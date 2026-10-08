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
const fillObservation = renderer.getFillObservation('FilledBadge');
const capabilities = renderer.getCapabilities();
const nextJSON = stringifySceneJSON(scene);
renderer.dispose();
```

The input scene is `{version:0|1|2, unit:'logical-px', contextId, nodes}`. Version 0 keeps the original `group`, `frame`, `rect`, and `line` nodes and refuses paths. Version 1 adds stroked `path` nodes. Version 2 adds independently optional path fill and stroke. Every node has a stable `id`, integer `layer`, and explicit `{x,y,scaleX,scaleY,rotation}` transform. Groups and frames contain `children`. Frames and rectangles have positive `width` and `height` and a straight RGBA `fill`. Frames also have a Boolean `clip`. Lines have `x1`, `y1`, `x2`, `y2`, positive `width`, and straight RGBA `stroke`. See [the example scene](../../examples/canvas2d-scene/scene.mjs) for complete v0, v1 and v2 data.

Version 1 `path` nodes have `commands`, positive `width`, and straight RGBA `stroke`. Commands use absolute path-local logical pixels: `M {x,y}`, `L {x,y}`, `Q {cx,cy,x,y}`, `C {c1x,c1y,c2x,c2y,x,y}`, and `Z` with no coordinate fields. The first command is `M`; `L/Q/C` need an open subpath; `Z` closes it and requires a new `M` before further drawing. Each subpath must draw a nonzero segment. The reader copies exact authored controls and parameters. There is no SVG string parser.

Quadratic and cubic curves split by de Casteljau at command-parameter midpoints. Each accepted chord's control-polygon distance to the finite chord is at most `maxDeviationDevicePx` after the full transform, zoom, and DPR. The option defaults to 1 and accepts 0.25–4. `getPathObservation(id)` returns a copy of the accepted path samples with original command indexes, parameters in `[0,1]`, transformed world logical coordinates, segment/vertex counts and the maximum observed device-space control-polygon deviation. These are tessellation observations, not a global output-pixel or manufacturing precision certificate. View and DPR changes stage a new tessellation before replacing accepted state.

Stroke segments use butt caps and bevel joins, including closed joins. Accepted Float32 triangles drive both drawing and path hit testing. At self-crossings and overlaps, semi-transparent stroke triangles accumulate with the renderer's source-over blend. Version 1 paths have no fill or hole-winding rule.

Version 2 path nodes keep the same commands and use exact optional `fill: {color: RGBA, rule:'evenodd'}` and/or `stroke: {color: RGBA, width}` fields. At least one paint is required. Every filled subpath must close with `Z`; stroke-only paths may stay open. Version 0 and 1 keep their original path admission and JSON shape. An even-odd fill uses the accepted Float32 contours as a stencil parity mask, then composites its color once before an optional stroke. Nested holes, islands and self-crossings follow parity. CPU fill hit testing uses those Float32 contours; pixels at boundaries may differ from the mathematical predicate. A paint with zero alpha does not hit. There is no nonzero winding or Boolean operation.

The renderer requests a stencil buffer when creating WebGL2. `getCapabilities()` reports `{stencil,stencilBits}` for the current context. If an existing context has no stencil bits, old scenes and strokes still work; a filled scene is rejected with `UNSUPPORTED_FEATURE` before replacing accepted state. `getFillObservation(id)` returns a copy of the filled path's world logical-pixel contour samples, segment count, mask/cover vertex counts and maximum observed device-space flattening deviation. Drawing and fill hit testing use matching Float32 coordinates; the returned samples preserve the original double-precision command parameters. A lost context reports no current stencil capability. Filled CPU data is retained and GPU objects are rebuilt after a supported restore.

Coordinates are logical pixels, with x right and y down. Rotation uses radians. A node transform is `parent × translate × rotate × scale`. The view maps world to viewport with `screen = pan + zoom × world`; DPR changes backing pixels only. Hit tests take viewport logical pixels and return the top visible drawable `{id,kind}` or `null`. Frames paint before children. Siblings paint by ascending layer, then input order. Hit tests reverse that order. Clips intersect and apply to drawing and hit tests. Only axis-aligned frame clips are supported; a frame clip with any rotated ancestor or own rotation is rejected.

The renderer copies accepted scene data and owns only its own WebGL program, buffer, vertex array, and context listeners. `updateScene`, `setView`, and `resize` do not draw automatically. A rejected update leaves the accepted scene, view, size, and prior frame in place. Context loss preserves CPU scene data; `render()` reports `CONTEXT_LOST` until restoration rebuilds the GPU objects. `dispose()` is idempotent. The host owns pointer events, animation, files, and the canvas element.

The v0 reader accepts only exact plain data fields, dense arrays, finite scalars and unique ASCII IDs (`[A-Za-z][A-Za-z0-9_-]{0,63}`). It rejects hidden fields, getters, symbols, foreign prototypes, cycles, unknown node kinds/fields, duplicate IDs, negative zero, and unsupported clips. JSON serialization supports those scalar values only. Duplicate JSON member names follow the host `JSON.parse` behavior; producers should use `stringifySceneJSON` to write canonical field order.

Limits: 256 nodes, 16 tree levels, 32 paths, at most 8 filled contours per path, 2–256 commands and at most 1,024 accepted segments per path, 16,384 total mask/cover/stroke/old draw vertices, subdivision depth 16, 1 MiB JSON/snapshot, authored coordinates and pan within ±1,000,000, composed world geometry within ±1,000,000,000, scale 0.01–100, rotation within ±2π, layers −1024–1024, stroke/line width at most 1,000, zoom 0.05–64, DPR 0.5–4, logical width/height 1–8192 integer pixels, at most 16 million backing pixels and actual WebGL size limits. RGBA channels are 0–1. The shader premultiplies output and uses `ONE, ONE_MINUS_SRC_ALPHA` blending.

Errors are `Canvas2DError` with `code`: `INVALID_SCENE`, `SCENE_LIMIT`, `INVALID_VIEW`, `INVALID_SIZE`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `DISPOSED`, `SERIALIZATION`, or `UNSUPPORTED_FEATURE`.

Run the bounded example from the repository root after building this package:

```sh
pnpm --dir packages/barocss-canvas2d build:library
node examples/canvas2d-scene/probe.mjs
node examples/canvas2d-scene/fill-probe.mjs
node examples/canvas2d-scene/server.mjs
```

Open the printed URL. The example draws two frames, colored rectangles, lines, a version 1 stroke and version 2 filled paths with visible control handles. It supports selection, drag, pan, zoom, v0/v1/v2 JSON Save/Open and control-point editing through this public API. Boolean operations, SVG parsing, text shaping, general masks, images, filters, blend modes, color-managed output, editor history, collaboration, and full design-tool behavior remain outside this prototype.
