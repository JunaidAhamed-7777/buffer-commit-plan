# Security and privacy design

The local workbench passed an authorized Buffer test on Bluesky. Hosted verification also covers the production callback, database and logging configuration. [Local test evidence](../evidence/README.md#live-buffer-verification-on-11-november-2026)

## Data minimization

Request only account/organization identity needed for isolation, chosen channel identity, and selected drafts. Do not import the user's entire social history by default. No emails, payment details, contacts, engagement analytics, private messages, or profile scraping are needed.

Draft copy is private content even when intended for eventual publication. Avoid exposing it in URLs, logs, crash reports, analytics, or demo recordings. Use fictional low-stakes test copy with permission. Existing real drafts require user consent before any edit.

## Threats and controls

| Threat | Control | Residual limit |
| --- | --- | --- |
| OAuth CSRF or code interception | Single-use state bound to a server session, PKCE and an exact callback origin | Verify the registered redirect and real callback |
| Token leaks | Server-side AES-256-GCM, HTTP-only session cookie, HTTPS for hosted OAuth and sanitized errors | Host secrets, logs and storage permissions still need review |
| Cross-tenant post edit | Server checks owner, selected organization, channel, post and current permissions | Client IDs alone are never authorization |
| Uninvited Buffer account | Hosted OAuth matches the account and organization returned by Buffer against server configuration before saving the connection | The fictional sample is public |
| Malicious draft text | Render as escaped text; treat as data | No content can trigger tools, navigation or commands |
| Stale review overwrite | Exact baseline comparison, fresh read, invalidate review, verify after edit | No remote CAS; a race window remains |
| Duplicate dispatch | Durable local operation record, consumed approval, disable repeated UI submit | No documented provider idempotency guarantee |
| Partial batch/failure | Per-post receipts and fail-stop behavior | No multi-post transaction or automatic rollback |
| Browser/script injection | Escaped draft text and response headers that block framing, embedded objects and external form submissions | Review browser behavior before release |
| URL SSRF/tracking | Treat registration URL as text; no server fetch | User can still enter misleading URLs; preview is not a safety certification |
| Excessive OAuth access | Minimal requested scopes, no offline access initially | Confirm scopes really suffice in integration spike |
| Data retained after disconnect | Delete tokens/session; separate campaign deletion control | Buffer's own drafts remain until user acts there |
| Public demo privacy leak | Fictional authorized drafts, crop account details, no auth/network secrets | Review final recording manually |

## Approval design

The product's confirmation is specific: actor, organization, exact selected draft IDs, precise before/after text and count. The UI and server consume the same review manifest. New fact value, external text change, selection, account, or organization invalidates it.

Authorization to edit a draft is not authorization to schedule, publish, delete, regenerate, send to a model, or repair the rest of the account. Do not bury those actions behind a generic approval.

## Session choice

The app uses interactive OAuth. It keeps the access token encrypted in the server session for up to one hour, capped at the lifetime Buffer returns. The browser gets an HTTP-only session cookie. Disconnect deletes the session and its stored token. OAuth attempts expire within ten minutes and the app consumes a matching attempt once.

If refresh is added later, request approval for the expanded persistent access and serialize single-use token rotation. Do not ask users to paste credentials into a chat or source file.

Patchwork omits the callback URL from its application logs. Vercel can still include search parameters in its request logs. The callback contains the one-use authorization code and state. The PKCE verifier and access token stay server-side. Keep Vercel project logs private and avoid exporting callback traffic. [Vercel runtime log fields](https://vercel.com/docs/logs/runtime#log-details)

## Retention

The live workspace stores the campaign and receipts for seven days from its last write. The anonymous sample session expires after twelve hours. Workspace requests trigger cleanup of expired records. Deleting a campaign clears its active copy while preserving unresolved write guards. Keep the local SQLite file, journal and backups on private storage. The hosted Buffer workbench stores its records in Neon PostgreSQL. Database changes remain recoverable within the project's configured restore window, including deleted records. [Neon restore history](https://neon.com/docs/postgres/backup-restore/branch-restore)

An unresolved write guard survives disconnect, campaign deletion and expiry. The guard keeps organization, post and operation identifiers. It has no automatic expiry because a later read cannot prove a pending edit has finished. See the [reconciliation protocol](architecture.md#reconciliation-after-uncertainty).

## Required pre-release checks

- Credentials absent from git, client bundles, screenshots and logs.
- Owner/organization/post authorization checked on every server endpoint.
- OAuth error/state/replay cases tested.
- Unsupported content refused, never silently rewritten.
- Requests and responses bounded; Unicode and special HTML text handled safely.
- Provider error messages sanitized; no draft text sent to unnecessary telemetry.
- Privacy/contact information describes actual storage, scopes and deletion.
- Users understand OAuth grants access and that app-local checks cannot eliminate concurrent Buffer edits.
