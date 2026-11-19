# Personal Productivity App — Backend Technical Specification

> **Document ID:** PPA-BE-SPEC-001  
> **Version:** 2.0.0 — Hybrid Architecture  
> **Updated:** 17/11/2026  
> **Language:** Tiếng Việt — technical terms in English  
> **Status:** **Architecture decision: HYBRID (feature-first, layers-inside) — specification v2.0**; ERD, authentication flow và hosting vẫn cần review trước khi triển khai  
> **Product:** Personal Productivity & Time Management App  
> **Primary platform:** Next.js Web; **Future client:** React Native iOS (cài cá nhân qua SideStore)  
> **Backend philosophy:** **Hybrid (feature-first + explicit layers)** · Modular Monolith · API-first · Data Integrity · Security by Default · Observability · Cost-conscious

---

## 0. Executive Summary

Dự án xây backend độc lập để phục vụ ứng dụng quản lý kế hoạch cá nhân: **Tasks, Projects, Recurrence, Calendar, Timeline, Time Tracking, Habits, Goals, Analytics và Reminders**. Web triển khai trước; iOS dùng chung backend và dữ liệu về sau. Trọng tâm không phải chỉ tạo CRUD nhanh mà là **bảo toàn lịch sử, xử lý thời gian chính xác, đồng bộ thiết bị và nhắc việc đáng tin cậy**.

### 0.1. Quyết định nền tảng

| Thành phần | Quyết định | Trạng thái |
| --- | --- | --- |
| Programming language | **Python 3.14.x (CPython, GIL-enabled build thông thường)** | **Đã chọn** |
| Backend framework | **FastAPI** | **Đã chọn** |
| Application style | **Hybrid Modular Monolith + REST API** | **Đã chọn về mặt kiến trúc** |
| Source-code layout | **`modules/<domain>/{api,services,repositories,models,schemas,mappers}`** | **Đã chọn — không dùng global layer-first** |
| Data validation | **Pydantic v2 + pydantic-settings** | Khuyến nghị |
| Persistence | **PostgreSQL 17** | Định hướng (chốt phiên bản khi dựng DB) |
| ORM | **SQLAlchemy 2.x (ưu tiên stable 2.1.x nếu kiểm thử tương thích)** | Khuyến nghị |
| Migrations | **Alembic** | Khuyến nghị |
| PostgreSQL driver | **Psycopg 3 (async interface)** | Khuyến nghị |
| Environment/dependencies | **uv + `uv.lock`** | Khuyến nghị |
| Authentication | **JWT access + rotating refresh/session** | Thiết kế mục tiêu, chi tiết cần chốt |
| Hosting | API cloud riêng, PostgreSQL managed hoặc self-host | **Chưa chốt nhà cung cấp** |
| Reminders | Persisted jobs trong PostgreSQL + worker/cron riêng | **Bắt buộc khi thêm notification** |
| Mobile | Dùng cùng REST API; iOS client riêng | Giai đoạn sau |

**Quan trọng:** Python 3.14 được giữ cố định theo yêu cầu dự án (`>=3.14,<3.15`). Không tự động nhảy sang 3.15 chỉ vì package manager có bản mới. Không mặc định sử dụng Python free-threaded (`3.14t`): ưu tiên CPython 3.14 thông thường để giảm rủi ro tương thích.

### 0.2. Nguyên tắc không thay đổi

1. Backend là **source of truth** cho nghiệp vụ, quyền sở hữu và dữ liệu thực tế.
2. Frontend **không truy cập PostgreSQL trực tiếp**; mọi thao tác qua REST API có xác thực.
3. **Task definition** khác **Task occurrence**; **planned time** khác **actual time**.
4. Thay đổi task lặp không được làm mất lịch sử đã hoàn thành.
5. Scheduler/worker có cơ chế **retry, idempotency, deduplication**.
6. Mọi timestamps mang timezone; timezone mặc định cho người dùng là `Asia/Ho_Chi_Minh`.
7. Tổ chức source theo **Hybrid**: module nghiệp vụ nằm ngoài, tầng kỹ thuật nằm bên trong; không gom `services/`, `repositories/`, `mappers/` của mọi nghiệp vụ thành thư mục toàn cục.
8. Không thêm Redis, Kafka, Celery, Kubernetes, microservices khi chưa có nhu cầu đo được.
9. Không chọn công nghệ chỉ vì mới: dùng ổn định, dễ kiểm thử và triển khai trên máy Ubuntu.
10. OpenAPI phải cho phép sinh typed API client TypeScript cho Next.js và React Native.
11. Quyết định còn bỏ ngỏ phải hiển thị rõ, **không để AI coding assistant tự ý chốt ngầm**.

---

## 1. System Architecture

### 1.1. Sơ đồ logic

```text
                      ┌────────────────────────┐
                      │ Next.js Web (phase 1)  │
                      └───────────┬────────────┘
                                  │ HTTPS / REST
                      ┌───────────▼────────────┐
                      │ FastAPI Application    │
                      │ Auth · APIs · Services │
                      └───────────┬────────────┘
                                  │ SQLAlchemy / Psycopg 3
                      ┌───────────▼────────────┐
                      │ PostgreSQL             │
                      │ Source of truth        │
                      └───────────▲────────────┘
                                  │
                      ┌───────────┴────────────┐
                      │ Reminder Worker        │
                      │ + External Cron        │
                      └───────────┬────────────┘
                                  │
                      ┌───────────▼────────────┐
                      │ Web Push / provider    │
                      │ (native iOS: later)    │
                      └────────────────────────┘

          Future: React Native iOS ─ HTTPS / REST ─► FastAPI
```

### 1.2. Architecture Decision — Hybrid (đã chọn)

**Tên:** Hybrid / Feature-First, Layered-Inside, Modular Monolith.

- `app/modules/` chia theo **business capability**: `tasks`, `calendar`, `time_tracking`, `reminders`, `analytics`, v.v.
- Bên trong mỗi module, tách **các thư mục layer riêng** theo phong cách Java/Spring Boot: `api/`, `services/`, `repositories/`, `models/`, `schemas/`, `mappers/` (chỉ tạo khi module cần).
- `core/`, `db/`, `shared/` chứa hạ tầng/chức năng ngang, **không chứa business logic của một feature cụ thể**.
- **1 ứng dụng FastAPI, 1 backend deployable**; worker dùng cùng codebase nhưng chạy process riêng nếu có.
- HTTP API là entry point; Service điều phối nghiệp vụ và transaction; Repository làm persistence; Mapper đổi kiểu dữ liệu, không truy vấn DB.
- PostgreSQL là nguồn dữ liệu sự thật; Pydantic schemas là contract API; OpenAPI sinh TypeScript client.

**Luồng chuẩn:**

```text
Incoming HTTP
    │
    ▼
[API Router / Controller] ─── validates ───> [Request DTO / Pydantic]
    │
    ▼
[Application Service] ─── calls ───> [Domain Policies / Rules]
    │
    ▼
[Repository] <── SQLAlchemy ORM Model ──> [PostgreSQL]
    │  returns data
    ▼
[Application Service] ───> [Mapper (khi cần)] ──> [Response DTO]
                                                │
                                                ▼
                                            JSON/HTTP
```

Trong hiện thực, **API layer thường gọi Mapper** sau khi Service trả về kết quả. Diagram diễn tả đường đi dữ liệu, **không yêu cầu Service import Response DTO hay FastAPI**.

### 1.3. Vì sao Hybrid phù hợp dự án này?

1. **Java-style clarity:** Mỗi feature vẫn có `api/`, `services/`, `repositories/` rất rõ ràng.
2. **Feature locality:** Sửa recurrence của Tasks không phải đi qua các `services/` toàn cục và không làm trôi code vào module khác.
3. **AI-friendly scope:** Task của coding assistant có thể giới hạn tại `modules/tasks/`, mở rộng ngoài module khi thực sự cần.
4. **Maintainability:** Các module có hợp đồng tương tác rõ, dễ test và tránh phụ thuộc vòng.
5. **No needless ceremony:** Module chỉ có read-only calendar query không phải tự tạo `models/` hay `repositories/` rỗng.

**Trade-off được chấp nhận:** nhiều cấp thư mục và có thêm conventions. Cần kiểm soát để không biến Hybrid thành nhiều `BaseService`, `BaseRepository`, `AbstractMapper` vô nghĩa.

### 1.4. Những thứ không làm ngay

- Microservices / event bus phân tán.
- GraphQL, gRPC, WebSocket khi chưa có use case rõ ràng.
- Redis cache bắt buộc, Celery queue, Kafka, Elasticsearch.
- AI/LLM phục vụ analytics bản đầu tiên.
- Tự viết framework auth, repository generic quá trừu tượng.
- Thêm thư mục/class rỗng chỉ để mọi module trông giống nhau.

---

## 2. Backend Technology Stack

### 2.1. Core runtime và web API

| Hạng mục | Công nghệ | Trách nhiệm | Mức ưu tiên |
| --- | --- | --- | --- |
| Python runtime | **CPython 3.14.x** | Runtime backend | **Core** |
| Web framework | **FastAPI** | REST API, DI, OpenAPI | **Core** |
| ASGI server | **Uvicorn** (`uvicorn[standard]`) | Phục vụ HTTP/ASGI | **Core** |
| Request/response models | **Pydantic v2** | Runtime validation & serialization | **Core** |
| App configuration | **pydantic-settings** | Environment-based configuration | **Core** |
| ORM | **SQLAlchemy 2.x** (`sqlalchemy[asyncio]`) | Models, SQL queries, transactions; có greenlet cho async ORM | **Core** |
| Database driver | **psycopg[binary]** (Psycopg 3) | PostgreSQL async connection | **Core** |
| Schema migrations | **Alembic** | Phiên bản hóa database schema | **Core** |
| Database | **PostgreSQL** | Lưu dữ liệu bền vững, ràng buộc | **Core** |
| Package manager | **uv** | Python environment, dependency lock | **Core** |
| API docs | FastAPI OpenAPI/Swagger | API contract, interactive docs | **Core** |

**Tương thích Python 3.14:** FastAPI, Pydantic v2, SQLAlchemy, Psycopg 3 đã công bố hỗ trợ Python 3.14 (xem mục 23 — nguồn). Vẫn phải kiểm tra **trên chính bộ version lock thực tế**, đặc biệt các optional dependencies và driver binaries khi build Docker.

