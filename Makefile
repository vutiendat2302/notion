SHELL := /bin/bash
.DEFAULT_GOAL := help

APP_ENV_FILE := .env
COMPOSE := docker compose --env-file $(APP_ENV_FILE) -f infra/compose.yaml
COMPOSE_DEV := $(COMPOSE) -f infra/compose.dev.yaml

# Cong Dev tach biet hoan toan voi vsico_zalo_bot (8000/8001/3000/3001/8866)
# va khong dung ban Production notion-productivity-isolated (18000/3100).
DEV_PROJECT ?= personal-productivity-dev
DEV_BACKEND_PORT ?= 8010
DEV_FRONTEND_PORT ?= 3010
DEV_API_BASE_URL := http://localhost:$(DEV_BACKEND_PORT)/api/v1
DEV_CORS_ORIGINS := http://localhost:$(DEV_FRONTEND_PORT),http://127.0.0.1:$(DEV_FRONTEND_PORT)

COMPOSE_DEV_ISOLATED := COMPOSE_PROJECT_NAME=$(DEV_PROJECT) \
	BACKEND_PORT=$(DEV_BACKEND_PORT) \
	FRONTEND_PORT=$(DEV_FRONTEND_PORT) \
	NEXT_PUBLIC_API_BASE_URL=/api/v1 \
	INTERNAL_API_BASE_URL=http://backend:8000/api/v1 \
	CORS_ALLOWED_ORIGINS=$(DEV_CORS_ORIGINS) \
	docker compose -p $(DEV_PROJECT) --env-file $(APP_ENV_FILE) -f infra/compose.yaml -f infra/compose.dev.yaml

.PHONY: help env config \
	be-local be-dev be-worker be-lint be-typecheck be-test \
	fe-local fe-dev fe-lint fe-typecheck fe-test \
	db-up db-provision db-check db-shell db-backup migrate ai-db-migrate migration \
	dev-isolated dev-logs dev-ps dev-down \
	prod-on prod-off prod-status prod-logs \
	up dev up-storage up-qdrant up-ollama up-infra up-ai up-all down stop ps logs \
	check

help:
	@echo "=========================================================================="
	@echo " LỆNH KHẢ DỤNG — PERSONAL PRODUCTIVITY (NOTION)"
	@echo " (Tách biệt cổng khỏi vsico_zalo_bot & bản Prod 18000/3100)"
	@echo "=========================================================================="
	@echo "  1. Backend & Kiểm thử (Dev Port $(DEV_BACKEND_PORT)):"
	@echo "     make be-local        : Chạy BE trực tiếp trên terminal (hot-reload, Port $(DEV_BACKEND_PORT))"
	@echo "     make be-dev          : Tự động chạy BE + Worker Docker hot-reload (Port $(DEV_BACKEND_PORT))"
	@echo "     make be-worker       : Khởi chạy riêng Recurrence Worker (Docker Dev)"
	@echo "     make be-lint         : Kiểm tra lint & format Backend (ruff)"
	@echo "     make be-typecheck    : Kiểm tra kiểu dữ liệu Backend (pyright)"
	@echo "     make be-test         : Chạy test suite Backend (pytest)"
	@echo ""
	@echo "  2. Frontend & Kiểm thử (Dev Port $(DEV_FRONTEND_PORT)):"
	@echo "     make fe-local        : Chạy FE trực tiếp trên terminal (hot-reload, Port $(DEV_FRONTEND_PORT))"
	@echo "     make fe-dev          : Chạy Frontend Next.js Docker hot-reload (Port $(DEV_FRONTEND_PORT))"
	@echo "     make fe-lint         : Kiểm tra ESLint Frontend"
	@echo "     make fe-typecheck    : Kiểm tra TypeScript Frontend"
	@echo "     make fe-test         : Chạy unit/component tests Frontend (vitest)"
	@echo "     make check           : Chạy toàn bộ Quality Gates (BE + FE)"
	@echo ""
	@echo "  3. Cơ sở dữ liệu MySQL 8.4 (127.0.0.1:3306) & Alembic:"
	@echo "     make db-up           : Kiểm tra container MySQL (vsico-zalo-mysql)"
	@echo "     make db-provision    : Tạo 2 DB & 4 tài khoản riêng cho Notion"
	@echo "     make db-check        : Kiểm tra version, utf8mb4, collation & timezone"
	@echo "     make db-shell        : Mở MySQL Interactive Shell (notion_productivity_db)"
	@echo "     make db-backup       : Sao lưu logical dump ra thư mục backups/"
	@echo "     make migrate         : Chạy Alembic upgrade head (notion_productivity_db)"
	@echo "     make ai-db-migrate   : Chạy Alembic upgrade head (notion_ai_metadata_db)"
	@echo "     make migration MSG=..: Tạo Alembic revision mới"
	@echo ""
	@echo "  4. Cụm Dev tách biệt & Hạ tầng mở rộng (MinIO 9010, Qdrant 6343, Ollama 11444):"
	@echo "     make dev-isolated    : Bật cả cụm Dev (BE :$(DEV_BACKEND_PORT) + Worker + FE :$(DEV_FRONTEND_PORT))"
	@echo "     make dev-ps          : Xem trạng thái các container cụm Dev"
	@echo "     make dev-logs SVC=.. : Xem logs cụm Dev (ví dụ: make dev-logs SVC=backend)"
	@echo "     make dev-down        : Dừng & gỡ cụm Dev (không ảnh hưởng Prod hay Zalo Bot)"
	@echo "     make up-storage      : Chỉ bật MinIO (API :9010, Console :9011)"
	@echo "     make up-qdrant       : Chỉ bật Qdrant (HTTP :6343, gRPC :6344)"
	@echo "     make up-ollama       : Chỉ bật Ollama (Port :11444)"
	@echo "     make up-infra        : Chỉ bật hạ tầng MinIO + Qdrant + Ollama (không bật BE/FE)"
	@echo "     make up-ai           : Bật đầy đủ cụm Dev + MinIO + Qdrant + Ollama + OCR + AI"
	@echo "     make prod-on         : Bật cụm Production + Cloudflare Tunnel (lumi-on)"
	@echo "     make prod-off        : Tắt cụm Production + Cloudflare Tunnel (lumi-off, giữ volume)"
	@echo "     make prod-status     : Kiểm tra trạng thái Production & domain (lumi-status)"
	@echo "     make env / config    : Tạo .env từ mẫu / kiểm tra cú pháp Docker Compose"
	@echo "=========================================================================="

