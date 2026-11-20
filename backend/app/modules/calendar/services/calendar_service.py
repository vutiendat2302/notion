"""Calendar projection over task occurrences; no duplicate event storage."""

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationAppError
from app.modules.calendar.repositories.calendar_repository import CalendarRepository
from app.modules.calendar.schemas.calendar_schemas import (
    CalendarConflictsResponse,
    CalendarEventsResponse,
    CalendarOccurrence,
    DueMarker,
)
from app.modules.planning.domain.periods import PeriodWindow
from app.modules.planning.services.planning_service import utc_bounds
from app.modules.tasks.repositories.task_repository import TaskRepository
from app.modules.users.repositories.user_repository import UserRepository


class CalendarService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = CalendarRepository(session)
        self.task_repo = TaskRepository(session)
        self.user_repo = UserRepository(session)

    async def events(self, user_id: UUID, start: date, end: date) -> CalendarEventsResponse:
        if end <= start or end - start > timedelta(days=366):
            raise ValidationAppError("Calendar range must be 1–366 days, end exclusive.")
        settings = await self.user_repo.get_settings_by_user_id(user_id)
        timezone = settings.timezone if settings else get_settings().default_timezone
        window = PeriodWindow("DAY", start.isoformat(), start, end)
        start_utc, end_utc = utc_bounds(window, timezone)
        rows = await self.repo.list_events(user_id, start, end, start_utc, end_utc)
        all_day: list[CalendarOccurrence] = []
        timed: list[CalendarOccurrence] = []
        due: list[DueMarker] = []
        for item in rows:
            event = CalendarOccurrence(
                occurrence_id=item.id,
                task_id=item.task_id,
                title=item.task.title,
                status=item.status,
                scheduled_date=item.scheduled_date,
                start_at=item.start_at,
                end_at=item.end_at,
                due_at=item.due_at,
            )
            if (
                item.start_at is not None
                and item.start_at < end_utc
                and (item.end_at is None or item.end_at > start_utc)
            ):
                timed.append(event)
            elif item.scheduled_date is not None and start <= item.scheduled_date < end:
                all_day.append(event)
            if item.due_at is not None and start_utc <= item.due_at < end_utc:
                due.append(
                    DueMarker(
                        occurrence_id=item.id,
                        task_id=item.task_id,
                        title=item.task.title,
                        due_at=item.due_at,
                    )
                )
        return CalendarEventsResponse(
            user_id=user_id,
            start=start,
            end=end,
            timezone=timezone,
            all_day_occurrences=all_day,
            timed_occurrences=timed,
            due_markers=due,
        )

    async def conflicts(
        self,
        user_id: UUID,
        start_at: datetime,
        end_at: datetime,
        exclude_occurrence_id: UUID | None = None,
    ) -> CalendarConflictsResponse:
        if start_at.tzinfo is None or end_at.tzinfo is None:
            raise ValidationAppError("start_at and end_at require timezone offsets.")
        start_utc, end_utc = start_at.astimezone(UTC), end_at.astimezone(UTC)
        if end_utc <= start_utc or end_utc - start_utc > timedelta(days=7):
            raise ValidationAppError(
                "Conflict window must be greater than zero and at most 7 days."
            )
        if (
            exclude_occurrence_id is not None
            and await self.task_repo.get_occurrence_by_id_and_user(exclude_occurrence_id, user_id)
            is None
        ):
            raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")
        rows = await self.repo.list_conflicts(user_id, start_utc, end_utc, exclude_occurrence_id)
        conflicts = [
            CalendarOccurrence(
                occurrence_id=item.id,
                task_id=item.task_id,
                title=item.task.title,
                status=item.status,
                scheduled_date=item.scheduled_date,
                start_at=item.start_at,
                end_at=item.end_at,
                due_at=item.due_at,
            )
            for item in rows
        ]
        return CalendarConflictsResponse(
            start_at=start_utc,
            end_at=end_utc,
            has_conflict=bool(conflicts),
            conflicts=conflicts,
        )
