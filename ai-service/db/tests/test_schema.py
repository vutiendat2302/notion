import os
from datetime import UTC, datetime
from uuid import uuid7

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine

from ai_db.models import Base, ai_runs


@pytest.mark.asyncio
async def test_ai_schema_and_unique_request_id_without_persisting() -> None:
    engine = create_async_engine(os.environ["AI_METADATA_DATABASE_URL"])
    try:
        async with engine.connect() as connection:
            tx = await connection.begin()
            try:
                names = set(
                    (
                        await connection.execute(
                            text(
                                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
                            )
                        )
                    ).scalars()
                )
                assert names == set(Base.metadata.tables) | {"alembic_version"}
                assert len(Base.metadata.tables) == 5

                row = {
                    "id": uuid7().bytes,
                    "owner_user_id": uuid7().bytes,
                    "request_id": "ai-test-request-id",
                    "intent": "ANALYZE",
                    "provider": "OLLAMA",
                    "model_id": "local-test",
                    "status": "SUCCESS",
                    "created_at": datetime.now(UTC).replace(tzinfo=None),
                }
                await connection.execute(ai_runs.insert().values(**row))
                with pytest.raises(DBAPIError):
                    async with connection.begin_nested():
                        await connection.execute(
                            ai_runs.insert().values(**{**row, "id": uuid7().bytes})
                        )
                assert (
                    await connection.scalar(select(func.count()).select_from(ai_runs))
                    >= 1
                )
            finally:
                await tx.rollback()
    finally:
        await engine.dispose()
