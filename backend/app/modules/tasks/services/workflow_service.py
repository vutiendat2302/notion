from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.db.base import utc_now
from app.modules.tasks.models.checklist import ChecklistItem, OccurrenceChecklistState
from app.modules.tasks.models.task_dependency import TaskDependency
from app.modules.tasks.repositories.task_repository import TaskRepository
from app.modules.tasks.repositories.workflow_repository import WorkflowRepository
from app.modules.tasks.schemas.requests.workflow_requests import (
    ChecklistCreateRequest,
    ChecklistPatchRequest,
)
from app.modules.tasks.schemas.responses.workflow_responses import ChecklistStateResponse


class WorkflowService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.tasks = TaskRepository(session)
        self.repo = WorkflowRepository(session)

    async def _task(self, user_id: UUID, task_id: UUID) -> None:
        if await self.tasks.get_task_by_id_and_user(task_id, user_id) is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")

    async def list_checklist(self, user_id: UUID, task_id: UUID) -> list[ChecklistItem]:
        await self._task(user_id, task_id)
        return await self.repo.checklist_items(task_id)

    async def create_checklist(
        self, user_id: UUID, task_id: UUID, payload: ChecklistCreateRequest
    ) -> ChecklistItem:
        await self._task(user_id, task_id)
        item = ChecklistItem(task_id=task_id, title=payload.title, sort_order=payload.sort_order)
        self.session.add(item)
        await self.session.commit()
        return item

    async def patch_checklist(
        self, user_id: UUID, task_id: UUID, item_id: UUID, payload: ChecklistPatchRequest
    ) -> ChecklistItem:
        await self._task(user_id, task_id)
        item = await self.repo.checklist_item(task_id, item_id)
        if item is None:
            raise NotFoundError("Checklist item not found.", code="CHECKLIST_ITEM_NOT_FOUND")
        for field in ("title", "sort_order"):
            if field in payload.model_fields_set:
                value = getattr(payload, field)
                if value is None or (field == "title" and not value.strip()):
                    raise ValidationAppError(f"Field '{field}' cannot be empty.")
                setattr(item, field, value.strip() if field == "title" else value)
        if "archived" in payload.model_fields_set:
            if payload.archived is None:
                raise ValidationAppError("Field 'archived' cannot be null.")
            item.archived_at = utc_now() if payload.archived else None
        await self.session.commit()
        return item

    async def list_states(self, user_id: UUID, occurrence_id: UUID) -> list[ChecklistStateResponse]:
        occurrence = await self.tasks.get_occurrence_by_id_and_user(occurrence_id, user_id)
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")
        states = {
            state.checklist_item_id: state
            for state in await self.repo.checklist_states(occurrence_id)
        }
        return [
            ChecklistStateResponse(
                occurrence_id=occurrence_id,
                checklist_item_id=item.id,
                is_checked=states[item.id].is_checked if item.id in states else False,
                checked_at=states[item.id].checked_at if item.id in states else None,
            )
            for item in await self.repo.checklist_items(occurrence.task_id)
            if item.archived_at is None
        ]

    async def set_state(
        self, user_id: UUID, occurrence_id: UUID, item_id: UUID, checked: bool
    ) -> ChecklistStateResponse:
        occurrence = await self.tasks.get_occurrence_by_id_and_user(
            occurrence_id, user_id, for_update=True
        )
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")
        item = await self.repo.checklist_item(occurrence.task_id, item_id)
        if item is None or item.archived_at is not None:
            raise NotFoundError("Checklist item not found.", code="CHECKLIST_ITEM_NOT_FOUND")
        state = await self.repo.checklist_state(occurrence_id, item_id)
        if state is None:
            state = OccurrenceChecklistState(occurrence_id=occurrence_id, checklist_item_id=item_id)
            self.session.add(state)
        state.is_checked = checked
        state.checked_at = utc_now() if checked else None
        await self.session.commit()
        return ChecklistStateResponse(
            occurrence_id=occurrence_id,
            checklist_item_id=item_id,
            is_checked=state.is_checked,
            checked_at=state.checked_at,
        )

    async def list_dependencies(self, user_id: UUID, task_id: UUID) -> list[TaskDependency]:
        await self._task(user_id, task_id)
        return await self.repo.dependencies(user_id, task_id)

    async def add_dependency(
        self, user_id: UUID, blocked_task_id: UUID, blocking_task_id: UUID
    ) -> TaskDependency:
        if blocked_task_id == blocking_task_id:
            raise ConflictError("A task cannot block itself.", code="DEPENDENCY_CYCLE")
        # Lock endpoints in a deterministic order before checking the graph.
        for task_id in sorted((blocked_task_id, blocking_task_id)):
            if await self.tasks.get_task_by_id_and_user(task_id, user_id, for_update=True) is None:
                raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        edges = await self.repo.dependency_edges(user_id)
        if (blocking_task_id, blocked_task_id) in edges:
            raise ConflictError("Dependency already exists.", code="DEPENDENCY_EXISTS")
        # Follow edges from the blocked task; reaching the blocker would close a cycle.
        successors: dict[UUID, set[UUID]] = {}
        for source, target in edges:
            successors.setdefault(source, set()).add(target)
        pending = [blocked_task_id]
        visited: set[UUID] = set()
        while pending:
            current = pending.pop()
            if current == blocking_task_id:
                raise ConflictError(
                    "Dependency graph cannot contain a cycle.", code="DEPENDENCY_CYCLE"
                )
            if current not in visited:
                visited.add(current)
                pending.extend(successors.get(current, set()))
        dependency = TaskDependency(
            user_id=user_id,
            blocking_task_id=blocking_task_id,
            blocked_task_id=blocked_task_id,
        )
        self.session.add(dependency)
        await self.session.commit()
        return dependency

    async def remove_dependency(self, user_id: UUID, task_id: UUID, dependency_id: UUID) -> None:
        dependency = await self.repo.dependency(user_id, task_id, dependency_id)
        if dependency is None:
            raise NotFoundError("Dependency not found.", code="DEPENDENCY_NOT_FOUND")
        await self.session.delete(dependency)
        await self.session.commit()
