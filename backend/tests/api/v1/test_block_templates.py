import pytest
from httpx import AsyncClient

from app.modules.auth.services.admin_seed_service import ensure_default_accounts
from tests.conftest import TransactionalProxySession


@pytest.mark.asyncio
async def test_block_templates_seed_rbac_and_admin_crud(
    client: AsyncClient,
    db_proxy_session: TransactionalProxySession,
) -> None:
    await ensure_default_accounts(db_proxy_session)  # type: ignore[arg-type]

    # 1. Login as seeded ADMIN
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin", "password": "dat123456"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 2. Normal user registers -> gets USER role
    user_reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "tpl_user",
            "display_name": "Template User",
            "email": "tpl.user@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert user_reg.status_code == 201
    user_headers = {"Authorization": f"Bearer {user_reg.json()['access_token']}"}

    # 3. User cannot access admin endpoints
    forbidden = await client.get("/api/v1/admin/block-templates", headers=user_headers)
    assert forbidden.status_code == 403

    # 4. User lists seeded active templates (includes text, form/table, productivity, 19 charts)
    user_list = await client.get("/api/v1/block-templates", headers=user_headers)
    assert user_list.status_code == 200
    items = user_list.json()
    assert len(items) >= 30
    assert any(item["slug"] == "custom-table-form" for item in items)

    # 5. Admin creates a custom structured form template and toggles customization lock
    created = await client.post(
        "/api/v1/admin/block-templates",
        headers=admin_headers,
        json={
            "slug": "english-target-sheet",
            "category": "FORM_TABLE",
            "name_vi": "Mục tiêu Tiếng Anh",
            "name_en": "English Target",
            "description_vi": "Form lộ trình học theo tuần",
            "description_en": "Weekly study target table",
            "icon_name": "Table2",
            "widget_kind": "TASK_LIST",
            "default_title": "English Target",
            "default_width": 12,
            "default_height": 4,
            "default_spec_json": {
                "preset_type": "CUSTOM_TABLE",
                "border": "solid",
                "border_width": 2,
                "border_color": "#5D83BB",
                "columns": [{"id": "week", "label": "Week", "type": "number"}],
                "rows": [{"id": "r1", "cells": {"week": "1"}}],
            },
            "is_active": True,
            "is_user_customizable": False,
            "sort_order": 5,
        },
    )
    assert created.status_code == 201
    tpl_id = created.json()["id"]
    assert created.json()["is_user_customizable"] is False

    # 6. Admin patches template to deactivate -> hidden from user list, visible in admin list
    patched = await client.patch(
        f"/api/v1/admin/block-templates/{tpl_id}",
        headers=admin_headers,
        json={"is_active": False, "default_width": 6},
    )
    assert patched.status_code == 200
    assert patched.json()["is_active"] is False
    assert patched.json()["default_width"] == 6

    user_after_hide = await client.get("/api/v1/block-templates", headers=user_headers)
    assert not any(it["id"] == tpl_id for it in user_after_hide.json())

    admin_list = await client.get("/api/v1/admin/block-templates", headers=admin_headers)
    assert any(it["id"] == tpl_id for it in admin_list.json())

    # 7. Admin deletes custom template
    deleted = await client.delete(
        f"/api/v1/admin/block-templates/{tpl_id}", headers=admin_headers
    )
    assert deleted.status_code == 204
