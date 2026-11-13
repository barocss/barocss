# D1073 — replay repair Line points and the preceding Drag Trim

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record confirmed Line points as draft steps. Keep the current tool and replay both the active chain and parked geometry. Cursor previews do not make history steps.

- **FAIL** The parent Studio Drag Trims an open material line and draws a three-edge repair path. Cmd+Z leaves its last segment in the draft.
- **PASS** Desktop WebGPU undoes the four Line points and the preceding Trim in order. The toolbar and keyboard redo those same states. The accepted solid stays at 3,200 mm³ while the sketch is open.
- **PASS** A second Line path closes the stepped hole. Finish retains the construction boundaries and 2 mm Extrude. The resulting volume is 2,100 mm³. Document Undo and Redo restore the exact native documents and volumes. Visual review, Studio type-check, 20 focused tests, driver syntax and diff checks passed.
- The initial driver targeted a closed edge, outside Drag Trim's current scope. A later driver comparison included the cursor preview. The final baseline and corrected run use the same open-line fixture and compare placed vertices.
- **NOT_RUN** Arc placement history, Cut circle gap, other sketch routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
