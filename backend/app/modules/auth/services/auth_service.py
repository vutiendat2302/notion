from datetime import timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.base import new_uuid7, utc_now
from app.modules.auth.models.auth_session import AuthSession
from app.modules.auth.repositories.auth_session_repository import AuthSessionRepository
from app.modules.auth.schemas.requests.auth_requests import BootstrapUserRequest, LoginRequest
from app.modules.taxonomy.models.category import Category
from app.modules.users.models.user import User, UserSettings
from app.modules.users.repositories.user_repository import UserRepository

DEFAULT_CATEGORIES: list[tuple[str, str, int]] = [
    ("Study", "LAVENDER", 1),
    ("Health & Habit", "SAGE", 2),
    ("Personal", "PEACH", 3),
    ("Goals", "ROSE", 4),
    ("Focus", "SKY", 5),
]


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.session_repo = AuthSessionRepository(session)

    async def bootstrap_owner(self, payload: BootstrapUserRequest) -> tuple[User, str, str, int]:
        """Single-user bootstrap: only allowed when zero users exist."""
        if await self.user_repo.count_users() > 0:
            raise ConflictError(
                "Owner account already bootstrapped. Use /auth/login.",
                code="BOOTSTRAP_ALREADY_COMPLETED",
            )

        settings = get_settings()
        normalized_email = str(payload.email).strip().casefold()
        user = User(
            email=str(payload.email).strip(),
            email_normalized=normalized_email,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name.strip(),
            status="ACTIVE",
        )
        await self.user_repo.add_user(user)

        user_settings = UserSettings(
            user_id=user.id,
            timezone=settings.default_timezone,
            week_starts_on=1,
            locale="vi-VN",
            theme="SYSTEM",
            color_theme="SOFT_BLUE",
        )
        await self.user_repo.add_settings(user_settings)

        for name, accent, sort_order in DEFAULT_CATEGORIES:
            self.session.add(
                Category(
                    user_id=user.id,
                    name=name,
                    accent_token=accent,
                    sort_order=sort_order,
                )
            )
        await self.session.flush()

        access_token, refresh_token, ttl = await self._issue_session(
            user=user, device_label="bootstrap"
        )
        await self.session.commit()
        loaded_user = await self.user_repo.get_by_id(user.id)
        assert loaded_user is not None
        return loaded_user, access_token, refresh_token, ttl

    async def login(self, payload: LoginRequest) -> tuple[User, str, str, int]:
        normalized_email = str(payload.email).strip().casefold()
        user = await self.user_repo.get_by_email_normalized(normalized_email)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise UnauthorizedError("Invalid email or password.", code="INVALID_CREDENTIALS")
        if user.status != "ACTIVE":
            raise ForbiddenError("Account is disabled.", code="ACCOUNT_DISABLED")

        user.last_login_at = utc_now()
        access_token, refresh_token, ttl = await self._issue_session(
            user=user, device_label=payload.device_label
        )
        await self.session.commit()
        loaded_user = await self.user_repo.get_by_id(user.id)
        assert loaded_user is not None
        return loaded_user, access_token, refresh_token, ttl

    async def refresh(self, raw_refresh_token: str) -> tuple[User, str, str, int]:
        token_hash = hash_refresh_token(raw_refresh_token)
        stored = await self.session_repo.get_by_token_hash(token_hash)
        now = utc_now()
        if stored is None:
            raise UnauthorizedError("Invalid refresh token.", code="INVALID_REFRESH_TOKEN")

        # Reuse detection: revoke whole family if an already-revoked token is replayed
        if stored.revoked_at is not None:
            await self.session_repo.revoke_family(stored.family_id, now)
            await self.session.commit()
            raise UnauthorizedError(
                "Refresh token reuse detected. Session family revoked.",
                code="REFRESH_TOKEN_REUSED",
            )

        if stored.expires_at <= now:
            stored.revoked_at = now
            await self.session.commit()
            raise UnauthorizedError("Refresh token expired.", code="REFRESH_TOKEN_EXPIRED")

        user = await self.user_repo.get_by_id(stored.user_id)
        if user is None or user.status != "ACTIVE":
            raise UnauthorizedError("Account unavailable.", code="ACCOUNT_UNAVAILABLE")

        stored.revoked_at = now
        stored.last_used_at = now

        access_token, new_refresh_token, ttl = await self._issue_session(
            user=user,
            device_label=stored.device_label,
            family_id=stored.family_id,
        )
        await self.session.commit()
        return user, access_token, new_refresh_token, ttl

    async def logout(self, raw_refresh_token: str | None) -> bool:
        if not raw_refresh_token:
            return False
        token_hash = hash_refresh_token(raw_refresh_token)
        stored = await self.session_repo.get_by_token_hash(token_hash)
        if stored is None:
            return False
        if stored.revoked_at is None:
            stored.revoked_at = utc_now()
            await self.session.commit()
        return True

    async def _issue_session(
        self,
        *,
        user: User,
        device_label: str | None,
        family_id: UUID | None = None,
    ) -> tuple[str, str, int]:
        settings = get_settings()
        now = utc_now()
        raw_refresh = generate_refresh_token()
        session_row = AuthSession(
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(raw_refresh),
            family_id=family_id or new_uuid7(),
            device_label=device_label,
            issued_at=now,
            expires_at=now + timedelta(days=settings.refresh_token_ttl_days),
            last_used_at=now,
        )
        await self.session_repo.add(session_row)
        access_token, ttl_seconds = create_access_token(user_id=user.id, session_id=session_row.id)
        return access_token, raw_refresh, ttl_seconds
