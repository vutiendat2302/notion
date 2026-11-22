from typing import Annotated, Any
from uuid import UUID

from app.core.security import verify_incoming_s2s_token
from app.modules.planning_agent.service import AgentPlanRequest, PlanningAgentService
from fastapi import Depends, FastAPI, HTTPException, status

app = FastAPI(title="LumiPlan AI Service", version="0.1.0")


@app.get("/health/live")
async def health_live() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/internal/v1/agent/plan-from-input")
async def plan_from_input(
    payload: AgentPlanRequest,
    user_id: Annotated[UUID, Depends(verify_incoming_s2s_token)],
) -> dict[str, Any]:
    if str(user_id) != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Scope mismatch")
    try:
        return await PlanningAgentService().plan_from_input(payload)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
