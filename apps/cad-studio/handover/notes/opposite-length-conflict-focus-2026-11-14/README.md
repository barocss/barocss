# D1089 — focus a proven opposite-edge length conflict

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

After a refused viewport length edit on a four-edge H/V outline, use the existing rectilinear proof to check the attempted and opposite lengths. The full Model solve must also classify the edit as a proven conflict. The action belongs to the current document and exact outline. It changes the filters to Length with Picked only off and focuses the existing row.

- **FAIL** Parent Studio reports the 42 mm contradiction without a way to locate the existing opposite 40 mm length.
- **PASS** At 1024 × 800, Studio refuses the edit and preserves the accepted document. Enter on the conflict action exposes and focuses the opposite Length row. The viewport inspection identifies only edge 3. Tab and Enter remove that constraint. Retrying 42 mm succeeds. The named sides and 2 mm Extrude remain exact. The native check agrees with the 1,680 mm³ plate volume within 1e-7 mm³. Document Undo and Redo pass.
- **PASS** Sol High reviewed the exact subset proof and identified a range refusal that now has no action. Focused checks cover that refusal, a different proof with no attributable opposite row, the near-equality tolerance, missing axis locks and curved outlines. Studio type check, 33 tests, scoped lint, driver syntax, diff and visual review pass.
- **FAIL** Full App.tsx lint reports one inherited unused kFactor binding. The immutable parent file reports the same failure. Lint passed for the other affected files.
- **NOT_RUN** Circle and multi-rule attribution, other widths and work planes, fresh Save and Open, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
