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
// compiled.execution includes the scene and generated shaders. No WebGL call occurred.
```

The source must contain exactly one scene and unique ASCII object IDs. Source0 admits sphere and box. Numeric dimensions and translations use scene units without unit suffixes. `size` gives full box extents. CSS inheritance, classes, URLs and arbitrary expressions are outside this language.

## Mount one renderer

Create a `<canvas id="preview" width="640" height="360"></canvas>` in the browser host. Continue in the same module:

```ts
import { mountScene } from '@barocss/gpu';

const canvas = document.querySelector<HTMLCanvasElement>('#preview');
if (!canvas) throw new Error('Preview canvas is missing');
const renderer = mountScene(canvas, source);
const edited = renderer.update(source.replace('radius: .7', 'radius: .9'));
if (!edited.ok) console.error(edited.error.message);
// Call on host teardown:
renderer.dispose();
```

Mounting validates input, requests WebGL2, compiles shaders and draws one synchronous frame. It creates no animation timer. The host owns the canvas and event integration. The renderer owns its program, vertex array and context-loss listener.

## Opt in to rotation and more primitives

```ts
const tilted = `
@scene tilted { version: 1; cylinder #post; }
#post { radius: .6; height: 2; rotate-x: 20deg; rotate-z: -15deg; }
`;
const source1 = compileGpu({ kind: 'scene', source: tilted, sourceVersion: 1 });
if (!source1.ok) throw new Error(source1.diagnostics[0].message);
const renderer1 = mountScene(canvas, tilted, undefined, { sourceVersion: 1 });
renderer1.dispose();
```

Use a separate lifecycle for each mount. Source1 adds rigid rotation and its bounded cylinder, capsule, rounded-box and torus kinds. Rotation uses explicit degrees and the X→Y→Z order. The selected source version remains fixed for that renderer's updates.

Next: [retain accepted state on failure](./guides#replace-a-scene-safely), [limits](./limits), and the [repository source host](./examples).

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-gpu/package.json` (Manifest; local source), [public root](/packages/gpu/reference#declarations-5523de18ed63), `packages/barocss-gpu/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
