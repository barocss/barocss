# D819 — Restore the sheet orientation with two reflections

P1, rows 07, 08 and 16. SMALL verification of D817. An asymmetric D546 sheet is reflected twice at the origin YZ plane. Each operation explicitly chooses Reflected body only. The second targets the reopened first reflection by its body identity.

| Result | Check |
| --- | --- |
| FAIL | The first run completed its product assertions but the file watcher reported two driver changes. All 1,007 captured input hashes matched through cleanup. The unchanged repeat passed with no watcher events. |
| PASS | The existing combined default and single reflection pass again. The second actual Mirror consumes only the prior reflected output and creates one valid n8/b8 solid. All 24 native vertex positions, face names, folded bounds and the original outward −X fixed face return within 1e-9 mm coordinate tolerance. |
| PASS | Restored volume is 2967.7682447597 mm³ and centroid is (12.1410980541, 14.9639755142, 7.0078425114) mm. The bend-axis origin returns to (3, 30, 3) mm with direction (0, −1, 0). The native flat restores the DOWN bend, positive exterior and both negative radius-2.75 mm bores at (15, 10) and (18, 52.3929200659) mm. |
| PASS | First Undo restores the exact single reflection and its Flat dialog. First Redo restores the double reflection. Actual project Save, Close and fresh Open restore the exact 2,467-byte document and the original folded and flat orientation. |
| PASS | Syntax, diff check, root visual review and actual desktop WebGPU pass. Final run has zero page errors, console errors and downloads. D817's package checks apply to the unchanged product sources. |
| NOT_RUN | Separate flat DXF for each copy, bend-table assignment on an independent copy, offset reflected-only mode, joined pattern, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open for its wider provenance and output requirements. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
