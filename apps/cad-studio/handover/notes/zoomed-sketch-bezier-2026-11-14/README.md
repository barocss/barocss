# D1148 — Refine the Sketch Bézier path in desktop Ortho

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 20 · [#2473](https://github.com/barocss/barocss/issues/2473)

Project the authored quadratic or cubic poles into CSS pixels. Subdivide at the midpoint until each control hull is within 0.25 CSS px of its finite chord or the 512-segment cap is reached. The finite chord also detects collinear curves that reverse direction. The same path builder serves the pointer preview, active curve and parked curve. Preserve the authored poles and exact Make curves output. Perspective uses the existing fixed sampling.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, desktop Studio used 32 segments for the active and parked cubic. The authored endpoint span grew from 239.889 to 2453.267 CSS px. The measured Bernstein-to-line distance grew from 0.164847 to 1.685835 CSS px. |
| PASS | After the fix, the active and parked cubic used the same 122-segment path at the larger span. Measured distance was 0.185363 CSS px. The active quadratic used 27 segments and measured 0.120818 CSS px. The first and last projected points had zero measured error. Zoom and tool changes kept the accepted document exact. |
| PASS | Desktop authoring, control point Enter and blur history, Make curves, Save/Open and the arc zoom regression. Exact native conversion was checked with an independent Fraction/Bernstein oracle. The authoring driver now uses the visible Sketch tool, the semantic curve marker and the current persisted entity format. |
| PASS | 3 targeted Studio tests, 15 Model Bézier tests, Studio type check, production build, lint, driver syntax and diff check. |
| FAIL | A broader run returned 5 failures in existing no-op Finish fixtures in sketch-edit-identity.test.ts. Those fixtures expect a commit or evaluation after a no-op. The established no-op guard in 641d7c48c returns before either. The broader run recorded 30 passes. |
| NOT_RUN | Full suites, mobile, perspective zoom certification, extreme-scale 0.25 CSS px certification beyond the cap and Direct curve zoom. |

Error measurements probe 2049 parameter values with a Bernstein evaluator independent of the product sampler. The measured cases are ordinary desktop XY Ortho. Keep #2473 open for Direct Bézier zoom. Desktop QA is **24/54 (44%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
