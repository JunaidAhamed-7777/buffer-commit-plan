# Build roadmap and stop gates

The sample and live adapter are implemented locally. An authorized live check verified OAuth and one Bluesky draft edit with read-back. The phases below record the original plan and its remaining proof. [Live test evidence](../evidence/README.md#live-buffer-verification-on-11-november-2026)

The deadline is 14 November 2026 at 07:59 UTC / 13:29 IST. Leave time for verification and review of the submission artifacts.

## Phase 0 · Design and repository preparation

The design pass produced the product scope, API map, architecture, failure matrix, privacy model and evidence checklist. The skeleton phase reserved the source, test, data and asset directories for the app now in the repository.

Exit: another builder can explain the job, exclusions, safety limits, first API spike, and completion gates without this conversation.

## Phase 1 · Prove the integration before polishing

After the required account and access approvals:

- Register/configure the least-privilege OAuth client through an approved secure flow.
- Confirm redirect, state, PKCE, denial, reconnect, and server-side token handling.
- Read an authorized plain-text draft, apply one exact separately approved test edit, and verify it by read-back plus Buffer UI.
- Prove a second text-capable channel; establish draft/status/permission and special-content filters.

Stop the live check if credentials, channel eligibility, OAuth writes or read-back cannot be verified. Record the blocker with the [validation plan](../engineering/validation.md).

## Phase 2 · Complete one local correction loop

The local workflow covers draft snapshots, manual span linking, literal fact edits, immutable previews and explicit approval. The patch planner has tests for Unicode selection and overlapping links.

Exit: fixture suite proves only selected spans change; no-op and stale-baseline cases are refused; the whole workflow is keyboard-usable.

## Phase 3 · Wire safe-enough external execution

The server implements account and organization checks, sequential apply, durable state, per-post preflight and read-back, single-use approval and read-only reconciliation. One live edit passed on Bluesky. The live multi-draft and second-channel checks remain open. [Write protocol](../engineering/architecture.md)

Exit: one real three-draft story and the failure matrix pass with evidence. Two channels are genuinely exercised. An ambiguous timeout is not marked failed and blindly retried.

## Phase 4 · Craft and comprehension

Refine phrase selection, compact/full diffs, held-post explanation, receipts, accessibility and narrow-screen layout. Use sample mode for onboarding only. Test the first-time link/setup burden against manual editing.

Exit: the user understands partial completion and can recover without inventing a guarantee. The two-minute story remains comprehensible.

## Phase 5 · Evidence and authorized submission

Deploy only within approved hosting scope/budget. Validate public reachability, OAuth redirect configuration, privacy/contact pages, and availability through judging. Record an honest live demo and write the summary from measured behavior. Review terms and submit only when authorized, using a verified final artifact set.

Suggested internal evidence freeze: 13 November, 18:00 IST. This is a proposed planning buffer, not an organizer deadline or user commitment. It leaves time to inspect the real submission flow before the 14 November 13:29 IST cutoff. If time is short, cut features rather than verification.

## Cut ladder

Cut in this order: alternate literal renderings → decorative polish → extra fact types → more than three drafts. Keep OAuth, real API edits/read-back, precise diffs, stale-edit refusal, uncertainty handling, owner isolation and honest disclosure.

Never cut security or replace live integration with fictional receipts to meet the clock. If two-channel support is not verified, accurately label the reduced single-channel product and reconsider the submission story.

## Evidence by component

| Slice | Dependency | Exit proof |
| --- | --- | --- |
| Connection and isolation | Access approval | Real account/organization read, denial and isolation tests |
| Supported draft selector | Connection | Explicit exclusions, pagination, second-channel proof |
| Fact binding and planner | Selector | Deterministic fixtures and unchanged-copy tests |
| Review manifest | Planner | Version-bound approval and invalidation tests |
| Apply and reconcile | Review + real edit spike | Per-post outcomes and no-blind-retry behavior |
| Editorial UI | Correct full flow | Usability observations, keyboard/mobile checks |
| Release evidence | All required gates | Live demo, accessible app, sanitized logs |

Each slice should be a small meaningful commit or sequence. Push on each tested milestone, preserve failures, and re-check the remote head. Do not create a new competing implementation when the user is already building elsewhere; reconcile ownership first.
