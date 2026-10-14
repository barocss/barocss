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
const hitStack = renderer.hitTestAll({ x: 120, y: 120 }, 4);
const pathObservation = renderer.getPathObservation('PathRibbon');
const fillObservation = renderer.getFillObservation('FilledBadge');
const capabilities = renderer.getCapabilities();
const ownedImageBytes = renderer.getImageAsset('RGBA2');
const nextJSON = stringifySceneJSON(scene);
renderer.dispose();
```

Renderer options accept `backgroundColor: [r,g,b,a]`, using the existing straight RGBA channels in `[0,1]`. The default is transparent. `renderer.setBackgroundColor(color)` stores a copied tuple; call `render()` to show it. `getBackgroundColor()` returns a copy. The background fills the canvas independently of world pan/zoom and has no semantic hit. Resize and context restoration keep the value. It is host configuration: a saved Scene document excludes it, so supply it again in `stageCanvasDocument` or `exportCanvasDocumentPNG` options. The [compiled consumer](consumer/background.html) and [browser/file observation](consumer/evidence/background/observation.md) show the flow.

`hitTestAll(point, limit?)` returns fresh semantic hits in topmost-first order. It reports each node once, even when a path or glyph run has several draw records. The default limit is 16; an explicit limit must be a positive safe integer at most 16. It uses the same accepted scene, view, clip, sprite alpha and hit eligibility as `hitTest`. The host can choose a lower hit for selection cycling and pass it to `tree.dispatchPointer`. The [compiled hit-stack consumer](consumer/hit-stack.html) shows that route and a real v1 document reopen; [browser observations](consumer/evidence/hit-stack/observation.md) record the result.

`createPathBuilder()` makes path-local commands for the public display tree. The example below uses the renderer created above; the builder does not own paint or render a frame:

```js
import { createDisplayTree, createPathBuilder } from '@barocss/canvas2d';

