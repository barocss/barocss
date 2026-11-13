# D955 — isolate drawing selection across sheets and documents

2026-11-13 · SMALL · P2 rows 11, 12 and 16 · [#2367](https://github.com/barocss/barocss/issues/2367)

- **PASS** Desktop Studio selected the 20 mm width through the painted Section A trace on Sheet 1. Sheet 2 showed the same Section A cut result and Detail B with no carried selection. Dragging blank paper panned Sheet 2 without editing the document or SVG. Returning to Sheet 1 restored its exact SVG with no selected mark.
- **PASS** Opening a different native plate reused the Section A and width IDs. The replacement started unselected. A fresh click at the painted overlap selected the replacement's 24 mm width, with no document or SVG change. Actual file output identified the sheet cross-references. Visual review confirmed both sheets and the replacement width.
- **FAIL** The first browser start exceeded the 10-second navigation timeout before the fixture opened. A separate 60-second navigation budget resolved startup. The passing run recorded no page errors, console errors or downloads.
- **PASS** Driver syntax and diff check. Together with D932–D933 and D953–D954, this covers the issue's desktop input, history, reopen and SVG acceptance. No production change was needed for D955.
- **NOT_RUN** Build, full suites, DXF/PDF and mobile. The hit-policy changes do not edit the shared file producers.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
