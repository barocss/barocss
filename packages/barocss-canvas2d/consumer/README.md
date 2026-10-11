# Independent compiled consumer

This small host uses only `@barocss/canvas2d` and `@barocss/canvas2d/document`. The local import map points those public names at the package's compiled JavaScript. The `checkJs` configuration resolves their compiled TypeScript declarations. The consumer does not import renderer source or the repository's Canvas2D scene example.

From the repository root with Node 22 and installed workspace dependencies:

```sh
pnpm --filter @barocss/canvas2d build:library
pnpm exec tsc -p packages/barocss-canvas2d/consumer/tsconfig.json
python3 -m http.server 57013 --bind 127.0.0.1
```

Open `http://127.0.0.1:57013/packages/barocss-canvas2d/consumer/index.html`. The page starts with a Scene v3 320×200 logical canvas at DPR2 and a copied 16-byte image asset. Save the actual v1 document, change the rectangle, then Open the downloaded file. The valid file stages a fresh canvas; a corrupt asset digest refuses without replacing the accepted canvas. **Dispose** ends the renderer and shows the `DISPOSED` code. The [one-device observation](evidence/observation.md) records the exact file and pixel/hit results.

This is a local compiled-consumer proof. It does not imply npm publication, broad browser support, or a new renderer API.

## Public display tree consumer

The separate [`display-tree.html`](display-tree.html) page uses the public compiled entries to create a stage, container and two sprite handles. Its `display-tree.mjs` file is included in the same `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` type check. Open `http://127.0.0.1:57013/packages/barocss-canvas2d/consumer/display-tree.html` after the build and server steps above. Move the parent, change Red's anchor, raise/equalize layers, remove/re-add Red, and try invalid edits. The page submits each valid snapshot explicitly. Save a v1 document, change the scene, then Open the actual downloaded file on a fresh canvas. The host reconstructs new handles and the restored tree remains editable. This fixed consumer requires Team with Red and Blue children; the library function accepts any valid Scene v6/v7 group/image tree. Unsupported objects and corrupt files retain the prior canvas, tree and accepted scene. The [first authoring observation](evidence/display-tree/observation.md) and [reopening observation](evidence/display-tree-reopen/observation.md) record the separate checkpoints.

The [`pointer.html`](pointer.html) page uses the same compiled public entries and is included in the consumer type check. It forwards real browser pointer events through `renderer.hitTest` and `tree.dispatchPointer`, showing target-to-parent-to-stage delivery, alpha-aware targets, unsubscribe and propagation stop. It saves an actual v1 document and rebuilds both the renderer and event handles after Open. The [pointer observation](evidence/pointer/observation.md) records the exact browser and file results. The host owns DOM input and logical coordinate conversion; the library owns only validated callback delivery.

The [`ticker.html`](ticker.html) page uses the compiled public `createTicker` entry and is included in the consumer type check. It starts and stops its own browser frame callbacks, edits a sprite from capped `deltaMS`, and explicitly submits/renders each frame. Resume starts with a zero delta, and dispose ends further scheduling. The [ticker observation](evidence/ticker/observation.md) records the deterministic scheduler and actual browser pixels/hits. The ticker does not own renderer or document state.

The [`path.html`](path.html) page uses public `createPath` and `PathHandle` entries. It creates an even-odd fill with a hole, a cubic stroke and an image in one container. It checks real pointer delivery, explicit path edits, image layer order, rejected nonzero self-intersection and v1 document Open into new path handles. The [path observation](evidence/path/observation.md) records actual WebGL2 pixels, hits, file chooser and refusal. Path handles keep Scene v7 data; the renderer still checks the active view and device geometry when the host submits a snapshot.

The [`builder.html`](builder.html) page uses public `createPathBuilder` to make a rectangle and approximate circle, then attaches them through public path handles. It changes the circle radius, forwards a real pointer event and restores a saved v1 document into new handles. The [builder observation](evidence/builder/observation.md) records command/refusal checks, WebGL2 pixels/hits, file chooser and later edits. The builder produces commands only; `PathHandle` owns paint and Scene edits.

The [`image-decode.html`](image-decode.html) page uses compiled `decodeImageBlob` with a real PNG file chooser, then registers the returned pixels as a sprite asset. It checks alpha-aware hit fallthrough, rejected files and v1 document cold Open. The [image-decode observation](evidence/image-decode/observation.md) records actual WebGL2 pixels/hits, asset bytes and file results. The decoder does not fetch URLs or own the asset ID.

The [`glyph.html`](glyph.html) page uses public `createGlyphRun` and `GlyphRunHandle` entries with a fixed host-shaped H/I atlas. It checks visible and transparent glyph pixels, pointer delivery, atomic layout refusal, a changed layout, and actual v1 document cold Open into new handles. The [glyph observation](evidence/glyph/observation.md) records the one-browser results. The host owns the atlas and shaping; the handle edits Scene v7 data only.

The [`rect.html`](rect.html) page creates a public rectangle and overlapping path under a container. It checks compiled types, actual pixels/hits, rectangle pointer delivery, atomic size/color editing, a rejected edit and real v1 document Save/Open into fresh handles. The [rectangle observation](evidence/rect/observation.md) records the bounded Chromium/WebGL2 result.

The [`image-url.html`](image-url.html) page uses compiled `loadImageURL` to fetch a real same-origin PNG through HTTP, register its RGBA8 bytes and render a sprite. It checks a non-image response, a streamed 8-MiB limit, alpha-aware hits and v1 document cold Open. The [URL image observation](evidence/image-url/observation.md) records actual WebGL2 and file results. The helper owns no cache or asset ID.

