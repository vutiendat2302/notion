from datetime import date, time
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Time,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UUIDBinary16


class RecurrenceRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "recurrence_rules"
    __table_args__ = (
        CheckConstraint(
            "frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')",
            name="recurrence_rules_frequency",
        ),
        CheckConstraint("interval_value >= 1", name="recurrence_rules_interval"),
        CheckConstraint(
            "monthly_overflow_policy IN ('SKIP', 'CLAMP_TO_LAST_DAY')",
            name="recurrence_rules_overflow_policy",
        ),
        Index("ix_recurrence_rules_task_id_is_paused", "task_id", "is_paused"),
    )

    task_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)
    interval_value: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1, server_default=text("1")
    )
    weekdays_mask: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    month_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    monthly_overflow_policy: Mapped[str] = mapped_column(
        String(24), nullable=False, default="SKIP", server_default=text("'SKIP'")
    )
    default_start_time: Mapped[time | None] = mapped_column(Time(timezone=False), nullable=True)
    default_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    max_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="Asia/Ho_Chi_Minh",
        server_default=text("'Asia/Ho_Chi_Minh'"),
    )
    is_paused: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    rule_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
