#!/usr/bin/env sh
set -eu

INSTALL_DIR="${KAIR_INSTALL_DIR:-$HOME/.kair}"
SHIM_DIR="${KAIR_SHIM_DIR:-$HOME/bin}"
SHIM_PATH="$SHIM_DIR/kair"

ALIAS_START="# >>> kair alias >>>"
ALIAS_END="# <<< kair alias <<<"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

remove_alias_block() {
  RC_FILE="$1"
  if [ ! -f "$RC_FILE" ]; then
    return
  fi
  if ! grep -F "$ALIAS_START" "$RC_FILE" >/dev/null 2>&1; then
    return
  fi

  TMP_RC="$TMP_DIR/$(basename "$RC_FILE").updated"
  awk -v start="$ALIAS_START" -v end="$ALIAS_END" '
    $0 == start { inblock=1; next }
    $0 == end { inblock=0; next }
    !inblock { print }
  ' "$RC_FILE" > "$TMP_RC"
  mv "$TMP_RC" "$RC_FILE"
  printf '[kair-uninstall] removed alias block from %s\n' "$RC_FILE"
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

remove_alias_block "$HOME/.zshrc"
remove_alias_block "$HOME/.bashrc"
remove_alias_block "$HOME/.profile"

printf '[kair-uninstall] uninstall complete\n'
printf '[kair-uninstall] if your shell cached command paths, run: hash -r\n'
