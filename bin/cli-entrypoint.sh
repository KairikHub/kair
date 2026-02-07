#!/usr/bin/env sh
set -e

/app/bin/ensure-openclaw-built.sh

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
