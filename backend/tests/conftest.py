from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.db.session import get_db_session
from app.main import app


class TransactionalProxySession:
    """Proxy wrapping AsyncSession inside an outer rolled-back transaction.

    Intercepts Service `commit()` calls and turns them into `flush()` so MySQL
    constraints (UNIQUE, FK, CHECK, GENERATED columns) are verified in real
    InnoDB without persisting any test row into `productivity_db`.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def commit(self) -> None:
        await self._session.flush()

    async def rollback(self) -> None:
        if self._session.in_nested_transaction():
            await self._session.rollback()

    def __getattr__(self, name: str) -> Any:
        return getattr(self._session, name)


@pytest.fixture
async def db_proxy_session() -> AsyncIterator[TransactionalProxySession]:
    settings = get_settings()
    test_engine = create_async_engine(
        settings.build_sqlalchemy_url(),
        poolclass=NullPool,
    )
    async with test_engine.connect() as conn:
        outer_tx = await conn.begin()
        real_session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            autoflush=False,
            join_transaction_mode="create_savepoint",
        )
        proxy = TransactionalProxySession(real_session)
        try:
            yield proxy
        finally:
            await real_session.close()
            await outer_tx.rollback()
            await test_engine.dispose()


@pytest.fixture
async def client(db_proxy_session: TransactionalProxySession) -> AsyncIterator[AsyncClient]:
    async def _override_get_db_session() -> AsyncIterator[TransactionalProxySession]:
        yield db_proxy_session

    app.dependency_overrides[get_db_session] = _override_get_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client
    app.dependency_overrides.clear()
