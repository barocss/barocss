# D1086 — retain keyboard focus after removing a sketch constraint

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Move keyboard focus to the existing Kind filter before removing the focused button. Tab then reaches Picked only. Pointer activation keeps its existing path.

- **FAIL** Parent desktop Studio sends focus to the document body when Enter removes the only filtered row.
- **PASS** At 1024 × 800, Tab from the row reaches Remove. Enter removes only the selected Length constraint and focuses Kind. Tab reaches Picked only and Space toggles it. The same draft Undo and Redo restore and remove the row with Picked only off. The document, committed history and 1,600 mm³ body remain exact. Cancel keeps the original document.
- **PASS** Four focused tests, Studio type check, scoped lint, driver syntax, diff and visual review.
- **NOT_RUN** Picked only selection across Undo, other widths, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
