from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.core.security import hash_password
from app.modules.users.models.user import User, UserSettings
from tests.conftest import TransactionalProxySession


@pytest.mark.asyncio
async def test_health_and_system_info(client: AsyncClient) -> None:
    live_res = await client.get("/health/live")
    assert live_res.status_code == 200
    assert live_res.json() == {"status": "alive"}
    assert "X-Request-ID" in live_res.headers

    ready_res = await client.get("/health/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"

    info_res = await client.get("/api/v1/system/info")
    assert info_res.status_code == 200
    assert info_res.json()["default_timezone"] == "Asia/Ho_Chi_Minh"


@pytest.mark.asyncio
async def test_bootstrap_login_refresh_reuse_and_settings(client: AsyncClient) -> None:
    # 1. Bootstrap owner account (runs inside rolled-back proxy transaction)
    boot_res = await client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "owner@example.com",
            "password": "StrongPassword123!",
            "display_name": "Test Owner",
        },
    )
    assert boot_res.status_code == 201
    boot_data = boot_res.json()
    access_token = boot_data["access_token"]
    refresh_token_1 = boot_data["refresh_token"]
    assert boot_data["user"]["email"] == "owner@example.com"
    assert boot_data["user"]["settings"]["timezone"] == "Asia/Ho_Chi_Minh"

    # 2. Second bootstrap must be rejected (409)
    boot_again = await client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "attacker@example.com",
            "password": "StrongPassword123!",
            "display_name": "Attacker",
        },
    )
    assert boot_again.status_code == 409
    assert boot_again.json()["error"]["code"] == "BOOTSTRAP_ALREADY_COMPLETED"

    # 3. Get profile & partial patch settings
    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["display_name"] == "Test Owner"

    patch_res = await client.patch(
        "/api/v1/users/me/settings",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"theme": "DARK"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["theme"] == "DARK"
    assert patch_res.json()["timezone"] == "Asia/Ho_Chi_Minh"

    # 4. Refresh token rotation & reuse detection
    ref_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token_1},
    )
    assert ref_res.status_code == 200
    refresh_token_2 = ref_res.json()["refresh_token"]
    assert refresh_token_2 != refresh_token_1

    # Replaying refresh_token_1 must trigger reuse detection and revoke family
    replay_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token_1},
    )
    assert replay_res.status_code == 401
    assert replay_res.json()["error"]["code"] == "REFRESH_TOKEN_REUSED"

    # Subsequent attempt with refresh_token_2 must also fail because family was revoked
    revoked_family_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token_2},
    )
    assert revoked_family_res.status_code == 401


@pytest.mark.asyncio
async def test_tasks_occurrences_partial_patch_and_owner_isolation(
    client: AsyncClient,
    db_proxy_session: TransactionalProxySession,
) -> None:
    # Bootstrap User A
    boot_a = await client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "usera@example.com",
            "password": "StrongPassword123!",
            "display_name": "User A",
        },
    )
    assert boot_a.status_code == 201
    token_a = boot_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Default categories seeded on bootstrap
    cats_res = await client.get("/api/v1/categories", headers=headers_a)
    assert cats_res.status_code == 200
    categories = cats_res.json()
    assert len(categories) >= 5
    cat_id = categories[0]["id"]

    # Create project
    proj_res = await client.post(
        "/api/v1/projects",
        headers=headers_a,
        json={"title": "IELTS 7.5", "category_id": cat_id},
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # Blank title must fail validation
    blank_res = await client.post(
        "/api/v1/tasks",
        headers=headers_a,
        json={"title": "   "},
    )
    assert blank_res.status_code == 422

    # Quick create task (title-only -> Inbox unscheduled, auto default occurrence 'ONCE')
    inbox_task_res = await client.post(
        "/api/v1/tasks",
        headers=headers_a,
        json={"title": "Đọc tài liệu FastAPI"},
    )
    assert inbox_task_res.status_code == 201
    inbox_task = inbox_task_res.json()
    assert inbox_task["title"] == "Đọc tài liệu FastAPI"
    assert len(inbox_task["occurrences"]) == 1
    assert inbox_task["occurrences"][0]["recurrence_key"] == "ONCE"
    assert inbox_task["occurrences"][0]["scheduled_date"] is None
    assert inbox_task["occurrences"][0]["status"] == "NOT_STARTED"

    # Create scheduled task for today
    today_iso = date.today().isoformat()
    today_task_res = await client.post(
        "/api/v1/tasks",
        headers=headers_a,
        json={
            "title": "Luyện IELTS Listening",
            "project_id": project_id,
            "category_id": cat_id,
            "priority": "HIGH",
            "estimated_minutes": 60,
            "scheduled_date": today_iso,
        },
    )
    assert today_task_res.status_code == 201
    task_id = today_task_res.json()["id"]
    occ_id = today_task_res.json()["occurrences"][0]["id"]

    # Partial PATCH: update title only, project_id & category_id stay intact
    patch_title = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=headers_a,
        json={"title": "Luyện IELTS Listening + Speaking", "expected_version": 1},
    )
    assert patch_title.status_code == 200
    assert patch_title.json()["project_id"] == project_id
    assert patch_title.json()["version"] == 2

    # Stale version conflict -> 409
    stale_patch = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=headers_a,
        json={"title": "Stale update", "expected_version": 1},
    )
    assert stale_patch.status_code == 409
    assert stale_patch.json()["error"]["code"] == "TASK_CONFLICT"

    # Explicit null PATCH clears project_id
    clear_project = await client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=headers_a,
        json={"project_id": None},
    )
    assert clear_project.status_code == 200
    assert clear_project.json()["project_id"] is None
    assert clear_project.json()["category_id"] == cat_id

    # Complete and reopen occurrence
    done_res = await client.post(f"/api/v1/occurrences/{occ_id}/complete", headers=headers_a)
    assert done_res.status_code == 200
    assert done_res.json()["status"] == "DONE"
    assert done_res.json()["completed_at"] is not None

    reopen_res = await client.post(f"/api/v1/occurrences/{occ_id}/reopen", headers=headers_a)
    assert reopen_res.status_code == 200
    assert reopen_res.json()["status"] == "NOT_STARTED"
    assert reopen_res.json()["completed_at"] is None

    # Create User B directly in proxy session and verify strict owner isolation
    user_b = User(
        email="userb@example.com",
        email_normalized="userb@example.com",
        password_hash=hash_password("StrongPassword123!"),
        display_name="User B",
    )
    db_proxy_session.add(user_b)
    await db_proxy_session.flush()
    db_proxy_session.add(UserSettings(user_id=user_b.id))
    await db_proxy_session.flush()

    login_b = await client.post(
        "/api/v1/auth/login",
        json={"email": "userb@example.com", "password": "StrongPassword123!"},
    )
    assert login_b.status_code == 200
    headers_b = {"Authorization": f"Bearer {login_b.json()['access_token']}"}

    foreign_task = await client.get(f"/api/v1/tasks/{task_id}", headers=headers_b)
    assert foreign_task.status_code == 404

    foreign_complete = await client.post(
        f"/api/v1/occurrences/{occ_id}/complete",
        headers=headers_b,
    )
    assert foreign_complete.status_code == 404

    # Inside proxy session, users exist before rollback
    count_in_tx = await db_proxy_session.scalar(select(func.count()).select_from(User))
    assert count_in_tx == 2
