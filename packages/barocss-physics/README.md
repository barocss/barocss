# @barocss/physics

A small, renderer-neutral fixed-step 3D dynamics prototype. It simulates dynamic spheres with gravity, linear and angular one-step commands, and normal contact against fixed or explicitly targeted kinematic spheres/axis-aligned boxes. It does not simulate oriented box collision, contact angular impulse, friction, joints, meshes or continuous collision detection.

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

Dynamic spheres also have an optional local-to-world `orientation: [x,y,z,w]` quaternion and `angularVelocityRadps: [x,y,z]`, both in the right-handed world frame. The defaults are identity and zero. The initial quaternion must have unit norm within 1e-6 and is normalized on admission. The isotropic inertia is `2/5 × massKg × radiusM²`; an optional positive `inertiaKgM2` scalar overrides it. Every body state reports copied orientation and angular velocity, and a dynamic body reports inertia. A one-step angular impulse changes angular velocity by `angularImpulseNms/I`; torque adds `torqueNm/I × dt`. The next angular velocity sets an axis-angle delta for this step. Left multiplication applies that delta in world coordinates, then the quaternion is normalized. Angular speed components are limited to ±1000 rad/s and angular displacement to 10 radians per step. Spheres remain rotationally symmetric collision shapes. See [PHYS-04 #767](https://github.com/barocss/barocss/issues/767#issuecomment-6058865060) for the frozen numeric fixture and exclusions.

`state.events` reports `begin`, `stay` and `end` for the last accepted step. Events carry sorted body IDs and `kind:'contact'|'sensor'`. A static or kinematic collider can use `sensor:true`: it reports overlap events with a dynamic sphere but produces no physical contact, impulse or position correction. Initial overlap begins on the first step. The array is copied with state and is retained after a failed step.

`world.overlapSphere({centerM,radiusM,includeSensors?})` returns lexically sorted body IDs. `world.raycast({originM,direction,maxDistanceM,includeSensors?})` returns the nearest `{bodyId,distanceM}` or `null`; direction must be unit length within 1e-9. A ray starting inside a shape reports distance zero. Both queries read the last accepted state; they do not advance the world. Sensor inclusion defaults to true. Query positions are within ±10000 m, radius is 0.0001–1000 m, and ray distance is 0.0001–10000 m. Only spheres and axis-aligned boxes are admitted. Invalid queries use `INVALID_QUERY` and keep accepted state. See [PHYS-03 #766](https://github.com/barocss/barocss/issues/766#issuecomment-6058738723) for the frozen event and query rules.

`PhysicsError.code` identifies `INVALID_CONFIG`, `INVALID_STEP`, `INVALID_COMMAND`, `INVALID_QUERY`, `WORLD_LIMIT`, `NUMERIC_LIMIT` or `DISPOSED`.

Limits: 1–32 bodies, at least one dynamic sphere, 3600 steps, fixed step 1/240–1/30 s. Each position component is within ±10000 m, velocity and gravity components within ±1000 m/s, mass 0.000001–1000000 kg, sphere radius and box half extents 0.0001–1000 m, restitution 0–1. Force and torque components are within ±1000000 N or N·m; linear and angular impulse components are within ±100000 N·s or N·m·s. One step refuses movement or measured penetration above 10 m. Body IDs are unique ASCII identifiers, up to 64 characters, starting with a letter. Contact pairs have ascending IDs; `normalAtoB` points from A to B. See [Issue #751](https://github.com/barocss/barocss/issues/751) for v0 and [PHYS-02 #765](https://github.com/barocss/barocss/issues/765#issuecomment-6058662978) for linear control.

Run `pnpm --filter @barocss/physics build:library` after workspace registration, then `node examples/physics-scene/probe.mjs`, `node examples/physics-scene/controls-probe.mjs`, `node examples/physics-scene/events-queries-probe.mjs`, `node examples/physics-scene/rotation-probe.mjs`, and `node examples/physics-scene/server.mjs`.
