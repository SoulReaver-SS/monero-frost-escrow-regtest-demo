# FROST Escrow Demo: UI and Workflow Decision Record

This note records **only decisions with a real alternative on the table**. It does not credit the application with inventing the FROST share model, wallet API, or protocol primitives; those came from the upstream wallet library and its examples. The choices below concern how those capabilities were translated into the local demonstration.

## 1. How should the page refresh while a session is live?

**The question.** Should the page behave like a traditional form flow that reloads wholesale, a manually refreshed status page, or a live dashboard that refreshes only the parts whose state changed?

**The options.**

1. Reload the entire page after each action and on a short polling interval.
2. Require the viewer to refresh manually to see new funding, signing, or confirmation state.
3. Use server-sent events with a four-second state refresh as a fallback, replacing only state-bearing fragments in place.

**What we picked.** Option 3. The live summary, workflow cards, backup warning, mediator panel, and public-details panel refresh in place. The terminal is deliberately not replaced, so it does not jump, lose scroll context, or behave like a page reload. The public-details disclosure remains open if a viewer is reading it. The refresh continues for a live session so external fakechain confirmation changes can appear; it is not used to turn a completed pane back into an action prompt.

## 2. How should new terminal events behave?

**The question.** Should the console behave as a conventional growing log with the newest event at the bottom, force viewers to follow the bottom on every refresh, or make the newest protocol event immediately visible?

**The options.**

1. Append each event to the bottom and continuously pull the viewer down.
2. Replace the full log on every polling cycle.
3. Prepend new events, keep the latest event at the top, and provide live/pause and unread-event behavior.

**What we picked.** Option 3. This followed the observation that a one-second growing log made it hard to stay at the bottom long enough to understand what happened. Newest-first display makes the current protocol event immediately visible; the terminal is updated as an event stream rather than reconstructed as a page fragment.

## 3. What should the normal-settlement controls require?

**The question.** Should one party have a seller-side “complete happy payout” control, should buyer and seller each make a decision and then pass a separate authorization step, or should the two required roles each make one final, outcome-specific consent?

**The options.**

1. A seller-only happy-payout button.
2. Buyer and seller select an outcome, then one or both perform an additional review/authorize or complete action.
3. Buyer and seller each sign one final outcome-specific consent; matching consents immediately start the real buyer-plus-seller FROST round.

**What we picked.** Option 3. The seller-only control was rejected because it visually implied a unilateral two-share release. The later “decision plus authorization” layer was also removed as redundant. The page now requires one buyer and one seller release/refund consent; the second matching consent automatically begins the four-share threshold round. There is no third, cosmetic “complete” button.

## 4. What should a recovery settlement require?

**The question.** Should the mediator first select an outcome and then separately authorize it, should the UI expose a generic mediator payout button, or should a final ruling itself be the mediator’s single consent before the selected counterpart signs?

**The options.**

1. A mediator selection step followed by a second mediator “review/authorize” step.
2. A generic dispute-payout control that obscures who is agreeing to what.
3. A final mediator ruling — release to seller or refund to buyer — followed by exactly one final sign action from the selected buyer or seller.

**What we picked.** Option 3. A ruling is final, not a preliminary intention. The remaining selected role supplies the other required share set. This removed a redundant mediator authorization layer while preserving the real recovery condition: mediator share 5 plus either buyer shares 1–2 or seller shares 3–4 reaches the 3-of-5 threshold.

## 5. Which actions should be buttons, and which should remain automatic?

**The question.** Should routine blockchain observation be presented as a manual role action, or should only meaningful user decisions become controls?

**The options.**

1. Give the seller a manual “verify funds” or “detect funding” ritual after buyer payment.
2. Keep funding observation automatic, while making the buyer payment and actual settlement consents explicit controls.
3. Hide all operational steps behind a one-click end-to-end demo action.

**What we picked.** Option 2. Initialize, buyer payment, final buyer/seller consent, mediator ruling, and the selected recovery signer’s consent are visible actions. Buyer broadcast, regtest confirmation advancement, seller scan, matching-consent round start, preprocessing, share signing, completion, and broadcast are automatic real protocol operations whose results appear in the terminal and audit. The seller is shown that funds are in escrow rather than asked to perform a pretend manual verification ceremony.

