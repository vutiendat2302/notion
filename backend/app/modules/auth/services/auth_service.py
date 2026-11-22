from datetime import timedelta
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError, ValidationAppError
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
from app.modules.auth.schemas.requests.auth_requests import (
    BootstrapUserRequest,
    LoginRequest,
    RegisterRequest,
)
from app.modules.taxonomy.models.category import Category
from app.modules.users.models.user import User, UserSettings
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.contacts import (
    looks_like_email,
    looks_like_phone,
    normalize_email,
    normalize_phone,
    normalize_username,
)

DEFAULT_CATEGORIES: list[tuple[str, str, int]] = [
    ("Study", "LAVENDER", 1),
    ("Habit", "SAGE", 2),
    ("Personal", "PEACH", 3),
    ("Goals", "ROSE", 4),
    ("Attention", "BUTTER", 5),
    ("Schedule", "SKY", 6),
]


async def create_user_with_defaults(
    session: AsyncSession,
    user_repo: UserRepository,
    *,
    username: str | None = None,
    display_name: str,
    email: str | None,
    phone: str | None,
    password: str,
    role: str = "USER",
    status: str = "ACTIVE",
) -> User:
    """Create a user along with default UserSettings and starter categories."""
    clean_username, norm_username = normalize_username(username)
    clean_email, norm_email = normalize_email(email)
    clean_phone, norm_phone = normalize_phone(phone)

    if norm_email is None and norm_phone is None:
        raise ConflictError(
            "Phải cung cấp ít nhất Email hoặc Số điện thoại.",
            code="CONTACT_REQUIRED",
        )

    if norm_username and await user_repo.get_by_username_normalized(norm_username) is not None:
        raise ConflictError(
            "Tên tài khoản này đã được sử dụng.",
            code="USERNAME_ALREADY_EXISTS",
        )
    if norm_email and await user_repo.get_by_email_normalized(norm_email) is not None:
        raise ConflictError(
            "Email này đã được sử dụng bởi một tài khoản khác.",
            code="EMAIL_ALREADY_EXISTS",
        )
    if norm_phone and await user_repo.get_by_phone_normalized(norm_phone) is not None:
        raise ConflictError(
            "Số điện thoại này đã được sử dụng bởi một tài khoản khác.",
            code="PHONE_ALREADY_EXISTS",
        )

    settings = get_settings()
    user = User(
        username=clean_username,
        username_normalized=norm_username,
        email=clean_email,
        email_normalized=norm_email,
        phone=clean_phone,
        phone_normalized=norm_phone,
        password_hash=hash_password(password),
        display_name=display_name.strip(),
        role=role,
        status=status,
    )
    try:
        await user_repo.add_user(user)
    except IntegrityError as exc:
        raise ConflictError(
            "Email hoặc số điện thoại đã tồn tại trong hệ thống.",
            code="CONTACT_ALREADY_EXISTS",
        ) from exc

    user_settings = UserSettings(
        user_id=user.id,
        timezone=settings.default_timezone,
        week_starts_on=1,
        locale="vi-VN",
        theme="SYSTEM",
        color_theme="SOFT_PASTEL",
    )
    await user_repo.add_settings(user_settings)

    for name, accent, sort_order in DEFAULT_CATEGORIES:
        session.add(
            Category(
                user_id=user.id,
                name=name,
                accent_token=accent,
                sort_order=sort_order,
            )
        )
    await session.flush()
    return user


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

        user = await create_user_with_defaults(
            self.session,
            self.user_repo,
            display_name=payload.display_name,
            email=str(payload.email),
            phone=None,
            password=payload.password,
            role="ADMIN",
            status="ACTIVE",
        )
        access_token, refresh_token, ttl = await self._issue_session(
            user=user, device_label="bootstrap"
        )
        await self.session.commit()
        loaded_user = await self.user_repo.get_by_id(user.id)
        assert loaded_user is not None
        return loaded_user, access_token, refresh_token, ttl

    async def register(self, payload: RegisterRequest) -> tuple[User, str, str, int]:
        user = await create_user_with_defaults(
            self.session,
            self.user_repo,
            username=payload.username,
            display_name=payload.display_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role="USER",
            status="ACTIVE",
        )
        access_token, refresh_token, ttl = await self._issue_session(
            user=user, device_label=payload.device_label or "web-register"
        )
        await self.session.commit()
        loaded_user = await self.user_repo.get_by_id(user.id)
        assert loaded_user is not None
        return loaded_user, access_token, refresh_token, ttl

    async def login(self, payload: LoginRequest) -> tuple[User, str, str, int]:
        raw_identifier = (payload.identifier or payload.email or "").strip()
        user: User | None = None
        try:
            if looks_like_email(raw_identifier):
                _, norm_email = normalize_email(raw_identifier)
                if norm_email:
                    user = await self.user_repo.get_by_email_normalized(norm_email)
            elif looks_like_phone(raw_identifier):
                _, norm_phone = normalize_phone(raw_identifier)
                if norm_phone:
                    user = await self.user_repo.get_by_phone_normalized(norm_phone)
            else:
                _, norm_username = normalize_username(raw_identifier)
                if norm_username:
                    user = await self.user_repo.get_by_username_normalized(norm_username)
        except ValidationAppError:
            user = None

        if user is None or not verify_password(payload.password, user.password_hash):
            raise UnauthorizedError(
                "Sai thông tin đăng nhập hoặc mật khẩu.",
                code="INVALID_CREDENTIALS",
            )
        if user.status != "ACTIVE":
            raise ForbiddenError("Tài khoản đã bị vô hiệu hóa.", code="ACCOUNT_DISABLED")

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
        access_token, ttl_seconds = create_access_token(
            user_id=user.id, session_id=session_row.id, role=user.role
        )
        return access_token, raw_refresh, ttl_seconds
