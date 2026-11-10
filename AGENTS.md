# Patchwork working instructions

## Current phase

The owner authorized converting the planning repository into a public project skeleton, while explicitly saying **do not start coding**. Repository organization, documentation, placeholder directories and regular commits are allowed. Application implementation is not.

Do not add executable source, framework scaffolding, package manifests/lockfiles, executable tests, migrations, CI workflows, generated UI/assets, OAuth clients, credentials or deployments in this phase. Do not connect social accounts, write Buffer drafts, submit the contest or spend money. Publishing this repository does not authorize those actions.

## Read first

- README.md and docs/development/getting-started.md
- docs/product/specification.md
- docs/engineering/buffer-api.md
- docs/engineering/architecture.md
- docs/engineering/security-and-privacy.md
- Latest entries in docs/planning/refinement-log.md

The planning history is preserved. Earlier private-only/planning-only notes describe an earlier phase; the current owner instruction and this file govern the skeleton transition. Keep every claim of implemented behavior tied to real evidence.

## Intended boundaries

- src/app: composition and routes; src/components: accessible presentation.
- src/domain: pure deterministic binding, patch and review rules.
- src/server: auth, Buffer adapter, campaigns, operation coordination and storage.
- tests: unit, integration, end-to-end and synthetic fixtures.
- data/migrations and public: future schema/assets, not current implementation.

Directory READMEs define responsibilities; empty markers keep folders tracked. They are not permission to fill them with code. Confirm stack and actual run/test commands when implementation is authorized. Check relevant repository-local skills if present.

## Product constraints

One operator, one organization, selected plain-text drafts, explicit phrase linking and reviewed exact text changes. Exclude publishing, scheduling, media, threads, annotations, runtime AI and automatic rollback in the MVP.

Any observed baseline/eligibility change invalidates the proposed patch. Consume approval once into an immutable operation. Handle each external outcome honestly; never blindly retry an uncertain write. No remote atomicity, compare-and-swap or exactly-once guarantee is documented. A local lock cannot eliminate the provider race.

## Change discipline

Preserve user changes and git history. Commit coherent milestones and sync to the remote regularly; verify the resulting remote head. Do not force-push, publish private user content or add a licence without the owner's decision. Keep credentials out of every file and screenshot.

During skeleton work, validate relative links, current-phase consistency, supported placeholder file types and absence of implementation. No app test result can be claimed. During later coding, run the actual repository's tests/checks and distinguish passed, failed, blocked and not run.

Refinement must remove a real risk, simplify scope or strengthen the proof. Stop adding documents when they repeat an existing source of truth. Read new external evidence before changing a settled decision.
