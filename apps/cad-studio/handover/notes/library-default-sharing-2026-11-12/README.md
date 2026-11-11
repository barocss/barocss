# D726 — Validate default library configurations before sharing

P0, rows 12 and 16. FEATURE qualification for the shared Model checker, Studio Library panel and loopback team endpoint. Parent `9a824ed3856a8cd05834c22a36d3a761b7b741a1`. [#2417](https://github.com/barocss/barocss/issues/2417).

The default spacer height was 0 mm with a declared minimum of 1 mm. The ordinary no-option instantiation returned `PARAMETER`. Its h8 and h12 variants both built. The parent Library panel shared it through the real server, which returned HTTP 200, wrote both team files and recorded `ok: true, built: 2`.

The checker now evaluates the default configuration once and every named variant once, using the existing instantiation, part evaluator and output validity check. `built` counts each configuration with all declared outputs valid. The default and a named variant count separately when their values are equal. Problems identify the part and whether the configuration is the default or a specific named variant. Both client and server use the same checker. Explicit Studio picker selection, optional variant resolution, licensing and agent confirmation retain their existing behavior.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 5 states and 999 frozen inputs through cleanup. A valid library shared through the normal Vite proxy to the real local server, which recorded three builds. The invalid default displayed `Not shared` and made no POST. A direct authorized loopback request received HTTP 422, reported `spacer (default)` and counted the two successful named variants. Both previously accepted team files stayed byte-for-byte equal. Focused server tests also verify refusal to create a new invalid library.
- **PASS** — The Studio picker still selected h8 by default. Insert from the private library produced the requested 48 mm³ solid. Explicit h12 Place from the accepted team library produced a 2 × 3 × 12 mm, 72 mm³ part, verified by actual instance bounds and the independently computed box volume. The first Undo and Redo restored each state. Browser-project Save and fresh Open retained the stored features and origins. Native SHA-256 `27681b29ef7f48ef0c9c9e964630c148502040ab199518f24fd82a251ec31584`.
- **PASS** — The configuration matrix covers omitted, empty, one and two named variants, a named variant called `default`, default bounds, derived expression, feasible rule, geometry failure, named-only failure and multi-part aggregation. Existing estimate and unknown-context warnings are preserved. The built-in T-slot control had six valid configurations and four fits. A refused variant-omitted Model insertion preserved its document. Named variants and existing explicit regeneration passed. Model 10/10 and Studio 39/39 focused checks, both type-checks, affected lint, syntax, diff check and Studio production build passed.
- **FAIL** — The clean parent gave the invalid default a positive team check. The first fixed harness started on the demo document and expected the inserted library feature at index zero. The final harness starts a new part.
- **NOT_RUN** — Full package and kernel suites, mobile, external team storage, paid provider calls and unbounded parameter combinations.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D726_SOURCE_FROZEN=1 node apps/cad-studio/test/library-default-sharing-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test library
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test library-tools project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/library/sharing.ts
node --check apps/cad-studio/test/library-default-sharing-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D727 measures STEP analytic cavity shell orientation with independent input and output. [#2433](https://github.com/barocss/barocss/issues/2433). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
