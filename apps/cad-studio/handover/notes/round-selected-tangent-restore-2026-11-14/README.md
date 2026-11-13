# D1090 — restore a Round tangent from adjacent line and arc selections

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Select a straight outline edge and a circular arc that share a joint. Tangent adds the existing point-index constraint through the existing solve. Both edge orders use the same joint. The existing line-and-circle command remains available.

- **FAIL** On parent desktop Studio, the Tangent command is disabled after removing the tangent and selecting the line and adjacent R4 arc.
- **PASS** Desktop WebGPU opens the saved R4 Round, removes the tangent at point 2 and restores it through the selected pair. Draft Undo removes the restored constraint and Redo restores it. Finish retains the exact constraint IDs, five side tags, two named cylindrical faces and the 10 mm Extrude. Project Save and fresh Open retain the constraint and geometry. The strict native volume agrees with independent arc integration within 1e-7 mm³.
- **PASS** Sol High audited the existing solver, both orientations, wrapped joint, duplicate and incompatible constraints. Model 66/66, Studio 30/30, two type checks, scoped lint, driver syntax, diff and visual review pass.
- **NOT_RUN** Arc-to-arc selection authoring, other desktop working planes, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
