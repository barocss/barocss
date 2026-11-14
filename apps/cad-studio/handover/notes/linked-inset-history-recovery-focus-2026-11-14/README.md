# D1236 — Show Linked Inset recovery at keyboard focus

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The linked error scrolls the existing notice and recovery buttons into view. When Apply owns focus, focus goes to Reset. Enter from the numeric field preserves the field focus so it can be retried directly. A reply respects focus the user moved elsewhere.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio lost Apply focus or hid the recovery message. The first correction exposed the message but clipped the bottom of Reset. The final correction gives the controls a scroll margin. |
| PASS | Chrome WebGPU at 1024 × 800 tested two Linked Insets after Hole → Move. Apply Enter at 9.25 mm identified n8, n3.side1 and 4.75 mm, then focused visible Reset. Reset Enter restored 10 mm. Distance Enter at 9 mm identified n4, n3.side0 and 4.5 mm and preserved input focus. Both notices and Reset were visible before scrolling in the test. |
| PASS | Both refusals preserved the document, bodies, History and selection. Entering 12 mm directly recovered rings of 1548 and 1007 mm³. Independent outer-minus-opening calculations and strict native B-rep passed within 1e-7. Undo, Redo, Studio Save and fresh Open passed. |
| PASS | Direct-source control, 20 focused Studio tests, type check, scoped lint, driver syntax, build and frozen-source checks. |
| NOT_RUN | Assistive technology, changing focus while a delayed refusal is outstanding, full suites and CI. |

Keep #2481 open for the source width boundary and remaining cases. Desktop QA is **33/91 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
