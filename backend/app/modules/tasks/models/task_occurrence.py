from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UTCDateTime, UUIDBinary16

if TYPE_CHECKING:
    from app.modules.tasks.models.task import Task


class TaskOccurrence(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "task_occurrences"
    __table_args__ = (
        UniqueConstraint(
            "task_id",
            "recurrence_key",
            name="uq_task_occurrences_task_id_recurrence_key",
        ),
        CheckConstraint(
            "status IN ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'CANCELLED')",
            name="task_occurrences_status",
        ),
        CheckConstraint(
            "end_at IS NULL OR start_at IS NULL OR end_at > start_at",
            name="task_occurrences_time_range",
        ),
        Index(
            "ix_task_occurrences_user_id_scheduled_date_status",
            "user_id",
            "scheduled_date",
            "status",
        ),
        Index(
            "ix_task_occurrences_user_id_start_at_end_at",
            "user_id",
            "start_at",
            "end_at",
        ),
        Index(
            "ix_task_occurrences_user_id_due_at_status",
            "user_id",
            "due_at",
            "status",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    task_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    recurrence_rule_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("recurrence_rules.id", ondelete="SET NULL"), nullable=True
    )
    recurrence_key: Mapped[str] = mapped_column(
        String(64), nullable=False, default="ONCE", server_default=text("'ONCE'")
    )
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="NOT_STARTED", server_default=text("'NOT_STARTED'")
    )
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    is_override: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )

    task: Mapped[Task] = relationship(back_populates="occurrences")
