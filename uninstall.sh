#!/usr/bin/env sh
set -eu

INSTALL_DIR="${KAIR_INSTALL_DIR:-$HOME/.kair}"
SHIM_DIR="${KAIR_SHIM_DIR:-$HOME/bin}"
SHIM_PATH="$SHIM_DIR/kair"

ALIAS_START="# >>> kair alias >>>"
ALIAS_END="# <<< kair alias <<<"
EMBED_ALIAS_START="# >>> kair embedded alias >>>"
EMBED_ALIAS_END="# <<< kair embedded alias <<<"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

remove_alias_block_range() {
  RC_FILE="$1"
  START_MARKER="$2"
  END_MARKER="$3"
  if [ ! -f "$RC_FILE" ]; then
    return
  fi
  if ! grep -F "$START_MARKER" "$RC_FILE" >/dev/null 2>&1; then
    return
  fi

  TMP_RC="$TMP_DIR/$(basename "$RC_FILE").updated.$(date +%s%N)"
  awk -v start="$START_MARKER" -v end="$END_MARKER" '
    $0 == start { inblock=1; next }
    $0 == end { inblock=0; next }
    !inblock { print }
  ' "$RC_FILE" > "$TMP_RC"
  mv "$TMP_RC" "$RC_FILE"
  printf '[kair-uninstall] removed alias block (%s) from %s\n' "$START_MARKER" "$RC_FILE"
}

remove_direct_alias_lines() {
  RC_FILE="$1"
  if [ ! -f "$RC_FILE" ]; then
    return
  fi
  TMP_RC="$TMP_DIR/$(basename "$RC_FILE").direct.$(date +%s%N)"
  awk '
    /^alias[[:space:]]+kair=/ { next }
    { print }
  ' "$RC_FILE" > "$TMP_RC"
  if ! cmp -s "$RC_FILE" "$TMP_RC"; then
    mv "$TMP_RC" "$RC_FILE"
    printf '[kair-uninstall] removed direct kair alias line(s) from %s\n' "$RC_FILE"
  else
    rm -f "$TMP_RC"
  fi
}

cleanup_rc_file() {
  RC_FILE="$1"
  remove_alias_block_range "$RC_FILE" "$ALIAS_START" "$ALIAS_END"
  remove_alias_block_range "$RC_FILE" "$EMBED_ALIAS_START" "$EMBED_ALIAS_END"
  remove_direct_alias_lines "$RC_FILE"
}

if [ -e "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  printf '[kair-uninstall] removed install directory: %s\n' "$INSTALL_DIR"
else
  printf '[kair-uninstall] install directory not found: %s\n' "$INSTALL_DIR"
fi

if [ -e "$SHIM_PATH" ]; then
  rm -f "$SHIM_PATH"
  printf '[kair-uninstall] removed shim: %s\n' "$SHIM_PATH"
else
  printf '[kair-uninstall] shim not found: %s\n' "$SHIM_PATH"
fi

if [ -d "$SHIM_DIR" ] && [ -z "$(ls -A "$SHIM_DIR" 2>/dev/null)" ]; then
  rmdir "$SHIM_DIR" >/dev/null 2>&1 || true
fi

cleanup_rc_file "$HOME/.zshrc"
cleanup_rc_file "$HOME/.bashrc"
cleanup_rc_file "$HOME/.profile"

printf '[kair-uninstall] uninstall complete\n'
printf '[kair-uninstall] current shell may still have alias/hash cached; run: unalias kair 2>/dev/null; hash -r\n'
