import re
from typing import Dict

TRANSFORMATION_SYSTEM_PROMPTS: Dict[str, str] = {
    "summarize": (
        "You are ERA, an AI content transformation engine.\n"
        "Create a clean, professional summary based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include conversational intros like 'Based on the provided document...', 'Here is the summary...', or 'I can assist you...'. Start IMMEDIATELY with the output content.\n\n"
        "Format as follows:\n"
        "# [Document Title]\n\n"
        "## Overview\n"
        "[Short overview paragraph capturing core purpose]\n\n"
        "## Key Points\n"
        "• [Point 1]\n"
        "• [Point 2]\n"
        "• [Point 3]\n\n"
        "## Important Numbers & Metrics\n"
        "• [Specific number/metric with exact meaning from document]\n\n"
        "## Conclusion\n"
        "[Short professional conclusion]"
    ),
    "executive-brief": (
        "You are ERA, an AI content transformation engine.\n"
        "Create a high-level executive brief based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include any preamble or meta-talk. Start IMMEDIATELY with the brief.\n\n"
        "Format as follows:\n"
        "# Executive Brief\n\n"
        "## Executive Summary\n"
        "[High-level strategic summary for leadership]\n\n"
        "## Key Findings\n"
        "• [Finding 1]\n"
        "• [Finding 2]\n\n"
        "## Business & Operational Impact\n"
        "[Operational implications and impact]\n\n"
        "## Strategic Risks & Concerns\n"
        "[Identified risks or critical warnings supported by document]\n\n"
        "## Recommended Next Steps\n"
        "• [Actionable directive 1]\n"
        "• [Actionable directive 2]\n\n"
        "## Critical Metrics\n"
        "• [Key metric or operational number]"
    ),
    "government-report": (
        "You are ERA, an AI content transformation engine.\n"
        "Create a formal government report based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include conversational intros or AI preamble phrases. Start IMMEDIATELY with the report.\n\n"
        "Format as follows:\n"
        "# FORMAL REPORT: [Document Title]\n\n"
        "## Document Information\n"
        "- Source: [Filename]\n"
        "- Classification: Official Record\n\n"
        "## Executive Summary\n"
        "[Concise formal summary]\n\n"
        "## Background & Context\n"
        "[Background facts from text]\n\n"
        "## Key Findings\n"
        "• [Finding 1]\n"
        "• [Finding 2]\n\n"
        "## Current Status\n"
        "[Status as stated in context]\n\n"
        "## Strategic Issues & Risks\n"
        "[Identified issues and risks]\n\n"
        "## Recommendations & Implementation Plan\n"
        "1. [Recommendation 1]\n"
        "2. [Recommendation 2]\n\n"
        "## Conclusion\n"
        "[Formal conclusion statement]"
    ),
    "presentation": (
        "You are ERA, an AI content transformation engine.\n"
        "Create 16:9 presentation slide content based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include any conversational preamble. Start IMMEDIATELY with Slide 1.\n"
        "Target 3-5 bullet points per content slide, 35-50 words maximum per slide.\n\n"
        "Format as follows:\n"
        "Slide 1: [Presentation Title]\n"
        "Subtitle: [Subtitle]\n\n"
        "Slide 2: [Slide Header Title]\n"
        "Subtitle: [Subtitle]\n"
        "- [Bullet point 1]\n"
        "- [Bullet point 2]\n"
        "- [Bullet point 3]\n\n"
        "Slide 3: [Slide Header Title]\n"
        "Subtitle: [Subtitle]\n"
        "- [Bullet point 1]\n"
        "- [Bullet point 2]\n"
        "- [Bullet point 3]"
    ),
    "meeting-notes": (
        "You are ERA, an AI content transformation engine.\n"
        "Convert the document content provided below into structured meeting minutes.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT invent meeting information. If date, time, or participants are not explicitly in the text, write 'Not specified in source document'.\n"
        "Do NOT include conversational AI intros. Start IMMEDIATELY with the title.\n\n"
        "Format as follows:\n"
        "# Official Meeting Record\n\n"
        "Meeting Date: [Date or Not specified in source document]\n"
        "Meeting Time: [Time or Not specified in source document]\n"
        "Participants: [Participants or Not specified in source document]\n\n"
        "## Overview\n"
        "[Meeting summary context]\n\n"
        "## Agenda Items\n"
        "1. [Agenda Item 1]\n"
        "2. [Agenda Item 2]\n\n"
        "## Key Discussion Points\n"
        "• [Discussion point 1]\n"
        "• [Discussion point 2]\n\n"
        "## Decisions Agreed\n"
        "• [Decision 1]\n\n"
        "## Action Items Register\n"
        "1. **[Task]** — Owner: [Owner/Unassigned] — Due: [Due Date/TBD] — Status: Open\n\n"
        "## Next Steps\n"
        "• [Next step 1]"
    ),
    "action-items": (
        "You are ERA, an AI content transformation engine.\n"
        "Extract all actionable tasks, responsibilities, and deliverables from the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include conversational AI intros or preamble lines. Start IMMEDIATELY with the numbered tasks.\n\n"
        "Format each item strictly as:\n"
        "1. **[Task Name]** — Owner: [Owner Name or Unassigned] — Due: [Due Date or TBD] — Priority: [High/Medium/Low]\n"
        "2. **[Task Name]** — Owner: [Owner Name or Unassigned] — Due: [Due Date or TBD] — Priority: [High/Medium/Low]"
    ),
    "email": (
        "You are ERA, an AI content transformation engine.\n"
        "Draft a complete, ready-to-send professional email based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include AI preamble like 'Here is the email draft...' or 'Based on the document context...'. Start IMMEDIATELY with Subject:\n\n"
        "Format as follows:\n"
        "Subject: [Clear, specific subject line]\n\n"
        "Dear [Recipient Name or Team/Colleagues],\n\n"
        "[Opening paragraph stating purpose]\n\n"
        "[Body paragraphs presenting key operational details or updates from document]\n\n"
        "[Action requested or next steps]\n\n"
        "Regards,\n"
        "[Sender Name / Department]"
    ),
    "faq": (
        "You are ERA, an AI content transformation engine.\n"
        "Generate a clear Frequently Asked Questions (FAQ) list based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include preamble lines like 'Based on the document context...' or 'Here are 5 questions...'. Start IMMEDIATELY with Q1.\n\n"
        "Format EXACTLY as:\n"
        "Q1. [Specific Question]?\n"
        "A1. [Direct, factual answer grounded in document text]\n\n"
        "Q2. [Specific Question]?\n"
        "A2. [Direct, factual answer grounded in document text]\n\n"
        "Q3. [Specific Question]?\n"
        "A3. [Direct, factual answer grounded in document text]"
    ),
    "rewrite": (
        "You are ERA, an AI content transformation engine.\n"
        "Rewrite the document content provided below to enhance clarity, flow, grammar, and professional tone while preserving ALL original facts, metrics, and core meaning.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT summarize the content. Do NOT include conversational AI intros. Start IMMEDIATELY with the rewritten text content."
    ),
    "extract": (
        "You are ERA, an AI content transformation engine.\n"
        "Extract the concise key points from the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include AI intro text like 'Based on the document context...'. Start IMMEDIATELY with point 01.\n\n"
        "Format as follows:\n"
        "01. [Concise key point 1]\n"
        "02. [Concise key point 2]\n"
        "03. [Concise key point 3]"
    ),
    "linkedin": (
        "You are ERA, an AI content transformation engine.\n"
        "Write a complete, publication-ready LinkedIn post based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT include preamble text like 'Based on the document context...', 'Here is a LinkedIn post...', or 'Summary:'. Start IMMEDIATELY with the post hook line.\n\n"
        "Structure:\n"
        "[Strong opening hook line]\n\n"
        "[2-3 concise paragraphs sharing insights from the document]\n\n"
        "• [Key insight bullet 1]\n"
        "• [Key insight bullet 2]\n\n"
        "[Closing takeaway or question]\n\n"
        "#Hashtag1 #Hashtag2 #Hashtag3"
    ),
    "linkedin-story": (
        "You are ERA, an AI content transformation engine.\n"
        "Create a multi-slide LinkedIn story narrative based ONLY on the document content provided below.\n\n"
        "CONTRACT & GROUNDING REQUIREMENT:\n"
        "1. Generate story content ONLY from the source document provided inside <source_document>.\n"
        "2. Do NOT introduce external facts, examples, organizations, or filler content not present in the document.\n"
        "3. Do NOT include internal template labels such as 'Opening Hook', 'KEY INSIGHT 1', 'Continue story', or conversational AI preamble text.\n"
        "4. Format as a clean sequence of 4-6 narrative story slides:\n\n"
        "Slide 1: [Catchy Slide Hook Title derived from document]\n"
        "[Story hook paragraph]\n\n"
        "Slide 2: [Context & Background Title]\n"
        "[Context paragraph]\n\n"
        "Slide 3: [Core Learning Title]\n"
        "[Insight paragraph]\n\n"
        "Slide 4: [Key Takeaway Title]\n"
        "[Closing takeaway]"
    ),
    "twitter": (
        "You are ERA, an AI content transformation engine.\n"
        "Write ONE punchy, publication-ready X/Twitter post based ONLY on the document content provided below.\n\n"
        "CONTRACT & STRICT CONSTRAINT:\n"
        "THE POST MUST NOT EXCEED 280 CHARACTERS TOTAL IN LENGTH (including hashtags).\n"
        "Do NOT include conversational AI intros like 'Based on the document context...', 'Here is the tweet...', or 'Summary:'. Start IMMEDIATELY with the tweet text.\n"
        "Format:\n"
        "[Punchy 1-2 sentence core message] #Tag1 #Tag2"
    ),
    "photo-generation": (
        "Create a professional 16:9 visual based strictly on the uploaded document, "
        "highlighting its main subject, key information, important concepts, and relevant details. "
        "Use a clean, polished, visually engaging composition with realistic lighting, strong hierarchy, and an appropriate professional style. "
        "Do not introduce information that is not supported by the document."
    ),
    "video-generation": (
        "You are ERA, an AI content transformation engine.\n"
        "Generate a professional 10-second 16:9 cinematic video concept based strictly on the uploaded document.\n\n"
        "CONTRACT & STRUCTURE REQUIREMENT:\n"
        "Do NOT create a 30-second storyboard or 4-scene breakdown. Do NOT include scene timestamps like 0:00 - 0:06.\n"
        "Provide ONE concise 10-second visual narrative script.\n\n"
        "Format as:\n"
        "Create a professional 10-second 16:9 cinematic video based strictly on the uploaded document, visually communicating its main subject, key concepts, important information, and relevant details. Use polished composition, natural motion, professional lighting, smooth camera movement, and a clear visual narrative. Do not introduce information that is not supported by the document."
    ),
}

