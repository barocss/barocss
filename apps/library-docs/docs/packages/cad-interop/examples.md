# Loader examples

## Run the existing Three host

The saved public-export SDK host loads one authentic full five-Curve source, displays IDs, exercises refusal retention and disposes owned resources. From the workspace root with Node22+ and existing dependencies:

```sh
pnpm exec vite --config packages/barocss-cad-interop/examples/sdk-quickstart-vite.config.mjs --host 127.0.0.1 --port 5191 --strictPort
```

Open `http://127.0.0.1:5191/packages/barocss-cad-interop/examples/sdk-quickstart-three.html`. This normal source host needs no CAD/interop prebuild or source alias. If the port is occupied, report the conflict; preserve the other host process.

The unchanged source is `packages/barocss-cad-interop/examples/native-capacity-data/linear-quarter-five.barocad` (linear-quarter-five.barocad; local source),819 bytes, SHA256`f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2`. It retains Model`quarter_pattern` and native Curve IDs`quarter_seed`, `quarter_copy_1`..`quarter_copy_4`. The original nonunit Curve domain is `[-3,7]`. The saved profile uses8×8 Surface grid,0.001scene units/mm, explicit native16 and adaptive Curvev1/tolerance0.1mm/maxSegments512/maxDepth16.

Read `packages/barocss-cad-interop/examples/sdk-quickstart-three.mjs` (the host module; local source) and `packages/barocss-cad-interop/examples/sdk-quickstart-contract.ts` (typed consumer; local source). Three Scene, renderer, camera, canvas and unrelated marker remain caller-owned. The result owns its Group and per-object geometry/material.

## Choose another existing target

| Task | Fixed example |
| --- | --- |
| Babylon caller-host contract | `packages/barocss-cad-interop/examples/sdk-babylon-host-contract.ts` (sdk-babylon-host-contract.ts; local source) |
| Pinned Pixi3D host | `packages/barocss-cad-interop/README.md` (SDK section in README; local source) |
| Neutral complete native load | `packages/barocss-cad-interop/examples/native-capacity-verify.mjs` (capacity verifier; local source) |
| Complete source to display selection | [native parser](/packages/cad-interop/reference#declarations-d539b844fcdd) |
| Uniform original Curve | [uniform entry](/packages/cad-interop/reference#declarations-4328ed8aab4c) |
| Explicit emitted entry checkpoint | `packages/barocss-cad-interop/examples/sdk-entry-checkpoint-verify.mjs` (SDK verifier; local source) |

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

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad-interop/package.json` (Manifest; local source), [public root](/packages/cad-interop/reference#declarations-9cb9edb1215a), `packages/barocss-cad-interop/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
