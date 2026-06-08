from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db_session
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, ResetPasswordResponse,
    PasswordResetTokenResponse
)
from app.services.auth_service import AuthService
from app.core.security import get_current_user
from app.services.birthday_service import send_birthday_emails_task
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Register a new user
    """
    try:
        auth_service = AuthService(db)
        user = await auth_service.register_user(
            username=request.username,
            email=request.email,
            password=request.password,
            date_of_birth=request.date_of_birth
        )
        # Return user data (without token)
        return UserResponse(
            username=user.username,
            email=user.email,
            date_of_birth=user.date_of_birth,
            created_at=user.created_at.isoformat() if user.created_at else datetime.utcnow().isoformat()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Authenticate user and return access token
    """
    try:
        auth_service = AuthService(db)
        user = await auth_service.authenticate_user(
            username=request.username,
            password=request.password
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token = auth_service.create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/me")
async def get_current_user_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current authenticated user info
    """
    return current_user


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token removal)
    """
    return {"message": "Logged out successfully"}


@router.post("/request-reset")
async def request_password_reset(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Request a password reset link to be sent to the user's email.
    Returns success regardless of whether email exists (security).
    """
    auth_service = AuthService(db)
    result = await auth_service.request_password_reset(email=request.email)
    return result


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Reset user password using a valid reset token from email.
    """
    auth_service = AuthService(db)
    try:
        result = await auth_service.reset_password_with_token(
            token=request.token,
            new_password=request.new_password
        )
        return ResetPasswordResponse(message=result["message"])
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset failed: {str(e)}"
        )


@router.get("/verify-reset-token/{token}", response_model=PasswordResetTokenResponse)
async def verify_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Verify that a password reset token is valid and not expired.
    Used by frontend to check token before showing reset form.
    """
    auth_service = AuthService(db)
    is_valid, user, error = await auth_service.verify_reset_token(token)

    if is_valid and user:
        return PasswordResetTokenResponse(
            valid=True,
            message="Token is valid"
        )
    else:
        return PasswordResetTokenResponse(
            valid=False,
            message=error or "Invalid token"
        )


@router.post("/admin/send-birthday-emails")
async def trigger_birthday_emails(
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger birthday email sending.
    Admin-only endpoint for testing and manual runs.
    """
    try:
        result = await send_birthday_emails_task(db)
        return {
            "success": True,
            "message": "Birthday email task completed",
            "result": result
        }
    except Exception as e:
        logger.error(f"Failed to trigger birthday emails: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send birthday emails: {str(e)}"
        )
