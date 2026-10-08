# Marker timeline checkpoint

Base: `c3742ece80ed33cb7019f3ca5d37ce5d69cfeb59` (#662 native child). This checkpoint changes only `packages/barocss-motion/**` and `examples/motion-scene/**`.

Command: `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-motion build:library` — exit 0, `tsc` and `esbuild` complete.

Command: `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH node examples/motion-scene/timeline-probe.mjs` — exit 0. It read `assets/two-parts.baromotion`. At 2 s, events were `mid-a:0:1, mid-b:0:2` and part A translation was `[-25,10,0]` mm. Clamp at 4 s returned `end:0:3` and paused. Repeat from 2 to 4 s returned `end:0:3, start:1:0` with time 0 and iteration 1. An 8 s advance from zero returned both midpoint markers and endpoint for passes 0 and 1, followed by pass-2 start. Seventeen seams and 257 or more events refused with `LIMIT_EXCEEDED` and preserved prior state. Accessor input refused with zero getter calls. Duplicate marker and unknown target refused. Zero markers and a zero-duration clip had no events.

Browser: served this worktree on `http://127.0.0.1:52139` and opened `examples/motion-scene/timeline-demo.html` in headed Playwright Chromium. `document.body.dataset.ready` was `true`. A host-supplied exact 2 s advance produced `mid-a, mid-b`, time 2, iteration 0, and part A translation `[-25,10,0]` mm. An exact repeat seam from 2 s produced `end` at iteration 0 before `start` at iteration 1; resulting time was 0. [Midpoint screenshot](./timeline-midpoint.png) shows the actual 3D scene and event readout. The canvas only displays timeline poses; marker events come from the Motion wrapper.

This is a Motion-owned native implementation checkpoint. GPU integration and release acceptance are separate.
