# D1043 — frame the visible model with Display open

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2453](https://github.com/barocss/barocss/issues/2453)

Use visible scene bounds for Model camera fit and view directions. Exclude hidden root and placed bodies in both renderers. Include the open Display panel in the camera's work-area limits. Keep render-internal bounds and Print/CNC/Render framing paths separate.

- **FAIL** At 900 × 760, hiding the second root body and a distant placed part still left the remaining 40 mm body only 31.41 CSS px wide after Frame all with Display open.
- **PASS** Desktop Studio WebGPU and WebGL2 show the remaining body at 424.00 CSS px wide, with all eight tested corners on the canvas and about 131 CSS px above Display. Closing Display moves the fitted projection down 17 CSS px. Showing both distant solids again fits all 24 sampled corners. Frame all preserves the current document and visibility flags.
- **PASS** Visual review, the D668 desktop fit controls with chat and dock changes, 21 focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Multi-body occurrence with one hidden member, posed or clipped assemblies in the changed fit, gizmo obstruction, production build, full suites and mobile.

#2453 stays open for the gizmo case. Desktop QA is 12/54, initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
