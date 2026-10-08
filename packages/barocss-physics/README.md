# @barocss/physics

A small, renderer-neutral fixed-step 3D dynamics prototype. It simulates dynamic spheres, oriented boxes and capsules with gravity, one-step linear/angular commands, normal contact and bounded point friction. The admitted contact matrix supports sphere/sphere, sphere/oriented-box, sphere/capsule and oriented-box/oriented-box. It does not simulate capsule/box or capsule/capsule pairs, joints, meshes or continuous collision detection.

The host owns time and rendering. Physics uses metres, kilograms and seconds. Convert Viewer/CAD millimetres at the host boundary.

```ts
import { createPhysicsWorld } from '@barocss/physics';

const dt = 1 / 120;
const world = createPhysicsWorld({
  fixedStepSeconds: dt,
  gravityMps2: [0, -9.81, 0],
  bodies: [
    { id: 'part:ball', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.15 },
      positionM: [0, 2, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0.25 },
    { id: 'fixture:floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [1, 0.2, 1] },
      positionM: [0, 0.2, 0], restitution: 0.25 },
  ],
});

const state = world.step(dt); // One caller-requested fixed step, no hidden clock.
console.log(state.bodies, state.contacts);
world.step(dt, [{ kind: 'force', bodyId: 'part:ball', forceN: [0, 2, 0] }]);
world.step(dt, [{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 0.5, 0] }]);
world.dispose();
```

`step(dt, commands)` accepts at most 64 dense, plain-object commands per step: `{kind:'force',bodyId,forceN}`, `{kind:'impulse',bodyId,impulseNs}`, `{kind:'torque',bodyId,torqueNm}`, `{kind:'angularImpulse',bodyId,angularImpulseNms}`, or `{kind:'kinematicTarget',bodyId,positionM}`. Each body may receive one command of each applicable kind per step. Force and torque act for one step; impulses change velocity once. A kinematic body has `kind:'kinematic'`, a sphere or box shape, position and restitution but no mass or input velocity. A target is an absolute metre position for this step; the reported velocity is target movement divided by `dt`. Without a new target it holds position and reports zero velocity. Only dynamic bodies receive force, impulse, torque or angular impulse. Kinematic bodies contact dynamic spheres but do not respond to impulses. Static/kinematic pairs are not reported.

Commands are validated before a candidate step. Dynamic integration applies impulse, then gravity and force, then position; collision resolution follows. Input order does not change the result. `getState()` and `step()` return copies. A failed step leaves the world at its last accepted state.

