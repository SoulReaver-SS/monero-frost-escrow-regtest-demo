#!/usr/bin/env bash
set -euo pipefail

# Root launcher for a modular distribution. All executable source stays in
# code/; installed Node dependencies stay at the modular root so Node can
# resolve them by walking up from code/ without a mounted-filesystem symlink.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "$SCRIPT_DIR/code" ]]; then
  DIST_ROOT="$SCRIPT_DIR"
else
  DIST_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
CODE_DIR="$DIST_ROOT/code"
DEPENDENCY_DIR="$DIST_ROOT/dependencies"
NODE_MODULES="$DIST_ROOT/node_modules"

if [[ -d "$DIST_ROOT/local-runtime" ]]; then
  cat >&2 <<EOF
This is an old non-modular project checkout, not the extracted modular release.
The modular launcher requires a root folder containing code/, dependencies/, and state/.
Extract the modular archive into its own folder (for example, ~/Desktop/Terminus Sync/frost-modular) and run that folder's root-level frost-demo.sh.
EOF
  exit 2
fi

if [[ ! -d "$CODE_DIR" || ! -d "$DEPENDENCY_DIR" || ! -d "$DIST_ROOT/state" || ! -f "$DIST_ROOT/package.json" || ! -f "$DIST_ROOT/pnpm-lock.yaml" || ! -f "$CODE_DIR/package.json" || ! -x "$CODE_DIR/scripts/run-local-demo.sh" ]]; then
  echo "Modular distribution is incomplete: expected root-level code/, dependencies/, state/, package.json, and pnpm-lock.yaml." >&2
  exit 1
fi

mkdir -p "$DEPENDENCY_DIR" "$DIST_ROOT/state"
if [[ -L "$CODE_DIR/node_modules" ]]; then
  # Older modular releases created this link. Remove it so pnpm never needs
  # to create or traverse a link inside code/ on a mounted sync filesystem.
  rm "$CODE_DIR/node_modules"
fi

mkdir -p "$NODE_MODULES"

cd "$CODE_DIR"
exec env FROST_DEPENDENCY_ROOT="$DIST_ROOT" FROST_VITEST_BIN="$NODE_MODULES/.bin/vitest" ./scripts/run-local-demo.sh "$@"
