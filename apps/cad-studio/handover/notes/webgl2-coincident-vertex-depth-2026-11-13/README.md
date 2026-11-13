# D1047 — keep the front vertex at an exact WebGL2 silhouette tie

2026-11-13 · SMALL · P0 rows 06, 20 and 21 · [#2452](https://github.com/barocss/barocss/issues/2452)

Prefer the nearer native segment when the WebGL2 edge candidates have the same screen distance within 0.0001 CSS px. Use the current camera depth. Keep the renderer's surface rejection in Shaded and keep ordinary nearest-edge selection outside the tie.

- **FAIL** On D1046, clicking the exact coincident lower-left corner in WebGL2 Shaded selected rear body 1 at [0, 95, 0] mm. The earlier 1 px inset control passed and did not exercise the exact boundary.
- **PASS** Actual desktop Studio WebGL2 and WebGPU at 1024 × 800 select front body 0 at [0, 0, 0] mm at the exact projected point in Shaded, X-ray and Wireframe. The four rear-edge picks from D1046 still select body 1, edge 3. The source documents remain exact.
- **PASS** Visual review, 11 focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Downstream feature apply on a rear edge, instance edges, other overlap layouts, production build, full suites and mobile.

D1046 and D1047 satisfy the reported #2452 desktop criteria. The accepted desktop total is 15/54 after the issue closeout. Initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
