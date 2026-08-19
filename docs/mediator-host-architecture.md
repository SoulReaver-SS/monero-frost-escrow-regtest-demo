# Mediator Host Architecture

The coordinator currently calls the mediator only from the dispute branch of `payout()`. The new design retains that branch boundary while replacing the child-script invocation with a short-lived loopback-only mediator host.

| Concern | Coordinator | Isolated mediator host |
|---|---|---|
| Lifetime | Runs the buyer/seller workflow | Starts only after dispute payout is requested; exits after a single signing response |
| Secret access | Never reads the mediator-secret file | Reads its own private file path from host-local configuration |
| Request material | Sends persisted public keys, context, participation map, unsigned transaction, and seller preprocesses | Verifies and signs the request, then returns only participant, verify result, preprocess, and share |
| Observability | Stores lifecycle events and exposes current status | Serves loopback health and a single loopback signing endpoint |

The status view must show both the current process state (`running` or `not running`) and the last host transition. The read-only audit derives its content entirely from SQLite session, protocol-record, and event-log records.
