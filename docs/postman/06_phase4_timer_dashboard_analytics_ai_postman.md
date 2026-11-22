# Postman Test Guide — Phase 4: Storage, Focus Timer, Habits, Goals, Streak, 19 Charts, Dashboards & AI Gateway

> Quy ước dự án: **Chỉ dùng Postman Collection / Postman UI / Environment variables.** Tuyệt đối không dùng lệnh CLI HTTP client.  
> Environment sử dụng: **`notion`** (`base_url = http://127.0.0.1:8010`)

---

## Biến Environment mới cần có trong `notion`

- `user_username` = `user`
- `user_email` = `user@dat.local`
- `user_password` = `dat123456`
- `uploaded_file_id` (lưu tự động sau request upload)
- `time_entry_id` (lưu tự động sau khi start timer)
- `created_habit_id` (lưu tự động sau khi tạo habit)
- `created_goal_id` (lưu tự động sau khi tạo goal)
- `ai_proposal_id` (lưu tự động sau khi gọi AI chat)

---

## Folder `05. Storage, Sounds & Profile (/storage)`

### 1. List Sound Catalog
- **Method & URL:** `GET {{base_url}}/api/v1/storage/sounds`
- **Auth:** Bearer Token `{{access_token}}`
- **Assertions (Tests):** Status `200`, `defaults` chứa `default-countdown` và `default-finish`.

### 2. Upload File (Avatar hoặc Sound `.mp3`/`.mp4` hoặc Ảnh Chat)
- **Method & URL:** `POST {{base_url}}/api/v1/storage/upload?folder=avatars`
- **Auth:** Bearer Token `{{access_token}}`
- **Body (`form-data`):** Key `file` (Type = File) -> chọn ảnh PNG/JPEG hoặc audio MP3/MP4.
- **Expected:** `201 Created`, trả về `id`, `object_key` dạng `users/<user_id>/avatars/<file_id>`, `stream_url`.

### 3. Stream Media (HTTP Range)
- **Method & URL:** `GET {{base_url}}/api/v1/storage/files/{{uploaded_file_id}}/stream`
- **Auth:** Bearer Token `{{access_token}}`
- **Expected:** `200 OK` hoặc `206 Partial Content` với `Accept-Ranges: bytes`.

---

## Folder `06. Focus Timer & Time Entries (/time-entries)`

### 1. Get Active Timer (khôi phục sau refresh/mở lại trình duyệt)
- **Method & URL:** `GET {{base_url}}/api/v1/time-entries/active`
- **Auth:** Bearer Token `{{access_token}}`
- **Expected:** `200 OK`, trả về `{ "active_entry": null }` hoặc active timer kèm `server_now` và `effective_elapsed_seconds`.

### 2. Start Focus Timer
- **Method & URL:** `POST {{base_url}}/api/v1/time-entries/start`
- **Auth:** Bearer Token `{{access_token}}`
- **Body (`raw` JSON):**
```json
{
  "quick_task_title": "Deep Work API Review",
  "quick_task_scheduled_date": "2026-11-22",
  "planned_duration_seconds": 1500,
  "stop_existing": true
}
```
- **Expected:** `201 Created`, trạng thái `RUNNING`, trả về `planned_duration_seconds = 1500`.

### 3. Pause Timer
- **Method & URL:** `POST {{base_url}}/api/v1/time-entries/{{time_entry_id}}/pause`
- **Body (`raw` JSON):** `{}`
- **Expected:** `200 OK`, trạng thái `PAUSED`.

### 4. Resume Timer
- **Method & URL:** `POST {{base_url}}/api/v1/time-entries/{{time_entry_id}}/resume`
- **Body (`raw` JSON):** `{}`
- **Expected:** `200 OK`, trạng thái `RUNNING`, thời gian pause không bị cộng vào `effective_elapsed_seconds`.

### 5. Complete Timer
- **Method & URL:** `POST {{base_url}}/api/v1/time-entries/{{time_entry_id}}/complete`
- **Body (`raw` JSON):** `{ "mark_occurrence_done": false }`
- **Expected:** `200 OK`, trạng thái `COMPLETED`, không tự động ép Task sang `DONE` nếu `mark_occurrence_done = false`.

---

## Folder `07. Habits, Goals, Streak & 19 Charts`

### 1. Create Habit
- **Method & URL:** `POST {{base_url}}/api/v1/habits`
- **Body (`raw` JSON):** `{ "title": "Đọc sách 20 phút", "frequency_type": "DAILY" }`
- **Expected:** `201 Created`.

### 2. Log Habit Day
- **Method & URL:** `POST {{base_url}}/api/v1/habits/{{created_habit_id}}/logs`
- **Body (`raw` JSON):** `{ "log_date": "2026-11-22", "status": "COMPLETED" }`
- **Expected:** `200 OK`.

