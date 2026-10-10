# GPU examples

## Start the existing GPU source host

From the repository root with Node 22+ and its existing dependencies:

```sh
pnpm dev:gpu
```

This existing host transforms explicit original source entries in memory. Its default port is5180; use the URL printed by the process. Read [the GPU launcher](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/gpu-scene/source-server.mjs) and [reused CAD preview server](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-preview/source-server.mjs) for the actual host setup. It needs no library artifact build. For the separate ordinary-public-import consumer, use [the workspace source host](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/workspace-source/README.md); these hosts have different entry-selection evidence.

## Compile a material on the CPU

This manual includes one executed source-API flow using `@barocss/gpu` version0.0.0. It compiles the bounded opaque fragment language, validates owned material IR, lowers the trusted uniform layout and checks refusal of an unsupported function:

```ts
import { compileMeshMaterial, validateMeshMaterialIR, lowerMeshMaterial } from '@barocss/gpu';

const result = compileMeshMaterial(`
@shader #wave {
  @uniform timeSeconds: float(0,2,0);
  @fragment {
    color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5);
  }
}`);
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const material = validateMeshMaterialIR(result.material);
const lowered = lowerMeshMaterial(material);
if (lowered.uniformLayout.length !== 1 ||
    lowered.uniformLayout[0].name !== 'timeSeconds') {
  throw new Error('Uniform layout mismatch');
}
const refused = compileMeshMaterial('@shader #bad { @fragment { color: unknown(); } }');
if (refused.ok) throw new Error('Unsupported function was accepted');
console.log(material.shaderId, lowered.uniformLayout[0], refused.diagnostics);
```

Run the saved app-local consumer with the existing repository esbuild dependency and Node22+:

```sh
node apps/library-docs/scripts/run-snippet.mjs
```

The saved module is `apps/library-docs/scripts/snippets/material.mjs`. The runner uses ordinary public package imports and source transformation; it writes its receipt to `apps/library-docs/evidence/material-snippet.json`. The primary's actual selected run passed with222own source inputs and0own dist inputs; `unknown()` returned SYNTAX diagnostics. No renderer, drawing or emitted declaration check occurred in this flow. The receipt records the exact source snapshot and Node version.

`timeSeconds` is a bounded scalar uniform with declared min0,max2,default0. Compiling or lowering a material creates no timer. The host supplies time and adopts bindings through the admitted mesh renderer's `setMaterial` lifecycle. Arbitrary GLSL, textures or a general Engine textured renderer do not follow from this material profile.

## Choose a focused fixture

| Task | Repository file | What to inspect |
| --- | --- | --- |
| Source parsing/compiler | [GPU README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/README.md) | Source0 versus explicit source1, diagnostic ranges |
| Rotated source scene | [rotation smoke](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/gpu-scene/rotation-smoke.mjs) | Source1, camera and invalid-update retention |
| CAD Surface conversion | [CAD plane source](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/preview-flat.css) | Original mm coordinates and native packet parameters |
| Coordinate refusal | [Surface admission flow](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/gpu-scene/surface-coordinate-admission-flow.mjs) | CPU conversion and intentional null-context boundary |
| General Engine CPU API | [Engine scene source](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-scene.ts) | Original hierarchy versus derived bounds/draws |

Smoke scripts may require an existing local browser/runtime path and explicit evidence output. Their saved historical receipts describe their actual executed scope. Merely opening or copying a script does not establish that it passed on your current machine. Run one task-specific flow, not the entire gallery.

## Build a separate compiled checkpoint

```sh
pnpm --filter @barocss/gpu build:library
```

This emits `dist/index.js` and declarations. For a compiled consumer use the complete publication maps of every transitive workspace package; a direct GPU dist import can still mix source dependencies. See the [shared resolver/probe](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/workspace-source/probe.mjs). Keep source host results and emitted JS/type results as separate evidence.

A prepared #1183/#1184 browser fixture is not an available renderer example from this fixed parent. Use the public SDF or admitted mesh renderer for the [quickstart](./quickstart).

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
