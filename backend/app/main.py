from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

import app.db.models  # noqa: F401
from app.api.router import api_v1_router
from app.core.config import get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import configure_logging, request_id_ctx
from app.db.engine import AsyncSessionLocal, engine
from app.modules.auth.services.admin_seed_service import ensure_default_accounts
from app.modules.internal_tools.api.tools_router import router as internal_tools_router

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/bootstrap",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
}


def _extract_origin(request: Request) -> str | None:
    origin = request.headers.get("Origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("Referer")
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return None


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    if settings.app_env != "test":
        async with AsyncSessionLocal() as session:
            await ensure_default_accounts(session)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_and_csrf_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # 1. Origin + CSRF protection for browser cookie-authenticated mutations
        if request.method not in _SAFE_METHODS:
            has_bearer = request.headers.get("Authorization", "").lower().startswith("bearer ")
            if not has_bearer:
                request_origin = _extract_origin(request)
                allowed_origins = {o.rstrip("/") for o in settings.cors_origins_list}
                host_header = request.headers.get("Host")
                if host_header:
                    allowed_origins.add(f"{request.url.scheme}://{host_header}")
                if request_origin and request_origin not in allowed_origins:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={
                            "error": {
                                "code": "CSRF_ORIGIN_MISMATCH",
                                "message": "Untrusted request origin.",
                                "details": None,
                            },
                            "request_id": request_id_ctx.get(),
                        },
                    )

                cookie_csrf = request.cookies.get("csrf_token")
                header_csrf = request.headers.get("X-CSRF-Token")
                if (
                    cookie_csrf
                    and request_origin
                    and request.url.path not in _CSRF_EXEMPT_PATHS
                    and header_csrf != cookie_csrf
                ):
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={
                            "error": {
                                "code": "CSRF_TOKEN_INVALID",
                                "message": "Invalid or missing CSRF token.",
                                "details": None,
                            },
                            "request_id": request_id_ctx.get(),
                        },
                    )

        req_id = request.headers.get("X-Request-ID") or f"req_{uuid4().hex[:16]}"
        token = request_id_ctx.set(req_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            return response
        finally:
            request_id_ctx.reset(token)

    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)

    @app.get("/health/live", tags=["health"])
    async def health_live() -> dict[str, str]:
        return {"status": "alive"}

    @app.get("/health/ready", tags=["health"])
    async def health_ready() -> Response:
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "ready", "database": "ok"},
            )
        except Exception:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "degraded", "database": "unavailable"},
            )

    app.include_router(api_v1_router)
    app.include_router(internal_tools_router)
    return app


app = create_app()
