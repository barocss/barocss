# D324 / #2237 delayed instance pick CPU baseline

Base: `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`.
Node: `v22.19.0`. Working directory: `packages/barocss-gpu` in the assigned worktree.
Gate `d324-pick-baseline` acquired and released. Exactly one baseline run; no rerun.

## Source and execution binding

The GPU test imports emitted `dist/viewer/*.js`, as existing viewer-core and mesh-instance-atomicity tests do. The preexisting GPU dist was stale. Under the gate:

1. `node ../../node_modules/typescript/bin/tsc -p tsconfig.build.json`: **exit 0**. `baseline-emit.log` is empty. This emits the current GPU source and declarations; no CAD/kernel build was run.
2. `node --import ./tests/cad-dist.mjs --test tests/pick-instance-readback.test.mjs`: **exit 1**, **1 pass / 1 fail / 0 skipped**, normal runner exit. `baseline.log` is the original output; `baseline-exits.txt` records both exits.

`baseline-source-sha256.txt` records the exact viewer/scene source, new test and preexisting CAD dist used. `baseline-dist-sha256.txt` records the freshly emitted viewer/scene JS. These hashes are evidence binding, not acceptance oracles in the test.

## Product behavior observed at the CPU reconstruction boundary

- Unchanged delayed-readback control passes through actual `pickNow`: instance 1, triangle 0, face 71, captured depth and expected world point `[0.25, 0.25, 0]` within `1e-5`. Its successful assertions include exactly **map 1 / mapped-range reads 3 / unmap 1**.
- A second fixture first accepts the same hit, then delays another readback and calls actual public `Mesh.setInstances` to shrink two instances to one. It throws `TypeError: Cannot read properties of undefined (reading '0')` through `multiply → Viewer.instanceTransform → Viewer.meshRay → Viewer.pickNow`.
- The shrink test's `finally` executes before propagating that raw TypeError. Its assertions pass for exactly **maps 2 / reads 6 / unmaps 2** across the two requests (one unmap per mapped request), unchanged previous accepted point/face/triangle/instance, retained two-element original matrices, and current one-instance state. Counters are asserted by the bound test source; the TAP raw output prints the TypeError rather than separate counter diagnostics.

No production source, runner, dependency, API, lockfile or other worker's file was modified by this worker. Only the new affected test and this unit evidence were written.

## Proof boundary and source reference

Actual Camera, Geometry, Mesh, public setInstances and private pickNow CPU reconstruction are used. The sceneMoved prototype is real. Device submission, draw/visibility and prepareCamera preparation are stubbed. This is **not** Viewer constructor, public pick() queue, native GPU, rendered pixels, or browser timing proof. Matrix replacement/reorder/removal/mesh removal are not part of this minimal baseline run and remain expansion work.

The archived #2237 body and original audit `gpu-delayed-pick.mjs` / `runs/gpu-001/delayed-pick.json` were read only. That report belongs to `5463dbf32af5dd10670badd0d334c68504615292`; it is not reused as a run of the current source. The current fixture independently uses the current worktree and a different triangle/camera orientation, with its unchanged control first.

## Test registration observation

`packages/barocss-gpu/package.json:38` lists CPU test filenames explicitly. The new `tests/pick-instance-readback.test.mjs` is **not automatically discovered** and is not yet registered. `.github/workflows/release.yml:44` invokes recursive package test scripts, so that path also requires explicit package-script registration for this regression. The root `test` delegates recursively as well. No runner/CI change or remote CI execution was made in this baseline task.
