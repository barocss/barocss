# FLUID-02 #814 browser and consumer evidence

## Scope

- Local Integration parent: `e722b9c470ca5d187ebc201a2ebf4ac21b50bf75` includes Physics #813, GPU #850 and Viewer #851. Physics-owned interactive host is `examples/physics-scene/fluid-viewer/` in this native branch.
- Browser: HeadlessChrome/155.0.0.0 on macOS, Playwright CLI, one Chromium WebGL2 canvas/context, 640×480 drawing buffer. `gl.getError()=0`. Actual CAD source0 Surface and actual 256-particle Physics state share the Viewer camera and depth buffer.
- The preexisting `examples/viewer-fluid-scene` compiled-package flow was instrumented in the browser only: one pause after each accepted receipt and synchronous call timers around WebGL2 `bufferData`/`drawArrays`. Its source files were not edited. Screen capture, CAD loading and bundling are excluded from timings. The screenshot status still says that the automatic flow is running because the browser paused it just after each accepted frame.

## Captured frames

| Physics step | Raw metre Float64 SHA-256 | Float32 scene-unit upload hash | `readPixels` hash | Mean density error | p95 compression | Boundary hits | Screenshot |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 937234877 | 1160202075 | 0.09709062457183505 | 0.17260555479437723 | 0 | [step 0](physics-814-step-0.png) |
| 60 | `f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc` | 1499462381 | 4088262327 | 0.22785881124725596 | 0.008943763280411687 | 188 | [step 60](physics-814-step-60.png) |
| 240 | `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b` | 1856538442 | 592491607 | 0.015288410357167534 | 0.008918274260563797 | 362 | [step 240](physics-814-step-240.png) |

All three accepted frames submitted 256 `POINTS`. The actual Surface occluded cyan pixels: 3195 with the Surface in place, 3686 after moving only its display pose away, then 3195 after restoration. Submitted particles are not the count of individually visible particles. The automatic flow made 16 particle draws and 16 matching uploads. Wrong count, NaN, wrong context/revision, same-step changed positions and stale step were refused; previous Viewer pixels, CAD camera and Physics state were retained. A finite but physically wrong metre/mm value cannot be inferred by Viewer; the host owns the unit conversion `metres × 1000 × mmToSceneUnit` and source provenance.

## Host controls and lifecycle

The Physics-owned host bundles `src/fluid.ts` directly and presents copied states through public `viewer.setFluidFrame`. The Playwright UI flow observed step 0 → one step 1; 250 ms paused kept step 1 and the same SHA; play reached step 120; another 250 ms pause kept step 120 and its SHA; reset returned to step 0 and the original SHA. Viewer display step always matched Physics. It used one canvas/context and `gl.getError()=0`. [Reset screen](physics-814-interactive-reset.png).

Canvas screenshots were byte-identical across 250 ms at paused step 0 and paused step 1. Step 1 changed the screenshot; reset reproduced the original step-0 screenshot byte for byte.

`WEBGL_lose_context` was available. On forced loss, controls disabled and the host reported `contextLost:true`. On restoration, the page recreated the scene at step 0 with original SHA, enabled controls and `gl.getError()=0`. Page exit disposes the host world and Viewer. The compiled Viewer flow separately checked resize, layer clear, native scene replacement and disposal.

## Cost on the declared host

- Browser solver: 239 calls for steps 2–240; `performance.now()` around synchronous `world.step(1/120)`; p95 **14.7 ms**, max 16.0 ms. One-step UI call and initialization are excluded.
- Browser upload: 16 measured 768-float `ARRAY_BUFFER` `bufferData` calls; p95 **0.1 ms**. Browser `performance.now()` resolution limits this small value.
- Browser draw submission: 16 measured `POINTS` `drawArrays` calls; p95 **0.1 ms**. This is JavaScript call time, not completed GPU execution or frame time.
- Node 22.22.0 compiled `fluid-world-probe.mjs`: 240 steps, p95 **25.268 ms**, final SHA matched. Different runtime; do not compare it as a GPU speedup.

`source-import-probe.mjs` passed four source and four ordinary dist entries, including `/fluid`. Compiled `fluid-world-probe.mjs`, rigid `probe.mjs`, `replay-probe.mjs`, and `cad-proxy-probe.mjs` passed. The browser result is a bounded visual particle demonstration. It does not certify pressure, CFD, CAD collision, fluid–rigid coupling, surface reconstruction, GPU completion time, or release readiness.
