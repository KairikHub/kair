#!/usr/bin/env sh
set -e

/app/bin/ensure-openclaw-built.sh

# Bind-mounting /app can hide npm-link artifacts from the image; ensure CLI stays on PATH.
if ! command -v kairik >/dev/null 2>&1 && [ -x /app/bin/kairik.cjs ]; then
  ln -sf /app/bin/kairik.cjs /usr/local/bin/kairik || true
fi

if [ "$#" -eq 0 ]; then
  if command -v bash >/dev/null 2>&1; then
    exec bash
  fi
  exec sh
fi

if [ "$1" = "kairik" ]; then
  shift
  exec npm run kairik -- "$@"
fi

exec "$@"
