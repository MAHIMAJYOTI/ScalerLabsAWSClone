FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .
RUN chmod +x start.sh

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# Intentionally runs as root: Railway mounts volumes root-owned, and start.sh
# must create/migrate the SQLite file under /data. No USER directive.
CMD ["./start.sh"]
