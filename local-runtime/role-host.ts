import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  MultiSig,
  MultiSigTxSigner,
  deriveEscrowViewpairCommsSecret,
  escrowViewPairECDHgetPublicKey,
  getDkgMoneroAddress,
  getDkgPublicKey,
  makeTestKeyPair,
  openWallets,
  performEscrowViewPairECDH,
  writeScanSettings,
  writeWalletToScanSettings,
  type DkgVerifyValidResult,
  type ScanSettings,
} from "../vendor/monero-wallet-api/dist/api.js";
import { stringifyDurable } from "./runtime-primitives.js";
import { participantIndexes, type RoleCompletedTransaction, type RoleParticipation, type RolePreprocess, type RolePublicSetup, type RoleSignatureShares, type RoleVerification, type SigningRole } from "./role-protocol.js";

const role = process.env.FROST_ROLE as Exclude<SigningRole, "mediator">;
if (role !== "buyer" && role !== "seller") throw new Error("FROST_ROLE must be buyer or seller.");

const port = Number(process.env.FROST_ROLE_PORT ?? (role === "buyer" ? 3910 : 3911));
const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const roleDir = join(runtimeDir, "role-hosts", role);
const privatePath = join(roleDir, "private.json");
const scanSettingsPath = join(roleDir, "ScanSettings.json");
const fundingWalletPath = join(runtimeDir, "escrow-setup", "funding-wallet.json");
const nodeUrl = "http://127.0.0.1:18081";
const threshold = 3;
const count = 5;
const ownedIndexes = participantIndexes[role];
const participatingIndexes = role === "buyer" ? ownedIndexes : ["3"];

type RolePrivate = {
  role: typeof role;
  dkgSecrets: Record<string, string>;
  viewSecret: string;
  escrowViewSecret?: string;
  merchant?: { address: string; spendKey: string; viewKey: string };
};

type SetupPublicRequest = { };
type ParticipateRequest = { context: string; publicKeys: string[] };
type VerifyRequest = { context: string; publicKeys: string[]; participations: Record<string, string> };
type DeriveAddressRequest = { groupKey: string; peerViewPublicKey: string };
type ScanRequest = { escrowAddress: string; minHeight: number; escrowAmountAtomic: string; cacheNamespace: string };
type FundingRequest = { escrowAddress: string; amountAtomic: string; confirmations: number };
type UnsignedPayoutRequest = { escrowAddress: string; destination: string; mediatorAddress: string; escrowAmountAtomic: string; cacheNamespace: string };
type PreprocessRequest = { roundId: string; unsignedTx: string };
type SignRequest = { roundId: string; preprocesses: Record<string, string> };
type CompleteRequest = { roundId: string; shares: Record<string, string> };
type BroadcastRequest = { escrowAddress: string; signedTx: string; cacheNamespace: string };

const generators = new Map<string, Awaited<ReturnType<typeof MultiSig.createAndSetupGenerators>>>();
const signers = new Map<string, Map<string, MultiSigTxSigner>>();

function json(value: unknown) {
  return stringifyDurable(value);
}

function randomSecretHex() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString("hex");
}

async function loadPrivate() {
  const value = JSON.parse(await readFile(privatePath, "utf8")) as RolePrivate;
  if (value.role !== role) throw new Error(`Role-private file belongs to ${value.role}, not ${role}.`);
  return value;
}

async function savePrivate(value: RolePrivate) {
  await mkdir(roleDir, { recursive: true });
  await writeFile(privatePath, json(value), { mode: 0o600 });
}

async function getOrCreatePrivate() {
  const existing = await readFile(privatePath, "utf8").catch(() => "");
  if (existing) return loadPrivate();
  const privateState: RolePrivate = {
    role,
    dkgSecrets: Object.fromEntries(ownedIndexes.map(index => [index, randomSecretHex()])),
    viewSecret: Buffer.from(await deriveEscrowViewpairCommsSecret(crypto.getRandomValues(new Uint8Array(64)))).toString("hex"),
  };
  if (role === "seller") {
    const merchant = await makeTestKeyPair();
    privateState.merchant = {
      address: merchant.view_key.mainnet_primary,
      spendKey: merchant.spend_key,
      viewKey: merchant.view_key.view_key,
    };
  }
  await savePrivate(privateState);
  return privateState;
}

