# D1037 — label mesh approximation in curved Measure results

2026-11-13 · SMALL · P0 rows 11 and 20 · [#2450](https://github.com/barocss/barocss/issues/2450)

Ordinary Measure labels shortest distance as a mesh approximation for curved non-faceted faces, sampled curved edges, and planar faces with a curved trim present in the display edge table. The viewport prefixes the same distance with ≈. The axes row identifies its mesh fit. The algorithms and native radius values are unchanged.

- **FAIL** Baseline Studio showed 5.38 mm for the two cylindrical walls with no approximation label.
- **PASS** Desktop Studio shows 5.38 mm (mesh approximation) and ≈5.38 mm, with R5, R3 and coaxial (mesh fit). Independent native geometry gives √29 = 5.385164807134504 mm. A separate quality-8 mesh check gives 5.381595540432823 mm. The same native model gives different mesh results at qualities 4 and 16.
- **PASS** The separate placed planar rectangle control still shows 20.62 mm without the curved approximation marker. Visual review, 12 Model tests, 5 Studio tests, Studio type-check, driver syntax and diff check pass.
- **NOT_RUN** Curved tangent trims absent from the display edge table, native shortest-distance replacement, WebGL2, production build, full suites and mobile.

#2450 remains open. Desktop QA is 11/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
