from datetime import date

import pytest

from app.core.exceptions import ValidationAppError
from app.modules.planning.domain.periods import next_period, parse_period


def test_iso_week_crosses_month_and_respects_user_week_start() -> None:
    monday = parse_period("WEEK", "2026-W49", 1)
    sunday = parse_period("WEEK", "2026-W49", 7)
    assert (monday.start_date, monday.end_date_exclusive) == (date(2026, 11, 30), date(2026, 12, 7))
    assert (sunday.start_date, sunday.end_date_exclusive) == (date(2026, 11, 29), date(2026, 12, 6))
    assert next_period(sunday, 7).period_key == "2026-W50"


def test_iso_week_crosses_year_and_next_period_is_canonical() -> None:
    current = parse_period("WEEK", "2026-W53")
    assert (current.start_date, current.end_date_exclusive) == (
        date(2026, 12, 28),
        date(2027, 1, 4),
    )
    following = next_period(current)
    assert following.period_key == "2027-W01"
    assert following.start_date == date(2027, 1, 4)


@pytest.mark.parametrize(
    ("period_type", "key"),
    [("WEEK", "2026-W54"), ("MONTH", "2026-13"), ("DAY", "2026-02-30"), ("QUARTER", "2026-Q5")],
)
def test_invalid_period_key_is_rejected(period_type: str, key: str) -> None:
    with pytest.raises(ValidationAppError):
        parse_period(period_type, key)  # type: ignore[arg-type]
