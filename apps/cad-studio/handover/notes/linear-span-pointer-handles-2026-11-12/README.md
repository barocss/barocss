# D837 — Keep Count and Total span drags distinct and stable

P1, rows 08, 16 and 20. FEATURE. Fixed-span creation and history use the same handle geometry. Count appears 16 CSS pixels across the projected axis from the span arrow. A straight arrow keeps its value conversion from pointer-down through release. Current preview updates still use the existing command path.

| Result | Check |
| --- | --- |
| FAIL | In parent Studio, pressing within the drawn Count head moved the overlapping Total span handle from 90 to 150 mm. Count remained 4. |
| FAIL | At the distinct Count tip, a 60 mm drag moved Count 4 to 9. The live pitch changed the drag scale. The accepted fixed-span history item showed zero span and count handles. |
| PASS | Actual Top/Ortho Studio picks Count at the centre of its separated head. The same 60 mm drag holds and releases at Count 6 with span 90 mm and spacing 18 mm. Apply yields 48 native corners and 2880 mm³. |
| PASS | In History, a 20 mm span drag holds and releases at 110 mm, with Count 6 and spacing 22 mm. A −22 mm Count drag then holds and releases at Count 5, with span 110 mm and spacing 27.5 mm. The accepted row has 40 native corners, 2400 mm³ and centroid (90, 13, 4) mm. First Undo and Redo restore the two exact documents. Each native output matches an equivalent spacing-mode B-rep. |
| PASS | The D555 Width X arrow passes real drag, Apply and Undo. Focused Model and Studio tests, types, lint, build, browser syntax, diff check and root visual review pass. |
| NOT_RUN | Frame cadence measurement, full suites, mobile and other browsers. |

Next D838 checks stale preview ownership and the remaining direction and count bounds for [#2386](https://github.com/barocss/barocss/issues/2386). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
