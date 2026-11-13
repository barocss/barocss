# D984 — make Drawing dimension and Note rows keyboard-selectable

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2443](https://github.com/barocss/barocss/issues/2443)

- **FAIL on parent** With datum target B1 selected, Enter on the width row left B1 selected. Delete removed B1 and retained width. Two early harness runs observed the frame/target transition on different frames. The reproduced deletion uses settled selection.
- **Change** Use native selection buttons with sibling removal buttons for dimensions and Notes. Clear the previous target/frame selection in the same row-selection update.
- **PASS** Desktop WebGPU Studio switched from frame to B1 to width through Enter and Space. Delete removed only width. After Undo, Space on the Note selected it and Delete removed only that Note, keeping the other sheet's Note, width, B1 and the frame. Undo/Redo restored exact document states.
- **PASS** Visual review, 19 focused drawing checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Same-ID cross-kind selection, overlapping annotation click order, Note Duplicate/Remove leader, edit Escape, WebGL2, production build, full suites and mobile. #2443 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
