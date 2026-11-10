# Product specification

**Working product promise:** Change the fact. Keep the voice.

A fact is a value the user deliberately links to exact text spans in selected Buffer drafts. A fact is not a model's guess about what a post means.

## Primary job

When an event detail changes after I have drafted its promotion, help me find and review the affected words across my selected drafts, then make only the changes I approve.

First persona: a solo workshop creator. No claim that research participants were interviewed. First scenario uses fictional workshop data and user-authorized test drafts.

## Proposed MVP

- One signed-in operator and one explicitly selected Buffer organization.
- One active campaign with three to ten selected plain-text drafts across two verified text-capable channels. Fewer connected channels can support a technical smoke test but not substantiate a multi-channel demonstration.
- Three fact labels: venue, date label, registration URL. Each stores a literal replacement string, not a semantic event model.
- User selects exact occurrences in draft text and links them to a fact. One fact may have multiple separately approved literal renderings, such as “Sunday, 22 November” and “22 Nov”. The first demo can use one rendering per fact to limit work.
- Edit a fact, view an impact list and exact before/after text, approve a bounded set, apply sequentially, verify each read-back.
- Stale, missing, ambiguous, unsupported, or inaccessible posts are withheld. Partial completion is visible.
- No scheduling or publishing control exists in the MVP UI.

## Critical workflow

1. **Try a sample.** A clearly labeled local sample teaches linking and diff review without credentials. It never pretends to be connected or to have changed Buffer.
2. **Connect Buffer.** Explain requested access; preserve a safe return point on denial. No write occurs merely because OAuth succeeded.
3. **Choose organization and drafts.** Show channel, status, excerpt, and fetch time. Paginate supported draft queries; tell the user if only part of their content was loaded. No cross-organization selection.
4. **Link phrases.** Highlight “Studio 4” in each chosen draft, assign Venue. A selected occurrence becomes visibly linked; identical unselected text stays ordinary text.
5. **Change a fact.** Enter “Studio 9”. Show affected posts and occurrences, excluded items, and exact changed characters.
6. **Review.** Each selected draft has a compact diff and a full-context expansion. Confirm the exact batch, never a generic “fix everything” permission.
7. **Apply and verify.** Re-read each post, check supported draft state and permissions, send the minimal edit, then compare the read-back. Show a receipt per post.
8. **Resolve held posts.** Re-import fresh text, rebind affected phrases, and require a new preview/approval. Never reuse the old whole-text payload.

## Linking semantics

A link owns a specific range in a specific baseline text. Store the selected string, its range, a small context anchor, fact/rendering identifiers, and the baseline fingerprint. Do not use global find-and-replace.

For the MVP, **any changed baseline text invalidates the previous patch**. Even a harmless added sentence needs refreshed review. This deliberately avoids a rushed merge engine. Re-importing preserves the newest draft text; the operator relinks only the affected phrase. A later enhancement may suggest new anchors, but may not apply them automatically.

Reject overlapping selections and empty values. Treat URLs as literal text. Do not fetch links or infer whether a URL is trustworthy. Use Unicode-aware selection and show actual rendered text; block uncertain offsets rather than shifting by guesswork.

Date labels have no automatic calendar semantics. Replacing “21 November” does not update “Saturday,” “tomorrow,” local times, or text in an image. Every changed occurrence must be linked and previewed. Keep this limitation beside the input, not buried in a FAQ.

## Scope exclusions

Scheduled/sent/failed/approval-pending posts, media and captions bound to media, threads, mentions or annotations, service-specific metadata edits, automatic entity detection, imported scraped content, bulk creation, templates, undo/rollback, analytics, multiple operators, scheduled jobs, model calls, voice/image generation, and any public posting.

If the API cannot distinguish a special post from a supported plain-text draft, exclude it. Do not silently strip formatting or metadata to make a request pass.

## User-visible states

| State | Meaning | Next action |
| --- | --- | --- |
| Linked | Baseline captured; no change proposed | Edit a fact |
| Ready to review | Proposed text derived from current baseline | Inspect diff |
| Approved | Exact local version and post text approved | Apply once |
| Checking | Re-reading current Buffer state | Wait or cancel remaining work |
| Applying | One request in flight | No duplicate submit |
| Verified | Read-back matches intended text and remains draft | View receipt |
| Needs review | Baseline/status/permission changed | Refresh and relink |
| Failed | API definitely rejected the operation | Resolve reason and re-preview |
| Outcome unknown | Request may have applied; evidence inconclusive | Reconcile, never blindly retry |
| Not attempted | Batch stopped before this item | Start a newly reviewed batch |

“Verified” is an observation at a timestamp, not a lock on future edits. A local operation lock cannot prevent changes in Buffer or another integration.

## Definition of product success

The user can repair the explicitly linked facts without unapproved text changes, understand anything left unresolved, and see the resulting drafts in Buffer. Fewer clicks and time savings are hypotheses to measure. A mixed result must read “2 verified, 1 needs review,” never “campaign fixed.”