async function setupPublic(_request: SetupPublicRequest): Promise<RolePublicSetup & { merchantAddress?: string; buyerAddress?: string }> {
  const privateState = await getOrCreatePrivate();
  const publicKeys = await Promise.all(ownedIndexes.map(index => getDkgPublicKey(Uint8Array.from(Buffer.from(privateState.dkgSecrets[index], "hex")))));
  const viewPublicKey = Buffer.from(await escrowViewPairECDHgetPublicKey(Uint8Array.from(Buffer.from(privateState.viewSecret, "hex")))).toString("hex");
  const buyerAddress = role === "buyer"
    ? (JSON.parse(await readFile(fundingWalletPath, "utf8")) as { address: string }).address
    : undefined;
  return { role, publicKeys, viewPublicKey, merchantAddress: privateState.merchant?.address, buyerAddress };
}

async function ensureGenerator(index: string) {
  const existing = generators.get(index);
  if (existing) return existing;
  const generator = await MultiSig.createAndSetupGenerators(threshold, count);
  generators.set(index, generator);
  return generator;
}

async function participate(request: ParticipateRequest): Promise<RoleParticipation> {
  const privateState = await getOrCreatePrivate();
  const participationEntries = await Promise.all(participatingIndexes.map(async index => {
    const generator = await ensureGenerator(index);
    const result = await generator.participate({
      dkg_secret_key: privateState.dkgSecrets[index],
      context: request.context,
      dkg_public_keys: request.publicKeys,
      t: threshold,
    });
    return [index, result.participation] as const;
  }));
  return { role, participations: Object.fromEntries(participationEntries) };
}

async function verify(request: VerifyRequest): Promise<RoleVerification> {
  const privateState = await getOrCreatePrivate();
  const verifies: DkgVerifyValidResult[] = [];
  for (const index of ownedIndexes) {
    const generator = await ensureGenerator(index);
    verifies.push(await generator.verify({
      dkg_secret_key: privateState.dkgSecrets[index],
      context: request.context,
      dkg_public_keys: request.publicKeys,
      participations: request.participations,
      t: threshold,
    }));
  }
  const groupKey = verifies[0]?.group_key;
  if (!groupKey || !verifies.every(result => result.group_key === groupKey && result.threshold_key)) throw new Error(`${role} verification did not derive one valid group key.`);
  await savePrivate({ ...privateState, dkgSecrets: privateState.dkgSecrets });
  return { role, groupKey, participantIndexes: ownedIndexes };
}

async function deriveAddress(request: DeriveAddressRequest) {
  const privateState = await getOrCreatePrivate();
  const viewSecret = await performEscrowViewPairECDH(Uint8Array.from(Buffer.from(privateState.viewSecret, "hex")), Uint8Array.from(Buffer.from(request.peerViewPublicKey, "hex")));
  const address = await getDkgMoneroAddress(request.groupKey, viewSecret);
  await savePrivate({ ...privateState, escrowViewSecret: viewSecret });
  return { role, escrowAddress: address.mainnet_primary };
}

function escrowCacheDir(cacheNamespace: string) {
  if (!/^session-[a-f0-9-]{36}$/.test(cacheNamespace)) throw new Error(`${role} host received an invalid escrow wallet cache namespace.`);
  return join(roleDir, "escrow-wallet-sessions", cacheNamespace);
}

async function writeEscrowScanner(escrowAddress: string, cacheNamespace: string) {
  const privateState = await getOrCreatePrivate();
  if (!privateState.escrowViewSecret) throw new Error(`${role} host has not derived the shared escrow view secret.`);
  Bun.env[`vk${escrowAddress}`] = privateState.escrowViewSecret;
  const settings: ScanSettings = { wallets: [], node_url: nodeUrl, start_height: 1000, logs: "file", logs_include: ["handleCpuboundScan", "atomicWrite", "blocksBufferFetchLoop"] };
  const cacheDir = escrowCacheDir(cacheNamespace);
  const sessionScanSettingsPath = join(cacheDir, "ScanSettings.json");
  await mkdir(cacheDir, { recursive: true });
  await writeScanSettings(settings, sessionScanSettingsPath);
  await writeWalletToScanSettings({ primary_address: escrowAddress, start_height: 1000, wallet_name: "escrow", scan_settings_path: sessionScanSettingsPath });
  return { cacheDir, sessionScanSettingsPath };
}

async function withEscrowWallet<T>(escrowAddress: string, cacheNamespace: string, operation: (wallet: NonNullable<Awaited<ReturnType<typeof openWallets>>["wallets"][number]>) => Promise<T>) {
  const { cacheDir, sessionScanSettingsPath } = await writeEscrowScanner(escrowAddress, cacheNamespace);
  const wallets = await openWallets({ scan_settings_path: sessionScanSettingsPath, pathPrefix: `${cacheDir}/`, no_stats: true });
  try {
    const wallet = wallets.wallets.find(item => item?.wallet_name === "escrow");
    if (!wallet) throw new Error(`${role} host did not open the escrow wallet.`);
    return await operation(wallet);
  } finally {
    wallets.stopWorker();
  }
}

