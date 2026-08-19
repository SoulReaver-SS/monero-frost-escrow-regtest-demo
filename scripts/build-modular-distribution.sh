#!/usr/bin/env bash
set -euo pipefail

# Creates the first-install archive. Its contents are deliberately organized
# so later updates replace only the `code/` directory.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?Usage: ./scripts/build-modular-distribution.sh <release-version> [output-directory]}"
OUTPUT_DIR="${2:-$PROJECT_DIR/..}"
NAME="frost-monero-regtest-escrow"
ARCHIVE="$OUTPUT_DIR/${NAME}-modular-$VERSION.tar.gz"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/frost-modular-build.XXXXXX")"
STAGE="$BUILD_DIR/$NAME"

cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

rm -f "$ARCHIVE"
mkdir -p "$STAGE/code" "$STAGE/dependencies" "$STAGE/state"

tar -C "$PROJECT_DIR" \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./.manus-logs' \
  --exclude='./dist' \
  --exclude='./.frost-code-update-backups' \
  -cf - . | tar -C "$STAGE/code" -xf -

cp -p "$PROJECT_DIR/scripts/modular-demo.sh" "$STAGE/frost-demo.sh"
cp -p "$PROJECT_DIR/scripts/replace-code-dir.sh" "$STAGE/replace-code.sh"
cp -p "$PROJECT_DIR/package.json" "$PROJECT_DIR/pnpm-lock.yaml" "$STAGE/"
chmod +x "$STAGE/frost-demo.sh" "$STAGE/replace-code.sh"

cat > "$STAGE/README.md" <<'EOF'
# FROST Monero Regtest Escrow — Modular Distribution (__VERSION__)

This is the **first-install archive**. You may keep it under \`~/Desktop/Terminus Sync/\` if that is your preferred shared folder. Do not copy \`frost-demo.sh\` into an older project folder; its root must contain the three directories shown below.

\`\`\`text
__NAME__/
├── code/          Replace this directory for future code releases.
├── node_modules/  Installed dependencies; do not delete for a normal code update.
├── dependencies/  Reserved dependency metadata area.
├── state/         Reserved for local distribution metadata; durable Monero state is external.
├── frost-demo.sh  Normal launcher. Use this instead of code/scripts/run-local-demo.sh.
└── replace-code.sh  Safely replaces only code/ from a later full modular release.
\`\`\`

## First run

\`\`\`bash
tar -xzf ~/Downloads/__ARCHIVE__ -C "$HOME/Desktop/Terminus Sync"
cd "$HOME/Desktop/Terminus Sync/__NAME__"
./frost-demo.sh --tailscale
\`\`\`

The first run installs dependencies into the root \`node_modules/\` directory, outside the replaceable \`code/\` tree. The fakechain, snapshot, wallets, mediator secret, and SQLite session stay outside this archive at \`~/.local/share/frost-monero-regtest/\`.

## Future code update

Stop the coordinator with \`Ctrl+C\`. Extract a newer **modular** full archive somewhere temporary, then replace only the code directory:

\`\`\`bash
cd "$HOME/Desktop/Terminus Sync/__NAME__"
./replace-code.sh /path/to/extracted-new-release/code
./frost-demo.sh --tailscale
\`\`\`

\`replace-code.sh\` moves your previous \`code/\` into a timestamped backup under \`state/code-backups/\`; it does not touch \`dependencies/\` or \`~/.local/share/frost-monero-regtest/\`.

> If a future release changes \`package.json\` or \`pnpm-lock.yaml\`, the next launch automatically runs the normal frozen dependency install. In ordinary code-only releases, unchanged lockfiles make that check fast and preserve the existing \`node_modules\` directory.
EOF

sed -i "s/__VERSION__/$VERSION/g; s/__NAME__/$NAME/g; s/__ARCHIVE__/$(basename "$ARCHIVE")/g" "$STAGE/README.md"

printf '%s\n' "$VERSION" > "$STAGE/state/DISTRIBUTION_VERSION"
(cd "$STAGE" && sha256sum frost-demo.sh replace-code.sh README.md state/DISTRIBUTION_VERSION > SHA256SUMS)
tar -C "$BUILD_DIR" -czf "$ARCHIVE" "$NAME"
echo "$ARCHIVE"