const tree = createDisplayTree('Shapes');
const commands = createPathBuilder().rect(20, 20, 60, 60).build();
const shape = tree.createPath({ id: 'Rectangle', layer: 0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  commands, fill: { color: [1, 0, 0, 1], rule: 'evenodd' } });
tree.stage.addChild(shape);
renderer.updateScene(tree.snapshot());
renderer.render();
```

The builder also has chainable `moveTo`, `lineTo`, `quadraticCurveTo`, `bezierCurveTo`, `closePath`, `circle(cx,cy,radius)` and `clear`. A circle uses four cubic segments and is approximate. `build()` returns independent command objects. Invalid calls retain earlier commands. Path handles and renderer admission still check filled contours, tessellation, view and device limits. One path node has one fill and one stroke shared by its contours.

Scene v22 path fills also accept `fill: {rule:'evenodd',linear:{from:{x:0,y:0},to:{x:60,y:0},startColor:[1,0,0,1],endColor:[0,0,1,0]}}`. The two stops move with the path's local transform. A point with zero interpolated alpha lets semantic hits pass through. `setPath` edits the whole fill, and a v1 document can reopen it. This form is limited to two stops on path fills. The [compiled consumer](consumer/linear-fill.html) and [browser/file observation](consumer/evidence/linear-fill/observation.md) show the flow.
Scene v23 also accepts `fill: {rule:'evenodd',radial:{center:{x:30,y:25},radius:60,startColor:[1,0,0,1],endColor:[0,0,1,0]}}`. Radius uses path-local logical pixels. The circle follows the path transform and may appear elliptical under nonuniform scale. Zero interpolated alpha passes semantic hits through. Solid and linear fills remain valid. The [compiled consumer](consumer/radial-fill.html) and [browser/file observation](consumer/evidence/radial-fill/observation.md) show this bounded form.

`roundRect(x,y,width,height,radius)` adds one clockwise rounded rectangle with four approximate cubic corners. The single radius must be positive and at most half the smaller dimension; it is never clamped. Pass its commands to an existing path handle, and use `setPath` to edit the radius. The [compiled consumer](consumer/round-rect.html) and [browser/file observation](consumer/evidence/round-rect/observation.md) show this flow.

`ellipse(cx,cy,radiusX,radiusY)` adds one clockwise oval with four approximate cubic segments. Both radii must be positive, and equal radii produce the same commands as `circle`. Pass the commands to a path handle and use `setPath` to edit either radius. The [compiled consumer](consumer/ellipse.html) and [browser/file observation](consumer/evidence/ellipse/observation.md) show this flow.

`arc(cx,cy,radius,startAngle,sweepAngle)` starts a new open subpath and adds one to four approximate cubic segments. Angles use radians in y-down logical pixels: positive sweep is clockwise, negative is counterclockwise. Start angle is within ±2π and nonzero sweep is within ±2π. The call does not close the path or add a center line. For a filled sector, add `lineTo(cx,cy).closePath()`. Invalid coordinates, radius, angles, computed controls or an arc that rounds to empty geometry leave prior commands intact. The [compiled arc consumer](consumer/arc.html) checks stroke/fill pixels, hits, pointer routing and a fresh-canvas v1 document Open.

`polygon(points)` starts one closed subpath from 3–128 exact logical-pixel `{x,y}` vertices in input order. It emits `M`, then `L` commands and `Z`; it does not infer a hull or test Boolean validity. The builder copies points. Sparse, extra-key, getter or foreign arrays, invalid points and repeated closing/adjacent vertices refuse atomically. Existing path fill and hit rules apply to concave or self-intersecting contours. The [compiled polygon consumer](consumer/polygon.html) checks a concave fill, hit/pointer routing and a fresh-canvas v1 document Open/edit.

`polyline(points)` starts one open subpath from 2–128 exact logical-pixel `{x,y}` vertices. It emits `M` and ordered `L` commands without `Z`; call `closePath()` explicitly to close it. The builder copies points and refuses sparse, extra-key, getter or foreign arrays, invalid points, repeated adjacent points and a repeated first/last point without changing prior commands. It does not simplify or smooth the line. The path can use a stroke; the [compiled polyline consumer](consumer/polyline.html) checks both segments, hits, pointer routing and a fresh-canvas v1 document Open/edit.

Scene v18 path strokes require `{color,width,cap}` with `cap` equal to `butt`, `square` or `round`. Public `createPath` and `setPath` accept an omitted cap and write `butt` to the current Scene v29 snapshot. The preserved stroke-cap consumer records the original v18 behavior. Caps affect only open subpath endpoints; closed paths retain bevel joins. Square extends half the local stroke width along the endpoint tangent. Round uses bounded adaptive semicircle triangles. Pixels, semantic hits and bounds include caps. Scene v0–v17 retain their exact stroke fields and butt behavior. Editable reconstruction accepts v6–v29 and produces v29 snapshots; v0–v5 reconstruction remains unsupported. The v1 document envelope is unchanged. The SVG importer returns its declared Scene v5 subset. The exporter accepts Scene v5 and the solid group/path subset of current Scene v29. The [compiled stroke-cap consumer](consumer/stroke-cap.html) checks three cap styles, a transformed cap, pointer routing and a fresh-canvas document Open/edit.

Scene v19 path strokes also require `join:'bevel'|'round'`. Public path handles accept an omitted join and write `bevel` to the snapshot; they still accept an omitted cap and write `butt`. Round joins fill the exterior of each turn, including a closed path's seam. A reversal makes a disk at its vertex. Straight vertices add no join. The renderer bounds round sectors by device-pixel tolerance and rejects work that exceeds its segment or vertex limits. Scene v0–v18 retain their exact stroke fields and bevel behavior. The [compiled round-join consumer](consumer/round-join.html) checks pixels, hits, pointer routing and a fresh-canvas document Open/edit.

`decodeImageBlob(file)` accepts a host-provided PNG, JPEG or WebP `Blob` in a browser and returns `{width,height,pixels}` for `renderer.setImageAsset(id, asset)`. The host chooses the ID and owns file selection. The helper does no network request or caching. Input is limited to 8 MiB encoded, 4096 pixels per side and 32 MiB decoded RGBA8. Returned pixels are browser-decoded 2D-canvas values, so source-file bytes, ICC/HDR color and EXIF orientation are not guaranteed across browsers. A rejected file does not change renderer state.

`loadImageURL(url, {signal?,fetcher?})` fetches one absolute HTTP(S) PNG/JPEG/WebP URL without embedded credentials and returns the same owned RGBA8 shape. It uses a CORS GET with omitted credentials and no-store cache policy. It checks an advisory response length and enforces the 8-MiB encoded limit while streaming, then calls `decodeImageBlob`; its decoded limits still apply. The caller supplies the asset ID and registers pixels. Invalid URL, network/HTTP/stream failure, unsupported MIME and resource limits report the declared errors; abort reports `AbortError`. No cache, retry, cross-origin bypass, renderer mutation or document change is implicit. The [compiled URL consumer](consumer/image-url.html) and [browser/file observation](consumer/evidence/image-url/observation.md) cover a same-origin example.

`createImageAssetCache({maxEntries?,maxBytes?,fetcher?})` keeps decoded URL rasters in a host-owned CPU cache. `load(url)` coalesces concurrent requests for the same canonical HTTP(S) URL and returns fresh RGBA8 bytes on every call. `get(url)` returns another copy and refreshes recency. `delete(url)`, `clear()` and `dispose()` remove resident bytes and cancel affected pending requests. Read-only `size` and `byteLength` count resident entries and bytes. Defaults and maxima are 16 entries and 32 MiB; options may lower them to positive safe integers. At most `maxEntries` distinct URLs may load concurrently. A new success evicts least-recently-used entries until it fits; an oversized result refuses without eviction. A fragment does not change the key, but a query does. Cancellation produces `AbortError`, and operations after disposal report `DISPOSED`. The cache never registers renderer IDs or owns GPU textures, sprites or files. The [compiled cache consumer](consumer/image-cache.html) and [browser/file observation](consumer/evidence/image-cache/observation.md) cover one same-origin example.

The input scene is `{version, unit:'logical-px', contextId, nodes}`, where `version` is an integer from 0 through 29. Each version keeps its declared field contract; validation does not upgrade the input version. Version 0 keeps the original `group`, `frame`, `rect`, and `line` nodes and refuses paths. Version 1 adds stroked `path` nodes. Version 2 adds independently optional path fill and stroke. Version 3 adds `image` nodes and otherwise retains version 2 node shapes. Version 4 adds `glyphRun` nodes and retains version 3 shapes. Version 5 adds `path.fill.rule:'nonzero'` and retains version 4 shapes. Version 6 adds image anchors and retains version 5 shapes for other nodes. Version 7 adds a required normalized image RGB tint and retains version 6 shapes for other nodes. Version 8 adds required image blend mode `normal` or `add` and retains version 7 shapes for other nodes. Version 9 adds required Boolean `visible` to every node kind, including descendants. Version 10 adds required numeric `alpha` in `[0,1]` to every node kind; older versions retain their exact shapes and use effective alpha 1. Every node has a stable `id`, integer `layer`, and explicit `{x,y,scaleX,scaleY,rotation}` transform. Groups and frames contain `children`. Frames and rectangles have positive `width` and `height` and a straight RGBA `fill`. Frames also have a Boolean `clip`. Lines have `x1`, `y1`, `x2`, `y2`, positive `width`, and straight RGBA `stroke`. See [the example scene](../../examples/canvas2d-scene/scene.mjs) for v0–v4 data, [the nonzero fixture](../../examples/canvas2d-scene/nonzero-v5.mjs) for v5, [the anchor fixture](../../examples/canvas2d-scene/anchor-scene.mjs) for v6, [the tint probe](../../examples/canvas2d-scene/sprite-tint-probe.mjs) for v7 and [the blend probe](../../examples/canvas2d-scene/sprite-blend-probe.mjs) for v8. [The visibility probe](../../examples/canvas2d-scene/visibility-probe.mjs) checks v9, and [the alpha probe](../../examples/canvas2d-scene/alpha-probe.mjs) checks v10 and older-version reconstruction.

Version 1 `path` nodes have `commands`, positive `width`, and straight RGBA `stroke`. Commands use absolute path-local logical pixels: `M {x,y}`, `L {x,y}`, `Q {cx,cy,x,y}`, `C {c1x,c1y,c2x,c2y,x,y}`, and `Z` with no coordinate fields. The first command is `M`; `L/Q/C` need an open subpath; `Z` closes it and requires a new `M` before further drawing. Each subpath must draw a nonzero segment. The reader copies exact authored controls and parameters. There is no SVG string parser.

Quadratic and cubic curves split by de Casteljau at command-parameter midpoints. Each accepted chord's control-polygon distance to the finite chord is at most `maxDeviationDevicePx` after the full transform, zoom, and DPR. The option defaults to 1 and accepts 0.25–4. `getPathObservation(id)` returns a copy of the accepted path samples with original command indexes, parameters in `[0,1]`, transformed world logical coordinates, segment/vertex counts and the maximum observed device-space control-polygon deviation. These are tessellation observations, not a global output-pixel or manufacturing precision certificate. View and DPR changes stage a new tessellation before replacing accepted state.

Stroke segments use butt caps and bevel joins, including closed joins. Accepted Float32 triangles drive both drawing and path hit testing. At self-crossings and overlaps, semi-transparent stroke triangles accumulate with the renderer's source-over blend. Version 1 paths have no fill or hole-winding rule.

Version 2 path nodes keep the same commands and use exact optional `fill: {color: RGBA, rule:'evenodd'}` and/or `stroke: {color: RGBA, width}` fields. At least one paint is required. Every filled subpath must close with `Z`; stroke-only paths may stay open. Version 0 and 1 keep their original path admission and JSON shape. An even-odd fill uses the accepted Float32 contours as a stencil parity mask, then composites its color once before an optional stroke. Nested holes, islands and self-crossings follow parity. CPU fill hit testing uses those Float32 contours; pixels at boundaries may differ from the mathematical predicate. A paint with zero alpha does not hit.

Version 5 also accepts `fill: {color: RGBA, rule:'nonzero'}`. Versions 2–4 still refuse this rule, so their admission and serialized shapes stay fixed. Every nonzero contour must be a closed simple ring with nonzero Float32 area. Contours may be disjoint or strictly nested, but self-crossing, backtracking, touching, and contour intersection are refused with `UNSUPPORTED_FEATURE` before state replacement. Same-direction nested rings remain filled; opposite-direction nested rings make a hole. The renderer counts signed triangle coverage with front/back stencil operations and composites once where the count is nonzero. CPU hit testing uses winding on the same accepted Float32 contours. A stencil buffer must have enough bits for the accepted contour count; 8 filled contours remain the maximum. This is bounded display geometry, not a Boolean or exact CAD predicate.

The renderer requests a stencil buffer when creating WebGL2. `getCapabilities()` reports `{stencil,stencilBits}` for the current context. If an existing context has no stencil bits, old scenes and strokes still work; a filled scene is rejected with `UNSUPPORTED_FEATURE` before replacing accepted state. `getFillObservation(id)` returns a copy of the filled path's world logical-pixel contour samples, segment count, mask/cover vertex counts and maximum observed device-space flattening deviation. Drawing and fill hit testing use matching Float32 coordinates; the returned samples preserve the original double-precision command parameters. A lost context reports no current stencil capability. Filled CPU data is retained and GPU objects are rebuilt after a supported restore.

Version 3 image nodes have exact fields `kind,id,layer,transform,imageId,width,height,opacity,sampling` and optional `sourceRect:{x,y,width,height}`. The source rectangle uses integer top-left source pixels and must fit inside the registered image. The image size is in logical pixels. Sampling is `nearest` or `linear`; crop edges clamp to source pixel centers. `setImageAsset(id,{width,height,pixels})` copies decoded top-to-bottom row-major RGBA8 bytes from an ordinary `Uint8Array`; `getImageAsset(id)` returns another copy or `null`. Asset IDs use the node ID syntax in a separate namespace. `removeImageAsset(id)` refuses while an accepted scene references the asset. The host decodes files and supplies pixels; the core never fetches URLs or accepts DOM images. A valid replacement stages CPU bytes and a new WebGL texture before swapping. Rejected input, missing assets, out-of-range crops and unsafe replacements preserve the accepted scene and prior frame.

Version 6 image nodes require `anchorX` and `anchorY`, each a finite number from 0 to 1. The destination image rectangle shifts by `(-anchorX × width, -anchorY × height)` before its node transform, so `transform.x/y` locates the anchor in the parent. `(0,0)` retains the v3–v5 top-left placement; `(0.5,0.5)` centers the image on the transform. The crop still selects source pixels and does not change the destination anchor. Drawing and alpha hit testing use the same shifted rectangle and inverse transform. Versions 0–5 reject anchor fields, and v6 rejects missing or invalid anchors without replacing accepted state. [The browser fixture](../../examples/canvas2d-scene/anchor-v6.html) covers rotation, transparent pixels, old placement, refusal, and a cold v1 document Open. This is a retained image node, not a mutable Sprite or ticker API.

Image output premultiplies sampled straight-alpha RGB. Scene v0–v7 images use source-over; Scene v8 images select normal source-over or bounded additive blending. Image hit testing samples alpha through the accepted crop/filter/opacity and inverse node transform, then applies clips and reverse painter order. Exact boundary or device-raster equality is not promised. Owned textures are rebuilt from retained bytes after context restoration and deleted on replacement, removal and disposal. Scene JSON contains image IDs and crop data, **not** the pixel bytes. Cold reopening requires the host to register the corresponding asset bundle before `updateScene`.

Version 4 `glyphRun` nodes have exact fields `kind,id,layer,transform,atlasId,text,baseline,opacity,sampling,glyphs`. Text is 1–512 well-formed UTF-16 units. Each of 1–64 glyphs has `sourceRect:{x,y,width,height}`, `x,y,width,height,textStart,textEnd`. The source rectangle uses top-left integer pixels in a registered RGBA8 atlas. `x` is local to the run; glyph top is `baseline + y`. Text offsets use UTF-16 indexes at Unicode scalar boundaries and must span at least one scalar. Gaps and spaces need no glyph. The host supplies shaping, layout, and atlas bytes. The renderer draws glyphs in array order, samples alpha for hit testing, and reports the run ID. JSON saves atlas references and semantic text data, not atlas bytes. Cold reopening requires atlas registration. This contract does not decode fonts or provide shaping, IME, caret, or text layout.

Coordinates are logical pixels, with x right and y down. Rotation uses radians. A node transform is `parent × translate × rotate × scale`. The view maps world to viewport with `screen = pan + zoom × world`; DPR changes backing pixels only. Hit tests take viewport logical pixels and return the top visible drawable `{id,kind}` or `null`. Frames paint before children. Siblings paint by ascending layer, then input order. Hit tests reverse that order. Clips intersect and apply to drawing and hit tests. Scene v24 also supports transformed rectangular frame clips. Child paint and spatial hits must lie inside every ancestor rectangle in that frame's local coordinates, using its complete world inverse (including rotation, signed/nonuniform scale, pivot and composed shear). Earlier Scene v0–v23 retain their rotated-clip refusal. Frame fill/hit uses only inherited clips; its own clip gates children.

`renderer.viewportToWorld(point)` and `renderer.worldToViewport(point)` return new logical-pixel points using the currently accepted pan and zoom. They also convert off-canvas points. A successful `setView` changes the conversion immediately; DPR does not change it. Use `viewportToWorld` before a display handle's `toLocal` when processing a canvas pointer. Invalid input returns `INVALID_SCENE`, and a computed result outside the supported world range returns `SCENE_LIMIT`. A disposed renderer returns `DISPOSED`. [The compiled renderer point consumer](consumer/renderer-point-conversion.html) checks pixels, hits, a real pointer and v1 document Open on a fresh canvas.

The renderer copies accepted scene data and owns only its own WebGL program, buffer, vertex array, and context listeners. `updateScene`, `setView`, and `resize` do not draw automatically. A rejected update leaves the accepted scene, view, size, and prior frame in place. Context loss preserves CPU scene data; `render()` reports `CONTEXT_LOST` until restoration rebuilds the GPU objects. `dispose()` is idempotent. The host owns pointer events, animation, files, and the canvas element.

The v0 reader accepts only exact plain data fields, dense arrays, finite scalars and unique ASCII IDs (`[A-Za-z][A-Za-z0-9_-]{0,63}`). It rejects hidden fields, getters, symbols, foreign prototypes, cycles, unknown node kinds/fields, duplicate IDs, negative zero, and unsupported clips. JSON serialization supports those scalar values only. Duplicate JSON member names follow the host `JSON.parse` behavior; producers should use `stringifySceneJSON` to write canonical field order.

Limits: 256 nodes, 16 tree levels, 32 paths, 32 glyph runs, 1–64 glyphs per run, at most 8 filled contours per path, 2–256 commands and at most 1,024 accepted segments per path, 16,384 total mask/cover/stroke/rectangle/image/glyph vertices, subdivision depth 16, 1 MiB JSON/snapshot, at most 16 image assets and 32 MiB of copied RGBA8 bytes, asset width/height 1–4096 and actual WebGL texture limit, authored coordinates and pan within ±1,000,000, composed world geometry within ±1,000,000,000, scale 0.01–100, rotation within ±2π, layers −1024–1024, stroke/line width at most 1,000, zoom 0.05–64, DPR 0.5–4, logical width/height 1–8192 integer pixels, at most 16 million backing pixels and actual WebGL size limits. RGBA channels are 0–1. The shader premultiplies output and uses `ONE, ONE_MINUS_SRC_ALPHA` blending.

## Public display tree subset

`createDisplayTree(contextId)` returns a stable `stage` root, `createContainer(spec)`, `createSprite(spec)`, `createPath(spec)`, `createRect(spec)`, `createGlyphRun(spec)`, `createFrame(spec)`, `createLine(spec)`, `get(id)`, and `snapshot()`. The stage is not serialized. A container maps to a Scene group, a sprite to an image with required `anchorX/Y`, a path to v5-compatible vector data, a rectangle to a Scene rectangle, a glyph run to host-shaped atlas quads, a frame to a filled parent with optional child clipping, and a line to a finite stroke. Stage, containers and frames support `addChild`, `removeChild` and `setChildIndex`. Handles expose copied `data` and explicit `setTransform`/`setLayer` methods. Containers also have `setHitArea`; sprites have `setAnchor`/`setOpacity`/`setTint`/`setBlendMode`/`setSampling`/`setSourceRect`/`setImageSource`/`setSize`/`setSlice`/`setTile`/`setHitArea`, paths have `setPath`, rectangles have `setRect({width,height,fill})`, glyph runs have `setLayout({atlasId,text,baseline,opacity,sampling,glyphs})`, frames have `setFrame({width,height,fill,clip})`, and lines have `setLine({x1,y1,x2,y2,width,stroke})`. Each mutation validates the candidate tree before replacing handle state. A child may have one parent; cross-tree handles, cycles, duplicate attached IDs, bad scalars, and resource-limit violations refuse without changing membership, order or data. Removed handles can be attached again. `get(id)` finds only attached handles and returns `null` for an absent ID; an invalid ID refuses with `INVALID_SCENE`. Equal-layer children paint in their current list order.

`parent.setChildIndex(child,index)` moves a directly attached child to its final zero-based position in `parent.children`. The method retains the child's handle, data, descendants and pointer listeners. The index must be an integer from zero to `children.length - 1`; negative zero, invalid indexes and non-child handles refuse with `INVALID_SCENE` and retain the prior order. A move within the same layer changes paint and reverse hit order after the host submits a snapshot. Layer priority remains unchanged. The [compiled child order consumer](consumer/child-order.html) and [browser/file observation](consumer/evidence/child-order/observation.md) show a move, rejection and a later move on a reconstructed handle.

`sprite.setSourceRect({x,y,width,height})` selects an integer pixel crop from the registered image; `sprite.setSourceRect(null)` restores the full image. The destination size, anchor, layer and ID do not change. The handle validates the crop shape and range. The renderer checks it against actual asset dimensions on scene submission; an out-of-bounds crop returns `INVALID_ASSET` and retains the prior accepted frame. The host owns the atlas, frame timing, submission and any handle rollback. The [compiled crop consumer](consumer/sprite-crop.html) and [browser/file observation](consumer/evidence/sprite-crop/observation.md) show crop changes, refusal and cold Open into a new editable handle.

Scene v11 adds required `hitMode` to every node. Scene v12 adds optional image `slice: {left,right,top,bottom}`. A sliced sprite needs an explicit integer-pixel `sourceRect`; source and destination centers must remain positive after subtracting the insets. Its up to nine quads keep one semantic image ID, and each border uses its source-pixel inset as its logical width or height before the sprite transform. `sprite.setSlice(null)` returns to one quad. Invalid combined size, crop or slice edits leave the handle unchanged. Existing Scene versions keep their exact field sets. The [compiled nine-slice consumer](consumer/nine-slice.html) and [browser/file observation](consumer/evidence/nine-slice/observation.md) show a fixed-border resize and a real v1 document reopen.

Scene v13 adds optional image `tile: {width,height,offsetX,offsetY}`. A tiled sprite repeats its explicit integer-pixel source crop across the authored destination size. Cell width and height are finite logical pixels in `[1,4096]`; finite offsets are in `[-1000000,1000000]`. Partial edge cells use proportional crop UVs. The tiled surface keeps one semantic image ID and uses sampled alpha for hits. `slice` and `tile` cannot coexist; `setTile(null)` returns to one quad. Invalid combined edits refuse before changing the handle, and more than 16,384 scene vertices refuse before replacing the accepted renderer frame. Scene v0–v12 retain their field sets. The [compiled tiled sprite consumer](consumer/tiled-sprite.html) and [browser/file observation](consumer/evidence/tiled-sprite/observation.md) show resize, offset, pointer and v1 document reopen.

Scene v14 adds optional `pivot: {x,y}` to every node. Each coordinate must be finite, within ±1,000,000 and not negative zero. An omitted pivot means `(0,0)`. The local matrix is `T(position) · R(rotation) · S(scale) · T(-pivot)`; parent transforms follow outside this matrix. Sprite anchors still position image geometry in local coordinates. Every public non-stage handle has atomic `setPivot(x,y)` and copied `data.pivot`; `setPivot(0,0)` retains an explicit zero pivot. Scene v0–v13 reject the new field and keep their exact field sets. The v1 document envelope is unchanged. [The compiled pivot consumer](consumer/pivot.html) checks rectangle, sprite, parent and clipped-frame pixels, bounds, hits, pointer routes and actual document Open into fresh editable handles.

Scene v15 permits signed `transform.scaleX` and `transform.scaleY` with absolute values in `[0.01,100]`. Negative X or Y reflects the object around its local axis using the existing pivot matrix; zero, negative zero, nonfinite and out-of-range values refuse with `INVALID_SCENE`. The public `setScale` and `setTransform` apply this rule atomically. Scene v0–v14 remain positive-only. Editable reconstruction accepts v6–v29 and produces v29 snapshots. The v1 document envelope is unchanged. [The compiled signed-scale consumer](consumer/signed-scale.html) checks asymmetric image pixels, mirrored parent, clipped frame and path hole, hits, pointer routing and actual document Open into fresh editable handles. Source RGBA8 bytes remain unchanged.

Scene v16 adds optional image-only `hitArea: {x,y,width,height}` in sprite-local logical coordinates before anchor translation. Its half-open rectangle replaces sampled-alpha hit eligibility, including transparent texels and points beyond painted pixels. It leaves paint, image bytes and local/world bounds unchanged. Parent transforms, pivot, frame clip, visibility, inherited alpha, opacity and hit mode still apply. `SpriteHandle.setHitArea(rect)` sets it; `setHitArea(null)` restores sampled-alpha hits. Coordinates must be finite within ±1,000,000, and width and height must be positive and at most 1,000,000. Invalid fields return `INVALID_SCENE`; a composed area beyond the world limit returns `SCENE_LIMIT` at renderer admission. Scene v0–v15 reject this field. [The compiled sprite hit-area consumer](consumer/sprite-hit-area.html) checks real WebGL2 pixels, hits, pointer routes, refusals and v1 document Open into a fresh editable tree.

Scene v17 adds optional group-only `hitArea` with the same bounded local rectangle format. It adds one semantic group hit before its children in paint order without painting, clipping children, changing assets or enlarging painted bounds. A child hit wins over its group; a group hit in an empty gap wins over lower siblings. Children outside the group area still hit. An empty group can hit its area while its bounds stay `null`. `ContainerHandle.setHitArea(rect)` sets the area atomically, and `setHitArea(null)` removes it. Canvas bounds, view, inherited frame clips, visibility, alpha and hit mode still gate hits. Scene v0–v16 reject group areas; malformed areas return `INVALID_SCENE`, and composed areas outside the world range return `SCENE_LIMIT` at renderer admission. [The compiled container hit-area consumer](consumer/container-hit-area.html) checks WebGL2 pixels, child/group hit order, pointer routes and actual v1 document Open into a fresh editable tree.

`snapshot()` returns an independent validated Scene v29 value. `createDisplayTreeFromScene(scene)` validates Scene v6–v29 and returns a new v29 tree with new handles for group, frame, image, path, rectangle, glyph run and line nodes. Older inputs gain the default fields introduced by later versions. Scene v0–v5 reconstruction refuses with `UNSUPPORTED_FEATURE`; malformed input keeps its validator error. Assets remain host-owned and are not loaded by this function. Old handles are never rebound. The host explicitly calls `renderer.updateScene(tree.snapshot())` and `renderer.render()` after edits. Tree mutations do not alter the renderer's accepted scene or GPU resources. The [compiled consumer](consumer/display-tree.html) stages a document on a fresh canvas, reconstructs handles, and swaps live state only after both steps succeed. Its [file and browser observation](consumer/evidence/display-tree-reopen/observation.md) records the bounded roundtrip.

`tree.reparentChild(child,target,index)` moves an attached handle to a different attached stage, container or frame in the same tree. The target index is the final zero-based insertion position, from zero through the target's current child count. The child keeps its local transform, layer, descendants, identity and pointer listeners; its world position and future pointer ancestry can change with the new parent. Detached or foreign handles, same-parent moves, cycles and invalid indexes refuse with `INVALID_SCENE`. A failed Scene validation restores both parents' exact child order and parentage. The host submits a new snapshot and renders explicitly. The [compiled reparent consumer](consumer/reparent.html) and [browser/file observation](consumer/evidence/reparent/observation.md) show the move, refusal and cold Open into a new editable tree.

`SpriteHandle.setSize(width, height)` edits both Scene v7 destination dimensions in one validated mutation. Each is a positive finite logical-pixel number at most 1,000,000; fractional values are accepted. Invalid values leave both dimensions and the tree unchanged. The edit preserves sprite identity, source crop, anchor, registered image bytes and pointer listeners. The host submits the new snapshot and renders explicitly. The [compiled sprite size consumer](consumer/sprite-size.html) and [browser/file observation](consumer/evidence/sprite-size/observation.md) cover pixels, alpha-aware hits, pointer delivery and document reconstruction.

`createSpriteAnimation(sprite,frames,options?)` selects a copied, bounded sequence of 1–64 `{imageId,sourceRect?,durationMS}` frames on one public sprite. Durations are integer milliseconds from 1 through 60,000. Options select `loop` (default true) and `initialFrameIndex` (default 0). The returned controller starts paused and exposes `frameIndex`, `playing`, `finished`, `play()`, `pause()`, `seek(index)`, `advance(deltaMS)` and `dispose()`. An advance accepts 0–1,000 finite milliseconds, crosses exact frame boundaries and returns true when the frame index changes. One-shot playback stops after the last frame's duration; `seek` resets completion. Invalid sequence, index or delta refuses with `INVALID_SCENE`. A refused sprite source mutation leaves controller time and index unchanged. The host supplies ticker time, registers assets, submits the tree snapshot and renders. The controller owns no scheduler, renderer, asset bytes or document format; a v1 document saves only the current image ID/crop. The [compiled animation consumer](consumer/sprite-animation.html) and [browser/file observation](consumer/evidence/sprite-animation/observation.md) show a manual ticker, pixel/hit changes and cold Open into a new controller.

`SpriteHandle.setImageSource(imageId, sourceRect?)` changes the Scene v7 asset reference and optional crop in one validated edit. Omitting the crop or passing `null` clears the previous crop. Invalid ID/crop data leaves both fields unchanged. The handle has no asset registry: the host registers bytes with the renderer before submitting the new snapshot, and a missing asset or out-of-bounds crop refuses there with `INVALID_ASSET` while the previous accepted frame remains. The host restores a valid handle source before resubmission. The edit preserves the sprite's ID, destination geometry, transform, anchor, opacity, layer, parent and pointer listeners; it does not fetch or own bytes. The [compiled image source consumer](consumer/sprite-image-source.html) and [browser/file observation](consumer/evidence/sprite-image-source/observation.md) cover source switching, asset release, refusal and document reconstruction.

`SpriteHandle.setSampling('nearest' | 'linear')` changes one sprite's filter without changing its image asset or other Scene data. The edit is validated before mutation; other values return `INVALID_SCENE`. A later snapshot, renderer submission and v1 document preserve the selected filter. The [compiled sampling consumer](consumer/sprite-sampling.html) shows a nearest/linear switch, pointer delivery and a cold document Open.

`SpriteHandle.setBlendMode('normal' | 'add')` changes one Scene v8 sprite's blend operation. The handle defaults to normal. Normal uses premultiplied source-over; add uses WebGL2 `FUNC_ADD` with `(ONE, ONE)` factors for RGB and alpha, clamped by the framebuffer. Following draws return to normal. Scene v0–v7 images render as normal without changing their parsed data. Alpha-based hit testing does not use the blend result. Invalid modes return `INVALID_SCENE` before mutation. The host retains its image bytes and canvas. The [compiled blend consumer](consumer/sprite-blend.html) and [browser/file observation](consumer/evidence/sprite-blend/observation.md) cover pixels, pointer routing and cold document Open.

## Public pointer delivery subset

Stage, container, frame, sprite, path, rectangle, glyph run and line handles expose `onPointer(type, listener)`, which returns an idempotent unsubscribe function. `tree.dispatchPointer({type,pointerId,point,hit})` accepts `pointerdown`, `pointerup`, `pointermove` and `pointercancel`. The host converts its input to logical pixels and passes the current `renderer.hitTest(point)` result after submitting the latest tree snapshot. An image, path, rectangle, frame, glyph run or line hit routes to its attached handle, parent handles and stage in that order; a null hit routes only to stage. Each listener receives a copied point, pointer ID, stable target and current handles, and `stopPropagation()`. Same-handle listeners run in registration order; stopping prevents later ancestors but allows remaining same-handle listeners. The route and listeners are captured at dispatch entry, so mutations during a callback affect the next dispatch. Dispatch does not alter the Scene or render a frame.

`tree.capturePointer(pointerId, handle)` explicitly routes later pointer events to an attached handle in the same tree, even when the spatial hit changes or becomes null. It holds at most 16 pointer IDs. `getPointerCapture(pointerId)` returns the handle or null; `releasePointer(pointerId)` is idempotent. `pointerup` and `pointercancel` release capture after delivery, even if a listener throws. Detaching a captured handle or its ancestor releases capture; reparenting changes the next ancestor route. A captured handle remains the pointer target while hidden or hit-disabled. Invalid IDs and foreign, stage or detached handles refuse with `INVALID_SCENE`; the 17th distinct capture refuses with `SCENE_LIMIT`. The host still supplies a current valid hit and owns browser DOM pointer capture. Hover uses the spatial hit. See the [compiled capture consumer](consumer/pointer-capture.html) and [browser/file observation](consumer/evidence/pointer-capture/observation.md).

Each display handle also exposes `onHover('pointerenter' | 'pointerleave', listener)`; the stage has no hover listener. The host calls `tree.dispatchHover({pointerId,point,hit})` with a logical point and the current renderer hit after submitting the latest snapshot. `hit: null` clears that pointer. The tree tracks at most 16 active pointer routes. On a route change it calls leave listeners from old leaf to old parent, then enter listeners from new parent to new leaf; shared ancestors stay silent. Hover events have a frozen copied point and `target` and `currentTarget` both name the entered or left handle. These events do not bubble. Invalid, detached, hidden, transparent or hit-disabled claimed targets are refused before the route changes. Removing or reparenting a hovered object clears affected routes without callbacks. The host must send a null hit on canvas exit or cancel and owns DOM listener installation and DOM pointer capture. Hover does not change Scene or document data. See `consumer/hover.html` for a live WebGL2 consumer.

Malformed input or a stale/detached hit refuses with `INVALID_SCENE` before any callback; valid renderer hit kinds without a public handle refuse with `UNSUPPORTED_FEATURE`. Registrations are limited to 32 per event type per handle (`SCENE_LIMIT`). A listener exception ends the dispatch and reaches the host. A plain hit has no renderer identity or Scene revision; the host must use the current renderer after submitting the current tree. DOM listeners, CSS scaling, DOM pointer capture, event modes, keyboard, wheel and ticking remain host-owned or outside this subset. The [compiled pointer consumer](consumer/pointer.html) and its [browser/file observation](consumer/evidence/pointer/observation.md) show the base contract with real pointer events and document Open.

## Public rectangle handle

`tree.createRect({id,layer,transform,width,height,fill})` returns a `RectHandle` with stable identity and copied Scene v7 data. `setRect({width,height,fill})` validates the complete replacement before changing size or color. Width and height are positive logical pixels up to 1,000,000; RGBA channels are 0–1. The handle joins the same stage/container order, semantic hit route and v1 document reconstruction as paths and sprites. It does not create an asset, own a renderer or draw until the host submits a snapshot and renders. The [compiled rectangle consumer](consumer/rect.html) and [actual browser/file observation](consumer/evidence/rect/observation.md) cover overlap, resize, pointer delivery, refusal and cold Open.

## Public glyph run handle

`tree.createGlyphRun({id,layer,transform,atlasId,text,baseline,opacity,sampling,glyphs})` returns a `GlyphRunHandle` with copied Scene v7 data. `setLayout({atlasId,text,baseline,opacity,sampling,glyphs})` validates a complete replacement before accepting it. The host shapes text, builds and registers the atlas, and submits the tree snapshot. The handle does not load fonts, lay out text, own atlas bytes or edit DOM text. Existing Scene limits apply, including 32 runs, 1–64 quads per run and 512 UTF-16 units of semantic text. Renderer submission checks atlas presence and crop bounds. The [compiled glyph consumer](consumer/glyph.html) and [browser/file observation](consumer/evidence/glyph/observation.md) show one fixed H/I atlas, hit delivery, layout edit and cold Open.

## Public frame container handle

`tree.createFrame({id,layer,transform,width,height,fill,clip})` returns a `FrameHandle` with copied current Scene v29 data and ordered child methods. `setFrame({width,height,fill,clip})` validates the complete frame replacement before accepting it. Width and height are positive logical pixels up to 1,000,000; fill channels are 0–1. The current public tree emits Scene v29 and permits rotated clips. Scene v24 introduced transformed frame clipping; earlier versions retain their clip restrictions. Older Scene inputs retain their exact rotation refusal. The existing renderer clips descendants to the frame bounds when `clip:true`; its own fill and semantic hit follow the existing Scene rules. The host explicitly submits the snapshot and owns canvas and file state. The [compiled frame consumer](consumer/frame.html) and [browser/file observation](consumer/evidence/frame/observation.md) show clipped/overhanging child pixels, frame pointer delivery and a cold Open into new handles.

## Public line handle

`tree.createLine({id,layer,transform,x1,y1,x2,y2,width,stroke})` returns a `LineHandle` with copied Scene v7 data. `setLine({x1,y1,x2,y2,width,stroke})` validates the complete local-line replacement before accepting it. Endpoints are bounded finite logical pixels and must differ; width is positive and at most 1,000. The existing renderer draws a straight quad with flat ends and semantic line hit testing. The handle does not add joins, dashes, arrowheads or CAD identity. The [compiled line consumer](consumer/line.html) and [browser/file observation](consumer/evidence/line/observation.md) show visible/adjacent hits, pointer delivery, editing and cold Open into new handles.

## Public frame ticker subset

`createTicker(scheduler?)` returns a private callback ticker. By default it uses browser `requestAnimationFrame` and `cancelAnimationFrame`; an exact two-function scheduler can be injected for deterministic use. The scheduler must defer callbacks until after `requestFrame` returns. `onTick(listener, priority=0)` registers up to 128 active listeners and returns an idempotent unsubscribe function. Higher integer priority (-100 to 100) runs first; equal priority retains registration order. Each frozen tick has `frame`, `timestampMS`, raw `elapsedMS` and `deltaMS` capped at 100 ms. The first frame after each start has zero deltas. Start and stop are idempotent; stop cancels the pending callback and ignores late callbacks, and dispose clears listeners. Invalid scheduler, priority or timestamp returns `INVALID_SCENE`; unavailable default browser scheduling returns `UNSUPPORTED_FEATURE`. Registration, start and stop after disposal return `DISPOSED`; dispose remains idempotent. A callback exception stops the ticker and propagates.

The ticker does not change a display tree or draw by itself. The host mutates handles and calls `renderer.updateScene(tree.snapshot())` and `renderer.render()` inside a tick callback. It owns canvas, file and visibility lifecycle. There is no shared ticker, fixed-step simulation, FPS target, automatic page-visibility pause or implicit render loop. The [compiled ticker consumer](consumer/ticker.html) and its [browser observation](consumer/evidence/ticker/observation.md) show this boundary.

## Host document bundle

`@barocss/canvas2d/document` exports `serializeCanvasDocument(acceptedScene, getAsset)`, `parseCanvasDocument(text)`, and `stageCanvasDocument(text, freshCanvas, options)`. The format is one exact JSON object: `{format:'barocss-canvas-document',version:1,scene,assets}`. `scene` is a canonical Scene JSON **string**, so the Scene format itself remains asset-reference-only. `assets` contains only referenced image and glyph-atlas IDs, sorted by ID. Each entry has exact fields `{id,width,height,byteLength,sha256,pixelsBase64}`. The digest is lowercase hexadecimal SHA-256 of top-to-bottom straight RGBA8 bytes; base64 uses padded standard encoding. The adapter uses the host's Web Crypto implementation and does not fetch URLs or install a ZIP dependency.

Export copies the scene and bytes returned by `getAsset`. Parse validates the complete file, versions, fields, asset IDs/order/references, dimensions, encoded length, canonical base64 and digests before returning copied assets. The file limit is 48 MiB of UTF-8 text; decoded assets retain the renderer's 16-asset and 32-MiB limits. The Scene retains its 1-MiB limit. `stageCanvasDocument` registers verified assets, admits the scene and renders on a **fresh canvas**. If staging fails, it disposes that candidate. The host replaces its visible canvas and old renderer only after staging succeeds; do not pass the live canvas as the staging target. The [document example](../../examples/canvas2d-scene/document-v1.html) shows file download and Open with this swap. Plain Scene JSON Open is still available when the host registers referenced assets separately.

Errors are `Canvas2DError` with `code`: `INVALID_SCENE`, `SCENE_LIMIT`, `INVALID_VIEW`, `INVALID_SIZE`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `DISPOSED`, `SERIALIZATION`, `UNSUPPORTED_FEATURE`, `INVALID_ASSET`, `ASSET_LIMIT`, or `ASSET_IN_USE`.

## Authored orthogonal Boolean subset

`booleanOrthogonalPolygons(left,right,operation)` returns a new `PolygonBooleanResult` for `union`, `intersection`, or left-minus-right `difference`. Each operand is `{contours:[{id,points:[{x,y}]}]}`. Each ring is an open vertex list whose closing edge connects its last point to its first. Coordinates are exact integer logical pixels in `[-4096,4096]`. Rings have 4–128 distinct vertices and alternating horizontal and vertical edges; no duplicate closing point, diagonal, curve, fractional coordinate, collinear extra point, or implicit tolerance is accepted. Each operand has 1–8 non-touching simple rings. Positive screen-space signed area (x right, y down) denotes an outer ring; a nested hole has negative area, alternating by depth. Source IDs are unique across both operands.

Proper perpendicular crossings between operands are accepted. Endpoint contacts, coincident or overlapping edges, self-intersections, contacts between rings of one operand, wrong nesting orientation and ambiguous point-contact results return `UNSUPPORTED_FEATURE`. The combined inputs have at most 240 vertices, coordinate compression has at most 16,384 cells, and the output has at most 8 rings, 128 vertices per ring, 240 vertices total and 4,096 boundary edges. Excess returns `SCENE_LIMIT`. The bounded integer domain prevents arithmetic overflow in its predicates. The function copies inputs and returns only after validation; it does not change a renderer or scene.

The result records the operation, ordered input contour IDs and each deterministic output ring's `id`, `orientation`, contributing `sourceIds` and authored integer points. Empty output is allowed. Positive/negative output rings can be converted to one Scene v5 `nonzero` path, with the Scene's own admission limits still applied. Run `node examples/canvas2d-scene/boolean-probe.mjs` for the deterministic check. The example at `/examples/canvas2d-scene/boolean-v5.html` computes all three operations, retains its old canvas on refusal, and saves/opens a result JSON with lineage verification. This adapter does not perform curved, arbitrary-angle or CAD B-Rep Boolean operations.

## Bounded example

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

Open the printed URL. The main example draws two frames, colored rectangles, lines, version 2 filled paths, version 3 images, and a version 4 glyph run with visible path control handles. It supports selection, drag, pan, zoom, v0/v1/v2/v3/v4 JSON Save/Open with host-registered assets and control-point editing through this public API. Open `/examples/canvas2d-scene/nonzero-v5.html` for the winding comparison or `/examples/canvas2d-scene/svg-v5.html` for the bounded SVG file importer. Boolean operations, general SVG parsing, text shaping, general masks, filters beyond nearest/linear image sampling, blend modes beyond normal/add for sprites, color-managed output, editor history, collaboration, and full design-tool behavior remain outside this prototype.

## Bounded SVG import

`importSVGElement(root)` translates an SVG namespace `Element` into `{scene: SceneV5, diagnostics}`. The host parses XML, supplies the root, and renders only the returned Canvas2D Scene. The importer neither fetches URLs nor uses SVG rendering as a fallback. The root requires unitless integer logical-pixel `width`/`height` and a finite `viewBox`. Default `xMidYMid meet` and explicit `preserveAspectRatio="none"` map through a transparent clipping frame and viewBox group. Only nested `g` and `path` elements are admitted. Their transforms may contain one ordered translate, rotate in degrees, and positive scale sequence; pivot rotation, matrix and skew refuse. Explicit SVG IDs must match Canvas IDs; missing IDs get deterministic collision-free names. Sibling order becomes layer order.

Path data supports explicit uppercase absolute M/L/Q/C/Z with one argument set per command. Path-local fill defaults to black, stroke to none. Paint supports `#RRGGBB` or `none`, `fill-rule` nonzero/evenodd, and separate `fill-opacity`/`stroke-opacity` in 0–1. Stroke needs an explicit bevel join and uses butt caps. Unsupported elements, attributes, relative/shorthand/arc commands, CSS, inherited group paint, external references, filters, text, images, negative scale and object opacity other than 1 refuse with a location and `UNSUPPORTED_FEATURE`. Scene v5 validation then enforces contour and resource limits. This is a declared import subset, not general SVG compatibility.

