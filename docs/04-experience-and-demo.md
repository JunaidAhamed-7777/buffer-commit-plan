# Experience and demo

## Design direction

An editorial workbench, not an analytics dashboard. Warm white background, near-black text, restrained blue for linked facts, green for additions, and amber plus an icon/text label for held work. Use readable type and generous line spacing. Keep the main action quiet until the diff has been reviewed.

Three main surfaces: **Campaign → Review changes → Receipts**. A compact fact rail sits beside the draft cards. No chat pane, glowing network graph, decorative 3D scene, scores, or fake activity feed. The product's visual signature is the small, precise patch surrounded by unchanged writing.

## Campaign view

Header: campaign name, chosen organization, connection state, last fetched time. Fact rail: Venue, Date label, Registration URL, each with number of linked occurrences. Draft cards: channel label, status, excerpt, and linked spans. Selecting a fact highlights only its bound spans across cards.

Linking is the first-time usability risk. Give one short instruction: “Select the words that should change together.” Show a real selected phrase before offering “Link to Venue.” Provide keyboard selection and an alternative list of exact occurrences for users who cannot drag-select.

## Review view

Top line: “Venue: Studio 4 → Studio 9”. Below: “3 drafts affected · 2 ready · 1 needs review.” Keep held cards visible; do not hide them after filtering.

Each card contains a deletion/addition diff with text labels, full context toggle, checked selection, and a specific status. An “Unchanged” strip can say “Other text unchanged” only if comparison proves it. Do not assert that media or timing was preserved unless those fields were observed and checked. MVP excludes media and scheduled posts entirely.

Confirmation states the exact count and action: “Apply these 2 draft changes”. Pressing it consumes the approval into one immutable operation. Its approved items can finish sequentially; the approval cannot start a second operation. A cancel control stops unstarted operations; it must not imply an in-flight external request was cancelled.

## Receipts view

Each row shows intended change, result state, verification time, and a verified Buffer destination link if the API or observed UI supplies one. Never manufacture a deep-link format. If none is available, show channel/post identifiers with instructions to find the draft in Buffer.

Show errors in everyday language. Examples: “This draft changed since your review. Refresh it before applying.” “We could not confirm whether Buffer saved this change. Check its current text before retrying.” Never expose tokens or raw provider internals.

## Proposed two-minute recording

This is a script to test, not evidence that a demo exists. Use actual future Buffer OAuth and API activity, never sample data relabeled as live.

| Time | Screen and proof |
| --- | --- |
| 0–12 sec | Explain the workshop moved venue. Show three drafts with different writing. |
| 12–27 sec | Show real Buffer connection and two channels. Show the venue phrases already linked. |
| 27–47 sec | Change Studio 4 to Studio 9. The three exact diffs appear. |
| 47–67 sec | One draft was edited in Buffer after import. It becomes amber and cannot be applied with old approval. |
| 67–92 sec | Approve the two current drafts. Show per-post real mutation outcomes and read-back verification. |
| 92–112 sec | Show corresponding draft text in Buffer; explain the third is still held, with a fresh-review path. |
| 112–120 sec | “Change the fact. Keep the voice.” Show honest remaining scope. |

Do not claim all three are repaired if only two are. If first-time linking cannot be explained quickly, use a brief honest cut in the video, while keeping the live app fully inspectable. Do not fake the OAuth flow, receipt, timer, or external edit.

## Fictional sample copy

- Short: “Tiny workshop, big ideas. Meet us at Studio 4 on 21 November. Save your seat: https://example.com/workshop.”
- Personal: “I learned more from one afternoon of making than a week of scrolling. Join our hands-on session at Studio 4. Details: https://example.com/workshop.”
- Reminder: “Bring a notebook and a question. We’ll be at Studio 4 on 21 November. https://example.com/workshop.”

These examples are planning content only. They are not authorized to be posted or sent to Buffer. The demo's authorized test content can replace them later.

## Accessibility and responsive behavior

Keyboard-operable linking, facts, diff review, selection, and confirmation. Visible focus, labeled errors, no color-only distinction, minimum comfortable target sizes, and screen-reader announcements for per-post outcomes. Support narrow screens with stacked cards; do not impose desktop-only behavior based on unrelated projects. Reduced motion should be respected. Test 200% zoom and a small phone viewport before claiming accessibility.
