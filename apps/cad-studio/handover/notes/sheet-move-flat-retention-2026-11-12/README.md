# D812 — Keep the flat pattern after translating a sheet body

P1, rows 07, 08 and 16. FULL for the affected native output contract. Semantic Translate can carry an existing sheet report when the input and result each have one native solid, the fixed skin is one unambiguous plane, and each named bend resolves to unique cylindrical faces. A fresh report translates the bend axes and retains rules and provenance. The existing native flat-pattern function reads the translated B-rep. The existing multi-body, ambiguous-face and non-Translate behavior stays in its covered refusal scope.

| Result | Check |
| --- | --- |
| FAIL | Actual baseline Move (7, −3, 11) mm preserves the valid folded bracket, vertex correspondence, face names and mass. It drops the sheet report. Native flat returns CAPABILITY, and the actual Studio Flat button disappears. The baseline driver passes its explicit reproduction assertions. |
| PASS | The materialized source matches the canonical D546 L-bracket. Studio Move retains its original body shape and two through holes. Native and Worker volume are 2967.7682447597 mm³. The centroid moves to (19.1410980541, 12, 18.0078425114) mm. Every native vertex moves by the specified delta within 1e-9 mm, and the face names remain exact. |
| PASS | Bend-axis origin moves from (3, 30, 3) to (10, 27, 14) mm and direction stays (0, −1, 0). Thickness 1.5 mm, radius 1.5 mm, K 0.44 and the named fixed/bend faces persist. Flat length 67.3929200659 mm, width 30 mm and area 1974.2710130908 mm² match the independent formulas. The outside loop, two holes of radius 2.75 mm, and one DOWN bend keep their independently calculated positions. |
| PASS | The Flat dialog opens after Move, first Undo, first Redo and actual project Save, Close and fresh Open. The saved 2,323-byte document reopens exactly. The accepted moved output re-evaluates to the same native folded and flat quantities. Desktop runs have zero page errors, console errors and downloads. |
| PASS | CAD type-check and test build, 28 focused R12 tests, 20 R12 conformance cases, ten Model sheet tests, Model and Studio type-checks, production Studio build, syntax, diff check, Sol High implementation and root visual review. The focused native test also confirms bend-table source retention, unchanged original data and an allowed follow-on flange on a separate sheet specimen. |
| NOT_RUN | Actual follow-on flange on the moved D546 specimen, actual DXF after Move, whole-kernel/full suites, mobile and other browsers. Rotation, Mirror, pattern copies and manufacturing qualification remain separate. |

[Commands and receipt digests](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
