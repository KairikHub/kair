#!/usr/bin/env sh
set -e

OPENCLAW_ROOT="/app/vendor/openclaw"
ENTRY_FILE="$OPENCLAW_ROOT/dist/entry.js"
OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
CONFIG_PATH="$OPENCLAW_STATE_DIR/openclaw.json"

if [ -n "${OPENAI_API_KEY:-}" ] && [ ! -f "$CONFIG_PATH" ]; then
  mkdir -p "$OPENCLAW_STATE_DIR"
  MODEL_SUFFIX="${KAIR_LLM_MODEL:-gpt-5.1}"
  case "$MODEL_SUFFIX" in
    */*) MODEL_ID="$MODEL_SUFFIX" ;;
    *) MODEL_ID="openai/$MODEL_SUFFIX" ;;
  esac
  cat >"$CONFIG_PATH" <<EOF
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "${MODEL_ID}"
      }
    }
  }
}
EOF
  echo "[kair] OpenClaw config initialized for OpenAI."
fi

if [ -f "$ENTRY_FILE" ]; then
  if [ "$#" -gt 0 ]; then
    exec "$@"
  fi
  exit 0
fi

echo "[kair] OpenClaw build artifacts missing; building inside container."

if command -v corepack >/dev/null 2>&1; then
  COREPACK_ENABLE_STRICT=0 corepack enable >/dev/null 2>&1 || true
  COREPACK_ENABLE_STRICT=0 corepack prepare pnpm@10.23.0 --activate >/dev/null 2>&1 || true
fi

CI=1 pnpm -C "$OPENCLAW_ROOT" install
CI=1 pnpm -C "$OPENCLAW_ROOT" build

echo "[kair] OpenClaw build complete."

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
