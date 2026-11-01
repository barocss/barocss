// Compile-only positive/negative consumers. No create/step implementation is supplied.
import type { CreatePhysicsWorld, PhysicsModel, PhysicsCommand, CreatePhysicsRecorder,
  RestorePhysicsRecording, SerializePhysicsRecording, DeserializePhysicsRecording, PhysicsWorld, WorldOptions } from './types.js';

export const model = {
  format: 'barocss-physics-model', version: 1, revision: 'fixture1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' },
  gravityMps2: [0, -9.81, 0],
  bodies: [{ id: 'ball', kind: 'dynamic', massKg: 2,
    inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
    initial: { positionM: [0, 2, 0], orientationXYZW: [0, 0, 0, 1],
      velocityMps: [1, 0, 0], angularVelocityRadps: [0, 0, 0] } }],
  colliders: [{ id: 'ballShape', bodyId: 'ball', geometry: { kind: 'sphere', radiusM: 0.1 },
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } }],
  joints: [], cloths: [], fluids: [], sourceBindings: [],
} as const satisfies PhysicsModel;

export function compileConsumer(create: CreatePhysicsWorld, record: CreatePhysicsRecorder,
  restore: RestorePhysicsRecording, serialize: SerializePhysicsRecording, deserialize: DeserializePhysicsRecording): void {
  const world = create(model, { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' });
  const commands = [{ kind: 'force', bodyId: 'ball', forceN: [0, 24, 0] }] as const satisfies readonly PhysicsCommand[];
  world.step(commands);
  world.step();
  const reply = world.query({ kind: 'raycast', originM: [0, 2, -1], direction: [0, 0, 1],
    maxDistanceM: 2, includeSensors: false });
  if (reply.kind === 'raycast' && reply.hit) {
    const distance: number = reply.hit.distanceM;
    void distance;
  }
  const recordedWorld = create(model, { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' });
  const recorder = record(recordedWorld); // Attach at step0, before any recorded step.
  recorder.step([]);
  const saved = deserialize(serialize(recorder.saveRecording()));
  const continued = restore(saved, { model, options: saved.options, providerDigest: saved.identity.providerDigest });
  continued.recorder.dispose();
  continued.world.dispose();
  recorder.dispose();
  recordedWorld.dispose();
  world.dispose();

  // @ts-expect-error raw JSON is not the bit-preserving recording wire format.
  deserialize(JSON.stringify(saved));

  // These are intentionally rejected by the target API. They do not test runtime refusal.
  // @ts-expect-error dt is fixed at creation; a numeric step argument is not a command list.
  world.step(1 / 120);
  // @ts-expect-error no reset compatibility method.
  world.reset();
  // @ts-expect-error no arbitrary public state loading.
  world.setState(world.getState());
  // @ts-expect-error no per-domain clocks or child worlds.
  world.fluid.step();
  // @ts-expect-error force cannot use an impulse field.
  world.step([{ kind: 'force', bodyId: 'ball', impulseNs: [0, 1, 0] }]);
  // @ts-expect-error translational kinematic target has no orientation command.
  world.step([{ kind: 'kinematicTarget', bodyId: 'ball', positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] }]);
  // @ts-expect-error Physics model length is SI metres, not CAD millimetres.
  create({ ...model, units: { ...model.units, length: 'mm' } }, saved.options);
  // @ts-expect-error old single world-config signature is not retained as an overload.
  create({ fixedStepSeconds: 1 / 120, gravityMps2: [0, -9.81, 0], bodies: [] });
  // @ts-expect-error future arbitrary convex geometry is not silently admitted by the schema.
  create({ ...model, colliders: [{ ...model.colliders[0], geometry: { kind: 'convex', points: [] } }] }, saved.options);
  // @ts-expect-error common model is immutable to typed consumers.
  world.getModel().bodies.push(model.bodies[0]);
  // @ts-expect-error queries distinguish overlap results from raycast distance.
  const bad: number = world.query({ kind: 'overlap-sphere', centerM: [0, 0, 0], radiusM: 1, includeSensors: true }).distanceM;
  void bad;
}

// @ts-expect-error large profile requires AABB; no direct-path compatibility fallback.
export const badLarge: WorldOptions = { profile: 'rigid-large-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' };

// Shape-level compatibility is deliberately absent, not just undocumented.
export type HasReset = 'reset' extends keyof PhysicsWorld ? true : false;
export const noReset: HasReset = false;
