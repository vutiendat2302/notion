import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.auth.services.auth_service import create_user_with_defaults
from app.modules.users.models.user import User
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.contacts import normalize_email, normalize_username

logger = logging.getLogger(__name__)


async def _ensure_account(
    session: AsyncSession,
    *,
    email: str,
    username: str,
    password: str,
    display_name: str,
    role: str,
) -> User | None:
    _, norm_email = normalize_email(email)
    clean_username, norm_username = normalize_username(username)
    if not norm_email:
        return None

    user_repo = UserRepository(session)
    existing = await user_repo.get_by_email_normalized(norm_email)
    if existing is None and norm_username:
        existing = await user_repo.get_by_username_normalized(norm_username)

    if existing is not None:
        if (
            norm_username
            and not existing.username_normalized
            and await user_repo.get_by_username_normalized(norm_username) is None
        ):
            existing.username = clean_username
            existing.username_normalized = norm_username
            await session.commit()
        return existing

    account = await create_user_with_defaults(
        session,
        user_repo,
        username=clean_username,
        display_name=display_name,
        email=email,
        phone=None,
        password=password,
        role=role,
        status="ACTIVE",
    )
    await session.commit()
    logger.info("Seeded default %s account: %s (username=%s)", role, norm_email, clean_username)
    return account


async def ensure_default_admin(session: AsyncSession) -> User | None:
    """Idempotently seed the default admin account when absent."""
    settings = get_settings()
    return await _ensure_account(
        session,
        email=settings.default_admin_email,
        username=settings.default_admin_username,
        password=settings.default_admin_password,
        display_name=settings.default_admin_display_name,
        role="ADMIN",
    )


async def ensure_default_user(session: AsyncSession) -> User | None:
    """Idempotently seed the default standard user account when absent."""
    settings = get_settings()
    return await _ensure_account(
        session,
        email=settings.default_user_email,
        username=settings.default_user_username,
        password=settings.default_user_password,
        display_name=settings.default_user_display_name,
        role="USER",
    )


async def ensure_default_accounts(session: AsyncSession) -> tuple[User | None, User | None]:
    """Idempotently seed both default admin and default user accounts."""
    admin = await ensure_default_admin(session)
    member = await ensure_default_user(session)
    return admin, member
