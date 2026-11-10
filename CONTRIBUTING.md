# Contributing to Patchwork

## Before changing anything

Read [AGENTS.md](AGENTS.md), the [development guide](docs/development/getting-started.md), and the relevant design document. Keep the draft-only product boundary and its honest API limitations intact.

Use small coherent commits. Prefer a draft pull request for a proposed change unless the owner asks for another workflow. State what changed, why, and what was actually checked. Keep planning decisions in their existing document instead of creating duplicate specifications.

## Checks before pushing

- Run the checks for the affected code. [Development commands](docs/development/getting-started.md#checks)
- Check relative links after moving documentation. Report test results with their environment and say which cases used a simulated provider.
- Keep secrets, account exports and private drafts outside the repository. Use synthetic sample content and assets you have rights to share.

## Scope

Do not turn Patchwork into a scheduler or a generic AI content suite. Ask whether a change helps exact fact-linked review and correction. Read the [roadmap](docs/development/roadmap.md) before expanding scope.

The owner has yet to choose a software licence.
