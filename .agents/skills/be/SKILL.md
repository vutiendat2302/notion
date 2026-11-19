---
name: be
description: "Thiết kế và triển khai Backend FastAPI Python 3.14 theo Hybrid Architecture, REST API, service/repository/mapper, auth, transaction, planner, recurrence, time tracking và AI gateway."
---

# Backend Engineering — FastAPI Hybrid Skill

## Khi nào dùng

Khi thêm/sửa Backend API, auth, validation, business service, SQLAlchemy model/repository, schedulers, notifications hoặc đường giao tiếp nội bộ với AI Service.

## Stack cố định

**Python 3.14 · FastAPI · Pydantic v2 · SQLAlchemy 2.x · Alembic · asyncmy · MySQL 8.4 · uv**. Kiểm thử dependency thực trên Python 3.14 trước khi pin lockfile.

## Kiến trúc Hybrid (feature ngoài, layer trong)

```text
backend/app/
├── main.py
├── api/                       # đăng ký router, version prefix
├── core/                      # config, security, errors, logging
├── db/                        # engine, session, base, metadata
├── shared/                    # chỉ dùng chung thật sự
├── workers/                   # reminder/job workers
└── modules/
    ├── tasks/
    │   ├── api/               # FastAPI controllers/routers
    │   ├── services/          # nghiệp vụ, UoW
    │   ├── repositories/      # queries
    │   ├── models/            # SQLAlchemy
    │   ├── schemas/requests/  # Pydantic input
    │   ├── schemas/responses/ # Pydantic output
    │   ├── mappers/           # ORM/domain -> DTO khi cần
    │   └── domain/            # rules/exception/value objects
    ├── planning/
    ├── projects/
    ├── goals/
    ├── time_tracking/
    ├── reminders/
    ├── analytics/
    ├── files/
    ├── ai_gateway/
    └── ...
```

**Không tạo `backend/app/modules/ai` chứa Pydantic AI/agents**: AI đã là container riêng.

## Request/response chuẩn

```text
Client → API (request DTO + user context)
       → Service (rules, ownership, transaction)
       → Repository (SQLAlchemy query)
       → MySQL
       → Service (aggregate/authorization)
       → Mapper nếu cần → Response DTO → JSON
```

- Controller không viết business logic hay SQL.
- Service không import FastAPI `Request`/`Response` để điều khiển nghiệp vụ; nhận context qua typed dependency.
- Repository không tự `commit()`, không quyết định chuyển trạng thái nghiệp vụ.
- Mapper không query DB hoặc gọi service bên ngoài; không bắt mọi CRUD phải có mapper rỗng.
- Giữ `AsyncSession` theo từng request/UoW; không chia sẻ qua concurrent tasks.
- Module khác tương tác qua application services/read interfaces có chủ đích, không tự import repository nội bộ của nhau.

## Module ownership quan trọng

| Module | Sở hữu |
|---|---|
| `tasks` | Task definition, task occurrence, recurrence, checklist/subtasks/dependencies khi bật |
| `planning` | Planning periods/items, review, rollover; không nhân bản task |
| `projects` | Project metadata; tiến độ thường là derived |
| `goals` | Target/measurement/evidence |
| `calendar` | Query/scheduling view; không sao chép occurrence sang table events |
| `time_tracking` | Time entries và active session |
| `reminders` | Reminder rules, delivery attempts, dedup |
| `analytics` | Metric registry/queries/aggregation, không sở hữu task status |
| `files` | File metadata và kiểm tra quyền đối với MinIO objects |
| `ai_gateway` | Request/response bridge với AI service, không chứa agent logic |

## REST & validation conventions

- Prefix `/api/v1`; resource tên số nhiều; CRUD `GET/POST/PATCH/DELETE` đúng semantics.
- `PATCH` là **partial update**: trường không gửi = giữ nguyên, `null` = xóa nếu contract cho phép. Phân biệt bằng Pydantic `model_fields_set`/`exclude_unset=True`.
- Không rò ORM entity hoặc internal exception trực tiếp qua response.
- Pagination/filter/sort cần allowlist, ổn định và giới hạn `page_size`; thời gian biểu diễn ISO 8601 rõ UTC/offset.
- HTTP errors thống nhất: `400/422` validation, `401` chưa auth, `403` không đủ quyền, `404`, `409` conflict, `429` throttling, `5xx` internal/downstream.
- Với create/execute/scheduled work dễ retry, áp dụng idempotency key hoặc unique constraint phù hợp.
- Auth user context lấy từ phiên/credentials đáng tin, không lấy `user_id` do payload khai báo.

