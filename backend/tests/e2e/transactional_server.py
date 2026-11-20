"""Temporary HTTP server for browser E2E tests; every write rolls back on exit.

Run only inside an isolated test container. Stop the process to roll back the
outer MySQL transaction. This server is never part of the production image.
"""

import asyncio
from collections.abc import AsyncIterator

import uvicorn
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.db.session import get_db_session
from app.main import app
from tests.conftest import TransactionalProxySession


@app.get("/api/v1/__e2e__/transactional", include_in_schema=False)
async def transactional_marker() -> dict[str, bool]:
    return {"transactional": True}


async def main() -> None:
    engine = create_async_engine(get_settings().build_sqlalchemy_url(), poolclass=NullPool)
    async with engine.connect() as connection:
        outer_transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            autoflush=False,
            join_transaction_mode="create_savepoint",
        )
        proxy = TransactionalProxySession(session)
        lock = asyncio.Lock()

        async def override_session() -> AsyncIterator[TransactionalProxySession]:
            async with lock:
                yield proxy

        app.dependency_overrides[get_db_session] = override_session
        try:
            server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=8000))
            await server.serve()
        finally:
            app.dependency_overrides.clear()

            async def cleanup() -> None:
                await session.close()
                await outer_transaction.rollback()
                await engine.dispose()

            cleanup_task = asyncio.create_task(cleanup())
            try:
                await asyncio.shield(cleanup_task)
            except asyncio.CancelledError:
                await cleanup_task


if __name__ == "__main__":
    asyncio.run(main())
