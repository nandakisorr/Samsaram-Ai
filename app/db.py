import os
from typing import AsyncGenerator
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    metadata = MetaData()


# Create async engine with connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_recycle=settings.DB_POOL_RECYCLE,
    connect_args={
        "server_settings": {
            "application_name": "chatbot_app",
        }
    } if settings.DATABASE_URL.startswith("postgresql") else {}
)


# Create async session factory
AsyncSessionFactory = async_sessionmaker(
    engine, 
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with AsyncSessionFactory() as session:
        yield session


# Application lifespan context manager for engine disposal
async def close_db():
    await engine.dispose()