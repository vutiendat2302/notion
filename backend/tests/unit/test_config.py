import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_accepts_configured_database_url_without_duplicate_password() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret_key="j" * 32,
        s2s_signing_secret="s" * 32,
        database_url="mysql+asyncmy://app:configured@mysql:3306/productivity_db",
        mysql_password="CHANGE_ME_LOCAL_MYSQL_APP_PASSWORD",
    )
    assert settings.database_url is not None


def test_production_rejects_placeholder_database_credentials() -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL must be configured"):
        Settings(
            app_env="production",
            jwt_secret_key="j" * 32,
            s2s_signing_secret="s" * 32,
            database_url="mysql+asyncmy://app:CHANGE_ME@mysql:3306/productivity_db",
        )
