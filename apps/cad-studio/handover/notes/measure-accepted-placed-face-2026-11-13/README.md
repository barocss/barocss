# D1036 — measure accepted placed faces in world coordinates

2026-11-13 · FEATURE · P0 rows 11 and 20 · [#2450](https://github.com/barocss/barocss/issues/2450)

Ordinary Measure accepts a face from a static placed occurrence whose evaluation belongs to the current model. The inspector and highlight use the occurrence and its accepted world-space mesh. The selection retains occurrence provenance. Exploded, posed, previewed and sectioned placements wait for an accepted static view.

- **FAIL** In baseline Studio, picking the placed bottom face left To empty and showed no distance.
- **PASS** For the 40 × 30 × 10 mm base and 30 × 12 × 6 mm occurrence at [60, 0, 15], desktop Studio shows Witness plate, 20.62 mm shortest, 5 mm normal and Δ=[20, 0, 5] mm. Reversing the order changes the sign of the displacement only. Explode clears the distance and line. Returning to the accepted placement restores the measurement. The authored document stays unchanged.
- **PASS** Independent review confirms native rectangle boundaries and a shortest distance of √425 = 20.6155281280883 mm using the existing mesh path. Studio visual inspection, 12 Model tests, 8 Studio tests, Studio type-check, driver syntax and diff check pass.
- **NOT_RUN** Placed context-menu Measure, placed edge or vertex, a rotated or nested occurrence in Studio, replacement of a freed occurrence ID in Studio, live pose/preview browser controls, curved distance provenance, WebGL2, production build, full suites and mobile.

#2450 remains open. Desktop QA is 11/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
