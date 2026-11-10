---
work_id: D623
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D623 — Edit a rectangular profile width in a local worker run

P0 automation, B09 follow-up, rows 04 and 16. FULL interface qualification.

The local planner can use a stated local X extent to drive the width of a plain rectangular sketch on an independent placed part. It selects width when that extent requires a change and the hard Z checks require no height edit. A hard requirement for another fixed axis must already pass. The first profile uses a solid two-feature rectangle and extrusion. A sketch with construction geometry, a hole, an unsupported reference, or an authored width outside the hard tolerance is refused before dispatch.

The worker changes the maximum X coordinate of the existing sketch. The minimum corner, Y coordinates and extrusion node stay fixed. The proposal follows the existing scoped edit and terminal decision path. Studio reconstructs the scoped edit for candidate review and approved checkpoint Open. Existing height-only plans and checkpoint fields retain their previous form.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The saved source produces the same mixed plan through the CLI and actual Studio chat. The width task targets p1/n0 and the height task targets p2/n1. Studio launches both through its existing run card. |
| K02 | PASS | The width preview shows 20 → 24 mm and +200 mm³. Placed dimensions are 24 × 10 × 5 mm for p1 and 12 × 8 × 3 mm for p2. The first terminal-approved checkpoint shows the X check changing from Fail · 20 mm to Pass · 24 mm. |
| K03 | PASS | The rebuilt height candidate and the second terminal approval open through the same run card. The final placed dimensions are 24 × 10 × 5 mm and 12 × 8 × 4 mm. The independent reader confirms exact retained sibling data across each approval and final prism volumes of 1,200 and 384 mm³. |
| K04 | PASS | Desktop Studio opens the actual height-only checkpoint retained from D622. Its accepted document matches the native bytes from that artifact. |
| K05 | PASS | Focused checks cover wrong dimension, hidden submission fields, unsupported sketch metadata and holes, and two distinct precision refusals. The width calculation and native oracle both use the authored width. Isolated overlays verify the refusal and scope assertions. |

The fixture uses one width edit and one height edit. Approval remains explicit in the terminal. [Commands and hashes](qualification.json).

Whole suites, live providers, mobile and other width profiles are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten named initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open for broader acceptance.
