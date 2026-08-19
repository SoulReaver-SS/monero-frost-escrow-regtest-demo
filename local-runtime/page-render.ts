import type { EscrowStatus } from "./runtime-primitives.js";

type Actions = {
  setup: boolean;
  cancelSetup: boolean;
  fund: boolean;
  detect: boolean;
  forceRescan: boolean;
  happyPayout: boolean;
  disputePayout: boolean;
  disputeRelease: boolean;
  disputeRefund: boolean;
};

type PageSession = {
  status: string;
  payout_mode: string | null;
  escrow_address: string | null;
  group_key: string | null;
  merchant_address: string | null;
  created_at: string;
};

type PageModel = {
  session: PageSession | null;
  status: EscrowStatus;
  actions: Actions;
  thresholdKeyCount: number;
  fundingTxHash: string | null;
  payoutTxHash: string | null;
  fundingObservedHeight: number | null;
  fundingInPool: boolean | null;
  fundingConfirmations: number;
  payoutObservedHeight: number | null;
  payoutInPool: boolean | null;
  buyerAddress: string | null;
  mediatorPayoutAddress: string | null;
  settlementFee: {
    policy: string;
    escrow_amount_atomic: string;
    recipient_address: string;
    recipient_before_network_fee_atomic?: string;
    recipient_amount_atomic: string;
    mediator_payout_address: string;
    mediator_gross_fee_atomic: string;
    network_fee_atomic: string;
    mediator_amount_atomic?: string;
    mediator_net_amount_atomic?: string;
    network_fee_payer?: "settlement_recipient";
  } | null;
  publicKeys: string[];
  context: string | null;
  setupStage: string | null;
  setupStageElapsed: string | null;
  diagnosticAvailable: boolean;
  mediator: { state: "not running" | "running"; lastTransition: string };
  activityEntries: string[];
  backupReady: boolean;
  amountAtomic: string | null;
  happyConsents: Partial<Record<"buyer" | "seller", "release" | "refund">>;
  recovery: {
    eligible: boolean;
    reason: "disagreement" | "timeout" | "stalled";
    detail: string;
    roundPhase: string | null;
    selection: { counterpart: "buyer" | "seller"; choice: "release" | "refund"; reason: "disagreement" | "timeout" | "stalled" } | null;
    authorisations: Partial<Record<"buyer" | "seller" | "mediator", true>>;
    options: Array<{ counterpart: "buyer" | "seller"; choice: "release" | "refund"; label: string }>;
  };
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function xmrAmount(atomic: string) {
  const value = atomic.padStart(13, "0");
  const whole = value.slice(0, -12).replace(/^0+(?=\d)/, "");
  const fraction = value.slice(-12).replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} XMR`;
}

function grossMediatorFee(atomic: string | null) {
  return atomic && /^\d+$/.test(atomic) ? (BigInt(atomic) / 100n).toString() : null;
}

function feeDisclosure(model: PageModel) {
  const plannedGross = grossMediatorFee(model.amountAtomic);
  const completed = model.settlementFee;
  if (completed) {
    const mediatorAmount = completed.mediator_amount_atomic ?? completed.mediator_net_amount_atomic ?? completed.mediator_gross_fee_atomic;
    return `<div><dt>Completed 1% mediator fee split</dt><dd class="mono">Recipient ${escapeHtml(xmrAmount(completed.recipient_amount_atomic))} · mediator (fixed 1%) ${escapeHtml(xmrAmount(mediatorAmount))} · network fee ${escapeHtml(xmrAmount(completed.network_fee_atomic))}</dd><dd class="small">The network fee was deducted from the settlement recipient output (seller on release).</dd></div>`;
  }
  return `<div><dt>Mediator fee policy</dt><dd class="mono">1% (${escapeHtml(plannedGross ? xmrAmount(plannedGross) : "Calculated at setup")}) is reserved for the mediator.</dd><dd class="small">The actual network fee is deducted from the settlement recipient output (seller on release).</dd></div>`;
}

function transactionLifecycle(inPool: boolean | null, observedHeight: number | null, kind: "funding" | "settlement") {
  const label = kind === "funding" ? "Funding" : "Settlement";
  if (inPool) return `${label} broadcast, in tx pool.`;
  if (observedHeight !== null) return `${label} confirmed at height ${observedHeight}.`;
  return `${label} broadcast; awaiting daemon observation.`;
}

function action(path: string, label: string, tone = "primary", confirmation?: string) {
  const confirm = confirmation ? ` onsubmit="return confirm('${escapeHtml(confirmation)}')"` : "";
  return `<form method="post" action="${path}"${confirm}><button class="${tone}" type="submit">${label}</button></form>`;
}

function backupButton(role: "buyer" | "seller" | "mediator", ready: boolean) {
  if (!ready) return `<button class="backup unavailable" type="button" disabled title="Available after FROST setup completes">FROST backup</button>`;
  return `<a class="backup ready" href="/backup/${role}" download>FROST backup</a>`;
}

function idle(message: string) {
  return `<p class="idle">${escapeHtml(message)}</p>`;
}

function fundingStatus(model: PageModel) {
  if (model.fundingInPool) return `<div class="funding scanning"><strong>Funding broadcast, in tx pool.</strong><span>The local daemon has not yet reported a confirmed block height.</span></div>`;
  if (model.status === "funded" || model.status === "paid_out") return `<div class="funding confirmed"><strong>Funds are in escrow.</strong><span>Funding confirmed at height ${escapeHtml(String(model.fundingObservedHeight ?? "—"))}.</span></div>`;
  if (model.status === "funding_broadcast") return `<div class="funding scanning"><strong>Escrow funding is updating automatically.</strong><span>Payment broadcast · ${escapeHtml(String(model.fundingConfirmations))} / 15 fakechain confirmations · scanning escrow wallet</span></div>`;
  return `<div class="funding pending"><strong>Awaiting escrow payment.</strong><span>The status updates automatically after the buyer pays.</span></div>`;
}

function fundingAdvanced(model: PageModel) {
  return model.actions.forceRescan ? `<details class="advanced"><summary>Advanced</summary><p>Use this only if the automatic escrow scan needs to be retried.</p>${action("/action/force-rescan", "Force wallet rescan", "secondary")}</details>` : "";
}

function disputeControls(model: PageModel) {
  if (!model.actions.disputeRelease) return idle("Mediator recovery becomes available only after escrow funding, disagreement, a policy timeout, or a stalled signer round.");
  const { recovery } = model;
  const trigger = recovery.reason === "disagreement" ? "Immediate disagreement" : recovery.reason === "timeout" ? "Independent policy timeout" : "Stalled signer round";
  if (recovery.selection) {
    const selected = recovery.selection;
    return `<section class="dispute"><div class="eyebrow">Mediator ruling recorded</div><p><strong>Eligibility trigger: ${escapeHtml(trigger)}.</strong> The mediator ruled ${escapeHtml(choiceLabel(selected.choice))}. This is the mediator’s final consent for the 3-of-5 recovery. Awaiting ${escapeHtml(selected.counterpart)} to review and sign.</p><p class="consent-note">No funds move until the selected ${escapeHtml(selected.counterpart)} contributes its two shares.</p><div class="ruling-notes"><span>${selected.counterpart} 2 + mediator 1 = 3</span><span>normal agreement remains mediator-free</span></div></section>`;
  }
  if (!recovery.eligible) return `<section class="dispute"><div class="eyebrow">Mediator recovery</div><p>${escapeHtml(recovery.detail)}</p></section>`;
  if (recovery.reason === "stalled" && recovery.roundPhase === "stalled") return `<section class="dispute"><div class="eyebrow">Signer round expired</div><p>${escapeHtml(recovery.detail)}</p><p class="consent-note">Resetting invalidates the expired round’s one-time FROST preprocessing state. It does not move funds.</p>${action("/action/recovery/reset-signers", "Reset signers", "neutral", "Invalidate the expired signer round and open eligible mediator recovery selection.")}</section>`;
  const options = recovery.options.map(option => action(`/action/recovery/select/${option.counterpart}/${option.choice}`, option.label, "neutral", `Select ${option.label.toLowerCase()} for this eligible recovery round.`)).join("");
  return `<details class="dispute" open><summary>Mediator recovery is eligible</summary><p><strong>Eligibility trigger: ${escapeHtml(trigger)}.</strong> ${escapeHtml(recovery.detail)} Only signer sets that match the recorded condition are available.</p><div class="rulings">${options}</div><div class="ruling-notes"><span>buyer 2 + mediator 1 = 3</span><span>seller 2 + mediator 1 = 3</span></div></details>`;
}

function choiceLabel(choice: "release" | "refund") {
  return choice === "release" ? "release to seller" : "refund to buyer";
}

function settlementControls(model: PageModel, role: "buyer" | "seller") {
  if (!model.actions.happyPayout) return idle(role === "buyer" ? "Buyer setup is complete." : "The seller step unlocks after escrow funding is confirmed.");
  const recovery = model.recovery.selection;
  if (recovery?.counterpart === role) {
    const authorised = model.recovery.authorisations[role];
    return `<section class="settlement-consent"><div class="eyebrow">${role} recovery signature</div><p>The mediator ruled ${escapeHtml(choiceLabel(recovery.choice))} after ${escapeHtml(recovery.reason)}. Review the outcome, then sign with your two local shares to begin the real 3-of-5 recovery round.</p>${authorised ? '<p class="consent-note">Your signer has joined the recovery round. Real FROST relay activity is now recorded in the terminal.</p>' : action(`/action/recovery/authorise/${role}`, `Sign ${choiceLabel(recovery.choice)}`, "primary", `Sign your ${role} shares for ${choiceLabel(recovery.choice)}. This starts the 3-of-5 recovery with the mediator’s final ruling.`)}<div class="ruling-notes"><span>${role} 2 + mediator 1 = 3</span><span>normal agreement remains mediator-free</span></div></section>`;
  }
  const counterpart = role === "buyer" ? "seller" : "buyer";
  const selection = model.happyConsents[role];
  const counterpartSelection = model.happyConsents[counterpart];
  if (!selection || counterpartSelection !== selection) {
    const status = selection
      ? `You signed ${choiceLabel(selection)}. Awaiting ${counterpart} to sign the same outcome.`
      : `Choose the settlement outcome you are ready to sign.`;
    return `<section class="settlement-consent"><div class="eyebrow">${role} settlement signature</div><p>${escapeHtml(status)}</p><p class="consent-note">This is your final outcome-specific signing consent. When buyer and seller sign the same outcome, their two isolated role hosts automatically begin the real four-share FROST round.</p><div class="rulings">${action(`/action/happy-consent/${role}/release`, "Sign release to seller", "neutral", `Sign your ${role} consent to release escrow to seller. If the other role has signed the same outcome, the real four-share FROST round starts immediately.`)}${action(`/action/happy-consent/${role}/refund`, "Sign refund to buyer", "neutral", `Sign your ${role} consent to refund escrow to buyer. If the other role has signed the same outcome, the real four-share FROST round starts immediately.`)}</div><div class="ruling-notes"><span>buyer 2 + seller 2 = 4 ≥ 3</span><span>mediator not needed for agreement</span></div></section>`;
  }
  return `<section class="settlement-consent"><div class="eyebrow">Settlement in progress</div><p>Buyer and seller signed ${escapeHtml(choiceLabel(selection))}. Keep the selected role clients available while the terminal records real preprocessing, signing, completion, and broadcast messages.</p><div class="ruling-notes"><span>buyer 2 + seller 2 = 4 ≥ 3</span><span>mediator not needed for agreement</span></div></section>`;
}

function backupWarning() {
  return `<section class="backup-warning"><strong>Make sure to backup your FROST file. If you lose it, your funds cannot be recovered.</strong><span>Your FROST backup belongs to its local signer role and is never sent to a remote platform server.</span></section>`;
}

function workflow(model: PageModel) {
  const { actions, session, amountAtomic } = model;
  const amountDisplay = amountAtomic ? `${xmrAmount(amountAtomic)} <span class="atomic">(${escapeHtml(amountAtomic)} atomic units)</span>` : "Random 0.5–10 XMR selected when initialization begins.";
  const initializing = model.status === "initializing";
  const buyerAction = initializing
    ? `<div class="initializing"><strong>Initializing now.</strong> ${escapeHtml(model.setupStage ?? "Preparing the first setup stage")}${model.setupStageElapsed ? `<span class="stage-age">current stage ${escapeHtml(model.setupStageElapsed)}</span>` : ""}<p>Setup continues in the background. A timeout or cancellation creates a read-only diagnostic export.</p>${action("/action/cancel-setup", "Cancel initialization", "secondary")}${model.diagnosticAvailable ? '<a class="diagnostic-link" href="/diagnostic">Download latest initialization diagnostic</a>' : ""}</div>`
    : actions.setup
      ? `${action("/action/setup", "Initialize 3-of-5 escrow")}${model.diagnosticAvailable ? '<a class="diagnostic-link" href="/diagnostic">Download latest initialization diagnostic</a>' : ""}`
      : actions.fund
        ? action("/action/fund", "Pay into escrow")
        : actions.happyPayout
          ? settlementControls(model, "buyer")
          : idle(model.status === "funding_broadcast" ? "Payment is being checked automatically." : model.status === "funded" ? "Escrow funding is confirmed." : "Buyer setup is complete.");
  const sellerAction = settlementControls(model, "seller");
  return `<div id="workflow-root" class="workflow-cards">
    <article class="pane buyer"><div class="card-top"><div class="eyebrow">Buyer · two shares</div>${backupButton("buyer", model.backupReady)}</div><h2>${initializing ? "Establishing the shared address." : actions.setup ? "Establish the shared address." : "Fund the shared address."}</h2>
      <dl><div><dt>Buyer wallet address</dt><dd class="mono">${escapeHtml(model.buyerAddress ?? "Loaded during setup")}</dd></div><div><dt>Escrow address</dt><dd class="mono">${escapeHtml(session?.escrow_address ?? "Created during setup")}</dd></div><div><dt>Escrow amount</dt><dd class="mono">${amountDisplay}</dd></div>${feeDisclosure(model)}${model.fundingTxHash ? `<div><dt>Funding transaction ID</dt><dd class="mono">${escapeHtml(model.fundingTxHash)}</dd><dd class="small">${escapeHtml(transactionLifecycle(model.fundingInPool, model.fundingObservedHeight, "funding"))} · <a class="verify-link" href="/verify?tx=funding">Verify on fakechain</a></dd></div>` : ""}</dl>${buyerAction}
      <p class="disclosure">Buyer shares 1–2 are retained by the buyer’s isolated local signer host. The coordinator receives only public protocol artifacts.</p><p class="disclosure">Regtest note: <code>generateblocks</code> advances fakechain confirmations; it does not represent real block timing.</p>
    </article>
    <article class="pane seller"><div class="card-top"><div class="eyebrow">Seller · two shares</div>${backupButton("seller", model.backupReady)}</div><h2>Escrow funding updates automatically.</h2>${fundingStatus(model)}
      <dl><div><dt>Merchant wallet address</dt><dd class="mono">${escapeHtml(session?.merchant_address ?? "Created during setup")}</dd></div><div><dt>FROST group public key</dt><dd class="mono">${escapeHtml(session?.group_key ?? "Created during setup")}</dd></div><div><dt>Role-host signer allocation</dt><dd class="mono">${model.thresholdKeyCount ? "buyer 1–2 · seller 3–4 · coordinator holds no threshold keys" : "Awaiting setup"}</dd></div>${model.payoutTxHash ? `<div><dt>Settlement transaction ID</dt><dd class="mono">${escapeHtml(model.payoutTxHash)}</dd><dd class="small">${escapeHtml(transactionLifecycle(model.payoutInPool, model.payoutObservedHeight, "settlement"))} · <a class="verify-link" href="/verify?tx=payout">Verify on fakechain</a></dd></div>` : ""}</dl>${sellerAction}${fundingAdvanced(model)}
    </article>
  </div>
  <section class="mediator"><div class="mediator-copy"><div class="card-top"><div class="eyebrow">Mediator · one isolated share</div>${backupButton("mediator", model.backupReady)}</div><h2>Not needed for a normal escrow.</h2><p>Buyer and seller can prepare, fund, agree an outcome, and complete settlement without the mediator being online. The mediator is contacted only for disagreement, timeout, or signer recovery.</p><p class="custody-note">Public DKG key: <code>${escapeHtml(model.publicKeys[4] ?? "Created during setup")}</code>. Public payout address: <code>${escapeHtml(model.mediatorPayoutAddress ?? "Registered during setup")}</code>. Every completed settlement includes a fixed 1% mediator output; its network fee is deducted from the settlement recipient output (seller on release). Process state: <strong>${escapeHtml(model.mediator.state)}</strong>. ${escapeHtml(model.mediator.lastTransition)}</p></div><div class="mediator-control">${disputeControls(model)}</div></section>`;
}

function completedSummary(model: PageModel) {
  const mode = model.session?.payout_mode;
  const refund = mode === "happy-refund" || mode === "recovery-buyer-refund" || mode === "recovery-seller-refund";
  const recovery = mode?.startsWith("recovery-") ?? false;
  const settlementPath = mode === "happy-refund" ? "Buyer and seller coordinated refund" : mode === "happy-release" ? "Buyer and seller coordinated release" : mode === "recovery-buyer-refund" ? "Buyer plus mediator recovery refund" : mode === "recovery-buyer-release" ? "Buyer plus mediator recovery release" : mode === "recovery-seller-refund" ? "Seller plus mediator recovery refund" : "Seller plus mediator recovery release";
  const payoutLifecycle = transactionLifecycle(model.payoutInPool, model.payoutObservedHeight, "settlement");
  return `<div id="workflow-root" class="workflow-cards"><article class="pane completed buyer"><div class="card-top"><div class="eyebrow">Buyer · two shares</div>${backupButton("buyer", model.backupReady)}</div><h2>${refund ? "Buyer refund broadcast." : "Escrow payment completed."}</h2><dl><div><dt>Escrow address</dt><dd class="mono">${escapeHtml(model.session?.escrow_address ?? "—")}</dd></div>${feeDisclosure(model)}<div><dt>Funding transaction</dt><dd class="mono">${escapeHtml(model.fundingTxHash ?? "—")}</dd><dd class="small">${escapeHtml(transactionLifecycle(model.fundingInPool, model.fundingObservedHeight, "funding"))} · <a class="verify-link" href="/verify?tx=funding">Verify on fakechain</a></dd></div></dl></article><article class="pane completed seller"><div class="card-top"><div class="eyebrow">Seller · two shares</div>${backupButton("seller", model.backupReady)}</div><h2>${escapeHtml(payoutLifecycle)}</h2><dl><div><dt>Settlement transaction</dt><dd class="mono">${escapeHtml(model.payoutTxHash ?? "—")}</dd><dd class="small">${escapeHtml(payoutLifecycle)} · <a class="verify-link" href="/verify?tx=payout">Verify on fakechain</a></dd></div><div><dt>Settlement path</dt><dd>${settlementPath}</dd></div></dl></article></div><section class="mediator completed mediator"><div class="mediator-copy"><div class="card-top"><div class="eyebrow">Mediator · one isolated share</div>${backupButton("mediator", model.backupReady)}</div><h2>${recovery ? "Participated once, then exited." : "Remained absent for the complete happy path."}</h2><p>${recovery ? "The isolated mediator host ran only for the eligible recovery outcome and exited after returning its share." : "No mediator secret was loaded during setup, funding, detection, or coordinated settlement. Its separately registered public address received the 1% settlement output."}</p></div><a class="audit-link" href="/audit">Inspect full audit</a></section>`;
}

function publicTechnicalDetails(model: PageModel) {
  const keyRows = model.publicKeys.length ? model.publicKeys.map((key, index) => `<li><span>${index < 2 ? `Buyer public DKG key ${index + 1}` : index < 4 ? `Seller public DKG key ${index - 1}` : "Mediator public DKG key"}</span><code>${escapeHtml(key)}</code></li>`).join("") : '<li><span>Public DKG material</span><code>Available after initialization.</code></li>';
  const amount = model.amountAtomic ? xmrAmount(model.amountAtomic) : "Selected at initialization";
  return `<details id="public-details" class="technical"><summary>Public protocol and transaction details</summary><p>These values are suitable for illustration and audit. Private FROST shares, mediator material, and wallet secrets remain redacted.</p><dl class="technical-grid"><div><dt>Threshold configuration</dt><dd>3 of 5 · buyer 2 · seller 2 · mediator 1</dd></div><div><dt>Escrow amount</dt><dd class="mono">${escapeHtml(amount)}</dd></div><div><dt>Mediator fee policy</dt><dd>Fixed 1% separate mediator output; network fee deducted from settlement recipient output (seller on release)</dd></div><div><dt>Mediator payout address</dt><dd class="mono">${escapeHtml(model.mediatorPayoutAddress ?? "—")}</dd></div><div><dt>Escrow address</dt><dd class="mono">${escapeHtml(model.session?.escrow_address ?? "—")}</dd></div><div><dt>Group public key</dt><dd class="mono">${escapeHtml(model.session?.group_key ?? "—")}</dd></div></dl><h3>Five public DKG keys</h3><ul class="key-list">${keyRows}</ul></details>`;
}

function activityPanel(model: PageModel) {
  const entries = model.activityEntries.length ? model.activityEntries.map(entry => activityEntry(entry)).join("") : '<li class="activity-empty">No protocol event has been observed yet.</li>';
  return `<section class="logs terminal-console" aria-label="Live protocol terminal"><header><div class="terminal-session"><span class="command-prompt">frost@regtest:~/escrow/protocol$</span><span class="terminal-cursor" aria-hidden="true">▍</span></div><div class="terminal-controls"><span id="live-state">[ live ]</span><button id="pause-live" type="button" class="terminal-button">[ pause ]</button></div></header><div class="terminal-command"><span class="command-prompt">$</span><span> tail -n 30 -f role-relay.log</span></div><div id="new-events" class="new-events" hidden></div><ol id="activity-list" class="activity-list">${entries}</ol><footer class="terminal-footer"><span class="command-prompt">frost@regtest:~/escrow/protocol$</span></footer></section>`;
}

function activityEntry(entry: string) {
  const parsed = entry.match(/^\[(buyer|seller|mediator|chain)\]\s+(.*)$/);
  const role = parsed?.[1] ?? "system";
  const line = parsed?.[2] ?? entry;
  return `<li class="activity-entry"><span class="activity-role activity-${escapeHtml(role)}">[${escapeHtml(role)}]</span><span class="event-prompt">›</span><code>${escapeHtml(line)}</code></li>`;
}

function liveTerminalScript() {
  return `<style>
  :root{--ink:#eaf3ea;--paper:#101310;--green:#39a875;--red:#c94a45;--gold:#d59342;--line:#425047;--muted:#a5b7a9;--terminal:#07120e}body{background:#0d100d;color:var(--ink);isolation:isolate}body:before{content:"";position:fixed;inset:0;z-index:-2;background:linear-gradient(90deg,rgba(7,11,9,.97) 0%,rgba(9,13,11,.93) 42%,rgba(8,12,10,.68) 100%),url('/manus-storage/monero-frost-background_6d8f609e.webp') right 5% top 42%/auto 94vh no-repeat;background-attachment:fixed}body:after{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(circle at 15% 0,rgba(51,168,117,.12),transparent 34%),linear-gradient(180deg,rgba(6,9,7,.18),rgba(6,9,7,.62))}.shell{position:relative;z-index:1;max-width:1600px}.lede{color:#c7d5ca}.status,.stage{background:rgba(16,22,18,.86);border-color:#4a584e;color:#c8d6ca}.stage.active{background:var(--green);border-color:var(--green)}.stage.done{color:#70c591;border-color:#5b9c70}.panes{display:contents}.dashboard{display:grid;grid-template-columns:minmax(280px,1fr) minmax(360px,1.22fr) minmax(280px,1fr);gap:16px;align-items:stretch;margin-top:28px}.workflow-cards{display:contents}.buyer{grid-column:1;grid-row:1}.seller{grid-column:3;grid-row:1}.logs{grid-column:2;grid-row:1;margin:0;max-height:640px;display:flex;flex-direction:column}.logs .activity-list{overflow:auto;min-height:0}.pane,.mediator,.logs,.technical,.backup-warning{background:rgba(12,18,14,.88);border-color:#3e4c43;box-shadow:0 16px 40px rgba(0,0,0,.26)}.pane{padding:24px}.pane h2,.mediator h2{color:#f3f8f3}.eyebrow{color:#7bd5a0}.mono,.key-list code{color:#a9e2bc}dt,.small,.atomic{color:#9caea1}dl>div,.key-list li{border-color:#2f3c34}.funding{background:rgba(78,58,25,.45);border-color:#d59342}.funding span{color:#ead9b4}.funding.confirmed{background:rgba(34,100,65,.36);border-color:#55c47d}.funding.confirmed span{color:#bce8c9}.idle,.mediator p,.technical>p{color:#b7c8b9}.backup.ready{background:#2f9e6c;box-shadow:0 3px 0 #145735}.backup.unavailable{background:#bd4844;box-shadow:0 3px 0 #6d211f}.backup-warning{grid-column:1/-1;grid-row:2;margin:0;background:rgba(45,22,20,.72);border-color:#753632}.mediator{grid-column:1/-1;grid-row:3;margin:0;background:rgba(14,20,16,.9)}.technical{background:rgba(12,18,14,.88)}.technical summary,.advanced summary,.dispute summary{color:#e8c277}.custody-note{background:rgba(32,43,35,.74);border-color:#46574a}.dispute{background:rgba(45,35,19,.62);border-color:#785f32}.activity-entry{border-color:#1d3b2d}.logs{border-color:#315342}.terminal-button{background:#1e4534;border-color:#40715a}.new-events{background:#163b2d}.activity-role.activity-chain{background:#2f6f88}.disclosure{color:#a5b7a9;font-size:12px}.dashboard + .technical{margin-top:18px}@media(max-width:1100px){.dashboard{grid-template-columns:1fr 1fr}.buyer{grid-column:1;grid-row:1}.seller{grid-column:2;grid-row:1}.logs{grid-column:1/-1;grid-row:2;max-height:480px}.backup-warning{grid-row:3}.mediator{grid-row:4}}@media(max-width:760px){body:before{background:linear-gradient(180deg,rgba(7,11,9,.95),rgba(9,13,11,.82)),url('/manus-storage/monero-frost-background_6d8f609e.webp') center 8%/auto 60vh no-repeat}.dashboard{grid-template-columns:1fr}.buyer,.seller,.logs,.backup-warning,.mediator{grid-column:1;grid-row:auto}.logs{max-height:420px}}
  </style><style>
  .backup-warning{margin:20px 0 0;background:rgba(45,22,20,.72);border-color:#753632}.dashboard{margin-top:16px}.mediator{grid-row:2}.settlement-consent{margin-top:18px;border:1px solid #785f32;border-radius:8px;padding:12px;background:rgba(45,35,19,.62)}.settlement-consent p{color:#d8e6da;font-size:13px}.settlement-consent .consent-note{color:#b7c8b9}.settlement-consent .rulings{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.settlement-consent .rulings form{margin:0}.settlement-consent .rulings button{margin:0}.kali-terminal{border:1px solid #245081!important;border-radius:10px!important;background:linear-gradient(135deg,#040812 0%,#07101d 48%,#050711 100%)!important;box-shadow:0 18px 48px rgba(1,6,19,.55),inset 0 1px 0 rgba(123,197,255,.18)!important;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow:hidden}.kali-terminal:before{content:"";position:absolute;pointer-events:none;inset:0;background:linear-gradient(90deg,rgba(54,123,240,.05),transparent 26%,rgba(158,72,255,.045));mix-blend-mode:screen}.kali-terminal header{position:relative;min-height:54px;padding:0 14px!important;background:linear-gradient(90deg,rgba(19,39,73,.95),rgba(8,17,31,.98));border-bottom:1px solid #245081!important}.terminal-chrome{display:flex;align-items:center;gap:7px;min-width:0}.terminal-light{width:10px;height:10px;border-radius:50%;box-shadow:0 0 8px currentColor}.terminal-light.red{color:#ef5c79;background:#ef5c79}.terminal-light.amber{color:#f6bd60;background:#f6bd60}.terminal-light.green{color:#52d38c;background:#52d38c}.terminal-title{margin-left:8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:12px ui-monospace,SFMono-Regular,monospace;color:#96c9ff}.terminal-title b{color:#70f0d1}.terminal-controls{color:#72e5ff!important}.terminal-button{background:#173a64!important;border-color:#326aa4!important;color:#c9edff!important;border-radius:4px!important;font-family:ui-monospace,SFMono-Regular,monospace!important}.terminal-command{position:relative;padding:11px 16px 10px;border-bottom:1px solid rgba(63,119,180,.45);color:#c6d8ee;background:rgba(2,7,16,.72);font:11px/1.4 ui-monospace,SFMono-Regular,monospace}.command-prompt{color:#72f0d0;font-weight:700}.kali-terminal .activity-list{position:relative;background:repeating-linear-gradient(0deg,rgba(92,162,241,.018) 0,rgba(92,162,241,.018) 1px,transparent 1px,transparent 25px)}.kali-terminal .activity-entry{grid-template-columns:76px 12px minmax(0,1fr)!important;gap:9px!important;padding:12px 15px!important;border-bottom:1px solid rgba(54,105,162,.3)!important}.kali-terminal .activity-entry:hover{background:rgba(49,111,195,.09)}.kali-terminal .activity-entry code{color:#d1e7ff!important;font-size:11.5px!important}.event-prompt{color:#46b6ff;font-weight:800}.kali-terminal .activity-role{border-radius:3px!important;font-family:ui-monospace,SFMono-Regular,monospace;font-size:9px!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}.kali-terminal .activity-role.activity-buyer{background:#226e71!important}.kali-terminal .activity-role.activity-seller{background:#355f9d!important}.kali-terminal .activity-role.activity-mediator{background:#7a478d!important}.kali-terminal .activity-role.activity-chain{background:#2b7998!important}.kali-terminal .new-events{background:#123b61!important;color:#bcf1ff!important;font-family:ui-monospace,SFMono-Regular,monospace}.terminal-footer{display:flex;justify-content:space-between;gap:12px;padding:9px 15px;border-top:1px solid rgba(63,119,180,.45);background:#07101c;color:#7197bd;font:9px ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em}.kali-terminal .activity-empty{color:#83a6c8!important}@media(max-width:1100px){.mediator{grid-row:3}}@media(max-width:760px){.mediator{grid-row:auto}.terminal-title{max-width:165px}.terminal-footer{font-size:8px}.kali-terminal .activity-entry{grid-template-columns:70px 10px minmax(0,1fr)!important}}
  </style><style>
  .terminal-console{border:0!important;border-radius:0!important;background:#030603!important;box-shadow:none!important;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow:hidden}.terminal-console:before{display:none}.terminal-console header{position:relative;min-height:39px;padding:10px 14px!important;background:#030603!important;border:0!important;border-bottom:1px solid #183526!important}.terminal-session{display:flex;min-width:0;align-items:center;gap:5px;font:11px ui-monospace,SFMono-Regular,monospace}.terminal-console .terminal-controls{gap:8px;color:#93b697!important;font:10px ui-monospace,SFMono-Regular,monospace}.terminal-console .terminal-button{margin:0;padding:0;background:transparent!important;border:0!important;border-radius:0!important;color:#93b697!important;box-shadow:none!important;font:10px ui-monospace,SFMono-Regular,monospace!important}.terminal-console .terminal-button:hover{color:#d4f3d8!important;text-decoration:underline}.terminal-console .terminal-command{padding:8px 14px;background:#030603;border:0;border-bottom:1px solid #102719;color:#94ad96;font:10.5px/1.4 ui-monospace,SFMono-Regular,monospace}.terminal-console .command-prompt{color:#82e69a;font-weight:700}.terminal-cursor{color:#82e69a;animation:terminalBlink 1s steps(1) infinite}.terminal-console .activity-list{background:#030603}.terminal-console .activity-entry{grid-template-columns:78px 10px minmax(0,1fr)!important;gap:8px!important;padding:9px 14px!important;border:0!important}.terminal-console .activity-entry:hover{background:#071009}.terminal-console .activity-entry code{color:#c4d8c5!important;font-size:11px!important}.terminal-console .activity-role{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;text-align:left!important;font:10px ui-monospace,SFMono-Regular,monospace!important;letter-spacing:0!important}.terminal-console .activity-role.activity-buyer{color:#7fd7a1!important}.terminal-console .activity-role.activity-seller{color:#9ab9e5!important}.terminal-console .activity-role.activity-mediator{color:#d3a2e2!important}.terminal-console .activity-role.activity-chain{color:#8cd4dc!important}.terminal-console .event-prompt{color:#82e69a}.terminal-console .new-events{padding:7px 14px;background:#071009!important;color:#a4d6a9!important;font:10px ui-monospace,SFMono-Regular,monospace}.terminal-console .terminal-footer{display:flex;gap:5px;padding:8px 14px;border:0;border-top:1px solid #102719;background:#030603;color:#82e69a;font:10px ui-monospace,SFMono-Regular,monospace;letter-spacing:0}.terminal-console .activity-empty{padding:14px;color:#718c74!important;font:11px ui-monospace,SFMono-Regular,monospace}@keyframes terminalBlink{50%{opacity:0}}@media(max-width:760px){.terminal-console .activity-entry{grid-template-columns:72px 10px minmax(0,1fr)!important}.terminal-console .terminal-footer{font-size:9px}}
  .status-row .status:not(:first-child){display:none!important}.verify-link{color:#9be6ad;font-weight:750;text-decoration:underline;text-underline-offset:3px}
  </style><style>
  :root{--monero-orange:#ff6600;--monero-orange-deep:#c84f00;--monero-white:#f7f4ef;--monero-ink:#070707;--monero-panel:#111111;--monero-panel-raised:#171717;--monero-line:#393939;--monero-muted:#bdb8b0;--monero-error:#b54231}
  body{background:var(--monero-ink)!important;color:var(--monero-white)!important}body:before{background:linear-gradient(90deg,rgba(7,7,7,.98) 0%,rgba(7,7,7,.93) 41%,rgba(7,7,7,.66) 71%,rgba(7,7,7,.44) 100%),radial-gradient(circle at 86% 4%,rgba(255,102,0,.1),transparent 34%),url('/manus-storage/monerochan-frost-supplied_be562d67.webp') right -7vw top 4vh/auto 104vh no-repeat,linear-gradient(155deg,#111 0%,#080808 52%,#030303 100%)!important;background-attachment:fixed}body:after{background:linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.28))!important}.lede,.idle,.mediator p,.technical>p,.disclosure,.small,.atomic,dt{color:var(--monero-muted)!important}.eyebrow,.command-prompt,.terminal-cursor,.event-prompt{color:var(--monero-orange)!important}.stage,.status{background:#141414!important;border-color:#484848!important;color:#ddd8d0!important}.stage.done{color:#f0b487!important;border-color:#a64d1c!important}.stage.active{background:var(--monero-orange)!important;border-color:var(--monero-orange)!important;color:#080808!important}.pane,.mediator,.logs,.technical,.backup-warning{background:rgba(17,17,17,.94)!important;border-color:var(--monero-line)!important;box-shadow:0 16px 42px rgba(0,0,0,.4)!important}.seller,.mediator{background:linear-gradient(90deg,rgba(17,17,17,.94),rgba(17,17,17,.72))!important}.backup-warning{background:rgba(72,24,17,.72)!important;border-color:#a84a32!important}.backup.ready,button:not(.terminal-button){background:var(--monero-orange)!important;box-shadow:0 3px 0 var(--monero-orange-deep)!important;color:#080808!important}.backup.unavailable{background:var(--monero-error)!important;box-shadow:0 3px 0 #672118!important;color:#fff!important}.secondary{background:#5b3421!important;box-shadow:0 3px 0 #31180e!important;color:#fff!important}.neutral{background:#242424!important;border:1px solid #a14a1c!important;box-shadow:0 3px 0 #101010!important;color:var(--monero-white)!important}.funding,.funding.confirmed{background:rgba(255,102,0,.12)!important;border-color:var(--monero-orange)!important}.funding span,.funding.confirmed span{color:#f0c5a5!important}.settlement-consent,.dispute{background:rgba(72,38,18,.5)!important;border-color:#9d5828!important}.settlement-consent p,.settlement-consent .consent-note,.custody-note{color:#e6e0d8!important}.custody-note{background:#191817!important;border-color:#4b4139!important}.verify-link,.diagnostic-link,.audit-link{color:#ff923f!important}.terminal-console,.terminal-console header,.terminal-console .terminal-command,.terminal-console .activity-list,.terminal-console .terminal-footer{background:#050505!important}.terminal-console header{border-bottom-color:#54260f!important}.terminal-console .terminal-command,.terminal-console .terminal-footer{border-color:#39200f!important}.terminal-console .terminal-button{color:#f0c099!important}.terminal-console .terminal-button:hover{color:var(--monero-orange)!important}.terminal-console .activity-entry:hover{background:#17100b!important}.terminal-console .activity-entry code{color:#f0ece6!important}.terminal-console .activity-role.activity-buyer{color:#ff8f45!important}.terminal-console .activity-role.activity-seller{color:#f6f2eb!important}.terminal-console .activity-role.activity-mediator{color:#e1a16e!important}.terminal-console .activity-role.activity-chain{color:#d9b49a!important}.terminal-console .new-events{background:#26150c!important;color:#f6c59e!important}.terminal-console .activity-empty{color:#9e958b!important}.ruling-notes span{color:#d9a077!important}.key-list code,.mono{color:#f1c39f!important}.terminal-console .terminal-controls{color:#d5a17d!important}@media(max-width:760px){body:before{background:linear-gradient(180deg,rgba(7,7,7,.72),rgba(7,7,7,.95) 72%),url('/manus-storage/monerochan-frost-supplied_be562d67.webp') center top/auto 88vh no-repeat,#070707!important}.seller,.mediator{background:rgba(17,17,17,.94)!important}}
  </style><script>
  (() => {
    const list = document.getElementById('activity-list'); const pause = document.getElementById('pause-live'); const state = document.getElementById('live-state'); const notice = document.getElementById('new-events'); if (!list || !pause || !state || !notice) return;
    let paused = false, unread = 0, refreshTimer;
    const prepend = entry => { const match = entry.match(/^\\[(buyer|seller|mediator|chain)\\]\\s+(.*)$/); const row = document.createElement('li'); row.className = 'activity-entry'; const role = document.createElement('span'); role.className = 'activity-role activity-' + (match ? match[1] : 'system'); role.textContent = match ? match[1] : 'system'; const prompt = document.createElement('span'); prompt.className = 'event-prompt'; prompt.textContent = '›'; const text = document.createElement('code'); text.textContent = match ? match[2] : entry; row.append(role, prompt, text); list.prepend(row); };
    const updateNotice = () => { notice.hidden = unread === 0; notice.textContent = unread ? unread + ' new event' + (unread === 1 ? '' : 's') + ' · jump to newest' : ''; };
    const refreshState = async () => { const markup = await fetch('/', { cache: 'no-store' }).then(response => response.text()).catch(() => ''); if (!markup) return; const parsed = new DOMParser().parseFromString(markup, 'text/html'); for (const selector of ['#live-summary','#workflow-root','.backup-warning','.mediator','#public-details']) { const current = document.querySelector(selector); const next = parsed.querySelector(selector); const wasPublicDetailsOpen = selector === '#public-details' && current instanceof HTMLDetailsElement && current.open; if (current && next) { current.replaceWith(next); if (wasPublicDetailsOpen && next instanceof HTMLDetailsElement) next.open = true; } } };
    const scheduleRefresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshState, 120); };
    window.setInterval(refreshState, 4000);
    pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; state.textContent = paused ? 'Ⅱ PAUSED' : '● LIVE'; state.classList.toggle('paused', paused); });
    notice.addEventListener('click', () => { unread = 0; updateNotice(); window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - 18, behavior: 'smooth' }); });
    document.addEventListener('submit', async event => { const form = event.target; if (!(form instanceof HTMLFormElement) || event.defaultPrevented || form.method.toLowerCase() !== 'post') return; event.preventDefault(); const button = form.querySelector('button'); if (button) button.disabled = true; await fetch(form.action, { method: 'POST', redirect: 'manual' }).catch(() => undefined); scheduleRefresh(); });
    const events = new EventSource('/events'); events.addEventListener('protocol', message => { const payload = JSON.parse(message.data); if (payload.entry && !paused) prepend(payload.entry); else if (payload.entry) { unread++; updateNotice(); } scheduleRefresh(); }); events.addEventListener('state', scheduleRefresh);
  })();
  </script>`;
}

export function renderEscrowPage(model: PageModel) {
  const completed = model.status === "paid_out";
  const stages = ["Preparation", "Funding", "Decision", "Settlement"];
  const active = completed ? 3 : model.status === "funded" ? 2 : ["funding_broadcast"].includes(model.status) ? 1 : 0;
  const stageMarkup = stages.map((stage, index) => `<span class="stage ${index === active ? "active" : index < active ? "done" : ""}">${stage}</span>`).join("<i>—</i>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FROST 3-of-5 Monero Escrow Demo</title><style>
  :root{--ink:#12251f;--paper:#f7f4ed;--green:#285940;--red:#b7413e;--gold:#af7b2c;--line:#cad7ca;--muted:#607369;--terminal:#10221d}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,#eaf1e8,transparent 36%),var(--paper);color:var(--ink);font:15px/1.45 ui-sans-serif,system-ui,sans-serif}.shell{max-width:1220px;margin:auto;padding:42px 24px 56px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--green);font-weight:750}h1{font:500 clamp(35px,5vw,64px)/.96 Georgia,serif;margin:12px 0 14px;letter-spacing:-.04em}.lede{max-width:760px;font-size:17px;color:#486057}.stages{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:24px}.stage{padding:7px 10px;border-radius:999px;border:1px solid var(--line);font-size:12px;font-weight:750;color:#718178;background:#fff}.stage.active{color:#fff;background:var(--green);border-color:var(--green)}.stage.done{color:var(--green);border-color:#83a98b}.stages i{color:#99a79d;font-style:normal}.status-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.status{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:13px}.panes{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:28px}.pane,.mediator,.logs,.technical,.backup-warning{border:1px solid var(--line);background:rgba(255,255,255,.78);box-shadow:0 14px 32px rgba(35,65,48,.07)}.pane{padding:28px;min-width:0}.pane h2,.mediator h2{font:500 30px/1.1 Georgia,serif;margin:14px 0 20px}.buyer{border-top:4px solid #6a936f}.seller{border-top:4px solid var(--gold)}.card-top{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}.backup{display:inline-block;flex:0 0 auto;text-decoration:none;border:0;border-radius:6px;padding:8px 10px;font:750 12px ui-sans-serif,system-ui;color:#fff;white-space:nowrap}.backup.ready{background:var(--green);box-shadow:0 3px 0 #173525}.backup.unavailable{background:var(--red);box-shadow:0 3px 0 #6d211f;cursor:not-allowed;opacity:.92}dl{margin:0}dl>div{padding:12px 0;border-bottom:1px solid #e5ebe3}dt{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#6b786f}dd{margin:5px 0 0}.small,.atomic{font-size:12px;color:var(--muted)}.mono{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;overflow-wrap:anywhere;color:#2f4d3e}form{display:inline-block;margin:0 8px 0 0}button{margin-top:20px;border:0;background:var(--green);color:#fff;border-radius:7px;padding:12px 15px;font:650 14px inherit;cursor:pointer;box-shadow:0 4px 0 #173525}button:active{transform:translateY(2px);box-shadow:0 2px 0 #173525}button:disabled{cursor:not-allowed}.secondary{background:#765213;box-shadow:0 3px 0 #4a3517}.neutral{background:#52675b;box-shadow:0 3px 0 #304338}.idle{margin:22px 0 0;color:var(--muted)}.initializing{margin:22px 0 0;padding:14px;border-left:3px solid var(--gold);background:#fff9e9;color:#5c431c;font-weight:650}.initializing p{margin:8px 0 0;font-weight:400}.stage-age{display:inline-block;margin-left:6px;font:12px ui-monospace,SFMono-Regular,monospace;color:#765213}.diagnostic-link{display:inline-block;margin:14px 0 0;color:var(--green);font-size:13px}.funding{margin:0 0 16px;padding:12px 14px;border-left:4px solid var(--gold);background:#fff9e9}.funding strong,.funding span{display:block}.funding span{font-size:13px;color:#5c431c}.funding.confirmed{border-color:var(--green);background:#eef6ee}.funding.confirmed span{color:#315c38}.advanced{margin-top:16px;font-size:13px}.advanced summary,.dispute summary,.technical summary{cursor:pointer;font-weight:750;color:#5c431c}.advanced p,.dispute p{margin:8px 0}.mediator{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(290px,.85fr);gap:22px;align-items:start;padding:24px 28px;margin-top:18px;border-left:5px solid var(--gold)}.mediator-copy,.mediator-control{min-width:0}.mediator h2{font-size:25px;overflow-wrap:anywhere}.mediator p{margin:0;color:#486057;overflow-wrap:anywhere}.custody-note{margin-top:12px!important;padding:10px 12px;background:#f3f6f2;border:1px solid #dbe5da;font-size:13px}.custody-note code{overflow-wrap:anywhere}.dispute{border:1px solid #d8c291;border-radius:8px;padding:10px 12px;background:#fffaf0}.rulings{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.rulings form{margin:0}.rulings button{margin:0}.ruling-notes{display:flex;gap:18px;flex-wrap:wrap;font:11px ui-monospace,SFMono-Regular,monospace;color:#6b786f;margin-top:7px}.backup-warning{margin-top:18px;padding:14px 17px;border-left:4px solid var(--red);background:#fff7f5}.backup-warning strong,.backup-warning span{display:block}.backup-warning span{font-size:13px;color:#6a403a;margin-top:4px}.completed{border-top-color:var(--green)}.audit-link{display:inline-block;margin-top:14px;color:var(--green);font-weight:750}.technical{margin-top:18px;padding:20px 24px}.technical>p{color:#486057;max-width:940px}.technical h3{font:500 21px Georgia,serif;margin:20px 0 8px}.technical-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}.key-list,.activity-list{list-style:none;padding:0;margin:0}.key-list li{padding:11px 0;border-bottom:1px solid #e5ebe3}.key-list span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6b786f}.key-list code{display:block;margin-top:4px;overflow-wrap:anywhere;color:#2f4d3e}.logs{margin-top:18px;background:var(--terminal);border-color:#274237;color:#dceadf;overflow:hidden}.logs header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:17px 22px;border-bottom:1px solid #274237}.logs .eyebrow{color:#9bc7a5}.logs h2{font:500 24px Georgia,serif;margin:0}.terminal-controls{display:flex;align-items:center;gap:12px;font:12px ui-monospace,SFMono-Regular,monospace;color:#8fd39d}.terminal-controls #live-state.paused{color:#e8bd6d}.terminal-button{margin:0;padding:7px 10px;background:#274237;box-shadow:none;border:1px solid #3a5d4d}.new-events{cursor:pointer;padding:8px 22px;background:#18352c;color:#b8e2c0;font:12px ui-monospace,SFMono-Regular,monospace}.activity-entry{display:grid;grid-template-columns:82px minmax(0,1fr);gap:12px;padding:13px 22px;border-bottom:1px solid #274237}.activity-entry code{font:12px/1.5 ui-monospace,SFMono-Regular,monospace;color:#dceadf;overflow-wrap:anywhere}.activity-role{align-self:start;padding:3px 6px;border-radius:4px;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:#607369}.activity-role.activity-buyer{background:#4d7a54}.activity-role.activity-seller{background:#9a6a21}.activity-role.activity-mediator{background:#795927}.activity-role.activity-chain{background:#3e7490}.activity-empty{padding:18px 22px;color:#8da99a}@media(max-width:760px){.shell{padding:30px 16px 42px}.panes,.mediator,.technical-grid{grid-template-columns:1fr}.mediator{padding:22px}.logs header{align-items:flex-start;flex-direction:column}.activity-entry{grid-template-columns:1fr;gap:6px}}
  </style></head><body><main class="shell"><header id="live-summary"><div class="eyebrow">Local-only · Offline fakechain · 3-of-5</div><h1>FROST 3-of-5 Monero Escrow Demo</h1><p class="lede">Buyer and seller signer roles drive normal settlement while the mediator remains isolated unless an eligible recovery round requires it. Every status is backed by the fakechain node or wallet library.</p><div class="stages">${stageMarkup}</div><div class="status-row"><span class="status">${completed ? "completed" : escapeHtml(model.status)}</span></div></header>${backupWarning()}<section class="dashboard">${completed ? completedSummary(model) : workflow(model)}${activityPanel(model)}</section>${publicTechnicalDetails(model)}</main>${liveTerminalScript()}</body></html>`;
}
