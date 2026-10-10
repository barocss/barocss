# Canvas2D: edit a scene, paint it and route input

Open [the rectangle example](/playground#canvas2d-rectangle) to resize a retained object and inspect its current semantic hit.

![A retained rectangle displayed by Canvas2D](/examples/canvas2d-rectangle.png)

The red rectangle starts at `(20,20)` with size 80×50 logical pixels. Its right edge is X=100, so the probe `(110,30)` initially returns no hit. Set width to100: the edge moves to X=120 and the same probe returns `{id:"Rectangle",kind:"rect"}`. Width 0 is invalid and leaves the last accepted rectangle available. The interactive input combines rectangle data and a host probe; it is not the package's Scene JSON format.

## Create and submit a retained object

Use a browser host with a TypeScript-capable bundler and the workspace package dependency. Put this HTML in the host page and use the following module as its `main.ts` entry. The bundler resolves public imports and transforms TypeScript; the browser receives JavaScript.

```html
<canvas id="canvas" width="320" height="200" style="width:320px;height:200px"></canvas>
<button id="resize" type="button">Set width to 100</button>
<output id="result"></output>
<script type="module" src="./main.ts"></script>
```

```ts
import { createCanvas2D, createDisplayTree, Canvas2DError } from '@barocss/canvas2d';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const result = document.querySelector<HTMLOutputElement>('#result')!;
const resizeButton = document.querySelector<HTMLButtonElement>('#resize')!;
const tree = createDisplayTree('RectangleScene');
const rectangle = tree.createRect({
  id: 'Rectangle', layer: 0,
  transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 80, height: 50, fill: [1, 0, 0, 1],
});
tree.stage.addChild(rectangle);
const renderer = createCanvas2D(canvas, {
  logicalSize: { width: 320, height: 200 }, dpr: 1,
  backgroundColor: [0.063, 0.094, 0.125, 1],
});
try {
  renderer.updateScene(tree.snapshot());
  renderer.render();
} catch (error) {
  renderer.dispose();
  throw error;
}
result.value = JSON.stringify(renderer.hitTest({ x: 110, y: 30 }));
function resize() {
  try {
    rectangle.setRect({ width: 100, height: 50, fill: [1, 0, 0, 1] });
    renderer.updateScene(tree.snapshot());
    renderer.render();
    result.value = JSON.stringify(renderer.hitTest({ x: 110, y: 30 }));
  } catch (error) {
    result.value = error instanceof Canvas2DError ? error.code : String(error);
  }
}
resizeButton.addEventListener('click', resize);
window.addEventListener('pagehide', () => {
  resizeButton.removeEventListener('click', resize);
  renderer.dispose();
}, { once: true });
```

The three operations have separate meanings. A handle edit changes the tree. `updateScene` admits a copied scene. `render` paints that accepted scene. A handle mutation alone paints nothing. `logicalSize` and `dpr` are required; they set backing pixels, while the host sets the CSS size.

Handle validation rejects an invalid width before changing its data. Renderer admission can separately reject assets, geometry budgets or device requirements after a valid tree edit. Keep your previous accepted snapshot and candidate tree separate when implementing whole-document replacement. Restore or correct the candidate before resubmission. Context loss can prevent pixel restoration even when CPU scene data is retained.

## Dispatch a current pointer hit

A hit is a semantic node ID and kind. It does not select an object or install a DOM listener. Convert the browser point to logical viewport pixels, query the current accepted renderer, then dispatch that hit through the tree.

```ts
const stopListening = rectangle.onPointer('pointerdown', event => {
  console.log(event.target?.id, event.point);
});
function pointerDown(event: PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  const point = {
    x: (event.clientX - bounds.left) * 320 / bounds.width,
    y: (event.clientY - bounds.top) * 200 / bounds.height,
  };
  tree.dispatchPointer({
    type: 'pointerdown', pointerId: event.pointerId, point,
    hit: renderer.hitTest(point),
  });
}
canvas.addEventListener('pointerdown', pointerDown);
window.addEventListener('pagehide', () => {
  canvas.removeEventListener('pointerdown', pointerDown);
  stopListening();
}, { once: true });
```

Dispatch routes from the attached target to its ancestors. A stale or detached hit is refused. Browser pointer capture and tree pointer capture are separate: the host owns the DOM operation, while the tree controls its semantic route.

## Save scene data and reconstruct handles

```ts
import { stringifySceneJSON, parseSceneJSON, createDisplayTreeFromScene } from '@barocss/canvas2d';
const savedScene = stringifySceneJSON(tree.snapshot());
const reopenedTree = createDisplayTreeFromScene(parseSceneJSON(savedScene));
const reopenedRectangle = reopenedTree.get('Rectangle');
```

The current tree snapshot uses Scene version 29. Reopening creates new handles with copied data; it does not rebind old handles or listener registrations. Scene JSON contains asset references rather than image bytes. Use the [document entry](./api#document-entry) when you need a document that includes referenced image/atlas bytes. A captured PNG is derived pixels and cannot reconstruct this editable tree.

Dispose owned renderers and remove host listeners on document close. The canvas belongs to the host. WebGL2 availability, context state and admitted scene limits still apply.

[API](./api) · [Public signatures](./reference) · [Limits and errors](./limits)
