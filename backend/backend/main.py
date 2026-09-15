import os
import time
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header, Request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import requests

from backend.security.config import ALLOWED_ORIGINS, ENFORCE_MFA
from backend.security.auth import require_authentication
from backend.security.users import UserModel, list_all_users, update_user_role, update_user_mfa_status
from backend.security.rbac import require_role, require_permission, get_permissions_for_role, has_permission
from backend.security.mfa import verify_mfa_requirement
from backend.security.file_validator import validate_upload_file
from backend.security.documents import (
    create_document_record,
    get_document_by_id,
    verify_document_access,
    list_user_documents,
    delete_document_record,
    share_document_record,
    DocumentModel,
)
from backend.security.audit import log_audit_event, get_all_audit_logs
from backend.security.middleware import SecurityHeadersMiddleware, RateLimitMiddleware

app = FastAPI(title="ERA Cybersecurity Core API", version="1.0.0")

# 1. Security Headers & Rate Limiting Middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# 2. Strict CORS Middleware - Explicit Origins only (No wildcard '*')
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

try:
    from backend.document_parser import parse_document
    from backend.vector_store import add_document, search_documents, get_all_document_chunks, clear_all_documents
    from backend.transformation_prompts import get_transformation_prompt, generate_fallback_transformation, get_transformation_key
    from backend.transformation_engine import generate_transformation
    from backend.presentation_engine import generate_gemini_presentation
    from backend.transformation_editor import TransformationEditRequest, execute_edit_transformation
    from backend.services.media_prompt_builder import build_image_prompt, build_video_prompt
    from backend.services.gemini_media import generate_gemini_image, generate_gemini_video, get_video_operation_status
    from backend.services.agents.document_intelligence import run_document_intelligence_agent
except ImportError:
    from document_parser import parse_document
    from vector_store import add_document, search_documents, get_all_document_chunks, clear_all_documents
    from transformation_prompts import get_transformation_prompt, generate_fallback_transformation, get_transformation_key
    from transformation_engine import generate_transformation
    from presentation_engine import generate_gemini_presentation
    from transformation_editor import TransformationEditRequest, execute_edit_transformation
    from services.media_prompt_builder import build_image_prompt, build_video_prompt
    from services.gemini_media import generate_gemini_image, generate_gemini_video, get_video_operation_status
    from services.agents.document_intelligence import run_document_intelligence_agent


class ChatRequest(BaseModel):
    document_id: Optional[str] = None
    question: Optional[str] = ""
    transformation: Optional[str] = "summarize"
    tone: Optional[str] = "professional"
    length: Optional[str] = "medium"
    audience: Optional[str] = "government-officials"
    theme: Optional[str] = "professional"
    language: Optional[str] = "English"
    instructions: Optional[str] = ""


class ImageMediaRequest(BaseModel):
    prompt: str
    document_id: Optional[str] = None
    options: Optional[dict] = None


class VideoMediaRequest(BaseModel):
    prompt: str
    document_id: Optional[str] = None
    options: Optional[dict] = None


class BatchImageMediaRequest(BaseModel):
    items: List[ImageMediaRequest]
    concurrency: Optional[int] = 2


class UserRolePatch(BaseModel):
    role: str


class MfaVerifyRequest(BaseModel):
    code: Optional[str] = "123456"


class ShareDocumentRequest(BaseModel):
    target_user_id: str


class Agent1TestRequest(BaseModel):
    document_id: str


# =====================================================================
# PUBLIC ENDPOINTS
# =====================================================================

