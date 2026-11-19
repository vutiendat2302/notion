from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    DECIMAL,
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

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.db.types import UTCDateTime, UUIDBinary16


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint(
            "goal_type IN ('QUANTITATIVE', 'COUNT_BASED', 'HABIT_BASED', "
            "'TASK_BASED', 'MILESTONE_BASED', 'QUALITATIVE')",
            name="goals_type",
        ),
        CheckConstraint(
            "measurement_mode IN ('AUTO', 'MANUAL', 'HYBRID')",
            name="goals_measurement_mode",
        ),
        CheckConstraint(
            "status IN ('NOT_STARTED', 'ACTIVE', 'ON_HOLD', 'ACHIEVED', 'CANCELLED')",
            name="goals_status",
        ),
        CheckConstraint("target_value > 0", name="goals_positive_target"),
        CheckConstraint("start_date <= end_date", name="goals_date_range"),
        CheckConstraint(
            "parent_goal_id IS NULL OR parent_goal_id <> id",
            name="goals_no_self_parent",
        ),
        Index("ix_goals_user_status_dates", "user_id", "status", "start_date", "end_date"),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    parent_goal_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("goals.id", ondelete="RESTRICT"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_type: Mapped[str] = mapped_column(String(24), nullable=False)
    metric_unit: Mapped[str] = mapped_column(
        String(32), nullable=False, default="hours", server_default=text("'hours'")
    )
    target_value: Mapped[Decimal] = mapped_column(DECIMAL(18, 4), nullable=False)
    baseline_value: Mapped[Decimal] = mapped_column(
        DECIMAL(18, 4), nullable=False, default=Decimal("0.0000"), server_default=text("0.0000")
    )
    measurement_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="AUTO", server_default=text("'AUTO'")
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="ACTIVE", server_default=text("'ACTIVE'")
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class GoalLink(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "goal_links"
    __table_args__ = (
        UniqueConstraint("goal_id", "target_key", name="uq_goal_links_goal_target"),
        CheckConstraint(
            "((CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END) + "
            "(CASE WHEN task_id IS NOT NULL THEN 1 ELSE 0 END)) = 1",
            name="goal_links_single_target_xor",
        ),
    )

    goal_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=True
    )
    task_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=True
    )
    target_key: Mapped[str] = mapped_column(String(64), nullable=False)
    weight: Mapped[Decimal] = mapped_column(
        DECIMAL(8, 4), nullable=False, default=Decimal("1.0000"), server_default=text("1.0000")
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)
