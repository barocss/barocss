# @barocss/physics

Physics advances an admitted numerical model from initial state and applied loads. The caller supplies
the clock and displays each accepted state. The rigid world uses spheres, boxes and capsules. It does
not use the exact CAD Surface as its collision shape.

The common World supports [continuous primitive rotation](./profiles-and-lifecycle#isolated-noncubic-rotor)
within its input and numerical limits. Dynamic noncubic boxes use their COM
inertia, not constant world angular velocity. Contact, CCD and joint limits
remain separate. A CAD proxy conversion does not certify its physical accuracy.

This guide describes the current documentation branch. The package version is `0.0.0-experimental`
and unreleased. Local implementation and numerical evidence do not establish active CAD adoption,
publication, hardware validation or manufacturing acceptance. Existing HOLD and historical NO_GO
decisions remain in force. See [Physics verification](/reference/physics-verification).

## Choose the owning API

| Need | Owning entry or API | Scope |
| --- | --- | --- |
| Rigid forward dynamics | `createPhysicsWorld` from `@barocss/physics` | Fixed-step primitive bodies, contacts, bounded joints and queries. Choose an admitted profile. |
| One planar pendulum | Independent `examples/physics-planar-pendulum-reference/pendulum.ts` | Local one-coordinate ODE, separate from the rigid world and its joint solver. |
| Static-box capsule sweep | `createUprightCapsuleQuery` from the root | Geometric query; no dynamic body or hidden clock. |
| Upright capsule movement | `createUprightCapsuleController` from the root | Fixed upright capsule and immutable bounded box scene. No general character dynamics. |
| CAD proxy admission and display mapping | `admitCadSurfaceProxy`, `assertCadProxyCurrent`, `cadProxyPose` from `@barocss/physics/cad-proxy` | Source-bound control-net sphere or box approximation. |
| Accepted command-log replay | `createPhysicsRecorder`, `restorePhysicsRecording` from `@barocss/physics/replay` | Attach at step0; bounded indexed recording; no arbitrary state loading. |
| Visual water | Root `createPhysicsWorld(model, options)` | Fixed 256-particle basin; visual settings, no calibrated fluid material. |
| Visual sheet | Root `createPhysicsWorld(model, options)` | Fixed 289-vertex pinned sheet and static sphere. |
| CAD obstacle in visual water | `admitCadFluidStaticData` data adapter, then root World | One static axis-aligned CAD box proxy in version 1 water. |

## Fixed cloth and fluid model data

These visual profiles use the same World clock, guard and state contract.
P5a private kernels passed their bounded two-step source/native gates. P5b
public source and actual native runtime checks also pass for the named fixtures
and horizons in [verification](/reference/physics-verification#p5-common-world-visual-profiles).
Strict source/native consumers and the selected four-profile source example pass.
Native host compilation keeps the missing rendering SDKs external; their implementation
and product execution remain unverified. Site checks have separate receipts.

[Download the inert model asset](/physics/model-data.mjs). It contains explicit
public PhysicsModel data, not another World factory. Copy it into your
application and import it locally. The repository sample uses that same asset.

<<< @/../samples/physics-visual-docs.test.mjs#visual-model-import

<<< @/../samples/physics-visual-docs.test.mjs#visual-model-step

Cloth topology, pins, physical vertex masses and ordered constraints remain in
`getModel().cloths[0]`. Copied positions/velocities and diagnostics are in
`getState().cloths[0]`; fluid data uses the corresponding `fluids[0]` entry.
Do not pass time to step. Host reset means dispose and recreate a root World.
Only empty commands are supported for these fixed visual profiles.

Profiles are `cloth-pinned-sphere-visual-v1`, `fluid-basin-visual-v1`,
`fluid-basin-xsph-visual-v1`, and `fluid-static-box-visual-v1`, all with
`domain-fixed` broad phase and1/120s. The fluid smoothing radius is the original
computed binary64 value `0.09000000000000001`, not literal `0.09`. These are
visual settings, without calibrated fabric, viscosity, pressure or P6 coupling.

Domain recording is explicitly refused. Cloth exceeds the unchanged128KiB
model cap (`WORLD_LIMIT`); fluid profiles use `INVALID_SNAPSHOT` until actual
wire/budget/restore closure is qualified. The failed attach changes no owner or
accepted state. Preserve1MiB/512frames/4096commands; no JSON wire fallback.
For CAD-derived static data, keep its admitted proxy and call the existing
current-source check before each World step. SourceBinding alone cannot prove
current source. No CAD Studio/Viewer UI or release action is implied here.

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

Pass `createPhysicsWorld(model, options)` a complete model and an explicit profile. The model separates
rigid bodies, colliders and source bindings. Each body has an `initial` transform and motion. Each collider
has its own geometry, local transform, material and filter. The options declare the fixed step and broad phase.
`getModel()` returns a copy of the admitted input; `getState()` returns the accepted state and its identity.
`step(commands?)` advances that configured step and takes no time argument.

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

`step(commands)` validates the commands before it advances a candidate. A `force` acts for this
one step, so its velocity change is `forceN * dt / massKg`. An `impulse` changes velocity once by
`impulseNs / massKg`. Supply a force on each step when you need a sustained load.

<<< @/../samples/physics-docs.test.mjs#force-and-impulse

The command order in the input array does not select the integration order. Physics applies linear
impulse, then gravity and force, then position, followed by collision and joint response. Torque and
angular impulse use world-frame vectors and the body's orientation-transformed inverse inertia.
`kinematicTarget` supplies an absolute metre position for one kinematic-body step. A kinematic body
holds its position and reports zero velocity when the next step has no target.

## Reduced planar pendulum

The independent example reference `createPlanarPendulum` solves one angle about a fixed +Z pivot at the origin,
with gravity along −Y. It admits no contact geometry, motor, damping or joint network. It uses
velocity Verlet and explicit COM or pivot inertia. Read the [unit and frame contract](./units-and-frames).

<<< @/../samples/physics-docs.test.mjs#pendulum-reference-import

<<< @/../samples/physics-docs.test.mjs#reduced-pendulum

This sample checks the zero-angle equilibrium and an expected refusal. The separate foundation
experiment records period, matched-time state, convergence and energy-envelope checks; see
[Physics verification](/reference/physics-verification). The pendulum interface has `getState()`,
`step(dt)` and `dispose()`. Create a new instance for a new initial state.

The reference is outside the public package root. It does not establish adoption by the active CAD checkout. The CAD-bound workflow
that authors a hinge, applies loads and displays free motion remains a separate product gate.
It does not activate the original eight-box or two-hinge experiments.

## Select a bounded profile before creating a world

The `rigid-discrete-v1` profile admits 1–32 bodies and uses one contact point per pair. The opt-in
`rigid-persistent-box-v1` profile admits at most four bodies. `rigid-large-v1` admits up to 64 bodies with required
AABB broad phase and excludes joints, CCD and persistent boxes. These capacities are admission
bounds. They are not interchangeable stack-stability guarantees.

Use [profiles and lifecycle](./profiles-and-lifecycle) for the exact combinations, step limits,
typed refusals, copied state and replay rules. Use [units and frames](./units-and-frames) before
connecting a CAD or Robot host. Contact impulses and joint projection reactions are numerical
solver outputs. They are not calibrated mechanical loads.

Source owners for this guide are `packages/barocss-physics/package.json` and
`src/{index,types,world,limits,cad-proxy,replay}.ts` in that package. The
[verification page](/reference/physics-verification) keeps numerical evidence, geometry-only
receipts, failed trajectories and product acceptance separate.


## Common World transition

The current rigid root uses the [model/state/command/failure contract](/physics-evidence/p0-contract.txt):
`createPhysicsWorld(model, options)`, copied `getModel()` and `getState()`, `step(commands?)`, tagged `query(input)`
and `dispose()`. State includes model, configuration and provider digests. It identifies bodies and colliders
separately. The old root config and root reduced-pendulum factory are removed. There is no compatibility engine.

Cloth and fluid now use the common World. The removed `/cloth`, `/fluid` and `/fluid-cad` factories have no
compatibility path. Each admitted visual model contains one domain and its fixed static colliders. Dynamic
mixtures and force exchange with a moving rigid body remain unsupported. The replay service attaches to the common World through
`createPhysicsRecorder(world)` at step0 and owns advancing commands while attached. Recorder disposal detaches it;
the caller also disposes the World. CAD admission emits a body, collider and source binding; it never steps a
world. The [roadmap](/physics-evidence/api-roadmap.txt) and [migration contract](/physics-evidence/p0-migration.txt)
separate these later transitions from this rigid root change. This API change does not establish coupling or a new
numerical, Viewer, hardware or product acceptance result.


## P1b local evidence status

The rigid model/options cutover has selected source 8 / emitted 8 public checks,21 focused probes in each graph and
a native local published-map runtime/declaration receipt (`examples/physics-world-p1b-2276/evidence/native-04`).
These are checks of named providers, not a new numerical qualification. Five foundation entries pass 21 tests; documentation samples pass 174/174 and source mapping passes (`mapping-02`).
Documentation build, site and scoped link checks pass. README examples compile and execute (`native-05`). Current host callsites bundle with the absent Viewer SDK explicitly external; full Viewer/DOM execution remains NOT_RUN. Independent reduced-ODE receipts remain reference
results. P2_DONE_LOCALSELECTED has public source05/emitted05 checks11/11 each, test-only preparation-fault checks12/12
each, and native published-map/runtime/type checks. These historical receipts apply to their named providers; whole-engine
acceptance remains NO_GO. At that checkpoint, final recording callers passed3 per graph and docs samples174/174.
Current P5 results are separate in [verification](/reference/physics-verification#p5-common-world-visual-profiles).
Existing HOLD and NO_GO decisions stay in force.

## Physics Lab on desktop

The local Physics Lab uses the public World and recorder with the existing
WebGPU Viewer. From the repository root, run:

```sh
node examples/physics-lab/server.mjs
```

Open `http://127.0.0.1:52889`. Select box, sphere or capsule, change mass and
initial spin, apply world torque or a one-time angular impulse, then save,
restore and continue. The existing512-frame recording limit remains visible.
The fixed0.1s comparison uses six shared times at60/120/240Hz against saved
independent directed reference data. Live torque work is marked approximate;
it is not the independent comparison result. Desktop browser checks cover
actual controls, Viewer pose agreement, GPU pixels and failure retention.
This sample does not resume Studio or qualify contact/stack/device behavior.
