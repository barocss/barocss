# Actual upright capsule Viewer host (#1065)

Stage: native implementation and own actual 3D qualification complete. Exact sole Integration adoption pending. See RESULTS.md and evidence/canonical; native GO does not imply current integrated/editor acceptance or publication.

Run Node22 `node examples/physics-character-viewer/setup.mjs`, then `node examples/physics-character-viewer/server.mjs source`. The printed local URL is the host. `compiled` selects every transitive public publishConfig export and requires the original library builds. No source alias or new package API.

Seven genuine public controller scenes and one expected overlapping-start refusal. Full derived capsule r150mm/half350mm/height1000mm; each unchanged query box is authored as six real CAD degree1 surfaces and sampled with the public CAD compiler/tessellator. A per-face ledger retains original model, face and source ranges before the display aggregate. This generic Viewer packet and picking are derived; not native face authority or exact CAD collision.

Accepted controller metres become display pose millimetres once; Viewer maps mm to scene metres separately. Complete unique bindings cover actor and stationary terrain. Play uses fixed1/120s accumulated actual wall time, twelve steps/RAF and .1s debt cap; 240 steps stops at2s. Late display failure retains earlier display frame but CPU is already advanced: pause, report separate cursors, explicitly Reset. No atomic CPU/GPU claim. Reset failure marks display uncertain only after actual presentation attempt. The Viewer draws with WebGPU: `createViewer` is awaited once on first Reset and later Resets reuse it.

Modules separate immutable fixtures/frame, capsule geometry, native terrain ledger, host lifecycle, clock, view, UI, build resolver, actual driver and independent checks. Pixel controls keep packet order/colour and move the absent group out of frame through valid complete test poses, with independent frustum exclusion. They do not change physical state.

Run numeric-probe.mjs OUTPUT, then browser-driver.mjs OUTPUT NUMERIC_OUTPUT [cost]. Root alone runs campaigns. The driver checks source/fullcompiled graphs, numerical raw LE/repeats/reference, pose/frustum/source ledger, awaited `viewer.readPixels()` WebGPU captures (top-down RGBA) with actor/terrain witnesses and source/compiled pixel parity, actual play/copy/refusal/cap/disposal. Cost target full caller+Viewer main-thread p95<=8.33ms and simulated/wall>=.90; not GPU completion or FPS. Unrun current Integration/editor Save/Open/recovery remains separate under674. No product push/PR/deploy/pack/publish/release.

The committed `evidence/` folders and `saved-replay.py`/`raw-upload-replay.py` record the earlier WebGL2 renderer (bottom-up readback, WebGL2 buffer uploads, resource counts, context loss, allocation-failure injection). Those WebGL2-only probes were removed with that renderer; the replay scripts still verify only the saved evidence, not a new run.

Original authored files are saved under authored-sources/SCENE/terrain-box-N.cad. authored-sources.json records exact UTF-8/SHA256; host and numeric consumers compare actual generated compiler input against these immutable original bytes before presentation. Collision still uses unchanged box data.
