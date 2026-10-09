# Browser-font raster text native observation (#1011)

## Scope and source

Contract Wiki `47150e7` preceded Issue and code. The exact separately verified #976 parent is `f217cd7060a22f44fcfa6612d701e5bf3e432942`. This delta changes consumer HTML/MJS, focused evidence, docs and declaration configuration only. Core/schema/API are unchanged. The host uses fixed 24px monospace, 1..32 ASCII letters/digits/spaces and one whole-label quad. It does not claim Unicode shaping, per-character caret mapping, portable font identity or saved font files.

## Executed local checks

Node22.22.0 affected package build passed (198.0KiB ESM). Strict consumer TypeScript/checkJs passed after the chooser-generation fix. `node packages/barocss-canvas2d/consumer/evidence/text-raster/probe.mjs` passed 17 invalid texts, 20 nonfinite/missing metric values, signed finite metrics, exact 1024x128/524288-byte admission, two oversized edges, owned RGBA copy, empty alpha/length refusal, Scene23 whole-label metadata and invalid-layout retention. Those metrics are synthetic; this probe explicitly excludes browser fonts, generations and GPU.

## Actual browser and files

Isolated HeadlessChrome155 on macOS, real WebGL2, logical320x128/backing640x256 DPR2. Browser font readiness/load/check ran; generic monospace reported loadedFaces0/checktrue. This does not identify a downloaded FontFace. The initial Canvas2D label measured advance115.21875, bounds[-2,117,-18,3], atlas238x42/39984bytes. HI measured advance28.8046875, bounds[-1,29,-16,2], atlas60x36/8640bytes. H I measured advance43.20703125, bounds[-1,43,-16,2], atlas88x36/12672bytes. Baseline remained local0/world(24,64); quads use measured bounds directly, with no fitted maxWidth.

HI and H I buttons rebuilt accepted fresh canvases/trees. White ink[255,255,255,255] hit Label; an actual empty column of H I remained dark[32,40,56,255] and hit Back. Actual mouse clicks routed Label→stage and Back→stage. Slow HI's documented750ms host readiness gate was superseded by H I; the late result was ignored before renderer creation. Malformed newline gave HOST_TEXT/retainedtrue. The oversized control injects width600 metrics and gave HOST_RASTER_LIMIT/retainedtrue before renderer creation; it is not an actual oversized-font result.

Actual Save downloaded `saved-document.json` (17,907bytes; SHA256 f69ee6007f8af0a1d6d519567938f1a4d6291f418c648e29b6b130c6236778bf). Actual chooser Open restored Scene23 onto a fresh canvas/tree, fontPreparedfalse; prepareCalls stayed6. All 12,672 atlas bytes were compared, mismatches0. Selected ink/space samples and IDs Back/Label matched. Restored edit to HI prepared the current font and swapped a new candidate. Actual PNG export downloaded `exported.png` (5,405bytes; SHA256 fc735da301d0ae4170391d63dd608007a0eb39e9ef21a9b69bf4be57ca0a9d30). Native browser createImageBitmap decoded that exact downloaded file to640x256; selected ink/space/background pixels matched. The bitmap was closed. The private diagnostic decoder produced one getImageData performance warning; browser errors0. The product raster context already sets willReadFrequently.

A real chooser read used a controlled1000ms File.text delay. H I was clicked while it waited; generation11 was ignored, generation12 stayed accepted. Renderer creations increased only6→7, openCalls stayed1, max display renderers2/live1. The original File.text method was restored. The CLI subsequently repeated the same chooser upload; the successful extra document Open is included in beforeDispose counts, not omitted.

Slow HI then physical Dispose left renderer creations8/disposals8/live0. The late candidate increased ignored2→3 without submit/render. An actual click on the disposed canvas left submits8/renders8/pointer2 unchanged. Counts for the PNG helper's temporary canvas are separate from display renderer counts. Font API failure/5s timeout and platform/font variation were source-reviewed only, not executed.

## Artifacts and corrections

`browser-observations.json` stores actual observations; `saved-document.json` and `exported.png` are the real downloads. Screenshots `/tmp/canvas2d-1011-space.png` and `/tmp/canvas2d-1011-restored.png` were visually inspected. Private CLI artifacts stay outside the native delta.

Review found that chooser generation had to be reserved before asynchronous File.text. This was fixed before the final strict check and replayed browser flow. One run-code modal returned while its pending code completed; a later CLI upload caused the extra successful Open described above. No failed browser result was replaced by a source-only claim.

Native completion, develop integration and publication are separate. Integration should preserve the merged Scene24 types/config and source-default manifest work when adopting this consumer-only delta. No full probe/pack campaign, new core Text API or publication is required by this receipt.
