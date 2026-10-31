# D398 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Verified: mergeSheet — every sheet of a 3-sheet drawing merged back unedited is identical, also after 3 passes; 3000 random edits/deletes/adds across dimensions, notes, datums, targets, frames, details never lost or reordered another sheet's items, duplicated ids or touched another list (letters renamed only on new items). No `sheets`: 3 documents × 6 setting sets through set_drawing → issues → auto_dimension → fix → accept_tolerances → fix — tool output, SVG, PDF, DXF, issues, 3D, readDrawing byte-identical in all 18. PDF: a 3-sheet set (A4, A3, A4) opens in PDFKit as 3 pages with the right media boxes and its cross-references on the right pages.

1. (high) Weld symbols vanished when the isometric view moved (they were tied to the iso view's sheet but drawn only on front/top/right); Balloons / Weld symbols ticks thrown away by the merge and hidden on later sheets.
2. (high) A frame on one sheet naming datums defined on another reported a false DATUM_UNDEFINED error.
3. (medium) Chat auto_dimension / fix_drawing laid out on the one-sheet layout (OFF_SHEET left, fix applied nothing).
4. (medium) A deleted sheet's notes came back on the next added sheet (id reuse).
5. (low) A renamed new section/detail letter did not carry its same-edit dependents.
6. (info) Unticking a view on a later sheet left it listed there.
Mutations 15/24 caught; survivors untested (incl. tables dropped and other sheets' datums dropped — silent data loss if they regressed).
Root image review (run01): tabs, sheet index, "1 OF 2 A4" / "2 OF 2 A4", the top view alone on sheet 2 at its own scale.
