# import datetime
# from jose import JWTError, jwt
# from passlib.context import CryptContext
# from fastapi import Depends, HTTPException, status
# from fastapi.security import OAuth2PasswordBearer
# from app.core.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
# from fastapi.security import OAuth2PasswordBearer, HTTPBearer

# oauth2_scheme  = OAuth2PasswordBearer(tokenUrl="/auth/login")
# http_bearer    = HTTPBearer()   # this adds the simple Bearer field in Swagger

# pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# def hash_password(plain: str) -> str:

#     #print(plain)
#     #print(plain)
#     #print(plain)
#     #print(plain)
#     #print("===========")
#     return pwd_context.hash(plain)


# def verify_password(plain: str, hashed: str) -> bool:
#     return pwd_context.verify(plain, hashed)


# def create_access_token(data: dict) -> str:
#     payload = data.copy()
#     expire  = datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_EXPIRE_MINUTES)
#     payload.update({"exp": expire})
#     return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# def decode_access_token(token: str) -> dict:
#     try:
#         return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
#     except JWTError:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid or expired token.",
#             headers={"WWW-Authenticate": "Bearer"},
#         )


# def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
#     return decode_access_token(token)

import datetime
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.models.session import User
from app.db import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

pwd_context  = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer  = HTTPBearer()


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire  = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> dict:
    return decode_access_token(credentials.credentials)


async def get_current_user_id(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> str:
    """
    Dependency to get the user's UUID from the JWT's 'sub' (username).
    """
    username = current_user.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    stmt = select(User.id).where(User.username == username)
    result = await db.execute(stmt)
    user_id = result.scalar_one_or_none()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user_id