# @barocss/canvas2d

Experimental retained WebGL2 renderer for bounded 2D scenes. It is configured as a public package, but this repository change does not publish it.

```js
import { createCanvas2D, parseSceneJSON, stringifySceneJSON } from '@barocss/canvas2d';

const renderer = createCanvas2D(canvas, {
  logicalSize: { width: 800, height: 480 },
  dpr: window.devicePixelRatio,
  maxDeviationDevicePx: 1,
});
renderer.setImageAsset('RGBA2', { width: 2, height: 2, pixels: rgbaBytes });
renderer.updateScene(parseSceneJSON(savedJSON));
renderer.setView({ panX: 0, panY: 0, zoom: 1 });
renderer.render();
const hit = renderer.hitTest({ x: 120, y: 120 });
const pathObservation = renderer.getPathObservation('PathRibbon');
const fillObservation = renderer.getFillObservation('FilledBadge');
const capabilities = renderer.getCapabilities();
const ownedImageBytes = renderer.getImageAsset('RGBA2');
const nextJSON = stringifySceneJSON(scene);
renderer.dispose();
```

The input scene is `{version:0|1|2|3|4|5, unit:'logical-px', contextId, nodes}`. Version 0 keeps the original `group`, `frame`, `rect`, and `line` nodes and refuses paths. Version 1 adds stroked `path` nodes. Version 2 adds independently optional path fill and stroke. Version 3 adds `image` nodes and otherwise retains version 2 node shapes. Version 4 adds `glyphRun` nodes and retains version 3 shapes. Version 5 adds `path.fill.rule:'nonzero'` and retains version 4 shapes. Every node has a stable `id`, integer `layer`, and explicit `{x,y,scaleX,scaleY,rotation}` transform. Groups and frames contain `children`. Frames and rectangles have positive `width` and `height` and a straight RGBA `fill`. Frames also have a Boolean `clip`. Lines have `x1`, `y1`, `x2`, `y2`, positive `width`, and straight RGBA `stroke`. See [the example scene](../../examples/canvas2d-scene/scene.mjs) for v0–v4 data and [the nonzero fixture](../../examples/canvas2d-scene/nonzero-v5.mjs) for v5.

Version 1 `path` nodes have `commands`, positive `width`, and straight RGBA `stroke`. Commands use absolute path-local logical pixels: `M {x,y}`, `L {x,y}`, `Q {cx,cy,x,y}`, `C {c1x,c1y,c2x,c2y,x,y}`, and `Z` with no coordinate fields. The first command is `M`; `L/Q/C` need an open subpath; `Z` closes it and requires a new `M` before further drawing. Each subpath must draw a nonzero segment. The reader copies exact authored controls and parameters. There is no SVG string parser.

Quadratic and cubic curves split by de Casteljau at command-parameter midpoints. Each accepted chord's control-polygon distance to the finite chord is at most `maxDeviationDevicePx` after the full transform, zoom, and DPR. The option defaults to 1 and accepts 0.25–4. `getPathObservation(id)` returns a copy of the accepted path samples with original command indexes, parameters in `[0,1]`, transformed world logical coordinates, segment/vertex counts and the maximum observed device-space control-polygon deviation. These are tessellation observations, not a global output-pixel or manufacturing precision certificate. View and DPR changes stage a new tessellation before replacing accepted state.

Stroke segments use butt caps and bevel joins, including closed joins. Accepted Float32 triangles drive both drawing and path hit testing. At self-crossings and overlaps, semi-transparent stroke triangles accumulate with the renderer's source-over blend. Version 1 paths have no fill or hole-winding rule.

Version 2 path nodes keep the same commands and use exact optional `fill: {color: RGBA, rule:'evenodd'}` and/or `stroke: {color: RGBA, width}` fields. At least one paint is required. Every filled subpath must close with `Z`; stroke-only paths may stay open. Version 0 and 1 keep their original path admission and JSON shape. An even-odd fill uses the accepted Float32 contours as a stencil parity mask, then composites its color once before an optional stroke. Nested holes, islands and self-crossings follow parity. CPU fill hit testing uses those Float32 contours; pixels at boundaries may differ from the mathematical predicate. A paint with zero alpha does not hit.

Version 5 also accepts `fill: {color: RGBA, rule:'nonzero'}`. Versions 2–4 still refuse this rule, so their admission and serialized shapes stay fixed. Every nonzero contour must be a closed simple ring with nonzero Float32 area. Contours may be disjoint or strictly nested, but self-crossing, backtracking, touching, and contour intersection are refused with `UNSUPPORTED_FEATURE` before state replacement. Same-direction nested rings remain filled; opposite-direction nested rings make a hole. The renderer counts signed triangle coverage with front/back stencil operations and composites once where the count is nonzero. CPU hit testing uses winding on the same accepted Float32 contours. A stencil buffer must have enough bits for the accepted contour count; 8 filled contours remain the maximum. This is bounded display geometry, not a Boolean or exact CAD predicate.

