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
node examples/physics-scene/server.mjs
```

Open `http://127.0.0.1:5181/`. Use pause, single step and reset. The panel reports the same state returned by the library. The probe checks free fall, stable box rest, sphere impact, initial overlap, copied state, refusal retention and disposal.

The separate compiled `controls-probe.mjs` checks one-step force, impulse, kinematic box movement/contact, command order, invalid command retention and the original no-command `step(dt)` route. The visible scene remains the bounded v0 sphere-and-fixed-box profile.

The compiled `events-queries-probe.mjs` checks begin/stay/end events for physical and sensor pairs, no sensor impulse, inclusive overlap and nearest ray queries, copied events, invalid-query refusal and unchanged accepted state. The SVG scene remains a v0 host; this probe is not a 3D Viewer or Canvas2D adoption.

The compiled `rotation-probe.mjs` checks sphere inertia, torque and angular impulse, quaternion integration and normalization, state copies and atomic refusal. The visible scene remains a bounded position/contact host; the separate oriented-collider probe checks later 3D collision behavior.

The compiled `oriented-colliders-probe.mjs` checks an off-centre dynamic oriented-box/static-sphere impact with linear and angular response, a rotated capsule/static-sphere contact and queries, aligned box/box contact, copied world contact points/inertia, unsupported pairs and invalid-state retention. The visible SVG scene remains the original sphere/floor host. The supported primitive matrix is explicit; this probe does not show CAD collision or stacked-box stability.
