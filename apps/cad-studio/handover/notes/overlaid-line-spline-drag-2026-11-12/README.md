# D830 — Retire overlaid line diagnostics during spline drag

P1, rows 09, 15 and 16. SMALL. This item moved ahead of Linear pattern after the review of [#2392](https://github.com/barocss/barocss/issues/2392) found that Select could still own an uncommitted spline handle drag. The pointer now retires the diagnostic on press and blocks new scans until the gesture ends. The existing drag cancellation and release routes restore access. The diagnostic adds no shape or history edits.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio kept one report and one mark while a real closed spline handle was pressed and dragged. Escape left the report visible. On a second press before movement, Enter started a new scan. |
| PASS | Actual Chrome/WebGPU starts with two adjacent rectangles and a six-fit-point closed spline. Pointer-down removes the report and mark and disables Find. A real live drag and an Enter attempt before the movement threshold keep zero reports and marks. Escape restores the starting handle and sketch. A plain release restores access without restoring the report. |
| PASS | A normal drag commits a 60° handle change. The first sketch Undo restores the automatic handle and retires the scan. Redo restores 60°. A fresh scan still checks eight straight segments and finds one exact group. The accepted document stays exact. |
| PASS | The D828 adjacent rectangles and D829 stored source identity flows pass in actual Studio. Root reviewed the drag and rescan screenshots. Focused Studio tests, types, scoped lint and diff check pass. |
| FAIL | The additional D353 browser driver timed out looking for the command palette input before it entered Sketch. D830 uses the current Sketch workspace entry point. |
| NOT_RUN | Full suites, production build, mobile and other browsers. |

Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. Next is D831, the displaced Linear pattern Separate bodies input admission check. [Commands and receipt digests](qualification.json).
