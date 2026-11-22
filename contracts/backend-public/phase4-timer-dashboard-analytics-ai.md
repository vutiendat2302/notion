# Phase 4 Public API Contracts — Storage, Time Tracking, Habits/Goals, Analytics (19 Charts), Dashboards & AI Gateway

## 1. Storage (MinIO Object Keys: `users/<user_id>/<folder>/<file_id>`)
- `POST /api/v1/storage/upload` (`multipart/form-data`: `file`, `folder` in `avatars | sounds/countdown | sounds/finish | attachments | ai-uploads`) → `201 Created` (`FileRecordResponse`)
- `GET /api/v1/storage/sounds` → `200 OK` (default system sounds + user custom sounds)
- `GET /api/v1/storage/files/{file_id}/stream` → `200` / `206 Partial Content` (supports `Range` header, owner verified unless public system asset)

## 2. Time Tracking & Focus Timer
- `GET /api/v1/time-entries/active` → active `RUNNING` or `PAUSED` entry + `server_now`
- `GET /api/v1/time-entries` (`date_from`, `date_to`, `task_id`, `occurrence_id`) → list completed/active entries
- `POST /api/v1/time-entries/start` (`occurrence_id?`, `quick_task_title?`, `quick_task_scheduled_date?`, `planned_duration_seconds?`, `stop_existing?`) → `201 Created` (`409 ACTIVE_TIMER_EXISTS` if active & `!stop_existing`)
- `POST /api/v1/time-entries/{entry_id}/pause` → accumulates elapsed into `duration_seconds`, sets `status=PAUSED`
- `POST /api/v1/time-entries/{entry_id}/resume` → accumulates `paused_seconds`, sets `status=RUNNING`
- `POST /api/v1/time-entries/{entry_id}/complete` (`mark_occurrence_done?: bool = false`) → stops timer, computes actual `duration_seconds`, never forces `DONE` unless user explicitly requested

## 3. Habits & Goals
- `GET /api/v1/habits`, `POST /api/v1/habits`, `PATCH /api/v1/habits/{id}`, `POST /api/v1/habits/{id}/logs`
- `GET /api/v1/goals`, `POST /api/v1/goals`, `PATCH /api/v1/goals/{id}`, `POST /api/v1/goals/{id}/milestones`, `PATCH /api/v1/goals/{id}/milestones/{milestone_id}`, `POST /api/v1/goals/{id}/measurements`, `POST /api/v1/goals/{id}/links`

## 4. Analytics (Unified Active Day Streak + 19 Dynamic Chart Specs)
- `GET /api/v1/analytics/streak` → `current_streak`, `best_streak`, `consistency_30d`, `active_dates[]`
- `GET /api/v1/analytics/charts/{chart_key}` (`date`, `period_key`, `project_id`, `task_id`, `goal_id`, `habit_id`, `category_id`, `group_by`) → Fixed Chart Envelope

## 5. Custom Dashboards (Multi-Page Notion Paper Canvas & Linked Databases)
- `GET /api/v1/dashboards`, `POST /api/v1/dashboards` (`title`, `description?`, `is_default?`)
- `GET /api/v1/dashboards/default`, `PATCH /api/v1/dashboards/default`
- `GET /api/v1/dashboards/{dashboard_id}`, `PATCH /api/v1/dashboards/{dashboard_id}`, `DELETE /api/v1/dashboards/{dashboard_id}` (per-page `style_json` persists grid preset, guides, columns)
- `POST /api/v1/dashboards/default/widgets`, `PATCH /api/v1/dashboards/default/widgets/{widget_id}`, `DELETE /api/v1/dashboards/default/widgets/{widget_id}`
- `POST /api/v1/dashboards/{dashboard_id}/widgets`, `PATCH /api/v1/dashboards/{dashboard_id}/widgets/{widget_id}`, `DELETE /api/v1/dashboards/{dashboard_id}/widgets/{widget_id}`
  - Supports spatial `grid_col` / `grid_row` / `grid_col_span`, borders (`none|hairline|solid|dashed|dotted|double|shadow`, `border_width`, `border_color`), `SYNCED_REF` cross-page blocks, `COMPOSITE_CARD` custom slot layouts, and linked database blocks (`PLAN_DB`, `PROJECT_DB`, `TASK_DB`).
- `GET /api/v1/block-templates` → active template catalog (`COMPOSITE_CARD`, `PLAN_DB`, `PROJECT_DB`, forms, productivity widgets, 19 charts)
- `GET /api/v1/admin/block-templates`, `POST /api/v1/admin/block-templates`, `PATCH /api/v1/admin/block-templates/{template_id}`, `DELETE /api/v1/admin/block-templates/{template_id}` (Admin RBAC required)

## 6. AI Gateway & ActionProposals
- `GET /api/v1/ai/agents` → available agents (`local`: `qwen3:8b`, `claude`: `claude-sonnet-4-6`, `codex`: `gpt-5.4`, `gemini`: `gemini-3-flash-preview`) with `requires_api_key` & `server_configured` (no secret values exposed)
- `PATCH /api/v1/users/me/settings` (`ai.preferred_agent`, `ai.claude_api_key?`, `ai.openai_api_key?`, `ai.gemini_api_key?`) → stored per-user and returned masked (`has_*_key`, `*_key_hint`)
- `POST /api/v1/ai/chat` (`message`, `image_file_id?`, `conversation_id?`, `locale?`, `preferred_agent?`, `auto_confirm?: false`) → creates `ActionProposal` (`AWAITING_CONFIRMATION`) or returns grounded answer
- `POST /api/v1/ai/proposals/{proposal_id}/confirm` (`selected_indices?`, `edited_items?`, `Idempotency-Key` header) → executes `TaskService` creation in transaction
- `POST /api/v1/ai/proposals/{proposal_id}/reject`
