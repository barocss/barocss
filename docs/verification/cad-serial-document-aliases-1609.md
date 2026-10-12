# Explicit serial-part v2 concise API verification (#1609)

Date: 2026-10-12 UTC. Scope: six additive direct aliases, focused tests and documentation.

## Candidate and unchanged contracts

- Engine baseline: `2d2a31977c16c00ab30b9273e13c26b71b49ef26` (#1607).
- Product/type/build candidate: `9288334cc8b1022e80d63c70e016d8b6d300bc5c`.
- Corrected documentation candidate: `47648c20df6e580c074060da30e729c8a8e57b54`.
- Static replay on docs-only `d49dd6e494ddfcd44ecf87b9e76b5b924feca76c`:
  `dec258ce45524e0bd61f80f0fff6675632877b10`.
- The complete CAD package tree at the corrected and replayed candidates is identical:
  `51a97157d817aed5286b65e4610ee96a827a7d7d`. No build or native replay is needed
  for that docs-only reparent.
- Additional static replay onto editor-only
  `faea0acc7277ba903e7abeb0f6f631cddcf8235e`: `8f5a7d2aee07fa18b1f9579a322840e14562e3e7`.
  The complete CAD package tree remains `51a97157d817aed5286b65e4610ee96a827a7d7d`;
  all 13 editor files and the 16 preceding manual/documentation files are preserved.
- The source barrel, providers, schemas, refusal profiles and engine evidence are unchanged.
  `prismV1` still uses an optional original-parent sibling chamfer. `prismV2`
  explicitly selects six fixed-role nodes and the actual second-component chamfer.
- No editor/manual changes, geometry wrappers, default options, migration, schema widening
  or release-package changes are present.

## Results

| Check | Result |
| --- | --- |
| CAD package `type-check` | PASS on product candidate |
| CAD package `build:library` | PASS on product candidate |
| Changed TypeScript/MJS file lint | PASS, 0 errors; 1 existing-rule `no-console` reporting warning in the typecheck runner |
| Source-bundled facade identity tests | PASS, 3/3 |
| Fresh emitted facade identity tests | PASS, 3/3 |
| All 3 complete documentation examples + static type contracts against source | PASS after documented correction |
| Same documentation/type contracts against emitted declarations | PASS |
| Before/after public exports | All 713 pre-change runtime exports preserved |
| Old concise leaf mappings | All 27 preserved; 6 V2 aliases added |
| Final namespace contract | 33 exact function references, 10 frozen namespace records |
| Version separation | V1/V2 leaves distinct; incompatible authored/result/update types rejected at compile time |
| Documentation authored fixture | Exact comparison with accepted v2 campaign input, exposing only its `setback` parameter; signed zero preserved |
| `git diff --check` | PASS |

Node 22.23.3 was selected explicitly for package type/build, final source/emitted
checks and lint, including the child-process PATH. TypeScript 5.9.3 and existing
installed dependencies were reused. Compiler commands used a 2048 MiB heap and
180-second per-command timeout. Available disk remained above 500 MiB.
No new downloads or geometry operations were required.

The initial lightweight source bundle/export comparison used the environment's
Node 24.19.0. Both source and emitted identity suites were subsequently run with
Node 22.23.3. This does not claim a broader runtime-version compatibility matrix.

## First failure and correction

The first source-documentation typecheck on `9288334c` failed with TS2339:
`Property 'solid' does not exist on type 'ConvexPlanarSolidSplitOutcome'` because
its empty outcome must be narrowed. The sequence stopped there; remaining checks
were not treated as passed. Documentation-only commit `47648c20` binds the
negative outcome, checks `kind === 'solid'`, then reads `.solid`. All remaining
source/emitted documentation and alias checks passed after that correction.
Product sources and the emitted build were unchanged and not rebuilt redundantly.

## Reproduction

Use an existing dependency installation; `REPO_DEPS_ROOT` is optional when the
checkout itself already has dependencies. Choose Node 22.23.3 explicitly and put
its directory first on PATH for compiler child processes.

```sh
export NODE_OPTIONS=--max-old-space-size=2048
(cd packages/barocss-cad && node scripts/tool.mjs type-check)
(cd packages/barocss-cad && node scripts/tool.mjs build)
node --test packages/barocss-cad/test/public-api.test.mjs
node packages/barocss-cad/test/public-api-types.mjs
CAD_PUBLIC_API_TYPES_ENTRY="$PWD/packages/barocss-cad/dist/index.d.ts" \
  node packages/barocss-cad/test/public-api-types.mjs
```

For source identity checks, bundle `packages/barocss-cad/src/index.ts` with the
existing esbuild (`bundle: true`, `platform: 'node'`, `format: 'esm'`,
`target: 'es2022'`) and assert its metafile has no `/dist/` input. Set
`CAD_PUBLIC_API_TEST_MODULE` to that bundle and run the same identity test.
The export comparison separately bundles the baseline facade against the unchanged
providers and compares module export names plus all old leaf-to-named-export mappings.

## Evidence boundary

The typecheck runner emits no code and does not execute any documentation example.
The authored-fixture comparison evaluates only its input construction; all modeling
calls are excluded. Function identity and type preservation do not certify new
geometry behavior, performance, browser/editor Save/Open, OS files, manufacturing
accuracy or persistent topology naming. The accepted engine campaign and its
verification remain the native evidence:

- `examples/cad-nurbs/xy-affine-prism-serial-part-demo.mjs`
- `examples/cad-nurbs/xy-affine-prism-serial-part-verification.json`

No full-package lint, full CAD geometry suite or repository-wide suite pass is
claimed. The repository release pack check targets kit/browser/server/render;
none of those packages changed.

## Content and log pins

SHA256 content pins for the final five-file implementation:

- `packages/barocss-cad/src/public-api.ts`: `7417d47c4a86f70eb8b2b63886ecebd787968c850ee67f87df6f259dcaccc2b3`
- `packages/barocss-cad/test/public-api.test.mjs`: `a744ed5d62fb11f7c9cb0f5061e25b80d6649d0d0bba38a401475fc72cc9fe7f`
- `packages/barocss-cad/test/public-api-types.mjs`: `ac45656a71a505a40697e3f1c211d65a85414c6f43fc17c03d04eb8493200141`
- `packages/barocss-cad/test/public-api-types.ts`: `b03a3a2ef890f844c3c0d48f9a9780e244e19b852856e059b16a9cbbe7779262`
- `packages/barocss-cad/CONCISE_API.md`: `69bfe16936be3bef7e0950e4dfdc3e6476d3bce9ad1625f9261698dc48a8d474`

Preserved verification-log SHA256 pins (logs are run-specific, not deterministic snapshots):

- `build.log`: `aa45a036250da18e9118fdf59729fe4dbc4b63fde5743832fc8196ddeb9bc016`
- `identity-emitted.log`: `ccc7dc2bdc47990484e74cf686e456bd93d2db4557d4afd636f179a56257d69c`
- `identity-source.log`: `0b73b3e5f0b1824ec05a5458eb2be3fb7195fd8d76965a859616b5a0e0c891e5`
- `lint-changed.log`: `3172c6172231a1fbd39dfc859a54a7d28fb2e4c3ffa4b32b1cd1267b0a61d044`
- `type-check.log`: `4ebe3d36389147b01b2db34597d8677f0a07536833da0543fdfb81680e48d621`
- `types-emitted.log`: `ba5f0f1ef553ed8445a456c827095b0a4f05bc125d58daafea4e8d1d2e3e110d`
- `types-source-first-failure.log`: `0e410c05a0c6956f92595ab308d8a80201fa7d5fce88058cfdfd8b1944e96a76`
- `types-source.log`: `c88c1ae58cca2a8d417e53fd1bebbce478aebcd2542b971eb89f02f0392f7fc3`
