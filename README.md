# Personal Productivity & Time Management App

Hệ thống quản lý kế hoạch và năng suất cá nhân self-hosted trên Ubuntu: **Year → Quarter → Month → Week → Day**, Goals, Projects, Tasks, Occurrences, Recurrence, Time Tracking, Reminders, Analytics, Files/OCR và AI Assistant.

---

## 1. Kiến trúc tổng thể

```text
Web Next.js 16 (:3000) / iOS React Native (sau này)
                │ HTTPS / REST (/api/v1)
                ▼
     Backend FastAPI :8000 (Python 3.14, Hybrid Architecture)
         ├──► MySQL 8.4 LTS :3306 (`productivity_db`)
         ├──► MinIO :9000 (Object storage)
         │
         │ Private Authenticated HTTP (/internal/v1)
         ▼
     AI Service FastAPI :8001 (Python 3.14, Hybrid, Pydantic AI)
         ├──► Ollama :11434 (Local LLM & Embeddings)
         ├──► Qdrant :6333 (Vector Index)
         ├──► MySQL 8.4 :3306 (`ai_metadata_db`)
         ├──► OCR Service :8866 (Python 3.12, PaddleOCR 3.x / PyMuPDF)
         └──► Backend Internal Tool APIs (`/internal/v1/ai-tools/*`)
```

### Quy chuẩn & Tài liệu cốt lõi
- **Quy chuẩn AI Coding & Kiến trúc:** [AGENTS.md](file:///home/datbritget/Documents/notion/AGENTS.md)
- **Kế hoạch triển khai tổng thể & từng giai đoạn (BE, FE, DB, AI, OCR):** [docs/IMPLEMENTATION_PLAN.md](file:///home/datbritget/Documents/notion/docs/IMPLEMENTATION_PLAN.md)
- **Thiết kế Database chi tiết từng giai đoạn (MySQL 8.4 — 41 bảng qua 4 giai đoạn):** [docs/database/DATABASE_DESIGN_BY_PHASE.md](file:///home/datbritget/Documents/notion/docs/database/DATABASE_DESIGN_BY_PHASE.md)
- **Đặc tả nghiệp vụ:** [docs/personal_productivity_functional_spec_v2_notion.md](file:///home/datbritget/Documents/notion/docs/personal_productivity_functional_spec_v2_notion.md)
- **Đặc tả Frontend (Intelligent Minimalism × Soft Blue):** [docs/personal_productivity_frontend_spec_notion.md](file:///home/datbritget/Documents/notion/docs/personal_productivity_frontend_spec_notion.md)
- **Kế hoạch Database v2 (MySQL 8.4):** [docs/personal_productivity_database_v2_implementation_plan.md](file:///home/datbritget/Documents/notion/docs/personal_productivity_database_v2_implementation_plan.md)
- **Đặc tả AI & Hạ tầng Self-host:** [docs/v2.md](file:///home/datbritget/Documents/notion/docs/v2.md)

---

## 2. Cấu trúc thư mục phẳng

```text
notion/
├── frontend/                   # Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (Base UI)
├── backend/                    # FastAPI Python 3.14 (Hybrid Modular Monolith)
├── ai-service/                 # FastAPI Python 3.14 + Pydantic AI (Independent service)
├── ocr-service/                # FastAPI Python 3.12 + PaddleOCR 3.x (Independent service)
├── contracts/                  # OpenAPI specs & JSON schemas dùng chung
├── infra/                      # Docker Compose, MySQL config/init, scripts, secrets
├── docs/                       # Đặc tả và kế hoạch triển khai
├── .env.example                # Biến môi trường mẫu toàn dự án
├── Makefile                    # Điều phối Docker, DB, Migrations, Lint & Tests
└── README.md
```

---

## 3. Khởi chạy & Vận hành qua Docker + Makefile

Bản triển khai web trên máy chủ dùng Compose project và Cloudflare tunnel riêng; xem [hướng dẫn self-host](docs/deployment/SELF_HOSTED_WEB.md). Các lệnh Makefile bên dưới phục vụ môi trường phát triển và không tự bật tunnel công khai.

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
| `make db-up` | Kiểm tra container **MySQL 8.4** đang có (DataGrip: `127.0.0.1:3306`) |
| `make migrate` | Áp dụng Alembic qua tài khoản migration riêng vào `productivity_db` |
| `make db-check` | Kiểm tra version, `utf8mb4`, collation và timezone `+00:00` |
| `make db-shell` | Mở MySQL CLI bằng tài khoản ứng dụng |
| `make db-backup` | Xuất logical dump ra `backups/` (`--single-transaction`) |
| `make dev` | Khởi chạy Core Stack (`mysql` + `backend` + `frontend`) ở chế độ hot-reload |
| `make up` | Khởi chạy Core Stack ở chế độ production runtime |
| `make up-storage` | Bật thêm MinIO (`--profile storage`) |
| `make up-ai` | Bật thêm MinIO + Qdrant + Ollama + OCR + AI Service (`--profile ai`) |
| `make up-all` | Khởi chạy toàn bộ services (`--profile full`) |
| `make down` | Dừng và gỡ containers (giữ nguyên volumes dữ liệu) |
| `make logs SVC=backend` | Xem logs của container chỉ định |
| `make migrate` | Chạy `alembic upgrade head` cho Backend |
| `make check` | Chạy toàn bộ `ruff`, `pyright`, `pytest` (BE) và `lint`, `typecheck`, `test` (FE) |
