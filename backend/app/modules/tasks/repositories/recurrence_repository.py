from datetime import date
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.tasks.models.recurrence_rule import RecurrenceRule
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.time_tracking.models.time_entry import TimeEntry


class RecurrenceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_task(self, task_id: UUID, user_id: UUID) -> Task | None:
        result = await self.session.execute(
            select(Task)
            .options(selectinload(Task.occurrences))
            .where(Task.id == task_id, Task.user_id == user_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def latest_rule(self, task_id: UUID) -> RecurrenceRule | None:
        result = await self.session.execute(
            select(RecurrenceRule)
            .where(RecurrenceRule.task_id == task_id)
            .order_by(RecurrenceRule.rule_version.desc(), RecurrenceRule.created_at.desc())
            .limit(1)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def existing_keys(self, task_id: UUID) -> set[str]:
        result = await self.session.execute(
            select(TaskOccurrence.recurrence_key)
            .where(TaskOccurrence.task_id == task_id)
            .with_for_update()
        )
        return set(result.scalars())

    async def add_rule(self, rule: RecurrenceRule) -> None:
        self.session.add(rule)
        await self.session.flush()

    async def add_occurrence(self, occurrence: TaskOccurrence) -> None:
        self.session.add(occurrence)
        await self.session.flush()

    async def unstarted_once_occurrence(self, task_id: UUID) -> TaskOccurrence | None:
        result = await self.session.execute(
            select(TaskOccurrence)
            .where(
                TaskOccurrence.task_id == task_id,
                TaskOccurrence.recurrence_key == "ONCE",
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def has_time_entries(self, occurrence_id: UUID) -> bool:
        result = await self.session.execute(
            select(exists().where(TimeEntry.occurrence_id == occurrence_id))
        )
        return bool(result.scalar_one())

    async def removable_future_occurrences(
        self, task_id: UUID, rule_id: UUID, effective_date: date
    ) -> list[TaskOccurrence]:
        result = await self.session.execute(
            select(TaskOccurrence)
            .where(
                TaskOccurrence.task_id == task_id,
                TaskOccurrence.recurrence_rule_id == rule_id,
                TaskOccurrence.scheduled_date >= effective_date,
                TaskOccurrence.status == "NOT_STARTED",
                TaskOccurrence.is_override.is_(False),
                ~exists().where(TimeEntry.occurrence_id == TaskOccurrence.id),
            )
            .with_for_update()
        )
        return list(result.scalars())

    async def delete_occurrence(self, occurrence: TaskOccurrence) -> None:
        await self.session.delete(occurrence)
        await self.session.flush()
