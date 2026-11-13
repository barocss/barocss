# D1122 — verify a Hole on the cylinder from a snapped Circle

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

The test authors the D1110 object-snapped Circle, reopens its saved project document, extrudes its outline and adds a through Hole to the cylinder's top face in Studio.

| Result | Check |
| --- | --- |
| PASS | The End cue gave the saved Circle radius of 7.6288757789074015 mm. Project Save and fresh Open preserved that radius. The native 2 mm cylinder passed validity and volume checks. |
| PASS | The Hole used the cylinder's top face and stored centre (0, 0) mm with radius 1.25 mm. The native result passed validity. Its volume was 355.8623097072008 mm³ versus the independent 355.862309707201 mm³. The original 2800 mm³ stock remained valid. Undo and Redo restored the exact documents. Root reviewed the drilled body. |
| PASS | Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| FAIL | No failure in the tested flow. |
| NOT_RUN | Other Hole modes and axes, Hole on the tilted Circle, coincident screen projection and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
