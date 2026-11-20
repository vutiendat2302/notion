"""Pure calendar recurrence rules. Dates are interpreted in the rule's local timezone."""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol


class RuleLike(Protocol):
    @property
    def frequency(self) -> str: ...

    @property
    def interval_value(self) -> int: ...

    @property
    def weekdays_mask(self) -> int | None: ...

    @property
    def month_day(self) -> int | None: ...

    @property
    def monthly_overflow_policy(self) -> str: ...

    @property
    def starts_on(self) -> date: ...

    @property
    def ends_on(self) -> date | None: ...

    @property
    def max_count(self) -> int | None: ...


@dataclass(frozen=True)
class RecurrencePattern:
    frequency: str
    interval_value: int
    weekdays_mask: int | None
    month_day: int | None
    monthly_overflow_policy: str
    starts_on: date
    ends_on: date | None
    max_count: int | None


def _month_date(year: int, month: int, day: int, policy: str) -> date | None:
    last_day = monthrange(year, month)[1]
    if day > last_day and policy == "SKIP":
        return None
    return date(year, month, min(day, last_day))


def recurrence_dates(rule: RuleLike, through: date, *, from_date: date | None = None) -> list[date]:
    """Return dates through an inclusive bound; max_count applies from rule inception."""
    if through < rule.starts_on or rule.max_count == 0:
        return []
    end = min(through, rule.ends_on) if rule.ends_on else through
    lower = max(rule.starts_on, from_date) if from_date else rule.starts_on
    result: list[date] = []
    produced = 0

    def include(candidate: date | None) -> bool:
        nonlocal produced
        if candidate is None or candidate < rule.starts_on or candidate > end:
            return True
        produced += 1
        if candidate >= lower:
            result.append(candidate)
        return rule.max_count is None or produced < rule.max_count

    if rule.frequency == "DAILY":
        current = rule.starts_on
        while current <= end:
            if not include(current):
                break
            current += timedelta(days=rule.interval_value)
    elif rule.frequency == "WEEKLY":
        mask = rule.weekdays_mask or (1 << rule.starts_on.weekday())
        origin_week = rule.starts_on - timedelta(days=rule.starts_on.weekday())
        current = rule.starts_on
        while current <= end:
            week_index = (current - origin_week).days // 7
            if week_index % rule.interval_value == 0 and mask & (1 << current.weekday()):
                if not include(current):
                    break
            current += timedelta(days=1)
    elif rule.frequency == "MONTHLY":
        origin = rule.starts_on.year * 12 + rule.starts_on.month - 1
        end_month = end.year * 12 + end.month - 1
        month_index = origin
        day = rule.month_day or rule.starts_on.day
        while month_index <= end_month:
            year, month_zero = divmod(month_index, 12)
            if not include(_month_date(year, month_zero + 1, day, rule.monthly_overflow_policy)):
                break
            month_index += rule.interval_value
    elif rule.frequency == "YEARLY":
        year = rule.starts_on.year
        while year <= end.year:
            if not include(
                _month_date(
                    year, rule.starts_on.month, rule.starts_on.day, rule.monthly_overflow_policy
                )
            ):
                break
            year += rule.interval_value
    else:
        raise ValueError(f"Unsupported recurrence frequency: {rule.frequency}")
    return result
