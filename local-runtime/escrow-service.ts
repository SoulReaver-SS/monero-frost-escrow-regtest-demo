import { Database } from "bun:sqlite";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MediatorProcessTracker, availableActions, cryptographicRandomAtomicInclusive, elapsedLabel, normalizeRealLogs, parseDurable, renderActionForms, stringifyDurable } from "./runtime-primitives.js";
import type { EscrowStatus } from "./runtime-primitives.js";
import { renderEscrowPage } from "./page-render.js";
import type { RoleHostStatus, RoleParticipation, RolePreprocess, RolePublicSetup, RoleSignatureShares, RoleVerification, SigningRole } from "./role-protocol.js";
import {
  makeEscrowContext,
  type DkgVerifyValidResult,
} from "../vendor/monero-wallet-api/dist/api.js";

const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const serviceDir = join(runtimeDir, "escrow-demo");
const sessionDir = join(serviceDir, "session-local-demo");
const dbPath = join(serviceDir, "escrow.sqlite");
const mediatorPublicPath = join(runtimeDir, "mediator-public.json");
const mediatorHostPath = join(import.meta.dir, "mediator-host.ts");
const roleHostPath = join(import.meta.dir, "role-host.ts");
const mediatorPort = 3912;
const rolePorts = { buyer: 3910, seller: 3911 } as const;
const nodeUrl = "http://127.0.0.1:18081";
const threshold = 3;
const count = 5;
const minimumAmountAtomic = 500_000_000_000n;
const maximumAmountAtomic = 10_000_000_000_000n;
const txBlocks = 15;
const sessionId = "local-demo";
const mediatorTracker = new MediatorProcessTracker();
const roleHostPids = new Map<"buyer" | "seller", number>();
const liveEventSubscribers = new Set<ReadableStreamDefaultController<Uint8Array>>();
const liveEventEncoder = new TextEncoder();
let setupEpoch = 0;
mkdirSync(serviceDir, { recursive: true });
const db = new Database(dbPath, { create: true });

type Role = "buyer" | "seller" | "mediator" | "chain";
type DkgRecord = DkgVerifyValidResult;
type StoredValue = Record<string, unknown>;
type MediatorResponse = { participant: string; preprocess: string; share: string; verify: DkgRecord };
type SettlementFeeSplit = {
  policy: string;
  escrow_amount_atomic: string;
  recipient_address: string;
  recipient_before_network_fee_atomic?: string;
  recipient_amount_atomic: string;
  mediator_payout_address: string;
  mediator_gross_fee_atomic: string;
  network_fee_atomic: string;
  mediator_amount_atomic: string;
  mediator_net_amount_atomic?: string;
  network_fee_payer?: "settlement_recipient";
};
type HappySettlementChoice = "release" | "refund";
type HappySettlementConsents = Partial<Record<"buyer" | "seller", HappySettlementChoice>>;
type PublicSetupRecord = {
  escrow_address: string;
  group_key: string;
  merchant_address: string;
  mediator_payout_address: string;
  public_keys: string[];
};
type RecoverySelection = { counterpart: "buyer" | "seller"; choice: HappySettlementChoice; reason: "disagreement" | "timeout" | "stalled" };
type RecoveryAuthorisations = Partial<Record<"buyer" | "seller" | "mediator", true>>;
type DecisionRecord = Partial<Record<"buyer" | "seller", { choice: HappySettlementChoice; recordedAt: string }>>;
type RecoveryOption = { counterpart: "buyer" | "seller"; choice: HappySettlementChoice; label: string };
type PayoutMode = "happy-release" | "happy-refund" | "recovery-buyer-release" | "recovery-buyer-refund" | "recovery-seller-release" | "recovery-seller-refund";
const recoveryTimeoutMs = Number(process.env.FROST_RECOVERY_TIMEOUT_MS ?? String(7 * 24 * 60 * 60 * 1000));

db.exec(`
  CREATE TABLE IF NOT EXISTS escrow_sessions (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    payout_mode TEXT,
    escrow_address TEXT,
    group_key TEXT,
    merchant_address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS protocol_records (
    session_id TEXT NOT NULL,
    record_key TEXT NOT NULL,
    record_value TEXT NOT NULL,
    PRIMARY KEY (session_id, record_key)
  );
  CREATE TABLE IF NOT EXISTS escrow_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    source TEXT NOT NULL,
    line TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function now() {
  return new Date().toISOString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function short(value?: string | null) {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : "—";
}

function json(value: unknown) {
  return stringifyDurable(value);
}

async function roleHealth(role: "buyer" | "seller") {
  const response = await fetch(`http://127.0.0.1:${rolePorts[role]}/health`).catch(() => undefined);
  if (!response?.ok) return undefined;
  return await response.json() as RoleHostStatus;
}

async function ensureRoleHost(role: "buyer" | "seller") {
  const existing = await roleHealth(role);
  if (existing) return existing;
  const child = Bun.spawn([process.execPath, "run", roleHostPath], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FROST_ROLE: role, FROST_ROLE_PORT: String(rolePorts[role]) },
  });
  roleHostPids.set(role, child.pid);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const status = await roleHealth(role);
    if (status) return status;
    await Bun.sleep(50);
  }
  throw new Error(`${role} role host did not become ready on loopback.`);
}

async function callRole<T>(role: "buyer" | "seller", pathname: string, body: unknown): Promise<T> {
  await ensureRoleHost(role);
  const response = await fetch(`http://127.0.0.1:${rolePorts[role]}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json(body),
  });
  const payload = await response.json() as T | { error: string };
  if (!response.ok || (typeof payload === "object" && payload !== null && "error" in payload)) {
    throw new Error(typeof payload === "object" && payload !== null && "error" in payload ? payload.error : `${role} role host rejected ${pathname}.`);
  }
  return payload as T;
}

function saveRecord(key: string, value: unknown) {
  db.query("INSERT OR REPLACE INTO protocol_records (session_id, record_key, record_value) VALUES (?, ?, ?)")
    .run(sessionId, key, json(value));
}

function getRecord<T>(key: string): T | undefined {
  const row = db.query("SELECT record_value FROM protocol_records WHERE session_id = ? AND record_key = ?")
    .get(sessionId, key) as { record_value?: string } | null;
  return row?.record_value ? parseDurable<T>(row.record_value) : undefined;
}

function getPublicSetupRecord() {
  return getRecord<PublicSetupRecord>("completed_public_context") ?? getRecord<PublicSetupRecord>("public_setup");
}

function persistCompletedPublicContext(session: NonNullable<ReturnType<typeof getSession>>, mediatorPayoutAddress: string) {
  saveRecord("completed_public_context", {
    escrow_address: session.escrow_address,
    group_key: session.group_key,
    merchant_address: session.merchant_address,
    mediator_payout_address: mediatorPayoutAddress,
    public_keys: getRecord<string[]>("all_pk") ?? [],
  });
}

function randomEscrowAmountAtomic() {
  return cryptographicRandomAtomicInclusive(minimumAmountAtomic, maximumAmountAtomic).toString();
}

function escrowAmountRecord() {
  return getRecord<{ atomic?: string; selected_at?: string }>("escrow_amount");
}

function requireEscrowAmountAtomic() {
  const atomic = escrowAmountRecord()?.atomic;
  if (!atomic || !/^\d+$/.test(atomic)) throw new Error("A persisted random escrow amount is required before funding.");
  return atomic;
}

function requireEscrowWalletCacheNamespace() {
  const record = getRecord<{ value?: string }>("escrow_wallet_cache_namespace");
  if (!record?.value) throw new Error("Escrow wallet cache namespace is missing for this session. Start a fresh setup session before funding.");
  return record.value;
}

function event(source: Role, line: string) {
  const createdAt = now();
  db.query("INSERT INTO escrow_logs (session_id, source, line, created_at) VALUES (?, ?, ?, ?)")
    .run(sessionId, source, line, createdAt);
  publishLive("protocol", { entry: `[${source}] ${elapsedLabel(getSession()?.created_at, createdAt)} ${line}` });
}

function publishLive(type: "protocol" | "state", payload: unknown) {
  const message = json(payload);
  for (const subscriber of liveEventSubscribers) {
    try {
      subscriber.enqueue(liveEventEncoder.encode(`event: ${type}\ndata: ${message}\n\n`));
    } catch {
      liveEventSubscribers.delete(subscriber);
    }
  }
}

function getSession() {
  return db.query("SELECT * FROM escrow_sessions WHERE id = ?").get(sessionId) as {
    id: string; status: string; payout_mode: string | null; escrow_address: string | null; group_key: string | null; merchant_address: string | null; created_at: string; updated_at: string;
  } | null;
}

function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Escrow setup has not been run.");
  return session;
}

function updateSession(fields: Record<string, string | null>) {
  const entries = Object.entries({ ...fields, updated_at: now() });
  db.query(`UPDATE escrow_sessions SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), sessionId);
  publishLive("state", { status: getSession()?.status ?? "not_initialized" });
}

