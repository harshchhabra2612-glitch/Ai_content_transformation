from fastapi import HTTPException
import backend.security.config as config
from backend.security.users import UserModel


def is_mfa_required_for_action(action: str) -> bool:
    """
    Returns True if global MFA enforcement is enabled and the action is in MFA_REQUIRED_OPERATIONS,
    or if global MFA enforcement is forced.
    """
    if not config.ENFORCE_MFA:
        return False
    return action in config.MFA_REQUIRED_OPERATIONS


def verify_mfa_requirement(user: UserModel, action: str):
    """
    Enforces MFA verification for sensitive actions.
    If MFA is required and user is not MFA verified, raises HTTP 403.
    """
    if is_mfa_required_for_action(action):
        if not user.mfa_verified:
            raise HTTPException(
                status_code=403,
                detail=f"MFA_REQUIRED: Sensitive operation '{action}' requires multi-factor authentication verification."
            )


def require_mfa(user: UserModel) -> UserModel:
    """
    FastAPI dependency to strictly require verified MFA.
    """
    if not user.mfa_verified:
        raise HTTPException(
            status_code=403,
            detail="MFA_REQUIRED: Multi-Factor Authentication verification is required to perform this action."
        )
    return user
