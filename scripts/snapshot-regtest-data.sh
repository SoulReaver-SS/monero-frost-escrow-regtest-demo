#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}"
DATA_DIR="${RUNTIME_DIR}/data"
SNAPSHOT_DIR="${RUNTIME_DIR}/snapshot-data"
PID_FILE="${RUNTIME_DIR}/monerod.pid"

test -d "${DATA_DIR}/fake/lmdb" || { echo "No fakechain data directory is available to snapshot." >&2; exit 1; }

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  kill -INT "$(cat "${PID_FILE}")"
  for attempt in $(seq 1 30); do
    kill -0 "$(cat "${PID_FILE}")" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
    echo "Regtest daemon did not stop cleanly; refusing to snapshot mutable LMDB data." >&2
    exit 1
  fi
fi
rm -f "${PID_FILE}"
rm -rf "${SNAPSHOT_DIR}"
mkdir -p "${SNAPSHOT_DIR}"
cp -a "${DATA_DIR}/." "${SNAPSHOT_DIR}/"
"${PROJECT_ROOT}/scripts/setup-regtest.sh"
echo "Created a consistent local fakechain snapshot."
