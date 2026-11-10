# Server boundaries

The server owns authorization and external writes.

- auth: OAuth state/PKCE, sessions and identity boundaries.
- buffer: minimal typed provider reads/edits and error translation.
- campaigns: authorized campaign snapshots and fact/binding records.
- operations: consumed approval, immutable manifests, sequential apply and reconciliation.
- storage: persistence adapters and short-lived encrypted credential storage.

These directories belong to one application. [Architecture](../../docs/engineering/architecture.md) · [Security and privacy](../../docs/engineering/security-and-privacy.md)