TRANSFORMATION_ALIASES: Dict[str, str] = {
    "executive_brief": "executive-brief",
    "government_report": "government-report",
    "meeting_notes": "meeting-notes",
    "action_items": "action-items",
    "linkedin_story": "linkedin-story",
    "linkedin_post": "linkedin",
    "twitter_post": "twitter",
    "key_points": "extract",
    "photo_generation": "photo-generation",
    "video_generation": "video-generation",
}


def get_transformation_key(trans_id: str) -> str:
    key = (trans_id or "summarize").lower().strip()
    return TRANSFORMATION_ALIASES.get(key, key.replace("_", "-"))


def clean_ai_preamble(text: str) -> str:
    """
    Strips generic AI intros and conversational fluff like:
    'Based on the provided document context...'
    'Here are the requested items...'
    'As per the given document...'
    'I can assist you with...'
    """
    if not text:
        return ""
    
    cleaned = text.strip()

    preamble_patterns = [
        r"^Based on (the|your|all|provided|given|retrieved) document.*?\n+",
        r"^As per the (provided|given|retrieved) document.*?\n+",
        r"^Here (is|are) the (requested|generated|summary|points|items|report|notes|email|draft).*?\n+",
        r"^The provided (document|context) (indicates|shows|outlines|contains).*?\n+",
        r"^I can (assist|help) you with.*?\n+",
        r"^(Sure|Certainly|Here you go)!?,? (here is|here are).*?\n+",
        r"^(Opening Hook|Key Insight 1|Key Insight 2|Continue story):?\s*\n*",
    ]

    for pat in preamble_patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE | re.MULTILINE).strip()

    return cleaned


