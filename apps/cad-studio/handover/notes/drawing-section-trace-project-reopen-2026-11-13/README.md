# D933 — verify section-trace hit testing after Project Open

2026-11-13 · SMALL · P2 rows 11, 12 and 16 · [#2367](https://github.com/barocss/barocss/issues/2367)

- **PASS** The actual browser Project Save produced 1913 bytes. The parsed file matched the accepted drawing and model. Close, reload and Project Open retained the overlapping dimension, the ordinary front dimension, the Note and Section A.
- **PASS** On the reopened sheet, clicking the ordinary dimension or the Note selected its own mark. A trace-only drag panned the sheet without committing a change. After Fit sheet, dragging the painted overlap moved only the Top width dimension from (10, 6) to (10.520002092633916, 14.428571428571423) mm. Undo and Redo preserved the exact accepted documents. Visual review confirmed the selected width, Note and section.
- **PASS** 46 focused Studio tests, driver syntax and diff check. Desktop WebGPU reported no page errors, console errors or downloads. The D932 SVG result remains the export evidence for the initial fixture.
- **NOT_RUN** Datum target, standalone frame, removed section and detail drag, multi-sheet identity, build, full suites and mobile. The wider issue stays open. No product change was needed.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
