# D1092 — reopen the authored Slot with coupled dimensions

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Keep an authored Slot definition on the main loop. Restore its controls only when finite literal data reproduces all four ordered native segments exactly. Existing files without the authoring field and parameter-bound or mismatched loops use the ordinary outline. The optional editor field does not enter native part export or parameter resolution.

- **FAIL** Parent Studio Save and fresh Open preserve the solid but replace the Slot Length, Width and Angle controls with generic outline inputs.
- **PASS** Desktop WebGPU restores 45 mm, 14 mm and 30°. Editing Width to 16 mm changes both native end radii from 7 to 8 mm. The side IDs, named cylinders and 3 mm Extrude persist. Document Undo and Redo restore exact documents. Strict B-rep and the analytic capsule volume agree at 2763.183994933828 mm³.
- **PASS** Sol High checked legacy and arbitrary loops, exact mismatch, bound values, mixed profiles, strict native geometry, part export and DXF in Model probes. Model tests check main Slot identity, no-op reconstruction, companion region and false parameter-loss reporting from an invalid hint. Model 56/56, Studio 31/31, two type checks, scoped lint, driver syntax, diff and visual review pass.
- **NOT_RUN** Desktop editing of Slot regions and holes, desktop malformed hint path, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
