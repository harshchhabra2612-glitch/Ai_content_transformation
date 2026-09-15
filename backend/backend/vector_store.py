import os
import time
from typing import List, Dict, Any, Optional
import chromadb

try:
    from backend.services.embedding_gateway import get_embeddings
except ImportError:
    from services.embedding_gateway import get_embeddings


# Path to persistent ChromaDB database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, "chroma_db")
os.makedirs(DB_DIR, exist_ok=True)

# Initialize persistent ChromaDB client and collection
client = chromadb.PersistentClient(path=DB_DIR)

try:
    # Delete legacy 384d collection if it exists to clean up disk
    client.delete_collection("era_documents")
except Exception:
    pass

collection = client.get_or_create_collection(
    name="era_documents_v2",
    metadata={"hnsw:space": "cosine"}
)


def chunk_page_text(text: str, target_words: int = 500, overlap_words: int = 75) -> List[str]:
    """
    Intelligently splits text into chunks of ~500-800 words with ~75 words overlap.
    Preserves paragraph breaks where possible.
    """
    cleaned_text = text.strip()
    if not cleaned_text:
        return []

    words = cleaned_text.split()
    if len(words) <= target_words + overlap_words:
        return [cleaned_text]

    paragraphs = [p.strip() for p in cleaned_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [p.strip() for p in cleaned_text.split("\n") if p.strip()]

    chunks = []
    current_chunk_words = []

    for p in paragraphs:
        p_words = p.split()
        if not p_words:
            continue

        if len(current_chunk_words) + len(p_words) > target_words and current_chunk_words:
            chunk_str = " ".join(current_chunk_words)
            chunks.append(chunk_str)

            # Keep overlap_words from previous chunk
            overlap = current_chunk_words[-overlap_words:] if len(current_chunk_words) >= overlap_words else current_chunk_words
            current_chunk_words = overlap + p_words
        else:
            current_chunk_words.extend(p_words)

    if current_chunk_words:
        chunks.append(" ".join(current_chunk_words))

    return chunks


def _get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generates vector embeddings for a list of texts using the Hackathon AI Gateway ('embed' model).
    Never silently falls back to local or dummy embeddings.
    """
    return get_embeddings(texts)


try:
    from backend.debug_store import record_debug_chunks, record_debug_retrieval
except ImportError:
    try:
        from debug_store import record_debug_chunks, record_debug_retrieval
    except ImportError:
        record_debug_chunks = lambda *a, **k: None
        record_debug_retrieval = lambda *a, **k: None


def add_document(parsed_payload: Dict[str, Any], document_id: Optional[str] = None) -> int:
    """
    Indexes parsed document pages into ChromaDB vector store ONCE during upload.
    Stores document_id, filename, page_start, page_end, chunk_index in metadata.
    """
    global collection
    start_time = time.time()
    filename = parsed_payload.get("filename", "unknown")
    file_type = parsed_payload.get("file_type", "txt")
    pages = parsed_payload.get("pages", [])
    doc_id = document_id or filename

    # Remove pre-existing chunks for this document_id or filename to ensure clean session state
    delete_document(filename, doc_id)

    ids = []
    documents = []
    metadatas = []
    stored_chunks_info = []

    chunk_counter = 0
    total_chars = 0

    total_extracted_text = "\n".join(p.get("text", "") for p in pages)
    print("\n==================== [DEBUG 1: EXTRACTED TEXT] ====================")
    print(f"filename: {filename}")
    print(f"file_type: {file_type}")
    print(f"document_id: {doc_id}")
    print(f"number of pages: {len(pages)}")
    print(f"actual extracted text (first 300 chars): {total_extracted_text[:300]}")
    print("===================================================================\n")

    for page_info in pages:
        page_num = page_info.get("page", 1)
        page_text = page_info.get("text", "").strip()

        if not page_text:
            continue

        chunks = chunk_page_text(page_text)

        for c_idx, chunk_str in enumerate(chunks):
            clean_chunk = chunk_str.strip()
            if not clean_chunk:
                continue

            chunk_id = f"{doc_id}_p{page_num}_c{c_idx}"

            ids.append(chunk_id)
            documents.append(clean_chunk)
            total_chars += len(clean_chunk)

            meta = {
                "document_id": doc_id,
                "filename": filename,
                "file_type": file_type,
                "page": page_num,
                "page_start": page_num,
                "page_end": page_num,
                "chunk_index": chunk_counter
            }
            metadatas.append(meta)
            stored_chunks_info.append({
                "text": clean_chunk,
                "page": page_num,
                "chunk_index": chunk_counter,
                "metadata": meta
            })
            chunk_counter += 1

    print("\n==================== [DEBUG 2: CHUNKS CREATED] ====================")
    print(f"document_id: {doc_id}")
    print(f"filename: {filename}")
    print(f"number of chunks created: {chunk_counter}")
    for idx, cinfo in enumerate(stored_chunks_info[:5]):
        print(f" Chunk #{idx+1} [Page {cinfo['page']}]: {cinfo['text'][:150]}...")
    print("==================================================================\n")

    if documents:
        embeddings = _get_embeddings(documents)
        try:
            collection.add(
                ids=ids,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas
            )
        except Exception as e:
            if "dimension" in str(e).lower():
                print(f"[VECTOR STORE WARNING] Dimension mismatch detected. Recreating collection: {e}")
                try:
                    client.delete_collection("era_documents_v2")
                except Exception:
                    pass
                collection = client.get_or_create_collection(
                    name="era_documents_v2",
                    metadata={"hnsw:space": "cosine"}
                )
                collection.add(
                    ids=ids,
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas
                )
            else:
                raise e

    record_debug_chunks(doc_id, stored_chunks_info, embedding_confirmed=bool(documents))

    elapsed_ms = int((time.time() - start_time) * 1000)
    print(f"\n[CHUNKS_CREATED] doc_id={doc_id} filename={filename} chunks={chunk_counter} indexing_time={elapsed_ms}ms")

    return chunk_counter


def get_all_document_chunks(
    document_id: Optional[str] = None,
    filename: Optional[str] = None,
    max_chunks: int = 100
) -> List[Dict[str, Any]]:
    """
    Retrieves most relevant chunks belonging strictly to a specific document_id or filename in natural page order.
    Does NOT fall back to global collection retrieval to prevent RAG contamination.
    """
    start_time = time.time()
    doc_key = document_id or filename or "unknown"
    if collection.count() == 0 or (not document_id and not filename):
        print(f"\n[RETRIEVAL] document_id={document_id} query=ALL_CHUNKS retrieved=0 time=0ms")
        record_debug_retrieval(doc_key, "ALL_CHUNKS", [])
        return []

    results = None

    if document_id:
        try:
            results = collection.get(where={"document_id": document_id}, include=["documents", "metadatas"])
        except Exception as e:
            print(f"[VECTOR STORE ERROR] ChromaDB lookup by document_id failed: {e}")

    if (not results or not results.get("documents") or not results["documents"]) and filename:
        try:
            results = collection.get(where={"filename": filename}, include=["documents", "metadatas"])
        except Exception as e:
            print(f"[VECTOR STORE ERROR] ChromaDB lookup by filename failed: {e}")

    if not results or not results.get("documents") or not results["documents"]:
        print(f"\n[RETRIEVAL] document_id={document_id} query=ALL_CHUNKS retrieved=0 time=0ms")
        record_debug_retrieval(doc_key, "ALL_CHUNKS", [])
        return []

    docs = results.get("documents", [])
    metas = results.get("metadatas", [])
    ids = results.get("ids", [])

    items = []
    for i, doc_text in enumerate(docs):
        meta = metas[i] if i < len(metas) else {}
        items.append({
            "text": doc_text,
            "document": doc_text,
            "metadata": meta,
            "page": meta.get("page", 1),
            "chunk_index": meta.get("chunk_index", i)
        })

    items.sort(key=lambda x: (x.get("page", 1), x.get("chunk_index", 0)))

    if len(items) > max_chunks:
        items = items[:max_chunks]

    record_debug_retrieval(doc_key, "ALL_CHUNKS", items)

    retrieved_chunk_ids = [item.get("metadata", {}).get("chunk_index", 0) for item in items]
    retrieved_pages = sorted(list(set(item.get("page", 1) for item in items)))
    elapsed_ms = int((time.time() - start_time) * 1000)

    print(f"\n[RETRIEVAL] document_id={document_id} query=ALL_CHUNKS (natural order) retrieved_chunks={len(items)} pages={retrieved_pages} time={elapsed_ms}ms")

    return items


def search_documents(
    query: str,
    top_k: int = 10,
    filename: Optional[str] = None,
    document_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Performs vector similarity search over stored ChromaDB chunks.
    Filters strictly by document_id or filename for hard session isolation.
    """
    start_time = time.time()
    doc_key = document_id or filename or "unknown"
    if collection.count() == 0 or (not document_id and not filename):
        print(f"\n[RETRIEVAL] document_id={document_id} query={query} retrieved=0 time=0ms")
        record_debug_retrieval(doc_key, query, [])
        return []

    n_results = min(top_k, collection.count())
    query_embedding = _get_embeddings([query])

    query_kwargs: Dict[str, Any] = {
        "query_embeddings": query_embedding,
        "n_results": n_results
    }

    if document_id:
        query_kwargs["where"] = {"document_id": document_id}
    elif filename:
        query_kwargs["where"] = {"filename": filename}

    try:
        results = collection.query(**query_kwargs)
    except Exception as e:
        print(f"[RETRIEVAL ERROR] ChromaDB query failed: {e}")
        record_debug_retrieval(doc_key, query, [])
        return []

    retrieved = []
    if results and results.get("documents") and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results.get("distances", [[]])[0]

        for i, doc_text in enumerate(docs):
            meta = metas[i]
            dist = distances[i] if i < len(distances) else 0.0

            retrieved.append({
                "text": doc_text,
                "document": doc_text,
                "distance": dist,
                "metadata": meta
            })

    record_debug_retrieval(doc_key, query, retrieved)

    elapsed_ms = int((time.time() - start_time) * 1000)
    print(f"\n[RETRIEVAL] document_id={document_id} query={query} retrieved_chunks={len(retrieved)} time={elapsed_ms}ms")

    return retrieved


    return retrieved


def delete_document(filename: str = "", document_id: str = ""):
    """
    Deletes all chunks associated strictly with a specific document_id (or filename if document_id not specified).
    """
    if document_id:
        try:
            collection.delete(where={"document_id": document_id})
        except Exception:
            pass
    elif filename:
        try:
            collection.delete(where={"filename": filename})
        except Exception:
            pass


def clear_all_documents():
    """
    Clears all documents from the collection to ensure session isolation.
    """
    try:
        data = collection.get()
        ids = data.get("ids", [])
        if ids:
            collection.delete(ids=ids)
            print(f"[VECTOR STORE] Cleared {len(ids)} stale chunks from ChromaDB.")
    except Exception as e:
        print(f"[VECTOR STORE] Error clearing collection: {e}")
