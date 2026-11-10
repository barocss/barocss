---
work_id: D625
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D625 — Inspect approval history in the Studio run card

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

The local run card lists published tasks in approval order. Inspecting one task verifies its two original native states and displays the requirement results for their evidence revisions. The local service checks run ownership, task ID, operation ID and accepted file hash before reading a historical pair. Studio checks the same approval identity and native files before evaluating them. The existing latest-checkpoint Open remains a separate action.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio inspects all three approvals after the final publication. The tables show 20 → 24 mm, 3 → 4 mm and 3 → 5 mm, each with its own before and after evidence revisions. |
| K02 | PASS | The independent reader matches all three pairs byte-for-byte to the files delivered at the original publications. It confirms the measured values and the exact revisions shown in Studio. |
| K03 | PASS | Six invalid HTTP requests fail. A delayed p1 response is canceled after p2 is selected. Studio keeps the p2 results. |
| K04 | PASS | The working parameter edit, its Undo/Redo, the original saved project and the durable run stay intact during history inspection. The three latest-checkpoint Opens and the earlier two-task and height-only paths pass. |
| K05 | PASS | Focused Model and Studio tests, type checks, lint and the Studio build pass. |

The first desktop run found that Refresh dropped the approval list before rendering. The corrected Studio flow passes. [Commands and hashes](qualification.json).

Whole suites, mobile, live providers and working-model freshness comparison are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
