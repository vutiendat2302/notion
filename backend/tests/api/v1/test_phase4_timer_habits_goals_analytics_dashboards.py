from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.modules.analytics.domain.chart_specs import CHART_SPECS
from app.modules.time_tracking.models.time_entry import TimeEntry
from tests.conftest import TransactionalProxySession


@pytest.mark.asyncio
async def test_focus_timer_habits_goals_19_charts_and_blank_dashboard(
    client: AsyncClient,
    db_proxy_session: TransactionalProxySession,
) -> None:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "phase4_user",
            "display_name": "Phase 4 User",
            "email": "phase4@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    user_id = UUID(reg.json()["user"]["id"])

    # 1. Dashboard default starts as Blank Canvas (0 widgets)
    dash = await client.get("/api/v1/dashboards/default", headers=headers)
    assert dash.status_code == 200
    assert dash.json()["widgets"] == []

    # 2. Quick start timer with 2h planned countdown + quick task for today
    start = await client.post(
        "/api/v1/time-entries/start",
        headers=headers,
        json={
            "quick_task_title": "Deep Work Focus",
            "planned_duration_seconds": 7200,
        },
    )
    assert start.status_code == 201
    entry_id = UUID(start.json()["id"])
    occ_id = start.json()["occurrence_id"]
    assert occ_id is not None

    # Second concurrent start without stop_existing -> 409 ACTIVE_TIMER_EXISTS
    dup_start = await client.post(
        "/api/v1/time-entries/start",
        headers=headers,
        json={"planned_duration_seconds": 1500},
    )
    assert dup_start.status_code == 409
    assert dup_start.json()["error"]["code"] == "ACTIVE_TIMER_EXISTS"

    # Pause -> Resume -> Complete without marking task DONE
    pause = await client.post(f"/api/v1/time-entries/{entry_id}/pause", headers=headers)
    assert pause.status_code == 200
    assert pause.json()["status"] == "PAUSED"

    resume = await client.post(f"/api/v1/time-entries/{entry_id}/resume", headers=headers)
    assert resume.status_code == 200
    assert resume.json()["status"] == "RUNNING"

    complete = await client.post(
        f"/api/v1/time-entries/{entry_id}/complete",
        headers=headers,
        json={"mark_occurrence_done": False},
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "COMPLETED"
    # Planned 7200s must NOT become actual duration_seconds
    assert complete.json()["duration_seconds"] < 7200

    occ_check = await client.get(f"/api/v1/occurrences/{occ_id}", headers=headers)
    assert occ_check.status_code == 200
    assert occ_check.json()["status"] == "IN_PROGRESS"

    # Simulate midnight-crossing entry in Asia/Ho_Chi_Minh (16:30Z..17:30Z = 23:30..00:30 local)
    await db_proxy_session.execute(
        update(TimeEntry)
        .where(TimeEntry.id == entry_id)
        .values(
            started_at=datetime(2026, 11, 20, 16, 30, tzinfo=UTC),
            ended_at=datetime(2026, 11, 20, 17, 30, tzinfo=UTC),
            duration_seconds=3600,
        )
    )

    # 3. Create quick 3-field DONE task + project + habit + goal + milestone
    proj = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"title": "Focus Project", "status": "ACTIVE"},
    )
    assert proj.status_code == 201
    project_id = proj.json()["id"]

    quick_done = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Done Quick Task",
            "scheduled_date": "2026-11-22",
            "status": "DONE",
            "project_id": project_id,
            "estimated_minutes": 45,
        },
    )
    assert quick_done.status_code == 201
    task_id = quick_done.json()["id"]
    assert quick_done.json()["occurrences"][0]["status"] == "DONE"

    habit = await client.post(
        "/api/v1/habits",
        headers=headers,
        json={"title": "Read 20 pages", "starts_on": "2026-11-01"},
    )
    assert habit.status_code == 201
    habit_id = habit.json()["id"]
    h_log = await client.post(
        f"/api/v1/habits/{habit_id}/logs",
        headers=headers,
        json={"log_date": "2026-11-22", "status": "COMPLETED"},
    )
    assert h_log.status_code == 200

    goal = await client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "title": "Finish MVP",
            "goal_type": "MILESTONE_BASED",
            "target_value": 100,
            "start_date": "2026-11-01",
            "end_date": "2026-12-31",
        },
    )
    assert goal.status_code == 201
    goal_id = goal.json()["id"]
    ms = await client.post(
        f"/api/v1/goals/{goal_id}/milestones",
        headers=headers,
        json={"title": "Release Alpha", "target_date": "2026-11-25"},
    )
    assert ms.status_code == 201
    ms_patch = await client.patch(
        f"/api/v1/goals/{goal_id}/milestones/{ms.json()['id']}",
        headers=headers,
        json={"status": "COMPLETED"},
    )
    assert ms_patch.status_code == 200

    # 4. Streak & all 19 charts respond 200 with midnight split verified
    streak = await client.get("/api/v1/analytics/streak", headers=headers)
    assert streak.status_code == 200
    assert streak.json()["total_active_days"] >= 2
    assert "2026-11-20" in streak.json()["active_dates"]
    assert "2026-11-21" in streak.json()["active_dates"]

    timeline_day2 = await client.get(
        "/api/v1/analytics/charts/today_daily_timeline?date=2026-11-21",
        headers=headers,
    )
    assert timeline_day2.status_code == 200
    assert timeline_day2.json()["summary"]["primary_value"] == 30

    catalog = await client.get("/api/v1/analytics/charts", headers=headers)
    assert catalog.status_code == 200
    assert len(catalog.json()) == 19

    for key in CHART_SPECS:
        resp = await client.get(
            f"/api/v1/analytics/charts/{key}",
            headers=headers,
            params={
                "date": "2026-11-22",
                "project_id": project_id,
                "task_id": task_id,
                "goal_id": goal_id,
                "habit_id": habit_id,
            },
        )
        assert resp.status_code == 200, f"Chart failed: {key} -> {resp.text}"
        assert resp.json()["chart_key"] == key

    # 5. Add, update, and delete dashboard widget + style
    add_w = await client.post(
        "/api/v1/dashboards/default/widgets",
        headers=headers,
        json={
            "widget_kind": "HEATMAP",
            "title": "Yearly Heatmap",
            "spec_json": {"chart_key": "yearly_activity_heatmap", "filters": {}},
            "width": 12,
            "height": 4,
        },
    )
    assert add_w.status_code == 201
    widget_id = add_w.json()["id"]
    style_patch = await client.patch(
        "/api/v1/dashboards/default",
        headers=headers,
        json={"style_config": {"card_style": "bordered", "canvas_width": "wide"}},
    )
    assert style_patch.status_code == 200
    assert style_patch.json()["style_config"]["card_style"] == "bordered"
    assert len(style_patch.json()["widgets"]) == 1

    del_w = await client.delete(f"/api/v1/dashboards/default/widgets/{widget_id}", headers=headers)
    assert del_w.status_code == 204

    # 6. Multi-page custom Notion pages CRUD + widget persistence
    create_page = await client.post(
        "/api/v1/dashboards",
        headers=headers,
        json={"title": "Weekly Workspace"},
    )
    assert create_page.status_code == 201
    page_id = create_page.json()["id"]

    add_page_w = await client.post(
        f"/api/v1/dashboards/{page_id}/widgets",
        headers=headers,
        json={
            "widget_kind": "METRIC_CARD",
            "title": "Page Heading",
            "spec_json": {"preset_type": "TITLE", "content": "Weekly Workspace", "align": "center"},
            "width": 12,
            "height": 1,
        },
    )
    assert add_page_w.status_code == 201
    assert add_page_w.json()["spec_json"]["align"] == "center"

    list_pages = await client.get("/api/v1/dashboards", headers=headers)
    assert list_pages.status_code == 200
    assert any(p["id"] == page_id for p in list_pages.json())

    del_page = await client.delete(f"/api/v1/dashboards/{page_id}", headers=headers)
    assert del_page.status_code == 204

    # 7. AI Agent preference & API key masking on /users/me/settings
    ai_patch = await client.patch(
        "/api/v1/users/me/settings",
        headers=headers,
        json={
            "preferences_json": {
                "ai": {
                    "preferred_agent": "claude",
                    "claude_api_key": "sk-ant-test-secret-9876",
                }
            }
        },
    )
    assert ai_patch.status_code == 200
    ai_resp = ai_patch.json()["preferences_json"]["ai"]
    assert ai_resp["preferred_agent"] == "claude"
    assert ai_resp["has_claude_key"] is True
    assert ai_resp["claude_key_hint"] == "••••9876"
    assert "claude_api_key" not in ai_resp

    assert user_id is not None
    assert timedelta(days=1).days == 1