## 6. How should the four-stage workflow be drawn?

**The question.** Should DKG, address derivation, scan, signing, and broadcast each be separate top-level stages, should escrow look like a single fund-and-payout page, or should the UI use the four-stage Bazaar-like model while preserving the detailed operations within it?

**The options.**

1. A technical sequence with one visible stage per implementation operation.
2. A minimal “fund / payout” interface that hides the intermediate decision model.
3. Preparation → Funding (the deposit stage) → Decision → Settlement, with DKG and address setup inside Preparation, automatic scanning inside Funding, outcome consent inside Decision, and FROST round/broadcast inside Settlement.

**What we picked.** Option 3. DKG setup and address derivation were not promoted to separate user stages; they are genuine preparation work surfaced through the terminal and public details. Funding detection was not a separate stage or seller button. The former extra authorization layer was merged into the Decision stage rather than becoming another stage.

## 7. Where should the terminal go, and what belongs in it?

**The question.** Should the protocol console sit beneath the cards, be a decorative dashboard widget, or become the central evidence surface between the roles? Should it show all library output?

**The options.**

1. A full-width log below the buyer and seller cards.
2. A polished “app console” treatment with decorative window chrome and generic status text.
3. A plain terminal in the center column between buyer and seller, showing concise real protocol events only.

**What we picked.** Option 3. The final terminal intentionally looks like a terminal rather than an Apple-style card. It is centered between the buyer and seller so the role-host interaction is visually central. Each visible line carries a role/source prefix — buyer, seller, mediator, or chain — and elapsed-time notation so mediator absence and later activity are inspectable.

**What is shown versus retained only in the audit.** The terminal shows real role-host relay milestones, fakechain events, and errors. Repetitive wallet-library file-write chatter such as `ScanSettings.json` writes is filtered from the display. The complete filtered library log remains available in the read-only audit/export rather than being discarded.

## 8. How should the mediator’s delayed role be presented?

**The question.** Should the mediator appear as a normal always-running signing participant, be hidden until a dispute, or remain visibly present as a dormant role whose process state and eligibility are observable?

**The options.**

1. Run the mediator signer alongside buyer and seller throughout every session.
2. Hide mediator status entirely until recovery is invoked.
3. Show a mediator card from setup onward, make clear that the process is not running for normal settlement, and start it only once a legal recovery round is selected.

**What we picked.** Option 3. The card shows **not running** or **running** and explains that normal buyer-plus-seller settlement does not need the mediator. Recovery eligibility is explicitly presented as one of three independent conditions: immediate disagreement, policy timeout, or a stalled signer round. The terminal records which condition fired; the seven-day-style timeout is not misrepresented as a prerequisite for disagreement.

## 9. How should backups be named, scoped, and offered?

**The question.** Should the interface expose the individual FROST values, a generic recovery package, a single shared export, or role-specific user-facing backups?

**The options.**

1. Expose raw DKG, signing, and wallet files separately.
2. Offer one generic “recovery package” for the entire escrow.
3. Offer a direct role-specific **FROST backup** download for buyer, seller, and mediator, using a single role-scoped `.frost` export format.

**What we picked.** Option 3. “FROST backup” was preferred to the more generic “recovery package.” Each role has its own export because each owns different private material. The button itself is the availability signal: red while unavailable, green when ready, rather than a separate status dot or explanatory box. A prominent warning sits above all workflow cards. Backups are never included in public audit or protocol logs.

## 10. What should a completed pane show?

**The question.** After settlement, should the original controls remain disabled in grey, should the page reset to generic fund/pay prompts, or should each role pane become a completion summary?

**The options.**

1. Leave disabled funding and payout buttons in place.
2. Reset the panes to their initial prompts.
3. Replace actionable panes with a completed settlement summary while keeping public evidence available.

**What we picked.** Option 3. A completed session is not treated as a dead or blank workflow. The panes show the completed outcome and transaction lifecycle, while the audit and public-details panel remain accessible. This also required persisting the public setup snapshot so a finished recovery session does not turn addresses, group key, mediator payout address, or DKG public keys into dashes.

