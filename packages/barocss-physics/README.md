# @barocss/physics

The [library design and development roadmap](ROADMAP.md) defines the unreleased target API and
its staged verification. The root uses the P0 model/options contract. P5a private cloth/fluid kernels passed their bounded two-step source/native gates; the P5b common-World cutover is implemented with qualification pending. Existing HOLDs,
public admission limits and original NO_GO receipts remain in force.

The new `rigid-stationary-cube-stack-v1` uses that same World for unforced
equilibrium maintenance of eight1kg yaw-only cubes on the original floor.
Independent original ALIGNED/OFFSET/YAW1200-step checks, actual public
Source/compiled paths and desktop WebGPU body-word parity pass locally.
This does not support falling/collapse of eight bodies. The persistent-box
cap remains4, recorder caps512frames/1MiB, and all historical failures remain.
See [stationary World results](../../examples/physics-stack-stationary-world-2276/RESULTS.md).

Existing1/2-body impact dynamics also pass11 fresh desktop checks with current
emitted Physics, including numerical bounce values, actual upward travel and
changed GPU pixels. See [current motion desktop results](../../examples/physics-motion-desktop-2276/RESULTS.md).
The new direct, zero-friction/restitution box island uses one global normal and
all-pair position solve through the same World. The aligned2kg two-cube/floor
case passes256 primary steps in Source/actual compiled paths, independent
global projection/geometry gates, record/restore/failure controls and same-Native
desktop full257-state/word parity. Existing cap4 and tolerances stay fixed;
that zero-material regime explicitly rejects AABB. The later anisotropic tensor
repair constructs a symmetric world tensor directly. The original precontact
rotated box and a principal-spin case now pass 64 steps, three matched-time
step sizes, strict Source/actual compiled API and desktop checks. General tilted
contact is not qualified. Original first failures remain.
See [coupled dynamics results](../../examples/physics-coupled-cubes-floor-2276/RESULTS.md).
The same algorithm also passes three aligned2kg cubes/floor through256steps,
with an independent3DOF reference and actual desktop full-state/word/pixel checks,
inside cap4. See [three-cube results](../../examples/physics-three-cubes-floor-2276/RESULTS.md).
General moving8 is not qualified. No deployment.
See [anisotropic library results](../../examples/physics-anisotropic-inertia-2276/RESULTS.md)
and [CAD consumer readiness](../../examples/physics-anisotropic-inertia-2276/CONSUMER-READINESS.md).
CAD/CAD-model primitive flows and GPU CPU mesh admission pass; CAD Studio has no
Physics integration and remains on HOLD. No generic B-rep collision or full CAD
mass-tensor import is implied.

The finite box CCD checkpoint accepts both signs of the identity quaternion
without changing orientation/angular thresholds. Source/compiled20-case checks
and9desktop GPU checks pass; see
[`physics-box-slab-boundaries-2276`](../../examples/physics-box-slab-boundaries-2276/RESULTS.md).
A separate private contact-witness construction passes independent geometry on
20cases, including all32 original RAW point coordinates without movement.
It does not qualify the public persistent solver or eight-box dynamics; see
[`physics-box-quantized-witness-2276`](../../examples/physics-box-quantized-witness-2276/RESULTS.md).

A bounded, renderer-neutral fixed-step 3D Physics package. Its rigid world simulates admitted spheres, oriented boxes and capsules, static/kinematic boxes, limited fixed/hinge joints and narrow opt-in CCD profiles. The same World owns a selected fixed256-particle visual basin or a fixed pinned sheet over a static sphere. The caller owns time and display. The package does not simulate exact CAD Surface or mesh collision, general joint networks, arbitrary cloth meshes or engineering fluid flow.

## Continuous rigid rotation

The common World advances free and forced rotation for admitted primitive-COM
boxes, spheres and capsules. Mass, dimensions, initial pose, angular impulse and
torque use the existing input ranges; there is no case whitelist or one-step
horizon. A capsule uses uniform-density cylinder and hemisphere COM moments,
with its centreline on body Y. Sphere-isotropic overrides remain explicit.

