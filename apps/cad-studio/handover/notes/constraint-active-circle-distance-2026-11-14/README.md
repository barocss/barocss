# D1088 — show the active circle distance under Picked only

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Match the current circle-pair dimension key to its existing constraint row. The exact kind filter still applies. Display the current row while its editor is open. Do not reintroduce consumed geometry picks into the dimension tool.

- **FAIL** On parent desktop Studio, selecting the second circle opens the 26 mm input but the active Distance row disappears under Picked only.
- **PASS** At 1280 × 800, the selected first circle shows both related rows. Selecting the second circle leaves only the active circle-pair row visible. Hovering it highlights exactly the two circles. Editing 26 to 28 mm and closing the editor removes the temporary match. Finish retains the separate edge-to-circle distance, named sides and 5 mm Extrude. Document Undo and Redo pass. The native check and the independent plate volume agree within 1e-7 mm³.
- **PASS** Studio type check, 29 focused tests, scoped lint, driver syntax, diff checks and visual review.
- **NOT_RUN** Other widths and working planes, desktop horizontal and vertical circle-pair editing, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
