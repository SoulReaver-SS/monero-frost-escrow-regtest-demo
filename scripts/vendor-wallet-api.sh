#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN_BIN="${FROST_BUN_BIN:-$HOME/.local/frost-bun/node_modules/.bin/bun}"
WORK_DIR="${TMPDIR:-/tmp}/frost-wallet-api-prebuilt"
DEST_DIR="${PROJECT_ROOT}/vendor/monero-wallet-api"

test -x "${BUN_BIN}" || {
  echo "Bun was not found at ${BUN_BIN}. Install Bun, or set FROST_BUN_BIN." >&2
  exit 1
}

rm -rf "${WORK_DIR}" "${DEST_DIR}"
mkdir -p "${WORK_DIR}" "${DEST_DIR}"
cd "${WORK_DIR}"
"${BUN_BIN}" init -y >/dev/null
"${BUN_BIN}" add --ignore-scripts @spirobel/monero-wallet-api
test -d "${WORK_DIR}/node_modules/@spirobel/monero-wallet-api/dist"
cp -a "${WORK_DIR}/node_modules/@spirobel/monero-wallet-api/dist" "${DEST_DIR}/dist"
node -p "require('${WORK_DIR}/node_modules/@spirobel/monero-wallet-api/package.json').version" > "${DEST_DIR}/VERSION"
echo "Vendored prebuilt wallet API version $(cat "${DEST_DIR}/VERSION") without running package lifecycle scripts."
