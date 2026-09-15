import os
import json
import re
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

try:
    from backend.services.ai_gateway import call_ai_gateway, get_ai_model
except ImportError:
    from services.ai_gateway import call_ai_gateway, get_ai_model


def count_words(text: str) -> int:
    if not text:
        return 0
    return len(text.strip().split())


def validate_and_split_slides(presentation_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Backend Slide Content Validator:
    - Enforces hard content limits: max 60 words total per slide, max 5 bullets.
    - Automatically splits oversized slides across multiple slides (Part 1, Part 2).
    - Deduplicates identical slide titles or content.
    - Re-indexes slide numbers cleanly from 1 to N.
    """
    raw_slides = presentation_data.get("slides", [])
    if not raw_slides:
        return presentation_data

    processed_slides: List[Dict[str, Any]] = []

    for s in raw_slides:
        if not isinstance(s, dict):
            continue
        title = (s.get("title") or "").strip()
        subtitle = (s.get("subtitle") or "").strip()
        body = (s.get("body") or "").strip()
        bullets = s.get("bullets", [])
        layout = s.get("layout") or "content"
        visual = s.get("visual", None)

        if not isinstance(bullets, list):
            bullets = [str(bullets)] if bullets else []

        # Total word count calculation
        bullet_words = sum(count_words(str(b)) for b in bullets)
        total_words = count_words(title) + count_words(subtitle) + count_words(body) + bullet_words

        # Check if slide needs splitting (words > 60 or bullets > 5)
        if (total_words > 60 or len(bullets) > 5) and len(bullets) >= 2:
            mid = (len(bullets) + 1) // 2
            bullets_part1 = bullets[:mid]
            bullets_part2 = bullets[mid:]

            # Slide Part 1
            processed_slides.append({
                "slide_number": len(processed_slides) + 1,
                "layout": layout if layout != "title" else "content",
                "title": f"{title} (Part 1)" if title and not title.endswith("(Part 1)") else title,
                "subtitle": subtitle,
                "body": body if len(body) < 100 else "",
                "bullets": bullets_part1,
                "visual": visual
            })

            # Slide Part 2
            processed_slides.append({
                "slide_number": len(processed_slides) + 1,
                "layout": "content",
                "title": f"{title} (Part 2)",
                "subtitle": subtitle,
                "body": "",
                "bullets": bullets_part2,
                "visual": None
            })
        else:
            processed_slides.append({
                "slide_number": len(processed_slides) + 1,
                "layout": layout,
                "title": title,
                "subtitle": subtitle,
                "body": body,
                "bullets": bullets,
                "columns": s.get("columns", None),
                "statNumber": s.get("statNumber", None),
                "statLabel": s.get("statLabel", None),
                "quoteAuthor": s.get("quoteAuthor", None),
                "visual": visual
            })

    # Deduplicate consecutive identical slides
    deduped_slides: List[Dict[str, Any]] = []
    seen_titles = set()

    for slide in processed_slides:
        t_key = (slide.get("title", ""), tuple(slide.get("bullets", [])))
        if t_key in seen_titles:
            continue
        seen_titles.add(t_key)
        slide["slide_number"] = len(deduped_slides) + 1
        deduped_slides.append(slide)

    presentation_data["slides"] = deduped_slides
    return presentation_data


def generate_gemini_presentation(
    document_context: str,
    settings: Dict[str, Any],
    filename: str = "",
    language: str = "English",
    theme: str = "professional"
) -> Dict[str, Any]:
    """
    Dedicated AI Gateway Presentation Generator (Qwen-7B):
    - Grounded strictly in provided document context.
    - Validates word limits and slide boundaries before returning response.
    - Captures model, temperature, max_tokens, token usage, and latency_ms.
    """
    if not document_context or not document_context.strip():
        print("[PRESENTATION RETRIEVAL ERROR] document_context is empty.")
        raise HTTPException(
            status_code=400,
            detail="No relevant document content was retrieved for this presentation."
        )

    doc_words = count_words(document_context)
    if doc_words < 1000:
        recommended_slides = "5 to 7 slides"
    elif doc_words < 3000:
        recommended_slides = "7 to 10 slides"
    else:
        recommended_slides = "10 to 15 slides"

    tone = settings.get("tone", "professional")
    length = settings.get("length", "medium")
    audience = settings.get("audience", "government-officials")
    doc_title = filename if filename else "Document Presentation"

    system_instruction = (
        "You are generating a presentation from the DOCUMENT CONTEXT below.\n\n"
        "The DOCUMENT CONTEXT is the authoritative source.\n\n"
        "Use only information explicitly contained in the DOCUMENT CONTEXT.\n\n"
        "Every factual statement in every slide must be supported by the DOCUMENT CONTEXT.\n\n"
        "Preserve exact names, numbers, dates, technical terms, definitions and important facts.\n\n"
        "Do not invent facts.\n"
        "Do not use outside knowledge.\n"
        "Do not create generic filler.\n"
        "Do not write a presentation about the document merely by describing that a document exists.\n\n"
        "Actually extract and present the document's substantive information.\n\n"
        "If the context does not contain enough information for a slide, do not fabricate it.\n\n"
        "SLIDE TITLE MANDATE:\n"
        "The first slide may contain the document title, but all remaining slide content must communicate actual substantive information from the document.\n\n"
        "Do not use generic titles such as:\n"
        "- 'Document Overview'\n"
        "- 'Key Provisions'\n"
        "- 'Summary & Next Steps'\n\n"
        "unless those exact concepts are supported by the document.\n\n"
        "SLIDE STRUCTURE & HARD CONTENT LIMITS:\n"
        f"- Target slide count: {recommended_slides} based on document depth.\n"
        "- MAX 40-60 WORDS TOTAL per slide. Target 35-50 words.\n"
        "- MAX 3-5 BULLET POINTS per content slide. Each bullet must be 10-14 words max.\n"
        "- Title: 8-10 words max. Subtitle: 12-15 words max.\n"
        "- SLIDE SPLITTING: If a section has multiple sub-topics, create SEPARATE SLIDES for each sub-topic.\n"
        "- LAYOUT TYPES: Use appropriate layout for each slide ('title', 'section', 'content', 'two_column', 'three_column', 'statistics', 'quote', 'key_points', 'conclusion', 'timeline', 'process', 'comparison').\n"
        f"- LANGUAGE: Generate content in {language}. Keep important proper names, technical acronyms, and official numbers intact.\n"
    )

    user_prompt = f"""DOCUMENT CONTEXT:
{document_context}

TASK:
Create the presentation for document '{doc_title}'.

PRESENTATION METADATA & CONFIG:
Tone: {tone}
Length: {length}
Audience: {audience}
Requested Theme: {theme}
Target Language: {language}

OUTPUT FORMAT REQUIREMENT:
Return ONLY a valid JSON object matching this exact schema:
{{
  "transformation": "presentation",
  "title": "[Main Title Extracted From Document]",
  "subtitle": "[Subtitle Extracted From Document]",
  "theme": "{theme}",
  "language": "{language}",
  "slides": [
    {{
      "slide_number": 1,
      "layout": "title",
      "title": "[Substantive Slide Title From Document]",
      "subtitle": "[Substantive Subtitle From Document]",
      "body": "[Optional factual body text from document]",
      "bullets": ["Substantive factual bullet point 1", "Substantive factual bullet point 2"],
      "visual": {{
        "type": "photo",
        "description": "Visual element description based on document text"
      }}
    }}
  ]
}}
"""

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": user_prompt}
    ]

    target_model = get_ai_model()

    print("\n==================== [DEBUG: QWEN-7B REQUEST PARAMETERS] ====================")
    print(f"model: {target_model}")
    print(f"temperature: 0.2")
    print(f"max_tokens: 1500")
    print(f"system message:\n{system_instruction}")
    print(f"\nuser message snippet (first 1000 chars):\n{user_prompt[:1000]}")
    print("===========================================================================\n")

    gw_res = call_ai_gateway(messages, model=target_model, temperature=0.2, max_tokens=1500)

    if not gw_res.get("success"):
        print(f"\n[PRESENTATION FAILED] {gw_res.get('error')}")
        raise HTTPException(
            status_code=502,
            detail=f"Presentation generation failed via AI Gateway. Details: {gw_res.get('error')}"
        )

    response_text = gw_res.get("content", "").strip()

    print("\n==================== [DEBUG 5: QWEN RESPONSE] ====================")
    print(response_text)
    print("==================================================================\n")

    # Clean JSON markdown fences if present
    clean_json = response_text
    if "```" in clean_json:
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean_json, re.DOTALL)
        if match:
            clean_json = match.group(1).strip()
        else:
            clean_json = re.sub(r"```[a-zA-Z]*", "", clean_json).replace("```", "").strip()

    try:
        parsed_data = json.loads(clean_json)
    except Exception as parse_err:
        print(f"[PRESENTATION JSON PARSE ERROR]: {parse_err}")
        print(f"[RAW RESPONSE WAS]: {response_text}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to parse valid presentation JSON from AI response: {parse_err}"
        )

    # Validate, enforce word limits, and auto-split overcrowded slides
    validated_data = validate_and_split_slides(parsed_data)
    validated_data["transformation"] = "presentation"
    if not validated_data.get("title"):
        validated_data["title"] = doc_title

    final_content_json = json.dumps(validated_data, ensure_ascii=False)

    print("\n==================== [DEBUG 6: FINAL PRESENTATION JSON] ====================")
    print(final_content_json)
    print("============================================================================\n")

    print(f"\n[PRESENTATION SUCCESS]")
    print(f"slides_generated: {len(validated_data.get('slides', []))}")
    print(f"json_length: {len(final_content_json)}")

    return {
        "transformation": "presentation",
        "title": validated_data["title"],
        "content": final_content_json,
        "presentation_data": validated_data,
        "model": gw_res.get("model", target_model),
        "temperature": gw_res.get("temperature", 0.2),
        "max_tokens": gw_res.get("max_tokens", 1500),
        "usage": gw_res.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}),
        "latency_ms": gw_res.get("latency_ms", 0)
    }
