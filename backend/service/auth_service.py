"""
service/auth_service.py
Uses admin.create_user (email_confirm=True) so no confirmation
email is ever sent — matches the working reference pattern.
"""
from __future__ import annotations

import os
import traceback

from dotenv import load_dotenv
from supabase import Client, create_client

from models.auth_models import (
    AuthResponse,
    LoginRequest,
    # ProfileUpdate,
    SignupRequest,
    TokenRefreshResponse,
    UserProfile,
)

load_dotenv()



# ─────────────────────────────────────────────
# Supabase clients
# ─────────────────────────────────────────────

_SUPABASE_URL         = os.environ["SUPABASE_URL"]
_SUPABASE_ANON_KEY    = os.environ["SUPABASE_ANON_KEY"]
_SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# Admin client — service role key, bypasses RLS, used for admin.create_user
supabase_admin: Client = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_KEY)

# Anon client — used for sign_in_with_password to get a proper JWT session
supabase_anon: Client  = create_client(_SUPABASE_URL, _SUPABASE_ANON_KEY)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _row_to_profile(row: dict) -> UserProfile:
    return UserProfile(
        id         = row["id"],
        full_name  = row.get("full_name"),
        role       = row.get("role"),
        created_at = row["created_at"],
    )


def _fetch_profile(user_id: str) -> UserProfile:
    """Fetch profile row by UUID — raises ValueError if not found."""
    try:
        result = (
            supabase_admin
            .table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise ValueError(f"Profile not found (DB error: {exc})") from exc

    if not result.data:
        raise ValueError(f"Profile not found for user_id={user_id}")

    row = result.data if isinstance(result.data, dict) else result.data[0]
    return _row_to_profile(row)


# ─────────────────────────────────────────────
# AuthService
# ─────────────────────────────────────────────

class AuthService:

    # ── Sign-up ──────────────────────────────

    async def sign_up(self, data: SignupRequest) -> AuthResponse:
        """
        1. admin.create_user with email_confirm=True — no confirmation email.
        2. DB trigger reads user_metadata to auto-insert into public.profiles.
        3. Sign in immediately to get JWT session tokens.
        4. Return tokens + profile.
        """

        # 1. Create user via admin API
        try:
            auth_res = supabase_admin.auth.admin.create_user({
                "email":         data.email,
                "password":      data.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": data.full_name,
                    "role":      data.role,
                },
            })
        except Exception as exc:
            raise ValueError(f"Signup failed: {exc}") from exc

        user = auth_res.user
        if not user:
            raise ValueError("Signup failed — Supabase returned no user.")


        # 2. Sign in immediately to obtain JWT tokens
        try:
            session_res = supabase_anon.auth.sign_in_with_password({
                "email":    data.email,
                "password": data.password,
            })
        except Exception as exc:
            raise ValueError(
                "Account created but auto-login failed. Please log in manually."
            ) from exc

        if session_res.session is None or session_res.user is None:
            raise ValueError("Account created but auto-login failed. Please log in manually.")

        # 3. Fetch the auto-created profile (inserted by DB trigger)
        profile = _fetch_profile(user.id)


        return AuthResponse(
            access_token  = session_res.session.access_token,
            refresh_token = session_res.session.refresh_token,
            user          = profile,
        )

    # ── Sign-in ──────────────────────────────

    async def sign_in(self, data: LoginRequest) -> AuthResponse:

        try:
            resp = supabase_anon.auth.sign_in_with_password({
                "email":    data.email,
                "password": data.password,
            })
        except Exception as exc:
            raise ValueError("Invalid email or password.") from exc

        if resp.user is None or resp.session is None:
            raise ValueError("Invalid email or password.")

        profile = _fetch_profile(resp.user.id)

        # Enforce that the user is signing in with the correct role
        if data.role and profile.role != data.role:
            raise ValueError("Role does not match this account.")


        return AuthResponse(
            access_token  = resp.session.access_token,
            refresh_token = resp.session.refresh_token,
            user          = profile,
        )

    # ── Sign-out ─────────────────────────────

    async def sign_out(self) -> None:
        try:
            supabase_anon.auth.sign_out()
        except Exception as exc:
            raise ValueError(f"Logout failed: {exc}") from exc
    # ── Token verification ────────────────────

    async def verify_token(self, token: str) -> dict:
        try:
            resp = supabase_admin.auth.get_user(token)
        except Exception as exc:
            raise ValueError("Token is invalid or expired.") from exc

        if resp.user is None:
            raise ValueError("Token is invalid or expired.")

        return {"user_id": resp.user.id, "email": resp.user.email}

    # ── Token refresh ─────────────────────────

    async def refresh_tokens(self, refresh_token: str) -> TokenRefreshResponse:
        try:
            resp = supabase_anon.auth.refresh_session(refresh_token)
        except Exception as exc:
            raise ValueError("Refresh token is invalid or expired.") from exc

        if resp.session is None:
            raise ValueError("Refresh token is invalid or expired.")

        return TokenRefreshResponse(
            access_token  = resp.session.access_token,
            refresh_token = resp.session.refresh_token,
        )

    # ── Profile CRUD ──────────────────────────

    async def get_profile_by_id(self, user_id: str) -> UserProfile:
        return _fetch_profile(user_id)

    # async def update_profile(self, user_id: str, data: ProfileUpdate) -> UserProfile:
    #     payload = {k: v for k, v in data.model_dump().items() if v is not None}
    #     if not payload:
    #         return _fetch_profile(user_id)
    #     try:
    #         supabase_admin.table("profiles").update(payload).eq("id", user_id).execute()
    #     except Exception as exc:
    #         raise ValueError(f"Profile update failed: {exc}") from exc
    #     return _fetch_profile(user_id)


# ─────────────────────────────────────────────
# Singleton instance — import this in routes
# ─────────────────────────────────────────────
auth_service = AuthService()   # ← this was missing, causing the class to be used directly