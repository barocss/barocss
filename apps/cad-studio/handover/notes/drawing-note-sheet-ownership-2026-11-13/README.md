# D986 — retain Sheet 2 ownership when detaching or duplicating a Note

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2443](https://github.com/barocss/barocss/issues/2443)

- **FAIL on parent** Remove leader on a Right-view Note on Sheet 2 moved it to Sheet 1.
- **Change** Assign the current sheet when removing a Note's leader. Add the selected Note's Duplicate action with the same leader or sheet and a 5 mm offset along both paper axes. Allocate Note IDs across the whole drawing.
- **PASS** Desktop WebGPU Studio retained the detached Note on Sheet 2 with the exact text and position. Copies with and without a leader stayed on Sheet 2. The new ID was `n3`, with `n1` on Sheet 1 retained and `n2` on Sheet 2 retained. Undo and Redo restored each exact state. Sheet 1 and Sheet 2 showed only their own Notes.
- **PASS** Visual review, 19 focused drawing checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Note text Escape, overlapping Note/frame hit priority, WebGL2, production build, full suites and mobile. #2443 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
