# Loader examples

## Run the existing Three host

The saved public-export SDK host loads one authentic full five-Curve source, displays IDs, exercises refusal retention and disposes owned resources. From the workspace root with Node22+ and existing dependencies:

```sh
pnpm exec vite --config packages/barocss-cad-interop/examples/sdk-quickstart-vite.config.mjs --host 127.0.0.1 --port 5191 --strictPort
```

Open `http://127.0.0.1:5191/packages/barocss-cad-interop/examples/sdk-quickstart-three.html`. This normal source host needs no CAD/interop prebuild or source alias. If the port is occupied, report the conflict; preserve the other host process.

The unchanged source is [linear-quarter-five.barocad](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/examples/native-capacity-data/linear-quarter-five.barocad),819 bytes, SHA256`f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2`. It retains Model`quarter_pattern` and native Curve IDs`quarter_seed`, `quarter_copy_1`..`quarter_copy_4`. The original nonunit Curve domain is `[-3,7]`. The saved profile uses8×8 Surface grid,0.001scene units/mm, explicit native16 and adaptive Curvev1/tolerance0.1mm/maxSegments512/maxDepth16.

Read [the host module](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/examples/sdk-quickstart-three.mjs) and [typed consumer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/examples/sdk-quickstart-contract.ts). Three Scene, renderer, camera, canvas and unrelated marker remain caller-owned. The result owns its Group and per-object geometry/material.

## Choose another existing target

| Task | Fixed example |
| --- | --- |
| Babylon caller-host contract | [sdk-babylon-host-contract.ts](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/examples/sdk-babylon-host-contract.ts) |
| Pinned Pixi3D host | [SDK section in README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/README.md) |
| Neutral complete native load | [capacity verifier](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/examples/native-capacity-verify.mjs) |
| Complete source to display selection | [native parser](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/src/native.ts) |
| Uniform original Curve | [uniform entry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/src/native-uniform-curve.ts) |
| Explicit emitted entry checkpoint | [SDK verifier](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/examples/sdk-entry-checkpoint-verify.mjs) |

Read each example's entry, host setup, source hash and exact receipt before running. Source host, native target test, compiled consumer and independent packed installation are separate outcomes.

## Run the separate emitted checkpoint

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
node packages/barocss-cad-interop/examples/sdk-entry-checkpoint-verify.mjs --output /tmp/barocss-sdk-entry-checkpoint
```

Use a fresh output directory. The verifier selects the actual publication maps, exercises native/Three emitted JS and checks consumed emitted declarations with TypeScript strict/noEmit and disclosed skipLibCheck. Current-map file existence is not runtime coverage of every public entry. Peer declarations are counted separately from own source fallback.

[Quickstart #988](https://github.com/barocss/barocss/issues/988) retains earlier compiled host/type evidence. [#1017](https://github.com/barocss/barocss/issues/1017) separates the no-dist Three source browser from emitted JS/types and its later additive-map CPU follow-up. The original 27/28-entry receipts do not define the current complete manifest. Adoption and pending current integration browser checks remain separate from those historical runs. These commands do not establish a tarball or registry release.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
