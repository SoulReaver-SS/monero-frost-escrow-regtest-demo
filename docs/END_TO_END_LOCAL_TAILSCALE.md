# End-to-End Local + Tailscale Operating Guide

**Author:** Manus AI  
**Applies to:** the local FROST 3-of-5 Monero fakechain demonstration only. This is not the hosted template preview.

> Run the coordinator on **Linux** or **WSL2 Ubuntu**. If you use Windows, open an Ubuntu shell in Windows Terminal and keep the repository under your Linux home directory, such as `~/frost-monero-regtest-escrow`, rather than under `/mnt/c`.

The coordinator, `monerod` RPC, and isolated mediator host are loopback-bound. Remote viewing is provided by **Tailscale Serve**, which reverse-proxies the local coordinator to devices permitted by your tailnet policy. Do **not** use Tailscale Funnel for this demonstration.

## 1. One-time host preparation

Install Linux prerequisites and Bun. `setup-regtest.sh` will install any missing `bzip2`, `git`, `curl`, `sha256sum`, and `tar` packages with `apt-get` when available; Bun is the one prerequisite it deliberately does not install.

```bash
sudo apt-get update
sudo apt-get install -y curl git ca-certificates
curl -fsSL https://bun.sh/install | bash
export FROST_BUN_BIN="$HOME/.bun/bin/bun"
"$FROST_BUN_BIN" --version
```

Install a current Node.js LTS release, then confirm it works. The one-command bootstrap automatically activates or installs pnpm in your user account when pnpm is absent; no separate pnpm installation is normally necessary.

```bash
node --version
```

Install and sign in to Tailscale on the **host that will run the coordinator** and the **second computer that will view it**. Bring the host online, then confirm it has a tailnet identity:

```bash
sudo tailscale up
tailscale status
```

## 2. Extract the project and install packages

Copy `frost-monero-regtest-escrow-full-repository.tar.gz` to the Linux or WSL2 host. The evidence archive is optional and is not executable.

```bash
cd ~
tar -xzf frost-monero-regtest-escrow-full-repository.tar.gz
cd frost-monero-regtest-escrow
pnpm install --frozen-lockfile
pnpm test
```

The test command should report the runtime contract and template authentication tests as passing. It verifies code-level behavior; the later workflow steps exercise the actual fakechain.

## Fast path: one command

After Bun, Node.js, pnpm, and (optionally) Tailscale are installed, the bootstrap script performs all project-specific preparation. It installs locked dependencies, starts or verifies the loopback fakechain daemon, creates mediator material only when absent, creates the 1000-block snapshot only when absent, runs the test suite, and then keeps the coordinator in the foreground.

```bash
cd ~/frost-monero-regtest-escrow
chmod +x scripts/run-local-demo.sh
./scripts/run-local-demo.sh --tailscale
```

For the next recording, restore the snapshot and clear only the active coordinator session with:

```bash
./scripts/run-local-demo.sh --reset --tailscale
```

For a dispute-process recording where the mediator needs to remain visible for one minute after signing:

```bash
./scripts/run-local-demo.sh --reset --tailscale --recording-hold 60
```

Run `./scripts/run-local-demo.sh --help` to view the option summary. The script intentionally leaves the coordinator in the foreground; press `Ctrl+C` when you are done. It does not expose the backend on the ordinary LAN.

## 3. First-time fakechain and snapshot preparation

Run these steps **once per new runtime directory**. They download and SHA-256-check Monero CLI v0.18.5.1, start an isolated daemon, create the mediator’s one-time local key material, mine the snapshot baseline, and save that baseline for subsequent resets.

```bash
export FROST_BUN_BIN="$HOME/.bun/bin/bun"

./scripts/setup-regtest.sh
"$FROST_BUN_BIN" run scripts/bootstrap-mediator.ts
"$FROST_BUN_BIN" run scripts/prepare-regtest-snapshot.ts
```

`prepare-regtest-snapshot.ts` mines **exactly 1000 fakechain blocks** only if the chain height is below 1000. The fakechain uses fixed difficulty 1, so mining itself is normally quick; the funding-wallet sync is allowed up to 180 seconds. Treat the full initial operation as taking up to about three minutes.

The daemon runs offline with these meaningful flags:

| Setting | Purpose |
|---|---|
| `--regtest --keep-fakechain --offline` | Uses a local fakechain and never peers with the public Monero network. |
| `--fixed-difficulty 1` | Makes local `generateblocks` practical for a demonstration. |
| `--rpc-bind-ip 127.0.0.1 --rpc-bind-port 18081` | Keeps Monero RPC on loopback. |
| `--p2p-bind-ip 127.0.0.1` | Keeps peer-to-peer traffic on loopback. |

Do not regenerate mediator keys between recordings unless you intentionally discard the runtime directory and rebuild the full setup. The local mediator secret lives outside the project at `~/.local/share/frost-monero-regtest/mediator-secret.json` with restricted permissions.

## 4. Start the local coordinator

Start the coordinator in the same terminal. Leave this terminal running while you use the UI.

```bash
cd ~/frost-monero-regtest-escrow
export FROST_BUN_BIN="$HOME/.bun/bin/bun"
FROST_BUN_PORT=3901 ./scripts/start-local-demo.sh
```

Open this address **on the host** to verify the initial screen:

```text
http://127.0.0.1:3901
```

The current coordinator binds explicitly to `127.0.0.1:3901`; it is not intended to be opened directly on the ordinary LAN.

