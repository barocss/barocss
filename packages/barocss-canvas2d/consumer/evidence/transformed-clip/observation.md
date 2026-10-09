# Transformed frame clip native observation

Exact verified #970 merged parent: `58848034e126ec1a3ebe877d273e426d857546ab`.

## Executed checks

Node 22.22.0 package build passed (202.7 KiB ESM). Strict compiled consumer TypeScript passed. Run from package directory:

```sh
node consumer/evidence/transformed-clip/probe.mjs
```

The focused probe checks v23 rotated clip refusal (including canceled ancestor rotation), v24 admission/reconstruction/copied data, malformed-edit rollback, signed/nonuniform/pivot composed shear, clip intersection/clip:false, conservative bounds, following sibling, renderer Scene/view retention and Float32 rank collapse. Its renderer-state check does not create a GPU context.

## Actual Chromium 155 / WebGL2 / DPR2

Consumer URL: `http://127.0.0.1:52983/consumer/transformed-clip.html`; 240×180 logical, 480×360 backing. The image and common programs linked and rendered actual GPU pixels.

At initial rotation π/6, point (25,25) lies inside the frame AABB but has frame-local x=-9.641016. Pixel was `[64,64,64,255]`, hit Back. Real mouse clicks at logical (56,41) and (25,25) yielded `Sprite:Sprite / RotatedFrame:Sprite / stage:Sprite`, then `Back:Back / stage:Back`.

| Sample | RGBA | Semantic hit |
|---|---|---|
| Sprite inside | 255,0,0,255 | Sprite |
| Path inside | 0,255,0,255 | Path |
| Path even-odd hole | 255,0,0,255 | Sprite |
| Glyph opaque | 255,0,255,255 | Glyph |
| Glyph transparent | 255,0,0,255 | Sprite |
| Glyph outside ancestor clip | 64,64,64,255 | Back |
| Group interaction area inside | 255,0,0,255 | GroupArea |
| Path outside ancestor clip | 64,64,64,255 | Back |
| Nested tile opaque | 0,255,255,255 | NestedTile |
| Nested tile transparent | 26,26,26,255 | NestedOuter |
| Nested nine-slice center | 0,0,255,255 | NestedNine |
| Outside inner, inside outer | 26,26,26,255 | NestedOuter |
| Outside outer | 64,64,64,255 | Back |
| Following unclipped sibling | 255,128,0,255 | UnclippedSibling |

Nested complete matrix was approximately `[-.840873,.710055,.996083,.614511,187.218101,100.725374]`, with signed and unequal scales, pivots and composed shear. A clip:false intermediate frame retained both ancestors. Turning the upper frame clip off made (25,25) red/Sprite; turning it on restored Back. Public rotation edit to π/4 retained all named color/hit controls. A width-zero edit returned INVALID_SCENE; compressed view and precision-losing Scene returned SCENE_LIMIT. Each UI refusal retained accepted data/pixels/hits.

Actual WEBGL_lose_context made render return CONTEXT_LOST. Actual restoration recreated existing programs/textures and restored green Path, Back at outside point, and blue nested nine-slice samples. No new GPU object kind or stencil bit was introduced.

## Real saved file and cold Open

Browser Save downloaded 5,213-byte v1 Scene v24 JSON after π/4 edit. SHA-256: `1c1085b8e309adeeceef29635b3cc9cce5b981f500fcaf8603a98a8879a48b1c`; unchanged downloaded bytes are `document.json`. Real file chooser Open created canvas/renderer/tree generation 2. Every stored asset byte matched host bytes, Scene matched its reconstructed public tree, and the table controls matched. Editing restored frame back to π/6 passed and set restoredEdit=true.

Private CLI output will be retained at `/tmp/canvas2d-983-playwright-cli-20261009`; screenshot `/tmp/canvas2d-983-reopened.png` was visually inspected. Initial fixture failures were missing explicit tile/nine-slice source rectangles; the consumer was corrected before the accepted observation. They were fixture admission errors, not a renderer change. A read-only reviewer also found Float32 rank collapse at x=1e6/scale=.01/rotation=π/4: four vertices shared world x. Admission now rejects zero/changed-orientation rounded corner area and the focused reproducer passes. The added depth-limit probe first reused a transform object and correctly got INVALID_SCENE for duplicate object identity. Giving its extra frame a copied transform allowed the intended SCENE_LIMIT depth check to pass. The successful page emitted no new browser errors/warnings.

This is native evidence. Separate merged-head acceptance, exact CPU/GPU agreement at every numeric edge, older devices and publication are not claimed.
