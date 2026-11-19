from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import request_id_ctx


class AppError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class UnauthorizedError(AppError):
    def __init__(
        self,
        message: str = "Authentication required.",
        code: str = "UNAUTHORIZED",
    ) -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, code=code, message=message)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Access denied.", code: str = "FORBIDDEN") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, code=code, message=message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found.", code: str = "NOT_FOUND") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, code=code, message=message)


class ConflictError(AppError):
    def __init__(
        self,
        message: str = "Resource conflict.",
        code: str = "RESOURCE_CONFLICT",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            code=code,
            message=message,
            details=details,
        )


class ValidationAppError(AppError):
    def __init__(
        self,
        message: str = "Invalid request.",
        code: str = "VALIDATION_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            code=code,
            message=message,
            details=details,
        )


def _error_payload(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "request_id": request_id_ctx.get(),
    }


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(exc.code, exc.message, exc.details),
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    field_errors = [
        {
            "loc": [str(part) for part in err.get("loc", ())],
            "msg": err.get("msg", "Invalid value"),
            "type": err.get("type", "value_error"),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=_error_payload(
            "VALIDATION_ERROR",
            "Request validation failed.",
            {"fields": field_errors},
        ),
    )


async def unhandled_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload("INTERNAL_ERROR", "An unexpected internal error occurred."),
    )
