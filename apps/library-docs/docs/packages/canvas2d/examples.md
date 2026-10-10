# Canvas2D: editable tree and visible rectangle

## Task 1 — resize, refuse an invalid size and reconstruct handles

Run from the repository root with Node 22+ and the existing app-local esbuild runtime. The runner reads ordinary public source export maps and transforms TypeScript; it does not install or publish packages.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/canvas2d-example.ts
```

The complete runnable file is shown below. Its expected values come from the fixed API and inputs. This CPU command succeeded on Node22.22.0 at the fixed source pin in #1270. Its native receipt records the actual output and zero own dist inputs. A successful CPU task does not prove browser pixels.


```ts
import { createDisplayTree, createDisplayTreeFromScene, Canvas2DError } from '@barocss/canvas2d';
const tree = createDisplayTree('RectangleScene');
const rect = tree.createRect({ id: 'Rectangle', layer: 0,
  transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 80, height: 50, fill: [1, 0, 0, 1] });
tree.stage.addChild(rect);
rect.setRect({ width: 100, height: 50, fill: [1, 0, 0, 1] });
let refused = '';
try { rect.setRect({ width: 0, height: 50, fill: [1, 0, 0, 1] }); }
catch (error) { if (!(error instanceof Canvas2DError)) throw error; refused = error.code; }
const scene = tree.snapshot();
const fresh = createDisplayTreeFromScene(scene);
const restored = fresh.get('Rectangle');
if (rect.data.width !== 100 || !restored || refused !== 'INVALID_SCENE') throw new Error('Unexpected rectangle result');
console.log(JSON.stringify({ task: 'canvas2d-tree', sceneVersion: scene.version,
  acceptedWidth: rect.data.width, refused, newHandle: restored !== rect,
  rendered: false }, null, 2));
```

| Expected field | Meaning |
| --- | --- |
| `sceneVersion: 29` | This checkpoint's tree snapshot format; not package version. |
| `acceptedWidth: 100` | The valid resize replaces 80 logical pixels. |
| `refused: "INVALID_SCENE"` | Width zero is refused without losing the valid width. |
| `newHandle: true` | Reopen creates a new handle; old handles are not rebound. |
| `rendered: false` | This task changed CPU tree data only. |

`createDisplayTree` owns no scheduler or GPU. There is no renderer to dispose in this task. Document assets remain separate from tree reconstruction.

## Task 2 — paint the edited tree and inspect a current hit

This standalone browser recipe has not been executed for #1295. The Task 1 CPU receipt remains separate. Use a shell with Node22+ and the existing app-local esbuild/TypeScript runtime. No dependency installation or package prebuild is part of this recipe. Start from the repository root.

### Save the host and entry

Create the ignored local directory:

```sh
mkdir -p apps/library-docs/docs/.vitepress/cache/manual-canvas2d
```

Save this complete HTML as `apps/library-docs/docs/.vitepress/cache/manual-canvas2d/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Canvas2D rectangle</title>
  <style>
    body { font: 16px system-ui; margin: 20px; }
    canvas { display: block; width: 320px; height: 200px; }
  </style>
</head>
<body>
  <h1>Canvas2D rectangle</h1>
  <p>Open the browser developer console to inspect the task results.</p>
  <canvas id="canvas" width="320" height="200" aria-label="Canvas2D rectangle"></canvas>
  <script type="module" src="./bundle.js"></script>
</body>
</html>
```

Save the following complete module as `apps/library-docs/docs/.vitepress/cache/manual-canvas2d/entry.ts`. Keep it standalone with ordinary bare public package imports. The snapshot fallback refuses relative consumer imports; do not add imports from another local entry or an internal package helper.

```ts
import { createCanvas2D, createDisplayTree } from '@barocss/canvas2d';
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const renderer = createCanvas2D(canvas, { logicalSize: { width: 320, height: 200 }, dpr: 1 });
const tree = createDisplayTree('RectangleScene');
const rect = tree.createRect({ id: 'Rectangle', layer: 0,
  transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 80, height: 50, fill: [1, 0, 0, 1] });
tree.stage.addChild(rect);
renderer.updateScene(tree.snapshot());
renderer.render();
console.log(renderer.hitTest({ x: 110, y: 30 })); // null: outside the 80px rectangle.
rect.setRect({ width: 100, height: 50, fill: [1, 0, 0, 1] });
renderer.updateScene(tree.snapshot());
renderer.render();
console.log(renderer.hitTest({ x: 110, y: 30 })); // {id:'Rectangle',kind:'rect'}.
window.addEventListener('pagehide', () => renderer.dispose(), { once: true });
```

### Bundle and serve

Run this one-off command from the repository root in the same Node22+ shell:

```sh
node --input-type=module <<'JS'
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bundleExample } from './apps/library-docs/scripts/example-runtime.mjs';
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Use Node22 or later');
const directory = resolve('apps/library-docs/docs/.vitepress/cache/manual-canvas2d');
const { result, provenance } = await bundleExample(resolve(directory, 'entry.ts'), 'browser');
await writeFile(resolve(directory, 'bundle.js'), result.outputFiles[0].contents);
console.log(JSON.stringify(provenance, null, 2));
JS
```

This command transforms the entry and writes browser ESM; it does not execute a canvas API in Node. The helper resolves actual public source export maps and verifies consumed source against pin `5f5ad866205a21510ac69552e704cc162fa253b5`. If current package trees differ, it materializes that exact Git snapshot in its ignored cache. It uses no moving branch, source alias or custom source condition. A missing pinned Git object or changed cache is a setup refusal; do not substitute current source silently.

Start the existing Python static server from the repository root:

```sh
python3 -m http.server 52938 --bind 127.0.0.1 --directory apps/library-docs/docs/.vitepress/cache/manual-canvas2d
```

Open [http://127.0.0.1:52938/](http://127.0.0.1:52938/). Python serves `index.html` and `bundle.js`; the browser executes the module on a genuine WebGL2 canvas. If the port is occupied, preserve the other process and choose a free port in both the command and URL. Close the page for its owned cleanup, then press Ctrl+C in the server terminal. This server runs only until stopped; it is not a documentation deployment.



After the module completes, expect the final red rectangle at logical `(20,20)`, sized 100×50. The console first reports `null` for the 80px width, then `{id:"Rectangle",kind:"rect"}` for the 100px width. Both frame submissions run synchronously, so the browser may show only the final size. The second hit is inside the new width. Tree mutation alone paints nothing; both submission and `render()` are necessary. The hit contains semantic identity, not a DOM event or selected object.

For an already authored browser/file host, read `packages/barocss-canvas2d/consumer/rect.html` and `examples/canvas2d-scene/document-v1.html`. Those hosts have their own compiled/source setup; use their recorded commands instead of treating the CPU runner as a browser server. Missing WebGL2 or context loss is a renderer refusal. Preserve CPU data and dispose the owned renderer on close.

[The CAD/GPU playground](/playground) demonstrates a different 3D rendering path. It does not exercise Canvas2D or establish its pixel behavior.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
