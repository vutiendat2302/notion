"""add block_templates table for admin-managed block and form templates

Revision ID: 0007_block_templates
Revises: 0006_avatar_prefs_timer
Create Date: 2026-11-22 18:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.db.types import UTCDateTime, UUIDBinary16

# revision identifiers, used by Alembic.
revision: str = "0007_block_templates"
down_revision: str | Sequence[str] | None = "0006_avatar_prefs_timer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "block_templates",
        sa.Column("id", UUIDBinary16(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=24), nullable=False),
        sa.Column("name_vi", sa.String(length=120), nullable=False),
        sa.Column("name_en", sa.String(length=120), nullable=False),
        sa.Column("description_vi", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("description_en", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("icon_name", sa.String(length=48), nullable=False, server_default="Sparkles"),
        sa.Column("widget_kind", sa.String(length=24), nullable=False),
        sa.Column("default_title", sa.String(length=200), nullable=False),
        sa.Column("default_width", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("default_height", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("default_spec_json", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("is_user_customizable", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", UTCDateTime(), nullable=False),
        sa.Column("updated_at", UTCDateTime(), nullable=False),
        sa.CheckConstraint(
            "category IN ('TEXT_FORMAT','PRODUCTIVITY','FORM_TABLE','CHART')",
            name="ck_block_templates_category",
        ),
        sa.CheckConstraint(
            "widget_kind IN ('METRIC_CARD','CHART','HEATMAP','PROGRESS','TASK_LIST')",
            name="ck_block_templates_widget_kind",
        ),
        sa.CheckConstraint(
            "default_width > 0 AND default_width <= 12 AND default_height > 0 AND default_height <= 12",
            name="ck_block_templates_bounds",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_block_templates"),
        sa.UniqueConstraint("slug", name="uq_block_templates_slug"),
    )
    op.create_index(
        "ix_block_templates_category_sort",
        "block_templates",
        ["category", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_block_templates_category_sort", table_name="block_templates")
    op.drop_table("block_templates")
