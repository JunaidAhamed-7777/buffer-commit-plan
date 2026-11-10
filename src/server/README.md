# Server boundaries

Reserved directories, currently empty:

- auth: OAuth state/PKCE, sessions and identity boundaries.
- buffer: minimal typed provider reads/edits and error translation.
- campaigns: authorized campaign snapshots and fact/binding records.
- operations: consumed approval, immutable manifests, sequential apply and reconciliation.
- storage: persistence adapters and short-lived encrypted credential storage.

Follow the [architecture](../../docs/engineering/architecture.md) and [security design](../../docs/engineering/security-and-privacy.md). These are ownership boundaries, not separate services or packages. No endpoints, tokens, database schema or client have been created.
