#!/usr/bin/env bash
set -euo pipefail

# Replaces only the distribution's code/ directory. Dependencies and external
# runtime state are intentionally excluded.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "$SCRIPT_DIR/code" ]]; then
  DIST_ROOT="$SCRIPT_DIR"
else
  DIST_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
SOURCE_CODE_DIR="${1:?Usage: ./replace-code.sh /path/to/new-modular-release/code}"
TARGET_CODE_DIR="$DIST_ROOT/code"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$DIST_ROOT/state/code-backups/$STAMP"

if [[ ! -d "$SOURCE_CODE_DIR" || ! -f "$SOURCE_CODE_DIR/package.json" || ! -x "$SOURCE_CODE_DIR/scripts/run-local-demo.sh" ]]; then
  echo "Source must be a modular distribution's valid code/ directory." >&2
  exit 1
fi
if pgrep -af "local-runtime/escrow-service.ts" | grep -F "$TARGET_CODE_DIR" >/dev/null; then
  echo "Stop the coordinator with Ctrl+C before replacing code/." >&2
  exit 1
fi
if [[ -e "$SOURCE_CODE_DIR/node_modules" ]]; then
  echo "Source code/ must not contain node_modules; the modular distribution keeps dependencies separately." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
mv "$TARGET_CODE_DIR" "$BACKUP_DIR/code"
cp -a "$SOURCE_CODE_DIR" "$TARGET_CODE_DIR"

echo "Replaced only code/. Previous code backup: $BACKUP_DIR/code"
echo "Untouched: dependencies/ and ~/.local/share/frost-monero-regtest/"