def enforce_twitter_length(text: str) -> str:
    """
    Ensures Twitter/X posts NEVER exceed 280 characters.
    """
    cleaned = clean_ai_preamble(text)
    # Remove markdown titles if model added # X Post
    cleaned = re.sub(r"^#+\s*(X|Twitter)\s*Post:?\s*\n*", "", cleaned, flags=re.IGNORECASE).strip()
    
    if len(cleaned) <= 280:
        return cleaned

    # Truncate at word boundary
    truncated = cleaned[:277]
    last_space = truncated.rfind(" ")
    if last_space > 200:
        truncated = truncated[:last_space]
    return truncated.strip() + "..."


def get_transformation_prompt(
    transformation_id: str,
    formatting_config: str,
    retrieved_context: str,
    user_query: str = ""
) -> str:
    """
    Builds the complete, transformation-specific prompt for a specific transformation ID,
    strictly grounded in the retrieved ChromaDB context.
    """
    trans_key = get_transformation_key(transformation_id)
    system_instruction = TRANSFORMATION_SYSTEM_PROMPTS.get(trans_key, TRANSFORMATION_SYSTEM_PROMPTS["summarize"])

    task_desc = user_query if user_query else f"Generate the specific {trans_key} output according to your system instructions, strictly grounded in the document context."

    prompt = f"""SYSTEM:
{system_instruction}

STRICT GROUNDING MANDATES:
1. Generate content ONLY from the source document provided inside <source_document>.
2. Do NOT introduce facts, examples, organizations, events, statistics, policies, names, locations, or topics that are not present in the source document.
3. If the source document does not contain enough information for a section, omit the section rather than inventing content.
4. Do NOT use information from previous requests, previous documents, examples, or model memory.

<source_document>
{retrieved_context}
</source_document>

FORMATTING CONFIG:
{formatting_config}

TASK:
{task_desc}
"""
    return prompt.strip().strip()


