import os
from typing import List, Set

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
STORAGE_DIR = os.path.join(BASE_DIR, "storage", "documents")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(STORAGE_DIR, exist_ok=True)

# CORS Configuration - Strict list of allowed origins (No wildcards '*')
ALLOWED_ORIGINS_STR = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:3000,http://localhost:4173")
ALLOWED_ORIGINS: List[str] = [origin.strip() for origin in ALLOWED_ORIGINS_STR.split(",") if origin.strip()]

# MFA Policy Configuration
# Set ENFORCE_MFA=True to require verified MFA state for sensitive operations
ENFORCE_MFA: bool = os.getenv("ENFORCE_MFA", "false").lower() in ("true", "1", "yes")

MFA_REQUIRED_OPERATIONS: Set[str] = {
    "delete_document",
    "share_document",
    "export_sensitive",
    "change_user_role",
    "view_audit_logs",
}

# File Upload Security Settings
MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "15"))
MAX_FILE_SIZE_BYTES: int = MAX_FILE_SIZE_MB * 1024 * 1024

ALLOWED_EXTENSIONS: Set[str] = {".pdf", ".docx", ".pptx", ".xlsx", ".txt"}
ALLOWED_MIME_TYPES: Set[str] = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}

# Rate Limiting Settings
RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
