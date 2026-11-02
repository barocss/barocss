import { createPhysicsWorld, PhysicsError, type PhysicsModel, type WorldOptions,
  type PhysicsCommand, type PhysicsState, type Recording } from '@barocss/physics';
import { createPhysicsRecorder, restorePhysicsRecording, serializePhysicsRecording,
  deserializePhysicsRecording, type PhysicsRecorder } from '@barocss/physics/replay';
import * as Replay from '@barocss/physics/replay';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function refuses(code: string, operation: () => unknown): void {
  try { operation(); } catch (error) {
    assert(error instanceof PhysicsError && error.code === code, `expected ${code}`); return;
  }
  throw new Error(`missing ${code}`);
}
function same(left: PhysicsState, right: PhysicsState): void {
  assert(JSON.stringify(left) === JSON.stringify(right), 'accepted state differs');
}
const model = {
  format: 'barocss-physics-model', version: 1, revision: 'nativeP2',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' },
  gravityMps2: [-0, 0, 0],
  bodies: [{ id: 'ball', kind: 'dynamic', massKg: 1,
    inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
    initial: { positionM: [-0, 2, 0], orientationXYZW: [-0, 0, 0, 1],
      velocityMps: [-0, 0, 0], angularVelocityRadps: [0, 0, 0] } }],
  colliders: [{ id: 'ball.shape', bodyId: 'ball', geometry: { kind: 'sphere', radiusM: 0.1 },
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } }],
  joints: [], cloths: [], fluids: [], sourceBindings: [],
} satisfies PhysicsModel;
const options = { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' } satisfies WorldOptions;
for (const old of ['createPhysicsScene','createPhysicsReplaySession','restorePhysicsReplaySession',
  'serializePhysicsSnapshot','deserializePhysicsSnapshot']) {
  assert(!Object.hasOwn(Replay, old), `retired replay export ${old}`);
}
const world = createPhysicsWorld(model, options), cachedStep = world.step;
const recorder: PhysicsRecorder = createPhysicsRecorder(world);
const expected = { model, options, providerDigest: world.getState().identity.providerDigest };
try {
  const zero: Recording = deserializePhysicsRecording(serializePhysicsRecording(recorder.saveRecording()));
  assert(Object.is(zero.model.gravityMps2[0], -0), 'model signed zero lost');
  assert(Object.is(zero.finalState.bodies[0].positionM[0], -0), 'state signed zero lost');
  refuses('WORLD_OWNED', () => cachedStep());
  refuses('WORLD_OWNED', () => createPhysicsRecorder(world));
  assert(world.getModel().revision === model.revision, 'owned model read failed');
  assert(world.query({ kind: 'overlap-sphere', centerM: [0, 2, 0], radiusM: .2,
    includeSensors: false }).kind === 'overlap-sphere', 'owned query failed');
  const commands: readonly PhysicsCommand[] = [{ kind: 'impulse', bodyId: 'ball', impulseNs: [1, -0, 0] }];
  recorder.step(commands);
  const log = deserializePhysicsRecording(serializePhysicsRecording(recorder.saveRecording()));
  const command = log.frames[0].commands[0];
  assert(command.kind === 'impulse' && Object.is(command.impulseNs[1], -0), 'command signed zero lost');
  assert(log.frames[0].stepIndex === 1, 'frame cursor differs');
  const restored = restorePhysicsRecording(log, expected);
  try {
    same(restored.recorder.getState(), recorder.getState());
    same(restored.recorder.step(), recorder.step());
    refuses('WORLD_OWNED', () => restored.world.step());
    restored.world.dispose();
    refuses('DISPOSED', () => restored.recorder.step());
  } finally { restored.recorder.dispose(); restored.world.dispose(); }
  recorder.dispose(); recorder.dispose();
  refuses('DISPOSED', () => recorder.saveRecording());
  assert(cachedStep().stepIndex === 3, 'detach did not release advancing ownership');
  refuses('INVALID_SNAPSHOT', () => createPhysicsRecorder(world));
} finally { recorder.dispose(); world.dispose(); world.dispose(); }
const fresh = createPhysicsWorld(model, options), first = createPhysicsRecorder(fresh);
first.dispose();
const second = createPhysicsRecorder(fresh);
fresh.dispose();
refuses('DISPOSED', () => second.getState());
second.dispose(); second.dispose();
console.log(JSON.stringify({ result: 'PASS', providerDigest: expected.providerDigest,
  nativePackageImports: ['@barocss/physics', '@barocss/physics/replay'],
  ownership: true, sharedRegistry: true, restoreContinuation: true, signedZero: true }));
