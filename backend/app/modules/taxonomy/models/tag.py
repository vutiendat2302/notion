from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import UUIDBinary16


class Tag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (
        CheckConstraint(
            "color_token IN ('LAVENDER', 'SAGE', 'PEACH', 'ROSE', 'BUTTER', 'SKY', 'SLATE')",
            name="tags_color_token",
        ),
        UniqueConstraint("user_id", "name_normalized", name="uq_tags_user_name_normalized"),
        UniqueConstraint("user_id", "id", name="uq_tags_user_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    name_normalized: Mapped[str] = mapped_column(String(60), nullable=False)
    color_token: Mapped[str] = mapped_column(
        String(24), nullable=False, default="SKY", server_default=text("'SKY'")
    )
