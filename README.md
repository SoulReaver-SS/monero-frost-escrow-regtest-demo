# FROST 3-of-5 Monero Escrow Regtest Demo

This is an **unaudited, agent-assisted, local-only demonstration** of a 3-of-5 FROST Monero escrow workflow. It uses a loopback-only Monero fakechain/regtest daemon, real wallet-library FROST operations, isolated buyer/seller signer hosts, a delayed mediator signer for recovery, and local Bun SQLite persistence.

> **Do not use this software, its wallets, FROST files, private keys, or recovery procedure with real funds.** It is an educational demo, not a security audit, production escrow service, or legal escrow arrangement.

The local UI is served at `http://127.0.0.1:3901`.
## Recorded demonstrations

These are full-resolution screen recordings of real local fakechain runs. Select a poster to play or download the original-quality recording from the public release.

### 1. Happy-path buyer/seller settlement

<a href="https://github.com/SoulReaver-SS/monero-frost-escrow-regtest-demo/releases/download/demo-recordings/happy-path-buyer-seller-settlement.mp4">
  <img src="https://github.com/SoulReaver-SS/monero-frost-escrow-regtest-demo/releases/download/demo-recordings/happy-path-buyer-seller-poster.webp" alt="Happy-path buyer and seller FROST settlement recording" width="100%">
</a>

