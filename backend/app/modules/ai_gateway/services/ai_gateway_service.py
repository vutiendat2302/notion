import base64
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.core.logging import request_id_ctx
from app.core.security import create_s2s_token
from app.db.base import new_uuid7, utc_now
from app.db.extended_models import action_proposals
from app.modules.ai_gateway.schemas.ai_gateway_schemas import (
    AIChatRequest,
    AIChatResponse,
    AIProposalConfirmRequest,
    AIProposalConfirmResponse,
    ProposedTaskItem,
)
from app.modules.projects.repositories.project_repository import ProjectRepository
from app.modules.storage.services.storage_service import StorageService
from app.modules.tasks.domain.status_policy import OccurrenceStatus
from app.modules.tasks.schemas.requests.task_requests import TaskCreateRequest
from app.modules.tasks.services.task_service import TaskService
from app.modules.taxonomy.repositories.category_repository import CategoryRepository
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.audit import record_event


async def call_ai_service(
    *,
    base_url: str,
    timeout_seconds: int,
    s2s_token: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/internal/v1/agent/plan-from-input"
    headers = {
        "Authorization": f"Bearer {s2s_token}",
        "X-Correlation-ID": request_id_ctx.get(),
    }
    async with httpx.AsyncClient(timeout=float(timeout_seconds)) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return dict(resp.json())


class AIGatewayService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def chat_and_propose(self, user_id: UUID, payload: AIChatRequest) -> AIChatResponse:
        settings = get_settings()
        user_settings = await UserRepository(self.session).get_settings_by_user_id(user_id)
        tz_name = user_settings.timezone if user_settings else "Asia/Ho_Chi_Minh"
        today_local = datetime.now(ZoneInfo(tz_name)).date()

        image_b64: str | None = None
        image_mime: str | None = None
        if payload.image_file_id is not None:
            _, img_bytes, img_mime, _ = await StorageService(self.session).stream_file(
                user_id=user_id, file_id=payload.image_file_id
            )
            image_b64 = base64.b64encode(img_bytes).decode("ascii")
            image_mime = img_mime

        ai_prefs = (
            dict((user_settings.preferences_json or {}).get("ai") or {})
            if user_settings
            else {}
        )
        preferred_agent = str(ai_prefs.get("preferred_agent") or "local").strip().lower()
        user_api_key = str(ai_prefs.get(f"{preferred_agent}_api_key") or "").strip() or None
        custom_model = str(ai_prefs.get("custom_model") or "").strip() or None

        s2s_token = create_s2s_token(user_id=user_id, audience=settings.ai_service_audience)
        req_body = {
            "user_id": str(user_id),
            "locale": payload.locale,
            "message": payload.message,
            "timezone": tz_name,
            "today_date": today_local.isoformat(),
            "image_base64": image_b64,
            "image_mime_type": image_mime,
            "conversation_id": str(payload.conversation_id) if payload.conversation_id else None,
            "preferred_agent": preferred_agent,
            "user_api_key": user_api_key,
            "model_override": custom_model,
        }

        try:
            ai_data = await call_ai_service(
                base_url=settings.ai_service_base_url,
                timeout_seconds=settings.ai_request_timeout_seconds,
                s2s_token=s2s_token,
                payload=req_body,
            )
        except httpx.TimeoutException as exc:
            raise AppError(
                status_code=504,
                code="AI_SERVICE_TIMEOUT",
                message="AI Service phản hồi quá hạn. Vui lòng thử lại hoặc dùng Tạo nhanh Task.",
            ) from exc
        except httpx.HTTPError as exc:
            raise AppError(
                status_code=503,
                code="AI_SERVICE_UNAVAILABLE",
                message="AI Service hiện không khả dụng. Bạn có thể tạo Task nhanh trực tiếp.",
            ) from exc

        # Validate every proposed entity reference against real user-owned DB records
        proj_repo = ProjectRepository(self.session)
        cat_repo = CategoryRepository(self.session)
        validated_items: list[ProposedTaskItem] = []
        for raw_item in ai_data.get("proposed_tasks", []):
            item = ProposedTaskItem.model_validate(raw_item)
            if item.project_id is not None:
                if await proj_repo.get_by_id_and_user(item.project_id, user_id) is None:
                    item.project_id = None
            if item.category_id is not None:
                if await cat_repo.get_by_id_and_user(item.category_id, user_id) is None:
                    item.category_id = None
            if item.scheduled_date is None:
                item.scheduled_date = today_local
            validated_items.append(item)

        proposal_id: UUID | None = None
        prop_status: str = "INFO_ONLY"
        if validated_items:
            now = utc_now()
            proposal_id = new_uuid7()
            prop_status = "AWAITING_CONFIRMATION"
            await self.session.execute(
                insert(action_proposals).values(
                    id=proposal_id,
                    user_id=user_id,
                    action_type="CREATE_TASKS_BATCH",
                    status=prop_status,
                    changes_json={"items": [i.model_dump(mode="json") for i in validated_items]},
                    impact_summary=f"Đề xuất tạo {len(validated_items)} nhiệm vụ",
                    idempotency_key=str(new_uuid7()),
                    expires_at=now + timedelta(minutes=30),
                    ai_run_id=UUID(ai_data["ai_run_id"]) if ai_data.get("ai_run_id") else None,
                    created_at=now,
                    updated_at=now,
                )
            )
            await self.session.commit()

        conv_raw = ai_data.get("conversation_id")
        return AIChatResponse(
            conversation_id=UUID(conv_raw) if conv_raw else payload.conversation_id,
            proposal_id=proposal_id,
            status="AWAITING_CONFIRMATION" if proposal_id else "INFO_ONLY",
            reply_message=str(ai_data.get("reply_message", "")),
            ocr_text=ai_data.get("ocr_text"),
            provider=str(ai_data.get("provider", "HYBRID")),
            model_id=str(ai_data.get("model_id", "ai-service")),
            proposed_tasks=validated_items,
            citations=list(ai_data.get("citations", [])),
        )

    async def confirm_proposal(
        self,
        user_id: UUID,
        proposal_id: UUID,
        payload: AIProposalConfirmRequest,
    ) -> AIProposalConfirmResponse:
        row = await self._get_owned_proposal(user_id, proposal_id)
        now = utc_now()
        if row.status == "EXECUTED":
            return AIProposalConfirmResponse(
                proposal_id=proposal_id,
                status="EXECUTED",
                created_task_ids=[],
                created_count=0,
            )
        if row.status != "AWAITING_CONFIRMATION":
            raise ConflictError(
                "Đề xuất này không còn ở trạng thái chờ xác nhận.", code="PROPOSAL_NOT_PENDING"
            )
        expires_at = row.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=now.tzinfo)
        if expires_at < now:
            await self.session.execute(
                update(action_proposals)
                .where(action_proposals.c.id == proposal_id)
                .values(status="EXPIRED", updated_at=now)
            )
            await self.session.commit()
            raise ConflictError("Đề xuất đã hết hạn xác nhận.", code="PROPOSAL_EXPIRED")

        raw_items = list((row.changes_json or {}).get("items", []))
        if payload.edited_items is not None:
            items_to_create = payload.edited_items
        elif payload.selected_indices is not None:
            idx_set = set(payload.selected_indices)
            items_to_create = [
                ProposedTaskItem.model_validate(item)
                for idx, item in enumerate(raw_items)
                if idx in idx_set
            ]
        else:
            items_to_create = [ProposedTaskItem.model_validate(item) for item in raw_items]

        task_service = TaskService(self.session)
        created_ids: list[UUID] = []
        for item in items_to_create:
            created = await task_service.create_task(
                user_id,
                TaskCreateRequest(
                    title=item.title,
                    description=item.description,
                    project_id=item.project_id,
                    category_id=item.category_id,
                    priority=item.priority,
                    estimated_minutes=item.estimated_minutes,
                    scheduled_date=item.scheduled_date,
                    start_at=item.start_at,
                    end_at=item.end_at,
                    status=OccurrenceStatus(item.status),
                ),
            )
            created_ids.append(created.id)

        await self.session.execute(
            update(action_proposals)
            .where(action_proposals.c.id == proposal_id, action_proposals.c.user_id == user_id)
            .values(status="EXECUTED", confirmed_at=now, updated_at=now)
        )
        record_event(
            self.session,
            user_id,
            "ACTION_PROPOSAL",
            proposal_id,
            "AI_PROPOSAL_CONFIRMED",
            {"created_count": len(created_ids)},
        )
        await self.session.commit()
        return AIProposalConfirmResponse(
            proposal_id=proposal_id,
            status="EXECUTED",
            created_task_ids=created_ids,
            created_count=len(created_ids),
        )

    async def reject_proposal(self, user_id: UUID, proposal_id: UUID) -> dict[str, str]:
        row = await self._get_owned_proposal(user_id, proposal_id)
        if row.status == "AWAITING_CONFIRMATION":
            await self.session.execute(
                update(action_proposals)
                .where(action_proposals.c.id == proposal_id, action_proposals.c.user_id == user_id)
                .values(status="REJECTED", updated_at=utc_now())
            )
            await self.session.commit()
        return {"status": "REJECTED"}

    async def _get_owned_proposal(self, user_id: UUID, proposal_id: UUID) -> Any:
        row = (
            await self.session.execute(
                select(action_proposals).where(
                    action_proposals.c.id == proposal_id,
                    action_proposals.c.user_id == user_id,
                )
            )
        ).first()
        if row is None:
            raise NotFoundError("Action proposal not found.", code="PROPOSAL_NOT_FOUND")
        return row
