from functools import lru_cache
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV_FILE) if ROOT_ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Personal Productivity API"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    app_debug: bool = False
    default_timezone: str = "Asia/Ho_Chi_Minh"
    log_level: str = "INFO"

    # Database
    database_url: str | None = None
    mysql_host: str = "mysql"
    mysql_port: int = 3306
    mysql_host_port: int = 3307
    mysql_database: str = "productivity_db"
    mysql_user: str = "productivity_app"
    mysql_password: str = "CHANGE_ME_LOCAL_MYSQL_APP_PASSWORD"
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=5, ge=0, le=50)
    db_pool_timeout_seconds: int = Field(default=30, ge=1)

    # Auth & Security
    jwt_algorithm: str = "HS256"
    jwt_secret_key: str = "CHANGE_ME_LOCAL_JWT_SECRET_AT_LEAST_32_CHARS"
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=120)
    refresh_token_ttl_days: int = Field(default=14, ge=1, le=90)
    cookie_secure: bool = False
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Service-to-service
    s2s_signing_secret: str = "CHANGE_ME_LOCAL_S2S_SECRET_AT_LEAST_32_CHARS"
    ai_enabled: bool = False
    ai_service_base_url: str = "http://ai-service:8001"
    ai_request_timeout_seconds: int = 45

    @model_validator(mode="after")
    def validate_runtime_invariants(self) -> Settings:
        # Validate timezone
        ZoneInfo(self.default_timezone)
        if self.app_env == "production":
            if "CHANGE_ME" in self.jwt_secret_key or len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY must be set to a strong secret in production.")
            if "CHANGE_ME" in self.s2s_signing_secret or len(self.s2s_signing_secret) < 32:
                raise ValueError("S2S_SIGNING_SECRET must be configured in production.")
            if "CHANGE_ME" in self.mysql_password:
                raise ValueError("MYSQL_PASSWORD must be configured in production.")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    def build_sqlalchemy_url(self) -> str | URL:
        """Resolve MySQL async URL safely for both inside Docker and host-based tools."""
        in_docker = Path("/.dockerenv").exists()
        if self.database_url:
            if not in_docker and "@mysql:3306/" in self.database_url:
                return self.database_url.replace(
                    "@mysql:3306/", f"@127.0.0.1:{self.mysql_host_port}/"
                )
            return self.database_url
        host = self.mysql_host if in_docker else "127.0.0.1"
        port = self.mysql_port if in_docker else self.mysql_host_port
        return URL.create(
            drivername="mysql+asyncmy",
            username=self.mysql_user,
            password=self.mysql_password,
            host=host,
            port=port,
            database=self.mysql_database,
            query={"charset": "utf8mb4"},
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
