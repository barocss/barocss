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
