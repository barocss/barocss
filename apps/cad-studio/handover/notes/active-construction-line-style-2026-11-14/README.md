# D1107 — show active construction lines as open references

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Use the existing construction stroke for the active open chain and show its reference status once the point is placed. Preserve the pending arc placement prompt.

- **FAIL** The XY parent renders the active construction line with a solid stroke and reports an open material profile. An earlier observer waited for a nonzero SVG bounding box on a horizontal polyline. The corrected observer checks attachment and computed stroke.
- **PASS** Desktop Studio renders the active open reference with a dashed stroke and no close-profile warning. The construction line stays open through Finish and fresh native Open on XY and a 30° tilted plane. An 8 mm Extrude creates one body from the 20 × 10 mm material rectangle with 1600 mm³ volume. Undo/Redo restores the exact documents.
- **PASS** The D748 material open-chain refusal, eight focused tests, Studio type check, scoped lint, driver syntax, diff and visual review pass.
- **NOT_RUN** Selected-vertex plane replay, other construction tools and themes, full suites and production build.

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