The [`image-cache.html`](image-cache.html) page uses compiled `createImageAssetCache` for a same-origin PNG. It observes one GET for a repeated load, independent returned bytes, LRU eviction and refetch, exact WebGL2 pixels/hits, and a real v1 document cold Open after cache disposal. The [cache observation](evidence/image-cache/observation.md) records the requests and file flow. The host still owns renderer asset IDs and document state.

The [`frame.html`](frame.html) page creates a public frame with an overhanging rectangle child. It checks compiled types, actual clipped and unclipped pixels/hits, frame pointer delivery, atomic edit refusal and real v1 document Save/Open into fresh handles. The [frame observation](evidence/frame/observation.md) records the bounded Chromium/WebGL2 result.

The [`sprite-crop.html`](sprite-crop.html) page edits a public sprite's Scene v7 `sourceRect`. It checks red, transparent, green, full-atlas and reconstructed blue pixels/hits, real pointer delivery, strict handle refusal, renderer asset-bound refusal and v1 document cold Open. The [sprite crop observation](evidence/sprite-crop/observation.md) records one fixed 2×2 RGBA8 atlas flow.

The [`line.html`](line.html) page creates a public finite line and white rectangle under a container. It checks compiled types, ink and adjacent background pixels/hits, real line pointer delivery, an atomic rejected edit, and v1 document Save/Open into new handles. The [line observation](evidence/line/observation.md) records the bounded Chromium/WebGL2 result.

The [`sprite-size.html`](sprite-size.html) page edits one anchored sprite's logical-pixel destination width and height. It checks actual WebGL2 pixels, alpha-aware hits, pointer delivery, rejected edits and a real v1 document Open into a fresh, editable handle. The [sprite size observation](evidence/sprite-size/observation.md) records this bounded browser/file result.

The [`sprite-animation.html`](sprite-animation.html) page combines public `createSpriteAnimation`, `createTicker` and one sprite handle. A manual scheduler gives deterministic ticker deltas in a real browser; the host registers two RGBA8 atlases, submits snapshots and renders. It checks frame pixels/hits, transparent fallthrough, pointer delivery and a real v1 document Open into a fresh tree and controller. The [animation observation](evidence/sprite-animation/observation.md) records this fixed browser/file result.

The [`sprite-atlas.html`](sprite-atlas.html) page uses public `createSpriteAtlas` metadata to drive one sprite through named crops in a single host-owned RGBA8 image. It checks exact WebGL2 pixels/hits, transparent fallthrough, pointer delivery and a real v1 document cold Open into a fresh tree, atlas and controller. The [atlas observation](evidence/sprite-atlas/observation.md) records this bounded browser/file result.

The [`sprite-tint.html`](sprite-tint.html) page changes one Scene v7 sprite RGB tint while reusing the host-owned image. It checks exact WebGL2 white/cyan/black pixels, alpha-aware hits, transparent fallthrough, pointer delivery and real v1 document cold Open into a fresh editable tree. The [tint observation](evidence/sprite-tint/observation.md) records this bounded browser/file result.

The [`sprite-image-source.html`](sprite-image-source.html) page switches one public sprite between two host-registered RGBA8 assets. It checks actual WebGL2 pixels, alpha-aware hits, pointer delivery, removal of an unused asset, missing/out-of-bounds asset refusal, and v1 document Open into a fresh handle that can switch back after explicit registration. The [image source observation](evidence/sprite-image-source/observation.md) records the bounded browser/file result.

The [`child-order.html`](child-order.html) page changes the direct child index of two same-layer rectangles while a higher-layer rectangle retains priority. It checks WebGL2 pixels and hits, real pointer delivery, invalid-index refusal and a real v1 document Open into a fresh tree before moving a reconstructed handle. The [child order observation](evidence/child-order/observation.md) records this bounded browser/file result.

The [`reparent.html`](reparent.html) page moves one public rectangle between two translated containers while retaining its local transform and handle identity. It checks actual WebGL2 pixels/hits, a real pointer route through the new parent, atomic refusal and v1 document cold Open into new handles followed by another move. The [reparent observation](evidence/reparent/observation.md) records the bounded browser/file result.

The [`visibility.html`](visibility.html) page changes Scene v9 visibility on a sprite, frame and parent container. It checks WebGL2 pixels, hit fall-through, pointer routes, invalid hidden assets and crop, and actual v1 document Save/Open with a hidden sprite followed by editing its restored handle. The [visibility observation](evidence/visibility/observation.md) records the fixed Chromium/browser flow.

The [`transform-setters.html`](transform-setters.html) page changes a sprite's absolute local position and scale and a line's rotation. It checks WebGL2 pixels, hits, pointer delivery, invalid edit rollback, and actual v1 document Save/Open on a fresh canvas followed by another handle edit. The [transform observation](evidence/transform-setters/observation.md) records the fixed browser/file result.

The [`point-conversion.html`](point-conversion.html) page converts a sprite point through a rotated parent to Scene-world coordinates and then through an active pan/zoom view to a canvas point. It checks WebGL2 pixels, hits, pointer delivery, strict invalid input and actual v1 document Save/Open on a fresh canvas followed by a restored parent edit. The [point observation](evidence/point-conversion/observation.md) records the fixed browser/file result.

The [`alpha.html`](alpha.html) page changes Scene v10 inherited alpha on a parent and sprite while retaining authored frame, vector and image paint. It checks WebGL2 pixels, zero-alpha hit fall-through, real pointer routes, invalid edits/assets and a v1 document Save/Open on a fresh canvas followed by a restored parent edit. The [alpha observation](evidence/alpha/observation.md) records the fixed browser/file result.

