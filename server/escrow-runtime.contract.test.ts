import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MediatorProcessTracker, SessionSignerRegistry, availableActions, cryptographicRandomAtomicInclusive, normalizeRealLogs, parseDurable, prefixLog, renderActionForms, stringifyDurable, withinDeadline } from "../local-runtime/runtime-primitives";
import { participantIndexes } from "../local-runtime/role-protocol";

const projectRoot = join(import.meta.dirname, "..");
const runtime = readFileSync(join(projectRoot, "local-runtime", "escrow-service.ts"), "utf8");
const roleHost = readFileSync(join(projectRoot, "local-runtime", "role-host.ts"), "utf8");
const pageRenderer = readFileSync(join(projectRoot, "local-runtime", "page-render.ts"), "utf8");
const mediatorHost = readFileSync(join(projectRoot, "local-runtime", "mediator-host.ts"), "utf8");
const mediatorBootstrap = readFileSync(join(projectRoot, "scripts", "bootstrap-mediator.ts"), "utf8");
const resetScript = readFileSync(join(projectRoot, "scripts", "reset-regtest.sh"), "utf8");
const bootstrapScript = readFileSync(join(projectRoot, "scripts", "run-local-demo.sh"), "utf8");
const modularBuilder = readFileSync(join(projectRoot, "scripts", "build-modular-distribution.sh"), "utf8");
const modularLauncher = readFileSync(join(projectRoot, "scripts", "modular-demo.sh"), "utf8");
const modularReplace = readFileSync(join(projectRoot, "scripts", "replace-code-dir.sh"), "utf8");
const readme = readFileSync(join(projectRoot, "README.md"), "utf8");
const gitignore = readFileSync(join(projectRoot, ".gitignore"), "utf8");
const manifest = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as { dependencies?: Record<string, string> };

function resolveBunExecutable(): string {
  const home = process.env.HOME ?? "";
  const candidates = [process.env.FROST_BUN_BIN, home ? join(home, ".bun", "bin", "bun") : undefined, "/home/ubuntu/.local/frost-bun/node_modules/.bin/bun"].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return execFileSync("sh", ["-lc", "command -v bun"], { encoding: "utf8" }).trim();
}

