# Local Runtime Contract

This application is designed to run **locally and offline** against a Monero `regtest` daemon. It is not suitable for deployment to the managed web runtime because the demo requires a daemon process, a mutable chain data directory, a local library-log file, and in-memory signer state that must remain available across the escrow-signing window.

| Component | Local demo requirement | Managed-web limitation |
|---|---|---|
| Monero daemon | One offline `monerod --regtest` process with a persistent data directory | Request-scoped containers cannot safely host a durable child daemon or its chain data. |
| Wallet scanning | Durable local scan settings and a library-generated file log | Instance filesystems are ephemeral and instances can scale to zero. |
| FROST signers | An in-process registry keyed by escrow session ID from preprocessing through completion | A request can be served by a different instance after a cold start or scale event. |
| Block snapshot | Reusable local `regtest` snapshot directory | Snapshot restoration depends on local mutable filesystem state. |

The application code intentionally treats the Monero environment as a **local developer dependency**. The setup and reset scripts refuse public-network configuration, bind the daemon RPC interface to loopback, and verify the daemon reports `fakechain` before workflow operations are enabled. The interface never presents generated transactions, escrow state, or log lines as real unless they were returned by the local node or wallet library.
