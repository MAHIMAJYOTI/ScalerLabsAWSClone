#!/bin/sh
set -e

echo "[start] $(date -u +%FT%TZ) alembic upgrade head: begin"
alembic upgrade head
echo "[start] $(date -u +%FT%TZ) alembic upgrade head: done"

# Seed in the background so uvicorn binds the port within seconds. The seed
# commits the demo user first (its own fast commit), so login works
# immediately; zones stream in once its single data commit lands.
python -m scripts.seed 2>&1 | sed 's/^/[seed] /' &

echo "[start] $(date -u +%FT%TZ) starting uvicorn (seed running in background)"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="*"
