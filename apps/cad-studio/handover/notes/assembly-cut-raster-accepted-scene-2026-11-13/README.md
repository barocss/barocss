# D1024 — export the applied Assembly Cut in Raster PNG

2026-11-13 · FEATURE · P0 rows 05, 13, 16 and 20 · [#2448](https://github.com/barocss/barocss/issues/2448)

- **FAIL, baseline** The creation-draft PNG matches the applied Ø8 PNG byte for byte although the document has no cut. An unapplied Ø12 edit opens the radius 5 mm probe in the PNG.
- **PASS, fixed** Render takes the accepted placed bodies. Model keeps the draft, including the Ø12 geometry and editable radius on return. Raster export waits for the visible placed bodies to match the applied inputs.
- **PASS** Six Chrome desktop WebGPU exports at 1140 × 1000, with the same camera and selection. Stock, creation draft and creation Cancel are byte-identical. Applied Ø8, Ø12 edit draft and edit Cancel are byte-identical. The applied bore changes the center probe by 211.67 average channel levels. The outside probe is unchanged. Native reads match 12,000 mm³ before Apply and 12,000 − 80π mm³ per placed plate afterward within 1e-7 mm³.
- **PASS** Visual review, 19 focused Studio tests, both type-checks, driver syntax and diff check.
- **FAIL, setup runs** The first runner used a palette interaction that did not open from the focused outliner. The first fixed run left a different occurrence selection on the stock capture. It verified the geometry pixels, but the outlines changed the byte comparison. The final runner uses the visible tool rail and fixes the selection for every capture.
- **NOT_RUN** Path tracing, STEP, Drawing, 3MF, delayed placed-worker handoff under controlled timing, production build, full suites and mobile.

The Render workspace uses the same applied scene for raster capture and path trace start. D1025 verifies the still separately. Desktop QA stays at 9/54 and #2448 stays open. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
