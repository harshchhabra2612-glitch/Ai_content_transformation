import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException
from pydantic import BaseModel, Field

from backend.security.config import DATA_DIR
from backend.security.file_validator import get_safe_storage_path
from backend.security.users import UserModel

DOCUMENTS_FILE = os.path.join(DATA_DIR, "documents.json")
_doc_lock = threading.Lock()


class DocumentModel(BaseModel):
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    filename: str
    safe_storage_filename: str
    file_type: str
    file_size: int
    storage_reference: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    shared_with: List[str] = Field(default_factory=list)

    def to_dict(self) -> dict:
        return self.model_dump()


def _load_documents_from_disk() -> Dict[str, dict]:
    if not os.path.exists(DOCUMENTS_FILE):
        return {}
    try:
        with open(DOCUMENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[DOCUMENTS STORAGE WARNING] Failed to load documents.json: {e}")
        return {}


def _save_documents_to_disk(docs_data: Dict[str, dict]):
    try:
        with open(DOCUMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(docs_data, f, indent=2)
    except Exception as e:
        print(f"[DOCUMENTS STORAGE ERROR] Failed to save documents.json: {e}")


def create_document_record(
    owner_id: str,
    filename: str,
    file_type: str,
    file_size: int,
    file_bytes: bytes
) -> DocumentModel:
    doc_id = str(uuid.uuid4())
    storage_path = get_safe_storage_path(doc_id)

    # Save physical raw file securely
    with open(storage_path, "wb") as f:
        f.write(file_bytes)

    now = datetime.now(timezone.utc).isoformat()
    doc = DocumentModel(
        document_id=doc_id,
        owner_id=owner_id,
        filename=filename,
        safe_storage_filename=f"{doc_id}.bin",
        file_type=file_type,
        file_size=file_size,
        storage_reference=storage_path,
        created_at=now,
        updated_at=now,
        shared_with=[]
    )

    with _doc_lock:
        docs = _load_documents_from_disk()
        docs[doc_id] = doc.to_dict()
        _save_documents_to_disk(docs)

    return doc


def get_document_by_id(document_id: str) -> Optional[DocumentModel]:
    with _doc_lock:
        docs = _load_documents_from_disk()
        data = docs.get(document_id)
        if data:
            return DocumentModel(**data)
        return None


def verify_document_access(document_id: str, user: UserModel, required_permission: str = "read") -> DocumentModel:
    """
    Verifies user ownership or authorized sharing before granting document access.
    Raises:
      404 Not Found if document doesn't exist.
      403 Forbidden if user lacks ownership/permission.
    """
    doc = get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not Found: Requested document does not exist or has been deleted.")

    # Check access: Admin OR Owner OR Explicitly Shared
    is_owner = (doc.owner_id == user.user_id)
    is_shared = (user.user_id in doc.shared_with)
    is_admin = (user.role.upper() == "ADMIN")

    if not (is_owner or is_shared or is_admin):
        # Audit unauthorized attempt asynchronously
        from backend.security.audit import log_audit_event
        log_audit_event(
            user_id=user.user_id,
            action="UNAUTHORIZED_ACCESS_ATTEMPT",
            resource_type="document",
            resource_id=document_id,
            status="DENIED",
            metadata={"reason": "User is neither owner nor shared recipient", "role": user.role}
        )
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to access or modify this document."
        )

    return doc


def list_user_documents(user: UserModel) -> List[DocumentModel]:
    with _doc_lock:
        docs = _load_documents_from_disk()
        result = []
        for d in docs.values():
            doc = DocumentModel(**d)
            if user.role.upper() == "ADMIN" or doc.owner_id == user.user_id or user.user_id in doc.shared_with:
                result.append(doc)
        return result


def delete_document_record(document_id: str, user: UserModel) -> bool:
    doc = verify_document_access(document_id, user, required_permission="delete")
    
    # Remove physical file if exists
    if os.path.exists(doc.storage_reference):
        try:
            os.remove(doc.storage_reference)
        except Exception as e:
            print(f"[DOCUMENT DELETE WARNING] Could not remove physical file: {e}")

    with _doc_lock:
        docs = _load_documents_from_disk()
        if document_id in docs:
            del docs[document_id]
            _save_documents_to_disk(docs)
            return True
    return False


def share_document_record(document_id: str, owner_user: UserModel, target_user_id: str) -> DocumentModel:
    doc = verify_document_access(document_id, owner_user, required_permission="share")

    with _doc_lock:
        docs = _load_documents_from_disk()
        if document_id in docs:
            shared = docs[document_id].get("shared_with", [])
            if target_user_id not in shared:
                shared.append(target_user_id)
                docs[document_id]["shared_with"] = shared
                docs[document_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                _save_documents_to_disk(docs)
            return DocumentModel(**docs[document_id])
    return doc
