"""
models/auth_models.py
Pydantic models for request validation, response serialization,
and DB representation. Keep all auth-related schemas here.
"""
from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ─────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────

class Role(str, Enum):
    pathologist = "pathologist"
    researcher  = "researcher"
    admin       = "admin"


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────

class SignupRequest(BaseModel):
    """
    Fields used by service.sign_up():
      - data.email        → admin.create_user + sign_in_with_password
      - data.password     → admin.create_user + sign_in_with_password
      - data.full_name    → user_metadata
      - data.role         → user_metadata
    """
    email:     EmailStr
    password:  str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=150)
    role:      Role

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit.")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "email":     "ada@university.edu",
                "password":  "Secure123",
                "full_name": "Ada Lovelace",
                "role":      "researcher",
            }
        }
    }


class LoginRequest(BaseModel):
    """
    Fields used by service.sign_in():
      - data.email    → sign_in_with_password
      - data.password → sign_in_with_password
      - data.role     → post-login role check against profile.role
                        (NOT passed to Supabase auth directly)
    """
    email:    EmailStr
    password: str
    role:     Role

    model_config = {
        "json_schema_extra": {
            "example": {
                "email":    "ada@university.edu",
                "password": "Secure123",
                "role":     "researcher",
            }
        }
    }


class RefreshRequest(BaseModel):
    """Used by service.refresh_tokens()."""
    refresh_token: str


# ─────────────────────────────────────────────
# RESPONSE MODELS
# ─────────────────────────────────────────────

class UserProfile(BaseModel):
    """
    Returned by _row_to_profile() in service.py.
    Maps exactly to public.profiles table columns:
      id, full_name, role, created_at
    """
    id:         str
    full_name:  Optional[str] = None
    role:       Optional[str] = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class AuthResponse(BaseModel):
    """
    Returned by service.sign_up() and service.sign_in().
    Contains JWT tokens + serialized user profile.
    """
    access_token:  str
    refresh_token: str
    token_type:    str         = "bearer"
    user:          UserProfile


class TokenRefreshResponse(BaseModel):
    """Returned by service.refresh_tokens()."""
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"

class MessageResponse(BaseModel):
    """Generic success message — used by logout."""
    message: str
    success: bool = True