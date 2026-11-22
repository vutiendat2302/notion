from typing import Annotated

from fastapi import Cookie, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import get_db_session
from app.modules.users.models.user import User
from app.modules.users.repositories.user_repository import UserRepository


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    authorization: Annotated[str | None, Header()] = None,
    access_token_cookie: Annotated[str | None, Cookie(alias="access_token")] = None,
) -> User:
    raw_token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
    elif access_token_cookie:
        raw_token = access_token_cookie

    if not raw_token:
        raise UnauthorizedError("Authentication token is missing.", code="MISSING_ACCESS_TOKEN")

    user_id, _ = decode_access_token(raw_token)
    user = await UserRepository(session).get_by_id(user_id)
    if user is None or user.status != "ACTIVE":
        raise UnauthorizedError("Authenticated user is unavailable.", code="USER_UNAVAILABLE")
    return user


async def get_current_session_id(
    authorization: Annotated[str | None, Header()] = None,
    access_token_cookie: Annotated[str | None, Cookie(alias="access_token")] = None,
) -> str | None:
    raw_token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()
    elif access_token_cookie:
        raw_token = access_token_cookie
    if not raw_token:
        return None
    _, session_id = decode_access_token(raw_token)
    return str(session_id)


async def get_current_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "ADMIN":
        raise ForbiddenError("Administrator access required.", code="ADMIN_REQUIRED")
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
DBSession = Annotated[AsyncSession, Depends(get_db_session)]