## Derived PNG and bounded SVG export

`@barocss/canvas2d/document` exports `exportCanvasDocumentPNG(documentText, options, createCanvas)`. It validates the canonical v1 Scene+asset document and SHA-256 hashes before asking the host for a fresh HTML canvas. It stages and renders that document at the declared integer logical size and DPR, encodes a PNG with the browser's `canvas.toBlob`, and disposes its temporary renderer. The result is `{blob,logicalSize,backingSize,dpr}`. The host owns the document and download permission. The PNG's pixel rows are top-to-bottom as encoded by the browser; WebGL2 uses premultiplied source colors with each accepted image blend mode, and the browser serializes the final canvas. The demonstrated PNG is 8-bit RGBA. Opaque sample colors and dimensions are checked in Chromium; hidden RGB under transparent pixels, ICC/P3/HDR, print, PDF and byte-identical output across browsers are not certified. A bad document, missing asset, unavailable encoder or encode failure refuses without touching the host's visible canvas.

`exportSceneSVG(scene,logicalSize)` returns either `{ok:true,svg,sourceIdMap,diagnostics:[]}` or `{ok:false,diagnostics:[{nodeId,code,feature}]}`. Input is a validated Scene v5 or the solid group/path subset of Scene v29. Logical width and height are integer pixels. Paths use absolute M/L/Q/C/Z commands. Sibling `layer` must match input order. Transforms use ordered translate/rotate/positive scale. RGB channels must be exact 8-bit `#RRGGBB` values. Fills use nonzero/evenodd rules; strokes use butt caps and bevel joins.

