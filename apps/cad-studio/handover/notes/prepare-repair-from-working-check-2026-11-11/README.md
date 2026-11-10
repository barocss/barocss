---
work_id: D628
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D628 — Prepare a repair from a failed working check

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Studio offers Prepare repair when a fresh working check fails the same stated dimension that passed in the selected approval. The existing single-occurrence planner must choose that exact requirement. Studio reads and verifies the saved native source before it presents the repair. The prepared card uses the existing local run controls and requires Start repair. A working dispatch retires the plan's start authority.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The changed criterion has no repair action. The unsaved model refuses preparation. Neither creates a run or sends a Start request. |
| K02 | PASS | Studio Save permits the 7 → 5 mm repair to be prepared. Preparation makes no Start request. A working edit and its Undo leave the old card disabled until a fresh check and preparation. |
| K03 | PASS | One explicit Start launches the selected p3 candidate. Terminal approval and Studio Open produce a working Pass at 5 mm. |
| K04 | PASS | The independent reader verifies the exact saved source, p3/n1 scope and unchanged p1 and p2. The existing single-task chat and two-task paths also pass. The three-task path provides the prior approval in the new desktop flow. |
| K05 | PASS | Focused Model and Studio tests, type checks, lint and the Studio build pass. |

[Commands and hashes](qualification.json). Whole suites, mobile, live providers, and repair from a nested or changed criterion are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
