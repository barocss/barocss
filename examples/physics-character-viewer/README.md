# Actual upright capsule Viewer host (#1065)

Stage: implementation under native qualification. No host GO or Integration adoption is implied by this README.

Run Node22 `node examples/physics-character-viewer/setup.mjs`, then `node examples/physics-character-viewer/server.mjs source`. The printed local URL is the host. `compiled` selects every transitive public publishConfig export and requires the original library builds. No source alias or new package API.

Seven genuine public controller scenes and one expected overlapping-start refusal. Full derived capsule r150mm/half350mm/height1000mm; each unchanged query box is authored as six real CAD degree1 surfaces and sampled with the public CAD compiler/tessellator. A per-face ledger retains original model, face and source ranges before the display aggregate. This generic Viewer packet and picking are derived; not native face authority or exact CAD collision.

Accepted controller metres become display pose millimetres once; Viewer maps mm to scene metres separately. Complete unique bindings cover actor and stationary terrain. Play uses fixed1/120s accumulated actual wall time, twelve steps/RAF and .1s debt cap; 240 steps stops at2s. Late display failure retains earlier display frame but CPU is already advanced: pause, report separate cursors, explicitly Reset. No atomic CPU/GPU claim. Reset failure marks display uncertain only after actual presentation attempt. Real context loss pauses and disposes Viewer while lost; explicit Reset after restoration recreates it on the same caller canvas.

Modules separate immutable fixtures/frame, capsule geometry, native terrain ledger, host lifecycle, clock, view, UI, build resolver, actual driver and independent checks. `resource-probe.mjs` is TEST-only transparent WebGL observation; ordinary startup does not install it. Pixel controls keep packet order/colour and move the absent group out of frame through valid complete test poses, with independent frustum exclusion. They do not change physical state.

Run numeric-probe.mjs OUTPUT, then browser-driver.mjs OUTPUT NUMERIC_OUTPUT [cost]. Root alone runs campaigns. All source/fullcompiled graphs, first failures, clean measured head, original builds, numerical raw LE/repeats/reference, uploaded F32 geometry, pose/pixels/source ledger, actual play/copy/refusal/loss/disposal evidence must pass before native GO. Cost target full caller+Viewer main-thread p95<=8.33ms and simulated/wall>=.90; not GPU completion or FPS. Unrun current Integration/editor Save/Open/recovery remains separate under674. No product push/PR/deploy/pack/publish/release.

Original authored files are saved under authored-sources/SCENE/terrain-box-N.cad. authored-sources.json records exact UTF-8/SHA256; host and numeric consumers compare actual generated compiler input against these immutable original bytes before presentation. Collision still uses unchanged box data.
