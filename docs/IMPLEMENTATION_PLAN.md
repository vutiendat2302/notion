# Personal Productivity & Time Management App — Kế Hoạch Triển Khai Chi Tiết

> **Trạng thái:** Baseline Implementation Plan — thống nhất từ toàn bộ đặc tả kỹ thuật (`AGENTS.md`, `docs/*.md`, `.agents/skills/*/SKILL.md`)  
> **Cập nhật:** 19/11/2026  
> **Mô hình triển khai:** Self-hosted Docker Compose trên Ubuntu · Web-first (Next.js 16) + Business Backend (FastAPI Python 3.14) · Mở rộng tuần tự Storage (MinIO), OCR (Python 3.12), AI/RAG (Python 3.14 + Qdrant + Ollama) và iOS Native (React Native + Expo).

---

## 1. Tổng quan Kiến trúc & Các Quyết định Kỹ thuật Đã Chốt (ADRs)

### 1.1. Sơ đồ kiến trúc tổng thể

```text
Web Next.js 16 (:3000) / iOS React Native (sau này)
                │ HTTPS / REST (/api/v1)
                ▼
     Backend FastAPI :8000 (Python 3.14, Hybrid Architecture)
         ├──► MySQL 8.4 LTS :3306 (`productivity_db` — Backend sở hữu)
         ├──► MinIO :9000 (Object Storage: file gốc & exports)
         │
         │ Private Authenticated HTTP (/internal/v1)
         ▼
     AI Service FastAPI :8001 (Python 3.14, Hybrid, Pydantic AI)
         ├──► Ollama :11434 (Local LLM & Embedding models)
         ├──► Qdrant :6333 (Vector Index — có thể rebuild)
         ├──► MySQL 8.4 :3306 (`ai_metadata_db` — tài khoản tách biệt)
         ├──► OCR Service :8866 (Python 3.12, PaddleOCR 3.x / PyMuPDF)
         └──► Backend Internal Tool APIs (`/internal/v1/ai-tools/*`)
```

**Ranh giới bất biến:**
1. Frontend chỉ gọi Backend public API (`/api/v1/*`), không gọi trực tiếp AI Service, OCR Service, MySQL, MinIO Admin hay Ollama.
2. AI Service **không có credentials** truy cập `productivity_db`; mọi dữ liệu nghiệp vụ phải đi qua Backend Internal Tool APIs có kiểm tra scope và ownership.
3. AI chỉ đề xuất (`TaskDraft`, `ScheduleProposal`, `ChartSpec`, `ActionProposal`); Backend xác thực, preview, chờ user confirm rồi mới thực thi transaction.
4. Khi AI Service / OCR / Ollama / Qdrant tắt hoặc lỗi, toàn bộ ứng dụng cốt lõi (Today, Tasks, Planning, Calendar, Timer, Analytics) vẫn hoạt động bình thường.

### 1.2. Cấu trúc Monorepo phẳng

Thống nhất dùng **cấu trúc thư mục phẳng** tại repository root (theo ưu tiên của `AGENTS.md` và `docs/v2.md`):

```text
notion/
├── frontend/                   # Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui (Base UI)
├── backend/                    # FastAPI Python 3.14 (Hybrid Modular Monolith)
├── ai-service/                 # FastAPI Python 3.14 + Pydantic AI (Independent service, Hybrid)
├── ocr-service/                # FastAPI Python 3.12 + PaddleOCR 3.x / PyMuPDF (Independent service)
├── contracts/                  # OpenAPI specs & JSON schemas dùng chung (FE ↔ BE ↔ AI ↔ OCR)
│   ├── backend-ai/
│   ├── ai-ocr/
│   └── ai-backend-tools/
├── infra/                      # Docker Compose, MySQL config/init, scripts backup/restore, secrets
│   ├── compose.yaml
│   ├── compose.dev.yaml
│   ├── mysql/
│   │   ├── my.cnf
│   │   └── init/
│   ├── scripts/
│   └── secrets/                # Không commit git
├── docs/                       # Đặc tả nghiệp vụ, kiến trúc, DB, ADR và kế hoạch triển khai
├── .env.example                # Biến môi trường mẫu chung toàn dự án
├── .gitignore                  # Quy tắc ignore cho Python, Node/Next, Docker, secrets, backups
├── .dockerignore               # Loại trừ file thừa khỏi Docker build context
├── .editorconfig               # Thống nhất indent, charset UTF-8, LF
├── .gitattributes              # Ép LF cho scripts, config, Dockerfiles
├── Makefile                    # Lệnh điều phối Docker, DB, Migrations, Lint, Typecheck, Test
└── README.md                   # Hướng dẫn khởi chạy và vận hành dự án
```

### 1.3. Bốn quyết định nghiệp vụ & dữ liệu cốt lõi (Core ADRs)

| ADR | Quyết định | Lý do & Ràng buộc thực thi |
|---|---|---|
| **ADR-CORE-01** | **Tách bạch `Task` ≠ `TaskOccurrence` ≠ `TimeEntry`** | `tasks` chỉ lưu định nghĩa gốc; `task_occurrences` giữ lịch thực hiện và trạng thái (`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `SKIPPED`, `CANCELLED`); `time_entries` lưu phiên làm việc thực tế (`TIMER`/`MANUAL`). Không đặt cột `DONE` tổng quát trên `tasks` lặp; sửa rule lặp không ghi đè lịch sử `DONE`. |
| **ADR-CORE-02** | **Default Occurrence cho One-off Task chưa xếp lịch (Inbox)** | Khi tạo một one-off task chưa có ngày (`scheduled_date = NULL`), `TaskService` tự tạo **1 `task_occurrence` mặc định** (`scheduled_date = NULL`, `status = NOT_STARTED`). Giúp 100% trạng thái hoàn thành và `TimeEntry` đi qua `task_occurrences` thống nhất, không phải rẽ nhánh logic ở BE và FE. |
| **ADR-CORE-03** | **Planning Workspaces (`Year → Quarter → Month → Week → Day`) là Scope + Saved Plan** | Không tạo 5 bảng riêng hay nhân bản task theo kỳ. Mỗi kỳ có lớp *Dynamic View* truy vấn theo khoảng `[start_date, end_date_exclusive)` và lớp *Saved Plan* (`planning_periods` + `plan_items`) lưu focus/cam kết/ưu tiên kỳ. Xử lý tuần giao tháng/năm bằng phép giao khoảng ngày theo timezone user. |
| **ADR-CORE-04** | **Chuẩn ID, Temporal & API Contract** | PK dùng **UUIDv7** (`uuid.uuid7()` trong Python 3.14) lưu `BINARY(16)` trên MySQL 8.4 InnoDB; API JSON chuẩn **`snake_case`**, ID serialize dạng string UUID; timestamps lưu UTC `DATETIME(6)` (API xuất ISO 8601 có offset), ngày lịch dùng `DATE` theo timezone user (mặc định `Asia/Ho_Chi_Minh`). |

---

## 2. Thiết kế Database Theo Từng Giai Đoạn (MySQL 8.4 LTS)

Tuyệt đối **không** triển khai ồ ạt 81 bảng của bản thiết kế v1 tham khảo. Database được chia làm **4 giai đoạn tăng dần (14 đợt migration, tổng 41 bảng)** và đặc tả chi tiết tới từng cột, khóa ngoại, index, check constraint và SQL mẫu trong:
👉 **[Thiết kế Database chi tiết theo từng giai đoạn (DATABASE_DESIGN_BY_PHASE.md)](./database/DATABASE_DESIGN_BY_PHASE.md)**

### 2.1. Tổng quan 4 Giai đoạn Database

| Giai đoạn | Database | Đợt Migration | Bảng mở khóa |
|---|---|---:|---|
| **Giai đoạn 1 — Core MVP** | `productivity_db` | `M1` → `M7` (16 bảng) | `users`, `user_settings`, `auth_sessions`, `categories`, `projects`, `tasks`, `recurrence_rules`, `task_occurrences`, `checklist_items`, `occurrence_checklist_states`, `planning_periods`, `plan_items`, `time_entries`, `goals`, `goal_links`, `reminders` |
| **Giai đoạn 2 — Productivity+** | `productivity_db` | `M8` → `M11` (16 bảng) | `tags`, `task_tags`, `task_dependencies`, `habits`, `habit_logs`, `goal_measurements`, `goal_milestones`, `period_reviews`, `pages`, `saved_views`, `dashboards`, `dashboard_widgets`, `files`, `file_links`, `activity_events`, `idempotency_keys` |
| **Giai đoạn 3 — AI, OCR & RAG** | `productivity_db` + `ai_metadata_db` | `M12` + `AI-M1` (6 bảng) | `action_proposals` (Backend); `ai_conversations`, `ai_messages`, `ai_runs`, `ai_document_jobs`, `ai_document_chunks` (AI Service) + MinIO & Qdrant |
| **Giai đoạn 4 — Mobile & Automation** | `productivity_db` | `M13` (3 bảng) | `user_devices`, `templates`, `automation_rules` |

### 2.2. Giải pháp kỹ thuật bắt buộc trên MySQL 8.4 InnoDB

1. **Khóa chính & Temporal:** `UUIDv7` (`uuid.uuid7().bytes`) lưu `BINARY(16)` giảm page split InnoDB; UTC instant dùng `DATETIME(6)`; ngày lịch user dùng `DATE`.
2. **Chống bẫy `UNIQUE` với `NULL`:** Dùng `recurrence_key = 'ONCE'` (chống trùng trên `task_occurrences`), `target_key` (chống ghim trùng trên `plan_items` / `goal_links` / `file_links`).
3. **Ép tối đa 1 Active Timer/User ở tầng Engine DB:** Trên `time_entries`, dùng Virtual Generated Column `active_user_lock = IF(status IN ('RUNNING','PAUSED'), user_id, NULL)` + `UNIQUE(active_user_lock)` thay cho Partial Unique Index.
4. **Tránh lỗi `CHECK` + FK (MySQL Error 3823):** Các cột FK tham gia `CHECK` XOR đều dùng `ON DELETE RESTRICT` và xử lý dọn dẹp tại tầng Service.

### 2.3. Lộ trình Alembic Migrations Giai đoạn 1 (Core MVP — 16 bảng)

| Đợt | Nội dung migration | Điều kiện nghiệm thu |
|---|---|---|
| **M1** | `users`, `user_settings`, `auth_sessions` | Round-trip `UUIDBinary16`, UTC datetime, `utf8mb4` tiếng Việt & emoji. |
| **M2** | `categories`, `projects` | FK tới `users`, archive policy, ownership isolation. |
| **M3** | `tasks`, `recurrence_rules`, `task_occurrences`, `checklist_items`, `occurrence_checklist_states` | `UNIQUE(task_id, recurrence_key)`, `UNIQUE(occurrence_id, checklist_item_id)`, `CHECK` hợp lệ. |
| **M4** | `planning_periods`, `plan_items` | `CHECK(start_date < end_date_exclusive)`, `UNIQUE(period_id, target_key)`. |
| **M5** | `time_entries` | Index `(user_id, started_at, ended_at)`, `uq_time_entries_active_user_lock`. |
| **M6** | `goals`, `goal_links` | `DECIMAL(18,4)` cho target, constraint `target_value > 0`. |
| **M7** | `reminders` | Index `(status, remind_at, lease_until)` phục vụ `FOR UPDATE SKIP LOCKED`. |

---

## 3. Kế Hoạch Triển Khai Chi Tiết — Backend (`backend/`)

> **Stack:** Python 3.14 (`uv`), FastAPI, Pydantic v2, SQLAlchemy 2.x (`sqlalchemy[asyncio]`), `asyncmy`, Alembic, `pwdlib[argon2]`, `pyjwt`, `python-dateutil`, Ruff, Pyright, pytest.  
> **Kiến trúc bên trong:** Hybrid (`app/modules/<domain>/{api,services,repositories,models,schemas,mappers,domain}`).  
> **Quy tắc transaction:** Controller không viết SQL; Service làm chủ `commit`/`rollback`; Repository chỉ `select/add/flush`; Mapper không chạm DB.

### Giai đoạn BE-1: Foundation, Core Infrastructure & Auth/Users
1. **Khởi tạo Python 3.14 Project (`backend/`):**
   - Khởi tạo `pyproject.toml` (`requires-python = ">=3.14,<3.15"`), `.python-version`, lock dependencies bằng `uv lock`.
   - Cấu hình `[tool.ruff]`, `[tool.pyright]` (`typeCheckingMode = "standard"`), `[tool.pytest.ini_options]` (`asyncio_mode = "auto"`).
2. **Core & Database Layer (`app/core/`, `app/db/`, `app/shared/`):**
   - `core/config.py`: Đọc env bằng `pydantic-settings` (fail-fast khi thiếu secret production, build URL từ `SQLAlchemy URL.create`).
   - `core/exceptions.py` & `core/logging.py`: Middleware sinh/truyền `X-Request-ID`, structured JSON logging (redact token/password), handler chuẩn hóa error envelope:
     ```json
     {
       "error": { "code": "RESOURCE_CONFLICT", "message": "...", "details": {} },
       "request_id": "..."
     }
     ```
   - `db/base.py`, `db/types.py`, `db/engine.py`, `db/session.py`, `db/models.py`: `UUIDBinary16`, `UTCDateTime`, naming conventions (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`), async engine `pool_pre_ping=True`.
   - Health endpoints: `GET /health/live` (process alive) và `GET /health/ready` (`SELECT 1` kiểm tra MySQL).
3. **Module `users` & `auth` + Migration M1:**
   - Endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/users/me`, `PATCH /api/v1/users/me/settings`.
   - Single-user bootstrap CLI (`python -m app.cli.bootstrap_user`) tạo tài khoản chủ ban đầu an toàn.
   - Hash mật khẩu bằng `pwdlib[argon2]`, JWT access token ngắn hạn + refresh token lưu hash `SHA-256` kèm rotation và reuse detection (revoke cả `family_id` nếu phát hiện dùng lại token cũ).
4. **Tests BE-1:** Unit + Integration test trên MySQL thật (Docker container) cho UUIDv7, UTC conversion, login, refresh reuse, `401/403`.

### Giai đoạn BE-2: Taxonomy, Projects & Lõi Tasks / Occurrences / Recurrence
1. **Modules `taxonomy` (`categories`) & `projects` + Migration M2:**
   - CRUD `/api/v1/categories`, `/api/v1/projects`; hỗ trợ partial `PATCH` với `model_fields_set` (phân biệt trường không gửi vs `null`).
   - Seed danh mục mặc định khớp 6 màu pastel Soft Blue (`Study/Lavender`, `Habit/Sage`, `Personal/Peach`, `Goals/Rose`, `Attention/Butter`, `Schedule/Sky`).
2. **Module `tasks` + Migration M3:**
   - **Models & Repositories:** `Task`, `RecurrenceRule`, `TaskOccurrence`, `ChecklistItem`, `OccurrenceChecklistState`.
   - **Domain Policies (`domain/`):**
     - `status_policy.py`: State machine hợp lệ cho Occurrence (`NOT_STARTED → IN_PROGRESS → DONE`, `SKIPPED`, `CANCELLED`, `DONE → NOT_STARTED` reopen).
     - `recurrence_policy.py`: Sinh chuỗi ngày theo `DAILY/WEEKLY/MONTHLY/YEARLY`, xử lý ngày 29/30/31 theo `SKIP` hoặc `CLAMP_TO_LAST_DAY`, chuẩn hóa theo `timezone` của rule.
   - **Services (`services/`):**
     - `TaskService`: Quick create (`title` only → tự tạo 1 default `task_occurrence`), partial `PATCH` kiểm tra `version` (trả `409 Conflict` nếu stale), archive/restore (giữ nguyên lịch sử), validation subtask không tự trỏ hoặc tạo cycle.
     - `RecurrenceService`: Preview occurrences (`GET /tasks/{id}/recurrence/preview`), sinh occurrences idempotent theo rolling horizon (mặc định 60 ngày), cập nhật rule theo scope **`this_occurrence` / `future_occurrences`** (bảo toàn 100% occurrence đã `DONE`).
     - `OccurrenceService`: Complete/Reopen/Skip/Cancel/Reschedule + tick checklist theo từng `occurrence_id`.
   - **API Routers (`/api/v1/tasks/*`, `/api/v1/occurrences/*`):** Đầy đủ endpoints CRUD, filter (`inbox`, `today`, `upcoming`, `completed`, `project_id`, `category_id`, `search`), pagination ổn định.
3. **Tests BE-2:** Toàn bộ acceptance cases `T-001` → `T-028` (partial PATCH, recurrence idempotency khi chạy song song, bảo toàn occurrence `DONE`, reset checklist theo occurrence, chống cycle subtask).

### Giai đoạn BE-3: Planning Workspaces (`Y → Q → M → W → D`) & Calendar View
1. **Module `planning` + Migration M4:**
   - Canonical period parser (`2026`, `2026-Q4`, `2026-11`, `2026-W47`, `2026-11-19`) tính chính xác `[start_date, end_date_exclusive)` theo `timezone` và `week_starts_on` của user.
   - Endpoints:
     - `GET /api/v1/planning/periods/{type}/{key}`: Trả về dynamic view (occurrences thuộc khoảng ngày, overdue cần chú ý, focus time tổng hợp, saved plan & `plan_items`).
     - `PUT /api/v1/planning/periods/{type}/{key}/plan`: Tạo/cập nhật Saved Plan (`focus`, `notes`, `status`).
     - `POST/PATCH/DELETE /api/v1/planning/plans/{plan_id}/items`: Ghim và sắp xếp thứ tự (`priority_rank`) task/occurrence/project/goal vào kỳ mà không nhân bản dữ liệu.
     - `POST /api/v1/planning/periods/{type}/{key}/rollover/preview` & `POST /api/v1/planning/rollovers/confirm`: Dời lịch hoặc ghim lại việc chưa xong sang kỳ tiếp theo với `Idempotency-Key`.
2. **Module `calendar` (Query/Scheduling Projection):**
   - Không tạo bảng mới; đọc thông qua `TaskQueryService` và `OccurrenceService`.
   - `GET /api/v1/calendar/events?start=&end=`: Trả về tách biệt `all_day_occurrences`, `timed_occurrences`, và `due_markers`.
   - `GET /api/v1/calendar/conflicts`: Kiểm tra đụng độ khung giờ khi kéo/resize.
3. **Tests BE-3:** Test tuần giao tháng (`30/11–06/12`), tuần giao năm, đổi `week_starts_on`, rollover idempotent, Today deduplication (1 occurrence vừa scheduled today vừa due today chỉ trả 1 lần).

### Giai đoạn BE-4: Time Tracking (Focus Timer), Goals & Reminders
1. **Module `time_tracking` + Migration M5:**
   - Endpoints: `POST /api/v1/time-entries/start`, `POST /api/v1/time-entries/{id}/pause`, `resume`, `stop`, `POST /api/v1/time-entries` (manual entry), `PATCH /api/v1/time-entries/{id}`, `GET /api/v1/time-entries/active`.
   - Chặn 2 timer `RUNNING` đồng thời cho cùng user bằng transaction locking; tính `duration_seconds` từ server UTC timestamps trừ `paused_seconds`; phát hiện session treo quá ngưỡng (mặc định 12h–24h) để nhắc user xác nhận thay vì tự ghi giờ ảo; logic chia phút chuẩn xác khi phiên chạy xuyên qua 00:00 local time.
2. **Module `goals` + Migration M6:**
   - Endpoints: `CRUD /api/v1/goals`, `GET /api/v1/goals/{id}/progress`, `POST /api/v1/goals/{id}/links`.
   - Tính tiến độ theo đơn vị (`hours`, `tasks`, `count`), attribution chống cộng trùng khi link cả Project và Task con thuộc Project đó vào cùng 1 Goal.
3. **Module `reminders` + Migration M7 + Worker:**
   - Endpoints: `CRUD /api/v1/reminders`, `GET /api/v1/notifications`, `POST /api/v1/reminders/{id}/snooze`.
   - Worker chạy độc lập `backend/app/workers/reminder_worker.py` dùng `SELECT ... FOR UPDATE SKIP LOCKED` claim job có `lease_until`, gửi không trùng và tôn trọng retry/grace window.
4. **Tests BE-4:** Double-start timer, pause/resume duration, cross-midnight split, goal anti-double-count, concurrent reminder worker claim.

### Giai đoạn BE-5: Analytics Metric Registry & OpenAPI Contract Export
1. **Module `analytics` (Read-only Queries):**
   - Metric Registry tập trung định nghĩa công thức, unit, timezone boundary và inclusion/exclusion:
     - `completion_rate`: `DONE / eligible` (trả `null` khi `eligible = 0`, loại `CANCELLED` đúng policy, không tính occurrence tương lai).
     - `active_minutes`: Tổng hợp từ `time_entries` (xử lý union nếu có khoảng thời gian chồng nhau).
     - `planned_vs_actual`: So sánh `estimated_minutes` của scheduled occurrences vs `actual_minutes` từ `time_entries`.
     - `activity_heatmap`: Trả theo từng ngày local, phân biệt rõ `has_data: false` (`no_data`) với `value: 0`.
     - `time_allocation`: Theo `category_id` và `project_id`.
   - Endpoints: `GET /api/v1/analytics/overview`, `/completion`, `/time-allocation`, `/planned-vs-actual`, `/heatmap`.
2. **Contract Export:**
   - Xuất `contracts/backend-openapi.json` làm nguồn sự thật duy nhất để sinh TypeScript types cho Frontend.

---

## 4. Kế Hoạch Triển Khai Chi Tiết — Frontend (`frontend/`)

> **Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, `shadcn/ui` (**Base UI** primitives), Lucide React (tối thiểu icon), TanStack Query, Zustand, `nuqs`, React Hook Form + Zod, `date-fns`, Motion (`motion/react`), `@dnd-kit/react`, FullCalendar v7, Recharts, Sonner, `cmdk`, `pnpm`.  
> **Triết lý UI:** Intelligent Minimalism · Soft Blue (`#5378AC`) + Colorful Pastel Accents · Native scroll mặc định (không dùng Lenis toàn app).

### Giai đoạn FE-0: Foundation, Design Tokens & App Shell
1. **Khởi tạo Next.js 16 & Tooling:**
   - Thiết lập `tsconfig.json` strict, ESLint, Prettier, Vitest + Testing Library, `pnpm-lock.yaml`.
   - Cài đặt `shadcn/ui` (chọn **Base UI** primitives, không pha trộn Radix).
   - Nạp font **Geist Sans** và **Geist Mono** qua `next/font` (bảo đảm fallback hiển thị chuẩn dấu tiếng Việt + `tabular-nums` cho số liệu/timer).
2. **Hệ thống Màu & Semantic Tokens (`src/app/globals.css`):**
   - **Light Mode:** `--background: #F7F9FC`, `--card: #FFFFFF`, `--secondary: #F1F5FA`, `--primary: #5378AC` (đạt WCAG AA 4.52:1 với chữ trắng), `--soft-blue-decorative: #5D83BB`, `--foreground: #27354B`, `--muted-foreground: #65758B`, `--border: #E6EBF2`.
   - **Dark Mode (Slate Blue):** `--background: #111925`, `--card: #182332`, `--secondary: #202D3E`, `--primary: #9BBCE6`, `--foreground: #ECF2FA`, `--border: #2D3A4D`.
   - **6 Category Pastel Accents:** `lavender` (`#A99ADB`), `sage` (`#8CB9A5`), `peach` (`#F0B28D`), `rose` (`#E6A0B0`), `butter` (`#E6C879`), `sky` (`#8DBDDB`) kèm `soft background` và `strong text` riêng cho Light/Dark.
3. **App Shell & Hạ tầng State (`src/components/layout/`, `src/providers/`, `src/lib/api/`):**
   - `AppShell`:
     - Desktop: Sidebar trái gọn có thể collapse (180ms transition): **Today, Tasks, Planning, Calendar, Analytics, More (Goals, Projects, Settings)**. Hạn chế icon trang trí ở từng mục điều hướng.
     - Mobile (<768px): Top header + Bottom navigation (`Today / Tasks / Calendar / More`), touch target ≥ 44×44px, kiểm tra safe area iOS Safari.
   - `QueryProvider` (TanStack Query), `ThemeProvider` (`next-themes` Light/Dark/System), `NuqsAdapter` (URL state).
   - Typed API Client (`src/lib/api/`) với xử lý cookie/session refresh tự động, mapping error envelope + correlation ID, xử lý `401` (redirect login giữ nháp), `409 Conflict` (hiện thông báo reload/merge).

### Giai đoạn FE-1: Màn hình Today, Inbox, Tasks & Command Palette
1. **Trang Today (`/today`) — Content-First:**
   - Header ngày địa phương + **Daily Focus** (inline edit lưu vào Daily Saved Plan).
   - **Top Priorities:** Tối đa 3 mục ghim hàng đầu, hover/contextual actions (`Start Focus`, `Complete`, `Reschedule`).
   - **Today's Tasks & Schedule:** Gom nhóm rõ *Scheduled Today*, *Due Today*, *Overdue* (mỗi occurrence hiển thị tối đa 1 lần trong danh sách chính).
   - **Quick Add 1 dòng:** Gõ title → Enter tạo ngay với `scheduled_date = today`.
   - **Compact Progress Bar:** Hiển thị tổng occurrences hoàn thành & thời gian tập trung thực tế hôm nay (không đặt biểu đồ nặng ở Today).
2. **Trang Tasks & Inbox (`/tasks`):**
   - Bộ chuyển tab đồng bộ URL (`nuqs`): **Inbox (Unscheduled) / Today / Upcoming / All / Completed**.
   - Filter gọn theo Project, Category, Priority, Search.
   - `TaskRow`: Tối đa 3 điểm thông tin chính (Title, Category dot + Project, Date/Priority). Hỗ trợ **inline edit** Title/Priority/Date và optimistic tick checkbox (có rollback + undo toast khi lỗi).
   - Kéo-thả sắp xếp thứ tự bằng `@dnd-kit/react` kèm hỗ trợ bàn phím.
3. **Task Detail Slide-over Panel (`TaskDetailPanel`):**
   - Trên desktop là drawer bên phải; trên mobile là full-screen sheet.
   - Chỉnh Description, Estimate, Due Date, Project, Category, cấu hình **Recurrence Rule** (kèm preview 5 lần lặp tiếp theo), Subtasks, Checklist theo từng occurrence và tab lịch sử `TimeEntry`.
   - Khi sửa/dời lịch occurrence thuộc chuỗi lặp: hiển thị prompt chọn rõ **"Chỉ lần này"** hay **"Các lần tương lai"**.
4. **Command Palette (`Ctrl/⌘ + K` với `cmdk`):**
   - Chuyển trang nhanh, tìm kiếm task, tạo task nhanh, chuyển Light/Dark mode, bật Focus Timer.

### Giai đoạn FE-2: Planning Workspaces (`Year / Quarter / Month / Week`) & Calendar / Timeline
1. **Không gian Kế hoạch Đa cấp (`/planning`):**
   - Thanh điều hướng chuyển đổi scope **Year ↔ Quarter ↔ Month ↔ Week** với canonical URL (`?scope=week&key=2026-W47`).
   - Hiển thị **Saved Plan Header** (Focus, Ghi chú kỳ, Trạng thái), danh sách **Committed Plan Items** (ghim & sắp rank) và phần **Dynamic Overview** (occurrences, goals, tiến độ kỳ).
   - **Rollover Flow:** Nút "Chuyển kỳ" mở preview danh sách occurrence chưa hoàn thành từ kỳ trước, cho phép chọn giữ lại / dời ngày / ghim sang kỳ mới rồi Confirm.
2. **Trang Calendar & Timeline (`/calendar`):**
   - Lazy-load **FullCalendar v7** (`@fullcalendar/*`) tích hợp token Soft Blue & màu Category dịu nhẹ (không tô đặc chói mắt).
   - Hỗ trợ chuyển đổi **Month / Week / Day / Timeline (Time-blocking)**.
   - Tách khu vực **All-day tasks** (`scheduled_date` không giờ) và **Timed blocks** (`start_at`–`end_at`).
   - Hỗ trợ kéo task từ cột *Unscheduled / Weekly Backlog* thả trực tiếp vào khung giờ trên lịch; kéo/resize thời lượng trên lịch có cảnh báo xung đột giờ nhẹ nhàng.

### Giai đoạn FE-3: Focus Timer (Time Tracking), Goals, Projects & Settings
1. **Focus Timer (`FocusTimer` widget + `/time-tracking`):**
   - Widget gọn ghim ở góc dưới/topbar khi có phiên đang chạy; tách state đếm giây (`requestAnimationFrame`/interval tính từ `started_at` server) khỏi Query cache để tránh re-render toàn cây React.
   - Thao tác **Start / Pause / Resume / Stop**, thêm **Manual Time Entry**, sửa entry cũ và cảnh báo khôi phục nếu có phiên chạy quên qua đêm.
2. **Trang Goals (`/goals`) & Projects (`/projects`):**
   - Card tiến độ Goal theo đúng đơn vị (`giờ`, `buổi`, `tasks`, `cột mốc`), thanh progress clamp 100% nhưng hiển thị số thực nếu vượt target.
   - Chi tiết Project hiển thị danh sách tasks, milestone và so sánh Planned vs Actual hours.
3. **Trang Settings (`/settings`):**
   - Cài đặt Theme (Light / Dark / System), Timezone (`Asia/Ho_Chi_Minh`), Week Start (`Monday / Sunday`), Working Hours cho tính capacity, quản lý Categories.

### Giai đoạn FE-4: Analytics Dashboard
1. **Trang Analytics (`/analytics`):**
   - Lazy-load **Recharts + shadcn Charts**, mọi số liệu đọc trực tiếp từ Backend Metric Registry:
     - **Activity Heatmap:** Thang 5 mức màu Soft Blue, phân biệt rõ ngày không có dữ liệu (`No recorded activity`) và ngày 0 phút, tooltip hiện rõ `2h 30m` / `4 occurrences`.
     - **Planned vs Actual Chart:** Bar chart đối chiếu phút dự kiến vs phút thực tế theo ngày/tuần.
     - **Time Allocation Chart:** Donut/Bar theo Category hoặc Project (chỉ khi cùng đơn vị phút/giờ).
     - **Completion Trend Line Chart:** Xu hướng hoàn thành và chỉ báo `is_partial_period` cho tuần/tháng đang chạy dở.
   - Empty state rõ ràng giải thích cách bắt đầu ghi nhận dữ liệu (bật timer hoặc hoàn thành task), tuyệt đối không vẽ biểu đồ giả.

### Giai đoạn FE-5: Kiểm thử FE, Accessibility & Performance Gates
- **Unit & Component Tests:** Vitest + Testing Library (date/timezone utils, Task/Occurrence/TimeEntry mapping, optimistic rollback, inline edit).
- **E2E Tests (Playwright):** Luồng `Today → Quick Add → Calendar drag → Start/Stop Timer → Complete Occurrence → Analytics`; test trên viewport desktop (`1440px`) và mobile (`375px`), cả Light và Dark mode.
- **Chất lượng mục tiêu:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1; WCAG AA contrast, keyboard navigation đầy đủ, tôn trọng `prefers-reduced-motion`.

---

## 5. Lộ Trình Các Giai Đoạn Sau (Khi BE & FE Core Ổn Định)

| Giai đoạn | Service / Hạ tầng | Phạm vi triển khai | Profile Docker |
|---|---|---|---|
| **Phase 3: Storage & Files** | `MinIO` + `backend/modules/files` | Upload/download proxy qua Backend, private bucket `personal-uploads`, checksum SHA-256, `files` & `file_links` metadata, xóa mềm + cleanup orphan job. | `--profile storage` |
| **Phase 4: OCR Pipeline** | `ocr-service/` (Python 3.12) | FastAPI nội bộ `:8866`, PyMuPDF text-first PDF extraction, PaddleOCR 3.x cho ảnh/PDF scan tiếng Việt, PP-StructureV3 cho bảng biểu, trả `OCRResult` JSON có `bbox` & `confidence`. | `--profile ocr` |
| **Phase 5: AI Service & RAG** | `ai-service/` (Python 3.14) + `Qdrant` + `Ollama` | FastAPI nội bộ `:8001` (Pydantic AI), Backend `ai_gateway` + `/internal/v1/ai-tools/*`, Smart Task Creation (`TaskDraft`), OCR-to-Task preview, AI Chart Generator (`ChartSpec`), Daily Planner (`ScheduleProposal`), RAG tài liệu Qdrant có owner filter. | `--profile ai` / `full` |
| **Phase 6: Mobile Native** | `mobile/` (React Native + Expo) | App iOS 18 cài cá nhân qua SideStore, dùng chung REST API & OpenAPI client của Backend, local notifications & timer sync. | (Build client riêng) |

---

## 6. Cấu Hình Dự Án Chung & Quy Trình Vận Hành Qua Docker

Mọi thao tác phát triển và vận hành được điều phối thống nhất tại thư mục gốc thông qua `Makefile`, `.env.example` và `infra/compose.yaml`:

- **Chạy giai đoạn hiện tại (MySQL + BE + FE):** `make db-up` hoặc `make dev`
- **Kiểm tra cấu hình Docker Compose:** `make config`
- **Chạy chất lượng code (Lint / Typecheck / Test):** `make check`
- **Migration & Backup DB:** `make migrate`, `make migration MSG="..."`, `make db-backup`
- **Bật thêm Storage / AI / OCR khi tới phase sau:** `make up-storage`, `make up-ai`, `make up-all`

---

## 7. Definition of Done (Tiêu chí nghiệm thu trước bàn giao từng giai đoạn)

1. **Nghiệp vụ & Dữ liệu:** Không phá vỡ bất biến `Task ≠ TaskOccurrence ≠ TimeEntry`; hoàn thành task lặp không làm mất lịch sử; không trộn `planned_minutes` với `actual_minutes`.
2. **Chất lượng mã nguồn:** Backend pass `ruff check`, `pyright`, `pytest` (trên MySQL 8.4 thật); Frontend pass `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
3. **Bảo mật & Vận hành:** Không lộ secrets vào Git/logs; tất cả query đều scoped theo owner từ auth context; cổng nội bộ (`3306`, `8001`, `8866`, `6333`, `9000/9001`, `11434`) chỉ nằm trên mạng nội bộ hoặc loopback quản trị.
4. **Kiểm chứng thực tế:** Mọi thay đổi schema đi kèm Alembic migration và test rollback/restore; giao diện được test trên Desktop & Mobile, Light & Dark mode.
