# D1056 — keep a numeric Sketch edit before Trim in draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Recognize the original straight main polygon after Trim parks it in the finished list. Use the existing stable main IDs and exact authored field comparison. If Trim is active, restore an outline history step in the same slot and preserve its companion shapes.

- **FAIL** After changing Point 3 X from 40 to 44 mm and trimming the 10–30 mm span, the first Undo restored the span. The next Cmd+Z left X at 44 mm. The first repaired run passed the draft actions but the driver expected a polygon instead of the saved rectangle. Correct the driver to read the native rectangle and account for its normalized construction flags.
- **PASS** Actual desktop WebGPU Studio restores Trim, then X40. An extra Undo leaves Redo available. Toolbar Redo restores X44 and Cmd+Shift+Z restores the same gap. Undo of that trim allows Finish with the X44 rectangle. The native edge IDs, two construction segments and Extrude node are retained. The 2 mm Extrude changes from 1,600 to 1,760 mm³. Exact document Undo and Redo pass.
- **PASS** D874 and D875 desktop Trim replays, visual review, nine focused tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** No-op Finish with document Redo, new or curved outlines, other Sketch tools, production build, full suites and mobile.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
