# FLUID-05a playback evidence — 2026-10-09

## Profile and method

Issue [#871](https://github.com/barocss/barocss/issues/871) freezes 256 v1 particles, a 0.7 × 1.3 × 0.5 m basin and a 1/120 s host step. The two browser scenes are the unchanged release fixture with no obstacle and the [#816](https://github.com/barocss/barocss/issues/816) static CAD shelf. The candidate replaces string-keyed neighbor cells with reusable numeric arrays and ordered index chains. It keeps the same 27-cell visit order and particle-index order. It changes no public fluid input or output.

Measured on macOS 15.6.1 arm64, Apple M3 Max, Node 22.22.0, pnpm 10.11.0, HeadlessChrome 155, WebGL2, 640 × 480 canvas, device pixel ratio 1. Play/Pause is triggered by the example's real DOM buttons from inside the page. A 3000 ms page timer requests Pause; the ratio uses the actual wall interval until Pause runs, including delayed event handling. Each scene was reset before each run. `world.step()` and synchronous `viewer.setFluidFrame()` were timed separately with `performance.now()`; their p95 values exclude the first 30 samples. Viewer submission does not include GPU completion. Browser scheduling and this machine affect every time value.

The exact unmodified #816 parent had one same-method in-page trial: bare 144 steps / 3.248 s wall = 0.369 simulated/wall; shelf 150 steps / 3.264 s = 0.383. Both fail the frozen 0.90 gate. A Node 22 CPU profile of its compiled shelf probe had 5,693 of 9,214 sampled ticks in `NeighborGrid.each` (~61.8%); samples are not exact wall-time attribution.

| Candidate scene | Run | Accepted steps | Wall seconds | Simulated/wall | Warm solver p95 ms | Viewer submission p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bare v1 | 1 | 365 | 3.076 | 0.989 | 6.0 | 15.7 |
| Bare v1 | 2 | 365 | 3.083 | 0.987 | 6.2 | 16.0 |
| Bare v1 | 3 | 363 | 3.061 | 0.988 | 5.8 | 15.4 |
| CAD shelf v1 | 1 | 363 | 3.065 | 0.987 | 5.9 | 14.7 |
| CAD shelf v1 | 2 | 363 | 3.082 | 0.982 | 6.0 | 16.2 |
| CAD shelf v1 | 3 | 365 | 3.098 | 0.982 | 6.1 | 15.8 |

All six candidate browser trials exceeded the 0.90 playback ratio gate and stayed under the 8.33 ms solver p95 gate. Each reported WebGL error 0. The six runs are local evidence, not a guarantee on other devices or browsers. On the compiled Node v1 probe, the candidate measured median 6.179 ms and p95 13.004 ms in one run, down from the parent p95 35.768 ms. A second candidate run with explicit GC measured p95 14.127 ms and retained heap change +164,608 bytes over its probe. The heap delta is retained memory after GC, not total allocation.

## Numeric and independent consumer checks

The compiled `fluid-world-probe.mjs`, `fluid-cad-shelf-probe.mjs`, `fluid-visual-profile-probe.mjs` and `source-import-probe.mjs` passed on the candidate. V1 bare position SHA-256 at steps 0/60/240 remained `9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b`, `f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc`, `6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b`. CAD shelf steps 60/240 remained `2cfda35a877aaf8bd21cfa83eaadc3179c0b70e896b44fd5f3698c47ad6c5086` and `3d261943d75f9b94363c4c6085900a2e6e8a096b36c13a7310f7811d115bdb8d`. The v2 release/high-drop probe kept its step 60/240/720 hashes and invalid-input behavior. The CAD probe kept its static-box source-retention, copy, invalid-input and no-interior-centre checks through 240 steps. `source-import-probe` found five source and five compiled entries.

The independent Viewer-owned `examples/viewer-fluid-scene` consumer imported **built** Physics, Viewer and CAD interop packages in actual Chromium. It passed the v1 step 0/60/240 raw metre hashes, 256 POINTS, 16 particle uploads/draws, one canvas and one WebGL2 context, unchanged source, copied/invalid frame retention, and shared depth (3195 occluded versus 3686 exposed cyan pixels). WebGL error was 0 and browser errors were empty.

The Physics-owned interactive host bundled optimized Physics source with built Viewer/CAD packages. Captured shelf steps 0, 60 and 240 matched the compiled shelf hashes and showed the original CAD Surface in the same canvas:

- [Step 0](physics-871-shelf-step-0.png)
- [Step 60](physics-871-shelf-step-60.png)
- [Step 240](physics-871-shelf-step-240.png)

## Limit

The measured speed applies to the declared 256-particle scenes on this browser and machine. It does not establish 1,024/4,096-particle support, exact CAD collision, GPU completion time, a photorealistic surface, CFD accuracy, package publication or release-candidate acceptance. #816 and #871 still need serial Integration and merged-head verification before #818 can run its final gate.