Buyer and seller establish the shared address, fund it, detect funding, and complete a four-share settlement while the mediator stays absent. [Open the original-quality MP4 (135 MB)](https://github.com/SoulReaver-SS/monero-frost-escrow-regtest-demo/releases/download/demo-recordings/happy-path-buyer-seller-settlement.mp4).

### 2. Escrow recovery with mediator

<a href="https://github.com/SoulReaver-SS/monero-frost-escrow-regtest-demo/releases/download/demo-recordings/escrow-recovery-with-mediator.mp4">
  <img src="https://github.com/SoulReaver-SS/monero-frost-escrow-regtest-demo/releases/download/demo-recordings/escrow-recovery-with-mediator-poster.webp" alt="Escrow recovery with mediator FROST settlement recording" width="100%">
</a>

The shared address is funded, disagreement makes recovery eligible, and the mediator joins the selected counterparty for the three-share recovery settlement. [Open the original-quality MP4 (190 MB)](https://github.com/SoulReaver-SS/monero-frost-escrow-regtest-demo/releases/download/demo-recordings/escrow-recovery-with-mediator.mp4).

## What the demo shows

| Feature | Demonstration behavior |
|---|---|
| Threshold | **3 of 5** shares: buyer 1–2, seller 3–4, mediator 5. |
| Normal agreement | Buyer and seller contribute four shares; the mediator process does not start. |
| Recovery | An eligible mediator ruling starts a short-lived loopback mediator process; the selected buyer or seller then contributes two shares for 3-of-5. |
| Funding | A cryptographically selected local test amount between 0.5 and 10 XMR is paid into the shared fakechain escrow address. |
| Fee policy | A **fixed 1%** mediator output is created for every settlement. The transaction network fee is taken from the settlement recipient output—seller on a release, buyer on a refund. |
| Evidence | The audit and `/verify` endpoints expose public fakechain transaction evidence and daemon observation state. |

Mutable chain, wallet, session, scanner-cache, SQLite, and FROST role material live outside this repository by default:

```text
~/.local/share/frost-monero-regtest/
├── data/                 # live fakechain LMDB data
├── snapshot-data/        # reusable 1000-block baseline
├── escrow-setup/         # local funding wallet and snapshot metadata
├── escrow-demo/          # coordinator SQLite session state
├── role-hosts/           # local buyer/seller signer material and scanner caches
├── mediator-secret.json  # local mediator private DKG material
└── mediator-public.json  # corresponding public setup material
```

Keep that directory private. Set `FROST_MONERO_RUNTIME_DIR` if you need it in another local path.

## Prerequisites

Use Linux or WSL2 on x86-64. You need Bun 1.3.x, Node.js, pnpm, `curl`, `tar`, and `bzip2`. The scripts download Monero **v0.18.5.1** only once, verify its SHA-256, and keep it under the local runtime directory.

```bash
git clone https://github.com/OWNER/frost-monero-regtest-escrow.git
cd frost-monero-regtest-escrow

# Bun must be available. The launcher also checks FROST_BUN_BIN and ~/.bun/bin/bun.
bun --version
node --version
pnpm --version

pnpm install --frozen-lockfile
pnpm build
```

## Quick start

The normal launcher installs JavaScript dependencies, starts/validates the fakechain daemon, creates mediator public material and the one-time snapshot when absent, runs the regression tests, then starts the coordinator in the foreground.

```bash
./scripts/run-local-demo.sh
# Open http://127.0.0.1:3901
```

Press `Ctrl+C` to stop only the coordinator. The fakechain and reusable snapshot remain local for the next run.

## Exact fakechain daemon configuration

`scripts/setup-regtest.sh` starts `monerod` with the following effective flags:

```text
--regtest
--keep-fakechain
--offline
--fixed-difficulty 1
--data-dir ~/.local/share/frost-monero-regtest/data
--rpc-bind-ip 127.0.0.1
--rpc-bind-port 18081
--p2p-bind-ip 127.0.0.1
--no-igd
--non-interactive
--log-file ~/.local/share/frost-monero-regtest/monerod.log
```

The node never intentionally contacts a public Monero node. Confirm the local chain before running a session:

```bash
curl --fail --silent \
  --data '{"jsonrpc":"2.0","id":"health","method":"get_info"}' \
  -H 'Content-Type: application/json' \
  http://127.0.0.1:18081/json_rpc
# Expect: "nettype": "fakechain" and "offline": true
```

## The 1000-block setup snapshot

On the first run, `scripts/prepare-regtest-snapshot.ts` mines exactly `1000 - currentHeight` blocks. From a new fakechain at height zero, that is **exactly 1000 blocks**. The blocks provide test-wallet maturity and a decoy population; they do not model real Monero time or economics.

At fixed fakechain difficulty, block generation itself normally takes seconds. Allow **up to about three minutes** for the full first preparation because wallet scan synchronization has a 180-second guard. Later reset runs restore the snapshot instead of mining the 1000 blocks again.

To prepare manually instead of using the all-in-one launcher:

```bash
./scripts/setup-regtest.sh
"${FROST_BUN_BIN:-$(command -v bun)}" run scripts/bootstrap-mediator.ts
"${FROST_BUN_BIN:-$(command -v bun)}" run scripts/prepare-regtest-snapshot.ts
FROST_BUN_PORT=3901 ./scripts/start-local-demo.sh
```

## Reset a recording session

This restores the prepared 1000-block baseline, clears only the active coordinator session and disposable escrow-wallet scanner caches, restarts the fakechain daemon, reruns tests, and launches a new local UI:

```bash
./scripts/run-local-demo.sh --reset
```

It does **not** deliberately delete buyer/seller role-private setup data, mediator material, or previously downloaded `.frost` backups. To relocate or erase those local artifacts, remove the runtime directory yourself only after understanding that it contains private test material.

## Normal and dispute paths

After **Initialize 3-of-5 escrow**, click **Pay into escrow**. The demo advances fakechain confirmation blocks itself, then shows the funding state automatically. No manual seller “verification” step is needed.

For a normal release, buyer and seller each click **Sign release to seller**. Their isolated role hosts then automatically run the real preprocess, signing, completion, and broadcast relay. The mediator host remains absent.

To demonstrate a dispute, after funding have the buyer and seller choose **different** outcomes—for example, buyer signs refund while seller signs release. The disagreement immediately makes mediator recovery eligible. The mediator chooses **release to seller** or **refund to buyer**, which is the mediator’s final consent. Only the selected buyer or seller then clicks the one required outcome-specific signing action. The mediator process starts only for this recovery signing round and exits afterward.

For a recording of the running mediator host, use:

```bash
./scripts/run-local-demo.sh --reset --recording-hold 60
```

## Wallet API vendoring note

The runtime imports `vendor/monero-wallet-api/dist/api.js`. This prebuilt `dist/` tree is intentionally committed because the upstream tests and local runtime import `../../dist/api`; a clean clone that lacks it cannot run the wallet code.

If a source export, sparse checkout, or manual copy omits that directory, restore it before running the demo:

```bash
test -f vendor/monero-wallet-api/dist/api.js || pnpm vendor:wallet-api
```

The helper downloads `@spirobel/monero-wallet-api` with lifecycle scripts disabled and copies only its prebuilt distribution. Review the package version in `vendor/monero-wallet-api/VERSION` before changing it.

## Regtest decoys and tests

`decoyRetry = true` must be set on **both** the buyer funding wallet and the escrow payout wallet. Setting it only on the wallet that funds escrow does not fix a payout construction failure; the role-host payout wallet also sets it before creating the two-output settlement.

```bash
pnpm check
pnpm test
# equivalent combined verification
pnpm build
```

The tests are contract and local-persistence checks. They are not a cryptographic audit or a security guarantee.

## Public repository hygiene

The repository intentionally ignores `.project-config.json`, all `.env` variants, SQLite files, `.frost` backups, role-host material, mediator secrets, snapshots, fakechain LMDB directories, scanner settings, and relay logs. Do not force-add any of these files to a public fork.

## Important limitations

The UI and local audit expose public demonstration evidence, but never reveal FROST shares, wallet spend keys, wallet view keys, participation values, preprocessing values, or mediator private material. Buyer and seller material is still held by local signer processes on one machine for this demonstration; production software would keep each role’s secrets on separately controlled client devices.
