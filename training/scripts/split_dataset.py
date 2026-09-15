#!/usr/bin/env python3
"""
Dataset Splitter for ERA Llama 3.2 3B Fine-Tuning Pipeline
Splits validated transformation examples into train (80%), validation (10%), and test (10%) splits.
Prevents document leakage across splits by grouping by source document context.
"""

import os
import sys
import json
import random
import hashlib
import argparse
from typing import Dict, List, Any


def extract_doc_key(user_content: str) -> str:
    """
    Extracts a document key/hash from user content to prevent context leakage across splits.
    """
    # Look for Document Title if present
    lines = user_content.splitlines()
    for line in lines:
        if "title:" in line.lower() or "document:" in line.lower():
            return hashlib.md5(line.strip().lower().encode("utf-8")).hexdigest()
    
    # Fallback to hash of the first 200 characters of context
    return hashlib.md5(user_content[:200].lower().encode("utf-8")).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Split ERA SFT Dataset into Train/Val/Test")
    parser.add_argument("--input-dir", type=str, default="training/dataset", help="Path to input dataset directory")
    parser.add_argument("--output-dir", type=str, default="training/dataset/split", help="Path to save split files")
    parser.add_argument("--train-ratio", type=float, default=0.8, help="Train ratio (default: 0.8)")
    parser.add_argument("--val-ratio", type=float, default=0.1, help="Validation ratio (default: 0.1)")
    parser.add_argument("--test-ratio", type=float, default=0.1, help="Test ratio (default: 0.1)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    assert abs((args.train_ratio + args.val_ratio + args.test_ratio) - 1.0) < 1e-5, "Ratios must sum to 1.0"

    random.seed(args.seed)
    os.makedirs(args.output_dir, exist_ok=True)

    print(f"=" * 60)
    print(f"ERA DATASET SPLITTER")
    print(f"Input Directory:  {os.path.abspath(args.input_dir)}")
    print(f"Output Directory: {os.path.abspath(args.output_dir)}")
    print(f"Split Ratio:      {args.train_ratio*100:.0f}% Train | {args.val_ratio*100:.0f}% Val | {args.test_ratio*100:.0f}% Test")
    print(f"=" * 60)

    # Collect examples grouped by document key
    doc_groups: Dict[str, List[Dict[str, Any]]] = {}
    all_files = [f for f in os.listdir(args.input_dir) if f.endswith(".jsonl") and not f.startswith("train") and not f.startswith("val") and not f.startswith("test")]

    total_examples = 0
    for fname in sorted(all_files):
        fpath = os.path.join(args.input_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    ex = json.loads(line)
                    user_text = ex["messages"][1]["content"] if len(ex.get("messages", [])) > 1 else ""
                    doc_key = extract_doc_key(user_text)
                    if doc_key not in doc_groups:
                        doc_groups[doc_key] = []
                    doc_groups[doc_key].append(ex)
                    total_examples += 1
                except Exception as e:
                    print(f"[WARN] Failed to parse line in {fname}: {e}")

    print(f"\nCollected {total_examples} total examples across {len(doc_groups)} unique document contexts.")

    # Shuffle document groups
    doc_keys = list(doc_groups.keys())
    random.shuffle(doc_keys)

    train_examples, val_examples, test_examples = [], [], []

    # If small dataset (e.g. initial seed examples), ensure every split gets at least 1 example if total >= 3
    if total_examples <= 12:
        # Round-robin allocation for small datasets to guarantee test and val items
        for i, dk in enumerate(doc_keys):
            group = doc_groups[dk]
            if i % 10 == 8:
                val_examples.extend(group)
            elif i % 10 == 9:
                test_examples.extend(group)
            else:
                train_examples.extend(group)
        # Fallback if val or test is empty
        if not test_examples and len(train_examples) > 1:
            test_examples.append(train_examples.pop())
        if not val_examples and len(train_examples) > 1:
            val_examples.append(train_examples.pop())
    else:
        for dk in doc_keys:
            group = doc_groups[dk]
            r = random.random()
            if r < args.train_ratio:
                train_examples.extend(group)
            elif r < args.train_ratio + args.val_ratio:
                val_examples.extend(group)
            else:
                test_examples.extend(group)

    # Save output splits
    splits = {
        "train.jsonl": train_examples,
        "validation.jsonl": val_examples,
        "test.jsonl": test_examples
    }

    for s_name, s_data in splits.items():
        s_path = os.path.join(args.output_dir, s_name)
        with open(s_path, "w", encoding="utf-8") as f:
            for item in s_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"  Saved {s_name:<20}: {len(s_data)} examples -> {s_path}")

    print("\n✅ DATASET SPLIT COMPLETE: Train, Validation, and Test sets generated without context leakage.")


if __name__ == "__main__":
    main()
