# BE Phase 3 — Planning and Calendar verification

Date: 2026-11-20. Branch: `feature/be-phase3-planning-calendar`.

## Scope

- Canonical year/quarter/month/ISO-week/day period parsing, user timezone and `week_starts_on`.
- Dynamic period overview, saved plan and priority item CRUD.
- Preview/confirm rollover (`PIN` or `RESCHEDULE`) with occurrence version and idempotency checks.
- Calendar all-day/timed/due projections and timed overlap warnings.
- Today occurrence selection includes due-only work without duplicate rows.

## Automated verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Alembic upgrade on isolated MySQL 8.4 test DB | PASS | Applied revisions `0001`, `0002`, `818a88551072`; no production schema changed. |
| `alembic check` | PASS | No new upgrade operations detected; M4 planning and M13 idempotency tables already exist. |
| Backend pytest | PASS | 24 tests, including 10 BE-3 unit/API/contract cases; all DB writes run through `TransactionalProxySession`. |
| Ruff check and format | PASS | All backend source and test files passed. |
| Pyright | PASS | 0 errors, 0 warnings. |
| Post-test row count | PASS | Test DB `users`, `tasks`, `task_occurrences`, `planning_periods`, `plan_items`, `idempotency_keys` each had 0 rows. |
| Production schema check | PASS | Dedicated Notion DB reported Alembic `818a88551072 (head)` before backend replacement. |
| Production backend deployment | PASS | Only `notion-productivity-isolated-backend-1` was rebuilt/recreated; its healthcheck became healthy. No production migration ran. |
| Public HTTPS smoke | PASS | Owner login, read-only Planning/Calendar/Conflicts requests and logout returned 200 through `https://notion.vtdat.com/api/v1`. |

## Behavior covered

- `2026-W49` runs across November/December; `2026-W53` advances to `2027-W01`. Sunday week start shifts boundaries without changing the ISO key.
- Reading an unsaved period does not create a database row. Saved plan version conflicts return 409. Plan item duplicate and foreign target IDs are rejected.
- An occurrence matching both scheduled and due dates appears once in a period. Planned focus minutes use estimates and exclude skipped/cancelled occurrences.
- Completed occurrences are excluded from rollover preview. Replaying the same idempotency key/body returns the stored result; changing the body returns 409. Rescheduling preserves local start time and duration, moves only the selected occurrence, and leaves the task definition intact.
- Calendar separates timed/all-day occurrences from due markers. Overlap uses half-open intervals; a boundary touch is allowed. Foreign user occurrences do not appear in another user's period or calendar, and a foreign exclusion ID returns 404.
- Today includes due-only work, with each occurrence counted once even when it has both schedule and due fields.
- OpenAPI contains typed BE-3 responses and a required `Idempotency-Key` on rollover confirmation.

## Limits and operational notes

- Calendar conflict checks are advisory; a concurrent schedule edit after the check can still change the situation.
- FE Phase 2 continues to render occurrences directly. The new saved-plan and calendar-projection APIs are available for a later FE integration.
- No new migration was created because all required tables and constraints already exist. Production schema must be at Alembic head before deploying this backend release.
- Postman instructions: `docs/postman/03_be_phase3_planning_calendar_postman.md`.