For Scene v29, visibility and node/ancestor alpha become explicit path paint opacity. Hidden geometry and IDs remain in the SVG with zero paint and no hit. Each node requires `hitMode: 'auto'`; pivot must be absent or zero. Stroke dash lengths must be empty, dash offset zero and miter limit 4. Masks, gradients, group hit areas, signed scales, frames, rectangles, lines, images and glyph runs return diagnostics without an SVG. The exporter checks the unchanged importer's wrapper depth and resource limits before it returns success.

The SVG root has `viewBox="0 0 width height"` and `preserveAspectRatio="none"`. `sourceIdMap` retains the root, group and path IDs. Pass the parsed SVG root to `importSVGElement` to obtain a Scene v5 with viewport wrappers. Reconstruct admitted groups and paths through the public display-tree factories when you need editable Scene v29 handles. The imported SVG does not reproduce authored Scene JSON, visibility flags or hierarchy metadata bit for bit. Keep the original Scene+asset document as the editable source.

The [current SVG example](consumer/current-v29-svg.html) shows export, file Open and a paint change to the original display tree. Dispose the canvas and its pointer binding when the host closes. This subset has no raster fallback, font outline conversion, full SVG or CAD export.

## Bounded scene-scale measurement

The host example at `/examples/canvas2d-scene/perf-v4.html` uses the fixed `perf-corpus-v4.mjs` Scene v4 corpus: 800×480 logical pixels at DPR 2, eight clipped frames, 24 paths, eight RGBA images, eight two-glyph runs and 296 copied asset bytes. Build the package, start `node examples/canvas2d-scene/server.mjs`, open that URL, choose **Run fixed measurement**, then **Save metrics JSON**. The page records 40 scene updates, 30 render plus `gl.finish` calls, 20 batches of 1,000 miss/visible hit tests, and 20 host `SceneHistory` edit commits plus `gl.finish`. It records texture and buffer calls/bytes, representative pixels/hits, history position, browser/GPU strings, and resource deletion after `dispose()`. GPU resident memory is reported unavailable because WebGL does not expose a reliable byte count here; `performance.memory` is a browser estimate of JS heap use when present.

The measured host bottleneck was the `SceneHistory.commit` path. Its returned edited candidate was already separate from the stored history copy, so returning it avoids a redundant third `structuredClone` without exposing an internal history entry. The history probe mutates the returned value and checks that both accepted history and renderer state stay intact. On one Apple M3 Max / Headless Chrome 155 run, the commit-plus-finish median changed from 1.1 ms to 0.9 ms and p95 from 1.5 ms to 1.2 ms. The complete [before/after evidence](../../examples/canvas2d-scene/evidence/perf-v4/observation.md) records all other measured values and resource counts. This is a fixed single-device observation, not an FPS or broad device claim.

Scene v9 requires `visible: boolean` on all nodes. Public `create*` display specs default an omitted flag to true; each display handle exposes atomic `setVisible(boolean)` and copied `data.visible`. Hidden nodes, and descendants of hidden groups or frames, do not paint or hit. Their geometry and asset references still validate and count toward limits; the document still includes referenced hidden assets. Showing a parent restores children with their own flags unchanged. A stale pointer hit for a hidden object is rejected. [The compiled visibility consumer](consumer/visibility.html) checks pixels, hits, pointer routes and a real v1 document Open.

Every public display handle also has `setPosition(x, y)`, `setScale(scaleX, scaleY)` and `setRotation(rotation)`. These set absolute local transform fields and retain all other fields. They use the current Scene validation and atomic rollback as `setTransform`; rotated frame clips are admitted in current Scene v29 snapshots. Their support starts at Scene v24; earlier Scene versions keep their declared clip restrictions. The stage has no transform. [The compiled transform consumer](consumer/transform-setters.html) checks pixels, hits, pointer routes and document Open.

Scene v10 requires `alpha` on all nodes. Every public non-stage handle has `setAlpha(number)` and copied `data.alpha`; an omitted creation value defaults to 1. Parent and child alpha values multiply. Vector paint alpha and image/glyph opacity retain their authored values and multiply by effective alpha during drawing. A zero-alpha object or subtree gives no semantic hit or pointer target, while its geometry and assets still validate. Each child composites in paint order; no offscreen group isolation is provided. Scene v0–v9 retain their exact shapes. Reconstruction accepts v6–v10 and upgrades older nodes to alpha 1. The v1 document envelope is unchanged. [The compiled alpha consumer](consumer/alpha.html) checks pixels, hits, pointer routes and a real v1 document Open.

Scene v11 requires `hitMode: 'auto' | 'none'` on every node. `auto` keeps normal semantic hit testing. `none` keeps pixels, clips, geometry and asset validation, but excludes that object and its descendants from hits so a lower object can receive the pointer. Each public non-stage handle has `setHitMode(mode)` and copied `data.hitMode`; an omitted creation value defaults to `auto`. A parent set to `none` does not rewrite a child's authored mode. Invalid values and claimed pointer hits under a disabled node throw `INVALID_SCENE`. Scene v0–v10 retain their exact fields and act as `auto`; editable reconstruction accepts v6–v29 and upgrades older nodes into v29 snapshots. The v1 document envelope is unchanged and includes assets referenced by disabled objects. [The compiled hit-mode consumer](consumer/hit-mode.html) checks pixels, hits, pointer routes and a real v1 document Open.

Every public display handle has `toWorld(localPoint)` and `toLocal(worldPoint)`. They return copied Scene logical points through the current local and ancestor transforms, including after reparenting. A detached handle uses its own transform. These coordinates precede renderer pan, zoom and DPR; the host maps a world point through its view before calling `hitTest`. Sprite anchors and glyph offsets affect their image geometry, not the handle's coordinate origin. Invalid point input returns `INVALID_SCENE`; a nonfinite, singular or out-of-range result returns `SCENE_LIMIT`. [The compiled point consumer](consumer/point-conversion.html) checks view mapping, pixels, hits, pointer routes and a real v1 document Open.

