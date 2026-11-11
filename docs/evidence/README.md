# Evidence

The repository has local tests, simulated Buffer cases, a public sample demo and a verified live Bluesky edit. A second channel and performance benchmarks remain open.

## Vercel verification on 11 November 2026

- The workbench build from `a9aa3bb` reached Ready on Vercel Hobby with Neon Free. The public home and privacy page returned HTTP 200. [Workbench](https://patchwork-workbench.vercel.app/) · [Privacy policy](https://patchwork-workbench.vercel.app/privacy)
- A fresh sample session saved two selected changes, left the third draft intact, and created a secure session cookie. In a separate check, eight concurrent approvals returned the same operation and a second sample session could not reuse its review. The public callback rejected a request without matching OAuth state.
- The operator approved consent at the registered production callback. Patchwork returned to the public domain in connected mode, loaded the configured organization and listed the existing Bluesky test draft with the verified text from the localhost edit.
- At 06:51 UTC, the public workbench at `1fad232` changed the linked `Studio 9` to `Studio 12` and returned one **Verified** receipt after API read-back. A fresh load of Buffer showed `Patchwork test: meet at Studio 12. The old map still says Studio 4. Bring a notebook.` under **Unscheduled**, with one draft, zero queued posts and zero sent posts.
- All 42 Node tests passed with a disposable PostgreSQL 18 instance, including tests that use two independent pools. All seven Playwright tests, typecheck, and a clean production build passed.

## Live Buffer verification on 11 November 2026

- Patchwork `24e7594` ran on Windows over localhost HTTPS. After the operator completed Buffer consent, Patchwork showed the connected state and loaded the organization and eligible Bluesky draft through Buffer.
- The unscheduled test draft read `Patchwork test: meet at Studio 4. The old map still says Studio 4. Bring a notebook.` The full-draft review showed one change, to the first occurrence of `Studio 4`.
- At 06:21 UTC, Patchwork applied the reviewed edit and reported **Verified** after API read-back. After a separate reload, Buffer showed `Patchwork test: meet at Studio 9. The old map still says Studio 4. Bring a notebook.` under **Unscheduled**. The channel showed one draft, zero queued posts and zero sent posts.

## Stress verification on 11 November 2026

- On Windows with Node.js 26.8.1, all 39 Node tests passed. The planner preserved exact ranges across 600 seeded multilingual cases, handled 5,000 replacements at the preview limit, and rejected invisible-only replacements and oversized output. Provider fixtures covered oversized responses and malformed UTF-8.
- The simulated write tests forced a delayed read to return after another account's edit had finished. The delayed operation stopped before dispatch. The coordinator and storage suites passed 20 consecutive runs during development.
- All seven Playwright tests passed. Sixteen concurrent sample approvals returned the same operation; a different session could not use that approval. Wrong-origin, oversized and malformed requests left the review intact. Chromium also verified keyboard focus, stale selections, expired sessions and access to unresolved receipts with long content at 320 px.
- Typecheck, the production and showcase builds, and the strict UI audit passed. A production HTTP smoke run with a simulated Buffer provider checked PKCE, rejected invalid and replayed callback state, rotated the secure session cookie, sent exactly one approved text edit and verified it by reading the draft back. No Buffer request left the test process.

## Local verification on 11 November 2026

- The 28 Node tests passed on Windows with Node.js 24.2.0 and 26.8.1. They cover exact edits, stale reviews and links, cancellation, uncertain writes, OAuth response handling and durable storage. Provider responses were simulated.
- Both Chromium tests passed. The sample saved only the two approved drafts. Keyboard linking and dialog focus also worked at a 390 px viewport.
- Typecheck, the production build and the strict UI audit passed. A local production smoke run applied three sample edits, verified their receipts and opened the privacy page.
- The Vercel showcase build produced a static page and browser demo. Chromium verified keyboard review, applying only selected edits, preserving an unlinked occurrence and reflow at 320 px. The demo made no external requests.
- The localhost HTTPS launcher passed a smoke test with dummy client credentials. It issued a Secure, HttpOnly session cookie and a PKCE redirect with the registered callback and three scopes. The test stopped before contacting Buffer.
- The Vercel Hobby deployment of showcase build `3b35477` reached Ready. All six public files matched the local build. Chromium verified the sample edit and privacy navigation on the public URL. [Showcase](https://patchwork-showcase.vercel.app/) · [Privacy policy](https://patchwork-showcase.vercel.app/privacy.html)

Record the date, commit, environment and expected and observed results. Label each result sample, simulated or live. Share sanitized artifacts and keep credentials, private drafts and account screenshots out of the repository. [Validation plan](../engineering/validation.md) · [Submission checklist](../contest/submission-checklist.md)
