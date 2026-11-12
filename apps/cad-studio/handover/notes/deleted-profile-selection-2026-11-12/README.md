# D810 — Keep the surviving sketch selected after History Delete

P1, rows 09, 16 and 21. SMALL. Studio resolves picked profiles by stable ID at the accepted edit boundary. This covers ordinary History Delete and Delete with dependents. The common path also keeps surviving profiles when the last solid goes away. A deleted profile leaves the selection.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, deleting an earlier unused sketch left the selected index at 4, which now named circle n5 instead of circle n4. Actual Extrude used n5 and made a 100.5309649149 mm³ cylinder. Confirmed cascade left a picked index outside the document. Deleting the picked circle rebound its selection to n5. Deleting the only solid cleared the surviving selection. Both baseline drivers passed their explicit reproduction assertions. |
| PASS | Ordinary Delete preserves n4 at its new index. First Undo and Redo keep n4 selected. Actual Extrude uses n4 without another pick. |
| PASS | Canceling Delete with dependents preserves the exact document and the pick. Confirming it removes the plate, its source sketch and Hole. Circle n4 remains selected and can drive Extrude with or without another solid present. Deleting n4 itself removes its selection. |
| PASS | The three corrected 2 mm extrusions return 56.5486677646 mm³ and centroid (46, 10, 1) mm, within 1e-5 mm³ and 1e-6 mm of independent analytic values. |
| PASS | The D809 desktop reorder and history regression, 27 focused Model tests, both type checks, production build, driver syntax, diff check and visual review. Final desktop runs have zero page errors, console errors and downloads. |
| NOT_RUN | General mixed-feature graph, all history permutations, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#551](https://github.com/barocss/barocss/issues/551) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