Dynamic bodies have an optional local-to-world `orientation: [x,y,z,w]` quaternion and `angularVelocityRadps: [x,y,z]`, both in the right-handed world frame. The defaults are identity and zero. Static/kinematic bodies can declare a fixed orientation but do not rotate during a step. The initial quaternion must have unit norm within 1e-6 and is normalized on admission. Sphere inertia is `2/5 × massKg × radiusM²`; an optional positive `inertiaKgM2` scalar overrides it for spheres only. A solid box uses local diagonal inertia `massKg/3 × [hy²+hz²,hx²+hz²,hx²+hy²]`. A capsule uses a labelled isotropic proxy inertia `2/5 × massKg × (radiusM+halfLengthM)²`. Every body state reports copied orientation and angular velocity; a dynamic body reports its scalar or diagonal inertia. World-frame torque and angular impulse use the orientation-transformed inverse inertia. The next angular velocity sets an axis-angle delta for this step. Left multiplication applies that delta in world coordinates, then the quaternion is normalized. Angular speed components are limited to ±1000 rad/s and angular displacement to 10 radians per step. See [PHYS-04 #767](https://github.com/barocss/barocss/issues/767#issuecomment-6058865060) and [PHYS-05 #768](https://github.com/barocss/barocss/issues/768#issuecomment-6058939158) for frozen fixtures and exclusions.

A capsule's segment lies on its local Y axis from `-halfLengthM` to `+halfLengthM`, with radius `radiusM` around it. All shape lengths are 0.0001–1000 m. Only these pair families are admitted: sphere/sphere, sphere/oriented-box, sphere/capsule and oriented-box/oriented-box. An eligible capsule/box or capsule/capsule pair refuses world creation with `INVALID_CONFIG`, even when initially separated. Box/box uses a deterministic 15-axis separating-axis check and one approximate support-midpoint contact point. Contact state reports a copied world-metre `pointM`. The solver uses velocity at that point, including `ω×r`, and applies equal/opposite linear and angular normal impulses. Position correction remains translational. This is a one-point manifold and does not establish stacked-box stability or exact compound-capsule inertia. Sensors use the same admitted shape pairs without impulse. Sphere overlap and ray queries now read oriented boxes and capsules as well.

Any body may declare optional `friction:{static,dynamic}` coefficients with `0 <= dynamic <= static <= 2`; both default to zero. A pair combines matching coefficients by geometric mean. After each normal impulse, the solver evaluates tangential velocity at the point, including angular velocity. It cancels slip when the required impulse fits within `μ_static × normalImpulse`; otherwise it applies at most `μ_dynamic × normalImpulse` opposite slip. Each physical contact reports a copied, accumulated world-vector `tangentImpulseNs`. There is no impulse cache, warm start or persistent static constraint. The fixed sphere stack probe establishes only its recorded 240-step drift/penetration bounds. See [PHYS-06 #769](https://github.com/barocss/barocss/issues/769#issuecomment-6059055828) for the frozen fixture and limits.

`state.events` reports `begin`, `stay` and `end` for the last accepted step. Events carry sorted body IDs and `kind:'contact'|'sensor'`. A static or kinematic collider can use `sensor:true`: it reports overlap events with a dynamic sphere but produces no physical contact, impulse or position correction. Initial overlap begins on the first step. The array is copied with state and is retained after a failed step.

`world.overlapSphere({centerM,radiusM,includeSensors?})` returns lexically sorted body IDs. `world.raycast({originM,direction,maxDistanceM,includeSensors?})` returns the nearest `{bodyId,distanceM}` or `null`; direction must be unit length within 1e-9. A ray starting inside a shape reports distance zero. Both queries read the last accepted state; they do not advance the world. Sensor inclusion defaults to true. Query positions are within ±10000 m, radius is 0.0001–1000 m, and ray distance is 0.0001–10000 m. Spheres, oriented boxes and capsules are admitted. Invalid queries use `INVALID_QUERY` and keep accepted state. See [PHYS-03 #766](https://github.com/barocss/barocss/issues/766#issuecomment-6058738723) for the original event and query rules.

`PhysicsError.code` identifies `INVALID_CONFIG`, `INVALID_STEP`, `INVALID_COMMAND`, `INVALID_QUERY`, `WORLD_LIMIT`, `NUMERIC_LIMIT` or `DISPOSED`.

Limits: 1–32 bodies, at least one dynamic sphere, 3600 steps, fixed step 1/240–1/30 s. Each position component is within ±10000 m, velocity and gravity components within ±1000 m/s, mass 0.000001–1000000 kg, sphere radius and box half extents 0.0001–1000 m, restitution 0–1. Force and torque components are within ±1000000 N or N·m; linear and angular impulse components are within ±100000 N·s or N·m·s. One step refuses movement or measured penetration above 10 m. Body IDs are unique ASCII identifiers, up to 64 characters, starting with a letter. Contact pairs have ascending IDs; `normalAtoB` points from A to B. See [Issue #751](https://github.com/barocss/barocss/issues/751) for v0 and [PHYS-02 #765](https://github.com/barocss/barocss/issues/765#issuecomment-6058662978) for linear control.

Run `pnpm --filter @barocss/physics build:library` after workspace registration, then `node examples/physics-scene/probe.mjs`, `node examples/physics-scene/controls-probe.mjs`, `node examples/physics-scene/events-queries-probe.mjs`, `node examples/physics-scene/rotation-probe.mjs`, `node examples/physics-scene/oriented-colliders-probe.mjs`, `node examples/physics-scene/friction-stack-probe.mjs`, and `node examples/physics-scene/server.mjs`.
