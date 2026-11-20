from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.modules.planning.models.planning_period import PlanningPeriod
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.tasks.repositories.task_repository import TaskRepository
from app.modules.users.models.user import User
from tests.conftest import TransactionalProxySession


async def owner(client: AsyncClient) -> tuple[dict[str, str], UUID]:
    response = await client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "phase3@example.com",
            "password": "StrongPassword123!",
            "display_name": "Phase 3",
        },
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, UUID(
        response.json()["user"]["id"]
    )


@pytest.mark.asyncio
async def test_saved_plan_items_overview_and_owner_boundary(
    client: AsyncClient, db_proxy_session: TransactionalProxySession
) -> None:
    headers, user_id = await owner(client)
    path = "/api/v1/planning/periods/WEEK/2026-W49"
    empty = await client.get(path, headers=headers)
    assert empty.status_code == 200, empty.text
    assert empty.json()["saved_plan"] is None
    assert empty.json()["start_date"] == "2026-11-30"
    assert empty.json()["end_date_exclusive"] == "2026-12-07"
    assert (
        await db_proxy_session.execute(select(func.count()).select_from(PlanningPeriod))
    ).scalar_one() == 0
    changed_week = await client.patch(
        "/api/v1/users/me/settings", headers=headers, json={"week_starts_on": 7}
    )
    assert changed_week.status_code == 200
    sunday_view = await client.get(path, headers=headers)
    assert sunday_view.json()["start_date"] == "2026-11-29"
    assert sunday_view.json()["end_date_exclusive"] == "2026-12-06"
    await client.patch("/api/v1/users/me/settings", headers=headers, json={"week_starts_on": 1})

    task = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Plan once",
            "scheduled_date": "2026-12-01",
            "due_at": "2026-12-01T08:00:00+07:00",
            "estimated_minutes": 45,
        },
    )
    assert task.status_code == 201, task.text
    task_id = task.json()["id"]
    occurrence_id = task.json()["occurrences"][0]["id"]
    overview = await client.get(path, headers=headers)
    assert [item["id"] for item in overview.json()["occurrences"]] == [occurrence_id]
    assert overview.json()["planned_focus_minutes"] == 45
    assert overview.json()["focus_unit"] == "minutes"

    saved = await client.put(
        path + "/plan",
        headers=headers,
        json={
            "title": "Weekly focus",
            "focus_summary": "Top three",
            "notes": "Review",
            "status": "ACTIVE",
        },
    )
    assert saved.status_code == 200, saved.text
    plan_id = saved.json()["id"]
    assert saved.json()["version"] == 1
    stale = await client.put(path + "/plan", headers=headers, json={"expected_version": 9})
    assert stale.status_code == 409
    updated = await client.put(
        path + "/plan",
        headers=headers,
        json={"title": "Changed", "status": "ACTIVE", "expected_version": 1},
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2

    item = await client.post(
        f"/api/v1/planning/plans/{plan_id}/items",
        headers=headers,
        json={"target_type": "OCCURRENCE", "target_id": occurrence_id, "priority_rank": 3},
    )
    assert item.status_code == 201, item.text
    item_id = item.json()["id"]
    assert item.json()["target_key"] == f"OCC:{occurrence_id}"
    duplicate = await client.post(
        f"/api/v1/planning/plans/{plan_id}/items",
        headers=headers,
        json={"target_type": "OCCURRENCE", "target_id": occurrence_id},
    )
    assert duplicate.status_code == 409
    patched = await client.patch(
        f"/api/v1/planning/plans/{plan_id}/items/{item_id}",
        headers=headers,
        json={"priority_rank": 1, "commitment": "OPTIONAL"},
    )
    assert patched.status_code == 200
    assert patched.json()["commitment"] == "OPTIONAL"

    foreign = User(
        email="foreign@example.com",
        email_normalized="foreign@example.com",
        password_hash="not-used",
        display_name="Foreign",
    )
    db_proxy_session.add(foreign)
    await db_proxy_session.flush()
    foreign_task = Task(user_id=foreign.id, title="Private", priority="MEDIUM")
    db_proxy_session.add(foreign_task)
    await db_proxy_session.flush()
    foreign_occurrence = TaskOccurrence(
        user_id=foreign.id,
        task_id=foreign_task.id,
        recurrence_key="ONCE",
        scheduled_date=date(2026, 12, 1),
        start_at=datetime(2026, 12, 1, 9, tzinfo=ZoneInfo("Asia/Ho_Chi_Minh")),
        end_at=datetime(2026, 12, 1, 10, tzinfo=ZoneInfo("Asia/Ho_Chi_Minh")),
        status="NOT_STARTED",
    )
    db_proxy_session.add(foreign_occurrence)
    await db_proxy_session.flush()
    forbidden = await client.post(
        f"/api/v1/planning/plans/{plan_id}/items",
        headers=headers,
        json={"target_type": "TASK", "target_id": str(foreign_task.id)},
    )
    assert forbidden.status_code == 404
    scoped_overview = (await client.get(path, headers=headers)).json()
    assert scoped_overview["plan_items"][0]["id"] == item_id
    assert [item["id"] for item in scoped_overview["occurrences"]] == [occurrence_id]
    scoped_calendar = await client.get(
        "/api/v1/calendar/events?start=2026-12-01&end=2026-12-02", headers=headers
    )
    assert all(item["title"] != "Private" for item in scoped_calendar.json()["timed_occurrences"])
    hidden_exclusion = await client.get(
        "/api/v1/calendar/conflicts",
        headers=headers,
        params={
            "start_at": "2026-12-01T09:00:00+07:00",
            "end_at": "2026-12-01T10:00:00+07:00",
            "exclude_occurrence_id": str(foreign_occurrence.id),
        },
    )
    assert hidden_exclusion.status_code == 404
    removed = await client.delete(
        f"/api/v1/planning/plans/{plan_id}/items/{item_id}", headers=headers
    )
    assert removed.status_code == 204
    assert (await client.get(path, headers=headers)).json()["plan_items"] == []
    assert task_id != str(user_id)


@pytest.mark.asyncio
async def test_rollover_pin_reschedule_idempotency_and_stale_version(client: AsyncClient) -> None:
    headers, _ = await owner(client)
    task = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Cross-year work",
            "scheduled_date": "2026-12-29",
            "start_at": "2026-12-29T09:00:00+07:00",
            "end_at": "2026-12-29T10:00:00+07:00",
        },
    )
    assert task.status_code == 201, task.text
    occurrence = task.json()["occurrences"][0]
    finished = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Already done", "scheduled_date": "2026-12-30"},
    )
    assert finished.status_code == 201
    finished_id = finished.json()["occurrences"][0]["id"]
    assert (
        await client.post(f"/api/v1/occurrences/{finished_id}/complete", headers=headers)
    ).status_code == 200
    preview_path = "/api/v1/planning/periods/WEEK/2026-W53/rollover/preview"
    preview = await client.post(preview_path, headers=headers, json={"action": "PIN"})
    assert preview.status_code == 200, preview.text
    assert preview.json()["target_period_key"] == "2027-W01"
    assert [item["occurrence_id"] for item in preview.json()["candidates"]] == [occurrence["id"]]
    body = {
        "source_period_type": "WEEK",
        "source_period_key": "2026-W53",
        "action": "PIN",
        "items": [{"occurrence_id": occurrence["id"], "expected_version": occurrence["version"]}],
    }
    invalid_key = await client.post(
        "/api/v1/planning/rollovers/confirm",
        headers={**headers, "Idempotency-Key": "        "},
        json=body,
    )
    assert invalid_key.status_code == 422
    key_headers = {**headers, "Idempotency-Key": "phase3-rollover-pin-001"}
    confirmed = await client.post(
        "/api/v1/planning/rollovers/confirm", headers=key_headers, json=body
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["processed_count"] == 1
    replay = await client.post("/api/v1/planning/rollovers/confirm", headers=key_headers, json=body)
    assert replay.status_code == 200, replay.text
    assert replay.json()["replayed"] is True
    changed_payload = {**body, "action": "RESCHEDULE"}
    reused = await client.post(
        "/api/v1/planning/rollovers/confirm", headers=key_headers, json=changed_payload
    )
    assert reused.status_code == 409
    target = await client.get("/api/v1/planning/periods/WEEK/2027-W01", headers=headers)
    assert len(target.json()["plan_items"]) == 1
    unchanged = await client.get(f"/api/v1/occurrences/{occurrence['id']}", headers=headers)
    assert unchanged.json()["scheduled_date"] == "2026-12-29"

    move = await client.post(
        "/api/v1/planning/rollovers/confirm",
        headers={**headers, "Idempotency-Key": "phase3-rollover-move-001"},
        json=changed_payload,
    )
    assert move.status_code == 200, move.text
    after = await client.get(f"/api/v1/occurrences/{occurrence['id']}", headers=headers)
    assert after.json()["scheduled_date"] == "2027-01-04"
    assert (
        datetime.fromisoformat(after.json()["start_at"])
        .astimezone(ZoneInfo("Asia/Ho_Chi_Minh"))
        .hour
        == 9
    )
    stale = await client.post(
        "/api/v1/planning/rollovers/confirm",
        headers={**headers, "Idempotency-Key": "phase3-rollover-stale-001"},
        json=body,
    )
    assert stale.status_code == 409
    original_task = await client.get(f"/api/v1/tasks/{task.json()['id']}", headers=headers)
    assert len(original_task.json()["occurrences"]) == 1


@pytest.mark.asyncio
async def test_calendar_projection_conflicts_and_today_dedup(
    client: AsyncClient, db_proxy_session: TransactionalProxySession
) -> None:
    headers, user_id = await owner(client)
    timed = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Timed",
            "scheduled_date": "2026-12-01",
            "start_at": "2026-12-01T09:00:00+07:00",
            "end_at": "2026-12-01T10:00:00+07:00",
            "due_at": "2026-12-01T17:00:00+07:00",
        },
    )
    assert timed.status_code == 201, timed.text
    timed_id = timed.json()["occurrences"][0]["id"]
    all_day = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "All day", "scheduled_date": "2026-12-01"},
    )
    assert all_day.status_code == 201
    due_only = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Due only", "due_at": "2026-12-01T13:00:00+07:00"},
    )
    assert due_only.status_code == 201
    calendar = await client.get(
        "/api/v1/calendar/events?start=2026-12-01&end=2026-12-02", headers=headers
    )
    assert calendar.status_code == 200, calendar.text
    assert [x["title"] for x in calendar.json()["timed_occurrences"]] == ["Timed"]
    assert [x["title"] for x in calendar.json()["all_day_occurrences"]] == ["All day"]
    assert {x["title"] for x in calendar.json()["due_markers"]} == {"Timed", "Due only"}

    overlap = await client.get(
        "/api/v1/calendar/conflicts",
        headers=headers,
        params={"start_at": "2026-12-01T09:30:00+07:00", "end_at": "2026-12-01T10:30:00+07:00"},
    )
    assert overlap.status_code == 200
    assert [x["occurrence_id"] for x in overlap.json()["conflicts"]] == [timed_id]
    adjacent = await client.get(
        "/api/v1/calendar/conflicts",
        headers=headers,
        params={"start_at": "2026-12-01T10:00:00+07:00", "end_at": "2026-12-01T11:00:00+07:00"},
    )
    assert adjacent.json()["has_conflict"] is False
    excluded = await client.get(
        "/api/v1/calendar/conflicts",
        headers=headers,
        params={
            "start_at": "2026-12-01T09:30:00+07:00",
            "end_at": "2026-12-01T10:30:00+07:00",
            "exclude_occurrence_id": timed_id,
        },
    )
    assert excluded.json()["has_conflict"] is False
    assert (
        await client.get("/api/v1/calendar/events?start=2026-12-02&end=2026-12-01", headers=headers)
    ).status_code == 422
    client.cookies.clear()
    assert (
        await client.get("/api/v1/calendar/events?start=2026-12-01&end=2026-12-02")
    ).status_code == 401

    repo = TaskRepository(db_proxy_session)
    fixed_today = date(2026, 12, 1)
    end_utc = datetime.combine(
        fixed_today + timedelta(days=1), time.min, ZoneInfo("Asia/Ho_Chi_Minh")
    ).astimezone(UTC)
    rows, total = await repo.list_occurrences(
        user_id, scope="today", local_today=fixed_today, local_end_utc=end_utc
    )
    ids = [item.id for item in rows]
    assert total == 3
    assert len(ids) == len(set(ids))
    assert UUID(due_only.json()["occurrences"][0]["id"]) in ids
