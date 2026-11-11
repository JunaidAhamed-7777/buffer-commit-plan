# API feasibility

Core post schema and error and rate limit guidance were rechecked on 11 November 2026. OAuth guidance was last checked on 10 November. The first live check verified OAuth, an authorized draft read, `editPost` and read-back on Bluesky. The checks below still govern which content and responses Patchwork accepts. [Live test evidence](../evidence/README.md#live-buffer-verification-on-11-november-2026)

## Stable core to validate first

| Product need | Documented surface | What the spike must prove |
| --- | --- | --- |
| Identify account/organization | account and organization/channel queries | Required minimal scopes, actual organization selection and isolation |
| Load eligible drafts | posts and post queries | Draft filtering, pagination, text, status, channel and allowed actions |
| Change plain text | editPost with EditPostInput | Draft editable via OAuth; minimal ID/text edit preserves unrelated fields |
| Verify result | post query after mutation | Read-back text and state, including behavior after a lost response |
| Optional later draft creation | createPost with saveToDraft | Explicitly excluded from initial product; no automatic publication |

[API reference](https://developers.buffer.com/reference) · [EditPostInput](https://developers.buffer.com/types/EditPostInput.html) · [Posts guide](https://developers.buffer.com/guides/posts-and-scheduling.html)

Important confirmed semantics: `editPost` is the mutation name. Omitting text preserves it, while null/empty can clear it; omit unrelated input fields. Omitting assets preserves them. Omitting scheduling fields preserves scheduling. Threaded text has additional constraints, so exclude threads. No expected-version input or atomic batch-edit guarantee was found. Do not invent either.

## Evidence needed to admit a draft

At import and each final preflight, verify the post's channel/organization membership, literal `status: draft`, and `allowedActions` containing `updatePost`. The permission is named `updatePost`; the mutation remains `editPost`. Other statuses, including `needs_approval`, are outside scope. These fields narrow the classifier; they do not replace ownership or supported-content checks. [Reference](https://developers.buffer.com/reference) · [PostStatus](https://developers.buffer.com/types/PostStatus.html).

An empty assets list is insufficient. Inspect the concrete metadata type: [Bluesky metadata](https://developers.buffer.com/types/BlueskyPostMetadata.html) exposes annotations, link attachments and thread fields; [LinkedIn metadata](https://developers.buffer.com/types/LinkedInPostMetadata.html) also exposes a first comment. Prove how each chosen service represents ordinary text and excluded structures in actual OAuth responses. An omitted field, unknown metadata type or incomplete response is not evidence that unsupported content is absent. Keep uncertain cases excluded, including any automatically generated URL annotations or previews until their behavior is understood.

## Classifying an edit response

Request `__typename`, the `PostActionSuccess` result and a `MutationError` catch-all. Inspect both `data` and top-level `errors`; HTTP 200 alone proves neither success nor rejection. A success result can carry warnings, so check them and read back without resending the edit. [Error handling](https://developers.buffer.com/guides/error-handling.html) · [PostActionPayload](https://developers.buffer.com/types/PostActionPayload.html).

Patchwork's policy is to mark Failed only with evidence of a definite no-write rejection. A generic `UnexpectedError`, unclassified error member, malformed/missing response or transport failure after dispatch stays Outcome unknown unless stronger evidence resolves it. An error message alone is insufficient. Follow the [reconciliation protocol](architecture.md#reconciliation-after-uncertainty), including its block on further writes.

The [rate-limit guide](https://developers.buffer.com/guides/api-limits.html) documents rejected HTTP 429 responses with `Retry-After`, despite the error guide's broad statement that GraphQL returns 200. Handle both. A confirmed provider rate-limit rejection stops the batch as Failed; honor the wait before a fresh preflight/review, without automatically replaying the consumed operation. App clients have separate quotas from personal keys/MCP; capture actual rate headers instead of hard-coding example limits.

Keep diagnostic types/codes and timing, with provider messages sanitized. Do not copy full-query/variable/response logging examples: those can expose draft text or credentials. Generic retry examples do not override the stricter uncertain-write policy.

## OAuth plan

Use authorization-code OAuth with PKCE and state checking. Register the exact redirect URI only after approval for persistent access. Proposed minimum scopes are account:read, posts:read, posts:write, subject to confirming organization/channel access in a real spike. Do not copy the documentation's broad example scopes. Avoid account:write, ideas, snippets, notes and offline_access for the MVP.

A short interactive session can reconnect when its access token expires. If offline access later becomes necessary, request it separately and implement serialized refresh-token rotation. Never use a personal key as the shipped contest integration. Keep credentials server-side and redact them from logs and recordings. [Authentication guide](https://developers.buffer.com/guides/authentication.html).

## Capability gates, in order

1. User approves implementation and exact account/client access setup. No credentials in chat or git.
2. OAuth succeeds and denial/state-mismatch paths fail safely.
3. Account, selected organization and eligible channels load without excessive permissions.
4. Read one user-authorized test draft and capture its text/status/metadata snapshot.
5. Approve one exact, low-stakes test edit. Send only the necessary fields.
6. Read the result and inspect the actual Buffer draft; compare unchanged fields.
7. Repeat across a second text-capable network and check permissions/unsupported states.
8. Demonstrate a controlled stale-read case and a simulated unknown-response case without unsafe retries.

Record exact schema version/date, operation names and redacted responses only after execution. Test drafts must be specifically authorized. A successful account read alone demonstrates connectivity but not Patchwork's product function. Before batch writes, establish which response types prove rejection/completion and whether any supported evidence can resolve a lost response; do not assume a later text match settles that question.

## Unknowns that can change the plan

- The authenticated account's real channels, plan restrictions and client-registration availability.
- Which documented metadata fields and actual OAuth responses suffice to reject annotations, threads, approvals and media without ambiguity on each chosen channel.
- Error behavior and consistency delay for read-after-write in actual OAuth use.
- Actual rate headers and quotas for the authorized app client; the documented policy is not a measurement of this project's access.
- Whether default link previews or provider normalization alter nominally plain text. Read back; never normalize away a meaningful difference to claim success.
- Whether documented `draft`/`updatePost` checks and service metadata behave as required on both chosen channels.
- No documented remote lock or conditional edit. The residual race is an accepted limitation to disclose, not a missing feature we can magic away locally.

## Explicit non-dependencies

No post metrics: current public guidance restricts metrics to personal-key workflows, which is unsuitable as an OAuth product dependency. No experimental Content Items, native templates, content scanning, comments, social-platform APIs, image upload or web scraping.

If editing via OAuth fails, do not silently pivot to a personal API key or a copy-only mock and call it complete. Record the blocker; propose a separately chosen scope or stop. Sample mode remains an honest demonstration aid, never live integration evidence.
