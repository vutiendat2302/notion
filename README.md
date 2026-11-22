# LumiPlan — Personal Productivity & Time Management App

Hệ thống quản lý kế hoạch và năng suất cá nhân self-hosted trên Ubuntu: **Year → Quarter → Month → Week → Day**, multi-page **Notion Paper Canvas**, Linked Databases (**Plan → Project → Task**), Goals, Habits, Focus Timer, 19 Analytics Charts, MinIO Storage, OCR và Multi-Agent AI Assistant.

---

## 1. Kiến trúc tổng thể

```text
Web Next.js 16 (:3000 / :3010) / iOS React Native (giai đoạn sau)
                │ HTTPS / REST (/api/v1)
                ▼
     Backend FastAPI :8000 / :8010 (Python 3.14, Hybrid Architecture)
         ├──► MySQL 8.4 LTS :3306 (`notion_productivity_db`, 37 bảng)
         ├──► MinIO :9010 (Object storage: avatars, custom sounds, attachments)
         │
         │ Private Authenticated HTTP (/internal/v1, HS256 S2S JWT)
         ▼
     AI Service FastAPI :8001 (Python 3.14, Hybrid, Pydantic AI)
         ├──► Ollama :11444 (Local LLM `qwen3:8b` & Embeddings `bge-m3`)
         ├──► Cloud Providers (tùy chọn per-user / server key):
         │      Claude (`claude-sonnet-4-6`), Codex (`gpt-5.4`), Gemini (`gemini-3-flash-preview`)
         ├──► Qdrant :6343 (Vector Index — scoped theo `owner_user_id`)
         ├──► MySQL 8.4 :3306 (`notion_ai_metadata_db`, 5 bảng)
         ├──► OCR Service :8866 (Python 3.12, PaddleOCR 3.x / PyMuPDF)
         └──► Backend Internal Tool APIs (`/internal/v1/ai-tools/*`)
```

### Quy chuẩn & Tài liệu cốt lõi
- **Quy chuẩn AI Coding & Kiến trúc:** [AGENTS.md](AGENTS.md)
- **Hướng dẫn Dev & DataGrip tách cổng (`8010` / `3010`):** [docs/LOCAL_DEV_GUIDE.md](docs/LOCAL_DEV_GUIDE.md)
- **Hướng dẫn Self-Host Web (Docker + Cloudflare Tunnel):** [docs/deployment/SELF_HOSTED_WEB.md](docs/deployment/SELF_HOSTED_WEB.md)
- **API Contracts dùng chung (Public / S2S / OCR / Tools):** [contracts/](contracts/)
- **Bộ tài liệu kiểm thử Postman (không dùng CLI HTTP):** [docs/postman/](docs/postman/)
- **Kế hoạch triển khai tổng thể (BE, FE, DB, AI, OCR):** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- **Thiết kế Database chi tiết từng giai đoạn (MySQL 8.4):** [docs/database/DATABASE_DESIGN_BY_PHASE.md](docs/database/DATABASE_DESIGN_BY_PHASE.md)
- **Runbook MySQL ban đầu & Backup/Restore:** [docs/database/INITIAL_DATABASE_RUNBOOK.md](docs/database/INITIAL_DATABASE_RUNBOOK.md)
- **Đặc tả nghiệp vụ & Giao diện:** [docs/personal_productivity_functional_spec_v2_notion.md](docs/personal_productivity_functional_spec_v2_notion.md) · [docs/personal_productivity_frontend_spec_notion.md](docs/personal_productivity_frontend_spec_notion.md)
- **Đặc tả AI & Hạ tầng Self-host:** [docs/v2.md](docs/v2.md)

---

## 2. Tính năng đã triển khai

- **Workspace đa trang kiểu Notion (`/pages/[id]` & `/dashboard`):**
  - Sidebar nhóm theo nhiều **Danh mục (`SidebarGroup`)**, hỗ trợ kéo thả sắp xếp danh mục và chuyển trang giữa các danh mục; mặc định luôn có trang **Đếm ngược** (`/time-tracking`).
  - Quick Jump (`Ctrl+K`) tìm kiếm nhanh toàn bộ trang & danh mục đang có.
  - Canvas lưới linh hoạt (`Tự do 12 cột`, `3×3`, `4×4`, `6×N`), **1:1 Pointer Drag** đặt block vào ô bất kỳ (hỗ trợ hàng trống), kéo chuột resize 3 chiều, Outline `# / ## / ###` cố định cạnh phải, tùy biến viền/nền/bo góc, và **Copy / Synced Block 2 chiều** giữa các trang.
- **3 Linked Databases (`PLAN_DB` → `PROJECT_DB` → `TASK_DB`):**
  - `DB Kế hoạch` theo kỳ (`Năm / Quý / Tháng / Tuần / Ngày`), gắn Project & rollout tiến độ Task.
  - `DB Project` quản lý Project, trạng thái, timeline và Task con trực thuộc.
  - `DB Công việc` lọc theo Project / Inbox và gán/đổi Project ngay trên bảng.
- **Admin Block Studio (`/admin/templates`) & Quản trị Users (`/admin/users`):**
  - Danh mục 39+ form/card/module mẫu lưu trong bảng `block_templates` (MySQL).
  - Bấm trực tiếp vào card mẫu để mở **Visual Card Studio**: kéo thả & kéo giãn kích thước từng slot nội bộ trong card 12 cột × N hàng, kiểm soát quyền cho user custom hoặc bật/ẩn mẫu.
- **Focus Timer, MinIO Storage & Analytics:**
  - Đồng hồ đếm ngược server-backed (`RUNNING` / `PAUSED` / `COMPLETED`), chọn âm thanh mặc định hoặc tải nhạc `.mp3`/`.mp4` và avatar lên MinIO (`/api/v1/storage/*`).
  - Theo dõi thói quen (Habits), mục tiêu & cột mốc (Goals), Unified Active Day Streak và **19 biểu đồ phân tích động**.
- **AI Gateway & Multi-Agent Routing (`/settings` & `/api/v1/ai/*`):**
  - Mặc định chạy **AI Local Ollama (`qwen3:8b`)**, hỗ trợ chọn agent **`claude` (`claude-sonnet-4-6`)**, **`codex` (`gpt-5.4`)**, hoặc **`gemini` (`gemini-3-flash-preview`)** với API key cá nhân được mask hoàn toàn (`has_*_key` / `*_key_hint`).
  - Mọi thao tác ghi từ AI đi qua `ActionProposal` + xác nhận người dùng trước khi `TaskService` thực thi transaction.

---

## 3. Cấu trúc thư mục phẳng

```text
notion/
├── frontend/                   # Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (Base UI)
├── backend/                    # FastAPI Python 3.14 (Hybrid Modular Monolith, Alembic 0001..0007)
├── ai-service/                 # FastAPI Python 3.14 + Pydantic AI (Local Ollama & Cloud routing + Qdrant RAG)
├── ocr-service/                # FastAPI Python 3.12 + PaddleOCR 3.x / PyMuPDF
├── contracts/                  # Specs hợp đồng API giữa FE ↔ BE ↔ AI ↔ OCR
├── infra/                      # Docker Compose, MySQL config/init, scripts, secrets
├── docs/                       # Đặc tả, runbook DB, hướng dẫn dev/deploy và Postman guides
├── .env.example                # Biến môi trường mẫu toàn dự án
├── Makefile                    # Điều phối Docker, DB, Migrations, Lint & Tests
└── README.md
```

---

## 4. Khởi chạy & Vận hành qua Docker + Makefile

Bản triển khai web trên máy chủ dùng Compose project `notion-productivity-isolated` và Cloudflare tunnel riêng; xem [hướng dẫn self-host](docs/deployment/SELF_HOSTED_WEB.md). Các lệnh `Makefile` bên dưới phục vụ môi trường phát triển tách cổng (`BE :8010`, `FE :3010`).

### Chuẩn bị biến môi trường

```bash
cp .env.example .env
# Chỉnh sửa mật khẩu / secrets trong .env trước khi khởi chạy.
make config
```

### Các lệnh `Makefile` thường dùng

| Lệnh | Mục đích |
|---|---|
| `make help` | Hiển thị toàn bộ danh sách lệnh hỗ trợ |
| `make config` | Kiểm tra cú pháp Docker Compose (base, dev, profile `full`) |
| `make db-up` | Kiểm tra container **MySQL 8.4** đang có (`127.0.0.1:3306`) |
| `make db-provision` | Khởi tạo 2 schema (`notion_productivity_db`, `notion_ai_metadata_db`) & 4 tài khoản riêng |
| `make migrate` | Áp dụng Alembic (`upgrade head`) vào `notion_productivity_db` |
| `make ai-db-migrate` | Áp dụng Alembic cho `notion_ai_metadata_db` |
| `make db-check` | Kiểm tra version, `utf8mb4`, collation và timezone |
| `make db-shell` | Mở MySQL CLI bằng tài khoản ứng dụng |
| `make db-backup` | Xuất logical dump ra `backups/` (`--single-transaction`) |
| `make dev-isolated` | Bật cụm Dev tách cổng (`BE :8010` + Worker + `FE :3010`) |
| `make be-local` / `make fe-local` | Chạy BE (`:8010`) / FE (`:3010`) trực tiếp trên terminal với hot-reload |
| `make up-storage` | Bật thêm MinIO (`:9010` API / `:9011` Console) |
| `make up-ai` | Bật đầy đủ cụm Dev + MinIO + Qdrant (`:6343`) + Ollama (`:11444`) + OCR + AI Service |
| `make dev-down` / `make down` | Dừng và gỡ containers (giữ nguyên volumes dữ liệu) |
| `make dev-logs SVC=backend` | Xem logs của container dev chỉ định |
| `make prod-on` / `lumi-on` | Bật cụm Production + Cloudflare Tunnel ra domain `https://lumiplan.vtdat.com` |
| `make prod-off` / `lumi-off` | Tắt cụm Production + Cloudflare Tunnel (giữ nguyên toàn bộ volumes) |
| `make prod-status` / `lumi-status` | Kiểm tra trạng thái container Production & phản hồi từ domain |
| `make check` | Chạy toàn bộ `ruff`, `pyright`, `pytest` (BE) và `lint`, `typecheck`, `test` (FE) |
