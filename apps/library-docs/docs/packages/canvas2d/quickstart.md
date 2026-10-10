# Draw and hit a retained rectangle

Use a visible host-owned `HTMLCanvasElement` named `canvas` in a source-capable browser bundle.

```ts
import { createCanvas2D, createDisplayTree } from '@barocss/canvas2d';

export function drawRectangle(canvas: HTMLCanvasElement) {
  const renderer = createCanvas2D(canvas, {
    logicalSize: { width: 320, height: 200 }, dpr: 1,
    maxDeviationDevicePx: 1,
  });
  const tree = createDisplayTree('RectangleScene');
  const rectangle = tree.createRect({
    id: 'Rectangle', layer: 0,
    transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
    width: 80, height: 50, fill: [1, 0, 0, 1],
  });
  tree.stage.addChild(rectangle);
  renderer.updateScene(tree.snapshot());
  renderer.render();
  console.log(renderer.hitTest({ x: 30, y: 30 }));
  return () => renderer.dispose();
}
```

Call the returned cleanup when the document closes. The hit contains the semantic node ID and kind. It does not install pointer listeners or select the rectangle. The host owns the canvas, its CSS size, file I/O and selection.

To change size, call `rectangle.setRect({width:100,height:50,fill:[1,0,0,1]})`, then submit a fresh snapshot and render again. A valid handle mutation does not guarantee later renderer admission under device or scene budgets. See [transaction boundaries](./guides#submit-a-tree-edit).

`packages/barocss-canvas2d/package.json` (Manifest and version; local source) · `packages/barocss-canvas2d/README.md` (Package task notes; local source)
