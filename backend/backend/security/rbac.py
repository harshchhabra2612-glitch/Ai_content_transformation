from typing import Callable, Set, List
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.security.users import UserModel

# Centralized Role & Permission Definitions
ROLE_PERMISSIONS: dict[str, Set[str]] = {
    "ADMIN": {
        "upload",
        "read",
        "transform",
        "export",
        "share",
        "delete",
        "manage_users",
        "manage_permissions",
        "view_audit_logs",
    },
    "OFFICER": {
        "upload",
        "read",
        "transform",
        "export",
        "share",
    },
    "ANALYST": {
        "upload",
        "read",
        "transform",
        "export",
    },
    "VIEWER": {
        "read",
    },
}


def get_permissions_for_role(role: str) -> Set[str]:
    return ROLE_PERMISSIONS.get(role.upper(), set())


def has_permission(role: str, permission: str) -> bool:
    perms = get_permissions_for_role(role)
    return permission in perms



def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory to enforce specific role(s).
    """
    allowed_set = {r.upper() for r in allowed_roles}

    def role_checker(user: UserModel = Depends()) -> UserModel:
        if user.role.upper() not in allowed_set:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires one of roles {allowed_roles}. Current role: '{user.role}'"
            )
        return user

    return role_checker


def require_permission(permission: str):
    """
    FastAPI dependency factory to enforce a specific permission based on RBAC matrix.
    """
    def permission_checker(user: UserModel) -> UserModel:
        if not has_permission(user.role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Role '{user.role}' lacks required permission '{permission}'"
            )
        return user

    return permission_checker
