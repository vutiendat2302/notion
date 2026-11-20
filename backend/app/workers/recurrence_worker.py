"""Maintain a 60-day occurrence horizon without depending on API traffic."""

import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.db.engine import AsyncSessionLocal, engine
from app.modules.tasks.models.recurrence_rule import RecurrenceRule
from app.modules.tasks.models.task import Task
from app.modules.tasks.services.recurrence_service import RecurrenceService

logger = logging.getLogger(__name__)


async def replenish_once() -> tuple[int, int]:
    async with AsyncSessionLocal() as session:
        latest_version = (
            select(RecurrenceRule.rule_version)
            .where(RecurrenceRule.task_id == Task.id)
            .order_by(RecurrenceRule.rule_version.desc())
            .limit(1)
            .correlate(Task)
            .scalar_subquery()
        )
        result = await session.execute(
            select(Task.id, Task.user_id, RecurrenceRule.timezone)
            .join(RecurrenceRule, RecurrenceRule.task_id == Task.id)
            .where(
                Task.archived_at.is_(None),
                RecurrenceRule.rule_version == latest_version,
                RecurrenceRule.is_paused.is_(False),
            )
        )
        targets = list(result)

    processed = generated = 0
    for task_id, user_id, timezone in targets:
        try:
            through = datetime.now(ZoneInfo(timezone)).date() + timedelta(days=60)
            async with AsyncSessionLocal() as session:
                generated += await RecurrenceService(session).generate(user_id, task_id, through)
            processed += 1
        except Exception:
            logger.exception("Recurrence replenishment failed for task %s", task_id)
    return processed, generated


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    try:
        while True:
            processed, generated = await replenish_once()
            logger.info("Recurrence worker processed=%s generated=%s", processed, generated)
            await asyncio.sleep(3600)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
