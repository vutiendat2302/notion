import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError

from app.core.security import hash_password
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_dependency import TaskDependency
from app.modules.taxonomy.models.tag import Tag
from app.modules.taxonomy.models.task_tag import TaskTag
from app.modules.users.models.user import User
from tests.conftest import TransactionalProxySession


@pytest.mark.asyncio
async def test_m8_owner_scope_and_constraints(db_proxy_session: TransactionalProxySession) -> None:
    session = db_proxy_session
    owner = User(
        email="m8-owner@example.com",
        email_normalized="m8-owner@example.com",
        password_hash=hash_password("StrongPassword123!"),
        display_name="M8 Owner",
    )
    other = User(
        email="m8-other@example.com",
        email_normalized="m8-other@example.com",
        password_hash=hash_password("StrongPassword123!"),
        display_name="M8 Other",
    )
    session.add_all([owner, other])
    await session.flush()

    first = Task(user_id=owner.id, title="First task")
    second = Task(user_id=owner.id, title="Second task")
    foreign = Task(user_id=other.id, title="Foreign task")
    tag = Tag(user_id=owner.id, name="Study", name_normalized="study")
    foreign_tag = Tag(user_id=other.id, name="Study", name_normalized="study")
    session.add_all([first, second, foreign, tag, foreign_tag])
    await session.flush()

    session.add(TaskTag(user_id=owner.id, task_id=first.id, tag_id=tag.id))
    session.add(
        TaskDependency(user_id=owner.id, blocking_task_id=first.id, blocked_task_id=second.id)
    )
    await session.flush()
    assert await session.scalar(select(func.count()).select_from(TaskTag)) == 1
    assert await session.scalar(select(func.count()).select_from(TaskDependency)) == 1

    invalid_rows = [
        Tag(user_id=owner.id, name="STUDY", name_normalized="study"),
        TaskTag(user_id=owner.id, task_id=first.id, tag_id=foreign_tag.id),
        TaskDependency(user_id=owner.id, blocking_task_id=first.id, blocked_task_id=foreign.id),
        TaskDependency(user_id=owner.id, blocking_task_id=first.id, blocked_task_id=first.id),
        TaskDependency(user_id=owner.id, blocking_task_id=first.id, blocked_task_id=second.id),
    ]
    for row in invalid_rows:
        with pytest.raises(DBAPIError):
            async with session.begin_nested():
                session.add(row)
                await session.flush()

    assert await session.scalar(select(func.count()).select_from(TaskTag)) == 1
    assert await session.scalar(select(func.count()).select_from(TaskDependency)) == 1
