# #1273 native image crop observation

The bounded native implementation passed CPU, types and one actual browser file flow. This is native evidence on parent `6bd3376d6943a8d84b83ca62b0031a9ec8927bea`. Serial adoption, composed current root checks under #1254/#674 and publication remain separate.

The public synchronous `cropImageAsset(asset, rect)` copies exact source pixels. It retains hidden RGB at zero alpha. It uses the existing public `SourceRect` type. It validates all object descriptors, dimensions, typed bytes, rectangle bounds and budget before copying or allocating pixel payload. It calls the existing `copyImageAsset`, then copies each selected row. Input and output each fit 1 MiB. There is no retained helper state, DOM, decoder or GPU work.

Node 22.22.0 checks passed:

- `pnpm --filter @barocss/canvas2d build:library`.
- `pnpm exec tsc -p packages/barocss-canvas2d/consumer/tsconfig.json`.
- `pnpm exec tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-crop.json`. This checks actual source host imports and explicit compiled root declarations.
- A bounded esbuild bundle of the source root in `/tmp/c2d1273-source.mjs` and the compiled public root both ran `probe.mjs`. Each target passed 700 independent scalar-selection oracle crops and 9,800 compared bytes. Each passed 76 malformed/bounds/limit refusals with getter reads 0, typed pixel allocations 0 and copy calls 0. Offset views, non-square images, thin crops, full copies, hidden RGB and repeated result/source mutation were checked. The exact 1-MiB full crop measured two 1,048,576-byte typed allocations: 2,097,152 bytes total. The 512 row copy calls had no pixel scratch payload. See `focused.json`.

One actual Chromium 148 browser used ANGLE WebGL2 with SwiftShader. It used the existing `sprite-crop.html`, CLI session `c2d1273` and isolated server port 31273. Original red source metadata, all 16 original bytes, five red GPU samples and Sprite hits passed. Original controls and prior `evidence/sprite-crop/` files remain present. The derived pixel preparation uses a copied candidate tree and a fresh renderer. It admits assets, scene and rendering before the live canvas swap.

Before accepted extraction, malformed, outside, accessor and valid oversize requests refused. They preserved scene, tree, asset bytes, pixel samples, hits, pointer log and exact serialized document. Draw/read counts stayed unchanged during each refused preparation. Getter reads were 0. A separate direct browser 3×2 source to 2×2 crop compared all 16 bytes, including literal `[71,82,93,0]`, and checked result independence.

The host accepted exactly one right-column extraction: original 2×2 to derived 1×2 with all eight literal bytes `[0,0,0,0,0,255,0,255]`. The Sprite kept 80×80 logical size and used `Extracted` with whole-image crop `{x:0,y:0,width:1,height:2}`. Transparent pixels showed yellow Back; opaque pixels showed green Sprite. The full 320×240 backing compared 307,200 bytes against an independent literal rectangle oracle with tolerance 0. Actual mouse clicks hit Back and Sprite and delivered `Team,stage,Sprite,Team,stage`.

The flow saved once (1,116 bytes), clicked the actual file input and uploaded that saved file once. Open created a fresh canvas, tree and renderer. It restored all eight asset bytes, Scene29, `CropConsumer`, Team/Back/Sprite IDs, `Extracted`, crop, pixels and hits. The serialized text matched exactly. Crop preparation count stayed 1 during Open. The restored public Sprite moved from `(20,20)` to `(28,20)`; bytes stayed unchanged and new hits passed.

PNG export downloaded once (2,592 bytes). Public `decodeImageBlob` decoded that file at 320×240. All 307,200 decoded bytes matched an independent literal geometry oracle with tolerance 0. The screenshot was inspected: the moved green lower half extends eight logical pixels right of yellow Back. The upper transparent half shows Back. Controls and status remain readable.

Dispose removed the pointer binding. A later actual mouse click produced no pointer delivery. Binding counts were 3/3. All four created GL contexts are included: original, extraction candidate, Open and PNG export. Each context created/deleted Shader 4/4, Program 2/2, Buffer 3/3, VAO 2/2, Texture 1/1, FBO 0/0. All native `is*` live counts and GL errors were 0. No context loss occurred. CPU crop after Dispose still returned the exact eight bytes. The browser and isolated server were closed after proof collection.

The first post-extraction assertion failed because the evidence expected original list contained 14 entries. Actual original pixels retained all 16 and the accepted crop retained all eight. The first error and current state were retained in private `/tmp/c2d1273-phase1.txt` and `/tmp/c2d1273-first-failure-state.txt`. Only the evidence script was repaired. Validation resumed in the same page. Extraction, Save, Open and PNG were not replayed. Product code did not change after the first accepted extraction. Browser runtime errors were 0. Initial console evidence retains one favicon 404 and four ReadPixels stall warnings. An earlier CLI help call used system Node 18 and refused to start; all actual browser/build/probe calls used Node 22.

The parent public decoder closed its bitmap once but retained its private 320×240 2D canvas backing. This is the pending #1249 limitation. It is not a crop helper allocation or GPU leak. No claim is made about GC, performance, context loss, broad producer/pack installation, release or composed current root acceptance.

Legacy status caveat: `invalid()` and `outOfBounds()` compare complete serialized observations. The added GL read counters change when the observer takes pixel samples. Those legacy status strings can report `retained false` even when the scene and frame are retained. The frozen crop-helper refusal checks compare the actual scene, bytes, frame, hits and document independently and passed. This caveat was reported to the owner during final review.
