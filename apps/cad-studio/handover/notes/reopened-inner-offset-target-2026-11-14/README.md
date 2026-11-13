# D1102 — verify the reopened inner outline owns the next Offset

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Exercise the existing Active outline control from D1096 together with the D1099 nested Offset refusal. The tested route requires no product change.

- **PASS** After actual project Save and fresh native Open, select Outline 2 and confirm the R1 fields. In 1.5 mm refuses because it exceeds the inner arc radius. Select Outline 1 and confirm the R2 fields. The same In 1.5 mm refuses because its candidate would create a shape inside the existing hole. Each refusal preserves its selected outline, geometry, document, dirty state and history. No-op Finish retains the exact ring document.
- **PASS** Strict native B-rep, original side IDs and cylinder axes pass before and after Open. The independent rounded-rectangle formula agrees with 534.247779607693 mm³. Desktop Studio, driver syntax, diff and visual review pass.
- **FAIL** The first browser observer reused a locator from a closed page after Open. The completed run reacquires it in the fresh context.
- **NOT_RUN** Canvas activation of the hole from an edge, additional viewport sizes or outlines, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
