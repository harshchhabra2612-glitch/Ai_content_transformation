import os
import re
import uuid
from typing import Tuple
from fastapi import HTTPException

from backend.security.config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_MB,
    STORAGE_DIR,
)


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes raw user filename to prevent path traversal and shell injection.
    Strips directory separators, null bytes, and dangerous characters.
    """
    if not filename:
        return "unnamed_document.txt"

    # Remove path components (e.g. "../../secret.txt" -> "secret.txt")
    cleaned = os.path.basename(filename)
    cleaned = cleaned.replace("\\", "/").split("/")[-1]

    # Remove null bytes and non-printable characters
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", cleaned)

    # Keep safe alphanumeric characters, dots, dashes, underscores, and spaces
    cleaned = re.sub(r"[^\w\s\.\-]", "_", cleaned)
    cleaned = cleaned.strip()

    if not cleaned:
        return "unnamed_document.txt"

    return cleaned


def validate_upload_file(filename: str, content_type: str, file_bytes: bytes) -> Tuple[str, str, str]:
    """
    Validates file extension, MIME type, file size, and sanitizes filename.
    Returns (sanitized_filename, file_ext, file_type).
    Raises HTTPException (400, 413) if invalid.
    """
    # 1. Size Validation
    size = len(file_bytes)
    if size == 0:
        raise HTTPException(status_code=400, detail="Bad Request: Uploaded file is empty (0 bytes).")
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Payload Too Large: File size ({size / (1024*1024):.2f}MB) exceeds maximum limit of {MAX_FILE_SIZE_MB}MB."
        )

    # 2. Filename & Extension Sanitization
    raw_sanitized = sanitize_filename(filename)
    ext = os.path.splitext(raw_sanitized)[1].lower()

    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Bad Request: File extension '{ext}' is not permitted. Allowed extensions: {sorted(list(ALLOWED_EXTENSIONS))}"
        )

    # 3. Executable / Danger Check
    dangerous_exts = {".exe", ".sh", ".bat", ".cmd", ".php", ".py", ".js", ".vbs", ".ps1", ".dll", ".so", ".elf"}
    if ext in dangerous_exts:
        raise HTTPException(
            status_code=400,
            detail="Bad Request: Executable or script file uploads are strictly prohibited."
        )

    # 4. MIME Type Validation (if header provided)
    if content_type:
        normalized_mime = content_type.lower().split(";")[0].strip()
        # Allow text/plain or octet-stream for plain text or generic uploads if extension matches
        if normalized_mime not in ALLOWED_MIME_TYPES and normalized_mime != "application/octet-stream":
            print(f"[FILE SECURITY WARNING] Non-standard MIME type '{content_type}' for extension '{ext}'")

    file_type = ext.lstrip(".")
    return raw_sanitized, ext, file_type


def get_safe_storage_path(document_id: str) -> str:
    """
    Constructs an isolated, non-traversable file storage path using document_id.
    Never uses raw user filenames in storage path construction.
    """
    safe_id = str(uuid.UUID(document_id)) if isinstance(document_id, str) else str(document_id)
    return os.path.join(STORAGE_DIR, f"{safe_id}.bin")
