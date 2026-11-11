---
work_id: D645
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D645 — Reject one reviewed candidate in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification.

The local candidate preview offers **Reject candidate**. Approval and rejection share the same exact receipt, accepted model and control revision checks. The local writer records the explicit rejection on that attempt. Studio updates the run card and keeps the other candidate available.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio reviews p1 and p2. Reject is disabled while the accepted model is shown. A mismatched p2 receipt returns 409 without changing the run record or writer entries. |
| K02 | PASS | Studio rejects p2 at revision 9. The original model, native object set, budget and full p1 task record remain equal. The run is active, with p1 awaiting a decision and p2 cancelled. There are zero publications. |
| K03 | PASS | Repeated rejection returns the current state without a write, including after p1 is approved. Approval of rejected p2 and rejection of approved p1 both return 409. |
| K04 | PASS | Studio approves the same p1 candidate at revision 12. A fresh Studio session shows the persisted p2 rejection and opens the exact p1 checkpoint at 6 and 3 mm. An independent reader verifies both decision records, one publication and the unchanged p2 occurrence. |
| K05 | PASS | Desktop two-task delivery and terminal review regressions pass. Focused Studio tests, both type checks, changed TypeScript lint and the Studio build pass. |

The first lint run rejected two unused destructured fields. The final path projects only the public status fields.

[Commands and hashes](qualification.json). Concurrent opposite decisions from separate Studio sessions, live providers, whole CAD suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
