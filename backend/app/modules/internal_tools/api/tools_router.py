from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy import select

from app.api.dependencies import DBSession
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import decode_s2s_token
from app.db.base import utc_now
from app.modules.goals.models.goal import Goal
from app.modules.projects.models.project import Project
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.taxonomy.models.category import Category
from app.modules.users.repositories.user_repository import UserRepository

router = APIRouter(prefix="/internal/v1/tools", tags=["internal-tools"])


class ScopedContextResponse(BaseModel):
    user_id: str
    timezone: str
    projects: list[dict[str, str]]
    categories: list[dict[str, str]]
    goals: list[dict[str, str]]
    recent_tasks: list[dict[str, str | None]]


async def get_s2s_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> UUID:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing S2S token.", code="MISSING_S2S_TOKEN")
    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    return decode_s2s_token(token, expected_audience=settings.backend_tool_audience)


@router.get("/context-entities", response_model=ScopedContextResponse)
async def get_scoped_context_entities(
    user_id: Annotated[UUID, Depends(get_s2s_user_id)],
    session: DBSession,
) -> ScopedContextResponse:
    settings = await UserRepository(session).get_settings_by_user_id(user_id)
    tz_name = settings.timezone if settings else "Asia/Ho_Chi_Minh"

    proj_rows = (
        (
            await session.execute(
                select(Project)
                .where(Project.user_id == user_id, Project.archived_at.is_(None))
                .limit(30)
            )
        )
        .scalars()
        .all()
    )
    cat_rows = (
        (
            await session.execute(
                select(Category)
                .where(Category.user_id == user_id, Category.archived_at.is_(None))
                .limit(30)
            )
        )
        .scalars()
        .all()
    )
    goal_rows = (
        (
            await session.execute(
                select(Goal).where(Goal.user_id == user_id, Goal.archived_at.is_(None)).limit(20)
            )
        )
        .scalars()
        .all()
    )
    task_rows = (
        await session.execute(
            select(TaskOccurrence, Task)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .where(TaskOccurrence.user_id == user_id, Task.archived_at.is_(None))
            .order_by(TaskOccurrence.created_at.desc())
            .limit(25)
        )
    ).all()

    return ScopedContextResponse(
        user_id=str(user_id),
        timezone=tz_name,
        projects=[{"id": str(p.id), "title": p.title, "status": p.status} for p in proj_rows],
        categories=[{"id": str(c.id), "name": c.name} for c in cat_rows],
        goals=[{"id": str(g.id), "title": g.title} for g in goal_rows],
        recent_tasks=[
            {
                "task_id": str(task.id),
                "occurrence_id": str(occ.id),
                "title": task.title,
                "status": occ.status,
                "scheduled_date": occ.scheduled_date.isoformat()
                if occ.scheduled_date
                else utc_now().astimezone(ZoneInfo(tz_name)).date().isoformat(),
            }
            for occ, task in task_rows
        ],
    )