The [`hit-mode.html`](hit-mode.html) page keeps a blue sprite painted while `hitMode: 'none'` routes hit and pointer delivery to a red rectangle underneath. It changes sprite, clipped frame and parent modes, checks invalid assets, and saves and opens a v1/Scene v11 document on a fresh canvas before editing the restored parent. The [hit-mode observation](evidence/hit-mode/observation.md) records the fixed browser/file result.

The [`world-bounds.html`](world-bounds.html) page places a host outline around a sprite using the public world box and active view. It checks a curved path box, alpha-zero geometry retention with paint/hit fallthrough, actual WebGL2 pixels, sprite and path pointer routes, a parent move, and v1 document Save/Open on a fresh canvas followed by restored alpha and transform edits. The [bounds observation](evidence/world-bounds/observation.md) records the fixed browser/file result.

The [`nine-slice.html`](nine-slice.html) page creates one Scene v12 image node with an explicit 3 × 3 source crop and four one-pixel insets. It checks all nine WebGL2 cell colors at 7 × 5 and 9 × 7 sizes, transparent hit fall-through, one-ID hit stack, real pointer delivery, and an actual v1 document chooser Open into a fresh renderer/tree followed by a restored slice and size edit. The [nine-slice observation](evidence/nine-slice/observation.md) records the browser and file flow.

The [`tiled-sprite.html`](tiled-sprite.html) page creates one Scene v13 repeating sprite with a 2 × 2 RGBA8 crop. It checks repeated and partial WebGL2 cells, transparent hit fall-through, one-ID hit stack, real pointer delivery, positive and negative offsets, tint/additive blend, frame clipping, invalid asset rollback and a v1 document chooser Open on a fresh renderer/tree followed by a restored tile edit. The [tiled sprite observation](evidence/tiled-sprite/observation.md) records the browser and file flow.

The [`pivot.html`](pivot.html) page authors Scene v14 pivots on a rectangle, parent container, anchored sprite and clipped frame. It checks WebGL2 pixels, bounds and hits, real pointer delivery, invalid edit rollback and an actual v1 document chooser Open on a fresh renderer/tree. A restored rectangle handle can reset its pivot to zero. The [pivot observation](evidence/pivot/observation.md) records this fixed browser and file flow.

The [`signed-scale.html`](signed-scale.html) page reflects a two-color-per-row sprite horizontally and vertically with Scene v15 signed scale. It also checks a pivoted rectangle, mirrored parent, clipped frame, off-center path hole, real pointer route, invalid edit rollback and a v1 document chooser Open into a fresh renderer/tree. A restored sprite handle returns to positive scale. The [signed-scale observation](evidence/signed-scale/observation.md) records the fixed browser and file flow.

The [`sprite-hit-area.html`](sprite-hit-area.html) page sets an optional Scene v16 image interaction rectangle. It checks transparent and outside-paint hits while pixels stay fixed, a mirrored pivot, clipped frame, alpha and hit-mode fallthrough, one-ID tiled hits, actual pointer delivery and invalid input/asset/world-limit refusals. It saves a v1 document, opens that file on a fresh canvas and tree, then removes the area on the restored sprite handle. The [sprite hit-area observation](evidence/sprite-hit-area/observation.md) records the fixed Chromium/WebGL2 and file results.

The [`container-hit-area.html`](container-hit-area.html) page authors one Scene v17 group interaction rectangle while retaining separated painted children and an underlying rectangle. It checks unchanged gap pixels, child-first and nested-group hit stacks, a child outside the group area, real pointer delivery, mirror/pivot, inherited frame clip, alpha and hit-mode fallthrough, invalid edit/world-limit refusal and a v1 document Save/Open on a fresh renderer/tree. It removes the area from the restored handle. The [container hit-area observation](evidence/container-hit-area/observation.md) records the fixed browser/file flow.

The [`stroke-cap.html`](stroke-cap.html) page authors Scene v18 butt, square and round path stroke caps, including a rotated and scaled path. It checks endpoint/corner pixels and hits, bounds, real pointer delivery, invalid style rollback, and a v1 document Save/Open on a fresh renderer/tree followed by a restored cap edit. The [stroke cap observation](evidence/stroke-cap/observation.md) records the browser and file flow.

The [`round-join.html`](round-join.html) page authors Scene v19 bevel and round path joins, including a transformed turn. It checks exterior and empty pixels, hits, pointer routing, invalid edit rollback, and a v1 document Save/Open followed by a restored join edit. The [round join observation](evidence/round-join/observation.md) records the browser and file flow.

The [`stroke-dash.html`](stroke-dash.html) page authors a Scene v20 path with bounded on/off stroke lengths. It checks WebGL2 on and gap pixels, semantic hit fallthrough, real pointer routing, a transformed dashed path, rejected edit and view rollback, and a v1 document Save/Open on a fresh renderer/tree followed by an offset edit. The [stroke dash observation](evidence/stroke-dash/observation.md) records the browser and file flow.

`miter-join.html` checks Scene v21 bounded miter joins, bevel fallback, pointer hits and document restore.


## Polygon group mask consumer

Open `polygon-mask.html` after `build:library`, using the existing example server. The fixture uses compiled relative ESM outputs and a 320×240 logical canvas at DPR2. It exercises an L-shaped copied group mask under a transformed clipped frame, Sprite, glyph, gradient/nonzero Path and stroke children, group hit-area clipping and following unmasked draws. Use Mask/Remove/Mirror/Invalid, Save/Open, PNG and Dispose. Browser/file execution evidence is recorded separately from source and pure CPU probes in `evidence/polygon-mask/`.


## Application consumer

