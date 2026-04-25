"""
routes/auth_routes.py
FastAPI router for all authentication endpoints.
Mount in main.py:  app.include_router(auth_router)
"""
from __future__ import annotations

import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from models.auth_models import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    SignupRequest,
    TokenRefreshResponse,
    UserProfile,
)
# FIX: import the instance auth_service, NOT the class AuthService
from service.auth_service import auth_service

# ─────────────────────────────────────────────
# Logger
# ─────────────────────────────────────────────

logger = logging.getLogger("auth")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
_bearer = HTTPBearer()


# ─────────────────────────────────────────────
# Dependency: resolve current user from JWT
# ─────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    try:
        return await auth_service.verify_token(credentials.credentials)
    except ValueError as exc:
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─────────────────────────────────────────────
# Public routes
# ─────────────────────────────────────────────

@auth_router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def signup(body: SignupRequest) -> AuthResponse:
    logger.debug("POST /auth/signup — email=%s role=%s", body.email, body.role)
    try:
        result = await auth_service.sign_up(body)
        logger.info("Signup success — user_id=%s", result.user.id)
        return result

    except ValueError as exc:
        logger.warning("Signup ValueError: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except Exception as exc:
        logger.error("Signup unexpected error:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {type(exc).__name__}: {exc}",
        )


@auth_router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login with email, password, and role",
)
async def login(body: LoginRequest) -> AuthResponse:
    logger.debug("POST /auth/login — email=%s role=%s", body.email, body.role)
    try:
        result = await auth_service.sign_in(body)
        logger.info("Login success — user_id=%s", result.user.id)
        return result

    except ValueError as exc:
        logger.warning("Login failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    except Exception as exc:
        logger.error("Login unexpected error:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {type(exc).__name__}: {exc}",
        )


@auth_router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    summary="Refresh access token using a refresh token",
)
async def refresh_token(body: RefreshRequest) -> TokenRefreshResponse:
    logger.debug("POST /auth/refresh")
    try:
        return await auth_service.refresh_tokens(body.refresh_token)

    except ValueError as exc:
        logger.warning("Token refresh failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    except Exception as exc:
        logger.error("Token refresh unexpected error:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {type(exc).__name__}: {exc}",
        )


# ─────────────────────────────────────────────
# Protected routes (require Bearer token)
# ─────────────────────────────────────────────

@auth_router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout current user",
)
async def logout(_: dict = Depends(get_current_user)) -> MessageResponse:
    logger.debug("POST /auth/logout")
    await auth_service.sign_out()
    return MessageResponse(message="Logged out successfully.")


@auth_router.get(
    "/me",
    response_model=UserProfile,
    summary="Get the current user's profile",
)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserProfile:
    logger.debug("GET /auth/me — user_id=%s", current_user["user_id"])
    try:
        return await auth_service.get_profile_by_id(current_user["user_id"])

    except ValueError as exc:
        logger.warning("get_me not found: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    except Exception as exc:
        logger.error("get_me unexpected error:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch profile: {type(exc).__name__}: {exc}",
        )