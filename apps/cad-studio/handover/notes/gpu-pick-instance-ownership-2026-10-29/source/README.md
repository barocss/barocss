# D324 source lane

The baseline commit is `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`. `baseline-source.json` records the original Git blobs and SHA-256 values; the two `before.gz` files preserve their exact source bytes. `current-source.json` binds the candidate source.

The original `unit/baseline.log` records one unchanged control PASS and one public instance-shrink FAIL, with `TypeError: Cannot read properties of undefined (reading '0')` in `multiply -> instanceTransform -> meshRay -> pickNow`. This is a bounded CPU readback harness using the actual reconstruction and public setter. It does not prove native GPU behavior.

## Change

`Viewer.pickSceneRevision` starts at zero. A committed mesh add/remove, a clear with meshes, or an accepted instance replacement on an active mesh advances it. `Mesh.setInstances` signals the existing internal `sceneMoved` connection after packing, buffer release, and assignment. Failed input, detached meshes, absent removal, empty clear, and null-to-null instance calls do not advance it. Reapplying a valid instance input still replaces the accepted packed state and advances the revision. Null-to-instances-to-null is detected even when the final value is again null.

`pickNow` captures the revision before submission. After mapping, it reads the result and unmaps once, then rejects a changed revision with null. Existing camera, clip, canvas, and base-transform checks remain. Public pick serialization, error propagation, buffer ownership, and reconstruction of unchanged results are unchanged. No callback or closure was added to a hot loop.

The private field is not a new public member. The existing `@internal sceneMoved` method now accepts an optional Mesh signal. The API inventory includes internal method signatures, so its expected signature may need review; no expected inventory was edited here.

## Verification boundary

The source owner inspected the diff and `git diff --check` passed. After-change build, type checks, lint, CPU regressions, and native WebGPU validation are NOT_RUN by this lane. Their owners run them once after source handoff. Object.create fixtures must initialize `pickSceneRevision: 0` to match the real constructor; the production source does not special-case incomplete fixtures.

This is a correctness change. It makes no performance, driver-memory, or OOM claim. Existing direct mutation of internal instance matrices and unrelated visibility/material contracts are outside this selected public-setter fix.
