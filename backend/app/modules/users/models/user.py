from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.db.types import UTCDateTime, UUIDBinary16


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'DISABLED', 'PENDING_DELETION')",
            name="users_status",
        ),
        Index("ix_users_status", "status"),
    )

    email: Mapped[str] = mapped_column(String(254), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="ACTIVE", server_default=text("'ACTIVE'")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    settings: Mapped[UserSettings | None] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )


class UserSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_settings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_settings_user_id"),
        CheckConstraint("week_starts_on BETWEEN 1 AND 7", name="user_settings_week_starts_on"),
        CheckConstraint("theme IN ('LIGHT', 'DARK', 'SYSTEM')", name="user_settings_theme"),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="Asia/Ho_Chi_Minh",
        server_default=text("'Asia/Ho_Chi_Minh'"),
    )
    week_starts_on: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1, server_default=text("1")
    )
    locale: Mapped[str] = mapped_column(
        String(16), nullable=False, default="vi-VN", server_default=text("'vi-VN'")
    )
    theme: Mapped[str] = mapped_column(
        String(16), nullable=False, default="SYSTEM", server_default=text("'SYSTEM'")
    )
    color_theme: Mapped[str] = mapped_column(
        String(32), nullable=False, default="SOFT_BLUE", server_default=text("'SOFT_BLUE'")
    )
    working_hours_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    user: Mapped[User] = relationship(back_populates="settings")


def default_created_at() -> datetime:
    return utc_now()