**Lưu ý SQLAlchemy:** Tài liệu trước đây đề xuất SQLAlchemy 2.x. SQLAlchemy 2.1 (bản production từ 24/09/2026) không còn tự cài `greenlet` theo mặc định; phải cài `sqlalchemy[asyncio]` nếu dùng async ORM. 2.1 là nhánh phát hành hiện hành; chọn bản stable phù hợp, chạy đầy đủ integration tests và lock bằng `uv.lock`. Không lên 2.1 chỉ để đổi version nếu 2.0 đã đáp ứng và đang ổn định.

### 2.2. Security & authentication

| Hạng mục | Công nghệ | Vai trò | Mức ưu tiên |
| --- | --- | --- | --- |
| Password hashing | **pwdlib[argon2]** | Hash/verify mật khẩu bằng Argon2id | Core nếu dùng password login |
| Access token | **PyJWT** (`pyjwt[crypto]` nếu cần thuật toán bất đối xứng) | Tạo/verify JWT | Core nếu chọn JWT |
| Web auth transport | **HttpOnly + Secure cookies** | Giảm nguy cơ đọc token qua JavaScript | Core |
| Mobile auth transport | Bearer token + iOS secure storage | Dành cho app tương lai | Later |
| CSRF protection | CSRF token / origin checks | Bảo vệ mutation dùng cookie | Core |
| CORS | FastAPI `CORSMiddleware` | Giới hạn allowed origins | Core |
| Rate limiting | Layer CDN/proxy hoặc adapter sau | Chống brute-force / abuse | Khi public |
| Secrets | Env / secrets manager | Không hardcode keys | Core |

**Không** lưu mật khẩu plaintext, không dùng SHA-256 trực tiếp để hash password, không gửi refresh token lên frontend logs/analytics. Ưu tiên Argon2id theo OWASP.

### 2.3. Scheduling, time & analytics

| Hạng mục | Công nghệ / cách làm | Lý do |
| --- | --- | --- |
| Timezone | Python `zoneinfo` + IANA tzdb | Chính xác theo timezone |
| Recurrence | `python-dateutil` (`rrule` khi cần) + domain rules | Tính lặp ngày/tuần/tháng |
| Cron trigger | Cloud scheduler hoặc Cron container | Kích hoạt worker đúng chu kỳ |
| Durable jobs | PostgreSQL tables + transactional claim | Không mất lịch khi server restart |
| Queue / retry | PostgreSQL transaction + `FOR UPDATE SKIP LOCKED` khi phù hợp | Tránh 2 worker xử lý cùng một job |
| Analytics | SQL aggregation / materialized views nếu cần | Dữ liệu lớn mới tối ưu tiếp |
| Heavy processing | Separate worker khi thực sự có CPU-heavy jobs | API không bị chặn |

**Không dùng `FastAPI BackgroundTasks` làm nguồn bảo đảm cho reminder:** loại tác vụ này phù hợp công việc phụ sau request, không phải scheduler bền vững chạy 24/7.

### 2.4. Developer tooling & quality

| Hạng mục | Công nghệ | Vai trò |
| --- | --- | --- |
| Formatter/linter | **Ruff** | Coding style, lint nhanh |
| Static type checker | **Pyright** | Kiểm tra type trong Python |
| Unit/integration tests | **pytest** | Test nghiệp vụ và hạ tầng |
| Async tests | **pytest-asyncio** hoặc `pytest.mark.anyio` | Test async services |
| API tests | **HTTPX** + `ASGITransport` | HTTP endpoint testing |
| Test coverage | **pytest-cov** | Báo cáo coverage |
| Test DB | PostgreSQL test instance, có thể dùng Testcontainers | Giữ semantics đúng PostgreSQL |
| Time freezing | `time-machine` hoặc clock abstraction | Test hết hạn, recurrence, DST |
| API client | OpenAPI generator phù hợp TypeScript | Chia sẻ contract với Next.js |
| Git hooks | pre-commit (tùy chọn) | Check trước commit |
| CI | GitHub Actions | Lint, typecheck, test, migration checks |
| Container | Docker + Docker Compose | Môi trường đồng nhất |
| Logs | Python logging JSON structured (formatter tùy chọn) | Dễ quan sát, tìm lỗi |
| Error monitoring | Sentry (tùy chọn) | Theo dõi lỗi production |
| Metrics/traces | OpenTelemetry (tùy chọn) | Thêm khi vận hành cần |

### 2.5. Dependency policy

- **Core:** chỉ cài framework, database, security, tests cần thiết.
- **Optional:** `redis`, `celery`, `apscheduler`, `sentry-sdk`, `opentelemetry-*`, `pywebpush` nếu đúng nhu cầu và hỗ trợ Python 3.14.
- Không cài Redis/Celery/APScheduler chỉ để tạo cảm giác “enterprise”.
- Trong `pyproject.toml`: constraint major/minor có chủ đích; trong `uv.lock`: lock chính xác transitive dependencies.
- Chỉ nâng package sau khi `uv lock`, `uv sync`, lint, tests và smoke-test Docker pass.
- Không tự động dùng pre-release nếu chưa được phê duyệt.

---

## 3. Python 3.14 Configuration Standard

### 3.1. Runtime baseline

| Biến | Giá trị/định hướng |
| --- | --- |
| Python minor | **3.14** |
| Python implementation | CPython |
| Interpreter variant | GIL-enabled mặc định; không chủ động dùng `3.14t` |
| Encoding | UTF-8 |
| Default locale | Không phụ thuộc locale để parse thời gian |
| Process timezone | UTC (khuyến nghị) |
| User timezone | `Asia/Ho_Chi_Minh` (configurable) |
| Timestamps persisted | UTC-aware `TIMESTAMPTZ` |
| Date-only values | PostgreSQL `DATE` |
| Reproducible builds | `.python-version` + `uv.lock` + Docker image lock |

**Tại sao không tự động nâng 3.15?** API và dependencies cần ổn định trước; chỉ nâng theo changelog + test matrix, không vì thông báo phiên bản mới.

### 3.2. Local Ubuntu — install và khởi tạo

> Các lệnh sau là **skeleton khởi tạo**, không phải bản code backend hoàn thiện. Thực thi bên trong thư mục `services/api` của monorepo.

```bash
# Cài uv (xem trang chính thức để kiểm tra script)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Cài và pin CPython 3.14
uv python install 3.14
mkdir -p services/api
cd services/api
uv init --bare --python 3.14
uv python pin 3.14

# API runtime / ORM / DB
uv add fastapi 'uvicorn[standard]' pydantic-settings
uv add 'sqlalchemy[asyncio]' alembic 'psycopg[binary]' python-dateutil

# Security
uv add 'pwdlib[argon2]' pyjwt

# Quality / Testing
uv add --dev ruff pyright pytest pytest-asyncio pytest-cov httpx

# Khóa phiên bản và kiểm tra môi trường
uv lock
uv sync
uv run python --version

# Sau khi app/main.py được tạo
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Lưu ý:** trước khi dùng lệnh cài package trong production, nên rà soát phiên bản tương thích và khóa lại trong `uv.lock`. Không dùng `sudo pip install` vào system Python.

### 3.3. `pyproject.toml` — baseline tham khảo

```toml
[project]
name = "personal-productivity-api"
version = "0.1.0"
requires-python = ">=3.14,<3.15"
description = "Personal Productivity App backend REST API"

# `uv add` sẽ ghi dependencies thực tế vào project.dependencies.
# Không tự điền version đoán mò; dùng uv.lock để khóa chính xác.

[tool.ruff]
target-version = "py314"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "ASYNC"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra"
asyncio_mode = "auto"

