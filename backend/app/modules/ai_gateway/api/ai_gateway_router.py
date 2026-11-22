from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DBSession
from app.core.config import get_settings
from app.modules.ai_gateway.schemas.ai_gateway_schemas import (
    AIAgentOption,
    AIChatRequest,
    AIChatResponse,
    AIProposalConfirmRequest,
    AIProposalConfirmResponse,
)
from app.modules.ai_gateway.services.ai_gateway_service import AIGatewayService

router = APIRouter(prefix="/ai", tags=["ai-gateway"])


@router.get("/agents", response_model=list[AIAgentOption])
async def list_ai_agents(current_user: CurrentUser) -> list[AIAgentOption]:
    _ = current_user
    settings = get_settings()
    return [
        AIAgentOption(
            id="local",
            label="AI Local (Ollama)",
            model_id=settings.ollama_model,
            requires_api_key=False,
            server_configured=True,
        ),
        AIAgentOption(
            id="claude",
            label="Claude (Anthropic)",
            model_id=settings.claude_model,
            requires_api_key=True,
            server_configured=bool(settings.claude_api_key.strip()),
        ),
        AIAgentOption(
            id="codex",
            label="Codex (OpenAI)",
            model_id=settings.codex_model,
            requires_api_key=True,
            server_configured=bool(settings.openai_api_key.strip()),
        ),
        AIAgentOption(
            id="gemini",
            label="Gemini (Google)",
            model_id=settings.gemini_model,
            requires_api_key=True,
            server_configured=bool(
                (settings.gemini_api_key or settings.ai_cloud_api_key).strip()
            ),
        ),
    ]


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    current_user: CurrentUser,
    session: DBSession,
) -> AIChatResponse:
    return await AIGatewayService(session).chat_and_propose(current_user.id, payload)


@router.post("/proposals/{proposal_id}/confirm", response_model=AIProposalConfirmResponse)
async def confirm_ai_proposal(
    proposal_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
    payload: AIProposalConfirmRequest | None = None,
) -> AIProposalConfirmResponse:
    return await AIGatewayService(session).confirm_proposal(
        current_user.id,
        proposal_id,
        payload or AIProposalConfirmRequest(),
    )


@router.post("/proposals/{proposal_id}/reject")
async def reject_ai_proposal(
    proposal_id: UUID,
    current_user: CurrentUser,
    session: DBSession,
) -> dict[str, str]:
    return await AIGatewayService(session).reject_proposal(current_user.id, proposal_id)
