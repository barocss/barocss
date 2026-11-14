# D1229 — Explain the minimum straight span of a rounded inset source

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The source width editor checks the resulting straight spans against the same 0.01 mm limit as the native rounded inset planner. The specific refusal shows the corner radius and tells the user how to increase Source width. The existing closed-opening case still gives both width and inset-distance recovery actions.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio refused a 4 mm width with R2 and 1.5 mm inset but gave a generic first notice. The useful detail required expansion. |
| PASS | Chrome WebGPU at 1024 × 800 showed the distinct notices for 5 mm width with 2.5 mm inset and for 4 and 4.01 mm widths with 1.5 mm inset. Rejected edits kept the inputs and preserved the accepted document, History, selection and bodies. |
| PASS | Width 4.1 mm with inset 1.5 mm recovered without Reset. The outer radius stayed 2 mm and the inner radius was 0.5 mm. Strict closed B-rep, Undo, Redo, Studio Save to the browser project and fresh Open passed. |
| PASS | Native and Studio volume matched 300.80972450961724 mm³ within 1e-7 mm³. Independent area was `4.1×10 − (4−π)×2² − 1.1×7 + (4−π)×0.5²`, multiplied by the 10 mm extrusion. |
| PASS | 11 focused Model tests, including the next binary64 value above 4.01 mm on the origin fixture, plus Model and Studio type checks, scoped Model lint, driver syntax, production build and frozen-source checks. |
| FAIL | Whole-file App lint retains the inherited unused `_k` from D1228. |
| NOT_RUN | Other corner radii in Studio, assistive technology, full suites and CI. |

Keep #2481 open for remaining criteria. Desktop QA is **30/82 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