The renderer requests a stencil buffer when creating WebGL2. `getCapabilities()` reports `{stencil,stencilBits}` for the current context. If an existing context has no stencil bits, old scenes and strokes still work; a filled scene is rejected with `UNSUPPORTED_FEATURE` before replacing accepted state. `getFillObservation(id)` returns a copy of the filled path's world logical-pixel contour samples, segment count, mask/cover vertex counts and maximum observed device-space flattening deviation. Drawing and fill hit testing use matching Float32 coordinates; the returned samples preserve the original double-precision command parameters. A lost context reports no current stencil capability. Filled CPU data is retained and GPU objects are rebuilt after a supported restore.

Version 3 image nodes have exact fields `kind,id,layer,transform,imageId,width,height,opacity,sampling` and optional `sourceRect:{x,y,width,height}`. The source rectangle uses integer top-left source pixels and must fit inside the registered image. The image size is in logical pixels. Sampling is `nearest` or `linear`; crop edges clamp to source pixel centers. `setImageAsset(id,{width,height,pixels})` copies decoded top-to-bottom row-major RGBA8 bytes from an ordinary `Uint8Array`; `getImageAsset(id)` returns another copy or `null`. Asset IDs use the node ID syntax in a separate namespace. `removeImageAsset(id)` refuses while an accepted scene references the asset. The host decodes files and supplies pixels; the core never fetches URLs or accepts DOM images. A valid replacement stages CPU bytes and a new WebGL texture before swapping. Rejected input, missing assets, out-of-range crops and unsafe replacements preserve the accepted scene and prior frame.

Image output premultiplies sampled straight-alpha RGB and uses the same source-over blend. Image hit testing samples alpha through the accepted crop/filter/opacity and inverse node transform, then applies clips and reverse painter order. Exact boundary or device-raster equality is not promised. Owned textures are rebuilt from retained bytes after context restoration and deleted on replacement, removal and disposal. Scene JSON contains image IDs and crop data, **not** the pixel bytes. Cold reopening requires the host to register the corresponding asset bundle before `updateScene`.

Version 4 `glyphRun` nodes have exact fields `kind,id,layer,transform,atlasId,text,baseline,opacity,sampling,glyphs`. Text is 1–512 well-formed UTF-16 units. Each of 1–64 glyphs has `sourceRect:{x,y,width,height}`, `x,y,width,height,textStart,textEnd`. The source rectangle uses top-left integer pixels in a registered RGBA8 atlas. `x` is local to the run; glyph top is `baseline + y`. Text offsets use UTF-16 indexes at Unicode scalar boundaries and must span at least one scalar. Gaps and spaces need no glyph. The host supplies shaping, layout, and atlas bytes. The renderer draws glyphs in array order, samples alpha for hit testing, and reports the run ID. JSON saves atlas references and semantic text data, not atlas bytes. Cold reopening requires atlas registration. This contract does not decode fonts or provide shaping, IME, caret, or text layout.

Coordinates are logical pixels, with x right and y down. Rotation uses radians. A node transform is `parent × translate × rotate × scale`. The view maps world to viewport with `screen = pan + zoom × world`; DPR changes backing pixels only. Hit tests take viewport logical pixels and return the top visible drawable `{id,kind}` or `null`. Frames paint before children. Siblings paint by ascending layer, then input order. Hit tests reverse that order. Clips intersect and apply to drawing and hit tests. Only axis-aligned frame clips are supported; a frame clip with any rotated ancestor or own rotation is rejected.

The renderer copies accepted scene data and owns only its own WebGL program, buffer, vertex array, and context listeners. `updateScene`, `setView`, and `resize` do not draw automatically. A rejected update leaves the accepted scene, view, size, and prior frame in place. Context loss preserves CPU scene data; `render()` reports `CONTEXT_LOST` until restoration rebuilds the GPU objects. `dispose()` is idempotent. The host owns pointer events, animation, files, and the canvas element.

The v0 reader accepts only exact plain data fields, dense arrays, finite scalars and unique ASCII IDs (`[A-Za-z][A-Za-z0-9_-]{0,63}`). It rejects hidden fields, getters, symbols, foreign prototypes, cycles, unknown node kinds/fields, duplicate IDs, negative zero, and unsupported clips. JSON serialization supports those scalar values only. Duplicate JSON member names follow the host `JSON.parse` behavior; producers should use `stringifySceneJSON` to write canonical field order.

Limits: 256 nodes, 16 tree levels, 32 paths, 32 glyph runs, 1–64 glyphs per run, at most 8 filled contours per path, 2–256 commands and at most 1,024 accepted segments per path, 16,384 total mask/cover/stroke/rectangle/image/glyph vertices, subdivision depth 16, 1 MiB JSON/snapshot, at most 16 image assets and 32 MiB of copied RGBA8 bytes, asset width/height 1–4096 and actual WebGL texture limit, authored coordinates and pan within ±1,000,000, composed world geometry within ±1,000,000,000, scale 0.01–100, rotation within ±2π, layers −1024–1024, stroke/line width at most 1,000, zoom 0.05–64, DPR 0.5–4, logical width/height 1–8192 integer pixels, at most 16 million backing pixels and actual WebGL size limits. RGBA channels are 0–1. The shader premultiplies output and uses `ONE, ONE_MINUS_SRC_ALPHA` blending.

