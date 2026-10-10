# Edit, route input and reopen a canvas

## Submit a tree edit

Mutate public handles → take `tree.snapshot()` → call `renderer.updateScene(snapshot)` → call `renderer.render()`. Each handle mutation validates its candidate tree before accepting it. The renderer has a separate accepted scene. If asset or GPU admission refuses, correct or roll back the host's tree before resubmission.

## Build a path

```ts
import { createPathBuilder } from '@barocss/canvas2d';
const commands = createPathBuilder()
  .roundRect(0, 0, 80, 50, 8)
  .build();
// Use commands in tree.createPath with a validated transform and fill/stroke.
```

`build()` returns independent command objects. Angles use radians; positive arc sweep is clockwise in the Y-down frame. Circle, ellipse and rounded corners use approximate cubic segments. Polygon/polyline vertices are copied in authored order; the builder does not infer a hull.

## Route current pointer hits

Convert canvas-local CSS input to logical viewport coordinates using your canvas rectangle and configured logical size. After the latest scene submission, obtain `renderer.hitTest(point)` or `hitTestAll(point,limit)`. Pass that current result to `tree.dispatchPointer({type,pointerId,point,hit})`. The tree captures target and ancestry for this dispatch. A stale/detached hit refuses. Browser pointer capture and DOM listeners belong to the host; tree capture is a separate semantic route.

## Save and reopen owned assets

```ts
import type { DisplayTree, Canvas2DRenderer, Canvas2DOptions } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';
// renderer, tree, freshCanvas and options are owned by your browser host.
const save = (tree: DisplayTree, renderer: Canvas2DRenderer) =>
  serializeCanvasDocument(tree.snapshot(), id => renderer.getImageAsset(id));
const open = (text: string, freshCanvas: HTMLCanvasElement, options: Canvas2DOptions) =>
  stageCanvasDocument(text, freshCanvas, options);
```

Use a fresh canvas for Open. Stage verifies referenced RGBA8 bytes/digests, registers assets, admits and renders. Swap the visible canvas and dispose the old renderer only after success. Failure disposes the candidate and keeps your live canvas. Reconstruct a new editable tree with `createDisplayTreeFromScene(staged.scene)`; old handles are not rebound. Supply background options again: background is host configuration and is absent from the document.

## Own a render loop

`createCanvas2DApplication` owns one renderer, tree and ticker. It starts stopped unless `autoStart:true`. Register `onUpdate`, mutate handles, and let the application submit one automatic frame after updates. `stop()` cancels its frame loop. `dispose()` stops owned scheduling, clears subscriptions and disposes its renderer. The host still owns canvas/DOM/file state.

`packages/barocss-canvas2d/package.json` (Manifest and version; local source) · `packages/barocss-canvas2d/README.md` (Package task notes; local source)
