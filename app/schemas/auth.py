from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from datetime import date
from typing import Optional
import re


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    date_of_birth: Optional[date] = Field(None, description="User's date of birth (optional)")
    confirm_password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "username": "nkr",
                "email": "nkr@example.com",
                "password": "Secret123!",
                "confirm_password": "Secret123!",
                "date_of_birth": "1990-05-15"
            }
        }
    }

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v

    @model_validator(mode='after')
    def validate_passwords_match(self) -> 'RegisterRequest':
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self


class ForgotPasswordRequest(BaseModel):
    """Request to send a password reset email"""
    email: EmailStr

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com"
            }
        }
    }


class ResetPasswordRequest(BaseModel):
    """Request to reset password using token from email"""
    token: str = Field(..., min_length=1, description="Password reset token from email")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")

    model_config = {
        "json_schema_extra": {
            "example": {
                "token": "abc123-def456-ghi789...",
                "new_password": "newSecret123!",
                "confirm_password": "newSecret123!"
            }
        }
    }

    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v

    @model_validator(mode='after')
    def validate_passwords_match(self) -> 'ResetPasswordRequest':
        if self.new_password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self


class LoginRequest(BaseModel):
    username: str
    password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "username": "nkr",
                "password": "secret123"
            }
        }
    }


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    username: str
    email: str
    date_of_birth: Optional[date] = None
    created_at: str


class ResetPasswordResponse(BaseModel):
    """Response after successful password reset"""
    message: str
    success: bool = True


class PasswordResetTokenResponse(BaseModel):
    """Response for token verification"""
    valid: bool
    message: str