The stage and every public display handle have `getWorldBounds()`. It returns a new conservative `{x,y,width,height}` box in Scene logical world coordinates, or `null` for empty geometry. It follows current ancestor transforms, sprite anchors, glyph placement, stroke widths, frame clips and child edits, including detached subtrees. Hidden, transparent and zero-opacity authored geometry remains included. The box may contain empty space; use `renderer.hitTest` for semantic hits. The host applies its view and CSS mapping when placing an overlay. Composed geometry outside the supported world range throws `SCENE_LIMIT`. [The compiled bounds consumer](consumer/world-bounds.html) places an outline, checks sprite/path pixels and pointer routes, and opens a v1 document on a fresh canvas.

Every public display handle also has `getLocalBounds()`. It returns a fresh conservative box in that handle's own logical coordinates. The query includes authored geometry, descendant transforms and descendant frame clips. It excludes the queried handle's transform and all ancestor transforms and clips. An empty group returns `null`; the Scene schema does not accept an empty path. The stage has no local-bounds method because its coordinates are Scene-world coordinates. Visibility, alpha and hit mode do not remove authored geometry from either bounds query. A detached handle still reports its own subtree. [The compiled local-bounds consumer](consumer/local-bounds.html) checks parent move and rotation, WebGL2 pixels and hits, and a fresh-canvas v1 document reopen.

## Independent compiled consumer

The [package-local consumers](consumer/README.md) import the two public `@barocss/canvas2d` entries and type-check against their built declarations. The first browser host registers a copied image, renders and hit-tests a Scene v3, downloads a v1 document, and cold-opens that actual file on a fresh canvas; a corrupt digest retains the accepted canvas. The display-tree host uses public container/sprite handles and current Scene v29 snapshots. Its preserved browser/file observation records the original v6 roundtrip; it is not a new current-version execution receipt. Neither imports renderer source or the repository's scene example. These consumers are local verification code, outside the package's published `files` list.

`createSpriteAtlas(imageId, imageSize, entries)` validates 1..64 named source-pixel crops inside one host-owned image. `frame(name)` and `sequence(names)` return copies suitable for `createSpriteAnimation`; the host registers the image and drives time. It does not parse third-party spritesheet formats.

Scene v7 adds a required normalized RGB `tint` to image nodes. `createSprite` defaults omitted tint to white, and `SpriteHandle.setTint` changes one sprite without copying its asset. Older Scene versions still parse and render with effective white tint; editable reconstruction accepts v6–v29, upgrading absent tint, blend mode, visibility and alpha to white, normal, true and 1 in v29 snapshots. The v7 tint introduction and earlier reconstruction examples retain their historical version contracts.

### Transformed frame clipping

The [compiled consumer](consumer/transformed-clip.html) uses overhanging Sprite, Path, glyph and group hit-area children in rotated and nested frames. Axis-aligned clipping retains scissor; general clips use a fixed list of complete inverse/local-size predicates in both existing shaders and semantic hit testing. No new GPU resources or stencil bits are allocated. The list capacity is 16 (the existing depth limit admits at most 15 frame ancestors). Unrepresentable inverse, world/device coordinates or collapsed Float32 edges return `SCENE_LIMIT` during renderer admission, keeping the last accepted Scene/view and frame. Malformed handle edits use atomic tree validation. Bounds are conservative AABBs, so they do not prove exact nonempty intersection of rotated rectangles. The document envelope stays v1 and can contain Scene v24. The host explicitly submits and renders; explicit pointer capture retains its existing route.


### Copied polygon group masks (Scene v25–v26)

`tree.createContainer({ ...spec, mask: { commands } })` copies one closed, simple polygon in group-local coordinates. `container.setMask(mask)` replaces that value atomically; `setMask(null)` removes it. Use one `M`, 2–31 `L` commands and one `Z` (3–32 distinct vertices). Convex and concave polygons in either winding are supported. Curves, holes, crossing/touching/backtracking edges are refused. Scene v26 and later allow two masked groups on one ancestor chain; their independent predicates intersect paint and hits. A third masked ancestor reports `SCENE_LIMIT`, including hidden or alpha-zero groups. Scene v25 preserves its nested `UNSUPPORTED_FEATURE` refusal. A Scene admits at most eight masks and 256 stored points. Old Scene v0–v24 field contracts remain unchanged; current snapshots are v29 and editable reconstruction admits v6–v29. Scene v27 adds image RGB matrices, v28 adds screen blending and v29 adds image alpha masks; these additions preserve the v25/v26 polygon-mask contracts.

The mask receives the complete group world transform, including signed/nonuniform scale, pivot and composed shear. It intersects descendant paint and spatial hits, the group's own hit area and inherited frame clips. It has no paint or separate hit ID. Both existing shaders and CPU hit tests use the admitted Float32 world contour. CPU segment boundaries are inside; exact GPU edge coverage can differ across devices. World/device values outside ±1e9 or topology lost in Float32 return `SCENE_LIMIT` before accepting a tree edit or renderer Scene/view. Mask uniforms reset for each draw; filled child paths retain their existing stencil behavior. Context restore uses retained CPU contours and rebuilt program uniforms.

Bounds conservatively intersect mask and frame AABBs; they do not prove exact clipped emptiness. The v1 document stores each group’s copied mask commands in its declared Scene version. Scene v25–v29 admit masks under their version-specific limits. Open can reconstruct those scenes into editable v29 handles; parsing the saved document preserves its original Scene version. Limited SVG export refuses masks, including hidden ones. The host explicitly submits snapshots and owns file state. See [the compiled polygon mask consumer](consumer/polygon-mask.html) and its [preserved Scene25 native probe](consumer/evidence/polygon-mask/probe.mjs).


## Owned Application

`createCanvas2DApplication` combines a new renderer, display tree and ticker. Its default state is stopped. Populate the tree and register assets before starting. Optional `initialScene` reconstructs a fresh copied owned tree through the existing Scene v6–v29 reconstruction API and returns a v29 tree. Its contextId must match the required options.contextId. Explicit null/undefined and option accessors refuse before renderer/ticker allocation. Absent retains empty-tree behavior. The restored tree is available immediately; renderer admission/render still starts only after the host registers assets and calls render/start. No Scene, document envelope or asset registry is inferred from this option. It does not bind DOM input or own document/file transactions.

```ts
import { createCanvas2DApplication } from '@barocss/canvas2d';

const app = createCanvas2DApplication(canvas, {
  contextId: 'MyApp',
  renderer: { logicalSize: { width: 320, height: 200 }, dpr: 2 },
});
const actor = app.tree.createRect({
  id: 'Actor', layer: 0, transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 20, height: 20, fill: [1, 0, 0, 1],
});
app.tree.stage.addChild(actor);
app.onUpdate(info => actor.setPosition(actor.data.transform.x + info.deltaMS * 0.02, 10));
app.render(); // manual submission is also available while stopped
app.start();
// Later: app.stop(); app.dispose();
```

Each successful tick runs app update listeners, snapshots the tree, admits the Scene and renders once. `onUpdate` accepts integer priorities −99..100; higher priorities run first, equal priorities keep registration order. An internal priority−100 render listener occupies one of the ticker's 128 slots. Raw `app.ticker.onTick(..., -100)` registered later runs after rendering. Use `onUpdate` for ordinary changes. Calling `app.render()` inside an app update callback is refused; direct renderer/ticker calls keep their existing low-level behavior.

An invalid Scene admission retains the renderer's previously accepted frame. Successful tree, asset or view changes before that failure are not rolled back. Repair the data and explicitly render or restart. Callback errors halt scheduling and propagate unchanged. The existing ticker retains first/resume delta0, capped deltaMS100 and its late-callback guard.

`app.dispose()` removes its listeners and disposes ticker then renderer. It is idempotent and attempts renderer cleanup even if host scheduler cancellation throws. Later app methods refuse DISPOSED. Tree handles are CPU objects with their existing lifetime; Application disposal does not invalidate them. Host DOM listeners, capture, file URLs and animation controllers remain host-owned. See `consumer/application.html` and its focused evidence.

### Composed atlas game host