[tool.pyright]
pythonVersion = "3.14"
typeCheckingMode = "standard"
include = ["app"]
```

**Type checking:** bắt đầu `standard`, nâng dần lên `strict` ở domain/core sau khi đã ổn định; không disable toàn bộ linter để làm CI xanh.

---

## 4. Repository & Source Code Architecture — Hybrid Standard

### 4.1. Canonical Monorepo Layout

```text
personal-productivity/
├── apps/
│   ├── web/                              # Next.js + TypeScript (web first)
│   └── mobile/                           # Expo / React Native (later)
├── services/
│   └── api/                              # Python 3.14 + FastAPI
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py                   # FastAPI app factory / lifespan
│       │   ├── api/
│       │   │   ├── router.py             # Tổng hợp routers của các module, gắn /api/v1
│       │   │   └── dependencies.py       # Dependency HTTP dùng chung
│       │   ├── core/
│       │   │   ├── config.py             # pydantic-settings
│       │   │   ├── security.py           # Auth utilities / crypto, không chứa task logic
│       │   │   ├── exceptions.py         # Global exception handler
│       │   │   └── logging.py
│       │   ├── db/
│       │   │   ├── base.py               # DeclarativeBase + naming conventions
│       │   │   ├── session.py            # Engine, session factory
│       │   │   └── models.py             # Import ORM models để Alembic nhận metadata
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── api/
│       │   │   │   ├── services/
│       │   │   │   ├── repositories/
│       │   │   │   ├── models/
│       │   │   │   ├── schemas/
│       │   │   │   └── mappers/          # Chỉ tạo nếu mapping không tầm thường
│       │   │   ├── users/
│       │   │   ├── categories/
│       │   │   ├── projects/
│       │   │   ├── tasks/                # Sở hữu Task, RecurrenceRule, TaskOccurrence
│       │   │   │   ├── __init__.py
│       │   │   │   ├── api/
│       │   │   │   │   ├── task_router.py
│       │   │   │   │   ├── recurrence_router.py
│       │   │   │   │   └── occurrence_router.py
│       │   │   │   ├── services/
│       │   │   │   │   ├── task_service.py
│       │   │   │   │   ├── recurrence_service.py
│       │   │   │   │   ├── occurrence_service.py
│       │   │   │   │   └── task_query_service.py
│       │   │   │   ├── repositories/
│       │   │   │   │   ├── task_repository.py
│       │   │   │   │   ├── recurrence_rule_repository.py
│       │   │   │   │   └── occurrence_repository.py
│       │   │   │   ├── models/
│       │   │   │   │   ├── task.py
│       │   │   │   │   ├── recurrence_rule.py
│       │   │   │   │   └── task_occurrence.py
│       │   │   │   ├── schemas/
│       │   │   │   │   ├── requests/
│       │   │   │   │   │   ├── task_create.py
│       │   │   │   │   │   └── task_patch.py
│       │   │   │   │   └── responses/
│       │   │   │   │       ├── task_response.py
│       │   │   │   │       └── occurrence_response.py
│       │   │   │   ├── mappers/
│       │   │   │   │   ├── task_mapper.py
│       │   │   │   │   └── occurrence_mapper.py
│       │   │   │   ├── domain/
│       │   │   │   │   ├── recurrence_policy.py
│       │   │   │   │   └── status_policy.py
│       │   │   │   └── exceptions.py
│       │   │   ├── calendar/             # Read/query view; KHÔNG sở hữu TaskOccurrence
│       │   │   │   ├── api/
│       │   │   │   │   └── calendar_router.py
│       │   │   │   ├── services/
│       │   │   │   │   └── calendar_query_service.py
│       │   │   │   └── schemas/
│       │   │   │       └── responses/
│       │   │   │           └── calendar_response.py
│       │   │   ├── time_tracking/        # Sở hữu TimeEntry
│       │   │   │   ├── api/
│       │   │   │   ├── services/
│       │   │   │   ├── repositories/
│       │   │   │   ├── models/
│       │   │   │   ├── schemas/
│       │   │   │   └── mappers/
│       │   │   ├── reminders/            # Sở hữu ReminderRule/Job/Delivery/Subscription
│       │   │   ├── analytics/            # Read-model / metric computations
│       │   │   ├── habits/               # Thêm khi chốt habit model
│       │   │   ├── goals/                # Thêm khi chốt goal model
│       │   │   └── exports/              # Thêm khi có yêu cầu export
│       │   ├── workers/
│       │   │   ├── reminder_worker.py    # Process entrypoint, gọi reminders service
│       │   │   └── recurrence_worker.py  # Nếu chọn pre-generation
│       │   └── shared/
│       │       ├── clock.py              # Clock Protocol/test clock
│       │       ├── pagination.py
│       │       └── types.py
│       ├── alembic/
│       │   ├── env.py
│       │   └── versions/
│       ├── tests/
│       │   ├── conftest.py
│       │   ├── unit/
│       │   │   └── modules/
│       │   │       ├── tasks/
│       │   │       └── reminders/
│       │   ├── integration/
│       │   │   └── modules/
│       │   ├── api/
│       │   │   └── v1/
│       │   └── workers/
│       ├── pyproject.toml
│       ├── uv.lock
│       ├── .python-version
│       ├── .env.example
│       ├── Dockerfile
│       └── README.md
├── packages/
│   └── api-client/                      # TypeScript types/client từ OpenAPI
├── infra/
│   └── compose.yaml
├── docs/
│   ├── architecture/
│   ├── decisions/                       # ADRs, gồm quyết định Hybrid
│   └── api/
└── README.md
```

> **Lưu ý:** Tree trên thể hiện **đích kiến trúc**, không có nghĩa phải tạo toàn bộ thư mục ngay. Thư mục không có file sẽ được bổ sung đúng thời điểm. Package Python sử dụng `__init__.py` khi cần để giữ import paths rõ ràng.

### 4.2. Canonical Module Template

Module nghiệp vụ vừa/đủ lớn như `tasks` theo khuôn sau:

```text
modules/<domain>/
├── api/                      # FastAPI Router / HTTP adapters
│   └── <domain>_router.py
├── services/                 # Use cases, orchestration, Unit of Work boundary
│   └── <domain>_service.py
├── repositories/             # SQLAlchemy select/insert/update, persistence
│   └── <domain>_repository.py
├── models/                   # SQLAlchemy ORM entities, relationships
│   └── <domain>.py
├── schemas/                  # Pydantic API DTOs
│   ├── requests/
│   └── responses/
├── mappers/                  # ORM / domain → API DTO; nếu có logic mapping
├── domain/                   # Pure rules, value objects, state transitions khi cần
└── exceptions.py             # Domain errors (nếu có)
```

- **Module nhỏ** chỉ có `api/`, `services/`, `schemas/` vẫn hợp lệ.
- **Module query-only** như Calendar có thể không có model/repository riêng; gọi **public TaskQueryService**, không giành quyền sở hữu `task_occurrences`.
- Không áp đặt interface/abstract class cho mọi Service/Repository khi chỉ có một implementation và không có nhu cầu test/extension cụ thể.

### 4.3. Responsibility Matrix (tầng kỹ thuật)

| Layer / Directory | Được làm | Không được làm |
| --- | --- | --- |
| `api/` | Router, dependency injection, request parse, HTTP status, gọi service, mapping response | SQL queries, nghiệp vụ phức tạp, commit DB |
| `schemas/requests/` | Pydantic validation input, typed patch fields | ORM mapping, ghi DB, xử lý nghiệp vụ |
| `services/` | Business use cases, authorization logic, call repositories, transaction/UoW | HTTP-specific concerns, raw serialization, tự ý gửi notify bên trong DB transaction |
| `domain/` | Pure business rules: recurrence, status transitions, invariants | Import FastAPI, gọi database, network I/O |
| `repositories/` | SQLAlchemy queries, paging, eager loading, `flush` theo contract | Business decisions, tự `commit` mặc định, trả HTTP responses |
| `models/` | SQLAlchemy ORM classes, keys, indexes, relations | API JSON schema, HTTP handlers |
| `mappers/` | Convert ORM/domain → response DTO, handle nested fields có kiểm soát | Query DB, commit, auth decisions |
| `schemas/responses/` | API contract, serialization rules, field visibility | Truy vấn DB, xử lý mutation |
| `core/` | Cấu hình, bảo mật kỹ thuật, logging, common exceptions | Domain business logic của Tasks/Habits |
| `db/` | Engine, `AsyncSession`, model discovery | Task create/edit logic |
| `workers/` | Process entrypoint, claim/start jobs, gọi module services | Copy/paste logic nghiệp vụ từ Services |
| `shared/` | Pure cross-cutting primitives thực sự dùng chung | Gom mọi thứ chưa biết bỏ đâu vào `utils.py` |

### 4.4. Request / Response Pipeline

```text
POST /api/v1/tasks
    |
    v
modules/tasks/api/task_router.py
    | validates with TaskCreateRequest
    v
modules/tasks/services/task_service.py
    | enforces ownership, business invariants, opens UoW
    v
modules/tasks/repositories/task_repository.py
    | SQLAlchemy ORM Task, session.flush()
    v
PostgreSQL
    |
    v
TaskService returns application result / loaded entity
    |
    v
modules/tasks/mappers/task_mapper.py   <- gọi tại API boundary nếu mapping phức tạp
    |
    v
modules/tasks/schemas/responses/task_response.py
    |
    v
HTTP 201 + JSON
```

**Không hiểu nhầm `model → mapper → response` là thứ tự thực thi bắt buộc trong Service.** Model/DTO là kiểu dữ liệu; API có thể dùng `TaskResponse.model_validate(entity)` với `from_attributes=True` khi mapping đơn giản. Chỉ viết `mapper.py` khi có nested fields, computed fields, renaming, visibility, timezone formatting phức tạp.

### 4.5. Module Ownership — Quy tắc quan trọng nhất

| Module | Sở hữu dữ liệu/logic | Modules khác sử dụng qua |
| --- | --- | --- |
| `auth` | Đăng nhập, refresh session, token revoke | Public auth dependencies / auth service |
| `users` | User profile, settings/timezone | UserSettingsQueryService |
| `categories` | `categories` | CategoryQueryService |
| `projects` | `projects` | ProjectQueryService |
| **`tasks`** | **`tasks`, `recurrence_rules`, `task_occurrences`, recurrence generation, occurrence transitions** | **TaskQueryService + public commands** |
| `calendar` | Aggregation/query view theo ngày/tuần/tháng | TaskQueryService và TimeTracking queries |
| `time_tracking` | `time_entries`, timer semantics | TimeTrackingQueryService |
| `reminders` | Reminder config, jobs, subscription/delivery | ReminderService public API |
| `analytics` | Metric definitions, read queries | Public queries hoặc optimized read models có review |
| `habits` | `habit_logs` nếu có model riêng | HabitQueryService |
| `goals` | `goals`, `goal_progress` khi duyệt | GoalQueryService |

**Đã chốt ownership ở mức kiến trúc:** Recurrence và Occurrence **thuộc Tasks module**, không tạo 2 modules `recurrence/`, `occurrences/` riêng từ đầu. Các HTTP endpoint `/recurrences`, `/occurrences` vẫn có thể tồn tại, nhưng routers nằm trong `modules/tasks/api/`. Calendar là read/use-case projection, không tạo bản sao bảng occurrence.

### 4.6. Cross-Module Dependency Rules

1. Module khác **không import trực tiếp** `repositories/` hoặc ORM `models/` nội bộ của module sở hữu để ghi dữ liệu.
2. Liên hệ giữa modules qua **public application services/query services** hoặc published interfaces rõ ràng; tránh `from ... import ...` xuyên vào đường dẫn private.
3. Nếu cần một nghiệp vụ xuyên nhiều module, có thể dùng **application orchestration service** với ownership/transaction được ghi ADR, không tạo vòng phụ thuộc.
4. `analytics` có thể cần SQL JOIN nhiều bảng để tổng hợp nhanh: cho phép **read-only reporting repository** có review, không làm business write qua analytics.
5. `calendar` không trực tiếp cập nhật occurrence; thao tác dời lịch ủy quyền cho `tasks.OccurrenceService`.
6. Không circular imports, không dùng event bus hoặc distributed events khi gọi service trực tiếp đã đủ.
7. Không tăng mức trừu tượng chỉ để đạt “clean architecture” trên giấy. Có thể dùng Protocol/interface khi coupling thực sự là vấn đề.

### 4.7. Database Transaction / Unit of Work (UoW)

- **Service/application use case** làm chủ transaction: commit một lần khi thành công, rollback khi lỗi.
- **Repository** sử dụng `AsyncSession` do caller cung cấp; không tự tạo session riêng và không tự `commit()` theo mặc định.
- Dùng `flush()` khi cần lấy ID/kiểm tra constraints trước khi trả dữ liệu; flush **không** đồng nghĩa commit.
- Tạo một session cho mỗi HTTP request/UoW; worker tạo session cho mỗi batch/job; không share `AsyncSession` đồng thời giữa nhiều coroutines.
- Không gọi HTTP/Web Push trong khi đang giữ transaction mở; muốn gửi notification dùng durable reminder job/outbox phù hợp.
- Dùng `expire_on_commit=False` nếu trả ORM sau commit; vẫn yêu cầu query eager-loaded để tránh lazy async I/O không kiểm soát.
- Domain service kiểm tra quyền sở hữu ngay cả khi SQL có `user_id` filter; **defense in depth**, nhưng không đòi hỏi lookup trùng lặp.

### 4.8. API Router Registration / Dependency Injection

```text
app/main.py
  └── app/api/router.py                # include_router(..., prefix="/api/v1")
       ├── modules/auth/api/auth_router.py
       ├── modules/tasks/api/task_router.py
       ├── modules/tasks/api/occurrence_router.py
       ├── modules/calendar/api/calendar_router.py
       └── ...

