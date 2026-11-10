# Evaluation plan

All results are **not run**. Targets below are proposed acceptance criteria, not demonstrated metrics. Do not fabricate users, timings, success rates, testimonials, or performance claims.

## Product questions

1. Can a new user understand linking without a tutorial session?
2. Does repeated correction save enough work to justify setup?
3. Can the operator identify exactly which posts changed and which did not?
4. Does refusing a stale edit improve understanding, or merely frustrate the user?

Compare with the real baseline: opening each draft in Buffer and manually correcting the same phrases. Include initial linking time and repeat-correction time separately. A fair comparison uses identical copy, channels, changes and familiarity. Do not compare Patchwork's prepared campaign to an unprepared manual task and claim end-to-end savings.

## Proposed small usability study

When separately authorized to recruit, ask three to five creators to complete a synthetic campaign task. No outreach is authorized by this document. Record setup time, correction time, uncorrected/mistaken phrases, help requests, and whether they correctly explain the final batch state. Report participant count and raw observations; this sample cannot establish broad market demand.

A planning-time alternative is one honest self-test on seeded fixtures, explicitly labeled a self-test. Interview notes and personal data do not belong in the public demo.

## Deterministic acceptance matrix

| Case | Required observation |
| --- | --- |
| One venue across three drafts | Only selected venue spans change |
| Same phrase appears twice; one linked | Unlinked occurrence stays byte-for-byte unchanged |
| Multiple linked occurrences | All intended ranges change once; offsets remain correct |
| Overlapping ranges | Linking rejected with explanation |
| Date label changed | No implied correction of unlinked weekday/relative language |
| New value is longer/shorter | Surrounding copy and subsequent bindings remain correct |
| Emoji, combining marks, non-Latin text | No broken graphemes or shifted selection; uncertain case blocks |
| External edit observed by final preflight read | Old approval invalid; no stale whole-text replacement dispatched |
| Changed status, permissions or unsupported content observed by final preflight read | No write for that post; remaining batch stops |
| External change between final read and write | Reproduce and document the residual race; no guaranteed non-overwrite claim |
| Another organization/account ID injected | Server rejects before remote action |
| Thread/media/annotation detected | Unsupported with reason, not silently flattened |
| Empty or no-op fact change | No remote mutation |
| Duplicate click or page refresh | One local operation; no automatic repeated remote write |
| Two successful posts, third rejected | Partial result remains explicit; no rollback |
| Successful item updates its baseline | Remaining operation items still use their immutable approved manifest |
| Lost response after apply | Outcome unknown until reconciliation; no blind retry |
| Unknown request followed by old-text read | Remains blocked without provider evidence; fresh approval alone cannot authorize a supposedly safe retry |
| Read-back has third-party changed text | No green success; fresh review required |
| Local cancellation during request | Stops only unstarted operations, not claimed remote cancellation |
| Browser closes while applying | Durable operation resumes by read/reconcile |
| OAuth denial/state mismatch | No connected state or actions; useful recovery |
| Token expiry/revocation | Prompt reconnect; no credential leakage |
| Provider errors/limits | Preserve review state, show useful failure, no tight retry loop |

## Integration proof required

A real authorized OAuth connection; real eligible draft read; exact approved edit; mutation response classification; independent read-back; matching Buffer UI state. Repeat on a second supported channel before claiming multi-channel operation. Record UTC times and redacted artifacts. Any simulated response/error must be marked simulated, including in recordings.

## Quantitative gates before calling the build ready

- Zero unapproved differences in the deterministic supported-text fixture suite.
- Zero duplicate dispatches in local duplicate-click/reload tests, while explicitly disclosing no remote exactly-once guarantee.
- Every observed outcome assigned the correct per-post state in the failure matrix.
- All authorization/session boundary tests pass.
- Complete the honest end-to-end demo in at most 120 seconds.
- Keyboard completion, narrow viewport, 200% zoom, and readable error announcements verified manually.

These are release gates, not current achievements. Performance timing and accessibility conformance require actual measurements, not checklist completion alone.

## Evidence format

For each executed case: date, environment/version, authorization context without secrets, fixture, steps, expected result, observed result, pass/fail/blocked, and sanitized artifact reference. Keep failures visible. A sample-mode screenshot cannot be filed as real integration proof. No application tests run in the current documentation phase.
