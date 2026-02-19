#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/.kair/VERSION"

if [ ! -f "$VERSION_FILE" ]; then
  echo "[kair-embed-check] missing $VERSION_FILE" >&2
  echo "[kair-embed-check] run ./scripts/package-kair-runtime.sh first" >&2
  exit 1
fi

CURRENT_SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || true)"
EMBED_SHA="$(sed -n 's/^kair_git_sha=//p' "$VERSION_FILE" | tr -d '\r\n' | head -n 1)"

if [ -z "$CURRENT_SHA" ] || [ -z "$EMBED_SHA" ]; then
  echo "[kair-embed-check] unable to resolve git SHA values" >&2
  exit 1
fi

if [ "$CURRENT_SHA" != "$EMBED_SHA" ]; then
  echo "[kair-embed-check] mismatch detected" >&2
  echo "[kair-embed-check] repo HEAD : $CURRENT_SHA" >&2
  echo "[kair-embed-check] .kair/VERSION: $EMBED_SHA" >&2
  echo "[kair-embed-check] run ./scripts/package-kair-runtime.sh && ./scripts/verify-kair-manifest.sh" >&2
  exit 1
fi

echo "[kair-embed-check] OK: .kair/VERSION matches HEAD ($CURRENT_SHA)"

