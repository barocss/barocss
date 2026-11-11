# D728 — Reject invalid STEP planar cavity placement

P0, rows 13, 16 and 30. FULL qualification for spatial admission between straight-edge, exactly planar cavity boundaries. Parent `cfd6dbf751262b6b65d4ad21d1fbc423e74eaee6`. [#2433](https://github.com/barocss/barocss/issues/2433).

The parent accepted individually well-oriented shells even when one void lay inside another, two voids crossed or touched, or a void touched or crossed the outer boundary. The nested input displayed 776 mm³ and the crossing input displayed 964 mm³. Those are sums of signed shell volumes for invalid solids. The outer boundary and every void must be disjoint. Every void must be inside the outer boundary and outside the other voids. [ISO 10303-42 §6.4.3](https://steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/6_schema.htm).

After the D727 orientation check, the reader compares eligible shell pairs within each body. It uses original represented vertices for bounding-box pruning. Exact rational edge–face tests reject contact and crossings, including coplanar edges and faces with holes. Once connected boundaries are disjoint, exact ray parity at one boundary vertex in each direction determines nesting. If the five common rays all graze, a finite set of integer directions supplies a clean ray. Each forbidden plane excludes at most two directions of the form (1, t, t²). Curved shells and boundaries that are not exactly planar retain the D727 orientation check. This verifies relative placement of the selected shells and does not certify an individual shell against self-intersection.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 11 states and 328 frozen inputs through cleanup. Five invalid files returned typed refusal through Open. The nested input also refused Add reference. Studio retained the accepted 986 mm³ solid, existing reference, selection, history and the available Redo. Redo restored the prior edit. The disjoint control reopened. An annular void with a separate void in its through opening opened at 807 mm³ even though their bounding boxes nest.
- **PASS** — Independent Part 21 inputs cover disjoint, nested, crossing without interior vertices, face contact, point contact, outside and outer-wall contact. Control placements cover genus-one outer and inner shells, a separate void that passes the annular cap planes inside the opening, a coplanar cap inside that opening and an exact positive gap of 2⁻⁴⁸ mm. Signed winding and closed-form volumes distinguish actual material and void. The independent oracle read the genus-one writer output at 807 mm³.
- **PASS** — Two independent geometry reviews. An exact determinant check confirmed the 16 hull faces and interior cube of the adversarial ray fixture. Five isolated mutations were detected, covering ignored contact, skipped outer checks, one-direction nesting, fixed-ray exhaustion and using only box containment. D727's actual orientation, old-file refusal, Section, reference and Save/Open replay passed all 9 states.
- **PASS** — CAD 89/89, Model 23/23 and Studio 42/42 focused checks. Three type-checks, affected lint, syntax, diff check and Studio production build passed.
- **FAIL** — The parent admitted all five invalid Studio files. The first exact implementation exhausted its five fixed rays on a valid convex hull and interior cube. The final regression succeeds in both query directions.
- **NOT_RUN** — Full package and kernel suites, mobile, third-party CAD readers, independent external assets, curved inter-shell placement and general self-intersection certification.

The nested input SHA-256 is `453638feca95dd1cb489d2b6a02d12162f9eb2eea7762f664ac4c60483d5d789`. The valid 807 mm³ input SHA-256 is `cbcabe78eed8b6cb43b0c4316990ef4220a46a43cb9f0a588a771ef70d6a004e`. Evidence files remain outside Git.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
node packages/barocss-cad/scripts/tool.mjs build:fast
node --test --test-concurrency=1 packages/barocss-cad/test/{step-cavity,step,brep-step2,polyhedral-boolean,mass-polyhedral,step-tessellated,step-offset}.test.mjs
D728_SOURCE_FROZEN=1 node apps/cad-studio/test/step-cavity-containment-browser.mjs "$EVIDENCE/studio"
D727_SOURCE_FROZEN=1 node apps/cad-studio/test/step-cavity-orientation-browser.mjs "$EVIDENCE/d727-replay" --fixed "$LEGACY_BASELINE"
node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE/mutation-results"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test api-step-report step-reference-units
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test document-file imported-file-ownership step-export
pnpm --dir packages/barocss-cad type-check
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad/src/brep/polyhedral-boolean.ts packages/barocss-cad/src/io/{step-import,step-cavity-internal}.ts
node --check apps/cad-studio/test/step-cavity-containment-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D729 checks whether binary STL Float32 conversion collapses previously valid triangles and whether Studio withholds the complete export when that happens. [#2425](https://github.com/barocss/barocss/issues/2425). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
