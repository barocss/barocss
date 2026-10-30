# D372 — Row 01 closed: standalone tolerance frames (CG5 DR-6)

Tier: **small** (close-out). Owner order "Go to 01–06", 2026-10-31. [Qualification](qualification.json).

The row's open action was "finish the latest reader/writer field preservation and raw-input checks, and connect them to the product". That work is already in the code:
- **Reading.** `drawing/controls.ts` reads saved frames as an array, refusing invalid ones with a message.
- **Rendering.** The sheet and the SVG draw standalone frames at view-mm.
- **Diagnostics.** `issues.ts` reports a missing view, a hidden view, an undefined datum and text over lines.
- **Tests.** The model tests pass 26/26, including real file-codec round trips.

The close-out ran one actual Studio flow on the current code with the shared flow helper (driver `48a348d28`, [run-01](run-01/receipt.json)). It passed on the first try:
1. **Add.** A standalone frame in the right view.
2. **Edit.** Characteristic and tolerance.
3. **Move.** Only `place` changes.
4. **Hide.** Hiding the view keeps the frame and warns; showing it again restores the drawing settings.
5. **Files.** Save, New and Open give an identical frame.
6. **SVG export.** An independent Python oracle puts the frame at origin + scale·place within 5e-3 mm.
7. **Delete.** Remove and Undo restore the document identically.

Errors were 0, and all 265 frozen files equal the commit.

**Limits.** Datum-referencing frames, section and detail views, and dragging on the sheet are not driven; the model tests cover datums and missing views. The earlier evidence keeps its own notes. CI and release were not run.
