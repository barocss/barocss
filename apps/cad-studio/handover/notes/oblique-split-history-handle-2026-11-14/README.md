# D1177 — Align the angled Split History handle to the native plane

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2465](https://github.com/barocss/barocss/issues/2465)

Creation and History use the same equation for the angled Split handle. The handle origin is the stock bounds centre projected to the saved plane. Its direction is the unit normal. The raw At change per millimetre is the magnitude of the saved normal. History takes its bounds from both current direct split sides. If that pair is unavailable, the numeric History fields remain available.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop History displayed the saved normal and At, but drew the handle at the placeholder X-axis plane, outside the actual angled plane. The parent numerical History edit passed. |
| PASS | In actual desktop Studio, a face pick started Split on a 40 × 20 × 10 mm box. At30 gave 4000/4000 mm³, with cap endpoints at (30,0) and (10,20) on both Z levels. At34 gave 4800/3200 mm³ and endpoints (34,0) and (14,20). Both caps kept four expected corners, their names and opposite outward normals. The independent strip-volumes matched within 1e−6 mm³, and cap planes and vertices within 1e−7 mm. Both outputs were strict-valid native solids. |
| PASS | History SVG handle origins matched the projected points (20,10,5) and (22,12,5) within 0.00002 CSS px in the qualifying run. Projected direction cosines exceeded 0.99999999. Undo, Redo and fresh Open retained the correct outputs. A tangent At60 was refused with the accepted document fixed. Scaling the normal to [2,2,0] and At to 68 preserved the plane, geometry, side keys and handle location. |
| PASS | A fresh cardinal desktop control edited X16 → X22, with caps at the specified planes and volumes changing from 3200/4800 to 4400/3600 mm³. 57 focused Model tests included bound At and omitted-handle behavior with one direct output. Sol High geometry review, both type checks, scoped lint, syntax, diff check and production build passed. |
| NOT_RUN | The older D788 driver stalled before its first checkpoint and was stopped. No current downstream Move/project replay is claimed from that attempt. Actual angled handle drag, general cap references, full suites and mobile were not run. |

Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [#2465](https://github.com/barocss/barocss/issues/2465) remains open pending the Hole preset keyboard check and any outstanding acceptance. D1178 exercises the existing preset list in desktop Studio. [Commands and hashes](qualification.json).
