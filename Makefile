SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose --env-file .env -f infra/compose.yaml
COMPOSE_DEV := $(COMPOSE) -f infra/compose.dev.yaml

.PHONY: help env config \
	db-up db-shell db-check db-backup \
	up dev up-storage up-ai up-all down stop ps logs \
	migrate migration \
	be-lint be-typecheck be-test \
	fe-lint fe-typecheck fe-test \
	check

help: ## Hien thi danh sach lenh ho tro
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Tao .env tu .env.example neu chua ton tai
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example (please review secrets before non-local use)"; \
	else \
		echo ".env already exists"; \
	fi

config: env ## Kiem tra cu phap Docker Compose (base + dev + profile full)
	$(COMPOSE) config --quiet
	$(COMPOSE_DEV) --profile full config --quiet
	@echo "Docker Compose configurations are valid."

# --- Database (MySQL 8.4) ---
db-up: env ## Khoi chay MySQL 8.4 container
	$(COMPOSE) up -d mysql

db-shell: ## Mo MySQL shell bang tai khoan app trong container
	$(COMPOSE) exec mysql sh -c 'mysql -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" "$$MYSQL_DATABASE"'

db-check: ## Kiem tra version, charset, collation va timezone cua MySQL
	$(COMPOSE) exec -T mysql sh -c 'mysql -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" -e "SELECT VERSION() AS version, DATABASE() AS db, @@time_zone AS tz, @@character_set_server AS charset, @@collation_server AS collation;" "$$MYSQL_DATABASE"'

db-backup: ## Sao luu logical MySQL dump ra thu muc backups/
	@mkdir -p backups
	@umask 077 && $(COMPOSE) exec -T mysql sh -c \
		'exec mysqldump -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF "$$MYSQL_DATABASE"' \
		> "backups/productivity_db_$$(date +%F_%H%M%S).sql"
	@echo "Backup created under backups/"

# --- Docker Stack Lifecycle ---
up: env ## Khoi chay core stack (mysql + backend + frontend) che do runtime
	$(COMPOSE) up -d --build

dev: env ## Khoi chay core stack che do dev hot-reload (bind mount source)
	$(COMPOSE_DEV) up -d --build

up-storage: env ## Khoi chay core + MinIO object storage
	$(COMPOSE_DEV) --profile storage up -d --build

up-ai: env ## Khoi chay core + MinIO + Qdrant + Ollama + OCR + AI Service
	$(COMPOSE_DEV) --profile ai up -d --build

up-all: env ## Khoi chay toan bo services (profile full)
	$(COMPOSE_DEV) --profile full up -d --build

down: ## Dung va go containers (giu nguyen named volumes du lieu)
	$(COMPOSE_DEV) --profile full down

stop: ## Tam dung tat ca containers ma khong xoa container
	$(COMPOSE_DEV) --profile full stop

ps: ## Xem trang thai cac containers
	$(COMPOSE_DEV) --profile full ps

logs: ## Theo doi logs (co the truyen SVC=backend)
	$(COMPOSE_DEV) --profile full logs -f --tail=100 $(SVC)

# --- Database Migrations (Alembic) ---
migrate: ## Chay alembic upgrade head tren backend
	cd backend && uv run alembic upgrade head

migration: ## Tao Alembic revision moi (dung: make migration MSG="init core tables")
	@if [ -z "$(MSG)" ]; then echo "Usage: make migration MSG=\"describe_change\""; exit 1; fi
	cd backend && uv run alembic revision --autogenerate -m "$(MSG)"

# --- Quality Gates: Backend (Python 3.14) ---
be-lint: ## Kiem tra lint va format backend (ruff)
	cd backend && uv run ruff check . && uv run ruff format --check .

be-typecheck: ## Kiem tra kieu du lieu backend (pyright)
	cd backend && uv run pyright app

be-test: ## Chay test suite backend (pytest)
	cd backend && uv run pytest

# --- Quality Gates: Frontend (Next.js 16) ---
fe-lint: ## Kiem tra ESLint frontend
	cd frontend && pnpm lint

fe-typecheck: ## Kiem tra TypeScript frontend
	cd frontend && pnpm typecheck

fe-test: ## Chay unit/component tests frontend
	cd frontend && pnpm test

check: be-lint be-typecheck be-test fe-lint fe-typecheck fe-test ## Chay toan bo quality gates BE + FE
