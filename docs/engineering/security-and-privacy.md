# Security and privacy design

This is a threat model and future checklist, not a claim that controls are implemented or that a privacy review passed.

## Data minimization

Request only account/organization identity needed for isolation, chosen channel identity, and selected drafts. Do not import the user's entire social history by default. No emails, payment details, contacts, engagement analytics, private messages, or profile scraping are needed.

Draft copy is private content even when intended for eventual publication. Avoid exposing it in URLs, logs, crash reports, analytics, or demo recordings. Use fictional low-stakes test copy with permission. Existing real drafts require user consent before any edit.

## Threats and planned controls

| Threat | Planned mitigation | Residual limit |
| --- | --- | --- |
| OAuth CSRF or code interception | Random state, PKCE, exact redirect allowlist, short-lived server session | Must be implemented and tested, not assumed from framework defaults |
| Token leaks | Server-side encrypted storage, secrets manager, HTTPS, redacted logs, no client persistence | Operational access/host controls still need review |
| Cross-tenant post edit | Server checks owner, selected organization, channel, post and current permissions | Client IDs alone are never authorization |
| Malicious draft text | Render as escaped text; treat as data | No content can trigger tools, navigation or commands |
| Stale review overwrite | Exact baseline comparison, fresh read, invalidate review, verify after edit | No remote CAS; a race window remains |
| Duplicate dispatch | Durable local operation record, consumed approval, disable repeated UI submit | No documented provider idempotency guarantee |
| Partial batch/failure | Per-post receipts and fail-stop behavior | No multi-post transaction or automatic rollback |
| Browser/script injection | Escaped rendering, restrictive CSP, no arbitrary HTML preview | Audit actual implementation |
| URL SSRF/tracking | Treat registration URL as text; no server fetch | User can still enter misleading URLs; preview is not a safety certification |
| Excessive OAuth access | Minimal requested scopes, no offline access initially | Confirm scopes really suffice in integration spike |
| Data retained after disconnect | Delete tokens/session; separate campaign deletion control | Buffer's own drafts remain until user acts there |
| Public demo privacy leak | Fictional authorized drafts, crop account details, no auth/network secrets | Review final recording manually |

## Approval design

The product's confirmation is specific: actor, organization, exact selected draft IDs, precise before/after text and count. The UI and server consume the same review manifest. New fact value, external text change, selection, account, or organization invalidates it.

Authorization to edit a draft is not authorization to schedule, publish, delete, regenerate, send to a model, or repair the rest of the account. Do not bury those actions behind a generic approval.

## Session choice

Prefer short interactive access without offline refresh for the MVP. Keep tokens encrypted on the server for the active session, with an explicit expiry/deletion policy. The production retention choice must be published accurately before anyone connects. Do not claim “we store nothing” while retaining baselines or tokens.

If refresh is added later, request approval for the expanded persistent access and serialize single-use token rotation. Do not ask users to paste credentials into a chat or source file.

## Retention proposal

Default: keep only the active campaign plus minimal receipts. Offer clear deletion. Delete expired session secrets promptly. Propose automatic campaign/receipt deletion after a short published period, but do not promise a number until implemented and tested. Deleting local data must not delete Buffer posts. Backups and provider logs need separate, truthful handling.

An unresolved write needs a minimal guard independent of campaign/session deletion so reconnecting cannot permit a second write while the first may still be pending. Keep only provider account, organization, post and operation identifiers/state for this purpose, without tokens or draft copy. Define its retention and explain what campaign deletion removes before release. See the [reconciliation protocol](architecture.md#reconciliation-after-uncertainty).

## Required pre-release checks

- Credentials absent from git, client bundles, screenshots and logs.
- Owner/organization/post authorization checked on every server endpoint.
- OAuth error/state/replay cases tested.
- Unsupported content refused, never silently rewritten.
- Requests and responses bounded; Unicode and special HTML text handled safely.
- Provider error messages sanitized; no draft text sent to unnecessary telemetry.
- Privacy/contact information describes actual storage, scopes and deletion.
- Users understand OAuth grants access and that app-local checks cannot eliminate concurrent Buffer edits.

No real customer data, persistent access changes, public release or external writing is authorized by this plan.
