from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UTCDateTime, UUIDBinary16


class Reminder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reminders"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_reminders_idempotency_key"),
        CheckConstraint(
            "channel IN ('IN_APP', 'WEB_PUSH', 'IOS_LOCAL')",
            name="reminders_channel",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'CLAIMED', 'SENT', 'FAILED_RETRYABLE', "
            "'FAILED_PERMANENT', 'CANCELLED', 'DISMISSED')",
            name="reminders_status",
        ),
        Index(
            "ix_reminders_status_remind_at_lease",
            "status",
            "remind_at",
            "lease_until",
        ),
        Index(
            "ix_reminders_user_channel_read_at",
            "user_id",
            "channel",
            "read_at",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    occurrence_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("task_occurrences.id", ondelete="CASCADE"), nullable=False
    )
    offset_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    remind_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    channel: Mapped[str] = mapped_column(
        String(16), nullable=False, default="IN_APP", server_default=text("'IN_APP'")
    )
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="PENDING", server_default=text("'PENDING'")
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    attempt_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )
    lease_owner: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    last_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