app/api/dependencies.py               # current_user, db session, common dependencies
modules/tasks/api/dependencies.py     # nếu cần TaskService factory riêng cho feature
```

- Router feature định nghĩa **feature-specific prefix** như `/tasks` hoặc `/occurrences`.
- `app/api/router.py` gắn version prefix một lần, tránh thành `/api/v1/api/v1/tasks`.
- Các endpoint vẫn xuất đúng REST/OpenAPI contract như trong mục 8.
- `Depends` / `Annotated` không lọt xuống pure domain rules. DI wiring nên nằm ở API boundary hoặc composition root.

### 4.9. Test Layout & Mocking

- `tests/unit/modules/tasks/`: test policy/service thuần, fake repository hoặc test doubles cần thiết.
- `tests/integration/modules/tasks/`: test SQLAlchemy repositories trên **PostgreSQL thật** bằng disposable database.
- `tests/api/v1/`: test FastAPI validation/auth/serialization bằng HTTPX.
- `tests/workers/`: claim, retries, crash recovery.
- Mỗi thay đổi ở `modules/tasks/` phải có regression tests cho cùng module; nếu đổi OpenAPI thì thêm API contract tests.

### 4.10. Anti-Patterns bị cấm

- Global `app/services/task_service.py` và `app/repositories/task_repository.py` **song song** với `modules/tasks/` (hai nguồn code nghiệp vụ).
- `TaskRouter` query DB trực tiếp, xử lý recurrence hoặc `session.commit()`.
- `TaskRepository` quyết định khi nào một occurrence được chuyển DONE/CANCELLED.
- `TaskService` import FastAPI `Request`, `HTTPException`, response DTO rồi tự serialize JSON.
- `TaskMapper` query Postgres, gọi LLM/network hoặc commit session.
- `Calendar` hoặc `Analytics` cập nhật bảng `task_occurrences` trực tiếp.
- Copy một logic recurrence vào cả `tasks`, `calendar`, `reminders`.
- Mọi module đều phải tạo 6 thư mục đầy đủ ngay cả khi chưa có nhu cầu.
- Dùng nhiều `BaseClass`/interfaces chỉ để giống Java hơn, nhưng không có giá trị kiểm thử/extension.

---

## 5. Backend Module Scope & Delivery Plan

| Module | API / chức năng | Chủ sở hữu dữ liệu | Phase |
| --- | --- | --- | --- |
| `auth` | Login, logout, refresh, session revoke | `refresh_sessions`, auth credentials/session | 1 |
| `users` | Profile, timezone, week start, settings | `users`, `user_settings` | 1 |
| `categories` | Category CRUD, ordering, archive | `categories` | 2 |
| `projects` | Project CRUD, archive, task association queries | `projects` | 2 |
| `tasks` | Task CRUD, recurrence rules, generation, occurrence status/schedule | `tasks`, `recurrence_rules`, `task_occurrences` | 2 |
| `calendar` | Date-range/day/week/month projections, time-blocking view | Không sở hữu bảng riêng lúc đầu | 3 |
| `time_tracking` | Timer lifecycle và manual entries | `time_entries` | 3 |
| `reminders` | Reminder rules, durable jobs, retries, subscription/deliveries | Reminder-related tables | 4 |
| `analytics` | Completion, heatmap, allocation, trends | Read models/queries; không sở hữu dữ liệu gốc | 5 |
| `habits` | Check-in, streaks | `habit_logs` nếu chốt model riêng | 6 |
| `goals` | Progress, goal targets | `goals`, `goal_progress` | 6 |
| `exports` | CSV/JSON export, backup API khi cần | Không sở hữu dữ liệu gốc | 6 |

**Phạm vi:** App cá nhân trước. Không tạo role matrix enterprise/multi-tenant phức tạp, nhưng vẫn áp dụng ownership `user_id` cho từng truy vấn và trường hợp mobile có nhiều sessions. Mỗi module chỉ được thêm khi schema/use case tương ứng đã được duyệt.

---

## 6. Database Design Standard — PostgreSQL

### 6.1. Core model (đúng domain đã phân tích)

```text
User
 ├── Category
 ├── Project
 └── Task (định nghĩa công việc)
       ├── RecurrenceRule (quy tắc lặp)
       └── TaskOccurrence (một lần xuất hiện)
                └── TimeEntry (0..n phiên thực tế)