function setSetupStage(label: string) {
  saveRecord("setup_stage", { label, started_at: now() });
  event("buyer", `Setup stage: ${label}.`);
}

function assertSetupActive(epoch: number) {
  if (epoch !== setupEpoch || getSession()?.status !== "initializing") {
    throw new Error("Initialize escrow was cancelled before this setup stage completed.");
  }
}

async function writeInitializationDiagnostic(reason: string) {
  const filename = `initialization-diagnostic-${Date.now()}.json`;
  const events = db.query("SELECT source, line, created_at FROM escrow_logs WHERE session_id = ? ORDER BY id").all(sessionId);
  const payload = {
    read_only: true,
    reason,
    generated_at: now(),
    session: getSession(),
    setup_stage: getRecord<{ label?: string; started_at?: string }>("setup_stage") ?? null,
    public_protocol: {
      group_key: getRecord<string>("group_key") ?? null,
      public_keys: getRecord<string[]>("all_pk") ?? null,
      context: getRecord<string>("context") ?? null,
    },
    events,
    library_log: redactAuditLibraryLogs(await recursiveLogs(sessionDir)),
    redaction: "Private FROST shares, participations, preprocessing values, mediator secret, wallet spend keys, and wallet view keys are intentionally omitted.",
  };
  await writeFile(join(sessionDir, filename), json(payload));
  saveRecord("initialization_diagnostic", { filename, reason, created_at: now() });
  return filename;
}

async function rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${nodeUrl}/json_rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json({ jsonrpc: "2.0", id: method, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned ${response.status}`);
  const payload = await response.json() as { result?: T; error?: unknown };
  if (payload.error) throw new Error(`${method} RPC error: ${json(payload.error)}`);
  if (!payload.result) throw new Error(`${method} returned no result`);
  return payload.result;
}

type PersistedTransaction = {
  tx_hash?: string | null;
  in_pool?: boolean | null;
  observed_height?: number | null;
  [key: string]: unknown;
};

async function daemonTransactionObservation(txHash: string) {
  const request = { txs_hashes: [txHash], decode_as_json: false, prune: false };
  const response = await fetch(`${nodeUrl}/get_transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json(request),
  }).catch(() => undefined);
  const payload = await response?.json().catch(() => undefined) as { txs?: Array<{ in_pool?: boolean; block_height?: number }> } | undefined;
  const tx = payload?.txs?.[0];
  if (!tx) return null;
  const inPool = tx.in_pool === true;
  return { in_pool: inPool, observed_height: inPool || typeof tx.block_height !== "number" ? null : tx.block_height };
}

async function refreshPersistedTransactionObservation(kind: "funding" | "payout") {
  const recordKey = kind === "funding" ? "funding_tx" : "payout_tx";
  const record = getRecord<PersistedTransaction>(recordKey);
  if (!record?.tx_hash) return record;
  const observation = await daemonTransactionObservation(record.tx_hash).catch(() => null);
  if (!observation) return record;
  const next = { ...record, ...observation };
  if (record.in_pool !== next.in_pool || record.observed_height !== next.observed_height) {
    saveRecord(recordKey, next);
    event("chain", `${kind === "funding" ? "Funding" : "Settlement"} transaction ${next.in_pool ? "broadcast, in tx pool" : `confirmed at height ${next.observed_height ?? "unknown"}`}.`);
  }
  return next;
}

async function broadcastObservation(result: unknown) {
  const info = await rpc<{ height?: number }>("get_info");
  const pool = await fetch(`${nodeUrl}/get_transaction_pool`).then(response => response.json()).catch(() => ({})) as {
    transactions?: Array<{ id_hash?: string; tx_hash?: string }>;
  };
  const latest = pool.transactions?.at(-1);
  return { result, tx_hash: latest?.id_hash ?? latest?.tx_hash ?? null, observed_height: info.height ?? null };
}

async function assertFakechain() {
  const info = await rpc<{ nettype?: string; offline?: boolean }>("get_info");
  if (info.nettype !== "fakechain" || !info.offline) throw new Error("The local node must report offline fakechain before escrow actions run.");
}

async function recursiveLogs(root: string, limits?: { tailPerFile?: number; totalLines?: number }): Promise<string[]> {
  const output: string[] = [];
  const visit = async (path: string) => {
    const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.name.endsWith(".log")) {
        const allLines = (await readFile(fullPath, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
        const lines = limits?.tailPerFile ? allLines.slice(-limits.tailPerFile) : allLines;
        output.push(...lines.map(line => `[seller] library/${entry.name}: ${line}`));
      }
    }
  };
  await visit(root);
  return limits?.totalLines ? output.slice(-limits.totalLines) : output;
}

async function ensureSessionDir() {
  await mkdir(sessionDir, { recursive: true });
}

