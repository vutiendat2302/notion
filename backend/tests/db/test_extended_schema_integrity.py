from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.core.security import hash_password
from app.db.base import Base
from app.db.extended_models import FileLink, FileRecord, IdempotencyKey
from app.modules.tasks.models.task import Task
from app.modules.users.models.user import User
from tests.conftest import TransactionalProxySession


@pytest.mark.asyncio
async def test_full_productivity_schema_matches_metadata(
    db_proxy_session: TransactionalProxySession,
) -> None:
    names = set(
        (
            await db_proxy_session.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = DATABASE()"
                )
            )
        ).scalars()
    )
    assert names == set(Base.metadata.tables) | {"alembic_version"}
    assert len(Base.metadata.tables) == 36


@pytest.mark.asyncio
async def test_file_links_and_idempotency_are_owner_scoped(
    db_proxy_session: TransactionalProxySession,
) -> None:
    session = db_proxy_session
    owner = User(
        email="extended-owner@example.com",
        email_normalized="extended-owner@example.com",
        password_hash=hash_password("StrongPassword123!"),
        display_name="Extended Owner",
    )
    other = User(
        email="extended-other@example.com",
        email_normalized="extended-other@example.com",
        password_hash=hash_password("StrongPassword123!"),
        display_name="Extended Other",
    )
    session.add_all([owner, other])
    await session.flush()
    task = Task(user_id=owner.id, title="Owner task")
    foreign_task = Task(user_id=other.id, title="Foreign task")
    file = FileRecord(
        user_id=owner.id,
        bucket="personal-uploads",
        object_key=f"uploads/{owner.id}/one/original",
        original_filename="one.pdf",
        mime_type="application/pdf",
        size_bytes=12,
        sha256_hex="a" * 64,
    )
    session.add_all([task, foreign_task, file])
    await session.flush()
    session.add(
        FileLink(
            user_id=owner.id,
            file_id=file.id,
            task_id=task.id,
            target_key=f"TASK:{task.id}",
        )
    )
    session.add(
        IdempotencyKey(
            user_id=owner.id,
            scope="tasks:create",
            idempotency_key="same-key",
            request_hash=b"x" * 32,
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
    )
    await session.flush()

    invalid_rows = [
        FileLink(user_id=owner.id, file_id=file.id, target_key="MISSING"),
        FileLink(
            user_id=owner.id,
            file_id=file.id,
            task_id=foreign_task.id,
            target_key=f"TASK:{foreign_task.id}",
        ),
        IdempotencyKey(
            user_id=owner.id,
            scope="tasks:create",
            idempotency_key="same-key",
            request_hash=b"y" * 32,
            expires_at=datetime.now(UTC) + timedelta(days=1),
        ),
    ]
    for row in invalid_rows:
        with pytest.raises(DBAPIError):
            async with session.begin_nested():
                session.add(row)
                await session.flush()

    assert await session.scalar(select(func.count()).select_from(FileLink)) == 1
    assert await session.scalar(select(func.count()).select_from(IdempotencyKey)) == 1
