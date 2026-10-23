# G11: the heaviest scenes measured on both renderers (G-R42, 2026-10-23)

Read-only. An orbit of 60 steps (16 ms apart) per display mode, 1440 × 900, DPR 1, Apple M-series, headless Chrome. The tally is O10's frameCosts plus the bench's instruments (frame CPU in rAF, the main thread's task time, WebGPU timestamps per submit). The harness is a scratch copy of test/bench-browser.mjs; scene documents were generated from the model's own commands and the A9 acceptance test.

Load: 17.3 / 13.3 / 10.5 during the WebGPU run, 12.9 / 15.1 / 12.2 during WebGL2. Other lanes were running.

Budget: 60 Hz, so a frame's main-thread task and its GPU time each under 16.7 ms, and the frame interval's p95 at about 16.7 ms. WebGL2 has no GPU timer here (the bench's timestamps are WebGPU's); its frame interval stands in.

| scene | renderer | mode | open s | bodies | draws | triangles | lines | task ms/frame | GPU ms/submit | interval p50/p95/max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| A9 assembly | webgpu | shaded-with-edges | 16.4 | 38 | 90 | 42474 | 44553 | 3.47 | 1.66 | 16.7/16.8/33.3 |
| A9 assembly | webgpu | hidden-lines-dashed | 16.4 | 38 | 132 | 42472 | 83986 | 3.35 | 2.93 | 16.7/16.8/16.8 |
| A9 assembly | webgpu | x-ray | 16.4 | 38 | 90 | 42474 | 44553 | 3.3 | 3.81 | 16.7/16.8/16.8 |
| 120-bracket pattern | webgpu | shaded-with-edges | 0.3 | 120 | 361 | 33122 | 32160 | 3.23 | 1.97 | 16.7/16.7/16.8 |
| 120-bracket pattern | webgpu | hidden-lines-dashed | 0.3 | 120 | 600 | 33120 | 64320 | 3.01 | 2.63 | 16.7/16.7/16.8 |
| 120-bracket pattern | webgpu | x-ray | 0.3 | 120 | 361 | 33122 | 32160 | 3.1 | 3.38 | 16.7/16.8/16.8 |
| 5 box frames (60 members) | webgpu | shaded-with-edges | 24.8 | 60 | 181 | 24246 | 30244 | 3.81 | 3.9 | 16.7/16.8/50.1 |
| 5 box frames (60 members) | webgpu | hidden-lines-dashed | 24.8 | 60 | 300 | 24244 | 60488 | 3.73 | 2.98 | 16.7/16.8/50 |
| 5 box frames (60 members) | webgpu | x-ray | 24.8 | 60 | 181 | 24246 | 30244 | 3.88 | 4.71 | 16.7/16.7/33.3 |
| 6R arm | webgpu | shaded-with-edges | 0.3 | 7 | 22 | 3338 | 3284 | 2.78 | 0.92 | 16.7/16.7/16.8 |
| 6R arm | webgpu | hidden-lines-dashed | 0.3 | 7 | 35 | 3336 | 6568 | 2.81 | 0.84 | 16.7/16.7/16.8 |
| 6R arm | webgpu | x-ray | 0.3 | 7 | 22 | 3338 | 3284 | 2.78 | 2.11 | 16.7/16.7/16.8 |
| welded table | webgpu | shaded-with-edges | 0.1 | 8 | 17 | 290 | 208 | 2.87 | 1.23 | 16.7/16.8/16.8 |
| welded table | webgpu | hidden-lines-dashed | 0.1 | 8 | 24 | 288 | 416 | 2.75 | 0.69 | 16.7/16.7/16.8 |
| welded table | webgpu | x-ray | 0.1 | 8 | 17 | 290 | 208 | 2.97 | 2.2 | 16.7/16.7/16.8 |
| spring | webgpu | shaded-with-edges | 10.6 | 1 | 4 | 114282 | 114218 | 3.32 | 3.26 | 16.7/16.7/33.3 |
| spring | webgpu | hidden-lines-dashed | 10.6 | 1 | 5 | 114280 | 228436 | 2.92 | 2.79 | 16.7/16.7/16.8 |
| spring | webgpu | x-ray | 10.6 | 1 | 4 | 114282 | 114218 | 2.49 | 3.62 | 16.7/16.8/16.8 |
| worm pair | webgpu | shaded-with-edges | 6.8 | 2 | 7 | 17138 | 18806 | 2.61 | 2.66 | 16.7/16.8/16.8 |
| worm pair | webgpu | hidden-lines-dashed | 6.8 | 2 | 10 | 17136 | 37612 | 2.63 | 0.98 | 16.7/16.8/16.8 |
| worm pair | webgpu | x-ray | 6.8 | 2 | 7 | 17138 | 18806 | 2.59 | 2.91 | 16.7/16.8/16.8 |
| spur gear | webgpu | shaded-with-edges | 1.0 | 1 | 4 | 2210 | 2248 | 2.48 | 1.41 | 16.7/16.8/16.8 |
| spur gear | webgpu | hidden-lines-dashed | 1.0 | 1 | 5 | 2208 | 4496 | 2.59 | 0.7 | 16.7/16.7/16.8 |
| spur gear | webgpu | x-ray | 1.0 | 1 | 4 | 2210 | 2248 | 2.47 | 2.66 | 16.7/16.7/16.8 |
| clearance-states fixture | webgpu | shaded-with-edges | 0.9 | 10 | 23 | 11460 | 11378 | 2.52 | 0.84 | 16.7/16.8/16.8 |
| clearance-states fixture | webgpu | hidden-lines-dashed | 0.9 | 10 | 34 | 11458 | 22756 | 2.4 | 1.45 | 16.7/16.8/16.8 |
| clearance-states fixture | webgpu | x-ray | 0.9 | 10 | 23 | 11460 | 11378 | 2.35 | 2.17 | 16.7/16.8/16.8 |
| lid fixture | webgpu | shaded-with-edges (mode locked) | 0.0 | 10 | 47 | 34524 | 14494 | 2.45 | 5.02 | 16.7/16.8/16.8 |
| starter plate template | webgpu | shaded-with-edges | 0.1 | 1 | 3 | 14 | 12 | 2.22 | 1.37 | 16.7/16.8/16.8 |
| starter plate template | webgpu | hidden-lines-dashed | 0.1 | 1 | 3 | 12 | 24 | 2.39 | 0.48 | 16.7/16.8/33.2 |
| starter plate template | webgpu | x-ray | 0.1 | 1 | 3 | 14 | 12 | 2.41 | 2.53 | 16.7/16.8/16.8 |
| A9 assembly | webgl2 | shaded-with-edges | 15.7 | 38 | 94 | 42476 | 7578 | 3.51 | — | 16.7/16.7/33.4 |
| A9 assembly | webgl2 | hidden-lines-dashed | 15.7 | 38 | 137 | 42474 | 9832 | 3.26 | — | 16.7/16.8/33.4 |
| A9 assembly | webgl2 | x-ray | 15.7 | 38 | 94 | 42476 | 7578 | 3.35 | — | 16.7/16.7/16.8 |
| 120-bracket pattern | webgl2 | shaded-with-edges | 0.2 | 120 | 359 | 33124 | 17910 | 3.03 | — | 16.7/16.7/16.8 |
| 120-bracket pattern | webgl2 | hidden-lines-dashed | 0.2 | 120 | 593 | 33122 | 35616 | 2.98 | — | 16.7/16.8/16.8 |
| 120-bracket pattern | webgl2 | x-ray | 0.2 | 120 | 359 | 33124 | 17910 | 3.05 | — | 16.7/16.8/16.8 |
| 5 box frames (60 members) | webgl2 | shaded-with-edges | 27.5 | 60 | 184 | 24248 | 10990 | 3.68 | — | 16.7/16.8/50 |
| 5 box frames (60 members) | webgl2 | hidden-lines-dashed | 27.5 | 60 | 303 | 24246 | 21776 | 4.04 | — | 16.7/16.8/50 |
| 5 box frames (60 members) | webgl2 | x-ray | 27.5 | 60 | 184 | 24248 | 10990 | 3.76 | — | 16.7/16.8/50.1 |
| 6R arm | webgl2 | shaded-with-edges | 0.3 | 7 | 25 | 3340 | 1988 | 2.75 | — | 16.7/16.8/16.8 |
| 6R arm | webgl2 | hidden-lines-dashed | 0.3 | 7 | 38 | 3338 | 3772 | 2.86 | — | 16.7/16.7/16.8 |
| 6R arm | webgl2 | x-ray | 0.3 | 7 | 25 | 3340 | 1988 | 2.61 | — | 16.7/16.8/16.8 |
| welded table | webgl2 | shaded-with-edges | 0.1 | 8 | 20 | 292 | 412 | 2.53 | — | 16.7/16.8/16.8 |
| welded table | webgl2 | hidden-lines-dashed | 0.1 | 8 | 27 | 290 | 620 | 2.76 | — | 16.7/16.8/16.8 |
| welded table | webgl2 | x-ray | 0.1 | 8 | 20 | 292 | 412 | 2.59 | — | 16.7/16.8/33.4 |
| spring | webgl2 | shaded-with-edges | 10.3 | 1 | 7 | 114284 | 5737 | 2.47 | — | 16.7/16.7/16.8 |
| spring | webgl2 | hidden-lines-dashed | 10.3 | 1 | 8 | 114282 | 11270 | 2.36 | — | 16.7/16.8/16.8 |
| spring | webgl2 | x-ray | 10.3 | 1 | 7 | 114284 | 5737 | 2.14 | — | 16.7/16.8/16.8 |
| worm pair | webgl2 | shaded-with-edges | 6.3 | 2 | 10 | 17140 | 4267 | 2.24 | — | 16.7/16.7/16.8 |
| worm pair | webgl2 | hidden-lines-dashed | 6.3 | 2 | 13 | 17138 | 8330 | 2.28 | — | 16.7/16.7/16.8 |
| worm pair | webgl2 | x-ray | 6.3 | 2 | 10 | 17140 | 4267 | 2.18 | — | 16.7/16.7/16.8 |
| spur gear | webgl2 | shaded-with-edges | 0.9 | 1 | 7 | 2212 | 1390 | 2.24 | — | 16.7/16.8/16.8 |
| spur gear | webgl2 | hidden-lines-dashed | 0.9 | 1 | 8 | 2210 | 2576 | 2.41 | — | 16.7/16.7/16.8 |
| spur gear | webgl2 | x-ray | 0.9 | 1 | 7 | 2212 | 1390 | 2.6 | — | 16.7/16.7/16.8 |
| clearance-states fixture | webgl2 | shaded-with-edges | 1.0 | 10 | 26 | 11462 | 1424 | 2.38 | — | 16.7/16.8/16.8 |
| clearance-states fixture | webgl2 | hidden-lines-dashed | 1.0 | 10 | 37 | 11460 | 2644 | 2.44 | — | 16.7/16.8/16.8 |
| clearance-states fixture | webgl2 | x-ray | 1.0 | 10 | 26 | 11462 | 1424 | 2.41 | — | 16.7/16.8/16.8 |
| lid fixture | webgl2 | shaded-with-edges (mode locked) | 0.0 | 10 | 44 | 22994 | 4541 | 2.54 | — | 16.7/16.7/16.8 |
| starter plate template | webgl2 | shaded-with-edges | 0.1 | 1 | 6 | 16 | 216 | 2.51 | — | 16.7/16.7/16.8 |
| starter plate template | webgl2 | hidden-lines-dashed | 0.1 | 1 | 6 | 14 | 228 | 2.35 | — | 16.7/16.7/16.8 |
| starter plate template | webgl2 | x-ray | 0.1 | 1 | 6 | 16 | 216 | 2.38 | — | 16.7/16.7/16.8 |

WebGL2's task: the bench divides by the frames it saw submitted, and WebGL2 submits none, so the row is divided by the 60 orbit steps here.

## Top bodies by share (WebGPU, shaded with edges)

- A9 assembly: p2/b2 38.4 % (16774 tri, 16646 lines, 2 draws), p3/b3 26.2 % (11392 tri, 11392 lines, 2 draws), p2/b0 25.7 % (11230 tri, 11150 lines, 3 draws)
- 120-bracket pattern: t0/b3 0.8 % (276 tri, 268 lines, 3 draws), t1/b3 0.8 % (276 tri, 268 lines, 3 draws), t2/b3 0.8 % (276 tri, 268 lines, 3 draws)
- 5 box frames (60 members): b4_part6 2.4 % (586 tri, 744 lines, 3 draws), b3_part6 2.4 % (576 tri, 734 lines, 3 draws), b1_part5 2.4 % (570 tri, 728 lines, 3 draws)
- 6R arm: l1/b5 15.9 % (532 tri, 524 lines, 3 draws), l2/b5 15.9 % (532 tri, 524 lines, 3 draws), l3/b5 15.9 % (532 tri, 524 lines, 3 draws)
- welded table: b0_part7 16.1 % (48 tri, 32 lines, 2 draws), b0_part5 13.7 % (40 tri, 28 lines, 2 draws), b0_part6 13.7 % (40 tri, 28 lines, 2 draws)
- spring: b0 100 % (114280 tri, 114218 lines, 3 draws)
- worm pair: b1 68.6 % (11608 tri, 13038 lines, 3 draws), b0 31.4 % (5528 tri, 5768 lines, 3 draws)
- spur gear: b0 100 % (2208 tri, 2248 lines, 3 draws)
- clearance-states fixture: b0 98 % (11230 tri, 11150 lines, 3 draws), b1 1.2 % (132 tri, 132 lines, 3 draws), i1/b1 0.1 % (12 tri, 12 lines, 2 draws)
- lid fixture: b0 45.7 % (11230 tri, 11150 lines, 3 draws), b1 0.5 % (132 tri, 132 lines, 3 draws), i1/b1 0 % (12 tri, 12 lines, 2 draws)
- starter plate template: b1 92.3 % (12 tri, 12 lines, 2 draws)

## Draws and primitives per pass (WebGPU)

- A9 assembly · shaded-with-edges: draws {"surface": 57, "transparent": 33}, primitives {"surface": 83873, "transparent": 3154}
- A9 assembly · hidden-lines-dashed: draws {"surface": 57, "transparent": 28, "hiddenLines": 47}, primitives {"surface": 83873, "hiddenLines": 41993, "transparent": 592}
- A9 assembly · x-ray: draws {"surface": 19, "transparent": 33, "oit": 38}, primitives {"oit": 42472, "surface": 41401, "transparent": 3154}
- 5 box frames (60 members) · shaded-with-edges: draws {"surface": 60, "transparent": 121}, primitives {"transparent": 30246, "surface": 24244}
- 5 box frames (60 members) · hidden-lines-dashed: draws {"surface": 60, "transparent": 120, "hiddenLines": 120}, primitives {"surface": 24244, "transparent": 30244, "hiddenLines": 30244}
- 5 box frames (60 members) · x-ray: draws {"transparent": 121, "oit": 60}, primitives {"transparent": 30246, "oit": 24244}
- spring · shaded-with-edges: draws {"surface": 1, "transparent": 3}, primitives {"transparent": 114220, "surface": 114280}
- spring · hidden-lines-dashed: draws {"surface": 1, "transparent": 2, "hiddenLines": 2}, primitives {"surface": 114280, "transparent": 114218, "hiddenLines": 114218}
- spring · x-ray: draws {"transparent": 3, "oit": 1}, primitives {"transparent": 114220, "oit": 114280}
- lid fixture · shaded-with-edges: draws {"surface": 30, "transparent": 11, "outlineMask": 6}, primitives {"transparent": 14356, "surface": 23130, "outlineMask": 11532}