```

**Chính xác hơn:** `time_entries.occurrence_id` có thể **NULL** vì có hoạt động độc lập không gắn với occurrence. Bảng `time_entries` vẫn có `user_id`.

### 6.2. Các bảng lõi dự kiến

| Table | Vai trò | Ghi chú |
| --- | --- | --- |
| `users` | Identity/account | Bổ sung phục vụ auth |
| `user_settings` | Timezone, preferences | Có thể thêm sớm |
| `categories` | Phân loại hoạt động | Chủ sở hữu `user_id` |
| `projects` | Gom task theo dự án | Archive thay hard delete |
| `tasks` | Định nghĩa công việc | **Không lưu `DONE` cho task lặp** |
| `recurrence_rules` | DAILY/WEEKLY/MONTHLY | Version/active/end date |
| `task_occurrences` | Từng lần thực hiện | Có `scheduled_date`, `status` |
| `time_entries` | Thời gian thực tế | `occurrence_id` nullable |

### 6.3. Bảng mở rộng khi đến module

| Table | Trách nhiệm | Thời điểm |
| --- | --- | --- |
| `refresh_sessions` | Refresh token rotation/revocation | Cùng Auth |
| `reminder_rules` | Nhắc trước X phút hoặc theo lịch cụ thể | Khi làm Reminders |
| `reminder_jobs` | Công việc cần gửi, retry, schedule | Khi làm Reminders |
| `reminder_deliveries` | Kết quả gửi từng kênh/thiết bị | Khi làm Reminders |
| `push_subscriptions` | Web Push subscriptions | Khi làm Web Push |
| `habit_logs` | Check-in thói quen | Khi làm Habits |
| `goals`, `goal_progress` | Mục tiêu / lịch sử tiến độ | Khi làm Goals |
| `audit_events` | Audit hoạt động nhạy cảm | Nếu thực sự cần |

**Không tạo sẵn tất cả bảng trong Phase 1.** ERD và migrations phải dựa trên use case đã chốt, không thêm bảng chỉ vì có thể hữu ích sau này.

### 6.4. PostgreSQL conventions

- Primary key: UUID (`UUID` native PostgreSQL). Quyết định UUIDv4/v7 trong ERD review; UUIDv7 có thể cân nhắc nhưng không bắt buộc.
- `created_at`, `updated_at`, `completed_at`: `TIMESTAMPTZ`.
- `scheduled_date`: `DATE`, **không ép phải có giờ**.
- `start_at`, `end_at`: planned timestamps và phải **khác** actual time.
- `duration_seconds`: integer không âm; lưu thực tế theo logic đã duyệt.
- Foreign keys + unique constraints + CHECK constraints ở database.
- Index các truy vấn `(user_id, date/status)`, `(task_id, scheduled_date)`, `(project_id, ...)` theo query thật.
- `recurrence_key`: key ổn định chống tạo trùng cùng một lần lặp; cần unique constraint phù hợp.
- `archived_at`: ưu tiên hơn xóa cứng với dữ liệu có lịch sử.
- Tránh lưu “overdue” dạng trạng thái vật lý; tính từ thời hạn và trạng thái hiện tại.
- Khi chỉnh recurrence rule: giữ các occurrence đã DONE; tương lai xử lý theo policy riêng.
- Không dùng floating-point cho số liệu tài chính nếu một ngày có thêm chi phí; với thời lượng dùng integer seconds.

### 6.5. Migration policy

1. Mọi thay đổi schema đều có **Alembic revision**.
2. Không dùng `create_all()` để tự cập nhật schema production.
3. Migration phải **review thủ công** dù dùng autogenerate.
4. Tránh destructive migration trực tiếp; làm expand → migrate data → contract.
5. DB schema và SQLAlchemy models phải đồng bộ; CI kiểm tra migrations/head.
6. Backup trước migration rủi ro; phải có phương án rollback dữ liệu (downgrade không phải lúc nào an toàn).
7. Cần test migration trên PostgreSQL thật, không chỉ SQLite in-memory.

---

## 7. Time, Recurrence & Scheduling Rules

Đây là phần dễ gây bug nhất, phải được test kỹ hơn CRUD thông thường.

### 7.1. Ba khái niệm không được trộn

| Khái niệm | Ví dụ | Lưu ở đâu |
| --- | --- | --- |
| **Task definition** | “Học tiếng Anh” | `tasks` |
| **Task occurrence** | Học lúc 20:00 ngày 17/11 | `task_occurrences` |
| **Time entry** | Học thật từ 20:05 đến 20:35 | `time_entries` |

Một task gốc có nhiều occurrences, một occurrence có thể có nhiều time entries. **Không dùng thời gian dự kiến để suy ra thời gian đã thực hiện.**

### 7.2. Recurrence engine

- Ban đầu hỗ trợ: `DAILY`, `WEEKLY`, `MONTHLY`; interval và weekday tùy chọn.
- Chưa cần hỗ trợ toàn bộ RFC 5545 ngay khi MVP.
- Hướng triển khai: sinh occurrences **on demand** theo range, hoặc sinh trước theo rolling window (30/90 ngày). **Cần chốt ở ERD/design review.**
- Generation phải **idempotent**, gọi lại không được sinh bản sao.
- Bản đã DONE/đã nhập time entry không được “regenerate” ghi đè.
- Thay đổi rule có effective date và chính sách với occurrence tương lai.
- Hủy một lần lặp phải không hủy toàn bộ series nếu người dùng chỉ chọn “this occurrence”.
- Test cuối tháng (28/29/30/31), năm nhuận và DST cho timezone khác Việt Nam.
- `dateutil.rrule` có quy tắc bỏ qua các ngày/giờ không tồn tại; phải định nghĩa UX muốn bỏ qua hay chuyển ngày, không phỏng đoán.

### 7.3. Time tracking

- Timer: start, pause, resume, stop; design policy riêng cho timer bị bỏ quên.
- Phải giới hạn **một timer active cho mỗi user** (hoặc nêu rõ nếu muốn hỗ trợ parallel).
- Manual entry được phép, đánh dấu `source = MANUAL`.
- Validate `ended_at >= started_at`; không cho duration âm.
- Tính active duration có quy tắc rõ ràng cho pause intervals.
- Không cộng trùng khi phân tích thời gian nếu các phiên chồng lấp.
- Thay đổi máy hoặc refresh trang không làm mất timer đã được lưu server-side.

### 7.4. Timezone policy

- Backend lưu UTC-aware instant (`TIMESTAMPTZ`).
- Recurrence theo **calendar date/time trong timezone của user**.
- Khi hiển thị “hôm nay”, tính theo `user_settings.timezone`, không dùng timezone server.
- `scheduled_date` đại diện ngày theo địa phương; đồng bộ riêng với `start_at`/`end_at`.
- Không tự `replace(tzinfo=...)` để chuyển đổi một UTC datetime sai cách.
- Test DST nonexistent/ambiguous local time ở các timezone có đổi giờ.

---

## 8. REST API Contract & Conventions

### 8.1. API versioning

- Prefix **`/api/v1`** ngay từ đầu.
- Resources là danh từ số nhiều (`/tasks`, `/projects`, `/occurrences`).
- JSON request/response dùng **snake_case** hoặc **camelCase** thống nhất; tài liệu này đề xuất **snake_case** tương ứng Python + DB, frontend sinh TypeScript client từ OpenAPI (có thể mapping khi cần).
- `created_at`, `completed_at`: ISO 8601 có offset/UTC (`Z`).
- `scheduled_date`: `YYYY-MM-DD`.
- Enum code trong API ổn định, upper snake case nếu nhất quán với DB.
- Không expose stack trace, SQL error hoặc secrets qua API.

### 8.2. Định hướng endpoints

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| `GET` | `/health/live` | Liveness (không phụ thuộc DB) |
| `GET` | `/health/ready` | Readiness (có kiểm tra phụ thuộc tối thiểu) |
| `POST` | `/api/v1/auth/login` | Login |
| `POST` | `/api/v1/auth/refresh` | Refresh/rotation |
| `POST` | `/api/v1/auth/logout` | Thu hồi session |
| `GET` | `/api/v1/users/me` | Current user |
| `GET/POST` | `/api/v1/categories` | Danh sách / tạo category |
| `GET/POST` | `/api/v1/projects` | Danh sách / tạo project |
| `GET/POST` | `/api/v1/tasks` | Danh sách / tạo task definition |
| `GET/PATCH` | `/api/v1/tasks/{task_id}` | Xem / sửa task |
| `GET/POST` | `/api/v1/occurrences` | Truy vấn / tạo occurrence |
| `PATCH` | `/api/v1/occurrences/{id}` | Đổi lịch / trạng thái |
| `GET` | `/api/v1/calendar` | Occurrences theo range |
| `POST` | `/api/v1/time-entries` | Lưu thời gian thực tế |
| `GET` | `/api/v1/analytics/overview` | Tổng quan thống kê |
| `GET` | `/api/v1/analytics/heatmap` | Heatmap theo metric |
| `POST` | `/api/v1/reminders/subscriptions` | Đăng ký thiết bị nhận Web Push (sau) |

**Endpoints trên là draft API contract**, cần duyệt khi module được triển khai. Tránh API endpoint ghi đè cả đối tượng khi người dùng chỉ sửa một vài trường.

### 8.3. HTTP & error conventions

| Trường hợp | Status |
| --- | --- |
| GET/PATCH thành công | 200 |
| Tạo resource thành công | 201 |
| Xóa/đóng mà không cần body | 204 |
| Request invalid | 422 hoặc 400 theo quy ước chuẩn hóa |
| Chưa đăng nhập | 401 |
| Không có quyền | 403 (hoặc 404 nếu cần tránh lộ dữ liệu) |
| Không tìm thấy resource | 404 |
| Trạng thái xung đột | 409 |
| Rate limited | 429 |
| Server error | 500 (không leak details) |

Khuyến nghị một **error envelope chuẩn hóa**:

```json
{
  "error": {
    "code": "OCCURRENCE_ALREADY_COMPLETED",
    "message": "Completed occurrence cannot be overwritten by recurrence regeneration",
    "details": null
  },
  "request_id": "example-request-id"
}
```

- Code lỗi machine-readable, message dễ hiểu, không dựa vào parse chuỗi lỗi.
- Chọn thống nhất schema lỗi cho Pydantic validation errors tại API boundary.
- Pagination: limit có maximum; `cursor` khi dữ liệu lớn hoặc offset khi MVP, thống nhất mỗi endpoint.
- Filtering: `start_date`, `end_date`, `status`, `project_id`, `category_id` khi có ý nghĩa.
- Đặt giới hạn date range của Calendar/Analytics để tránh query vô hạn.

### 8.4. Update semantics

- `PATCH`: **chỉ cập nhật field được cung cấp**; field vắng mặt giữ nguyên.
- Phân biệt field `null` (xóa giá trị nếu hợp lệ) với **field không gửi**.
- Dùng Pydantic `model_fields_set` hoặc `model_dump(exclude_unset=True)` khi cần.
- Không tự biến `null` thành giá trị mặc định âm thầm.
- Validate quyền sở hữu, trạng thái và invariants trước khi commit.
- Khi hai thiết bị sửa cùng một task, xem xét optimistic concurrency (`version`/`updated_at`, `If-Match`) nếu thực tế phát sinh lost updates.

---

## 9. Authentication & Security Architecture

### 9.1. Định hướng auth

Cho cá nhân dùng trước, chọn **email/password + access token ngắn hạn + refresh token có rotation**, hoặc một giải pháp session tương đương sau khi security review. Khuyến nghị JWT cho access token, còn refresh session được quản lý **server-side** để thu hồi.

- Access token ví dụ 10–15 phút (cấu hình được).
- Refresh lifetime ví dụ 7–30 ngày tùy risk profile; **không coi đây là thời hạn bắt buộc**.
- Refresh token chỉ lưu dạng **hash** ở DB (hoặc cơ chế rotation tương đương).
- Rotate mỗi lần refresh; phát hiện token reuse để revoke session family.
- Có `logout all devices` và revoke từng device nếu cần.
- Không dùng một JWT access token vô thời hạn.
- Không tin `user_id` gửi từ client: user identity lấy từ verified credential.

### 9.2. Web client

- Đối với Next.js Web, ưu tiên auth bằng **Secure, HttpOnly, SameSite cookies** với thiết kế CORS/CSRF rõ ràng.
- Nếu frontend/backend dùng subdomains khác nhau, xem xét site/origin/credentials thực tế; **không** bật `allow_origins=["*"]` kèm credentials.
- Với cookie-bearing mutating requests, chống CSRF bằng token và/origin verification.
- Không lưu refresh token trong `localStorage`.

### 9.3. iOS client (giai đoạn sau)

- Mobile app dùng cùng API/auth logic.
- Giữ token trong iOS Keychain/SecureStore, không lưu plain text.
- Kế hoạch notification qua SideStore có thể gặp giới hạn APNs/entitlements; **không mặc định remote push chạy được** chỉ vì IPA đã cài thành công.
- Local notifications trên iPhone là một đường triển khai riêng; backend cung cấp lịch đã đồng bộ.

### 9.4. Security controls

- HTTPS production bắt buộc.
- DB credentials và signing secrets nằm trong environment/secret manager, không commit Git.
- Separate dev/staging/prod DB, token keys và origins.
- Rate limit login/refresh; log failed logins theo cách tránh lộ PII/secrets.
- Password hash Argon2id, không tự thiết kế encryption algorithm.
- CORS allowlist theo origin đã biết.
- Strict request validation, parameterized SQL qua ORM/Core.
- Security headers tại reverse proxy hoặc app phù hợp.
- Giới hạn body size, request timeout, URL params và upload nếu có.
- Áp dụng least-privilege DB account; migration role riêng nếu cần.
- Secret rotation & backup policy rõ ràng.

---

## 10. Reminder & Notification Architecture

### 10.1. Yêu cầu chức năng

- Nhắc trước task `N` phút, nhắc đúng ngày/giờ, có timezone của người dùng.
- Có thể bật/tắt notification theo user và thiết bị.
- Reminder được hủy hoặc reschedule khi occurrence thay đổi phù hợp policy.
- Không gửi thông báo trùng khi scheduler retry hoặc process restart.
- Có trạng thái gửi và lỗi để debug.
- Chỉ gửi khi người dùng đã cấp quyền notification trên thiết bị.

### 10.2. Luồng đề xuất

```text
Occurrence created / updated
        │
        ▼
Derive reminder time using user timezone
        │
        ▼
Persist reminder_jobs (PENDING)
        │
        ▼
External Cron ─► Reminder worker
                       │
                       ▼
               Claim due jobs in DB
                       │
                       ▼
               Verify current revision
                       │
             ┌─────────┴──────────┐
             ▼                    ▼
       Send Web Push       Skip/cancel outdated
             │
             ▼
       Record delivery state / retry policy
```

### 10.3. Thiết kế vận hành

- Persist jobs trong DB, không lưu lịch nhắc **chỉ trong memory**.
- Dùng `job_id`, `occurrence_id`, `device/channel`, `scheduled_for`, `revision`, status.
- `PENDING`, `PROCESSING`, `SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `CANCELLED` (tên chi tiết sẽ chốt ở schema).
- Idempotency key/unique constraint để mỗi reminder revision/channel/device không bị tạo trùng.
- Claim bằng transaction + row locking, có `lease_expires_at` để recover job khi worker chết.
- Không giữ database transaction mở trong suốt network call ra push provider.
- Retry exponential backoff, max retry, xử lý expired subscription/token.
- Khi sửa occurrence, tăng `revision` và invalidate jobs cũ thay vì ghi đè mù.
- Với job gửi quá giờ: có **grace window** và policy bỏ qua/nhắc muộn — **phải chốt theo UX**.
- Push delivery acknowledgment không đồng nghĩa thiết bị đã hiển thị/thấy thông báo.

