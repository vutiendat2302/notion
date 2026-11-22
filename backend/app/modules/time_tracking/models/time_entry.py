from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Computed,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UTCDateTime, UUIDBinary16


class TimeEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "time_entries"
    __table_args__ = (
        CheckConstraint("source IN ('TIMER', 'MANUAL')", name="time_entries_source"),
        CheckConstraint(
            "status IN ('RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')",
            name="time_entries_status",
        ),
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="time_entries_time_range",
        ),
        UniqueConstraint("active_user_lock", name="uq_time_entries_active_user_lock"),
        Index("ix_time_entries_user_started_ended", "user_id", "started_at", "ended_at"),
        Index("ix_time_entries_occurrence_id", "occurrence_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    occurrence_id: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(), ForeignKey("task_occurrences.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="TIMER", server_default=text("'TIMER'")
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="RUNNING", server_default=text("'RUNNING'")
    )
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    last_resumed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    paused_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    planned_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    active_user_lock: Mapped[UUID | None] = mapped_column(
        UUIDBinary16(),
        Computed("IF(status IN ('RUNNING','PAUSED'), user_id, NULL)", persisted=False),
        nullable=True,
    )
