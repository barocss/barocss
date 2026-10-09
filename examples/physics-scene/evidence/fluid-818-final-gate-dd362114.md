# FLUID-06 bounded local visual-water candidate

Issue: https://github.com/barocss/barocss/issues/818

## Decision

**Accepted only for the pinned local merged commit** `dd362114c8a7dbd74d09bed790dfefb2fc0ffc45`. The frozen 256-particle visual-water profile passed the numeric, resource, independent-consumer and actual browser gates below. This is a local candidate decision. The native-only runner deliberately reports `localReleaseCandidate:false`; the separate browser evidence in this report supports the final local decision. No npm publication, remote PR, engineering accuracy or CFD certification is claimed.

## Frozen profile and environment

- 256 particles, caller-owned 1/120 s fixed step, right-handed XYZ metres, static 0.7 × 1.3 × 0.5 m basin and gravity [0,-9.81,0] m/s².
- Opt-in visual v2 covers release and high-drop without a CAD shelf. One sourceVersion 0 static CAD Surface supplies a labelled box shelf for v1 only.
- macOS 15.6.1, Apple M3 Max, Node v22.22.0, pnpm 10.11.0, headless Chromium 155/WebGL2.

## Gate results

| Frozen gate | Result | Evidence |
| --- | --- | --- |
| Clean offline install, five builds, five source/compiled exports | Pass | [Native JSON](fluid-818-native-dd362114.json) |
| Compiled v1/v2 release and high-drop SHA, CAD shelf, copied/invalid/stale retention | Pass | [Native JSON](fluid-818-native-dd362114.json) |
| Three 240-step GC retained-heap deltas ≤1 MiB | Pass | 164,832 / 164,864 / 164,832 bytes |
| Independent Viewer-owned browser importing built Physics/Viewer | Pass | [Viewer JSON](fluid-818-viewer-dd362114.json) |
| Paired 0/60/240 browser captures, controls and context recovery | Pass | 18 screenshots below; GL error 0 |
| Three warm Play/Pause trials each for bare and shelf: ratio ≥0.90, solver p95 ≤8.33 ms | Pass | Ratios and timings below |

The native runner passed all 12 checks. Its three Node median step times were 1.491 / 1.485 / 1.466 ms, with p95 1.833 / 1.735 / 1.786 ms. These resource-probe times are separate from the browser speed gate.

The independent Viewer proof recorded one canvas and one WebGL2 context, 256 POINTS per submission, 16 point draws and 16 uploads, matching raw metre SHA at steps 0/60/240, and one metre-to-scene conversion. Moving the original CAD display Surface changed cyan pixels from 3195 to 3686, demonstrating shared depth; GL error and browser errors were 0.

## Browser playback

One warm-up preceded three reset 3000 ms Play/Pause trials per mode. Each measured run advanced 361 fixed steps (3.0083 simulated seconds), with 331 warm solver samples after the first 30. Wall time includes browser control calls. Viewer submission p95 is synchronous CPU time, not GPU completion.

| Mode / run | Simulated / wall | Solver p95 ms | Viewer submission p95 ms |
| --- | ---: | ---: | ---: |
| bare / 1 | 0.9810 | 1.40 | 3.80 |
| bare / 2 | 0.9808 | 1.50 | 4.10 |
| bare / 3 | 0.9814 | 1.40 | 3.80 |
| shelf / 1 | 0.9808 | 1.50 | 3.90 |
| shelf / 2 | 0.9810 | 1.40 | 3.70 |
| shelf / 3 | 0.9812 | 1.50 | 3.80 |

The CAD host also refused a changed source revision at step 240 without changing the accepted state or pixel hash 3222176261. Reset restored the original step-0 SHA. Forced WebGL context loss disabled controls; restoration returned a valid step-0 scene. Play/Pause and one fixed step kept Physics and Viewer step indices equal. Console errors and warnings were 0 in all three browser hosts.

## Paired actual screenshots

All captures came from the pinned merged checkout. Each row had 256 particles, matching Viewer/Physics step and GL error 0. The high-drop step-0 frames show the full upper block and four horizontal floor corners after #909; ordinary release framing remains intact.