`application.html` uses the public `createCanvas2DApplication` root export. Its injected manual scheduler makes update priority, a single automatic render, capped time and late callback behavior observable. Use Start/Step/Stop/Resume/manual Render, missing asset/repair, callback error/recovery and Dispose. DOM pointer delivery remains host-owned. The fixture records accepted pixels/hits separately from the live tree after a rejected frame. This is a controlled scheduler with actual WebGL2; it does not measure RAF performance.

## Public atlas game composition

[`game.html`](game.html) composes the public Application, atlas, animation, display tree and pointer APIs on a 320×200 logical canvas at DPR2. Build the package and run the consumer type check using the commands above, then open `/packages/barocss-canvas2d/consumer/game.html` on the local HTTP server. The committed PNG is fetched through the bounded URL loader; its RGBA bytes are explicitly registered with the renderer. Atlas metadata does not register a texture.

Play/Pause controls host scheduling. Step advances one 100 ms animation frame while paused. Drag the actor over one of three tokens and release to collect it once; the score is host state. Reset pauses, restores frame0 and pose, and shows all tokens with score0. Input converts CSS → logical viewport → world → parent-local coordinates and uses both DOM and display-tree pointer capture. Visibility loss pauses and releases drag. Dispose detaches listeners and ends ticker/animation/renderer lifetime; there is no DisplayTree dispose API. The host ignores load results after cancellation or disposal.

This consumer uses positive group transforms and existing public exports. It does not use transformed Frame clip, SVG export, Physics or automatic text layout. The existing game now uses `createCanvas2DApplication` for renderer/tree/ticker ownership. Its normal `onUpdate` advances animation; an observation-only ticker listener at −100 runs after Application rendering. Step, Reset and pointer movement call `app.render()` outside updates. Host code still owns animation, input/capture and load generations. It imports compiled public entries and is checked against their declarations. The [native observation](evidence/game/observation.md) and compact browser data record executed Node22/types/timing and actual Chromium155/WebGL2 controls, pointer/pixels and teardown. Native and Integration acceptance remain separate.

### Game Application adoption (#1052)

Use **Fail automatic update** to insert a missing atlas reference into one normal update. The host RAF boundary catches the original error. Scheduling stops and accepted pixels/hits remain while the CPU tree differs. **Repair and Play** restores the reference and explicitly restarts. This is partial Scene admission retention, not a tree/asset/view rollback. The existing direct crop and candidate-admission refusal controls remain separate.

Normal automatic frames, manual redraws and refusal redraws have separate counters. Counters describe completed host frames; the native observation independently checked actual WebGL2 color-clear/draw commands. `app.dispose()` owns ticker/renderer cleanup; the host first stops, releases capture and removes input/update/observation subscriptions, then disposes its animation. Cancel/Dispose at the decoded-load gate cannot create an Application. The [adoption observation](evidence/game-application/observation.md) records actual RAF controls, mouse capture/pickup, failure/repair, late callbacks and bounded decode races. The previous [game observation](evidence/game/observation.md) remains historical author evidence. This example has no document export, installed-package or performance claim.

- [nested-mask.html](nested-mask.html): two inherited copied polygon masks in Scene26, a transformed clipped panel, image/glyph/nonzero gradient path, group hit area and zero/one/two-mask sibling resets. UI removes/restores each mask, refuses a third ancestor, saves/opens a v1 document into a fresh canvas, edits restored handles, exports PNG, restores context and disposes the session. Scene25 retains its original nested refusal. See [focused probe](evidence/nested-mask/focused-probe.mjs) and [native observations](evidence/nested-mask/observation.md).

`rgb-matrix.html`: Scene27 copied Sprite RGB rows, filtering/tint/blend, two masks, fresh file restoration, PNG and explicit lifetime. No package campaign.

## Public browser text helper (#1024)

After the compiled package build, open `browser-text.html`. The host waits for its 24px monospace font, then calls the public synchronous `rasterizeBrowserText` helper. Canvas2D, HI and H I use raster DPR 1, 2 and 1.5. The page uses one whole-label glyph quad and copies no private raster service. Each accepted label swaps a fresh canvas, renderer and tree. Invalid and measured oversized font requests retain the accepted label. Save stores exact RGBA bytes in a v1 document; chooser Open restores them on a fresh canvas without calling the helper or preparing a font. The restored label can be rerasterized as HI with the current font, then edited with its public handle. PNG export and Dispose use the existing document and renderer APIs. `browserTextConsumer.observe()` reports the current bytes, layout, samples, hit results and lifetime counts. These controls are a bounded consumer, not a shaping, caret, font download or performance contract.

## Browser-font raster text consumer (#1011)

After the compiled package build, open `/packages/barocss-canvas2d/consumer/text-raster.html`. This host prepares a fixed 24px monospace ASCII label with browser font readiness, measured baseline bounds and copied DPR2 RGBA bytes. One public glyph run represents the complete label; spaces remain transparent. An edit uses a fresh candidate canvas/tree/renderer and commits only the newest accepted generation. Failed or late candidates retain the live label. Save stores Scene and RGBA bytes in v1; Open restores pixels without preparing a font, and later edits use the current host font. PNG uses an actual export file. Font metadata, Unicode shaping and per-character caret mapping are outside this consumer.

- [initial-scene.html](initial-scene.html): stopped Application with a copied initialScene, explicit assets/manual admission, restored handles, controlled update schedule, physical Save/Open/fresh canvas, PNG/context restoration and Dispose. See [native execution](evidence/initial-scene/observation.md).

## Public clipped chart consumer (#995)

