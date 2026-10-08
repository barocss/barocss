# @barocss/canvas2d

Experimental retained WebGL2 renderer for bounded 2D scenes. It is configured as a public package, but this repository change does not publish it.

```js
import { createCanvas2D, parseSceneJSON, stringifySceneJSON } from '@barocss/canvas2d';

const renderer = createCanvas2D(canvas, {
  logicalSize: { width: 800, height: 480 },
  dpr: window.devicePixelRatio,
  maxDeviationDevicePx: 1,
});
renderer.updateScene(parseSceneJSON(savedJSON));
renderer.setView({ panX: 0, panY: 0, zoom: 1 });
renderer.render();
const hit = renderer.hitTest({ x: 120, y: 120 });
const pathObservation = renderer.getPathObservation('PathRibbon');
const nextJSON = stringifySceneJSON(scene);
renderer.dispose();
```

The input scene is `{version:0|1, unit:'logical-px', contextId, nodes}`. Version 0 keeps the original `group`, `frame`, `rect`, and `line` nodes and refuses paths. Version 1 adds `path` while preserving the old nodes. Every node has a stable `id`, integer `layer`, and explicit `{x,y,scaleX,scaleY,rotation}` transform. Groups and frames contain `children`. Frames and rectangles have positive `width` and `height` and a straight RGBA `fill`. Frames also have a Boolean `clip`. Lines have `x1`, `y1`, `x2`, `y2`, positive `width`, and straight RGBA `stroke`. See [the example scene](../../examples/canvas2d-scene/scene.mjs) for complete v0 and v1 data.

Version 1 `path` nodes have `commands`, positive `width`, and straight RGBA `stroke`. Commands use absolute path-local logical pixels: `M {x,y}`, `L {x,y}`, `Q {cx,cy,x,y}`, `C {c1x,c1y,c2x,c2y,x,y}`, and `Z` with no coordinate fields. The first command is `M`; `L/Q/C` need an open subpath; `Z` closes it and requires a new `M` before further drawing. Each subpath must draw a nonzero segment. The reader copies exact authored controls and parameters. There is no SVG string parser.

Quadratic and cubic curves split by de Casteljau at command-parameter midpoints. Each accepted chord's control-polygon distance to the finite chord is at most `maxDeviationDevicePx` after the full transform, zoom, and DPR. The option defaults to 1 and accepts 0.25–4. `getPathObservation(id)` returns a copy of the accepted path samples with original command indexes, parameters in `[0,1]`, transformed world logical coordinates, segment/vertex counts and the maximum observed device-space control-polygon deviation. These are tessellation observations, not a global output-pixel or manufacturing precision certificate. View and DPR changes stage a new tessellation before replacing accepted state.

Stroke segments use butt caps and bevel joins, including closed joins. Accepted Float32 triangles drive both drawing and path hit testing. At self-crossings and overlaps, semi-transparent triangles accumulate with the renderer's source-over blend. Paths have no fill or hole-winding rule.

Coordinates are logical pixels, with x right and y down. Rotation uses radians. A node transform is `parent × translate × rotate × scale`. The view maps world to viewport with `screen = pan + zoom × world`; DPR changes backing pixels only. Hit tests take viewport logical pixels and return the top visible drawable `{id,kind}` or `null`. Frames paint before children. Siblings paint by ascending layer, then input order. Hit tests reverse that order. Clips intersect and apply to drawing and hit tests. Only axis-aligned frame clips are supported; a frame clip with any rotated ancestor or own rotation is rejected.

The renderer copies accepted scene data and owns only its own WebGL program, buffer, vertex array, and context listeners. `updateScene`, `setView`, and `resize` do not draw automatically. A rejected update leaves the accepted scene, view, size, and prior frame in place. Context loss preserves CPU scene data; `render()` reports `CONTEXT_LOST` until restoration rebuilds the GPU objects. `dispose()` is idempotent. The host owns pointer events, animation, files, and the canvas element.

The v0 reader accepts only exact plain data fields, dense arrays, finite scalars and unique ASCII IDs (`[A-Za-z][A-Za-z0-9_-]{0,63}`). It rejects hidden fields, getters, symbols, foreign prototypes, cycles, unknown node kinds/fields, duplicate IDs, negative zero, and unsupported clips. JSON serialization supports those scalar values only. Duplicate JSON member names follow the host `JSON.parse` behavior; producers should use `stringifySceneJSON` to write canonical field order.

Limits: 256 nodes, 16 tree levels, 32 paths, 2–256 commands and at most 1,024 accepted segments per path, 16,384 total draw vertices, subdivision depth 16, 1 MiB JSON/snapshot, authored coordinates and pan within ±1,000,000, composed world geometry within ±1,000,000,000, scale 0.01–100, rotation within ±2π, layers −1024–1024, stroke/line width at most 1,000, zoom 0.05–64, DPR 0.5–4, logical width/height 1–8192 integer pixels, at most 16 million backing pixels and actual WebGL size limits. RGBA channels are 0–1. The shader premultiplies output and uses `ONE, ONE_MINUS_SRC_ALPHA` blending.

Errors are `Canvas2DError` with `code`: `INVALID_SCENE`, `SCENE_LIMIT`, `INVALID_VIEW`, `INVALID_SIZE`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `DISPOSED`, or `SERIALIZATION`.

Run the bounded example from the repository root after building this package:

```sh
pnpm --dir packages/barocss-canvas2d build:library
node examples/canvas2d-scene/probe.mjs
node examples/canvas2d-scene/server.mjs
```

Open the printed URL. The example draws two frames, colored rectangles, lines and a version 1 path with visible control handles. It supports selection, drag, pan, zoom, v0/v1 JSON Save/Open and control-point editing through this public API. Filled/Boolean paths, SVG parsing, text shaping, masks, images, filters, blend modes, color-managed output, editor history, collaboration, and full design-tool behavior remain outside this prototype.