See [the game consumer](consumer/game.html) and [run/lifetime instructions](consumer/README.md#public-atlas-game-composition) for a small public-API app combining bounded PNG loading, named atlas frames, host-owned animation with Application update/render scheduling, captured drag and explicit teardown. Its score/token logic is host-owned and is not serialized library state.

The [nested-mask consumer](consumer/nested-mask.html) demonstrates Scene26 outer/inner crops and restored edits. Each existing common/image/glyph fragment program reserves 64 `vec2` points and two independent counts, resets both counts for every draw, and applies all active masks before path stencil writes. Renderer creation and restoration require at least 128 reported fragment uniform vectors; insufficient capacity reports `UNSUPPORTED_FEATURE` before program allocation. The conservative common/image budgets are 126/119 vectors, including the 16 transformed-clip entries. No texture, framebuffer, stencil layer or additional GPU object category is added. Empty polygon overlap is legal; bounds remain conservative AABB intersections, not Boolean polygon output.

### Sprite RGB matrix (Scene27)

SpriteSpec accepts optional `rgbMatrix: SpriteRGBMatrix`, twelve copied row-major numbers (three RGB rows with an offset). Coefficients are in [-4,4], offsets in [-1,1]. `sprite.setRGBMatrix(matrix)` copies and validates the value; `setRGBMatrix(null)` restores identity. Data and snapshots are independent copies. Old Scene0..26 reject this field.

The image shader filters the original straight RGBA, applies the three row dot products and RGB clamp, then tint and alpha premultiplication for the existing blend. Alpha, hit tests, source bytes, masks and clip do not change. Nine-slice/tile draws carry the matrix; each ordinary Sprite and synthesized glyph resets missing rows to identity. This is channel arithmetic, with no color-space or perceptual-gray claim. No new GPU resource category/pass is added. Three vec4 uniforms raise the image fragment budget to122, below the retained128 requirement (common126). SVG still refuses image export.

The [RGB matrix consumer](consumer/rgb-matrix.html) covers copied inputs, color order, reset, file/restored handles and explicit resource lifetime. Its recorded observations state the actual executed scope.

## Prepare one browser text label

`rasterizeBrowserText` synchronously returns owned RGBA8 bytes and an existing
whole-label `GlyphRunLayout`. Prepare fonts in the host before calling it:

```ts
import { rasterizeBrowserText, createDisplayTree, createCanvas2D } from '@barocss/canvas2d';
await document.fonts.ready;
await document.fonts.load('24px monospace', 'H I');
const raster = rasterizeBrowserText({
  text: 'H I', font: '24px monospace', atlasId: 'LabelAtlas', dpr: 1.5,
});
const tree = createDisplayTree('LabelHost');
const label = tree.createGlyphRun({
  id: 'Label', layer: 0,
  transform: { x: 24, y: 72, scaleX: 1, scaleY: 1, rotation: 0 },
  ...raster.layout,
});
tree.stage.addChild(label);
const renderer = createCanvas2D(canvas, { logicalSize: { width: 320, height: 128 }, dpr: 2 });
renderer.setImageAsset(raster.layout.atlasId, raster.asset);
renderer.updateScene(tree.snapshot());
renderer.render();
// Later edits prepare new bytes and use label.setLayout(next.layout).
// The host disposes its renderer when it no longer needs it.
renderer.dispose();
```

Text permits 1..128 ASCII letters, digits and spaces, with at least one letter or
digit. Font declarations are nonempty, at most 256 characters, without CR/LF/NUL.
DPR is 1..4 (default1). Options require ordinary own enumerable data fields.
Two sentinel assignments detect ignored CSS font syntax, followed by a readiness
check. The helper never loads fonts, schedules work, registers assets or creates
a display renderer. Its normalized `font` describes the declaration; a readiness
check does not certify a named typeface.

`bounds` has a baseline of zero and two logical pixels of padding. Backing
extents use `ceil(logical extent * dpr)`; returned logical extents include the
extra fractional-DPR edge pixels. The raster must fit 1024x256 and 1 MiB and
contain ink. Each result has independent bytes and metadata. Transparent pixels
keep the existing glyph alpha hit behavior. The detached scratch canvas is not
retained in the result.

Malformed options/text/font/DPR use `INVALID_SCENE`; bad asset IDs, unready fonts,
invalid metrics or allocation/draw/read failures use `INVALID_ASSET`. Positive
safe extents beyond caps use `ASSET_LIMIT`; missing browser/font/2D APIs use
`UNSUPPORTED_FEATURE`. Root import is inert in Node; a call requires a browser.
The host owns candidate admission and replacement. v1 saves layout/text and
asset bytes. Cold Open does not rasterize or need the original font; restored
edits explicitly use the current host font. See
[consumer/browser-text.html](consumer/browser-text.html). This API does not
provide multiline text, Unicode, wrapping, per-character carets, font discovery,
typography parity or performance claims.

## Browser-font raster text consumer (#1011)

After the compiled package build, open `/packages/barocss-canvas2d/consumer/text-raster.html`. This host prepares a fixed 24px monospace ASCII label with browser font readiness, measured baseline bounds and copied DPR2 RGBA bytes. One public glyph run represents the complete label; spaces remain transparent. An edit uses a fresh candidate canvas/tree/renderer and commits only the newest accepted generation. Failed or late candidates retain the live label. Save stores Scene and RGBA bytes in v1; Open restores pixels without preparing a font, and later edits use the current host font. PNG uses an actual export file. Font metadata, Unicode shaping and per-character caret mapping are outside this consumer.

The [initial Scene consumer](consumer/initial-scene.html) composes saved Scene values with an owned stopped Application, host asset registration and a fresh-canvas file transaction. See [native evidence](consumer/evidence/initial-scene/observation.md).

## Public clipped chart consumer (#995)

After the compiled build, open `/packages/barocss-canvas2d/consumer/chart.html`. Two fixed eight-point series use public Path/Rect handles inside a rotated clipped Frame. Host controls pan/zoom, bounded hit-stack selection and one-point editing. CSS input becomes logical viewport input for renderer hits; public conversion supplies world/plot-local data for tree events. Changes stage a fresh tree/canvas before adoption. Save clears transient selection and stores accepted Scene; Open resets host view/selection, validates exact chart topology and derives data from admitted commands before restoring editable handles. No plotting framework, host dataset metadata or SVG export is provided.

The [fixed glyph diagram consumer](consumer/diagram.html) combines public groups, rectangles, host-shaped H/I glyph runs, paths, transformed frame clipping, pointer capture, v1 document restoration and PNG export. It is an example host with nine objects and a copied 16x12 RGBA8 atlas; it does not add a core diagram or text API. See the [consumer guide](consumer/README.md) for the local build and server commands.

### Existing font consumer uses the public helper (#1150)

`consumer/text-raster.html` now uses `rasterizeBrowserText` for its asset and
whole-label layout. The host keeps its 1..32 ASCII label policy, fixed 24px
monospace font, font readiness and five-second timeout. It checks cancellation
after readiness and before calling the synchronous helper, then checks again
before display admission. Its narrower 1024x128 and 512 KiB example guard runs
after helper preparation. This does not add a core raster limit.

Cold Open restores document bytes without preparing a font or calling the
helper. A later restored edit prepares the current font and calls the helper,
then applies the result with `GlyphRunHandle.setLayout` on a copied candidate
tree. The accepted renderer and tree remain live until candidate admission
succeeds. Original native consumer observations remain historical evidence.

## Sprite screen blending (Scene28)

Scene v28 introduced screen blending. Current display snapshots use Scene v29. Sprite creation and `setBlendMode` accept `normal`, `add` and `screen`; earlier Scene0..27 types/admission remain unchanged and reject screen. Screen combines premultiplied stored channels as `s+d-s*d`, with source-over alpha. It reuses source matrix/tint/opacity, clipping/masks and source-alpha hit testing; image bytes are unchanged. Normal/add behavior and document envelope1 stay unchanged. No group blend isolation or full CSS/color-space parity is promised.

The bounded `consumer/screen-blend.html` example compares opaque/translucent backgrounds, edits one Sprite, saves/opens a native document, and disposes owned renderers. Node22 build plus strict `consumer/tsconfig.screen-blend.json` and `consumer/evidence/screen-blend/probe.mjs` check current sources/public compiled types; the recorded actual WebGL2/file/pointer flow is in `consumer/evidence/screen-blend/observation.md`. Historical probes stay tied to their original native Scene versions. Native proof is separate from merged/integrated validation or release.

## Printable ASCII browser labels

`rasterizeBrowserText({text:'-$20',font:'24px monospace',atlasId:'Label',textPolicy:'printable-ascii'})` prepares decimal, currency and status labels through the existing owned raster/layout path. Exported `BrowserTextPolicy` is `alphanumeric | printable-ascii`. Omit `textPolicy` for the original letters/digits/spaces contract. Explicit unknown/undefined/null/accessor fields refuse. Printable mode allows U+0020..U+007E,1..128 characters with nonspace; no control/DEL/Unicode/newline/multiline support. Existing font/DPR/1024x256/1MiB limits, font preparation ownership and copiedRGBA/wholelabel result apply.

Existing `consumer/browser-text.html` shows 12.5, -$20 and FPS:60, byte-only coldOpen, restoredhelper/setLayout and PNG/Dispose. `consumer/evidence/printable-text/observation.md` separates actualbrowser/file proof from Node validation and pendingintegration/release. The policy is raster preparation only; document envelope/Scene and savedglyphtext/layout/bytes do not change.

## Explicit multiline browser labels

`rasterizeBrowserMultilineText({ text: 'Balance\n-$20', font: '24px monospace', atlasId: 'Label', lineAdvance: 40, dpr: 2 })` prepares one copied RGBA atlas and one whole-label glyph quad. Prepare the font in the host first. Upload `result.asset` and create/edit a glyph with `result.layout`. Save stores original text and pixels; Open needs no font preparation. Scene28 and document v1 are unchanged.

Accept 1..4 printable ASCII lines separated by LF, each with a nonspace character, at most 128 UTF-16 code units including LF. Required `lineAdvance` is finite, positive, <=1e6 logical pixels, with last baseline<=1e6. DPR is 1..4; the font declaration has at most 256 characters. No wrapping/normalization/shrinking/automatic gap adjustment. Overlapping lines draw in source-over text order. Transparent gaps use existing alpha hit behavior.

The first baseline is 0. `lines` reports original textStart/textEnd excluding LF, logical baseline and measured advance; `advance` is max measured line width. Bounds union observed ink edges at each baseline, round outward to integers, add 2 logical pixels padding, then ceil backing dimensions at DPR. Logical width/height=backing/DPR. The existing 1024x256 / 1 MiB cap applies to the complete block before resize/draw/readback. Caller owns independent copied bytes/layout; host owns accepted candidate replacement. Browser metrics do not identify a matched typeface or certify shaping.

Ordinary enumerable data options text/font/atlasId/lineAdvance plus optional dpr only. Unknown fields, textPolicy, symbols, accessors, nonenumerable fields and explicit undefined/null, CR, tabs, controls, non-ASCII, empty lines and all-space lines refuse INVALID_SCENE before scratch. Unavailable APIs use UNSUPPORTED_FEATURE; font readiness, finite metrics, readback, allocation or missing ink failures use INVALID_ASSET; oversize uses ASSET_LIMIT. One scratch, at most 4 measurements/draws, one <=1MiB copied readback; multiline finally releases scratch backing to 0x0 on success/error. Single-line API/default errors stay unchanged.

## Multiline advance-box alignment

Optional `BrowserMultilineTextOptions.lineAlign` uses exported `BrowserMultilineTextAlignment` (`left | center | right`). Omit it or use `left` for the original multiline result. Center/right move each line within the largest measured advance W by (W-w)/2 or W-w; spaces contribute to w. Visible ink edges need not align. The helper keeps Canvas2D left/LTR text alignment and shifts draw origins and ink bounds before existing rounding/padding/DPR/cap checks. Result shape, text ranges, baseline advance, original text and one copied atlas/quad stay fixed.

Explicit undefined/null/unknown/accessor alignment refuses INVALID_SCENE before scratch. Existing 1..4 lines/128 UTF16/font/DPR/finite metrics/1024x256/1MiB and multiline scratch finally0x0 apply. No alignment policy is saved in Scene28/document v1. Cold Open restores exact pixels; a restored edit supplies the current host's alignment explicitly. Existing browser-text host includes Left/Center/Right lines and Center restored lines controls. See consumer/evidence/aligned-text/observation.md for bounded native proof; integrated acceptance remains separate.

## Bounded browser paragraph wrapping

`rasterizeBrowserWrappedText({text:'Canvas2D labels fit this panel',font:'24px monospace',atlasId:'Label',lineAdvance:30,maxWidth:160,dpr:2})` prepares one original paragraph as up to four visual lines. BrowserWrappedTextOptions/Raster are exported. Text is 1..128 printableASCII words separated by exactly one ASCIIspace; no normalization, leading/trailing/repeatedspace/LF/Unicode. Host prepares fonts. Greedy complete-candidate measured advance must fit maxWidth; never split or hyphenate words. A long word or more than four lines refuses ASSET_LIMIT before draw. Width must be finite positive<=1e6; existing font/DPR/finite ink/backing1024x256/1MiB limits remain.

Result adds maxWidth to multiline fields and retains the original paragraph in layout.text/onequad. lines ranges reference original text and exclude a separating wrapspace; baselines are i*lineAdvance. Optional left/center/right aligns advance boxes within configured maxWidth (not actual ink or clipping); result.advance remains largest actual line advance. One scratch, at most128measure/4draw/onecopiedreadback, finally0x0. Existing single/multiline APIs are unchanged. Save/Open keeps original text/layout/pixels with no width/wrap policy field. Restored edits supply current host width explicitly. This is bounded ASCII word wrapping, not shaping/justification/caret/fontloading. See existing browser-text host and evidence/wrapped-text/observation.md.

## Sprite sampled-color alpha mask (Scene29)

Optional copied SpriteAlphaMask `[r,g,b,bias]` uses sampled original straight RGB: factor=clamp(r*R+g*G+b*B+bias,0,1); effective alpha=sampleA*opacity*inheritedalpha*factor. Use Sprite.setAlphaMask(mask), or null to clear. Coefficients are finite[-4,4],bias[-1,1]; plain four-value arrays/data only. Factory/data/snapshot copies are independent. Scene0..28 reject the field; currenttree snapshots29 and reconstructs6..29. Documentv1 stores authored tuple and untouched asset bytes.

Nearest/linear sample original RGBA first, then compute the factor; masking texels before linear interpolation is different. Mask uses original RGB before RGBmatrix/tint. Originalalpha0 remains invisible/unhit even with bias. Default sampled-alpha hits use the same row/formula; explicit Sprite hitArea keeps its existing geometric override. Conservativebounds do not shrink; numerical CPU/GPU boundary parity is not promised. Missing field resets identity[0,0,0,1] on every image/glyph draw. Image123fragmentvectors/common126 still fit the unchanged128minimum; no texture/FBO category is added. Context restore reapplies current tuples. See existing rgb-matrix.html controls and evidence/alpha-mask/observation.md for native proof, separate from integrated validation/release.


### Owned renderer capture

`renderer.captureImageAsset()` renders accepted state once and returns independent top-left straight RGBA8 `ImageAssetInput` at backing size. Register it with another renderer's `setImageAsset` and display it as a Sprite. Capture is bounded to 1MiB and adds no GPU object. Disposed/lost/mismatched backing and oversize refuse before drawing/readback. Use `renderer.resize` for dimensions. Pixels are unpremultiplied from quantized framebuffer bytes; alpha zero has RGB zero, low-alpha color loses precision, and additive RGB above alpha clamps. The derived Sprite has its own sampled-alpha hit behavior; original IDs/geometry remain in the editable source document. Captures are snapshots, not live render textures. Raw host GL mutation is outside renderer ownership. See consumer/capture-image.html for cross-renderer capture, file restoration and PNG export.

## Bounded image box blur

`blurImageAsset(asset, radius)` prepares an independent same-size RGBA8 asset. The required integer radius is0..8 in asset pixels. Input is exact non-shared Uint8Array RGBA8, dimensions1..4096 and at most1MiB. Malformed fields, getters and typed-array metadata overrides return INVALID_ASSET; oversize returns ASSET_LIMIT before pixel copies/scratch/output. Radius0 copies bytes exactly. Positive radii average premultiplied encoded byte colors and alpha with a square kernel, then return straight colors; transparent RGB is zero. Outside pixels are transparent black with a constant kernel divisor, so edges fade and blur is cropped to original dimensions. No automatic DPR scaling, Gaussian/CSS blur or linear-light conversion. Transient typed-array payload is at most6MiB (source1, horizontal integer sums4, output1), with no DOM/GPU state.

Register the result with existing `renderer.setImageAsset`. The existing capture-image consumer adds a **Blur 2 pixels** control. It keeps the original captured bytes for each blur preparation. Save/Open retains complete derived bytes and Sprite metadata; it does not store radius or infer effects. Use caller-owned source pixels to prepare a new result after edits. Derived Sprite hits use its own alpha rectangle. No original source geometry/IDs survive flattening.

## Pack owned Sprite images

`packSpriteAtlas(imageId, images, maxWidth)` returns `{asset,atlas}`. Register the owned RGBA `asset` under `imageId`; use `atlas.frame` or `atlas.sequence` with existing Sprite animation. Each of1..16 inputs is `{name,asset,durationMS}`. Names are unique existing ID-like strings; durations1..60000ms. Required integer maxWidth1..1024. Aggregate input and output each<=1MiB; output dimensions<=1024. Malformed/getter/metadataoverride values return INVALID_ASSET; count/width/height/byte budget excess returns ASSET_LIMIT before pixel allocation.

Caller order defines shelf rows, without rotation, sorting, trimming, padding or gutters. Row height is its tallest image. Actual output width is the largest occupied row end. Unoccupied pixels are zero. All source bytes, including hidden alpha0 color, are copied exactly with no resampling or color conversion. This deterministic plan is not an optimal packing algorithm. Copied source and output payload together are at most2MiB. Preparation uses no DOM/GPU state; registry upload remains caller-owned and copied. Returned outer record is frozen, asset pixels remain mutable, catalog frame metadata is independently copied. Keep registered dimensions consistent with the returned catalog.

The existing sprite-atlas consumer adds **Pack images**, **Edit restored Gold**, **Export PNG** and **Dispose** controls. Its original default manual catalog remains available on initial load. Pack produces a5x5 atlas from mixed source sizes and uses the existing controlled ticker/animation. Saved documents contain the derived bytes and active crop; catalog/packing policy stays host metadata. Open uses saved bytes and retained host catalog metadata without invoking the packer. Original packing inputs are not inferred from the file.

## Owned alpha shadow preparation

`shadowImageAsset(asset, {radius:2, offsetX:6, offsetY:4, color:[0.25,0.5,1,0.75]})` returns independent straight RGBA pixels. Radius is integer0..8; signed offsets integer-64..64; normalized RGBA color0..1. All fields are required ordinary data, and negative zero is refused. Original RGB has no effect: output alpha is the rounded mean alpha of the square kernel times color alpha; visible RGB is rounded color*255, alpha0 RGB is zero. Transparent outside samples use the full kernel divisor. Dimensions stay fixed, so shifted/blurred edges can be cropped. Radius0 colors and shifts the silhouette; it does not copy source RGB. This is encoded-byte box-filtered alpha, not CSS/Gaussian/linear-light shading.

Input must be exact non-shared ordinary RGBA Uint8Array, dimensions1..4096 and at most1MiB. Malformed descriptors/accessors/options fail INVALID_ASSET; oversized input fails ASSET_LIMIT before typed pixel allocations. Copied input, Uint32 horizontal alpha sums and output own at most3MiB total. No DOM, GPU or retained scratch is used; no original IDs/geometry/hit topology is reconstructed. Register the result with existing setImageAsset, which copies it. The capture-image consumer uses cached original pixels, then saves derived bytes only; Open requires no shadow policy or recomputation.

## Owned pixel resize

`resizeImageAsset(asset, width, height, sampling)` synchronously prepares a copied RGBA8 image. Required integer output dimensions are1..4096 and sampling is `nearest` or `linear`. Both input and output must fit1MiB; copied source plus output payload is at most2MiB. Descriptor/getter, shared bytes, malformed dimensions and modes fail with INVALID_ASSET; valid byte overflow fails with ASSET_LIMIT before pixel allocation.

Both modes map pixel centers and clamp source edges. Nearest copies all RGBA bytes, including transparent hidden RGB. Linear interpolates premultiplied encoded-byte RGB and alpha without pass quantization, rounds final alpha and unpremultiplies visible RGB; roundedalpha0 becomes RGBA0. Linear identity normalizes hidden RGB; nearest identity returns an independent exact copy. This helper performs no DPR inference, area averaging, linear-light conversion, DOM/GPU work or automatic registration. Display size, IDs and original hit topology do not follow from resized bytes.

The existing capture-image consumer has Resize nearest/linear controls. It prepares cached original128x64 pixels at63x31 before changing the accepted asset and public Sprite crop. Logical display stays128x64. Save/Open stores derived bytes and crop only, with no resize policy or regeneration.

Resize controls admit a copied candidate tree/crop and new renderer before swapping the current canvas. The physical Open path reuses this replacement. This preserves the current display when preparation or candidate admission fails. Native #1245 evidence records the first old-crop registration refusal, repaired host,190 BigInt oracle cases and one accepted nearest/linear Save/Open/PNG flow with all eight actual GL contexts retained.

## Temporary image decode backing

`decodeImageBlob` resets its private readback canvas to0×0 in `finally` on success or failure. It also closes each created ImageBitmap once. The copied output remains independent after release. Early Blob/decoded dimension refusal creates no temporary canvas. This extends the original decoder lifecycle; PNG/JPEG/WebP admission,8MiB encoded/32MiB decoded limits, dimensions4096, public return/error behavior and browser-decoded color scope remain unchanged. Throwing cleanup is covered as a controlled probe; no browser GC or memory measurement is claimed. Existing `image-decode.html` remains the consumer. See `consumer/evidence/decode-cleanup/observation.md` for native proof, separate from future composed validation or release.

### Rejected URL stream lifetime (#1258)

`loadImageURL` requests cancellation of unread response data on stream refusal
(invalid chunk, read failure or encoded overflow) and on abort. It requests
cancellation at most once per acquired reader, removes the abort listener and
releases the reader lock. A response received after abort is cancelled before
rejection. Cleanup failures do not replace the original error. Normal EOF and
later decoder failures do not trigger reader cancellation. This is local stream
ownership; it does not guarantee that a remote server stops transmitting.
The URL, fetch, MIME, 8 MiB encoded and decoded image policies stay unchanged.


### Browser text scratch release (#1266)

`rasterizeBrowserText`, `rasterizeBrowserMultilineText` and `rasterizeBrowserWrappedText` release their private 2D canvas backing after success or failure. Width and height are each reset to zero. A cleanup setter failure does not replace the returned copied RGBA bytes or the original error, and does not prevent the other reset attempt. Invalid options and unavailable APIs still refuse before canvas allocation. Font readiness, text policy, layout, limits and public errors are unchanged. This is an explicit local resource release contract; it does not measure garbage collection or establish a permanent memory leak.

Scoped checks: `consumer/tsconfig.text-scratch.json` covers the unchanged browser text host and source/explicit compiled public types. `consumer/evidence/text-scratch/probe.mjs` exercises controlled cleanup paths; `observation.md` records the native browser, file, PNG and resource results. Composed integration acceptance is tracked separately in #1254/#674.

## Exact image pixel crop

`cropImageAsset(asset, {x,y,width,height})` synchronously copies a source-pixel rectangle into a new `ImageAssetInput`. It keeps all RGBA8 bytes, including hidden RGB at alpha zero. A full-frame crop is also an independent copy. The source and each result have separate pixel storage.

The asset has exactly enumerable own data fields `width,height,pixels`. Dimensions are integers in 1..4096. Pixels are an ordinary non-shared `Uint8Array` with exact RGBA byte length and no own buffer/length metadata overrides. The rectangle has exactly enumerable own data fields `x,y,width,height`. Coordinates are nonnegative integers. Dimensions are integers in 1..4096. Negative zero, getters, extra fields and out-of-bounds regions return `INVALID_ASSET`. Valid input or output above 1 MiB returns `ASSET_LIMIT`. All checks occur before pixel allocation or copying. The copied source plus output use at most 2 MiB of typed pixel payload. There is no DOM, decode, GPU or retained global state.

Register the result explicitly with `setImageAsset`. Pixel extraction does not change a Sprite or its logical size. `setSourceRect` selects metadata in existing bytes. The existing [sprite crop host](consumer/sprite-crop.html) provides both controls. Save/Open uses the extracted bytes directly. See [native evidence](consumer/evidence/image-crop/observation.md) for the bounded browser flow.


### Exact image quarter turns

`rotateImageAsset(asset, quarterTurns)` copies RGBA8 bytes through an exact clockwise rotation. Exported `ImageQuarterTurns` is `0 | 1 | 2 | 3`; both arguments are required. Odd turns swap the asset dimensions. All channels, including hidden RGB at alpha zero, are retained. Identity and repeated calls return independent pixel copies.

The input must have exactly three own enumerable data fields: `width`, `height`, and `pixels`. Dimensions are integers in 1..4096. Pixels must be an ordinary, non-shared `Uint8Array` with exact RGBA8 length and no own `buffer`, `byteLength`, `byteOffset` or `length` overrides. Unrelated own pixel fields are ignored without getter reads or indexed-key enumeration. Invalid records or turns, including negative zero, fail with `INVALID_ASSET` without reading getters or allocating typed pixel copies. Input and output each fit 1 MiB; valid overflow fails with `ASSET_LIMIT` before copying. The copied source plus output uses at most 2 MiB of transient typed payload.

The helper is synchronous CPU preparation. It does not change display geometry, register assets, or use DOM/GPU resources. The capture host uses the cached original 128×64 RGBA capture at source DPR 2. Its Rotate 90 control prepares 64×128 bytes, explicitly keeps the Sprite at 128×64 logical pixels, and updates the whole crop before admitting a copied tree into a new renderer. Save/Open persists the prepared bytes without running rotation again. Arbitrary angles, reflection, interpolation and EXIF orientation are outside this helper. Native evidence is under `consumer/evidence/image-rotate/`; integrated root acceptance remains separate. Current-source CPU preflight correction evidence is recorded separately in `consumer/evidence/image-rotate-preflight/`; its browser/GL gate remains unrun under #1283.


## Exact image pixel reflection

`mirrorImageAsset(asset, axis)` synchronously returns an independent same-size `ImageAssetInput`. Both arguments are required. `ImageMirrorAxis` is `horizontal` or `vertical`: horizontal reverses source columns, and vertical reverses source rows. Every RGBA byte is copied, including hidden RGB at alpha zero. Source and repeated results have separate storage.

The asset has exactly enumerable own data fields `width,height,pixels` on an ordinary record. Dimensions are integers in 1..4096; negative zero is refused. Pixels are an ordinary non-shared `Uint8Array` with exact RGBA8 byte length. Own `buffer,byteLength,byteOffset,length` overrides refuse without reading getters. Unrelated pixel extras are ignored without indexed-key enumeration. Full shape and required axis validation precede pixel copies and allocation. Malformed input returns `INVALID_ASSET`; valid input above 1 MiB returns `ASSET_LIMIT`. One source copy plus output use at most 2 MiB of internal typed pixel payload. There is no resampling, DOM, GPU or automatic Sprite mutation.

The existing [capture consumer](consumer/capture-image.html) prepares a horizontal reflection from cached original pixels. It admits a copied tree and fresh renderer before swapping the target canvas. The Sprite retains 128×64 logical geometry and a whole-image source rectangle. Renderer-owned snapshots isolate caller mutations, including the original capture return. Saved files store mirrored bytes and Scene data; Open does not invoke the helper. See [native reflection evidence](consumer/evidence/image-mirror/observation.md).


## Copied image source-over

`compositeImageAssets(background, foreground)` synchronously prepares an independent same-size `ImageAssetInput`. Both inputs are required encoded straight RGBA8 images. Foreground is placed source-over background. Integer rational weights round alpha and straight RGB half up without intermediate quantization. A zero combined alpha returns zero RGBA. Hidden RGB under zero input alpha does not contribute. This is encoded-byte composition.

Both inputs must have exactly ordinary enumerable own data fields `width,height,pixels`, dimensions in 1..4096, and exact non-shared ordinary `Uint8Array` bytes. Own `buffer,byteLength,byteOffset,length` overrides refuse without invoking getters. Unrelated typed-array extras are ignored without indexed-key enumeration. Validate both complete inputs and equal dimensions before the budget check or copies. Malformed input or unequal dimensions returns `INVALID_ASSET`; valid equal inputs above 1 MiB each return `ASSET_LIMIT`. Two source copies plus the result use at most 3 MiB of internal typed pixel payload. Aliased inputs are accepted; neither source nor a repeated result shares result storage. No DOM, GPU, offsets, resizing or automatic registration occurs.

The existing [image source consumer](consumer/sprite-image-source.html) composes the fixed foreground into `Composite`. It retains 80×80 logical Sprite geometry and uses the full 2×2 source crop. The host admits a copied tree and fresh renderer before swapping canvases. Original AtlasA/B remain registered, including after document Open. Save stores referenced Composite bytes and Scene data. The host retains copied asset snapshots for post-disposal canonical evidence. See [native composite evidence](consumer/evidence/image-composite/observation.md).

### Alpha-bound image trimming

`trimImageAsset(asset)` returns `TrimmedImageAsset | null`. Nonempty results contain an independent cropped `asset` and source-pixel `offsetX`/`offsetY`. Bounds include every alpha byte greater than zero. Interior RGBA bytes, including hidden RGB in transparent holes, remain exact. Outside pixels and their hidden RGB are discarded. Fully transparent input returns `null` after one source copy. Full bounds still return independent output. The offsets do not change Sprite geometry automatically.

Strict ordinary asset validation completes before copying. Malformed input throws `INVALID_ASSET`; valid input above 1 MiB throws `ASSET_LIMIT`. Dimensions are integers 1..4096. Source copy plus output use at most 2 MiB of typed pixel storage; an empty result uses only the source copy. No scratch image, DOM, GPU, DPR or automatic registration is used.

### Transparent image padding

`padImageAsset(asset, padding)` returns copied straight RGBA8 pixels with transparent zero RGBA margins. Both arguments are required. `ImagePadding` has exactly `top`, `right`, `bottom` and `left` integer fields in 0..4096. The source bytes, including RGB beneath zero alpha, remain exact at `(left, top)`. Zero margins also return independent pixels.

The helper validates all asset and padding fields before allocation. Malformed values throw `INVALID_ASSET`. Valid input or output above 1 MiB, or derived dimensions above 4096, throw `ASSET_LIMIT`. The internal source copy and output use at most 2 MiB of typed pixel storage. The helper does not use DOM, GPU, DPR or registration.


## Prepare copied RGB matrix pixels

`applyImageRGBMatrix(asset, matrix)` is synchronous CPU preparation. It uses the existing exported `SpriteRGBMatrix` twelve-number tuple. Both arguments are required. Each output RGB row evaluates `R*m0 + G*m1 + B*m2 + 255*m3` in JavaScript binary64 from left to right, clamps to0..255 and rounds once with `Math.round`. Alpha bytes stay exact, including zero. Hidden RGB is transformed. This byte operation has its own rounding contract; it makes no GPU Float32, linear-light or CSS color parity claim.

The input must have exactly ordinary enumerable data width/height/pixels fields, integer dimensions1..4096 and exact ordinary non-shared Uint8Array RGBA8 bytes. Four own metadata overrides are refused. Irrelevant pixel fields are ignored without getter reads or indexed-key enumeration. The matrix is an ordinary dense data array of length12; RGB coefficients are finite -4..4 and offsets -1..1. Negative zero, accessors, holes and extra fields refuse with INVALID_ASSET. Both shapes are checked before the1MiB input budget and typed copies; valid oversize is ASSET_LIMIT. Copied source plus independent result uses at most2MiB internal typed payload. No DOM/GPU, registration, geometry, Scene or document policy is added.

The existing sprite-tint host retains tint controls and its original WHITE opaque/WHITE transparent atlas. Bake RGB bytes prepares a copied2×1 asset with red offset0.25, giving `[64,255,255,255,64,255,255,0]`. The Sprite stays50×50 with a full2×1 crop. A copied tree/new renderer is admitted before swap. Save/Open stores prepared bytes without running the helper again; restored public position edit, PNG and Dispose controls supply the bounded native flow. Evidence is in `consumer/evidence/image-color/`. Native proof and broader integrated-root acceptance remain separate.

### Copied image alpha-mask preparation

`applyImageAlphaMask(asset, mask: SpriteAlphaMask)` returns a copied, same-size RGBA8 asset. It preserves every RGB byte, including hidden RGB, and uses the four existing mask coefficients to bake alpha. The explicit JavaScript binary64 calculation is `v = ((R*m0 + G*m1) + B*m2) + 255*m3`, followed by `Math.round((A * clamp(v, 0, 255)) / 255)`. There is no intermediate byte rounding. Original alpha0 remains0. This encoded-byte calculation does not claim GPU Float32 or linear-light parity.

Both arguments are required. The mask must be a dense ordinary four-number data array; coefficients are finite in[-4,4], bias in[-1,1], and negative zero is refused. Complete ordinary asset and mask validation precedes the1MiB input budget and all typed copies. Dimensions are1..4096, pixels are exact nonshared ordinary Uint8Array RGBA8, and four own typed metadata overrides are refused without enumerating indexed bytes. Malformed input throws `INVALID_ASSET`; valid oversized input throws `ASSET_LIMIT`. Source copy plus output uses at most2MiB of typed payload. No DOM, GPU, registration or retained global state is used. The caller owns the prepared asset and any later atlas, filter or file work.

### Copied edge extrusion

`extrudeImageAsset(asset, gutter)` adds exact copies of the nearest source edge and corner pixels. Both arguments are required. Gutter is an integer in 0..64; dimensions become source width/height plus twice the gutter. Every RGBA byte, including hidden RGB under zero alpha, remains exact. Zero gutter also returns independent pixels.

Complete ordinary asset and gutter validation precede budgets and copies. Malformed input throws `INVALID_ASSET`; valid input/output above1MiB or derived dimensions above4096 throw `ASSET_LIMIT`. Internal source copy plus output use at most2MiB typed pixel storage. No scratch image, DOM, GPU or automatic registration is used. Existing rendering already clamps crop UVs; this prepares physical gutter bytes and does not promise a bleeding fix, atlas packing or seamless sampling.

### Copied image alpha matte

`applyImageAlphaMatte(source, matte)` returns an independent same-size RGBA8 asset. It copies source RGB bytes exactly, including hidden RGB under original or newly zero alpha, and sets alpha to the nearest integer of `sourceAlpha * matteAlpha / 255`. Matte RGB is ignored. Alpha0 is never revealed. Both inputs are required and must have equal width/height; there is no automatic resampling, offset, registration or Scene effect. This lets a separately prepared matte clip image bytes before atlas, filter or file processing.

Complete ordinary asset shapes and equal dimensions are validated before budgets or typed copies. Dimensions are integers1..4096 with negative zero refused. Each input must be exact nonshared ordinary Uint8Array RGBA8 and fit1MiB. Four own typed metadata overrides are refused without enumerating indexed pixel keys or reading unrelated getters. Malformed input or mismatched extents throws `INVALID_ASSET`; a valid equal oversized pair throws `ASSET_LIMIT`. Two copied inputs plus output use at most3MiB typed payload, with no pixel scratch, DOM/GPU or retained global state. Aliased inputs are allowed; returned storage remains independent.


## Unicode single-line browser labels

`rasterizeBrowserText({ text, font, atlasId, dpr, textPolicy: 'unicode-single-line' })`
prepares one copied whole-label atlas and retains the original semantic text.
It admits 1..128 well-formed UTF-16 code units with non-whitespace content,
excluding C0, DEL/C1 controls and U+2028/U+2029. It does not normalize text.
The host prepares a local font; browser shaping and font fallback determine
actual glyphs. Font readiness is not a glyph-coverage certificate. Existing
ASCII defaults, printable ASCII, multiline and wrapping keep their contracts.
Save/Open stores the complete text, layout and pixels, not the font, policy or
raster DPR. A later edit explicitly chooses the current font and policy.
The existing browser-text consumer adds an editable Unicode draft using
24px system-ui at DPR2, with accepted-state retention on refusal and disposal.
No downloaded font, shaping kernel, global coverage or cross-device parity is
provided. Existing raster size, byte limits and scratch cleanup remain.

### Bounded single-line ASCII ellipsis

`rasterizeBrowserEllipsizedText({text,font,atlasId,maxWidth,dpr?})` accepts1..128 printable ASCII code units with a nonspace character. The host prepares the font. Maximum logical advance is required, finite and positive, at most1e6. DPR defaults1 in1..4. Full original text is drawn when its advance fits. Otherwise every prefix of length0..N-1 plus ASCII `...` is measured, and the greatest fitting prefix wins. Nonmonotonic kerning is supported; no candidate fit throws `ASSET_LIMIT` before drawing.

The result exposes `displayText`, `truncated`, `visibleTextEnd` and `maxWidth`. Derived display text is at most130 code units. `layout.text` and the whole-label range0..N preserve original semantics. The visible prefix end excludes the three dots; no caret/grapheme mapping is claimed. Maximum129 whole-string measures reuse selected metrics; one private canvas and one draw retain1024×256/1MiB raster caps and finally release the backing to0×0. Width bounds advance, not ink overhang or padding. This fixed ASCII entry does not change Unicode/default/multiline/wrapped policies or introduce a Unicode ellipsis character.

### Copied same-extent image outline

`outlineImageAsset(asset, radius, color: Color)` prepares a copied constant-color alpha outline. Radius is required, integer1..8; the square neighborhood includes its centre and treats outside pixels as alpha0. Output alpha is `Math.round((maximumNeighborhoodAlpha - centreAlpha) * color[3])`. Nonzero output pixels have RGB `Math.round(255 * color[channel])`; output alpha0 has RGB0. The source is unchanged. This max-minus-centre operation can outline isolated shapes and transparent holes; same extent clips the effect at image edges. It is not a box mean, a shifted shadow, a Scene effect or a renderer change.

All three arguments are required. Complete ordinary asset shape, radius and dense ordinary Color4 validation precede budgets/copies. Color channels must be finite0..1, and negative zero is refused. Input/output each fit1MiB with dimensions1..4096; malformed input throws `INVALID_ASSET`, valid oversized input `ASSET_LIMIT`. Four typed metadata overrides are refused without enumerating indexed bytes or reading unrelated getters. Source copy, one-byte-per-pixel horizontal maximum scratch and RGBA output use at most2,359,296 typed bytes (2.25MiB). No extra pixel scratch, DOM/GPU, registration or global retention is used.


### Native SVG with linear path fills

`exportSceneLinearSVG(scene, logicalSize)` exports a copied Scene29 group/path scene as browser-display SVG. It returns the existing `SVGExportResult` union. The legacy `exportSceneSVG` and solid-only SVG importer keep their separate behavior; the new output has no gradient import or round-trip guarantee.

Linear fills require two opaque endpoint colors on the existing 8-bit RGB grid (rounding tolerance `1e-12`). Original local endpoints use SVG `userSpaceOnUse`, `pad` and explicit `sRGB` interpolation. Positive path/group transforms preserve local gradient coordinates. Inherited alpha and visibility multiply each leaf fill/stroke opacity, without isolated group opacity. Solid fills/strokes retain the existing paint restrictions. Unsupported radial fills, stop transparency, masks, node kinds, hit settings, pivots, signed scales, stroke styles, layers or colors return complete diagnostics and no SVG.

The existing full scene validator copies input before export and keeps its 1 MiB, 256-node, depth-16, 32-path and 256-command-per-path limits. Endpoints closer than `0.001` remain `INVALID_SCENE`. The new native profile does not apply the legacy importer's extra wrapper admission. Definitions are deterministic, at most 32 with 64 stops, and skip every source ID. Output contains local references only and is bounded to 1 MiB of ASCII code units/UTF-8 bytes before fragments are assembled; an output overflow throws `SCENE_LIMIT`. This does not certify GPU precision admission, arbitrary native SVG hit behavior, edge raster parity, color management or device coverage.


### Native gradient SVG

`exportSceneGradientSVG(scene, logicalSize)` exports the bounded Scene29 group/Path profile with solid, linear and concentric radial fills. Gradient stops must be opaque and use the existing eight-bit RGB grid. Local gradient coordinates, inherited leaf alpha and visibility remain explicit. Unsupported fields return diagnostics without an SVG. The old solid and linear export profiles keep their behavior.

Open `consumer/current-v29-svg.html?gradient=1` to display the exported file with the browser's native SVG reader. The original Scene remains editable. Native gradient SVG display does not extend our solid-only SVG importer. See `consumer/evidence/svg-gradient/` for actual file/interior-pixel/lifetime proof and limits; no device-edge parity or release claim follows.


### Local Blob request ownership

The `consumer/image-decode.html` host gives each image selection or document Open a request token. A late decoder result or error cannot overwrite a newer Open. The token is captured before a native `File.text()` read; stale staged renderers are disposed. A newer refused request retains the accepted document and does not revive older work.

The host's Dispose control invalidates pending work, removes its owned controls and releases the current renderer. Late completions and repeated Dispose retain readable terminal state. The public decoder, Blob limits and Scene6 document profile remain unchanged. See `consumer/evidence/blob-open-generation/` for the focused controlled-hold/native-file proof, separate from earlier decoder receipts and current-root acceptance.


### Authored subtree copies

`duplicateSceneSubtree(scene, sourceId, { nodeIds, assetIds, offset })` copies the selected Scene29 node and its descendants into the same parent, immediately after the original. Supply exact fresh node and asset ID maps. Layers remain unchanged; the offset uses parent-local logical pixels. The returned Scene and maps are independent. The helper copies references, not asset pixels or display resources.

A host snapshots original pixels through `getImageAsset`, registers independent copies under the mapped IDs in a fresh renderer, and admits the candidate before replacing accepted state. Current asset/device limits still apply. The `consumer/subtree-duplicate.html` example edits the copied path, image and whole label, then restores both subtrees from a document. It does not clone listeners, capture, font work, history or selection. See `consumer/evidence/subtree-duplicate/` for the scoped native receipt; exact adoption and broader current-root acceptance remain separate.

## Copied encoded RGB color key

`applyImageColorKey(asset, key, tolerance)` copies a bounded RGBA8 image. It sets alpha to zero when all three encoded RGB channels are within the inclusive integer tolerance of the byte key. Every RGB byte and every nonmatched alpha byte stays exact. This synchronous preparation uses at most two1MiB typed arrays and does not register pixels or change a Scene effect. `consumer/sprite-blend.html?key=1` retains an original Follower and adopts the copied keyed Main Sprite before Save/Open/edit/PNG. The document stores pixels, not a recovered key recipe. See Issue #1452 and `consumer/evidence/image-color-key` for actual author acceptance and limits.

## Bounded SVG endpoint arc import

`importSVGArcElement` is a separate solid SVG profile. It converts explicit absolute endpoint `A` commands into bounded approximate cubic controls and returns SceneV5 with the existing diagnostics shape. The legacy importer keeps its original arc refusal. The example `examples/canvas2d-scene/svg-v5.html?arcs=1` explicitly constructs an editable current tree through public Frame/Group/Path APIs, then saves and reopens a current v1 document. Source SVG parameters are not recovered from normalized controls. See Issue #1451 and the `consumer/evidence/svg-arcs` author receipt for measured scope and first failures.


### Bounded convex polygon intersection

`intersectConvexPolygons(left, right)` accepts one copied strictly convex simple contour per operand,3–32 integer points in[-4096,4096], with unique ASCII IDs. Either winding is accepted. Proper crossings, strict containment and disjoint inputs are supported; interoperand endpoint contacts or overlapping edges return UNSUPPORTED_FEATURE. Exact BigInt/rational predicates produce a canonical positive-area contour with at most64 points, then convert coordinates once to binary64. The result reuses PolygonBooleanResult with operation intersection, zero or one ResultContour1, and sourceIds in caller order as operation provenance. Caller Scene admission owns display IDs. The helper limits clipping to2048 point visits and rational intermediates to512 bits. No DOM or GPU resources are created.

## Authored path subdivision

`splitPathSegment(commands, index, t)` copies a validated authored path and replaces one L, Q or C segment with two same-degree segments. The required parameter is strictly between 0 and 1. Coordinates use bounded binary64 de Casteljau interpolation. The result has at most256 commands; M/Z targets and a constant selected segment are unsupported. Source validation, index/parameter errors and derived collapse remain explicit typed refusals. The helper does not change paint, handles, Scene versions or resource registration.

The existing `examples/canvas2d-scene/path-control-editing/index.html?split=1` profile inserts a cubic midpoint and edits the inserted shared anchor through copied public path handles and the existing history adapter. Prepared commands reopen from genuine JSON bytes without subdivision. Its focused evidence stays in the separate `evidence/path-split/` directory. Native author proof and later exact adoption/current Root1254 qualification are separate.


### Coverage-area image downsampling

`downsampleImageAsset(asset, width, height)` produces a copied RGBA8 resource for dimensions within the source extent. Shrinking includes every source pixel's footprint coverage, averages encoded RGB with alpha weights and rounds each output channel once. Rounded alpha zero produces zero RGBA. Identity dimensions return an independent exact copy, including hidden RGB. Inputs and outputs are each limited to1MiB; source copy plus output has a2MiB ceiling and no pixel scratch array. Complete shape and dimension validation precedes budgets and copies. Malformed or enlarged requests use INVALID_ASSET; valid oversized assets use ASSET_LIMIT.


### Browser paragraph preparation

`rasterizeBrowserParagraphText` fits a well-formed Unicode original of1–128 UTF16 units to a declared advance width. Require font, atlasId, maxWidth, lineAdvance, direction (`ltr` or `rtl`) and breakPolicy (`grapheme`); DPR defaults to1 and physical lineAlign toleft. Native Intl.Segmenter supplies grapheme boundaries. LF separates nonblank hard lines; soft wrapping preserves every cluster and space. The helper checks all complete remaining prefixes and selects the greatest fitting endpoint, with at most512 measures and4 draws. No fit or more than4 lines uses ASSET_LIMIT before drawing. Missing Segmenter/browser facilities use UNSUPPORTED_FEATURE. Existing1024×256/1MiB copied atlas and scratch reset limits apply. The result records original UTF16 line ranges, resolved segmenter locale and preparation direction while keeping one whole-label quad. Browser shaping and cluster wrapping remain tied to the prepared host font/profile.
