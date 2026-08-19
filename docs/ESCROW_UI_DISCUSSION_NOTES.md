# Escrow UI Discussion Notes

## Reference concepts under consideration

The XMRBazaar guide presents escrow as four user-facing stages: preparation, deposit, decision, and payout. In its deposit stage, the buyer sends funds and explicitly starts a wallet sync/check; after detection, the workflow advances. It also treats mnemonic and backup material as user-controlled recovery data in a non-custodial client-side model.

Monero's multisignature documentation distinguishes public address information from private view and spend-related material, and describes exported multisig information as part of transaction preparation/recovery handling. This reinforces a strict separation between public audit exports and any secret-bearing recovery artifact.

## Implications for this local FROST demonstration

1. Present a clear automatic funding status rather than describing seller receipt detection as a manual verification task.
2. Keep the existing read-only public audit export safe to download and share.
3. Do not expose buyer/seller FROST shares, wallet spend keys, wallet view keys, or the mediator secret in the general UI or audit.
4. If a recovery download is later approved, it must be explicitly labelled secret-bearing, locally encrypted or password-protected, and scoped to this fakechain demonstration only.
5. A terminal-like activity display can live-update in place, prepend new events, and preserve the reader's scroll position instead of triggering document reloads.
