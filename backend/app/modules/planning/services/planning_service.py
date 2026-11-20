"""Saved plans and rollover; the service owns every write transaction."""

import hashlib
import re
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.db.base import utc_now
from app.db.extended_models import IdempotencyKey, idempotency_keys
from app.modules.planning.domain.periods import PeriodType, PeriodWindow, next_period, parse_period
from app.modules.planning.models.planning_period import PlanItem, PlanningPeriod
from app.modules.planning.repositories.planning_repository import PlanningRepository
from app.modules.planning.schemas.planning_schemas import (
    PeriodOverviewResponse,
    PlanItemCreateRequest,
    PlanItemPatchRequest,
    PlanItemResponse,
    RolloverCandidate,
    RolloverConfirmRequest,
    RolloverConfirmResponse,
    RolloverPreviewRequest,
    RolloverPreviewResponse,
    SavedPlanPutRequest,
    SavedPlanResponse,
)
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.tasks.schemas.responses.task_responses import OccurrenceWithTaskResponse
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.audit import record_event


def utc_bounds(window: PeriodWindow, timezone: str) -> tuple[datetime, datetime]:
    zone = ZoneInfo(timezone)
    return (
        datetime.combine(window.start_date, time.min, zone).astimezone(UTC),
        datetime.combine(window.end_date_exclusive, time.min, zone).astimezone(UTC),
    )


def occurrence_day(occurrence: TaskOccurrence, zone: ZoneInfo) -> date | None:
    if occurrence.scheduled_date is not None:
        return occurrence.scheduled_date
    if occurrence.start_at is not None:
        return occurrence.start_at.astimezone(zone).date()
    if occurrence.due_at is not None:
        return occurrence.due_at.astimezone(zone).date()
    return None


