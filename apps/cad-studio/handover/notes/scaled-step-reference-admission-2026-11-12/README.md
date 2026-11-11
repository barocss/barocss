# D724 — Count STEP reference solids before scaling

P0, rows 13 and 16. FEATURE qualification for Add reference. Parent `0c79431ded33fcb1e966184c4619ad54ee04741e`. [#2412](https://github.com/barocss/barocss/issues/2412).

The parent successfully evaluated a single-solid inch reference, then sent a split import with two scale nodes to count the solids. The actual worker rejected the second scale target with `target: ref1/1 is not a part`. For more than two solids, that provisional count also left some bodies without a scale node in the probe.

The Model adapter validates the length declaration, evaluates a split import at raw coordinates and counts the returned bodies. It then evaluates the reference with one scale operation per actual solid. The stored reference keeps the source STEP and the confirmed count for files with multiple solids. The same reconstruction path supplies the references when opening a saved project. The Model and CAD public signatures and native format stay compatible.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 4 recorded states and 673 frozen inputs through cleanup. A single inch solid and three separated foot solids appeared as locked references with 6 and 18 faces, while the host part retained its original body. The actual worker's first reply reported 1 and 3 unscaled bodies. The next replies supplied exactly 1 and 3 scaled bodies. The inch reference retained an authored placement at Z = 17 mm. Undo and Redo restored the corresponding reference sets.
- **PASS** — Independent box arithmetic checked the scaled worker mesh bounds, centroids and volumes. The inch body volume was 393,289.536 mm³. The foot volumes were 679,604,318.208, 339,802,159.104 and 226,534,772.736 mm³ in increasing X order. Tolerance per value was the greater of `1e-9` in its units and `1e-11` relative. Save to a browser project and fresh Open retained both byte-for-byte sources, placement, body count and the same physical geometry. The native SHA-256 was `c7c2aa911306e3576f4a049dd96cd3f4d903119f3d05325cdb80bd1609121f20`.
- **PASS** — D723 desktop replay at 10 states. Unsupported conversion declarations still refuse analytic and mesh-only Open and Add reference before any worker geometry request. Model 41/41 and Studio 67/67 focused tests. Both type-checks, affected lint, driver syntax, diff check and Studio production build passed.
- **FAIL** — The clean parent rejected a valid inch reference in the actual worker's second read, after the first read had accepted one solid. The fixture did not modify the host document on that refusal.
- **NOT_RUN** — Full package and kernel suites, mobile, third-party reader, general unit conversion expressions, per-representation scale mapping and external files.

The fixture SHA-256 values were `959bf16f84daa9973d08c2366896bb85aad80b214ff72c0d5b5973e14a20ec86` for INCH and `6f59a101249c4a5d1e1973f17babedfe69d5f7b10c5a6dde35c92690cf1709bb` for FOOT. Evidence files remain outside Git.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D724_SOURCE_FROZEN=1 node apps/cad-studio/test/step-scaled-reference-browser.mjs "$EVIDENCE/studio"
D723_SOURCE_FROZEN=1 node apps/cad-studio/test/step-conversion-unit-browser.mjs "$EVIDENCE/d723-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test step-reference-units reference-bodies step-units step-offset-units api-step-report
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test imported-file-ownership mesh-import-ownership project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/chat/references.ts
node --check apps/cad-studio/test/step-scaled-reference-browser.mjs
node --check apps/cad-studio/test/step-length-fixture.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D725 checks whether translation or unrelated geometry causes a DXF endpoint gap to be accepted. [#2403](https://github.com/barocss/barocss/issues/2403). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
