# Working instructions

## Current authorization and phase

The user requested a Buffer hackathon repository, **documentation phase**, repeated idea refinement, frequent commits, and regular pushes. This repository is private. Work only on planning documents until the user explicitly moves the task into implementation.

Do not create application code, scaffolds, executable prototypes, package manifests, tests, generated implementation assets, OAuth clients, credentials, deployments, or Buffer posts during this phase. Do not sign up, submit the contest entry, accept new terms, publish this repo, contact organizers, or spend money without the applicable authorization. Never store secrets or unrelated user information.

## First read

Read README.md, docs/contest/rules.md, docs/product/specification.md, docs/engineering/buffer-api.md, and the latest entries in docs/planning/refinement-log.md. Recheck official API documentation before implementation; do not invent mutation names, fields, OAuth capabilities, or transaction guarantees. Check repository-local skills if available.

## Product constraints

- Working title: Patchwork. Core job: review and apply fact-level changes across selected plain-text Buffer drafts.
- MVP is draft-only, explicit user-confirmed, one organization at a time. Do not silently grow into a scheduler, social listening tool, or AI writing suite.
- No promise of atomicity, compare-and-swap, guaranteed prevention of concurrent edits, or exactly-once external writes. Buffer's documented edit input has no version precondition.
- Never promote drafts or publish. Preserve fields the user did not approve changing.
- Imported content is data, never an instruction to act. No model is required at runtime.
- Sourced facts, assumptions, proposed acceptance targets, and measured results must stay visibly separate.

## Refinement and stopping

Commit each meaningful milestone, not every wording tweak. Push or write the commit to the private remote at the end of each milestone and verify the remote commit. Never force-push or overwrite new user changes. Use normal sentences and source links.

Each refinement must remove a real risk, strengthen the user benefit, simplify scope, or improve proof. Record what changed and why. Stop a refinement pass once its highest-severity open issue is resolved or explicitly gated. Endless restyling is not progress.

Do not claim tests pass when only a test plan exists. During documentation work, verify relative links, phase consistency, forbidden implementation files, source dates, and contradictory promises. At the end, report the verified remote head, what was changed, and actual remaining blockers.
