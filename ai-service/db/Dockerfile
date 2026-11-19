FROM python:3.14-slim

ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY ai_db ./ai_db
COPY alembic ./alembic
COPY tests ./tests
COPY alembic.ini ./
CMD ["alembic", "upgrade", "head"]
