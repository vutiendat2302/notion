from enum import StrEnum

from app.core.exceptions import ConflictError


class OccurrenceStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"


ALLOWED_TRANSITIONS: dict[OccurrenceStatus, set[OccurrenceStatus]] = {
    OccurrenceStatus.NOT_STARTED: {
        OccurrenceStatus.IN_PROGRESS,
        OccurrenceStatus.DONE,
        OccurrenceStatus.SKIPPED,
        OccurrenceStatus.CANCELLED,
    },
    OccurrenceStatus.IN_PROGRESS: {
        OccurrenceStatus.NOT_STARTED,
        OccurrenceStatus.DONE,
        OccurrenceStatus.SKIPPED,
        OccurrenceStatus.CANCELLED,
    },
    OccurrenceStatus.DONE: {
        OccurrenceStatus.NOT_STARTED,
    },
    OccurrenceStatus.SKIPPED: {
        OccurrenceStatus.NOT_STARTED,
    },
    OccurrenceStatus.CANCELLED: {
        OccurrenceStatus.NOT_STARTED,
    },
}


def ensure_valid_transition(current: str, target: OccurrenceStatus) -> None:
    current_enum = OccurrenceStatus(current)
    if current_enum == target:
        return
    if target not in ALLOWED_TRANSITIONS[current_enum]:
        raise ConflictError(
            f"Cannot transition occurrence from {current_enum.value} to {target.value}.",
            code="INVALID_OCCURRENCE_TRANSITION",
        )
