"""M8: owner-scoped tags and task dependency edges.

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa

import app.db.types
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Composite parent keys let link-table FKs prove that both records share an owner.
    op.create_unique_constraint("uq_tasks_user_id", "tasks", ["user_id", "id"])
    op.create_table(
        "tags",
        sa.Column("id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("user_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("name_normalized", sa.String(60), nullable=False),
        sa.Column("color_token", sa.String(24), nullable=False, server_default="SKY"),
        sa.Column("created_at", app.db.types.UTCDateTime(), nullable=False),
        sa.Column("updated_at", app.db.types.UTCDateTime(), nullable=False),
        sa.CheckConstraint(
            "color_token IN ('LAVENDER', 'SAGE', 'PEACH', 'ROSE', 'BUTTER', 'SKY', 'SLATE')",
            name="ck_tags_tags_color_token",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_tags_user_id_users", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
        sa.UniqueConstraint("user_id", "id", name="uq_tags_user_id"),
        sa.UniqueConstraint("user_id", "name_normalized", name="uq_tags_user_name_normalized"),
    )
    op.create_table(
        "task_tags",
        sa.Column("id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("user_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("task_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("tag_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("created_at", app.db.types.UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id", "task_id"],
            ["tasks.user_id", "tasks.id"],
            name="fk_task_tags_user_id_tasks",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "tag_id"],
            ["tags.user_id", "tags.id"],
            name="fk_task_tags_user_id_tags",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_task_tags"),
        sa.UniqueConstraint("task_id", "tag_id", name="uq_task_tags_task_tag"),
    )
    op.create_index("ix_task_tags_user_tag", "task_tags", ["user_id", "tag_id"])
    op.create_table(
        "task_dependencies",
        sa.Column("id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("user_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("blocking_task_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("blocked_task_id", app.db.types.UUIDBinary16(), nullable=False),
        sa.Column("relation_type", sa.String(24), nullable=False, server_default="FINISH_TO_START"),
        sa.Column("created_at", app.db.types.UTCDateTime(), nullable=False),
        sa.CheckConstraint(
            "blocking_task_id <> blocked_task_id",
            name="ck_task_dependencies_task_dependencies_no_self",
        ),
        sa.CheckConstraint(
            "relation_type IN ('FINISH_TO_START')",
            name="ck_task_dependencies_task_dependencies_relation_type",
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "blocking_task_id"],
            ["tasks.user_id", "tasks.id"],
            name="fk_task_dependencies_blocking_owner",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "blocked_task_id"],
            ["tasks.user_id", "tasks.id"],
            name="fk_task_dependencies_blocked_owner",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_task_dependencies"),
        sa.UniqueConstraint(
            "user_id", "blocking_task_id", "blocked_task_id", name="uq_task_dependencies_edge"
        ),
    )
    op.create_index(
        "ix_task_dependencies_user_blocked", "task_dependencies", ["user_id", "blocked_task_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_task_dependencies_user_blocked", table_name="task_dependencies")
    op.drop_table("task_dependencies")
    op.drop_index("ix_task_tags_user_tag", table_name="task_tags")
    op.drop_table("task_tags")
    op.drop_table("tags")
    op.drop_constraint("uq_tasks_user_id", "tasks", type_="unique")
