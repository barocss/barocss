import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import type { PhysicsModel, PhysicsWorld } from '@barocss/physics';

// Native Node consumer of emitted declarations and root. Reduced ODE proofs live in pendulum.test.ts.
const model: PhysicsModel = { format: 'barocss-physics-model', version: 1, revision: 'publicConsumer1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' }, gravityMps2: [0, 0, 0],
  bodies: [{ id: 'sphere', kind: 'dynamic', massKg: 1,
    inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
    initial: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1],
      velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] } }],
  colliders: [{ id: 'sphere.shape', bodyId: 'sphere', geometry: { kind: 'sphere', radiusM: 0.1 },
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } }, sensor: false, ccd: false,
    filter: { categoryBits: 1, maskBits: 65535 } }], joints: [], cloths: [], fluids: [], sourceBindings: [] };
const world: PhysicsWorld = createPhysicsWorld(model,
  { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' });
assert.equal(world.step().stepIndex, 1);
world.dispose(); world.dispose();
assert.throws(() => world.getState(), (error: unknown) => error instanceof PhysicsError && error.code === 'DISPOSED');
console.log(JSON.stringify({ publicSpecifier: '@barocss/physics', emittedDeclarations: true,
  nativeNodeResolution: true, worldUnchanged: true, reducedPendulum: 'independent-reference-test' }));
