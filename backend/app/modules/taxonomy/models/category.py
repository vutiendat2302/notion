from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UTCDateTime, UUIDBinary16


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint(
            "accent_token IN ('LAVENDER', 'SAGE', 'PEACH', 'ROSE', 'BUTTER', 'SKY', 'SLATE')",
            name="categories_accent_token",
        ),
        Index(
            "ix_categories_user_id_archived_at_sort_order",
            "user_id",
            "archived_at",
            "sort_order",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    accent_token: Mapped[str] = mapped_column(
        String(24), nullable=False, default="SKY", server_default=text("'SKY'")
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
