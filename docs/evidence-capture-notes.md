# Evidence Capture Notes

The wallet broadcast result records relay status but does not include a transaction hash. For evidence, the buyer-payment hash is recovered from the `tx_hashes` field in confirmed fakechain blocks and verified through the daemon’s native `/get_transactions` endpoint.

The prebuilt wallet API exposes a bigint `amount` getter on an opened scan cache. Merchant-balance evidence therefore uses the recognized wallet amount rather than an inferred transaction amount.

The current setup persists four buyer/seller verification records. The fifth mediator verification record is deliberately created only by the explicit dispute payout, using the persisted participation map and the isolated mediator signer.