### 3. Create Goal
- **Method & URL:** `POST {{base_url}}/api/v1/goals`
- **Body (`raw` JSON):**
```json
{
  "title": "Hoàn thành đồ án tốt nghiệp",
  "metric_unit": "%",
  "target_value": 100,
  "baseline_value": 0,
  "measurement_mode": "MILESTONE_PERCENT",
  "start_date": "2026-11-01",
  "end_date": "2026-12-31"
}
```
- **Expected:** `201 Created`.

### 4. Unified Active Day & Streak
- **Method & URL:** `GET {{base_url}}/api/v1/analytics/streak`
- **Expected:** `200 OK`, trả về `current_streak`, `best_streak`, `consistency_30d`, `active_dates`.

### 5. 19-Chart Catalog & Sample Query
- **Catalog:** `GET {{base_url}}/api/v1/analytics/charts` (trả về đủ 19 `chart_key` qua 8 spaces).
- **Chart Data:** `GET {{base_url}}/api/v1/analytics/charts/weekly_planned_vs_actual?granularity=day`
- **Expected:** `200 OK`, trả về `{ chart_key, space, timezone, period, filters, series, summary, empty }`.

---

## Folder `08. Multi-Page Dashboards, Block Templates & AI Gateway`

### 1. List / Create Custom Pages (`Dashboards`)
- **List Pages:** `GET {{base_url}}/api/v1/dashboards` → `200 OK`
- **Create Page:** `POST {{base_url}}/api/v1/dashboards`
- **Body (`raw` JSON):** `{ "title": "Q4 Roadmap", "description": "Linked Plan → Project → Task" }`
- **Expected:** `201 Created`, lưu `created_dashboard_id`.

### 2. Get Default Dashboard (Blank Canvas)
- **Method & URL:** `GET {{base_url}}/api/v1/dashboards/default`
- **Expected:** `200 OK`, dashboard mặc định ban đầu có `widgets = []`.

### 3. Add Linked Database / Chart Widget to Page
- **Method & URL:** `POST {{base_url}}/api/v1/dashboards/{{created_dashboard_id}}/widgets`
- **Body (`raw` JSON):**
```json
{
  "widget_type": "CUSTOM_TABLE",
  "title": "DB Kế hoạch",
  "position_x": 0,
  "position_y": 0,
  "width": 12,
  "height": 4,
  "spec_json": {
    "preset_type": "PLAN_DB",
    "period_type": "WEEK",
    "grid_col": 0,
    "grid_row": 0,
    "grid_col_span": 12
  }
}
```
- **Expected:** `201 Created`.

### 4. Block Templates Catalog & Admin Studio CRUD
- **User Catalog:** `GET {{base_url}}/api/v1/block-templates` (Bearer `{{access_token}}`) → `200 OK`, chứa `plan-database`, `project-database`, `composite-form-card`.
- **Admin List:** `GET {{base_url}}/api/v1/admin/block-templates` (Bearer `{{admin_access_token}}`) → `200 OK`.
- **Admin Create / Patch:** `POST {{base_url}}/api/v1/admin/block-templates` / `PATCH {{base_url}}/api/v1/admin/block-templates/{{template_id}}` (chỉnh `default_width`, `default_height`, `default_spec_json.slots` từ Card Studio).

### 5. List Available AI Agents
- **Method & URL:** `GET {{base_url}}/api/v1/ai/agents`
- **Auth:** Bearer Token `{{access_token}}`
- **Expected:** `200 OK`, trả về 4 agent (`local` / `qwen3:8b`, `claude` / `claude-sonnet-4-6`, `codex` / `gpt-5.4`, `gemini` / `gemini-3-flash-preview`), không lộ secret key.

### 6. AI Chat & Action Proposal (Human-in-the-loop)
- **Method & URL:** `POST {{base_url}}/api/v1/ai/chat`
- **Body (`raw` JSON):**
```json
{
  "message": "Lên giúp tôi 2 nhiệm vụ ôn thi buổi chiều hôm nay",
  "locale": "vi",
  "preferred_agent": "local"
}
```
- **Expected:** `200 OK`, trả về `reply_message` và tùy chọn `action_proposal` trạng thái `PENDING`.

### 7. Confirm AI Proposal (ghi vào DB qua `TaskService`)
- **Method & URL:** `POST {{base_url}}/api/v1/ai/proposals/{{ai_proposal_id}}/confirm`
- **Headers:** `Idempotency-Key: {{$guid}}`
- **Body (`raw` JSON):** `{}`
- **Expected:** `200 OK`, `status = "EXECUTED"`, `created_task_ids` chứa UUID các task vừa tạo.
