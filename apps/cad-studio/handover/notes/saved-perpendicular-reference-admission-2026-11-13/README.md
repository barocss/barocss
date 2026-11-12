# D860 — Refuse an inert saved perpendicular constraint

P0, rows 09, 12 and 16. SMALL. D859 reproduced a saved perpendicular rule that points to a circular arc. Its row and glyphs appeared in Studio, while the solver omitted it. The shared saved-document reader now requires two distinct straight-edge indices for the existing perpendicular rule. Both the native segment and the editable outline must identify a straight edge. It returns BAD_REFERENCE before installing the incoming document.

| Result | Check |
| --- | --- |
| FAIL | D859 desktop Studio opened the exact synthetic file and displayed Perpendicular for a 45° line-to-tangent angle. Its solver stayed at rank 3 and 7 DOF. |
| PASS | Current desktop File Open refuses the same input bytes with the sketch and constraint number. The active dirty sketch retains both picked entities, solver rank 5 and 5 DOF, its constraint rows, accepted body, document and history. Cancel followed by first document Undo and Redo returns the exact earlier and later documents. |
| PASS | The supported two-straight-edge control passes Apply, Undo/Redo and native reopen. Its R8 arc, native names and independent volume 658.4071052554 mm³ agree. The project writes the same 1,665 bytes as D859 and opens them in a fresh context. |
| PASS | Raw Model, native-file and exact snapshot reads refuse the known invalid rule in schema 3 and genuine PB0 schema 4. Reversed arc order, duplicated or invalid indices and native/editor disagreement also refuse. Ordinary loop, polygon and rectangle files retain their valid rule and exact coordinates. The input document and supplied bytes are preserved. |
| PASS | The inventory finds 630 tracked native files, 629 plain Model files and one packed file. The root sketch outlines of the plain files contain zero explicit perpendicular rules. The generated straight-edge controls provide the positive coverage. |
| FAIL | The first Model test fixture omitted a required PB0 member field. The initial type check also required an exact two-member tuple. The final fixture supplies both and all selected checks pass. |
| PASS | Model 28/28, Studio 56/56, both type checks, scoped lint, driver syntax and diff check. |
| NOT_RUN | Packed-file reproduction, direct in-memory API validation, older application builds, native mixed-constraint admission, mobile, additional browser engines, production build and full suites. |

[Issue #2436](https://github.com/barocss/barocss/issues/2436) stays open. The old-reader fence for a new persisted line–arc relation still needs a compatible representation. [D859 baseline](../line-arc-perpendicular-boundary-2026-11-13/README.md) · [Commands and receipt digests](qualification.json). Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**.
