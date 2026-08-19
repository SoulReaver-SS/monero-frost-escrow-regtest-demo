import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DistributedKeyGenerator,
  MultiSigTxSigner,
  getDkgPublicKey,
  type DkgVerifyValidResult,
} from "../vendor/monero-wallet-api/dist/api.js";

type SignRequest = {
  publicKeys: string[];
  context: string;
  participations: Record<string, string>;
  unsignedTx: string;
  signerPreprocesses: Record<string, string>;
};

type BackupRequest = {
  sessionId: string;
  escrowAddress: string;
  groupKey: string;
  publicKeys: string[];
  context: string;
  participations: Record<string, string>;
};

const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const port = Number(process.env.FROST_MEDIATOR_PORT ?? 3912);
const mediatorSecretPath = join(runtimeDir, "mediator-secret.json");
const shutdownDelayMs = Number(process.env.FROST_MEDIATOR_HOLD_MS ?? "1500");

async function sign(request: SignRequest) {
  const mediatorSecret = JSON.parse(await readFile(mediatorSecretPath, "utf8")) as { dkgSecret: string };
  const mediatorPublicKey = await getDkgPublicKey(Uint8Array.from(Buffer.from(mediatorSecret.dkgSecret, "hex")));
  if (mediatorPublicKey !== request.publicKeys[4]) throw new Error("Mediator secret does not match the fifth persisted DKG public key.");
  const dkg = await DistributedKeyGenerator.createAndSetupGenerators(3, 5);
  const verify = dkg.verify({
    dkg_secret_key: mediatorSecret.dkgSecret,
    context: request.context,
    dkg_public_keys: request.publicKeys,
    participations: request.participations,
    t: 3,
  }) as DkgVerifyValidResult;
  if (!verify.threshold_key || !verify.group_key) throw new Error(`Mediator delayed verify() did not return a threshold key: ${JSON.stringify(verify)}`);
  const signer = await MultiSigTxSigner.create();
  const preprocess = signer.preprocess({ threshold_key: verify.threshold_key, unsigned_tx: request.unsignedTx }).preprocess;
  const share = signer.sign({ preprocesses: { ...request.signerPreprocesses, [String(verify.i)]: preprocess } }).share;
  return { participant: String(verify.i), preprocess, share, verify };
}

async function backup(request: BackupRequest) {
  const mediatorSecret = JSON.parse(await readFile(mediatorSecretPath, "utf8")) as { dkgSecret: string };
  const mediatorPublicKey = await getDkgPublicKey(Uint8Array.from(Buffer.from(mediatorSecret.dkgSecret, "hex")));
  if (mediatorPublicKey !== request.publicKeys[4]) throw new Error("Mediator secret does not match the fifth persisted DKG public key.");
  return {
    format: "frost-backup-v1",
    role: "mediator",
    exported_at: new Date().toISOString(),
    session_id: request.sessionId,
    threshold: { required: 3, participants: 5, role_shares: 1 },
    private_signing_material: { mediator_dkg_secret: mediatorSecret.dkgSecret },
    public_context: {
      escrow_address: request.escrowAddress,
      group_key: request.groupKey,
      dkg_public_keys: request.publicKeys,
      context: request.context,
      participations: request.participations,
    },
    restore_note: "Restore this mediator FROST backup only with the local mediator recovery tooling, then perform delayed verify() before signing a dispute outcome.",
  };
}

let server: ReturnType<typeof Bun.serve>;
server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "running", pid: process.pid });
    }
    if (request.method !== "POST" || !["/sign", "/backup"].includes(url.pathname)) return new Response("Not found", { status: 404 });
    try {
      const requestBody = await request.json();
      const response = url.pathname === "/sign"
        ? await sign(requestBody as SignRequest)
        : await backup(requestBody as BackupRequest);
      setTimeout(() => {
        server.stop(true);
        process.exit(0);
      }, shutdownDelayMs);
      return Response.json(response);
    } catch (error) {
      setTimeout(() => {
        server.stop(true);
        process.exit(1);
      }, shutdownDelayMs);
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  },
});
