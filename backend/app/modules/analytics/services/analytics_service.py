from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.extended_models import goal_measurements, goal_milestones, habit_logs, habits
from app.modules.analytics.domain.chart_specs import CHART_SPECS
from app.modules.analytics.schemas.analytics_schemas import (
    AnalyticsOverviewResponse,
    ChartEnvelopeResponse,
    StreakResponse,
)
from app.modules.goals.models.goal import Goal, GoalLink
from app.modules.planning.domain.periods import parse_period
from app.modules.projects.models.project import Project
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.taxonomy.models.category import Category
from app.modules.taxonomy.models.tag import Tag
from app.modules.taxonomy.models.task_tag import TaskTag
from app.modules.time_tracking.models.time_entry import TimeEntry
from app.modules.users.repositories.user_repository import UserRepository


def _to_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def _slice_entry_by_local_day(entry: TimeEntry, tz: ZoneInfo) -> dict[date, int]:
    """Split completed time_entry duration across local midnight boundaries proportionally."""
    if entry.duration_seconds <= 0:
        return {}
    start_local = _to_utc(entry.started_at).astimezone(tz)
    end_ref = entry.ended_at or (entry.started_at + timedelta(seconds=entry.duration_seconds))
    end_local = _to_utc(end_ref).astimezone(tz)
    if end_local <= start_local:
        return {start_local.date(): entry.duration_seconds}

    total_wall = (end_local - start_local).total_seconds()
    slices: list[tuple[date, float]] = []
    cursor = start_local
    while cursor < end_local:
        next_midnight = datetime.combine(cursor.date() + timedelta(days=1), time.min, tzinfo=tz)
        segment_end = min(end_local, next_midnight)
        slices.append((cursor.date(), (segment_end - cursor).total_seconds()))
        cursor = segment_end

    result: dict[date, int] = {}
    allocated = 0
    for idx, (day, wall_sec) in enumerate(slices):
        if idx == len(slices) - 1:
            sec = max(0, entry.duration_seconds - allocated)
        else:
            sec = int(round(entry.duration_seconds * (wall_sec / total_wall)))
            allocated += sec
        if sec > 0:
            result[day] = result.get(day, 0) + sec
    return result


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _user_context(self, user_id: UUID) -> tuple[ZoneInfo, int, str]:
        settings = await UserRepository(self.session).get_settings_by_user_id(user_id)
        tz_name = settings.timezone if settings else "Asia/Ho_Chi_Minh"
        week_starts_on = settings.week_starts_on if settings else 1
        return ZoneInfo(tz_name), week_starts_on, tz_name

    async def _compute_daily_activity(
        self,
        user_id: UUID,
        tz: ZoneInfo,
        *,
        project_id: UUID | None = None,
        category_id: UUID | None = None,
    ) -> tuple[dict[date, dict[str, int]], set[date]]:
        """Single source of truth for Active Day used by both Streak & Heatmaps."""
        occ_stmt = (
            select(TaskOccurrence.completed_at)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .where(
                TaskOccurrence.user_id == user_id,
                TaskOccurrence.status == "DONE",
                TaskOccurrence.completed_at.is_not(None),
            )
        )
        if project_id is not None:
            occ_stmt = occ_stmt.where(Task.project_id == project_id)
        if category_id is not None:
            occ_stmt = occ_stmt.where(Task.category_id == category_id)
        done_times = (await self.session.execute(occ_stmt)).scalars().all()

        done_by_day: dict[date, int] = defaultdict(int)
        for dt in done_times:
            if dt is not None:
                done_by_day[_to_utc(dt).astimezone(tz).date()] += 1

        habits_by_day: dict[date, int] = defaultdict(int)
        if project_id is None and category_id is None:
            hlog_rows = (
                (
                    await self.session.execute(
                        select(habit_logs.c.log_date).where(
                            habit_logs.c.user_id == user_id,
                            habit_logs.c.status == "COMPLETED",
                        )
                    )
                )
                .scalars()
                .all()
            )
            for ld in hlog_rows:
                habits_by_day[ld] += 1

        te_stmt = select(TimeEntry).where(
            TimeEntry.user_id == user_id,
            TimeEntry.status == "COMPLETED",
            TimeEntry.duration_seconds > 0,
        )
        if project_id is not None or category_id is not None:
            te_stmt = te_stmt.join(
                TaskOccurrence, TimeEntry.occurrence_id == TaskOccurrence.id
            ).join(Task, TaskOccurrence.task_id == Task.id)
            if project_id is not None:
                te_stmt = te_stmt.where(Task.project_id == project_id)
            if category_id is not None:
                te_stmt = te_stmt.where(Task.category_id == category_id)

        entries = (await self.session.execute(te_stmt)).scalars().all()
        focus_sec_by_day: dict[date, int] = defaultdict(int)
        for entry in entries:
            for day, sec in _slice_entry_by_local_day(entry, tz).items():
                focus_sec_by_day[day] += sec

        all_days = (
            set(done_by_day.keys()) | set(habits_by_day.keys()) | set(focus_sec_by_day.keys())
        )
        daily: dict[date, dict[str, int]] = {}
        active_days: set[date] = set()
        for day in all_days:
            d_cnt = done_by_day.get(day, 0)
            h_cnt = habits_by_day.get(day, 0)
            f_sec = focus_sec_by_day.get(day, 0)
            is_active = d_cnt >= 1 or h_cnt >= 1 or f_sec >= 900
            if is_active:
                active_days.add(day)
                score = d_cnt * 2 + h_cnt + (f_sec // 1500)
                if score == 0:
                    score = 1
            else:
                score = 0
            level = (
                0
                if score == 0
                else 1
                if score <= 2
                else 2
                if score <= 5
                else 3
                if score <= 9
                else 4
            )
            daily[day] = {
                "done_count": d_cnt,
                "habit_count": h_cnt,
                "focus_minutes": round(f_sec / 60),
                "score": score,
                "level": level,
                "is_active": 1 if is_active else 0,
            }
        return daily, active_days

    async def get_streak(self, user_id: UUID) -> StreakResponse:
        tz, _, tz_name = await self._user_context(user_id)
        today = datetime.now(tz).date()
        _, active_days = await self._compute_daily_activity(user_id, tz)

        today_active = today in active_days
        cursor = today if today_active else (today - timedelta(days=1))
        current_streak = 0
        while cursor in active_days:
            current_streak += 1
            cursor -= timedelta(days=1)

        sorted_days = sorted(active_days)
        best_streak = 0
        run = 0
        prev: date | None = None
        for day in sorted_days:
            if prev is not None and (day - prev).days == 1:
                run += 1
            else:
                run = 1
            best_streak = max(best_streak, run)
            prev = day

        start_30 = today - timedelta(days=29)
        active_30 = sum(1 for d in active_days if start_30 <= d <= today)
        consistency_30d = round(active_30 / 30 * 100, 1)

        return StreakResponse(
            timezone=tz_name,
            today_date=today,
            current_streak=current_streak,
            best_streak=best_streak,
            consistency_30d=consistency_30d,
            total_active_days=len(active_days),
            today_is_active=today_active,
            active_dates=[d.isoformat() for d in sorted_days[-365:]],
        )

    async def get_overview(self, user_id: UUID) -> AnalyticsOverviewResponse:
        tz, _, _ = await self._user_context(user_id)
        streak = await self.get_streak(user_id)
        today = datetime.now(tz).date()

        occ_rows = (
            (
                await self.session.execute(
                    select(TaskOccurrence).where(
                        TaskOccurrence.user_id == user_id,
                        TaskOccurrence.status.notin_(["SKIPPED", "CANCELLED"]),
                    )
                )
            )
            .scalars()
            .all()
        )
        eligible = len(occ_rows)
        done = sum(1 for o in occ_rows if o.status == "DONE")
        planned_min = sum(o.estimated_minutes or 0 for o in occ_rows)

        entries = (
            (
                await self.session.execute(
                    select(TimeEntry).where(
                        TimeEntry.user_id == user_id, TimeEntry.status == "COMPLETED"
                    )
                )
            )
            .scalars()
            .all()
        )
        active_sec = sum(e.duration_seconds for e in entries)
        today_sec = sum(_slice_entry_by_local_day(e, tz).get(today, 0) for e in entries)

        return AnalyticsOverviewResponse(
            user_id=user_id,
            streak=streak,
            metrics={
                "completion_rate": round(done / eligible * 100, 1) if eligible else None,
                "done_count": done,
                "eligible_count": eligible,
                "active_minutes": round(active_sec / 60),
                "today_focus_minutes": round(today_sec / 60),
                "planned_minutes": planned_min,
            },
            data_status="OK"
            if (eligible > 0 or active_sec > 0 or streak.total_active_days > 0)
            else "NO_DATA",
        )

    async def get_chart(
        self,
        user_id: UUID,
        chart_key: str,
        *,
        target_date: date | None = None,
        period_key: str | None = None,
        project_id: UUID | None = None,
        task_id: UUID | None = None,
        goal_id: UUID | None = None,
        habit_id: UUID | None = None,
        category_id: UUID | None = None,
        group_by: str = "project",
    ) -> ChartEnvelopeResponse:
        spec = CHART_SPECS.get(chart_key)
        if spec is None:
            raise NotFoundError(f"Unknown chart_key: {chart_key}", code="CHART_NOT_FOUND")

        tz, week_starts_on, tz_name = await self._user_context(user_id)
        today = target_date or datetime.now(tz).date()

        filters_applied = {
            "date": today.isoformat(),
            "period_key": period_key,
            "project_id": str(project_id) if project_id else None,
            "task_id": str(task_id) if task_id else None,
            "goal_id": str(goal_id) if goal_id else None,
            "habit_id": str(habit_id) if habit_id else None,
            "category_id": str(category_id) if category_id else None,
            "group_by": group_by,
        }

        if chart_key == "today_daily_timeline":
            return await self._chart_today_daily_timeline(
                user_id, spec.space, tz, tz_name, today, project_id, category_id, filters_applied
            )
        if chart_key == "today_completion_ring":
            return await self._chart_today_completion_ring(
                user_id, spec.space, tz_name, today, project_id, category_id, filters_applied
            )
        if chart_key == "today_focus_time":
            return await self._chart_today_focus_time(
                user_id, spec.space, tz, tz_name, today, project_id, task_id, filters_applied
            )
        if chart_key in (
            "weekly_completion",
            "weekly_planned_vs_actual",
            "weekly_workload_distribution",
        ):
            iso_year, iso_week, _ = today.isocalendar()
            wk = period_key or f"{iso_year}-W{iso_week:02d}"
            win = parse_period("WEEK", wk, week_starts_on)
            return await self._chart_weekly(
                user_id,
                chart_key,
                spec.space,
                tz,
                tz_name,
                win.start_date,
                win.end_date_exclusive,
                project_id,
                task_id,
                category_id,
                group_by,
                filters_applied,
            )
        if chart_key in (
            "monthly_activity_heatmap",
            "monthly_productivity_trend",
            "monthly_deadline_performance",
        ):
            mk = period_key or today.strftime("%Y-%m")
            win = parse_period("MONTH", mk, week_starts_on)
            return await self._chart_monthly(
                user_id,
                chart_key,
                spec.space,
                tz,
                tz_name,
                win.start_date,
                win.end_date_exclusive,
                project_id,
                category_id,
                filters_applied,
            )
        if chart_key in (
            "yearly_activity_heatmap",
            "yearly_monthly_comparison",
            "yearly_time_allocation",
        ):
            yk = period_key or str(today.year)
            win = parse_period("YEAR", yk, week_starts_on)
            return await self._chart_yearly(
                user_id,
                chart_key,
                spec.space,
                tz,
                tz_name,
                win.start_date,
                win.end_date_exclusive,
                project_id,
                category_id,
                group_by,
                filters_applied,
            )
        if chart_key in ("task_execution_history", "task_duration_trend"):
            return await self._chart_task_detail(
                user_id, chart_key, spec.space, tz, tz_name, task_id, filters_applied
            )
        if chart_key in ("project_progress", "project_cumulative_work"):
            return await self._chart_project(
                user_id, chart_key, spec.space, tz, tz_name, project_id, filters_applied
            )
        if chart_key in ("goal_progress", "goal_milestone_timeline"):
            return await self._chart_goal(
                user_id, chart_key, spec.space, tz_name, goal_id, filters_applied
            )
        # habit_consistency_heatmap
        mk = period_key or today.strftime("%Y-%m")
        win = parse_period("MONTH", mk, week_starts_on)
        return await self._chart_habits(
            user_id,
            spec.space,
            tz_name,
            today,
            win.start_date,
            win.end_date_exclusive,
            habit_id,
            filters_applied,
        )

    async def _fetch_entries(
        self,
        user_id: UUID,
        *,
        project_id: UUID | None = None,
        task_id: UUID | None = None,
        category_id: UUID | None = None,
    ) -> list[tuple[TimeEntry, Task | None]]:
        stmt = (
            select(TimeEntry, Task)
            .outerjoin(TaskOccurrence, TimeEntry.occurrence_id == TaskOccurrence.id)
            .outerjoin(Task, TaskOccurrence.task_id == Task.id)
            .where(TimeEntry.user_id == user_id, TimeEntry.status == "COMPLETED")
            .order_by(TimeEntry.started_at.asc())
        )
        if project_id is not None:
            stmt = stmt.where(Task.project_id == project_id)
        if task_id is not None:
            stmt = stmt.where(Task.id == task_id)
        if category_id is not None:
            stmt = stmt.where(Task.category_id == category_id)
        rows = (await self.session.execute(stmt)).all()
        return [(r[0], r[1]) for r in rows]

    async def _fetch_occurrences(
        self,
        user_id: UUID,
        *,
        project_id: UUID | None = None,
        task_id: UUID | None = None,
        category_id: UUID | None = None,
    ) -> list[tuple[TaskOccurrence, Task]]:
        stmt = (
            select(TaskOccurrence, Task)
            .join(Task, TaskOccurrence.task_id == Task.id)
            .where(TaskOccurrence.user_id == user_id)
        )
        if project_id is not None:
            stmt = stmt.where(Task.project_id == project_id)
        if task_id is not None:
            stmt = stmt.where(Task.id == task_id)
        if category_id is not None:
            stmt = stmt.where(Task.category_id == category_id)
        rows = (await self.session.execute(stmt)).all()
        return [(r[0], r[1]) for r in rows]

    async def _chart_today_daily_timeline(
        self,
        user_id: UUID,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        day: date,
        project_id: UUID | None,
        category_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        rows = await self._fetch_entries(user_id, project_id=project_id, category_id=category_id)
        day_start = datetime.combine(day, time.min, tzinfo=tz)
        day_end = day_start + timedelta(days=1)
        series: list[dict[str, Any]] = []
        total_minutes = 0
        for entry, task in rows:
            sliced = _slice_entry_by_local_day(entry, tz)
            sec = sliced.get(day, 0)
            if sec <= 0:
                continue
            s_local = max(day_start, _to_utc(entry.started_at).astimezone(tz))
            e_ref = entry.ended_at or (entry.started_at + timedelta(seconds=entry.duration_seconds))
            e_local = min(day_end, _to_utc(e_ref).astimezone(tz))
            mins = round(sec / 60, 1)
            total_minutes += int(round(sec / 60))
            series.append(
                {
                    "entry_id": str(entry.id),
                    "label": task.title if task else (entry.note or "Focus"),
                    "start_hour": round(s_local.hour + s_local.minute / 60, 2),
                    "end_hour": round(
                        24.0 if e_local == day_end else (e_local.hour + e_local.minute / 60), 2
                    ),
                    "start_time": s_local.strftime("%H:%M"),
                    "end_time": "24:00" if e_local == day_end else e_local.strftime("%H:%M"),
                    "minutes": mins,
                }
            )
        return ChartEnvelopeResponse(
            chart_key="today_daily_timeline",
            space=space,
            timezone=tz_name,
            period={"from": day.isoformat(), "to": day.isoformat()},
            filters_applied=filters_applied,
            data_status="OK" if series else "NO_DATA",
            summary={
                "primary_value": total_minutes,
                "session_count": len(series),
                "unit": "minutes",
            },
            series=series,
        )

    async def _chart_today_completion_ring(
        self,
        user_id: UUID,
        space: str,
        tz_name: str,
        day: date,
        project_id: UUID | None,
        category_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        rows = await self._fetch_occurrences(
            user_id, project_id=project_id, category_id=category_id
        )
        day_occs = [
            occ
            for occ, _ in rows
            if occ.scheduled_date == day and occ.status not in ("SKIPPED", "CANCELLED")
        ]
        total = len(day_occs)
        done = sum(1 for o in day_occs if o.status == "DONE")
        in_prog = sum(1 for o in day_occs if o.status == "IN_PROGRESS")
        not_started = sum(1 for o in day_occs if o.status == "NOT_STARTED")
        rate = round(done / total * 100, 1) if total else None
        return ChartEnvelopeResponse(
            chart_key="today_completion_ring",
            space=space,
            timezone=tz_name,
            period={"from": day.isoformat(), "to": day.isoformat()},
            filters_applied=filters_applied,
            data_status="OK" if total else "NO_DATA",
            summary={"primary_value": rate, "done": done, "total": total, "unit": "%"},
            series=[
                {"label": "DONE", "value": done},
                {"label": "IN_PROGRESS", "value": in_prog},
                {"label": "NOT_STARTED", "value": not_started},
            ],
        )

    async def _chart_today_focus_time(
        self,
        user_id: UUID,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        day: date,
        project_id: UUID | None,
        task_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        rows = await self._fetch_entries(user_id, project_id=project_id, task_id=task_id)
        by_day: dict[date, int] = defaultdict(int)
        for entry, _ in rows:
            for d, sec in _slice_entry_by_local_day(entry, tz).items():
                by_day[d] += sec

        today_min = round(by_day.get(day, 0) / 60)
        series = []
        for offset in range(6, -1, -1):
            d = day - timedelta(days=offset)
            series.append(
                {
                    "label": d.strftime("%d/%m"),
                    "date": d.isoformat(),
                    "value": round(by_day.get(d, 0) / 60),
                }
            )
        prev_avg = round(sum(p["value"] for p in series[:-1]) / 6, 1) if len(series) > 1 else 0.0
        return ChartEnvelopeResponse(
            chart_key="today_focus_time",
            space=space,
            timezone=tz_name,
            period={"from": (day - timedelta(days=6)).isoformat(), "to": day.isoformat()},
            filters_applied=filters_applied,
            data_status="OK" if any(p["value"] > 0 for p in series) else "NO_DATA",
            summary={"primary_value": today_min, "secondary_value": prev_avg, "unit": "minutes"},
            series=series,
        )

    async def _chart_weekly(
        self,
        user_id: UUID,
        chart_key: str,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        start: date,
        end_exclusive: date,
        project_id: UUID | None,
        task_id: UUID | None,
        category_id: UUID | None,
        group_by: str,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        days = [start + timedelta(days=i) for i in range((end_exclusive - start).days)]
        occs = await self._fetch_occurrences(
            user_id, project_id=project_id, task_id=task_id, category_id=category_id
        )

        if chart_key == "weekly_completion":
            series = []
            total_done = 0
            total_elig = 0
            for d in days:
                elig = [
                    o
                    for o, _ in occs
                    if o.scheduled_date == d and o.status not in ("SKIPPED", "CANCELLED")
                ]
                done_c = sum(1 for o in elig if o.status == "DONE")
                total_done += done_c
                total_elig += len(elig)
                series.append(
                    {
                        "label": d.strftime("%a %d/%m"),
                        "date": d.isoformat(),
                        "done": done_c,
                        "total": len(elig),
                    }
                )
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="OK" if total_elig else "NO_DATA",
                summary={
                    "primary_value": total_done,
                    "secondary_value": total_elig,
                    "unit": "tasks",
                },
                series=series,
            )

        if chart_key == "weekly_planned_vs_actual":
            entries = await self._fetch_entries(
                user_id, project_id=project_id, task_id=task_id, category_id=category_id
            )
            actual_sec_by_day: dict[date, int] = defaultdict(int)
            for entry, _ in entries:
                for d, sec in _slice_entry_by_local_day(entry, tz).items():
                    if start <= d < end_exclusive:
                        actual_sec_by_day[d] += sec

            series = []
            tot_planned = 0
            tot_actual = 0
            for d in days:
                planned = sum(
                    (o.estimated_minutes or 0)
                    for o, _ in occs
                    if o.scheduled_date == d and o.status not in ("SKIPPED", "CANCELLED")
                )
                actual = round(actual_sec_by_day.get(d, 0) / 60)
                tot_planned += planned
                tot_actual += actual
                series.append(
                    {
                        "label": d.strftime("%a"),
                        "date": d.isoformat(),
                        "planned": planned,
                        "actual": actual,
                    }
                )
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="OK" if (tot_planned or tot_actual) else "NO_DATA",
                summary={
                    "primary_value": tot_actual,
                    "secondary_value": tot_planned,
                    "unit": "minutes",
                },
                series=series,
            )

        # weekly_workload_distribution
        cat_names = {
            c.id: c.name
            for c in (
                await self.session.execute(select(Category).where(Category.user_id == user_id))
            )
            .scalars()
            .all()
        }
        proj_names = {
            p.id: p.title
            for p in (await self.session.execute(select(Project).where(Project.user_id == user_id)))
            .scalars()
            .all()
        }
        grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "minutes": 0})
        for occ, task in occs:
            if occ.scheduled_date and start <= occ.scheduled_date < end_exclusive:
                if group_by == "category":
                    key = (
                        cat_names.get(task.category_id, "Uncategorized")
                        if task.category_id
                        else "Uncategorized"
                    )
                else:
                    key = (
                        proj_names.get(task.project_id, "No Project")
                        if task.project_id
                        else "No Project"
                    )
                grouped[key]["count"] += 1
                grouped[key]["minutes"] += occ.estimated_minutes or 30
        series = [
            {"label": k, "count": v["count"], "value": v["minutes"]} for k, v in grouped.items()
        ]
        return ChartEnvelopeResponse(
            chart_key=chart_key,
            space=space,
            timezone=tz_name,
            period={
                "from": start.isoformat(),
                "to": (end_exclusive - timedelta(days=1)).isoformat(),
            },
            filters_applied=filters_applied,
            data_status="OK" if series else "NO_DATA",
            summary={"primary_value": sum(i["count"] for i in series), "unit": "tasks"},
            series=series,
        )

    async def _chart_monthly(
        self,
        user_id: UUID,
        chart_key: str,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        start: date,
        end_exclusive: date,
        project_id: UUID | None,
        category_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        days = [start + timedelta(days=i) for i in range((end_exclusive - start).days)]
        if chart_key == "monthly_activity_heatmap":
            daily, _ = await self._compute_daily_activity(
                user_id, tz, project_id=project_id, category_id=category_id
            )
            series = []
            active_days_count = 0
            for d in days:
                info = daily.get(d, {"score": 0, "level": 0, "done_count": 0, "focus_minutes": 0})
                if info["level"] > 0:
                    active_days_count += 1
                series.append(
                    {
                        "date": d.isoformat(),
                        "label": str(d.day),
                        "value": info["score"],
                        "level": info["level"],
                        "done_count": info["done_count"],
                        "focus_minutes": info["focus_minutes"],
                    }
                )
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="OK" if active_days_count else "NO_DATA",
                summary={
                    "primary_value": active_days_count,
                    "total_days": len(days),
                    "unit": "days",
                },
                series=series,
            )

        if chart_key == "monthly_productivity_trend":
            daily, _ = await self._compute_daily_activity(
                user_id, tz, project_id=project_id, category_id=category_id
            )
            series = []
            total_done = 0
            total_min = 0
            for d in days:
                info = daily.get(d, {"done_count": 0, "focus_minutes": 0})
                total_done += info["done_count"]
                total_min += info["focus_minutes"]
                series.append(
                    {
                        "date": d.isoformat(),
                        "label": str(d.day),
                        "done": info["done_count"],
                        "focus_minutes": info["focus_minutes"],
                    }
                )
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="OK" if (total_done or total_min) else "NO_DATA",
                summary={
                    "primary_value": total_done,
                    "secondary_value": total_min,
                    "unit": "tasks",
                },
                series=series,
            )

        # monthly_deadline_performance
        occs = await self._fetch_occurrences(
            user_id, project_id=project_id, category_id=category_id
        )
        on_time = 0
        late = 0
        overdue_open = 0
        now_utc = datetime.now(UTC)
        for occ, _ in occs:
            if occ.due_at is None or occ.status in ("SKIPPED", "CANCELLED"):
                continue
            due_local = _to_utc(occ.due_at).astimezone(tz)
            if not (start <= due_local.date() < end_exclusive):
                continue
            if occ.status == "DONE":
                comp = _to_utc(occ.completed_at) if occ.completed_at else now_utc
                if comp <= _to_utc(occ.due_at):
                    on_time += 1
                else:
                    late += 1
            elif _to_utc(occ.due_at) < now_utc:
                overdue_open += 1
        total_dl = on_time + late + overdue_open
        rate = round(on_time / total_dl * 100, 1) if total_dl else None
        return ChartEnvelopeResponse(
            chart_key=chart_key,
            space=space,
            timezone=tz_name,
            period={
                "from": start.isoformat(),
                "to": (end_exclusive - timedelta(days=1)).isoformat(),
            },
            filters_applied=filters_applied,
            data_status="OK" if total_dl else "NO_DATA",
            summary={"primary_value": rate, "total_deadlines": total_dl, "unit": "%"},
            series=[
                {"label": "ON_TIME", "value": on_time},
                {"label": "LATE", "value": late},
                {"label": "OVERDUE_OPEN", "value": overdue_open},
            ],
        )

    async def _chart_yearly(
        self,
        user_id: UUID,
        chart_key: str,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        start: date,
        end_exclusive: date,
        project_id: UUID | None,
        category_id: UUID | None,
        group_by: str,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        if chart_key == "yearly_activity_heatmap":
            daily, _ = await self._compute_daily_activity(
                user_id, tz, project_id=project_id, category_id=category_id
            )
            series = []
            cursor = start
            active_days_count = 0
            while cursor < end_exclusive:
                info = daily.get(
                    cursor, {"score": 0, "level": 0, "done_count": 0, "focus_minutes": 0}
                )
                if info["level"] > 0:
                    active_days_count += 1
                series.append(
                    {
                        "date": cursor.isoformat(),
                        "weekday": cursor.isoweekday(),
                        "value": info["score"],
                        "level": info["level"],
                        "done_count": info["done_count"],
                        "focus_minutes": info["focus_minutes"],
                    }
                )
                cursor += timedelta(days=1)
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="OK" if active_days_count else "NO_DATA",
                summary={"primary_value": active_days_count, "unit": "days"},
                series=series,
            )

        if chart_key == "yearly_monthly_comparison":
            occs = await self._fetch_occurrences(
                user_id, project_id=project_id, category_id=category_id
            )
            entries = await self._fetch_entries(
                user_id, project_id=project_id, category_id=category_id
            )
            done_m: dict[int, int] = defaultdict(int)
            plan_m: dict[int, int] = defaultdict(int)
            act_sec_m: dict[int, int] = defaultdict(int)
            for occ, _ in occs:
                ref_d = (
                    _to_utc(occ.completed_at).astimezone(tz).date()
                    if occ.completed_at
                    else occ.scheduled_date
                )
                if ref_d and start <= ref_d < end_exclusive:
                    if occ.status == "DONE":
                        done_m[ref_d.month] += 1
                    if occ.status not in ("SKIPPED", "CANCELLED"):
                        plan_m[ref_d.month] += occ.estimated_minutes or 0
            for entry, _ in entries:
                for d, sec in _slice_entry_by_local_day(entry, tz).items():
                    if start <= d < end_exclusive:
                        act_sec_m[d.month] += sec
            series = [
                {
                    "label": f"T{m}",
                    "month": m,
                    "done": done_m[m],
                    "planned_hours": round(plan_m[m] / 60, 1),
                    "actual_hours": round(act_sec_m[m] / 3600, 1),
                }
                for m in range(1, 13)
            ]
            has_data = any(i["done"] > 0 or i["actual_hours"] > 0 for i in series)
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="OK" if has_data else "NO_DATA",
                summary={"primary_value": sum(i["done"] for i in series), "unit": "tasks"},
                series=series,
            )

        # yearly_time_allocation (Donut & Tag/Project breakdown like Ảnh 8)
        entries = await self._fetch_entries(user_id, project_id=project_id, category_id=category_id)
        proj_map = {
            p.id: p.title
            for p in (await self.session.execute(select(Project).where(Project.user_id == user_id)))
            .scalars()
            .all()
        }
        cat_map = {
            c.id: c.name
            for c in (
                await self.session.execute(select(Category).where(Category.user_id == user_id))
            )
            .scalars()
            .all()
        }
        tags_by_task: dict[UUID, list[str]] = defaultdict(list)
        if group_by == "tag":
            tag_rows = (
                await self.session.execute(
                    select(TaskTag.task_id, Tag.name)
                    .join(Tag, TaskTag.tag_id == Tag.id)
                    .where(Tag.user_id == user_id)
                )
            ).all()
            for t_id, t_name in tag_rows:
                tags_by_task[t_id].append(t_name)

        buckets: dict[str, int] = defaultdict(int)
        total_sec = 0
        for entry, task in entries:
            sec_in_year = sum(
                sec
                for d, sec in _slice_entry_by_local_day(entry, tz).items()
                if start <= d < end_exclusive
            )
            if sec_in_year <= 0:
                continue
            total_sec += sec_in_year
            if group_by == "tag" and task is not None:
                tlist = tags_by_task.get(task.id) or ["Untagged"]
                buckets[tlist[0]] += sec_in_year
            elif group_by == "category":
                name = (
                    cat_map.get(task.category_id, "Uncategorized")
                    if (task and task.category_id)
                    else "Uncategorized"
                )
                buckets[name] += sec_in_year
            else:
                name = (
                    proj_map.get(task.project_id, "No Project")
                    if (task and task.project_id)
                    else "No Project"
                )
                buckets[name] += sec_in_year

        series = sorted(
            [
                {
                    "label": k,
                    "minutes": round(sec / 60),
                    "hours": round(sec / 3600, 2),
                }
                for k, sec in buckets.items()
            ],
            key=lambda x: x["minutes"],
            reverse=True,
        )
        return ChartEnvelopeResponse(
            chart_key=chart_key,
            space=space,
            timezone=tz_name,
            period={
                "from": start.isoformat(),
                "to": (end_exclusive - timedelta(days=1)).isoformat(),
            },
            filters_applied=filters_applied,
            data_status="OK" if total_sec > 0 else "NO_DATA",
            summary={
                "primary_value": round(total_sec / 3600, 2),
                "groups": len(series),
                "unit": "hours",
            },
            series=series,
        )

    async def _chart_task_detail(
        self,
        user_id: UUID,
        chart_key: str,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        task_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        occs = await self._fetch_occurrences(user_id, task_id=task_id)
        entries = await self._fetch_entries(user_id, task_id=task_id)
        sec_by_occ: dict[UUID, int] = defaultdict(int)
        for entry, _ in entries:
            if entry.occurrence_id:
                sec_by_occ[entry.occurrence_id] += entry.duration_seconds

        occs_sorted = sorted(
            occs,
            key=lambda pair: (pair[0].scheduled_date or date.min, pair[0].created_at),
        )[-30:]
        if chart_key == "task_execution_history":
            series = [
                {
                    "occurrence_id": str(occ.id),
                    "label": occ.scheduled_date.isoformat()
                    if occ.scheduled_date
                    else occ.recurrence_key,
                    "task_title": task.title,
                    "status": occ.status,
                    "actual_minutes": round(sec_by_occ.get(occ.id, 0) / 60, 1),
                    "value": 1 if occ.status == "DONE" else 0,
                }
                for occ, task in occs_sorted
            ]
            done_cnt = sum(1 for occ, _ in occs_sorted if occ.status == "DONE")
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={"from": None, "to": None},
                filters_applied=filters_applied,
                data_status="OK" if series else "NO_DATA",
                summary={"primary_value": done_cnt, "total": len(series), "unit": "runs"},
                series=series,
            )

        # task_duration_trend
        series = [
            {
                "label": occ.scheduled_date.isoformat() if occ.scheduled_date else task.title[:16],
                "actual_minutes": round(sec_by_occ.get(occ.id, 0) / 60, 1),
                "estimated_minutes": occ.estimated_minutes or task.estimated_minutes,
            }
            for occ, task in occs_sorted
        ]
        avg_min = (
            round(sum(i["actual_minutes"] for i in series) / len(series), 1) if series else 0.0
        )
        return ChartEnvelopeResponse(
            chart_key=chart_key,
            space=space,
            timezone=tz_name,
            period={"from": None, "to": None},
            filters_applied=filters_applied,
            data_status="OK" if series else "NO_DATA",
            summary={"primary_value": avg_min, "unit": "minutes"},
            series=series,
        )

    async def _chart_project(
        self,
        user_id: UUID,
        chart_key: str,
        space: str,
        tz: ZoneInfo,
        tz_name: str,
        project_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        if chart_key == "project_progress":
            occs = await self._fetch_occurrences(user_id, project_id=project_id)
            counts: dict[str, int] = defaultdict(int)
            for occ, _ in occs:
                counts[occ.status] += 1
            elig = sum(v for k, v in counts.items() if k not in ("SKIPPED", "CANCELLED"))
            done = counts.get("DONE", 0)
            pct = round(done / elig * 100, 1) if elig else None
            series = [
                {"label": st, "value": counts.get(st, 0)}
                for st in ("DONE", "IN_PROGRESS", "NOT_STARTED", "SKIPPED", "CANCELLED")
            ]
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={"from": None, "to": None},
                filters_applied=filters_applied,
                data_status="OK" if elig else "NO_DATA",
                summary={"primary_value": pct, "done": done, "eligible": elig, "unit": "%"},
                series=series,
            )

        # project_cumulative_work
        entries = await self._fetch_entries(user_id, project_id=project_id)
        by_day: dict[date, int] = defaultdict(int)
        for entry, _ in entries:
            for d, sec in _slice_entry_by_local_day(entry, tz).items():
                by_day[d] += sec
        cum_sec = 0
        series = []
        for d in sorted(by_day.keys()):
            cum_sec += by_day[d]
            series.append(
                {
                    "date": d.isoformat(),
                    "label": d.strftime("%d/%m"),
                    "daily_minutes": round(by_day[d] / 60, 1),
                    "cumulative_hours": round(cum_sec / 3600, 2),
                }
            )
        return ChartEnvelopeResponse(
            chart_key=chart_key,
            space=space,
            timezone=tz_name,
            period={
                "from": series[0]["date"] if series else None,
                "to": series[-1]["date"] if series else None,
            },
            filters_applied=filters_applied,
            data_status="OK" if series else "NO_DATA",
            summary={"primary_value": round(cum_sec / 3600, 2), "unit": "hours"},
            series=series,
        )

    async def _chart_goal(
        self,
        user_id: UUID,
        chart_key: str,
        space: str,
        tz_name: str,
        goal_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        goal_stmt = select(Goal).where(Goal.user_id == user_id, Goal.archived_at.is_(None))
        if goal_id is not None:
            goal_stmt = goal_stmt.where(Goal.id == goal_id)
        goals_list = (await self.session.execute(goal_stmt)).scalars().all()
        if not goals_list:
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={"from": None, "to": None},
                filters_applied=filters_applied,
                data_status="NO_DATA",
                summary={"primary_value": None, "unit": "%"},
                series=[],
            )

        if chart_key == "goal_milestone_timeline":
            target_ids = [g.id for g in goals_list]
            ms_rows = (
                await self.session.execute(
                    select(goal_milestones)
                    .where(
                        goal_milestones.c.user_id == user_id,
                        goal_milestones.c.goal_id.in_(target_ids),
                    )
                    .order_by(
                        goal_milestones.c.target_date.asc(), goal_milestones.c.sort_order.asc()
                    )
                )
            ).fetchall()
            series = [
                {
                    "id": str(r.id),
                    "label": str(r.title),
                    "target_date": r.target_date.isoformat() if r.target_date else None,
                    "status": str(r.status),
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                }
                for r in ms_rows
            ]
            done_ms = sum(1 for r in ms_rows if r.status == "COMPLETED")
            return ChartEnvelopeResponse(
                chart_key=chart_key,
                space=space,
                timezone=tz_name,
                period={"from": None, "to": None},
                filters_applied=filters_applied,
                data_status="OK" if series else "NO_DATA",
                summary={"primary_value": done_ms, "total": len(series), "unit": "milestones"},
                series=series,
            )

        # goal_progress
        series = []
        for g in goals_list:
            meas = (
                (
                    await self.session.execute(
                        select(goal_measurements.c.measured_value).where(
                            goal_measurements.c.goal_id == g.id,
                            goal_measurements.c.user_id == user_id,
                        )
                    )
                )
                .scalars()
                .all()
            )
            current = float(g.baseline_value) + sum(float(v) for v in meas)
            if not meas:
                links = (
                    (await self.session.execute(select(GoalLink).where(GoalLink.goal_id == g.id)))
                    .scalars()
                    .all()
                )
                p_ids = [lnk.project_id for lnk in links if lnk.project_id]
                if p_ids:
                    occ_st = (
                        (
                            await self.session.execute(
                                select(TaskOccurrence.status)
                                .join(Task, TaskOccurrence.task_id == Task.id)
                                .where(
                                    TaskOccurrence.user_id == user_id,
                                    Task.project_id.in_(p_ids),
                                    TaskOccurrence.status.notin_(["SKIPPED", "CANCELLED"]),
                                )
                            )
                        )
                        .scalars()
                        .all()
                    )
                    if occ_st:
                        current = round(
                            sum(1 for s in occ_st if s == "DONE")
                            / len(occ_st)
                            * float(g.target_value),
                            2,
                        )
            pct = (
                round(min(100.0, max(0.0, current / float(g.target_value) * 100)), 1)
                if g.target_value > 0
                else 0.0
            )
            series.append(
                {
                    "goal_id": str(g.id),
                    "label": g.title,
                    "current_value": current,
                    "target_value": float(g.target_value),
                    "unit": g.metric_unit,
                    "progress_percent": pct,
                }
            )
        avg_pct = (
            round(sum(i["progress_percent"] for i in series) / len(series), 1) if series else None
        )
        return ChartEnvelopeResponse(
            chart_key=chart_key,
            space=space,
            timezone=tz_name,
            period={"from": None, "to": None},
            filters_applied=filters_applied,
            data_status="OK" if series else "NO_DATA",
            summary={"primary_value": avg_pct, "goals_count": len(series), "unit": "%"},
            series=series,
        )

    async def _chart_habits(
        self,
        user_id: UUID,
        space: str,
        tz_name: str,
        today: date,
        start: date,
        end_exclusive: date,
        habit_id: UUID | None,
        filters_applied: dict[str, str | None],
    ) -> ChartEnvelopeResponse:
        h_stmt = select(habits).where(habits.c.user_id == user_id, habits.c.archived_at.is_(None))
        if habit_id is not None:
            h_stmt = h_stmt.where(habits.c.id == habit_id)
        h_rows = (await self.session.execute(h_stmt)).fetchall()
        if not h_rows:
            return ChartEnvelopeResponse(
                chart_key="habit_consistency_heatmap",
                space=space,
                timezone=tz_name,
                period={
                    "from": start.isoformat(),
                    "to": (end_exclusive - timedelta(days=1)).isoformat(),
                },
                filters_applied=filters_applied,
                data_status="NO_DATA",
                summary={"primary_value": 0.0, "unit": "%"},
                series=[],
            )

        log_rows = (
            await self.session.execute(
                select(habit_logs).where(
                    habit_logs.c.user_id == user_id,
                    habit_logs.c.log_date >= today - timedelta(days=90),
                    habit_logs.c.log_date < max(end_exclusive, today + timedelta(days=1)),
                )
            )
        ).fetchall()
        log_map: dict[tuple[UUID, date], str] = {
            (r.habit_id, r.log_date): str(r.status) for r in log_rows
        }

        days = [start + timedelta(days=i) for i in range((end_exclusive - start).days)]
        series = []
        total_completed = 0
        total_eligible = 0
        for h in h_rows:
            cells = []
            h_done = 0
            for d in days:
                st = log_map.get((h.id, d))
                if d < h.starts_on:
                    cell_state = "EXCLUDED"
                elif d > today:
                    cell_state = "FUTURE"
                elif st == "COMPLETED":
                    cell_state = "COMPLETED"
                    h_done += 1
                    total_completed += 1
                    total_eligible += 1
                elif st == "SKIPPED":
                    cell_state = "EXCLUDED"
                else:
                    cell_state = "MISSED"
                    total_eligible += 1
                cells.append({"date": d.isoformat(), "day": d.day, "status": cell_state})
            series.append(
                {
                    "habit_id": str(h.id),
                    "label": str(h.title),
                    "total_done": h_done,
                    "days": cells,
                }
            )
        recovery_rate = round(total_completed / total_eligible * 100, 1) if total_eligible else 0.0
        return ChartEnvelopeResponse(
            chart_key="habit_consistency_heatmap",
            space=space,
            timezone=tz_name,
            period={
                "from": start.isoformat(),
                "to": (end_exclusive - timedelta(days=1)).isoformat(),
            },
            filters_applied=filters_applied,
            data_status="OK" if h_rows else "NO_DATA",
            summary={
                "primary_value": recovery_rate,
                "completed_count": total_completed,
                "eligible_count": total_eligible,
                "unit": "%",
            },
            series=series,
        )
