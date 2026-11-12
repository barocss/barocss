# D809 — Keep a picked sketch attached to its feature during reorder

P1, rows 09, 16 and 21. SMALL. History now maps selected ordinary and driven sketches by their existing feature IDs after an accepted reorder. Same-document Undo and Redo also resolve those IDs against the restored node order. Existing body, face and edge selection uses its existing rebuild path.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, selecting rectangle n0 and moving the independent cylinder ahead of it left the selection at index 0. That index now named the cylinder's circle n1. Actual Extrude used the circle and created an overlapping 157.0796326795 mm³ cylinder. The baseline driver passed its explicit reproduction assertions. |
| PASS | After the fix, n0 stays selected at index 2 after the move, at index 0 after first Undo, and at index 2 after first Redo. Actual Extrude without a new pick creates the intended 30 × 20 × 2 mm plate. The Worker returns 1200 mm³ and centroid (15, 10, 1) mm, within 1e-5 mm³ and 1e-6 mm of the independent dimensions. |
| PASS | The D808 desktop flow still passes with its dependent Hole refusal, exact project Save/Open and post-Open edit. Both final desktop runs have zero page errors, console errors and downloads. |
| PASS | 27 focused Model tests, both type checks, production build, driver syntax, diff check and visual review. |
| NOT_RUN | History Delete and cascade selection remapping, other history families, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#551](https://github.com/barocss/barocss/issues/551) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
