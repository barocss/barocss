# D1084 — refuse a source radius that collapses the unlocked Round

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Use the same finite-contact inequality for a source radius change when only that radius is locked. Verify the prior pinned branch and require a radius-only candidate. Reject a source diameter that cannot span the fixed carrier height. Leave the fillet free when the edit is feasible.

- **FAIL** Parent desktop Studio applies source R9 with the fillet unlocked and shows no error at input. The replay stops at this first incorrect result.
- **PASS** Desktop WebGPU refuses source R9 and R10 at input. Both refusals preserve the document, visible history, dirty state, outline inputs and lock states. R16 applies and keeps the fillet unlocked at approximately 2.576380 mm. Finish retains the fixed endpoint, three tangent constraints, five side IDs and both named cylinders. Strict B-rep and the independent planar calculation agree with the 10 mm extrusion volume within 1e-7 mm³. Document Undo and Redo and project Save and fresh Open pass.
- **PASS** Sol High checked the analytic bound and candidate scope. Model 65/65 and Studio 9/9 focused tests, two type checks, scoped lint, driver syntax, diff checks and visual review pass. Model checks cover both traversals, the panel and canvas paths, and source R10.00000001 at the numerical margin.
- **NOT_RUN** Desktop canvas radius edits and draft Undo immediately after refusal, oblique and broader Round profiles, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
