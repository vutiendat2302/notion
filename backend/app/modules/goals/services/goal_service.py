from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.db.base import new_uuid7, utc_now
from app.db.extended_models import goal_measurements, goal_milestones
from app.modules.goals.models.goal import Goal, GoalLink
from app.modules.goals.schemas.goal_schemas import (
    GoalCreateRequest,
    GoalLinkCreateRequest,
    GoalLinkResponse,
    GoalMeasurementCreateRequest,
    GoalMilestoneCreateRequest,
    GoalMilestonePatchRequest,
    GoalMilestoneResponse,
    GoalPatchRequest,
    GoalResponse,
)
from app.modules.projects.repositories.project_repository import ProjectRepository
from app.modules.tasks.models.task import Task
from app.modules.tasks.models.task_occurrence import TaskOccurrence
from app.modules.tasks.repositories.task_repository import TaskRepository


class GoalService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_goals(self, user_id: UUID, include_archived: bool = False) -> list[GoalResponse]:
        stmt = select(Goal).where(Goal.user_id == user_id).order_by(Goal.created_at.desc())
        if not include_archived:
            stmt = stmt.where(Goal.archived_at.is_(None))
        rows = (await self.session.execute(stmt)).scalars().all()
        return [await self._serialize_goal(user_id, goal) for goal in rows]

    async def create_goal(self, user_id: UUID, payload: GoalCreateRequest) -> GoalResponse:
        goal = Goal(
            id=new_uuid7(),
            user_id=user_id,
            category_id=payload.category_id,
            title=payload.title.strip(),
            description=payload.description,
            goal_type=payload.goal_type,
            metric_unit=payload.metric_unit,
            target_value=payload.target_value,
            baseline_value=payload.baseline_value,
            measurement_mode=payload.measurement_mode,
            start_date=payload.start_date,
            end_date=payload.end_date,
            status=payload.status,
        )
        self.session.add(goal)
        await self.session.commit()
        await self.session.refresh(goal)
        return await self._serialize_goal(user_id, goal)

    async def patch_goal(
        self, user_id: UUID, goal_id: UUID, payload: GoalPatchRequest
    ) -> GoalResponse:
        goal = await self._get_owned_goal(user_id, goal_id)
        if payload.expected_version is not None and goal.version != payload.expected_version:
            raise ConflictError("Goal version conflict.", code="STALE_VERSION")

        for field in ("title", "description", "category_id", "target_value", "status", "end_date"):
            if field in payload.model_fields_set:
                val = getattr(payload, field)
                setattr(goal, field, val.strip() if isinstance(val, str) else val)
        if "archived" in payload.model_fields_set and payload.archived is not None:
            goal.archived_at = utc_now() if payload.archived else None
        goal.version += 1
        await self.session.commit()
        await self.session.refresh(goal)
        return await self._serialize_goal(user_id, goal)

    async def add_milestone(
        self, user_id: UUID, goal_id: UUID, payload: GoalMilestoneCreateRequest
    ) -> GoalMilestoneResponse:
        await self._get_owned_goal(user_id, goal_id)
        now = utc_now()
        ms_id = new_uuid7()
        await self.session.execute(
            insert(goal_milestones).values(
                id=ms_id,
                user_id=user_id,
                goal_id=goal_id,
                title=payload.title.strip(),
                target_date=payload.target_date,
                status="PENDING",
                sort_order=payload.sort_order,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        row = (
            await self.session.execute(select(goal_milestones).where(goal_milestones.c.id == ms_id))
        ).first()
        assert row is not None
        return self._milestone_to_response(row)

    async def patch_milestone(
        self,
        user_id: UUID,
        goal_id: UUID,
        milestone_id: UUID,
        payload: GoalMilestonePatchRequest,
    ) -> GoalMilestoneResponse:
        await self._get_owned_goal(user_id, goal_id)
        row = (
            await self.session.execute(
                select(goal_milestones).where(
                    goal_milestones.c.id == milestone_id,
                    goal_milestones.c.goal_id == goal_id,
                    goal_milestones.c.user_id == user_id,
                )
            )
        ).first()
        if row is None:
            raise NotFoundError("Milestone not found.", code="MILESTONE_NOT_FOUND")
        now = utc_now()
        values: dict[str, Any] = {"updated_at": now}
        if "title" in payload.model_fields_set and payload.title:
            values["title"] = payload.title.strip()
        if "target_date" in payload.model_fields_set:
            values["target_date"] = payload.target_date
        if "status" in payload.model_fields_set and payload.status:
            values["status"] = payload.status
            values["completed_at"] = now if payload.status == "COMPLETED" else None

        await self.session.execute(
            update(goal_milestones).where(goal_milestones.c.id == milestone_id).values(**values)
        )
        await self.session.commit()
        updated = (
            await self.session.execute(
                select(goal_milestones).where(goal_milestones.c.id == milestone_id)
            )
        ).first()
        assert updated is not None
        return self._milestone_to_response(updated)

    async def add_measurement(
        self, user_id: UUID, goal_id: UUID, payload: GoalMeasurementCreateRequest
    ) -> GoalResponse:
        goal = await self._get_owned_goal(user_id, goal_id)
        now = utc_now()
        idem_key = payload.idempotency_key or str(new_uuid7())
        await self.session.execute(
            insert(goal_measurements).values(
                id=new_uuid7(),
                user_id=user_id,
                goal_id=goal_id,
                measured_value=payload.measured_value,
                measured_at=now,
                source="MANUAL",
                note=payload.note,
                idempotency_key=idem_key,
                created_at=now,
            )
        )
        await self.session.commit()
        return await self._serialize_goal(user_id, goal)

    async def add_link(
        self, user_id: UUID, goal_id: UUID, payload: GoalLinkCreateRequest
    ) -> GoalLinkResponse:
        await self._get_owned_goal(user_id, goal_id)
        if payload.project_id is not None:
            proj = await ProjectRepository(self.session).get_by_id_and_user(
                payload.project_id, user_id
            )
            if proj is None:
                raise NotFoundError("Project not found.", code="PROJECT_NOT_FOUND")
            target_key = f"PROJECT:{payload.project_id}"
        else:
            assert payload.task_id is not None
            task = await TaskRepository(self.session).get_task_by_id_and_user(
                payload.task_id, user_id
            )
            if task is None:
                raise NotFoundError("Task not found.", code="TASK_NOT_FOUND")
            target_key = f"TASK:{payload.task_id}"

        existing = (
            await self.session.execute(
                select(GoalLink).where(
                    GoalLink.goal_id == goal_id, GoalLink.target_key == target_key
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            return GoalLinkResponse(
                id=existing.id,
                goal_id=existing.goal_id,
                project_id=existing.project_id,
                task_id=existing.task_id,
                target_key=existing.target_key,
            )

        link = GoalLink(
            id=new_uuid7(),
            goal_id=goal_id,
            project_id=payload.project_id,
            task_id=payload.task_id,
            target_key=target_key,
            weight=payload.weight,
        )
        self.session.add(link)
        await self.session.commit()
        return GoalLinkResponse(
            id=link.id,
            goal_id=link.goal_id,
            project_id=link.project_id,
            task_id=link.task_id,
            target_key=link.target_key,
        )

    async def _get_owned_goal(self, user_id: UUID, goal_id: UUID) -> Goal:
        goal = (
            await self.session.execute(
                select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
            )
        ).scalar_one_or_none()
        if goal is None:
            raise NotFoundError("Goal not found.", code="GOAL_NOT_FOUND")
        return goal

    async def _serialize_goal(self, user_id: UUID, goal: Goal) -> GoalResponse:
        ms_rows = (
            await self.session.execute(
                select(goal_milestones)
                .where(goal_milestones.c.goal_id == goal.id, goal_milestones.c.user_id == user_id)
                .order_by(goal_milestones.c.sort_order.asc(), goal_milestones.c.created_at.asc())
            )
        ).fetchall()
        milestones = [self._milestone_to_response(r) for r in ms_rows]

        link_rows = (
            (await self.session.execute(select(GoalLink).where(GoalLink.goal_id == goal.id)))
            .scalars()
            .all()
        )
        links = [
            GoalLinkResponse(
                id=link.id,
                goal_id=link.goal_id,
                project_id=link.project_id,
                task_id=link.task_id,
                target_key=link.target_key,
            )
            for link in link_rows
        ]

        meas_rows = (
            await self.session.execute(
                select(goal_measurements)
                .where(
                    goal_measurements.c.goal_id == goal.id,
                    goal_measurements.c.user_id == user_id,
                )
                .order_by(goal_measurements.c.measured_at.asc())
            )
        ).fetchall()

        current_val = goal.baseline_value
        if meas_rows:
            current_val = sum(
                (Decimal(str(m.measured_value)) for m in meas_rows), goal.baseline_value
            )
        elif goal.goal_type == "MILESTONE_BASED" and milestones:
            completed = sum(1 for m in milestones if m.status == "COMPLETED")
            current_val = (
                Decimal(completed) / Decimal(len(milestones)) * goal.target_value
            ).quantize(Decimal("0.01"))
        elif links:
            linked_project_ids = [link.project_id for link in links if link.project_id is not None]
            linked_task_ids = [link.task_id for link in links if link.task_id is not None]
            done_count = 0
            total_count = 0
            if linked_project_ids:
                occ_rows = (
                    (
                        await self.session.execute(
                            select(TaskOccurrence.status)
                            .join(Task, TaskOccurrence.task_id == Task.id)
                            .where(
                                TaskOccurrence.user_id == user_id,
                                Task.project_id.in_(linked_project_ids),
                                TaskOccurrence.status.notin_(["SKIPPED", "CANCELLED"]),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                total_count += len(occ_rows)
                done_count += sum(1 for s in occ_rows if s == "DONE")
            if linked_task_ids:
                occ_rows2 = (
                    (
                        await self.session.execute(
                            select(TaskOccurrence.status).where(
                                TaskOccurrence.user_id == user_id,
                                TaskOccurrence.task_id.in_(linked_task_ids),
                                TaskOccurrence.status.notin_(["SKIPPED", "CANCELLED"]),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                total_count += len(occ_rows2)
                done_count += sum(1 for s in occ_rows2 if s == "DONE")
            if total_count > 0:
                current_val = (
                    Decimal(done_count) / Decimal(total_count) * goal.target_value
                ).quantize(Decimal("0.01"))

        pct = 0.0
        if goal.target_value > 0:
            pct = float(
                min(Decimal("100"), max(Decimal("0"), current_val / goal.target_value * 100))
            )

        return GoalResponse(
            id=goal.id,
            title=goal.title,
            description=goal.description,
            category_id=goal.category_id,
            goal_type=goal.goal_type,
            metric_unit=goal.metric_unit,
            target_value=goal.target_value,
            baseline_value=goal.baseline_value,
            measurement_mode=goal.measurement_mode,
            start_date=goal.start_date,
            end_date=goal.end_date,
            status=goal.status,
            version=goal.version,
            current_value=current_val,
            progress_percent=round(pct, 1),
            milestones=milestones,
            links=links,
            archived_at=goal.archived_at,
            created_at=goal.created_at,
        )

    def _milestone_to_response(self, row: Any) -> GoalMilestoneResponse:
        return GoalMilestoneResponse(
            id=row.id,
            goal_id=row.goal_id,
            title=str(row.title),
            target_date=row.target_date,
            status=str(row.status),
            completed_at=row.completed_at,
            sort_order=int(row.sort_order),
        )
