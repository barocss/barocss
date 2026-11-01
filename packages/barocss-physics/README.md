# @barocss/physics

The [library design and development roadmap](ROADMAP.md) defines the unreleased target API and
its staged verification. The rigid root now uses the P0 model/options contract; cloth/fluid common-World migration remains future work. Existing HOLDs,
public admission limits and original NO_GO receipts remain in force.

A bounded, renderer-neutral fixed-step 3D Physics package. Its rigid world simulates admitted sphere, oriented-box and capsule pairs, limited fixed/hinge joints and narrow opt-in CCD profiles. A separate visual-water world simulates one fixed 256-particle basin. A separate cloth world advances one fixed pinned sheet over a static sphere. The caller owns time and display. The package does not simulate exact CAD Surface or mesh collision, general joint networks, arbitrary cloth meshes or engineering fluid flow.

| Entry point | Current result | Example |
| --- | --- | --- |
| `@barocss/physics` | Rigid bodies, contacts, commands, bounded joints and queries | [3D native-Surface Viewer](../../examples/physics-viewer-scene/README.md) |
| `@barocss/physics/cad-proxy` | Admit a labelled sphere or box proxy from one original CAD Surface; map accepted body poses to Viewer | [CAD proxy scene](../../examples/physics-cad-scene/README.md) |
| `@barocss/physics/replay` | Save and validate one bounded accepted command log | [replay probe](../../examples/physics-scene/replay-probe.mjs) |
| `@barocss/physics/fluid` | Simulate and copy 256 visual-water particle positions | [water Viewer scene](../../examples/physics-scene/fluid-viewer/README.md) |
| `@barocss/physics/cloth` | Fixed 289-vertex visual sheet, copied triangle state and numerical diagnostics | [compiled cloth probe](../../examples/physics-scene/cloth-world-probe.mjs); actual Viewer host remains [#981](https://github.com/barocss/barocss/issues/981) |
| `@barocss/physics/fluid-cad` | Admit one static CAD-derived box obstacle for version 1 water | [CAD shelf Viewer scene](../../examples/physics-scene/fluid-cad-viewer/README.md) |

Ordinary workspace package imports use `src` through a TypeScript-capable bundler. The complete `publishConfig` map selects compiled `dist` JavaScript/declarations for release. The `barocss-source` condition selects the same current source API and is optional during development. Plain Node does not resolve source internal `.js` imports to `.ts`. CAD Surfaces remain original display geometry; CAD admission creates a separate sphere or box simulation proxy. See the limits below before using any profile.

The rigid public entry is `src/index.ts`. Public model/state types are in `types.ts`; private numerical body records are in `internal-types.ts`; model admission is in `model-admission.ts` and numerical checks are in `validation.ts`; vectors, quaternions and inertia transforms are in `math.ts`; primitive collision and contact response are in `collision.ts`; joint parsing is in `joints.ts`, anchored motor drive is in `joint-motor.ts`, and the two-dynamic-body fixed and hinge profiles are in `dynamic-fixed-joint.ts` and `dynamic-hinge-joint.ts`; CCD admission and sweeps are in `ccd.ts`, `ccd-pair.ts`, `ccd-box.ts` and `ccd-slab.ts`; optional broad-phase bounds are in `broadphase.ts`; large-scene filtering and contact-island sleep rules are in `scene-profile.ts` and `sleep.ts`; and fixed-step world state is in `world.ts`. `limits.ts` holds shared bounds.

## Bounded visual cloth

`@barocss/physics/cloth` provides one visual profile with 289 vertices, 512 fixed triangles and two pinned back corners. The caller advances time. Create it as follows:

```ts
import { createClothWorld } from '@barocss/physics/cloth';

const world = createClothWorld({
  format: 'barocss-cloth-scene', version: 1, revision: 'sheet-v1',
  basis: 'right-handed-xyz-metres', fixedStepSeconds: 1 / 120,
  profile: 'pinned-sheet-sphere-v1',
});
const frame = world.step(1 / 120);
// frame.positionsM and frame.triangles are independent copies for caller display.
world.reset();
world.dispose();
```

The six input fields are exact own data fields on an object with `Object.prototype`. Null and custom prototypes are refused. A revision is a 1–64 character ASCII identifier starting with a letter. Extra fields, getters, wrong versions, steps or profiles use `INVALID_CONFIG`. The profile fixes a 1 m square XZ sheet at Y=0.55 m, density 0.2 kg/m², gravity `[0,-9.81,0]`, and a static sphere at `[0,0.1,0]` m with radius 0.3 m and collision offset 0.002 m. It uses eight XPBD substeps and two iterations per substep, stretch/shear compliance 0.001 m/N and a second-neighbour bend-distance surrogate at 0.1 m/N. These are visual settings, without fabric calibration.

`getState()`, `step(dt)` and `reset()` return copied Float64 positions/velocities, Uint16 triangle indices and pinned indices, the proxy sphere, step/time and diagnostics. Vertex i stays `z*17+x`; triangle order stays fixed. Diagnostics measure structural extension/compression, vertex-envelope penetration, pin drift and total mass. The collider has simulation identity only. It is not a native CAD Surface. `reset()` restores exact step 0. `dispose()` is idempotent; later reads, resets or steps use `DISPOSED`.

The first profile admits 240 host steps at exactly 1/120 s. A different dt uses `INVALID_STEP`; step 241 uses `WORLD_LIMIT`. Each step commits only finite candidates within ±10 m and ±1000 m/s, structural extension ≤10%, vertex-envelope penetration ≤1e-6 m and exact pins. A violation uses `NUMERIC_LIMIT` and retains the accepted state. Returned data cannot change future simulation. Vertex collision does not guarantee continuous triangle separation: centroid and edge-midpoint sampling of the measured scene has a separate ≤0.002 m display-loss gate. Self-collision, tearing, moving obstacles, arbitrary meshes, command logs and engineering stress are outside this profile.

The implementation separates input admission, fixed profile, topology, constraints, solver, metrics and world lifecycle under `src/cloth/`. Run `pnpm --filter @barocss/physics build:library`, then `node examples/physics-scene/cloth-world-probe.mjs` and `node examples/physics-scene/cloth-source-import-probe.mjs`. The probe compares step 0/60/240 with the preserved [#825 numerical experiment](../../examples/physics-cloth-spike/README.md), checks scalar math and retention, and reports sampled display loss and CPU step cost. [#978](https://github.com/barocss/barocss/issues/978) delivers the numerical API. GPU mesh, Viewer bridge and actual cloth display are separate [#979](https://github.com/barocss/barocss/issues/979), [#980](https://github.com/barocss/barocss/issues/980) and [#981](https://github.com/barocss/barocss/issues/981) gates.

The optional `@barocss/physics/fluid` subpath provides a bounded 3D water-particle world. Version 1 admits exactly 256 initial particles in a 0.7 × 1.3 × 0.5 m static basin, gravity `[0,-9.81,0]`, and a caller-driven 1/120 s step. Version 2 keeps that scene and requires the fixed opt-in field `visualViscosity:{kind:'xsph',coefficient:0.15}`. It blends nearby particle velocities after density projection; version 1 behavior and hashes stay unchanged. Initial centres must stay inside the basin with at least 0.025 m spacing. `createFluidWorld(scene)` returns `step(dt)`, `getState()`, `reset()` and `dispose()`. State contains copied `Float64Array` XYZ metre positions and velocities, stable particle indices, a step count and normalized density diagnostics. The caller owns display and clock. The visual coefficient is not a calibrated material viscosity. No emitter, moving obstacle, rigid coupling or CFD accuracy is claimed. See [FLUID-01 #813](https://github.com/barocss/barocss/issues/813), [FLUID-03 #815](https://github.com/barocss/barocss/issues/815) and the [solver decision](../../examples/physics-fluid-spike/README.md).

The opt-in `@barocss/physics/fluid-cad` subpath binds a version 1 fluid scene to one admitted static box derived from a BaroCAD sourceVersion 0 native Surface. `createCadFluidWorld(scene, sourceText, request)` accepts a static `box` CAD proxy inside the basin, with no initial particle overlap. The obstacle uses the CAD proxy's metre centre and half extents, expanded by the particle radius. `step(dt,{sourceText,currentRevision})` and `reset({sourceText,currentRevision})` check the exact source text and revision before changing state. A stale source throws `STALE_SOURCE` and retains the last accepted state. `getObstacle()` returns copied source identity, body ID, box dimensions and the approximation label. State adds per-step `obstacleHits`; this is a projection count, not a force or pressure. The first profile admits one fixed axis-aligned box and version 1 water only. It does not resolve the exact CAD Surface, swept thin features, moving obstacles or v2 visual settling together with CAD. See [FLUID-04 #816](https://github.com/barocss/barocss/issues/816) and the [CAD water example](../../examples/physics-scene/fluid-cad-viewer/README.md).

The bounded fluid neighbor grid uses reusable numeric cell arrays for the declared basin and two sampled floor layers. It visits cells and particle indices in the same order as the original string-key grid, so the frozen v1, v2 and CAD shelf position hashes stay unchanged. The measured browser playback and its machine limits are recorded in [FLUID-05a #871](https://github.com/barocss/barocss/issues/871) and the [playback evidence](../../examples/physics-scene/evidence/fluid-871-playback-2026-10-09.md). This is an implementation speedup for the admitted 256-particle profile, not a higher particle-count or browser-wide performance promise.

The optional `@barocss/physics/cad-proxy` subpath admits one selected BaroCAD sourceVersion 0 native Surface from an exact source string. Its modules separate native admission, input validation, copied binding types and Viewer pose mapping. It depends on the public `@barocss/cad` compiler. `admitCadSurfaceProxy(source, request)` creates a qualified `part:<model>.<surface>` or `fixture:<model>.<surface>` Physics body from the original Surface control-net bounds in right-handed XYZ millimetres. A sphere encloses the control-net AABB; a box uses its axis-aligned half-spans plus a declared minimum half-extent. The result reports the original IDs, source revision, source center and a shape-loss label. It emits separate `body:RigidBody`, `collider:Collider` and `binding:SourceBinding` values for the corresponding model arrays. Position input is `body.initial.positionM`; collision geometry is `collider.geometry`. The binding contains numerical entity IDs, occurrence/model IDs, source revision/digest and approximation metadata. Exact source text and bounds remain in the adapter. Accepted body states use `orientationXYZW`. Native rational Surface weights are positive under the CAD compiler profile, so the control net is a conservative envelope; this is not exact Surface collision. Dynamic bodies need explicit mass and may declare a starting offset. Body lengths convert by 0.001 to metres. `assertCadProxyCurrent` compares both the complete source string and caller revision. A change throws `STALE_SOURCE` until explicit re-admission. `cadProxyPose` checks that binding and maps an accepted Physics body pose back to Viewer millimetres, including rotation about the source center. The host owns world replacement and Viewer frame application. See [PHYS-10 #773](https://github.com/barocss/barocss/issues/773#issuecomment-6060408936) and the [native Viewer consumer](../../examples/physics-cad-scene/README.md).

The optional `@barocss/physics/replay` subpath records accepted commands on an existing common World.
Call `createPhysicsRecorder(world)` before the first step. The recorder supplies `step(commands?)`, `getState()`,
`saveRecording()` and `dispose()`. While attached, direct or cached `world.step` calls and a second attachment
refuse with `WORLD_OWNED`. World reads and queries remain available. Recorder disposal detaches it; the caller must
also dispose the World. Disposal releases the recorder's recording/options references; it makes no claim about
garbage-collection timing or out-of-memory recovery. World disposal invalidates its recorder. An advanced World cannot start a new recording.

`saveRecording()` returns copied model/options/identity, consecutive 1-based command frames and final state.
Restore with `restorePhysicsRecording(recording,{model,options,providerDigest})`; take the expected provider digest
from the intended current World's `getState().identity.providerDigest`. Source revisions remain in model
`sourceBindings`. Restore validates the complete bounded recording before expected identity, reconstructs an isolated
World, compares final state at the existing `1e-12` absolute/relative gate, and returns `{world,recorder}`.
The next command frame and log budgets are checked before candidate calculation. The final state, returned copy
and complete recording encoding are prepared before the nonthrowing shared physical/log commit.
Changed identity gives `STALE_SNAPSHOT`; damaged data gives `INVALID_SNAPSHOT`. Dispose both returned objects.

Persist recordings with `serializePhysicsRecording(recording):Uint8Array` and read them with
`deserializePhysicsRecording(bytes)`. The wire format is ASCII `BCPHREC1` plus P0 canonical typed bytes; it preserves
binary64 signed zero. There is no JSON or old-schema migration reader. Limits remain 512 frames and 4096 commands;
the canonical model is at most 128 KiB and recording bytes, including magic, at most 1 MiB. Object key order does not
change identity. Reconstruction does not import arbitrary state or promise bitwise cross-platform trajectories.
P2_DONE_LOCALSELECTED: public source05/emitted05 each pass11/11; test-only preparation faults each pass15/15.
Native03 passes actual published maps, strict positive/negative declarations, the shared registry, CAD release
consumer and four README blocks. See the [P2 report](../../examples/physics-world-p2-2276/README.md) for providers,
commands, first failures and final check status. Whole-engine acceptance remains NO_GO.

[PHYS-12 #775](https://github.com/barocss/barocss/issues/775#issuecomment-6060693170) defines the first release-candidate gate for this 3D profile. The default `node examples/physics-scene/release-gate.mjs <report-path>` is a bounded prototype checkpoint: frozen offline setup, CAD and Physics builds, and one compiled Surface proxy flow. The host checks the actual Viewer flow separately. Explicit `--full` runs all five library builds, eleven compiled probes, numeric/workload criteria and the independent offline packed-package consumer on the declared macOS 15.6.1 arm64, Node 22.22.0, pnpm 10.11.0 profile. This broader validation is a separate scheduled phase. The [native full report](../../examples/physics-scene/evidence/release-gate-native-2026-10-08.json) and [merged-base preflight](../../examples/physics-scene/evidence/release-gate-merged-preflight-2026-10-08.md) are measured evidence, not Integration-owned release acceptance. No mode sets `releaseCandidate:true`, publishes a package or certifies professional engineering use.

The host owns time and rendering. Physics uses metres, kilograms and seconds. Convert Viewer/CAD millimetres at the host boundary.

```ts
import { createPhysicsWorld } from '@barocss/physics';

const dt = 1 / 120;
const model = {
  format: 'barocss-physics-model', version: 1, revision: 'example1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' }, gravityMps2: [0, -9.81, 0],
  bodies: [
    { id: 'part:ball', kind: 'dynamic', massKg: 1,
      inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
      initial: { positionM: [0, 2, 0], orientationXYZW: [0, 0, 0, 1],
        velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] } },
    { id: 'fixture:floor', kind: 'static',
      initial: { positionM: [0, 0.2, 0], orientationXYZW: [0, 0, 0, 1] } },
  ],
  colliders: [
    { id: 'ball.shape', bodyId: 'part:ball', geometry: { kind: 'sphere', radiusM: 0.15 },
      local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
      material: { restitution: 0.25, friction: { static: 0, dynamic: 0 } },
      sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } },
    { id: 'floor.shape', bodyId: 'fixture:floor', geometry: { kind: 'box', halfExtentsM: [1, 0.2, 1] },
      local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
      material: { restitution: 0.25, friction: { static: 0, dynamic: 0 } },
      sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } },
  ], joints: [], cloths: [], fluids: [], sourceBindings: [],
} satisfies import('@barocss/physics').PhysicsModel;
const world = createPhysicsWorld(model,
  { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' });
const state = world.step(); // Exactly one configured step, with no hidden clock.
console.log(state.bodies, state.contacts, state.identity);
world.step([{ kind: 'force', bodyId: 'part:ball', forceN: [0, 2, 0] }]);
world.step([{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 0.5, 0] }]);
world.dispose();
```

`step(commands?)` accepts at most 64 dense, plain-object commands per step: `{kind:'force',bodyId,forceN}`, `{kind:'impulse',bodyId,impulseNs}`, `{kind:'torque',bodyId,torqueNm}`, `{kind:'angularImpulse',bodyId,angularImpulseNms}`, or `{kind:'kinematicTarget',bodyId,positionM}`. Each body may receive one command of each applicable kind per step. Force and torque act for one step; impulses change velocity once. A kinematic body has `kind:'kinematic'` and an explicit `initial` transform; its collider supplies sphere/box geometry and material. It has no mass or input velocity. A target is an absolute metre position for this step; the reported velocity is target movement divided by `dt`. Without a new target it holds position and reports zero velocity. Only dynamic bodies receive force, impulse, torque or angular impulse. Kinematic bodies contact dynamic spheres but do not respond to impulses. Static/kinematic pairs are not reported.

Commands are validated before a candidate step. Dynamic integration applies impulse, then gravity and force, then position; collision resolution follows. Input order does not change the result. `getState()` and `step()` return copies. A failed step leaves the world at its last accepted state.

Bodies declare a local-to-world `initial.orientationXYZW:[x,y,z,w]`. Dynamic bodies also declare
`initial.angularVelocityRadps` and linear velocity explicitly. The model is copied before numerical normalization;
`getModel()` retains original input numbers, including signed zero. The initial runtime quaternion must have norm
within 1e-6 of one and is normalized for state. Dynamic inertia is explicit: `primitive-com` derives sphere inertia
`2*m*r²/5`, box COM diagonal `m/3*[hy²+hz²,hx²+hz²,hx²+hy²]` or the labelled isotropic capsule proxy
`2*m*(radiusM+halfLengthM)²/5`. A sphere-only `sphere-isotropic` record can supply positive `kgM2` instead.
Both forms declare `about:'com'` and `frame:'body-local'`. State reports orientation and angular velocity; inertia
and collider geometry remain model data. World-frame torque and angular impulse use the transformed inverse
inertia. Quaternion advancement and the existing ±1000 rad/s component and 10 rad/step guards remain unchanged.

A capsule's segment lies on its local Y axis from `-halfLengthM` to `+halfLengthM`, with radius `radiusM` around it. All shape lengths are 0.0001–1000 m. The admitted pair families are sphere/sphere, sphere/oriented-box, sphere/capsule, oriented-box/oriented-box, capsule/oriented-box and capsule/capsule. Capsule/box finds the closest capsule-axis point to the oriented box; capsule/capsule finds closest points on their two axes. Coincident axes use a deterministic ID-based fallback normal. Box/box uses a deterministic 15-axis separating-axis check and one approximate support-midpoint contact point. Contact state reports a copied world-metre `pointM`. The solver uses velocity at that point, including `ω×r`, and applies equal/opposite linear and angular normal impulses. Position correction remains translational. This is a one-point manifold and does not establish stable capsule stacks or exact compound-capsule inertia. Sensors use the same admitted shape pairs without impulse. Sphere overlap and ray queries read oriented boxes and capsules as well. See [RIGID-00 #819](https://github.com/barocss/barocss/issues/819).

For the one-point box/box contact, a support axis perpendicular to the chosen normal uses the face centre on that axis. This removes the arbitrary far-corner torque in a symmetric box-on-floor fixture. It does not provide a multi-point manifold or guarantee stable off-centre stacks. See [RIGID-00a #848](https://github.com/barocss/barocss/issues/848).

Any body may declare optional `friction:{static,dynamic}` coefficients with `0 <= dynamic <= static <= 2`; both default to zero. A pair combines matching coefficients by geometric mean. After each normal impulse, the solver evaluates tangential velocity at the point, including angular velocity. It cancels slip when the required impulse fits within `μ_static × normalImpulse`; otherwise it applies at most `μ_dynamic × normalImpulse` opposite slip. Each physical contact reports a copied, accumulated world-vector `tangentImpulseNs`. There is no impulse cache, warm start or persistent static constraint. The fixed sphere stack probe establishes only its recorded 240-step drift/penetration bounds. See [PHYS-06 #769](https://github.com/barocss/barocss/issues/769#issuecomment-6059055828) for the frozen fixture and limits.

The options profile `profile:'rigid-persistent-box-v1'` admits at most four bodies. For a box/box contact with a face normal, it clips the incident face to the reference face, keeps up to four deterministic contact points, and reuses their bounded accumulated normal and friction impulses on the next accepted fixed step. It reports one copied contact summary per body pair. Edge/edge and non-box contacts keep the one-point path. The default world path retains the earlier one-point behavior. This mode establishes the recorded centred and 0.05 m offset stack fixtures only; it does not guarantee arbitrary tilted stacks, high-speed impacts or engineering loads. See [RIGID-01 #820](https://github.com/barocss/barocss/issues/820).

The options profile `profile:'rigid-large-v1'` admits 1–64 bodies with `broadPhase:'aabb'`; it excludes joints, CCD and `persistent-box-v1`. Each collider declares `filter:{categoryBits,maskBits}` with integer 16-bit values (category 1–65535, mask 0–65535). For unfiltered collision, supply category 1 and mask 65535. Both bodies must admit each other's category for a contact or sensor event. Filters are fixed at world creation. Dynamic states expose copied `sleeping` booleans. A supported dynamic contact island sleeps after 60 consecutive steps with all linear and angular speeds at most 0.02 in SI units. Static and kinematic fixtures support islands but do not join separate dynamic groups. Nonzero force/impulse/torque, contact with an awake dynamic body and moving kinematic support wake affected bodies. Sleeping contacts still report events. The 63-sphere floor fixture proves this bounded profile; it does not establish arbitrary 64-body stack stability, a broad collision matrix at this scale or a general speedup. See [RIGID-02 #821](https://github.com/barocss/barocss/issues/821) and `examples/physics-scene/large-scene-probe.mjs`.

Model `joints` records connect one static/kinematic A body to one uniquely jointed dynamic B body. At most eight dense fixed/hinge records use `bodyAId`/`bodyBId`, qualified IDs and body-local `anchorALocalM`/`anchorBLocalM` in metres; the initial world anchors must coincide within 1e-6 m. A fixed joint preserves the initial relative orientation and common anchor. A hinge declares a unit `axisWorld` and a `limitRad:[min,max]` within ±π/2 including zero. It allows only signed twist about that axis from B's initial orientation and clamps at the limits. Joint projection runs after each contact pass; a connected A/B collision pair is disabled. State reports copied per-step `joints` with linear and angular reaction impulses, plus hinge angle. Reactions are the dynamic B velocity corrections caused by this bounded projection solver. They are not certified mechanical loads. See [PHYS-07 #770](https://github.com/barocss/barocss/issues/770#issuecomment-6059121440) for the first anchored profile.

One `fixed` joint may instead connect exactly two dynamic spheres and no other bodies or joints. The solver distributes anchor and orientation corrections by inverse mass/inertia and disables contact between the connected bodies. The first measured fixture is two 1 kg spheres separated by 0.2 m under one 0.2 N·s impulse; its native and Viewer checks are in `examples/physics-scene/dynamic-fixed-pair-probe.mjs` and `examples/physics-viewer-scene/joint-demo.html`. Joint state reports the impulse on B; the equal/opposite A correction is checked in the fixture. Other mass ratios, large rotations and complex contact networks are not accepted performance or accuracy profiles. This dynamic pair has no motor, break force, cycle or CAD-authored assembly constraint. See [RIGID-04 #823](https://github.com/barocss/barocss/issues/823#issuecomment-6072507713).

An anchored `hinge` may declare `motor:{targetSpeedRadps,maxImpulseNms,maxReactionNms}`. The target speed is within ±2 rad/s; the per-step motor impulse cap is positive and at most 0.05 N·m·s; the per-step constraint reaction cap is positive and at most 1 N·m·s. The motor impulse is reported separately as `motorImpulseNms`. The motor stops pushing outward at a hinge limit. A constraint reaction above the configured cap fails the step with `NUMERIC_LIMIT` and keeps the last accepted state. This is a refusal bound, not a break-force model. The first fixture uses one static anchor, one 1 kg sphere, zero gravity, 1/120 s steps and a +Z hinge; see `examples/physics-scene/hinge-motor-probe.mjs` and `examples/physics-viewer-scene/motor-demo.html`.

One `hinge` may instead connect exactly two dynamic spheres at the same centre. This planar profile requires zero gravity, zero initial motion, identity initial orientations and zero local anchors. Only angular commands along the hinge axis are admitted. Its optional motor drives the relative speed of B against A with equal and opposite impulses; the reaction cap retains the last accepted state on overload. A measured pair of 1 kg, 0.1 m spheres reaches opposite ±0.25 rad/s at step 10 and 0.48125 rad relative angle at step 120. See `examples/physics-scene/dynamic-hinge-motor-probe.mjs` and `examples/physics-viewer-scene/dynamic-hinge-demo.html`. Offset anchors, gravity, linear commands, off-axis motion, multi-joint assemblies and calibrated break laws are outside this profile.

One separate offset-hinge profile connects exactly two 1 kg dynamic spheres with 0.1 m radius. Their initial centres are `[-0.1,0,0]` and `[0.1,0,0]` m; local anchors `[0.1,0,0]` and `[-0.1,0,0]` m meet at one pivot. It admits one planar +Z hinge with `limitRad:[-0.8,0.8]`, a motor targeting 0.5 rad/s relative speed with 0.0001 N·m·s motor impulse and 0.01 N·m·s reaction caps, zero gravity and no linear or off-axis commands. The caller steps at 1/120 s. Joint state copies the reaction on B; a reaction above `maxReactionNms` refuses the candidate and retains the accepted world and Viewer frame. That cap is a numeric limit, not a material break strength. At step 120 the measured relative angle is 0.4809513021838483 rad. The [numeric probe](../../examples/physics-scene/offset-hinge-probe.mjs), [Viewer demo](../../examples/physics-viewer-scene/offset-hinge-demo.html?step=120) and [#939 merged receipt](https://github.com/barocss/barocss/issues/939#issuecomment-6077079018) cover this one fixture. Other mass ratios, nonzero gravity, arbitrary offset axes, multiple joints, exact CAD collision and calibrated loads remain outside it.

Set `ccd:true` on a dynamic sphere's collider to prevent it from crossing a thin static box in one step. The first opt-in profile admits exactly one dynamic sphere, 1–8 static nonsensor oriented boxes, and no joints or other bodies. The sphere center sweeps through each box-local axis-aligned bound expanded by its radius. The earliest entry fraction wins, with fixture ID breaking equal-fraction ties. The candidate stops at the entry point with a 1e-9 m inward offset so the discrete contact solver can respond. An initial center inside an expanded box uses the discrete solver. Expanded-box corners can conservatively report a hit before exact sphere/box contact. See [PHYS-08 #771](https://github.com/barocss/barocss/issues/771#issuecomment-6059234992) for that profile.

A second opt-in CCD profile admits exactly two nonsensor dynamic spheres, exactly one marked `ccd:true`, zero gravity and no joints. It sweeps their relative centres and stops both at the first entry, with a total inward offset of 1e-9 m so the discrete contact solver can respond. The reported `colliderId` names the **other dynamic sphere's collider**, and `normalFixtureToBody` points from it to the marked sphere. Initial overlap/touch and a missing entry use the discrete solver. See [RIGID-05 #824](https://github.com/barocss/barocss/issues/824) and `examples/physics-scene/ccd-pair-probe.mjs`.

A third opt-in CCD profile admits exactly one dynamic axis-aligned box marked `ccd:true` and one static nonsensor axis-aligned box, with no joints or `persistent-box-v1`. It sweeps the dynamic centre against the static bounds expanded by both half-extents, then stops at first entry with a 1e-9 m inward offset. Initial overlap and no-entry motion use the discrete solver. A nonzero angular command fails before stepping; if contact creates rotation, that candidate fails and the last accepted state remains. This profile fixes the named 0.002 m-thick CAD Surface proxy fixture, not arbitrary tilted or moving boxes. All CCD profiles report copied `{bodyId,colliderId,toiFraction,normalFixtureToBody}` records and stop without integrating the remaining fraction of the step. Other CCD configurations refuse creation; `ccd:false` retains the discrete solver. Capsule sweeps, general oriented-box CCD and more than two dynamic CCD bodies are unsupported. See [RIGID-05a #864](https://github.com/barocss/barocss/issues/864) and `examples/physics-scene/thin-box-ccd-probe.mjs`.

Options `broadPhase:'aabb'` filters the existing eligible pair list before narrow-phase detection. Supply `broadPhase:'direct'` for the original direct pair path. Bounds enclose spheres by radius, oriented boxes by projected half-extents, and oriented capsules by radius plus projected local-Y half-segment. They are updated from each moving body at the start of every solver pass and immediately after its contact correction; static bounds are reused during that step. Intervals overlap inclusively with 1e-9 m slack. `state.pairStats` is a copied per-step `{eligiblePairs,candidatePairs,aabbTests}` count across eight passes. Direct mode has candidatePairs equal to eligiblePairs and zero AABB tests. AABB mode reports one test for each eligible pair; candidatePairs counts narrow-phase calls. The initial state has zeros, and failed steps retain the prior counts. The fixed 32-body/120-step compiled fixture reduced candidate calls from 29,760 to 960 with matching recorded contacts and poses. Its one-machine wall time and heap-use change are observations, not general performance or allocation guarantees. The direct option remains available for contact cascades outside that fixture. In `large-v1`, layer filtering removes pairs before these counts, and sleeping pairs are checked on the first pass but can skip later passes; `aabbTests` can therefore be lower than `eligiblePairs`. See [PHYS-09 #772](https://github.com/barocss/barocss/issues/772#issuecomment-6060293632) for the frozen contract.

`state.events` reports `begin`, `stay` and `end` for the last accepted step. Events carry collider IDs and `kind:'contact'|'sensor'`. A static or kinematic collider can use `sensor:true`: it reports overlap events with a dynamic sphere but produces no physical contact, impulse or position correction. Initial overlap begins on the first step. The array is copied with state and is retained after a failed step.

`world.query({kind:'overlap-sphere',centerM,radiusM,includeSensors})` returns
`{kind:'overlap-sphere',colliderIds}`. `world.query({kind:'raycast',originM,direction,maxDistanceM,includeSensors})`
returns `{kind:'raycast',hit:null|{bodyId,colliderId,distanceM}}`. Direction must have unit norm within 1e-9;
an inside ray reports distance zero. Queries read accepted state without advancing. Supply `includeSensors`
explicitly. Query positions remain within ±10000 m, sphere radius 0.0001–1000 m, ray distance 0.0001–10000 m.
Invalid queries give `INVALID_QUERY` and retain accepted state.

`PhysicsError.code` identifies `INVALID_CONFIG`, `INVALID_STEP`, `INVALID_COMMAND`, `INVALID_QUERY`, `INVALID_SNAPSHOT`, `STALE_SOURCE`, `STALE_SNAPSHOT`, `WORLD_LIMIT`, `NUMERIC_LIMIT`, `WORLD_OWNED` or `DISPOSED`. The separate upright capsule query also uses `INITIAL_OVERLAP` and `ITERATION_LIMIT`.

The root, `/cloth`, `/fluid` and `/fluid-cad` export the same `PhysicsError`
constructor within one installed package instance. A caller can catch a genuine
subpath error with the root error class. This does not guarantee identity across
separate package versions, realms or independently built consumer bundles.
The compiled root is an ESM bundle that imports sibling `dist/types.js`.
The root also imports `dist/provider-manifest.generated.js`; its digest describes the actual emitted provider graph. Keep both files beside `dist/index.js` when serving the compiled root directly.
Existing bundled browser hosts resolve the sibling during their bundle step.

Limits: 1–32 bodies in `rigid-discrete-v1` or 1–64 in `rigid-large-v1`, at least one dynamic body, 3600 steps, fixed step 1/240–1/30 s. Each position component is within ±10000 m, velocity and gravity components within ±1000 m/s, mass 0.000001–1000000 kg, sphere radius and box half extents 0.0001–1000 m, restitution 0–1. Force and torque components are within ±1000000 N or N·m; linear and angular impulse components are within ±100000 N·s or N·m·s. One step refuses movement or measured penetration above 10 m. Body IDs are unique ASCII identifiers, up to 64 characters, starting with a letter. Contact pairs have ascending IDs; `normalAtoB` points from A to B. See [Issue #751](https://github.com/barocss/barocss/issues/751) for v0 and [PHYS-02 #765](https://github.com/barocss/barocss/issues/765#issuecomment-6058662978) for linear control.

Workspace defaults resolve the root, `/cad-proxy`, `/replay`, `/fluid`, `/fluid-cad` and `/cloth` to `src/*.ts` without a source condition. Browser examples may also bundle source directly. Published entries use the complete `publishConfig` dist map. Explicit compiled checkpoints must resolve transitive own imports from those published maps. See the [shared source consumer](../../examples/workspace-source/README.md) for source-only and compiled-only commands, cache reuse and edit invalidation.

Run `node examples/physics-scene/server.mjs` to view the existing basic source scene. It refreshes the source provider manifest before its startup build. The shared workspace-source host also refreshes before source rebuilds. For the current compiled checkpoint, build Physics and use the shared `compiled-probe.mjs`, which resolves transitive own dependencies from published maps. Older numerical/release probe commands retain their original compiled-default manifest scope and need explicit compiled entry resolution before replay under this convention; historical receipts are unchanged.

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
