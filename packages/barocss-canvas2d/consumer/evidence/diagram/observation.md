# C2D-72 fixed glyph diagram native observation

2026-10-09 UTC. Issue #996. Exact parent: verified #983 merged head `c731a0fd2c3795c85dd2c566e0ec41662ca4b17f`. This is a consumer implementation and native verification. Develop integration and publication are separate.

## Implementation and checks

Only package consumer files, docs, config and evidence changed. No renderer, schema, core API or manifest changed. The fixed host composes nine public Scene v24 objects: a background, rotated clipping frame, connector, two groups, two boxes and two glyph runs. `diagram-host.mjs` owns a fresh 16x12/768-byte H/I RGBA8 atlas. Saved atlas bytes are copied and used as authoritative data; Open does not regenerate or compare them to today's pattern. Fixed topology/styles/defaults are checked before allocating a fresh renderer. Positions are finite and bounded to ±500. Connector centers use group `toWorld` and frame `toLocal`; admission checks coordinates within 1e-10 and keeps the admitted command bytes before comparing the full canonical snapshot.

Node 22.22.0 `pnpm --filter @barocss/canvas2d build:library` passed (203.2 KiB). Strict consumer `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` passed. The focused `node packages/barocss-canvas2d/consumer/evidence/diagram/probe.mjs` passed: copied atlas, 56 opaque/136 transparent pixels, five invalid position cases, fresh tree independence, center conversion, H/I metadata edits, invalid layout retention, six topology/style/connector refusals, 3,962-byte pure document and all 768 restored bytes, corrupt SHA rejection. This probe does not test a renderer, listeners or GPU.

Two helpers owned the HTML/module fixture and pure probe separately. A read-only review found no blocking contract defect. Main owned the host helper, docs/config, build, browser flow and final commit.

## Actual browser flow

Local HTTP port 52996, isolated HeadlessChrome 155, actual WebGL2, 360x240 logical / 720x480 backing at DPR2. The page's imports use the two compiled public package entries. Browser console: zero errors and zero warnings.

- Initial opaque H/I pixels: white `[255,255,255,255]`, hits LabelA/LabelB. Transparent glyph pixels: red `[204,51,51,255]` or blue `[51,102,204,255]`, hits BoxA/BoxB. Connector midpoint: yellow `[255,204,0,255]`, hit Connector. Background and outside rotated frame: `[26,31,41,255]`, Back only. All nine pixel/hit/stack samples are recorded.
- A real glyph click delivered LabelA → NodeA → DiagramFrame → stage. A real box drag captured NodeA in both DOM and display tree. Moving outside the canvas kept capture while the spatial hit was null. Candidate trees and listeners changed during the drag; the canvas and renderer stayed identical. Returning A to about (-20,40) kept the box clipped at the frame boundary; the tested outside-frame point remained Back only. Pointer-up cleared both captures. Six capture transfers were observed in this drag.
- A public position edit set A to (40,40) before Save. Physical invalid-position button returned HOST_POSITION with retained:true. The live renderer count stayed one.
- Physical Save downloaded **3,976 bytes**, SHA-256 `b38e9abd4b52853369cb176a7f4b023010cb2621d22b2704c6bcc590406014f7`. Physical file chooser Open used that exact file after intervening node/label edits. It created a fresh canvas/tree/renderer, disposed the old display renderer and reset selection/drag/view. All nine IDs and all nine pixel/hit/stack samples matched. All **768** atlas bytes were compared, mismatch zero.
- A real restored B drag changed local position to approximately (169.136887,73.433689); the connector followed. Physical label edit changed restored A from H to I and rendered its admitted glyph layout.
- A corrupt asset SHA file returned INVALID_ASSET with retained:true. A canonical valid document whose frame width was 259 returned HOST_DIAGRAM with retained:true. Both were opened through the real file chooser before renderer creation. An initial negative fixture was incorrectly written with Python whitespace in its Scene string and returned SERIALIZATION. That real refusal is retained in the evidence; the topology file was rebuilt using public `stringifySceneJSON` and then tested again. No product code change was needed.
- Physical PNG export downloaded **11,147 bytes**, SHA-256 `d51094b43d89db9319ff0170e50d2f07fc97d7e6516fb88d5ecc52dec4a6cfc8`. The accepted v1 document was exported with explicit identity view/logical size/DPR. The actual file was decoded with `createImageBitmap` and Canvas2D with `willReadFrequently`; decoded size 720x480 and all nine sample RGBA values matched the current WebGL2 display. Bitmap closed. PNG temporary canvas count one; the display renderer counters exclude the document helper's temporary renderer, which the helper disposes.
- Physical Dispose removed all bindings and disposed both created display renderers: created=disposed=2, live=0, activeBindings=0. A later real canvas click left sceneSubmits=14, renders=14, pointerEvents=17 unchanged. Max simultaneous display renderers=2 during Open; Open/PNG temporary use is serialized. oldDomCallbacks=0.

## Evidence and limits

`browser-observations.json`, `saved-document.json` and `exported.png` contain the executed evidence. The private screenshot was visually inspected: two labeled boxes, connecting path and rotated clipping frame. Browser/server stopped after verification; CLI scratch files moved outside the worktree.

Native mouse coordinates are browser-quantized; observed drag positions are reported as measured. The pure conversion checks use their separate 1e-10 tolerance. Open generation/late file and PNG/Open slot behavior were reviewed in source; no extra delayed-file or context-loss campaign ran here. There is no arbitrary text shaping, font loading, Unicode, per-character editing, undo, framework adapter, publication or broad device claim. No full probe or npm pack campaign was repeated.
