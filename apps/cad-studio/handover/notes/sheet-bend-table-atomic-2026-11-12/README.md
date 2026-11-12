# D820 — Keep the accepted sheet when a bend table has no matching row

P0 repair in the P1 sheet workflow, rows 07, 08 and 16. SMALL. The real Bend table file input accepts a table only after the current candidate evaluates. The request checks the originating document, file-open scope and latest table selection before applying a result. A valid table still applies to the selected sheet's own source feature.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, a structurally valid local table with only a 4 mm row was committed to the 2 mm copy. The native part then returned BEND_TABLE_MISS, Studio became stale, and the first Undo was required to recover the last accepted table. The baseline driver passes its explicit reproduction assertions. |
| FAIL | The first corrected run preserved the document and history, but visual review caught a generic instruction to Undo. The final notice asks the user to check the table's bend coverage and retains the native detail. |
| PASS | Studio applies the exact local 2 mm, R1.5, 90° test row with K 0.46 to copied source n7. Original n0 keeps K 0.44. Copy row 0 and its declared source persist in the native sheet and flat bend. Both folded bodies retain their native volumes and centroid. The original flat length remains 67.3929200659 mm and the copy flat length is 66.8013271108 mm. |
| PASS | The unmatched table is refused with BEND_TABLE_MISS. Both accepted sheets, their current native results and the exact document stay intact. First Undo goes directly to the valid pre-table state, and Redo restores the exact row. |
| PASS | Actual project Save, Close and fresh Open restore the exact 4,691-byte document. Each sheet opens its own Flat dialog. The copy restores its named bend, exact table row and 1956.5232244398 mm² flat area. |
| PASS | Both type checks, 11 focused Model sheet tests, Studio production build, driver syntax, diff check, and root visual review. Final desktop has zero page errors, console errors and downloads. |
| NOT_RUN | Delayed File read across document replacement, concurrent uploads, separate copy DXF, joined patterns, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). The input table is a controlled fixture. [#2230](https://github.com/barocss/barocss/issues/2230) remains open for broader output and transform requirements. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
