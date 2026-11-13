# D983 — qualify explicit top-rim reference confirmation after Detail Move

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2442](https://github.com/barocss/barocss/issues/2442)

- **Observed** After the Hole centre moved from [32, 16] to [48, 16] mm, the saved signature still named the old seam position [26, 16, 8] mm. Fresh Open offered the top and bottom rims. The detail renderer and exports resolved the authored top-rim name. An exact source review confirmed the top and bottom candidates are separated by the 8 mm plate thickness.
- **PASS** Desktop WebGPU Studio confirmed the existing top-rim candidate. Only its signature changed, to [42, 16, 8] mm. The accepted edge name, pick point, tolerance, both frames, Detail boundary, sheet placement and model remained exact. Save and fresh Open retained the confirmed document and Ø12 and showed no reference-choice panel.
- **PASS** The D982 split-Detail move, Undo/Redo and SVG, DXF and two-page PDF readback repeated before explicit confirmation. Studio visual review, driver syntax and diff check passed. No product source changes, page errors or console errors.
- **Follow-up** Ordinary History Hole centre edits can keep an old drawing reference signature. Scope a future refresh to a proved same native rim across the edit, and retain a choice when continuity cannot be proved. This is separate from the Detail Move and Fix all annotation-loss acceptance.
- **NOT_RUN** Automatic signature refresh, WebGL2, PDF raster visual review, standards-level PDF qualification, type-check, production build, full suites and mobile.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
