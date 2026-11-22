from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import jwt
from app.core.config import get_ai_settings
from fastapi import Header, HTTPException, status
from jwt import InvalidTokenError


def verify_incoming_s2s_token(authorization: Annotated[str | None, Header()] = None) -> UUID:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing S2S token")
    token = authorization.split(" ", 1)[1].strip()
    settings = get_ai_settings()
    try:
        payload = jwt.decode(
            token,
            settings.s2s_signing_secret,
            algorithms=["HS256"],
            audience=settings.ai_service_audience,
        )
        return UUID(str(payload["sub"]))
    except (InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid S2S token") from exc


def mint_s2s_token(*, user_id: str, audience: str, ttl_seconds: int = 120) -> str:
    settings = get_ai_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "iss": "ai-service",
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.s2s_signing_secret, algorithm="HS256")
