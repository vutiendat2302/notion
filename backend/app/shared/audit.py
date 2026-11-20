"""Write small, owner-scoped activity events in the caller's transaction."""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import request_id_ctx
from app.db.extended_models import ActivityEvent


def record_event(
    session: AsyncSession,
    user_id: UUID,
    entity_type: str,
    entity_id: UUID,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> None:
    session.add(
        ActivityEvent(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            event_type=event_type,
            payload_json=payload,
            request_id=request_id_ctx.get(),
        )
    )
