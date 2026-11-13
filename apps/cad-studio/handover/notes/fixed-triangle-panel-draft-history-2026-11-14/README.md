# D1080 — recover the verified fixed-triangle length in the Sketch panel

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Reuse the source-owned D858 recovery for the existing third-edge driving length in the Sketch panel. Re-entering a locked value does not create a duplicate draft step. Preserve the ordinary panel path for other shapes and lengths.

- **FAIL** The parent Studio refuses the feasible panel edit 131.95 → 124.05 mm. The first candidate accepts the edit but a repeated Enter on the same value adds a draft step. The final change removes that step.
- **PASS** Desktop WebGPU accepts 124.05 mm and refuses 132.05 mm. Undo returns directly to 131.95 mm, and Redo restores 124.05 mm. The accepted document stays exact during editing. Finish preserves the two fixed vertices, 128 mm driving side, 6 mm Extrude, and exact native topology names. The independent nominal volume is 238.3371991233 mm³. Strict native validity, document Undo/Redo and actual project Save and fresh Open pass.
- **PASS** The existing inline recovery and ordinary 37° control pass in Studio. A first reopened panel driver held a locator from the closed page. The final run reads the newly opened page. Visual review, Studio type-check, eight focused tests, scoped lint, driver syntax and diff checks pass.
- **NOT_RUN** Same-draft reverse recovery, Extrude feature-editor numeric recovery, other triangle families, full suites and production build.

The [#2455 closeout](https://github.com/barocss/barocss/issues/2455#issuecomment-6859384243) is complete. [The desktop tracker](https://github.com/barocss/barocss/issues/2492#issuecomment-6859391705) records 19/54.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
