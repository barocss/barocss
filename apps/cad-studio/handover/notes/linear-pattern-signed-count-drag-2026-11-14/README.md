# D1194 — Align the Linear Pattern Count arrow to signed spacing

2026-11-14 · FEATURE · P0 desktop QA, rows 09, 20 and 21 · [#2468](https://github.com/barocss/barocss/issues/2468)

In Separate bodies mode, the Count arrow starts at the outer face of the last copy and points along the signed spacing. Moving it by one interval changes Count by one. At zero spacing, the Spacing arrow remains available and the Count arrow is hidden.

| Result | Check |
| --- | --- |
| FAIL | On the parent, an inward drag of 16 mm with Spacing −16 mm raised Count from 3 to 19. |
| PASS | In desktop Studio, the same held drag moved Count 3 → 2 → 4 with Spacing fixed at −16 mm. The accepted document stayed unchanged before Apply. The Count 4 screenshot shows three preview copies and the arrow pointing along negative X. |
| PASS | Apply produced four strict-valid solids, each 192 mm³, with centres at X4, X20, X36 and X52 mm, Y13 and Z4 mm. Undo restored the seed and Redo restored all four solids. |
| PASS | The D1193 signed Spacing drag still traversed −24 → 0 → +8 → −20 mm. Model handles 14/14, both type checks, scoped lint, driver syntax, production build and frozen-source checks passed. |
| NOT_RUN | Actual Count drag on Y/Z, fractional spacing in Studio, fresh file Open, full suites, CI and mobile. |

Keep #2468 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