# --- Environment & Validation ---
env:
	@if [ ! -f $(APP_ENV_FILE) ]; then \
		cp .env.example $(APP_ENV_FILE); \
		echo "Created $(APP_ENV_FILE); configure secrets before use"; \
	else \
		echo "$(APP_ENV_FILE) already exists"; \
	fi

config: env
	$(COMPOSE) config --quiet
	$(COMPOSE_DEV) --profile full config --quiet
	@echo "Docker Compose configurations are valid."

# --- 1. Backend (Dev Isolated Port 8010) & Quality Gates ---
be-local: env
	@docker stop $(DEV_PROJECT)-backend-1 $(DEV_PROJECT)-backend-recurrence-worker-1 >/dev/null 2>&1 || true
	@if [ ! -x backend/.venv-local/bin/uvicorn ]; then \
		echo "Missing backend/.venv-local. Run: python3 -m venv backend/.venv-local && backend/.venv-local/bin/pip install uv && cd backend && UV_PROJECT_ENVIRONMENT=.venv-local .venv-local/bin/uv sync --frozen --no-install-project"; \
		exit 1; \
	fi
	cd backend && set -a && source ../$(APP_ENV_FILE) && set +a && \
		DATABASE_URL="$${DATABASE_URL//@vsico-zalo-mysql:3306/@127.0.0.1:3306}" \
		MINIO_ENDPOINT="127.0.0.1:$${MINIO_API_PORT:-9010}" \
		AI_SERVICE_BASE_URL="http://127.0.0.1:$${AI_SERVICE_PORT:-8001}" \
		CORS_ALLOWED_ORIGINS="$(DEV_CORS_ORIGINS)" \
		.venv-local/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port $(DEV_BACKEND_PORT)

be-dev: env
	$(COMPOSE_DEV_ISOLATED) up -d --build backend backend-recurrence-worker

be-worker: env
	$(COMPOSE_DEV_ISOLATED) up -d --build backend-recurrence-worker

be-lint:
	cd backend && uv run ruff check . && uv run ruff format --check .

be-typecheck:
	cd backend && uv run pyright app

be-test:
	cd backend && uv run pytest

# --- 2. Frontend (Dev Isolated Port 3010) & Quality Gates ---
fe-local: env
	@docker stop $(DEV_PROJECT)-frontend-1 >/dev/null 2>&1 || true
	cd frontend && NEXT_PUBLIC_API_BASE_URL="/api/v1" INTERNAL_API_BASE_URL="http://127.0.0.1:$(DEV_BACKEND_PORT)/api/v1" npm run dev -- --port $(DEV_FRONTEND_PORT)

