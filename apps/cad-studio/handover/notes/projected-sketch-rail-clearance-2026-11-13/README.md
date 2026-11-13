# D1041 — frame the projected sketch clear of the tool rail

2026-11-13 · SMALL · P0 rows 09 and 21 · [#2453](https://github.com/barocss/barocss/issues/2453)

Frame each sketch plane after the Sketch layout commits. Read horizontal limits from the current canvas, tool rail and dock with the existing work-area reader. Keep normal Sketch pointer routing.

- **FAIL** At 1024 × 900, Project to sketch from Front put the world corner [0, 0, 0] at [98.00, 492.50] CSS px on the rail, whose right edge was at x=100. Select could not reach that corner.
- **PASS** In desktop Studio the same corner projects to [163.66, 514.58] CSS px and selects as `point:3`. The opposite corner is also on the canvas. Panning the same original corner back under the rail to x≈98 makes its click leave the sketch unselected. The accepted document is unchanged.
- **PASS** Existing Model Frame all/F, three-vertex Sketch and visible Section sketch-copy desktop controls. Visual review, 35 focused Studio tests, Studio type-check, driver syntax and diff checks pass.
- **NOT_RUN** The 900 × 760 Fixed mark and gizmo cases, Frame all with the open Display panel, WebGL2, production build, full suites and mobile.

#2453 remains open for the additional obstruction cases. Desktop QA is 12/54, initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