async function mediatorContribution(unsignedTx: string, signerPreprocesses: Record<string, string>, counterpart: "buyer" | "seller") {
  Bun.env.FROST_MEDIATOR_PORT = String(mediatorPort);
  const child = Bun.spawn([process.execPath, "run", mediatorHostPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  mediatorTracker.start(child.pid);
  event("mediator", `Isolated loopback mediator host started (pid ${child.pid}) for this dispute only.`);
  try {
    const healthUrl = `http://127.0.0.1:${mediatorPort}/health`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const health = await fetch(healthUrl).catch(() => undefined);
      if (health?.ok) break;
      await Bun.sleep(50);
      if (attempt === 39) throw new Error("Isolated mediator host did not become ready.");
    }
    event("mediator", `Mediator host received persisted participations and ${counterpart} preprocesses; delayed verify(), preprocess(), and sign() are executing inside the isolated process.`);
    const response = await fetch(`http://127.0.0.1:${mediatorPort}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json({
        publicKeys: getRecord<string[]>("all_pk"),
        context: getRecord<string>("context"),
        participations: getRecord<Record<string, string>>("participation"),
        unsignedTx,
        signerPreprocesses,
      }),
    });
    const payload = await response.json() as MediatorResponse | { error: string };
    if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Mediator host rejected signing.");
    const signed = payload as MediatorResponse;
    const session = requireSession();
    if (signed.verify.group_key !== session.group_key) throw new Error("Mediator verify() produced a different group key.");
    saveRecord("verify.mediator", signed.verify);
    saveRecord("mediator_response", signed);
    event("mediator", "Delayed verify() derived the persisted escrow group key.");
    event("mediator", `Mediator preprocess completed for participant ${signed.participant}; mediator sign() returned its ${counterpart} decision signature share.`);
    return signed;
  } finally {
    const exitCode = await child.exited;
    mediatorTracker.stop(exitCode);
    event("mediator", `Isolated loopback mediator host exited after dispute signing (exit ${exitCode}).`);
  }
}

async function mediatorBackup(session: NonNullable<ReturnType<typeof getSession>>) {
  Bun.env.FROST_MEDIATOR_PORT = String(mediatorPort);
  const child = Bun.spawn([process.execPath, "run", mediatorHostPath], { stdout: "pipe", stderr: "pipe" });
  mediatorTracker.start(child.pid);
  event("mediator", `Isolated mediator host started (pid ${child.pid}) to export its FROST backup.`);
  try {
    const healthUrl = `http://127.0.0.1:${mediatorPort}/health`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const health = await fetch(healthUrl).catch(() => undefined);
      if (health?.ok) break;
      await Bun.sleep(50);
      if (attempt === 39) throw new Error("Isolated mediator host did not become ready for backup export.");
    }
    const response = await fetch(`http://127.0.0.1:${mediatorPort}/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json({
        sessionId,
        escrowAddress: session.escrow_address,
        groupKey: session.group_key,
        publicKeys: getRecord<string[]>("all_pk"),
        context: getRecord<string>("context"),
        participations: getRecord<Record<string, string>>("participation"),
      }),
    });
    const payload = await response.json() as Record<string, unknown> & { error?: unknown };
    if (!response.ok || typeof payload.error === "string") throw new Error(typeof payload.error === "string" ? payload.error : "Mediator backup export was rejected.");
    return payload;
  } finally {
    const exitCode = await child.exited;
    mediatorTracker.stop(exitCode);
    event("mediator", `Isolated mediator host exited after FROST backup export (exit ${exitCode}).`);
  }
}

async function frostBackup(role: "buyer" | "seller" | "mediator") {
  const session = requireSession();
  if (["not_initialized", "initializing"].includes(session.status)) throw new Error("FROST backup is available after setup completes.");
  if (role === "mediator") return mediatorBackup(session);
  return callRole<Record<string, unknown>>(role, "/backup", {});
}

async function setup(epoch: number) {
  if (getSession()?.status !== "initializing") return;
  await assertFakechain();
  assertSetupActive(epoch);
  await ensureSessionDir();
  setSetupStage("Waiting for buyer and seller role hosts");
  const [buyerStatus, sellerStatus] = await Promise.all([ensureRoleHost("buyer"), ensureRoleHost("seller")]);
  event("buyer", `Buyer role host is connected on loopback (pid ${buyerStatus.pid}) and owns shares 1–2.`);
  event("seller", `Seller role host is connected on loopback (pid ${sellerStatus.pid}) and owns shares 3–4.`);

  setSetupStage("Exchanging public FROST setup material");
  const [buyerPublic, sellerPublic] = await Promise.all([
    callRole<RolePublicSetup & { buyerAddress?: string }>("buyer", "/setup/public", {}),
    callRole<RolePublicSetup & { merchantAddress?: string }>("seller", "/setup/public", {}),
  ]);
  const mediator = JSON.parse(await readFile(mediatorPublicPath, "utf8")) as { dkgPublicKey: string; payoutAddress?: string };
  if (!mediator.payoutAddress) throw new Error("Mediator public payout address is missing. Run ./scripts/bootstrap-mediator.ts before initializing a new escrow session.");
  const allPk = [...buyerPublic.publicKeys, ...sellerPublic.publicKeys, mediator.dkgPublicKey];
  const context = makeEscrowContext(0).context;
  if (!context) throw new Error("Escrow context creation failed");
  event("buyer", "Buyer host published public keys for shares 1–2; seller host published public keys for shares 3–4.");
  event("mediator", "Mediator public DKG key and 1% payout address are registered. The mediator is not needed to be online for normal preparation, deposit, or agreed settlement.");

  setSetupStage("Relaying buyer and seller DKG participations");
  const [buyerParticipation, sellerParticipation] = await Promise.all([
    callRole<RoleParticipation>("buyer", "/setup/participate", { context, publicKeys: allPk }),
    callRole<RoleParticipation>("seller", "/setup/participate", { context, publicKeys: allPk }),
  ]);
  const participations = { ...buyerParticipation.participations, ...sellerParticipation.participations };
  event("buyer", "Buyer role host returned real DKG participations for shares 1–2.");
  event("seller", "Seller role host returned real DKG participation for share 3.");

  setSetupStage("Verifying the shared FROST group key");
  const [buyerVerification, sellerVerification] = await Promise.all([
    callRole<RoleVerification>("buyer", "/setup/verify", { context, publicKeys: allPk, participations }),
    callRole<RoleVerification>("seller", "/setup/verify", { context, publicKeys: allPk, participations }),
  ]);
  if (buyerVerification.groupKey !== sellerVerification.groupKey) throw new Error("Buyer and seller role hosts derived different FROST group keys.");
  const groupKey = buyerVerification.groupKey;
  event("buyer", `Buyer role host returned group key ${buyerVerification.groupKey}.`);
  event("seller", `Seller role host returned group key ${sellerVerification.groupKey}.`);
  event("chain", `Public group-key equality check passed: buyer ${buyerVerification.groupKey} = seller ${sellerVerification.groupKey}. No role-private threshold key was relayed to the coordinator.`);

  setSetupStage("Deriving the shared escrow address");
  const [buyerAddressResult, sellerAddressResult] = await Promise.all([
    callRole<{ escrowAddress: string }>("buyer", "/setup/address", { groupKey, peerViewPublicKey: sellerPublic.viewPublicKey }),
    callRole<{ escrowAddress: string }>("seller", "/setup/address", { groupKey, peerViewPublicKey: buyerPublic.viewPublicKey }),
  ]);
  if (buyerAddressResult.escrowAddress !== sellerAddressResult.escrowAddress) throw new Error("Buyer and seller role hosts derived different escrow addresses.");
  if (!sellerPublic.merchantAddress || !buyerPublic.buyerAddress) throw new Error("Role hosts did not provide required public wallet addresses.");

  assertSetupActive(epoch);
  updateSession({ status: "ready", payout_mode: null, escrow_address: buyerAddressResult.escrowAddress, group_key: groupKey, merchant_address: sellerPublic.merchantAddress });
  saveRecord("participation", participations);
  saveRecord("group_key", groupKey);
  saveRecord("verify.buyer", { group_key: groupKey, participants: buyerVerification.participantIndexes, host: "buyer" });
  saveRecord("verify.seller", { group_key: groupKey, participants: sellerVerification.participantIndexes, host: "seller" });
  saveRecord("all_pk", allPk);
  saveRecord("context", context);
  saveRecord("buyer_address", buyerPublic.buyerAddress);
  saveRecord("mediator_payout_address", mediator.payoutAddress);
  saveRecord("public_setup", {
    escrow_address: buyerAddressResult.escrowAddress,
    group_key: groupKey,
    merchant_address: sellerPublic.merchantAddress,
    mediator_payout_address: mediator.payoutAddress,
    public_keys: allPk,
  } satisfies PublicSetupRecord);
  saveRecord("role_hosts", { buyer: buyerStatus, seller: sellerStatus, mediator: { state: "not running", note: "Not needed for normal escrow." } });
  event("chain", `Buyer and seller derived the shared escrow address ${buyerAddressResult.escrowAddress}. Public address equality check passed.`);
  event("seller", "Preparation completed with isolated buyer and seller role hosts. The terminal will show their real FROST relay messages during settlement.");
}

async function fund() {
  const session = requireSession();
  if (session.status !== "ready") throw new Error(`Funding is unavailable while status is ${session.status}.`);
  await assertFakechain();
  const amountAtomic = requireEscrowAmountAtomic();
  const result = await callRole<{ fundingAddress: string; result: unknown; txHash: string | null; observedHeight: number | null }>("buyer", "/wallet/fund", {
    escrowAddress: session.escrow_address,
    amountAtomic,
    confirmations: txBlocks,
  });
  saveRecord("funding_tx", { result: result.result, tx_hash: result.txHash, in_pool: true, observed_height: null, amount_atomic: amountAtomic, broadcast_by: "buyer-role-host" });
  await refreshPersistedTransactionObservation("funding");
  updateSession({ status: "funding_broadcast" });
  event("buyer", `Buyer role host signed and broadcast a real fakechain escrow payment with amount ${amountAtomic} atomic units.`);
  event("chain", `Buyer role host advanced ${txBlocks} fakechain blocks to simulate escrow confirmation; automatic role-host scan started.`);
  void detectFunding("automatic").catch(error => event("seller", `Automatic escrow scan will retry from the advanced rescan control: ${error instanceof Error ? error.message : String(error)}`));
}

async function detectFunding(origin: "automatic" | "manual" = "manual") {
  const session = requireSession();
  if (session.status !== "funding_broadcast") throw new Error("Funding detection requires a broadcast escrow payment.");
  const amountAtomic = requireEscrowAmountAtomic();
  const cacheNamespace = requireEscrowWalletCacheNamespace();
  const scan = await callRole<{ inputCount: number; currentHeight: number | null; spendableInputCount: number; ignoredInputCount: number }>("seller", "/wallet/scan", { escrowAddress: session.escrow_address, minHeight: 1000 + txBlocks, escrowAmountAtomic: amountAtomic, cacheNamespace });
  if (scan.inputCount === 0) throw new Error("Seller role host found no spendable escrow input yet.");
  if (scan.inputCount !== 1) throw new Error(`Seller role host found ${scan.inputCount} inputs matching this session amount; expected exactly one.`);
  saveRecord("escrow_inputs", { count: scan.inputCount, total_spendable_count: scan.spendableInputCount, ignored_input_count: scan.ignoredInputCount, cache_namespace: cacheNamespace, expected_amount_atomic: amountAtomic, observed_by: "seller-role-host", current_height: scan.currentHeight });
  updateSession({ status: "funded" });
  event("seller", `${origin === "automatic" ? "Automatic seller role-host escrow scan" : "Advanced seller role-host escrow rescan"} detected the one input matching this session’s ${amountAtomic}-atomic escrow amount after fakechain confirmation.`);
}

function getHappySettlementConsents() {
  return getRecord<HappySettlementConsents>("happy_settlement_consents") ?? {};
}

function getDecisionRecord() {
  return getRecord<DecisionRecord>("decision_record") ?? {};
}

function recoveryEligibility() {
  const decisions = getDecisionRecord();
  // Disagreement unlocks recovery immediately. Timeout remains a separate
  // independent path when one party never provides a corresponding decision.
  if (decisions.buyer && decisions.seller && decisions.buyer.choice !== decisions.seller.choice) return { eligible: true, reason: "disagreement" as const, detail: "Immediate disagreement eligibility: buyer and seller requested different outcomes; the recovery timeout is not required." };
  const sole = decisions.buyer ? "buyer" : decisions.seller ? "seller" : undefined;
  if (sole) {
    const timestamp = new Date(decisions[sole]!.recordedAt).getTime();
    const remaining = Math.max(0, recoveryTimeoutMs - (Date.now() - timestamp));
    if (remaining === 0) return { eligible: true, reason: "timeout" as const, detail: `Independent timeout eligibility: ${sole[0].toUpperCase()}${sole.slice(1)} decision exceeded the configured recovery timeout.` };
    return { eligible: false, reason: "timeout" as const, detail: `Mediator recovery remains locked: awaiting the other party or the independent recovery timeout (${Math.ceil(remaining / 1000)}s remaining in this environment).` };
  }
  const round = getRecord<{ phase?: string; expires_at?: string }>("payout_round");
  if ((round?.phase === "stalled" || round?.phase === "reset") && round.expires_at && Date.now() >= new Date(round.expires_at).getTime()) return { eligible: true, reason: "stalled" as const, detail: round.phase === "reset" ? "Stalled-round eligibility: the expired signer round was reset. Select the remaining role and mediator recovery outcome." : "Stalled-round eligibility: the selected signer round expired and may be reset." };
  return { eligible: false, reason: "timeout" as const, detail: "Mediator recovery remains locked until one independent condition fires: immediate disagreement, a policy timeout, or a stalled signer round." };
}

function recoveryOptions(): RecoveryOption[] {
  const eligibility = recoveryEligibility();
  if (!eligibility.eligible) return [];
  const decisions = getDecisionRecord();
  if (eligibility.reason === "disagreement") return [
    { counterpart: "buyer", choice: "refund", label: "Rule: refund buyer" },
    { counterpart: "seller", choice: "release", label: "Rule: pay seller" },
  ];
  if (eligibility.reason === "timeout") {
    const counterpart = decisions.buyer ? "buyer" : "seller";
    const choice = decisions[counterpart]?.choice;
    return choice ? [{ counterpart, choice, label: choice === "refund" ? "Rule: refund buyer" : "Rule: pay seller" }] : [];
  }
  const round = getRecord<{ outcome?: string; counterpart?: "buyer" | "seller"; choice?: HappySettlementChoice }>("payout_round");
  const choice = round?.choice ?? (round?.outcome === "refund to buyer" ? "refund" : "release");
  const counterpart = round?.counterpart ?? (choice === "refund" ? "buyer" : "seller");
  return [{ counterpart, choice, label: choice === "refund" ? "Rule: continue refund with buyer" : "Rule: continue payout with seller" }];
}

function markRoundStalled(reason: string) {
  const current = getRecord<Record<string, unknown>>("payout_round");
  if (!current || current.phase === "completed") return;
  const expiresAt = new Date(Date.now() + recoveryTimeoutMs).toISOString();
  saveRecord("payout_round", { ...current, phase: "stalled", updated_at: now(), expires_at: expiresAt, failure: reason });
  event("chain", `Settlement round stalled: ${reason}. Its one-time signer state will expire at ${expiresAt}; Reset signers becomes available after the recovery timeout.`);
}

async function resetSigners() {
  const session = requireSession();
  if (session.status !== "funded") throw new Error("Reset signers is available only while escrow remains funded.");
  const round = getRecord<Record<string, unknown>>("payout_round");
  if (!round || round.phase !== "stalled" || typeof round.expires_at !== "string" || Date.now() < new Date(round.expires_at).getTime()) throw new Error("Reset signers is available only after a stalled round reaches its recovery timeout.");
  saveRecord("payout_round", { ...round, phase: "reset", updated_at: now(), reset_at: now() });
  saveRecord("recovery_selection", null);
  saveRecord("recovery_authorisations", {});
  event("chain", "Reset signers invalidated the expired round’s one-time preprocess state. Mediator recovery selection is now available.");
}

async function recordHappySettlementConsent(role: "buyer" | "seller", choice: HappySettlementChoice) {
  const session = requireSession();
  if (session.status !== "funded") throw new Error(`Settlement consent is unavailable while status is ${session.status}.`);
  const consents = { ...getHappySettlementConsents(), [role]: choice };
  saveRecord("happy_settlement_consents", consents);
  saveRecord("decision_record", { ...getDecisionRecord(), [role]: { choice, recordedAt: now() } });
  const counterpart = role === "buyer" ? "seller" : "buyer";
  const counterpartChoice = consents[counterpart];
  if (counterpartChoice !== choice) {
    const mismatch = counterpartChoice && counterpartChoice !== choice;
    event(role, mismatch
      ? `Buyer and seller requested different outcomes. No FROST signing started; the mediator recovery path is now eligible.`
      : `${role[0].toUpperCase()}${role.slice(1)} recorded ${choice === "release" ? "release to seller" : "refund to buyer"} consent. Awaiting matching ${counterpart} consent before any FROST signing; the independent recovery timeout has started but is not yet eligible.`);
    return;
  }
  event(role, `Both buyer and seller issued their final ${choice === "release" ? "release to seller" : "refund to buyer"} signing consents. Their isolated role hosts will now begin the real four-share FROST payout round.`);
  await payout(choice === "release" ? "happy-release" : "happy-refund");
}

async function selectRecovery(counterpart: "buyer" | "seller", choice: HappySettlementChoice) {
  const session = requireSession();
  if (session.status !== "funded") throw new Error(`Mediator recovery is unavailable while status is ${session.status}.`);
  const eligibility = recoveryEligibility();
  if (!eligibility.eligible) throw new Error(eligibility.detail);
  if (!recoveryOptions().some(option => option.counterpart === counterpart && option.choice === choice)) throw new Error("The selected recovery signer set or outcome is not legal for the recorded escrow condition.");
  const selection: RecoverySelection = { counterpart, choice, reason: eligibility.reason };
  saveRecord("recovery_selection", selection);
  saveRecord("recovery_authorisations", { mediator: true });
  event("mediator", `Recovery eligibility condition fired: ${eligibility.reason}. ${eligibility.detail} Mediator ruled ${choice === "release" ? "release to seller" : "refund to buyer"} with ${counterpart}; the ruling records the mediator’s final consent and awaits ${counterpart} to sign the 3-of-5 recovery.`);
}

async function authoriseRecovery(role: "buyer" | "seller") {
  const session = requireSession();
  if (session.status !== "funded") throw new Error(`Recovery signing is unavailable while status is ${session.status}.`);
  const selection = getRecord<RecoverySelection>("recovery_selection");
  if (!selection || role !== selection.counterpart) throw new Error("This role is not selected for the current recovery round.");
  const authorisations = { ...(getRecord<RecoveryAuthorisations>("recovery_authorisations") ?? {}), [role]: true };
  saveRecord("recovery_authorisations", authorisations);
  if (!authorisations.mediator) throw new Error("A final mediator ruling is required before recovery signing.");
  event(role, `${role[0].toUpperCase()}${role.slice(1)} reviewed the mediator ruling and signed into the recovery round. The selected role host and delayed mediator host will now begin the real 3-of-5 FROST payout round.`);
  await payoutRecovery(selection);
}

async function payoutRecovery(selection: RecoverySelection) {
  const session = requireSession();
  const destination = selection.choice === "release" ? session.merchant_address! : getRecord<string>("buyer_address")!;
  const mediatorAddress = getRecord<string>("mediator_payout_address");
  if (!mediatorAddress) throw new Error("Mediator payout address is unavailable for settlement.");
  const escrowAmountAtomic = requireEscrowAmountAtomic();
  const cacheNamespace = requireEscrowWalletCacheNamespace();
  const roundId = `recovery-${crypto.randomUUID()}`;
  const createdAt = now();
  saveRecord("payout_round", { id: roundId, counterpart: selection.counterpart, choice: selection.choice, outcome: selection.choice === "release" ? "release to seller" : "refund to buyer", selected_roles: [selection.counterpart, "mediator"], selected_participants: selection.counterpart === "buyer" ? ["1", "2", "5"] : ["3", "4", "5"], completion_role: selection.counterpart, phase: "preprocessing", created_at: createdAt, updated_at: createdAt, expires_at: new Date(Date.now() + recoveryTimeoutMs).toISOString(), recovery_reason: selection.reason });
  event("chain", `Recovery round ${roundId} selected ${selection.counterpart} shares plus mediator share 5 = 3/3 for ${selection.choice === "release" ? "release to seller" : "refund to buyer"}.`);
  const unsigned = await callRole<{ unsignedTx: string; inputCount: number; ignoredInputCount: number; feeSplit: SettlementFeeSplit }>(selection.counterpart, "/wallet/unsigned-payout", { escrowAddress: session.escrow_address, destination, mediatorAddress, escrowAmountAtomic, cacheNamespace });
  saveRecord("sweep", { destination, input_count: unsigned.inputCount, ignored_input_count: unsigned.ignoredInputCount, cache_namespace: cacheNamespace, decision: `recovery-${selection.counterpart}-${selection.choice}`, created_by: `${selection.counterpart}-role-host`, fee_split: unsigned.feeSplit });
  saveRecord("settlement_fee", unsigned.feeSplit);
  event("chain", `Settlement split is destination ${unsigned.feeSplit.recipient_amount_atomic} atomic units plus fixed 1% mediator ${unsigned.feeSplit.mediator_amount_atomic} atomic units; the actual ${unsigned.feeSplit.network_fee_atomic}-atomic fakechain fee is deducted from the settlement recipient output.`);
  const counterpartPreprocess = await callRole<RolePreprocess>(selection.counterpart, "/round/preprocess", { roundId, unsignedTx: unsigned.unsignedTx });
  event(selection.counterpart, `${selection.counterpart[0].toUpperCase()}${selection.counterpart.slice(1)} role host returned real preprocesses for shares ${Object.keys(counterpartPreprocess.preprocesses).join("–")}.`);
  const mediator = await mediatorContribution(unsigned.unsignedTx, counterpartPreprocess.preprocesses, selection.counterpart);
  const preprocesses = { ...counterpartPreprocess.preprocesses, [mediator.participant]: mediator.preprocess };
  saveRecord("preprocess", { round_id: roundId, participants: Object.keys(preprocesses) });
  const counterpartShares = await callRole<RoleSignatureShares>(selection.counterpart, "/round/sign", { roundId, preprocesses });
  const shares = { ...counterpartShares.shares, [mediator.participant]: mediator.share };
  saveRecord("share", { round_id: roundId, participants: Object.keys(shares) });
  event(selection.counterpart, `${selection.counterpart[0].toUpperCase()}${selection.counterpart.slice(1)} role host returned real signature shares for ${Object.keys(counterpartShares.shares).join("–")}; mediator share is relayed.`);
  const completed = await callRole<{ signedTx: string }>(selection.counterpart, "/round/complete", { roundId, shares });
  event(selection.counterpart, `${selection.counterpart[0].toUpperCase()}${selection.counterpart.slice(1)} role host completed the 3-of-5 recovery transaction.`);
  const broadcast = await callRole<{ result: unknown; txHash: string | null }>(selection.counterpart, "/wallet/broadcast", { escrowAddress: session.escrow_address, signedTx: completed.signedTx, cacheNamespace });
  const mode = `recovery-${selection.counterpart}-${selection.choice}` as PayoutMode;
  saveRecord("payout_tx", { result: broadcast.result, tx_hash: broadcast.txHash, in_pool: true, observed_height: null, broadcast_by: `${selection.counterpart}-role-host` });
  await refreshPersistedTransactionObservation("payout");
  saveRecord("payout_round", { ...(getRecord<Record<string, unknown>>("payout_round") ?? {}), phase: "completed", updated_at: now() });
  persistCompletedPublicContext(session, mediatorAddress);
  updateSession({ status: "paid_out", payout_mode: mode });
  event("mediator", `Recovery settlement completed: ${selection.counterpart} plus mediator broadcast the real 3-of-5 threshold transaction.`);
}

async function payout(mode: PayoutMode) {
  const session = requireSession();
  if (session.status !== "funded") throw new Error(`Payout is unavailable while status is ${session.status}.`);
  if (mode === "happy-release" || mode === "happy-refund") {
    const outcome = mode === "happy-release" ? "release_to_seller" : "refund_to_buyer";
    const completionRole = mode === "happy-release" ? "seller" : "buyer";
    const destination = mode === "happy-release" ? session.merchant_address! : getRecord<string>("buyer_address")!;
    const mediatorAddress = getRecord<string>("mediator_payout_address");
    if (!mediatorAddress) throw new Error("Mediator payout address is unavailable for settlement.");
    const escrowAmountAtomic = requireEscrowAmountAtomic();
    const cacheNamespace = requireEscrowWalletCacheNamespace();
    const roundId = `round-${crypto.randomUUID()}`;
    const createdAt = now();
    saveRecord("payout_round", {
      id: roundId,
      outcome,
      selected_roles: ["buyer", "seller"],
      selected_participants: ["1", "2", "3", "4"],
      completion_role: completionRole,
      phase: "preprocessing",
      created_at: createdAt,
      updated_at: createdAt,
      expires_at: new Date(Date.now() + recoveryTimeoutMs).toISOString(),
    });
    event("chain", `Payout round ${roundId} selected buyer shares 1–2 plus seller shares 3–4 = 4/3 for ${outcome}. The mediator is not needed to be online.`);
    const unsigned = await callRole<{ unsignedTx: string; inputCount: number; ignoredInputCount: number; feeSplit: SettlementFeeSplit }>(completionRole, "/wallet/unsigned-payout", { escrowAddress: session.escrow_address, destination, mediatorAddress, escrowAmountAtomic, cacheNamespace });
    saveRecord("sweep", { destination, input_count: unsigned.inputCount, ignored_input_count: unsigned.ignoredInputCount, cache_namespace: cacheNamespace, decision: mode, created_by: `${completionRole}-role-host`, fee_split: unsigned.feeSplit });
    saveRecord("settlement_fee", unsigned.feeSplit);
    event("chain", `Settlement split is destination ${unsigned.feeSplit.recipient_amount_atomic} atomic units plus fixed 1% mediator ${unsigned.feeSplit.mediator_amount_atomic} atomic units; the actual ${unsigned.feeSplit.network_fee_atomic}-atomic fakechain fee is deducted from the settlement recipient output.`);
    event(completionRole, `${completionRole[0].toUpperCase()}${completionRole.slice(1)} role host created the unsigned escrow settlement transaction.`);
    const [buyerPreprocess, sellerPreprocess] = await Promise.all([
      callRole<RolePreprocess>("buyer", "/round/preprocess", { roundId, unsignedTx: unsigned.unsignedTx }),
      callRole<RolePreprocess>("seller", "/round/preprocess", { roundId, unsignedTx: unsigned.unsignedTx }),
    ]);
    const preprocesses = { ...buyerPreprocess.preprocesses, ...sellerPreprocess.preprocesses };
    saveRecord("preprocess", { round_id: roundId, participants: Object.keys(preprocesses) });
    event("buyer", `Buyer role host returned real preprocesses for shares ${Object.keys(buyerPreprocess.preprocesses).join("–")}.`);
    event("seller", `Seller role host returned real preprocesses for shares ${Object.keys(sellerPreprocess.preprocesses).join("–")}. All four preprocesses are now relayed.`);
    saveRecord("payout_round", { ...(getRecord<Record<string, unknown>>("payout_round") ?? {}), phase: "signing", updated_at: now() });
    const [buyerShares, sellerShares] = await Promise.all([
      callRole<RoleSignatureShares>("buyer", "/round/sign", { roundId, preprocesses }),
      callRole<RoleSignatureShares>("seller", "/round/sign", { roundId, preprocesses }),
    ]);
    const shares = { ...buyerShares.shares, ...sellerShares.shares };
    saveRecord("share", { round_id: roundId, participants: Object.keys(shares) });
    event("buyer", `Buyer role host returned real signature shares for ${Object.keys(buyerShares.shares).join("–")}.`);
    event("seller", `Seller role host returned real signature shares for ${Object.keys(sellerShares.shares).join("–")}. The completion step is unlocked.`);
    saveRecord("payout_round", { ...(getRecord<Record<string, unknown>>("payout_round") ?? {}), phase: "completing", updated_at: now() });
    const completed = await callRole<{ signedTx: string }>(completionRole, "/round/complete", { roundId, shares });
    saveRecord("signed_tx", { round_id: roundId, completed_by: `${completionRole}-role-host`, value: "redacted" });
    event(completionRole, `${completionRole[0].toUpperCase()}${completionRole.slice(1)} role host completed the threshold transaction from the received four-share set.`);
    saveRecord("payout_round", { ...(getRecord<Record<string, unknown>>("payout_round") ?? {}), phase: "broadcasting", updated_at: now() });
    const broadcast = await callRole<{ result: unknown; txHash: string | null }>(completionRole, "/wallet/broadcast", { escrowAddress: session.escrow_address, signedTx: completed.signedTx, cacheNamespace });
    saveRecord("payout_tx", { result: broadcast.result, tx_hash: broadcast.txHash, in_pool: true, observed_height: null, broadcast_by: `${completionRole}-role-host` });
    await refreshPersistedTransactionObservation("payout");
    saveRecord("payout_round", { ...(getRecord<Record<string, unknown>>("payout_round") ?? {}), phase: "completed", updated_at: now() });
    persistCompletedPublicContext(session, mediatorAddress);
    updateSession({ status: "paid_out", payout_mode: mode });
    event(completionRole, `${completionRole[0].toUpperCase()}${completionRole.slice(1)} role host broadcast the real completed four-share threshold transaction for ${outcome}.`);
    return;
  }
  throw new Error(`Payout mode ${mode} must be executed through a selected isolated role-host round.`);
}

function button(path: string, label: string, enabled: boolean) {
  return `<form method="post" action="${path}"><button ${enabled ? "" : "disabled"}>${label}</button></form>`;
}

async function legacyPage() {
  const session = getSession();
  const status = session?.status ?? "not initialized";
  const actions = availableActions(session ? session.status as Exclude<EscrowStatus, "not_initialized"> : "not_initialized");
  const forms = renderActionForms(session ? session.status as Exclude<EscrowStatus, "not_initialized"> : "not_initialized");
  const thresholdKeys = getRecord<Record<string, string>>("threshold_key");
  const amountAtomic = escrowAmountRecord()?.atomic ?? "Selected at initialization";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FROST Escrow · Regtest</title><style>
    :root{--ink:#12251f;--paper:#f7f4ed;--sage:#dfe9df;--green:#285940;--gold:#af7b2c;--line:#cad7ca}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,#eaf1e8,transparent 36%),var(--paper);color:var(--ink);font:15px/1.45 ui-sans-serif,system-ui,sans-serif}.shell{max-width:1220px;margin:auto;padding:42px 24px 56px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--green);font-weight:750}h1{font:500 clamp(35px,5vw,64px)/.96 Georgia,serif;margin:12px 0 14px;letter-spacing:-.04em}.lede{max-width:720px;font-size:17px;color:#486057}.status{display:inline-flex;gap:9px;align-items:center;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:13px}.dot{width:8px;height:8px;border-radius:50%;background:${status==="paid_out"?"#285940":"#af7b2c"}}.panes{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:34px}.pane,.mediator,.logs{border:1px solid var(--line);background:rgba(255,255,255,.72);box-shadow:0 14px 32px rgba(35,65,48,.07)}.pane{padding:28px;min-height:300px}.pane h2,.mediator h2{font:500 30px/1.1 Georgia,serif;margin:0 0 20px}.buyer{border-top:4px solid #6a936f}.seller{border-top:4px solid var(--gold)}.label{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#6b786f;margin-top:18px}.mono{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;word-break:break-all;color:#2f4d3e}.data{padding:12px 0;border-bottom:1px solid #e5ebe3}button{margin-top:20px;border:0;background:var(--green);color:#fff;border-radius:7px;padding:12px 15px;font:650 14px inherit;cursor:pointer;box-shadow:0 4px 0 #173525}button:active{transform:translateY(2px);box-shadow:0 2px 0 #173525}button:disabled{cursor:not-allowed;background:#aab8ab;box-shadow:none}.mediator{display:flex;align-items:center;justify-content:space-between;padding:22px 28px;margin-top:18px;border-left:5px solid var(--gold)}.mediator h2{font-size:23px;margin:0}.badge{border:1px solid #d6b576;color:#765213;background:#fff9e9;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}.toggle{display:flex;gap:9px;align-items:center}.toggle button{margin:0;background:#795927;box-shadow:0 3px 0 #4a3517}.logs{margin-top:18px}.logs header{display:flex;justify-content:space-between;align-items:center;padding:17px 22px;border-bottom:1px solid var(--line)}.logs h2{font:500 24px Georgia,serif;margin:0}.logs iframe{display:block;width:100%;height:260px;border:0;background:#12251f}@media(max-width:720px){.panes{grid-template-columns:1fr}.mediator{align-items:flex-start;gap:14px;flex-direction:column}}
  </style></head><body><main class="shell"><div class="eyebrow">Local-only · Offline fakechain · 3-of-5</div><h1>FROST escrow, rendered in the clear.</h1><p class="lede">A single local operator can drive buyer and seller workflow while the mediator stays absent from setup and scanning. Every status is backed by the regtest node or the wallet library.</p><p class="status"><span class="dot"></span>${escapeHtml(status)}</p><section class="panes"><article class="pane buyer"><div class="eyebrow">Buyer · two shares</div><h2>Fund the shared address.</h2><div class="data"><div class="label">Escrow address</div><div class="mono">${escapeHtml(session?.escrow_address ?? "Run setup to derive address")}</div></div><div class="data"><div class="label">Amount</div><div class="mono">${amountAtomic} atomic units</div></div>${forms.setup}${forms.fund}</article><article class="pane seller"><div class="eyebrow">Seller · two shares</div><h2>Scan, then settle.</h2><div class="data"><div class="label">FROST group key</div><div class="mono">${escapeHtml(short(session?.group_key))}</div></div><div class="data"><div class="label">Persisted buyer/seller shares</div><div class="mono">${thresholdKeys ? "4 threshold keys" : "Awaiting setup"}</div></div>${forms.detect}${forms.happyPayout}</article></section><section class="mediator"><div><div class="eyebrow">Mediator · one share</div><h2>Never present during setup.</h2><div class="mono">Public key only until the explicit dispute action.</div></div><div class="toggle"><span class="badge">1 share · offline by default</span>${forms.disputePayout}</div></section><section class="logs"><header><div><div class="eyebrow">Live source log</div><h2>Observed activity</h2></div><span class="mono">auto-refresh 1s</span></header><iframe title="Real activity log" src="/log"></iframe></section></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function page() {
  const session = getSession();
  const status = (session?.status ?? "not_initialized") as EscrowStatus;
  const publicSetup = getPublicSetupRecord();
  const pageSession = session ? {
    ...session,
    escrow_address: session.escrow_address ?? publicSetup?.escrow_address ?? null,
    group_key: session.group_key ?? publicSetup?.group_key ?? null,
    merchant_address: session.merchant_address ?? publicSetup?.merchant_address ?? null,
  } : session;
  const roleHosts = getRecord<Record<string, unknown>>("role_hosts");
  const funding = await refreshPersistedTransactionObservation("funding") as PersistedTransaction | undefined;
  const chainInfo = await rpc<{ height?: number }>("get_info").catch(() => ({} as { height?: number }));
  const payoutRecord = await refreshPersistedTransactionObservation("payout") as PersistedTransaction | undefined;
  const setupStage = getRecord<{ label?: string; started_at?: string }>("setup_stage");
  const diagnostic = getRecord<{ filename?: string }>("initialization_diagnostic");
  const activityEntries = await newestActivityEntries();
  const body = renderEscrowPage({
    session: pageSession,
    status,
    actions: availableActions(status),
    thresholdKeyCount: roleHosts ? 4 : 0,
    fundingTxHash: funding?.tx_hash ?? null,
    payoutTxHash: payoutRecord?.tx_hash ?? null,
    fundingObservedHeight: funding?.observed_height ?? null,
    fundingInPool: funding?.in_pool ?? null,
    fundingConfirmations: funding?.observed_height && chainInfo.height ? Math.max(0, Math.min(txBlocks, chainInfo.height - funding.observed_height)) : 0,
    payoutObservedHeight: payoutRecord?.observed_height ?? null,
    payoutInPool: payoutRecord?.in_pool ?? null,
    buyerAddress: getRecord<string>("buyer_address") ?? null,
    mediatorPayoutAddress: getRecord<string>("mediator_payout_address") ?? publicSetup?.mediator_payout_address ?? null,
    settlementFee: getRecord<SettlementFeeSplit>("settlement_fee") ?? null,
    publicKeys: getRecord<string[]>("all_pk") ?? publicSetup?.public_keys ?? [],
    context: getRecord<string>("context") ?? null,
    setupStage: setupStage?.label ?? null,
    setupStageElapsed: setupStage?.started_at ? elapsedLabel(setupStage.started_at, now()) : null,
    diagnosticAvailable: Boolean(diagnostic?.filename),
    mediator: mediatorTracker.status(),
    activityEntries,
    backupReady: Boolean(session && !["not_initialized", "initializing"].includes(status) && roleHosts),
    amountAtomic: escrowAmountRecord()?.atomic ?? null,
    happyConsents: getHappySettlementConsents(),
    recovery: {
      ...recoveryEligibility(),
      options: recoveryOptions(),
      roundPhase: getRecord<{ phase?: string }>("payout_round")?.phase ?? null,
      selection: getRecord<RecoverySelection>("recovery_selection") ?? null,
      authorisations: getRecord<RecoveryAuthorisations>("recovery_authorisations") ?? {},
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function liveEvents() {
  let subscriber: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      subscriber = controller;
      liveEventSubscribers.add(controller);
      controller.enqueue(liveEventEncoder.encode(`event: protocol\ndata: ${json({ connected: true })}\n\n`));
    },
    cancel() {
      if (subscriber) liveEventSubscribers.delete(subscriber);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function frostBackupFilename(role: "buyer" | "seller" | "mediator") {
  return `escrow-${sessionId}-${role}-${now().replace(/[:.]/g, "-")}.frost`;
}

async function newestActivityEntries() {
  const stored = db.query("SELECT source, line, created_at FROM escrow_logs WHERE session_id = ? ORDER BY id DESC LIMIT 80").all(sessionId) as { source: Role; line: string; created_at: string }[];
  const library = await recursiveLogs(sessionDir, { tailPerFile: 30, totalLines: 60 });
  return normalizeRealLogs([...stored].reverse(), library, getSession()?.created_at).reverse().slice(0, 30);
}

async function logPage() {
  const entries = await newestActivityEntries();
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>FROST Escrow Activity</title><style>body{margin:0;background:#12251f;color:#dceadf;font:12px/1.5 ui-monospace,SFMono-Regular,monospace;padding:15px}.entry{padding:0 0 10px;margin:0 0 10px;border-bottom:1px solid #274237;white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#8da99a}</style></head><body>${entries.length ? entries.map(entry => `<div class="entry">${escapeHtml(entry)}</div>`).join("") : '<span class="muted">No wallet or route output has been observed yet.</span>'}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function redactVerifyRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { threshold_key: _privateThresholdKey, ...publicRecord } = value as Record<string, unknown>;
  return publicRecord;
}

function redactMediatorResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const response = value as Record<string, unknown>;
  return {
    participant: typeof response.participant === "string" ? response.participant : null,
    verify: redactVerifyRecord(response.verify),
    contribution: "Mediator delayed verification, preprocessing, and signature-share contribution completed; values are redacted.",
  };
}

function participantSummary(value: unknown, label: string) {
  const participants = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>) : [];
  return { count: participants.length, participants, values: `${label} values are redacted.` };
}

function redactAuditLibraryLogs(lines: string[]) {
  return lines.map(line => /\b(secret|spend[_ -]?key|view[_ -]?key|threshold[_ -]?key|participation|preprocess|signature[_ -]?share|dkg_secret)\b/i.test(line)
    ? "[audit] sensitive library line redacted"
    : line);
}

async function auditPayload() {
  await Promise.all([refreshPersistedTransactionObservation("funding"), refreshPersistedTransactionObservation("payout")]);
  const records = db.query("SELECT record_key, record_value FROM protocol_records WHERE session_id = ? ORDER BY record_key").all(sessionId) as { record_key: string; record_value: string }[];
  const protocolRecords = Object.fromEntries(records.map(row => [row.record_key, parseDurable(row.record_value)]));
  const events = db.query("SELECT source, line, created_at FROM escrow_logs WHERE session_id = ? ORDER BY id").all(sessionId) as { source: Role; line: string; created_at: string }[];
  const fullLibraryLog = await recursiveLogs(sessionDir);
  return {
    read_only: true,
    session: getSession(),
    mediator_process: mediatorTracker.status(),
    dkg: {
      participation: participantSummary(protocolRecords.participation, "DKG participation"),
      group_key: protocolRecords.group_key ?? null,
      public_keys: protocolRecords.all_pk ?? null,
      completed_public_context: protocolRecords.completed_public_context ?? protocolRecords.public_setup ?? null,
      verify: Object.fromEntries(Object.entries(protocolRecords)
        .filter(([key]) => key.startsWith("verify."))
        .map(([key, value]) => [key, redactVerifyRecord(value)])),
    },
    transactions: {
      escrow_amount: protocolRecords.escrow_amount ?? null,
      funding: protocolRecords.funding_tx ?? null,
      sweep: protocolRecords.sweep ?? null,
      payout: protocolRecords.payout_tx ?? null,
      signed_transaction: protocolRecords.signed_tx ?? null,
      mediator_payout_address: protocolRecords.mediator_payout_address ?? null,
      settlement_fee: protocolRecords.settlement_fee ?? null,
    },
    signing: {
      preprocesses: participantSummary(protocolRecords.preprocess, "FROST preprocess"),
      shares: participantSummary(protocolRecords.share, "FROST signature share"),
      mediator_response: redactMediatorResponse(protocolRecords.mediator_response ?? null),
    },
    settlement_consents: protocolRecords.happy_settlement_consents ?? {},
    initialization_diagnostic: protocolRecords.initialization_diagnostic ?? null,
    redaction: "Private FROST shares, participations, preprocessing values, mediator secret, wallet spend keys, and wallet view keys are intentionally omitted from this read-only audit.",
    events,
    full_library_log: redactAuditLibraryLogs(fullLibraryLog),
  };
}

async function fakechainTransactionEvidence(kind: "funding" | "payout") {
  const record = await refreshPersistedTransactionObservation(kind);
  const txHash = record?.tx_hash;
  const nodeInfo = await rpc<{ height?: number; nettype?: string; offline?: boolean }>("get_info");
  if (!txHash) return { read_only: true, kind, available: false, node: nodeInfo, message: `No ${kind} transaction ID has been recorded for this session yet.` };
  const request = { txs_hashes: [txHash], decode_as_json: false, prune: false };
  const response = await fetch(`${nodeUrl}/get_transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: json(request) });
  const rawDaemonResponse = await response.json().catch(() => ({ parse_error: "The daemon returned a non-JSON response." }));
  return { read_only: true, kind, available: response.ok, transaction_id: txHash, in_pool: record?.in_pool ?? null, observed_height: record?.observed_height ?? null, node: nodeInfo, daemon_request: request, raw_daemon_response: rawDaemonResponse, independent_command: `curl -sS -X POST ${nodeUrl}/get_transactions -H 'Content-Type: application/json' --data '${json(request)}'` };
}

async function verificationPage(kind: "funding" | "payout") {
  const evidence = await fakechainTransactionEvidence(kind);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Verify fakechain transaction</title><style>body{margin:0;padding:28px;background:#080d09;color:#d9eadb;font:14px/1.5 ui-monospace,SFMono-Regular,monospace}a{color:#91e5a6}pre{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #2d5038;background:#030603;padding:18px}</style></head><body><p><a href="/">← Escrow</a> · <a href="/verify.json?tx=${kind}">Download raw JSON</a> · <a href="/audit">Inspect session audit</a></p><h1>Independent fakechain evidence: ${escapeHtml(kind)}</h1><p>This is the local daemon response, not a terminal summary. On the computer running the demo, run the displayed command directly against loopback monerod to compare it yourself.</p><pre>${escapeHtml(json(evidence))}</pre></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function auditText(payload: Awaited<ReturnType<typeof auditPayload>>) {
  return json(payload);
}

async function auditPage() {
  const payload = await auditPayload();
  const diagnosticLink = payload.initialization_diagnostic ? ' · <a href="/diagnostic">initialization diagnostic</a>' : "";
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>FROST Escrow Audit</title><style>body{margin:0;padding:28px;background:#f7f4ed;color:#12251f;font:14px/1.5 ui-monospace,SFMono-Regular,monospace}a{color:#285940}pre{white-space:pre-wrap;word-break:break-word;border:1px solid #cad7ca;background:#fff;padding:18px}</style></head><body><p><a href="/">← Escrow</a> · <a href="/audit.json">JSON</a> · <a href="/audit.txt">plain text</a>${diagnosticLink}</p><h1>Read-only session audit</h1><pre>${escapeHtml(auditText(payload))}</pre></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function mediatorStatusPage() {
  const status = mediatorTracker.status();
  const tone = status.state === "running" ? "#285940" : "#765213";
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:8px 0;font:12px/1.35 ui-sans-serif,system-ui;color:#12251f}.state{display:inline-block;padding:4px 8px;border-radius:999px;color:#fff;background:${tone};font-weight:700}.detail{display:block;margin-top:4px;color:#596d61}</style></head><body><span class="state">Mediator process: ${escapeHtml(status.state)}</span><span class="detail">${escapeHtml(status.lastTransition)}</span></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", Refresh: "1", "Cache-Control": "no-store" } });
}

async function handleAction(path: string) {
  try {
    if (path === "/action/setup") {
      const existing = getSession();
      if (!existing || existing.status === "not_initialized") {
        if (existing) {
          db.query("DELETE FROM protocol_records WHERE session_id = ?").run(sessionId);
          updateSession({ status: "initializing", payout_mode: null, escrow_address: null, group_key: null, merchant_address: null });
        } else {
          db.query("INSERT INTO escrow_sessions (id, status, payout_mode, escrow_address, group_key, merchant_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .run(sessionId, "initializing", null, null, null, null, now(), now());
        }
        const amountAtomic = randomEscrowAmountAtomic();
        const cacheNamespace = `session-${crypto.randomUUID()}`;
        saveRecord("escrow_amount", { atomic: amountAtomic, min_atomic: minimumAmountAtomic.toString(), max_atomic: maximumAmountAtomic.toString(), selected_at: now(), selection: "cryptographically random per local session" });
        saveRecord("escrow_wallet_cache_namespace", { value: cacheNamespace, created_at: now(), purpose: "Isolated role-host escrow scanner cache for this coordinator session" });
        event("buyer", `Random escrow amount selected: ${amountAtomic} atomic units (between ${minimumAmountAtomic} and ${maximumAmountAtomic} atomic units).`);
        event("buyer", "Initialize request accepted; setup is running in the coordinator. This page will refresh with progress.");
        const epoch = ++setupEpoch;
        void setup(epoch).catch(async error => {
          if (getSession()?.status !== "initializing") return;
          const reason = error instanceof Error ? error.message : String(error);
          event("seller", `Initialize failed: ${reason}`);
          await writeInitializationDiagnostic(reason);
          updateSession({ status: "not_initialized" });
        });
      }
    }
    else if (path === "/action/cancel-setup") {
      if (getSession()?.status === "initializing") {
        setupEpoch += 1;
        const reason = "Initialize escrow was cancelled by the operator.";
        event("buyer", reason);
        await writeInitializationDiagnostic(reason);
        updateSession({ status: "not_initialized" });
      }
    }
    else if (path === "/action/fund") await fund();
    else if (path === "/action/detect" || path === "/action/force-rescan") await detectFunding("manual");
    else if (path === "/action/payout/happy") throw new Error("Happy-path settlement requires matching buyer and seller final signing consents.");
    else {
      const consent = path.match(/^\/action\/happy-consent\/(buyer|seller)\/(release|refund)$/);
      if (consent) await recordHappySettlementConsent(consent[1] as "buyer" | "seller", consent[2] as HappySettlementChoice);
      else {
          const selection = path.match(/^\/action\/recovery\/select\/(buyer|seller)\/(release|refund)$/);
          const recoveryAuthorisation = path.match(/^\/action\/recovery\/authorise\/(buyer|seller)$/);
          if (selection) await selectRecovery(selection[1] as "buyer" | "seller", selection[2] as HappySettlementChoice);
          else if (recoveryAuthorisation) await authoriseRecovery(recoveryAuthorisation[1] as "buyer" | "seller");
          else if (path === "/action/recovery/reset-signers") await resetSigners();
          else if (path === "/action/payout/dispute" || path === "/action/payout/dispute-release" || path === "/action/payout/dispute-refund") throw new Error("Mediator recovery requires an eligible final ruling and the selected buyer or seller signature.");
          else return new Response("Not found", { status: 404 });
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (path.includes("authorise")) markRoundStalled(reason);
    event("seller", `Action failed: ${reason}`);
  }
  // A relative Location preserves the browser's current origin. This works for
  // localhost, 127.0.0.1, and a Tailscale Serve HTTPS URL without redirecting
  // a remote browser to its own localhost.
  return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
}

await ensureSessionDir();
Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.FROST_BUN_PORT ?? 3901),
  idleTimeout: 255,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return page();
    if (request.method === "GET" && url.pathname === "/manus-storage/monero-frost-background_6d8f609e.webp") {
      return Response.redirect("https://frostescrow-xos58zyj.manus.space/manus-storage/monero-frost-background_6d8f609e.webp", 307);
    }
    if (request.method === "GET" && url.pathname === "/manus-storage/monerochan-frost-supplied_be562d67.webp") {
      return Response.redirect("https://frostescrow-xos58zyj.manus.space/manus-storage/monerochan-frost-supplied_be562d67.webp", 307);
    }
    if (request.method === "GET" && url.pathname === "/log") return logPage();
    if (request.method === "GET" && url.pathname === "/events") return liveEvents();
    if (request.method === "GET" && url.pathname === "/mediator-status") return mediatorStatusPage();
    if (request.method === "GET" && url.pathname === "/audit") return auditPage();
    if (request.method === "GET" && url.pathname === "/audit.json") return new Response(auditText(await auditPayload()), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=escrow-session-audit.json", "Cache-Control": "no-store" } });
    if (request.method === "GET" && url.pathname === "/audit.txt") return new Response(auditText(await auditPayload()), { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": "attachment; filename=escrow-session-audit.txt", "Cache-Control": "no-store" } });
    if (request.method === "GET" && url.pathname === "/verify") return verificationPage(url.searchParams.get("tx") === "payout" ? "payout" : "funding");
    if (request.method === "GET" && url.pathname === "/verify.json") return new Response(json(await fakechainTransactionEvidence(url.searchParams.get("tx") === "payout" ? "payout" : "funding")), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename=fakechain-${url.searchParams.get("tx") === "payout" ? "payout" : "funding"}-evidence.json`, "Cache-Control": "no-store" } });
    if (request.method === "GET" && url.pathname === "/diagnostic") {
      const diagnostic = getRecord<{ filename?: string }>("initialization_diagnostic");
      if (!diagnostic?.filename || !/^initialization-diagnostic-\d+\.json$/.test(diagnostic.filename)) return new Response("No initialization diagnostic is available.", { status: 404 });
      const payload = await readFile(join(sessionDir, diagnostic.filename), "utf8").catch(() => "");
      return payload ? new Response(payload, { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=initialization-diagnostic.json", "Cache-Control": "no-store" } }) : new Response("Initialization diagnostic file is unavailable.", { status: 404 });
    }
    const backupMatch = url.pathname.match(/^\/backup\/(buyer|seller|mediator)$/);
    if (request.method === "GET" && backupMatch) {
      const role = backupMatch[1] as "buyer" | "seller" | "mediator";
      const payload = await frostBackup(role);
      event(role, `${role[0].toUpperCase()}${role.slice(1)} FROST backup downloaded.`);
      return new Response(json(payload), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename=${frostBackupFilename(role)}`, "Cache-Control": "no-store" } });
    }
    if (request.method === "POST") return handleAction(url.pathname);
    return new Response("Not found", { status: 404 });
  },
});