Angular impulse acts once at step start. Torque acts continuously in world
coordinates during the configured step, then expires. Torque-free anisotropic
motion uses an eighth-order geometric composition. Constant torque uses
eighth-order modified-midpoint extrapolation and affine world momentum.
Conditioning, movement and finite-arithmetic bounds may refuse a step with
`NUMERIC_LIMIT`; the accepted state and recording remain unchanged. There is
no integrator switch, compatibility engine or second World.

The [general rotation contract](../../examples/physics-general-rotation-2276/CONTRACT.md)
separates admission from measured accuracy. The original G1/G1e failures and
one-step evidence remain historical records. Contact, joint and CCD profile
limits still apply; rotation accuracy alone does not qualify those solvers.

The [desktop Physics Lab](../../examples/physics-lab/README.md) runs box, sphere and capsule rotation with the public World/recorder and existing Viewer. It includes live diagnostics, in-page save/restore and an independent fixed-case three-grid comparison.

The [rounded CCD desktop scene](../../examples/physics-rounded-ccd-2276/README.md) shows the actual sphere/static-box face, edge and vertex boundary, with hit/miss and normal diagnostics. The narrow sweep now uses Euclidean distance instead of an expanded rectangular boundary.

The [persistent box impact scene](../../examples/physics-persistent-impact-2276/README.md) exercises minimum restitution and the strict speed switch through the common World, recorder and desktop GPU Viewer. Centered zero-friction impacts and warmed-cache failure recovery are qualified separately from general stacks and friction.

The [tangent response scene](../../examples/physics-tangent-response-2276/README.md) shows discrete anisotropic cuboid sticking and the original sphere static/dynamic boundary inputs. Independent momentum/no-slip audits and desktop rendering are recorded separately; this does not qualify persistent friction or arbitrary coupled impacts.

The [two-sphere CCD scene](../../examples/physics-sphere-pair-ccd-2276/README.md) shows the corrected near-graze MISS and real head-on/graze cases through the actual World/recorder. Separate endpoint/radius words drive exact predicates; display enlargement is explicitly labelled.

The local tracking checkpoint on 2026-11-03 keeps P4 and persistent friction
NO_GO. Offline adapter byte equivalence and compact V2 saved numeric/protocol
checks pass. Position V2 matches the complete saved physical reply on 6 cold
QPs/432 records/2592 words/17394 retained leaves; its core CPU is773147000 ns.
Primitive-axis CPU798363000 ns fails the fixed cost gate and that candidate is
ended. The Node candidate also fails: parent core397992000 ns plus full owned
wait4 child CPU686846000 ns is1084838000 ns. That conservative wider boundary is
one saved-baseline pairing; it is not a universal benchmark. The child reaches
both EOFs and is reaped. Full 32-point line/paired witness, ledger/quality,
whole-trajectory cost and full 1200-step P4 remain NOT_RUN. See the
[offline position results](../../examples/physics-p4-position-v2-2276/RESULTS.md),
[primitive cost result](../../examples/physics-p4-primitive-axis-2276/RESULTS.md)
and [Node receipt](../../examples/physics-p4-node-sat-2276/evidence/node-01/summary.json).

A separate public Native persistent-friction baseline accepts 2 steps in 1 World
but fails: tangent-plane residual 7.191714e-9 Ns and accepted paired-contact gaps
8.508678e-6 m/5.691598e-5 m exceed their unchanged 1e-12 gates. Geometry phase/cache
handling remains under investigation. Private box construction and
Source/strict parity pass 20 cases/62 points per graph, but independent geometry
stops at the third point of the first case because the rounded midpoint line
misses a native box. That candidate is private and has no production integration.
These failures do not change the separate finite sphere-pair CCD/API/desktop
result. See the [roadmap](ROADMAP.md) for evidence paths and proof boundaries.
HOLDs, first failures and all tolerances remain. No deployment is authorized.

A private replacement separates accepted native geometry from integrated
pair wrenches. Its first Source execution passes3 Worlds/8 attempts/6 accepted
steps, independent physical reports, rollback, retry and restore/continue.
Its typed Source/emitted amendment also passes the bounded cold-cache campaign
with22 complete packet matches. A separate same-input warm projection passes
one real changed-frame cache hit and a4-World/8-attempt recording, rollback,
wire and restore campaign. The composed warm Source/emitted gate now passes38 complete packets and full
wire equality. Its browser consumer passes10 desktop rendering checks and a
separate independent physical audit of the saved finite-window trace. The
original capture and decoder-resource failures remain preserved.
Current public types/recording remain unchanged.
General cache/cone laws, all producer paths, performance and full P4 still block
adoption. See the [typed result](../../examples/physics-contact-wrench-native-2276/RESULTS.md)
and [warm recording result](../../examples/physics-warm-replay-2276/RESULTS.md).

