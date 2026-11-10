# Getting started

## Run locally

Install Node.js 24.2 or later and npm 11 or later. Patchwork uses Next.js, React, TypeScript and the SQLite driver bundled with Node.js.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The sample works without Buffer settings. Change the venue to Studio 9, review the diffs and apply the selected changes. SQLite creates the local database at `.patchwork/patchwork.sqlite` unless `PATCHWORK_DB_PATH` is set.

## Configure an approved Buffer client

1. Confirm the account, requested scopes and authorized test drafts. [API feasibility and capability gates](../engineering/buffer-api.md)
2. Register a confidential client named Patchwork. Allow `account:read`, `posts:read`, and `posts:write`, and add `https://localhost:3000/api/buffer/callback` as its redirect. Buffer requires HTTPS for localhost too. [Buffer registration guide](https://developers.buffer.com/guides/building-apps.html#registering-an-app-client)
3. From the project directory, run `./scripts/start-buffer-live.ps1` in your own PowerShell. It uses OpenSSL from Git for Windows or PATH. Enter the client ID and paste the secret into the masked prompt. The launcher supplies the credentials and a fresh token encryption key to the server process.
4. For a hosted live connection, register the HTTPS callback and set `PATCHWORK_DB_PATH` to an absolute path on a persistent volume. A reverse proxy should preserve the public `Host`, set the trusted `X-Forwarded-Proto` and omit callback query strings from access logs.

Open [the HTTPS workspace](https://localhost:3000). The launcher prints the fingerprint of its temporary certificate and leaves system trust settings unchanged. If the browser shows a certificate screen, verify the localhost address and fingerprint before deciding whether to proceed. Choose **Connect Buffer** and review the permissions on Buffer’s consent screen. After restarting the launcher, disconnect and reconnect if the previous session is still open.

Use a dedicated, unscheduled plain-text draft on an already connected Bluesky or LinkedIn channel. The first live check needs an approved read, one exact edit and a read-back. Live OAuth and channel support are pending verification.

## Publish the showcase on Vercel

The showcase is a static project page with a browser-only demo. `npm run build:showcase` compiles the patch planner and copies the public assets into `dist/showcase`.

In the Vercel web dashboard, import this GitHub repository into your Hobby account. Keep the root directory at the repository root and choose **Other** as the framework preset. Use Node.js 24.x. Set **Build Command** to `npm run build:showcase` and **Output Directory** to `dist/showcase`. Leave environment variables empty. [Vercel build settings](https://vercel.com/docs/builds/configure-a-build)

These settings publish the showcase. Hosting the connected app on Vercel Functions would require a shared transactional database for OAuth sessions, reviews and write guards because the local SQLite file cannot persist across instances. [Vercel SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Node test runner covers unit and integration tests. Playwright exercises the sample in Chromium. Record results against the [validation plan](../engineering/validation.md), which separates local checks from real Buffer evidence.

## Where work belongs

| Location | Responsibility |
| --- | --- |
| src/app | Pages/routes and composition |
| src/components | Accessible review UI |
| src/domain | Pure fact, binding and patch rules |
| src/server/auth | Session and identity checks |
| src/server/buffer | Provider adapter |
| src/server/campaigns | Authorized campaign records |
| src/server/operations | Reviewed apply and reconciliation |
| src/server/storage | SQLite workspace records, sessions and write guards |
| data/migrations | Future approved schema migrations |
| tests | Unit, integration, end-to-end checks and synthetic fixtures |
| public | Public-safe static assets |
| docs/evidence | Sanitized, accurately labeled proof |

## Repository hygiene

Commit small coherent milestones and sync each completed one. Preserve the existing planning history. Keep fresh evidence and plans separate. No force pushes, invented test results, public secrets or unapproved live actions. A software licence has not been selected; public visibility alone is not an open-source licence.
