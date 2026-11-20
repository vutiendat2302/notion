from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.modules.tasks.domain.recurrence_policy import RecurrencePattern, recurrence_dates
from app.modules.tasks.models.recurrence_rule import RecurrenceRule
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.tasks.repositories.recurrence_repository import RecurrenceRepository
from app.modules.tasks.schemas.requests.workflow_requests import (
    RecurrenceEditRequest,
    RecurrenceRuleRequest,
)
from app.shared.audit import record_event


class RecurrenceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = RecurrenceRepository(session)

    @staticmethod
    def _pattern(rule: RecurrenceRule) -> RecurrencePattern:
        return RecurrencePattern(
            frequency=rule.frequency,
            interval_value=rule.interval_value,
            weekdays_mask=rule.weekdays_mask,
            month_day=rule.month_day,
            monthly_overflow_policy=rule.monthly_overflow_policy,
            starts_on=rule.starts_on,
            ends_on=rule.ends_on,
            max_count=rule.max_count,
        )

    def _make_rule(
        self, task_id: UUID, payload: RecurrenceRuleRequest, *, version: int = 1
    ) -> RecurrenceRule:
        return RecurrenceRule(
            task_id=task_id,
            frequency=payload.frequency,
            interval_value=payload.interval_value,
            weekdays_mask=payload.weekdays_mask,
            month_day=payload.month_day,
            monthly_overflow_policy=payload.monthly_overflow_policy,
            default_start_time=payload.default_start_time,
            default_duration_minutes=payload.default_duration_minutes,
            starts_on=payload.starts_on,
            ends_on=payload.ends_on,
            max_count=payload.max_count,
            timezone=payload.timezone,
            rule_version=version,
            is_paused=False,
        )

    async def add_rule_for_new_task(
        self, task: Task, payload: RecurrenceRuleRequest
    ) -> tuple[RecurrenceRule, int]:
        rule = self._make_rule(task.id, payload)
        task.is_recurring = True
        await self.repo.add_rule(rule)
        today = datetime.now(ZoneInfo(rule.timezone)).date()
        generated = await self._generate(task, rule, today + timedelta(days=60), today)
        return rule, generated

    async def create_rule(
        self, user_id: UUID, task_id: UUID, payload: RecurrenceRuleRequest
    ) -> RecurrenceRule:
        task = await self.repo.lock_task(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        if task.archived_at is not None:
            raise ConflictError(
                "Archived task cannot receive a recurrence rule.", code="TASK_ARCHIVED"
            )
        if await self.repo.latest_rule(task_id) is not None:
            raise ConflictError("Task already has a recurrence rule.", code="RECURRENCE_EXISTS")
        once = await self.repo.unstarted_once_occurrence(task_id)
        if once is not None:
            if once.status != "NOT_STARTED" or await self.repo.has_time_entries(once.id):
                raise ConflictError("Completed or tracked one-off task cannot be converted.")
            await self.repo.delete_occurrence(once)
        rule, _ = await self.add_rule_for_new_task(task, payload)
        record_event(
            self.session,
            user_id,
            "TASK",
            task_id,
            "RECURRENCE_CREATED",
            {"rule_version": rule.rule_version},
        )
        await self.session.commit()
        return rule

    async def get_rule(self, user_id: UUID, task_id: UUID) -> RecurrenceRule:
        task = await self.repo.lock_task(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        rule = await self.repo.latest_rule(task_id)
        if rule is None:
            raise NotFoundError("Recurrence rule not found.", code="RECURRENCE_NOT_FOUND")
        return rule

    async def preview(self, user_id: UUID, task_id: UUID, count: int) -> list[date]:
        rule = await self.get_rule(user_id, task_id)
        today = datetime.now(ZoneInfo(rule.timezone)).date()
        # Yearly and sparse monthly rules need a wider window than daily rules.
        end_year = min(9999, today.year + min(100, max(10, count * rule.interval_value + 1)))
        dates = recurrence_dates(self._pattern(rule), date(end_year, 12, 31), from_date=today)
        return dates[:count]

    async def _generate(
        self, task: Task, rule: RecurrenceRule, through: date, from_date: date
    ) -> int:
        existing = await self.repo.existing_keys(task.id)
        count = 0
        for day in recurrence_dates(self._pattern(rule), through, from_date=from_date):
            key = day.isoformat()
            if key in existing:
                continue
            start_at = None
            end_at = None
            if rule.default_start_time is not None:
                local_start = datetime.combine(
                    day, rule.default_start_time, ZoneInfo(rule.timezone)
                )
                start_at = local_start.astimezone(UTC)
                if rule.default_duration_minutes is not None:
                    end_at = start_at + timedelta(minutes=rule.default_duration_minutes)
            occurrence = TaskOccurrence(
                user_id=task.user_id,
                task_id=task.id,
                recurrence_rule_id=rule.id,
                recurrence_key=key,
                scheduled_date=day,
                start_at=start_at,
                end_at=end_at,
                estimated_minutes=rule.default_duration_minutes or task.estimated_minutes,
                status="NOT_STARTED",
            )
            await self.repo.add_occurrence(occurrence)
            existing.add(key)
            count += 1
        return count

    async def generate(self, user_id: UUID, task_id: UUID, through: date) -> int:
        task = await self.repo.lock_task(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        if task.archived_at is not None:
            raise ConflictError("Archived task cannot generate occurrences.", code="TASK_ARCHIVED")
        rule = await self.repo.latest_rule(task_id)
        if rule is None:
            raise NotFoundError("Recurrence rule not found.", code="RECURRENCE_NOT_FOUND")
        if rule.is_paused:
            raise ConflictError("Recurrence rule is paused.", code="RECURRENCE_PAUSED")
        today = datetime.now(ZoneInfo(rule.timezone)).date()
        if through < today or through > today + timedelta(days=365):
            raise ValidationAppError("through must be within the next 365 days")
        count = await self._generate(task, rule, through, today)
        await self.session.commit()
        return count

    async def set_paused(
        self, user_id: UUID, task_id: UUID, paused: bool, expected_rule_version: int
    ) -> RecurrenceRule:
        rule = await self.get_rule(user_id, task_id)
        if rule.rule_version != expected_rule_version:
            raise ConflictError("Recurrence rule changed.", code="RECURRENCE_CONFLICT")
        rule.is_paused = paused
        record_event(
            self.session,
            user_id,
            "TASK",
            task_id,
            "RECURRENCE_PAUSED" if paused else "RECURRENCE_RESUMED",
            {"rule_version": rule.rule_version},
        )
        await self.session.commit()
        return rule

    async def edit_future(
        self, user_id: UUID, task_id: UUID, payload: RecurrenceEditRequest
    ) -> RecurrenceRule:
        task = await self.repo.lock_task(task_id, user_id)
        if task is None:
            raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
        if task.archived_at is not None:
            raise ConflictError("Archived task cannot change recurrence.", code="TASK_ARCHIVED")
        old = await self.repo.latest_rule(task_id)
        if old is None:
            raise NotFoundError("Recurrence rule not found.", code="RECURRENCE_NOT_FOUND")
        if old.rule_version != payload.expected_rule_version:
            raise ConflictError("Recurrence rule changed.", code="RECURRENCE_CONFLICT")
        today = datetime.now(ZoneInfo(old.timezone)).date()
        if payload.effective_date < today:
            raise ValidationAppError("effective_date cannot be in the past")
        for occurrence in await self.repo.removable_future_occurrences(
            task_id, old.id, payload.effective_date
        ):
            await self.repo.delete_occurrence(occurrence)
        old.is_paused = True
        rule = self._make_rule(task_id, payload, version=old.rule_version + 1)
        await self.repo.add_rule(rule)
        await self._generate(task, rule, today + timedelta(days=60), payload.effective_date)
        record_event(
            self.session,
            user_id,
            "TASK",
            task_id,
            "RECURRENCE_FUTURE_CHANGED",
            {
                "previous_rule_version": old.rule_version,
                "rule_version": rule.rule_version,
                "effective_date": payload.effective_date.isoformat(),
            },
        )
        await self.session.commit()
        return rule
