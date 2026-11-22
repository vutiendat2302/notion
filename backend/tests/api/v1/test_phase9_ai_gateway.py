import httpx
import pytest
from httpx import AsyncClient

from app.core.security import create_s2s_token
from app.modules.ai_gateway.services import ai_gateway_service


@pytest.mark.asyncio
async def test_internal_tools_and_ai_proposal_confirmation_flow(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "ai_tester",
            "display_name": "AI Tester",
            "email": "ai.tester@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert reg.status_code == 201
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    proj = await client.post(
        "/api/v1/projects",
        headers=headers,
        json={"title": "AI Target Project", "status": "ACTIVE"},
    )
    assert proj.status_code == 201
    project_id = proj.json()["id"]

    # 1. Internal tools API enforces S2S audience & owner scope
    bad_tools = await client.get("/internal/v1/tools/context-entities", headers=headers)
    assert bad_tools.status_code == 401

    from uuid import UUID

    s2s_token = create_s2s_token(user_id=UUID(user_id), audience="backend-tools")
    ok_tools = await client.get(
        "/internal/v1/tools/context-entities",
        headers={"Authorization": f"Bearer {s2s_token}"},
    )
    assert ok_tools.status_code == 200
    assert any(p["id"] == project_id for p in ok_tools.json()["projects"])

    # 2. Mock AI Service response -> creates AWAITING_CONFIRMATION proposal (never auto-writes)
    async def _fake_ai_call(**_: object) -> dict[str, object]:
        return {
            "ai_run_id": None,
            "conversation_id": None,
            "provider": "CLOUD",
            "model_id": "gemini-2.5-flash",
            "reply_message": "Mình đã tách 2 nhiệm vụ cho hôm nay.",
            "ocr_text": "1. Học ngữ pháp\n2. Làm bài tập",
            "proposed_tasks": [
                {
                    "title": "Học ngữ pháp",
                    "priority": "HIGH",
                    "estimated_minutes": 45,
                    "project_id": project_id,
                },
                {
                    "title": "Làm bài tập",
                    "priority": "MEDIUM",
                    "estimated_minutes": 30,
                    "project_id": "00000000-0000-0000-0000-000000000099",  # invalid -> stripped
                },
            ],
            "citations": [],
        }

    monkeypatch.setattr(ai_gateway_service, "call_ai_service", _fake_ai_call)
    chat_resp = await client.post(
        "/api/v1/ai/chat",
        headers=headers,
        json={"message": "Lên nhiệm vụ hôm nay giúp mình", "locale": "vi"},
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["status"] == "AWAITING_CONFIRMATION"
    assert len(chat_data["proposed_tasks"]) == 2
    assert chat_data["proposed_tasks"][0]["project_id"] == project_id
    assert chat_data["proposed_tasks"][1]["project_id"] is None
    proposal_id = chat_data["proposal_id"]

    # Before confirmation, tasks are NOT created yet
    tasks_before = await client.get("/api/v1/tasks", headers=headers)
    assert tasks_before.json()["pagination"]["total"] == 0

    # 3. User confirms proposal -> TaskService creates tasks inside transaction
    confirm_resp = await client.post(
        f"/api/v1/ai/proposals/{proposal_id}/confirm",
        headers=headers,
        json={"selected_indices": [0, 1]},
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "EXECUTED"
    assert confirm_resp.json()["created_count"] == 2

    tasks_after = await client.get("/api/v1/tasks", headers=headers)
    assert tasks_after.json()["pagination"]["total"] == 2

    # 4. Graceful error when AI service is unreachable
    async def _down_ai_call(**_: object) -> dict[str, object]:
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(ai_gateway_service, "call_ai_service", _down_ai_call)
    down_resp = await client.post(
        "/api/v1/ai/chat",
        headers=headers,
        json={"message": "Hello", "locale": "vi"},
    )
    assert down_resp.status_code == 503
    assert down_resp.json()["error"]["code"] == "AI_SERVICE_UNAVAILABLE"

    # 5. List configured AI agents without exposing raw API keys
    agents_resp = await client.get("/api/v1/ai/agents", headers=headers)
    assert agents_resp.status_code == 200
    agents = agents_resp.json()
    agent_ids = [item["id"] for item in agents]
    assert agent_ids == ["local", "claude", "codex", "gemini"]
    local_agent = next(item for item in agents if item["id"] == "local")
    assert local_agent["requires_api_key"] is False
    assert local_agent["server_configured"] is True
    for item in agents:
        assert "api_key" not in item
        if item["id"] != "local":
            assert item["requires_api_key"] is True
