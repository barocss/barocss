# @barocss/physics

A small, renderer-neutral fixed-step 3D dynamics prototype. It simulates translating spheres with gravity, one-step forces and impulses, and normal contact against fixed or explicitly targeted kinematic spheres/axis-aligned boxes. It does not simulate rotation, friction, joints, meshes or continuous collision detection.

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

`step(dt, commands)` accepts at most 64 dense, plain-object commands per step: `{kind:'force',bodyId,forceN}`, `{kind:'impulse',bodyId,impulseNs}`, or `{kind:'kinematicTarget',bodyId,positionM}`. Each body may receive one command of each applicable kind per step. Force acts for one step; impulse changes velocity once. A kinematic body has `kind:'kinematic'`, a sphere or box shape, position and restitution but no mass or input velocity. A target is an absolute metre position for this step; the reported velocity is target movement divided by `dt`. Without a new target it holds position and reports zero velocity. Only dynamic bodies receive force/impulse. Kinematic bodies contact dynamic spheres but do not respond to impulses. Static/kinematic pairs are not reported.

Commands are validated before a candidate step. Dynamic integration applies impulse, then gravity and force, then position; collision resolution follows. Input order does not change the result. `getState()` and `step()` return copies. A failed step leaves the world at its last accepted state. `PhysicsError.code` identifies `INVALID_CONFIG`, `INVALID_STEP`, `INVALID_COMMAND`, `WORLD_LIMIT`, `NUMERIC_LIMIT` or `DISPOSED`.

Limits: 1–32 bodies, at least one dynamic sphere, 3600 steps, fixed step 1/240–1/30 s. Each position component is within ±10000 m, velocity and gravity components within ±1000 m/s, mass 0.000001–1000000 kg, sphere radius and box half extents 0.0001–1000 m, restitution 0–1. Force components are within ±1000000 N; impulse components are within ±100000 N·s. One step refuses movement or measured penetration above 10 m. Body IDs are unique ASCII identifiers, up to 64 characters, starting with a letter. Contact pairs have ascending IDs; `normalAtoB` points from A to B. See [Issue #751](https://github.com/barocss/barocss/issues/751) for v0 and [PHYS-02 #765](https://github.com/barocss/barocss/issues/765#issuecomment-6058662978) for this extension.

Run `pnpm --filter @barocss/physics build:library` after workspace registration, then `node examples/physics-scene/probe.mjs`, `node examples/physics-scene/controls-probe.mjs`, and `node examples/physics-scene/server.mjs`.
