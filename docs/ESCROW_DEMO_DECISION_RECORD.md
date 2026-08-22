# FROST Escrow Demo: Architecture, Workflow, and UI Decision Record

This note records **only decisions for which a genuine alternative was discussed**. It does not claim to have invented the upstream FROST share model, wallet operations, or cryptographic primitives. Those came from the upstream wallet library and its escrow material. The decisions below concern how those primitives were separated into local roles and translated into an inspectable escrow demonstration.

> The local role-host arrangement is a **demo custody boundary**. It is deliberately more faithful than a one-process test harness, but a production buyer or seller should keep their material in their own local signer client or device—not trust a remote application server with it.

## A. Runtime Architecture and Custody

### 1. Should the upstream one-process escrow example remain one process?

**The question.** The upstream example can create participants, verify DKG, preprocess, sign, complete, and broadcast in a single process. Should the demonstration retain that topology, split only the mediator, or split every business role?

**The options.**

1. Keep buyer, seller, mediator, and orchestration in one process, as a direct test harness.
2. Keep buyer and seller inside the coordinator and move only the mediator into a subprocess.
3. Run buyer, seller, and mediator as separate loopback role hosts; make the coordinator an orchestrator and evidence store rather than a signer.

**What we picked.** Option 3.

**Why.** A single process proves that the API works but cannot demonstrate custody boundaries. Splitting only the mediator leaves the normal path centralized. Three distinct role hosts make the separation observable through their loopback endpoints, PIDs, logs, runtime directories, and contract tests.

### 2. Should each share get its own process, or should each business role own its allocation?

**The question.** The 3-of-5 group could be represented as five separate signer processes, one central process holding all shares, or three actor-aligned hosts.

**The options.**

1. One process for each of five individual shares.
2. One coordinator process holding all five shares and merely labeling them by role.
3. One buyer host owning shares 1–2, one seller host owning shares 3–4, and one mediator host owning share 5.

**What we picked.** Option 3.

**Why.** It preserves the upstream allocation while aligning runtime boundaries with the actual escrow actors. Five independent processes would add operational noise without improving the actor boundary; centralizing shares would defeat it.

### 3. What is the coordinator allowed to know and do?

**The question.** Should the coordinator create generators and derive threshold keys for convenience, hold buyer/seller material only, or hold no signing secrets at all?

**The options.**

1. Let the coordinator retain DKG secrets, threshold keys, and signing state.
2. Let it retain buyer/seller secrets while keeping the mediator secret separate.
3. Let it retain no DKG secret, threshold key, private share, wallet spend/view key, or mediator secret; limit it to orchestration, durable non-secret state, public evidence, and relay messages.

**What we picked.** Option 3.

**Why.** The coordinator can schedule a round without being capable of signing it. The role hosts perform `verify()`, threshold-key derivation, `preprocess()`, `sign()`, `complete()`, and wallet operations within their own process boundaries.

### 4. How should the mediator join the group without being loaded in the normal path?

**The question.** Should the mediator verify DKG at setup and stay resident, be omitted from initial group setup, or be present only through its public key until recovery?

**The options.**

1. Start the mediator during setup, verify participations immediately, and keep it running throughout the session.
2. Omit the mediator from the initial public-key set and add it only during a dispute.
3. Include the mediator’s public DKG key in the five-key set during setup; persist the real participation map; start its host only for recovery, where it calls `verify()` with its own secret plus the preserved map and derives its threshold key locally.

**What we picked.** Option 3.

**Why.** The mediator must be part of the same 3-of-5 group from setup, so option 2 is invalid. Option 3 preserves that membership while making the delayed-mediator claim real: happy-path setup, funding, scan, and buyer-plus-seller settlement do not run the mediator host or load its secret.

### 5. When should the mediator process exist?

**The question.** Should mediator code run permanently, be imported into the coordinator on recovery, or be a short-lived isolated process?

**The options.**

1. Keep a mediator host running from startup through every session.
2. Import mediator signing code into the coordinator only when recovery is selected.
3. Spawn a loopback mediator host only for a legally eligible recovery round, record its PID/status, and terminate it after signing.

**What we picked.** Option 3.

**Why.** The mediator’s absence becomes observable rather than asserted. The normal UI and audit report **not running**; recovery shows the process start, perform its local verification/preprocess/sign work, and exit. Importing it into the coordinator would hide the exact boundary being demonstrated.

### 6. How should the coordinator communicate with isolated roles?

