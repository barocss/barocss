# D1127 — prefer the front native vertex at an orthographic overlap

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2458](https://github.com/barocss/barocss/issues/2458)

In an orthographic view, distinct native vertices from the same picked edge or face can project within a fraction of a pixel. The picker uses the unique front native candidate when all such candidates fall within 0.1 CSS px of its projection. Equal depth and projection-separated candidates retain the existing ambiguity rule.

| Result | Check |
| --- | --- |
| FAIL | The parent Top Ortho click at the nearly coincident lower projection selected (0, 0, 0) mm. |
| PASS | Desktop WebGPU measured a projection gap of 0.038718 CSS px. The same click selected (0, 0, 10) mm and used it as the native sketch origin. The ordered plane, 96 mm³ extrusion, independent native corners, Undo/Redo, Save and fresh Open passed. Root reviewed the selected coordinates. |
| PASS | Perspective still refused the hidden endpoint. The existing front and rear edge controls passed on WebGPU and WebGL2. The focused control checks camera depth independently of world Z and preserves the separated endpoint. |
| PASS | Studio 26/26 and Model 8/8 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. Sol High reviewed the depth and ownership boundary. |
| NOT_RUN | All possible surface and edge-source combinations, a separate Front plane creation fixture, and full suites. |

#2458 remains open. Desktop QA is 20/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
