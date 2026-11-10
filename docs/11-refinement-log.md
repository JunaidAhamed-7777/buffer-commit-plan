# Refinement and decision log

Date: 10 November 2026. Record real changes in reasoning. These entries describe planning revisions, not product implementation or user testing.

## Pass 1 · Start from the event, not a generic AI demo

Read the existing tracker before choosing work. Confirmed the Buffer contest and registration context, checked official rules, and inspected the user's repository list. No Buffer project was found in that search. Reviewed Homingo's independent planning README to avoid merging projects or importing its future kickoff restrictions.

Decision: a new private documentation repository, no code, no registration repeat. Buffer's build window is already open; documentation-only is the user's requested phase.

## Pass 2 · Tournament, then choose a specific user job

Compared fact repair, preflight checking, preview/approval, content repurposing, event-relative schedules and generic MCP assistance. Rejected the crowded caption-generation/scheduling directions. Chose correction after drafts already exist.

Decision: Patchwork for a solo workshop creator. The phrase “Change the fact. Keep the voice.” explains the user benefit better than a platform or agent label.

## Pass 3 · Check native overlap

Found Buffer already groups channel variants and offers AI repurposing and MCP. Its help FAQ also records individual-edit friction for multi-channel posts.

Decision: grouping and generation are not the differentiator. Focus on persistent fact-to-text relationships, explicit small diffs, and reviewed write-through. Do not claim market uniqueness or validated demand.

## Pass 4 · Remove assumptions the API cannot honor

Confirmed editPost and minimal text-edit semantics in primary docs. No conditional-version input or atomic multi-edit was found.

Decision: no transactional, conflict-proof, exactly-once or universal rollback claims. Sequential results, fresh reads, uncertainty reconciliation, and explicit partial completion. The residual race is documented rather than hidden.

## Pass 5 · Shrink the dangerous surface

Initial thought included queued/scheduled campaign repairs and automatic preservation through arbitrary edits. Those increase publishing/concurrency and merge risk.

Decision: only selected plain-text drafts. Any external text change invalidates approval, even if unrelated. The user refreshes, relinks and re-reviews. Exclude scheduling, media, threads, annotations and published content. No runtime model is needed.

## Pass 6 · Make the restraint visible

A heroic “all fixed” demo would hide the product's most important behavior. The strongest demo changes two current drafts while holding a third changed elsewhere.

Decision: editorial diff view, prominent held item, per-post receipts, honest two-minute narrative. Sample mode is labeled and cannot stand in for live proof.

## Pass 7 · Challenge setup cost

Linking is extra work. A tiny one-off change may be faster directly in Buffer.

Decision: test first-time setup and repeated corrections separately against a fair manual baseline. Do not invent time savings. Keep onboarding to selection and phrase linking, rather than adding AI extraction to hide the problem.

## Pass 8 · Delivery and safety audit

Added authorization gates, OAuth-first spike, explicit privacy model, failure matrix, cut ladder and submission evidence requirements. Planned hosting through the results date as a cautious buffer, not a quoted organizer obligation.

Decision: stop this documentation pass when links, consistency and remote contents are checked. The next meaningful work is either a targeted review of new evidence or separately authorized implementation. Do not keep adding speculative features merely to make more commits.

## Current design decisions

| Decision | Rationale | Reopen only if |
| --- | --- | --- |
| Draft-only writes | Reduces consequences and keeps proof bounded | A tested provider capability and explicit scope justify expansion |
| Manual linking | Deterministic and explainable | Real usability evidence supports a controlled assisted mode |
| Stale text blocks | Avoids unsafe rushed merge engine | Fresh-review anchor suggestions are correctly tested |
| No runtime AI | The core job does not need it | A measured user need warrants cost/data/complexity |
| No offline scope | Interactive MVP does not need background access | A necessary workflow and permission justify it |
| Private repo | Planning stage; no public source requirement found | User explicitly requests publication |

## Remaining highest-risk hypotheses

Real OAuth draft editing across two channels; setup burden versus manual edits; supported-content classification; read-after-write behavior; residual concurrency risk. These require implementation authorization and evidence, not more confident prose.
