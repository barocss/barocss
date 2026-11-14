# D1183 — Show picked and tangent edges in a Fillet preview

2026-11-14 · FULL · P0 desktop QA, rows 07 and 21 · [#2466](https://github.com/barocss/barocss/issues/2466)

For a successful constant circular edge Fillet covered by the native edge pass, Studio shows the count and names of the picked source edges and the extra tangent edges. The displayed radius belongs to the same preview. The native result reports the exact original targets from the successful finishing pass. The worker copies this report for the current preview only. The feature document continues to store the authored picks. If a phased operation or unnamed target prevents exact source attribution, the preview omits the scope report.

| Result | Check |
| --- | --- |
| FAIL | The parent Studio preview displayed one selected edge for a four-edge result. A first focused Studio test run also failed on a mock that lacked required command callbacks. The final test supplies those callbacks. |
| PASS | Current desktop Studio reported 1 picked edge and 3 additions after the individual rim pick, then 4 picked edges and 0 additions after a tangent-chain pick. The checked names were the exact original rim edges in both cases. The root reviewed the preview screenshot. |
| PASS | Both accepted R1 previews produced one strict-valid solid with two R1 cylinders and two revolved patches. The native volume was 1247.9164744094264 mm³. The analytic quarter-round sweep gave 1247.9164744094167 mm³. Native and analytic centroids agreed within 1e−7 mm. Apply, Undo, Redo and fresh Open preserved the authored targets and accepted geometry for the exercised lifecycle. |
| PASS | The mutation that replaced one tangent name in the worker response while retaining the count and geometry produced the expected FAIL on the exact-name assertion. All desktop runs had matching frozen-source manifests before and after cleanup. |
| PASS | Two read-only geometry/API audits. Kernel 16/16, Model 17/17, Studio 15/15, three type checks, scoped lint, browser-script syntax, diff check and Studio production build. |
| NOT_RUN | Variable or noncircular expansion, limiting automatic tangent propagation, removal from the live preview, the imported STEP seam case, full package suites, CI and mobile. |

Keep #2466 open for its remaining acceptance. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. Next reproduce the smooth imported STEP seam and test a real corner on the same body. [Commands and hashes](qualification.json).
