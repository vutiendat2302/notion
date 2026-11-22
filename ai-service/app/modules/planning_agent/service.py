import json
import re
from typing import Any
from uuid import uuid7

import httpx
from app.core.config import get_ai_settings
from app.core.security import mint_s2s_token
from app.modules.rag_search.service import QdrantRagService
from pydantic import BaseModel


class AgentPlanRequest(BaseModel):
    user_id: str
    locale: str = "vi"
    message: str
    timezone: str = "Asia/Ho_Chi_Minh"
    today_date: str
    image_base64: str | None = None
    image_mime_type: str | None = None
    conversation_id: str | None = None
    preferred_agent: str = "local"
    user_api_key: str | None = None
    model_override: str | None = None


class PlanningAgentService:
    def __init__(self) -> None:
        self.rag = QdrantRagService()

    async def plan_from_input(self, req: AgentPlanRequest) -> dict[str, Any]:
        settings = get_ai_settings()
        ocr_text: str | None = None

        # 1. OCR Extraction first when image is present (PaddleOCR / PP-StructureV3)
        if req.image_base64:
            ocr_token = mint_s2s_token(user_id=req.user_id, audience="ocr-service")
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    ocr_resp = await client.post(
                        f"{settings.resolved_ocr_url()}/internal/v1/ocr/extract",
                        headers={"Authorization": f"Bearer {ocr_token}"},
                        json={
                            "image_base64": req.image_base64,
                            "mime_type": req.image_mime_type or "image/png",
                            "enable_layout": True,
                            "enable_table": True,
                            "lang": "vi" if req.locale == "vi" else "en",
                        },
                    )
                    if ocr_resp.status_code == 200:
                        odata = ocr_resp.json()
                        ocr_text = (odata.get("text") or "").strip() or None
            except httpx.HTTPError:
                ocr_text = None

        # 2. Fetch verified context entities via Backend Scoped Tool API + Qdrant (bge-m3)
        context_data = await self._fetch_backend_context(req.user_id)
        for proj in context_data.get("projects", [])[:5]:
            await self.rag.upsert_entity(
                owner_user_id=req.user_id,
                entity_type="PROJECT",
                entity_id=proj["id"],
                text=proj["title"],
            )
        rag_hits = await self.rag.search_user_context(
            owner_user_id=req.user_id,
            query_text=f"{req.message}\n{ocr_text or ''}".strip(),
        )

        # 3. Route strictly per user preference: default is always Local Ollama
        prompt = self._build_prompt(req, ocr_text, context_data, rag_hits)
        agent = (req.preferred_agent or settings.ai_default_agent or "local").strip().lower()
        parsed: dict[str, Any] | None = None
        provider = "OLLAMA"
        model_id = settings.ollama_model

        if agent == "claude":
            key = (req.user_api_key or settings.claude_api_key).strip()
            mdl = (req.model_override or settings.claude_model).strip()
            if key:
                parsed = await self._call_claude(
                    api_key=key,
                    model=mdl,
                    prompt=prompt,
                    image_base64=req.image_base64,
                    image_mime=req.image_mime_type or "image/png",
                )
                if parsed is not None:
                    provider = "CLAUDE"
                    model_id = mdl

        elif agent in {"codex", "openai"}:
            key = (req.user_api_key or settings.openai_api_key).strip()
            mdl = (req.model_override or settings.codex_model).strip()
            if key:
                parsed = await self._call_openai(
                    api_key=key,
                    model=mdl,
                    prompt=prompt,
                    image_base64=req.image_base64,
                    image_mime=req.image_mime_type or "image/png",
                )
                if parsed is not None:
                    provider = "CODEX"
                    model_id = mdl

        elif agent == "gemini":
            key = (req.user_api_key or settings.resolved_gemini_key()).strip()
            mdl = (req.model_override or settings.gemini_model).strip()
            if key:
                parsed = await self._call_gemini(
                    api_key=key,
                    model=mdl,
                    prompt=prompt,
                    image_base64=req.image_base64,
                    image_mime=req.image_mime_type or "image/png",
                )
                if parsed is not None:
                    provider = "GEMINI"
                    model_id = mdl

        # Default or cloud fallback -> System Local AI (Ollama)
        if parsed is None:
            parsed = await self._call_ollama(
                origin=settings.resolved_ollama_origin(),
                model=settings.ollama_model,
                prompt=prompt,
            )
            if parsed is not None:
                provider = "OLLAMA"
                model_id = settings.ollama_model

        if parsed is None:
            raise RuntimeError(
                "AI_MODEL_UNAVAILABLE: Local or configured cloud model failed to return valid output."
            )

        conv_id = req.conversation_id or str(uuid7())
        return {
            "ai_run_id": str(uuid7()),
            "conversation_id": conv_id,
            "provider": provider,
            "model_id": model_id,
            "reply_message": str(parsed.get("reply_message", "")),
            "ocr_text": ocr_text,
            "proposed_tasks": list(parsed.get("proposed_tasks", [])),
            "citations": [
                {
                    "entity_type": str(h.get("entity_type", "")),
                    "entity_id": str(h.get("entity_id", "")),
                    "label": str(h.get("text", "")),
                }
                for h in rag_hits
            ],
        }

    async def _fetch_backend_context(self, user_id: str) -> dict[str, Any]:
        settings = get_ai_settings()
        token = mint_s2s_token(user_id=user_id, audience=settings.backend_tool_audience)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{settings.resolved_backend_url()}/internal/v1/tools/context-entities",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if resp.status_code == 200:
                    return dict(resp.json())
        except httpx.HTTPError:
            pass
        return {"projects": [], "categories": [], "goals": [], "recent_tasks": []}

    def _build_prompt(
        self,
        req: AgentPlanRequest,
        ocr_text: str | None,
        ctx: dict[str, Any],
        rag_hits: list[dict[str, Any]],
    ) -> str:
        return (
            f"You are LumiPlan AI assistant. Today is {req.today_date} ({req.timezone}). "
            f"Reply in {'Vietnamese' if req.locale == 'vi' else 'English'}.\n"
            f"User projects (only use exact UUID if matching): {json.dumps(ctx.get('projects', []), ensure_ascii=False)}\n"
            f"User categories (only use exact UUID if matching): {json.dumps(ctx.get('categories', []), ensure_ascii=False)}\n"
            f"Semantic context (Qdrant bge-m3): {json.dumps(rag_hits, ensure_ascii=False)}\n"
            f"OCR extracted text from image: {ocr_text or 'None'}\n"
            f"User message: {req.message}\n\n"
            "Return STRICT JSON ONLY with keys:\n"
            '{"reply_message": "...", "proposed_tasks": [{"title": "...", "scheduled_date": "YYYY-MM-DD", '
            '"estimated_minutes": 30, "priority": "LOW|MEDIUM|HIGH|URGENT", '
            '"status": "NOT_STARTED", "project_id": null, "category_id": null, "description": "..."}]}'
        )

    async def _call_claude(
        self,
        *,
        api_key: str,
        model: str,
        prompt: str,
        image_base64: str | None,
        image_mime: str,
    ) -> dict[str, Any] | None:
        content: list[dict[str, Any]] = []
        if image_base64:
            content.append(
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": image_mime, "data": image_base64},
                }
            )
        content.append({"type": "text", "text": prompt})
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": 2048,
                        "temperature": 0.2,
                        "messages": [{"role": "user", "content": content}],
                    },
                )
                if resp.status_code != 200:
                    return None
                blocks = resp.json().get("content", [])
                txt = "".join(b.get("text", "") for b in blocks if isinstance(b, dict))
                return self._parse_json_object(txt)
        except (httpx.HTTPError, ValueError, TypeError):
            return None

    async def _call_openai(
        self,
        *,
        api_key: str,
        model: str,
        prompt: str,
        image_base64: str | None,
        image_mime: str,
    ) -> dict[str, Any] | None:
        user_content: list[dict[str, Any]] | str
        if image_base64:
            user_content = [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{image_mime};base64,{image_base64}"},
                },
            ]
        else:
            user_content = prompt
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"},
                        "messages": [{"role": "user", "content": user_content}],
                    },
                )
                if resp.status_code != 200:
                    return None
                txt = resp.json()["choices"][0]["message"]["content"]
                return self._parse_json_object(txt)
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError):
            return None

    async def _call_gemini(
        self,
        *,
        api_key: str,
        model: str,
        prompt: str,
        image_base64: str | None,
        image_mime: str,
    ) -> dict[str, Any] | None:
        parts: list[dict[str, Any]] = [{"text": prompt}]
        if image_base64:
            parts.append({"inline_data": {"mime_type": image_mime, "data": image_base64}})
        body = {
            "contents": [{"parts": parts}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        header_variants = [{"x-goog-api-key": api_key}]
        if api_key.startswith("AQ."):
            header_variants.append({"Authorization": f"Bearer {api_key}"})
        for hdrs in header_variants:
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(url, headers=hdrs, json=body)
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    txt = data["candidates"][0]["content"]["parts"][0]["text"]
                    return self._parse_json_object(txt)
            except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError):
                continue
        return None

    async def _call_ollama(self, *, origin: str, model: str, prompt: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{origin}/api/chat",
                    json={
                        "model": model,
                        "stream": False,
                        "format": "json",
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                if resp.status_code != 200:
                    return None
                txt = resp.json().get("message", {}).get("content", "")
                return self._parse_json_object(txt)
        except (httpx.HTTPError, ValueError, TypeError):
            return None

    def _parse_json_object(self, raw: str) -> dict[str, Any] | None:
        try:
            return dict(json.loads(raw))
        except (json.JSONDecodeError, TypeError, ValueError):
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if not m:
                return None
            try:
                return dict(json.loads(m.group(0)))
            except (json.JSONDecodeError, TypeError, ValueError):
                return None
