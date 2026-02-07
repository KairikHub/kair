#!/usr/bin/env sh
set -e

OPENCLAW_ROOT="/app/vendor/openclaw"
ENTRY_FILE="$OPENCLAW_ROOT/dist/entry.js"

if [ -f "$ENTRY_FILE" ]; then
  if [ "$#" -gt 0 ]; then
    exec "$@"
  fi
  exit 0
fi

echo "[kairik] OpenClaw build artifacts missing; building inside container."

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.12.2 --activate >/dev/null 2>&1 || true
fi

pnpm -C "$OPENCLAW_ROOT" install
pnpm -C "$OPENCLAW_ROOT" build

echo "[kairik] OpenClaw build complete."

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
