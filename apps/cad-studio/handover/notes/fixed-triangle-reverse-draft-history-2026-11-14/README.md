# D1081 — replay fixed-triangle length changes in one Sketch draft

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Allow another guarded recovery on the exact polygon produced by a prior recovery in the same reopened edit session. Both dimension controls use that session's provenance. The Model solve and all numerical checks remain the D858 checks.

- **FAIL** Parent Studio accepts 124.05 mm, then refuses 131.95 mm in the same draft and retains the 124.05 mm outline.
- **PASS** Desktop WebGPU replays 131.95 → 124.05 → 131.95 mm through the canvas editor. Undo restores 124.05 mm. A refused 132.05 mm edit preserves the outline and pending Redo. Redo restores 131.95 mm. The Sketch panel then returns to 124.05 mm. The draft stays fully defined at rank 6 and 0 DOF.
- **PASS** Finish preserves both fixed points, the 128 mm side, native face names, strict B-rep validity and the 6 mm Extrude at 238.3371991233 mm³. Exact document Undo and Redo pass. The D1080 panel and D858 canvas regressions pass, including native Save/Open and the ordinary 37° control.
- **PASS** Sol High reviewed the ownership and numerical boundaries. Studio type-check, nine focused tests, scoped lint, driver syntax, diff checks and visual review pass. The focused negative controls exclude a clone, another edit session and a draft with companion geometry.
- **NOT_RUN** Feature-editor length recovery, other triangle families, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
