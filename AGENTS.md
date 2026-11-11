# Patchwork working instructions

## Current phase

The owner authorized implementation on 11 November 2026. Build and verify the draft-only MVP, make small commits and push working milestones. Live OAuth client registration, connecting accounts, editing real drafts, deployment, spending and contest submission still require their own authorization.

Patchwork was submitted to Buffer Commit by the owner on 11 November 2026, corroborated by the organizer receipt and the owner's project identification. Submission is final; do not create a duplicate entry or treat the historical pre-submission checklists as pending submission instructions. Keep the app publicly available through at least 30 November; judging starts 16 November and winners are announced 7 December. See [submission status](docs/contest/submission-checklist.md). This status update grants no new app, account, spending or credential permissions.

## Read first

- README.md and docs/development/getting-started.md
- docs/product/specification.md
- docs/engineering/buffer-api.md
- docs/engineering/architecture.md
- docs/engineering/security-and-privacy.md
- Latest entries in docs/planning/refinement-log.md

The planning history records earlier phases. Keep implementation and live integration claims tied to separate evidence.

## Intended boundaries

- src/app: composition and routes; src/components: accessible presentation.
- src/domain: pure deterministic binding, patch and review rules.
- src/server: auth, Buffer adapter, campaigns, operation coordination and storage.
- tests: unit, integration, end-to-end and synthetic fixtures.
- data/migrations and public: future schema/assets, not current implementation.

Directory READMEs define responsibilities. Keep stack and actual run/test commands in the development guide. Check relevant repository-local skills if present.

## Product constraints

One operator, one organization, selected plain-text drafts, explicit phrase linking and reviewed exact text changes. Exclude publishing, scheduling, media, threads, annotations, runtime AI and automatic rollback in the MVP.

Any observed baseline/eligibility change invalidates the proposed patch. Consume approval once into an immutable operation. Handle each external outcome honestly; never blindly retry an uncertain write. No remote atomicity, compare-and-swap or exactly-once guarantee is documented. A local lock cannot eliminate the provider race.

## Change discipline

Preserve user changes and git history. Commit coherent milestones and sync to the remote regularly; verify the resulting remote head. Do not force-push, publish private user content or add a licence without the owner's decision. Keep credentials out of every file and screenshot.

Run the actual repository tests and checks. Distinguish passed, failed, blocked and not run. Label sample and simulated provider results separately from real OAuth and Buffer edits.

Refinement must remove a real risk, simplify scope or strengthen the proof. Stop adding documents when they repeat an existing source of truth. Read new external evidence before changing a settled decision.
