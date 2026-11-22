from datetime import UTC, date, datetime, time, timedelta
from typing import cast
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
    TaskPriority,
)
from app.modules.tasks.schemas.responses.workflow_responses import TaskProgressResponse
from app.modules.tasks.services.recurrence_service import RecurrenceService
from app.modules.taxonomy.repositories.category_repository import CategoryRepository
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.audit import record_event


class TaskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TaskRepository(session)
        self.project_repo = ProjectRepository(session)
        self.category_repo = CategoryRepository(session)
        self.user_repo = UserRepository(session)

    async def create_task(self, user_id: UUID, payload: TaskCreateRequest) -> Task:
        project_id = payload.project_id
        if payload.parent_task_id is not None:
            parent = await self.repo.get_task_by_id_and_user(payload.parent_task_id, user_id)
            if parent is None:
                raise NotFoundError("Parent task not found.", code="PARENT_TASK_NOT_FOUND")
            if "project_id" not in payload.model_fields_set:
                project_id = parent.project_id

        if project_id is not None:
            project = await self.project_repo.get_by_id_and_user(project_id, user_id)
            if project is None:
                raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")

        if payload.category_id is not None:
            category = await self.category_repo.get_by_id_and_user(payload.category_id, user_id)
            if category is None:
                raise NotFoundError("Category not found.", code="CATEGORY_NOT_FOUND")

        task = Task(
            user_id=user_id,
            project_id=project_id,
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

        if payload.recurrence is not None:
            await RecurrenceService(self.session).add_rule_for_new_task(task, payload.recurrence)
        else:
            # ADR-CORE-02: one-off tasks always receive one default occurrence.
            initial_status = payload.status
            default_occurrence = TaskOccurrence(
                user_id=user_id,
                task_id=task.id,
                recurrence_key="ONCE",
                scheduled_date=payload.scheduled_date,
                start_at=payload.start_at,
                end_at=payload.end_at,
                due_at=payload.due_at,
                estimated_minutes=payload.estimated_minutes,
                status=initial_status.value,
                completed_at=utc_now() if initial_status == OccurrenceStatus.DONE else None,
            )
            await self.repo.add_occurrence(default_occurrence)

        record_event(self.session, user_id, "TASK", task.id, "TASK_CREATED")

        await self.session.commit()
        loaded = await self.repo.get_task_by_id_and_user(task.id, user_id)
        assert loaded is not None
        return loaded

    async def get_task(self, user_id: UUID, task_id: UUID) -> Task:
        task = await self.repo.get_task_by_id_and_user(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        return task

    async def list_task_occurrences(self, user_id: UUID, task_id: UUID) -> list[TaskOccurrence]:
        await self.get_task(user_id, task_id)
        return await self.repo.list_task_occurrences(task_id, user_id)

    async def get_occurrence(self, user_id: UUID, occurrence_id: UUID) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(occurrence_id, user_id)
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")
        return occurrence

    async def list_subtasks(self, user_id: UUID, task_id: UUID) -> list[Task]:
        await self.get_task(user_id, task_id)
        return await self.repo.list_subtasks(task_id, user_id)

    async def duplicate_task(self, user_id: UUID, task_id: UUID) -> Task:
        source = await self.get_task(user_id, task_id)
        if source.parent_task_id is not None:
            await self.get_task(user_id, source.parent_task_id)
        # A duplicate starts fresh; source history stays on the original task.
        payload = TaskCreateRequest(
            title=source.title,
            description=source.description,
            project_id=source.project_id,
            category_id=source.category_id,
            parent_task_id=source.parent_task_id,
            priority=cast(TaskPriority, source.priority),
            estimated_minutes=source.estimated_minutes,
            due_at=source.due_at,
        )
        return await self.create_task(user_id, payload)

    async def task_progress(
        self,
        user_id: UUID,
        task_id: UUID,
        start: date | None = None,
        end: date | None = None,
    ) -> TaskProgressResponse:
        if start is not None and end is not None and end <= start:
            raise ValidationAppError("end must be after start")
        task = await self.get_task(user_id, task_id)
        settings = await self.user_repo.get_settings_by_user_id(user_id)
        timezone = settings.timezone if settings else get_settings().default_timezone
        zone = ZoneInfo(timezone)
        today = datetime.now(zone).date()
        eligible = completed = skipped = cancelled = future = 0
        for occurrence in task.occurrences:
            day = occurrence.scheduled_date
            if day is None and occurrence.due_at is not None:
                day = occurrence.due_at.astimezone(zone).date()
            if day is None:
                continue
            if (start is not None and day < start) or (end is not None and day >= end):
                continue
            if day > today:
                future += 1
            elif occurrence.status == "CANCELLED":
                cancelled += 1
            else:
                eligible += 1
                completed += occurrence.status == "DONE"
                skipped += occurrence.status == "SKIPPED"
        return TaskProgressResponse(
            task_id=task_id,
            timezone=timezone,
            window_start=start,
            window_end_exclusive=end,
            as_of=today,
            eligible_count=eligible,
            completed_count=completed,
            skipped_count=skipped,
            cancelled_count=cancelled,
            future_excluded_count=future,
            completion_rate=round(completed / eligible * 100, 2) if eligible else None,
        )

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
        if "parent_task_id" in payload.model_fields_set:
            await self.repo.lock_owner(user_id)
        task = await self.repo.get_task_by_id_and_user(task_id, user_id, for_update=True)
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

        if "parent_task_id" in fields_set and payload.parent_task_id is not None:
            cursor = payload.parent_task_id
            visited: set[UUID] = set()
            while cursor is not None:
                if cursor == task.id or cursor in visited:
                    raise ConflictError("Task hierarchy cannot contain a cycle.", code="TASK_CYCLE")
                visited.add(cursor)
                parent = await self.repo.get_task_by_id_and_user(cursor, user_id, for_update=True)
                if parent is None:
                    raise NotFoundError("Parent task not found.", code="PARENT_TASK_NOT_FOUND")
                cursor = parent.parent_task_id

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
            "parent_task_id",
        )
        for nullable_field in nullable_fields:
            if nullable_field in fields_set:
                setattr(task, nullable_field, getattr(payload, nullable_field))

        if "archived" in fields_set:
            if payload.archived is None:
                raise ValidationAppError("Field 'archived' cannot be null.")
            task.archived_at = utc_now() if payload.archived else None

        task.version += 1
        event_type = "TASK_UPDATED"
        if "archived" in fields_set:
            event_type = "TASK_ARCHIVED" if payload.archived else "TASK_RESTORED"
        record_event(
            self.session,
            user_id,
            "TASK",
            task.id,
            event_type,
            {"fields": sorted(fields_set - {"expected_version"})},
        )
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
        zone = ZoneInfo(tz_name)
        local_today = datetime.now(zone).date()
        local_end_utc = datetime.combine(
            local_today + timedelta(days=1), time.min, zone
        ).astimezone(UTC)
        return await self.repo.list_occurrences(
            user_id,
            scope=scope,
            local_today=local_today,
            local_end_utc=local_end_utc,
            project_id=project_id,
            category_id=category_id,
            search=search,
            limit=limit,
            offset=offset,
        )

    async def patch_occurrence(
        self, user_id: UUID, occurrence_id: UUID, payload: OccurrencePatchRequest
    ) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(
            occurrence_id, user_id, for_update=True
        )
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
        record_event(
            self.session,
            user_id,
            "OCCURRENCE",
            occurrence.id,
            "OCCURRENCE_SCHEDULE_UPDATED",
            {"fields": sorted(fields_set - {"expected_version"})},
        )
        await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded

    async def complete_occurrence(self, user_id: UUID, occurrence_id: UUID) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(
            occurrence_id, user_id, for_update=True
        )
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")

        ensure_valid_transition(occurrence.status, OccurrenceStatus.DONE)
        if occurrence.status != OccurrenceStatus.DONE.value:
            previous = occurrence.status
            occurrence.status = OccurrenceStatus.DONE.value
            occurrence.completed_at = utc_now()
            occurrence.version += 1
            record_event(
                self.session,
                user_id,
                "OCCURRENCE",
                occurrence.id,
                "OCCURRENCE_STATUS_CHANGED",
                {"from": previous, "to": "DONE"},
            )
            await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded

    async def set_occurrence_status(
        self, user_id: UUID, occurrence_id: UUID, target: OccurrenceStatus
    ) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(
            occurrence_id, user_id, for_update=True
        )
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")
        ensure_valid_transition(occurrence.status, target)
        if occurrence.status != target.value:
            previous = occurrence.status
            occurrence.status = target.value
            occurrence.completed_at = utc_now() if target == OccurrenceStatus.DONE else None
            occurrence.version += 1
            record_event(
                self.session,
                user_id,
                "OCCURRENCE",
                occurrence.id,
                "OCCURRENCE_STATUS_CHANGED",
                {"from": previous, "to": target.value},
            )
            await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded

    async def reopen_occurrence(self, user_id: UUID, occurrence_id: UUID) -> TaskOccurrence:
        occurrence = await self.repo.get_occurrence_by_id_and_user(
            occurrence_id, user_id, for_update=True
        )
        if occurrence is None:
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")

        ensure_valid_transition(occurrence.status, OccurrenceStatus.NOT_STARTED)
        if occurrence.status != OccurrenceStatus.NOT_STARTED.value:
            previous = occurrence.status
            occurrence.status = OccurrenceStatus.NOT_STARTED.value
            occurrence.completed_at = None
            occurrence.version += 1
            record_event(
                self.session,
                user_id,
                "OCCURRENCE",
                occurrence.id,
                "OCCURRENCE_STATUS_CHANGED",
                {"from": previous, "to": "NOT_STARTED"},
            )
            await self.session.commit()
        loaded = await self.repo.get_occurrence_by_id_and_user(occurrence.id, user_id)
        assert loaded is not None
        return loaded
