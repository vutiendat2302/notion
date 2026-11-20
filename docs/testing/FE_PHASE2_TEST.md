# FE Phase 2 — Test report

Date: 2026-11-20. Branch: `feature/fe-phase2-planning-calendar`.

## Scope

- Planning views Year / Quarter / Month / ISO Week / Day from real occurrence data.
- Calendar month / week / day / list, timed and all-day events, Inbox drag, confirmation before schedule changes.
- Task detail: occurrence status, task edit, schedule, checklist, subtasks, dependencies, recurrence and progress.
- Tasks search, category/project filters, pagination; Today timezone and completed-today count.

## Automated checks run

| Check | Result | Evidence |
| --- | --- | --- |
| `corepack pnpm typecheck` | PASS | TypeScript completed with no errors. |
| `corepack pnpm lint` | PASS | ESLint completed with no errors or warnings. |
| `corepack pnpm test` | PASS | 8 tests in 2 files, including ISO week boundary, leap month and user timezone. |
| `corepack pnpm build` | PASS | Next.js production build generated all routes. |
| `git diff --check` | PASS | No whitespace errors. |
| Backend `pytest` on dedicated MySQL | PASS | 14 tests; integration tests use an outer transaction and rollback. |
| Backend Ruff and Pyright | PASS | Ruff check/format passed; Pyright reported 0 errors. |
| Playwright authenticated browser E2E | PASS | 1 end-to-end flow against the real MySQL-backed API through a rollback-only HTTP test server. |

## Runtime checks run

| Scenario | Result | Notes |
| --- | --- | --- |
| Isolated Backend health on `127.0.0.1:18000` | PASS | `/health/live` and `/health/ready` returned 200; ready reported database OK. Port 8000 belongs to another project and was not changed. |
| Unauthenticated `/users/me`, `/occurrences`, `/tasks` | PASS | All returned 401. CORS allowed only the temporary FE origin used for this check. |
| Calendar unauthenticated view | PASS | Headless Chrome displayed sign-in prompt. |
| Planning with temporary in-memory API responses | PASS | Headless Chrome displayed period navigation, counts, grouped occurrences and rollover control. |
| Calendar with temporary in-memory API responses | PASS | Headless Chrome displayed month grid, all-day item, timed item and Inbox backlog. |
| Task detail with temporary in-memory API responses | PASS | Browser opened task panel; status and editable fields rendered. |
| Mobile Calendar at 390 px width with temporary data | PASS | Page remained within viewport; calendar grid scrolls horizontally. |
| Authenticated browser flow against MySQL | PASS | Bootstrap, task create, checklist add/tick, occurrence start/complete/reopen, schedule, Planning rollover confirmation and Calendar display. |
| Test data cleanup | PASS | After the E2E server stopped, users, tasks, occurrences and checklist test tables contained zero test rows. |
| Production Compose on isolated project | PASS | Backend and recurrence worker healthy; FE returned 200 on `/`, `/planning`, `/calendar`; unauthenticated API returned 401. Bound to loopback ports 18000 and 3100. |
| Production same-origin authentication smoke | PASS | Owner login through FE `/api/v1`, authenticated `/users/me` 200 with expected account, logout revoked the session. |
| Public HTTPS via dedicated Cloudflare tunnel | PASS | `https://notion.vtdat.com/`, `/planning`, `/calendar` returned 200; `/api/v1/users/me` returned 401 when unauthenticated. |
| Public Chrome login and navigation | PASS | Signed in over HTTPS, opened Planning and Calendar, then logged out through the public API. |
| Isolation check | PASS | `oa`, `bot` and `api.vtdat.com` still pointed to the original Zalo Bot tunnel; its systemd service and MySQL/MinIO/Qdrant/OCR containers remained active and healthy. |

The earlier rendering checks used synthetic data. The later Playwright flow used real MySQL behind a transactional HTTP server and rolled back all writes when the server stopped. It covers the listed happy path; drag/resize, recurrence editing and cross-owner cases remain manual or backend-level checks.

## Manual acceptance scenarios for an owner account

Use the Web UI and the Postman requests in `docs/postman/02_be_phase2_task_workflows_postman.md`. Test against a dedicated test account or a transactional test database.

1. Create a one-off task in Inbox, find it with Tasks search and project/category filters, then schedule it in Calendar. Confirm only the selected occurrence moves.
2. Drag a timed event to another time, resize it, confirm the proposed time and verify the task detail reflects the saved schedule. Check overlap warning and cancel behavior.
3. Mark an occurrence done, reopen it, skip and cancel another occurrence. Verify Today and Planning counts refresh without changing the task definition.
4. Add checklist items, tick one occurrence and compare another occurrence of the same recurring task. States must stay independent.
5. Add a subtask and a dependency. Confirm a self-dependency or cycle is rejected with a visible backend error.
6. Create a recurrence rule, preview dates, pause/resume, then edit only future occurrences. Verify completed history is preserved and the old selected occurrence panel closes after a rule change.
7. Navigate ISO week `2026-W53` to `2027-W01`, leap February 2028, and switch user timezone. Verify displayed days and Today boundary.
8. Open Planning/Calendar on a narrow mobile viewport; use keyboard navigation and reduced-motion mode. Confirm loading, empty, error and unauthorized states.

## Current backend boundary

`/planning/periods/{type}/{key}` still returns a skeleton without saved plans or plan items, and `/calendar/events` still returns an empty projection. FE Phase 2 therefore presents and edits BE Phase 2 occurrences directly. Saved plan items, period review and server-side calendar range queries require the corresponding backend phase.
