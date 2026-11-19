from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UTCDateTime, UUIDBinary16


class PlanningPeriod(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "planning_periods"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "period_type",
            "period_key",
            name="uq_planning_periods_user_type_key",
        ),
        CheckConstraint(
            "period_type IN ('YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY')",
            name="planning_periods_type",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED')",
            name="planning_periods_status",
        ),
        CheckConstraint(
            "start_date < end_date_exclusive",
            name="planning_periods_date_range",
        ),
        Index(
            "ix_planning_periods_user_dates",
            "user_id",
            "start_date",
            "end_date_exclusive",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    period_type: Mapped[str] = mapped_column(String(12), nullable=False)
    period_key: Mapped[str] = mapped_column(String(16), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date_exclusive: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="Asia/Ho_Chi_Minh",
        server_default=text("'Asia/Ho_Chi_Minh'"),
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    focus_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="ACTIVE", server_default=text("'ACTIVE'")
    )
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )


class PlanItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_items"
    __table_args__ = (
        UniqueConstraint("period_id", "target_key", name="uq_plan_items_period_target"),
        CheckConstraint(
            "commitment IN ('PLANNED', 'COMMITTED', 'OPTIONAL')",
            name="plan_items_commitment",
        ),
        CheckConstraint(
            "((CASE WHEN task_id IS NOT NULL THEN 1 ELSE 0 END) + "
            "(CASE WHEN occurrence_id IS NOT NULL THEN 1 ELSE 0 END) + "
            "(CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END) + "
            "(CASE WHEN goal_id IS NOT NULL THEN 1 ELSE 0 END)) = 1",
            name="plan_items_single_target_xor",
        ),
        Index("ix_plan_items_period_rank", "period_id", "priority_rank"),
    )

    period_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("planning_periods.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=True
    )
    occurrence_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("task_occurrences.id", ondelete="RESTRICT"), nullable=True
    )
    project_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=True
    )
    goal_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("goals.id", ondelete="RESTRICT"), nullable=True
    )
    target_key: Mapped[str] = mapped_column(String(64), nullable=False)
    priority_rank: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    commitment: Mapped[str] = mapped_column(
        String(16), nullable=False, default="COMMITTED", server_default=text("'COMMITTED'")
    )
