# D973 — keep parked 3D Sketch out of workspace input and history

2026-11-13 · SMALL · P0 rows 09, 15 and 21 · [#2440](https://github.com/barocss/barocss/issues/2440)

- **FAIL on parent** Render focus picked an accepted body. Keyboard Undo then changed the hidden 3D Sketch, while toolbar Undo removed the Render focus change. The first harness run put a sketch point outside the framed viewport. The reproducing run used two visible points.
- **Change** Suspend mutable 3D Sketch input, draft marks and transient pointer state when another workspace or editor owns input. Keep committed skeleton marks available. Use one history dispatcher for the 3D Sketch toolbar and keyboard.
- **PASS** Desktop WebGPU Studio picked a 39.246795947 mm focus distance. Keyboard and toolbar Undo/Redo restored the same exact Render document states. Render click, drag and Tab and Drawing click and Tab left two points, one segment and the XY plane exact on return. With 3D Sketch visible, toolbar Undo/Redo affected only its draft. No page errors, console errors or downloads.
- **PASS** Visual review, 20 focused Studio checks, Studio type-check, driver syntax and diff check.
- **NOT_RUN** SubD Cage workspace ownership, switching workspace during a held pointer, committed skeleton overlay regression, Mate and Hole activation, Delete confirmation, WebGL2, project reopen, production build, full suites and mobile. #2440 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