## 11. What transaction state should the UI claim?

**The question.** Should a successful broadcast be called “complete,” should confirmations be hidden as regtest plumbing, or should the page distinguish exactly what the daemon has observed?

**The options.**

1. Treat broadcast as settled/completed.
2. Show only a transaction ID with no lifecycle state.
3. Show **broadcast, in tx pool** when the daemon reports `in_pool: true`, then **confirmed at height N** only when `get_transactions` provides an observed height.

**What we picked.** Option 3. This was chosen after the UI incorrectly appeared to claim payout completion while the audit still showed an in-pool transaction. Funding and payout use the same evidence-driven lifecycle language. The page also states plainly that `generateblocks` advances the fakechain for demonstration confirmations and is not real wall-clock confirmation time.

## 12. What belongs in public protocol details, and what must stay redacted?

**The question.** Because this is an illustration, should the UI expose every available value, show only a terminal narrative, or publish verifiable public state while withholding private signing and wallet material?

**The options.**

1. Show only high-level status text and ask viewers to trust the demo.
2. Publish all values, including private role material, for maximum apparent transparency.
3. Publish the public setup and transaction evidence, but redact secrets and raw private cryptographic intermediates.

**What we picked.** Option 3. Public details include threshold allocation, randomized XMR and atomic amount, escrow address, buyer and merchant addresses, mediator payout address, all five public DKG keys, group key, transaction IDs and lifecycle, fee split, role/process state, and summaries/counts of signing artifacts. `/verify` exposes the underlying daemon transaction response, and audit/export routes preserve the session record.

Private FROST shares, participation values, threshold keys, preprocessing values, signature-share values, mediator secret material, spend keys, and view keys remain redacted. Role backups may contain private role material, but they are separate downloads and are explicitly excluded from audit/export.

## 13. How should the escrow amount and fee policy be exposed?

**The question.** Should the demo use a fixed amount, allow an opaque backend-selected amount, choose a random amount in the requested range, or ask the viewer to enter one? Should mediator compensation apply only to disputes or to every completed settlement? Who absorbs the network fee?

**The options.**

1. A fixed demonstration amount and a mediator cut only when mediation occurs.
2. A per-session cryptographically uniform 0.5–10 XMR amount, a fixed 1% mediator output on every completed settlement, and the network fee deducted from that mediator output.
3. A per-session cryptographically uniform 0.5–10 XMR amount, a fixed 1% mediator output on every completed settlement, and the network fee deducted from the settlement recipient output.

**What we picked.** Option 3. The random amount is shown in both XMR and atomic units. The fixed 1% mediator output is visible even for normal buyer-and-seller settlement, so the fee is not dependent on whether the mediator has to come online. The recipient pays the fakechain network fee: seller on release, buyer on refund. This protects the fixed mediator percentage from fee variability.

## 14. What visual system should carry the demonstration?

**The question.** Should the initial green FROST treatment remain, should the supplied Monerochan art be removed because it competed with the interface, or should the page use Monero branding while retaining the art as context rather than foreground content?

**The options.**

1. Keep the green FROST visual system.
2. Remove the Monerochan artwork for a cleaner, generic dashboard.
3. Use Monero orange (`#ff6600`), off-white, and near-black; retain the supplied Monerochan art as a shifted, reduced, strongly overlaid background.

**What we picked.** Option 3. The green direction was replaced with the Monero palette. The artwork was explicitly retained, but made less prominent through positioning and stronger foreground gradients so it functions as background rather than interfering with controls and evidence.

## 15. How should the demonstration substantiate its claims?

**The question.** Should the terminal itself be the proof of the flow, should the UI merely announce that FROST happened, or should the user be able to inspect independent fakechain and protocol records?

**The options.**

1. Treat terminal text as sufficient evidence.
2. Show a polished workflow with no downloadable or independently inspectable record.
3. Provide read-only audit JSON/text, public protocol data, real transaction IDs, `/verify` routes that show the daemon `get_transactions` response, and role-host/FROST relay information.

**What we picked.** Option 3. The demo is deliberately not asking a viewer to accept a UI claim on faith. The terminal provides a readable live story; audit/export and verification routes provide the underlying evidence needed to inspect it separately.