## 5. Make the UI available only through Tailscale

In a second terminal on the coordinator host, configure Tailscale Serve to proxy its tailnet HTTPS endpoint to the local-only server:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:3901
tailscale serve status
```

`tailscale serve status` prints the URL. From the other Tailscale-connected computer, open the printed HTTPS address, usually:

```text
https://<host-name>.<your-tailnet>.ts.net/
```

Anyone allowed by your Tailscale ACLs to reach that host can operate the local demo UI. This local coordinator has no separate application login, so use a restrictive tailnet ACL if the test session must be limited to particular devices or users.

> Use **Serve**, not **Funnel**. Serve shares the endpoint inside the tailnet; Funnel is the command for public Internet exposure.

## 6. Run the workflow in the UI

Follow the buttons in this order for a normal happy-path recording:

| State | UI action | Result |
|---|---|---|
| `not_initialized` | **Initialize 3-of-5 escrow** | Creates the 3-of-5 DKG material and shared escrow address. |
| `ready` | **Pay into escrow** | Broadcasts the buyer payment and advances fakechain blocks to simulate confirmation. |
| `funding_broadcast` | **Detect confirmed payment** | Seller scans and detects a spendable escrow input. |
| `funded` | **Complete happy-path payout** | Buyer and seller shares settle the escrow. The mediator remains absent. |
| `paid_out` | No more action buttons | Completed transaction summaries and the read-only audit remain visible. |

For a dispute demonstration, stop after **Detect confirmed payment**, expand **Enable dispute mediation**, and select **Start dispute payout & mediator host**. The mediator process starts only then, performs delayed `verify()`, `preprocess()`, and `sign()`, then exits. Its state and PID appear in the mediator pane; the timed live log records the protocol events.

For a recording where the running mediator must stay visible longer, stop the coordinator and start it with this **recording-only** option:

```bash
FROST_MEDIATOR_HOLD_MS=60000 FROST_BUN_PORT=3901 ./scripts/start-local-demo.sh
```

The normal mediator shutdown delay remains 1500 ms. The 60-second setting affects only observation time after its signing response, not the protocol’s signing inputs.

## 7. Read the audit and logs

The UI provides read-only exports for the active session:

| URL | Contents |
|---|---|
| `/audit` | Human-readable audit page. |
| `/audit.json` | Protocol records, DKG results, transaction records, signing data, events, and complete library log. |
| `/audit.txt` | Downloadable plain-text version. |
| `/log` | Timed role-tagged protocol events and errors only. |

The header deliberately shows two distinct measures: **live session age** is wall-clock time since session creation, and **last protocol event** is the elapsed position of the latest logged event. They diverge when the UI is viewed after the workflow has been idle.

## 8. Reset for the next recording

This restores the already-created 1000-block fakechain snapshot. It does **not** call `generateblocks` and does **not** repeat the initial pre-mine.

```bash
cd ~/frost-monero-regtest-escrow
pkill -f 'local-runtime/escrow-service.ts' || true
./scripts/reset-regtest.sh
rm -rf "${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}/escrow-demo"
FROST_BUN_BIN="$HOME/.bun/bin/bun" FROST_BUN_PORT=3901 ./scripts/start-local-demo.sh
```

Refresh the Tailscale URL. You should again see `not_initialized` and only **Initialize 3-of-5 escrow**.

## 9. Stop sharing and shut down

Stop remote access first:

```bash
tailscale serve --https=443 off
```

Then stop the coordinator and, if you are finished with the daemon, stop `monerod` without deleting its snapshot data:

```bash
pkill -f 'local-runtime/escrow-service.ts' || true
RUNTIME_DIR="${FROST_MONERO_RUNTIME_DIR:-$HOME/.local/share/frost-monero-regtest}"
if [ -f "$RUNTIME_DIR/monerod.pid" ]; then
  kill "$(cat "$RUNTIME_DIR/monerod.pid")" || true
fi
```

Keep `~/.local/share/frost-monero-regtest/snapshot-data/` if you want fast resets later. Delete the entire runtime directory only if you intend to rebuild the fakechain baseline and mediator keys from scratch.

## 10. Fast troubleshooting

| Symptom | Check | Resolution |
|---|---|---|
| Page does not load locally | `curl -I http://127.0.0.1:3901/` | Start the coordinator again from the project root. |
| Fakechain is unavailable | `./scripts/setup-regtest.sh` | It checks and starts the loopback daemon. |
| First fund operation complains about a missing snapshot | `"$FROST_BUN_BIN" run scripts/prepare-regtest-snapshot.ts` | Create the one-time 1000-block snapshot. |
| Tailnet device cannot open the UI | `tailscale status` and `tailscale serve status` | Confirm both devices are online, Serve points to `127.0.0.1:3901`, and ACLs allow the connection. |
| Mediator process is too fast to record | Restart with `FROST_MEDIATOR_HOLD_MS=60000` | This is an observation-only delay. |

## References

[1] [Bun HTTP server configuration](https://bun.com/docs/runtime/http/server) — documents explicit `hostname` and `port` binding options.  
[2] [Tailscale Serve CLI reference](https://tailscale.com/docs/reference/tailscale-cli/serve) — documents tailnet-only reverse proxying, HTTPS endpoints, status, and shutdown commands.  
[3] [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) — explains public Internet exposure, which this guide intentionally avoids.
