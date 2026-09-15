"""
Media Prompt Builder for Gemini Media Generation Engine.

Converts source document context, user media instructions, selected style,
aspect ratio, and visual constraints into clean, factually grounded Gemini media prompts.
"""

from typing import Dict, Any, Optional


def build_image_prompt(
    user_prompt: str,
    doc_context: str = "",
    options: Optional[Dict[str, Any]] = None
) -> str:
    """
    Constructs a Gemini image generation prompt.
    Ensures strict factual grounding if source document context is present.
    """
    options = options or {}
    style = options.get("style", "Professional")
    aspect_ratio = options.get("aspect_ratio", "16:9")
    quality = options.get("quality", "High Resolution")

    prompt_parts = []

    if doc_context and doc_context.strip():
        # Clean & truncate doc context to relevant facts
        cleaned_context = doc_context.strip()[:1500]
        prompt_parts.append(
            f"SOURCE DOCUMENT FACTS:\n{cleaned_context}\n"
            "GROUNDING REQUIREMENT: The image must visually represent ONLY details supported by the source document facts above. "
            "Do NOT invent unrelated people, places, organizations, dates, or statistics not mentioned in the text."
        )

    # Core user visual request
    user_instruction = user_prompt.strip() if user_prompt else "A professional digital visual representing the core topic."
    prompt_parts.append(f"VISUAL INSTRUCTION: {user_instruction}")

    # Visual Style and Specs
    prompt_parts.append(
        f"STYLE & COMPOSITION: Style: {style}. Aspect Ratio: {aspect_ratio}. Quality: {quality}. "
        "Create a clean, photorealistic, professional image with balanced lighting and high detail. Avoid text overlays or watermark artifacts."
    )

    return "\n\n".join(prompt_parts)


def build_video_prompt(
    user_prompt: str,
    doc_context: str = "",
    options: Optional[Dict[str, Any]] = None
) -> str:
    """
    Constructs a Gemini video generation prompt.
    Ensures strict factual grounding if source document context is present.
    """
    options = options or {}
    style = options.get("style", "Cinematic")
    aspect_ratio = options.get("aspect_ratio", "16:9")
    duration = options.get("duration", "5 seconds")

    prompt_parts = []

    if doc_context and doc_context.strip():
        cleaned_context = doc_context.strip()[:1500]
        prompt_parts.append(
            f"SOURCE DOCUMENT FACTS:\n{cleaned_context}\n"
            "GROUNDING REQUIREMENT: The video sequence must depict ONLY concepts and facts supported by the source document above. "
            "Do NOT add fabricated entities, fictional logos, or false data."
        )

    user_instruction = user_prompt.strip() if user_prompt else "A smooth cinematic video sequence capturing the key theme."
    prompt_parts.append(f"VIDEO SCENE INSTRUCTION: {user_instruction}")

    prompt_parts.append(
        f"CINEMATOGRAPHY & SPECS: Style: {style}. Duration: {duration}. Aspect Ratio: {aspect_ratio}. "
        "High-definition video, smooth camera motion, consistent frame rate, realistic lighting and textures."
    )

    return "\n\n".join(prompt_parts)
