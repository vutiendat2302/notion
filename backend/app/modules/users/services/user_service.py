from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.core.security import hash_password
from app.db.base import utc_now
from app.modules.auth.models.auth_session import AuthSession
from app.modules.auth.repositories.auth_session_repository import AuthSessionRepository
from app.modules.auth.services.auth_service import create_user_with_defaults
from app.modules.users.models.user import User, UserSettings
from app.modules.users.repositories.user_repository import UserRepository
from app.modules.users.schemas.requests.settings_patch import UserSettingsPatchRequest
from app.modules.users.schemas.requests.user_requests import (
    AdminUserCreateRequest,
    AdminUserPatchRequest,
    UserMePatchRequest,
)
from app.shared.contacts import normalize_email, normalize_phone, normalize_username


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)
        self.session_repo = AuthSessionRepository(session)

    async def get_profile(self, user_id: UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.", code="USER_NOT_FOUND")
        return user

    async def patch_me(self, user_id: UUID, payload: UserMePatchRequest) -> User:
        user = await self.get_profile(user_id)
        await self._apply_user_contact_updates(
            user=user,
            fields_set=payload.model_fields_set,
            username=payload.username,
            display_name=payload.display_name,
            email=payload.email,
            phone=payload.phone,
        )
        await self._commit_user_safely()
        loaded = await self.repo.get_by_id(user.id)
        assert loaded is not None
        return loaded

    async def patch_settings(
        self, user_id: UUID, payload: UserSettingsPatchRequest
    ) -> UserSettings:
        settings = await self.repo.get_settings_by_user_id(user_id)
        if settings is None:
            raise NotFoundError("User settings not found.", code="USER_SETTINGS_NOT_FOUND")

        fields_set = payload.model_fields_set
        non_nullable_fields = {"timezone", "week_starts_on", "locale", "theme", "color_theme"}
        for field_name in fields_set:
            value = getattr(payload, field_name)
            if field_name in non_nullable_fields and value is None:
                raise ValidationAppError(f"Field '{field_name}' cannot be null.")
            setattr(settings, field_name, value)

        await self.session.commit()
        await self.session.refresh(settings)
        return settings

    async def list_my_sessions(self, user_id: UUID) -> list[AuthSession]:
        return await self.session_repo.list_active_by_user_id(user_id, utc_now())

    async def revoke_my_session(self, user_id: UUID, session_id: UUID) -> bool:
        target = await self.session_repo.get_by_id_and_user_id(session_id, user_id)
        if target is None:
            raise NotFoundError("Session not found.", code="SESSION_NOT_FOUND")
        if target.revoked_at is None:
            target.revoked_at = utc_now()
            await self.session.commit()
            return True
        return False

    # --- Admin CRUD ---
    async def list_users_admin(
        self,
        *,
        search: str | None = None,
        role: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        return await self.repo.list_users(
            search=search, role=role, status=status, limit=limit, offset=offset
        )

    async def create_user_admin(self, payload: AdminUserCreateRequest) -> User:
        user = await create_user_with_defaults(
            self.session,
            self.repo,
            username=payload.username,
            display_name=payload.display_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role=payload.role,
            status=payload.status,
        )
        await self._commit_user_safely()
        loaded = await self.repo.get_by_id(user.id)
        assert loaded is not None
        return loaded

    async def patch_user_admin(
        self,
        *,
        actor_id: UUID,
        target_user_id: UUID,
        payload: AdminUserPatchRequest,
    ) -> User:
        user = await self.get_profile(target_user_id)
        fields_set = payload.model_fields_set

        await self._apply_user_contact_updates(
            user=user,
            fields_set=fields_set,
            display_name=payload.display_name,
            email=payload.email,
            phone=payload.phone,
        )

        new_role = payload.role if "role" in fields_set and payload.role else user.role
        new_status = payload.status if "status" in fields_set and payload.status else user.status

        if user.id == actor_id and new_status != "ACTIVE":
            raise ConflictError(
                "Không thể tự khóa tài khoản Admin đang đăng nhập.",
                code="CANNOT_DISABLE_SELF",
            )
        if (
            user.role == "ADMIN"
            and user.status == "ACTIVE"
            and (new_role != "ADMIN" or new_status != "ACTIVE")
        ):
            if await self.repo.count_active_admins() <= 1:
                raise ConflictError(
                    "Phải giữ ít nhất một tài khoản Admin đang hoạt động.",
                    code="LAST_ADMIN_REQUIRED",
                )

        user.role = new_role
        user.status = new_status
        if "password" in fields_set and payload.password:
            user.password_hash = hash_password(payload.password)

        if user.status != "ACTIVE":
            await self.session_repo.revoke_all_for_user(user.id, utc_now())

        await self._commit_user_safely()
        loaded = await self.repo.get_by_id(user.id)
        assert loaded is not None
        return loaded

    async def disable_user_admin(self, *, actor_id: UUID, target_user_id: UUID) -> User:
        return await self.patch_user_admin(
            actor_id=actor_id,
            target_user_id=target_user_id,
            payload=AdminUserPatchRequest(status="DISABLED"),
        )

    async def _apply_user_contact_updates(
        self,
        *,
        user: User,
        fields_set: set[str],
        username: str | None = None,
        display_name: str | None,
        email: str | None,
        phone: str | None,
    ) -> None:
        if "username" in fields_set:
            clean_username, norm_username = normalize_username(username)
            if norm_username:
                existing = await self.repo.get_by_username_normalized(norm_username)
                if existing is not None and existing.id != user.id:
                    raise ConflictError(
                        "Tên tài khoản này đã được sử dụng.",
                        code="USERNAME_ALREADY_EXISTS",
                    )
            user.username = clean_username
            user.username_normalized = norm_username

        if "display_name" in fields_set:
            if not display_name or not display_name.strip():
                raise ValidationAppError("Display name cannot be empty.")
            user.display_name = display_name.strip()

        if "email" in fields_set:
            clean_email, norm_email = normalize_email(email)
            if norm_email:
                existing = await self.repo.get_by_email_normalized(norm_email)
                if existing is not None and existing.id != user.id:
                    raise ConflictError(
                        "Email này đã được sử dụng bởi tài khoản khác.",
                        code="EMAIL_ALREADY_EXISTS",
                    )
            user.email = clean_email
            user.email_normalized = norm_email

        if "phone" in fields_set:
            clean_phone, norm_phone = normalize_phone(phone)
            if norm_phone:
                existing = await self.repo.get_by_phone_normalized(norm_phone)
                if existing is not None and existing.id != user.id:
                    raise ConflictError(
                        "Số điện thoại này đã được sử dụng bởi tài khoản khác.",
                        code="PHONE_ALREADY_EXISTS",
                    )
            user.phone = clean_phone
            user.phone_normalized = norm_phone

        if user.email_normalized is None and user.phone_normalized is None:
            raise ValidationAppError(
                "Tài khoản phải giữ lại ít nhất Email hoặc Số điện thoại.",
                code="CONTACT_REQUIRED",
            )

    async def _commit_user_safely(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(
                "Email hoặc số điện thoại đã tồn tại trong hệ thống.",
                code="CONTACT_ALREADY_EXISTS",
            ) from exc