class PlanningService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = PlanningRepository(session)
        self.user_repo = UserRepository(session)

    async def _context(self, user_id: UUID) -> tuple[str, int]:
        settings = await self.user_repo.get_settings_by_user_id(user_id)
        return (
            settings.timezone if settings else get_settings().default_timezone,
            settings.week_starts_on if settings else 1,
        )

    async def overview(
        self, user_id: UUID, period_type: PeriodType, period_key: str
    ) -> PeriodOverviewResponse:
        timezone, week_start = await self._context(user_id)
        window = parse_period(period_type, period_key, week_start)
        start_utc, end_utc = utc_bounds(window, timezone)
        period = await self.repo.get_period(user_id, period_type, period_key)
        items = await self.repo.list_items(period.id) if period else []
        occurrences = await self.repo.list_occurrences_for_period(
            user_id, window.start_date, window.end_date_exclusive, start_utc, end_utc
        )
        overdue = await self.repo.list_overdue(user_id, window.start_date, start_utc)
        included_ids = {item.id for item in occurrences}
        focus = sum(
            (item.estimated_minutes or item.task.estimated_minutes or 0)
            for item in occurrences
            if item.status not in ("CANCELLED", "SKIPPED")
        )
        return PeriodOverviewResponse(
            user_id=user_id,
            period_type=period_type,
            period_key=period_key,
            start_date=window.start_date,
            end_date_exclusive=window.end_date_exclusive,
            timezone=timezone,
            week_starts_on=week_start,
            saved_plan=SavedPlanResponse.model_validate(period) if period else None,
            status=period.status if period else "UNSAVED",
            plan_items=[PlanItemResponse.model_validate(item) for item in items],
            occurrences=[OccurrenceWithTaskResponse.model_validate(item) for item in occurrences],
            overdue_occurrences=[
                OccurrenceWithTaskResponse.model_validate(item)
                for item in overdue
                if item.id not in included_ids
            ],
            planned_focus_minutes=focus,
        )

    async def put_plan(
        self, user_id: UUID, period_type: PeriodType, period_key: str, payload: SavedPlanPutRequest
    ) -> SavedPlanResponse:
        timezone, week_start = await self._context(user_id)
        window = parse_period(period_type, period_key, week_start)
        await self.repo.lock_owner(user_id)
        period = await self.repo.get_period(user_id, period_type, period_key, for_update=True)
        if period is None:
            if payload.expected_version is not None:
                raise ConflictError("Saved plan does not exist.", code="PLAN_VERSION_CONFLICT")
            period = PlanningPeriod(
                user_id=user_id,
                period_type=period_type,
                period_key=period_key,
                start_date=window.start_date,
                end_date_exclusive=window.end_date_exclusive,
                timezone=timezone,
                title=payload.title,
                focus_summary=payload.focus_summary,
                notes=payload.notes,
                status=payload.status,
                closed_at=utc_now() if payload.status == "CLOSED" else None,
            )
            self.session.add(period)
        else:
            if payload.expected_version is not None and payload.expected_version != period.version:
                raise ConflictError(
                    "Saved plan was modified concurrently.", code="PLAN_VERSION_CONFLICT"
                )
            period.title = payload.title
            period.focus_summary = payload.focus_summary
            period.notes = payload.notes
            period.status = payload.status
            period.closed_at = utc_now() if payload.status == "CLOSED" else None
            period.version += 1
        await self.session.flush()
        record_event(self.session, user_id, "PLANNING_PERIOD", period.id, "PLAN_SAVED")
        await self.session.commit()
        return SavedPlanResponse.model_validate(period)

    async def _writable_plan(self, user_id: UUID, plan_id: UUID) -> PlanningPeriod:
        period = await self.repo.get_period_by_id(user_id, plan_id)
        if period is None:
            raise NotFoundError("Saved plan not found.", code="PLAN_NOT_FOUND")
        if period.status in ("CLOSED", "ARCHIVED"):
            raise ConflictError("This saved plan is closed.", code="PLAN_CLOSED")
        return period

    async def add_item(
        self, user_id: UUID, plan_id: UUID, payload: PlanItemCreateRequest
    ) -> PlanItemResponse:
        await self.repo.lock_owner(user_id)
        period = await self._writable_plan(user_id, plan_id)
        if not await self.repo.target_owned(user_id, payload.target_type, payload.target_id):
            raise NotFoundError("Target not found.", code="PLAN_TARGET_NOT_FOUND")
        prefix = "OCC" if payload.target_type == "OCCURRENCE" else payload.target_type
        target_key = f"{prefix}:{payload.target_id}"
        if await self.repo.get_item_by_target(plan_id, target_key):
            raise ConflictError("Target is already in this plan.", code="PLAN_ITEM_DUPLICATE")
        item = PlanItem(
            period_id=plan_id,
            target_key=target_key,
            priority_rank=payload.priority_rank,
            commitment=payload.commitment,
            **{f"{payload.target_type.lower()}_id": payload.target_id},
        )
        self.session.add(item)
        period.version += 1
        await self.session.flush()
        record_event(self.session, user_id, "PLANNING_PERIOD", plan_id, "PLAN_ITEM_ADDED")
        await self.session.commit()
        return PlanItemResponse.model_validate(item)

    async def patch_item(
        self, user_id: UUID, plan_id: UUID, item_id: UUID, payload: PlanItemPatchRequest
    ) -> PlanItemResponse:
        await self.repo.lock_owner(user_id)
        period = await self._writable_plan(user_id, plan_id)
        item = await self.repo.get_item(plan_id, item_id)
        if item is None:
            raise NotFoundError("Plan item not found.", code="PLAN_ITEM_NOT_FOUND")
        for field in payload.model_fields_set:
            value = getattr(payload, field)
            if value is None:
                raise ValidationAppError(f"Field '{field}' cannot be null.")
            setattr(item, field, value)
        period.version += 1
        record_event(self.session, user_id, "PLANNING_PERIOD", plan_id, "PLAN_ITEM_UPDATED")
        await self.session.commit()
        return PlanItemResponse.model_validate(item)

    async def delete_item(self, user_id: UUID, plan_id: UUID, item_id: UUID) -> None:
        await self.repo.lock_owner(user_id)
        period = await self._writable_plan(user_id, plan_id)
        item = await self.repo.get_item(plan_id, item_id)
        if item is None:
            raise NotFoundError("Plan item not found.", code="PLAN_ITEM_NOT_FOUND")
        await self.session.delete(item)
        period.version += 1
        record_event(self.session, user_id, "PLANNING_PERIOD", plan_id, "PLAN_ITEM_REMOVED")
        await self.session.commit()

    async def rollover_preview(
        self,
        user_id: UUID,
        period_type: PeriodType,
        period_key: str,
        payload: RolloverPreviewRequest,
    ) -> RolloverPreviewResponse:
        timezone, week_start = await self._context(user_id)
        source = parse_period(period_type, period_key, week_start)
        target = next_period(source, week_start)
        start_utc, end_utc = utc_bounds(source, timezone)
        items = await self.repo.list_occurrences_for_period(
            user_id, source.start_date, source.end_date_exclusive, start_utc, end_utc
        )
        zone = ZoneInfo(timezone)
        candidates = [
            RolloverCandidate(
                occurrence_id=item.id,
                task_id=item.task_id,
                title=item.task.title,
                status=item.status,
                scheduled_date=item.scheduled_date,
                proposed_date=target.start_date,
                version=item.version,
            )
            for item in items
            if item.status in ("NOT_STARTED", "IN_PROGRESS")
            and (day := occurrence_day(item, zone)) is not None
            and source.start_date <= day < source.end_date_exclusive
        ]
        return RolloverPreviewResponse(
            source_period_type=period_type,
            source_period_key=period_key,
            target_period_key=target.period_key,
            target_start_date=target.start_date,
            action=payload.action,
            candidates=candidates,
        )

    async def rollover_confirm(
        self, user_id: UUID, payload: RolloverConfirmRequest, idempotency_key: str
    ) -> RolloverConfirmResponse:
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", idempotency_key):
            raise ValidationAppError("Idempotency-Key must be 8–128 safe ASCII characters.")
        timezone, week_start = await self._context(user_id)
        source = parse_period(payload.source_period_type, payload.source_period_key, week_start)
        target = next_period(source, week_start)
        await self.repo.lock_owner(user_id)
        request_hash = hashlib.sha256(payload.model_dump_json().encode()).digest()
        columns = idempotency_keys.c
        prior = (
            (
                await self.session.execute(
                    select(idempotency_keys).where(
                        columns.user_id == user_id,
                        columns.scope == "PLANNING_ROLLOVER",
                        columns.idempotency_key == idempotency_key,
                    )
                )
            )
            .mappings()
            .one_or_none()
        )
        if prior is not None:
            if prior["request_hash"] != request_hash:
                raise ConflictError(
                    "Idempotency key was used for another request.", code="IDEMPOTENCY_CONFLICT"
                )
            return RolloverConfirmResponse.model_validate(prior["response_body_json"]).model_copy(
                update={"replayed": True}
            )

        zone = ZoneInfo(timezone)
        period: PlanningPeriod | None = None
        changed = 0
        for selection in payload.items:
            occurrence = await self.repo.get_occurrence_for_update(user_id, selection.occurrence_id)
            if occurrence is None:
                raise NotFoundError("Occurrence not found.", code="OCCURRENCE_NOT_FOUND")
            if occurrence.version != selection.expected_version:
                raise ConflictError(
                    "Occurrence was modified concurrently.", code="OCCURRENCE_CONFLICT"
                )
            day = occurrence_day(occurrence, zone)
            if (
                occurrence.status not in ("NOT_STARTED", "IN_PROGRESS")
                or day is None
                or not (source.start_date <= day < source.end_date_exclusive)
            ):
                raise ConflictError(
                    "Occurrence is no longer eligible for rollover.", code="ROLLOVER_STALE"
                )

            if payload.action == "PIN":
                if period is None:
                    period = await self.repo.get_period(
                        user_id, target.period_type, target.period_key, for_update=True
                    )
                    if period is None:
                        period = PlanningPeriod(
                            user_id=user_id,
                            period_type=target.period_type,
                            period_key=target.period_key,
                            start_date=target.start_date,
                            end_date_exclusive=target.end_date_exclusive,
                            timezone=timezone,
                            status="ACTIVE",
                        )
                        self.session.add(period)
                        await self.session.flush()
                    if period.status in ("CLOSED", "ARCHIVED"):
                        raise ConflictError("Target plan is closed.", code="PLAN_CLOSED")
                key = f"OCC:{occurrence.id}"
                if await self.repo.get_item_by_target(period.id, key) is None:
                    self.session.add(
                        PlanItem(period_id=period.id, occurrence_id=occurrence.id, target_key=key)
                    )
                    changed += 1
            else:
                occurrence.scheduled_date = target.start_date
                if occurrence.start_at is not None:
                    local_time = occurrence.start_at.astimezone(zone).timetz().replace(tzinfo=None)
                    shifted = datetime.combine(target.start_date, local_time, zone).astimezone(UTC)
                    duration = (
                        occurrence.end_at - occurrence.start_at if occurrence.end_at else None
                    )
                    occurrence.start_at = shifted
                    occurrence.end_at = shifted + duration if duration is not None else None
                if occurrence.task.is_recurring:
                    occurrence.is_override = True
                occurrence.version += 1
                changed += 1
            record_event(
                self.session,
                user_id,
                "OCCURRENCE",
                occurrence.id,
                "OCCURRENCE_ROLLED_OVER",
                {"action": payload.action, "target_period_key": target.period_key},
            )

        response = RolloverConfirmResponse(
            source_period_key=source.period_key,
            target_period_key=target.period_key,
            action=payload.action,
            processed_count=changed,
            occurrence_ids=[item.occurrence_id for item in payload.items],
        )
        self.session.add(
            IdempotencyKey(
                user_id=user_id,
                scope="PLANNING_ROLLOVER",
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_status=200,
                response_body_json=response.model_dump(mode="json"),
                expires_at=utc_now() + timedelta(days=7),
            )
        )
        if period is not None and changed:
            period.version += 1
        await self.session.commit()
        return response
