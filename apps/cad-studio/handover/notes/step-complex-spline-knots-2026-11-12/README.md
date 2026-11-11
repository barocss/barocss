# D722 — Diagnose STEP complex spline knot forms

P0, rows 13 and 16. FEATURE qualification for STEP import and desktop Studio. Parent `6f9c88293d53fa8a21cbad3c0138c4d44e094f0c`. [#2423](https://github.com/barocss/barocss/issues/2423).

The parent threw a JavaScript property-access error when a reached ordinary edge referenced complex curve `#50` with a `QUASI_UNIFORM_CURVE` knot form. The direct reader produced TypeError, the part evaluator produced GEOMETRY, and the real Studio worker exposed an unexpected kernel failure.

The shared curve and surface reader checks the knot-form components before reading their arguments. A recognized implicit form produces a named unsupported refusal. Missing or conflicting knot forms, duplicate spline components and invalid implicit attributes produce typed input refusals. The entity number is included when present in the current DATA map. Existing explicit-knot parsing, the public signature, document schema and geometry tolerances stay unchanged. The valid implicit fixtures pair the knot subtype with the rational subtype and use ordered external mapping. [Part 21 entity mapping](https://www.steptools.com/stds/step/IS_final_p21e3.html#clause-12-2-5-1) · [STEP geometry schema](https://steptools.com/stds/smrl/data/resources/geometry_schema/geometry_schema.htm).

## Qualification

- **PASS** — Independently walked the Part 21 reference graph from a manifold solid to the reached curve, face surface and shared sweep basis. Complex Bézier, quasi-uniform and uniform curves and surfaces give direct `BrepError INPUT` and part-level `CAPABILITY` with the import feature ID. Missing, duplicate, contradictory and malformed forms give `INPUT` at both boundaries. Simple unsupported forms retain their named refusals. An unused malformed record does not block a supported solid.
- **PASS** — Strict native analytic, polynomial explicit-knot and rational explicit-knot controls. The 10 × 8 × 5 mm box retained volume 400 mm³ and centroid `[5,4,2.5] mm` within `1e-7 mm³` and `1e-10 mm`. The curve retained degree 1, domain `[-2,6]` and rational weights `[1,3]`. The top surface retained degrees `[1,1]`, domains `[2,6] × [-3,1]` and weights `[[1,2],[3,6]]`. Independent Bernstein evaluation gave rational midpoint `[7.5,0,0] mm` on the edge and `[7.5,16/3,5] mm` on the face. Names, face sense and unit context were retained. The linear-extrusion and revolution controls kept their independent volumes `1400/3` and `666π/5 mm³`. Sol High independently checked fixture conformance and geometry.
- **PASS** — Desktop Chrome WebGPU, 5 states and 671 frozen inputs through cleanup. Actual STEP read reply 6 reported unsupported curve `#50`; reply 8 reported the missing knot form of surface `#119`. Both refusals retained the accepted analytic cylinder, its body selection, history, Undo/Redo and dirty state. A later 400 mm³ rational STEP opened and supported a body rename, Undo and Redo. No downloads, page errors or console errors.
- **PASS** — CAD 16/16 focused tests including the existing STEP suite, Model 23/23 and Studio 49/49 focused checks, all three type-checks, affected lint, driver syntax, Studio production build and diff checks.
- **FAIL** — The parent mislabeled unsupported implicit spline forms as unexpected kernel failure. The first fixed browser driver assumed STEP Open left a clean document. The passing run compares the actual pre-refusal dirty state.
- **NOT_RUN** — Full package and kernel suites, mobile, native implementations of implicit knots, broader malformed STEP validation and new geometry support.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
node packages/barocss-cad/scripts/tool.mjs build:fast
node --test --test-concurrency=1 packages/barocss-cad/test/step-spline-knots.test.mjs packages/barocss-cad/test/step.test.mjs
D722_SOURCE_FROZEN=1 node apps/cad-studio/test/step-spline-knots-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test api-step-report step-units
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-open-ownership step-export
pnpm --dir packages/barocss-cad type-check
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad/src/io/step-import.ts
node --check apps/cad-studio/test/step-spline-knots-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D723 reproduces unsupported conversion-based STEP length units and verifies refusal before the coordinate scale is chosen. [#2412](https://github.com/barocss/barocss/issues/2412). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