## Domain logic bắt buộc

### Task & occurrence

- Task gốc không có trạng thái DONE chung nếu lặp; occurrence mới có status.
- Task một lần cũng dùng occurrence thống nhất khi được lên lịch/thực hiện.
- Recurrence generation idempotent; rule change không viết lại occurrence đã DONE; xử lý exception/single occurrence.
- Status transitions phải được xác định (reopen/cancel/skip), có test và audit event nếu quan trọng.

### Planning & goals

- Year/Quarter/Month/Week/Day là scope của kỳ kế hoạch; `plan_items` chỉ tham chiếu task/project/goal hoặc commitment, không sao chép toàn bộ bản ghi.
- Goal progress có unit và nguồn measurement; không suy ra % từ bất kỳ tasks không liên quan.

### Time tracking & reminders

- Timer persist start/pause/resume/stop, tính actual từ entries; không tin timer chạy riêng trên FE.
- Xử lý time entries đi qua nửa đêm theo timezone, session quên đóng, concurrent start.
- Reminder scheduler chạy độc lập; phân biệt due, claimed, sent, retry, exhausted; không gửi trùng.

## AI Gateway — ranh giới đặc biệt

- Public client chỉ gọi `backend/api/v1/ai/*` (hoặc endpoint Backend đã chốt).
- Backend xác thực user, rate limit, tạo correlation ID, gọi `ai-service` bằng HTTPX + service credential + timeout.
- AI Service gọi lại `backend/internal/ai-tools/*` với scoped service token và ủy quyền người dùng xác thực. Internal route **không** gọi ngược `ai_gateway` gây vòng lặp.
- Tool đọc qua read service; tool write chỉ chạy khi có proposal/confirmation token được Backend phát và kiểm tra lại state/version.
- Không lộ API keys/connection strings trong response/log.

## Transaction, concurrency & persistence

- Transaction boundary nằm ở Service/UoW; thay đổi nhiều bảng phải all-or-nothing nếu cùng transaction.
- Sử dụng database constraints thay cho kiểm tra ứng dụng đơn độc khi cần chống trùng.
- Dùng optimistic locking cho sửa task/plan song song nếu phù hợp; trả `409 Conflict` khi version mismatch.
- Events cross-service nên dùng outbox/job nếu cần recover, không giả định một HTTP call + DB commit là atomic.
- Đối với MySQL async driver: validate timeout/pool size theo số workers và số kết nối tối đa, bật `pool_pre_ping` nếu phù hợp.

## File và API example (không ràng buộc tên endpoint nếu code đã có)

```text
POST   /api/v1/tasks
GET    /api/v1/tasks?status=&project_id=&date_from=
GET    /api/v1/tasks/{id}
PATCH  /api/v1/tasks/{id}
GET    /api/v1/tasks/{id}/occurrences
PATCH  /api/v1/occurrences/{id}
GET    /api/v1/planning/periods?scope=week&date=
GET    /api/v1/analytics/overview?from=&to=
POST   /api/v1/ai/requests
```

## Quality gates

- `uv run ruff check .`, `uv run pyright`, `uv run pytest` nếu dự án đã khai báo scripts/deps tương ứng.
- Integration test trên MySQL thật cùng major version, không chỉ SQLite in-memory.
- Bắt buộc test: partial PATCH, foreign owner, recurrence duplicate, transaction rollback, conflicting edits, timezone, idempotency, downstream AI timeout.

## Cấm

- SQL trong Controller; repository commit độc lập; mapper query DB; circular module imports.
- Hardcode user ID, credentials, timezone string bừa bãi.
- Truy cập trực tiếp MySQL nghiệp vụ từ AI Service.
- Return ORM trực tiếp khi có trường nhạy cảm; cập nhật dữ liệu bằng AI output chưa kiểm định.
- Tự thêm PostgreSQL/Supabase/Redis/Celery khi không có yêu cầu.
