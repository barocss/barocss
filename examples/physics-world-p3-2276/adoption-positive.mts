// Compile-only consumer of the actual emitted public declarations. Never execute.
import { createPhysicsWorld } from '../../packages/barocss-physics/dist/index.js';
import type { PhysicsModel, WorldOptions, PhysicsWorld, CreatePhysicsWorld } from '../../packages/barocss-physics/dist/index.js';
const ids = ['pairA0', 'pairB0', 'pairA1', 'pairB1'] as const;
const positions = [[-.1, 0, 0], [.1, 0, 0], [-.1, 0, 1], [.1, 0, 1]] as const;
export const model: PhysicsModel = {
  format: 'barocss-physics-model', version: 1, revision: 'p3-original-f401',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' }, gravityMps2: [0, 0, 0],
  bodies: ids.map((id, i) => ({ id, kind: 'dynamic' as const, massKg: 1,
    inertia: { kind: 'primitive-com' as const, about: 'com' as const, frame: 'body-local' as const },
    initial: { positionM: positions[i], orientationXYZW: [0, 0, 0, 1] as const,
      velocityMps: [0, 0, 0] as const, angularVelocityRadps: [0, 0, 0] as const } })),
  colliders: ids.map(id => ({ id: id + '.shape', bodyId: id, geometry: { kind: 'sphere' as const, radiusM: .1 },
    local: { positionM: [0, 0, 0] as const, orientationXYZW: [0, 0, 0, 1] as const },
    material: { restitution: 0, friction: { static: 1, dynamic: .7 } }, sensor: false, ccd: false,
    filter: { categoryBits: 1, maskBits: 65535 } })),
  joints: [0, 1].map(i => ({ id: 'hinge' + i, kind: 'hinge' as const, bodyAId: ids[2 * i], bodyBId: ids[2 * i + 1],
    anchorALocalM: [.1, 0, 0] as const, anchorBLocalM: [-.1, 0, 0] as const, axisWorld: [0, 0, 1] as const,
    limitRad: [-.8, .8] as const, motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01 } })),
  cloths: [], fluids: [], sourceBindings: [],
};
export const options: WorldOptions = { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' };
export const factory: CreatePhysicsWorld = createPhysicsWorld;
export function compileOnlyConsumer(create: CreatePhysicsWorld): PhysicsWorld { return create(model, options); }
