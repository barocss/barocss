# D952 — verify the existing Move action for a clipped Detail label

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement

- **PASS** The D950 interior label produces `TEXT_OVER_LINES` in Studio. Its existing Move action changes the model-view label placement from (33,15) to (31,17) mm and clears that warning. Only the placement changes. The dimension keeps its Ø9 value, source edge and 0.15 mm tolerance. First Undo restores the original warning and exact document. First Redo clears it again.
- **PASS** The actual SVG and DXF agree with the independent source-arc calculation. The tip is at (312.5,85) paper mm. The DXF keeps the Ø9 model measurement and 45 paper-mm definition diameter at 5:1. Driver syntax and diff check pass.
- **NOT_RUN** New placement behavior, fresh unit suites for unchanged product code, production build, full suites, PDF and mobile. Other fixture diagnostics remain visible. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
