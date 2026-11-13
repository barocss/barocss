# D1046 — pick visible rear edges in X-ray and Wireframe

2026-11-13 · SMALL · P0 rows 06, 20 and 21 · [#2452](https://github.com/barocss/barocss/issues/2452)

Match native edge hit testing to X-ray and Wireframe visibility. WebGL2 draws the native X-ray edges over the surfaces, as the through-line pick requires. Pick all keeps the front surface or shaded edge as the source of coincident corners. Faces and Shaded edge depth retain their existing behavior.

- **FAIL** In baseline WebGPU Studio, clicking the rear edge at [17, 80, 7] mm in Front Ortho returned no edge with Edges and picked the front face with Pick all, in both X-ray and Wireframe.
- **PASS** At 1024 × 800 in WebGPU and WebGL2, the four X-ray/Wireframe and Edges/Pick all combinations select the same rear body and edge, body index 1 and edge index 3. Shaded Edges still refuses the rear edge and Shaded Pick all selects the front face. Clicking 1 CSS px inside the two projected coincident lower-left corners selects the front vertex [0, 0, 0] in all three modes. Both documents remain exact.
- **PASS** Visual review, 11 focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Exact silhouette boundary tie on WebGL2, actual downstream feature apply from the rear edge, instance edges, other overlap layouts, production build, full suites and mobile.

The two desktop profiles satisfy the reported #2452 criteria. Desktop QA advances to 15/54, initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
