# Real warm-frame input contract 01

This is a new, private Source-only probe. It does not change the engine, the qualified producer, the old broad-floor case, or any saved failure. The author does not execute the generator, geometry, or World. Root first runs the independent input generator and freezes its outputs. Root then uses the unchanged qualified producer build.

## Frozen input

There are two boxes. `a-floor` is static, centered at `[0,-0.1,0]`, with half extents `[0.2,0.1,0.05]` and identity orientation. `z-cube` has mass 1 kg, uniform primitive inertia, half extents `[0.5,0.5,0.5]`, and quaternion words obtained by nearest-even conversion of `[40/801,0,40/801,799/801]`. Its position is `[0,Cy,0]`, velocity `[0.5,0,0]`, and angular velocity `[0,0,0.01]`. Both materials have restitution 0, static friction 1, and dynamic friction 0.7. Gravity is `[0,-9.81,0]`; the time step is the binary64 value of `1/120`. The profile is `rigid-persistent-box-v1`, with direct broad phase.

The generator treats every stored binary64 input as an exact rational. It computes normalized Hamilton rotation as `q v conjugate(q) / dot(q,q)` without importing engine code. Let `n` be the cube local Y axis. Enumerate all eight actual floor corners. The unique maximum of `dot(n,p)` must be at `[-0.2,0,0.05]`. Set the exact height to `(0.5 + max dot(n,p)) / n.y`.

**Height conversion is directed downward, frozen before execution.** Convert this positive rational once to nearest-even binary64. If that word is above the rational, select its immediate lower binary64 word. This defines the correctly downward-rounded boundary value, not an iterative repair. Record its exact error and native plane penetration. Each must be at most the unchanged `1e-12 m` gate. No new height is selected after a refusal or failure.

The ideal rational quaternion has unit norm and Y axis `[-63920,635201,63920]/641601`. Its ideal decimal-dimension height is `673561/1270402`. This is a secondary analytic check. Actual-word Hamilton geometry controls model generation. Admission normalizes the quaternion in `parseBody`; the generator records this uncertainty and does not substitute a simulated parser. Initial and later native checks must use the actual admitted state. A strict constructor MISS remains a preserved result even when the ideal gap is small.

## Independent input checks

The floor support corner must be unique. Its projection onto the cube bottom plane must be strictly inside both finite face bounds. All other native support directions (three floor axes, three cube axes, and nine nonzero crosses) must have strict positive interval overlap larger than the selected plane's rounding residual. The reference records all corner projections, bounds, exact rational residuals, and initial closing, sliding, and changing-normal kinematics. These establish input feasibility only. They do not establish the future SAT feature, a cache hit, friction behavior, or stability.

The candidate hypothesis is a cube-Y face contact with the same floor corner and native point ID `FACE:4:0` on later queries. Coverage requires an actual corresponding nonzero tangent cache and a changed normal, with real prior/pass provenance. A matching name alone does not establish coverage. No cache is injected. The first real failure is preserved.

## Execution and result boundary

Use exactly one fresh World and at most three accepted-step attempts. Capture constructor state. Stop at the first independent physical failure, typed refusal, or validated actual warm-frame coverage. If three steps do not cover the real branch, report `NOT_COVERED`; do not tune this case. Existing trace, resource, numerical, geometry, momentum, spin, work, report, transaction, and cache gates remain unchanged. Existing global caps are not raised. No serde or restore World is added.

The generator writes a fresh `evidence/<id>/` with `model.json`, `options.json`, and `reference.json`. Only the first two are passed to World. The reference is not a witness seed. `INPUT_REFERENCE_READY` means independent input checks passed, not a physics PASS. The qualified Source bundle and its build/actual-PASS receipts are authenticated by SHA-256. Native, canonical public API, desktop, performance, and production promotion remain outside this probe.

No engine, geometry, force, cache, dispatch, or report equation changes are permitted here. If actual warm behavior fails, save the first failure before proposing a separate contract.
