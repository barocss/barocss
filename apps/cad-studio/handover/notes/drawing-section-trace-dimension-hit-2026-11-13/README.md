# D932 — let a drawing dimension receive input through a section trace

2026-11-13 · SMALL · P2 rows 11 and 16 · [#2367](https://github.com/barocss/barocss/issues/2367)

- **FAIL reproduced** At the painted overlap on the Top view, the original desktop click selected section A, and dragging left the 20 mm width dimension at its original place while panning the sheet.
- **PASS** Studio now looks through section ink for the existing annotation when Select is active. Both actual pointer-down events still hit the section trace. Click selects `width` without committing. Drag changes only the dimension place from (10, 6) to (10.520002092633916, 15.142857142857146) mm. Undo and Redo restore both exact documents. A trace-only drag still pans without moving the dimension. Section marks, dimension value, references and sheet viewBox stay intact during the dimension edit.
- **PASS** The actual Export SVG command emitted 6888 bytes. Before browser download delivery, an independent XML parser read A3 dimensions, the 20 mm dimension, five trace lines and one section. Studio and export share the original markup producer. WebGPU visual review and the final run passed with no errors or downloads.
- **PASS** Four Studio drawing roundtrip checks, Studio type check, driver syntax and diff check.
- **FAIL** The Model command matched `chat-drawing.test.ts` as well as the requested drawing tests. It returned 61 PASS and one known `TEXT_OVER_LINES` assertion, previously documented in D697 and D700. The Model and its output producers are unchanged. Early browser drivers hit JSON key order, duplicate selected A groups or a paint-gap coordinate. The final driver rechecks the actual painted overlap before drag.
- **NOT_RUN** Fresh project Open/re-drag, the full annotation interaction matrix, Model type check, build, full suites and mobile. The wider issue remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
