from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationAppError
from app.modules.users.models.user import User, UserSettings
from app.modules.users.repositories.user_repository import UserRepository
from app.modules.users.schemas.requests.settings_patch import UserSettingsPatchRequest


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    async def get_profile(self, user_id: UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.", code="USER_NOT_FOUND")
        return user

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
