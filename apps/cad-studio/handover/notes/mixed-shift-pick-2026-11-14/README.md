# D1048 — preserve mixed Shift selections

2026-11-14 · SMALL · P0 rows 20 and 21 · [#2454](https://github.com/barocss/barocss/issues/2454)

Toggle the face or edge by type when the selection contains no explicit bodies. Keep the Bodies filter and explicit-body toggle policy. The Selection inspector reports the two counts together and continues to show the first face's details.

- **FAIL** On D1047, both click orders cleared a same-body selection and converted a different-body selection into two explicit bodies. Switching from Faces to Edges also converted the selection to bodies.
- **PASS** In desktop WebGPU Studio at 1024 × 800, both orders preserve face 0 of body 0 and edge 3 of the same or the second body. Clicking the second item again removes only that item. Faces then Edges keeps both types. Bodies mode still adds and removes whole bodies. The accepted document is unchanged. Visual review confirms separate face and edge marks and `SELECTION · 1 FACE, 1 EDGE`.
- **PASS** Studio type-check, 11 focused tests, driver syntax and diff checks.
- **NOT_RUN** Crossing/window and context actions, active feature apply, WebGL2, placed instances, full suites, production build and mobile.

Desktop QA remains 15/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. Continue #2454 with crossing/window and check the reported context-action target before closing it. [Commands and hashes](qualification.json).
