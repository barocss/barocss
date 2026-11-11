# D712 — Require a native bore wall for hole-diameter checks

P0 B09, row 16. FULL qualification for the changed geometry decision and the kernel entry point that Model uses. Parent `96bb2919f9ab247f9c02473127a8128f073321e7`. [#2429](https://github.com/barocss/barocss/issues/2429).

## Reproduction and decision

On the parent, the external `cad-mcp.mjs --doc` server returned two passes and one numeric failure for each of a native Ø8 through bore, a native Ø8 external cylinder and a native sphere with radius 4 mm. The generic radius of 4 mm was valid on all three faces. The exterior and sphere incorrectly passed the Ø8 hole requirement and reported an apparent 8 mm measurement against the Ø10 requirement.

Resolve one current face and preserve the selector's body scope. Refuse missing and ambiguous faces. Read the unrounded diameter only from the native group behind that face. Each member must be an inward analytic cylinder on one axis in the closed outer shell of one solid. Native coedges must form two complete circular rims at different axial positions. The rims must have opposite winding. This excludes an inward open-sided channel. Radius remains a separate measurement with its previous supported surfaces. D648 still converts the raw diameter into the authored inch unit for evidence after the comparison. The check makes no claim about through depth, hole count, or relations between different holes.

The first correction refused ordinary bores because a derivative sample landed on a repeated interior knot. Sampling inside a nonzero knot span resolved that failure. The first Studio driver run also failed because its fixture label was still JSON-encoded. The next run decoded the label and verified each named fixture.

## Qualification

- **PASS** — Desktop Chrome WebGPU opened seven native documents with 14 before/after states. The existing grouped `requirements.check` and `requirements.evidence` returned the same results through Studio Chat and the external MCP server. The scripted local Chat client sent 18 tool calls. The selected bore passed Ø8 and failed Ø10 with measured 8 mm and delta −2 mm. The same-radius exterior cylinder, sphere, and open-sided channel returned UNKNOWN while the radius controls passed. Rotation, translation, native reopen, suppression, removal, wrong body, and occurrence scope passed. The Requirements panel showed the pass, failure, and unknown reasons. Document, bodies, selection, history, and input bytes stayed exact on each read. All 984 frozen inputs matched through cleanup. No page or console errors or downloads.
- **PASS** — Seven independent Python oracles used authored dimensions, closed-form volume, finite differences on the native surfaces, and material probes 0.25 mm to each side. Maximum allowed volume error was `1e-8 mm³`. Radius and oriented cosine tolerances were `1e-8` in mm and dimensionless units respectively. The bore and shaft measured 748.6725877128164 and 251.32741228718345 mm³. The sphere measured 268.082573106329 mm³ and the channel 874.3362938564089 mm³. The solver's bore predicate and display normals were not inputs to the oracle.
- **PASS** — Model 56/56 and Studio 19/19 scoped tests. The Model cases also cover a blind bore, D648 inch tolerance, duplicate names, an exact open cylindrical sheet, a faceted import, a cone and a torus. CAD, Model and Studio TypeScript, CAD code shape, affected lint, Studio production build and driver syntax passed. Affected lint retains two existing `no-explicit-any` test warnings.
- **FAIL** — The parent falsely passed the external cylinder and sphere for Ø8. The correction and test-driver failures above were reproduced and corrected before the final passing run.
- **NOT_RUN** — Full repository and kernel suites, mobile, live AI provider, and unqualified bore representations such as oblique or interrupted rims. Those representations can return UNKNOWN.

Run from the repository root with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate.

```sh
D712_SOURCE_FROZEN=1 node apps/cad-studio/test/hole-requirement-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test spec requirement-evidence task-execution task-plan
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test toolset-mcp task-plan-agent approved-requirement-compare
pnpm --dir packages/barocss-cad type-check
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
node packages/barocss-cad/scripts/code-shape.mjs --check
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
```

Next D713 checks whether a perspective selection box adds bodies behind the camera in actual Studio. [#2431](https://github.com/barocss/barocss/issues/2431). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
