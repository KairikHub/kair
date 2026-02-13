#!/usr/bin/env sh
set -e

/app/bin/ensure-openclaw-package.sh

# Bind-mounting /app can hide npm-link artifacts from the image; ensure CLI stays on PATH.
if ! command -v kair >/dev/null 2>&1 && [ -x /app/bin/kair.cjs ]; then
  ln -sf /app/bin/kair.cjs /usr/local/bin/kair || true
fi

if [ "$#" -eq 0 ]; then
  if command -v bash >/dev/null 2>&1; then
    exec bash
  fi
  exec sh
fi

if [ "$1" = "kair" ]; then
  shift
  exec npm run kair -- "$@"
fi

exec "$@"
