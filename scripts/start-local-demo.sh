#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -n "${FROST_BUN_BIN:-}" ]]; then
  BUN_BIN="$FROST_BUN_BIN"
elif [[ -x "$HOME/.bun/bin/bun" ]]; then
  BUN_BIN="$HOME/.bun/bin/bun"
elif command -v bun >/dev/null 2>&1; then
  BUN_BIN="$(command -v bun)"
elif [[ -x "$HOME/.local/frost-bun/node_modules/.bin/bun" ]]; then
  BUN_BIN="$HOME/.local/frost-bun/node_modules/.bin/bun"
else
  BUN_BIN=""
fi
test -x "${BUN_BIN}" || { echo "Bun is required; set FROST_BUN_BIN or install it first." >&2; exit 1; }
"${PROJECT_ROOT}/scripts/setup-regtest.sh"
test -f "${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}/snapshot-data/fake/lmdb/data.mdb" || echo "Run scripts/prepare-regtest-snapshot.ts once before funding."
exec "${BUN_BIN}" run "${PROJECT_ROOT}/local-runtime/escrow-service.ts"
