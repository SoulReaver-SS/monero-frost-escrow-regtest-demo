# Local Validation Notes

The verified fakechain reported height 1000. During the first funding attempt, the freshly created buyer scan-cache file contained an empty `scanned_ranges` array and a daemon height of zero, while the connection status separately showed that the daemon RPC was reachable at height 1000. The next implementation step must therefore make the session scanner reuse the prepared funding-wallet scan cache or explicitly wait for a completed per-wallet scan after opening it, instead of assuming the new session cache is already synchronized.

For the dispute-path diagnostic, the generated mediator request was confirmed to contain five DKG public keys, the `escrow-0` context, all three persisted initial participation messages, the real unsigned sweep transaction, and seller preprocess messages. The isolated mediator worker returned an empty verification object, so the remaining issue is specifically delayed mediator DKG verification rather than absent request data.

The completed local page was visually verified after a dispute payout. The mediator strip rendered `Mediator process: not running` with the recorded clean-exit transition; the same page visibly included the read-only audit, JSON, and plain-text links plus disclosures that `generateblocks` simulates regtest confirmation time and that server-held buyer/seller shares are a demo-only simplification.