### 10.4. Hosting limitations

- Backend free tier ngủ khi không có request có thể khiến job trễ; không để reminder scheduler lệ thuộc process API luôn sống.
- Free cron chạy theo chu kỳ không bảo đảm đúng đến từng giây; xác định SLA nhắc việc thực tế.
- Với thông báo quan trọng cần đúng giờ cao, cân nhắc worker always-on và/hoặc local iOS notifications.
- Worker có thể cùng Docker image với API, nhưng **chạy command riêng**, không tự động chạy nhiều scheduler trong mỗi API replica.

### 10.5. Web Push vs iOS Native

| Kênh | Backend cần | Ghi chú |
| --- | --- | --- |
| Web Push / browser/PWA | Push subscription + server send | Kiểm thử quyền và hành vi từng browser |
| iOS local notification | API đồng bộ lịch/nhắc xuống mobile | Không phụ thuộc backend tại thời điểm phát local notification nếu đã schedule |
| iOS remote APNs | APNs credentials + entitlements + provider | Cần kiểm tra giới hạn signing qua SideStore |

**Phạm vi giai đoạn đầu:** ưu tiên reminder correctness và Web Push cho web, chưa triển khai APNs native nếu chưa xác minh khả năng signing.

---

## 11. Analytics: Data Model & Metric Integrity

### 11.1. Nhóm metrics

| Metric | Nguồn dự kiến | Lưu ý |
| --- | --- | --- |
| Task Completion Rate | `task_occurrences` | Phải định nghĩa mẫu số |
| Total Completed | `task_occurrences` | Theo `completed_at` hoặc scheduled date — phải rõ |
| Overdue Tasks | Due time/date + occurrence status | Không dùng status `OVERDUE` lưu cứng |
| Active Time | `time_entries` | Chống cộng trùng intervals |
| Time by Project/Category | Time Entry → Task link | Cần policy cho entry độc lập |
| Planned vs Actual | Occurrence planned + time entries | Không trộn trường dữ liệu |
| Activity Heatmap | Entries/checkins/completions | Chọn một metric mỗi chế độ |
| Focus Sessions | Time entries/timer events | Pause/resume phải nhất quán |
| Habit Streak | Habit logs | Quy tắc missed day rõ ràng |

### 11.2. Metric specification bắt buộc

Mỗi metric phải có 7 yếu tố: **name, formula, timeframe, unit, source tables, inclusion/exclusion policy, edge cases**.

- Không lấy `DONE` trên task definition làm nguồn truth cho task lặp.
- Không mặc định tính các occurrence tương lai vào mẫu số completion rate.
- Không cộng duration 2 phiên chồng nhau nếu metric là unique active time.
- Phân biệt “không có dữ liệu” và “đã xác nhận không hoạt động”.
- Dữ liệu đủ nhỏ: compute từ SQL; chưa cần cache hay precomputed snapshot.
- Có unit test metric bằng dataset có expected results rõ ràng.

---

## 12. Configuration & Environment Variables

### 12.1. `pydantic-settings`

- Khởi tạo Settings từ environment variables.
- Validate `DATABASE_URL`, auth secrets, CORS origins khi start app.
- Chia `.env.example` (**commit**) và `.env` (**không commit**).
- Production lấy secret từ platform, không copy `.env` trong Docker image.
- Runtime không log toàn bộ Settings object.

### 12.2. `.env.example`

```dotenv
APP_NAME=Personal Productivity API
APP_ENV=development
APP_DEBUG=true
APP_HOST=127.0.0.1
APP_PORT=8000

# DB: PostgreSQL via Psycopg 3; URL encoding for special password chars
DATABASE_URL=postgresql+psycopg://app_user:CHANGE_ME@localhost:5432/productivity
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
DB_POOL_TIMEOUT_SECONDS=30

# Backend process timestamps UTC; user date boundary may differ
DEFAULT_USER_TIMEZONE=Asia/Ho_Chi_Minh

# Auth - provide strong production secrets via secret manager
JWT_ALGORITHM=HS256
JWT_SECRET_KEY=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=14
COOKIE_SECURE=false

# Explicit comma-separated allowlist; adapt parser in Settings model
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Cron-to-worker auth (if external trigger approach is selected)
REMINDER_WORKER_SECRET=CHANGE_ME
REMINDER_POLL_INTERVAL_SECONDS=60

# Monitoring
LOG_LEVEL=INFO
SENTRY_DSN=
```

**Các giá trị trên là placeholders/dev defaults**. Không reuse `CHANGE_ME` khi deploy. `APP_DEBUG=false`, `COOKIE_SECURE=true` và origins HTTPS là điều kiện production.

### 12.3. Database sessions

- **Một `AsyncSession` per request / unit of work**.
- Async SQLAlchemy sessions **không được chia sẻ đồng thời** qua nhiều coroutine/tasks.
- Transaction boundaries rõ ràng: success commit, failure rollback.
- API server pool nhỏ để phù hợp quota managed PostgreSQL; tính tổng connections theo số replicas/processes.
- `pool_pre_ping` và timeout theo environment.
- SSL khi kết nối managed DB production.
- Kiểm thử setting prepared statements nếu đi qua transaction pooler/PgBouncer; không mặc định cấu hình chạy đúng trên mọi provider.

---

## 13. Coding Standards & AI Coding Rules

### 13.1. Clean Python

- Type hints đầy đủ cho public functions và service interfaces.
- Ưu tiên immutable/request-specific objects khi phù hợp.
- Giới hạn dependency injection; không global mutable state.
- `async def` chỉ khi gọi async I/O; không chạy blocking I/O/CPU-heavy trực tiếp trên event loop.
- Không dùng `except Exception: pass` để giấu lỗi.
- Không hardcode timezone, magic strings, auth secrets.
- Ràng buộc nghiệp vụ ở service/domain và DB; frontend validation chỉ hỗ trợ UX.
- Cần log để debug nhưng **không log mật khẩu/token/PII nhạy cảm**.

### 13.2. Quality gates

- `ruff check .` không lỗi.
- `ruff format --check .` không lỗi.
- `pyright app` không lỗi **trong scope type-checking đã chốt**.
- `pytest` pass trên môi trường test.
- Migration được review và chạy trên test database.
- OpenAPI schema generation không lỗi và không gây breaking change không chủ ý.
- Docker image khởi chạy và đáp ứng readiness.

### 13.3. Quy định cho Codex/Claude Code

**Kiến trúc bắt buộc:** `app/modules/<domain>/{api,services,repositories,models,schemas,mappers}`. Module nào nhỏ chỉ tạo tầng cần thiết. Không tự chuyển về global `app/services`, `app/repositories`; không tự chia thành microservices.


1. **Đọc spec trước khi sửa code.** Không tự ý đổi FastAPI sang Django/NestJS.
2. Không tự ý đổi phiên bản Python ngoài 3.14.x.
3. Không thêm library mới khi chưa nêu lý do và tác động transitive dependencies.
4. Không tự tạo database tables ngoài ERD đã duyệt.
5. Mọi schema change đi kèm Alembic migration và tests.
6. Phân biệt Task/Occurrence/Time Entry; không lưu status Done ở Task gốc.
7. Update PATCH chỉ sửa field có mặt; không reset field không gửi.
8. Worker/recurrence phải idempotent và tránh duplicate.
9. Tạo tests cho business rules trước hoặc cùng lúc với code.
10. Không tắt lint/typecheck/test chỉ để hợp thức hóa kết quả.
11. Không đụng vào frontend design tokens, trừ khi task liên quan FE rõ ràng.
12. Trước mỗi PR: mô tả thay đổi, migration, test results và rủi ro.
13. Mỗi Task PR chỉ sửa module tương ứng và public interfaces cần thiết; nếu thay đổi module ownership phải bổ sung ADR.
14. Không import private repositories/models xuyên module để mutate dữ liệu; sử dụng public services.
15. Service chịu trách nhiệm transaction; repository không tự commit; mapper không query DB; router không viết business logic.

---

## 14. Testing Strategy

### 14.1. Test pyramid

**Cấu trúc test:** Đặt theo module nghiệp vụ (`tests/unit/modules/tasks`, `tests/integration/modules/tasks`) và theo API contract (`tests/api/v1`). Module ownership tests kiểm tra cả việc cập nhật recurrence không làm sai calendar/analytics.


| Lớp test | Mục tiêu | Công nghệ |
| --- | --- | --- |
| Unit | Pure domain rules, date/time, metrics | pytest |
| Service | Business logic, repository mocks khi hợp lý | pytest |
| Integration | PostgreSQL transactions, unique/FK, query logic | pytest + test PostgreSQL |
| API | Request validation, auth, HTTP contract | HTTPX / FastAPI testing |
| Migration | Fresh DB upgrade, existing DB migration | Alembic + PostgreSQL |
| Worker | Claim/retry/duplicates/crash recovery | pytest + test DB |
| Security | Authz, CSRF, token expiry/reuse | pytest/API tests |

### 14.2. Mandatory test cases

**Recurrence / Task**
- Task chạy mỗi ngày: sinh đúng occurrence và không trùng khi gọi lại.
- Task lặp thứ Hai/Tư/Sáu: đúng weekday và timezone.
- Task monthly 29/30/31: xử lý cuối tháng theo policy đã chốt.
- Đổi recurrence rule: không xóa hoặc chỉnh bản DONE.
- Hủy một occurrence: series còn nguyên.
- Archive task: lịch sử vẫn truy vấn được.

**Time Tracking / Analytics**
- Start → pause → resume → stop tạo đúng total duration.
- Timer chưa stop khi reload/restart, dữ liệu không mất.
- Manual log không vô tình ghi đè timer log.
- Session overlap không bị tính trùng trong active time.
- Task DONE không tự động tương đương đã có time entry.
- Completion rate không đếm task tương lai theo policy.

**Authentication / Authorization**
- Sai/mất/expired token trả code đúng.
- User A không đọc/sửa task user B.
- Refresh reuse bị phát hiện/revoke theo policy.
- Logout vô hiệu session phù hợp.
- Mutation cookie-auth không bypass CSRF.

**Reminders**
- Hai worker cùng chạy: không claim trùng một job.
- Worker restart giữa chừng: job được recover sau lease.
- Đổi giờ occurrence: job cũ không gửi.
- Retry do provider lỗi tạm thời có giới hạn.
- Subscription hết hiệu lực được đánh dấu/loại bỏ.
- Reminder quá hạn được xử lý theo grace policy.