**The question.** Should it use shared in-process objects, loopback HTTP, or publicly/LAN-reachable signer endpoints?

**The options.**

1. Direct function calls and shared JavaScript objects.
2. Structured HTTP over `127.0.0.1` between coordinator and role hosts.
3. Network-accessible signer endpoints or a browser-accessible mediator host.

**What we picked.** Option 2.

**Why.** Loopback HTTP creates an explicit serialization and process boundary while remaining simple for a local demo. Requests may carry public DKG keys, preserved participation context, round IDs, unsigned transaction material, preprocesses, and responses; they do not carry role DKG secrets, threshold keys, wallet keys, or mediator secret material out of a role host. Optional Tailscale access proxies the coordinator page, not signer endpoints.

### 7. What state is durable, and what remains host-local and ephemeral?

**The question.** After splitting the upstream in-memory example, should all raw objects be centralized, should only terminal text persist, or should durable public context be separated from one-time signing state?

**The options.**

1. Keep all raw FROST and wallet objects in the coordinator for easy debugging.
2. Keep only terminal text and accept that restarts lose protocol context.
3. Persist non-secret session, public-key, participation, decision, transaction, fee, mediator-lifecycle, and completion records; keep one-time signer/preprocess instances in role-local registries keyed by `roundId`.

**What we picked.** Option 3.

**Why.** The delayed mediator needs the original participation context after setup, and completed sessions need durable public evidence. At the same time, FROST preprocess/sign state is one-time, role-local, and cannot safely be reconstructed from generic coordinator records. Buyer, seller, and mediator registries retain only their own round state, clear after broadcast, and do not silently recreate a lost round after restart. A missing signer becomes an explicit stalled/reset/recovery condition.

### 8. How should role-private material, backups, and scan caches be separated?

**The question.** Should one common state directory and backup contain everything, should role keys be regenerated per start, or should private material and disposable scan state be separately scoped?

**The options.**

1. Store all DKG, wallet, scan, and backup material in a coordinator directory or shared export.
2. Regenerate role secrets at process start and reuse one long-lived shared scanner cache.
3. Use separate buyer/seller/mediator private directories with restrictive file permissions, direct role-scoped FROST backups, and opaque per-session scanner caches that require exactly one input matching the persisted session amount.

**What we picked.** Option 3.

**Why.** Private files and saved verification context use owner-only permissions; the coordinator database remains free of them. Each role exports only its own FROST backup, never through the audit. Scanner caches are disposable rather than signing material, so reset can clear them without deleting role keys or backups. Exact amount matching prevents an old visible input from being selected for a new settlement.

### 9. How should the architecture prove that its boundaries are real?

**The question.** Should the project state its custody claims in prose, log broad success messages, or make the claims testable and inspectable?

**The options.**

1. README assertions only.
2. General terminal success messages without process or audit evidence.
3. Contract tests, role-host health/PID logging, mediator lifecycle state, redacted durable audit records, and real fakechain verification routes.

**What we picked.** Option 3.

**Why.** The central claim is architectural, not cosmetic. The evidence therefore shows that normal settlement calls buyer and seller hosts, mediator host is absent on the happy path, the coordinator lacks threshold keys, and recovery uses delayed mediator verification/signing.

## B. Workflow and UI

### 10. How should a live session refresh?

**The question.** Should the page reload fully, require manual refresh, or update only state-bearing fragments while preserving the terminal?

**The options.**

1. Full page reloads after actions and on a polling interval.
2. Manual refresh for funding, signing, and confirmation changes.
3. Server-sent events with a four-second fallback refresh that replaces only live summary/workflow/public fragments in place.

**What we picked.** Option 3.

**Why.** Live summary, workflow cards, backup warning, mediator panel, and public details update without making the terminal jump or losing the viewer’s reading context. The public-details disclosure remains open while it is being inspected.

### 11. How should the terminal behave and what belongs in it?

**The question.** Should the log grow at the bottom, be replaced wholesale, sit beneath the cards, or become the central evidence surface? Should every library write be visible?

**The options.**

1. Append all output at the bottom of a full-width log or replace the full log every refresh.
2. Use a decorative application-console card with generic status text.
3. Use a plain center-column terminal between buyer and seller; prepend newest events; allow live/pause behavior; show concise role-prefixed protocol events only.

**What we picked.** Option 3.

