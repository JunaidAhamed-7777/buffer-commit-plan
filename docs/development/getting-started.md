# Getting started

## Current state

Patchwork has a product specification, engineering design and a project directory skeleton. It has no source implementation, dependency manifest, lockfile, framework configuration, executable tests, database migrations or deployment. Nothing can be installed, run or built yet.

Do not add fake setup commands or success badges. Public source publication is separate from a working public application.

## Before implementation

1. Read [AGENTS.md](../../AGENTS.md), the [product specification](../product/specification.md), [API gates](../engineering/buffer-api.md) and [architecture](../engineering/architecture.md).
2. Obtain an explicit go-ahead to begin coding. The current instruction permits repository structure and documents only.
3. Confirm stack, package manager, hosting/storage constraints and budget. TypeScript/React/Next.js and a server-side relational store remain proposed choices, not installed dependencies.
4. Resolve approved OAuth/client setup and suitable low-stakes test drafts. Do not commit credentials, create persistent access, deploy or edit live content just because a folder exists.
5. Start with the smallest verified OAuth/read/edit/read-back slice, then implement the pure patch planner and immutable review flow. Follow the [roadmap](roadmap.md).

## Where future work belongs

| Location | Responsibility |
| --- | --- |
| src/app | Pages/routes and composition |
| src/components | Accessible review UI |
| src/domain | Pure fact, binding and patch rules |
| src/server/auth | Session and identity checks |
| src/server/buffer | Provider adapter |
| src/server/campaigns | Authorized campaign records |
| src/server/operations | Reviewed apply and reconciliation |
| src/server/storage | Durable records and encrypted secrets |
| data/migrations | Future approved schema migrations |
| tests | Unit, integration, end-to-end checks and synthetic fixtures |
| public | Public-safe static assets |
| docs/evidence | Sanitized, accurately labeled proof |

Folders do not imply microservices, packages or implemented features. Keep one application until evidence justifies more.

## First real implementation commit should establish

An actual chosen toolchain, exact runtime/package-manager versions, a dependency manifest and lockfile, working local commands, environment-variable documentation without values, and a small tested vertical slice. Add those only after coding is authorized; they are deliberately absent now.

## Repository hygiene

Commit small coherent milestones and sync each completed one. Preserve the existing planning history. Keep fresh evidence and plans separate. No force pushes, invented test results, public secrets or unapproved live actions. A software licence has not been selected; public visibility alone is not an open-source licence.
