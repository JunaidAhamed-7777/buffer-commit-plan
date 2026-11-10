# Patchwork

**Change the fact. Keep the voice.**

A campaign correction desk for Buffer drafts. Patchwork is designed to link a shared venue, date label or URL across independently written posts, show exact text changes, and apply only reviewed corrections.

**Project status: skeleton ready; implementation not started.** This repository contains the product design, engineering documents, contribution guidance and reserved application/test directories. It has no runnable app, dependencies, OAuth client, live integration or deployed demo.

## The product

A workshop moves from Studio 4 to Studio 9. Three drafts describe it in different voices. The intended flow is:

1. Select plain-text Buffer drafts and link the exact venue phrases.
2. Change the venue once and inspect the proposed changes across the selected drafts.
3. Approve the precise batch. Hold drafts that changed since review.
4. See separate verified, failed or uncertain outcomes for each post.

This is the target experience, not a list of implemented features. The first version is deliberately draft-only: no publishing, scheduling, generative rewriting, media or threads. The API does not provide a documented atomic version check, so the design discloses the remaining concurrency risk.

## Start here

- [Getting started](docs/development/getting-started.md): current state, future setup gates and directory ownership.
- [Product specification](docs/product/specification.md): audience, scope and behavior.
- [Architecture](docs/engineering/architecture.md): boundaries, review manifests and operation protocol.
- [Roadmap](docs/development/roadmap.md): implementation sequence and stop gates.
- [All documentation](docs/README.md): API research, UX, validation, privacy, contest and planning history.
- [Contributing](CONTRIBUTING.md) and [agent instructions](AGENTS.md): how to continue without crossing the no-code boundary.

## Repository layout

| Path | Intended role |
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
| docs/evidence | Future sanitized proof; currently no app evidence |

The application folders contain README placeholders or empty .gitkeep markers only. They are not framework-generated code.

## Setup and checks

There is nothing to install or run yet. Runtime versions, dependency manifests, local commands, environment configuration and test runners will be added when implementation begins. Do not treat documentation/link checks as application tests.

Proposed direction: one TypeScript web application, a server-side Buffer adapter, pure deterministic patch logic and a small durable relational store. Final tooling and hosting remain open. No runtime AI is required for the core workflow.

## Buffer Commit

This project is being prepared for [Buffer Commit](https://buffer.com/api/commit). The verified submission cutoff is **14 November 2026, 07:59 UTC / 13:29 IST**. A qualifying entry still needs a public working app, Buffer OAuth, successful real API use and the required submission artifacts. A public repository alone is not an entry. See [rules](docs/contest/rules.md) and [submission checklist](docs/contest/submission-checklist.md).

## Evidence and limits

The concept has been refined against the official API and adjacent native workflows. Buffer documents individual-edit friction for scheduled multi-channel posts; usefulness for this narrower draft-only product remains a hypothesis. Setup cost, real OAuth behavior and cross-channel editing still need testing. No customers, time savings, passing application tests or awards are claimed.

The working name is provisional. No software licence has been selected; public visibility alone does not grant an open-source licence. AI-assisted planning is disclosed in the [submission notes](docs/contest/submission-checklist.md).
