#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/.kair"
APP_DIR="$OUT_DIR/app"
RUNTIME_DIR="$OUT_DIR/runtime"
TMP_DIR="$ROOT_DIR/.kair/.tmp"
BUILD_DIR="$ROOT_DIR/.kair/.build"
VERIFY_ONLY=0

if [ "${1:-}" = "--verify" ]; then
  VERIFY_ONLY=1
fi

install_shell_alias() {
  if [ "$VERIFY_ONLY" -eq 1 ]; then
    return
  fi
  if [ -n "${CI:-}" ]; then
    echo "[kair-package] CI detected; skipping shell alias install"
    return
  fi
  if [ "${KAIR_INSTALL_ALIAS:-1}" = "0" ]; then
    echo "[kair-package] KAIR_INSTALL_ALIAS=0; skipping shell alias install"
    return
  fi
  if [ ! -d "${HOME:-}" ]; then
    echo "[kair-package] HOME is not set to a writable directory; skipping alias install"
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

  ALIAS_START="# >>> kair embedded alias >>>"
  ALIAS_LINE="alias kair='$ROOT_DIR/.kair/bin/kair'"
  ALIAS_END="# <<< kair embedded alias <<<"

  mkdir -p "$(dirname "$RC_FILE")"
  touch "$RC_FILE"

  if grep -F "$ALIAS_START" "$RC_FILE" >/dev/null 2>&1; then
    echo "[kair-package] shell alias already configured in $RC_FILE"
    return
  fi

  {
    echo ""
    echo "$ALIAS_START"
    echo "$ALIAS_LINE"
    echo "$ALIAS_END"
  } >> "$RC_FILE"

  echo "[kair-package] installed shell alias in $RC_FILE"
  echo "[kair-package] open a new shell or run: source $RC_FILE"
}

if [ "$VERIFY_ONLY" -eq 0 ]; then
  rm -rf "$APP_DIR" "$RUNTIME_DIR" "$TMP_DIR"
  mkdir -p "$APP_DIR/bin" "$APP_DIR/src" "$RUNTIME_DIR" "$TMP_DIR" "$BUILD_DIR"

  NODE_VERSION="${KAIR_EMBED_NODE_VERSION:-v22.13.1}"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64|aarch64)
      NODE_ARCH="arm64"
      ;;
    x86_64|amd64)
      NODE_ARCH="x64"
      ;;
    *)
      NODE_ARCH="arm64"
      ;;
  esac
  NODE_DIST="${KAIR_EMBED_NODE_DIST:-node-${NODE_VERSION}-darwin-${NODE_ARCH}}"
  NODE_URL="${KAIR_EMBED_NODE_URL:-https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.gz}"
  NODE_TARBALL="$TMP_DIR/node.tar.gz"
  NPM_CLI="$TMP_DIR/$NODE_DIST/lib/node_modules/npm/bin/npm-cli.js"

  echo "[kair-package] downloading embedded Node runtime: $NODE_URL"
  curl -fsSL "$NODE_URL" -o "$NODE_TARBALL"
  tar -xzf "$NODE_TARBALL" -C "$TMP_DIR"

  cp "$TMP_DIR/$NODE_DIST/bin/node" "$RUNTIME_DIR/node"
  chmod +x "$RUNTIME_DIR/node"

  cat > "$APP_DIR/bin/kair.cjs" <<'LAUNCHER'
#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [tsxCli, path.join(root, "src", "kair.ts"), ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: `${path.join(root, "node_modules", ".bin")}:${process.env.PATH || ""}`,
  },
});

if (result.error) {
  console.error(`Error: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
LAUNCHER
  chmod +x "$APP_DIR/bin/kair.cjs"
  cp -R "$ROOT_DIR/src/." "$APP_DIR/src"
  cp "$ROOT_DIR/package.json" "$APP_DIR/package.json"

  echo "[kair-package] bootstrapping tsx runtime dependency via embedded npm"
  rm -rf "$BUILD_DIR/tsx"
  mkdir -p "$BUILD_DIR/tsx"
  cat > "$BUILD_DIR/tsx/package.json" <<'PKG'
{
  "private": true,
  "dependencies": {
    "tsx": "4.19.3"
  }
}
PKG
  PATH="$RUNTIME_DIR:$PATH" "$RUNTIME_DIR/node" "$NPM_CLI" install \
    --prefix "$BUILD_DIR/tsx" \
    --no-audit \
    --no-fund >/dev/null
  cp -R "$BUILD_DIR/tsx/node_modules" "$APP_DIR/node_modules"

  EMBED_NODE_VERSION="$NODE_VERSION"
  BUILD_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  GIT_SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"

  cat > "$OUT_DIR/VERSION" <<VERS
kair_git_sha=$GIT_SHA
embedded_node=$EMBED_NODE_VERSION
built_at_utc=$BUILD_TS
VERS

  rm -rf "$TMP_DIR" "$BUILD_DIR"
fi

if [ ! -x "$OUT_DIR/runtime/node" ]; then
  echo "[kair-package] missing runtime binary at .kair/runtime/node" >&2
  exit 1
fi

if [ ! -f "$OUT_DIR/app/bin/kair.cjs" ]; then
  echo "[kair-package] missing app entry at .kair/app/bin/kair.cjs" >&2
  exit 1
fi

MANIFEST_TMP="$OUT_DIR/MANIFEST.json.tmp"
MANIFEST_PATH="$OUT_DIR/MANIFEST.json"

{
  echo "{"
  echo "  \"version_file\": \".kair/VERSION\"," 
  echo "  \"files\": ["

  find "$OUT_DIR/bin" "$OUT_DIR/runtime" "$OUT_DIR/app" -type f | sort | \
  while IFS= read -r FILE; do
    REL_PATH="${FILE#$ROOT_DIR/}"
    SUM="$(shasum -a 256 "$FILE" | awk '{print $1}')"
    SIZE="$(wc -c < "$FILE" | tr -d ' ')"
    echo "    {\"path\": \"$REL_PATH\", \"sha256\": \"$SUM\", \"size\": $SIZE},"
  done

  echo "    {\"path\": \".kair/VERSION\", \"sha256\": \"$(shasum -a 256 "$OUT_DIR/VERSION" | awk '{print $1}')\", \"size\": $(wc -c < "$OUT_DIR/VERSION" | tr -d ' ')}"
  echo "  ]"
  echo "}"
} > "$MANIFEST_TMP"

mv "$MANIFEST_TMP" "$MANIFEST_PATH"

if [ "$VERIFY_ONLY" -eq 1 ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "[kair-package] verifying launcher"
    PATH="/usr/bin:/bin:/usr/sbin:/sbin" "$OUT_DIR/bin/kair" --help >/dev/null
    echo "[kair-package] verify OK"
  else
    echo "[kair-package] non-macOS host detected; skipped launcher runtime check"
  fi
else
  echo "[kair-package] package complete"
  install_shell_alias
  echo "[kair-package] run smoke test: ./.kair/bin/kair --help"
fi
