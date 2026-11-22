from datetime import UTC, datetime, timedelta
from typing import Literal, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.db.base import new_uuid7, utc_now
from app.modules.tasks.domain.status_policy import OccurrenceStatus
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.time_tracking.models.time_entry import TimeEntry
from app.modules.time_tracking.schemas.time_entry_schemas import (
    ActiveTimerResponse,
    TimeEntryCompleteRequest,
    TimeEntryResponse,
    TimeEntryStartRequest,
)
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.audit import record_event

MAX_TIMER_CONTINUOUS_SECONDS = 12 * 3600


def _ensure_utc(dt: datetime | None, fallback: datetime) -> datetime:
    if dt is None:
        return fallback
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _clamp_event_time(
    client_event_at: datetime | None,
    *,
    floor_time: datetime,
    server_now: datetime,
) -> datetime:
    if client_event_at is None:
        return server_now
    candidate = _ensure_utc(client_event_at, server_now)
    # Never allow future timestamps or timestamps earlier than last state change.
    floor_utc = _ensure_utc(floor_time, server_now)
    if candidate > server_now:
        return server_now
    if candidate < floor_utc:
        return floor_utc
    return candidate


class TimeTrackingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_active(self, user_id: UUID) -> ActiveTimerResponse:
        now = utc_now()
        entry = await self._get_active_entry(user_id)
        auto_paused = False
        if entry is not None and entry.status == "RUNNING" and entry.last_resumed_at is not None:
            resumed_utc = _ensure_utc(entry.last_resumed_at, now)
            elapsed = int((now - resumed_utc).total_seconds())
            if elapsed > MAX_TIMER_CONTINUOUS_SECONDS:
                cap_time = resumed_utc + timedelta(seconds=MAX_TIMER_CONTINUOUS_SECONDS)
                entry.duration_seconds += MAX_TIMER_CONTINUOUS_SECONDS
                entry.paused_at = cap_time
                entry.last_resumed_at = None
                entry.status = "PAUSED"
                auto_paused = True
                await self.session.commit()
                await self.session.refresh(entry)

        return ActiveTimerResponse(
            user_id=user_id,
            active_entry=await self._serialize(entry, now) if entry else None,
            server_now=now,
            auto_paused_stale=auto_paused,
        )

    async def list_entries(
        self,
        user_id: UUID,
        *,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        task_id: UUID | None = None,
        occurrence_id: UUID | None = None,
        limit: int = 100,
    ) -> list[TimeEntryResponse]:
        now = utc_now()
        stmt = (
            select(TimeEntry)
            .where(TimeEntry.user_id == user_id)
            .order_by(TimeEntry.started_at.desc())
            .limit(limit)
        )
        if occurrence_id is not None:
            stmt = stmt.where(TimeEntry.occurrence_id == occurrence_id)
        if date_from is not None:
            stmt = stmt.where(TimeEntry.started_at >= _ensure_utc(date_from, now))
        if date_to is not None:
            stmt = stmt.where(TimeEntry.started_at <= _ensure_utc(date_to, now))
        if task_id is not None:
            stmt = stmt.join(TaskOccurrence, TimeEntry.occurrence_id == TaskOccurrence.id).where(
                TaskOccurrence.task_id == task_id
            )

        rows = (await self.session.execute(stmt)).scalars().all()
        return [await self._serialize(row, now) for row in rows]

    async def start_timer(self, user_id: UUID, payload: TimeEntryStartRequest) -> TimeEntryResponse:
        now = utc_now()
        existing = await self._get_active_entry(user_id)
        if existing is not None:
            if not payload.stop_existing:
                raise ConflictError(
                    "Đang có phiên tập trung hoạt động. Hãy tạm dừng hoặc hoàn thành trước.",
                    code="ACTIVE_TIMER_EXISTS",
                    details={"active_entry_id": str(existing.id)},
                )
            self._finalize_entry_values(existing, now)
            await self.session.flush()

        occurrence_id = payload.occurrence_id
        if payload.quick_task_title and payload.quick_task_title.strip():
            scheduled = payload.quick_task_scheduled_date
            if scheduled is None:
                settings = await UserRepository(self.session).get_settings_by_user_id(user_id)
                tz_name = settings.timezone if settings else "Asia/Ho_Chi_Minh"
                scheduled = datetime.now(ZoneInfo(tz_name)).date()

            quick_task = Task(
                id=new_uuid7(),
                user_id=user_id,
                title=payload.quick_task_title.strip(),
                priority="MEDIUM",
                estimated_minutes=(
                    max(1, payload.planned_duration_seconds // 60)
                    if payload.planned_duration_seconds
                    else None
                ),
            )
            self.session.add(quick_task)
            await self.session.flush()
            quick_occ = TaskOccurrence(
                id=new_uuid7(),
                user_id=user_id,
                task_id=quick_task.id,
                recurrence_key="ONCE",
                scheduled_date=scheduled,
                estimated_minutes=quick_task.estimated_minutes,
                status=OccurrenceStatus.IN_PROGRESS.value,
            )
            self.session.add(quick_occ)
            await self.session.flush()
            occurrence_id = quick_occ.id
        elif occurrence_id is not None:
            occ = await self._get_owned_occurrence(user_id, occurrence_id)
            if occ is None:
                raise NotFoundError("Task occurrence not found.", code="OCCURRENCE_NOT_FOUND")

        entry = TimeEntry(
            id=new_uuid7(),
            user_id=user_id,
            occurrence_id=occurrence_id,
            source="TIMER",
            status="RUNNING",
            started_at=now,
            last_resumed_at=now,
            paused_seconds=0,
            duration_seconds=0,
            planned_duration_seconds=payload.planned_duration_seconds,
            note=payload.note,
        )
        self.session.add(entry)
        await self.session.flush()
        record_event(self.session, user_id, "TIME_ENTRY", entry.id, "TIMER_STARTED")
        await self.session.commit()
        await self.session.refresh(entry)
        return await self._serialize(entry, now)

    async def pause_timer(
        self,
        user_id: UUID,
        entry_id: UUID,
        *,
        client_event_at: datetime | None = None,
    ) -> TimeEntryResponse:
        now = utc_now()
        entry = await self._get_owned_entry(user_id, entry_id)
        if entry.status != "RUNNING":
            raise ConflictError("Chỉ có thể tạm dừng phiên đang chạy.", code="TIMER_NOT_RUNNING")

        anchor = _ensure_utc(entry.last_resumed_at or entry.started_at, now)
        event_time = _clamp_event_time(client_event_at, floor_time=anchor, server_now=now)
        delta = max(
            0, min(MAX_TIMER_CONTINUOUS_SECONDS, int((event_time - anchor).total_seconds()))
        )
        entry.duration_seconds += delta
        entry.paused_at = event_time
        entry.last_resumed_at = None
        entry.status = "PAUSED"
        await self.session.commit()
        await self.session.refresh(entry)
        return await self._serialize(entry, now)

    async def resume_timer(
        self,
        user_id: UUID,
        entry_id: UUID,
        *,
        client_event_at: datetime | None = None,
    ) -> TimeEntryResponse:
        now = utc_now()
        entry = await self._get_owned_entry(user_id, entry_id)
        if entry.status != "PAUSED":
            raise ConflictError("Chỉ có thể tiếp tục phiên đang tạm dừng.", code="TIMER_NOT_PAUSED")

        anchor = _ensure_utc(entry.paused_at or entry.started_at, now)
        event_time = _clamp_event_time(client_event_at, floor_time=anchor, server_now=now)
        pause_delta = max(0, int((event_time - anchor).total_seconds()))
        entry.paused_seconds += pause_delta
        entry.paused_at = None
        entry.last_resumed_at = event_time
        entry.status = "RUNNING"
        await self.session.commit()
        await self.session.refresh(entry)
        return await self._serialize(entry, now)

    async def complete_timer(
        self,
        user_id: UUID,
        entry_id: UUID,
        payload: TimeEntryCompleteRequest,
    ) -> TimeEntryResponse:
        now = utc_now()
        entry = await self._get_owned_entry(user_id, entry_id)
        if entry.status not in ("RUNNING", "PAUSED"):
            raise ConflictError("Phiên làm việc đã kết thúc trước đó.", code="TIMER_ALREADY_CLOSED")

        anchor = _ensure_utc(entry.last_resumed_at or entry.paused_at or entry.started_at, now)
        event_time = _clamp_event_time(payload.client_event_at, floor_time=anchor, server_now=now)
        self._finalize_entry_values(entry, event_time)

        if payload.mark_occurrence_done and entry.occurrence_id is not None:
            occ = await self._get_owned_occurrence(user_id, entry.occurrence_id)
            if occ is not None and occ.status != OccurrenceStatus.DONE.value:
                occ.status = OccurrenceStatus.DONE.value
                occ.completed_at = event_time
                occ.version += 1

        record_event(
            self.session,
            user_id,
            "TIME_ENTRY",
            entry.id,
            "TIMER_COMPLETED",
            {"duration_seconds": entry.duration_seconds},
        )
        await self.session.commit()
        await self.session.refresh(entry)
        return await self._serialize(entry, now)

    async def cancel_timer(self, user_id: UUID, entry_id: UUID) -> TimeEntryResponse:
        now = utc_now()
        entry = await self._get_owned_entry(user_id, entry_id)
        if entry.status not in ("RUNNING", "PAUSED"):
            raise ConflictError("Phiên làm việc đã đóng.", code="TIMER_ALREADY_CLOSED")
        entry.status = "CANCELLED"
        entry.ended_at = now
        entry.last_resumed_at = None
        await self.session.commit()
        await self.session.refresh(entry)
        return await self._serialize(entry, now)

    def _finalize_entry_values(self, entry: TimeEntry, stop_time: datetime) -> None:
        if entry.status == "RUNNING" and entry.last_resumed_at is not None:
            resumed = _ensure_utc(entry.last_resumed_at, stop_time)
            delta = max(
                0, min(MAX_TIMER_CONTINUOUS_SECONDS, int((stop_time - resumed).total_seconds()))
            )
            entry.duration_seconds += delta
        elif entry.status == "PAUSED" and entry.paused_at is not None:
            paused = _ensure_utc(entry.paused_at, stop_time)
            entry.paused_seconds += max(0, int((stop_time - paused).total_seconds()))
        entry.last_resumed_at = None
        entry.paused_at = None
        entry.ended_at = stop_time
        entry.status = "COMPLETED"

    async def _get_active_entry(self, user_id: UUID) -> TimeEntry | None:
        stmt = select(TimeEntry).where(
            TimeEntry.user_id == user_id,
            TimeEntry.status.in_(["RUNNING", "PAUSED"]),
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def _get_owned_entry(self, user_id: UUID, entry_id: UUID) -> TimeEntry:
        stmt = select(TimeEntry).where(TimeEntry.id == entry_id, TimeEntry.user_id == user_id)
        entry = (await self.session.execute(stmt)).scalar_one_or_none()
        if entry is None:
            raise NotFoundError("Time entry not found.", code="TIME_ENTRY_NOT_FOUND")
        return entry

    async def _get_owned_occurrence(
        self, user_id: UUID, occurrence_id: UUID
    ) -> TaskOccurrence | None:
        stmt = select(TaskOccurrence).where(
            TaskOccurrence.id == occurrence_id, TaskOccurrence.user_id == user_id
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def _serialize(self, entry: TimeEntry, server_now: datetime) -> TimeEntryResponse:
        task_id: UUID | None = None
        task_title: str | None = None
        if entry.occurrence_id is not None:
            stmt = (
                select(TaskOccurrence.task_id, Task.title)
                .join(Task, TaskOccurrence.task_id == Task.id)
                .where(TaskOccurrence.id == entry.occurrence_id)
            )
            row = (await self.session.execute(stmt)).first()
            if row is not None:
                task_id = row[0]
                task_title = row[1]

        effective = entry.duration_seconds
        if entry.status == "RUNNING" and entry.last_resumed_at is not None:
            resumed = _ensure_utc(entry.last_resumed_at, server_now)
            effective += max(
                0, min(MAX_TIMER_CONTINUOUS_SECONDS, int((server_now - resumed).total_seconds()))
            )

        return TimeEntryResponse(
            id=entry.id,
            user_id=entry.user_id,
            occurrence_id=entry.occurrence_id,
            task_id=task_id,
            task_title=task_title,
            source=cast("Literal['TIMER', 'MANUAL']", entry.source),  # type: ignore[name-defined]
            status=cast("Literal['RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']", entry.status),  # type: ignore[name-defined]
            started_at=entry.started_at,
            last_resumed_at=entry.last_resumed_at,
            paused_at=entry.paused_at,
            paused_seconds=entry.paused_seconds,
            ended_at=entry.ended_at,
            duration_seconds=entry.duration_seconds,
            planned_duration_seconds=entry.planned_duration_seconds,
            effective_elapsed_seconds=effective,
            note=entry.note,
            server_now=server_now,
        )
