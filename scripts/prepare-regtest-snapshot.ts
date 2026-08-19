import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  makeTestKeyPair,
  openWallets,
  writeScanSettings,
  type ScanSettings,
} from "../vendor/monero-wallet-api/dist/api.js";

const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const setupDir = join(runtimeDir, "escrow-setup");
const scanSettingsPath = join(setupDir, "ScanSettings.json");
const keypairsPath = join(setupDir, "funding-wallet.json");
const nodeUrl = "http://127.0.0.1:18081";
const totalBlocks = 1000;

type JsonRpcResult<T> = { result?: T; error?: unknown };

async function rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${nodeUrl}/json_rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
  });
  if (!response.ok) throw new Error(`${method} RPC returned ${response.status}`);
  const payload = (await response.json()) as JsonRpcResult<T>;
  if (payload.error) throw new Error(`${method} RPC error: ${JSON.stringify(payload.error)}`);
  if (!payload.result) throw new Error(`${method} RPC response had no result`);
  return payload.result;
}

async function waitForFakechain(): Promise<void> {
  for (let retry = 0; retry < 60; retry += 1) {
    try {
      const info = await rpc<{ nettype?: string }>("get_info");
      if (info.nettype === "fakechain") return;
    } catch {
      // The caller receives a bounded timeout error below.
    }
    await Bun.sleep(500);
  }
  throw new Error("Local regtest node did not report nettype=fakechain");
}

async function loadOrCreateFundingWallet() {
  try {
    return JSON.parse(await readFile(keypairsPath, "utf8")) as {
      address: string;
      spendKey: string;
      viewKey: string;
    };
  } catch {
    const keypair = await makeTestKeyPair();
    const result = {
      address: keypair.view_key.mainnet_primary,
      spendKey: keypair.spend_key,
      viewKey: keypair.view_key.view_key,
    };
    await writeFile(keypairsPath, JSON.stringify(result, null, 2), { mode: 0o600 });
    return result;
  }
}

async function main() {
  await waitForFakechain();
  await mkdir(setupDir, { recursive: true });

  const fundingWallet = await loadOrCreateFundingWallet();
  Bun.env[`sk${fundingWallet.address}`] = fundingWallet.spendKey;
  Bun.env[`vk${fundingWallet.address}`] = fundingWallet.viewKey;

  const settings: ScanSettings = {
    wallets: [{ primary_address: fundingWallet.address, wallet_name: "buyer-funding" }],
    node_url: nodeUrl,
    start_height: 0,
    logs: "file",
    logs_include: ["handleCpuboundScan", "atomicWrite", "blocksBufferFetchLoop"],
  };
  await writeScanSettings(settings, scanSettingsPath);

  const info = await rpc<{ height: number }>("get_info");
  if (info.height < totalBlocks) {
    await rpc("generateblocks", {
      amount_of_blocks: totalBlocks - info.height,
      wallet_address: fundingWallet.address,
    });
  }

  let syncedResolve: (() => void) | undefined;
  const synced = new Promise<void>((resolve) => {
    syncedResolve = resolve;
  });
  const wallets = await openWallets({
    scan_settings_path: scanSettingsPath,
    pathPrefix: `${setupDir}/`,
    no_stats: true,
    notifyMasterChanged: async (params) => {
      const latest = params.newCache.scanned_ranges.at(-1);
      if (latest && latest.end >= totalBlocks - 1 && syncedResolve) syncedResolve();
    },
  });

  if (wallets.current_height !== null && wallets.current_height >= totalBlocks - 1 && syncedResolve) {
    syncedResolve();
  }

  await Promise.race([
    synced,
    Bun.sleep(180_000).then(() => {
      throw new Error("Funding wallet scan did not reach the snapshot height");
    }),
  ]);
  wallets.stopWorker();

  if (process.env.FROST_SKIP_SNAPSHOT !== "1") {
    const projectRoot = join(import.meta.dir, "..");
    const snapshot = Bun.spawn(["bash", join(projectRoot, "scripts", "snapshot-regtest-data.sh")], { stdout: "inherit", stderr: "inherit" });
    const snapshotExitCode = await snapshot.exited;
    if (snapshotExitCode !== 0) throw new Error("Failed to create a consistent fakechain snapshot.");
  }
  await writeFile(
    join(setupDir, "snapshot-manifest.json"),
    JSON.stringify({ address: fundingWallet.address, blocks: totalBlocks, createdAt: new Date().toISOString() }, null, 2),
  );
  console.log(JSON.stringify({ ready: true, address: fundingWallet.address, blocks: totalBlocks }));
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
