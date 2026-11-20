from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.users.models.user import User


class TaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_owner(self, user_id: UUID) -> None:
        await self.session.execute(select(User.id).where(User.id == user_id).with_for_update())

    async def add_task(self, task: Task) -> Task:
        self.session.add(task)
        await self.session.flush()
        return task

    async def add_occurrence(self, occurrence: TaskOccurrence) -> TaskOccurrence:
        self.session.add(occurrence)
        await self.session.flush()
        return occurrence

    async def get_task_by_id_and_user(
        self, task_id: UUID, user_id: UUID, *, for_update: bool = False
    ) -> Task | None:
        stmt = (
            select(Task)
            .options(selectinload(Task.occurrences))
            .where(Task.id == task_id, Task.user_id == user_id)
            .execution_options(populate_existing=True)
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_occurrence_by_id_and_user(
        self, occurrence_id: UUID, user_id: UUID, *, for_update: bool = False
    ) -> TaskOccurrence | None:
        stmt = (
            select(TaskOccurrence)
            .options(selectinload(TaskOccurrence.task))
            .where(TaskOccurrence.id == occurrence_id, TaskOccurrence.user_id == user_id)
            .execution_options(populate_existing=True)
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_task_occurrences(self, task_id: UUID, user_id: UUID) -> list[TaskOccurrence]:
        result = await self.session.execute(
            select(TaskOccurrence)
            .where(TaskOccurrence.task_id == task_id, TaskOccurrence.user_id == user_id)
            .order_by(TaskOccurrence.scheduled_date, TaskOccurrence.created_at, TaskOccurrence.id)
        )
        return list(result.scalars())

    async def list_subtasks(self, parent_id: UUID, user_id: UUID) -> list[Task]:
        result = await self.session.execute(
            select(Task)
            .options(selectinload(Task.occurrences))
            .where(Task.user_id == user_id, Task.parent_task_id == parent_id)
            .order_by(Task.created_at, Task.id)
        )
        return list(result.scalars())

    async def list_tasks(
        self,
        user_id: UUID,
        *,
        project_id: UUID | None = None,
        category_id: UUID | None = None,
        search: str | None = None,
        include_archived: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Task], int]:
        base = select(Task).where(Task.user_id == user_id)
        if not include_archived:
            base = base.where(Task.archived_at.is_(None))
        if project_id is not None:
            base = base.where(Task.project_id == project_id)
        if category_id is not None:
            base = base.where(Task.category_id == category_id)
        if search:
            like_pattern = f"%{search.strip()}%"
            base = base.where(Task.title.ilike(like_pattern))

        count_stmt = select(func.count()).select_from(base.subquery())
        total = int((await self.session.execute(count_stmt)).scalar_one())

        items_stmt = (
            base.options(selectinload(Task.occurrences))
            .order_by(Task.created_at.desc(), Task.id.desc())
            .limit(limit)
            .offset(offset)
        )
        items = list((await self.session.execute(items_stmt)).scalars().all())
        return items, total

    async def list_occurrences(
        self,
        user_id: UUID,
        *,
        scope: str = "all",
        local_today: date,
        project_id: UUID | None = None,
        category_id: UUID | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[TaskOccurrence], int]:
        stmt = (
            select(TaskOccurrence)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .options(selectinload(TaskOccurrence.task))
            .where(
                TaskOccurrence.user_id == user_id,
                Task.archived_at.is_(None),
            )
        )
        if project_id is not None:
            stmt = stmt.where(Task.project_id == project_id)
        if category_id is not None:
            stmt = stmt.where(Task.category_id == category_id)
        if search:
            stmt = stmt.where(Task.title.ilike(f"%{search.strip()}%"))

        if scope == "inbox":
            stmt = stmt.where(
                TaskOccurrence.scheduled_date.is_(None),
                TaskOccurrence.status.in_(("NOT_STARTED", "IN_PROGRESS")),
            )
        elif scope == "today":
            stmt = stmt.where(
                TaskOccurrence.scheduled_date <= local_today,
                TaskOccurrence.status.in_(("NOT_STARTED", "IN_PROGRESS")),
            )
        elif scope == "upcoming":
            stmt = stmt.where(
                TaskOccurrence.scheduled_date > local_today,
                TaskOccurrence.status.in_(("NOT_STARTED", "IN_PROGRESS")),
            )
        elif scope == "completed":
            stmt = stmt.where(TaskOccurrence.status == "DONE")

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int((await self.session.execute(count_stmt)).scalar_one())

        ordered = (
            stmt.order_by(
                TaskOccurrence.scheduled_date.asc(),
                TaskOccurrence.sort_order.asc(),
                TaskOccurrence.created_at.desc(),
                TaskOccurrence.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        items = list((await self.session.execute(ordered)).scalars().all())
        return items, total
