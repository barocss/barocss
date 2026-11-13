# D988 — qualify Delete for overlapping Drawing annotations

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2443](https://github.com/barocss/barocss/issues/2443)

- **PASS** Desktop WebGPU Studio clicked a painted overlap where the Section A trace was above datum target B1. Only B1 was selected and Delete removed only B1.
- **PASS** At a second painted overlap the standalone flatness frame was above the trace. Only the frame was selected and Delete removed only the frame. Width and Section A stayed exact in both cases. Undo and Redo restored exact documents. The final SVG was byte-identical to the original.
- **PASS** Visual review, driver syntax and diff check. No product source changes, page errors, console errors or browser downloads. The first two harness runs reused the pre-delete clean flag for the second case. The final run compares the state immediately before each selection.
- **NOT_RUN** Other overlap pairs, WebGL2, type-check, production build, full suites and mobile. D984–D988 cover the reported #2443 desktop acceptance.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
