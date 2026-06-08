import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.db import Base
# Import all models to register them with Base.metadata
from app.models import session  # noqa
from app.models import auth_models  # noqa


async def init_db():
    """Initialize the database tables"""
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    print("Database tables created successfully!")


if __name__ == "__main__":
    asyncio.run(init_db())