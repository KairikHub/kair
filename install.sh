#!/usr/bin/env sh
set -eu

fail() {
  echo "[kair-install] $1" >&2
  exit 1
}

OS_NAME="$(uname -s)"
if [ "$OS_NAME" != "Darwin" ]; then
  fail "kair embedded runtime currently supports macOS only (detected: $OS_NAME)."
fi

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required."
fi
if ! command -v tar >/dev/null 2>&1; then
  fail "tar is required."
fi

INSTALL_DIR="${KAIR_INSTALL_DIR:-$HOME/.kair}"
REPO_ARCHIVE_URL="${KAIR_REPO_ARCHIVE_URL:-https://codeload.github.com/KairikHub/kair/tar.gz/refs/heads/main}"
NODE_VERSION="${KAIR_EMBED_NODE_VERSION:-v22.13.1}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64)
    NODE_ARCH="arm64"
    ;;
  x86_64|amd64)
    NODE_ARCH="x64"
    ;;
  *)
    fail "Unsupported architecture: $ARCH"
    ;;
esac

NODE_DIST="node-${NODE_VERSION}-darwin-${NODE_ARCH}"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.gz"

REPO_TARBALL="$TMP_DIR/kair-repo.tar.gz"
NODE_TARBALL="$TMP_DIR/node.tar.gz"

printf '[kair-install] downloading kair payload...\n'
curl -fsSL "$REPO_ARCHIVE_URL" -o "$REPO_TARBALL"

tar -xzf "$REPO_TARBALL" -C "$TMP_DIR"
SOURCE_ROOT="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[ -n "$SOURCE_ROOT" ] || fail "Unable to locate extracted payload directory."
[ -d "$SOURCE_ROOT/.kair" ] || fail "Payload does not include .kair directory."

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/bin" "$INSTALL_DIR/app" "$INSTALL_DIR/runtime"
cp -R "$SOURCE_ROOT/.kair/bin" "$SOURCE_ROOT/.kair/app" "$SOURCE_ROOT/.kair/approvals" "$INSTALL_DIR/"
if [ -f "$SOURCE_ROOT/.kair/VERSION" ]; then
  cp "$SOURCE_ROOT/.kair/VERSION" "$INSTALL_DIR/VERSION"
fi
if [ -f "$SOURCE_ROOT/.kair/MANIFEST.json" ]; then
  cp "$SOURCE_ROOT/.kair/MANIFEST.json" "$INSTALL_DIR/MANIFEST.json"
fi

cat > "$INSTALL_DIR/bin/kair" <<'LAUNCHER'
#!/usr/bin/env sh
set -e

BASE_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
OS_NAME="$(uname -s)"

if [ "$OS_NAME" != "Darwin" ]; then
  echo "kair embedded runtime currently supports macOS only (detected: $OS_NAME)." >&2
  exit 1
fi

NODE_BIN="$BASE_DIR/runtime/node"
APP_ENTRY="$BASE_DIR/app/bin/kair.cjs"

if [ ! -x "$NODE_BIN" ]; then
  echo "Missing embedded runtime: $NODE_BIN" >&2
  exit 1
fi

if [ ! -f "$APP_ENTRY" ]; then
  echo "Missing embedded app entry: $APP_ENTRY" >&2
  exit 1
fi

exec "$NODE_BIN" "$APP_ENTRY" "$@"
LAUNCHER
chmod +x "$INSTALL_DIR/bin/kair"

printf '[kair-install] downloading embedded node runtime (%s)...\n' "$NODE_VERSION"
curl -fsSL "$NODE_URL" -o "$NODE_TARBALL"
tar -xzf "$NODE_TARBALL" -C "$TMP_DIR"
mkdir -p "$INSTALL_DIR/runtime"
cp "$TMP_DIR/$NODE_DIST/bin/node" "$INSTALL_DIR/runtime/node"
chmod +x "$INSTALL_DIR/runtime/node"

NPM_CLI="$TMP_DIR/$NODE_DIST/lib/node_modules/npm/bin/npm-cli.js"
BUILD_DIR="$TMP_DIR/tsx-build"
mkdir -p "$BUILD_DIR"
cat > "$BUILD_DIR/package.json" <<'PKG'
{
  "private": true,
  "dependencies": {
    "tsx": "4.19.3"
  }
}
PKG

printf '[kair-install] installing runtime js dependencies...\n'
PATH="$INSTALL_DIR/runtime:$PATH" "$INSTALL_DIR/runtime/node" "$NPM_CLI" install \
  --prefix "$BUILD_DIR" \
  --no-audit \
  --no-fund >/dev/null
rm -rf "$INSTALL_DIR/app/node_modules"
cp -R "$BUILD_DIR/node_modules" "$INSTALL_DIR/app/node_modules"

install_alias() {
  if [ -n "${CI:-}" ]; then
    printf '[kair-install] CI detected; skipping alias setup\n'
    return
  fi
  if [ "${KAIR_INSTALL_ALIAS:-1}" = "0" ]; then
    printf '[kair-install] KAIR_INSTALL_ALIAS=0; skipping alias setup\n'
    return
  fi

  SHELL_NAME="$(basename "${SHELL:-}")"
  case "$SHELL_NAME" in
    zsh)
      RC_FILE="$HOME/.zshrc"
      ;;
    bash)
      RC_FILE="$HOME/.bashrc"
      ;;
    *)
      RC_FILE="$HOME/.profile"
      ;;
  esac

  ALIAS_START="# >>> kair alias >>>"
  ALIAS_LINE="alias kair='$INSTALL_DIR/bin/kair'"
  ALIAS_END="# <<< kair alias <<<"

  touch "$RC_FILE"
  if grep -F "$ALIAS_START" "$RC_FILE" >/dev/null 2>&1; then
    printf '[kair-install] alias already configured in %s\n' "$RC_FILE"
    return
  fi

  {
    printf '\n%s\n' "$ALIAS_START"
    printf '%s\n' "$ALIAS_LINE"
    printf '%s\n' "$ALIAS_END"
  } >> "$RC_FILE"

  printf '[kair-install] alias added to %s\n' "$RC_FILE"
  printf '[kair-install] open a new shell or run: source %s\n' "$RC_FILE"
}

install_alias

"$INSTALL_DIR/bin/kair" --help >/dev/null
printf '[kair-install] install complete\n'
printf '[kair-install] run: %s/bin/kair --help\n' "$INSTALL_DIR"
