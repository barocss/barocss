# D771 — Verify same-ID native Viewer source replacement

P4 B10-02, rows 05 and 32. SMALL qualification. Parent `977458a3a06b13cbfff1ff690c65d7c850d561d6`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md).

- **PASS** — Public Viewer `loadDocument` replaces document and asset revision 1 with 2 at the same body and surface IDs. The accepted document, binding, source bytes and native width match the current revision. Surface `replacement_asset/panel` grows from 20 to 40 mm. The prior selection clears when the replacement loads.
- **PASS** — At the same 320 × 240 camera, pixel (205, 120) changes from background to surface and then to the selection color. Its pick changes from null to the same logical surface at x = 15.533008589 mm. Two independent Python checks cover exact bounds, native width and the camera-ray intersection, with absolute ray tolerance 1e-7 mm. The capture uses public RGBA readback.
- **PASS** — Desktop Studio imports the same authored source bytes into two empty parts. Public pointer selection finds the current surface in both. The independent point at x = 15 mm misses revision 1 and hits revision 2. Reviewed the Viewer readback and Studio surface screenshots. Four Viewer frames, two Studio states, 853 frozen files and zero page errors, console errors or downloads.
- **PASS** — Viewer 33/33 and Studio 10/10 focused checks, Model type check, driver syntax and diff check.
- **FAIL, first driver only** — The first run imported into the default bracket. Studio appends the direct surface to the active part and the bracket occluded the centre pick. Both Viewer checks passed. The replay starts an empty Studio part for each source and clears the import selection before the pointer click.
- **NOT_RUN** — Other native geometries, emitted consumer bundles, full suites, builds and mobile. No product source changed.

```sh
D771_SOURCE_FROZEN=1 node apps/cad-studio/test/viewer-current-source-browser.mjs "$EVIDENCE/studio-viewer-replay"
pnpm --dir packages/barocss-viewer exec node --test tests/review-state.test.mjs tests/clipping-contract.test.mjs
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test direct-curve-candidate.test sew-preview-direct.test
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/viewer-current-source-browser.mjs
git diff --check
```

B10 is pending at 2/7 current groups. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. D772 checks current Studio section clipping and pick ownership.
