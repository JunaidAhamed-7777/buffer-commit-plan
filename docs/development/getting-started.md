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
3. From the project directory, run `./scripts/start-buffer-live.ps1` in your own PowerShell. It uses OpenSSL from Git for Windows or PATH. Find the existing client under [Buffer Settings → API](https://publish.buffer.com/settings/api) → **App Clients**. Enter its ID and paste the secret into the masked prompt. Leave PowerShell open while you test.

Once the launcher says Patchwork is ready, open [the HTTPS workspace](https://localhost:3000). The launcher creates a fresh self-signed certificate for localhost each time it starts. Browsers may show a privacy warning because they do not trust that certificate by default. Check the address and compare the browser’s certificate fingerprint with the SHA-256 fingerprint printed in PowerShell before deciding whether to proceed.

Choose **Connect Buffer → Continue to Buffer**, then review the permissions on Buffer’s consent screen. When the connection succeeds, Patchwork shows **Disconnect**. After restarting the launcher, disconnect and reconnect if the previous session is still open.

## Test one real draft

Use a dedicated, unscheduled plain-text draft on an already connected Bluesky or LinkedIn channel. For a disposable test, save `Patchwork test: meet at Studio 4. Bring a notebook.` as a draft in Buffer.

1. In Patchwork, select its organization and import only the test draft. Under **Venue**, link the exact occurrence of `Studio 4` and preview `Studio 9`.
2. Expand **Full draft** and review the complete before and after. For the example, the result should be `Patchwork test: meet at Studio 9. Bring a notebook.` Approve that exact text before applying the single edit.
3. Check the **Verified** receipt, then open the same draft in Buffer. Confirm that the text matches and the post is still a draft. If the receipt says **Outcome unknown**, use **Check current draft** and do not send the edit again.

## Publish the showcase on Vercel

The showcase is a static project page with a browser-only demo. `npm run build:showcase` compiles the patch planner and copies the public assets into `dist/showcase`.

In the Vercel web dashboard, import this GitHub repository into your Hobby account. Keep the root directory at the repository root and choose **Other** as the framework preset. Use Node.js 24.x. Set **Build Command** to `npm run build:showcase` and **Output Directory** to `dist/showcase`. Leave environment variables empty. [Vercel build settings](https://vercel.com/docs/builds/configure-a-build)

These settings publish the showcase. Hosting the connected app on Vercel Functions would require a shared transactional database for OAuth sessions, reviews and write guards because the local SQLite file cannot persist across instances. [Vercel SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)

For a self-hosted live connection, register the HTTPS callback and set `PATCHWORK_DB_PATH` to an absolute path on a persistent volume. A reverse proxy should preserve the public `Host`, set the trusted `X-Forwarded-Proto` and omit callback query strings from access logs.

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
