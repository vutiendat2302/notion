from datetime import date, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence


class CalendarRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_events(
        self, user_id: UUID, start: date, end: date, start_utc: datetime, end_utc: datetime
    ) -> list[TaskOccurrence]:
        stmt = (
            select(TaskOccurrence)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .options(selectinload(TaskOccurrence.task))
            .where(
                TaskOccurrence.user_id == user_id,
                Task.archived_at.is_(None),
                TaskOccurrence.status != "CANCELLED",
                or_(
                    (TaskOccurrence.scheduled_date >= start)
                    & (TaskOccurrence.scheduled_date < end),
                    (TaskOccurrence.start_at >= start_utc) & (TaskOccurrence.start_at < end_utc),
                    (TaskOccurrence.start_at < end_utc) & (TaskOccurrence.end_at > start_utc),
                    (TaskOccurrence.due_at >= start_utc) & (TaskOccurrence.due_at < end_utc),
                ),
            )
            .order_by(TaskOccurrence.scheduled_date, TaskOccurrence.start_at, TaskOccurrence.id)
        )
        return list((await self.session.execute(stmt)).scalars())

    async def list_conflicts(
        self, user_id: UUID, start_at: datetime, end_at: datetime, exclude_id: UUID | None
    ) -> list[TaskOccurrence]:
        stmt = (
            select(TaskOccurrence)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .options(selectinload(TaskOccurrence.task))
            .where(
                TaskOccurrence.user_id == user_id,
                Task.archived_at.is_(None),
                TaskOccurrence.status.in_(("NOT_STARTED", "IN_PROGRESS")),
                TaskOccurrence.start_at < end_at,
                TaskOccurrence.end_at > start_at,
            )
            .order_by(TaskOccurrence.start_at, TaskOccurrence.id)
        )
        if exclude_id is not None:
            stmt = stmt.where(TaskOccurrence.id != exclude_id)
        return list((await self.session.execute(stmt)).scalars())
