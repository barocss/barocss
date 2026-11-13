# D1101 — check the emitted arc radius before accepting Offset

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Check the arc reconstructed from the final rounded endpoints and emitted bulge before committing Offset. The check reads the existing Extrude minimum radius and uses the same strict less-than comparison as native admission. The early signed-radius test and all kernel tolerances keep their existing behavior.

- **FAIL** Parent desktop Studio accepts In 1.99 mm and adds a draft Undo entry. The numerical audit computes an analytic radius of 0.010000000000000009 mm and an emitted radius of 0.00999999999999801 mm for one corner.
- **PASS** Desktop WebGPU refuses 1.99 and 1.990001 mm before changing the outline, document, dirty state or history. In 1.989999 mm is accepted and has four inner R0.010001 mm cylinders. Draft and document Undo and Redo pass. Project Save and fresh Open preserve the exact document and native result.
- **PASS** Strict native B-rep volume 1001.2601239225877 mm³ matches the independent rounded-area calculation within 1e-7 mm³. Model 83/83, Studio 32/32, both type checks, scoped lint, driver syntax, diff, visual and independent numerical source review pass.
- **NOT_RUN** Other outline families and oblique planes, actual exactly-representable 0.01 mm arcs in other fixtures, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
