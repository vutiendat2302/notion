from datetime import date, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.goals.models.goal import Goal
from app.modules.planning.models.planning_period import PlanItem, PlanningPeriod
from app.modules.projects.models.project import Project
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.users.models.user import User


class PlanningRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_owner(self, user_id: UUID) -> None:
        await self.session.execute(select(User.id).where(User.id == user_id).with_for_update())

    async def get_period(
        self, user_id: UUID, period_type: str, period_key: str, *, for_update: bool = False
    ) -> PlanningPeriod | None:
        stmt = select(PlanningPeriod).where(
            PlanningPeriod.user_id == user_id,
            PlanningPeriod.period_type == period_type,
            PlanningPeriod.period_key == period_key,
        )
        if for_update:
            stmt = stmt.with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_period_by_id(self, user_id: UUID, period_id: UUID) -> PlanningPeriod | None:
        return (
            await self.session.execute(
                select(PlanningPeriod).where(
                    PlanningPeriod.id == period_id, PlanningPeriod.user_id == user_id
                )
            )
        ).scalar_one_or_none()

    async def list_items(self, period_id: UUID) -> list[PlanItem]:
        return list(
            (
                await self.session.execute(
                    select(PlanItem)
                    .where(PlanItem.period_id == period_id)
                    .order_by(PlanItem.priority_rank, PlanItem.created_at, PlanItem.id)
                )
            ).scalars()
        )

    async def get_item(self, period_id: UUID, item_id: UUID) -> PlanItem | None:
        return (
            await self.session.execute(
                select(PlanItem).where(PlanItem.period_id == period_id, PlanItem.id == item_id)
            )
        ).scalar_one_or_none()

    async def get_item_by_target(self, period_id: UUID, target_key: str) -> PlanItem | None:
        return (
            await self.session.execute(
                select(PlanItem).where(
                    PlanItem.period_id == period_id, PlanItem.target_key == target_key
                )
            )
        ).scalar_one_or_none()

    async def target_owned(self, user_id: UUID, target_type: str, target_id: UUID) -> bool:
        if target_type == "TASK":
            stmt = select(Task.id).where(
                Task.id == target_id, Task.user_id == user_id, Task.archived_at.is_(None)
            )
        elif target_type == "OCCURRENCE":
            stmt = (
                select(TaskOccurrence.id)
                .join(Task, TaskOccurrence.task_id == Task.id)
                .where(
                    TaskOccurrence.id == target_id,
                    TaskOccurrence.user_id == user_id,
                    Task.archived_at.is_(None),
                )
            )
        elif target_type == "PROJECT":
            stmt = select(Project.id).where(
                Project.id == target_id, Project.user_id == user_id, Project.archived_at.is_(None)
            )
        else:
            stmt = select(Goal.id).where(
                Goal.id == target_id, Goal.user_id == user_id, Goal.archived_at.is_(None)
            )
        return (await self.session.execute(stmt)).scalar_one_or_none() is not None

    async def list_occurrences_for_period(
        self, user_id: UUID, start: date, end: date, start_utc: datetime, end_utc: datetime
    ) -> list[TaskOccurrence]:
        stmt = (
            select(TaskOccurrence)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .options(selectinload(TaskOccurrence.task))
            .where(
                TaskOccurrence.user_id == user_id,
                Task.archived_at.is_(None),
                or_(
                    (TaskOccurrence.scheduled_date >= start)
                    & (TaskOccurrence.scheduled_date < end),
                    (TaskOccurrence.start_at >= start_utc) & (TaskOccurrence.start_at < end_utc),
                    (TaskOccurrence.due_at >= start_utc) & (TaskOccurrence.due_at < end_utc),
                ),
            )
            .order_by(TaskOccurrence.scheduled_date, TaskOccurrence.created_at, TaskOccurrence.id)
        )
        return list((await self.session.execute(stmt)).scalars())

    async def list_overdue(
        self, user_id: UUID, start: date, start_utc: datetime
    ) -> list[TaskOccurrence]:
        stmt = (
            select(TaskOccurrence)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .options(selectinload(TaskOccurrence.task))
            .where(
                TaskOccurrence.user_id == user_id,
                Task.archived_at.is_(None),
                TaskOccurrence.status.in_(("NOT_STARTED", "IN_PROGRESS")),
                or_(
                    TaskOccurrence.scheduled_date < start,
                    TaskOccurrence.due_at < start_utc,
                ),
            )
            .order_by(TaskOccurrence.scheduled_date, TaskOccurrence.due_at, TaskOccurrence.id)
        )
        return list((await self.session.execute(stmt)).scalars())

    async def get_occurrence_for_update(
        self, user_id: UUID, occurrence_id: UUID
    ) -> TaskOccurrence | None:
        return (
            await self.session.execute(
                select(TaskOccurrence)
                .join(Task, TaskOccurrence.task_id == Task.id)
                .options(selectinload(TaskOccurrence.task))
                .where(
                    TaskOccurrence.id == occurrence_id,
                    TaskOccurrence.user_id == user_id,
                    Task.archived_at.is_(None),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
