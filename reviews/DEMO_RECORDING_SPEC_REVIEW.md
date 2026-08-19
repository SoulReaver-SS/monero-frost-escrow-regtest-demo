# Demo Recording vs. Agreed Specification

## Scope and evidence boundary

This review covers the uploaded recording `08.18.2026_06-07-19_AV1_Opus.mp4`. It is a review of **what is visible in the recording**, not a substitute for the local fakechain audit or role-host process evidence. The recording has no usable spoken-audio transcript, so the findings below rely on visible controls, status text, and terminal output.

## Observable alignment

| Agreed requirement | What the recording visibly shows | Review |
|---|---|---|
| Four stages: Preparation, Deposit, Decision, Settlement | The stage bar advances through all four stages. | **Aligned** |
| 3-of-5 allocation: buyer 2, seller 2, mediator 1 | All three role headings display their assigned share counts. | **Aligned** |
| Shared-address funding | A shared address and a funding transaction record appear during Deposit. | **Aligned** |
| Buyer/seller outcome decision controls | The Decision stage shows release-to-seller and refund-to-buyer controls; a refund is selected. | **Aligned** |
| Recovery uses buyer 2 + mediator 1 | The recovery section and terminal describe the 3-of-5 buyer-plus-mediator refund path. | **Aligned, as displayed** |
| Mediator is not needed for ordinary agreement | The normal release control is present, but no full normal buyer-plus-seller settlement is recorded. | **Not demonstrated** |
| Recovery eligibility only after disagreement, timeout, or a stalled round | The recording moves from a buyer refund request to mediator ruling, but does not visibly show the seller's conflicting decision, an expired timeout, or a stalled round. | **Indeterminate; capture this explicitly next time** |
| Final mediator ruling plus one selected-party signature | The recovery presentation appears streamlined; no redundant mediator approval is evident in the recording. | **Visually aligned** |
| Raw fakechain verification | Funding and settlement IDs and `Verify on fakechain` links are visible. The recording does not open either link to show the raw `get_transactions` response. | **Control visible; independent proof not demonstrated** |
| Always-on 1% mediator fee | A 1% mediator-fee policy is visible. The recording does not visibly establish the completed recipient / mediator / network-fee split or decode the second transaction output. | **Policy visible; settlement accounting not demonstrated** |
| Plain live terminal; no redundant cursor or stale timing pills | The terminal is central and live-looking. No duplicate cursor or stale status-age pills are visible in the captured states. | **Aligned in the recorded view** |
| Monero orange, white, and near-black presentation with Monerochan retained | The orange/black theme and right-side Monerochan artwork are visible. | **Aligned** |

## Main conclusion

The recording is a **credible UI demonstration** of the recovery/refund experience and is broadly aligned with the agreed visual and role-allocation specification. It does **not**, by itself, prove all of the stronger operational claims. In particular, it does not visibly prove recovery eligibility, the normal mediator-free buyer-plus-seller path, raw daemon transaction evidence, the exact completed 1% output split, or the mediator process lifecycle.

The largest recording gap is the recovery trigger. For the next take, leave the terminal lines on screen that show either: (a) buyer and seller selecting different outcomes, (b) timeout eligibility, or (c) a stalled signer round. Then show the mediator's final ruling followed by the selected buyer or seller's one signing action.

## Recommended recording sequence

1. Record **one normal path**: matching buyer and seller decisions, both signing actions, mediator status remaining `not running`, payout completion, and raw payout verification.
2. Record **one recovery path**: make the eligibility event visible, select the final mediator ruling, show only the selected counterparty's signing action, terminal mediator start/verify/preprocess/sign/exit events, and payout verification.
3. Open both funding and payout `Verify on fakechain` links. Capture the raw daemon response and the completed fee split on the dashboard.
