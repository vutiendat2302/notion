"""Canonical Chart Specification Registry for all 19 dynamic charts."""

from dataclasses import dataclass
from typing import Literal

ChartKey = Literal[
    "today_daily_timeline",
    "today_completion_ring",
    "today_focus_time",
    "weekly_completion",
    "weekly_planned_vs_actual",
    "weekly_workload_distribution",
    "monthly_activity_heatmap",
    "monthly_productivity_trend",
    "monthly_deadline_performance",
    "yearly_activity_heatmap",
    "yearly_monthly_comparison",
    "yearly_time_allocation",
    "task_execution_history",
    "task_duration_trend",
    "project_progress",
    "project_cumulative_work",
    "goal_progress",
    "goal_milestone_timeline",
    "habit_consistency_heatmap",
]


@dataclass(frozen=True)
class ChartSpec:
    chart_key: ChartKey
    space: str
    title_vi: str
    title_en: str
    widget_kind: Literal["METRIC_CARD", "CHART", "HEATMAP", "PROGRESS"]


CHART_SPECS: dict[str, ChartSpec] = {
    "today_daily_timeline": ChartSpec(
        "today_daily_timeline", "TODAY", "Dòng thời gian trong ngày", "Daily Timeline", "CHART"
    ),
    "today_completion_ring": ChartSpec(
        "today_completion_ring",
        "TODAY",
        "Tiến độ task hôm nay",
        "Daily Completion Ring",
        "PROGRESS",
    ),
    "today_focus_time": ChartSpec(
        "today_focus_time", "TODAY", "Phút tập trung hôm nay", "Focus Time", "METRIC_CARD"
    ),
    "weekly_completion": ChartSpec(
        "weekly_completion", "WEEKLY", "Hoàn thành theo tuần", "Weekly Completion", "CHART"
    ),
    "weekly_planned_vs_actual": ChartSpec(
        "weekly_planned_vs_actual", "WEEKLY", "Kế hoạch vs Thực tế", "Planned vs Actual", "CHART"
    ),
    "weekly_workload_distribution": ChartSpec(
        "weekly_workload_distribution",
        "WEEKLY",
        "Phân bổ khối lượng tuần",
        "Workload Distribution",
        "CHART",
    ),
    "monthly_activity_heatmap": ChartSpec(
        "monthly_activity_heatmap",
        "MONTHLY",
        "Heatmap hoạt động tháng",
        "Monthly Activity Heatmap",
        "HEATMAP",
    ),
    "monthly_productivity_trend": ChartSpec(
        "monthly_productivity_trend",
        "MONTHLY",
        "Xu hướng năng suất tháng",
        "Productivity Trend",
        "CHART",
    ),
    "monthly_deadline_performance": ChartSpec(
        "monthly_deadline_performance",
        "MONTHLY",
        "Tỷ lệ hoàn thành đúng hạn",
        "Deadline Performance",
        "CHART",
    ),
    "yearly_activity_heatmap": ChartSpec(
        "yearly_activity_heatmap",
        "YEARLY",
        "Heatmap hoạt động cả năm",
        "Yearly Activity Heatmap",
        "HEATMAP",
    ),
    "yearly_monthly_comparison": ChartSpec(
        "yearly_monthly_comparison", "YEARLY", "So sánh 12 tháng", "Monthly Comparison", "CHART"
    ),
    "yearly_time_allocation": ChartSpec(
        "yearly_time_allocation",
        "YEARLY",
        "Phân bổ thời gian theo lĩnh vực",
        "Time Allocation",
        "CHART",
    ),
    "task_execution_history": ChartSpec(
        "task_execution_history",
        "TASK_DETAIL",
        "Lịch sử thực hiện task",
        "Execution History",
        "CHART",
    ),
    "task_duration_trend": ChartSpec(
        "task_duration_trend",
        "TASK_DETAIL",
        "Thời lượng mỗi lần làm",
        "Duration Trend",
        "CHART",
    ),
    "project_progress": ChartSpec(
        "project_progress", "PROJECT", "Tiến độ dự án", "Project Progress", "PROGRESS"
    ),
    "project_cumulative_work": ChartSpec(
        "project_cumulative_work",
        "PROJECT",
        "Tổng thời gian tích lũy dự án",
        "Cumulative Work",
        "CHART",
    ),
    "goal_progress": ChartSpec(
        "goal_progress", "GOALS", "Tiến độ mục tiêu", "Goal Progress", "PROGRESS"
    ),
    "goal_milestone_timeline": ChartSpec(
        "goal_milestone_timeline",
        "GOALS",
        "Dòng thời gian cột mốc",
        "Milestone Timeline",
        "CHART",
    ),
    "habit_consistency_heatmap": ChartSpec(
        "habit_consistency_heatmap",
        "HABITS",
        "Ma trận đều đặn thói quen",
        "Consistency Heatmap",
        "HEATMAP",
    ),
}
