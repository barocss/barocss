# Coupled hinge pose reference — #1309

Private detached candidate. It changes two poses once. It does not step a world, drive a motor, call the original projection, or change velocity/angular velocity.

The law clamps raw relative +Z twist, splits the correction by original inverse axis inertia, applies each quaternion correction once, holds those orientations, then closes both anchors about the unchanged mass COM. The output pose report has joint ID, final angle and target angle only. Pose deltas are not reaction loads.

Input metadata uses unchanged #1294 rest/raw helpers. The reader validates immutable external #1279 archive/native/source/Float64 data and adopted #1294 diagnostic proof. Historical whole CAD pins are verified at historical native sources. The new source freeze pins the current complete CAD/Physics graph separately.

## Commands after root freeze and authorization

Data-only freeze: `node examples/physics-rigid-coupled-hinge-reference/freeze.mjs`.

Build: original `examples/physics-rigid-engine-reference/build-local.mjs`, with Node22.22.0 and REPO_DEPS_ROOT set to the Integration dependency root. Strict types use this directory's tsconfig.json. Root records the actual emitted ledger before any consumer execution.

One consumer: `node examples/physics-rigid-coupled-hinge-reference/runner.mjs /Users/user/.codex/worktrees/physics-multi-hinge/barocss /tmp/physics-1309-canonical`.

The consumer verifies the prior source/emitted freezes, runs frozen refusal/reference controls, evaluates positive analytical cases, the same24 archived records196/197, and one admitted inconsistent-anchor/orbital-momentum case, and compares source/source-repeat/genuine compiled helpers. The first physical gate failure stops that graph. Later graphs consume only the same prefix. Unknown/archive/reference/harness failures are recorded separately.

Live JS equality and Float64LE preserve signed zero. JSON snapshots erase zero signs and serve only as readable records. Before/after raw pair frames contain26 doubles/208bytes in body order: position3, velocity3, quaternion4, angular velocity3. Raw hex is also passed to the independent observer.

The observer computes its law from independent original input. It checks anchors, angle/report/limits, COM, P and orbital+spin L, raw/normalized geometry, and separate Decimal80/120 algebra. Velocity bits remain fixed. Orbital L conservation is measured, not promised. Detached GO does not qualify a world velocity/motor law, public engine, adoption or release. Preserve the original #1279 NO-GO and #1294 diagnostic result.

The inconsistent-anchor input is admitted by this API. It is evaluated by the actual candidate after the archived records. Its known independent law prediction of orbital L loss is not an admission refusal or substitute evidence. A measured momentum failure produces detached NO-GO and stops the candidate prefix.
