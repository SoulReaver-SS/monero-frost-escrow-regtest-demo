#!/usr/bin/env bash
set -euo pipefail

# This script never contacts a public Monero node. It starts an isolated fakechain
# node on loopback only and preserves all mutable chain data outside the web project.
RUNTIME_DIR="${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}"
MONERO_VERSION="0.18.5.1"
ARCHIVE_NAME="monero-linux-x64-v${MONERO_VERSION}.tar.bz2"
ARCHIVE_URL="https://downloads.getmonero.org/cli/${ARCHIVE_NAME}"
ARCHIVE_SHA256="22a7dda7b0cb699fdd6b7674c3b4a4465b337cc98a54983523b759e1e7cc9958"
ARCHIVE_DIR="${RUNTIME_DIR}/archives"
EXTRACT_DIR="${RUNTIME_DIR}/monero-${MONERO_VERSION}"
DATA_DIR="${RUNTIME_DIR}/data"
PID_FILE="${RUNTIME_DIR}/monerod.pid"
RPC_URL="http://127.0.0.1:18081/json_rpc"

mkdir -p "${ARCHIVE_DIR}" "${DATA_DIR}"

missing_packages=()
command -v bzip2 >/dev/null || missing_packages+=(bzip2)
command -v git >/dev/null || missing_packages+=(git)
command -v curl >/dev/null || missing_packages+=(curl)
command -v sha256sum >/dev/null || missing_packages+=(coreutils)
command -v tar >/dev/null || missing_packages+=(tar)

if (( ${#missing_packages[@]} > 0 )); then
  command -v apt-get >/dev/null || {
    echo "Missing required packages (${missing_packages[*]}) and apt-get is unavailable." >&2
    exit 1
  }
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends "${missing_packages[@]}" ca-certificates
fi

for dependency in bzip2 git curl sha256sum tar; do
  command -v "${dependency}" >/dev/null || {
    echo "Missing dependency: ${dependency}" >&2
    exit 1
  }
done

archive_path="${ARCHIVE_DIR}/${ARCHIVE_NAME}"
if [[ ! -f "${archive_path}" ]]; then
  curl --fail --location --silent --show-error --output "${archive_path}.partial" "${ARCHIVE_URL}"
  mv "${archive_path}.partial" "${archive_path}"
fi

echo "${ARCHIVE_SHA256}  ${archive_path}" | sha256sum --check --status

if [[ ! -x "${EXTRACT_DIR}/monerod" ]]; then
  rm -rf "${EXTRACT_DIR}"
  mkdir -p "${EXTRACT_DIR}"
  tar --extract --bzip2 --file "${archive_path}" --strip-components=1 --directory "${EXTRACT_DIR}"
fi

if curl --fail --silent --show-error --data '{"jsonrpc":"2.0","id":"health","method":"get_info"}' \
  -H 'Content-Type: application/json' "${RPC_URL}" | grep -Eq '"nettype"[[:space:]]*:[[:space:]]*"fakechain"'; then
  echo "A local regtest daemon is already ready."
  exit 0
fi

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "A monerod process is running but did not confirm fakechain health." >&2
  exit 1
fi

nohup "${EXTRACT_DIR}/monerod" \
  --regtest \
  --keep-fakechain \
  --offline \
  --fixed-difficulty 1 \
  --data-dir "${DATA_DIR}" \
  --rpc-bind-ip 127.0.0.1 \
  --rpc-bind-port 18081 \
  --p2p-bind-ip 127.0.0.1 \
  --no-igd \
  --non-interactive \
  --log-file "${RUNTIME_DIR}/monerod.log" >/dev/null 2>&1 &

pid="$!"
printf '%s\n' "${pid}" > "${PID_FILE}"

for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error --data '{"jsonrpc":"2.0","id":"health","method":"get_info"}' \
    -H 'Content-Type: application/json' "${RPC_URL}" | grep -Eq '"nettype"[[:space:]]*:[[:space:]]*"fakechain"'; then
    echo "Regtest node ready; nettype=fakechain."
    exit 0
  fi
  sleep 1
done

echo "Regtest daemon did not become ready with nettype=fakechain." >&2
exit 1
