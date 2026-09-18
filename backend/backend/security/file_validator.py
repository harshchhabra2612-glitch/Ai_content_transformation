import os
import re
import uuid
from typing import Tuple, Dict, Any, Optional
from fastapi import HTTPException

try:
    from backend.security.config import (
        ALLOWED_EXTENSIONS,
        ALLOWED_MIME_TYPES,
        MAX_FILE_SIZE_BYTES,
        MAX_FILE_SIZE_MB,
        STORAGE_DIR,
    )
    from backend.security.file_registry import (
        DANGEROUS_EXTENSIONS,
        ALLOWED_MIME_TYPES as REG_MIME_MAP,
        detect_file_signature_match,
        DOCUMENTS, IMAGES, AUDIO, VIDEO, ARCHIVES
    )
    from backend.security.archive_validator import inspect_and_extract_archive, ArchiveSecurityError
except ImportError:
    from security.config import (
        ALLOWED_EXTENSIONS,
        ALLOWED_MIME_TYPES,
        MAX_FILE_SIZE_BYTES,
        MAX_FILE_SIZE_MB,
        STORAGE_DIR,
    )
    from security.file_registry import (
        DANGEROUS_EXTENSIONS,
        ALLOWED_MIME_TYPES as REG_MIME_MAP,
        detect_file_signature_match,
        DOCUMENTS, IMAGES, AUDIO, VIDEO, ARCHIVES
    )
    from security.archive_validator import inspect_and_extract_archive, ArchiveSecurityError


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes raw user filename to prevent path traversal and shell injection.
    Strips directory separators, null bytes, control characters, and unsafe filesystem characters.
    Never returns paths with '../', '..\\\\', or absolute directories.
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

    if not cleaned or cleaned in {".", ".."}:
        return "unnamed_document.txt"

    return cleaned


def detect_file_type(filename: str, content_type: Optional[str] = None) -> str:
    """Detects primary file extension / type from filename."""
    sanitized = sanitize_filename(filename)
    ext = os.path.splitext(sanitized)[1].lower()
    return ext.lstrip(".")


def validate_extension(ext: str) -> bool:
    """Checks if extension is permitted and not dangerous."""
    if not ext:
        return False
    norm_ext = f".{ext.lstrip('.').lower()}"
    if norm_ext in DANGEROUS_EXTENSIONS:
        return False
    return norm_ext in ALLOWED_EXTENSIONS


def validate_mime_type(ext: str, declared_mime: Optional[str]) -> bool:
    """Checks declared MIME type against registry rules."""
    if not declared_mime:
        return True
    norm_ext = f".{ext.lstrip('.').lower()}"
    norm_mime = declared_mime.lower().split(";")[0].strip()

    if norm_mime in {"application/octet-stream", "text/plain", "binary/octet-stream"}:
        return True

    allowed_set = REG_MIME_MAP.get(norm_ext, set())
    if not allowed_set:
        return True

    return norm_mime in allowed_set or norm_mime in ALLOWED_MIME_TYPES


def validate_magic_bytes(file_bytes: bytes, ext: str) -> bool:
    """Validates file signature / magic bytes."""
    norm_ext = f".{ext.lstrip('.').lower()}"
    return detect_file_signature_match(file_bytes, norm_ext)


def validate_file_signature(file_bytes: bytes, ext: str) -> bool:
    """Alias for magic bytes signature validation."""
    return validate_magic_bytes(file_bytes, ext)


def validate_file_size(size_bytes: int) -> None:
    """Enforces 300 MB upload size limit strictly."""
    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")
    try:
        from backend.security import config as sec_cfg
    except ImportError:
        from security import config as sec_cfg

    if size_bytes > sec_cfg.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds the maximum allowed limit of 300 MB."
        )


def check_archive_safety(file_bytes: bytes, ext: str) -> None:
    """Validates archive security (zip bomb, path traversal, dangerous contents)."""
    norm_ext = f".{ext.lstrip('.').lower()}"
    if norm_ext in ARCHIVES:
        try:
            inspect_and_extract_archive(file_bytes, norm_ext)
        except ArchiveSecurityError as ase:
            raise HTTPException(
                status_code=400,
                detail=f"File could not be processed because it failed security validation."
            )


def validate_upload(filename: str, content_type: Optional[str], file_bytes: bytes) -> Tuple[str, str, str]:
    """
    Centralized upload validator conceptual function.
    Validates file size, extension, MIME type, magic bytes, and archive safety.
    """
    return validate_upload_file(filename, content_type, file_bytes)


def validate_upload_file(filename: str, content_type: Optional[str], file_bytes: bytes) -> Tuple[str, str, str]:
    """
    Authoritative file upload security validator:
    1. Size Check (<= 300 MB)
    2. Filename Sanitization against path traversal
    3. Executable / Dangerous extension check
    4. Allowed extension check
    5. MIME type check
    6. Magic Bytes / File Signature Check
    7. Archive safety check for archives
    
    Returns (sanitized_filename, file_ext, file_type).
    Raises HTTPException (400, 413) with clear user-facing error messages on validation failure.
    """
    # 1. Size Check
    validate_file_size(len(file_bytes))

    # 2. Filename & Extension Sanitization
    raw_sanitized = sanitize_filename(filename)
    ext = os.path.splitext(raw_sanitized)[1].lower()

    if not ext or ext in DANGEROUS_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="File could not be processed because it failed security validation."
        )

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="File type could not be verified."
        )

    # 3. MIME Validation
    if not validate_mime_type(ext, content_type):
        print(f"[SECURITY WARNING] Non-standard MIME type '{content_type}' declared for extension '{ext}'")

    # 4. Magic Bytes Signature Check (Detect renamed executables or mismatched headers)
    if not validate_magic_bytes(file_bytes, ext):
        raise HTTPException(
            status_code=400,
            detail="File type could not be verified."
        )

    # 5. Archive Safety Check
    if ext in ARCHIVES:
        check_archive_safety(file_bytes, ext)

    file_type = ext.lstrip(".")
    return raw_sanitized, ext, file_type


def get_safe_storage_path(document_id: str) -> str:
    """
    Constructs an isolated, non-traversable file storage path using document_id.
    Never uses raw user filenames in storage path construction.
    """
    safe_id = str(uuid.UUID(document_id)) if isinstance(document_id, str) else str(document_id)
    return os.path.join(STORAGE_DIR, f"{safe_id}.bin")