describe("isolated local FROST escrow runtime contract", () => {
  it("keeps the public repository free of web-template credentials and retains reproducible local runtime prerequisites", () => {
    for (const removedPath of [".project-config.json", "drizzle.config.ts", "components.json", "template.json", "vite.config.ts", "client", "drizzle", "shared", "storage", "patches", join("server", "_core"), join("server", "db.ts"), join("server", "routers.ts")]) {
      expect(existsSync(join(projectRoot, removedPath))).toBe(false);
    }
    expect(existsSync(join(projectRoot, "vendor", "monero-wallet-api", "dist", "api.js"))).toBe(true);
    for (const ignoredPath of [".project-config.json", ".env.*", "*.frost", "*.sqlite", "role-hosts/", "escrow-demo/", "snapshot-data/", "mediator-secret.json", "role-relay.log"]) expect(gitignore).toContain(ignoredPath);
    expect(readme).toContain("unaudited, agent-assisted, local-only demonstration");
    expect(readme).toContain("decoyRetry = true");
    expect(readme).toContain("vendor/monero-wallet-api/dist/api.js");
    expect(readme).toContain("To demonstrate a dispute");
    expect(bootstrapScript).toContain("Restarting the restored loopback fakechain daemon");
    expect(manifest.dependencies).toMatchObject({ "@noble/curves": "2.2.0", "@noble/hashes": "2.2.0" });
  });

  it("uses the requested five-share, three-threshold allocation", () => {
    expect(runtime).toContain("const threshold = 3;");
    expect(runtime).toContain("const count = 5;");
    expect(participantIndexes).toEqual({ buyer: ["1", "2"], seller: ["3", "4"], mediator: ["5"] });
    expect(roleHost).toContain("const threshold = 3;");
    expect(roleHost).toContain("const count = 5;");
  });

  it("chooses a cryptographically random inclusive amount inside the approved 0.5 to 10 XMR atomic range", () => {
    const minimum = 500_000_000_000n;
    const maximum = 10_000_000_000_000n;
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const amount = cryptographicRandomAtomicInclusive(minimum, maximum);
      expect(amount).toBeGreaterThanOrEqual(minimum);
      expect(amount).toBeLessThanOrEqual(maximum);
    }
    expect(() => cryptographicRandomAtomicInclusive(2n, 1n)).toThrow("bounds are invalid");
  });

  it("keeps buyer and seller DKG, threshold derivation, and signer state inside isolated role hosts", () => {
    expect(roleHost).toContain('const role = process.env.FROST_ROLE');
    expect(roleHost).toContain('const privatePath = join(roleDir, "private.json")');
    expect(roleHost).toContain("dkg_secret_key: privateState.dkgSecrets[index]");
    expect(roleHost).toContain("async function preprocess");
    expect(roleHost).toContain("async function sign");
    expect(roleHost).toContain("async function complete");
    expect(roleHost).toContain('hostname: "127.0.0.1"');
    expect(runtime).toContain("async function ensureRoleHost");
    expect(runtime).toContain("async function callRole");
    expect(runtime).not.toContain('saveRecord("threshold_key"');
    expect(runtime).not.toContain("dkg_secret_key:");
    expect(runtime).not.toContain("MultiSigTxSigner.create");
  });

  it("relays public setup material while buyer and seller independently verify the group key", () => {
    const setupScope = runtime.slice(runtime.indexOf("async function setup(epoch"), runtime.indexOf("async function fund()"));
    expect(setupScope).toContain('callRole<RolePublicSetup & { buyerAddress?: string }>("buyer", "/setup/public", {})');
    expect(setupScope).toContain('callRole<RoleParticipation>("buyer", "/setup/participate"');
    expect(setupScope).toContain('callRole<RoleParticipation>("seller", "/setup/participate"');
    expect(setupScope).toContain('callRole<RoleVerification>("buyer", "/setup/verify"');
    expect(setupScope).toContain('callRole<RoleVerification>("seller", "/setup/verify"');
    expect(setupScope).toContain("No role-private threshold key was relayed to the coordinator");
    expect(setupScope).toContain("Buyer role host returned group key ${buyerVerification.groupKey}");
    expect(setupScope).toContain("Seller role host returned group key ${sellerVerification.groupKey}");
    expect(setupScope).toContain("Public group-key equality check passed");
    expect(setupScope).toContain("Buyer and seller derived the shared escrow address");
    expect(setupScope).toContain('saveRecord("public_setup"');
    expect(setupScope).toContain('saveRecord("role_hosts"');
  });

  it("preserves complete public setup evidence after either completed settlement path", () => {
    expect(runtime).toContain("type PublicSetupRecord");
    expect(runtime).toContain("function persistCompletedPublicContext");
    expect(runtime).toContain('saveRecord("completed_public_context"');
    expect(runtime).toContain("const publicSetup = getPublicSetupRecord()");
    expect(runtime).toContain("escrow_address: session.escrow_address ?? publicSetup?.escrow_address ?? null");
    expect(runtime).toContain("publicKeys: getRecord<string[]>(\"all_pk\") ?? publicSetup?.public_keys ?? []");
    expect(runtime).toContain("completed_public_context: protocolRecords.completed_public_context ?? protocolRecords.public_setup ?? null");
    expect(pageRenderer).toContain("Five public DKG keys");
    expect(pageRenderer).toContain("Mediator payout address");
  });

  it("moves funding broadcast to buyer and funding detection to seller role hosts", () => {
    const fundingScope = runtime.slice(runtime.indexOf("async function fund()"), runtime.indexOf("function getHappySettlementConsents"));
    expect(fundingScope).toContain('callRole<{ fundingAddress: string; result: unknown; txHash: string | null; observedHeight: number | null }>("buyer", "/wallet/fund"');
    expect(fundingScope).toContain('callRole<{ inputCount: number; currentHeight: number | null; spendableInputCount: number; ignoredInputCount: number }>("seller", "/wallet/scan"');
    expect(fundingScope).toContain('void detectFunding("automatic")');
    expect(fundingScope).toContain("Buyer role host signed and broadcast a real fakechain escrow payment");
    expect(fundingScope).toContain("Automatic seller role-host escrow scan");
    expect(fundingScope).toContain("requireEscrowAmountAtomic()");
    expect(fundingScope).toContain("amount_atomic: amountAtomic");
  });

  it("persists one bounded random escrow amount before setup and projects it into the audit", () => {
    const setupRoute = runtime.slice(runtime.indexOf('if (path === "/action/setup")'), runtime.indexOf('else if (path === "/action/cancel-setup")'));
    expect(runtime).toContain("const minimumAmountAtomic = 500_000_000_000n;");
    expect(runtime).toContain("const maximumAmountAtomic = 10_000_000_000_000n;");
    expect(setupRoute).toContain('saveRecord("escrow_amount"');
    expect(setupRoute).toContain("Random escrow amount selected:");
    expect(runtime).toContain("escrow_amount: protocolRecords.escrow_amount ?? null");
  });

  it("exposes raw fakechain transaction evidence instead of relying only on terminal claims", () => {
    expect(runtime).toContain("async function fakechainTransactionEvidence");
    expect(runtime).toContain("async function daemonTransactionObservation");
    expect(runtime).toContain("async function refreshPersistedTransactionObservation");
    expect(runtime).toContain('await refreshPersistedTransactionObservation(kind)');
    expect(runtime).toContain('`${nodeUrl}/get_transactions`');
    expect(runtime).toContain('url.pathname === "/verify"');
    expect(runtime).toContain('url.pathname === "/verify.json"');
    expect(runtime).toContain("independent_command");
    expect(pageRenderer).toContain('href="/verify?tx=funding"');
    expect(pageRenderer).toContain('href="/verify?tx=payout"');
  });

  it("renders fakechain transaction lifecycle from in-pool and observed-height evidence", () => {
    expect(pageRenderer).toContain("function transactionLifecycle");
    expect(pageRenderer).toContain("broadcast, in tx pool");
    expect(pageRenderer).toContain("confirmed at height");
    expect(pageRenderer).toContain("fundingInPool");
    expect(pageRenderer).toContain("payoutInPool");
    expect(pageRenderer).toContain("window.setInterval(refreshState, 4000)");
    expect(runtime).toContain('await Promise.all([refreshPersistedTransactionObservation("funding"), refreshPersistedTransactionObservation("payout")])');
    expect(runtime).toContain("in_pool: record?.in_pool ?? null");
  });

  it("constructs every settlement with a public 1% mediator output while keeping the normal mediator signer absent", () => {
    expect(mediatorBootstrap).toContain("makeTestKeyPair");
    expect(mediatorBootstrap).toContain("payoutAddress");
    expect(bootstrapScript).toContain('"$BUN_BIN" run ./scripts/bootstrap-mediator.ts');
    expect(runtime).toContain('saveRecord("mediator_payout_address", mediator.payoutAddress)');
    expect(runtime).toContain('saveRecord("settlement_fee", unsigned.feeSplit)');
    expect(roleHost).toContain("wallet.makeTransaction({ payments: reservePayments, inputs: sessionInputs })");
    expect(roleHost).toContain("wallet.makeTransaction({ payments, inputs: sessionInputs })");
    expect(roleHost).toContain("mediator_amount_atomic");
    expect(roleHost).toContain("recipientBeforeNetworkFee - networkFee");
    expect(roleHost).toContain("network_fee_payer: \"settlement_recipient\"");
    expect(roleHost).not.toContain("networkFee >= grossMediatorFee");
    expect(roleHost).toContain("sessionInputs.length !== 1");
    expect(pageRenderer).toContain("1% mediator fee");
    expect(pageRenderer).toContain("network fee is deducted from the settlement recipient output");
    expect(pageRenderer).toContain("Mediator payout address");
    expect(pageRenderer).toContain("network fee deducted from settlement recipient output");
  });

  it("isolates wallet scan state per fresh coordinator session and requires the exact funded input", () => {
    expect(runtime).toContain('saveRecord("escrow_wallet_cache_namespace"');
    expect(runtime).toContain("requireEscrowWalletCacheNamespace()");
    expect(runtime).toContain("expected exactly one");
    expect(roleHost).toContain("escrow-wallet-sessions");
    expect(roleHost).toContain("matchingInputs");
    expect(roleHost).toContain("sessionInputs.length !== 1");
    expect(bootstrapScript).toContain('rm -rf "$RUNTIME_DIR/role-hosts/buyer/escrow-wallet-sessions" "$RUNTIME_DIR/role-hosts/seller/escrow-wallet-sessions"');
  });

  it("hides non-live elapsed pills and offers only recorded-condition recovery choices", () => {
    expect(pageRenderer).toContain(".status-row .status:not(:first-child){display:none!important}");
    expect(runtime).toContain("function recoveryOptions()");
    expect(runtime).toContain("The selected recovery signer set or outcome is not legal");
    expect(pageRenderer).toContain("Only signer sets that match the recorded condition are available.");
    expect(pageRenderer).not.toContain('action("/action/recovery/select/buyer/release"');
  });

  it("uses matching final buyer and seller signing consents to start normal signing without a redundant second action", () => {
    const consentScope = runtime.slice(runtime.indexOf("async function recordHappySettlementConsent"), runtime.indexOf("async function selectRecovery"));
    expect(consentScope).toContain('saveRecord("happy_settlement_consents", consents)');
    expect(consentScope).toContain("Both buyer and seller issued their final");
    expect(consentScope).toContain('await payout(choice === "release" ? "happy-release" : "happy-refund")');
    expect(runtime).not.toContain("happy_settlement_authorisations");
    expect(runtime).not.toContain("authoriseHappySettlement");
    expect(runtime).not.toContain("happy-authorise");
  });

  it("runs the normal four-share round only through buyer and seller role-host responses", () => {
    const happyScope = runtime.slice(runtime.indexOf('if (mode === "happy-release" || mode === "happy-refund")'), runtime.indexOf('throw new Error(`Payout mode ${mode}'));
    for (const fragment of ["/wallet/unsigned-payout", 'callRole<RolePreprocess>("buyer", "/round/preprocess"', 'callRole<RolePreprocess>("seller", "/round/preprocess"', 'callRole<RoleSignatureShares>("buyer", "/round/sign"', 'callRole<RoleSignatureShares>("seller", "/round/sign"', "/round/complete", "/wallet/broadcast"]) expect(happyScope).toContain(fragment);
    expect(happyScope).not.toContain("mediatorContribution");
    expect(happyScope).toContain("The mediator is not needed to be online");
  });

  it("keeps the mediator host absent throughout the normal path", () => {
    const tracker = new MediatorProcessTracker();
    for (const stage of ["setup", "funding", "decision", "normal payout"]) {
      expect(tracker.status().state, stage).toBe("not running");
      expect(() => tracker.assertAbsent()).not.toThrow();
    }
    expect(mediatorHost).toContain('hostname: "127.0.0.1"');
    expect(mediatorHost).toContain('join(runtimeDir, "mediator-secret.json")');
  });

  it("gates recovery on disagreement, timeout, or stalled-round eligibility and treats the mediator ruling as final", () => {
    expect(runtime).toContain("function recoveryEligibility()");
    expect(runtime).toContain('reason: "disagreement"');
    expect(runtime).toContain('reason: "timeout"');
    expect(runtime).toContain('reason: "stalled"');
    expect(runtime).toContain("async function selectRecovery");
    expect(runtime).toContain("async function authoriseRecovery");
    expect(runtime).toContain("function markRoundStalled");
    expect(runtime).toContain("async function resetSigners");
    expect(runtime).toContain('path === "/action/recovery/reset-signers"');
    expect(runtime).toContain('saveRecord("recovery_authorisations", { mediator: true })');
    expect(runtime).toContain("await payoutRecovery(selection)");
    expect(runtime).toContain('path.match(/^\\/action\\/recovery\\/select\\/(buyer|seller)\\/(release|refund)$/)');
    expect(runtime).toContain('path.match(/^\\/action\\/recovery\\/authorise\\/(buyer|seller)$/)');
    expect(runtime).toContain("the ruling records the mediator’s final consent");
    expect(runtime).toContain("reviewed the mediator ruling and signed into the recovery round");
    expect(runtime).toContain("Immediate disagreement eligibility");
    expect(runtime).toContain("Independent timeout eligibility");
    expect(runtime).toContain("Stalled-round eligibility");
    expect(runtime).toContain("Recovery eligibility condition fired");
    expect(pageRenderer).toContain("Eligibility trigger:");
  });

  it("uses the isolated mediator only inside the actual recovery round", () => {
    const recoveryScope = runtime.slice(runtime.indexOf("async function payoutRecovery"), runtime.indexOf("async function payout(mode"));
    expect(recoveryScope).toContain("await mediatorContribution");
    expect(recoveryScope).toContain("selected_participants: selection.counterpart === \"buyer\" ? [\"1\", \"2\", \"5\"] : [\"3\", \"4\", \"5\"]");
    expect(recoveryScope).toContain("Recovery settlement completed");
    expect(mediatorHost).toContain("Mediator delayed verify() did not return a threshold key");
  });

  it("offers one final signing action per required role while retaining a terminal for automatic real FROST relay", () => {
    for (const fragment of ["Sign release to seller", "Sign refund to buyer", "Settlement in progress", "Live protocol terminal", "new EventSource('/events')", "document.addEventListener('submit'", "events.addEventListener('state', scheduleRefresh)"]) expect(pageRenderer).toContain(fragment);
    expect(pageRenderer).not.toContain("Complete happy-path payout");
    expect(pageRenderer).not.toContain("Review & authorise");
    expect(pageRenderer).not.toContain("Newest event first");
    expect(pageRenderer).toContain("mediator not needed for agreement");
    expect(pageRenderer).toContain("Mediator recovery is eligible");
    expect(pageRenderer).toContain("Reset signers");
    expect(pageRenderer).toContain("Mediator ruling recorded");
    expect(pageRenderer).toContain("Sign ${choiceLabel(recovery.choice)}");
    expect(pageRenderer).not.toContain("Review & authorise mediator recovery");
    expect((pageRenderer.match(/<span class="terminal-cursor"/g) ?? []).length).toBe(1);
  });

  it("places the user-approved backup warning above the dashboard with role-host-accurate custody wording", () => {
    expect(pageRenderer).toContain("Make sure to backup your FROST file. If you lose it, your funds cannot be recovered.");
    expect(pageRenderer).toContain("belongs to its local signer role");
    expect(pageRenderer).toContain('</header>${backupWarning()}<section class="dashboard">');
    expect(pageRenderer).toContain("FROST backup");
    expect(runtime).toContain('callRole<Record<string, unknown>>(role, "/backup", {})');
  });

  it("renders the mediator as unnecessary for normal operation and reserves it for recovery", () => {
    expect(pageRenderer).toContain("Not needed for a normal escrow.");
    expect(pageRenderer).toContain("disagreement, timeout, or signer recovery");
    expect(pageRenderer).toContain("Mediator recovery");
    expect(pageRenderer).toContain("buyer 2 + mediator 1 = 3");
    expect(pageRenderer).toContain("seller 2 + mediator 1 = 3");
  });

  it("keeps live in-place updates, centered terminal layout, and the supplied Monerochan artwork", () => {
    expect(pageRenderer).toContain("const refreshState = async");
    expect(pageRenderer).toContain('id="public-details"');
    expect(pageRenderer).toContain("'#public-details'");
    expect(pageRenderer).toContain("wasPublicDetailsOpen");
    expect(pageRenderer).toContain("terminal-console");
    expect(pageRenderer).toContain("frost@regtest");
    expect(pageRenderer).toContain("tail -n 30 -f role-relay.log");
    expect(pageRenderer).toContain("[ live ]");
    expect(pageRenderer).toContain("event-prompt");
    expect(pageRenderer).toContain("grid-template-columns:minmax(280px,1fr) minmax(360px,1.22fr) minmax(280px,1fr)");
    expect(pageRenderer).toContain("/manus-storage/monerochan-frost-supplied_be562d67.webp");
    expect(runtime).toContain('publishLive("state"');
    expect(runtime).toContain('url.pathname === "/manus-storage/monerochan-frost-supplied_be562d67.webp"');
  });

  it("uses the approved Monero orange, off-white, and near-black palette without removing responsive terminal rules", () => {
    expect(pageRenderer).toContain("--monero-orange:#ff6600");
    expect(pageRenderer).toContain("--monero-white:#f7f4ef");
    expect(pageRenderer).toContain("--monero-ink:#070707");
    expect(pageRenderer).toContain("var(--monero-orange)");
    expect(pageRenderer).toContain("@media(max-width:760px)");
  });

  it("preserves durable, redacted public audit records", () => {
    expect(runtime).toContain("function auditPayload()");
    expect(runtime).toContain("function redactAuditLibraryLogs");
    expect(runtime).toContain("Private FROST shares, participations, preprocessing values, mediator secret, wallet spend keys, and wallet view keys are intentionally omitted");
    expect(runtime).toContain('url.pathname === "/audit.json"');
    expect(runtime).toContain('url.pathname === "/audit.txt"');
    expect(runtime).toContain("payout_round");
  });

  it("serializes BigInt protocol values and filters library write chatter", async () => {
    const encoded = stringifyDurable({ atomic: 133_700_000_000n });
    expect(parseDurable<{ atomic: bigint }>(encoded)).toEqual({ atomic: 133_700_000_000n });
    expect(prefixLog("mediator", "delayed verify completed")).toBe("[mediator] delayed verify completed");
    expect(normalizeRealLogs([{ source: "buyer", created_at: "2026-01-01T00:00:00.000Z", line: "funded escrow" }], ["[seller] library writing to ScanSettings.json", "[seller] library scan error: retry"], "2026-01-01T00:00:00.000Z")).toEqual(["[buyer] +00:00:00 funded escrow", "[seller] library scan error: retry"]);
    await expect(withinDeadline(new Promise<never>(() => {}), "round relay", 5)).rejects.toThrow("round relay did not complete within 0 seconds");
  });

  it("keeps public action availability and relative redirects", () => {
    expect(availableActions("funded")).toMatchObject({ happyPayout: true, disputePayout: true });
    expect(availableActions("paid_out")).toMatchObject({ happyPayout: false, disputePayout: false });
    expect(renderActionForms("not_initialized").setup).toContain("generateblocks");
    expect(runtime).toContain('new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } })');
  });

  it("persists protocol records across a real Bun SQLite reopen", () => {
    const output = execFileSync(resolveBunExecutable(), ["run", join(projectRoot, "scripts", "verify-sqlite-persistence.ts")], { encoding: "utf8" });
    expect(JSON.parse(output)).toMatchObject({ restored: "funded", records: expect.any(Array) });
  });

  it("retains the modular release, reset, and local bootstrap workflows", () => {
    expect(resetScript).toContain('cp -a "${SNAPSHOT_DIR}/." "${DATA_DIR}/"');
    expect(bootstrapScript).toContain('"$PNPM_BIN" install --frozen-lockfile');
    expect(bootstrapScript).toContain("./scripts/reset-regtest.sh");
    expect(modularBuilder).toContain('mkdir -p "$STAGE/code" "$STAGE/dependencies" "$STAGE/state"');
    expect(modularLauncher).toContain('FROST_DEPENDENCY_ROOT="$DIST_ROOT"');
    expect(modularReplace).toContain("Untouched: dependencies/ and ~/.local/share/frost-monero-regtest/");
  });

  it("keeps the old in-process registry primitive testable but unused by the coordinator", () => {
    const registry = new SessionSignerRegistry<{ id: string }>();
    registry.forSession("demo").set("1", { id: "buyer-1" });
    expect(registry.require("demo", "1")).toEqual({ id: "buyer-1" });
    registry.clear("demo");
    expect(() => registry.require("demo", "1")).toThrow("No in-process signer");
    expect(runtime).not.toContain("new SessionSignerRegistry");
  });
});
