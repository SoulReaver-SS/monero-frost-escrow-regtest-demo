#!/usr/bin/env bash
set -euo pipefail

# Creates a small release archive that can update an existing local checkout
# without touching node_modules, the fakechain, wallets, or escrow session data.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?Usage: ./scripts/build-code-overlay.sh <release-version> [output-directory]}"
OUTPUT_DIR="${2:-$PROJECT_DIR/..}"
RELEASE_DIR="$OUTPUT_DIR/frost-monero-regtest-escrow-code-update-$VERSION"
ARCHIVE="$OUTPUT_DIR/frost-monero-regtest-escrow-code-update-$VERSION.tar.gz"

FILES=(
  "local-runtime/escrow-service.ts"
  "local-runtime/mediator-host.ts"
  "local-runtime/page-render.ts"
  "local-runtime/runtime-primitives.ts"
  "scripts/run-local-demo.sh"
  "scripts/start-local-demo.sh"
  "server/escrow-runtime.contract.test.ts"
  "docs/CODE_UPDATE_OVERLAY.md"
)

rm -rf "$RELEASE_DIR" "$ARCHIVE"
mkdir -p "$RELEASE_DIR/overlay"

for relative_path in "${FILES[@]}"; do
  mkdir -p "$RELEASE_DIR/overlay/$(dirname "$relative_path")"
  cp -p "$PROJECT_DIR/$relative_path" "$RELEASE_DIR/overlay/$relative_path"
done

printf '%s\n' "$VERSION" > "$RELEASE_DIR/overlay/.frost-code-version"

cat > "$RELEASE_DIR/README.txt" <<'README'
FROST Monero regtest escrow — code-only update

This archive updates code only. It does NOT contain, delete, or recreate:
  - node_modules or installed dependencies
  - ~/.local/share/frost-monero-regtest/ fakechain data
  - mediator keys, wallets, snapshots, or SQLite session data

Extract this archive anywhere under your Linux/WSL home directory, then run:

  ./apply-update.sh ~/frost-escrow

Replace ~/frost-escrow with your permanent project directory. Stop the
coordinator first, then restart it with ./scripts/run-local-demo.sh --tailscale.

If a release changes package.json or pnpm-lock.yaml, use a full repository
archive instead. A code-only overlay intentionally never changes dependencies.
README

cat > "$RELEASE_DIR/apply-update.sh" <<'APPLY'
#!/usr/bin/env bash
set -euo pipefail

UPDATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$HOME/frost-escrow}"
OVERLAY_DIR="$UPDATE_DIR/overlay"
BACKUP_ROOT="$TARGET_DIR/.frost-code-update-backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

FILES=(
  "local-runtime/escrow-service.ts"
  "local-runtime/mediator-host.ts"
  "local-runtime/page-render.ts"
  "local-runtime/runtime-primitives.ts"
  "scripts/run-local-demo.sh"
  "scripts/start-local-demo.sh"
  "server/escrow-runtime.contract.test.ts"
  "docs/CODE_UPDATE_OVERLAY.md"
)

if [[ ! -d "$TARGET_DIR" || ! -f "$TARGET_DIR/package.json" || ! -d "$TARGET_DIR/local-runtime" ]]; then
  echo "Target does not look like an existing FROST escrow checkout: $TARGET_DIR" >&2
  echo "Usage: ./apply-update.sh /path/to/your/permanent/project" >&2
  exit 1
fi

if [[ ! -f "$OVERLAY_DIR/.frost-code-version" ]]; then
  echo "The extracted update overlay is incomplete." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$UPDATE_DIR" && sha256sum -c SHA256SUMS)
fi

if pgrep -af "local-runtime/escrow-service.ts" | grep -F "$TARGET_DIR" >/dev/null; then
  echo "Stop the running coordinator from its terminal with Ctrl+C, then apply the update again." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
for relative_path in "${FILES[@]}"; do
  source="$OVERLAY_DIR/$relative_path"
  destination="$TARGET_DIR/$relative_path"
  if [[ ! -f "$source" ]]; then
    echo "Overlay is missing required file: $relative_path" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$destination")" "$(dirname "$BACKUP_DIR/$relative_path")"
  if [[ -e "$destination" ]]; then
    cp -p "$destination" "$BACKUP_DIR/$relative_path"
  fi
  cp -p "$source" "$destination"
done

cp -p "$OVERLAY_DIR/.frost-code-version" "$TARGET_DIR/.frost-code-version"

echo "Applied code update $(cat "$OVERLAY_DIR/.frost-code-version") to: $TARGET_DIR"
echo "Backup of replaced code only: $BACKUP_DIR"
echo "Untouched: node_modules, ~/.local/share/frost-monero-regtest, wallets, snapshot, and SQLite session state."
echo "Restart with: cd \"$TARGET_DIR\" && ./scripts/run-local-demo.sh --tailscale"
APPLY

chmod +x "$RELEASE_DIR/apply-update.sh"
(cd "$RELEASE_DIR" && sha256sum $(find overlay -type f -print | sort) > SHA256SUMS)
tar -C "$OUTPUT_DIR" -czf "$ARCHIVE" "$(basename "$RELEASE_DIR")"
rm -rf "$RELEASE_DIR"

echo "$ARCHIVE"