fe-dev: env
	$(COMPOSE_DEV_ISOLATED) up -d --build frontend

fe-lint:
	cd frontend && pnpm lint

fe-typecheck:
	cd frontend && pnpm typecheck

fe-test:
	cd frontend && pnpm test

check: be-lint be-typecheck be-test fe-lint fe-typecheck fe-test

# --- 3. Database (MySQL 8.4 Shared Instance, Isolated DBs) & Alembic ---
db-up: env
	docker inspect $$(sed -n 's/^EXTERNAL_MYSQL_CONTAINER=//p' $(APP_ENV_FILE)) --format '{{.State.Status}}'

db-provision: env
	python3 infra/mysql/provision_shared.py

db-shell:
	docker run --rm -it --env-file $(APP_ENV_FILE) --network $$(sed -n 's/^MYSQL_DOCKER_NETWORK=//p' $(APP_ENV_FILE)) mysql:8.4 sh -c 'mysql -h"$$MYSQL_HOST" -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" "$$MYSQL_DATABASE"'

db-check:
	docker run --rm --env-file $(APP_ENV_FILE) --network $$(sed -n 's/^MYSQL_DOCKER_NETWORK=//p' $(APP_ENV_FILE)) mysql:8.4 sh -c 'mysql -h"$$MYSQL_HOST" -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" -e "SELECT VERSION() AS version, DATABASE() AS db, @@time_zone AS tz, @@character_set_server AS charset, @@collation_server AS collation;" "$$MYSQL_DATABASE"'

db-backup:
	@mkdir -p backups
	@umask 077 && docker run --rm --env-file $(APP_ENV_FILE) --network $$(sed -n 's/^MYSQL_DOCKER_NETWORK=//p' $(APP_ENV_FILE)) mysql:8.4 sh -c \
		'exec mysqldump -h"$$MYSQL_HOST" -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF "$$MYSQL_DATABASE"' \
		> "backups/$$(sed -n 's/^MYSQL_DATABASE=//p' $(APP_ENV_FILE))_$$(date +%F_%H%M%S).sql"
	@echo "Backup created under backups/"

migrate:
	$(COMPOSE) --profile migration run --rm backend-migrate

ai-db-migrate:
	$(COMPOSE) --profile migration run --rm --build ai-db-migrate

migration:
	@if [ -z "$(MSG)" ]; then echo "Usage: make migration MSG=\"describe_change\""; exit 1; fi
	cd backend && uv run alembic revision --autogenerate -m "$(MSG)"

# --- 4. Isolated Dev Stack & Base Lifecycle ---
dev-isolated: env
	$(COMPOSE_DEV_ISOLATED) up -d --build backend backend-recurrence-worker frontend

dev-ps:
	$(COMPOSE_DEV_ISOLATED) ps

dev-logs:
	$(COMPOSE_DEV_ISOLATED) logs -f --tail=100 $(SVC)

dev-down:
	$(COMPOSE_DEV_ISOLATED) --profile full down

# --- 5. Production Stack + Cloudflare Tunnel (https://lumiplan.vtdat.com) ---
prod-on: env
	./infra/scripts/lumiplan-ctl.sh on

prod-off: env
	./infra/scripts/lumiplan-ctl.sh off

prod-status: env
	./infra/scripts/lumiplan-ctl.sh status

prod-logs: env
	./infra/scripts/lumiplan-ctl.sh logs $(SVC)

up: env
	$(COMPOSE) up -d --build

dev: env
	$(COMPOSE_DEV) up -d --build

up-storage: env
	$(COMPOSE_DEV_ISOLATED) --profile storage up -d --build minio

up-qdrant: env
	$(COMPOSE_DEV_ISOLATED) --profile ai up -d qdrant

up-ollama: env
	$(COMPOSE_DEV_ISOLATED) --profile ai up -d ollama

up-infra: env
	$(COMPOSE_DEV_ISOLATED) --profile full up -d minio qdrant ollama

up-ai: env
	$(COMPOSE_DEV_ISOLATED) --profile ai up -d --build

up-all: env
	$(COMPOSE_DEV_ISOLATED) --profile full up -d --build

down:
	$(COMPOSE_DEV) --profile full down

stop:
	$(COMPOSE_DEV) --profile full stop

ps:
	$(COMPOSE_DEV) --profile full ps

logs:
	$(COMPOSE_DEV) --profile full logs -f --tail=100 $(SVC)
