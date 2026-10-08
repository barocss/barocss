# C2D-13 fixed host measurement

## Reproduce

Worktree parent: local integrated `develop` at `4864c16cc17c21919ff2d8d7f17b5386f9047672` (includes #708). Node 22.22.0 and the preinstalled package dependencies were used. Run `pnpm --filter @barocss/canvas2d build:library`, `node examples/canvas2d-scene/history-probe.mjs`, and `node examples/canvas2d-scene/server.mjs`. Open `http://127.0.0.1:57012/examples/canvas2d-scene/perf-v4.html` (set `PORT=57012`), click **Run fixed measurement**, then **Save metrics JSON**. The two checked-in downloads are `baseline.json` with the original `SceneHistory.commit` return and `optimized.json` with the one-line return change. The same fixed corpus and harness were used for both, in one Playwright Chromium session with page reloads. `optimized.png` is the measured page screenshot.

## Corpus and hardware

Scene v4, 800×480 logical pixels, DPR 2. Eight clipped frames contain 24 paths, eight images, eight two-glyph runs, rectangles and lines. Two copied assets total 296 bytes. All scenes stay under current admission limits. Browser: Headless Chrome 155.0.0.0 on macOS, WebGL2 through ANGLE Metal on Apple M3 Max. Hardware strings are preserved in each JSON. Each trial warms the renderer ten times, then records 40 updateScene calls, 30 render-plus-`gl.finish` calls, 20 batches of 1,000 miss/visible hits, and 20 distinct history edit commits plus `gl.finish`. The timer has approximately 0.1 ms granularity for single calls; these distributions are one local run per revision and may vary on another run or device.

| Metric | Baseline median / p95 | Optimized median / p95 |
| --- | ---: | ---: |
| `updateScene`, 40 calls | 0.5 / 0.8 ms | 0.5 / 0.8 ms |
| render + `gl.finish`, 30 calls | 0.1 / 0.1 ms | 0.1 / 0.2 ms |
| miss hit, 20 × 1,000 | 0.0011 / 0.0013 ms per hit | 0.0011 / 0.0015 ms per hit |
| visible hit, 20 × 1,000 | 0.0013 / 0.0022 ms per hit | 0.0013 / 0.0018 ms per hit |
| history commit + `gl.finish`, 20 calls | **1.1 / 1.5 ms** | **0.9 / 1.2 ms** |

The selected bottleneck is the host history commit. `SceneHistory` formerly copied the candidate once to edit, once to store, and once to return. The returned edited candidate is already detached from its stored history copy and from the renderer's validated copy. Returning it saves the final copy. `history-probe.mjs` mutates that return and checks the accepted history and renderer scene remain unchanged; rejection still keeps the prior state.

The corpus, hardware fields, history position 20/21, five RGBA pixels, five hit IDs/kinds, and setup/run/dispose resource counts matched exactly across JSON files. Both observed two texture uploads (296 bytes total) and three buffer creations during setup; no texture upload occurred in the timed updates or commits. Both recorded 8,432 `bufferData` calls and 1,083,264 submitted buffer bytes after the full run. Both deleted two textures and three buffers on `dispose()`, and a later render returned `DISPOSED`. `performance.memory` supplied a JS heap estimate but is not a precise CPU-memory accounting. GPU resident bytes are unavailable through this WebGL observation. No GPU resource or draw pipeline was changed.

The changed commit metric is one-device evidence. The render p95 and miss-hit p95 moved slightly in the other direction; these paths are unchanged and the differences are within the observed single-call timer granularity. No broad FPS, platform, or backend claim follows.
