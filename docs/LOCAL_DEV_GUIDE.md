# Hướng Dẫn Kết Nối DB (DataGrip) & Chạy Project (Không Đụng `vsico_zalo_bot` & Prod)

> **Áp dụng cho:** Repository `notion` (Personal Productivity & Time Management App)

---

## 1. Bảng phân bổ cổng toàn máy (Không trùng nhau)

| Dịch vụ | `vsico_zalo_bot` | `notion` (Prod `notion.vtdat.com`) | `notion` (Dev qua `Makefile`) |
|---|---|---|---|
| **Backend API** | `8000` | `18000` | **`8010`** (`make be-dev`) |
| **Frontend Web** | `3001` *(OA Bridge: `3000`)* | `3100` | **`3010`** (`make fe-dev`) |
| **AI Service** | `8001` | *(chỉ nội bộ Docker)* | *(chỉ nội bộ Docker, không map ra host)* |
| **OCR Service** | `8866` | *(chỉ nội bộ Docker)* | *(chỉ nội bộ Docker, không map ra host)* |
| **MySQL 8.4** | `127.0.0.1:3306` | Dùng chung `vsico-zalo-mysql:3306` (DB riêng) | Dùng chung `vsico-zalo-mysql:3306` (DB riêng) |
| **MinIO** | `9000` / `9001` | — | **`9010`** (API) / **`9011`** (Console) |
| **Qdrant** | `6333` / `6334` | — | **`6343`** (HTTP) / **`6344`** (gRPC) |
| **Ollama** | `11434` | — | **`11444`** |

---

## 2. Kết nối Database (MySQL 8.4) & Xem trên DataGrip

1. Mở DataGrip → **`+`** → **`Data Source`** → **`MySQL`**:
   - **Data Source 1 (DB chính `notion_productivity_db`):**
     - **Name:** `Notion Productivity`
     - **Host:** `127.0.0.1` | **Port:** `3306`
     - **User:** `notion_productivity_app`
     - **Password:** giá trị `MYSQL_PASSWORD` ở dòng 35 trong [`.env`](../.env)
     - **Database:** `notion_productivity_db`
   - **Data Source 2 (DB AI `notion_ai_metadata_db`):**
     - **Name:** `Notion AI Metadata`
     - **Host:** `127.0.0.1` | **Port:** `3306`
     - **User:** `notion_ai_metadata_app`
     - **Password:** giá trị `AI_MYSQL_PASSWORD` ở dòng 42 trong [`.env`](../.env)
     - **Database:** `notion_ai_metadata_db`
2. Kiểm tra nhanh từ terminal:
   ```bash
   make db-up      # kiểm tra container vsico-zalo-mysql đang running
   make db-check   # kiểm tra version, utf8mb4, collation, timezone
   ```

*(Xem dữ liệu Vector DB **Qdrant** trên trình duyệt thay vì DataGrip: `http://127.0.0.1:6333/dashboard` cho Zalo Bot, hoặc `http://127.0.0.1:6343/dashboard` khi bật Qdrant của Notion.)*

---

## 3. Chạy Backend, Frontend & Hạ tầng Dev (Tự động, Không đụng Zalo Bot / Prod)

### Chạy toàn bộ cụm Dev bằng 1 lệnh
```bash
make dev-isolated
```
- **Backend Dev:** `http://127.0.0.1:8010` (Swagger: `http://127.0.0.1:8010/docs`) — tự động `restart: unless-stopped` và hot-reload (`uvicorn --reload`).
- **Frontend Dev:** `http://localhost:3010` — tự động trỏ API sang `http://localhost:8010/api/v1` (đã cấu hình sẵn `CORS_ALLOWED_ORIGINS` cho `3010`).

### Chạy / Theo dõi từng phần
```bash
make be-local            # Chạy BE trực tiếp trên terminal (cổng 8010, hot-reload)
make fe-local            # Chạy FE trực tiếp trên terminal (cổng 3010, hot-reload)
make be-dev              # Hoặc chạy BE + Worker bằng Docker ở cổng 8010
make fe-dev              # Hoặc chạy FE Next.js bằng Docker ở cổng 3010
make dev-ps              # Xem trạng thái cụm dev
make dev-logs SVC=backend # Xem log BE dev
make dev-down            # Tắt cụm dev (giữ nguyên DB, Prod 18000/3100 và Zalo Bot)
```

### Bật Storage / AI (khi cần)
```bash
make up-storage          # Bật MinIO riêng của Notion ở 9010 / 9011
make ai-db-migrate       # Migrate 5 bảng của notion_ai_metadata_db
make up-ai               # Bật MinIO + Qdrant (6343) + Ollama (11444) + OCR + AI
```
*(Lưu ý: `ai-service/` hiện mới có `Dockerfile` + `db/` và `ocr-service/` mới có `Dockerfile`, chưa có source FastAPI Phase 3.)*
