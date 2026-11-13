# D953 — select drawing annotations at the painted section trace

2026-11-13 · SMALL · P2 rows 11 and 16 · [#2367](https://github.com/barocss/barocss/issues/2367)

- **PASS** Desktop Studio selected datum target B1 through the painted cutting-plane trace. The actual pointer target was Section A at (425.25, 363) screen pixels. At the other painted overlap, the standalone 0.07 flatness frame received the pointer directly at (485.4617, 360.5) and selected only its own frame.
- **PASS** Both clicks left the accepted document, dirty flag, history, sheet viewBox and trace markup unchanged. The actual Studio SVG before and after selection was byte-identical at 7811 bytes. Visual review confirmed the selected target and frame. No page errors, console errors or downloads occurred.
- **FAIL** The first harness run timed out comparing serialized property order. The loaded annotations had the same values in a different order. The final run uses structural equality and requires both painted overlaps and both real pointer targets.
- **PASS** Driver syntax and diff check. No production change was required.
- **NOT_RUN** Annotation movement, removed Section and Detail drag, sheet and document ownership, production build, full suites and mobile. Issue closure requires the remaining negative input cases.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
