# Control Flow Audit

## External model reference

The public XMRBazaar escrow guide describes four stages: Preparation, Deposit, Decision, and Payout. For a disagreement or a qualifying unavailable-party case, the mediator makes the decision to refund or pay out. That decision determines the two payout signers. The selected two signers then remain online while the technical payout mechanics run automatically. The guide does not introduce a second mediator approval after the mediator has made that decision.

For the local FROST 3-of-5 demonstration, the equivalent recovery signer allocation is buyer shares 1–2 plus mediator share 5 for a refund, or seller shares 3–4 plus mediator share 5 for a payout. The mediator’s ruling can therefore record its final consent and initiate the delayed mediator role-host round. The selected buyer or seller retains one necessary explicit action to review and sign; only after both roles have committed may the automatic local FROST preprocess, signature-share, completion, and broadcast mechanics begin.

Sources consulted on 2026-08-19: https://xmrbazaar.com/escrow-guide/ and https://xmrbazaar.com/faq/.
