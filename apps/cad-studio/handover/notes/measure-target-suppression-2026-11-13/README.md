# D1035 — retain ordinary Measure targets through body suppression

2026-11-13 · SMALL · P0 rows 11 and 20 · [#2450](https://github.com/barocss/barocss/issues/2450)

Each ordinary measurement target keeps its body key and geometric reference. The current body and face or edge are resolved before reading or highlighting them. If a target cannot be resolved, retain its slot and ask the user to pick a replacement. A vertex whose original mesh was replaced waits for a fresh pick.

- **FAIL** In baseline desktop Studio, suppressing the selected middle body `b3` changed the active measurement from 10 mm to 28.28 mm by binding To to `b5`. Redo repeated the incorrect substitution.
- **PASS** Desktop Studio keeps From on `b1` and identifies unavailable To on `b3`. Distance and overlay disappear on Suppress and Redo. Undo restores the original 10 mm shortest and 8 mm normal distances. Explicitly selecting the third bottom face gives 28.28 mm shortest and 20 mm normal distances. These values match the rectangular fixture offsets [6, 0, 8] and [20, 0, 20] mm.
- **PASS** Desktop regressions verify preselected vertex and pinned opposite caps. Visual inspection, 12 Model tests, 5 Studio tests, Studio type-check, driver syntax and diff check pass.
- **NOT_RUN** Placed-face measuring, curved distance provenance, edge or vertex suppression in desktop Studio, WebGL2, production build, full suites and mobile.

#2450 remains open. Desktop QA is 11/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
