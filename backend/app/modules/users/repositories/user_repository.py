from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models.user import User, UserSettings


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def count_users(self) -> int:
        stmt = select(func.count()).select_from(User)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def count_active_admins(self) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .where(User.role == "ADMIN", User.status == "ACTIVE")
        )
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

    async def get_by_username_normalized(self, username_normalized: str) -> User | None:
        stmt = select(User).where(User.username_normalized == username_normalized)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_phone_normalized(self, phone_normalized: str) -> User | None:
        stmt = select(User).where(User.phone_normalized == phone_normalized)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_users(
        self,
        *,
        search: str | None = None,
        role: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        conditions = []
        if role:
            conditions.append(User.role == role)
        if status:
            conditions.append(User.status == status)
        if search:
            pattern = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.display_name.ilike(pattern),
                    User.username.ilike(pattern),
                    User.email.ilike(pattern),
                    User.phone.ilike(pattern),
                )
            )

        count_stmt = select(func.count()).select_from(User)
        list_stmt = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        for cond in conditions:
            count_stmt = count_stmt.where(cond)
            list_stmt = list_stmt.where(cond)

        total = int((await self.session.execute(count_stmt)).scalar_one())
        rows = list((await self.session.execute(list_stmt)).scalars().all())
        return rows, total

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