async function scan(request: ScanRequest) {
  return withEscrowWallet(request.escrowAddress, request.cacheNamespace, async wallet => {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      if (wallet.current_height !== null && wallet.current_height !== undefined && wallet.current_height >= request.minHeight - 1) break;
      await Bun.sleep(500);
    }
    const inputs = wallet.spendableInputs();
    const matchingInputs = inputs.filter(input => input.amount === BigInt(request.escrowAmountAtomic));
    return { role, inputCount: matchingInputs.length, currentHeight: wallet.current_height, spendableInputCount: inputs.length, ignoredInputCount: inputs.length - matchingInputs.length };
  });
}

async function fund(request: FundingRequest) {
  if (role !== "buyer") throw new Error("Only the buyer host can fund escrow.");
  const funding = JSON.parse(await readFile(fundingWalletPath, "utf8")) as { address: string; spendKey: string; viewKey: string };
  Bun.env[`sk${funding.address}`] = funding.spendKey;
  Bun.env[`vk${funding.address}`] = funding.viewKey;
  await mkdir(roleDir, { recursive: true });
  await copyFile(join(runtimeDir, "escrow-setup", `${funding.address}_cache.json`), join(roleDir, `${funding.address}_cache.json`));
  const settingsPath = join(roleDir, "BuyerFundingScanSettings.json");
  await writeScanSettings({ wallets: [{ primary_address: funding.address, wallet_name: "buyer" }], node_url: nodeUrl, start_height: 900, logs: "file", logs_include: ["handleCpuboundScan", "atomicWrite", "blocksBufferFetchLoop"] }, settingsPath);
  const wallets = await openWallets({ scan_settings_path: settingsPath, pathPrefix: `${roleDir}/`, no_stats: true });
  try {
    const wallet = wallets.wallets.find(item => item?.wallet_name === "buyer");
    if (!wallet) throw new Error("Buyer host did not open the funding wallet.");
    wallet.decoyRetry = true;
    const unsignedTx = await wallet.makeStandardTransaction(request.escrowAddress, request.amountAtomic);
    const signedTx = await wallet.signTransaction(unsignedTx);
    const result = await wallet.sendTransaction(signedTx);
    if (result.status !== "OK") throw new Error(`Buyer funding transaction was rejected: ${json(result)}`);
    const pool = await fetch(`${nodeUrl}/get_transaction_pool`).then(response => response.json()).catch(() => ({})) as { transactions?: Array<{ id_hash?: string; tx_hash?: string }> };
    const latest = pool.transactions?.at(-1);
    const info = await fetch(`${nodeUrl}/json_rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: json({ jsonrpc: "2.0", id: "get_info", method: "get_info", params: {} }) }).then(response => response.json()) as { result?: { height?: number } };
    await fetch(`${nodeUrl}/json_rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: json({ jsonrpc: "2.0", id: "generateblocks", method: "generateblocks", params: { amount_of_blocks: request.confirmations, wallet_address: funding.address } }) });
    return { role, fundingAddress: funding.address, result, txHash: latest?.id_hash ?? latest?.tx_hash ?? null, observedHeight: info.result?.height ?? null };
  } finally {
    wallets.stopWorker();
  }
}

async function buildTransactionWithDecoyRetry<T>(label: string, build: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await build();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : typeof error === "string" ? error : json(error);
      if (!/failed to sample decoys/i.test(message) || attempt === 6) break;
      await Bun.sleep(attempt * 100);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : typeof lastError === "string" ? lastError : json(lastError);
  throw new Error(`${label} failed after local fakechain decoy retries: ${detail}`);
}

