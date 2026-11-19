"""Database-only ORM mappings for the approved M9–M13 entities.

Business services and APIs are added in their own phases. These mappings keep the
schema discoverable by Alembic without giving a service ownership of another domain.
"""

from sqlalchemy import (
    BINARY,
    CHAR,
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.schema import SchemaItem

from app.db.base import Base, new_uuid7, utc_now
from app.db.types import UTCDateTime, UUIDBinary16


def owned_table(name: str, *elements: SchemaItem, updated: bool = False) -> Table:
    columns = [
        Column("id", UUIDBinary16(), primary_key=True, default=new_uuid7),
        Column(
            "user_id", UUIDBinary16(), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        Column("created_at", UTCDateTime(), nullable=False, default=utc_now),
    ]
    if updated:
        columns.append(
            Column("updated_at", UTCDateTime(), nullable=False, default=utc_now, onupdate=utc_now)
        )
    return Table(name, Base.metadata, *columns, *elements)


habits = owned_table(
    "habits",
    Column("category_id", UUIDBinary16(), ForeignKey("categories.id", ondelete="SET NULL")),
    Column("title", String(255), nullable=False),
    Column("habit_type", String(16), nullable=False),
    Column("target_value", Numeric(12, 3)),
    Column("unit", String(32)),
    Column("schedule_type", String(16), nullable=False),
    Column("weekdays_mask", SmallInteger()),
    Column("target_per_week", SmallInteger()),
    Column("starts_on", Date(), nullable=False),
    Column("archived_at", UTCDateTime()),
    CheckConstraint("habit_type IN ('BOOLEAN','QUANTITATIVE')", name="habit_type"),
    CheckConstraint("schedule_type IN ('DAILY','WEEKDAYS','X_PER_WEEK')", name="schedule_type"),
    CheckConstraint("target_value IS NULL OR target_value > 0", name="target_value"),
    CheckConstraint(
        "target_per_week IS NULL OR target_per_week BETWEEN 1 AND 7", name="target_per_week"
    ),
    UniqueConstraint("user_id", "id", name="uq_habits_user_id"),
    Index("ix_habits_user_archived", "user_id", "archived_at"),
    updated=True,
)

habit_logs = owned_table(
    "habit_logs",
    Column("habit_id", UUIDBinary16(), nullable=False),
    Column("log_date", Date(), nullable=False),
    Column("value", Numeric(12, 3)),
    Column("status", String(16), nullable=False),
    Column("note", Text()),
    Column("logged_at", UTCDateTime(), nullable=False),
    ForeignKeyConstraint(
        ["user_id", "habit_id"], ["habits.user_id", "habits.id"], ondelete="CASCADE"
    ),
    UniqueConstraint("habit_id", "log_date", name="uq_habit_logs_habit_date"),
    CheckConstraint("status IN ('COMPLETED','SKIPPED')", name="status"),
    CheckConstraint("value IS NULL OR value >= 0", name="value"),
    Index("ix_habit_logs_user_date", "user_id", "log_date"),
)

goal_measurements = owned_table(
    "goal_measurements",
    Column("goal_id", UUIDBinary16(), nullable=False),
    Column("measured_value", Numeric(18, 4), nullable=False),
    Column("measured_at", UTCDateTime(), nullable=False),
    Column("source", String(16), nullable=False),
    Column("note", Text()),
    Column("idempotency_key", String(128), nullable=False),
    ForeignKeyConstraint(
        ["user_id", "goal_id"], ["goals.user_id", "goals.id"], ondelete="RESTRICT"
    ),
    UniqueConstraint("user_id", "idempotency_key", name="uq_goal_measurements_user_key"),
    CheckConstraint("source IN ('MANUAL','HABIT','IMPORT')", name="source"),
    Index("ix_goal_measurements_goal_at", "goal_id", "measured_at"),
)

goal_milestones = owned_table(
    "goal_milestones",
    Column("goal_id", UUIDBinary16(), nullable=False),
    Column("title", String(255), nullable=False),
    Column("target_date", Date()),
    Column("status", String(16), nullable=False, server_default=text("'PENDING'")),
    Column("completed_at", UTCDateTime()),
    Column("sort_order", Integer(), nullable=False, server_default=text("0")),
    ForeignKeyConstraint(
        ["user_id", "goal_id"], ["goals.user_id", "goals.id"], ondelete="RESTRICT"
    ),
    CheckConstraint("status IN ('PENDING','COMPLETED')", name="status"),
    Index("ix_goal_milestones_goal_order", "goal_id", "sort_order"),
    updated=True,
)

period_reviews = owned_table(
    "period_reviews",
    Column("period_id", UUIDBinary16(), nullable=False),
    Column("answers_json", JSON(), nullable=False),
    Column("metric_snapshot_json", JSON()),
    Column("snapshot_as_of", UTCDateTime()),
    Column("status", String(16), nullable=False, server_default=text("'DRAFT'")),
    Column("submitted_at", UTCDateTime()),
    Column("version", Integer(), nullable=False, server_default=text("1")),
    ForeignKeyConstraint(
        ["user_id", "period_id"],
        ["planning_periods.user_id", "planning_periods.id"],
        ondelete="RESTRICT",
    ),
    UniqueConstraint("period_id", name="uq_period_reviews_period"),
    CheckConstraint("status IN ('DRAFT','SUBMITTED')", name="status"),
    updated=True,
)

pages = owned_table(
    "pages",
    Column("parent_page_id", UUIDBinary16()),
    Column("title", String(255), nullable=False),
    Column("content_markdown", MEDIUMTEXT()),
    Column("version", Integer(), nullable=False, server_default=text("1")),
    Column("archived_at", UTCDateTime()),
    Column("deleted_at", UTCDateTime()),
    UniqueConstraint("user_id", "id", name="uq_pages_user_id"),
    ForeignKeyConstraint(
        ["user_id", "parent_page_id"], ["pages.user_id", "pages.id"], ondelete="RESTRICT"
    ),
    CheckConstraint("parent_page_id IS NULL OR parent_page_id <> id", name="no_self_parent"),
    Index("ix_pages_user_parent", "user_id", "parent_page_id"),
    updated=True,
)

saved_views = owned_table(
    "saved_views",
    Column("resource_type", String(16), nullable=False),
    Column("name", String(120), nullable=False),
    Column("view_type", String(16), nullable=False),
    Column("config_json", JSON(), nullable=False),
    Column("is_default", Boolean(), nullable=False, server_default=text("0")),
    CheckConstraint("resource_type IN ('TASKS','PROJECTS','PAGES')", name="resource_type"),
    CheckConstraint(
        "view_type IN ('LIST','TABLE','BOARD','CALENDAR','TIMELINE')", name="view_type"
    ),
    UniqueConstraint("user_id", "resource_type", "name", name="uq_saved_views_user_resource_name"),
    updated=True,
)

dashboards = owned_table(
    "dashboards",
    Column("title", String(200), nullable=False),
    Column("description", Text()),
    Column("layout_mode", String(24), nullable=False, server_default=text("'RESPONSIVE_GRID'")),
    Column("is_default", Boolean(), nullable=False, server_default=text("0")),
    Column("archived_at", UTCDateTime()),
    CheckConstraint("layout_mode IN ('RESPONSIVE_GRID')", name="layout_mode"),
    UniqueConstraint("user_id", "id", name="uq_dashboards_user_id"),
    Index("ix_dashboards_user_archived", "user_id", "archived_at"),
    updated=True,
)

dashboard_widgets = owned_table(
    "dashboard_widgets",
    Column("dashboard_id", UUIDBinary16(), nullable=False),
    Column("widget_kind", String(24), nullable=False),
    Column("title", String(200), nullable=False),
    Column("spec_json", JSON(), nullable=False),
    Column("position_x", Integer(), nullable=False),
    Column("position_y", Integer(), nullable=False),
    Column("width", Integer(), nullable=False),
    Column("height", Integer(), nullable=False),
    ForeignKeyConstraint(
        ["user_id", "dashboard_id"], ["dashboards.user_id", "dashboards.id"], ondelete="CASCADE"
    ),
    CheckConstraint(
        "widget_kind IN ('METRIC_CARD','CHART','HEATMAP','PROGRESS','TASK_LIST')",
        name="widget_kind",
    ),
    CheckConstraint(
        "position_x >= 0 AND position_y >= 0 AND width > 0 AND height > 0", name="layout_bounds"
    ),
    Index("ix_dashboard_widgets_dashboard_position", "dashboard_id", "position_y", "position_x"),
    updated=True,
)

files = owned_table(
    "files",
    Column("bucket", String(64), nullable=False),
    Column("object_key", String(255), nullable=False),
    Column("original_filename", String(255), nullable=False),
    Column("mime_type", String(128), nullable=False),
    Column("size_bytes", BigInteger(), nullable=False),
    Column("sha256_hex", CHAR(64), nullable=False),
    Column("current_version", Integer(), nullable=False, server_default=text("1")),
    Column("status", String(24), nullable=False, server_default=text("'PENDING_UPLOAD'")),
    UniqueConstraint("bucket", "object_key", name="uq_files_bucket_object_key"),
    UniqueConstraint("user_id", "id", name="uq_files_user_id"),
    CheckConstraint("size_bytes >= 0 AND current_version > 0", name="size_version"),
    CheckConstraint(
        "status IN ('PENDING_UPLOAD','READY','FAILED','PENDING_DELETE','DELETED')", name="status"
    ),
    Index("ix_files_user_status", "user_id", "status"),
    updated=True,
)

file_links = owned_table(
    "file_links",
    Column("file_id", UUIDBinary16(), nullable=False),
    Column("task_id", UUIDBinary16()),
    Column("project_id", UUIDBinary16()),
    Column("goal_id", UUIDBinary16()),
    Column("page_id", UUIDBinary16()),
    Column("target_key", String(80), nullable=False),
    ForeignKeyConstraint(
        ["user_id", "file_id"], ["files.user_id", "files.id"], ondelete="RESTRICT"
    ),
    ForeignKeyConstraint(
        ["user_id", "task_id"], ["tasks.user_id", "tasks.id"], ondelete="RESTRICT"
    ),
    ForeignKeyConstraint(
        ["user_id", "project_id"], ["projects.user_id", "projects.id"], ondelete="RESTRICT"
    ),
    ForeignKeyConstraint(
        ["user_id", "goal_id"], ["goals.user_id", "goals.id"], ondelete="RESTRICT"
    ),
    ForeignKeyConstraint(
        ["user_id", "page_id"], ["pages.user_id", "pages.id"], ondelete="RESTRICT"
    ),
    CheckConstraint(
        "(task_id IS NOT NULL) + (project_id IS NOT NULL) + "
        "(goal_id IS NOT NULL) + (page_id IS NOT NULL) = 1",
        name="one_target",
    ),
    UniqueConstraint("file_id", "target_key", name="uq_file_links_file_target"),
)

activity_events = owned_table(
    "activity_events",
    Column("entity_type", String(32), nullable=False),
    Column("entity_id", UUIDBinary16(), nullable=False),
    Column("event_type", String(64), nullable=False),
    Column("payload_json", JSON()),
    Column("request_id", String(64)),
    Index("ix_activity_events_user_entity_at", "user_id", "entity_type", "entity_id", "created_at"),
)

idempotency_keys = owned_table(
    "idempotency_keys",
    Column("scope", String(64), nullable=False),
    Column("idempotency_key", String(128), nullable=False),
    Column("request_hash", BINARY(32), nullable=False),
    Column("response_status", SmallInteger()),
    Column("response_body_json", JSON()),
    Column("expires_at", UTCDateTime(), nullable=False),
    UniqueConstraint(
        "user_id", "scope", "idempotency_key", name="uq_idempotency_keys_user_scope_key"
    ),
    Index("ix_idempotency_keys_expires", "expires_at"),
)

action_proposals = owned_table(
    "action_proposals",
    Column("action_type", String(48), nullable=False),
    Column("status", String(24), nullable=False, server_default=text("'AWAITING_CONFIRMATION'")),
    Column("changes_json", JSON(), nullable=False),
    Column("impact_summary", String(500), nullable=False),
    Column("idempotency_key", String(128), nullable=False),
    Column("expires_at", UTCDateTime(), nullable=False),
    Column("confirmed_at", UTCDateTime()),
    Column("ai_run_id", UUIDBinary16()),
    CheckConstraint(
        "status IN ('AWAITING_CONFIRMATION','EXECUTED','REJECTED','EXPIRED','FAILED')",
        name="status",
    ),
    UniqueConstraint("user_id", "idempotency_key", name="uq_action_proposals_user_key"),
    Index("ix_action_proposals_user_status_expires", "user_id", "status", "expires_at"),
    updated=True,
)

user_devices = owned_table(
    "user_devices",
    Column("installation_id_hash", BINARY(32), nullable=False),
    Column("platform", String(8), nullable=False),
    Column("device_label", String(120)),
    Column("push_endpoint_or_token", Text()),
    Column("last_seen_at", UTCDateTime()),
    Column("revoked_at", UTCDateTime()),
    CheckConstraint("platform IN ('WEB','IOS')", name="platform"),
    UniqueConstraint("user_id", "installation_id_hash", name="uq_user_devices_user_installation"),
    updated=True,
)

templates = owned_table(
    "templates",
    Column("template_kind", String(16), nullable=False),
    Column("name", String(120), nullable=False),
    Column("schema_version", Integer(), nullable=False),
    Column("payload_json", JSON(), nullable=False),
    Column("archived_at", UTCDateTime()),
    CheckConstraint("template_kind IN ('TASK','PROJECT','PLAN','REVIEW')", name="template_kind"),
    CheckConstraint("schema_version > 0", name="schema_version"),
    UniqueConstraint("user_id", "template_kind", "name", name="uq_templates_user_kind_name"),
    updated=True,
)

automation_rules = owned_table(
    "automation_rules",
    Column("name", String(120), nullable=False),
    Column("trigger_event", String(64), nullable=False),
    Column("condition_json", JSON(), nullable=False),
    Column("action_json", JSON(), nullable=False),
    Column("is_enabled", Boolean(), nullable=False, server_default=text("0")),
    Column("last_triggered_at", UTCDateTime()),
    UniqueConstraint("user_id", "name", name="uq_automation_rules_user_name"),
    updated=True,
)


class Habit(Base):
    __table__ = habits


class HabitLog(Base):
    __table__ = habit_logs


class GoalMeasurement(Base):
    __table__ = goal_measurements


class GoalMilestone(Base):
    __table__ = goal_milestones


class PeriodReview(Base):
    __table__ = period_reviews


class Page(Base):
    __table__ = pages


class SavedView(Base):
    __table__ = saved_views


class Dashboard(Base):
    __table__ = dashboards


class DashboardWidget(Base):
    __table__ = dashboard_widgets


class FileRecord(Base):
    __table__ = files


class FileLink(Base):
    __table__ = file_links


class ActivityEvent(Base):
    __table__ = activity_events


class IdempotencyKey(Base):
    __table__ = idempotency_keys


class ActionProposal(Base):
    __table__ = action_proposals


class UserDevice(Base):
    __table__ = user_devices


class Template(Base):
    __table__ = templates


class AutomationRule(Base):
    __table__ = automation_rules