**Why.** The newest-first event stream avoids a continually scrolling bottom log. Lines identify buyer, seller, mediator, or chain and include elapsed time, making role activity and mediator absence inspectable. Real relay milestones, fakechain events, and errors are shown; repetitive wallet-library file-write chatter is filtered from the display but retained in audit/export.

### 12. Which steps become buttons, and which remain automatic?

**The question.** Should routine observation look like manual user labor, should everything be hidden behind one demo button, or should only genuine decisions be controls?

**The options.**

1. Give the seller a manual funds-verification/detection ritual and add controls for every technical operation.
2. Hide the whole flow behind one end-to-end action.
3. Make initialization, buyer payment, final role consents, mediator ruling, and selected recovery co-signing visible controls; keep broadcast, confirmation advancement, scan, matching-consent round start, preprocess, signing, completion, and broadcast automatic real operations.

**What we picked.** Option 3.

**Why.** The seller sees automatic confirmation that funds are in escrow instead of being asked to perform a pretend verification action. The terminal and audit show the automatic operations so they are not hidden from the demonstration.

### 13. How should the visible workflow be staged?

**The question.** Should every technical operation become a top-level stage, should escrow be only fund/payout, or should a four-stage user model contain the technical detail?

**The options.**

1. Separate top-level stages for DKG, address derivation, scan, signing, and broadcast.
2. A minimal fund/payout page.
3. Preparation → Funding → Decision → Settlement, with DKG/address work within Preparation, automatic scan within Funding, outcome consent in Decision, and FROST round/broadcast in Settlement.

**What we picked.** Option 3.

**Why.** It follows the Bazaar-like escrow model without pretending background protocol work does not exist. DKG and address derivation remain visible in terminal/public details, but are not inflated into user workflow stages. Funding detection is not a separate seller stage, and the discarded extra authorization layer does not become another stage.

### 14. What should normal settlement require?

**The question.** Should seller have a unilateral happy-payout control, should buyer and seller decide then separately authorize, or should each required role make one final outcome-specific consent?

**The options.**

1. A seller-only happy-payout button.
2. Buyer/seller decision followed by additional review/authorize/complete controls.
3. One final buyer consent and one final seller consent for release or refund; matching consents automatically start the real four-share round.

**What we picked.** Option 3.

**Why.** A seller-only button would falsely imply that two shares can release funds. The additional authorization layer was redundant. The second matching consent begins buyer 1–2 plus seller 3–4 signing; there is no third cosmetic completion action.

### 15. What should recovery require, and when should it become available?

**The question.** Should mediator selection be followed by a second mediator authorization, should there be a generic dispute button, or should a ruling be final and paired with one selected counterpart? Should timeout be required before any disagreement recovery?

**The options.**

1. Mediator selection plus separate review/authorize, available only after the timer.
2. A generic dispute payout button with unclear signer responsibility.
3. A final mediator ruling — release to seller or refund to buyer — followed by one final sign action from the selected buyer or seller; eligibility independently arises from disagreement, timeout, or stalled round.

**What we picked.** Option 3.

**Why.** A ruling is itself the mediator’s final consent. The selected counterpart supplies the other share set, reaching 3-of-5. Immediate disagreement does not wait for timeout; logs and UI show which eligibility condition fired.

### 16. How should backups be presented to the user?

**The question.** Should the interface expose raw DKG/signing files, present one generic recovery package, or offer role-specific FROST backups?

**The options.**

1. Separate raw values/files for every cryptographic intermediate.
2. One shared generic “recovery package.”
3. Direct buyer, seller, and mediator **FROST backup** downloads, each role-scoped; red when unavailable and green when ready.

**What we picked.** Option 3.

**Why.** “FROST backup” explains what is being backed up without forcing users to manage protocol internals. The color of the button itself provides a strong availability signal. A warning sits above all workflow cards, and backups are excluded from public audit/log output.

### 17. What should a completed session and transaction state claim?

**The question.** Should completed panes retain greyed-out controls or reset to prompts? Should broadcast be called complete, or should the page distinguish pool and confirmed state?

**The options.**

1. Leave disabled prompts and call any successful broadcast complete.
2. Reset panes to initial fund/pay prompts and show a transaction ID without lifecycle evidence.
3. Replace actions with a completed summary; state **broadcast, in tx pool** while `in_pool` is true and **confirmed at height N** only when daemon evidence provides a height.

**What we picked.** Option 3.

