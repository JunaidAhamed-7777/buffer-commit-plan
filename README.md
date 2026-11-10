# Patchwork · Buffer Commit

**Change the fact. Keep the voice.**

Patchwork is a campaign correction desk for people who run workshops, launches, and community events. Link the same fact across different Buffer drafts. When that fact changes, review the exact words that need changing, then apply the approved patches to Buffer.

**Status: documentation only.** No app, OAuth client, live integration, test results, deployment, or contest submission exists in this repository. The working name is provisional, not a cleared trademark.

## The moment worth building

A workshop moves from Studio 4 to Studio 9. Its LinkedIn announcement, Bluesky reminder, and follow-up draft each say it differently. Patchwork shows the affected phrases, changes only the linked facts, and leaves the surrounding copy alone. A draft edited elsewhere is held for fresh review instead of silently overwritten.

The proposed distinction is **fact-linked, reviewed repair**, not another caption generator or content calendar. Buffer already does drafting, templates, channel variants, and scheduling. Its help center currently says existing scheduled multi-channel posts must be edited individually. Relevance to our narrower draft-only workflow remains a hypothesis to validate. [Source](https://support.buffer.com/articles/scheduling-posts-4Qdld7giAZ).

## Read in this order

1. [Event rules and action boundaries](docs/01-event-and-boundaries.md)
2. [Idea tournament and differentiation](docs/02-idea-tournament.md)
3. [Product specification and scope](docs/03-product-spec.md)
4. [Experience and two-minute demo](docs/04-experience-and-demo.md)
5. [API feasibility and unknowns](docs/05-api-feasibility.md)
6. [Architecture and write safety](docs/06-architecture.md)
7. [Evaluation and acceptance cases](docs/07-evaluation.md)
8. [Build roadmap and stop gates](docs/08-roadmap.md)
9. [Threat model and privacy](docs/09-security-and-privacy.md)
10. [Submission evidence checklist](docs/10-submission-checklist.md)
11. [Refinement and decision log](docs/11-refinement-log.md)
12. [Research sources and open questions](docs/12-sources-and-questions.md)

## Small enough to finish, sharp enough to matter

One operator, one Buffer organization, one campaign, two text-capable networks, and three to ten selected plain-text drafts. Link facts by selecting literal phrases. Preview a batch. Confirm individual changes. Verify each result. Stop on conflicts or uncertain outcomes.

No automatic publishing, scheduled-post mutation, live-post correction, generative rewriting, media, threads, analytics, external scraping, background monitoring, or promises of atomic multi-post edits in the core build.

## Contest clock

Submission cutoff: **14 November 2026, 07:59 UTC / 13:29 IST**. The build window is already open. This task remains planning-only because that is the requested phase, not because Buffer forbids building now.

Buffer requires a public working app with OAuth and successful real API use, a demo of at most two minutes, an approximately 300-word explanation, and the app client ID. Private planning documentation alone is not a qualifying submission. [Official event](https://buffer.com/api/commit) · [terms](https://buffer.com/api/commit/terms).

## Honest promises

This is a product hypothesis with a documented workflow gap, not validated demand or a claim of originality across the whole market. API documentation supports the broad approach; authenticated behavior is untested. OAuth setup, app hosting, model costs if later added, and contest submission need their own authorization. No guaranteed win, time saving, conflict prevention, or API success is claimed.

See [AGENTS.md](AGENTS.md) before continuing. Keep commits small and meaningful; publish each completed documentation milestone to the private remote. Preserve user edits and keep evidence separate from plans.
