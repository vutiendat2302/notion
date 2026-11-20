# Backend public API v1 — BE-3 Planning and Calendar

The FastAPI request/response DTOs in `backend/app/modules/planning/schemas/` and `backend/app/modules/calendar/schemas/` generate the OpenAPI source for these `/api/v1` routes. JSON names use `snake_case`; IDs are UUID strings, dates are `YYYY-MM-DD`, and instants are ISO 8601 with an offset. Every route requires the authenticated owner context.

## Planning

| Method | Path | Effect |
| --- | --- | --- |
| GET | `/planning/periods/{period_type}/{period_key}` | Dynamic period view; does not create a row. |
| PUT | `/planning/periods/{period_type}/{period_key}/plan` | Create/update saved focus, notes and status. |
| POST | `/planning/plans/{plan_id}/items` | Pin one owned task, occurrence, project or goal. |
| PATCH | `/planning/plans/{plan_id}/items/{item_id}` | Update rank or commitment. |
| DELETE | `/planning/plans/{plan_id}/items/{item_id}` | Remove the pin, preserving the target. |
| POST | `/planning/periods/{period_type}/{period_key}/rollover/preview` | Return eligible pending occurrences and the next period. |
| POST | `/planning/rollovers/confirm` | Apply `PIN` or `RESCHEDULE` in one transaction. Requires `Idempotency-Key`. |

Canonical keys: `YEAR=2026`, `QUARTER=2026-Q4`, `MONTH=2026-11`, `WEEK=2026-W47` (ISO week number), `DAY=2026-11-19`. Bounds are `[start_date, end_date_exclusive)` in the user's timezone. The ISO week key stays stable when `week_starts_on` changes; the returned boundaries reflect the preference. Saved-plan boundaries are a snapshot from when the plan was created.

`occurrences` in a period include schedule, start-time or due-time matches, deduplicated by occurrence ID. `overdue_occurrences` contains pending work before the period and excludes IDs already in `occurrences`. `planned_focus_minutes` sums estimates for non-cancelled/non-skipped occurrences; it is planned time, not time tracked.

For `PUT /plan`, `expected_version` is optional for creation and checked on updates. Plan item writes increment the plan version. `PIN` creates a target-period plan item without changing the task or occurrence. `RESCHEDULE` moves the selected occurrence to the next period start, preserving its local start time and duration when timed. A `DONE`, `SKIPPED` or `CANCELLED` occurrence cannot be rolled over. Confirmation checks every selected `expected_version`; a stale selection returns `409`. A replay with the same user, key and body returns the stored response with `replayed=true`; the same key with a different body returns `409`.

## Calendar

| Method | Path | Effect |
| --- | --- | --- |
| GET | `/calendar/events?start=&end=` | All-day occurrences, timed occurrences and due markers; end date exclusive, maximum 366 days. |
| GET | `/calendar/conflicts?start_at=&end_at=&exclude_occurrence_id=` | Timed overlap warning; both instants require offsets. |

Event projection excludes archived tasks and cancelled occurrences. An occurrence can have one timed or all-day event plus an independent due marker. Overlap uses half-open instants: `existing.start_at < requested.end_at` and `existing.end_at > requested.start_at`. A boundary touch is not a conflict. Conflict checks are advisory; the occurrence PATCH endpoint remains the write owner.

## Errors and compatibility

Errors use the existing envelope `{ "error": { "code": ..., "message": ..., "details": ... }, "request_id": ... }`. Missing auth returns `401`; invalid keys/dates/windows return `422`; foreign/missing resources return `404`; duplicate pins, stale versions and reused idempotency keys return `409`. The existing `/planning/periods/*` and `/calendar/events` paths remain, now returning real projections. Their previous `user_id` fields remain in the response.
