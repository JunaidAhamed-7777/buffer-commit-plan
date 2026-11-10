# Evidence

The repository has local tests, simulated Buffer cases and a public sample demo. Real Buffer authorization, a real draft edit and performance benchmarks still need evidence.

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
