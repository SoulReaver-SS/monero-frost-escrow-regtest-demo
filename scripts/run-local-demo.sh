#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}"
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
PORT="${FROST_BUN_PORT:-3901}"
DEPENDENCY_ROOT="${FROST_DEPENDENCY_ROOT:-$PROJECT_ROOT}"
VITEST_BIN="${FROST_VITEST_BIN:-}"
RESET=0
TAILSCALE=0
RECORDING_HOLD=""
CHECK_PREREQS=0

usage() {
  cat <<'EOF'
Usage: ./scripts/run-local-demo.sh [options]

One foreground command for the local FROST Monero fakechain demo.

Options:
  --reset                 Restore the prepared 1000-block snapshot and clear only the active coordinator session.
  --tailscale             Configure Tailscale Serve HTTPS to proxy to 127.0.0.1:3901 before starting.
  --recording-hold SECS   Keep the real dispute-only mediator host alive this many seconds after it signs.
  --check-prereqs         Verify Bun, Node.js, and pnpm setup only; do not install project packages or start services.
  --help                  Show this help.

The command installs Node project dependencies, verifies the fakechain daemon,
creates the mediator key and 1000-block snapshot if absent, runs tests, then
starts the coordinator in the foreground. Ctrl+C stops the coordinator only.
EOF
}

while (($#)); do
  case "$1" in
    --reset) RESET=1 ;;
    --tailscale) TAILSCALE=1 ;;
    --check-prereqs) CHECK_PREREQS=1 ;;
    --recording-hold)
      shift
      [[ "${1:-}" =~ ^[0-9]+$ ]] && (( $1 > 0 )) || { echo "--recording-hold requires a positive integer number of seconds." >&2; exit 2; }
      RECORDING_HOLD="$1"
      ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

test -n "$BUN_BIN" && test -x "$BUN_BIN" || {
  cat >&2 <<EOF
Bun was not found. Install it with:
  curl -fsSL https://bun.sh/install | bash
Then either open a new terminal or run:
  export FROST_BUN_BIN="$HOME/.bun/bin/bun"
EOF
  cat >&2 <<'EOF'
The bootstrap checks, in order: FROST_BUN_BIN, ~/.bun/bin/bun, bun on PATH, and the legacy development path.
EOF
  exit 1
}

command -v node >/dev/null || {
  cat >&2 <<'EOF'
Node.js is required to run pnpm. Install a current Node LTS release, then rerun this command:
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  source "$HOME/.nvm/nvm.sh"
  nvm install --lts
EOF
  exit 1
}

if command -v pnpm >/dev/null 2>&1; then
  PNPM_BIN="$(command -v pnpm)"
elif command -v corepack >/dev/null 2>&1; then
  echo "[bootstrap] Activating pnpm through Corepack …"
  corepack enable pnpm
  PNPM_BIN="$(command -v pnpm)"
else
  echo "[bootstrap] Installing pnpm in $HOME/.local (no sudo required) …"
  npm install --global --prefix "$HOME/.local" pnpm
  PNPM_BIN="$HOME/.local/bin/pnpm"
fi
test -x "$PNPM_BIN" || { echo "pnpm installation did not produce an executable. Ensure Node.js and npm are installed, then retry." >&2; exit 1; }

if (( CHECK_PREREQS )); then
  printf 'Bootstrap prerequisites ready: bun=%s node=%s pnpm=%s\n' "$BUN_BIN" "$(command -v node)" "$PNPM_BIN"
  exit 0
fi

cd "$PROJECT_ROOT"
echo "[bootstrap] Installing verified Node dependencies …"
if [[ "$DEPENDENCY_ROOT" != "$PROJECT_ROOT" ]]; then
  [[ -f "$DEPENDENCY_ROOT/package.json" && -f "$DEPENDENCY_ROOT/pnpm-lock.yaml" ]] || { echo "Modular dependency root is missing package.json or pnpm-lock.yaml: $DEPENDENCY_ROOT" >&2; exit 1; }
  (cd "$DEPENDENCY_ROOT" && "$PNPM_BIN" install --frozen-lockfile)
else
  "$PNPM_BIN" install --frozen-lockfile
fi

echo "[bootstrap] Ensuring isolated loopback fakechain daemon …"
./scripts/setup-regtest.sh

echo "[bootstrap] Ensuring one-time local mediator DKG material and public fee destination …"
"$BUN_BIN" run ./scripts/bootstrap-mediator.ts

SNAPSHOT="$RUNTIME_DIR/snapshot-data/fake/lmdb/data.mdb"
if [[ ! -f "$SNAPSHOT" ]]; then
  echo "[bootstrap] Creating the one-time 1000-block fakechain snapshot …"
  "$BUN_BIN" run ./scripts/prepare-regtest-snapshot.ts
fi

if (( RESET )); then
  echo "[bootstrap] Restoring the 1000-block snapshot and clearing the active session plus disposable role-host escrow scan caches …"
  ./scripts/reset-regtest.sh
  rm -rf "$RUNTIME_DIR/escrow-demo"
  rm -rf "$RUNTIME_DIR/role-hosts/buyer/escrow-wallet-sessions" "$RUNTIME_DIR/role-hosts/seller/escrow-wallet-sessions"
  echo "[bootstrap] Restarting the restored loopback fakechain daemon …"
  ./scripts/setup-regtest.sh
fi

echo "[bootstrap] Running local regression checks …"
if [[ -n "$VITEST_BIN" ]]; then
  [[ -x "$VITEST_BIN" ]] || { echo "Modular Vitest executable is missing after dependency installation: $VITEST_BIN" >&2; exit 1; }
  "$VITEST_BIN" run
else
  "$PNPM_BIN" test
fi

if (( TAILSCALE )); then
  command -v tailscale >/dev/null || { echo "Tailscale CLI is required for --tailscale." >&2; exit 1; }
  echo "[bootstrap] Configuring tailnet-only HTTPS reverse proxy …"
  tailscale serve --bg --https=443 "http://127.0.0.1:${PORT}"
  tailscale serve status
fi

echo
echo "Coordinator UI (host): http://127.0.0.1:${PORT}"
if (( TAILSCALE )); then
  echo "Remote tailnet URL: shown above by 'tailscale serve status'."
fi
echo "Press Ctrl+C to stop the coordinator. The fakechain daemon and prepared snapshot remain available for later resets."
echo

if [[ -n "$RECORDING_HOLD" ]]; then
  exec env FROST_BUN_BIN="$BUN_BIN" FROST_BUN_PORT="$PORT" FROST_MEDIATOR_HOLD_MS="$(( RECORDING_HOLD * 1000 ))" ./scripts/start-local-demo.sh
fi
exec env FROST_BUN_BIN="$BUN_BIN" FROST_BUN_PORT="$PORT" ./scripts/start-local-demo.sh