After the compiled build, open `/packages/barocss-canvas2d/consumer/chart.html`. Two fixed eight-point series use public Path/Rect handles inside a rotated clipped Frame. Host controls pan/zoom, bounded hit-stack selection and one-point editing. CSS input becomes logical viewport input for renderer hits; public conversion supplies world/plot-local data for tree events. Changes stage a fresh tree/canvas before adoption. Save clears transient selection and stores accepted Scene; Open resets host view/selection, validates exact chart topology and derives data from admitted commands before restoring editable handles. No plotting framework, host dataset metadata or SVG export is provided.

## Fixed glyph diagram consumer

[`diagram.html`](diagram.html) composes nine public Scene v24 objects: two groups with a box and H/I glyph run, a connector, a transformed clipping frame, and a background. A fixed 16x12 host RGBA8 atlas supplies the glyph pixels. This host does not load a font or shape arbitrary text. Drag uses native canvas capture and public display-tree capture. Each valid edit stages a separate tree, updates the existing renderer, and replaces handles and listeners after admission. Open stages a fresh canvas and restores the saved atlas bytes. Save/Open, restored edits, bounded refusals, PNG decode and Dispose are recorded in [the diagram observation](evidence/diagram/observation.md).

## Existing font consumer helper adoption (#1150)

`text-raster.html` reuses the public `rasterizeBrowserText` helper. The host keeps
its 1..32 ASCII policy, 24px monospace font, DPR2, 0..1000ms readiness delay and
five-second timeout. A superseded readiness result returns before helper
scratch allocation. The host checks the current generation again before a
fresh display candidate. Its 1024x128, 131072-pixel and 512 KiB guard runs after
helper preparation. The oversize button uses an actual 1000px font and a string
of 32 copies of the letter M; public errors keep their codes and objects.

Save and cold Open keep the existing v1 document flow. Open uses saved layout
and bytes, including the preserved native Scene23 fixture, without font or
helper calls. Restored HI uses the helper and public `setLayout` on a copied
candidate tree before swapping its fresh canvas and renderer. `textRaster`
reports helper calls, layout edits, bindings and renderer lifetime. The original
`evidence/text-raster` observations remain unchanged. This adoption adds no new
example, core API, Scene version, Application facade or package campaign.

Current adoption checks use `tsc --noEmit -p consumer/tsconfig.text-helper.json`
and `node consumer/evidence/text-helper-adoption/probe.mjs` after the package
build. Run the historical `evidence/text-raster/probe.mjs` from the preserved
#1011 native checkout; it checks the former private host and Scene23.

## Sprite screen blending (Scene28)

Latest display snapshots use Scene28. Sprite creation and `setBlendMode` accept `normal`, `add` and `screen`; earlier Scene0..27 types/admission remain unchanged and reject screen. Screen combines premultiplied stored channels as `s+d-s*d`, with source-over alpha. It reuses source matrix/tint/opacity, clipping/masks and source-alpha hit testing; image bytes are unchanged. Normal/add behavior and document envelope1 stay unchanged. No group blend isolation or full CSS/color-space parity is promised.

The bounded `consumer/screen-blend.html` example compares opaque/translucent backgrounds, edits one Sprite, saves/opens a native document, and disposes owned renderers. Node22 build plus strict `consumer/tsconfig.screen-blend.json` and `consumer/evidence/screen-blend/probe.mjs` check current sources/public compiled types; the recorded actual WebGL2/file/pointer flow is in `consumer/evidence/screen-blend/observation.md`. Historical probes stay tied to their original native Scene versions. Native proof is separate from merged/integrated validation or release.

## Printable ASCII browser labels

`rasterizeBrowserText({text:'-$20',font:'24px monospace',atlasId:'Label',textPolicy:'printable-ascii'})` prepares decimal, currency and status labels through the existing owned raster/layout path. Exported `BrowserTextPolicy` is `alphanumeric | printable-ascii`. Omit `textPolicy` for the original letters/digits/spaces contract. Explicit unknown/undefined/null/accessor fields refuse. Printable mode allows U+0020..U+007E,1..128 characters with nonspace; no control/DEL/Unicode/newline/multiline support. Existing font/DPR/1024x256/1MiB limits, font preparation ownership and copiedRGBA/wholelabel result apply.

Existing `consumer/browser-text.html` shows 12.5, -$20 and FPS:60, byte-only coldOpen, restoredhelper/setLayout and PNG/Dispose. `consumer/evidence/printable-text/observation.md` separates actualbrowser/file proof from Node validation and pendingintegration/release. The policy is raster preparation only; document envelope/Scene and savedglyphtext/layout/bytes do not change.

## Explicit multiline browser labels

`rasterizeBrowserMultilineText({ text: 'Balance\n-$20', font: '24px monospace', atlasId: 'Label', lineAdvance: 40, dpr: 2 })` prepares one copied RGBA atlas and one whole-label glyph quad. Prepare the font in the host first. Upload `result.asset` and create/edit a glyph with `result.layout`. Save stores original text and pixels; Open needs no font preparation. Scene28 and document v1 are unchanged.

Accept 1..4 printable ASCII lines separated by LF, each with a nonspace character, at most 128 UTF-16 code units including LF. Required `lineAdvance` is finite, positive, <=1e6 logical pixels, with last baseline<=1e6. DPR is 1..4; the font declaration has at most 256 characters. No wrapping/normalization/shrinking/automatic gap adjustment. Overlapping lines draw in source-over text order. Transparent gaps use existing alpha hit behavior.

The first baseline is 0. `lines` reports original textStart/textEnd excluding LF, logical baseline and measured advance; `advance` is max measured line width. Bounds union observed ink edges at each baseline, round outward to integers, add 2 logical pixels padding, then ceil backing dimensions at DPR. Logical width/height=backing/DPR. The existing 1024x256 / 1 MiB cap applies to the complete block before resize/draw/readback. Caller owns independent copied bytes/layout; host owns accepted candidate replacement. Browser metrics do not identify a matched typeface or certify shaping.