### 14.3. Coverage policy

Không đánh giá chất lượng chỉ bằng `% code coverage`. Ưu tiên coverage cao với **domain logic, recurrence, authentication, reminders**; mục tiêu số phần trăm (ví dụ 80%) là KPI tùy chọn sau baseline test ổn định.

---

## 15. Logging, Monitoring & Error Handling

### 15.1. Structured logs

- Log mỗi request tối thiểu: `timestamp`, `level`, `service`, `environment`, `request_id`, `route`, `status_code`, `latency_ms`.
- Domain event quan trọng có `entity_id`, `action`, `outcome` với kiểm soát PII.
- Worker logs có `job_id`, `attempt`, `scheduled_for`, `delivery_status`.
- Không log password, JWT, refresh token, raw cookies, full DATABASE_URL.
- Production logs theo JSON; dev có thể dùng console dễ đọc.

### 15.2. Health endpoints

- `/health/live`: process đang sống; không query DB nặng.
- `/health/ready`: app đã sẵn sàng kết nối DB/critical dependencies.
- Các endpoint có kiểm soát traffic, không lộ version/secret/internal topology không cần thiết.

### 15.3. Metrics vận hành

| Metric | Mục tiêu |
| --- | --- |
| HTTP p50/p95 latency | Kiểm soát trải nghiệm API |
| 4xx/5xx rates | Phát hiện lỗi/requests sai |
| Database pool saturation | Tránh cạn connections |
| Worker backlog | Nhìn được reminder tồn đọng |
| Reminder delay | `sent_at - scheduled_for` |
| Notification fail/retry rates | Đánh giá reliability |
| Migration drift | Phát hiện schema không khớp code |

**Alerting:** chỉ thêm khi có monitoring hoạt động, ưu tiên health down hoặc backlog/5xx kéo dài; tránh spam alert cho app cá nhân.

---

## 16. Docker, Local Development & Deployment

### 16.1. Local compose topology

```text
[web :3000]        (chạy riêng hoặc pnpm dev)
      |
[api :8000]        FastAPI + reload (dev only)
      |
[postgres :5432]   PostgreSQL trong Docker local
      |
[worker]          Worker độc lập (chỉ bật khi làm reminder)
```

- Database local luôn dùng Docker volume.
- Chỉ bind DB vào `127.0.0.1` khi cần truy cập từ host.
- Không publish PostgreSQL port ra Internet.
- Cùng backend image cho API và worker nhưng command khác nhau.

### 16.2. Minimal production Dockerfile example

> Ví dụ khởi đầu. Trước khi chạy production cần pin image theo digest, security scan và kiểm tra dependencies Python 3.14 trên nền image thực tế.

```dockerfile
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Pin uv version/digest trong repo khi chuẩn bị production
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Lưu ý build:** Nếu app được đóng gói thành package cần cài project, hãy điều chỉnh `uv sync` để install package đúng quy trình. Không chạy `alembic upgrade head` trong Dockerfile hoặc tự động ở mọi replica startup. Chạy migration như một release step có kiểm soát.

### 16.3. Hosting baseline

| Thành phần | Khuyến nghị MVP | Khi cần ổn định |
| --- | --- | --- |
| Web | Vercel Hobby | Giữ hoặc nâng phù hợp |
| API | Free/low-cost Python service | Always-on container |
| DB | Managed PostgreSQL free tier hoặc self-host | Managed backup/restore |
| Worker | External Cron trigger + DB jobs | Dedicated always-on worker |
| Domain/TLS | HTTPS managed | Custom domain |
| Secrets | Hosting env/secrets | Secret manager nếu cần |

**Không giả định free hosting đảm bảo độ chính xác của notification.** Chi phí và giới hạn nhà cung cấp cần kiểm tra trước khi chốt deployment.

### 16.4. Deploy/release sequence

1. CI: lint → typecheck → unit tests → integration tests → image build.
2. Review migrations và backup plan.
3. Tạo image/tag immutable từ commit đã test.
4. Chạy migrations một lần trên DB mục tiêu.
5. Deploy API.
6. Deploy/enable worker.
7. Smoke test auth, tasks, calendar queries và sample reminder (nếu có).
8. Quan sát health, logs và rollback nếu cần.

---

## 17. API Integration with Next.js & Future iOS

### 17.1. Contract-first development

- Backend xuất OpenAPI ở `/openapi.json` (có thể giới hạn public access ở production nếu cần).
- `packages/api-client` sinh TypeScript types/client từ OpenAPI, không gõ lại types thủ công.
- Tạo một API adapter dùng chung và quản lý authentication/refresh ở client boundary.
- Mọi entity có `id`, trạng thái và timestamps rõ ràng.
- API response date/time consistent để Web/iOS hiển thị đúng timezone.

### 17.2. Frontend mock-first

Frontend được xây dựng trước với mock data, nhưng:

- Mock phải tuân thủ `task → occurrence → time entry`.
- Không gộp `is_done` vào task definition nếu một task có recurrence.
- Khi API ra đời, thay mock adapter bằng HTTP adapter mà **không rewrite business semantics**.
- Không thiết kế FE phụ thuộc trực tiếp các SQL column không public trong API.

### 17.3. Device sync

- Đọc/ghi qua cùng REST API.
- Chống double submit ở UI và hỗ trợ idempotency nếu endpoint dễ retry.
- Client phải có chiến lược stale data/revalidation, xử lý token expiry.
- Offline-first đầy đủ **không thuộc MVP**; có thể thêm sau khi có nhu cầu.
- iOS local reminders: cần đồng bộ và reschedule khi occurrence bị sửa/hủy.

---

## 18. Recommended Implementation Phases

| Phase | Deliverables | Exit criteria |
| --- | --- | --- |
| **0 — Decisions & ERD** | Chốt ERD, recurrence policy, auth flow, time tracking semantics | Chấp nhận schema và invariant tests |
| **1 — Foundation** | uv Python 3.14, FastAPI, config, DB, Alembic, CI, logs, auth | Login + health + migrations pass |
| **2 — Core Domain** | Categories, Projects, Tasks, Recurrence, Occurrences | Rules và CRUD API có tests |
| **3 — Time & Calendar** | Calendar range API, Time Entries, timer lifecycle | No data loss, timezone tests pass |
| **4 — Reminders** | Reminder jobs, worker, Web Push, retry/dedup | Không gửi trùng, có delayed-policy |
| **5 — Analytics** | Metrics, heatmap, trends, planned/actual | Công thức & tests có expected values |
| **6 — Optional Domain** | Habits, Goals, Export | Chỉ mở rộng khi use case đã rõ |
| **7 — Production Hardening** | Backup, security review, monitoring, release pipeline | Restore drill và vận hành ổn định |
| **8 — iOS Integration** | Mobile client auth, sync, local notification | Test trên iPhone iOS 18.x |

Thứ tự có thể song song ở mức giao diện mock-first và schema review, nhưng **không đánh đổi correctness để làm demo nhanh**.

---

## 19. Definition of Done — Acceptance Checklist

### 19.1. Infrastructure & foundations

- [ ] Project pin `Python 3.14.x`, có `.python-version` và `uv.lock`.
- [ ] Docker build và local startup chạy được.
- [ ] SQLAlchemy + Psycopg connect PostgreSQL thành công.
- [ ] Alembic migration được review và chạy trên database trống.
- [ ] Config fail-fast khi thiếu production secrets.
- [ ] CI chạy Ruff, Pyright, tests.
- [ ] Health live/ready hoạt động.

### 19.2. Data correctness

- [ ] Task definition khác occurrence, status ở occurrence.
- [ ] Recurrence generation idempotent, có unique constraints.
- [ ] Archive/sửa rule không mất lịch sử DONE.
- [ ] `scheduled_date` và timestamp xử lý timezone đúng.
- [ ] Timer và manual entries không cộng sai thời lượng.
- [ ] PATCH xử lý missing field vs explicit null chuẩn.
- [ ] Authorization kiểm soát ownership.

### 19.3. Reliability & security

- [ ] Secrets không nằm trong repo hoặc image.
- [ ] Password hash bằng Argon2id nếu có local password.
- [ ] Auth token có expiry, refresh rotation/revocation.
- [ ] CSRF/CORS được kiểm thử trong môi trường web thực tế.
- [ ] Reminder worker có retry/dedup, restart recovery.
- [ ] Backup tồn tại và đã thử restore ít nhất một lần.
- [ ] Logs không lộ token/password/raw secrets.
- [ ] OpenAPI docs và typed client thống nhất.

---

## 20. Open Decisions — cần chốt trước khi triển khai từng module

| Decision ID | Vấn đề | Lựa chọn đề xuất | Khi cần chốt |
| --- | --- | --- | --- |
| BE-001 | Async vs sync DB | **Async SQLAlchemy + Psycopg 3** | Foundation |
| BE-002 | SQLAlchemy version | Stable 2.1.x nếu test pass, 2.0.x nếu có ràng buộc | Foundation |
| BE-003 | PostgreSQL server version | PostgreSQL 17 hoặc bản hỗ trợ ổn định của hosting | Database |
| BE-004 | Login mechanism | Email/password, có refresh rotation | Auth |
| BE-005 | Web session transport | HttpOnly cookies + CSRF plan | Auth |
| BE-006 | Recurrence generation | On-demand vs 30/90-day rolling window | Recurrence |
| BE-007 | Timer data model | Pause/resume events vs segments | Time Tracking |
| BE-008 | Habit modeling | Dùng Task Occurrence hay Habit riêng | Habits |
| BE-009 | Reminder late policy | Bỏ qua, gửi muộn trong grace window | Reminders |
| BE-010 | Reminder channel | Web Push trước, iOS local sau | Notifications |
| BE-011 | Database hosting | Managed free tier vs self-host Ubuntu | Deploy |
| BE-012 | Export/backup format | JSON + CSV + PostgreSQL backup | Production |
| BE-013 | Public API contract casing | snake_case vs camelCase, chọn thống nhất | API setup |
| BE-014 | Goal schema | MVP hay phase sau | Goals |
| **BE-015** | **Backend package organization** | **Hybrid: `modules/<domain>/api,services,repositories,models,schemas,mappers` — ĐÃ CHỌN** | Đã chốt |
| **BE-016** | **Recurrence/Occurrence module ownership** | **Nằm trong `tasks` — kiến trúc đã chọn, review domain-specific edge cases khi làm ERD** | Đã chốt kiến trúc |
| **BE-017** | **Inter-module queries** | Public query services; analytics read-only reporting repository cần review | Foundation |

**Decision record:** lưu quyết định được duyệt ở `docs/decisions/ADR-xxx-*.md` với *context, options, decision, consequences*. Không để logic trọng yếu phụ thuộc vào câu trả lời chat thất lạc.

---

## 21. Example Commands / Developer Workflow

```bash
# Trong services/api

