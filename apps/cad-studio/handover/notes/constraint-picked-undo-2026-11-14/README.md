# D1087 — keep stable edge picks during outline Undo and Redo

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Keep the current edge selection through an outline history step when both settled shapes have the same ordered, unique side IDs and segment kinds. Drop picks that no longer have a proven edge identity. Full draft restores keep their existing selection policy.

- **FAIL** Parent desktop Studio restores the removed Length constraint on Undo but shows zero matching rows because the picked edge is cleared.
- **PASS** At 1024 × 800, the selected edge stays current through keyboard removal, Undo and Redo. The filtered list reports 1/8 → 0/7 → 1/8 → 0/7 without a canvas reselection. Focusing the restored row highlights only edge 3. The document, committed history and 1,600 mm³ body remain exact. Cancel returns to the original document.
- **PASS** Eleven focused tests, Studio type check, scoped lint, driver syntax, diff and visual review. Negative tests drop an invalid index and clear picks across missing IDs, reordered IDs and a changed segment kind.
- **NOT_RUN** Other widths, point and circle selection retention, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
