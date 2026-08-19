# Code-Only Update Overlay

Use a **code-only update overlay** when a release changes the coordinator, local UI, scripts, tests, or documentation but **does not change dependencies**. It exists to avoid deleting a project checkout with a large `node_modules` tree and never touches the separate Monero runtime under `~/.local/share/frost-monero-regtest/`.

> Keep one permanent checkout in your Linux or WSL home directory, such as `~/frost-escrow`. Do not use a synced `/mnt/...` folder as the working checkout.

## What the overlay replaces

| Replaced code | Preserved state |
|---|---|
| `local-runtime/*.ts` coordinator and UI source | `node_modules/` and installed dependencies |
| launch scripts and contract test | fakechain and snapshot data |
| this update guide | mediator key, wallets, SQLite session, and audit files |

The overlay creates a timestamped backup at `.frost-code-update-backups/` inside the permanent checkout. This backup contains only the files that were replaced.

## Apply a future overlay

First stop the coordinator in its own terminal with `Ctrl+C`. Then extract the small update archive anywhere convenient and run its installer against the permanent checkout:

```bash
mkdir -p ~/frost-updates
cd ~/frost-updates
tar -xzf ~/Downloads/frost-monero-regtest-escrow-code-update-<version>.tar.gz
cd frost-monero-regtest-escrow-code-update-<version>
./apply-update.sh ~/frost-escrow

cd ~/frost-escrow
./scripts/run-local-demo.sh --tailscale
```

Use the ordinary reset command only when you want a new recording session:

```bash
./scripts/run-local-demo.sh --reset --tailscale
```

That reset restores the existing 1,000-block snapshot. It does not delete `node_modules`, the permanent checkout, or the downloaded Monero binary.

## When not to use an overlay

If a release changes `package.json`, `pnpm-lock.yaml`, vendored wallet-library files, or the project layout outside the listed overlay files, use the full repository archive and run `pnpm install --frozen-lockfile` once in a new permanent checkout. The overlay deliberately avoids dependencies to keep updates small and predictable.