Ordinary enumerable data options text/font/atlasId/lineAdvance plus optional dpr only. Unknown fields, textPolicy, symbols, accessors, nonenumerable fields and explicit undefined/null, CR, tabs, controls, non-ASCII, empty lines and all-space lines refuse INVALID_SCENE before scratch. Unavailable APIs use UNSUPPORTED_FEATURE; font readiness, finite metrics, readback, allocation or missing ink failures use INVALID_ASSET; oversize uses ASSET_LIMIT. One scratch, at most 4 measurements/draws, one <=1MiB copied readback; multiline finally releases scratch backing to 0x0 on success/error. Single-line API/default errors stay unchanged.

### Explicit multiline alignment

In browser-text.html use Left lines, Center lines or Right lines. Each action prepares Balance LF -$20 through the public multiline helper. Alignment follows measured advance boxes, including spaces, with the longest line's origin unchanged. Save/Open keeps original text and raster bytes; it does not infer preparation policy. Center restored lines uses current host font/alignment and public glyph.setLayout with unchanged text. Existing default, original restored text editing and lifetime controls remain available. Run tsconfig.aligned-text.json and evidence/aligned-text/probe.mjs after the affected build. The evidence receipt separates native checks from merged validation.

### Wrapped paragraph

Use Wrap paragraph in browser-text.html to fit Canvas2D labels fit this panel at maxWidth160/lineAdvance30/DPR2. Three visual lines retain one original30-character paragraph. Save/Open is bytes-only. Refit restored paragraph supplies currentwidth220 through publicwrappedhelper and glyph.setLayout, retaining text while producing two lines. width is preparation metadata and is not inferred from saved bytes. Existing explicit-LF alignment and singleline controls remain. Run tsconfig.wrapped-text.json and evidence/wrapped-text/probe.mjs after the affected build. Native and integrated evidence remain separate.

### Sampled-color alpha mask

The existing rgb-matrix host also edits Scene29 alpha masks: Mask by green/average RGB, Clear alpha masks and Reject invalid alpha mask. Original source texture colors determine transparency; RGB styling remains independent. Save/Open keeps authored mask/RGB tuples and all44source bytes. Restored public setters remain editable. The following colored glyph/plainSprite test row resets, and Frame/twoMasks/linear/nine/tile remain in the same fixture. alpha-mask-types/tsconfig.alpha-mask and focused evidence use publictypes plus bounded private CPU sampling checks. Native browser/file/resource proof is recorded separately from current integrated validation.


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

## Extract copied image pixels

The existing `sprite-crop.html` retains its source cell controls. **Extract right column** copies the original 2×2 atlas into a 1×2 asset. The Sprite stays 80×80 logical pixels. The host admits a copied tree and a new renderer before replacing the current canvas. Save/Open stores the derived bytes and whole-image source rectangle. Open does not call the crop helper. Use **Move restored Sprite**, **Export PNG** and **Dispose** for the bounded file and lifetime flow.

Run `pnpm --filter @barocss/canvas2d build:library`, `pnpm exec tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-crop.json`, and `node packages/barocss-canvas2d/consumer/evidence/image-crop/probe.mjs` from the repository root. The type check includes source host imports and explicit compiled root declarations. Evidence is in `evidence/image-crop/`. Browser decoder cleanup remains subject to pending #1249; this feature does not change the decoder.


### Exact image quarter turns

`rotateImageAsset(asset, quarterTurns)` copies RGBA8 bytes through an exact clockwise rotation. Exported `ImageQuarterTurns` is `0 | 1 | 2 | 3`; both arguments are required. Odd turns swap the asset dimensions. All channels, including hidden RGB at alpha zero, are retained. Identity and repeated calls return independent pixel copies.

The input must have exactly three own enumerable data fields: `width`, `height`, and `pixels`. Dimensions are integers in 1..4096. Pixels must be an ordinary, non-shared `Uint8Array` with exact RGBA8 length and no metadata overrides or extra fields. Invalid records or turns, including negative zero, fail with `INVALID_ASSET` without reading getters or allocating typed pixel copies. Input and output each fit 1 MiB; valid overflow fails with `ASSET_LIMIT` before copying. The copied source plus output uses at most 2 MiB of transient typed payload.

The helper is synchronous CPU preparation. It does not change display geometry, register assets, or use DOM/GPU resources. The capture host uses the cached original 128×64 RGBA capture at source DPR 2. Its Rotate 90 control prepares 64×128 bytes, explicitly keeps the Sprite at 128×64 logical pixels, and updates the whole crop before admitting a copied tree into a new renderer. Save/Open persists the prepared bytes without running rotation again. Arbitrary angles, reflection, interpolation and EXIF orientation are outside this helper. Native evidence is under `consumer/evidence/image-rotate/`; integrated root acceptance remains separate.


### Reopen the saved atlas frame (#1296)

The existing `sprite-atlas.html` host matches the saved Sprite crop against the current session's named catalog. Red, Blue and Clear restore the original three-frame sequence at index 0, 1 or 2. A saved packed Gold crop appends Gold to that reconstructed sequence and restores index 3. The controller starts paused. After Start, the first controlled timestamp has delta 0 and keeps Gold; its 80 ms duration then wraps to Red.

Document v1 stores the accepted Scene crop and atlas bytes. The host retains catalog names and durations in the current session and checks exact atlas dimensions and bytes before Open. The file does not store ticker progress, elapsed frame time or the catalog policy. An unknown crop or mismatched atlas retains the current host and disposes the rejected staged renderer. See `evidence/atlas-saved-frame/observation.md` for the native focused file and lifetime checks.


