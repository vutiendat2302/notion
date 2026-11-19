from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import BINARY, DateTime
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class UUIDBinary16(TypeDecorator[UUID]):
    """Store Python UUID (UUIDv7) as MySQL BINARY(16) in standard network byte order."""

    impl = BINARY(16)
    cache_ok = True

    def process_bind_param(
        self, value: UUID | str | bytes | None, dialect: Dialect
    ) -> bytes | None:
        if value is None:
            return None
        if isinstance(value, UUID):
            return value.bytes
        if isinstance(value, bytes):
            if len(value) != 16:
                raise ValueError("UUID bytes must be exactly 16 bytes.")
            return value
        return UUID(value).bytes

    def process_result_value(self, value: Any, dialect: Dialect) -> UUID | None:
        if value is None:
            return None
        if isinstance(value, UUID):
            return value
        return UUID(bytes=bytes(value))


class UTCDateTime(TypeDecorator[datetime]):
    """Store UTC-aware Python datetimes as MySQL DATETIME(6) without implicit timezone drift."""

    impl = DateTime(timezone=False)
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "mysql":
            from sqlalchemy.dialects.mysql import DATETIME

            return dialect.type_descriptor(DATETIME(fsp=6))
        return dialect.type_descriptor(DateTime(timezone=False))

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: Any, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=UTC)
            return value.astimezone(UTC)
        raise TypeError(f"Expected datetime from DB, got {type(value)!r}")
