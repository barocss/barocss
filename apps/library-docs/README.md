# BaroCSS library documentation portal

Private VitePress1.6.4 application under #1247/#1248. It preserves the existing CSS site and release pins. Source content snapshot: `5f5ad866205a21510ac69552e704cc162fa253b5`.

Use Node22+. After the workspace's normal dependency setup:

```sh
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
pnpm --filter @barocss/library-docs build
pnpm --filter @barocss/library-docs preview --host 127.0.0.1
node apps/library-docs/scripts/check-docs.mjs
node apps/library-docs/scripts/run-snippet.mjs
```

During continuous edits, use the `dev` command. Production `preview` records the built file list and headers when it starts. If you rebuild while preview remains running, the page can display static HTML while its new JavaScript files are unavailable. Example controls and Search then do not start. Stop the preview process before a build, and start a fresh preview after the build finishes. Verify that the selected example reports `data-ready="true"` before checking its buttons or links. A successful HTML navigation alone does not prove that the interactive page started.

The native checkpoint reuses actual `/Users/user/.barocss-ai/v3/integration/node_modules/vitepress`1.6.4 through an ignored app-local node_modules link. No dependency installation or root lock edit is part of this delta. Root workspace already covers apps/*. Integration alone adds the importer for `vitepress:^1.6.4`, using its existing1.6.4 resolution; root scripts need no change. Root esbuild^0.25.9 supplies the selected API probe (actual reused0.25.12).

The source material probe creates ignored app-local GPU/CAD dependency links and uses esbuild's ordinary node-module search path for the transitive CAD dependency. It compiles, validates and lowers a real material and checks unsupported syntax refusal. It does not draw pixels or verify all exports. Documentation build, source API execution, compiled package acceptance, local integration and registry/site publication are separate stages.

`evidence/package-inventory.json` preserves the historical 12-package manifest snapshot at the source/API pin above. Do not refresh or retag it to match a newer checkout. `evidence/current-package-inventory.json` separately records current manifest bytes, full metadata, the exact Git commit, the historical inventory checksum, and field-by-field changes from that source snapshot. `check:docs` verifies both provenance and all 12 current manifest hashes. A version, export-map, dependency or other manifest change still fails until deliberately reviewed and recorded. Render metadata is included without activating the held Render lane or claiming new API/runtime/publication acceptance.

```sh
node apps/library-docs/scripts/inventory.mjs --check
node --test apps/library-docs/scripts/inventory.test.mjs
# Only after reviewing the manifest changes at an immutable commit:
node apps/library-docs/scripts/inventory.mjs --write --commit <full-reviewed-commit>
```

The writer reads manifests from that Git commit and refuses differing working-tree bytes; it never overwrites historical evidence. The checker requires both recorded Git commits to be available locally. Review `changesFromSourceSnapshot` and the metadata reconciliation receipt before accepting an update. Native build/browser/snippet receipts retain their original scope. No deployment or Pages configuration is included.

## API guidance and internal evidence maintenance

The manual uses task API guides, language guides and runnable examples. Historical API/source-link evidence remains unchanged in `evidence/public-api.json` and `evidence/package-inventory.json`. Required current API checking uses the separate `evidence/current-public-api.json`; it never falls back to historical evidence or silently accepts drift. Existing `/packages/<slug>/reference` URLs provide onward navigation and are excluded from search. Root TypeScript 5.9.3 supplies extraction; no new dependency is required. Render uses its tracked `src/index.d.ts` as declaration provenance for a dist-default runtime, not a fabricated source entry.

```sh
node apps/library-docs/scripts/public-api.mjs --check
node --test apps/library-docs/scripts/public-api.test.mjs
node apps/library-docs/scripts/public-api.mjs --self-test
# After reviewing actual API changes, pin an immutable public source commit:
node apps/library-docs/scripts/public-api.mjs --write-current --commit <full-40-character-SHA>
# Historical comparison requires the exact historical package trees locally:
node apps/library-docs/scripts/public-api.mjs --check-historical
```

The current writer requires all nine tracked package trees to match that exact commit and every declaration/re-export source to exist there. It records that commit, the nine Git tree IDs, TypeScript version, historical evidence hash and complete added/removed/changed delta. Verify that the source commit is available publicly before publishing this evidence. The checker validates those provenance records against Git and compares the working tree's actual public API. A different implementation commit with the same public declarations can still match; additions, removals, signature changes, export-map/version changes and changed re-export groups fail. Missing current evidence, a wrong/stale source pin with mismatched recorded trees, altered historical bytes, incomplete package coverage or altered signature digests fail. Neither command edits package sources or installs dependencies.

Extraction follows actual re-exports with ignored app-local workspace links and ordinary TypeScript dependency search. Use the repository's frozen dependency installation: inferred declarations can depend on React types and compiler version. Private/protected members and bodies are excluded; public constructor parameter properties are included. This inventory is declaration evidence, not emitted artifact equivalence, a type-check, runtime acceptance or a backward-compatibility guarantee. Behavior/error/ownership changes can require manual page review even when signatures stay identical.

The current baseline at `1e9bb35c7095c8d1a414b67572a015c55ae17606` records 1,644 added, zero removed and 52 changed entries relative to the historical snapshot. The 52 include two manifest records, nine re-export groups and 41 symbol occurrences. Reviewed compatibility changes include wider CAD source/expression/model unions, Render document parsers and accepted values returning a V0/V1 union, and new required session/snapshot members. Exhaustive consumers and handmade implementations/mocks may require adaptation. Other differences are material-type factoring, inherited receipt/presenter interfaces, added Viewer methods, optional React callbacks and inferred `React.JSX.Element`/`JSX.Element` spelling. The current snapshot also includes the later optional `workspace?: boolean` modeling prop and matching component parameter from #1943. These are already-adopted source changes, not changes introduced by this evidence update.

Historical `--write` remains restricted to the old catalog pin and must not be used to retag newer source. `--check-historical` likewise requires those exact old package trees before extracting and comparing; running it on today's source fails. The old local-only pin must be available with all its original blobs to replay it. Missing old blobs are an explicit historical replay limitation, never grounds to skip the current check or rewrite the historical files. Module README drift is separately tracked in [#1260](https://github.com/barocss/barocss/issues/1260).

The source-link receipt confirms the fixed commit is local-only (actual GitHub422). Local repository paths are provenance text; reader-facing declaration dumps are not generated. `node apps/library-docs/scripts/source-links.mjs --check` rejects unavailable fixed-SHA GitHub links; `--write` converts unavailable exact source links to local provenance text. Never substitute moving main/develop or push product code to make a provenance URL work. Recheck the exact remote commit before marking its availability receipt true.

## Runnable visual examples and languages

The site guide `/concepts/run-examples` gives repository setup, exact saved CPU commands, expected results, source-pin behavior and the distinction between Node consumers and browser hosts.

Open `/playground` from the portal navigation. It contains editable GPU source1, CAD source0 Curve/Surface and opaque mesh-material inputs. These use real source APIs and admitted WebGL2 renderers. The Curve plot uses CAD evaluation plus a host 2D canvas drawing; it is not BaroCSS renderer evidence. Source/input/result screenshots are stored in docs/public/examples and embedded in the task pages. CAD source0/1/2 and GPU scene/material language pages describe exact grammar and refusal rules.

The gallery adds CAD source1 Extrude/source2 parameter views, a six-primitive source1 scene and eleven independently selectable material function programs. Data-only preset JSON lives in `scripts/snippets/presets`. The builder composes these literals with the standalone public-import runtime before source-pin bundling; no relative preset import is remapped during snapshot fallback. Run `node apps/library-docs/scripts/check-gallery.mjs` from the repository root for the selected CPU compiler/geometry/lowering and refusal checks. This check draws no pixels. Actual new browser images and edit/refusal observations have separate receipts.

Two host modules under `scripts/snippets/hosts` add native Viewer and manually stepped Physics samples. The composer keeps each factory in its own closure and preserves literal public package imports in the standalone entry. The Physics diagram projects actual CPU state on a host 2D canvas; no physics renderer or timer is inferred. `node apps/library-docs/scripts/check-host-physics.mjs` checks the selected public-source step1/20 and invalid-step state retention without drawing. The actual browser host samples have their own receipts; previous standalone recipes remain separately labeled.

`pnpm dev` and `pnpm build` generate an ignored app-local ESM bundle before VitePress. Generation uses existing esbuild and ordinary public package imports, checks the fixed package source pin and refuses package dist or foreign package source inputs. If later workspace manifest/src trees differ, it materializes exact pinned Git blobs into an ignored app-local cache, then resolves their normal public export maps. Cache blobs are rechecked; no moving-main substitution or package source mutation. Snapshot fallback consumers must be standalone and use literal bare imports; consumer-relative imports are refused rather than silently remapped. No generated package artifacts or dependency install is required. To run a saved CPU task:

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/cad-example.ts
```

The runner accepts a source-capable consumer file; it executes that file. Browser-only APIs require a real browser host. Render remains dist-default and is not remapped to source by this runner. Source probe, browser pixels, emitted acceptance, integration and publication retain separate receipts.

## Separate CAD1301 Body profile

`node apps/library-docs/scripts/run-cad-body-1301.mjs [--input <complete-request.json>]` runs a versioned compiled-public Body API from provider `ded1ef68`/native `51821d21`. Its complete original input is bundled under `samples/cad-1301`; the app-private runtime container preserves179JS/179declarations, the original manifest and MIT license. The loader verifies hashes and materializes the actual publishConfig public root in an isolated ignored cache. No install, donor/source rebuild, alias or workspace module-link replacement is needed. This cache package is not a registry publication.

The guide `/packages/cad/body-1301` explains complete parents, IDs, units, ownership/refusals, exact volume and restricted material proof. The old5f inventory/reference/runner/livegallery remain unchanged. CLI bytes/input preservation and selected public builder/validator execution have separate evidence; currentRoot/emitted/registry/renderer/generalSolid/manufacturing acceptance is not inferred. The runtime container is documentation infrastructure, not a CAD file codec.


## Native coordinates, display pose and adaptive points

`/examples/library#viewer-display-pose` and `/packages/viewer/display-pose` teach public Viewer pose, native measurement, projection and selection with a complete Source0 panel. The fixed5f5ad866 profile verifies281 manifest/src blobs. Actual WebGL2 output and the application's rounded coordinate readout are separate. The selected browser refusal flow compares copied public state and every actual frame byte while the accepted Viewer remains live. Application dispose/listener counts do not establish native GPU deletion.

`/examples/library#cad-adaptive-sampling` and `/packages/cad/adaptive-curve-sampling` teach the fixed73342803 public adaptive sampler with a complete mixed Model, original XYZ and a non-unit knot domain. This separate204blob profile changes no older source profile. Browser sampling runs in an application-owned Worker; the main thread stages its own 2D canvas drawing. Structured clone retains numeric negative zero. Worker errors relay provider name/code/message rather than pretending to be provider instances in the main realm. Generation checks reject superseded candidates; disposal terminates the Worker and revokes its Blob URL.

The screen reports the complete sampling report and actual selected native records. Full span/subdivision audit data remains in the accepted value and the CPU receipt. Neither the projected polyline nor the UI summary substitutes for the complete public result. The criterion remains qualified binary64 work, with no certified global error, manufacturing tolerance or topology claim. First synchronous browser deadlines remain in evidence; Worker interaction checks are separate observations. These examples belong to library/API tasks, alongside separate language exercises and integrated workflows.


## Typed Scene generation and application diagnostic boxes

`/examples/language#generated-scene` and `/packages/gpu/generated-scene` teach the separate fixed4dcb0ebb Source2 mixed-generation profile. The builder verifies294 GPU/CAD manifest/src blobs and uses normal public imports with no package dist. Existing Source0/1 renderers and previous source profiles keep their stated admission. The new compiler returns complete original source/AST, typed values, generation records, all conditional decisions, selected Scene2 and derived shader text.

The interactive host changes original public AST literal/count token ranges and compiles the complete candidate before adoption. Strict equality excludes the marker. A third stud gets a stable generated ID and the common style's position; repetition does not auto-place it. False candidates retain their ID reservation and full semantic checks.

No public generated-Scene2 renderer or direct mesh bridge is admitted at this pin. The application draws transformed local diagnostic boxes around actual resolved box/sphere coefficients. It uses scale, X/Y/Z rotations, translation and a fixed oblique projection. Sphere boxes are guides, not rendered spheres. The public bounds preparer is not called; derived shaders remain text. Application clipping and unsupported diagram shapes are separate from public compiler admission. CPU source/control/refusal observations, actual diagnostic bitmap, local integration and graphics acceptance keep separate receipts.

## Material compilation bench

The GPU material-language guide now includes a separate CPU-only concept widget at the existing 5f5ad866 source pin. It does not add a catalog preset or change the existing 45 entries / 14 catalog modules. Build its generated module with `node scripts/build-material-bench.mjs`; run its one focused public-API flow with `node scripts/check-material-bench.mjs` (Node22). VitePress configuration builds the module for dev/build.

Evidence: `evidence/material-bench-consumer.json`, `evidence/material-bench-browser.json`, and `evidence/material-bench-checkpoint.md`. Cloud source/CPU/build checks are separate from the still-UNRUN genuine guide, keyboard, reduced-motion and screenshot acceptance. No renderer, GLSL execution or GPU proof is claimed.
