# Idea tournament

Decision date: 10 November 2026. These are internal product judgments, not measured customer demand, contest scores, or winning odds.

## Selection criteria

The official judging dimensions are usefulness, craft, and originality. Add feasibility as a veto: if a project depends on unverified privileged endpoints, weeks of model tuning, paid data, or a broad publishing engine, it is not a good fit for the remaining window.

| Candidate | User value | Finishable craft | Distinctiveness | Decision |
| --- | --- | --- | --- | --- |
| Patchwork: linked-fact repairs across drafts | High: concrete recurring correction work | High if draft/text-only | High hypothesis: facts as persistent links plus exact patches | Select |
| Preflight: scan for broken links, stale dates, accessibility gaps | High | Medium: false positives and external-link fetching | Medium; many generic checkers | Reserve only |
| Cross-channel preview and approval desk | Medium | High | Low; native composer/collaboration overlap | Reject |
| Second Wind: reuse top-performing content | Medium | Low for OAuth analytics dependencies | Low; AI repurposing is already native | Reject |
| Run of Show: shift a campaign when event time moves | High for events | Low: timezones, scheduling races, publishing risk | Medium-high | Defer |
| Generic chat/MCP social assistant | Medium | Medium | Low; Buffer has native MCP | Reject |

## Why Patchwork survives

**Specific user:** a solo workshop creator with independently written drafts across two channels. A venue or registration URL changes after those drafts were prepared. The job is to repair every selected occurrence, while keeping the distinct writing intact.

**Documented friction:** Buffer's scheduling FAQ says posts shared to multiple channels must be edited individually after creation. That supports a workflow gap. It does not prove users will adopt another app, pay, or tolerate fact-linking setup. [FAQ](https://support.buffer.com/articles/scheduling-posts-4Qdld7giAZ).

**Demo clarity:** one fact changes, several small diffs appear, one stale draft is withheld, and real Buffer read-backs prove the two accepted edits. The viewer can understand both the benefit and the restraint without a technical lecture.

**Engineering center:** reliable text-span relationships, conservative conflict handling, OAuth, and per-post reconciliation. This is enough substance without inventing an unnecessary autonomous agent.

## Position against what already exists

- Buffer AI already helps generate, adjust, and repurpose writing. Do not compete on caption quality. [AI Assistant](https://buffer.com/ai-assistant).
- Buffer MCP already lets AI tools interact with the queue. Do not claim conversational scheduling is novel. [MCP guide](https://developers.buffer.com/guides/integrations/mcp.html).
- Buffer Content Items group per-channel variants. Their experimental grouping is adjacent infrastructure, not our innovation. Patchwork stores relationships locally and does not depend on that preview surface. [Content Items](https://developers.buffer.com/guides/content-items.html).
- SocialBee's documented bulk editor includes profile/category/status actions. Publer's bulk workflow handles scheduling and customization. These establish adjacent competition, not absence of fact-level repair elsewhere. [SocialBee](https://help.socialbee.com/hc/en-us/articles/29979045233303-How-Do-I-Edit-Posts-in-Bulk-Several-at-Once) · [Publer](https://publer.com/help/en/article/16hbbj4/).

**Honest positioning:** a focused proposed workflow for linked facts and reviewed repair. Never say first, only, revolutionary, or impossible in competitors without evidence.

## The uncomfortable objection

“Why not just edit three drafts in Buffer?” is the right challenge. Linking takes time. The product earns its place only when initial setup is clear and repeated corrections become easier to inspect. Test against an actual manual-edit baseline, including setup time. If a new campaign has only two posts and one tiny change, Buffer itself may be faster. Say so.

## Product ambition without scope inflation

The long-term opportunity is reusable factual structure underneath expressive writing. The contest version proves one narrow correction loop. Future semantic detection, relative dates, published corrections, commerce inventory, and agency approvals are separate hypotheses, not a roadmap promise or MVP backlog.
