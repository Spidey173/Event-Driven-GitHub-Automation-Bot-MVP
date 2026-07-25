import asyncio
import sys
from pathlib import Path

# Add project root directory to path to resolve backend imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from typing import AsyncGenerator
import pytest
import httpx
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.app.main import app
from backend.app.api.deps import get_db
from backend.app.core.config import settings

@pytest.fixture(scope="session")
def event_loop():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    # Create a fresh engine per test to avoid cross-loop issues
    test_engine = create_async_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True
    )
    connection = await test_engine.connect()
    transaction = await connection.begin()
    
    session_maker = async_sessionmaker(
        bind=connection,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
    session = session_maker()
    
    yield session
    
    await session.close()
    await transaction.rollback()
    await connection.close()
    await test_engine.dispose()

@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    
    # Use ASGITransport for HTTPX 0.20+ compatibility
    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()
