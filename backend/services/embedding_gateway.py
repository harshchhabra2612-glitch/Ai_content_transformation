"""
ERA Embedding Gateway Service — OpenAI Compatible Embedding Client.

Connects to the internal Hackathon AI Gateway (http://172.16.10.110:4000/v1) for vector embeddings.
Uses the 'embed' model for text and document chunk embeddings.
Handles batching for multiple document chunks.
Logs embedding latency and batch sizes without exposing credentials.
Raises clear errors if gateway embedding fails (no silent fallbacks).
"""

import os
import time
import logging
from typing import List, Dict, Any, Optional

try:
    from backend.services.ai_gateway import get_openai_client, get_ai_gateway_url
except ImportError:
    from services.ai_gateway import get_openai_client, get_ai_gateway_url

logger = logging.getLogger("embedding_gateway")
logger.setLevel(logging.INFO)

EMBEDDING_MODEL = "embed"


def get_embedding(text: str) -> List[float]:
    """
    Generates vector embedding for a single text string using the 'embed' model.
    """
    res = get_embeddings([text])
    if not res or len(res) == 0:
        raise ValueError("Embedding Gateway returned empty vector for input text.")
    return res[0]


def get_embeddings(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """
    Generates vector embeddings for a list of text strings in batches.
    Calls Hackathon AI Gateway endpoint using model='embed'.
    Returns a list of float vectors matching the order of input texts.
    """
    if not texts:
        return []

    # Clean empty/whitespace strings
    cleaned_texts = [t if t and t.strip() else " " for t in texts]

    base_url = get_ai_gateway_url()
    client = get_openai_client()

    all_embeddings: List[List[float]] = []
    start_time = time.time()

    total_texts = len(cleaned_texts)
    logger.info(f"[EMBEDDING GATEWAY] provider=internal_gateway base_url={base_url} model={EMBEDDING_MODEL} total_texts={total_texts} batch_size={batch_size}")

    for i in range(0, total_texts, batch_size):
        batch = cleaned_texts[i:i + batch_size]
        batch_start = time.time()

        try:
            response = client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch
            )
            batch_ms = int((time.time() - batch_start) * 1000)

            # Parse OpenAI Embedding object
            if not response or not hasattr(response, "data") or not response.data:
                raise RuntimeError(f"Embedding Gateway returned invalid response for batch {i//batch_size + 1}")

            # Sort by index to ensure exact alignment
            sorted_data = sorted(response.data, key=lambda d: getattr(d, "index", 0))
            batch_vectors = [d.embedding for d in sorted_data]

            if len(batch_vectors) != len(batch):
                raise RuntimeError(f"Embedding Gateway returned {len(batch_vectors)} vectors for batch of size {len(batch)}")

            all_embeddings.extend(batch_vectors)

            logger.info(f"[EMBEDDING BATCH COMPLETE] batch={i//batch_size + 1} items={len(batch)} latency={batch_ms}ms vector_dim={len(batch_vectors[0]) if batch_vectors else 0}")

        except Exception as e:
            total_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[EMBEDDING GATEWAY ERROR] provider=internal_gateway model={EMBEDDING_MODEL} batch={i//batch_size + 1} error={e} total_ms={total_ms}")
            raise RuntimeError(f"Hackathon AI Gateway Embedding Error (model='embed'): {e}") from e

    total_ms = int((time.time() - start_time) * 1000)
    logger.info(f"[EMBEDDING COMPLETE] model={EMBEDDING_MODEL} total_texts={len(all_embeddings)} total_latency={total_ms}ms")

    return all_embeddings
