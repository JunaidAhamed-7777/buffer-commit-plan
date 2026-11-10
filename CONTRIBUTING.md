# Contributing to Patchwork

The repository is at the project-skeleton stage. There is no implementation to run or test yet. The current owner instruction permits structure and documentation only; coding begins after an explicit phase change.

## Before changing anything

Read [AGENTS.md](AGENTS.md), the [development guide](docs/development/getting-started.md), and the relevant design document. Keep the draft-only product boundary and its honest API limitations intact.

Use small coherent commits. Prefer a draft pull request for a proposed change unless the owner asks for another workflow. State what changed, why, and what was actually checked. Keep planning decisions in their existing document instead of creating duplicate specifications.

## Documentation and skeleton checks

- Relative links resolve after moves.
- Placeholders do not pretend to implement routes, tests or features.
- Plans and measured outcomes remain visibly distinct.
- No secret, token, account export or private draft content is included.
- Public assets have confirmed rights; sample content is synthetic.
- New source/tooling/CI work waits for implementation authorization.

No dependency manifest or test runner exists, so there are currently no install, lint, build or test commands. Add correct commands only with the chosen real tooling.

## Scope

Do not turn Patchwork into a scheduler or a generic AI content suite. Ask whether a change helps exact fact-linked review and correction. Read the [roadmap](docs/development/roadmap.md) before expanding scope.

Public visibility is not a licence choice. A software licence is still undecided; do not assume permission terms or add licensing commitments on the owner's behalf.
