# Compile and display a scene

Use this code in the repository workspace with Node 22 or later and a TypeScript-capable browser bundler. Ordinary `@barocss/gpu` imports select source. A plain browser cannot execute the raw TypeScript entry, and plain Node does not resolve its internal `.js` specifiers to `.ts`.

## Compile before creating a canvas

```ts
import { compileGpu } from '@barocss/gpu';

const source = `
@scene demo { version: 0; sphere #ball; box #block; }
#ball { radius: .7; translate: -1 0 0; color: #e08040; }
#block { size: 1 1.5 1; translate: 1 0 0; color: #4090e0; }
`;
const compiled = compileGpu({ kind: 'scene', source });
if (!compiled.ok) {
  throw new Error(compiled.diagnostics[0].message);
}
console.log(compiled.ir.pipeline); // 'sdf'
// compiled.execution includes the scene and generated shaders. No GPU call occurred.
```

The source must contain exactly one scene and unique ASCII object IDs. Source0 admits sphere and box. Numeric dimensions and translations use scene units without unit suffixes. `size` gives full box extents. CSS inheritance, classes, URLs and arbitrary expressions are outside this language.

## Show it on the viewer

Create a `<canvas id="preview" style="width:640px;height:360px"></canvas>` in the browser host. Continue in the same module:

```ts
import { createViewer, showScene } from '@barocss/gpu';

const canvas = document.querySelector<HTMLCanvasElement>('#preview');
if (!canvas) throw new Error('Preview canvas is missing');
const viewer = await createViewer(canvas, { camera: { position: [2, 1.6, 3], target: [0, 0, 0], up: [0, 1, 0] } });
const view = showScene(viewer, source);
console.log([...view.meshes.keys()]); // ['ball', 'block']
const edited = view.update(source.replace('radius: .7', 'radius: .9'));
if (!edited.ok) console.error(edited.diagnostics[0].message);
// Call on host teardown:
view.dispose();
viewer.dispose();
```

`createViewer(canvas, options?)` resolves to a `Viewer` once it has a WebGPU adapter, device and canvas context. It rejects with a `ViewerError` (`webgpu-unavailable`, `no-adapter` or `no-context`) when the browser cannot provide one. The viewer draws on demand, at most one frame per animation frame, follows the canvas's CSS size and pixel ratio, and attaches orbit controls unless `controls: false`. The host owns the canvas and its layout.

`showScene(viewer, source, options?)` compiles the source, adds one mesh per object (named by its ID) with its placement and color, sets the scene background and frames the scene once. A first source that does not compile throws a `SceneViewError` carrying the diagnostics. `view.update(source)` returns `{ok:true}` or `{ok:false,diagnostics}`; a refused edit keeps the shown scene. `view.dispose()` removes its meshes and geometry; `viewer.dispose()` releases the device and listeners.

## Opt in to rotation and more primitives

```ts
const tilted = `
@scene tilted { version: 1; cylinder #post; }
#post { radius: .6; height: 2; rotate-x: 20deg; rotate-z: -15deg; }
`;
const source1 = compileGpu({ kind: 'scene', source: tilted, sourceVersion: 1 });
if (!source1.ok) throw new Error(source1.diagnostics[0].message);
const view1 = showScene(viewer, tilted);
view1.dispose();
```

`compileGpu` needs the explicit `sourceVersion: 1` option. `showScene` selects source1 itself when the header declares `version: 1;`, and compiles every later `update` the same way. Source1 adds rigid rotation and its bounded cylinder, capsule, rounded-box and torus kinds. Rotation uses explicit degrees and the X→Y→Z order. Each scene view owns its meshes; dispose one before showing another on the same viewer.

Next: [retain accepted state on failure](./guides#replace-a-scene-safely), [limits](./limits), and the [repository source host](./examples).

---

Source snapshot: local Git `c79d752cb3463a34e6c93cb64e3693bc493c271f` (the WebGPU viewer; the earlier renderers were removed after `5f5ad866205a21510ac69552e704cc162fa253b5`). `packages/barocss-gpu/package.json` (Manifest; local source), `packages/barocss-gpu/src/index.ts` (public root; local source), `packages/barocss-gpu/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