### Atlas Open after Dispose (#1304)

The existing atlas host rejects `openText` with `Error('consumer disposed')` when the host is disposed. A call that starts after Dispose creates no canvas, parser work, GL renderer or pointer binding. If Dispose occurs while document staging is pending, the host disposes the staged renderer before tree reconstruction, canvas replacement or input binding. Native hash completion can create that temporary candidate; the host then closes it. Dispose remains idempotent. The saved-frame selection and live Open validation keep their existing behavior. See `evidence/atlas-open-dispose/observation.md` for the focused lifecycle checks.


### Exact copied pixel reflection (#1324)

`capture-image.html` keeps its capture, blur, shadow, resize and rotation controls. **Mirror horizontal** prepares original captured pixels with reversed columns. The source and result stay 128×64 pixels, and the Sprite stays 128×64 logical pixels with a full source rectangle. The helper also supports vertical row reversal. Each preparation starts from the cached original; the control does not toggle the current result.

The host admits the copied tree and new renderer before replacing the target canvas. Accepted asset snapshots are copies from the renderer, separate from returned preparation pixels. Open restores the file bytes directly. **Move restored Sprite** uses public `setPosition(8,0)`; **Export PNG** uses the public document exporter. Dispose removes the exact target pointer binding, deletes source/target renderer resources and disables controls. Owned CPU snapshots remain available after Dispose. Diagnostic GL context listeners remain available for evidence and are distinct from pointer bindings.

Use the existing package build/common check and `tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-mirror.json` for the actual source host and explicit source/compiled declarations. `evidence/image-mirror/` contains the independent both-axis byte oracle and native browser/file/PNG/lifetime record. The helper's 2 MiB internal payload excludes host and registration copies.


### Prepare source-over pixels (#1317)

The existing `sprite-image-source.html` retains its AtlasA/B source controls. **Compose images** prepares a fixed same-size foreground over original AtlasA and displays the independent `Composite` asset with a full 2×2 source rectangle. The Sprite stays 80×80 logical pixels on the 120×120 DPR2 host. A copied tree and fresh renderer are admitted before the canvas swap. Caller mutation of the returned preparation cannot change the registered bytes or the separate host-owned asset snapshots.

Save/Open restores Composite bytes directly. Open also registers missing original AtlasA/B assets so their controls remain usable. **Move restored Sprite** uses public `setPosition(8,0)`. **Export PNG** downloads once through the public document exporter. **Dispose** removes the pointer binding and deletes renderer resources; disposed Open entry refuses before staging, and a late staged candidate is closed before adoption. Host-owned asset copies remain available for CPU checks and canonical evidence after disposal.

Use the normal package build and common consumer check, plus `tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-composite.json`. The scoped check covers this actual source host and explicit compiled-root declarations. The focused BigInt oracle and bounded browser/file/PNG/lifetime records are in `evidence/image-composite/`. The helper's 3 MiB internal payload bound excludes host and renderer registration copies.

### Alpha trim in the size host

`sprite-size.html` preserves its size controls and adds **Load bordered image** and **Trim alpha bounds**. The fixed 5×4 source has an alpha-zero border and six interior pixels, including a hidden RGB hole. Loading sets an 80×80 Sprite at `(20,20)` with anchor zero. Trimming returns 3×2 at source offset `(1,1)`; the host explicitly sets size 48×40 and position `(36,40)`, preserving visible placement. This policy applies to the fixed anchor-zero fixture. The helper does not promise automatic arbitrary transform or anchor restoration.

Candidates admit copied trees, fresh renderers and separate CPU asset snapshots before swapping. A valid `null` result creates no candidate or host change. Save/Open stores cropped pixels and adjusted geometry; preparation offsets are absent from the file. Open restores only a missing default Atlas. The restored public edit sets position `(8,0)`; PNG uses the public document exporter. Dispose removes the exact pointer callback and closes the renderer; CPU assets remain accessible. Entry and post-stage checks protect the host's terminal lifetime.

### Padded image in the crop host

`sprite-crop.html` retains the original atlas controls and adds **Pad original atlas**. It prepares the original 2×2 atlas with left 1, right 2, top 1 and bottom 0. The new `Padded` image is 5×3. The Sprite remains 80×80 and uses the full image; the yellow Back remains 80×80. The host admits a copied tree, fresh renderer and independent CPU snapshots before swapping. Original colour buttons select `Atlas` again.

Save/Open stores prepared pixels and the crop as document metadata. Open does not repeat padding. Missing host Atlas defaults are restored without replacing file assets. The restored public edit moves Sprite to `(8, 0)`. PNG uses the public document exporter. Dispose removes the exact pointer callback and closes the renderer; host CPU snapshots remain available. Entry and post-stage checks refuse adoption after terminal disposal. Existing crop refusal status uses its original diagnostic comparison; this padding flow checks stable state independently.


## Prepare copied RGB matrix pixels

`applyImageRGBMatrix(asset, matrix)` is synchronous CPU preparation. It uses the existing exported `SpriteRGBMatrix` twelve-number tuple. Both arguments are required. Each output RGB row evaluates `R*m0 + G*m1 + B*m2 + 255*m3` in JavaScript binary64 from left to right, clamps to0..255 and rounds once with `Math.round`. Alpha bytes stay exact, including zero. Hidden RGB is transformed. This byte operation has its own rounding contract; it makes no GPU Float32, linear-light or CSS color parity claim.

