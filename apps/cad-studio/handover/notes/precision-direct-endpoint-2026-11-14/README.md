# D1150 — Qualify the Direct cubic and endpoint at precision zoom

2026-11-14 · SMALL · P0 desktop QA, rows 08 and 20 · [#2473](https://github.com/barocss/barocss/issues/2473)

Actual Studio makes the quadratic and cubic from public Sketch controls. At the analytic apex each curve selects its own Browser row. Move the zoom anchor to the left endpoint. Click once to select the curve and again to select that pole. The displayed line, native endpoint and selectable marker agree at approximately 6,500 CSS px/mm. No production change was required after D1149.

| Result | Check |
| --- | --- |
| PASS | Cubic WebGPU and WebGL2 at base, above 4× and precision. At precision, 1,024 segments give a maximum measured Bernstein-to-packet distance of 0.147748 CSS px. Apex raster displacement is 0.103937 CSS px. The closest endpoint raster pixel is within 0.421 and 0.634 CSS px. The selected SVG endpoint marker has zero measured gap. |
| PASS | Quadratic WebGPU under the same flow. Precision chord gap is 0.123978 CSS px. Apex raster displacement is 0.264921 CSS px. The nearest endpoint raster pixel is within 0.146 CSS px and the selected marker gap is zero. The original document is exact after all camera and selection operations. |
| PASS | Driver syntax and diff checks. |
| FAIL | The first two endpoint driver attempts failed to reframe from the deep apex or reused an already-selected pole. Frame all and explicitly toggle the initial pole off before the precision check. The final product flow passes. |
| NOT_RUN | Full suites, mobile, arbitrary rational curves, far-coordinate precision and live pole-drag parity. The selected issue concerns zoom in the committed view. |

The #2473 desktop repro acceptance is covered across [D1143](../zoomed-sketch-arc-path-2026-11-14/README.md), [D1144](../zoomed-inline-dimension-placement-2026-11-14/README.md), [D1145](../zoomed-native-cylinder-2026-11-14/README.md), [D1147](../zoomed-committed-band-rails-2026-11-14/README.md), [D1148](../zoomed-sketch-bezier-2026-11-14/README.md), [D1149](../precision-direct-bezier-2026-11-14/README.md) and this endpoint qualification. Equal-radius rails at the same Top projection select the nearer visible rail. The frustum control independently selects both rails. Desktop QA reaches **25/54 (46%)** after issue reconciliation. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
