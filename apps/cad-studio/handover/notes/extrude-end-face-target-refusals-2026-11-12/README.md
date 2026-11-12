# D850 — Qualify unsupported native end faces and target deletion

P1, rows 07, 08 and 16. SMALL evidence-only item. The desktop fixture has a literal 10 × 10 mm source, a plain rectangular target, a larger native holed cap and a separate cylinder. The radius-3 mm hole crosses the source edge at X10, Y5 ± √8. All four corners remain inside the outer trim and outside the hole. Sol High reviewed the physical witness, native face names and dependency ownership.

| Result | Check |
| --- | --- |
| PASS | The native inspector confirms `n3.bottom` has one outer and one inner trim. Its bore has radius 3 mm and centre XY (9, 5) mm. The holed solid volume agrees with 4500 − 45π mm³. |
| PASS | A real Bottom pick selects the holed planar cap and the native preview refuses it. A real Front pick selects a nonparallel original side and the native preview refuses it. The original curved cylinder side is refused at pick admission. The accepted document, bodies, selection, dirty state and history stay exact. |
| PASS | A subsequent valid pick of `n1.bottom` creates the 20 mm, 2000 mm³ extrusion. History lists the dependent extrusion before deleting its target. Cancel retains both. Explicit Delete 2 removes both and preserves the other two outputs. First Undo restores the exact relation. First Redo restores the exact deletion. |
| PASS | Model checks reject nonfinite sketch coordinates and a changed target feature ID, refuse deleting the target alone and qualify the explicit cascade. Earlier D840 cases cover wrong or missing exact face names, composite names, duplicate feature IDs and consumed or suppressed targets. |
| PASS | Model 56/56, Studio 50/50, final Model types, scoped lint, driver syntax, diff check and root visual review pass. |
| FAIL | The first desktop driver waited for text inside the collapsed Details element to be visible. The corrected run expands the actual element and checks the public reason. |
| NOT_RUN | General continuity when another face inherits the same exact native name, additional frames, third-party CAD STEP geometry import, full suites, fresh Studio types and production build, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D851 looks for the pinned B01 and B02 acceptance inputs and reruns the eligible current Studio profiles. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
