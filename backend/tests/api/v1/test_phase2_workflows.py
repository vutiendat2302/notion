from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.extended_models import ActivityEvent
from app.modules.tasks.models.checklist import OccurrenceChecklistState
from tests.conftest import TransactionalProxySession


async def auth(client: AsyncClient) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "phase2@example.com",
            "password": "StrongPassword123!",
            "display_name": "Phase 2",
        },
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
async def test_recurrence_generation_edit_and_occurrence_state(
    client: AsyncClient, db_proxy_session: TransactionalProxySession
) -> None:
    headers = await auth(client)
    today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    created = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Daily review",
            "recurrence": {
                "frequency": "DAILY",
                "starts_on": today.isoformat(),
                "default_start_time": "09:00:00",
                "default_duration_minutes": 30,
            },
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    task_id = task["id"]
    assert task["is_recurring"] is True
    assert len(task["occurrences"]) >= 60
    first_id = next(
        item["id"] for item in task["occurrences"] if item["scheduled_date"] == today.isoformat()
    )
    first = next(item for item in task["occurrences"] if item["id"] == first_id)
    assert (
        datetime.fromisoformat(first["start_at"]).astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).hour == 9
    )
    tomorrow_date = (today + timedelta(days=1)).isoformat()
    tomorrow = next(item for item in task["occurrences"] if item["scheduled_date"] == tomorrow_date)
    override = await client.patch(
        f"/api/v1/occurrences/{tomorrow['id']}",
        headers=headers,
        json={"scheduled_date": (today + timedelta(days=5)).isoformat()},
    )
    assert override.status_code == 200
    assert override.json()["is_override"] is True

    preview = await client.get(
        f"/api/v1/tasks/{task_id}/recurrence/preview?count=3", headers=headers
    )
    assert preview.status_code == 200
    assert preview.json()["dates"] == [
        (today + timedelta(days=offset)).isoformat() for offset in range(3)
    ]
    generate = await client.post(
        f"/api/v1/tasks/{task_id}/recurrence/generate",
        params={"through": (today + timedelta(days=65)).isoformat()},
        headers=headers,
    )
    assert generate.status_code == 200, generate.text
    assert generate.json()["generated_count"] == 5
    again = await client.post(
        f"/api/v1/tasks/{task_id}/recurrence/generate",
        params={"through": (today + timedelta(days=65)).isoformat()},
        headers=headers,
    )
    assert again.status_code == 200
    assert again.json()["generated_count"] == 0

    complete = await client.post(f"/api/v1/occurrences/{first_id}/complete", headers=headers)
    assert complete.status_code == 200
    assert complete.json()["status"] == "DONE"
    assert complete.json()["completed_at"] is not None
    duplicate = await client.post(f"/api/v1/tasks/{task_id}/duplicate", headers=headers)
    assert duplicate.status_code == 201
    assert duplicate.json()["occurrences"][0]["status"] == "NOT_STARTED"
    assert duplicate.json()["occurrences"][0]["recurrence_key"] == "ONCE"
    changed = await client.put(
        f"/api/v1/tasks/{task_id}/recurrence/future",
        headers=headers,
        json={
            "frequency": "WEEKLY",
            "weekdays_mask": 1 << today.weekday(),
            "starts_on": today.isoformat(),
            "effective_date": today.isoformat(),
            "expected_rule_version": 1,
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["rule_version"] == 2
    audit_rows = await db_proxy_session.execute(
        select(ActivityEvent).where(ActivityEvent.__table__.c.entity_id == UUID(first_id))
    )
    assert any(row.event_type == "OCCURRENCE_STATUS_CHANGED" for row in audit_rows.scalars())
    history = await client.get(f"/api/v1/tasks/{task_id}/occurrences", headers=headers)
    assert history.status_code == 200
    assert next(item for item in history.json() if item["id"] == first_id)["status"] == "DONE"
    assert any(item["status"] == "NOT_STARTED" for item in history.json())
    assert (
        next(item for item in history.json() if item["id"] == tomorrow["id"])["scheduled_date"]
        == (today + timedelta(days=5)).isoformat()
    )
    assert len({item["recurrence_key"] for item in history.json()}) == len(history.json())
    pause = await client.post(
        f"/api/v1/tasks/{task_id}/recurrence/pause",
        params={"expected_rule_version": 2},
        headers=headers,
    )
    assert pause.status_code == 200
    blocked = await client.post(
        f"/api/v1/tasks/{task_id}/recurrence/generate",
        params={"through": (today + timedelta(days=90)).isoformat()},
        headers=headers,
    )
    assert blocked.status_code == 409
    resume = await client.post(
        f"/api/v1/tasks/{task_id}/recurrence/resume",
        params={"expected_rule_version": 2},
        headers=headers,
    )
    assert resume.status_code == 200
    archived = await client.post(f"/api/v1/tasks/{task_id}/archive", headers=headers)
    assert archived.status_code == 200
    archived_generate = await client.post(
        f"/api/v1/tasks/{task_id}/recurrence/generate",
        params={"through": (today + timedelta(days=90)).isoformat()},
        headers=headers,
    )
    assert archived_generate.status_code == 409
    assert archived_generate.json()["error"]["code"] == "TASK_ARCHIVED"


@pytest.mark.asyncio
async def test_checklist_is_per_occurrence_and_dependency_cycles(
    client: AsyncClient, db_proxy_session: TransactionalProxySession
) -> None:
    headers = await auth(client)
    today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    task = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Practice",
            "recurrence": {"frequency": "DAILY", "starts_on": today.isoformat()},
        },
    )
    assert task.status_code == 201, task.text
    task_id = task.json()["id"]
    occurrences = task.json()["occurrences"]
    item = await client.post(
        f"/api/v1/tasks/{task_id}/checklist",
        headers=headers,
        json={"title": "Review notes"},
    )
    assert item.status_code == 201, item.text
    item_id = item.json()["id"]
    tick = await client.put(
        f"/api/v1/occurrences/{occurrences[0]['id']}/checklist/{item_id}",
        headers=headers,
        json={"is_checked": True},
    )
    assert tick.status_code == 200
    assert tick.json()["is_checked"] is True
    other = await client.get(
        f"/api/v1/occurrences/{occurrences[1]['id']}/checklist", headers=headers
    )
    assert other.status_code == 200
    assert other.json()[0]["is_checked"] is False
    archive = await client.patch(
        f"/api/v1/tasks/{task_id}/checklist/{item_id}",
        headers=headers,
        json={"archived": True},
    )
    assert archive.status_code == 200
    assert archive.json()["archived_at"] is not None
    historical_state = await db_proxy_session.execute(
        select(OccurrenceChecklistState).where(
            OccurrenceChecklistState.occurrence_id == UUID(occurrences[0]["id"]),
            OccurrenceChecklistState.checklist_item_id == UUID(item_id),
        )
    )
    assert historical_state.scalar_one().is_checked is True

    second = await client.post("/api/v1/tasks", headers=headers, json={"title": "Second"})
    third = await client.post("/api/v1/tasks", headers=headers, json={"title": "Third"})
    a, b, c = task_id, second.json()["id"], third.json()["id"]
    edge_ab = await client.post(
        f"/api/v1/tasks/{b}/dependencies", headers=headers, json={"blocking_task_id": a}
    )
    assert edge_ab.status_code == 201, edge_ab.text
    edge_bc = await client.post(
        f"/api/v1/tasks/{c}/dependencies", headers=headers, json={"blocking_task_id": b}
    )
    assert edge_bc.status_code == 201
    cycle = await client.post(
        f"/api/v1/tasks/{a}/dependencies", headers=headers, json={"blocking_task_id": c}
    )
    assert cycle.status_code == 409
    self_cycle = await client.patch(
        f"/api/v1/tasks/{a}", headers=headers, json={"parent_task_id": a}
    )
    assert self_cycle.status_code == 409
    parent = await client.patch(f"/api/v1/tasks/{b}", headers=headers, json={"parent_task_id": a})
    assert parent.status_code == 200
    project = await client.post("/api/v1/projects", headers=headers, json={"title": "New project"})
    assert project.status_code == 201
    assign_parent = await client.patch(
        f"/api/v1/tasks/{a}", headers=headers, json={"project_id": project.json()["id"]}
    )
    assert assign_parent.status_code == 200
    inherited = await client.post(
        f"/api/v1/tasks/{a}/subtasks", headers=headers, json={"title": "Inherited"}
    )
    assert inherited.status_code == 201
    assert inherited.json()["project_id"] == project.json()["id"]
    moved = await client.patch(
        f"/api/v1/tasks/{b}", headers=headers, json={"project_id": project.json()["id"]}
    )
    assert moved.status_code == 200
    assert moved.json()["parent_task_id"] == a
    assert moved.json()["project_id"] == project.json()["id"]
    nested_cycle = await client.patch(
        f"/api/v1/tasks/{a}", headers=headers, json={"parent_task_id": b}
    )
    assert nested_cycle.status_code == 409
    remove = await client.delete(
        f"/api/v1/tasks/{b}/dependencies/{edge_ab.json()['id']}", headers=headers
    )
    assert remove.status_code == 204


