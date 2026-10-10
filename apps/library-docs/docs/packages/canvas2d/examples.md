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

In a browser source-capable host, supply `<canvas id="canvas" width="320" height="200"></canvas>` with CSS width 320px and height 200px. Bundle the following TypeScript module as that page's entry. The host must link its `@barocss/canvas2d` workspace dependency; use the existing `examples/workspace-source` setup or your configured workspace host. Raw browser TypeScript imports are unsupported.

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

Expect a red rectangle at logical `(20,20)`, initially 80×50 and then 100×50. The second hit is inside its new width. Tree mutation alone paints nothing; both submission and `render()` are necessary. The hit contains semantic identity, not a DOM event or selected object.

For an already authored browser/file host, read `packages/barocss-canvas2d/consumer/rect.html` and `examples/canvas2d-scene/document-v1.html`. Those hosts have their own compiled/source setup; use their recorded commands instead of treating the CPU runner as a browser server. Missing WebGL2 or context loss is a renderer refusal. Preserve CPU data and dispose the owned renderer on close.

[The CAD/GPU playground](/playground) demonstrates a different 3D rendering path. It does not exercise Canvas2D or establish its pixel behavior.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