The separate [coupled static-contact candidate](../../examples/physics-coupled-contact-2276/RESULTS.md)
passes the unchanged before/at static-friction boundary inputs in Source and
strict emitted JavaScript. Independent contact-velocity residuals are zero;
all33 retained packets match. The after input refuses before application and
preserves accepted state. Dynamic contact remains NO_GO. This private first-
cold-interval result does not adopt a public API or qualify warm/multipoint,
recording or long-time behavior. Its separate
[desktop sample](../../examples/physics-coupled-viewer-2276/RESULTS.md) passes6
rendering/control checks and15 independent checks of the actual saved browser
physics data. Desktop widths are1280/1440/1920; no mobile tests run. The
original0.1410596011492487m/s constitutive failure and all original criteria
remain preserved.

The separate [lifecycle observation candidate](../../examples/physics-coupled-lifecycle-2276/RESULTS.md)
retains actual hidden validation state before disposal. Fresh Source/compiled
controls and one-frame rollback, wire and live restore checks pass, with40 static
and44 transaction packet matches. The old post-disposal observation failure
remains preserved. Its [desktop consumer](../../examples/physics-coupled-lifecycle-viewer-2276/RESULTS.md)
separately passes7 rendering/capture checks and15 unchanged physical observers
on actual browser data. This does not qualify a second physical interval,
dynamic contact, warm/multipoint or public adoption.

The [dynamic target arithmetic](../../examples/physics-coupled-dynamic-efficient-2276/RESULTS.md)
passes three fixed physical inputs and eight admission controls in Source and
compiled JavaScript, against an independent directed80/120 reference. It stays
within the unchanged integer-work cap. The original work-limit failure remains
preserved. That cohort remains pure arithmetic with zero World calls. Later
[shared arithmetic](../../examples/physics-coupled-arithmetic-2276/RESULTS.md),
[private actual World](../../examples/physics-coupled-dynamic-host-2276/CLEAN-RESULTS.md),
[post-impulse rollback/wire](../../examples/physics-coupled-dynamic-host-2276/TRANSACTION-RESULTS.md)
and [desktop Native browser](../../examples/physics-coupled-dynamic-host-viewer-2276/RESULTS.md)
pass their separately frozen gates. Only the original first-cold-one-point
before/at/after profile is qualified. Canonical package schema/caller adoption,
warm/multipoint dynamics and the original eight-box exit remain separate.

| Entry point | Current result | Example |
| --- | --- | --- |
| `@barocss/physics` | One World for selected rigid or fixed visual cloth/fluid model profiles | [3D native-Surface Viewer](../../examples/physics-viewer-scene/README.md) |
| `@barocss/physics/cad-proxy` | Admit a labelled sphere or box proxy from one original CAD Surface; map accepted body poses to Viewer | [CAD proxy scene](../../examples/physics-cad-scene/README.md) |
| `@barocss/physics/replay` | Save and validate one bounded accepted command log | [replay probe](../../examples/physics-scene/replay-probe.mjs) |

Ordinary workspace package imports use `src` through a TypeScript-capable bundler. The complete `publishConfig` map selects compiled `dist` JavaScript/declarations for release. The `barocss-source` condition selects the same current source API and is optional during development. Plain Node does not resolve source internal `.js` imports to `.ts`. CAD Surfaces remain original display geometry; CAD admission creates a separate sphere or box simulation proxy. See the limits below before using any profile.

