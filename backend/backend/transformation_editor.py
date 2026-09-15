import json
import re
import time
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from fastapi import HTTPException

try:
    from backend.transformation_prompts import (
        get_transformation_key,
        clean_ai_preamble,
        enforce_twitter_length,
    )
    from backend.transformation_engine import call_llm
except ImportError:
    from transformation_prompts import (
        get_transformation_key,
        clean_ai_preamble,
        enforce_twitter_length,
    )
    from transformation_engine import call_llm


class TransformationEditRequest(BaseModel):
    document_id: str
    transformation_id: str
    current_output: Any
    instruction: str
    options: Optional[dict] = None


TRANSFORMATION_EDIT_INSTRUCTIONS: Dict[str, str] = {
    "summarize": (
        "Preserve the summary structure (Overview, Key Points, Important Numbers, Conclusion). "
        "Apply the requested modifications while maintaining concise factual accuracy."
    ),
    "executive-brief": (
        "Preserve executive brief structure (Executive Summary, Key Findings, Business & Operational Impact, Strategic Risks, Recommended Next Steps, Critical Metrics). "
        "Focus changes on leadership decision-making."
    ),
    "government-report": (
        "Preserve formal government report structure with clear headings, document info, background, findings, and recommendations."
    ),
    "presentation": (
        "Preserve slide format (Slide 1: Title, Subtitle, Slide 2:, etc.). "
        "If the instruction requests changes to a specific slide (e.g. 'Make slide 3 shorter'), modify ONLY that slide or section while keeping all other slides intact."
    ),
    "meeting-notes": (
        "Preserve structured meeting record format (Meeting Date, Participants, Overview, Key Discussions, Decisions, Action Items)."
    ),
    "action-items": (
        "Preserve action task register format with task descriptions, owner, due date, and priority tags."
    ),
    "email": (
        "Preserve complete email draft format with Subject line, Greeting, Body paragraphs, and Call to Action/Signature."
    ),
    "faq": (
        "Preserve Q&A format with Q1:, A1:, Q2:, A2: pairs. Add, remove, or modify questions as requested."
    ),
    "rewrite": (
        "Preserve clarity and professional rewrite formatting according to the instruction."
    ),
    "extract": (
        "Preserve structured bullet point key insights format."
    ),
    "linkedin": (
        "Preserve professional LinkedIn feed post structure with strong opening, body, and hashtag tags. Do NOT include conversational meta-intros."
    ),
    "linkedin-story": (
        "Preserve multi-slide vertical story narrative sequence (Slide 1:, Slide 2:, etc.). Do NOT include internal template labels."
    ),
    "twitter": (
        "STRICT LENGTH CONSTRAINT: The total character count MUST be 280 characters or fewer. Generate a sharp, concise update."
    ),
    "video-generation": (
        "LOCKED DURATION MANDATE: The video duration is strictly locked to 10 seconds (16:9). "
        "Do NOT output a 30-second script or multi-scene storyboard (Scene 1, Scene 2, etc.). "
        "Output ONE concise 10-second video prompt/script."
    ),
}


def build_edit_prompt(
    transformation_id: str,
    document_context: str,
    current_output: str,
    instruction: str,
    filename: str = ""
) -> str:
    norm_key = get_transformation_key(transformation_id)
    spec = TRANSFORMATION_EDIT_INSTRUCTIONS.get(
        norm_key,
        "Preserve the current transformation type and format while applying the user's edit instruction."
    )

    prompt = f"""You are ERA, an AI content transformation editor.
Your task is to EDIT an existing '{norm_key}' output based ONLY on the source document context provided below and the user's specific edit instruction.

SOURCE DOCUMENT CONTEXT:
--------------------------------------------------
{document_context}
--------------------------------------------------

CURRENT TRANSFORMATION OUTPUT ({norm_key}):
--------------------------------------------------
{current_output}
--------------------------------------------------

USER EDIT INSTRUCTION:
"{instruction}"

TRANSFORMATION SPECIFIC RULES:
{spec}

GLOBAL MANDATORY RULES:
1. Preserve the transformation type '{norm_key}'. Do NOT change this into a different transformation.
2. Strictly maintain factual grounding in the source document context. Do NOT introduce unsupported external facts.
3. Modify the current output according to the user's edit instruction.
4. Do NOT include conversational preambles like "Here is the edited summary...", "Based on context...", "As an AI...", or "According to the provided document...".
5. Start IMMEDIATELY with the edited transformation result.
"""
    return prompt


