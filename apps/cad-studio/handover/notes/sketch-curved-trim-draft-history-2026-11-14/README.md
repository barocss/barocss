# D1071 — keep Trim history across Select for a curved profile

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Allow the same ID and geometry checks to match settled line-and-arc outlines across Trim and Select. A changed bulge still blocks replay.

- **FAIL** The parent Studio trims a construction line beside a reopened arc profile. After changing to Select, Cmd+Z leaves the line absent.
- **PASS** Desktop WebGPU restores the line with Undo and removes it with Redo in Select. Both controls replay the same states. The arc stays active, with the original radius field. Finish restores the exact native document and 1,285.619449 mm³.
- **PASS** Visual review, Studio type-check, 13 focused tests, driver syntax and diff checks. The focused refusal case includes a replacement with changed arc coefficients.
- The first driver treated the horizontal SVG polyline as a visible bounding box. The baseline retry waits for attachment and reproduces the defect.
- **NOT_RUN** Newly drawn profiles, Trim of a material arc, splines, other draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
