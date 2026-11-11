# D727 — Apply STEP cavity shell orientation exactly once

P0, rows 13, 16 and 30. FULL qualification at the public STEP reader/writer boundary and native Open admission. Parent `adcfced974e0df94d99c4aef5555fac3eaaa0e4a`. [#2433](https://github.com/barocss/barocss/issues/2433).

An independent planar STEP described a 10 mm cube and an outward 2 mm cube as the base of its `.F.` void wrapper. The parent Studio read 1,008 mm³. The expected material volume is 992 mm³. The parent Studio writer put an inward base shell behind another reversal. The independent byte reader found base volume −8 mm³ and effective void volume +8 mm³, for a net 1,008 mm³. The parent's own reader skipped the wrapper and obtained 992 mm³ on that output.

STEP defines a void as an oriented closed shell with orientation FALSE. A plain closed shell points away from the region it encloses. The reader applies the wrapper to the final face sense and every loop traversal, after periodic seam processing. The writer represents the native cavity as an outward base by reversing the emitted face and bound senses. It keeps the .F. wrapper and edge identities. Two independent geometry reviews checked these choices. [ISO 10303-42 topology](https://steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/5_schema.htm), [ISO 10303-42 solids](https://steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/6_schema.htm#brep_with_voids).

The reader checks each cavity body's effective shell orientation separately from the whole-body volume. Straight planar boundaries use the existing planar integral. Curved boundaries use the existing integration with a sign-stability check. Structural refusals cover invalid flags and derived fields, missing and repeated references, duplicate faces and nested oriented-shell wrappers. A material-facing void with positive signed volume is refused. The old producer header cannot identify the writer version. Studio checks embedded cavity STEP before toolbar and project Open can adopt the candidate. The original file is kept. There is no automatic legacy conversion.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 9 recorded states and 792 frozen inputs through cleanup. Studio opened the independent fixture at 992 mm³ and prepared new STEP output with raw void +8 mm³, effective void −8 mm³ and net 992 mm³. The prepared bytes reopened. The actual exact Section view returned 496 mm³ and showed the cavity. A separate asymmetric input and reference preserved centroid `[4976/992, 4976/992, 4976/992] mm`, Undo/Redo and byte-exact source through browser-project Save and fresh Open.
- **PASS** — Studio rejected a malformed wrapper through Open and Add reference. It rejected the exact parent writer file and the same source embedded in a native import and reference. Project Open did not activate the refused project file. The accepted model, reference, history and selection remained. The legacy STEP SHA-256 was `93c8ee6dfe1fab66087e6c35ee9ca4f51a4c862ba823d90a0785a99645c9f30c` and its native import SHA-256 was `d9841f619cca7d50afc13d1de73cb59e1d93aedaa15a75952d2e0ad0394cb005`. The accepted native Save SHA-256 was `23fa7e56960c0461c59277349454bfdd8e8d7016dadee06acf712c03d47c4dba`.
- **PASS** — Independent Part 21 traversal checks coedge continuity, opposite uses, face/loop orientation, shell signs, volume and first moments. Controls covered the outer-only cube, centered and asymmetric cavities, and two disjoint voids at 986 mm³ with first moments [4931,4940,4961] mm⁴. Signed winding of native triangles separated material, exterior and both voids. A curved closed-cylinder cavity retained volume `122π mm³` and signed winding at material and void points. Four isolated mutations were detected, covering ignored wrapper, face-only reversal, writer double reversal and unsafe legacy acceptance.
- **PASS** — CAD 116/116, Model 35/35 and Studio 78/78 focused checks. Three type-checks, affected lint, syntax, diff check and Studio production build passed. D724's actual supported inch/foot reference and Save/Open replay also passed.
- **FAIL** — The clean parent misread independent input and produced nonconforming cavity direction on output. The first implementation check keyed shell validation by the pre-build shell ID and missed an invalid legacy file. The final check binds post-build shell IDs and rejects the deliberate mutation.
- **NOT_RUN** — Full kernel/package suites, mobile, third-party reader, external files and general shell containment/intersection certification. The browser used the actual prepared export bytes without a browser download. The full kernel suite is reserved for B-rep core changes.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. The baseline run must use the parent production source and generate the legacy fixture directory used by the fixed run. Evidence files remain outside Git.

```sh
node packages/barocss-cad/scripts/tool.mjs build:fast
node --test --test-concurrency=1 packages/barocss-cad/test/{step-cavity,step,brep-step2,step-quoted-tokens,step-cone-zero-offset,step-offset,step-tessellated,step-spline-knots}.test.mjs
D727_SOURCE_FROZEN=1 node apps/cad-studio/test/step-cavity-orientation-browser.mjs "$EVIDENCE/studio" --fixed "$EVIDENCE/baseline"
D724_SOURCE_FROZEN=1 node apps/cad-studio/test/step-scaled-reference-browser.mjs "$EVIDENCE/d724-replay"
node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE/mutation-results"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test api-step-report step-units step-reference-units step-offset-units
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test document-file project-open-ownership imported-file-ownership step-export
pnpm --dir packages/barocss-cad type-check
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad/src/io/{step-import,step,step-cavity-internal}.ts apps/cad-studio/src/App.tsx apps/cad-studio/src/files/{documentFile,useStudioDocumentFiles}.ts apps/cad-studio/src/storage/useProject.ts
node --check apps/cad-studio/test/step-cavity-orientation-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D728 reproduces a geometrically nested planar void separately from the rejected nested wrappers. Keep #2433 open while that acceptance remains unresolved. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
