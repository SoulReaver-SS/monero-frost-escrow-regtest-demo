import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDkgPublicKey, makeTestKeyPair } from "../vendor/monero-wallet-api/dist/api.js";

const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const secretPath = join(runtimeDir, "mediator-secret.json");
const publicPath = join(runtimeDir, "mediator-public.json");
type MediatorSecret = {
  dkgSecret: string;
  payoutWallet?: { address: string; spendKey: string; viewKey: string };
};

await mkdir(runtimeDir, { recursive: true });
const existing = await readFile(secretPath, "utf8").catch(() => "");
const secret = existing
  ? JSON.parse(existing) as MediatorSecret
  : { dkgSecret: Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString("hex") };

if (!secret.payoutWallet) {
  const wallet = await makeTestKeyPair();
  secret.payoutWallet = {
    address: wallet.view_key.mainnet_primary,
    spendKey: wallet.spend_key,
    viewKey: wallet.view_key.view_key,
  };
}

const dkgSecretBytes = Uint8Array.from(Buffer.from(secret.dkgSecret, "hex"));
await writeFile(secretPath, JSON.stringify(secret), { mode: 0o600 });
await writeFile(publicPath, JSON.stringify({
  dkgPublicKey: await getDkgPublicKey(dkgSecretBytes),
  payoutAddress: secret.payoutWallet.address,
}), { mode: 0o644 });
console.log("Mediator bootstrap complete: setup receives only the mediator DKG public key and public 1% payout address.");