# Cập nhật dependencies theo lock
uv sync --frozen

# Chạy API (dev only)
uv run uvicorn app.main:app --reload --port 8000

# Lint & format
uv run ruff check .
uv run ruff format .

# Type-check
uv run pyright app

# Tests
uv run pytest
uv run pytest --cov=app --cov-report=term-missing

# Database migration (sau khi tạo Alembic config)
uv run alembic revision --autogenerate -m "create core tables"
# Review file migration trước khi chạy
uv run alembic upgrade head
uv run alembic current
uv run alembic history

# Export OpenAPI sau khi app được tạo và import được
uv run python -c 'import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))' > openapi.json
```

**Các command là convention mục tiêu.** Thư mục và import paths phải trùng mã nguồn thực tế; không chạy autogenerate trên production DB.

---

## 22. Compact Prompt for AI Coding Assistant

> **Use this Backend Specification v2.0 as the mandatory engineering contract for the Personal Productivity App.** Use **HYBRID architecture**: one modular monolith with feature-first packages `app/modules/<domain>/` and explicit internal layers (`api/`, `services/`, `repositories/`, `models/`, `schemas/`, `mappers/`, `domain/` only when needed). Do not use top-level global business service/repository folders. Keep Task, RecurrenceRule, and TaskOccurrence ownership inside the `tasks` module; Calendar is a query projection and Analytics is read-only for core data. Enforce Controller → Service → Repository → DB, with response mapping at the API boundary. Service owns transaction; Repository never commits by default; Mapper never performs I/O or security decisions. Inter-module mutation uses public application services, never another module’s private Repository. Build FastAPI with CPython **3.14.x**, Pydantic v2, SQLAlchemy 2.x (`sqlalchemy[asyncio]`), Psycopg 3, Alembic, PostgreSQL, uv, Ruff, Pyright and pytest. Keep the API independent from Next.js and future React Native. Preserve Task / TaskOccurrence / TimeEntry separation, timezone correctness, idempotent recurrence, and full history. Use explicit database transactions, ownership checks, consistent OpenAPI contracts, strict environment validation and automated tests. Reminders must be persisted and processed by a separate worker with retry/deduplication; never rely on in-memory API scheduling for durable notifications. Do not introduce Redis, Celery, microservices or new database tables without a justified need and approved design. For undecided product rules, document the decision and implement only what has been explicitly approved. Every schema change requires a reviewed Alembic migration and tests. Respect the existing frontend UX principles: minimal, soft blue/pastel, fast, API contract first.

---

## 23. References & Verification Notes

**Checked:** 17/11/2026. Links below are documentation sources, **not** a claim that every package combination has been installed or integration-tested in this project.

1. [FastAPI Python-version support — source metadata](https://github.com/fastapi/fastapi/blob/master/pyproject.toml) — Python 3.14 classifier.
2. [Pydantic project metadata](https://github.com/pydantic/pydantic/blob/main/pyproject.toml) — Python 3.14 support.
3. [SQLAlchemy releases](https://www.sqlalchemy.org/download.html) — current/maintenance branches.
4. [Psycopg 3 official documentation](https://www.psycopg.org/) — async support và Python 3.14.
5. [uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/) — Python pin, 3.14 vs free-threaded variant.
6. [uv project/environment documentation](https://docs.astral.sh/uv/) — dependency locks và sync.
7. [SQLAlchemy 2.1.0 release](https://www.sqlalchemy.org/blog/2026/09/24/sqlalchemy-2.1.0-released/) — `sqlalchemy[asyncio]` installs optional `greenlet` for asyncio features.
8. [FastAPI password hashing](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — pwdlib + Argon2.
9. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — password hashing.
10. [Alembic autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) — review generated migrations.
11. [Alembic asyncio cookbook](https://alembic.sqlalchemy.org/en/latest/cookbook.html#using-asyncio-with-alembic) — async migrations.
12. [FastAPI Async Testing](https://fastapi.tiangolo.com/advanced/async-tests/) — HTTPX async tests.
13. [python-dateutil `rrule`](https://dateutil.readthedocs.io/en/stable/rrule.html) — RFC recurrence details, invalid dates/times.
14. [PostgreSQL documentation](https://www.postgresql.org/docs/) — constraints, indexes, locking, transactions.
15. [Python 3.14 docs](https://docs.python.org/3.14/) — standard library, `zoneinfo`, typing.

### Notes on external facts vs project decisions

- **Đã xác minh từ nguồn:** các project FastAPI, Pydantic, SQLAlchemy và Psycopg hỗ trợ Python 3.14 trong các phiên bản hiện hành; uv có cơ chế pin Python; Alembic cần review migration; `dateutil.rrule` có quy tắc với invalid dates/times.
- **Đã chọn theo cuộc trao đổi:** **Hybrid feature-first/layered-inside**, FastAPI/Python 3.14 và module ownership nền tảng; đây là **quyết định thiết kế**, chưa phải code đã triển khai. Auth rotation, reminder jobs trong PostgreSQL và cron/worker là kiến trúc khuyến nghị, cần duyệt chi tiết use case.
- **Chưa xác minh end-to-end:** full dependency lock Python 3.14 trên máy Ubuntu của người dùng, Docker image cụ thể, compatibility của mọi optional package, APNs notification khi app iOS ký bằng SideStore, năng lực free hosting theo workload thực.

---

## 24. Final Architecture Recommendation — Đã chốt Hybrid

**Technology Stack:** `CPython 3.14.x` + `FastAPI` + `Pydantic v2` + `SQLAlchemy 2.x [asyncio]` + `Psycopg 3` + `PostgreSQL` + `Alembic` + `uv` + `Ruff` + `Pyright` + `pytest` + `Docker`.

**Architecture:** **Hybrid (Feature-First + Layered-Inside) Modular Monolith**. HTTP API phục vụ Next.js trước, React Native iOS sau; PostgreSQL là nguồn dữ liệu; reminder worker độc lập với web process.

```text
services/api/app/
├── modules/
│   ├── tasks/{api,services,repositories,models,schemas,mappers,domain}/
│   ├── time_tracking/{api,services,repositories,models,schemas,mappers}/
│   ├── reminders/{api,services,repositories,models,schemas,mappers}/
│   ├── calendar/{api,services,schemas}/
│   └── ...
├── api/     # API v1 aggregator, shared HTTP dependencies
├── core/    # Config, security utilities, logging
├── db/      # SQLAlchemy engine/session/ORM discovery
└── shared/  # Clock, pagination, shared primitives
```

**Luồng giao tiếp:** `API Controller → Application Service → Repository → PostgreSQL → Application Service → Mapper (nếu cần) → Response DTO → JSON`.

**Thứ tự triển khai:** Review ERD và rules → tạo skeleton Hybrid Python 3.14 → API/OpenAPI, DB, auth → Tasks/Recurrence/Occurrences → Calendar/Time Tracking → Reminders → Analytics → iOS.

**Definition of quality:** **Correctness > Data Integrity > Security > Reliability > Maintainability > Measured Performance**. Không phá ranh giới module để làm nhanh một endpoint.

---

## 25. Migration Checklist — từ Spec v1.0 sang Hybrid v2.0

Nếu đã tạo source theo layout feature-flat hoặc layer-first, chuyển có kiểm soát:

1. [ ] Tạo `app/modules/<domain>/`, chưa xóa code cũ trước khi test.
2. [ ] Di chuyển từng `router.py` → `<domain>/api/<domain>_router.py`, cập nhật router aggregator.
3. [ ] Di chuyển `service.py` → `services/`, `repository.py` → `repositories/`, `models.py` → `models/`, `schemas.py` → `schemas/requests|responses/`.
4. [ ] Chỉ tạo `mappers/` khi mapping thực sự không tầm thường; ghi chú vì sao cần Mapper.
5. [ ] Chuyển logic `recurrence` và `occurrences` vào **`modules/tasks/`**, giữ nguyên DB table names/PK/FK và API paths khi có thể.
6. [ ] Tách `calendar` thành read/query module; dời mọi direct update occurrence về Task/OccurrenceService.
7. [ ] Rà soát `auth`, `time_tracking`, `reminders`, `analytics` theo ownership matrix.
8. [ ] Cập nhật imports, DI providers, Alembic model discovery và migration autogenerate dry-run.
9. [ ] Không tạo migration đổi tên table chỉ vì đổi đường dẫn Python module.
10. [ ] Chạy unit/integration/API tests; giữ OpenAPI contract tương thích với frontend.
11. [ ] Xóa global duplicated services/repositories/models sau khi test pass; không để hai implementations cạnh tranh nhau.
12. [ ] Cập nhật ADR/README và báo cáo các breaking changes nếu có.

**Nếu chưa code BE:** Dựng trực tiếp Hybrid v2.0, không cần migration mã nguồn.

## 26. AI Coding Assistant — Pull Request Review Template

```markdown
### Scope
- Business module(s):
- Public API changes:
- DB schema / Alembic migration changes:

### Architecture compliance
- [ ] Files are under app/modules/<domain>/{api,services,repositories,models,schemas,mappers} as needed
- [ ] API only handles HTTP + DI; Service implements use cases
- [ ] Repository owns persistence, no default commit
- [ ] No private cross-module repository/model mutations
- [ ] No circular imports; no duplicate recurrence ownership
- [ ] Domain rules independent of FastAPI and database where possible

### Correctness
- [ ] Ownership checks and timezone rules tested
- [ ] Task / occurrence / time entry history preserved
- [ ] PATCH missing vs null semantics verified
- [ ] Idempotent recurrence / reminders verified if affected

### Quality
- [ ] Ruff / Pyright / pytest pass
- [ ] Integration tests against PostgreSQL pass if persistence changed
- [ ] OpenAPI contract reviewed
- [ ] No credentials or tokens in logs/code
- [ ] Risks and rollout/rollback documented
```

**End of Backend Technical Specification — Hybrid v2.0.**
