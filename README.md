# Patchwork

**Change the fact. Keep the voice.**

A correction desk for Buffer drafts. Link a venue, date label or registration URL across drafts, then review the exact edits before applying them.

The workbench runs locally with a sample workspace and an optional Buffer connection. The public showcase runs the sample in the browser. The local workbench completed Buffer OAuth and verified an edit to an unscheduled Bluesky draft. [Live test evidence](docs/evidence/README.md#live-buffer-verification-on-11-november-2026)

## Project showcase

The showcase explains the workflow and lets visitors review and apply edits to fictional drafts in their browser. It uses the same patch planner as the app. Build it with `npm run build:showcase` and serve `dist/showcase`. [Vercel Hobby setup](docs/development/getting-started.md#publish-the-showcase-on-vercel)

[Live showcase](https://patchwork-showcase.vercel.app/) · [Privacy policy](https://patchwork-showcase.vercel.app/privacy.html)

## Try the sample

With Node.js 24.2 or later and npm 11 or later, run:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The sample has three drafts for a workshop at Studio 4. Change **Venue** to **Studio 9**, review the proposed edits, then apply them to the sample and inspect the receipts. The sample uses fictional drafts and needs no credentials.

Live changes are limited to eligible plain-text drafts. Patchwork checks each draft again before sending its approved edit. Buffer does not document a version check on `editPost`, so an edit in Buffer can still land between the check and the write.

## Start here

- Set up the app, run tests and configure OAuth. [Getting started](docs/development/getting-started.md)
- Read the scope and write protocol. [Product specification](docs/product/specification.md) · [Architecture](docs/engineering/architecture.md)
- Check the remaining verification and release work. [Roadmap](docs/development/roadmap.md)
- Find the API notes, privacy design and planning history. [Documentation](docs/README.md)
- Review the repository conventions before changing code. [Contributing](CONTRIBUTING.md) · [Agent instructions](AGENTS.md)

## Repository layout

| Path | Role |
| --- | --- |
| src/app | Application pages, routes and composition |
| src/components | Accessible review interface |
| src/domain | Pure fact, binding and patch rules |
| src/server | Auth, Buffer adapter, campaigns, operations and storage |
| tests | Unit, integration and end-to-end checks; synthetic fixtures |
| data/migrations | Future schema migrations |
| public | Public-safe static assets |
| docs/product | Specification and experience |
| docs/engineering | Architecture, API, validation and security |
| docs/development | Onboarding and roadmap |
| docs/contest | Rules and submission requirements |
| docs/planning | Preserved idea decisions and refinement history |
| docs/research | Sources and open questions |
| docs/evidence | Rules for recording test and live integration evidence |

## Buffer Commit

This project is being prepared for [Buffer Commit](https://buffer.com/api/commit). The verified submission cutoff is **14 November 2026, 07:59 UTC / 13:29 IST**. A qualifying entry still needs a public working app, Buffer OAuth, successful real API use and the required submission artifacts. A public repository alone is not an entry. See [rules](docs/contest/rules.md) and [submission checklist](docs/contest/submission-checklist.md).

## Evidence and limits

Local and simulated tests cover the correction workflow and failure cases. Setup cost and live editing on a second Buffer channel still need testing. [Validation plan](docs/engineering/validation.md)

The working name and software licence are undecided. See the [submission notes](docs/contest/submission-checklist.md) for the AI assistance disclosure.
