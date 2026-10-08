# FLUID-05b: visible CAD floor

Issue: https://github.com/barocss/barocss/issues/877

The Physics-owned `fluid-viewer` host now serves one horizontal, display-only CAD Surface. Its source is `@model fluid_basin`, `@surface #floor`, `length-unit:mm`, degree 1×1, knots `[0,0,1,1]` in both axes, control points `[[[0,0,0],[0,0,500]],[[700,0,0],[700,0,500]]]`, and unit weights. Physics still owns the fixed basin collision. The camera uses eye `[1.25,1.1,1.45]` m and target `[0.35,0.42,0.25]` m, with up `[0,1,0]`, 45° vertical FOV, 0.01 m near and 10 m far.

## Actual browser check

Ran the source host at `http://127.0.0.1:52964/` in headless Chromium 155.0.0.0 on macOS with WebGL2. The host bundled the Physics source and used built CAD, GPU and Viewer packages. The browser had one visible canvas. The actual captures below show the upper release particles and all four floor corners inside the 640×480 canvas. The former vertical slab is absent. A closer trial with eye `[1.1,1,1.15]` clipped the near floor edge and was rejected; the issue records that correction.

| Scene | Step | Raw position SHA-256 | Boundary hits | Capture |
| --- | ---: | --- | ---: | --- |
| release v1 | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0 | [PNG](physics-877-release-step-0.png) |
| release v1 | 60 | `f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc` | 188 | [PNG](physics-877-release-step-60.png) |
| release v1 | 240 | `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b` | 362 | [PNG](physics-877-release-step-240.png) |
| release visual v2 | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0 | [PNG](physics-877-release-tuned-step-0.png) |
| release visual v2 | 60 | `dd2882d9419042bce8cf3dede4861de08d226b23a422790b35c17e8833ae39a5` | 303 | [PNG](physics-877-release-tuned-step-60.png) |
| release visual v2 | 240 | `772c8d5b613bff311ec1ab2a40d9965a52ab026fb413771a77dde120be0c9dac` | 322 | [PNG](physics-877-release-tuned-step-240.png) |
| high-drop visual v2 | 240 | `d8edda0487697b5464ce5033a269a6e713cb4605d86aa53bf8c30804851a9d8c` | 343 | [PNG](physics-877-splash-tuned-step-240.png) |

Every row had 256 particles, `displayStep` equal to the Physics step, and GL error 0. These SHA values match the frozen pre-change fixtures. Mean absolute density error for release v1 was 0.09709 / 0.22786 / 0.01529 at steps 0 / 60 / 240. For release visual v2 it was 0.09709 / 0.11997 / 0.01642. High-drop visual v2 at step 240 was 0.01715.

The same browser session passed Play → Pause (step 45), one fixed step (46), Reset (step 0 and original SHA), forced WebGL context loss (all controls disabled), and restoration (step 0 and original SHA). The browser console reported 0 errors and 0 warnings. This verifies the isolated visual sample, not the final merged-head FLUID-06 release gate.
