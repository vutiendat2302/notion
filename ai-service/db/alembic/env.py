import asyncio
import os

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from ai_db.models import Base
from alembic import context

config = context.config
target_metadata = Base.metadata


def database_url() -> str:
    url = os.getenv("AI_METADATA_MIGRATION_URL")
    if not url:
        raise RuntimeError("AI_METADATA_MIGRATION_URL is required")
    return url


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = database_url()
    engine = async_engine_from_config(
        configuration, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    async with engine.connect() as connection:

        def migrate(conn: object) -> None:
            context.configure(
                connection=conn, target_metadata=target_metadata, compare_type=True
            )
            with context.begin_transaction():
                context.run_migrations()

        await connection.run_sync(migrate)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=database_url(), target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_async_migrations())
