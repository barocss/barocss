# D1042 — keep the Fixed mark clear of the Sketch rail

2026-11-13 · SMALL · P0 rows 09 and 21 · [#2453](https://github.com/barocss/barocss/issues/2453)

Use the Sketch rail's bounds as an obstacle in the existing constraint mark layout. Read its bounds when Sketch opens or when the rail or canvas resizes. A moved mark keeps its leader to the original geometry.

- **FAIL** At 900 × 760, a Fixed point at x≈112 was visible, but its mark started at x≈87 under the tool rail, whose right edge was x=100.
- **PASS** In desktop Studio the mark starts at x≈107, with a leader to the same Fixed point. A canvas click selects `point:0`. After panning the point under the rail to x≈98, a click leaves it unselected. The accepted document is unchanged.
- **PASS** Visual review, the adjacent Fixed marks and downstream Extrude control, the projected corner control, four focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Frame all with hidden bodies and an open Display panel, the gizmo obstruction, WebGL2, production build, full suites and mobile.

#2453 stays open. Desktop QA is 12/54, initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
