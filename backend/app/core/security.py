import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

_password_hasher = PasswordHash.recommended()


def hash_password(plain_password: str) -> str:
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return _password_hasher.verify(plain_password, password_hash)


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw_token: str) -> bytes:
    return hashlib.sha256(raw_token.encode("utf-8")).digest()


def create_access_token(*, user_id: UUID, session_id: UUID) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(UTC)
    ttl_seconds = settings.access_token_ttl_minutes * 60
    expires_at = now + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "iss": "productivity-backend",
        "aud": "productivity-client",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, ttl_seconds


def decode_access_token(token: str) -> tuple[UUID, UUID]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            audience="productivity-client",
            issuer="productivity-backend",
        )
        return UUID(str(payload["sub"])), UUID(str(payload["sid"]))
    except (InvalidTokenError, KeyError, ValueError) as exc:
        raise UnauthorizedError(
            "Invalid or expired access token.",
            code="INVALID_ACCESS_TOKEN",
        ) from exc
