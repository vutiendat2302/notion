from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.planning_agent.service import AgentPlanRequest, PlanningAgentService


def test_parse_json_object_extracts_wrapped_json() -> None:
    svc = PlanningAgentService()
    raw = 'Here is the plan:\n```json\n{"reply_message": "Done", "action_proposal": null}\n```'
    parsed = svc._parse_json_object(raw)
    assert parsed == {"reply_message": "Done", "action_proposal": None}


def test_build_prompt_includes_context_and_ocr() -> None:
    svc = PlanningAgentService()
    req = AgentPlanRequest(
        user_id="01950000-0000-7000-8000-000000000001",
        locale="vi",
        message="Lên kế hoạch hôm nay",
        today_date="2026-11-22",
    )
    prompt = svc._build_prompt(
        req,
        "9:00 Họp sprint",
        {"projects": [{"id": "p1", "title": "Core App"}], "tasks": []},
        [{"entity_type": "PROJECT", "text": "Core App", "score": 0.91}],
    )
    assert "9:00 Họp sprint" in prompt
    assert "Core App" in prompt
    assert "2026-11-22" in prompt


def test_default_local_agent_skips_cloud_even_when_cloud_keys_present(monkeypatch) -> None:
    svc = PlanningAgentService()
    called: list[str] = []

    async def fake_ctx(user_id: str) -> dict:
        return {"projects": [], "categories": [], "goals": [], "recent_tasks": []}

    async def fake_search(**kwargs) -> list:
        return []

    async def fake_gemini(**kwargs) -> dict:
        called.append("gemini")
        return {"reply_message": "cloud", "proposed_tasks": []}

    async def fake_ollama(**kwargs) -> dict:
        called.append("ollama")
        return {"reply_message": "local ok", "proposed_tasks": []}

    monkeypatch.setattr(svc, "_fetch_backend_context", fake_ctx)
    monkeypatch.setattr(svc.rag, "search_user_context", fake_search)
    monkeypatch.setattr(svc, "_call_gemini", fake_gemini)
    monkeypatch.setattr(svc, "_call_ollama", fake_ollama)

    req = AgentPlanRequest(
        user_id="01950000-0000-7000-8000-000000000001",
        locale="vi",
        message="Lên lịch",
        today_date="2026-11-22",
        preferred_agent="local",
    )
    res = asyncio.run(svc.plan_from_input(req))
    assert called == ["ollama"]
    assert res["provider"] == "OLLAMA"
