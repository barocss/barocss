# D1044 — verify Move gizmo input at the tool rail

2026-11-13 · SMALL · P0 rows 20 and 21 · [#2453](https://github.com/barocss/barocss/issues/2453)

Qualify the existing pointer boundary with a real Move command. The rail already consumes pointer input in the tested geometry. No product change is required for that boundary.

- **PASS** At 900 × 760 in desktop Studio, pan the Move X arrow under the tool rail to [170, 90] CSS px. Drag 42 px to the right across the rail boundary. ΔX remains 0 mm, and the accepted document, body results and history stay the same.
- **PASS** Pan the same arrow back to the canvas at approximately [476, 348.4] CSS px. Drag 42 px to the right, then Apply. The command adds one Move with offset [4, 0, 0] mm to the original body. Undo and Redo restore the exact documents. Visual review, driver syntax and diff checks pass.
- **FAIL** No product failure reproduced in this run.
- **NOT_RUN** WebGL2 for this gizmo, other transform axes and commands, production build, full suites and mobile. No new unit run for this browser-driver-only change.

D1041–D1044 qualify the reported #2453 desktop criteria. Desktop QA advances to 13/54. Initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
