#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/.kair/MANIFEST.json"

if [ ! -f "$MANIFEST" ]; then
  echo "Missing manifest: $MANIFEST" >&2
  exit 1
fi

TMP_FILE="$ROOT_DIR/.kair/.manifest-check.tmp"
CURRENT_PATH=""
> "$TMP_FILE"
while IFS= read -r LINE; do
  case "$LINE" in
    *'"path": '*)
      CURRENT_PATH="$(printf '%s' "$LINE" | sed -E 's/.*"path": "([^"]+)".*/\1/')"
      ;;
    *'"sha256": '*)
      HASH="$(printf '%s' "$LINE" | sed -E 's/.*"sha256": "([^"]+)".*/\1/')"
      if [ -n "$CURRENT_PATH" ] && [ -n "$HASH" ]; then
        printf '%s %s\n' "$CURRENT_PATH" "$HASH" >> "$TMP_FILE"
      fi
      ;;
  esac
done < "$MANIFEST"

while IFS=' ' read -r REL_PATH EXPECTED; do
  FILE_PATH="$ROOT_DIR/$REL_PATH"
  if [ ! -f "$FILE_PATH" ]; then
    echo "Missing file from manifest: $REL_PATH" >&2
    rm -f "$TMP_FILE"
    exit 1
  fi
  ACTUAL="$(shasum -a 256 "$FILE_PATH" | awk '{print $1}')"
  if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "Checksum mismatch: $REL_PATH" >&2
    echo "expected=$EXPECTED" >&2
    echo "actual=$ACTUAL" >&2
    rm -f "$TMP_FILE"
    exit 1
  fi
done < "$TMP_FILE"

rm -f "$TMP_FILE"
echo "Manifest verification OK"
