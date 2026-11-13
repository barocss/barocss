# D1149 — Keep the Direct Bézier line and click together at precision zoom

2026-11-14 · FEATURE · P0 desktop QA, rows 08 and 20 · [#2473](https://github.com/barocss/barocss/issues/2473)

For a single visible Direct curve in desktop Ortho, use the compiled poles of an exact single-span, clamped, unit-weight quadratic or cubic on [0, 1]. This also admits structurally equivalent imported curves. Bound the world chord interpolation error by the maximum second difference and the orthographic screen scale. Keep the original packet when it meets the 0.2 CSS px prepacking target. Refine to a power of two up to 2,048 segments when needed. Drawing, selected styling and line picking receive one packet in both renderers. The refined packet is reused at the same tier, including during pan. The stored Direct source, object identity and pole-pick priority are retained.

| Result | Check |
| --- | --- |
| FAIL | The original WebGPU path used 127 segments. At 6,500 CSS px/mm, its analytic quadratic apex was 8.060016 CSS px beyond the central chord. Actual raster displacement was 7.731747 CSS px. The click did not select the curve. |
| PASS | Form the same quadratic using public Sketch and Make curves. Both WebGPU and WebGL2 select the published object at base, 4.35× and precision zoom. The precision packet has 1,024 segments and a measured Bernstein-to-packet interpolation gap of 0.123978 CSS px. Raster displacement at the apex is 0.268253 and 0.264920 CSS px respectively. The authored endpoints are exact in the packet. The endpoint pole is selectable at the ordinary scale and the document remains exact. |
| PASS | The original Bézier control point history and Direct conversion flow, 15 Model and 13 Studio focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Full suites, mobile, equivalent cubic at precision zoom, high-zoom endpoint marker and click alignment, and far-coordinate Float32 certification. |

The geometry check compares the uploaded packet to independent Bernstein evaluation at five parameter samples per chord. The raster uses a separate screenshot and pixel test. The 6 CSS px hit radius is preserved. The 2,048-segment cap is best effort beyond its error limit. Next D1150 verifies the precision endpoint marker and cubic case before closing #2473. Desktop QA is **24/54 (44%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
