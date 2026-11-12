# D854 — Preserve sketch Offset direction after splitting a circle

P1, rows 09 and 16. FULL for the line-and-arc geometry fix. Offset now determines winding from signed chord and circular segment area. It translates the chord arithmetic to a local origin, uses a series for shallow bulges and refuses an indeterminate sign. It checks the result after the existing rounding. The radius check uses the signed radial distance before rebuilding endpoints. This keeps the existing strict 0.01 mm circle threshold for split arcs too.

| Result | Check |
| --- | --- |
| FAIL | The unchanged parent reproduced both wrong results in Studio. After drawing R10 and using Split, Out 2 produced R8 and In 2 produced R12. The baseline driver passed its assertions of the defect. |
| PASS | Desktop Studio draws and splits the same circle. Out 2 gives R12 with the original R10 inner boundary. In 2 gives R8 with the original R10 outer boundary. The two original side IDs stay on the R10 boundary. A 2 mm extrusion gives 88π and 72π mm³ respectively. |
| PASS | In 12 refuses and retains the accepted document, bodies, selection, history and dirty state. The next valid offset finishes with the expected two loops. First Undo and Redo restore the exact sketch and Extrude states. |
| PASS | Browser project Save writes 1511 bytes. A fresh Studio context opens those exact bytes through File Open. The sketch remains editable. Changing the reopened extrusion distance to 3 mm gives 132π mm³ with the same R10/R12 source. The separate translated XZ run places the 2 mm ring at centroid (0, −8, 0) mm with the same radii and 88π mm³. |
| PASS | Independent Model oracles cover native circle and alternate-seam Split, both windings, +12 and collapse near the radius floor, mixed arc/chord winding, a shallow lens, indeterminate area and ordinary outline regressions. Two geometry reviews checked the signed area and the existing radius floor. |
| PASS | Model 136/136, Studio 79/79, both type checks, scoped lint, driver syntax, production build, diff check and root visual review. The control passes and all six mutations fail their designated assertions.
| FAIL | The first Model lens assertion allowed only 1e−9 bulge error after the stored 1e−6 mm point rounding. The corrected oracle includes propagation of that rounding. The first XZ driver used XY screen coordinates, so it drew R11. The corrected driver projects the actual XZ world points. |
| NOT_RUN | General offset topology changes, spline offsets, same-project UI reopen, other browsers and full test suites. |

[Issue #2296](https://github.com/barocss/barocss/issues/2296) is the bounded Split/Offset defect. D855 checks whether noncircular display edges can offer a false sketch centre. Initial scenarios remain **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
