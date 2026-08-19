# Local Recording Runbook

This runbook resets the local FROST escrow demonstration to its initial screen without recreating the fakechain. It restores the already prepared **1000-block** LMDB snapshot, starts the loopback fakechain daemon, removes only the coordinator’s SQLite/session directory, and starts the local Bun service.

> The reset does **not** call `generateblocks` and does **not** re-mine the 1000-block baseline. The initial snapshot creation is the only step that seeds those blocks; it normally takes seconds for fixed-difficulty fakechain block generation plus a wallet scan bounded at 180 seconds.

## Normal recording reset

Run the following from the repository root:

```bash
pkill -f 'local-runtime/escrow-service.ts' || true
./scripts/reset-regtest.sh
./scripts/setup-regtest.sh
rm -rf "${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}/escrow-demo"
FROST_BUN_PORT=3901 ./scripts/start-local-demo.sh
```

Open `http://127.0.0.1:3901`. The page will show **not_initialized** and only the **Initialize 3-of-5 escrow** action is live.

| Recording state | Action that produces it |
|---|---|
| Initial | Finish the reset sequence above. |
| Ready | Select **Initialize 3-of-5 escrow**. |
| Funding broadcast | Select **Pay into escrow**. This action uses fakechain `generateblocks` to simulate confirmation. |
| Funded | Select **Detect confirmed payment**. |
| Happy completion | Select **Complete happy-path payout**. |
| Dispute completion | Expand **Enable dispute mediation**, then select **Start dispute payout & mediator host**. |

## Optional active-mediator capture

Normal dispute behavior holds the isolated mediator host for 1500 ms after signing. For a recording only, keep the **real** host alive longer after it has produced the delayed verification, preprocess, and signature share:

```bash
FROST_MEDIATOR_HOLD_MS=60000 FROST_BUN_PORT=3901 ./scripts/start-local-demo.sh
```

The 60-second value changes observation time only. The normal default remains 1500 ms. While the dispute request is in progress, refresh the coordinator page to capture the mediator card showing **running** and its PID; the timed log exposes the delayed `verify()`, `preprocess()`, and `sign()` events.
