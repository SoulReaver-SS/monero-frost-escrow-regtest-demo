# Mediator Fee Implementation Notes

The existing local role host creates a one-output settlement with `sweepToExternalWallet`. The vendored wallet API also exposes a supported standard transaction path accepting an explicit `payments` array. This provides the required mechanism for a real two-output settlement: one output to the agreed buyer or seller destination and one output to the mediator’s registered payout address.

The approved accounting rule is a **fixed 1% of the persisted escrow amount** to the mediator. The actual network transaction fee is deducted from the settlement recipient output: the seller on a release, or the buyer on a refund. Therefore, the intended accounting invariant is:

```
destination = escrow amount − 1% mediator fee − actual network fee
mediator output = 1% mediator fee
destination + mediator output + actual network fee = escrow amount
```

The mediator’s public payout address must be produced during the one-time local mediator bootstrap, stored only in `mediator-public.json`, and registered during escrow preparation. This does not start the mediator signer host and does not read mediator-private material during normal buyer-and-seller settlement.

The upstream repository confirms that transaction construction is implemented in a Rust-to-WASM wallet layer while the public TypeScript surface exposes a `payments` array. Its transaction-building source keeps the standard constructor distinct from the sweep constructor; the latter is explicitly documented as a one-payment, “complete amount minus fee” path. The mediator-fee work must therefore use the standard multi-payment constructor, not the existing sweep helper. The implementation must validate the fee-reserve arithmetic in a real fakechain settlement before release.

## Historical Pre-Policy-Change Validation

A clean browser-validated happy-path run completed with **no mediator host process running**. The persisted randomized escrow amount was `9.212964899284 XMR` (`9212964899284` atomic units). The signed four-share buyer-and-seller settlement recorded these exact public values:

| Item | Atomic units | XMR |
|---|---:|---:|
| Recipient output before network fee | 9,120,835,250,292 | 9.120835250292 |
| Gross 1% mediator allocation | 92,129,648,992 | 0.092129648992 |
| Actual fakechain network fee | 2,516,400,000 | 0.0025164 |
| Mediator output after network fee under the superseded policy | 89,613,248,992 | 0.089613248992 |

The completed settlement transaction ID was `02cb7235235fc74557860802f62df07f9a06e946d474a42890f5ec07a5cbb32f`. It is retained solely as evidence of the superseded mediator-paid-fee policy. The revised builder still uses an iterative reserve probe because the wallet can refine the exact necessary fee after the first payment layout is evaluated; it now subtracts that determined fee from the recipient output while retaining the full 1% mediator output.

## Current Seller-Paid-Fee Validation

A fresh four-share buyer-and-seller fakechain release validated the revised policy. The signed settlement records a fixed `45,503,245,100`-atomic-unit mediator output, exactly 1% of the `4,550,324,510,090`-atomic-unit escrow amount. The `2,517,600,000`-atomic-unit fakechain network fee is deducted only from the recipient output.

| Item | Atomic units | XMR |
|---|---:|---:|
| Escrow amount | 4,550,324,510,090 | 4.550324510090 |
| Recipient output before network fee | 4,504,821,264,990 | 4.504821264990 |
| Network fee paid by recipient output | 2,517,600,000 | 0.002517600000 |
| Recipient output after network fee | 4,502,303,664,990 | 4.502303664990 |
| Fixed 1% mediator output | 45,503,245,100 | 0.045503245100 |

The persisted audit identifies this explicitly with `network_fee_payer: "settlement_recipient"`; on a release, that settlement recipient is the seller.
