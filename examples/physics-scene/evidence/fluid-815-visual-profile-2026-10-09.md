# FLUID-03 #815 opt-in visual profile evidence

## Contract and fixture

The [frozen #815 contract](https://github.com/barocss/barocss/issues/815#issuecomment-6065168955) adds only `FluidSceneV2` with the exact opt-in `visualViscosity:{kind:'xsph',coefficient:0.15}`. Version 1 is unchanged. The visual blend uses fluid neighbours after density projection; it has no material calibration. Both fixtures contain 256 particles in the 0.7 × 1.3 × 0.5 m basin at 1/120 s. Release starts at Y `0.45+y×0.05`; high drop starts at Y `0.85+y×0.05`. X/Z and ordering match #813. The high drop is a stronger impact fixture, not a new emitter.

## Compiled numeric comparison

Node 22.22.0, macOS, compiled `dist/fluid.js`, `examples/physics-scene/fluid-visual-profile-probe.mjs`. The probe alternated v1/v2 step call order in the same process and captured the 720-step p95 cost. These local wall times are comparative evidence on this host, not general performance guarantees.

| Fixture | Step | v1 p95 speed (m/s) | v2 p95 speed (m/s) | v1 mean density error | v2 mean density error | v2 raw Float64 position SHA-256 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Release | 60 | 2.27166642 | 1.42039490 | 0.22785881 | 0.11996663 | `dd2882d9419042bce8cf3dede4861de08d226b23a422790b35c17e8833ae39a5` |
| Release | 240 | 0.21262637 | 0.03257995 | 0.01528841 | 0.01641522 | `772c8d5b613bff311ec1ab2a40d9965a52ab026fb413771a77dde120be0c9dac` |
| Release | 720 | 0.02503916 | 0.00922754 | 0.01265080 | 0.01485509 | `adc36dc1df9ba1c1c64c4135b97011487daa12c196b567da324addb924d96509` |
| High drop | 60 | 4.06980056 | 4.10036757 | 0.20543831 | 0.14395780 | `b053a4c578e876225ba621eaedd30def2f4461b5012728eca8e13cf5d59eb29e` |
| High drop | 240 | 0.27789932 | 0.05371435 | 0.02233469 | 0.01714821 | `d8edda0487697b5464ce5033a269a6e713cb4605d86aa53bf8c30804851a9d8c` |
| High drop | 720 | 0.03663787 | 0.00625818 | 0.01066356 | 0.01410296 | `d55b9bef8d14ca7fe0b280cb063c606ad3ea504403627fd5a9b4eefcf765cc58` |

Final repeated release p95 step cost: v1 **31.17513 ms**, v2 **34.08188 ms**, ratio **1.093**. High-drop cost: v1 **31.82988 ms**, v2 **34.99908 ms**, ratio **1.100**. Both are below the frozen 1.5× limit. The high-drop step-60 speed remained above 3.25 m/s, both step-240 density errors stayed below their limits, and both step-720 speeds met the settling limits. Repeat v2 runs had equal step-720 SHA. V1 step-60/240/720 SHA and the existing v1 probe remained unchanged. Missing/wrong v2 profile and an out-of-basin initial point returned `INVALID_CONFIG`; an invalid step retained the accepted state.

## Actual Viewer/WebGL2 frames

The Physics-owned host bundles `src/fluid.ts` and lets the user choose release/high drop and v1/v2. HeadlessChrome/155.0.0.0 on macOS displayed the same v2 step-0/60/240 raw SHA, diagnostics and scene revision as the compiled numeric probe. Each frame submitted 256 `POINTS` on one canvas with `gl.getError()=0`; displayed and Physics steps matched. [Release v2 0](physics-815-release-tuned-step-0.png), [60](physics-815-release-tuned-step-60.png), [240](physics-815-release-tuned-step-240.png); [high-drop v2 0](physics-815-splash-tuned-step-0.png), [60](physics-815-splash-tuned-step-60.png), [240](physics-815-splash-tuned-step-240.png). The v1 high-drop [0](physics-815-splash-step-0.png), [60](physics-815-splash-step-60.png), [240](physics-815-splash-step-240.png) frames are saved for comparison; the v1 release frames are in [#814 evidence](fluid-814-browser-2026-10-09.md).

The actual **compiled** Physics/Viewer flow was also run with the high-drop v2 scene. Its raw SHA matched steps 0/60/240, 16 uploads matched 16 point draws, one context/canvas returned GL error 0, and moving the native CAD Surface display pose changed visible cyan pixels **4346 → 5429** before restoration. This proves shared depth for this selected scene, not individual particle visibility or CAD collision. That run changed only the browser-served fixture/version/expected hashes, not Viewer source.

With high-drop v2 selected, a forced `WEBGL_lose_context` event disabled the scene selector and all buttons. Restoration reloaded the page into the declared default v1 release scene at step 0; its original SHA returned and GL error was 0. The selection is reset on context recreation.

For a visible settling check, the same camera/canvas was captured at steps 240 and 300 for all four modes. Decoding the saved PNGs to RGB24 and counting pixels with any changed channel gave: release v1 **2387** versus v2 **1304**; high drop v1 **3003** versus v2 **1181**. The underlying [release v1](physics-815-motion-release-240.png)/[300](physics-815-motion-release-300.png), [release v2](physics-815-motion-release-tuned-240.png)/[300](physics-815-motion-release-tuned-300.png), [high-drop v1](physics-815-motion-splash-240.png)/[300](physics-815-motion-splash-300.png) and [high-drop v2](physics-815-motion-splash-tuned-240.png)/[300](physics-815-motion-splash-tuned-300.png) canvas images are saved. This measures screen change, not an objective realism score. The point layout remains visibly discrete and can look structured; the profile should be described as reduced late motion, not a realistic water surface.

No pressure accuracy, surface reconstruction, exact CAD collision, fluid–rigid coupling, arbitrary viscosity values, GPU solver, browser performance guarantee or release claim follows from this result.
