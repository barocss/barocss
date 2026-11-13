# D1116 — show when the current sketch tool cannot use Crossing

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Object snaps shows a short note when Edge crossing is enabled and the active sketch tool has no native crossing support. It uses the same tool eligibility as the viewport. The setting stays available for the rest of the session.

| Result | Check |
| --- | --- |
| FAIL | The parent showed Edge crossing enabled during Slot and offered no tool-limit indication. |
| PASS | Desktop Studio showed the note in Slot and provided no Crossing cue on the tested offset plane. Switching to Line removed the note and restored Crossing at the same model edge. The setting stayed enabled. Cancel retained the original document. Root reviewed the note in Studio. |
| PASS | Desktop Object snaps and Escape controls, Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, browser-driver syntax and diff check. |
| NOT_RUN | Other supported source families, snap availability at every tool phase, the tilted construction endpoint consumer and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