def validate_edited_output(edited_text: str, norm_key: str, instruction: str) -> str:
    """
    Validates output formatting, preambles, and length constraints.
    """
    if not edited_text or not edited_text.strip():
        raise ValueError("Edited output returned empty result.")

    clean_text = clean_ai_preamble(edited_text)

    # Check Twitter strict length
    if norm_key in ("twitter", "twitter_post"):
        clean_text = enforce_twitter_length(clean_text)
        if len(clean_text) > 280:
            clean_text = clean_text[:277] + "..."

    return clean_text


def execute_edit_transformation(
    document_id: str,
    transformation_id: str,
    current_output: Any,
    instruction: str,
    document_context: str,
    filename: str = "",
    options: Optional[dict] = None,
    retrieval_ms: int = 0
) -> Dict[str, Any]:
    """
    Executes Agent 2 Transformation Editor via Qwen 7B AI Gateway with Output Validation.
    Calculates stage-by-stage timing metrics.
    """
    start_time = time.time()
    norm_key = get_transformation_key(transformation_id)
    fn = filename or "Uploaded Document"

    # Normalize current_output to string if dict/json
    if isinstance(current_output, (dict, list)):
        current_output_str = json.dumps(current_output, indent=2)
    else:
        current_output_str = str(current_output)

    prompt = build_edit_prompt(
        transformation_id=norm_key,
        document_context=document_context,
        current_output=current_output_str,
        instruction=instruction,
        filename=fn
    )

    print(f"\n[EDIT TRANSFORM START] document_id={document_id} transformation_id={norm_key} instruction={instruction}")

    llm_start = time.time()
    llm_res = call_llm(norm_key, prompt, len(document_context), max_tokens=1000)
    llm_ms = int((time.time() - llm_start) * 1000)

    if not llm_res or not llm_res.get("content"):
        print(f"[EDIT TRANSFORM FAILED] LLM returned no response for edit.")
        raise HTTPException(
            status_code=502,
            detail=f"AI Gateway edit execution failed for '{norm_key}'. Ensure internal AI Gateway is running at http://172.16.10.110:4000/v1."
        )

    val_start = time.time()
    raw_response = llm_res["content"]

    try:
        validated_text = validate_edited_output(raw_response, norm_key, instruction)
    except Exception as err:
        print(f"[EDIT VALIDATOR WARN] Initial validation issue: {err}. Attempting secondary clean.")
        validated_text = clean_ai_preamble(raw_response)

    validation_ms = int((time.time() - val_start) * 1000)
    total_ms = int((time.time() - start_time) * 1000) + retrieval_ms

    title_map = {
        "summarize": f"Document Summary — {fn}",
        "executive-brief": f"Executive Brief — {fn}",
        "faq": f"Frequently Asked Questions — {fn}",
        "meeting-notes": f"Meeting Notes — {fn}",
        "rewrite": f"Rewritten Content — {fn}",
        "government-report": f"Government Report — {fn}",
        "action-items": f"Action Items — {fn}",
        "email": f"Email Draft — {fn}",
        "linkedin": f"LinkedIn Post — {fn}",
        "linkedin-story": f"LinkedIn Story — {fn}",
        "twitter": f"X Post — {fn}",
        "extract": f"Key Points — {fn}",
        "presentation": f"Presentation — {fn}",
    }

    title = title_map.get(norm_key, f"Transformation ({norm_key}) — {fn}")

    timing_breakdown = {
        "parsing_ms": 0,
        "embedding_ms": 0,
        "retrieval_ms": retrieval_ms,
        "llm_ms": llm_ms,
        "validation_ms": validation_ms,
        "total_ms": total_ms
    }

    print(f"\n[TIMING BREAKDOWN EDIT] transformation={norm_key} parsing=0ms embedding=0ms retrieval={retrieval_ms}ms llm={llm_ms}ms validation={validation_ms}ms total={total_ms}ms")

    return {
        "success": True,
        "document_id": document_id,
        "transformation_id": norm_key,
        "title": title,
        "content": validated_text,
        "metadata": {
            "instruction": instruction,
            "filename": fn,
            "edited": True,
        },
        "model": llm_res.get("model", "qwen-7b"),
        "temperature": llm_res.get("temperature", 0.2),
        "max_tokens": llm_res.get("max_tokens", 1000),
        "usage": llm_res.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}),
        "latency_ms": llm_res.get("latency_ms", llm_ms),
        "timing_ms": timing_breakdown,
        "parsing_ms": 0,
        "embedding_ms": 0,
        "retrieval_ms": retrieval_ms,
        "llm_ms": llm_ms,
        "validation_ms": validation_ms,
        "total_ms": total_ms
    }
