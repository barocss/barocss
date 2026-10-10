# Loader: complete native input and caller-owned display

## Task 1 — parse one complete Surface and keep the last valid result

Run from the repository root with Node 22+ and the existing app-local esbuild runtime. The runner reads ordinary public source export maps and transforms TypeScript; it does not install or publish packages.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/interop-example.ts
```

The complete runnable file is shown below. Its expected values come from the fixed API and inputs. This CPU command succeeded on Node22.22.0 at the fixed source pin in #1270. Its native receipt records the actual output and zero own dist inputs. A successful CPU task does not prove browser pixels.


```ts
import { parseBaroCadSource, BaroCadSourceError } from '@barocss/cad-interop/native';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const options = { sourceVersion: 0 as const, countU: 3, countV: 3, unitsPerMillimeter: 0.001 };
const result = parseBaroCadSource(source, options);
let refused = '';
try { parseBaroCadSource('not a model', options); }
catch (error) { if (!(error instanceof BaroCadSourceError)) throw error; refused = error.name; }
if (result.model.name !== 'panel_demo' || result.surfaces.length !== 1 || !refused) throw new Error('Unexpected loader result');
console.log(JSON.stringify({ task: 'native-loader', sourceExact: result.source === source,
  model: result.model.name, surfaceIds: result.surfaces.map(surface => surface.surfaceId),
  nativeObjects: result.model.objects.length, curves: result.curves.length,
  positions: result.surfaces[0].mesh.positions.length,
  indices: result.surfaces[0].mesh.indices.length, refused, rendered: false }, null, 2));
```

| Expected result | Meaning |
| --- | --- |
| `sourceExact:true` | The complete original source string is retained. |
| `model:'panel_demo'`, `surfaceIds:['panel']` | Original identity, not generated display labels. |
| `nativeObjects:1`, `curves:0` | Complete admitted native inventory. |
| `positions:27`, `indices:24` | A 3×3 sampled Surface grid: 9 XYZ vertices and 8 triangles. |
| `refused:'BaroCadSourceError'` | Invalid text is refused; the host keeps its prior result. |
| `rendered:false` | Parsing creates no target renderer or image. |

Display positions use scene units/mm0.001, so native width100mm becomes0.1 scene units. Original weights/knots/coordinates remain native millimetres and dimensionless parameters. The sampled packet/mesh is a derived approximation. This native result has no target-renderer resource to dispose.

## Task 2 — load five original Curves into an actual Three host {#run-the-existing-three-host}

Use Node22+ and the existing configured SDK host dependencies. This source host uses ordinary public package imports, without a CAD/interop prebuild or source alias:

```sh
pnpm exec vite --config packages/barocss-cad-interop/examples/sdk-quickstart-vite.config.mjs --host 127.0.0.1 --port 5191 --strictPort
```

Open `http://127.0.0.1:5191/packages/barocss-cad-interop/examples/sdk-quickstart-three.html`. If the strict port is occupied, keep the other process and choose a free authorized host setup.

Input is the complete `packages/barocss-cad-interop/examples/native-capacity-data/linear-quarter-five.barocad`:819bytes, SHA256 `f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2`. Model is `quarter_pattern`; native IDs are `quarter_seed`, `quarter_copy_1` through `quarter_copy_4`. The original Curve domain is `[-3,7]`. Host options explicitly admit native16 and adaptive Curvev1, tolerance0.1mm, maxSegments512, maxDepth16, and scene scale0.001/mm.

Expect five original Curve objects and five corresponding display Lines. The host retains a separate unrelated marker. Choose its invalid-load action: accepted old geometry stays visible. Dispose the loaded result: adapter-owned Group, geometries and materials are released; the caller's Scene, camera, renderer and unrelated marker remain. Parsing/transport does not transfer host ownership.

The exact target contract is `packages/barocss-cad-interop/examples/sdk-quickstart-contract.ts`; the runnable module is `packages/barocss-cad-interop/examples/sdk-quickstart-three.mjs`. A Three Curve line pick is a sampled chord result, not a native exact intersection.

## Related actual image

![Original CAD Surface rendered through the playground's GPU mesh path](/examples/cad-surface.png)

The [playground](/playground) connects original CAD input to a derived GPU mesh image. This image explains Task 1's model/mesh/image distinction. It does not show the Three SDK host, its five-Curve fixture, a GLB export, Babylon or Pixi3D. Each target requires its own actual host test.

## Source and emitted checkpoints

`#988` and `#1017` preserve the earlier SDK/source-browser/emitted receipts. This manual's source runner does not verify packed installation or publication. An explicit emitted checkpoint uses actual compiled publication maps and is a separate command:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
node packages/barocss-cad-interop/examples/sdk-entry-checkpoint-verify.mjs --output /tmp/barocss-sdk-entry-checkpoint
```

Use a fresh output directory. Do not infer complete public-entry runtime coverage from file existence or an older 27/28-entry count. Preserve actual first failures and consumed type-check scope.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
