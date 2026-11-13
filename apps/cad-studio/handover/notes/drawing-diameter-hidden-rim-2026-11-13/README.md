# D1030 — honor Hidden lines in Drawing Diameter selection

2026-11-13 · SMALL · P0 rows 10, 12 and 20 · [#2449](https://github.com/barocss/barocss/issues/2449)

Standard-view Diameter hover and picking share the eligible rim pieces. When hidden lines are off, a circle needs a visible piece to be a candidate. A visible rim or a displayed dashed rim takes precedence over centre snapping.

- **FAIL** In the baseline Top view, turning Hidden lines off removed the lower rim from the sheet but clicking [26, 20] still previewed and authored a diameter on `p1`.
- **PASS** In desktop Studio, [26, 20] has no rim highlight, preview or dimension with Hidden lines off. With Hidden lines on it highlights the dashed rim and authors a diameter on `p1`. The upper rim at [40, 20] highlights and authors on `p2` with either setting. Undo restores the source document after each authored control.
- **PASS** Visual inspection, 85 Model tests, 17 Studio tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Fully coincident rim choice, explicit reattachment, pre-export loss warnings, Redo row deletion, other view and annotation tools in desktop Studio, full suites, production build and mobile.

#2449 remains open. Desktop QA is 10/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
