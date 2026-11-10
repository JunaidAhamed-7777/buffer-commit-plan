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
2. Copy [`.env.example`](../../.env.example) to `.env.local`. Set `BUFFER_CLIENT_ID`, `BUFFER_CLIENT_SECRET` and the exact registered `BUFFER_REDIRECT_URI`. The local example uses `http://localhost:3000/api/buffer/callback`. Open Patchwork at that same origin.
3. Generate the 32-byte `PATCHWORK_TOKEN_KEY` using the command in `.env.example`. Keep credentials and the key in `.env.local` or a host secret store. Restart the app after editing the settings.
4. For a hosted live connection, register the HTTPS callback and set `PATCHWORK_DB_PATH` to an absolute path on a persistent volume. A reverse proxy should preserve the public `Host`, set the trusted `X-Forwarded-Proto` and omit callback query strings from access logs.

The first live check needs an approved read, one exact edit and a read-back using a low-stakes draft. Live OAuth, channel support and hosted operation are pending verification.

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