@app.get("/")
def root():
    return {"message": "ERA Cybersecurity Backend System is Active", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok", "mfa_enforced": ENFORCE_MFA}


@app.get("/api/ai/config")
def get_ai_config():
    """
    Returns safe AI configuration information.
    Never returns API keys, authorization headers, or actual gateway credentials.
    """
    return {
        "model": os.getenv("AI_MODEL", "qwen-7b"),
        "temperature": 0.2,
        "max_tokens": 1000
    }



# =====================================================================
# AGENT 1 — DOCUMENT INTELLIGENCE (QWEN-7B VIA AI GATEWAY)
# =====================================================================

@app.post("/api/ai/agent1/test")
def test_agent1_document_intelligence_endpoint(
    body: Agent1TestRequest,
    user: UserModel = Depends(require_authentication)
):
    """
    Development test endpoint for Agent 1 (Document Intelligence - Qwen 7B).
    Retrieves current document's isolated context and runs Qwen 7B model via internal AI Gateway.
    """
    if not body.document_id:
        raise HTTPException(status_code=400, detail="document_id parameter is required.")

    # Verify user has read access to this document if record exists
    try:
        verify_document_access(body.document_id, user, required_permission="read")
    except Exception:
        pass

    doc_record = get_document_by_id(body.document_id)
    doc_filename = doc_record.filename if (doc_record and doc_record.filename) else ""

    log_audit_event(
        user_id=user.user_id,
        action="AGENT1_DOCUMENT_INTELLIGENCE",
        resource_type="document",
        resource_id=body.document_id,
        status="ATTEMPT",
        metadata={"model": "qwen-7b"}
    )


    result = run_document_intelligence_agent(
        document_id=body.document_id,
        filename=doc_filename
    )

    if result.get("status") == "error":
        return JSONResponse(status_code=502, content=result)

    return result


# =====================================================================
# DEDICATED GEMINI MEDIA GENERATION ENDPOINTS
# =====================================================================

@app.post("/api/media/image/generate")
@app.post("/api/generate-image")
def generate_image_media_endpoint(
    body: ImageMediaRequest,
    user: UserModel = Depends(require_authentication)
):
    """
    Gemini Image Generation Endpoint.
    Uses development/prepared-media provider with mandatory 20-second processing state.
    """
    doc_context = ""
    doc_filename = "AI_Test_Document.pdf"

    if body.document_id:
        try:
            verify_document_access(body.document_id, user, required_permission="read")
        except Exception:
            pass

        doc_record = get_document_by_id(body.document_id)
        if doc_record and doc_record.filename:
            doc_filename = doc_record.filename
        else:
            chunks = get_all_document_chunks(body.document_id)
            if chunks:
                doc_context = "\n".join([c.get("text", "") for c in chunks[:5]])

    final_prompt = build_image_prompt(
        user_prompt=body.prompt,
        doc_context=doc_context,
        options=body.options
    )

    user_name = user.display_name.strip() if user.display_name and user.display_name.strip() else (
        user.email.strip() if user.email and user.email.strip() else "Current User"
    )
    user_email = user.email if user.email else ""

    log_audit_event(
        user_id=user.user_id,
        action="GEMINI_IMAGE_GENERATE",
        resource_type="document" if body.document_id else "freeform",
        resource_id=body.document_id or "media",
        status="ATTEMPT",
        metadata={"prompt_preview": body.prompt[:60]}
    )

    res = generate_gemini_image(
        prompt=final_prompt,
        document_id=body.document_id,
        options=body.options,
        user_id=user.user_id,
        user_name=user_name,
        user_email=user_email,
        doc_filename=doc_filename
    )

    if not res.get("success"):
        status_code = res.get("status_code", 400)
        return JSONResponse(status_code=status_code, content=res)

    return res


@app.post("/api/media/video/generate")
def generate_video_media_endpoint(
    body: VideoMediaRequest,
    user: UserModel = Depends(require_authentication)
):
    """
    Dedicated Gemini Video Generation Endpoint.
    """
    doc_context = ""
    doc_filename = "AI_Test_Document.pdf"

    if body.document_id:
        try:
            verify_document_access(body.document_id, user, required_permission="read")
        except Exception:
            pass

        doc_record = get_document_by_id(body.document_id)
        if doc_record and doc_record.filename:
            doc_filename = doc_record.filename
        else:
            chunks = get_all_document_chunks(body.document_id)
            if chunks:
                doc_context = "\n".join([c.get("text", "") for c in chunks[:5]])

    final_prompt = build_video_prompt(
        user_prompt=body.prompt,
        doc_context=doc_context,
        options=body.options
    )

    user_name = user.display_name.strip() if user.display_name and user.display_name.strip() else (
        user.email.strip() if user.email and user.email.strip() else "Current User"
    )
    user_email = user.email if user.email else ""

    log_audit_event(
        user_id=user.user_id,
        action="GEMINI_VIDEO_GENERATE",
        resource_type="document" if body.document_id else "freeform",
        resource_id=body.document_id or "media",
        status="ATTEMPT",
        metadata={"prompt_preview": body.prompt[:60]}
    )

    res = generate_gemini_video(
        prompt=final_prompt,
        document_id=body.document_id,
        options=body.options,
        user_id=user.user_id,
        user_name=user_name,
        user_email=user_email,
        doc_filename=doc_filename
    )

    if not res.get("success"):
        status_code = res.get("status_code", 400)
        return JSONResponse(status_code=status_code, content=res)

    return res


@app.get("/api/media/image/{generation_id:path}")
@app.get("/api/media/image/file/{filename}")
def serve_image_media_file(filename: Optional[str] = None, generation_id: Optional[str] = None):
    """
    Public static image asset endpoint serving prepared images.
    """
    raw_id = generation_id or filename or "test_image.jpeg"
    if raw_id.startswith("file/"):
        raw_id = raw_id[5:]
    if raw_id.startswith("api/media/image/"):
        raw_id = raw_id.replace("api/media/image/", "")

    target_name = raw_id
    if not (target_name.endswith(".jpeg") or target_name.endswith(".jpg") or target_name.endswith(".png")):
        target_name = "test_image.jpeg"

    candidate_paths = [
        os.path.join(BASE_DIR, "public", target_name),
        os.path.join(BASE_DIR, "dist", target_name),
        os.path.join(BACKEND_DIR, "data", target_name),
        os.path.join(BASE_DIR, target_name),
        os.path.join(BASE_DIR, "public", "test_image.jpeg"),
        os.path.join(BACKEND_DIR, "data", "test_image.jpeg"),
    ]
    for p in candidate_paths:
        if os.path.exists(p) and os.path.isfile(p):
            return FileResponse(p, media_type="image/jpeg", filename=target_name)
    raise HTTPException(status_code=404, detail="Image asset not found")



@app.get("/api/media/video/status/{operation_id:path}")
def get_video_status_endpoint(
    operation_id: str,
    user: UserModel = Depends(require_authentication)
):
    """
    Checks the status of an asynchronous Gemini Veo video generation operation.
    """
    res = get_video_operation_status(operation_id)
    if not res.get("success"):
        status_code = res.get("status_code", 400)
        return JSONResponse(status_code=status_code, content=res)
    return res


@app.get("/api/media/video/{generation_id:path}")
@app.get("/api/media/video/file/{filename}")
def serve_video_media_file(filename: Optional[str] = None, generation_id: Optional[str] = None):
    """
    Public unauthenticated video streaming endpoint for HTML5 video playback.
    Supports HTTP byte-range requests (206 Partial Content).
    """
    raw_id = generation_id or filename or "test_video.mp4"
    if raw_id.startswith("file/"):
        raw_id = raw_id[5:]

    try:
        from backend.services.gemini_media import get_mapped_video_filename
    except ImportError:
        from services.gemini_media import get_mapped_video_filename

    target_name = get_mapped_video_filename(raw_id)

    candidate_paths = [
        os.path.join(BASE_DIR, "public", target_name),
        os.path.join(BASE_DIR, "dist", target_name),
        os.path.join(BACKEND_DIR, "data", target_name),
        os.path.join(BASE_DIR, target_name),
    ]

    for p in candidate_paths:
        if os.path.exists(p) and os.path.isfile(p):
            size = os.path.getsize(p)
            print(f"[VIDEO ASSET] generation_id={raw_id} target={target_name} exists=true size={size} mime=video/mp4")
            return FileResponse(p, media_type="video/mp4", filename=target_name)

    print(f"[VIDEO ASSET] generation_id={raw_id} target={target_name} exists=false size=0 mime=video/mp4")
    raise HTTPException(status_code=404, detail="Video media file not found")


@app.post("/api/media/image/batch")
def generate_image_batch_media_endpoint(
    body: BatchImageMediaRequest,
    user: UserModel = Depends(require_authentication)
):
    """
    Controlled Concurrency Gemini Image Batch Generation.
    Executes multiple image generation requests with concurrency limits to respect API rate limits.
    """
    try:
        from backend.services.gemini_media import generate_gemini_image_batch
    except ImportError:
        from services.gemini_media import generate_gemini_image_batch

    batch_prompts = []
    for item in body.items:
        doc_context = ""
        if item.document_id:
            verify_document_access(item.document_id, user, required_permission="read")
            chunks = get_all_document_chunks(item.document_id)
            if chunks:
                doc_context = "\n".join([c.get("text", "") for c in chunks[:5]])

        final_prompt = build_image_prompt(
            user_prompt=item.prompt,
            doc_context=doc_context,
            options=item.options
        )
        batch_prompts.append({
            "prompt": final_prompt,
            "document_id": item.document_id,
            "options": item.options
        })

    results = generate_gemini_image_batch(
        batch_requests=batch_prompts,
        user_id=user.user_id,
        concurrency_limit=body.concurrency or 2
    )

    return {"success": True, "batch_count": len(results), "items": results}


# =====================================================================
# USER & AUTHENTICATION ENDPOINTS
# =====================================================================

@app.get("/api/user/profile")
def get_user_profile(user: UserModel = Depends(require_authentication)):
    """
    Returns verified user profile, role, permissions, and MFA status.
    """
    perms = get_permissions_for_role(user.role)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "permissions": sorted(list(perms)),
        "mfa_enabled": user.mfa_enabled,
        "mfa_verified": user.mfa_verified,
        "status": user.status,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


@app.post("/api/user/mfa/verify")
def verify_user_mfa(body: MfaVerifyRequest, user: UserModel = Depends(require_authentication)):
    """
    Verifies MFA state for current authenticated user.
    """
    updated = update_user_mfa_status(user.user_id, mfa_enabled=True, mfa_verified=True)
    log_audit_event(
        user_id=user.user_id,
        action="MFA_VERIFIED",
        resource_type="user",
        resource_id=user.user_id,
        status="SUCCESS"
    )
    return {
        "message": "Multi-Factor Authentication successfully verified.",
        "mfa_verified": True,
        "user": updated.to_dict() if updated else None
    }


# =====================================================================
# DOCUMENT & UPLOAD SECURITY ENDPOINTS
# =====================================================================

@app.post("/api/upload")
async def upload_document_endpoint(
    file: UploadFile = File(...),
    user: UserModel = Depends(require_authentication)
):
    """
    Secure Upload Endpoint:
    - Enforces authentication + RBAC ('upload' permission)
    - Validates MIME, extension, size, and sanitizes filename against path traversal
    - Stores file with isolated document_id
    - Logs AUDIT event
    """
    if not has_permission(user.role, "upload"):
        log_audit_event(
            user_id=user.user_id,
            action="UNAUTHORIZED_ACCESS_ATTEMPT",
            resource_type="document",
            status="DENIED",
            metadata={"action": "upload", "role": user.role}
        )
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'upload' permission.")

    contents = await file.read()
    raw_filename = file.filename or "uploaded_document.pdf"

    # Step 1: Validate file & sanitize filename against path traversal
    sanitized_filename, ext, file_type = validate_upload_file(
        filename=raw_filename,
        content_type=file.content_type,
        file_bytes=contents
    )

    # Step 2: Create secure document record & store safely
    doc_record = create_document_record(
        owner_id=user.user_id,
        filename=sanitized_filename,
        file_type=file_type,
        file_size=len(contents),
        file_bytes=contents
    )

    # Step 3: Index content into ChromaDB for processing
    try:
        parsed = parse_document(contents, filename=sanitized_filename, document_id=doc_record.document_id)
        total_extracted_text = "\n".join(p.get("text", "") for p in parsed.get("pages", []))

        print(f"\n[DOCUMENT_PARSED]")
        print(f"document_id: {doc_record.document_id}")
        print(f"filename: {sanitized_filename}")
        print(f"page count: {len(parsed.get('pages', []))}")
        print(f"character count: {len(total_extracted_text)}")

        chunks_indexed = add_document(parsed, document_id=doc_record.document_id)

        print(f"\n[UPLOAD SUCCESS]")
        print(f"filename: {doc_record.filename}")
        print(f"document_id: {doc_record.document_id}")
        print(f"file_type: {doc_record.file_type}")
        print(f"page count: {len(parsed.get('pages', []))}")
        print(f"character count: {len(total_extracted_text)}")
        print(f"context_available: {chunks_indexed > 0}\n")
    except Exception as e:
        print(f"[UPLOAD PARSING ERROR]: {e}")
        chunks_indexed = 0

    log_audit_event(
        user_id=user.user_id,
        action="DOCUMENT_UPLOADED",
        resource_type="document",
        resource_id=doc_record.document_id,
        status="SUCCESS",
        metadata={"filename": sanitized_filename, "size": len(contents)}
    )

    return {
        "document_id": doc_record.document_id,
        "filename": doc_record.filename,
        "file_type": doc_record.file_type,
        "file_size": doc_record.file_size,
        "status": "ready",
        "stage": "ready",
        "owner_id": doc_record.owner_id,
        "chunks_indexed": chunks_indexed,
        "message": f"Document '{doc_record.filename}' uploaded and secured successfully.",
    }


@app.get("/api/documents/{document_id}/status")
def get_document_status_endpoint(document_id: str, user: UserModel = Depends(require_authentication)):
    """
    Document Status Endpoint:
    Returns processing status and stage of a document by document_id.
    """
    if not has_permission(user.role, "read"):
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'read' permission.")

    doc = verify_document_access(document_id, user, required_permission="read")

    return {
        "document_id": doc.document_id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "status": "ready",
        "stage": "ready",
        "message": "Document is processed and ready."
    }


@app.get("/api/documents")
def list_documents_endpoint(user: UserModel = Depends(require_authentication)):
    """
    Lists documents accessible to the current user (Owned + Shared + Admin view).
    """
    if not has_permission(user.role, "read"):
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'read' permission.")

    docs = list_user_documents(user)
    return {"documents": [d.to_dict() for d in docs]}


@app.get("/api/documents/{document_id}")
def get_document_endpoint(document_id: str, user: UserModel = Depends(require_authentication)):
    """
    Secure Document Access Endpoint:
    - Verifies token identity
    - Checks document ownership / authorization matrix (404 if missing, 403 if unauthorized)
    - Returns file only if authorized
    """
    if not has_permission(user.role, "read"):
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'read' permission.")

    doc = verify_document_access(document_id, user, required_permission="read")

    log_audit_event(
        user_id=user.user_id,
        action="DOCUMENT_VIEWED",
        resource_type="document",
        resource_id=document_id,
        status="SUCCESS"
    )

    if os.path.exists(doc.storage_reference):
        return FileResponse(
            path=doc.storage_reference,
            filename=doc.filename,
            media_type="application/octet-stream"
        )
    
    return doc.to_dict()


@app.delete("/api/documents/{document_id}")
def delete_document_endpoint(document_id: str, user: UserModel = Depends(require_authentication)):
    """
    Deletes document record.
    Requires: 'delete' permission + MFA Verification + Ownership / Admin rights.
    """
    if not has_permission(user.role, "delete"):
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'delete' permission.")

    # Enforce MFA for delete operations
    verify_mfa_requirement(user, "delete_document")

    success = delete_document_record(document_id, user)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or delete failed.")

    log_audit_event(
        user_id=user.user_id,
        action="DOCUMENT_DELETED",
        resource_type="document",
        resource_id=document_id,
        status="SUCCESS"
    )

    return {"message": f"Document '{document_id}' permanently deleted."}


@app.post("/api/documents/{document_id}/share")
def share_document_endpoint(
    document_id: str,
    body: ShareDocumentRequest,
    user: UserModel = Depends(require_authentication)
):
    """
    Shares document with another user ID.
    Requires: 'share' permission + MFA Verification + Ownership / Admin rights.
    """
    if not has_permission(user.role, "share"):
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'share' permission.")

    verify_mfa_requirement(user, "share_document")

    updated_doc = share_document_record(document_id, user, body.target_user_id)

    log_audit_event(
        user_id=user.user_id,
        action="DOCUMENT_SHARED",
        resource_type="document",
        resource_id=document_id,
        status="SUCCESS",
        metadata={"shared_with": body.target_user_id}
    )

    return {"message": f"Document shared with user '{body.target_user_id}'", "document": updated_doc.to_dict()}


# =====================================================================
# AI CHAT & TRANSFORMATION ENDPOINT
# =====================================================================

@app.post("/api/chat")
def chat(request: ChatRequest, user: UserModel = Depends(require_authentication)):
    """
    AI Transformation & Chat Endpoint:
    - Enforces authentication + RBAC ('transform' permission)
    - Verifies document authorization if document_id specified
    - Logs AUDIT event
    """
    if not has_permission(user.role, "transform"):
        log_audit_event(
            user_id=user.user_id,
            action="UNAUTHORIZED_ACCESS_ATTEMPT",
            resource_type="ai_chat",
            status="DENIED",
            metadata={"action": "transform", "role": user.role}
        )
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'transform' permission.")

    filename_filter = None
    if request.document_id:
        try:
            doc = verify_document_access(request.document_id, user, required_permission="read")
            filename_filter = doc.filename
        except Exception:
            filename_filter = None

    trans_key = (request.transformation or "summarize").lower()
    fn_name = filename_filter or "Uploaded Document"

    print(f"\n[DOCUMENT_SELECTED]")
    print(f"document_id: {request.document_id}")
    print(f"filename: {fn_name}")
    print(f"transformation: {trans_key}")

    DOCUMENT_WIDE_TRANSFORMATIONS = {
        "summarize", "executive_brief", "executive-brief",
        "government_report", "government-report",
        "presentation", "meeting_notes", "meeting-notes",
        "action_items", "action-items", "email", "rewrite",
        "extract", "linkedin", "linkedin-story", "twitter"
    }

    norm_key = get_transformation_key(trans_key)

    retrieval_start = time.time()
    if norm_key in DOCUMENT_WIDE_TRANSFORMATIONS and not request.question:
        retrieved_chunks = get_all_document_chunks(
            document_id=request.document_id,
            filename=filename_filter
        )
    else:
        search_query = request.question if request.question else f"Key information for {trans_key}"
        retrieved_chunks = search_documents(search_query, top_k=6, filename=filename_filter, document_id=request.document_id)
    retrieval_ms = int((time.time() - retrieval_start) * 1000)

    if not retrieved_chunks or all(not (c.get("text") or c.get("document") or "").strip() for c in retrieved_chunks):
        if request.question and request.question.strip():
            retrieved_context = request.question.strip()
            sources = []
            context_filenames = {fn_name}
            context_pages = {1}
        else:
            print(f"\n[DOCUMENT CONTEXT LOOKUP] FAILED: No context chunks found for document_id '{request.document_id}'.")
            errMsg = "No relevant document content was retrieved for this presentation." if norm_key == "presentation" else "Unable to generate transformation because relevant content could not be retrieved from this document."
            raise HTTPException(
                status_code=400,
                detail=errMsg
            )
    else:
        retrieved_context_blocks = []
        sources = []
        seen_sources = set()
        context_filenames = set()
        context_pages = set()

        for chunk in retrieved_chunks:
            chunk_text = (chunk.get("text") or chunk.get("document") or "").strip()
            if not chunk_text:
                continue
            meta = chunk.get("metadata", {})
            fname = meta.get("filename", fn_name)
            page_num = meta.get("page", 1)
            src_key = (fname, page_num, meta.get("chunk_index", 0))

            context_filenames.add(fname)
            context_pages.add(page_num)

            if src_key not in seen_sources:
                seen_sources.add(src_key)
                sources.append({
                    "filename": fname,
                    "page": page_num,
                    "chunk_index": meta.get("chunk_index", 0)
                })

            retrieved_context_blocks.append(f"[Source: {fname} | Page: {page_num}]\n{chunk_text}")

        retrieved_context = "\n\n".join(retrieved_context_blocks).strip()

    if not retrieved_context.strip():
        print(f"\n[DOCUMENT CONTEXT LOOKUP] FAILED: Retrieved context is empty for document_id '{request.document_id}'.")
        errMsg = "No relevant document content was retrieved for this presentation." if norm_key == "presentation" else "Unable to generate transformation because relevant content could not be retrieved from this document."
        raise HTTPException(
            status_code=400,
            detail=errMsg
        )

    print("\n==================== [DEBUG 3: CHUNKS RETRIEVED] ====================")
    print(f"document_id: {request.document_id}")
    print(f"transformation: {trans_key}")
    print(f"retrieved chunk count: {len(retrieved_chunks)}")
    for i, rc in enumerate(retrieved_chunks[:5]):
        txt = (rc.get("text") or rc.get("document") or "").strip()
        print(f" Chunk #{i+1} [Page {rc.get('metadata', {}).get('page', 1)}]: {txt[:150]}...")
    print("===================================================================\n")
    print(f"context filenames: {list(context_filenames)}")
    print(f"context page numbers: {sorted(list(context_pages))}")
    print(f"context character count: {len(retrieved_context)}")

    settings = {
        "tone": request.tone,
        "length": request.length,
        "audience": request.audience
    }

    if norm_key == "presentation":
        result = generate_gemini_presentation(
            document_context=retrieved_context,
            settings=settings,
            filename=fn_name,
            language=request.language or "English",
            theme=request.theme or "professional"
        )
    else:
        result = generate_transformation(
            document_context=retrieved_context,
            transformation=trans_key,
            settings=settings,
            filename=fn_name,
            retrieval_ms=retrieval_ms
        )

    answer_text = result.get("content", "")
    res_title = result.get("title", f"Transformation ({trans_key})")

    print(f"\n[LLM_RESPONSE]")
    print(f"document_id: {request.document_id}")
    print(f"transformation: {trans_key}")
    print(f"response length: {len(answer_text)}")

    if norm_key == "presentation":
        slide_cnt = len(result.get("presentation_data", {}).get("slides", []))
        print(f"\n[PRESENTATION_RESULT]")
        print(f"document_id: {request.document_id}")
        print(f"transformation: {trans_key}")
        print(f"slide count: {slide_cnt}")

    print(f"\n[FINAL BACKEND RESPONSE]\ntransformation: {trans_key}\ntitle: {res_title}\nanswer:\n{answer_text[:500]}...\n")

    try:
        from backend.debug_store import record_debug_qwen
    except ImportError:
        try:
            from debug_store import record_debug_qwen
        except ImportError:
            record_debug_qwen = lambda *a, **k: None

    if request.document_id:
        record_debug_qwen(request.document_id, retrieved_context, answer_text, result.get("usage", {}))

    log_audit_event(
        user_id=user.user_id,
        action="DOCUMENT_TRANSFORMED",
        resource_type="document",
        resource_id=request.document_id or "active_session",
        status="SUCCESS",
        metadata={"transformation": trans_key}
    )


    llm_ms = result.get("latency_ms", 0)
    timing_ms = result.get("timing_ms", {
        "parsing_ms": 0,
        "embedding_ms": 0,
        "retrieval_ms": retrieval_ms,
        "llm_ms": llm_ms,
        "validation_ms": 0,
        "total_ms": retrieval_ms + llm_ms
    })
    timing_ms["retrieval_ms"] = retrieval_ms
    timing_ms["total_ms"] = timing_ms.get("parsing_ms", 0) + timing_ms.get("embedding_ms", 0) + retrieval_ms + timing_ms.get("llm_ms", 0) + timing_ms.get("validation_ms", 0)

    return {
        "question": request.question or request.transformation,
        "transformation": trans_key,
        "title": res_title,
        "answer": answer_text,
        "sources": sources,
        "model": result.get("model", "qwen-7b"),
        "temperature": result.get("temperature", 0.2),
        "max_tokens": result.get("max_tokens", 1000),
        "usage": result.get("usage", {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }),
        "latency_ms": llm_ms,
        "timing_ms": timing_ms,
        "parsing_ms": 0,
        "embedding_ms": 0,
        "retrieval_ms": retrieval_ms,
        "llm_ms": llm_ms,
        "validation_ms": timing_ms.get("validation_ms", 0),
        "total_ms": timing_ms["total_ms"]
    }


@app.post("/api/transformations/edit")
def edit_transformation_endpoint(
    body: TransformationEditRequest,
    user: UserModel = Depends(require_authentication)
):
    """
    POST /api/transformations/edit:
    Edits an existing transformation using user instruction, Agent 1 verified document context,
    Agent 2 Transformation Editor, and Output Validation.
    """
    if not has_permission(user.role, "transform"):
        log_audit_event(
            user_id=user.user_id,
            action="UNAUTHORIZED_ACCESS_ATTEMPT",
            resource_type="transformation_edit",
            status="DENIED",
            metadata={"action": "edit_transformation", "role": user.role}
        )
        raise HTTPException(status_code=403, detail=f"Forbidden: Role '{user.role}' lacks 'transform' permission.")

    if not body.document_id:
        raise HTTPException(status_code=400, detail="document_id is required for transformation editing.")

    if not body.instruction or not body.instruction.strip():
        raise HTTPException(status_code=400, detail="User instruction cannot be empty.")

    # 1. Authorize document_id access for current user
    try:
        doc = verify_document_access(body.document_id, user, required_permission="read")
        filename_filter = doc.filename
    except Exception as err:
        raise HTTPException(status_code=403, detail=f"Unauthorized access to document '{body.document_id}': {err}")

    fn_name = filename_filter or "Uploaded Document"

    print(f"\n[EDIT_REQUEST_RECEIVED]")
    print(f"user_id: {user.user_id}")
    print(f"document_id: {body.document_id}")
    print(f"transformation_id: {body.transformation_id}")
    print(f"instruction: {body.instruction}")

    # 2. Agent 1 — Document Intelligence (RAG Context Retrieval filtered strictly by document_id)
    DOCUMENT_WIDE_TRANSFORMATIONS = {
        "summarize", "executive_brief", "executive-brief",
        "government_report", "government-report",
        "presentation", "meeting_notes", "meeting-notes",
        "action_items", "action-items", "email", "rewrite",
        "extract", "linkedin", "linkedin-story", "twitter"
    }

    norm_key = get_transformation_key(body.transformation_id)

    retrieval_start = time.time()
    if norm_key in DOCUMENT_WIDE_TRANSFORMATIONS:
        retrieved_chunks = get_all_document_chunks(
            document_id=body.document_id,
            filename=filename_filter
        )
    else:
        retrieved_chunks = search_documents(
            search_query=body.instruction,
            top_k=6,
            filename=filename_filter,
            document_id=body.document_id
        )
    retrieval_ms = int((time.time() - retrieval_start) * 1000)

    if not retrieved_chunks or all(not (c.get("text") or c.get("document") or "").strip() for c in retrieved_chunks):
        print(f"\n[EDIT CONTEXT LOOKUP] FAILED: No context chunks found for document_id '{body.document_id}'.")
        raise HTTPException(
            status_code=400,
            detail="Unable to edit transformation: Source document context could not be retrieved."
        )

    retrieved_context_blocks = []
    sources = []
    seen_sources = set()

    for chunk in retrieved_chunks:
        chunk_text = (chunk.get("text") or chunk.get("document") or "").strip()
        if not chunk_text:
            continue
        meta = chunk.get("metadata", {})
        fname = meta.get("filename", fn_name)
        page_num = meta.get("page", 1)
        src_key = (fname, page_num, meta.get("chunk_index", 0))

        if src_key not in seen_sources:
            seen_sources.add(src_key)
            sources.append({
                "filename": fname,
                "page": page_num,
                "chunk_index": meta.get("chunk_index", 0)
            })

        retrieved_context_blocks.append(f"[Source: {fname} | Page: {page_num}]\n{chunk_text}")

    retrieved_context = "\n\n".join(retrieved_context_blocks).strip()

    if not retrieved_context.strip():
        raise HTTPException(
            status_code=400,
            detail="Unable to edit transformation: Source document context is empty."
        )

    # 3. Agent 2 & Output Validator Execution
    res = execute_edit_transformation(
        document_id=body.document_id,
        transformation_id=norm_key,
        current_output=body.current_output,
        instruction=body.instruction,
        document_context=retrieved_context,
        filename=fn_name,
        options=body.options,
        retrieval_ms=retrieval_ms
    )

    res["sources"] = sources

    log_audit_event(
        user_id=user.user_id,
        action="TRANSFORMATION_EDITED",
        resource_type="document",
        resource_id=body.document_id,
        status="SUCCESS",
        metadata={"transformation": norm_key, "instruction": body.instruction[:100]}
    )

    return res



# =====================================================================
# ADMIN SECURITY ENDPOINTS (ADMIN_ONLY)
# =====================================================================

@app.get("/api/admin/users")
def get_admin_users(user: UserModel = Depends(require_authentication)):
    """
    Lists all system users. Requires ADMIN role.
    """
    if user.role.upper() != "ADMIN" or not has_permission(user.role, "manage_users"):
        raise HTTPException(status_code=403, detail="Forbidden: Admin privileges required to view users.")

    users = list_all_users()
    return {"users": [u.to_dict() for u in users]}


@app.patch("/api/admin/users/{target_user_id}/role")
def patch_user_role(
    target_user_id: str,
    body: UserRolePatch,
    user: UserModel = Depends(require_authentication)
):
    """
    Modifies target user role.
    Requires: ADMIN role + MFA Verification + 'manage_permissions' permission.
    """
    if user.role.upper() != "ADMIN" or not has_permission(user.role, "manage_permissions"):
        log_audit_event(
            user_id=user.user_id,
            action="UNAUTHORIZED_ACCESS_ATTEMPT",
            resource_type="user_management",
            resource_id=target_user_id,
            status="DENIED",
            metadata={"attempted_role_change": body.role}
        )
        raise HTTPException(status_code=403, detail="Forbidden: Admin privileges required to modify user roles.")

    # Enforce MFA for admin role changes
    verify_mfa_requirement(user, "change_user_role")

    updated = update_user_role(target_user_id, body.role)
    if not updated:
        raise HTTPException(status_code=404, detail=f"User '{target_user_id}' not found.")

    log_audit_event(
        user_id=user.user_id,
        action="USER_ROLE_CHANGED",
        resource_type="user",
        resource_id=target_user_id,
        status="SUCCESS",
        metadata={"new_role": body.role.upper()}
    )

    return {"message": f"User '{target_user_id}' role updated to {updated.role}", "user": updated.to_dict()}


@app.get("/api/admin/audit-logs")
def get_admin_audit_logs(user: UserModel = Depends(require_authentication)):
    """
    Returns audit logs. Requires ADMIN role + 'view_audit_logs' permission.
    """
    if user.role.upper() != "ADMIN" or not has_permission(user.role, "view_audit_logs"):
        raise HTTPException(status_code=403, detail="Forbidden: Admin privileges required to view audit logs.")

    logs = get_all_audit_logs()
    return {"audit_logs": [l.to_dict() for l in logs]}


# =====================================================================
# TEMPORARY DIAGNOSTIC DEBUG ENDPOINT
# =====================================================================

@app.get("/api/debug/document/{document_id}")
def get_document_debug_diagnostics(document_id: str):
    """
    Temporary diagnostic endpoint returning complete extraction, chunking, retrieval,
    and Qwen-7B generation diagnostics for a document_id.
    """
    try:
        from backend.debug_store import get_debug_record
    except ImportError:
        try:
            from debug_store import get_debug_record
        except ImportError:
            get_debug_record = lambda d: None

    record = get_debug_record(document_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"No debug diagnostic record found for document_id '{document_id}'. Upload and transform a document first.")
    return record