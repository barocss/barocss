# C2D-08 document bundle observation

2026-10-08. Clean native parent `19ccd074` (#691), branch `codex/canvas2d-705`. Actual browser URL: `http://127.0.0.1:55822/examples/canvas2d-scene/document-v1.html`. The browser used compiled `dist` JavaScript and uploaded local JSON files through the host file input. No product integration, npm publication or cross-browser claim.

## File contract and build

- `CanvasDocumentV1` has exact top-level fields `{format,version,scene,assets}`. The scene is its canonical JSON string; assets are referenced-only and ID-sorted, with `{id,width,height,byteLength,sha256,pixelsBase64}`. SHA-256 is lowercase hex over exact top-to-bottom straight RGBA8 bytes; base64 is standard padded canonical form. Limits are 16 assets, 32 MiB decoded bytes, 48 MiB encoded UTF-8 document and the existing 1 MiB Scene limit. The actual v4 [document](scene-and-assets.json) is 5,687 bytes and contains Checker8 256 bytes, GlyphHI 280 bytes, and RGBA2 16 bytes. [Corrupt digest](corrupt-digest.json) and [missing atlas](missing-atlas.json) are retained refusal fixtures.
- Node 22 affected `pnpm --dir packages/barocss-canvas2d build:library` exited 0; base renderer bundle was 60.1 KiB and the independent `dist/document.js` declaration/JS output was generated. `node examples/canvas2d-scene/document-probe.mjs` exited 0. It round-tripped v4 context/node data and every RGBA byte, confirmed parser copies, and refused corrupt digest, missing atlas, unknown document version, extra field, unordered/duplicate asset IDs, truncated base64 and unsupported Scene version. `git diff --check` exited 0.
- The first build failed with TS2345 because `crypto.subtle.digest` requires an `ArrayBuffer`-backed `BufferSource`, while the input type could contain a `SharedArrayBuffer`. The adapter now copies bytes into a fresh `ArrayBuffer` before hashing; the affected build passed. No dependency was downloaded.

## Actual browser file flow

- Before Open, the visible v4 document used DPR2 backing `1600×960` and all three assets. Representative samples were RGBAQuadrants `(460,250)` `[255,0,0,255]`, GlyphHI `(552,253)` `[20,32,56,255]`, and CroppedChecker `(335,250)` `[51,83,97,255]`; hit IDs matched those names.
- Uploading the corrupt digest file reported `INVALID_ASSET: asset GlyphHI SHA-256 mismatch`. Uploading the missing-atlas file reported `INVALID_ASSET: asset table must match scene references`. Both refusals retained the exact original canvas object, GlyphHI hit at `(552,253)` and `[20,32,56,255]` pixel.
- Uploading the valid document reported `Opened v4 · 3 assets`; a **different canvas object** became visible. `contextId` remained `DesignBoard`. Every byte in the fresh renderer's three copied assets matched the host fixtures. All three representative pixel/hit samples were identical to the prior document. The [opened screenshot](opened-document.png) shows the new canvas. Browser Save downloaded `canvas-document.json` with 5,687 bytes; `cmp` against the Node-generated document exited 0.
- The only browser console error was the unrelated missing `favicon.ico` request.

The adapter validates and stages on a fresh canvas. The host controls the file picker, download and visible-canvas swap. Passing a live canvas to staging would not provide the demonstrated atomic UI behavior. This is one bounded v4 image+glyph file flow, not a general archive or storage durability campaign.