## Host document bundle

`@barocss/canvas2d/document` exports `serializeCanvasDocument(acceptedScene, getAsset)`, `parseCanvasDocument(text)`, and `stageCanvasDocument(text, freshCanvas, options)`. The format is one exact JSON object: `{format:'barocss-canvas-document',version:1,scene,assets}`. `scene` is a canonical Scene JSON **string**, so the Scene format itself remains asset-reference-only. `assets` contains only referenced image and glyph-atlas IDs, sorted by ID. Each entry has exact fields `{id,width,height,byteLength,sha256,pixelsBase64}`. The digest is lowercase hexadecimal SHA-256 of top-to-bottom straight RGBA8 bytes; base64 uses padded standard encoding. The adapter uses the host's Web Crypto implementation and does not fetch URLs or install a ZIP dependency.

Export copies the scene and bytes returned by `getAsset`. Parse validates the complete file, versions, fields, asset IDs/order/references, dimensions, encoded length, canonical base64 and digests before returning copied assets. The file limit is 48 MiB of UTF-8 text; decoded assets retain the renderer's 16-asset and 32-MiB limits. The Scene retains its 1-MiB limit. `stageCanvasDocument` registers verified assets, admits the scene and renders on a **fresh canvas**. If staging fails, it disposes that candidate. The host replaces its visible canvas and old renderer only after staging succeeds; do not pass the live canvas as the staging target. The [document example](../../examples/canvas2d-scene/document-v1.html) shows file download and Open with this swap. Plain Scene JSON Open is still available when the host registers referenced assets separately.

Errors are `Canvas2DError` with `code`: `INVALID_SCENE`, `SCENE_LIMIT`, `INVALID_VIEW`, `INVALID_SIZE`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `DISPOSED`, `SERIALIZATION`, `UNSUPPORTED_FEATURE`, `INVALID_ASSET`, `ASSET_LIMIT`, or `ASSET_IN_USE`.

Run the bounded example from the repository root after building this package:

```sh
pnpm --dir packages/barocss-canvas2d build:library
node examples/canvas2d-scene/probe.mjs
node examples/canvas2d-scene/fill-probe.mjs
node examples/canvas2d-scene/image-probe.mjs
node examples/canvas2d-scene/glyph-probe.mjs
node examples/canvas2d-scene/nonzero-probe.mjs
node examples/canvas2d-scene/svg-probe.mjs
node examples/canvas2d-scene/server.mjs
```

Open the printed URL. The main example draws two frames, colored rectangles, lines, version 2 filled paths, version 3 images, and a version 4 glyph run with visible path control handles. It supports selection, drag, pan, zoom, v0/v1/v2/v3/v4 JSON Save/Open with host-registered assets and control-point editing through this public API. Open `/examples/canvas2d-scene/nonzero-v5.html` for the winding comparison or `/examples/canvas2d-scene/svg-v5.html` for the bounded SVG file importer. Boolean operations, general SVG parsing, text shaping, general masks, filters beyond nearest/linear image sampling, blend modes, color-managed output, editor history, collaboration, and full design-tool behavior remain outside this prototype.

## Bounded SVG import

`importSVGElement(root)` translates an SVG namespace `Element` into `{scene: SceneV5, diagnostics}`. The host parses XML, supplies the root, and renders only the returned Canvas2D Scene. The importer neither fetches URLs nor uses SVG rendering as a fallback. The root requires unitless integer logical-pixel `width`/`height` and a finite `viewBox`. Default `xMidYMid meet` and explicit `preserveAspectRatio="none"` map through a transparent clipping frame and viewBox group. Only nested `g` and `path` elements are admitted. Their transforms may contain one ordered translate, rotate in degrees, and positive scale sequence; pivot rotation, matrix and skew refuse. Explicit SVG IDs must match Canvas IDs; missing IDs get deterministic collision-free names. Sibling order becomes layer order.

Path data supports explicit uppercase absolute M/L/Q/C/Z with one argument set per command. Path-local fill defaults to black, stroke to none. Paint supports `#RRGGBB` or `none`, `fill-rule` nonzero/evenodd, and separate `fill-opacity`/`stroke-opacity` in 0–1. Stroke needs an explicit bevel join and uses butt caps. Unsupported elements, attributes, relative/shorthand/arc commands, CSS, inherited group paint, external references, filters, text, images, negative scale and object opacity other than 1 refuse with a location and `UNSUPPORTED_FEATURE`. Scene v5 validation then enforces contour and resource limits. This is a declared import subset, not general SVG compatibility.
