# D1145 — Refine native cylinder display on zoom

2026-11-14 · FEATURE · P0 desktop QA, rows 08, 20 and 21 · [#2473](https://github.com/barocss/barocss/issues/2473)

A single upright uncut circular extrusion in the ordinary committed Top Ortho view can use two finer display packets from its exact original B-rep. Each packet shares its triangle, outline, highlight and pick geometry. Studio chooses the first that meets the 0.25 CSS px rim chord target or uses the finest during further zoom. The native owner stays the canonical face/edge table. The worker transfers 20,592 and 41,072 bytes on the first packet for the fixture and reuses the token on a repeated evaluation.

| Result | Check |
| --- | --- |
| FAIL | At projected radii 133.403 and 477.411 CSS px, the parent drew 32 rim segments at both zoom levels. Maximum sampled errors were 0.642 and 2.298 CSS px. At the high zoom, the pixel 2 CSS px inside the analytic rim matched the background. |
| PASS | Both desktop WebGPU and WebGL2 drew and picked the same top rim at 64 and 128 segments with maximum errors 0.161 and 0.144 CSS px. The raster pixel 2 CSS px inside remained filled while the pixel 5 CSS px outside matched the background. Actual clicks retained edge 1 on body 0 and preserved the accepted document and volume 500π mm³. |
| PASS | Desktop rear-edge and coincident-vertex controls on both backends and the model framing control. Nineteen focused Model tests, both type checks, production build, scoped lint, syntax and diff checks. |
| NOT_RUN | Original D426 STEP browser replay requires its external original fixture set. Other body families, deeper zoom above the tier budget, Band, Bézier, full suites and mobile remain unqualified. |

Initial refinement declined the fixture because the two native wall faces share one display owner. The final gate verifies the exact ordered native-member and display owner tables. Sol High reviewed the source boundary and recommended coherent triangle and edge packets and canonical selection ownership. The exact output is limited to the selected orthographic profile.

Keep [#2473](https://github.com/barocss/barocss/issues/2473) open. Desktop QA is **24/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
