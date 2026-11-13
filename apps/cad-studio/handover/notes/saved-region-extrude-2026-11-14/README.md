# D1132 — Evaluate and edit a saved individual-region Extrude

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

A schema 3 region extrusion binds a source feature ID, exact local plane and four undirected tagged boundary edges. The first supported source has separate axis-aligned rectangles in the sketch plane, no holes and no face attachment. Shared boundary contact is allowed. The selected rectangle must have no positive-area intersection with another rectangle. Studio locks source sketch editing while this feature refers to it. The native conversion still uses the existing sketch and Extrude operations. A distinct saved kind lets older top-level file readers refuse an unrecognized feature.

| Result | Check |
| --- | --- |
| PASS | Studio opened the right rectangle of a three-region sketch that shares part of one side with its left neighbor. A separate equally sized rectangle served as a control. The native 10 × 12 × 2 mm body had volume 240 mm³, centroid (19, 12, 1) mm, and the selected original side name. |
| PASS | Distance edit 2 → 3 mm, exact Undo/Redo, native project Save and fresh Open retained the source reference. The reopened native body had volume 360 mm³ and centroid (19, 12, 1.5) mm. |
| PASS | A changed boundary was refused before adoption. A matching but zero-normal plane was also refused by the native Open check. The original accepted document remained exact on both paths. |
| PASS | Model checks cover loop reorder and reversal, duplicate and flatten rekeying, suppression, parameter distance, exact plane and stale ID refusal, holes and overlap refusal, and the legacy full-sketch 680 mm³ control. Studio 15/15 and Model 42/42 focused, both type checks, build, scoped lint, driver syntax and diff passed. Sol High reviewed the native and admission boundaries. |
| FAIL | Early focused attempts exposed an import cycle and two test oracle/fixture errors. A later preflight refinement needed a TypeScript type narrowing correction. The final execution passed. |
| NOT_RUN | Region picking and creation preview in Studio, imported arbitrary outlines, holes, attached-face operations, nested assembly Studio Open, older nested readers, full suites and mobile. |

#2459 remains open. Desktop QA is **21/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
