# FE Phase 3 — verification report

Date: 2026-11-20 · Branch: `feature/fe-phase3-workspaces`

## Scope and API boundaries

- Planning reads `GET /planning/periods/{type}/{key}`; saved plans and pinned occurrences use BE-3 plan APIs. Rollover uses preview and one idempotent confirmation transaction.
- Calendar events and timed conflict warnings come from BE-3 calendar APIs. Calendar still loads an occurrence catalog for task detail and unscheduled backlog; the view is capped at 10,000 catalog entries and reports truncation.
- Projects use the existing owner-scoped project and occurrence APIs. Project progress is completion of eligible occurrences in the displayed page, with the count and pagination limit shown. Estimated minutes are planned time; actual minutes are unavailable until BE-4.
- Settings persist theme, timezone, week start and working hours through `PATCH /users/me/settings`; categories use owner-scoped CRUD.
- Goals and Time Tracking routes in the current backend are skeletons. The frontend labels them unavailable and does not claim a local timer as recorded time.

## Automated verification

| Command | Result | Notes |
| --- | --- | --- |
| `corepack pnpm lint` | PASS | ESLint across frontend. |
| `corepack pnpm typecheck` | PASS | TypeScript `--noEmit`. |
| `corepack pnpm test` | PASS | 8 unit tests. |
| `corepack pnpm build` | PASS | Production Next.js build includes `/projects`, `/settings`, `/planning`, `/calendar`, `/goals`, `/time-tracking`. |
| `corepack pnpm test:e2e` | PASS | 2 Chrome tests, run against rollback-only FastAPI marker and test DB via `TransactionalProxySession`; no test rows committed. |

The FE-3 browser test creates a task, saves a week plan, pins and rolls over an occurrence, creates and edits a project, persists week start across reload, creates a category, checks Calendar, and follows the mobile Projects → Tasks link with the project filter applied. The FE-2 regression test verifies checklist, task status, scheduling, Planning and Calendar.

Login regression: the shared browser sign-in flow verifies that the password starts masked, can be shown and hidden without changing its value, and still signs in successfully. Both E2E tests passed again after this UI change.

After stopping the rollback-only server, a separate connection to the test database reported zero rows in `users`, `tasks`, `task_occurrences`, `planning_periods`, `projects` and `categories`.

Production smoke check: rebuilt and recreated only the `frontend` service in Compose project `notion-productivity-isolated`. The public URL returned HTTP 200 for `/`, `/projects`, `/planning` and `/settings`; an unauthenticated `/api/v1/users/me` returned the expected 401. A Chrome session signed in with the existing owner account and displayed Projects, Planning and Settings. The Zalo Bot containers remained running and healthy.

## Manual regression checklist

1. Sign in as the owner; check Planning for all five scopes and verify the displayed period boundaries follow the account timezone and week start.
2. Save a plan, reload, edit it from another tab, then attempt to save a stale version. The API should return a visible conflict; reload before retry.
3. Preview both `PIN` and `RESCHEDULE` rollover actions. Confirm one selection; refresh and ensure the occurrence is only moved once. Replaying the same idempotency key and body should not duplicate it.
4. Open Calendar, move a timed occurrence onto an occupied slot, and verify the server conflict count appears. Cancel and confirm a move; verify its new time after refresh.
5. Create/edit/archive a project and create/rename/recolor/archive a category; confirm data remains scoped to the authenticated account.
6. Save timezone, week start and theme. Reload and check Calendar/Planning reflect the persisted values.
7. At 375px width and with keyboard navigation, check the Projects form, Planning editor, rollover dialog and Settings controls remain usable.

## Open dependencies

- Full Focus Timer, manual entries, Goals progress, project milestones and Planned vs Actual comparison require BE-4 APIs. There is no persisted actual time to display in this phase.
- Large Calendar backlogs still use the capped occurrence catalog for selection and task details; range events are fetched from the server independently.
