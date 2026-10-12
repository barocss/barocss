# Current manifest metadata reconciliation — Manual #1247

Before-code scope was frozen to these six app-local paths: `scripts/inventory.mjs`, `scripts/check-docs.mjs`, `scripts/inventory.test.mjs`, `evidence/current-package-inventory.json`, this receipt, and `README.md`. Parent explicitly selected metadata-only reconciliation including the held Render manifest. Base: `23e6615a8e2c4ad9c9299184a6be5ff2735358b5`; isolated branch `cloud/1247-manifest-inventory`.

## Historical evidence and current metadata are separate

The original `evidence/package-inventory.json` remains byte-for-byte unchanged at `5f5ad866205a21510ac69552e704cc162fa253b5`, as do API evidence/extractor, profiles, runtime/example pins and prior receipts. The new inventory records the current base commit, historical inventory checksum, exact full current manifest metadata, SHA-256 of each raw Git manifest, and complete before/after values for changed fields. It is not generated from unlabelled working-tree bytes.

Reviewed differences from the original source snapshot:

- Kit, Browser, Server and Render versions: `0.12.0` → `0.12.2`; no other manifest fields changed in these four packages
- CAD Interop: 21 additional development export entries and matching publication-map entries; no removed or changed existing entries. Full names and before/after maps are recorded in the new inventory
- Render Editor: added `@barocss/cad-interop` and `@barocss/viewer` dependencies, both `workspace:*`
- GPU, CAD, Canvas2D, Viewer, Physics and CAD Editor manifests unchanged

This records current metadata, not validation or documentation of the added APIs, emitted output equivalence, registry publication or Render-lane reactivation. Existing source/API consumers still use their own historical pins. No provider/package/API/type-generation/dependency/lock/runtime change is included. Parent #1247 remains open.

## Guard and reproducible checks

`inventory.mjs --check` is read-only and is now the default. Writing requires `--write --commit <full-reviewed-commit>`, verifies working manifest bytes equal that commit and only writes the new current inventory. Both recorded Git commits must be locally available. The full docs checker reconstructs provenance from those commits and verifies all 12 current raw manifest hashes, so editing a hash alone, omitting a package or changing a historical record cannot bypass drift detection.

Checks on the final app-local delta, using Node v24.19.0 and existing VitePress 1.6.4 dependencies:

- `node --test apps/library-docs/scripts/inventory.test.mjs`: 12 tests pass. Positive current checkout and exact reviewed field inventory; negative version, held Render version, development exports, publication exports, dependencies, blind hash refresh, historical pin/metadata rewrite, missing package and non-immutable commit cases. Mutations use temporary copies; actual package manifests are not modified
- `node apps/library-docs/scripts/inventory.mjs --check`: all 12 current manifests match the new current commit; historical source remains 5f5ad866
- App build's exact commands, from `apps/library-docs`: `node scripts/build-examples.mjs && node node_modules/vitepress/bin/vitepress.js build docs`: pass, existing large-chunk advisory only
- `node apps/library-docs/scripts/check-docs.mjs`: pass, 111 pages, 709 internal links, 57 image assets, 3 downloads, 45 catalog anchors/presets, 14 generated modules and 12 manifest hashes. Reports historical source commit and current manifest commit separately
- `node --check` on the three affected scripts; `git diff --check`: pass
- Git diff confirms historical inventory/API evidence/extractor/profiles unchanged; no package/root/lock modifications

First build invocation through `pnpm --filter @barocss/library-docs build` hit the environment's pnpm automatic dependency setup and failed before build because the environment's pnpm data directory was unavailable. No new installation was performed. The exact script commands above succeeded using existing ignored dependency links. No remaining docs-checker error was observed. Browser/runtime execution, unrelated aggregate suites, publication and root serial adoption are outside this metadata-only verification.

Independent review requested a durable successful-build log because the original successful tool output had not been saved to a file. The exact build commands above were rerun successfully (VitePress reported 20.48s); the retained successful log SHA-256 is `7703d643d417524fe25c76136924c5169708ba035af2b66707c0f210d2fb7c47`. The original pnpm failure log remains unmodified. The subsequent docs checker and all 12 inventory tests also passed. This receipt-only privacy correction replaces an absolute environment path with a generic description; implementation remains the tested local commit `32e942457a7dddea57bc35755e5af69eeb982d33`.
