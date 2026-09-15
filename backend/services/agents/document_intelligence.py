"""
Agent 1 — Document Intelligence Agent (llama-8b).

Responsible for deep, grounded understanding of the CURRENT document context only.
Extracts structured factual information (summary, key facts, topics, entities, dates, numbers, source references)
for downstream transformation agents without rendering UI or HTML.
"""

import os
import json
import re
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("document_intelligence")
logger.setLevel(logging.INFO)

try:
    from backend.services.ai_gateway import call_ai_gateway, get_agent1_model
    from backend.vector_store import get_all_document_chunks, search_documents
except ImportError:
    from services.ai_gateway import call_ai_gateway, get_agent1_model
    from vector_store import get_all_document_chunks, search_documents


DOCUMENT_INTELLIGENCE_SYSTEM_PROMPT = """You are ERA's Document Intelligence Agent.

Analyze ONLY the provided source document context.

Extract and organize information that is explicitly supported by the document.

Identify:
- document purpose
- main topics
- important facts
- key concepts
- entities
- dates
- numerical values
- important statements
- sections/topics
- terminology
- relationships between facts
- potential transformation-relevant information

Do not invent facts.
Do not use outside knowledge.
Do not infer unsupported information.

If information is not present in the supplied document context, mark it as "Not available in the provided document context."

Return structured JSON ONLY matching this exact schema:
{
  "document_id": "string",
  "document_summary": "string",
  "topics": ["string"],
  "key_facts": ["string"],
  "entities": ["string"],
  "dates": ["string"],
  "numbers": ["string"],
  "important_statements": ["string"],
  "sections": ["string"],
  "terminology": ["string"],
  "source_references": [
    {
      "document_id": "string",
      "filename": "string",
      "page": 1,
      "chunk_index": 0
    }
  ]
}
"""


def extract_json_from_response(text: str) -> Optional[Dict[str, Any]]:
    """
    Parses response text into JSON dictionary.
    Handles Markdown code fences (```json ... ```) or embedded JSON objects.
    """
    if not text or not text.strip():
        return None

    clean_text = text.strip()

    # Strips ```json ... ``` codeblocks
    if "```" in clean_text:
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean_text, re.DOTALL)
        if match:
            clean_text = match.group(1).strip()
        else:
            clean_text = re.sub(r"```[a-zA-Z]*", "", clean_text).replace("```", "").strip()

    try:
        return json.loads(clean_text)
    except Exception:
        # Fallback: find outer braces { ... }
        match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                pass
    return None


def run_document_intelligence_agent(
    document_id: str,
    document_context: Optional[str] = None,
    filename: str = ""
) -> Dict[str, Any]:
    """
    Executes Agent 1 (Document Intelligence) over a single isolated document_id using Llama 8B.
    
    1. Retrieves chunks strictly filtered by document_id.
    2. Constructs document context payload with metadata references.
    3. Invokes Llama 8B model via internal AI Gateway.
    4. Validates structured JSON output and captures usage metrics.
    """
    if not document_id:
        return {
            "status": "error",
            "agent": "document_intelligence",
            "message": "document_id parameter is required for Document Intelligence Agent."
        }

    logger.info(f"[AGENT 1] status=started document_id={document_id}")

    # Retrieve chunks strictly filtered by document_id for hard session isolation
    retrieved_items = get_all_document_chunks(document_id=document_id)
    
    if not retrieved_items and document_context:
        # Fallback to provided document context if vector store not populated yet
        chunks_text = document_context
        source_refs = [{
            "document_id": document_id,
            "filename": filename or "Uploaded_Document.pdf",
            "page": 1,
            "chunk_index": 0
        }]
    elif retrieved_items:
        chunk_parts = []
        source_refs = []
        for idx, item in enumerate(retrieved_items):
            meta = item.get("metadata", {})
            fn = meta.get("filename") or filename or "document.pdf"
            pg = meta.get("page", 1)
            c_idx = meta.get("chunk_index", idx)
            
            logger.info(
                f"[AGENT 1] chunk: document_id={document_id} filename={fn} "
                f"page={pg} chunk_index={c_idx}"
            )
            
            chunk_parts.append(f"[Chunk {idx+1} | Page {pg}]\n{item.get('text', '')}")
            source_refs.append({
                "document_id": document_id,
                "filename": fn,
                "page": pg,
                "chunk_index": c_idx
            })
            
        chunks_text = "\n\n".join(chunk_parts)
    else:
        logger.warning(f"[AGENT 1] status=no_chunks_found document_id={document_id}")
        return {
            "status": "error",
            "agent": "document_intelligence",
            "message": f"No document context found for document_id '{document_id}'."
        }

    logger.info(f"[AGENT 1] retrieved_chunks={len(retrieved_items or [1])} document_id={document_id}")

    user_prompt = f"""SOURCE DOCUMENT CONTEXT (document_id={document_id}):
--------------------------------------------------
{chunks_text}
--------------------------------------------------

Perform Document Intelligence analysis for document_id '{document_id}' and return structured JSON ONLY."""

    messages = [
        {"role": "system", "content": DOCUMENT_INTELLIGENCE_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    target_model = get_agent1_model()
    gw_response = call_ai_gateway(messages, model=target_model, temperature=0.2, max_tokens=1500)

    if not gw_response.get("success"):
        logger.error(f"[AGENT 1] status=failed document_id={document_id} error={gw_response.get('error')}")
        return {
            "status": "error",
            "agent": "document_intelligence",
            "message": "Document Intelligence Agent is currently unavailable.",
            "error_detail": gw_response.get("error")
        }

    raw_content = gw_response.get("content", "")
    parsed_json = extract_json_from_response(raw_content)

    if not parsed_json or not isinstance(parsed_json, dict):
        logger.warning(f"[AGENT 1] status=json_parse_fallback document_id={document_id}")
        parsed_json = {
            "document_id": document_id,
            "document_summary": raw_content[:500] if raw_content else "Summary unavailable.",
            "topics": ["Document Analysis"],
            "key_facts": ["Extracted from document context."],
            "entities": [],
            "dates": [],
            "numbers": [],
            "important_statements": [],
            "sections": [],
            "terminology": [],
            "source_references": source_refs
        }
    else:
        # Enforce document_id and source_references consistency
        parsed_json["document_id"] = document_id
        if not parsed_json.get("source_references"):
            parsed_json["source_references"] = source_refs

    logger.info(f"[AGENT 1] status=completed document_id={document_id} model={target_model}")

    return {
        "status": "success",
        "agent": "document_intelligence",
        "model": gw_response.get("model", target_model),
        "temperature": gw_response.get("temperature", 0.2),
        "max_tokens": gw_response.get("max_tokens", 1500),
        "usage": gw_response.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}),
        "latency_ms": gw_response.get("latency_ms", 0),
        "data": parsed_json
    }
