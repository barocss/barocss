# @barocss/physics

Physics advances an admitted numerical model from initial state and applied loads. The caller supplies
the clock and displays each accepted state. The rigid world uses spheres, boxes and capsules. It does
not use the exact CAD Surface as its collision shape.

This guide describes the current documentation branch. The package version is `0.0.0-experimental`
and unreleased. Local implementation and numerical evidence do not establish active CAD adoption,
publication, hardware validation or manufacturing acceptance. Existing HOLD and historical NO_GO
decisions remain in force. See [Physics verification](/reference/physics-verification).

## Choose the owning API

| Need | Owning entry or API | Scope |
| --- | --- | --- |
| Rigid forward dynamics | `createPhysicsWorld` from `@barocss/physics` | Fixed-step primitive bodies, contacts, bounded joints and queries. Choose an admitted profile. |
| One planar pendulum | `createPlanarPendulum` from the root | Local one-coordinate ODE, separate from the rigid world and its joint solver. |
| Static-box capsule sweep | `createUprightCapsuleQuery` from the root | Geometric query; no dynamic body or hidden clock. |
| Upright capsule movement | `createUprightCapsuleController` from the root | Fixed upright capsule and immutable bounded box scene. No general character dynamics. |
| CAD proxy admission and display mapping | `admitCadSurfaceProxy`, `assertCadProxyCurrent`, `cadProxyPose` from `@barocss/physics/cad-proxy` | Source-bound control-net sphere or box approximation. |
| Accepted command-log replay | `createPhysicsScene`, `createPhysicsReplaySession`, `restorePhysicsReplaySession` from `@barocss/physics/replay` | Versioned bounded scene and replay; no arbitrary state loading. |
| Visual water | `createFluidWorld` from `@barocss/physics/fluid` | Fixed 256-particle basin; visual settings, no calibrated fluid material. |
| Visual sheet | `createClothWorld` from `@barocss/physics/cloth` | Fixed 289-vertex pinned sheet and static sphere. |
| CAD obstacle in visual water | `createCadFluidWorld` from `@barocss/physics/fluid-cad` | One static axis-aligned CAD box proxy in version 1 water. |

Robot FK, IK, timed paths and prescribed-motion loads belong to
[CAD Model](/packages/cad-model/). Read the [robot motion guide](/guide/robot-motion) and
[Studio robot documentation](/studio/robots). A sampled robot path gives joint values over time.
It does not predict free motion from force. Motion is a capability here; there is no new installable
Motion package. Viewer applies display poses.

## Import and advance a free body

Workspace imports resolve TypeScript source. Use the documentation sample runner or a TypeScript-capable
bundler. Plain Node cannot resolve the source's internal `.js` imports to `.ts`. The package's
`publishConfig` selects compiled `dist` entries for a release. A source sample does not verify that
compiled package graph or a published package.

<<< @/../samples/physics-docs.test.mjs#physics-import

Use SI values at the Physics boundary. This fixture has a 2 kg sphere, an initial +X speed of 1 m/s,
and no other body. Its radius is 0.1 m. Keep conversion code outside the step loop.

<<< @/../samples/physics-docs.test.mjs#world-fixture

The world uses a configured fixed step. The sample compares 12 free-flight steps with the discrete
semi-implicit Euler solution. Its position oracle includes the integrator's time-discretization term;
it is not the continuous expression `p = p0 + v0*t + g*t²/2`.

<<< @/../samples/physics-docs.test.mjs#free-flight

The sample helper `vectorNear` compares each finite component with absolute tolerance `1e-12` unless
a tolerance is supplied. It uses `node:assert/strict`. The source is in
`apps/library-docs/samples/physics-docs.test.mjs` and runs with the site's `test:samples` command.
A separate sample test compares the same physical time, 0.1 s, with the continuous ballistic solution at
steps 1/120 and 1/240 s. Its position-error gate is 0.0041 m and its refinement-ratio gate is 1.99–2.01;
velocity is checked within 1e-12 m/s. This distinguishes integrator agreement from physical-time accuracy.
These examples supply no contact, browser or hardware result.

## Apply a force or an impulse

`step(dt, commands)` validates the commands before it advances a candidate. A `force` acts for this
one step, so its velocity change is `forceN * dt / massKg`. An `impulse` changes velocity once by
`impulseNs / massKg`. Supply a force on each step when you need a sustained load.

<<< @/../samples/physics-docs.test.mjs#force-and-impulse

The command order in the input array does not select the integration order. Physics applies linear
impulse, then gravity and force, then position, followed by collision and joint response. Torque and
angular impulse use world-frame vectors and the body's orientation-transformed inverse inertia.
`kinematicTarget` supplies an absolute metre position for one kinematic-body step. A kinematic body
holds its position and reports zero velocity when the next step has no target.

## Reduced planar pendulum

This branch exports `createPlanarPendulum`. It solves one angle about a fixed +Z pivot at the origin,
with gravity along −Y. It admits no contact geometry, motor, damping or joint network. It uses
velocity Verlet and explicit COM or pivot inertia. Read the [unit and frame contract](./units-and-frames).

<<< @/../samples/physics-docs.test.mjs#reduced-pendulum

This sample checks the zero-angle equilibrium and an expected refusal. The separate foundation
experiment records period, matched-time state, convergence and energy-envelope checks; see
[Physics verification](/reference/physics-verification). The pendulum interface has `getState()`,
`step(dt)` and `dispose()`. Create a new instance for a new initial state.

The local export does not establish adoption by the active CAD checkout. The CAD-bound workflow
that authors a hinge, applies loads and displays free motion remains a separate product gate.
It does not activate the original eight-box or two-hinge experiments.

## Select a bounded profile before creating a world

The default world admits 1–32 bodies and uses one contact point per pair. The opt-in
`persistent-box-v1` mode admits at most four bodies. `large-v1` admits up to 64 bodies with required
AABB broad phase and excludes joints, CCD and persistent boxes. These capacities are admission
bounds. They are not interchangeable stack-stability guarantees.

Use [profiles and lifecycle](./profiles-and-lifecycle) for the exact combinations, step limits,
typed refusals, copied state and replay rules. Use [units and frames](./units-and-frames) before
connecting a CAD or Robot host. Contact impulses and joint projection reactions are numerical
solver outputs. They are not calibrated mechanical loads.

Source owners for this guide are `packages/barocss-physics/package.json` and
`src/{index,types,world,limits,pendulum,cad-proxy,replay}.ts` in that package. The
[verification page](/reference/physics-verification) keeps numerical evidence, geometry-only
receipts, failed trajectories and product acceptance separate.


## Planned common World contract

The API described above currently has separate rigid, fluid and cloth runtime owners. Replay wraps a rigid world;
CAD fluid wraps a fluid solver with one static obstacle. There is no cross-domain force exchange or atomic shared
step. The [library roadmap](/physics-evidence/api-roadmap.txt) proposes one accepted World state and clock above
separate numerical solvers, with replay as a service and CAD as an adapter. That target API is not implemented.
A common facade cannot establish coupling: each admitted interaction needs its own numerical checks.
The unreleased transition will update callers directly; it will not retain a parallel compatibility engine.


P0 now fixes the proposed [model/state/command/failure contract](/physics-evidence/p0-contract.txt),
[unexported target types](/physics-evidence/p0-types.txt) and
[direct caller transition](/physics-evidence/p0-migration.txt). These documents do not change the current API shown
above. Type checks and an inventory do not establish runtime integration, physical coupling or a numerical pass.
