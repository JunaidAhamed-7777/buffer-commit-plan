# Sources and open questions

Checked 10 November 2026. Links below are primary sources except the user's existing private tracker, which supplies project status context. Web documentation can change; verify again before implementation and submission.

## Evidence register

| Source | What it supports | What it does not prove |
| --- | --- | --- |
| [Buffer Commit](https://buffer.com/api/commit) | Event, dates, public app expectations, awards | User's completed build or winning chance |
| [Commit terms](https://buffer.com/api/commit/terms) | Eligibility, judging, AI permission, entry/legal obligations | Personal eligibility completion or accepted terms in this session |
| [API overview](https://buffer.com/api) | Current developer platform and access | This account's configured client or channel access |
| [Authentication](https://developers.buffer.com/guides/authentication.html) | OAuth PKCE/state/scopes/token behavior | Successful authorization for this project |
| [API reference](https://developers.buffer.com/reference) | Queries/mutations and schema | Live behavior for every channel |
| [EditPostInput](https://developers.buffer.com/types/EditPostInput.html) | Minimal edits and omission semantics | Atomicity or remote version locking |
| [Posts guide](https://developers.buffer.com/guides/posts-and-scheduling.html) | Post lifecycle, pagination, current metrics caveat | Future metrics availability through OAuth |
| [Content Items](https://developers.buffer.com/guides/content-items.html) | Native per-channel grouping and overlap | Our proposed fact-repair workflow already exists or is globally unique |
| [Scheduling FAQ](https://support.buffer.com/articles/scheduling-posts-4Qdld7giAZ) | Individual-edit friction and published-post limits | Market demand for another app |
| [Buffer AI](https://buffer.com/ai-assistant) | Native rewriting/repurposing competition | Comparative writing quality |
| [Buffer MCP](https://developers.buffer.com/guides/integrations/mcp.html) | Native agent integration competition | A reason to add a model to Patchwork |
| [SocialBee bulk editor](https://help.socialbee.com/hc/en-us/articles/29979045233303-How-Do-I-Edit-Posts-in-Bulk-Several-at-Once) | Adjacent bulk content controls | Exhaustive competitor feature audit |
| [Publer bulk workflow](https://publer.com/help/en/article/16hbbj4/) | Adjacent scheduling/customization | Lack of any competing fact-linking feature |

The official event's linked developer handbook was unavailable during this check. No handbook-only claim is used. Registration status comes from the existing private tracker; no private receipt details or unrelated personal information are copied into this repository.

## Questions to answer by evidence, not guesswork

| Priority | Question | Cheapest honest next evidence |
| --- | --- | --- |
| P0 | Can the authorized client edit and verify a real draft through OAuth? | Small approved end-to-end spike |
| P0 | Which two text-capable channels can be tested? | Authenticated channel read after access approval |
| P0 | Can all unsupported content be classified before edit? | Actual schema/payload inspection and adversarial fixtures |
| P0 | Does this scope remain useful despite the remote race? | Explain limitation during self-test/user review; no guarantee claims |
| P1 | Is manual linking worth its setup cost? | Fair baseline with separate setup and repeat-change timing |
| P1 | What happens after an uncertain mutation/read-back delay? | Controlled failure injection, labeled simulated where necessary |
| P1 | Is the current name appropriate? | Basic naming review before public branding; not trademark clearance |
| P1 | What is the exact hosting/retention choice? | Approved provider/budget and implementation review |
| P2 | Would assisted linking help? | Observe linking friction first; evaluate later under explicit data permissions |
| P2 | Can queued posts ever be added responsibly? | New scope decision and real provider capabilities, not deadline pressure |

## Questions not worth interrupting planning for

A final logo, domain, slogan variants, optional AI provider, pricing tiers, agency roles, outreach plan, or public launch copy. These do not decide whether the core correction loop is useful and feasible. Keep them deferred.
