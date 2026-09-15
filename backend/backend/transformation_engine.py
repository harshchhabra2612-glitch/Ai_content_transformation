import os
import time
from typing import Dict, Any, Optional
from fastapi import HTTPException

try:
    from backend.transformation_prompts import get_transformation_prompt, get_transformation_key, clean_ai_preamble, enforce_twitter_length
    from backend.services.ai_gateway import call_ai_gateway, get_ai_model
except ImportError:
    from transformation_prompts import get_transformation_prompt, get_transformation_key, clean_ai_preamble, enforce_twitter_length
    from services.ai_gateway import call_ai_gateway, get_ai_model


def call_llm(transformation: str, prompt: str, context_length: int, max_tokens: int = 1000) -> Optional[Dict[str, Any]]:
    """
    Executes the LLM call via the internal Hackathon AI Gateway using Qwen 7B (qwen-7b).
    Captures prompt_tokens, completion_tokens, total_tokens, latency_ms, temperature, and max_tokens.
    """
    model_name = get_ai_model()
    print(f"\n[LLM CALL START]")
    print(f"transformation: {transformation}")
    print(f"model: {model_name}")
    print(f"context_length: {context_length}")

    messages = [
        {"role": "system", "content": "You are ERA, an advanced AI content transformation engine."},
        {"role": "user", "content": prompt}
    ]

    try:
        gw_res = call_ai_gateway(
            messages=messages,
            model=model_name,
            temperature=0.2,
            max_tokens=max_tokens
        )
        if gw_res.get("success"):
            content = gw_res.get("content", "").strip()
            print(f"[LLM CALL COMPLETE] model={model_name} response_len={len(content)} usage={gw_res.get('usage')} latency={gw_res.get('latency_ms')}ms")
            return {
                "content": content,
                "model": gw_res.get("model", model_name),
                "temperature": gw_res.get("temperature", 0.2),
                "max_tokens": gw_res.get("max_tokens", max_tokens),
                "usage": gw_res.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}),
                "latency_ms": gw_res.get("latency_ms", 0)
            }
        else:
            print(f"[LLM CALL FAILED] Reason: {gw_res.get('error')}")
            return None
    except Exception as e:
        print(f"[LLM CALL EXCEPTION] Reason: {e}")
        return None


def generate_transformation(
    document_context: str,
    transformation: str,
    settings: Dict[str, Any],
    filename: str = "",
    retrieval_ms: int = 0,
    parsing_ms: int = 0,
    embedding_ms: int = 0
) -> Dict[str, Any]:
    """
    Central Transformation Dispatcher.
    Routes each transformation ID explicitly to its specific prompt and Qwen 7B execution logic.
    Calculates complete stage-by-stage timing: parsing_ms, embedding_ms, retrieval_ms, llm_ms, validation_ms, total_ms.
    """
    start_time = time.time()

    if not document_context or not document_context.strip():
        raise HTTPException(
            status_code=400,
            detail="No document content was retrieved for this request."
        )

    trans_key = get_transformation_key(transformation)
    fn = filename or "Uploaded Document"

    prompt = get_transformation_prompt(
        transformation_id=trans_key,
        formatting_config=f"Tone: {settings.get('tone', 'professional')}, Length: {settings.get('length', 'medium')}",
        retrieved_context=document_context
    )

    max_tokens = 1500 if trans_key in ("government-report", "government_report", "presentation") else 1000

    llm_start = time.time()
    llm_res = call_llm(trans_key, prompt, len(document_context), max_tokens=max_tokens)
    llm_ms = int((time.time() - llm_start) * 1000)

    if not llm_res or not llm_res.get("content"):
        raise HTTPException(
            status_code=502,
            detail=f"Qwen 4B generation failed for transformation '{trans_key}'. Ensure Hackathon AI Gateway is running at http://172.16.10.110:4000/v1."
        )

    val_start = time.time()
    answer = llm_res["content"]

    # Clean generic AI preamble
    clean_answer = clean_ai_preamble(answer)

    # Strict Twitter/X Post <= 280 length constraint enforcement
    if trans_key in ("twitter", "twitter_post"):
        clean_answer = enforce_twitter_length(clean_answer)

    validation_ms = int((time.time() - val_start) * 1000)
    total_ms = int((time.time() - start_time) * 1000) + retrieval_ms + parsing_ms + embedding_ms

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
    }

    title = title_map.get(trans_key, f"Transformation ({trans_key}) — {fn}")

    timing_breakdown = {
        "parsing_ms": parsing_ms,
        "embedding_ms": embedding_ms,
        "retrieval_ms": retrieval_ms,
        "llm_ms": llm_ms,
        "validation_ms": validation_ms,
        "total_ms": total_ms
    }

    print(f"\n[TIMING BREAKDOWN] transformation={trans_key} parsing={parsing_ms}ms embedding={embedding_ms}ms retrieval={retrieval_ms}ms llm={llm_ms}ms validation={validation_ms}ms total={total_ms}ms")

    return {
        "transformation": trans_key,
        "title": title,
        "content": clean_answer,
        "model": llm_res.get("model", "qwen-7b"),

        "temperature": llm_res.get("temperature", 0.2),
        "max_tokens": llm_res.get("max_tokens", max_tokens),
        "usage": llm_res.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}),
        "latency_ms": llm_res.get("latency_ms", llm_ms),
        "timing_ms": timing_breakdown,
        "parsing_ms": parsing_ms,
        "embedding_ms": embedding_ms,
        "retrieval_ms": retrieval_ms,
        "llm_ms": llm_ms,
        "validation_ms": validation_ms,
        "total_ms": total_ms
    }
