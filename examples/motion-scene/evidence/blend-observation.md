# Two-clip blend checkpoint

Base: integrated #668 `fa5b12eb4b1d96d3ae1852213b9907cda1c1b1ac`. Owned paths are under `packages/barocss-motion/**` and `examples/motion-scene/**`.

Affected build: `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --filter @barocss/motion build:library` exited 0. `tsc` and `esbuild` produced `dist/index.js` (31.9 kb). No initial build failure occurred.

Compiled real-file probe: `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH node examples/motion-scene/blend-probe.mjs` exited 0. It read `assets/two-parts.baromotion` and `assets/two-parts-blend-target.baromotion`. The destination has reversed target order and Part A quaternions opposite in sign to the source. Source order remained `part-a, part-b`. At source/destination time 2 s and weight 0.5, Part A translation was `[-5,25,0]` mm and Part B translation was `[37.5,15,0]` mm. Weight 0 preserved the source's negative-zero translation component; weight 1 preserved the destination quaternion `[0,0,0,-1]`. Separate times 1 s and 3 s were returned unchanged. The antipodal midpoint rotation followed the source orientation. Context, target, property, time, weight, and getter inputs refused with stable codes while an earlier result remained unchanged; getter calls were zero.

Browser: served this worktree on `http://127.0.0.1:52149` and opened `examples/motion-scene/blend-demo.html` in headed Chromium. The page reported ready, had one canvas, and displayed the same two-part midpoint. The destination file input rejected `assets/wrong-context.baromotion` with `INCOMPATIBLE_CLIPS`; a before/after result comparison showed the prior pose was retained. The destination and source file inputs then opened the two compatible assets and returned the known midpoint. Browser console: zero errors and warnings. [Midpoint screenshot](./blend-midpoint.png) shows the actual 3D consumer and pose readout.

This is a Motion-owned native checkpoint. GPU integration, Viewer adoption and release acceptance are separate.
