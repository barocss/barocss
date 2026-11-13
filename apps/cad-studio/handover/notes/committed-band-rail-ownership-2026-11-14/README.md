# D1146 — Qualify committed Band rail ownership before display changes

2026-11-14 · SMALL · P0 desktop QA, rows 08, 20 and 21 · [#2473](https://github.com/barocss/barocss/issues/2473)

The two-patch Band has four named circular native trims. Each trim has one incident face. The current sheet display omits these edges. Both source cylinders can be hidden while the Band remains present. An ordinary edge pick cannot return a Band trim under this display contract.

| Result | Check |
| --- | --- |
| FAIL | With both source bodies hidden in desktop Top Ortho, clicking the exact lower or upper rail position selected no edge. The frustum audit and equal-radius audit positively assert and reproduce this existing behavior. |
| PASS | Studio reproduced the four exact rail names and retained the accepted document through the clicks. An independent coaxial surface formula agrees with the native area within 1e-7 mm². Frustum radii 20 and 10 mm at height 30 mm produced 2980.376479738825 mm². Equal radii 10 mm produced 1884.955592153881 mm². |
| PASS | Model type check, driver syntax and diff check. |
| NOT_RUN | Band rail drawing, adaptive fill and named picking, full suites and mobile. |

Sol High traced consumers of the two-face canonical edge type. Machining and section paths assume two face indices. Sew and Thicken take whole Direct surfaces. D1147 will carry native trim identity in a viewport-owned display packet and qualify regular interaction before any generic edge-table change. Equal-radius coaxial rails occupy the same locus in exact Top Ortho. Use the unequal-radius control to verify independent picks, and keep one visible owner when the projections overlap.

The first two browser setups predated lazy reference signature capture. The audit now checks unchanged authored source names, allows the verified signature additions during Hide, and compares exact accepted documents through the picks. Keep [#2473](https://github.com/barocss/barocss/issues/2473) open. Desktop QA is **24/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