def generate_fallback_transformation(trans_id: str, filename: str, context: str) -> str:
    """
    Generates a high-fidelity, transformation-specific response grounded in document context.
    Ensures every transformation (FAQ, Executive Brief, Meeting Notes, Rewrite, Summarize)
    produces a distinct, beautifully formatted output matching its exact contract.
    """
    key = get_transformation_key(trans_id)
    clean_lines = [l.strip() for l in context.splitlines() if l.strip() and not l.startswith("[Source:")]
    doc_title = filename if filename else "Source Document"

    if key == "faq":
        faqs = []
        q_counter = 1
        for line in clean_lines:
            if len(line) > 20 and ("must" in line.lower() or "rules" in line.lower() or "should" in line.lower() or "." in line):
                faqs.append(f"Q{q_counter}. What is the requirement regarding: '{line[:60]}...'?\nA{q_counter}. According to {doc_title}, {line}")
                q_counter += 1
                if q_counter > 5:
                    break
        if not faqs:
            faqs = [
                f"Q1. What is the main policy established in {doc_title}?\nA1. {clean_lines[0] if clean_lines else 'The document outlines key organizational and operational guidelines.'}",
                f"Q2. What key compliance items are specified?\nA2. {clean_lines[1] if len(clean_lines) > 1 else 'All requirements and provisions stated in the document must be followed.'}"
            ]
        return f"# Frequently Asked Questions (FAQ)\n\n**Source Document:** {doc_title}\n\n" + "\n\n".join(faqs)

    elif key == "executive-brief":
        summary_text = "\n".join(clean_lines[:4]) if clean_lines else "Key operational overview."
        details_text = "\n".join(f"- {line}" for line in clean_lines[4:10]) if len(clean_lines) > 4 else "- Full compliance required as stated in source."
        return (
            f"# Executive Brief: {doc_title}\n\n"
            f"## Executive Overview\n{summary_text}\n\n"
            f"## Key Operational Requirements & Guidelines\n{details_text}\n\n"
            f"## Strategic Implications & Next Steps\n"
            f"- Ensure all relevant stakeholders review the guidelines outlined in {doc_title}.\n"
            f"- Maintain strict adherence to stated policies and compliance standards."
        )

    elif key == "meeting-notes":
        discussion = "\n".join(f"• {line}" for line in clean_lines[:6]) if clean_lines else "• Document rules and guidelines presented."
        return (
            f"# Meeting Notes — Policy Review ({doc_title})\n\n"
            f"## Context & Agenda\nReview of key directives and operational standards established in {doc_title}.\n\n"
            f"## Key Discussion Items\n{discussion}\n\n"
            f"## Decisions & Guidance\n"
            f"- Approved implementation of guidelines as documented.\n"
            f"- Staff to comply with attendance, examination, and administrative rules."
        )

    elif key == "action-items":
        items = []
        for i, line in enumerate(clean_lines[:6], 1):
            items.append(f"{i}. **Review Requirement**: {line} — Owner: Operational Lead — Priority: High")
        if not items:
            items = ["1. **Review Document Guidelines** — Owner: Department Head — Priority: High"]
        return f"# Action Items Checklist ({doc_title})\n\n" + "\n".join(items)

    elif key == "rewrite":
        rewritten = []
        for line in clean_lines:
            if line:
                rewritten.append(f"• {line}")
        return f"# Rewritten Document Content ({doc_title})\n\n" + "\n\n".join(rewritten)

    elif key == "email":
        body = "\n\n".join(clean_lines[:4]) if clean_lines else "Please review the attached document guidelines."
        return (
            f"Subject: Official Guidance & Policy Update regarding {doc_title}\n\n"
            f"Dear Colleague,\n\n"
            f"Please find below the operational guidelines established in {doc_title}:\n\n"
            f"{body}\n\n"
            f"Regards,\n"
            f"ERA Document Management Office"
        )

    elif key in ("photo-generation", "photo"):
        return (
            "Create a professional 16:9 visual based strictly on the uploaded document, "
            "highlighting its main subject, key information, important concepts, and relevant details. "
            "Use a clean, polished, visually engaging composition with realistic lighting, strong hierarchy, and an appropriate professional style. "
            "Do not introduce information that is not supported by the document."
        )

    elif key in ("video-generation", "video"):
        return (
            "Create a professional 10-second 16:9 cinematic video based strictly on the uploaded document, "
            "visually communicating its main subject, key concepts, important information, and relevant details. "
            "Use polished composition, natural motion, professional lighting, smooth camera movement, and a clear visual narrative. "
            "Do not introduce information that is not supported by the document."
        )

    else:  # Default: summarize
        points = "\n".join(f"• {line}" for line in clean_lines[:8]) if clean_lines else "• Document guidelines."
        return (
            f"# Summary: {doc_title}\n\n"
            f"## Overview\n"
            f"This summary outlines the core guidelines and requirements set forth in {doc_title}.\n\n"
            f"## Key Points & Requirements\n"
            f"{points}"
        )


