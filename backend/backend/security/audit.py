import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from backend.security.config import DATA_DIR

AUDIT_FILE = os.path.join(DATA_DIR, "audit_logs.json")
_audit_lock = threading.Lock()


class AuditLogEntry(BaseModel):
    audit_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action: str
    resource_type: str = "system"
    resource_id: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "SUCCESS"  # SUCCESS, DENIED, FAILED
    ip_address: Optional[str] = "127.0.0.1"
    user_agent: Optional[str] = ""
    metadata: dict = Field(default_factory=dict)

    def to_dict(self) -> dict:
        return self.model_dump()


def _load_audit_logs() -> List[dict]:
    if not os.path.exists(AUDIT_FILE):
        return []
    try:
        with open(AUDIT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[AUDIT LOG WARNING] Failed to read audit_logs.json: {e}")
        return []


def _save_audit_logs(logs: List[dict]):
    try:
        with open(AUDIT_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        print(f"[AUDIT LOG ERROR] Failed to save audit_logs.json: {e}")


def log_audit_event(
    user_id: str,
    action: str,
    resource_type: str = "system",
    resource_id: str = "",
    status: str = "SUCCESS",
    ip_address: Optional[str] = "127.0.0.1",
    user_agent: Optional[str] = "",
    metadata: Optional[dict] = None
) -> AuditLogEntry:
    # Filter sensitive fields from metadata if present
    safe_metadata = dict(metadata) if metadata else {}
    for sensitive_key in ("password", "token", "secret", "private_key", "credentials"):
        if sensitive_key in safe_metadata:
            safe_metadata[sensitive_key] = "[REDACTED]"

    entry = AuditLogEntry(
        audit_id=str(uuid.uuid4()),
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        status=status,
        ip_address=ip_address or "127.0.0.1",
        user_agent=user_agent or "",
        metadata=safe_metadata
    )

    with _audit_lock:
        logs = _load_audit_logs()
        logs.append(entry.to_dict())
        _save_audit_logs(logs)

    return entry


def get_all_audit_logs() -> List[AuditLogEntry]:
    with _audit_lock:
        logs = _load_audit_logs()
        return [AuditLogEntry(**item) for item in reversed(logs)]
