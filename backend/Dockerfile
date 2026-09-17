# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

# psycopg2-binary ships its own libpq, so no build toolchain is needed. curl is
# here for the container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Copy requirements first so dependency layers cache across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts

# Never run as root.
RUN useradd --create-home --uid 10001 bookvuk \
    && chown -R bookvuk:bookvuk /app
USER bookvuk

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Migrations are deliberately NOT run here: a container that migrates on start
# races its own replicas. Run `alembic upgrade head` as a deploy step.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
