import json
import os
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field

from backend.security.config import DATA_DIR

USERS_FILE = os.path.join(DATA_DIR, "users.json")
_lock = threading.Lock()


class UserModel(BaseModel):
    user_id: str
    email: str
    display_name: str = ""
    role: str = "OFFICER"  # Default initial role: OFFICER
    mfa_enabled: bool = False
    mfa_verified: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "active"

    def to_dict(self) -> dict:
        return self.model_dump()


def _load_users_from_disk() -> Dict[str, dict]:
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[USERS STORAGE WARNING] Failed to load users.json: {e}")
        return {}


def _save_users_to_disk(users_data: Dict[str, dict]):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users_data, f, indent=2)
    except Exception as e:
        print(f"[USERS STORAGE ERROR] Failed to save users.json: {e}")


def get_user_by_id(user_id: str) -> Optional[UserModel]:
    with _lock:
        users = _load_users_from_disk()
        data = users.get(user_id)
        if data:
            return UserModel(**data)
        return None


def get_or_create_user(user_id: str, email: str, display_name: str = "") -> UserModel:
    with _lock:
        users = _load_users_from_disk()
        now = datetime.now(timezone.utc).isoformat()

        if user_id in users:
            user_data = users[user_id]
            # Optionally sync email or display_name if updated
            if email and user_data.get("email") != email:
                user_data["email"] = email
                user_data["updated_at"] = now
            if display_name and not user_data.get("display_name"):
                user_data["display_name"] = display_name
                user_data["updated_at"] = now
            users[user_id] = user_data
            _save_users_to_disk(users)
            return UserModel(**user_data)

        # Default role: First user created in empty system or designated admin can be ADMIN, default OFFICER
        initial_role = "ADMIN" if len(users) == 0 or "admin" in email.lower() else "OFFICER"
        
        new_user = UserModel(
            user_id=user_id,
            email=email,
            display_name=display_name or (email.split("@")[0].title() if email else "ERA User"),
            role=initial_role,
            mfa_enabled=False,
            mfa_verified=False,
            created_at=now,
            updated_at=now,
            status="active"
        )
        users[user_id] = new_user.to_dict()
        _save_users_to_disk(users)
        return new_user


def update_user_role(target_user_id: str, new_role: str) -> Optional[UserModel]:
    valid_roles = {"ADMIN", "OFFICER", "ANALYST", "VIEWER"}
    if new_role.upper() not in valid_roles:
        raise ValueError(f"Invalid role: {new_role}. Must be one of {valid_roles}")

    with _lock:
        users = _load_users_from_disk()
        if target_user_id not in users:
            return None

        users[target_user_id]["role"] = new_role.upper()
        users[target_user_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
        _save_users_to_disk(users)
        return UserModel(**users[target_user_id])


def update_user_mfa_status(user_id: str, mfa_enabled: Optional[bool] = None, mfa_verified: Optional[bool] = None) -> Optional[UserModel]:
    with _lock:
        users = _load_users_from_disk()
        if user_id not in users:
            return None

        if mfa_enabled is not None:
            users[user_id]["mfa_enabled"] = mfa_enabled
        if mfa_verified is not None:
            users[user_id]["mfa_verified"] = mfa_verified

        users[user_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
        _save_users_to_disk(users)
        return UserModel(**users[user_id])


def list_all_users() -> List[UserModel]:
    with _lock:
        users = _load_users_from_disk()
        return [UserModel(**u) for u in users.values()]
