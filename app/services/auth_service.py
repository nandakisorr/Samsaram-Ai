from datetime import datetime, timedelta, date
from typing import Optional
import bcrypt
import uuid
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import JWTError, jwt
from app.core.config import settings
from app.models.session import User
from app.models.auth_models import PasswordResetToken
from app.core.exceptions import AuthenticationException
from app.services.email_service import email_service
import logging

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(self, username: str, email: str, password: str, date_of_birth: Optional[date] = None):
        """
        Register a new user
        """
        from datetime import date
        try:
            # Check if user already exists
            existing_user = await self.get_user_by_username(username)
            if existing_user:
                raise ValueError("Username already registered")
            
            existing_email = await self.get_user_by_email(email)
            if existing_email:
                raise ValueError("Email already registered")
            
            # Hash password
            hashed_password = self._hash_password(password)
            
            # Create new user
            user = User(
                id=str(uuid.uuid4()),
                username=username,
                email=email,
                hashed_password=hashed_password,
                date_of_birth=date_of_birth,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            
            # Send welcome email asynchronously (don't block registration)
            try:
                subject, html_body, text_body = email_service.build_welcome_email(
                    username=user.username,
                    email=user.email
                )
                await email_service.send_email(
                    to_email=user.email,
                    subject=subject,
                    html_body=html_body,
                    text_body=text_body
                )
                logger.info(f"Welcome email sent to {user.email}")
            except Exception as e:
                logger.error(f"Failed to send welcome email to {user.email}: {e}")
                # Don't raise - registration should succeed even if email fails
            
            return user
        except Exception as e:
            await self.db.rollback()
            raise e

    async def authenticate_user(self, username: str, password: str):
        """
        Authenticate user credentials
        """
        try:
            user = await self.get_user_by_username(username)
            if not user or not self._verify_password(password, user.hashed_password):
                return None
            return user
        except Exception as e:
            raise AuthenticationException(f"Authentication failed: {str(e)}")

    async def get_user_by_username(self, username: str):
        """
        Get user by username
        """
        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str):
        """
        Get user by email
        """
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: str):
        """
        Get user by ID
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """
        Create JWT access token
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    def decode_access_token(self, token: str):
        """
        Decode JWT access token
        """
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                raise AuthenticationException("Could not validate credentials")
            return username
        except JWTError:
            raise AuthenticationException("Could not validate credentials")

    def _hash_password(self, password: str) -> str:
        """
        Hash password using bcrypt
        """
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify password against hash
        """
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

    async def create_password_reset_token(self, user: User) -> PasswordResetToken:
        """
        Create a password reset token for the user
        """
        # Generate a secure random token
        token = secrets.token_urlsafe(32)

        # Calculate expiration
        expires_at = datetime.utcnow() + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)

        # Create token record
        reset_token = PasswordResetToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token=token,
            expires_at=expires_at,
            used="0"
        )

        self.db.add(reset_token)
        await self.db.commit()
        await self.db.refresh(reset_token)

        return reset_token

    async def get_reset_token_by_token(self, token: str) -> Optional[PasswordResetToken]:
        """
        Get a password reset token by its token string
        """
        stmt = select(PasswordResetToken).where(PasswordResetToken.token == token)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def verify_reset_token(self, token: str) -> tuple[bool, Optional[User], Optional[str]]:
        """
        Verify a password reset token is valid and not expired/used.
        Returns (is_valid, user, error_message)
        """
        reset_token = await self.get_reset_token_by_token(token)

        if not reset_token:
            return False, None, "Invalid reset token"

        if reset_token.used == "1":
            return False, None, "Token has already been used"

        if reset_token.expires_at < datetime.utcnow():
            return False, None, "Token has expired"

        user = await self.get_user_by_id(reset_token.user_id)
        if not user:
            return False, None, "User not found"

        return True, user, None

    async def reset_password_with_token(self, token: str, new_password: str) -> dict:
        """
        Reset user password using a valid reset token
        """
        is_valid, user, error = await self.verify_reset_token(token)

        if not is_valid or not user:
            raise ValueError(error or "Invalid reset token")

        # Update user password
        user.hashed_password = self._hash_password(new_password)
        user.updated_at = datetime.utcnow()

        # Mark token as used
        reset_token = await self.get_reset_token_by_token(token)
        reset_token.used = "1"

        await self.db.commit()
        await self.db.refresh(user)

        logger.info(f"Password reset successful for user: {user.username}")

        return {"success": True, "message": "Password reset successfully"}

    async def request_password_reset(self, email: str) -> dict:
        """
        Initiate password reset request for a user by email.
        Sends reset email if user exists, returns generic message for security.
        """
        user = await self.get_user_by_email(email)

        if not user:
            # Return generic success message to prevent email enumeration
            logger.info(f"Password reset requested for non-existent email: {email}")
            return {"success": True, "message": "If an account exists with this email, a reset link has been sent."}

        # Create reset token
        reset_token = await self.create_password_reset_token(user)

        # Build reset URL
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token.token}"

        # Send email
        subject, html_body, text_body = email_service.build_password_reset_email(
            reset_url=reset_url,
            username=user.username,
            expires_hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
        )

        email_sent = await email_service.send_email(
            to_email=user.email,
            subject=subject,
            html_body=html_body,
            text_body=text_body
        )

        if email_sent:
            logger.info(f"Password reset email sent to {user.email}")
            return {"success": True, "message": "If an account exists with this email, a reset link has been sent."}
        else:
            logger.error(f"Failed to send password reset email to {user.email}")
            return {"success": False, "message": "Failed to send reset email. Please try again later."}