The rigid public entry is `src/index.ts`. Public model/state types are in `types.ts`; private numerical body records are in `internal-types.ts`; model admission is in `model-admission.ts` and numerical checks are in `validation.ts`; vectors, quaternions and inertia transforms are in `math.ts`; primitive collision and contact response are in `collision.ts`; joint parsing is in `joints.ts`, anchored motor drive is in `joint-motor.ts`, and the two-dynamic-body fixed and hinge profiles are in `dynamic-fixed-joint.ts` and `dynamic-hinge-joint.ts`; CCD admission and sweeps are in `ccd.ts`, `ccd-rounded-box.ts`, `ccd-pair.ts`, `ccd-sphere-pair-exact.ts`, `ccd-box.ts` and `ccd-slab.ts`; optional broad-phase bounds are in `broadphase.ts`; large-scene filtering and contact-island sleep rules are in `scene-profile.ts` and `sleep.ts`; and fixed-step world state is in `world.ts`. `limits.ts` holds shared bounds.

## Fixed visual models

P5b uses the actual root API with complete `PhysicsModel` data and explicit
`WorldOptions`. Source/native full-profile, public-error and docs runtime
qualification are pending; current source implementation is not that proof.

```ts
import { createPhysicsWorld } from '@barocss/physics';
// Local inert example data, not another Physics factory or package subpath.
import { copyPhysicsModelPreset } from './model-data.mjs';

const { model, options } = copyPhysicsModelPreset('cloth-pinned-sphere-visual-v1');
const world = createPhysicsWorld(model, options);
const state = world.step([]);
const positionsM = state.cloths[0].positionsM;
const triangles = world.getModel().cloths[0].triangles;
world.dispose();
```

The [shared model data](../../examples/physics-model-data-2276/model-data.mjs)
contains complete inert public-model fixtures. Copy it beside a standalone
consumer. The same asset is [served with the guide](../../apps/library-docs/docs/public/physics/model-data.mjs).
Each call returns detached data. It does not create a World or run a solver.
Topology and masses are explicit model data; copied Float64Array positions,
velocities and measured diagnostics are in `state.cloths` or `state.fluids`.

| Profile | Fixed numerical scope |
| --- | --- |
| `cloth-pinned-sphere-visual-v1` | Original17×17 sheet,289 vertices,512 triangles,pins0/16, sphere at[0,0.1,0] radius0.3 and offset0.002; eight XPBD substeps ×two iterations;240 host steps. |
| `fluid-basin-visual-v1` | Original256 particles, basin0.7×1.3×0.5m, zero initial velocities and visual unit weights. Existing admitted initial-position variation remains. |
| `fluid-basin-xsph-visual-v1` | Same fluid population with exact XSPH coefficient0.15; no calibrated viscosity claim. |
| `fluid-static-box-visual-v1` | v1 fluid and one static axis-aligned box, original radius-expanded margin/initial-overlap checks; no XSPH or dynamic reaction. |

All use configured1/120s and `broadPhase:'domain-fixed'`. The original smoothing
radius is `1.8 * 0.05`, binary64 `0.09000000000000001`; literal `0.09` differs.
The public initializer first checks complete inert schema/IDs/roles. Cloth
requires exact original rest/topology/masses/ordered constraints. Fluid starts
within strict particle-radius basin margins with the original minimum spacing.
Empty commands advance; unsupported commands/queries refuse. There is no
`step(dt)` overload or World reset. Host reset disposes/recreates an owned World.
One guard/clock prepares candidates and all output before shared commit.
Disposal is idempotent and clears owned runtime references.

Recording is explicitly refused: the222324-byte cloth preset exceeds unchanged
128KiB model cap (`WORLD_LIMIT`); visual fluid recording is unsupported
(`INVALID_SNAPSHOT`). A failed attach leaves the World unowned and unchanged.
The1MiB/512frame/4096command recording limits remain. Fluid size measurements
alone do not qualify wire/restore. No public domain recorder or new codec.

For an optional CAD shelf, `admitCadFluidStaticData` from `./cad-proxy` returns
copied model data and an existing proxy token. The caller runs
`assertCadProxyCurrent(proxy,sourceText,currentRevision)` before each World step.
The numerical root imports no CAD service. This is static box projection, not
exact CAD-surface collision, pressure, two-way coupling or CFD accuracy.

Original physical thresholds/hashes and NO_GO evidence remain unchanged.
The bounded [cloth probe](../../examples/physics-scene/cloth-world-probe.mjs)
reuses the one-time original research raw oracle; no old factory rerun.
[Water](../../examples/physics-scene/fluid-viewer/README.md) and
[CAD shelf](../../examples/physics-scene/fluid-cad-viewer/README.md) hosts remain
separate browser proof. Self-contact, tearing, arbitrary meshes, moving
obstacles and P6 coupling are refused. Full3600-step fluid stability and
fresh-scratch performance are not inferred from P5a two-step parity.

