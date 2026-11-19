from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.db.base import utc_now
from app.modules.projects.repositories.project_repository import ProjectRepository
from app.modules.tasks.domain.status_policy import OccurrenceStatus, ensure_valid_transition
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.tasks.repositories.task_repository import TaskRepository
from app.modules.tasks.schemas.requests.task_requests import (
    OccurrencePatchRequest,
    TaskCreateRequest,
    TaskPatchRequest,
)
from app.modules.taxonomy.repositories.category_repository import CategoryRepository
from app.modules.users.repositories.user_repository import UserRepository


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TaskRepository(session)
        self.project_repo = ProjectRepository(session)
        self.category_repo = CategoryRepository(session)
        self.user_repo = UserRepository(session)

    async def create_task(self, user_id: UUID, payload: TaskCreateRequest) -> Task:
        if payload.project_id is not None:
            project = await self.project_repo.get_by_id_and_user(payload.project_id, user_id)
            if project is None:
                raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")

        if payload.category_id is not None:
            category = await self.category_repo.get_by_id_and_user(payload.category_id, user_id)
            if category is None:
                raise NotFoundError("Category not found.", code="CATEGORY_NOT_FOUND")

        if payload.parent_task_id is not None:
            parent = await self.repo.get_task_by_id_and_user(payload.parent_task_id, user_id)
            if parent is None:
                raise NotFoundError("Parent task not found.", code="PARENT_TASK_NOT_FOUND")

        task = Task(
            user_id=user_id,
            project_id=payload.project_id,
            category_id=payload.category_id,
            parent_task_id=payload.parent_task_id,
            title=payload.title,
            description=payload.description,
            priority=payload.priority,
            estimated_minutes=payload.estimated_minutes,
            due_at=payload.due_at,
            is_recurring=False,
        )
        await self.repo.add_task(task)

        # ADR-CORE-02: Every one-off task automatically receives a default TaskOccurrence
        default_occurrence = TaskOccurrence(
            user_id=user_id,
            task_id=task.id,
            recurrence_key="ONCE",
            scheduled_date=payload.scheduled_date,
            start_at=payload.start_at,
            end_at=payload.end_at,
            due_at=payload.due_at,
            estimated_minutes=payload.estimated_minutes,
            status=OccurrenceStatus.NOT_STARTED.value,
        )
        await self.repo.add_occurrence(default_occurrence)

        await self.session.commit()
        loaded = await self.repo.get_task_by_id_and_user(task.id, user_id)
        assert loaded is not None
        return loaded

    async def get_task(self, user_id: UUID, task_id: UUID) -> Task:
        task = await self.repo.get_task_by_id_and_user(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        return task

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
        return await self.repo.list_tasks(
            user_id,
            project_id=project_id,
            category_id=category_id,
            search=search,
            include_archived=include_archived,
            limit=limit,
            offset=offset,
        )

    async def patch_task(self, user_id: UUID, task_id: UUID, payload: TaskPatchRequest) -> Task:
        task = await self.repo.get_task_by_id_and_user(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")

        if payload.expected_version is not None and payload.expected_version != task.version:
            raise ConflictError(
                "Task was modified concurrently.",
                code="TASK_CONFLICT",
                details={
                    "expected_version": payload.expected_version,
                    "actual_version": task.version,
                },
            )

        fields_set = payload.model_fields_set
        if "project_id" in fields_set and payload.project_id is not None:
            if await self.project_repo.get_by_id_and_user(payload.project_id, user_id) is None:
                raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")

        if "category_id" in fields_set and payload.category_id is not None:
            if await self.category_repo.get_by_id_and_user(payload.category_id, user_id) is None:
                raise NotFoundError("Category not found.", code="CATEGORY_NOT_FOUND")

        for required_field in ("title", "priority"):
            if required_field in fields_set:
                value = getattr(payload, required_field)
                if value is None:
                    raise ValidationAppError(f"Field '{required_field}' cannot be null.")
                setattr(task, required_field, value)

        nullable_fields = (
            "description",
            "project_id",
            "category_id",
            "estimated_minutes",
            "due_at",
        )
        for nullable_field in nullable_fields:
            if nullable_field in fields_set:
                setattr(task, nullable_field, getattr(payload, nullable_field))

        if "archived" in fields_set:
            if payload.archived is None:
                raise ValidationAppError("Field 'archived' cannot be null.")
            task.archived_at = utc_now() if payload.archived else None

        task.version += 1
        await self.session.commit()
        loaded = await self.repo.get_task_by_id_and_user(task.id, user_id)
        assert loaded is not None
        return loaded

    async def list_occurrences(
        self,
        user_id: UUID,
        *,
        scope: str = "all",
        project_id: UUID | None = None,
        category_id: UUID | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[TaskOccurrence], int]:
        user_settings = await self.user_repo.get_settings_by_user_id(user_id)
        tz_name = user_settings.timezone if user_settings else get_settings().default_timezone
        local_today = datetime.now(ZoneInfo(tz_name)).date()
        return await self.repo.list_occurrences(
            user_id,
            scope=scope,
            local_today=local_today,
            project_id=project_id,
            category_id=category_id,
            search=search,
            limit=limit,
            offset=offset,
        )

    async def patch_occurrence(
        self, user_id: UUID, occurrence_id: UUID, payload: OccurrencePatchRequest
    ) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(occurrence_id, user_id)
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")

        if payload.expected_version is not None and payload.expected_version != occurrence.version:
            raise ConflictError(
                "Occurrence was modified concurrently.",
                code="OCCURRENCE_CONFLICT",
                details={
                    "expected_version": payload.expected_version,
                    "actual_version": occurrence.version,
                },
            )

        fields_set = payload.model_fields_set
        occ_nullable = ("scheduled_date", "start_at", "end_at", "due_at", "estimated_minutes")
        for nullable_field in occ_nullable:
            if nullable_field in fields_set:
                setattr(occurrence, nullable_field, getattr(payload, nullable_field))

        if "sort_order" in fields_set:
            if payload.sort_order is None:
                raise ValidationAppError("Field 'sort_order' cannot be null.")
            occurrence.sort_order = payload.sort_order

        if occurrence.start_at and occurrence.end_at and occurrence.end_at <= occurrence.start_at:
            raise ValidationAppError("end_at must be strictly greater than start_at.")

        if occurrence.task.is_recurring:
            occurrence.is_override = True

        occurrence.version += 1
        await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded

    async def complete_occurrence(self, user_id: UUID, occurrence_id: UUID) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(occurrence_id, user_id)
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")

        ensure_valid_transition(occurrence.status, OccurrenceStatus.DONE)
        if occurrence.status != OccurrenceStatus.DONE.value:
            occurrence.status = OccurrenceStatus.DONE.value
            occurrence.completed_at = utc_now()
            occurrence.version += 1
            await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded

    async def reopen_occurrence(self, user_id: UUID, occurrence_id: UUID) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(occurrence_id, user_id)
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")

        ensure_valid_transition(occurrence.status, OccurrenceStatus.NOT_STARTED)
        if occurrence.status != OccurrenceStatus.NOT_STARTED.value:
            occurrence.status = OccurrenceStatus.NOT_STARTED.value
            occurrence.completed_at = None
            occurrence.version += 1
            await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded
