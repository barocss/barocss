# D925 — retire a two-point rectangle snap on successful File Open

2026-11-13 · SMALL · P1 rows 09, 15 and 16 · [#2321](https://github.com/barocss/barocss/issues/2321)

D793 and D794 already establish rectangle placement, signed distance, grid-off and offset XZ. This check uses the current desktop File Open button while a calculated XY point is pending.

- **PASS** An invalid file leaves the original document, title, selection, dirty state and history intact. The pending ratio 0.25, its (7.75, 3.25) mm result and its marker remain. No rectangle point is consumed.
- **PASS** Opening the valid replacement closes the original Sketch panel, point form and calculated marker. A fresh sketch picks the ordinary midpoint (11, 5) mm. The independent second click is (18, 9) mm. Finish stores only the replacement's construction and rectangle.
- **PASS** An actual 2 mm Extrude yields a valid native solid with all eight expected corners and volume 56.00000000000001 mm³. Independent expected volume is 56 mm³ with a 1e-8 mm³ tolerance. Two Undo and Redo steps stay in the new document. Visual review confirms the calculated source marker and the ordinary replacement midpoint. No product change was needed.
- **PASS** Nine Model and 44 Studio focused checks, driver syntax and diff check. The desktop WebGPU run reports no errors or downloads. The source capsule matches after cleanup.
- **NOT_RUN** Full suites, type checks, build, mobile, other sketch planes, source mutation while picking and Project Open during a pending snap. The wider issue remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).

The [#2324 research closeout](https://github.com/barocss/barocss/issues/2324#issuecomment-6842787489) was verified after pushing D924. Damaged-file repair remains deferred.
