"""Canonical planning periods; ISO week keys remain stable across user week starts."""

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from app.core.exceptions import ValidationAppError

PeriodType = Literal["YEAR", "QUARTER", "MONTH", "WEEK", "DAY"]


@dataclass(frozen=True)
class PeriodWindow:
    period_type: PeriodType
    period_key: str
    start_date: date
    end_date_exclusive: date


def parse_period(period_type: PeriodType, key: str, week_starts_on: int = 1) -> PeriodWindow:
    if not 1 <= week_starts_on <= 7:
        raise ValidationAppError("week_starts_on must be between 1 and 7.")
    try:
        if period_type == "YEAR" and re.fullmatch(r"\d{4}", key):
            year = int(key)
            start, end = date(year, 1, 1), date(year + 1, 1, 1)
        elif period_type == "QUARTER" and re.fullmatch(r"\d{4}-Q[1-4]", key):
            year, quarter = int(key[:4]), int(key[-1])
            month = (quarter - 1) * 3 + 1
            start = date(year, month, 1)
            end = date(year + 1, 1, 1) if quarter == 4 else date(year, month + 3, 1)
        elif period_type == "MONTH" and re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", key):
            year, month = int(key[:4]), int(key[5:])
            start = date(year, month, 1)
            end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        elif period_type == "WEEK" and re.fullmatch(r"\d{4}-W\d{2}", key):
            monday = date.fromisocalendar(int(key[:4]), int(key[6:]), 1)
            start = monday - timedelta(days=(monday.isoweekday() - week_starts_on) % 7)
            end = start + timedelta(days=7)
        elif period_type == "DAY" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", key):
            start = date.fromisoformat(key)
            end = start + timedelta(days=1)
        else:
            raise ValueError("invalid period key")
    except (ValueError, OverflowError) as exc:
        raise ValidationAppError(
            "Invalid canonical period key.", code="INVALID_PERIOD_KEY"
        ) from exc
    return PeriodWindow(period_type, key, start, end)


def next_period(window: PeriodWindow, week_starts_on: int = 1) -> PeriodWindow:
    day = window.end_date_exclusive
    if window.period_type == "YEAR":
        key = str(day.year)
    elif window.period_type == "QUARTER":
        key = f"{day.year}-Q{(day.month - 1) // 3 + 1}"
    elif window.period_type == "MONTH":
        key = f"{day.year}-{day.month:02d}"
    elif window.period_type == "WEEK":
        iso = (
            date.fromisocalendar(int(window.period_key[:4]), int(window.period_key[6:]), 1)
            + timedelta(days=7)
        ).isocalendar()
        key = f"{iso.year}-W{iso.week:02d}"
    else:
        key = day.isoformat()
    return parse_period(window.period_type, key, week_starts_on)