| Scene | Step | Raw position SHA-256 | Mean density error | Capture |
| --- | ---: | --- | ---: | --- |
| bare | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0.09709 | [PNG](physics-818-final-bare-0.png) |
| bare | 60 | `f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc` | 0.22786 | [PNG](physics-818-final-bare-60.png) |
| bare | 240 | `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b` | 0.01529 | [PNG](physics-818-final-bare-240.png) |
| shelf | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0.09709 | [PNG](physics-818-final-shelf-0.png) |
| shelf | 60 | `2cfda35a877aaf8bd21cfa83eaadc3179c0b70e896b44fd5f3698c47ad6c5086` | 0.22677 | [PNG](physics-818-final-shelf-60.png) |
| shelf | 240 | `3d261943d75f9b94363c4c6085900a2e6e8a096b36c13a7310f7811d115bdb8d` | 0.03309 | [PNG](physics-818-final-shelf-240.png) |
| release | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0.09709 | [PNG](physics-818-final-release-0.png) |
| release | 60 | `f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc` | 0.22786 | [PNG](physics-818-final-release-60.png) |
| release | 240 | `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b` | 0.01529 | [PNG](physics-818-final-release-240.png) |
| release-tuned | 0 | `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b` | 0.09709 | [PNG](physics-818-final-release-tuned-0.png) |
| release-tuned | 60 | `dd2882d9419042bce8cf3dede4861de08d226b23a422790b35c17e8833ae39a5` | 0.11997 | [PNG](physics-818-final-release-tuned-60.png) |
| release-tuned | 240 | `772c8d5b613bff311ec1ab2a40d9965a52ab026fb413771a77dde120be0c9dac` | 0.01642 | [PNG](physics-818-final-release-tuned-240.png) |
| splash | 0 | `00bf5a47249e94db4abebdebb6dac0e5ab745b357f1a92bdc3ba22db69eba04a` | 0.09709 | [PNG](physics-818-final-splash-0.png) |
| splash | 60 | `33aa6e732073ffecfd7a51f1a16a59b40766619291ab9e64e839dcd51be86341` | 0.20544 | [PNG](physics-818-final-splash-60.png) |
| splash | 240 | `a3f1f0b785bf871bfcbef1da600a937c8e9251e2617837dbd5807f5850a572cc` | 0.02233 | [PNG](physics-818-final-splash-240.png) |
| splash-tuned | 0 | `00bf5a47249e94db4abebdebb6dac0e5ab745b357f1a92bdc3ba22db69eba04a` | 0.09709 | [PNG](physics-818-final-splash-tuned-0.png) |
| splash-tuned | 60 | `b053a4c578e876225ba621eaedd30def2f4461b5012728eca8e13cf5d59eb29e` | 0.14396 | [PNG](physics-818-final-splash-tuned-60.png) |
| splash-tuned | 240 | `d8edda0487697b5464ce5033a269a6e713cb4605d86aa53bf8c30804851a9d8c` | 0.01715 | [PNG](physics-818-final-splash-tuned-240.png) |

## Limits

- The accepted count is exactly 256 in this frozen basin. The 1,024 and 4,096 particle discovery runs are measurements, not support promises.
- The shelf is a static control-net box proxy. It is not exact NURBS collision. This gate does not cover moving rigid bodies, v2 plus CAD, emitters or pressure/load calculations.
- Playback ratios and timings apply to the measured Apple M3 Max / Chromium 155 host. Viewer submission does not measure GPU completion.
- Water is rendered as particles. There is no validated CFD, photorealistic surface or engineering certificate. Package publication and release are separate decisions.

## Reproduction boundary

Run `node examples/physics-scene/fluid-release-gate.mjs <report-path>` with Node 22 on a clean checkout of the pinned commit; it performs the frozen offline install, five builds and numeric/resource probes. Start `examples/viewer-fluid-scene/server.mjs`, `examples/physics-scene/fluid-cad-viewer/server.mjs` and `examples/physics-scene/fluid-viewer/server.mjs` from that built checkout, then drive their actual Chromium pages. The committed JSON and screenshots record this run. An evidence-only child commit can carry these artifacts without changing the pinned tested product commit.
