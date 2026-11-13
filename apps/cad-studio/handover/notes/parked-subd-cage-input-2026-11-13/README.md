# D974 — keep parked SubD Cage out of workspace input and history

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2440](https://github.com/barocss/barocss/issues/2440)

- **FAIL on parent** Keyboard Undo in Render removed a moved cage face from the hidden draft. Toolbar Undo removed the accepted focus change instead. The first harness attempt opened the palette while the Open button still held focus. The reproducing attempt released that focus.
- **Change** Use one Model edit owner for the visible panel, mutable overlay, viewport input and history. Give an active Cage precedence over 3D Sketch. Other workspaces show the accepted body. Cancel a held Cage gizmo when its viewport session changes.
- **PASS** Desktop WebGPU Studio used a SubD box with 96 quads and one actual face move. Render picked 115.831469030 mm of focus distance. Keyboard and toolbar Undo/Redo restored the same exact documents. Render and Drawing click, drag and Tab retained the exact cage and selection. Switching to Render during a held gizmo retained the previous cage. With both editors open only the Cage received the Model shortcut and toolbar history. The 3D Sketch became visible after canceling Cage.
- **PASS** Visual review, 26 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Mate and Hole activation, Delete confirmation, WebGL2, project reopen, production build, full suites and mobile. #2440 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
