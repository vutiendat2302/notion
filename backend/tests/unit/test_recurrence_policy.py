from datetime import date

from app.modules.tasks.domain.recurrence_policy import recurrence_dates
from app.modules.tasks.schemas.requests.workflow_requests import RecurrenceRuleRequest


def test_weekly_mask_and_interval() -> None:
    rule = RecurrenceRuleRequest(
        frequency="WEEKLY",
        interval_value=2,
        weekdays_mask=(1 << 0) | (1 << 2),
        starts_on=date(2026, 11, 16),
    )
    assert recurrence_dates(rule, date(2026, 12, 2)) == [
        date(2026, 11, 16),
        date(2026, 11, 18),
        date(2026, 11, 30),
        date(2026, 12, 2),
    ]


def test_month_end_skip_and_clamp() -> None:
    skip = RecurrenceRuleRequest(frequency="MONTHLY", starts_on=date(2026, 1, 31))
    clamp = skip.model_copy(update={"monthly_overflow_policy": "CLAMP_TO_LAST_DAY"})
    assert recurrence_dates(skip, date(2026, 4, 30)) == [date(2026, 1, 31), date(2026, 3, 31)]
    assert recurrence_dates(clamp, date(2026, 4, 30)) == [
        date(2026, 1, 31),
        date(2026, 2, 28),
        date(2026, 3, 31),
        date(2026, 4, 30),
    ]


def test_yearly_leap_day_and_count_from_inception() -> None:
    leap = RecurrenceRuleRequest(frequency="YEARLY", starts_on=date(2024, 2, 29))
    assert recurrence_dates(leap, date(2028, 12, 31)) == [date(2024, 2, 29), date(2028, 2, 29)]
    daily = RecurrenceRuleRequest(frequency="DAILY", starts_on=date(2026, 11, 1), max_count=3)
    assert recurrence_dates(daily, date(2026, 11, 30), from_date=date(2026, 11, 3)) == [
        date(2026, 11, 3)
    ]