The input must have exactly ordinary enumerable data width/height/pixels fields, integer dimensions1..4096 and exact ordinary non-shared Uint8Array RGBA8 bytes. Four own metadata overrides are refused. Irrelevant pixel fields are ignored without getter reads or indexed-key enumeration. The matrix is an ordinary dense data array of length12; RGB coefficients are finite -4..4 and offsets -1..1. Negative zero, accessors, holes and extra fields refuse with INVALID_ASSET. Both shapes are checked before the1MiB input budget and typed copies; valid oversize is ASSET_LIMIT. Copied source plus independent result uses at most2MiB internal typed payload. No DOM/GPU, registration, geometry, Scene or document policy is added.

The existing sprite-tint host retains tint controls and its original WHITE opaque/WHITE transparent atlas. Bake RGB bytes prepares a copied2×1 asset with red offset0.25, giving `[64,255,255,255,64,255,255,0]`. The Sprite stays50×50 with a full2×1 crop. A copied tree/new renderer is admitted before swap. Save/Open stores prepared bytes without running the helper again; restored public position edit, PNG and Dispose controls supply the bounded native flow. Evidence is in `consumer/evidence/image-color/`. Native proof and broader integrated-root acceptance remain separate.

### Prepared alpha-mask bytes

The existing `sprite-blend.html` host keeps its normal/add controls and original partial-red Atlas. **Mask image alpha** prepares the main Sprite with `[0,0,0,0.5]`, creating an independent Faded asset `[255,0,0,64]`; Follower retains Atlas `[255,0,0,128]`. Both use normal blending and no display alpha mask. The copied tree and fresh renderer are admitted before canvas replacement. Save/Open retain the prepared bytes through current public document validation; moving the restored Sprite and exporting PNG use those bytes without another preparation. Dispose releases the host renderer and its exact canvas callback. CPU preparation remains independent of the renderer lifetime.

### Edge extrusion in the sampling host

`sprite-sampling.html` preserves Nearest/Linear controls and adds **Extrude edge gutter**. The original2×1 red/blue asset with gutter1 becomes4×3; every row contains red,red,blue,blue. The Sprite stays40×30 at20,20 with anchor zero and the full4×3 crop. Copied tree, fresh renderer and independent CPU asset snapshots admit before the live swap.

Save/Open stores prepared pixels and full crop without calling extrusion again. Public staging validates the current Scene rather than the former narrow version list. Open restores only a missing default Atlas and preserves file assets. Restored public edit sets position8,0; PNG uses the public document exporter. Dispose removes the exact pointer callback and closes the renderer, while CPU assets remain available. Entry and post-stage checks protect terminal lifetime; no general competing-Open policy or sampling-parity promise.

### Prepared independent alpha matte

The existing `alpha.html` host retains inherited-alpha controls and the original Atlas. **Apply alpha matte** prepares a fixed2×2 source and independent2×2 matte, preserves all source RGB, and displays copied Matted bytes under the existing blue Frame and green Vector. A copied tree, candidate renderer and separate CPU snapshots are admitted before replacement. Current public document staging reopens the prepared bytes without rerunning the helper. A restored Sprite position edit remains local to the Frame; PNG export uses the accepted document. Dispose removes the exact host canvas callback and releases all owned GL resources; CPU preparation has an independent lifetime.


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

### Ellipsis in the existing text raster host

`text-raster.html` retains the automatic `Canvas2D` bootstrap and original controls. **Ellipsize long label** prepares semantic `A B C D E F G H` with width90,24px monospace/DPR2. Native measurements select a display prefix plus `...`; the full semantic text/range stays in the GlyphRun. Candidates reuse existing readiness/admission/lifetime logic and retain independent renderer-owned CPU pixels.

Saved files store original text/ranges and prepared raster bytes. Open does not prepare fonts or rasterize again. Font and ellipsis preparation profile are null/unknown on file restore; pixels do not identify the display string or font. **Move restored label** uses public position40,64 without rerasterizing. PNG and Dispose reuse existing APIs. This is an advance-width policy, not pixel clipping or arbitrary typography/caret parity.

### Prepared outline and nine-slice

The existing `nine-slice.html` host retains its original palette and resize/edit-slice controls. **Prepare outline** uses a copied3×3 source with an opaque centre, radius1 and white alpha0.5. The independent Outline asset has eight white alpha128 cells and a transparent centre. Existing nine-slice insets1 display that asset as a1logical-pixel ring around a7×5 Panel over gray Back. A copied tree/new renderer and separate CPU asset snapshots are admitted before replacement. Current public document staging restores the prepared bytes without another outline call; **Move restored Panel** uses public position8,0, and PNG export uses the accepted document. Dispose removes the exact canvas callback and releases its GL resources.


### Linear SVG display profile

Open `current-v29-svg.html?linear=1` for copied Scene29 linear-path SVG export. The existing solid mode remains the default. The linear mode exports an edited transformed path, opens the genuine downloaded SVG for native browser display, and separately saves/opens the original editable Canvas JSON document. SVG display does not use the solid-only importer. A radial corrective draft is retained on export refusal. The bounded evidence is in `evidence/svg-linear/`; selected interior comparisons and exact source/file/lifetime receipts have their own declared scope, separate from broader integrated acceptance.


### Native gradient SVG

`exportSceneGradientSVG(scene, logicalSize)` exports the bounded Scene29 group/Path profile with solid, linear and concentric radial fills. Gradient stops must be opaque and use the existing eight-bit RGB grid. Local gradient coordinates, inherited leaf alpha and visibility remain explicit. Unsupported fields return diagnostics without an SVG. The old solid and linear export profiles keep their behavior.

Open `consumer/current-v29-svg.html?gradient=1` to display the exported file with the browser's native SVG reader. The original Scene remains editable. Native gradient SVG display does not extend our solid-only SVG importer. See `consumer/evidence/svg-gradient/` for actual file/interior-pixel/lifetime proof and limits; no device-edge parity or release claim follows.
