# CLOTH-01 native numerical receipt

Issue #978. Clean base `f217cd7060a22f44fcfa6612d701e5bf3e432942`.
Implementation/probe source commit `6cd35e8e789de091312c933d9bd9cf0262d40125`.
The evidence child changes only these reports. Node22.22.0.

## Executed gates

- `pnpm --filter @barocss/physics build:library`: TypeScript declarations and JavaScript plus existing root bundle passed. No root/lock or existing rigid/fluid code changed.
- `node examples/physics-scene/cloth-world-probe.mjs`: independent scalar expectation passed; 29 malformed configs rejected without executing getters; nine injected numeric faults rejected with complete public-state retention and exact recovery.
- Copied positions/velocities/triangles/pins/proxy/diagnostics cannot mutate the world. Invalid dt, limit241, reset from accepted step240 and repeated disposal pass.
- Preserved #825 XPBD8x2 code is the trajectory reference. Positions/velocities differ by exactly0 at0/60/240 in this Node environment. Peak extension0.05174255069177636; all240accepted states satisfy finite/bounded values, exact pins and vertex-envelope penetration<=1e-6m. Final SHA256127f1c7626b9b089ccfef63503a01d67ac05abb65d0bb7aad272d6f1e66ff1a4 matches the discovery receipt and four repeats.
- Independent triangle centroid/edge-midpoint samples: peak0.0013840839157666096m at28, below the separate0.002m display-loss target. This does not guarantee continuous triangle separation.
- One warmup and three240-step public CPU trials: p95 1.236917/1.232209/1.291042ms, each below1000/120ms. Includes candidate copy, numerical solve, diagnostics and returned-state copy; excludes reference and triangle sampling. No GPU completion or actual Viewer measurement.
- `node examples/physics-scene/cloth-source-import-probe.mjs`: esbuild source-condition/default resolve to correct src/dist subpath; actual plain Node named `@barocss/physics/cloth` import advances step1 and thrown errors use its exported PhysicsError.
- Existing five-entry source/default resolver probe and diff-check passed.

## First verification mismatch and limits

A helper initially compared `/cloth`'s PhysicsError constructor with the bundled root constructor. That assertion failed. The existing root build bundles its own class; compiled subpaths use the shared unbundled types module. Cross-entry constructor identity is not part of this Issue's contract, and this existing root architecture was preserved. The corrected assertion verifies errors against the actual `/cloth` exported class; consumers can use stable error.code.

This is a public numerical visual-profile candidate, not a Viewer cloth acceptance, calibrated material model, engineering stress, self-collision, arbitrary-mesh solver or release. Integration remains the only shared develop writer and must adopt the native delta once, build and run the focused compiled/source consumer before closure. Actual 3D delivery remains #979/#980/#981.

## Independent review correction and final clean run

A read-only reviewer found that null-prototype records were accepted despite the frozen custom-prototype refusal. Corrected at `11c4be8f1ada95887fe36dd7415ea8d43787245d`: require exactly Object.prototype, add the null-prototype refusal to the probe, and clarify README. This is an admission correction; solver code and original numeric reports above remain unchanged.

The final clean-source compiled/source probes ran on that commit, recorded sourceTreeDirty:false and passed. Final reports are `cloth-978-final-world-2026-10-09.json` and `cloth-978-final-source-2026-10-09.json`. Thirty malformed configs now refuse; nine numerical guard/recovery cases, copied-state/lifecycle, exact reference snapshots/hashes, sampled-loss and named Node/source imports all pass. Final public CPU warm p95 trials are1.306083/1.312458/1.225500ms. The initial reports at6cd35e8e remain preserved as earlier evidence; they did not cover null-prototype refusal. No actual Viewer acceptance is implied.