## Upright static-box capsule query

`createUprightCapsuleQuery` is a separate renderer-neutral geometric query, under [CHARACTER-01 #1062](https://github.com/barocss/barocss/issues/1062). It copies a `CapsuleQuerySceneV1` and exposes `sweep`, `getSnapshot` and idempotent `dispose`. It does not step or move a Physics body. Profile `upright-capsule-box-v1`, version1, fixes radius0.15m, centreline half-length0.35m, total height1m and world Y.

```ts
import { createUprightCapsuleQuery, PhysicsError } from '@barocss/physics';
const query = createUprightCapsuleQuery({
  version: 1, profile: 'upright-capsule-box-v1', revision: 'room1',
  boxes: [{ id: 'wall', centerM: [0.5,0.6,0], halfExtentsM: [0.05,1,1], orientationXYZW: [0,0,0,1] }],
});
try {
  const hit = query.sweep({revision:'room1',centerM:[-0.5,0.6,0],displacementM:[2,0,0],excludeId:null});
  // hit?.toiFraction is about0.4. normalFixtureToCapsule is dimensionless.
  // pointM is a box witness; segmentPointM is on the capsule centreline.
} catch (error) {
  if (!(error instanceof PhysicsError)) throw error;
  // code is the stable refusal field.
} finally { query.dispose(); }
```

The scene has0..32static boxes with unique ASCII IDs and an opaque revision matching `[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}`. Box centre components are within±10m; each half extent is0.0001..5m. Original XYZW components are within±1 and quaternion norm within1e-12 of1. Query centre components are within±5m; requested displacement norm is at most2m. Original numbers, signed zeros, source order and IDs are copied; stored quaternions are not normalized. All records have exactly the declared own data fields, all tuples are dense ordinary arrays in the current realm. Extra/symbol/accessor fields, sparse arrays, typed arrays and subclasses refuse.

A hit is `{bodyId,toiFraction,normalFixtureToCapsule,pointM,segmentPointM,iterations}`; otherwise `null`. Normal is the world unit vector from the box to the capsule. Fractions are dimensionless; points are metres. Iterations count only the selected scalar hit, not total work. Exact original geometry may share computation while retaining eligible IDs. Evaluate all eligible groups before returning a hit. Choose global minimum fraction, then lexical ID within1e-9; return that selected hit's own fields. Exclusion is null or one known box ID. No hidden actor or world is created.

Initial contact within1e-12m returns fraction0 even for zero/parallel/away travel. Initial overlap deeper than1e-12m gives `INITIAL_OVERLAP`; this is not depenetration. Scalar cap64/nonprogress gives `ITERATION_LIMIT`; nonfinite/crossed-contact/unresolved-normal gives `NUMERIC_LIMIT`. Invalid scene gives `INVALID_CONFIG`, invalid query `INVALID_QUERY`, well-formed stale revision `STALE_SNAPSHOT`, and disposed queries/snapshots `DISPOSED`. Complete malformed admission precedes semantic revision/exclusion; stale wins over otherwise well-formed unknown exclusion. Dispose wins before inspecting inputs. Refusals yield no partial hit and keep the copied scene unchanged. Returned data and independent query objects cannot alter later results.

The canonical PhysicsError is shared inside each source or compiled package graph through an internal root error bridge. Source and compiled constructors in distinct graphs need not be identical. The compiled root still needs sibling dist/types.js under the existing #1022 build rule. No new subpath or manifest map is added.

See [the full contract](https://github.com/barocss/barocss/wiki/Physics-Upright-Capsule-Query) and `examples/physics-capsule-query-scene` for the31fixed numerical cases,28accepted cost cases, source/compiled public consumers, original-bit decoder and actual browser evidence. Named crowded translations are capacity observations, not a promise that every arbitrary32rotated geometry takes2ms. No controller, dynamic obstacles, arbitrary capsule orientation, exact CAD collision, Viewer scene or physics certification follows.

## Upright capsule controller v1

`createUprightCapsuleController` moves a fixed upright capsule through an immutable
bounded box scene. It uses the existing capsule query. Units are metres, seconds
and metres per second. The capsule radius is 0.15m and centreline half-length is
0.35m. The profile uses world Y, fixed gravity −9.81m/s², a 0.002m skin, a 0.1m
step limit and a 10° walkable slope limit.

```ts
import { createUprightCapsuleController } from '@barocss/physics';
const controller = createUprightCapsuleController({
  version: 1,
  profile: 'upright-capsule-controller-v1',
  scene: {
    version: 1, profile: 'upright-capsule-box-v1', revision: 'scene1',
    boxes: [{ id: 'floor', centerM: [0, -0.05, 0],
      halfExtentsM: [3, 0.05, 1], orientationXYZW: [0, 0, 0, 1] }],
  },
  positionM: [-1, 0.505, 0],
});
const state = controller.step({ dtSeconds: 1 / 120,
  sceneRevision: 'scene1', desiredVelocityMps: [1, 0, 0] });
controller.dispose();
```

The caller supplies the clock and renders accepted `positionM` and
`orientationXYZW`. Each command must use exactly 1/120 second. The request has
zero Y and horizontal speed at most 1m/s. The scene has at most 32 boxes; initial
penetration refuses with `INITIAL_OVERLAP`. After 240 steps, create a new instance
for a new bounded run. This API does not provide moving platforms, dynamic body
pushing, arbitrary terrain, a rendering clock or serialized state restoration.

`getSnapshot()` and `step()` return independent copies of 14 fields. Total
`velocityMps` is the accepted pose change divided by the fixed time, including
lift and snap. `fallVelocityYMps` is the separate gravity recurrence. `support`
and `assist` contain copied query IDs and normals or pending step information.
`queryCount` is the accepted step's query work; it excludes initial admission.

Use `PhysicsError.code`, not message text. Input errors use `INVALID_CONFIG` or
`INVALID_COMMAND`; wrong finite time uses `INVALID_STEP`, stale revision uses
`STALE_SNAPSHOT`, work limits use `WORLD_LIMIT`, and unresolved movement uses
`INVALID_COMMAND`. Query errors preserve their existing codes. Each refusal
preserves all accepted state. Disposal is idempotent; later calls use `DISPOSED`
before input inspection. Records and tuples must be ordinary same-realm data
with exactly the declared fields. Getters and extra fields refuse.

The bounded native verification example is
`examples/physics-character-public-reference`. Its table is numerical evidence.
The actual 3D Viewer consumer is tracked in Issue #1065. Native implementation,
Integration adoption, integrated screen/file checks and publication are separate
states.

## P1b verification boundary

The unreleased root now accepts only `createPhysicsWorld(model,options)`. It returns copied `getModel()` and
`getState()`, `step(commands?)`, tagged `query(input)` and idempotent `dispose()`. Public model/options/state are
separate; no old config converter or compatibility engine remains. A numeric argument to rigid `step` is
`INVALID_COMMAND`. Separate cloth/fluid/reference APIs still have their own time-argument contracts.
The standalone reduced pendulum moved to `examples/physics-planar-pendulum-reference/pendulum.ts`; its preserved
period/energy receipts describe that independent ODE, not a rigid hinge or a current root export.

Selected P1b source/emitted public checks pass 8 tests per graph, the 21 focused probes pass per graph,
5 foundation entries pass 21 tests, native published-map runtime/declarations pass (`native-04`), source mapping
passes (`mapping-02`), and documentation samples pass 174/174. These receipts apply to their named providers.
Documentation build, site checks and scoped links pass. README examples compile and execute in `native-05`. Seven current host callsites bundle with the unbuilt Viewer SDK explicitly external; Viewer/DOM execution remains NOT_RUN. The basic HTTP host startup/bundle/close check passes (`server-01`). See the [slice report](../../examples/physics-world-p1b-2276/README.md) for actual results and provider hashes. Historical numerical
reports remain attributed to their original providers. No Viewer, Studio, hardware or manufacturing HOLD is lifted;
original NO_GO trajectories and first-failure gates remain unchanged. P2 recording ownership has its own selected local source/emitted/native checks. P5 domain
migration remains future work.
