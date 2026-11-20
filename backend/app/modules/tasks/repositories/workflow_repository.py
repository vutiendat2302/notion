from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tasks.models.checklist import ChecklistItem, OccurrenceChecklistState
from app.modules.tasks.models.task_dependency import TaskDependency


class WorkflowRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def checklist_items(self, task_id: UUID) -> list[ChecklistItem]:
        result = await self.session.execute(
            select(ChecklistItem)
            .where(ChecklistItem.task_id == task_id)
            .order_by(ChecklistItem.sort_order, ChecklistItem.created_at, ChecklistItem.id)
        )
        return list(result.scalars())

    async def checklist_item(self, task_id: UUID, item_id: UUID) -> ChecklistItem | None:
        result = await self.session.execute(
            select(ChecklistItem).where(
                ChecklistItem.task_id == task_id, ChecklistItem.id == item_id
            )
        )
        return result.scalar_one_or_none()

    async def checklist_state(
        self, occurrence_id: UUID, item_id: UUID
    ) -> OccurrenceChecklistState | None:
        result = await self.session.execute(
            select(OccurrenceChecklistState)
            .where(
                OccurrenceChecklistState.occurrence_id == occurrence_id,
                OccurrenceChecklistState.checklist_item_id == item_id,
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def checklist_states(self, occurrence_id: UUID) -> list[OccurrenceChecklistState]:
        result = await self.session.execute(
            select(OccurrenceChecklistState).where(
                OccurrenceChecklistState.occurrence_id == occurrence_id
            )
        )
        return list(result.scalars())

    async def dependencies(self, user_id: UUID, task_id: UUID) -> list[TaskDependency]:
        result = await self.session.execute(
            select(TaskDependency)
            .where(TaskDependency.user_id == user_id, TaskDependency.blocked_task_id == task_id)
            .order_by(TaskDependency.created_at, TaskDependency.id)
        )
        return list(result.scalars())

    async def dependency(
        self, user_id: UUID, task_id: UUID, dependency_id: UUID
    ) -> TaskDependency | None:
        result = await self.session.execute(
            select(TaskDependency).where(
                TaskDependency.user_id == user_id,
                TaskDependency.blocked_task_id == task_id,
                TaskDependency.id == dependency_id,
            )
        )
        return result.scalar_one_or_none()

    async def dependency_edges(self, user_id: UUID) -> list[tuple[UUID, UUID]]:
        result = await self.session.execute(
            select(TaskDependency.blocking_task_id, TaskDependency.blocked_task_id)
            .where(TaskDependency.user_id == user_id)
            .with_for_update()
        )
        return [(row[0], row[1]) for row in result]
