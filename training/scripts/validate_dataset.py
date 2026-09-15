#!/usr/bin/env python3
"""
Dataset Validator for ERA Llama 3.2 3B Fine-Tuning Pipeline
Validates JSONL syntax, chat structure, quality rules, and transformation integrity.
"""

import os
import sys
import json
import hashlib
import argparse
from typing import Dict, List, Tuple, Any

# Transformation types expected
VALID_TRANSFORMATIONS = {
    "summarize", "faq", "executive_brief", "report", "rewrite", "meeting_notes"
}

# Quality rules flag patterns (bad OCR, placeholders, generic responses)
BAD_OCR_PATTERNS = [
    "ideasprint", "l&t", "spsu", "jkcement", "ocr error", "scanned document",
    "summary of document", "summary...", "todo", "placeholder", "lorem ipsum",
    "insert document here", "[insert", "filename-only"
]

REQUIRED_ROLES = {"system", "user", "assistant"}


def check_example(example: Dict[str, Any], index: int, filename: str) -> List[str]:
    """
    Validates a single chat-style fine-tuning example against quality rules.
    Returns a list of error strings (empty if valid).
    """
    errors = []

    if not isinstance(example, dict):
        return [f"Line {index}: Example is not a valid JSON object."]

    if "messages" not in example or not isinstance(example["messages"], list):
        return [f"Line {index}: Missing or invalid 'messages' array."]

    messages = example["messages"]

    if len(messages) < 3:
        errors.append(f"Line {index}: Expected at least 3 messages (system, user, assistant), found {len(messages)}.")

    roles_found = set()
    role_content_map = {}

    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            errors.append(f"Line {index}, message {i}: Message is not a dict.")
            continue

        role = msg.get("role", "").strip().lower()
        content = msg.get("content", "").strip()

        roles_found.add(role)
        role_content_map[role] = content

        if not role:
            errors.append(f"Line {index}, message {i}: Missing or empty 'role'.")

        if not content:
            errors.append(f"Line {index}, message {i} ({role}): Message content is empty.")

    # Check for mandatory roles
    missing_roles = REQUIRED_ROLES - roles_found
    if missing_roles:
        errors.append(f"Line {index}: Missing required role(s): {', '.join(sorted(missing_roles))}.")

    # Check assistant response present
    assistant_content = role_content_map.get("assistant", "")
    if not assistant_content:
        errors.append(f"Line {index}: Assistant content is missing or empty.")

    user_content = role_content_map.get("user", "")
    system_content = role_content_map.get("system", "")

    # Extremely short examples check
    if len(user_content) < 40:
        errors.append(f"Line {index}: User content is extremely short ({len(user_content)} chars). Minimum 40 chars expected.")

    if len(assistant_content) < 30:
        errors.append(f"Line {index}: Assistant response is extremely short ({len(assistant_content)} chars). Minimum 30 chars expected.")

    # Bad OCR & Placeholder detection
    combined_text = (user_content + " " + assistant_content).lower()
    for bad_pattern in BAD_OCR_PATTERNS:
        if bad_pattern in combined_text:
            errors.append(f"Line {index}: Detected invalid pattern or bad OCR fragment: '{bad_pattern}'.")

    # Document context existence check in user message
    if "document" not in user_content.lower() and "context" not in user_content.lower():
        errors.append(f"Line {index}: User message does not explicitly present source document context.")

    return errors


def validate_file(filepath: str) -> Tuple[int, int, List[str], int]:
    """
    Validates a single dataset .jsonl file.
    Returns (total_count, valid_count, list_of_error_strings, duplicate_count)
    """
    errors = []
    seen_hashes = set()
    total = 0
    valid = 0
    duplicates = 0

    if not os.path.exists(filepath):
        return 0, 0, [f"File not found: {filepath}"], 0

    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue

            total += 1

            # JSON syntax check
            try:
                data = json.loads(line_str)
            except Exception as e:
                errors.append(f"{os.path.basename(filepath)} - Line {line_num}: Invalid JSON syntax: {e}")
                continue

            # Duplicate check
            line_hash = hashlib.md5(line_str.encode("utf-8")).hexdigest()
            if line_hash in seen_hashes:
                errors.append(f"{os.path.basename(filepath)} - Line {line_num}: Duplicate example detected.")
                duplicates += 1
                continue
            seen_hashes.add(line_hash)

            # Structure & Quality check
            item_errors = check_example(data, line_num, os.path.basename(filepath))
            if item_errors:
                for err in item_errors:
                    errors.append(f"{os.path.basename(filepath)} - {err}")
            else:
                valid += 1

    return total, valid, errors, duplicates


def main():
    parser = argparse.ArgumentParser(description="Validate ERA SFT Dataset JSONL Files")
    parser.add_argument("--dataset-dir", type=str, default="training/dataset", help="Path to dataset directory")
    args = parser.parse_args()

    dataset_dir = args.dataset_dir
    print(f"=" * 60)
    print(f"ERA DATASET VALIDATOR")
    print(f"Directory: {os.path.abspath(dataset_dir)}")
    print(f"=" * 60)

    if not os.path.exists(dataset_dir):
        print(f"[ERROR] Directory '{dataset_dir}' does not exist.")
        sys.exit(1)

    expected_files = [f"{t}.jsonl" for t in VALID_TRANSFORMATIONS]
    total_all = 0
    valid_all = 0
    errors_all = []
    duplicates_all = 0

    file_summary = {}

    for fname in sorted(expected_files):
        fpath = os.path.join(dataset_dir, fname)
        tot, val, errs, dups = validate_file(fpath)
        total_all += tot
        valid_all += val
        duplicates_all += dups
        errors_all.extend(errs)
        file_summary[fname] = {"total": tot, "valid": val, "invalid": tot - val, "duplicates": dups}

    print("\n--- DATASET SUMMARY BY TRANSFORMATION TYPE ---")
    for fname, counts in file_summary.items():
        status = "PASSED" if counts["invalid"] == 0 and counts["total"] > 0 else ("EMPTY" if counts["total"] == 0 else "FAILED")
        print(f"  [{status}] {fname:<25} Total: {counts['total']:<4} Valid: {counts['valid']:<4} Invalid: {counts['invalid']:<4} Duplicates: {counts['duplicates']:<4}")

    print(f"\n--- OVERALL VALIDATION SUMMARY ---")
    print(f"  Total Examples Analyzed: {total_all}")
    print(f"  Valid Examples:          {valid_all}")
    print(f"  Invalid/Error Examples:  {total_all - valid_all}")
    print(f"  Duplicates Detected:     {duplicates_all}")

    if errors_all:
        print(f"\n--- DETAILED VALIDATION ERRORS ({len(errors_all)}) ---")
        for err in errors_all[:20]:  # Limit output to 20
            print(f"  ❌ {err}")
        if len(errors_all) > 20:
            print(f"  ... and {len(errors_all) - 20} more errors.")
        print("\n❌ VALIDATION FAILED: Correct errors in dataset files before training.")
        sys.exit(1)
    else:
        print("\n✅ DATASET VALIDATION PASSED: All training dataset files satisfy ERA quality rules!")
        sys.exit(0)


if __name__ == "__main__":
    main()
