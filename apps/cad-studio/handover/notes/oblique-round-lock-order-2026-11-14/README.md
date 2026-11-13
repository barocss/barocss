# D1106 — verify both Round lock orders on an oblique sketch plane

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Run the D1083 clockwise lock-order scenario on a plane with origin [3, 4.5, 6] mm, normal [0, 0.6, 0.8] and local X [1, 0, 0]. Compare each solved state to independent local arc construction and transformed native cap vertices and cylinder axes.

- **PASS** Desktop Studio refuses the same R10 in both lock orders with the accepted document and draft inputs intact. R5/R20 succeeds in both orders, keeping the exact authored constraint rows, plane, side IDs, and Extrude. The largest vertex gap between solved documents is 2.303e-11 mm. The largest bulge gap is 3.646e-13. Both solids agree with the independent geometry and volume at the existing 1e-8 mm point and 1e-7 mm³ volume tolerances. Undo, Redo, local-project Save, fresh Open, driver syntax and diff checks pass.
- **FAIL** The first observer required exact equality of solved coordinates between lock orders. It found a numerical difference within tolerance. The final observer requires exact authored data and compares solved coordinates and bulges at the existing tolerance.
- **NOT_RUN** Additional oblique planes, same-session repair of historical collapsed arc files, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
