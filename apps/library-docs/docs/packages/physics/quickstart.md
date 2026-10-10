# Advance one fixed rigid step

Bundle these ordinary imports with the existing workspace source runner. This example creates a dynamic sphere and static floor, then advances one step.

```ts
import { createPhysicsWorld } from '@barocss/physics';

const dt = 1 / 120;
const world = createPhysicsWorld({
  fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [
    { id: 'part:ball', kind: 'dynamic',
      shape: { kind: 'sphere', radiusM: 0.15 },
      positionM: [0, 2, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0.25 },
    { id: 'fixture:floor', kind: 'static',
      shape: { kind: 'box', halfExtentsM: [1, 0.2, 1] },
      positionM: [0, 0.2, 0], restitution: 0.25 },
  ],
});
try {
  const state = world.step(dt);
  console.log(state.bodies, state.contacts);
} finally {
  world.dispose();
}
```

`step` returns copied accepted state. It does not schedule another frame or mutate Viewer. If a step refuses, retain the last accepted world state and report the stable `PhysicsError.code`. Use the same configured step size; do not pass a variable browser frame delta directly.

For display, map accepted body poses through the supported host bridge. Convert metres to millimetres only once when passing CAD/Viewer pose data. See [CAD proxies](./guides#admit-a-cad-proxy).

`packages/barocss-physics/package.json` (Manifest and version; local source) · `packages/barocss-physics/README.md` (Package task notes; local source)
