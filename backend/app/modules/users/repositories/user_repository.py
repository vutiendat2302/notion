from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models.user import User, UserSettings


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def count_users(self) -> int:
        from sqlalchemy import func

        stmt = select(func.count()).select_from(User)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def get_by_id(self, user_id: UUID) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email_normalized(self, email_normalized: str) -> User | None:
        stmt = select(User).where(User.email_normalized == email_normalized)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_settings_by_user_id(self, user_id: UUID) -> UserSettings | None:
        stmt = select(UserSettings).where(UserSettings.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add_user(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    async def add_settings(self, settings: UserSettings) -> UserSettings:
        self.session.add(settings)
        await self.session.flush()
        return settings
