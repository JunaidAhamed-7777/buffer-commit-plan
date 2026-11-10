# API feasibility

Research checked 10 November 2026. **Documented is not tested.** No authenticated Buffer request has been made for this project. These are requirements for a later authorized spike, not executable examples or implementation.

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

Record exact schema version/date, operation names and redacted responses only after execution. Test drafts must be specifically authorized. A successful account read alone demonstrates connectivity but not Patchwork's product function.

## Unknowns that can change the plan

- The authenticated account's real channels, plan restrictions and client-registration availability.
- Exact query fields needed to reject annotations, threads, approvals and media without ambiguity.
- Error behavior and consistency delay for read-after-write in actual OAuth use.
- Limits/rate policies for this client. Read official error/limit docs before implementing; do not guess numbers.
- Whether default link previews or provider normalization alter nominally plain text. Read back; never normalize away a meaningful difference to claim success.
- Whether a reliable edit action/status check is available for every supported service.
- No documented remote lock or conditional edit. The residual race is an accepted limitation to disclose, not a missing feature we can magic away locally.

## Explicit non-dependencies

No post metrics: current public guidance restricts metrics to personal-key workflows, which is unsuitable as an OAuth product dependency. No experimental Content Items, native templates, content scanning, comments, social-platform APIs, image upload or web scraping.

If editing via OAuth fails, do not silently pivot to a personal API key or a copy-only mock and call it complete. Record the blocker; propose a separately chosen scope or stop. Sample mode remains an honest demonstration aid, never live integration evidence.
