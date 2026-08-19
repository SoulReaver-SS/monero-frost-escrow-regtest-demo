#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}"
DATA_DIR="${RUNTIME_DIR}/data"
SNAPSHOT_DIR="${RUNTIME_DIR}/snapshot-data"
PID_FILE="${RUNTIME_DIR}/monerod.pid"

if [[ ! -d "${SNAPSHOT_DIR}" ]]; then
  echo "No prepared regtest snapshot exists. Run scripts/prepare-regtest-snapshot.ts first." >&2
  exit 1
fi

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  kill "$(cat "${PID_FILE}")"
  for attempt in $(seq 1 20); do
    kill -0 "$(cat "${PID_FILE}")" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
    kill -9 "$(cat "${PID_FILE}")"
    for attempt in $(seq 1 10); do
      kill -0 "$(cat "${PID_FILE}")" 2>/dev/null || break
      sleep 1
    done
  fi
  if kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
    echo "The fakechain daemon did not stop; refusing to replace its LMDB directory." >&2
    exit 1
  fi
fi
rm -f "${PID_FILE}"
rm -rf "${DATA_DIR}"
mkdir -p "${DATA_DIR}"
cp -a "${SNAPSHOT_DIR}/." "${DATA_DIR}/"
echo "Restored the local regtest chain from the prepared snapshot."
