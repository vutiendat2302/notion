import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.auth.services.auth_service import create_user_with_defaults
from app.modules.users.models.user import User
from app.modules.users.repositories.user_repository import UserRepository
from app.shared.contacts import normalize_email, normalize_username

logger = logging.getLogger(__name__)


async def ensure_default_admin(session: AsyncSession) -> User | None:
    """Idempotently seed the default admin account when absent."""
    settings = get_settings()
    _, norm_email = normalize_email(settings.default_admin_email)
    clean_username, norm_username = normalize_username(settings.default_admin_username)
    if not norm_email:
        return None

    user_repo = UserRepository(session)
    existing = await user_repo.get_by_email_normalized(norm_email)
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

    admin = await create_user_with_defaults(
        session,
        user_repo,
        username=clean_username,
        display_name=settings.default_admin_display_name,
        email=settings.default_admin_email,
        phone=None,
        password=settings.default_admin_password,
        role="ADMIN",
        status="ACTIVE",
    )
    await session.commit()
    logger.info("Seeded default admin account: %s (username=%s)", norm_email, clean_username)
    return admin
