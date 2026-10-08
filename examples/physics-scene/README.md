# Physics scene

This is the first visible consumer of `@barocss/physics`. A moving sphere falls onto a fixed box. The engine computes positions, velocities and contacts in SI units; this page draws a side projection of those returned values. The sphere and box are screen geometry, not CAD collision shapes.

From the repository root, build the package and run:

```sh
pnpm --filter @barocss/physics build:library
node examples/physics-scene/probe.mjs
node examples/physics-scene/controls-probe.mjs
node examples/physics-scene/events-queries-probe.mjs
node examples/physics-scene/rotation-probe.mjs
node examples/physics-scene/oriented-colliders-probe.mjs
node examples/physics-scene/friction-stack-probe.mjs
node examples/physics-scene/joints-probe.mjs
node examples/physics-scene/ccd-probe.mjs
node examples/physics-scene/broadphase-probe.mjs
node examples/physics-scene/replay-probe.mjs
node examples/physics-scene/server.mjs
```

Open `http://127.0.0.1:5181/`. Use pause, single step and reset. The panel reports the same state returned by the library. The probe checks free fall, stable box rest, sphere impact, initial overlap, copied state, refusal retention and disposal.

The separate compiled `controls-probe.mjs` checks one-step force, impulse, kinematic box movement/contact, command order, invalid command retention and the original no-command `step(dt)` route. The visible scene remains the bounded v0 sphere-and-fixed-box profile.

The compiled `events-queries-probe.mjs` checks begin/stay/end events for physical and sensor pairs, no sensor impulse, inclusive overlap and nearest ray queries, copied events, invalid-query refusal and unchanged accepted state. The SVG scene remains a v0 host; this probe is not a 3D Viewer or Canvas2D adoption.

The compiled `rotation-probe.mjs` checks sphere inertia, torque and angular impulse, quaternion integration and normalization, state copies and atomic refusal. The visible scene remains a bounded position/contact host; the separate oriented-collider probe checks later 3D collision behavior.

The compiled `oriented-colliders-probe.mjs` checks an off-centre dynamic oriented-box/static-sphere impact with linear and angular response, a rotated capsule/static-sphere contact and queries, aligned box/box contact, copied world contact points/inertia, unsupported pairs and invalid-state retention. The visible SVG scene remains the original sphere/floor host. The supported primitive matrix is explicit; this probe does not show CAD collision or stacked-box stability.

The compiled `friction-stack-probe.mjs` compares zero and nonzero point friction on a sliding sphere and measures two vertically stacked dynamic spheres on a static box for 240 fixed steps. It checks copied tangent impulses, coefficient refusal and failed-step retention. This bounded fixture does not establish arbitrary pile or box-face stability.

The compiled `joints-probe.mjs` checks a static-anchored fixed sphere under gravity, a Z hinge with a ±0.5 radian limit, an offset local anchor, copied reaction output, invalid joint configs and failed-step retention. The visible SVG scene remains the original sphere/floor host. The joint profile is a bounded projection solver, not a CAD assembly constraint or general robotics joint system.

The compiled `ccd-probe.mjs` reproduces a fast sphere crossing a thin box under discrete stepping, then checks that opt-in CCD records an entry fraction and stops at contact. It also checks an oriented box, no-hit output, copied hit state, unsupported configuration refusal and failed-step retention. The SVG scene still renders the original bounded sphere/floor case.

The compiled `broadphase-probe.mjs` compares direct and optional AABB pair filtering for 32 bodies over 120 steps. It checks copied pair statistics, exact accepted pose/contact agreement in the fixed workload, oriented box and capsule bounds, a contact cascade within one solver pass, kinematic movement, CCD, refusal and disposal. It prints candidate counts, local wall time and heap-use change. These measurements describe this run only; heap-use change is not total allocation.

The compiled `replay-probe.mjs` saves a versioned scene and 150 accepted command frames, round-trips a snapshot through JSON, restores an independent world and compares state and a subsequent step. It also checks contact and fixed-joint reaction, copied scene/log data, stale scene and source revisions, damaged commands/state, unsupported versions, nonfinite input, failed-step retention and the 512-frame limit. Replay is a bounded command-log reconstruction, not an arbitrary state restore or cross-platform determinism guarantee.

`release-gate.mjs` is the PHYS-12 native preparation runner. With Node 22.22.0 and pnpm 10.11.0 on the declared macOS arm64 profile, run `node examples/physics-scene/release-gate.mjs examples/physics-scene/evidence/release-gate-native-2026-10-08.json`. It performs frozen offline install, CAD/GPU/interop/Viewer/Physics builds, all ten Physics probes plus the CAD proxy probe, fixed numeric checks, local package packing and an offline install in a separate temporary consumer. The consumer imports only package names and checks root/CAD/replay entries and declarations. The [saved report](evidence/release-gate-native-2026-10-08.json) records exact outputs. A local native pass prepares a candidate; #773/#774 local Integration and a fresh merged-head browser check are still required for release-candidate acceptance. No package is published by the runner.