@pytest.mark.asyncio
async def test_task_progress_duplicate_archive_and_partial_patch(client: AsyncClient) -> None:
    headers = await auth(client)
    categories = await client.get("/api/v1/categories", headers=headers)
    assert [(item["name"], item["accent_token"]) for item in categories.json()] == [
        ("Study", "LAVENDER"),
        ("Habit", "SAGE"),
        ("Personal", "PEACH"),
        ("Goals", "ROSE"),
        ("Attention", "BUTTER"),
        ("Schedule", "SKY"),
    ]
    category_id = categories.json()[0]["id"]
    category_detail = await client.get(f"/api/v1/categories/{category_id}", headers=headers)
    assert category_detail.status_code == 200
    category_archive = await client.delete(f"/api/v1/categories/{category_id}", headers=headers)
    assert category_archive.status_code == 204
    assert (await client.get("/api/v1/categories", headers=headers)).json()[0]["name"] == "Habit"
    project = await client.post(
        "/api/v1/projects", headers=headers, json={"title": "Phase 2 project"}
    )
    assert project.status_code == 201
    project_id = project.json()["id"]
    assert (await client.get(f"/api/v1/projects/{project_id}", headers=headers)).status_code == 200
    deleted_project = await client.delete(f"/api/v1/projects/{project_id}", headers=headers)
    assert deleted_project.status_code == 204
    today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    task = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "One off", "scheduled_date": today.isoformat()},
    )
    assert task.status_code == 201
    task_id = task.json()["id"]
    occurrence_id = task.json()["occurrences"][0]["id"]
    empty = await client.get(f"/api/v1/tasks/{task_id}/progress", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["eligible_count"] == 1
    assert empty.json()["completion_rate"] == 0
    future_task = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Future", "scheduled_date": (today + timedelta(days=1)).isoformat()},
    )
    assert future_task.status_code == 201
    future_progress = await client.get(
        f"/api/v1/tasks/{future_task.json()['id']}/progress", headers=headers
    )
    assert future_progress.json()["future_excluded_count"] == 1
    assert future_progress.json()["completion_rate"] is None
    converted = await client.post(
        f"/api/v1/tasks/{future_task.json()['id']}/recurrence",
        headers=headers,
        json={"frequency": "WEEKLY", "starts_on": today.isoformat()},
    )
    assert converted.status_code == 201, converted.text
    converted_task = await client.get(f"/api/v1/tasks/{future_task.json()['id']}", headers=headers)
    assert converted_task.json()["is_recurring"] is True
    assert all(item["recurrence_key"] != "ONCE" for item in converted_task.json()["occurrences"])
    duplicate_rule = await client.post(
        f"/api/v1/tasks/{future_task.json()['id']}/recurrence",
        headers=headers,
        json={"frequency": "DAILY", "starts_on": today.isoformat()},
    )
    assert duplicate_rule.status_code == 409
    recurring = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Recurring comparison",
            "recurrence": {"frequency": "DAILY", "starts_on": today.isoformat()},
        },
    )
    assert recurring.status_code == 201
    recurring_progress = await client.get(
        f"/api/v1/tasks/{recurring.json()['id']}/progress", headers=headers
    )
    assert recurring_progress.status_code == 200
    assert recurring_progress.json()["metric_type"] == empty.json()["metric_type"]
    assert recurring_progress.json()["policy"] == empty.json()["policy"]
    assert recurring_progress.json()["eligible_count"] == 1
    skip = await client.post(f"/api/v1/occurrences/{occurrence_id}/skip", headers=headers)
    assert skip.status_code == 200
    skipped = await client.get(f"/api/v1/tasks/{task_id}/progress", headers=headers)
    assert skipped.json()["skipped_count"] == 1
    assert skipped.json()["eligible_count"] == 1
    cancel = await client.post(f"/api/v1/occurrences/{occurrence_id}/cancel", headers=headers)
    assert cancel.status_code == 409
    reopen = await client.post(f"/api/v1/occurrences/{occurrence_id}/reopen", headers=headers)
    assert reopen.status_code == 200
    cancel = await client.post(f"/api/v1/occurrences/{occurrence_id}/cancel", headers=headers)
    assert cancel.status_code == 200
    cancelled = await client.get(f"/api/v1/tasks/{task_id}/progress", headers=headers)
    assert cancelled.json()["eligible_count"] == 0
    assert cancelled.json()["cancelled_count"] == 1
    assert cancelled.json()["completion_rate"] is None
    copy = await client.post(f"/api/v1/tasks/{task_id}/duplicate", headers=headers)
    assert copy.status_code == 201
    assert copy.json()["occurrences"][0]["status"] == "NOT_STARTED"
    assert copy.json()["occurrences"][0]["scheduled_date"] is None
    archived = await client.post(f"/api/v1/tasks/{task_id}/archive", headers=headers)
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None
    restored = await client.post(f"/api/v1/tasks/{task_id}/restore", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["occurrences"][0]["status"] == "CANCELLED"
    unknown = await client.patch(f"/api/v1/tasks/{task_id}", headers=headers, json={"unknown": 1})
    assert unknown.status_code == 422