**Why.** A completed session remains auditable rather than becoming a dead screen. Public setup values persist after settlement. Funding and payout reflect the actual daemon observation, and the UI states that `generateblocks` advances fakechain confirmation for the demonstration rather than simulating real elapsed block time.

### 18. What should be public evidence, and what should remain redacted?

**The question.** Should viewers trust the terminal, see every available secret, or receive public evidence plus independent verification while private material remains withheld?

**The options.**

1. Terminal narrative only.
2. Publish all FROST and wallet values for apparent transparency.
3. Publish public DKG keys, group key, addresses, amount, fee split, transaction IDs/lifecycle, role/process status, signing summaries, audit export, and raw `/verify` daemon responses; redact secret and raw private intermediates.

**What we picked.** Option 3.

**Why.** The demonstration should be inspectable without becoming a key dump. DKG secrets, threshold keys, private shares, participation/preprocess/signature-share values, mediator secret, and wallet spend/view keys are not public evidence. Role backups are a separate private capability.

### 19. How should amount, mediator fee, and network fee work?

**The question.** Should the demo use a fixed amount and charge the mediator only on disputes, or select a random session amount with a consistent settlement policy? Should network fee come from mediator or recipient output?

**The options.**

1. Fixed amount; mediator paid only when needed.
2. Cryptographically uniform 0.5–10 XMR amount; fixed 1% mediator output on every settlement; network fee taken from mediator allocation.
3. Cryptographically uniform 0.5–10 XMR amount; fixed 1% mediator output on every settlement; network fee taken from settlement recipient output.

**What we picked.** Option 3.

**Why.** The random XMR and atomic amount are visible per session. Mediator compensation does not depend on the mediator coming online, and network-fee variability does not erode the fixed 1% output. Seller bears it on release; buyer bears it on refund.

### 20. What visual system should carry the evidence-heavy UI?

**The question.** Should the initial green FROST treatment remain, should the Monerochan art be removed, or should the page use Monero branding while retaining the supplied art as subdued context?

**The options.**

1. Keep the green FROST dashboard treatment.
2. Remove artwork for a generic clean dashboard.
3. Use Monero orange (`#ff6600`), off-white, and near-black; retain Monerochan as a shifted, reduced, strongly overlaid background; keep a plain terminal as the central evidence surface.

**What we picked.** Option 3.

**Why.** The result is recognizably Monero-oriented without letting the art compete with controls, addresses, or audit information. The terminal reads as a terminal rather than polished decorative chrome, which better supports the demo’s inspectability goal.

## C. Corrections Made After Observing Live Runs

**Payout completion versus actual confirmation.** The first completion view called a payout complete immediately after broadcast, even while the audit and daemon evidence still reported `in_pool: true` and no observed block height. This surfaced when the completed UI was compared directly with the session audit. The display was changed to show **broadcast, in tx pool** until `get_transactions` supplies a height, then **confirmed at height N**; funding uses the same evidence-driven lifecycle.

**Missing payout-wallet decoy retry.** An early real settlement reached transaction construction but failed with the known regtest decoy-construction problem because `decoyRetry` had been applied to the funding side rather than the escrow wallet constructing the payout. This surfaced in the real role-host wallet output, not in a static UI check. The payout/escrow wallet was configured with `decoyRetry`, and the setup path retained the required pre-mined fakechain depth before constructing transactions.

**Completed recovery details rendered as dashes.** A finished dispute session displayed dashes for the escrow address, group key, mediator payout address, and public DKG keys even though those values existed in durable state and had rendered earlier in the funded session. This surfaced on the actual completed recovery screen. The coordinator now stores a public setup snapshot at setup and completion, and the page/audit use that persisted snapshot as their completed-session fallback.

**BigInt serialization failure in the happy path.** A live happy-path run emitted `JSON.stringify cannot serialize BigInt` between payment and signing, creating a risk that a protocol record or event could fail to persist. This surfaced in the displayed protocol log during the real flow. Serialization was changed to use a BigInt replacer that preserves the values in a serializable form, and the contract suite checks that the conversion does not silently discard state.

**Redundant authorization layers.** The first interactive versions added extra approval controls after an already-final buyer/seller consent and after a mediator ruling. Seeing the live controls made the duplication clear: it implied an additional cryptographic or authority requirement that did not exist. The normal path now starts the FROST round as soon as matching buyer and seller final consents exist; a mediator ruling is itself final, leaving only the selected buyer or seller’s required co-sign action for recovery.
