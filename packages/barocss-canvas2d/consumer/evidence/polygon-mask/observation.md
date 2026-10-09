# C2D-75 copied polygon group mask native verification

Input parent: `ab81aacade3def44e1736ab0b935a8f6b72278ae` (accepted #1010 local develop). Issue: #1025. This is native evidence. Integration and publication are pending.

## Executed checks

- Node 22 library build: 218.7 KiB. Strict consumer TypeScript check passed.
- `policy-probe.mjs`: 16 rejection cases, copying, accessor avoidance, concave and reversed contours, signed/sheared transformation, 32 vertices and Float32 collapse.
- `probe.mjs`: 31 rejection cases, Scene v0–v24 compatibility, Scene v25 copying/restore, CPU hit/bounds, hidden nested mask refusal, attach/reparent/capacity rollback, SVG refusal, view admission retaining the previous accepted scene/view, and mask-only admission without stencil.
- Existing transformed-clip focused probe passed. Its current-tree snapshot is v25; the explicit v24 fixture remains supported.

## Actual browser

Isolated HeadlessChrome 155, WebGL2, DPR2; 320×240 logical viewport / 640×480 backing pixels. The consumer uses the public package API. It combines a rotated frame, concave L mask, sprite, nonzero gradient path with a hole, glyph, stroke, group interaction area and following unmasked rectangle/image/path draws.

18 pixel and hit samples were recorded in `browser-observations.json`. The notch and clipped points fall through to Back. Opaque glyph ink selects Glyph; transparent glyph pixels select Sprite. The group area has no paint and selects MaskGroup. Following unmasked draws retain their expected colors. Three real pointer clicks verify Glyph/group/frame/stage and Back routes.

Physical Remove/Restore controls change the notch hit and paint. Physical Mirror applies pivot and negative/nonuniform scale under the rotated frame. Sample locations change with the object; the mirrored stroke sample overlaps a later sprite, and a former outside-frame sample enters the frame. These are observed layer/geometry changes, not identical initial samples.

Duplicate mask edits return INVALID_SCENE, nested masks return UNSUPPORTED_FEATURE and precision admission returns SCENE_LIMIT. The previous accepted samples remain unchanged.

## Actual file flow

Physical Save downloaded `saved-document.json`: **4,913 bytes**, Scene v25, SHA-256 `bced43eaf8c5b3a2d1c77816032b0f2f95fd6244bc8fe87a9061125ab31fdd88`.

After an intervening mask edit, the physical file chooser opened the saved bytes in a fresh canvas/tree/renderer. All mask commands, all 448 atlas bytes (384 glyph + 64 image), and all 18 saved samples matched. The previous renderer was disposed. A restored mask edit and actual glyph click passed.

The final consumer source includes a narrow opened-document kind guard. After that guard was added, the page was reloaded and the actual chooser Open → physical Save → restored mask edit flow was repeated. The final download has the same 4,913 bytes and SHA-256. `final-browser.json` records this replay.

Physical PNG export downloaded `exported.png`: **13,962 bytes**, SHA-256 `c143b29dd52a8b5c180df37442da481d26fd6ca5e46d06b66a502e03f8d91d03`. Actual createImageBitmap/Canvas2D decode produced 640×480 pixels; all 18 samples matched the accepted PNG frame. The bitmap was closed. CPU/GPU equality at every polygon boundary is not claimed.

Actual WEBGL_lose_context loss/restoration preserved all 18 accepted pixel/hit samples. A separate actual WebGL2 context with stencil disabled (stencilBits=0) rendered masked rectangle, image and glyph colors/hits, with a transparent notch and GL error 0. It was disposed.

Physical Dispose left zero live display renderers, balanced bindings and no pointer/log changes after another canvas click. Final-source replay counts are created=2/disposed=2/live=0/max=2. PNG and the separate no-stencil fixture use their own internal renderer lifetime and are excluded from these display counts. Browser console: 0 errors / 0 warnings.

## Limits and corrections

No pack, release, performance campaign, delayed-file campaign or negative-file browser campaign was executed. Generation guards are source evidence. Pure test fixtures were corrected for reused command references, an invalid renderer test method, and a zoom beyond the existing maximum. These were test-fixture errors. No runtime mask defect was found in the browser checks.
