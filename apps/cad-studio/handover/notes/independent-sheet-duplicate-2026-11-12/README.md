# D818 — Edit an independent sheet duplicate

P1, rows 07, 08 and 16. SMALL verification of the existing Duplicate command with D812's qualified Translate. The source is the canonical D546 L-bracket. Studio creates one separate copy with a 60 mm X offset. The original body b6 and copy b14 have separate authored feature IDs and sheet reports.

| Result | Check |
| --- | --- |
| FAIL | The first Studio driver waited for the correct native refusal while Kernel detail was collapsed. The corrected driver opens the actual detail control. The first run and its custody remain recorded. |
| PASS | Actual Duplicate keeps both valid solids with independent fixed faces n0.leg0.a and n7.leg0.a. Both start at thickness 1.5 mm, with identical native volumes and flat geometry. The copy centroid and folded bounds move by the selected offset. |
| PASS | Editing only copied source n7 to 2 mm leaves the original document prefix, native geometry and flat exact. Original volume is 2967.7682447597 mm³ and flat size is 30 × 67.3929200659 mm. Copy volume is 3920.5862712481 mm³ and flat size is 30 × 66.7384952578 mm. Both retain their own named DOWN bend, two radius-2.75 mm holes and explicit K 0.44. |
| PASS | Zero thickness on the copy is refused. Both accepted sheets stay exact. The first Undo restores the 1.5 mm copy and the first Redo restores the 2 mm copy. |
| PASS | Actual project Save, Close and fresh Open restore the exact 4,329-byte document. Studio opens both Flat dialogs separately. The live Worker and independent native read agree with the analytic volume, centroid, bounds, holes and bend checks at the stated tolerances. |
| PASS | Driver syntax, diff check and root visual review. Final desktop has zero page errors, console errors and downloads. D817's focused package checks apply to the unchanged product sources. |
| NOT_RUN | Two-reflection Studio lifecycle, copy-specific DXF, joined pattern, table-backed duplicate, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
