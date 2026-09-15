"""
ERA Document Accuracy Debug Diagnostics Store & Logger.
Maintains in-memory diagnostic telemetry for document extraction, chunking, ChromaDB storage, retrieval, and Qwen-7B context.
"""
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("era_debug")
logger.setLevel(logging.INFO)

# In-memory diagnostic storage keyed by document_id
_DOCUMENT_DIAGNOSTICS: Dict[str, Dict[str, Any]] = {}


def init_debug_record(document_id: str, filename: str, file_type: str):
    """Initializes a new diagnostic record for document_id."""
    _DOCUMENT_DIAGNOSTICS[document_id] = {
        "document_id": document_id,
        "filename": filename,
        "file_type": file_type,
        "native_pages": [],
        "minicpm_invoked": False,
        "minicpm_raw_output": "",
        "final_normalized_text": "",
        "chunks_count": 0,
        "first_few_chunks": [],
        "embedding_confirmed": False,
        "chroma_stored_chunks": [],
        "retrieval_query": "",
        "retrieved_chunks": [],
        "qwen_context_string": "",
        "qwen_response": "",
        "usage": {}
    }
    print(f"\n==================================================")
    print(f"[DEBUG PIPELINE INIT] document_id='{document_id}' filename='{filename}' file_type='{file_type}'")
    print(f"==================================================")


def record_debug_native_page(document_id: str, page_num: int, text: str):
    """Logs and records native parser extracted text for a specific page."""
    if document_id in _DOCUMENT_DIAGNOSTICS:
        _DOCUMENT_DIAGNOSTICS[document_id]["native_pages"].append({
            "page": page_num,
            "char_count": len(text),
            "text": text
        })
    print(f"\n[DEBUG 2. NATIVE PARSER] page={page_num} chars={len(text)}\n--- PAGE {page_num} TEXT ---\n{text}\n-----------------------------")


def record_debug_minicpm(document_id: str, raw_output: str):
    """Logs and records MiniCPM vision OCR invocation and raw output."""
    if document_id in _DOCUMENT_DIAGNOSTICS:
        _DOCUMENT_DIAGNOSTICS[document_id]["minicpm_invoked"] = True
        _DOCUMENT_DIAGNOSTICS[document_id]["minicpm_raw_output"] = raw_output
    print(f"\n[DEBUG 3 & 4. MINICPM OCR] invoked=True raw_len={len(raw_output)}\n--- MINICPM RAW OUTPUT ---\n{raw_output}\n--------------------------")


def record_debug_final_text(document_id: str, text: str):
    """Logs and records final normalized extracted text."""
    if document_id in _DOCUMENT_DIAGNOSTICS:
        _DOCUMENT_DIAGNOSTICS[document_id]["final_normalized_text"] = text
    print(f"\n[DEBUG 5. FINAL NORMALIZED TEXT] total_chars={len(text)}\n--- FULL TEXT SAMPLE ---\n{text[:600]}...\n-----------------------")


def record_debug_chunks(document_id: str, chunks: List[Dict[str, Any]], embedding_confirmed: bool = True):
    """Logs and records chunking & ChromaDB storage diagnostics."""
    if document_id in _DOCUMENT_DIAGNOSTICS:
        _DOCUMENT_DIAGNOSTICS[document_id]["chunks_count"] = len(chunks)
        _DOCUMENT_DIAGNOSTICS[document_id]["first_few_chunks"] = chunks[:5]
        _DOCUMENT_DIAGNOSTICS[document_id]["embedding_confirmed"] = embedding_confirmed
        _DOCUMENT_DIAGNOSTICS[document_id]["chroma_stored_chunks"] = chunks
    print(f"\n[DEBUG 6, 7, 8, 9. CHUNKS & CHROMADB] doc_id='{document_id}' total_chunks={len(chunks)} embedding_confirmed={embedding_confirmed}")
    for idx, c in enumerate(chunks[:5]):
        print(f"  Chunk #{idx} [Page {c.get('page', 1)} | Index {c.get('chunk_index', idx)}]:\n  {c.get('text', '')[:250]}...\n")


def record_debug_retrieval(document_id: str, query: str, retrieved_chunks: List[Dict[str, Any]]):
    """Logs and records retrieval query and actual retrieved chunks with metadata."""
    if document_id in _DOCUMENT_DIAGNOSTICS:
        _DOCUMENT_DIAGNOSTICS[document_id]["retrieval_query"] = query
        _DOCUMENT_DIAGNOSTICS[document_id]["retrieved_chunks"] = retrieved_chunks
    print(f"\n[DEBUG 10, 11, 12. RETRIEVAL] doc_id='{document_id}' query='{query}' retrieved_count={len(retrieved_chunks)}")
    for idx, rc in enumerate(retrieved_chunks):
        meta = rc.get("metadata", {})
        print(f"  Retrieved Chunk [{idx+1}/{len(retrieved_chunks)}] meta={meta}")
        print(f"  ACTUAL TEXT:\n  {(rc.get('text') or rc.get('document') or '')[:300]}...\n")


def record_debug_qwen(document_id: str, context_str: str, response_str: str, usage: Dict[str, Any]):
    """Logs and records Qwen-7B exact context, generated output, and token usage."""
    if document_id in _DOCUMENT_DIAGNOSTICS:
        _DOCUMENT_DIAGNOSTICS[document_id]["qwen_context_string"] = context_str
        _DOCUMENT_DIAGNOSTICS[document_id]["qwen_response"] = response_str
        _DOCUMENT_DIAGNOSTICS[document_id]["usage"] = usage
    print(f"\n[DEBUG 13, 14, 15. QWEN-7B GENERATION] doc_id='{document_id}' context_len={len(context_str)} resp_len={len(response_str)} usage={usage}")
    print(f"--- QWEN CONTEXT STRING SENT ---\n{context_str[:800]}...\n--------------------------------")
    print(f"--- QWEN GENERATED RESPONSE ---\n{response_str[:800]}...\n--------------------------------")


def get_debug_record(document_id: str) -> Optional[Dict[str, Any]]:
    """Returns the comprehensive diagnostic telemetry payload for a document_id."""
    return _DOCUMENT_DIAGNOSTICS.get(document_id)
