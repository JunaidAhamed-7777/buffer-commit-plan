# Evidence

The repository has local test suites and simulated Buffer cases. Live OAuth, real edits, benchmarks and a live demo still need evidence.

## Local verification on 11 November 2026

- The 28 Node tests passed on Windows with Node.js 24.2.0 and 26.8.1. They cover exact edits, stale reviews and links, cancellation, uncertain writes, OAuth response handling and durable storage. Provider responses were simulated.
- Both Chromium tests passed. The sample saved only the two approved drafts. Keyboard linking and dialog focus also worked at a 390 px viewport.
- Typecheck, the production build and the strict UI audit passed. A local production smoke run applied three sample edits, verified their receipts and opened the privacy page.
- The Vercel showcase build produced a static page and browser demo. Chromium verified keyboard review, applying only selected edits, preserving an unlinked occurrence and reflow at 320 px. The demo made no external requests.
- The localhost HTTPS launcher passed a smoke test with dummy client credentials. It issued a Secure, HttpOnly session cookie and a PKCE redirect with the registered callback and three scopes. The test stopped before contacting Buffer.

Record the date, commit, environment and expected and observed results. Label each result sample, simulated or live. Share sanitized artifacts and keep credentials, private drafts and account screenshots out of the repository. [Validation plan](../engineering/validation.md) · [Submission checklist](../contest/submission-checklist.md)
