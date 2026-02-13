#!/usr/bin/env sh
set -e

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

if node -e "require.resolve('openclaw')" >/dev/null 2>&1; then
  if [ "$#" -gt 0 ]; then
    exec "$@"
  fi
  exit 0
fi

echo "[kair] npm dependency 'openclaw' is missing; installing project dependencies."
CI=1 npm install

if node -e "require.resolve('openclaw')" >/dev/null 2>&1; then
  if [ "$#" -gt 0 ]; then
    exec "$@"
  fi
  exit 0
fi

echo "[kair] Unable to resolve npm dependency 'openclaw' after npm install."
exit 1
