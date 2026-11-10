# Architecture and write safety

Proposed design only. No modules, database, requests, or tests exist yet.

## Bounded implementation shape

A single TypeScript web application with a server-side Buffer adapter and a small durable relational store. React/Next.js is a reasonable provisional stack, not a commitment to a paid host. PostgreSQL is a practical production option; choose the host and database together after approval. Do not deploy SQLite on an ephemeral serverless filesystem or add Redis, queues, microservices, vector search, or an LLM by default.

The browser handles phrase selection and diff rendering. The server owns identity, authorization, fresh reads, patch validation, mutation execution, and receipts. The browser must not hold provider tokens or choose an arbitrary organization/post outside the authenticated membership boundary.

## Logical components

- **Connection/session:** OAuth state, PKCE verifier, short-lived encrypted access token, connection health, logout/disconnect.
- **Buffer adapter:** typed minimal reads and edit operation; explicit union/error handling; redacted diagnostics.
- **Campaign store:** selected organization, posts, baselines, fact values, exact span bindings and revisions.
- **Patch planner:** deterministic transformation of a known text version; no external action.
- **Review manifest:** immutable local record of the proposed before/after text and approved subset.
- **Apply coordinator:** serializes this app's operation for a campaign and records each external outcome.
- **Receipt viewer:** current evidence and unresolved items, never inferred all-or-nothing success.

## Data model in plain language

| Entity | Minimum information | Important constraint |
| --- | --- | --- |
| Connection | Internal owner, provider account, granted scopes, token expiry | Token encrypted separately; no secret in receipts |
| Campaign | Owner, organization, title, local revision | One organization, authorization checked server-side |
| Draft snapshot | Post/channel IDs, full supported text, status, observed time, fingerprint, exclusion signals | Minimal needed fields; not an archive of the full account |
| Fact/rendering | Label, literal current value, revision | No implied semantic truth or automatic date interpretation |
| Binding | Post, baseline fingerprint, exact range/text/context, rendering | Non-overlapping and explicit |
| Review | Campaign revision, selected posts, before/after text fingerprints, exact proposed text, expiry, approval | Bound to owner and current local revision |
| Operation | Review reference, local operation key, per-post state, attempt time, request outcome | Duplicate clicks reuse same local record |
| Unresolved write guard | Provider account, organization, post ID and unresolved operation reference | Blocks further writes to that post across sessions and campaigns |
| Receipt | Intended/observed fingerprints, verification time, status, redacted failure | Does not claim remote idempotency or permanent state |

Full baseline text is needed to generate precise replacements. A hash is a change detector, not confidentiality or proof of truth. Treat campaign copy as private user content. Keep retention short and explicit.

## Patch planning invariants

1. All selected posts belong to the authenticated owner’s chosen organization and are supported plain-text drafts.
2. Bindings point to the exact captured text, cannot overlap, and resolve unambiguously.
3. Changing a fact only changes explicitly linked spans. Unselected identical phrases are untouched.
4. Apply spans from the end of the text toward the beginning, or use an equivalent tested range-preserving method.
5. The preview and proposed payload are derived from the same immutable manifest.
6. Any local edit, selection change, refreshed baseline, session change, or review expiry invalidates approval.
7. Empty or no-op changes produce no remote write. Meaningful control characters and ambiguous Unicode selection block review.

## Apply protocol

At batch start, validate the review once under an app-local operation lock. Consume its approval into one durable operation with an immutable approved manifest. Duplicate submissions return that operation; they do not dispatch a second batch. Freeze campaign edits while it is active, or cancel remaining work before editing. Cancellation and account/session changes stop unstarted items; they do not cancel a request already claimed for dispatch.

For each selected post, sequentially:

1. Load the active operation and its immutable item, not a fresh reusable approval. Check owner, organization, item state and cancellation.
2. Read the post again from Buffer. Re-run the complete supported-content classifier, including media, thread, annotation, link-metadata, status and permission exclusions. Compare exact text and relevant state with the approved baseline. Newly unsupported content is a conflict even when top-level text is unchanged.
3. If anything changed, mark Needs review and stop before this write. Do not merge silently. Already completed posts remain completed; later posts are Not attempted.
4. Immediately before dispatch, atomically claim the item as Applying and create its post-level write guard under durable coordination shared by all app workers. Recheck the active owner/session, cancellation, item state and any existing guard in that same claim. If cancellation or logout wins before the claim, mark the item Not attempted and do not send. Once the claim wins, cancellation stops later items; this item may still be sent and needs its own outcome. Submit the minimal text edit only. Never include stale arrays or scheduling fields just because they were in the snapshot.
5. A definite API rejection becomes Failed. A timeout/disconnect after dispatch becomes Outcome unknown, not Failed.
6. After a confirmed success response, read current state. Mark Verified only when intended text and supported draft state match. Unexpected status or text is Needs review/Outcome unknown with precise evidence, not green success. A matching read alone cannot establish completion of an uncertain request.
7. Store the new baseline and refresh affected bindings only from the verified exact text. These internal result updates do not change or invalidate the remaining items in the operation’s immutable manifest. A user edit cannot mutate that manifest. Finish with per-post totals.

Fail-stop is the default: an unexpected result halts remaining writes. A later batch can resume only with a fresh review of unresolved posts. There is no automatic rollback of successful edits.

## Reconciliation after uncertainty

Record current text separately from request completion. An intended-text match can be reported as “Matches intended text, observed at [time]”; it does not prove which actor made the change or that the earlier request has finished. Old text can mean the request has not applied yet. A third text is a conflict needing operator review. None of these observations alone clears an unresolved request.

Keep the item in Outcome unknown and block further writes to that post until sufficient provider evidence establishes that the earlier request is no longer in flight. A fresh approval, elapsed time or another matching read is not completion evidence. If no supported way to obtain that evidence is available, offer read-only reconciliation and manual inspection; do not invent a safe retry interval. After completion is established, compare current text and eligibility again before assigning a final outcome or preparing a fresh review.

The unresolved-write guard belongs to the provider account, organization and post, independently of the campaign or session. Check it before every dispatch. Cancellation, logout, reconnect and campaign deletion/recreation must not clear it. Retain only the identifiers and operation state needed for that guard, without tokens or draft copy; define and disclose its retention before release.

App-local operation keys prevent repeated local submission. They are not provider-supported idempotency keys. A crashed process resumes at reconciliation, not at “send again.” This includes a crash after the durable dispatch claim when the app cannot establish whether the request was sent.

## Residual concurrency risk

Buffer's documented edit input does not expose a version precondition. Another editor can change or schedule the draft between our final read and write. Our local lock cannot stop that. Fresh reads, draft-only scope, immediate verification, short batches, and asking the operator to avoid concurrent edits reduce the risk but do not eliminate it. Never describe this as conflict-proof, transactional, or safe against every race.

If product requirements demand guaranteed non-overwrite, the write feature must wait for provider support or a verified alternative. A preview/export-only fallback can be useful, but it is a reduced product and must be described as such.

## Session and lifecycle

On logout, stop unstarted items, invalidate the local session and delete its tokens. Keep the outcome of any already claimed request visible without promising remote cancellation; preserve its unresolved-write guard. Local campaign deletion is separate from deleting Buffer content. Disconnect should explain how to revoke the app in Buffer; implement programmatic revocation only if a documented supported route is verified. No background polling or refresh job. The service should offer a sample mode during a provider outage while clearly marking live actions unavailable.