async function createUnsignedPayout(request: UnsignedPayoutRequest) {
  return withEscrowWallet(request.escrowAddress, request.cacheNamespace, async wallet => {
    const info = await fetch(`${nodeUrl}/json_rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: json({ jsonrpc: "2.0", id: "get_info", method: "get_info", params: {} }) }).then(response => response.json()) as { result?: { height?: number } };
    const targetHeight = info.result?.height ?? 0;
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline && (wallet.current_height === null || wallet.current_height === undefined || wallet.current_height < targetHeight - 1)) {
      await Bun.sleep(500);
    }
    wallet.decoyRetry = true;
    const inputs = wallet.spendableInputs();
    if (inputs.length === 0) throw new Error(`${role} host found no spendable escrow input.`);
    const escrowAmount = BigInt(request.escrowAmountAtomic);
    const sessionInputs = inputs.filter(input => input.amount === escrowAmount);
    if (sessionInputs.length !== 1) throw new Error(`${role} host refuses settlement: expected exactly one spendable input matching the persisted escrow amount (${escrowAmount}), found ${sessionInputs.length} among ${inputs.length} spendable input(s).`);
    const grossMediatorFee = escrowAmount / 100n;
    const recipientBeforeNetworkFee = escrowAmount - grossMediatorFee;
    if (grossMediatorFee <= 0n) throw new Error("Mediator fee is zero for this escrow amount.");
    const reservePayments = [
      { address: request.destination, amount: recipientBeforeNetworkFee.toString() },
      { address: request.mediatorAddress, amount: grossMediatorFee.toString() },
    ];
    let networkFee: bigint | undefined;
    let reserveProbeError: string | undefined;
    try {
      await buildTransactionWithDecoyRetry("mediator-fee reserve probe", () => wallet.makeTransaction({ payments: reservePayments, inputs: sessionInputs }));
    } catch (error) {
      const message = error instanceof Error ? error.message : typeof error === "string" ? error : json(error);
      reserveProbeError = message;
      const matched = message.match(/necessary_fee["':\s]+(\d+)/i);
      if (matched?.[1]) networkFee = BigInt(matched[1]);
    }
    if (networkFee === undefined) throw new Error(`${role} host could not measure the actual network fee needed for the two-output settlement. Reserve probe: ${reserveProbeError ?? "no error detail returned"}`);
    let unsignedTx: string | undefined;
    let recipientAmount: bigint | undefined;
    for (let resolutionAttempt = 1; resolutionAttempt <= 4; resolutionAttempt += 1) {
      if (networkFee >= recipientBeforeNetworkFee) throw new Error(`${role} host refuses settlement: the actual network fee (${networkFee}) would consume the settlement recipient output (${recipientBeforeNetworkFee}).`);
      recipientAmount = recipientBeforeNetworkFee - networkFee;
      const payments = [
        { address: request.destination, amount: recipientAmount.toString() },
        { address: request.mediatorAddress, amount: grossMediatorFee.toString() },
      ];
      try {
        unsignedTx = await buildTransactionWithDecoyRetry("mediator-fee settlement", () => wallet.makeTransaction({ payments, inputs: sessionInputs }));
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : json(error);
        const matched = message.match(/necessary_fee["':\s]+(\d+)/i);
        const nextFee = matched?.[1] ? BigInt(matched[1]) : undefined;
        if (!nextFee || nextFee <= networkFee || resolutionAttempt === 4) throw error;
        networkFee = nextFee;
      }
    }
    if (!unsignedTx || recipientAmount === undefined) throw new Error(`${role} host could not finalize the two-output settlement fee allocation.`);
    return {
      role,
      unsignedTx,
      inputCount: sessionInputs.length,
      ignoredInputCount: inputs.length - sessionInputs.length,
      feeSplit: {
        policy: "1% of the persisted escrow amount to mediator; fakechain network fee deducted from settlement recipient output",
        escrow_amount_atomic: escrowAmount.toString(),
        recipient_address: request.destination,
        recipient_before_network_fee_atomic: recipientBeforeNetworkFee.toString(),
        recipient_amount_atomic: recipientAmount.toString(),
        mediator_payout_address: request.mediatorAddress,
        mediator_gross_fee_atomic: grossMediatorFee.toString(),
        network_fee_atomic: networkFee.toString(),
        mediator_amount_atomic: grossMediatorFee.toString(),
        network_fee_payer: "settlement_recipient",
      },
    };
  });
}

async function preprocess(request: PreprocessRequest): Promise<RolePreprocess> {
  const privateState = await getOrCreatePrivate();
  const roleSigners = new Map<string, MultiSigTxSigner>();
  const entries = await Promise.all(ownedIndexes.map(async index => {
    const signer = await MultiSigTxSigner.create();
    roleSigners.set(index, signer);
    const thresholdKey = await deriveThresholdKey(privateState, index);
    return [index, signer.preprocess({ threshold_key: thresholdKey, unsigned_tx: request.unsignedTx }).preprocess] as const;
  }));
  signers.set(request.roundId, roleSigners);
  return { role, roundId: request.roundId, preprocesses: Object.fromEntries(entries) };
}

async function deriveThresholdKey(privateState: RolePrivate, index: string) {
  const statePath = join(roleDir, "verified-context.json");
  const stored = JSON.parse(await readFile(statePath, "utf8")) as VerifyRequest;
  const generator = await ensureGenerator(index);
  const result = await generator.verify({
    dkg_secret_key: privateState.dkgSecrets[index],
    context: stored.context,
    dkg_public_keys: stored.publicKeys,
    participations: stored.participations,
    t: threshold,
  });
  if (!result.threshold_key) throw new Error(`${role} host could not derive threshold key for ${index}.`);
  return result.threshold_key;
}

async function persistVerifyContext(request: VerifyRequest) {
  await mkdir(roleDir, { recursive: true });
  await writeFile(join(roleDir, "verified-context.json"), json(request), { mode: 0o600 });
}

async function sign(request: SignRequest): Promise<RoleSignatureShares> {
  const roleSigners = signers.get(request.roundId);
  if (!roleSigners) throw new Error(`${role} host has no retained signer state for round ${request.roundId}.`);
  const shares = Object.fromEntries([...roleSigners.entries()].map(([index, signer]) => [index, signer.sign({ preprocesses: request.preprocesses }).share]));
  return { role, roundId: request.roundId, shares };
}

async function complete(request: CompleteRequest): Promise<RoleCompletedTransaction> {
  const roleSigners = signers.get(request.roundId);
  if (!roleSigners) throw new Error(`${role} host has no retained signer state for round ${request.roundId}.`);
  const [ownerIndex, owner] = [...roleSigners.entries()][0] ?? [];
  if (!owner || !ownerIndex) throw new Error(`${role} host has no completion signer for round ${request.roundId}.`);
  const otherShares = Object.fromEntries(Object.entries(request.shares).filter(([index]) => index !== ownerIndex));
  const completed = owner.complete({ shares: otherShares });
  return { role, roundId: request.roundId, signedTx: completed.signed_tx };
}

async function broadcast(request: BroadcastRequest) {
  return withEscrowWallet(request.escrowAddress, request.cacheNamespace, async wallet => {
    const result = await wallet.sendTransaction(request.signedTx);
    if (result.status !== "OK") throw new Error(`${role} host broadcast was rejected: ${json(result)}`);
    const pool = await fetch(`${nodeUrl}/get_transaction_pool`).then(response => response.json()).catch(() => ({})) as { transactions?: Array<{ id_hash?: string; tx_hash?: string }> };
    const latest = pool.transactions?.at(-1);
    signers.clear();
    return { role, result, txHash: latest?.id_hash ?? latest?.tx_hash ?? null };
  });
}

async function backup() {
  const privateState = await getOrCreatePrivate();
  return {
    format: "frost-backup-v2-role-host",
    role,
    exported_at: new Date().toISOString(),
    threshold: { required: threshold, participants: count, role_shares: ownedIndexes.length },
    private_signing_material: { dkg_secrets: privateState.dkgSecrets, view_secret: privateState.viewSecret, merchant: privateState.merchant ?? null },
    restore_note: `Restore this ${role} material only in the ${role} role host or browser-local signer client.`,
  };
}

async function handler(request: Request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return Response.json({ role, pid: process.pid, connected: true, shares: ownedIndexes });
  if (request.method !== "POST") return new Response("Not found", { status: 404 });
  try {
    const body = await request.json().catch(() => ({}));
    const response = url.pathname === "/setup/public" ? await setupPublic(body as SetupPublicRequest)
      : url.pathname === "/setup/participate" ? await participate(body as ParticipateRequest)
      : url.pathname === "/setup/verify" ? (await persistVerifyContext(body as VerifyRequest), await verify(body as VerifyRequest))
      : url.pathname === "/setup/address" ? await deriveAddress(body as DeriveAddressRequest)
      : url.pathname === "/wallet/fund" ? await fund(body as FundingRequest)
      : url.pathname === "/wallet/scan" ? await scan(body as ScanRequest)
      : url.pathname === "/wallet/unsigned-payout" ? await createUnsignedPayout(body as UnsignedPayoutRequest)
      : url.pathname === "/round/preprocess" ? await preprocess(body as PreprocessRequest)
      : url.pathname === "/round/sign" ? await sign(body as SignRequest)
      : url.pathname === "/round/complete" ? await complete(body as CompleteRequest)
      : url.pathname === "/wallet/broadcast" ? await broadcast(body as BroadcastRequest)
      : url.pathname === "/backup" ? await backup()
      : undefined;
    if (!response) return new Response("Not found", { status: 404 });
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

Bun.serve({ hostname: "127.0.0.1", port, fetch: handler });
