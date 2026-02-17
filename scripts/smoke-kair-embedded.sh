#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CLI="$ROOT_DIR/.kair/bin/kair"

if [ ! -x "$CLI" ]; then
  echo "Missing embedded launcher: $CLI" >&2
  exit 1
fi

"$CLI" --help >/dev/null
"$CLI" contract --id embedded_smoke_script "Embedded smoke from script" >/dev/null

echo "Embedded runtime smoke OK"
