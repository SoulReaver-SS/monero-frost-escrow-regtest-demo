# Upstream Integration Notes

The local runtime will use the prebuilt `@spirobel/monero-wallet-api` distribution. Its upstream escrow acceptance test imports the FROST/DKG utilities, wallet scanner, scan-settings writer, escrow wallet registration helper, and `MultiSigTxSigner` directly from `typescript/dist/api`.

| Requirement | Upstream reference behavior | Local integration decision |
|---|---|---|
| Regtest daemon | Starts `monerod` with `--regtest`, `--offline`, fixed difficulty, and loopback RPC. | The setup script starts an equivalent loopback-only process and checks `get_info.nettype` before enabling workflow actions. |
| Wallet discovery | `ScanSettings` supplies the local node URL, scan start height, file logging, and selected log categories. | Setup writes a scan-settings file; the application tails only library and route-level real output. |
| Funding | A real customer test keypair is placed in environment variables and the test mines spendable regtest outputs before creating the escrow transaction. | The setup creates funding data in the isolated local runtime and snapshots the prepared chain. |
| FROST state | DKG derives a group key and transaction signing uses a signer object that keeps nonce state internally. | Serializable values persist in the application store; signer objects remain in a session-keyed process-local registry. |

The demo uses the upstream **3-of-5** role-share structure: the buyer holds shares 1 and 2, the seller holds shares 3 and 4, and the mediator holds share 5. The setup flow creates the threshold set of three upstream-compatible participation messages for buyer shares 1–2 and seller share 3; all four buyer/seller DKG instances then run `verify()` and derive threshold keys. The mediator public key remains in `all_pk`, while its participation is absent from the persisted participation map until the dispute path.

| Payout path | Key material loaded before payout | Shares used for payout | Mediator behavior |
|---|---|---|---|
| Happy path (default) | Buyer and seller materials only | Buyer 1, buyer 2, seller 1, seller 2 | The mediator secret is never loaded. |
| Dispute path | Seller materials, then mediator material only at payout | Seller 1, seller 2, mediator 1 | The mediator runs delayed `verify()` using the persisted participation map, then contributes preprocess and share data. |

Both paths retain the upstream API call order and serialization rules. The mediator does not participate during initial DKG setup or scanning; it can only appear in real payout logs when the explicit dispute path is selected.
