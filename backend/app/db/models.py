"""Central ORM metadata registry for Alembic autogenerate discovery."""

import app.db.extended_models  # noqa: F401
from app.modules.auth.models.auth_session import AuthSession
from app.modules.goals.models.goal import Goal, GoalLink
from app.modules.planning.models.planning_period import PlanItem, PlanningPeriod
from app.modules.projects.models.project import Project
from app.modules.reminders.models.reminder import Reminder
from app.modules.tasks.models.checklist import ChecklistItem, OccurrenceChecklistState
from app.modules.tasks.models.recurrence_rule import RecurrenceRule
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_dependency import TaskDependency
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.taxonomy.models.category import Category
from app.modules.taxonomy.models.tag import Tag
from app.modules.taxonomy.models.task_tag import TaskTag
from app.modules.time_tracking.models.time_entry import TimeEntry
from app.modules.users.models.user import User, UserSettings

__all__ = [
    "AuthSession",
    "Category",
    "ChecklistItem",
    "Goal",
    "GoalLink",
    "OccurrenceChecklistState",
    "PlanItem",
    "PlanningPeriod",
    "Project",
    "RecurrenceRule",
    "Reminder",
    "Task",
    "TaskDependency",
    "TaskTag",
    "Tag",
    "TaskOccurrence",
    "TimeEntry",
    "User",
    "UserSettings",
]
