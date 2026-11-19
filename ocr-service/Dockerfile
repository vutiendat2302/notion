# syntax=docker/dockerfile:1

# Python 3.12 riêng cho tương thích PaddlePaddle / PaddleOCR / OpenCV native wheels
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# --- Development stage (hot-reload) ---
FROM base AS dev

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .

EXPOSE 8866
CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8866"]

# --- Production runtime stage (non-root) ---
FROM base AS runtime

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /home/appuser/.paddleocr \
    && chown -R appuser:appuser /app /home/appuser/.paddleocr

USER appuser

EXPOSE 8866
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8866/health/live', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8866"]
