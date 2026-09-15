# ERA — Llama 3.2 3B Supervised Fine-Tuning (SFT) Pipeline

This directory contains the dataset preparation, validation, training configuration, baseline evaluation, and deployment workflow for fine-tuning **Llama 3.2 3B Instruct** using QLoRA for the ERA document transformation platform.

---

## 1. Pipeline Architecture & Directory Layout

```
training/
├── dataset/
│   ├── summarize.jsonl          # Summarization transformation examples
│   ├── faq.jsonl                # Structured Q&A transformation examples
│   ├── executive_brief.jsonl    # Executive Brief transformation examples
│   ├── report.jsonl             # Formal Report transformation examples
│   ├── rewrite.jsonl            # Tone & Clarity Rewrite examples
│   ├── meeting_notes.jsonl      # Structured Meeting Notes examples
│   └── split/                   # Generated train/val/test splits
│       ├── train.jsonl
│       ├── validation.jsonl
│       └── test.jsonl
├── scripts/
│   ├── validate_dataset.py      # Syntax, quality, OCR & role validator
│   ├── split_dataset.py         # Leakage-free dataset splitter (80/10/10)
│   ├── train_lora.py            # QLoRA SFT training script (SFTTrainer + PEFT)
│   └── evaluate.py             # Baseline vs Fine-Tuned benchmarking script
├── configs/
│   └── llama32_3b_qlora.yaml    # QLoRA & SFT hyperparameter configuration
├── outputs/
│   └── llama32_3b_era_lora/    # Trained LoRA adapter output directory
├── evaluation/
│   └── baseline_vs_finetuned.md # Markdown evaluation report
├── requirements.txt             # PyTorch, Transformers, TRL, PEFT dependencies
└── README.md                    # Pipeline documentation
```

---

## 2. Dataset Quality & Format Rules

All training examples strictly adhere to chat-style supervised fine-tuning format:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are ERA, an AI content transformation assistant..."
    },
    {
      "role": "user",
      "content": "Create a concise summary from the following document...\n\nDOCUMENT:\n<real complete text>"
    },
    {
      "role": "assistant",
      "content": "<ideal high-quality grounded output>"
    }
  ]
}
```

### Strict Quality Constraints:
1. **Source Document Grounding:** Source context must contain complete, meaningful document text.
2. **No OCR Fragments:** Fragments containing isolated terms (e.g. `IDEASPRINT`, `L&T`) without document context are prohibited.
3. **Explicit Format Contracts:** FAQ responses must strictly use `Q1.` and `A1.`, Executive Briefs must contain standard executive headings, and Rewrites must preserve all original facts and figures.
4. **Zero Hallucinations:** Assistant outputs must never invent dates, metrics, people, or external assumptions.

---

## 3. Dataset Validation & Splitting Commands

### Validate Dataset Quality & Syntax
```bash
python3 training/scripts/validate_dataset.py --dataset-dir training/dataset
```

### Generate Leakage-Free Train / Validation / Test Splits (80% / 10% / 10%)
```bash
python3 training/scripts/split_dataset.py --input-dir training/dataset --output-dir training/dataset/split
```

---

## 4. Hardware Environment Requirements

- **Local Development Environment:** Apple Silicon M2 (MacBook Pro, 8 GB Unified RAM).
  - *Note:* QLoRA 4-bit CUDA quantization (`bitsandbytes`) and loading Llama 3.2 3B weights requires 12 GB–16 GB+ VRAM.
  - Local macOS environment uses `--dry-run` modes to validate scripts and configurations without hardware crashes.
- **Cloud / GPU Training Host:** NVIDIA T4 / A10G / A100 / Colab / RunPod / Vertex AI running PyTorch with CUDA 12.x.

---

## 5. Model Fine-Tuning Execution

### Run Training Pipeline (Dry-Run / Config Validation)
```bash
python3 training/scripts/train_lora.py --config training/configs/llama32_3b_qlora.yaml --dry-run
```

### Execute Full QLoRA Fine-Tuning (On CUDA GPU Instance)
```bash
pip install -r training/requirements.txt
python3 training/scripts/train_lora.py --config training/configs/llama32_3b_qlora.yaml
```

The training script saves the LoRA adapter weights and tokenizer to `training/outputs/llama32_3b_era_lora/` separately from the base model.

---

## 6. Baseline vs Fine-Tuned Model Evaluation

Run benchmark evaluation comparing the base `meta-llama/Llama-3.2-3B-Instruct` model against the ERA fine-tuned model across unseen test cases:

```bash
python3 training/scripts/evaluate.py --test-file training/dataset/split/test.jsonl --report-file training/evaluation/baseline_vs_finetuned.md
```

Evaluation scores outputs across 7 core metrics: Grounding, Factual Accuracy, Completeness, Format Adherence, Structure, Hallucination Penalty, and Instruction Following.

---

## 7. Ollama Integration Strategy (Post-Training)

After training and evaluation sign-off, export and deploy the model to the active ERA backend:

1. **Merge Base Model & LoRA Adapter:**
   ```python
   from peft import PeftModel
   from transformers import AutoModelForCausalLM, AutoTokenizer

   base_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
   model = PeftModel.from_pretrained(base_model, "training/outputs/llama32_3b_era_lora")
   merged_model = model.merge_and_unload()
   merged_model.save_pretrained("training/outputs/era_llama32_3b_merged")
   ```

2. **Convert to GGUF Format via `llama.cpp`:**
   ```bash
   python llama.cpp/convert_hf_to_gguf.py training/outputs/era_llama32_3b_merged --outfile training/outputs/era-llama3.2.gguf --outtype q4_k_m
   ```

3. **Create Ollama `Modelfile`:**
   ```dockerfile
   FROM ./training/outputs/era-llama3.2.gguf
   PARAMETER temperature 0.2
   PARAMETER top_p 0.9
   SYSTEM """You are ERA, an AI content transformation assistant."""
   ```

4. **Register Model with Local Ollama Engine:**
   ```bash
   ollama create era-llama3.2 -f Modelfile
   ```

5. **Update Backend Configuration:**
   Update `MODEL_NAME = "era-llama3.2"` inside [`transformation_engine.py`](file:///Users/harshchhabra/Downloads/ai-content-transformation-platform-cleaned%20%281%29%20%281%29/backend/backend/transformation_engine.py).
