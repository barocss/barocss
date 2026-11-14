# D1179 — Keep the picked Hole centre when grid snap is off

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2490](https://github.com/barocss/barocss/issues/2490)

Studio Hole defaults use the active grid step for a picked centre. Snap off retains the ray-plane hit coordinates. A command started from a face without a point retains the existing face-centre default. The HUD identifies the entry face beside the editable centre.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio rounded the fractional STEP top pick to (47,4) even when Grid was off. |
| PASS | The reported stale right-click case did not reproduce at the parent. After a real left-click at (8,8), right-click at (24,24) and menu Hole both parent and final opened Centre (24,24). Final preview identified `n1.top`. Apply at Ø4 made a strict-valid through bore with volume 19049.20355262768 mm³, within 1e−6 of 19200 − 48π. History reopened the exact X/Y coordinates and Undo restored the full original document. |
| PASS | On the imported STEP top, Snap off plus H opened Centre (46.5, 3.9999990823386313) from the real projected pointer. The difference from (46.5,4) is below 1e−6 mm. Preview identified `n0.box.top`. The accepted native bore axis and History retained those raw coordinates. At Ø4 the one valid output had volume 7049.203552627709 mm³, within 1e−6 of 7200 − 48π. Undo retained the original STEP import. |
| PASS | D1178 desktop preset regression, 18 focused Model tests, three Studio preset tests, both type checks, scoped lint, syntax, diff check and production build. |
| NOT_RUN | Thread and Hole pattern History edits, Type-menu Enter reproduction, other browsers, mobile and full suites. |

Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [#2490](https://github.com/barocss/barocss/issues/2490) stays open. D1180 measures the reported Type-menu key behavior and the remaining bounded pattern History cases. [Commands and hashes](qualification.json).
