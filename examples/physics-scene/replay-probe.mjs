import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';
import { createPhysicsRecorder, restorePhysicsRecording, serializePhysicsRecording, deserializePhysicsRecording } from '../../packages/barocss-physics/dist/replay.js';

const dt = 1 / 120;
const body = (id, kind, positionM) => kind === 'dynamic'
  ? { id, kind, initial: { positionM, orientationXYZW: [0, 0, 0, 1],
    velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] }, massKg: 1,
    inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' } }
  : { id, kind, initial: { positionM, orientationXYZW: [0, 0, 0, 1] } };
const collider = (bodyId, geometry) => ({ id: `${bodyId}:collider`, bodyId, geometry,
  local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
  material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
  sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } });
const options = { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' };
const model = { format: 'barocss-physics-model', version: 1, revision: 'replayModel1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' }, gravityMps2: [0, -9.81, 0],
  bodies: [body('part:ball', 'dynamic', [0, 1.2, 0]), body('fixture:floor', 'static', [0, 0, 0])],
  colliders: [collider('part:ball', { kind: 'sphere', radiusM: 0.1 }),
    collider('fixture:floor', { kind: 'box', halfExtentsM: [1, 0.5, 1] })],
  joints: [], cloths: [], fluids: [], sourceBindings: [] };
model.sourceBindings = [{ id: 'source:ball', sourceRevision: 'rev1', sourceDigest: 'sha256:' + '1'.repeat(64),
  modelId: 'replayModel', occurrenceId: 'ball', entityIds: ['part:ball', 'part:ball:collider'],
  approximation: { kind: 'control-net-sphere', lossLabel: 'bounded replay fixture' } }];
const world = createPhysicsWorld(model, options);
const session = createPhysicsRecorder(world);
const expected = { model, options, providerDigest: world.getState().identity.providerDigest };
const first = session.step([{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 0.5, 0] }]);
assert.equal(first.stepIndex, 1);
const beforeInvalid = JSON.stringify(session.getState());
const beforeFrames = session.saveRecording().frames.length;
assert.throws(() => session.step([{ kind: 'impulse', bodyId: 'missing', impulseNs: [0, 1, 0] }]),
  (error) => error instanceof PhysicsError && error.code === 'INVALID_COMMAND');
assert.equal(JSON.stringify(session.getState()), beforeInvalid);
assert.equal(session.saveRecording().frames.length, beforeFrames);
let contacts = 0;
for (let index = 1; index < 150; index++) {
  const state = session.step();
  if (state.contacts.length) contacts++;
}
assert.ok(contacts > 0);
const recording = session.saveRecording();
assert.equal(recording.finalState.stepIndex, 150);
assert.equal(recording.finalState.timeSeconds, 150 * dt);
assert.equal(recording.frames.length, 150);
assert.equal(recording.frames[0].commands[0].kind, 'impulse');
assert.equal(recording.frames[1].commands.length, 0);
const encoded = serializePhysicsRecording(recording);
const parsed = deserializePhysicsRecording(encoded);
const restoredPair = restorePhysicsRecording(parsed, expected);
const restored = restoredPair.recorder;
assert.deepEqual(restored.getState(), session.getState());
assert.deepEqual(restored.step(), session.step());
const modelCopy = session.saveRecording();
modelCopy.model.bodies[0].initial.positionM[1] = 999;
assert.equal(session.saveRecording().model.bodies[0].initial.positionM[1], 1.2);
const savedCopy = session.saveRecording();
savedCopy.frames[0].commands[0].impulseNs[1] = 99;
assert.equal(session.saveRecording().frames[0].commands[0].impulseNs[1], 0.5);

const refuses = (action, code) => assert.throws(action,
  (error) => error instanceof PhysicsError && error.code === code);
const negativeZeroModel = { ...model, gravityMps2: [-0, -9.81, 0] };
const negativeZeroWorld = createPhysicsWorld(negativeZeroModel, options);
const negativeZeroSession = createPhysicsRecorder(negativeZeroWorld);
const signedZeroBytes = serializePhysicsRecording(negativeZeroSession.saveRecording());
assert.equal(Buffer.from(signedZeroBytes.subarray(0, 8)).toString('ascii'), 'BCPHREC1');
assert.ok(Object.is(deserializePhysicsRecording(signedZeroBytes).model.gravityMps2[0], -0));
refuses(() => deserializePhysicsRecording(Buffer.from(JSON.stringify(recording))), 'INVALID_SNAPSHOT');
refuses(() => deserializePhysicsRecording(signedZeroBytes.subarray(0, -1)), 'INVALID_SNAPSHOT');
refuses(() => deserializePhysicsRecording(Uint8Array.from([...signedZeroBytes, 0])), 'INVALID_SNAPSHOT');
negativeZeroSession.dispose(); negativeZeroWorld.dispose();
refuses(() => restorePhysicsRecording(parsed, { ...expected, model: { ...model, revision: 'changed' } }), 'STALE_SNAPSHOT');
const staleSourceModel = { ...model, sourceBindings: model.sourceBindings.map(binding => ({ ...binding, sourceRevision: 'rev2' })) };
refuses(() => restorePhysicsRecording(parsed, { ...expected, model: staleSourceModel }), 'STALE_SNAPSHOT');
refuses(() => restorePhysicsRecording(parsed, { ...expected, providerDigest: 'sha256:' + '0'.repeat(64) }), 'STALE_SNAPSHOT');
refuses(() => restorePhysicsRecording({ ...parsed, version: 2 }, expected), 'INVALID_SNAPSHOT');
const damagedState = structuredClone(parsed);
damagedState.finalState.stepIndex++;
refuses(() => restorePhysicsRecording(damagedState, expected), 'INVALID_SNAPSHOT');
const damagedCommand = structuredClone(parsed);
damagedCommand.frames.at(-1).commands = [{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 1, 0] }];
refuses(() => restorePhysicsRecording(damagedCommand, expected), 'INVALID_SNAPSHOT');
const sparse = structuredClone(parsed);
delete sparse.frames[3];
refuses(() => restorePhysicsRecording(sparse, expected), 'INVALID_SNAPSHOT');
refuses(() => createPhysicsWorld({ ...model, gravityMps2: [0, NaN, 0] }, options), 'INVALID_CONFIG');
assert.deepEqual(restored.getState(), session.getState(), 'failed restore changed accepted session');

const jointModel = ({ ...model, revision: 'jointModel1', sourceBindings: [],
  bodies: [body('fixture:anchor', 'static', [0, 0, 0]), body('part:held', 'dynamic', [0, 0, 0])],
  colliders: [collider('fixture:anchor', { kind: 'sphere', radiusM: 0.1 }),
    collider('part:held', { kind: 'sphere', radiusM: 0.1 })],
  joints: [{ id: 'joint:fixed', kind: 'fixed', bodyAId: 'fixture:anchor', bodyBId: 'part:held',
    anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0] }] });
const jointWorld = createPhysicsWorld(jointModel, options);
const jointSession = createPhysicsRecorder(jointWorld);
jointSession.step();
jointSession.step();
const jointRestoredPair = restorePhysicsRecording(deserializePhysicsRecording(serializePhysicsRecording(jointSession.saveRecording())),
  { model: jointModel, options, providerDigest: jointWorld.getState().identity.providerDigest });
const jointRestored = jointRestoredPair.recorder;
assert.deepEqual(jointRestored.getState(), jointSession.getState());
const jointReactionY = jointRestored.getState().joints[0].linearImpulseOnBNs[1];
assert.ok(jointReactionY > 0);

const limitedModel = ({ ...model, revision: 'limitModel1', sourceBindings: [], gravityMps2: [0, 0, 0],
  bodies: [body('part:idle', 'dynamic', [0, 0, 0])],
  colliders: [collider('part:idle', { kind: 'sphere', radiusM: 0.1 })] });
const limitedWorld = createPhysicsWorld(limitedModel, options);
const limited = createPhysicsRecorder(limitedWorld);
for (let index = 0; index < 512; index++) limited.step();
const atLimit = JSON.stringify(limited.getState());
refuses(() => limited.step(), 'WORLD_LIMIT');
assert.equal(JSON.stringify(limited.getState()), atLimit);
assert.equal(limited.saveRecording().frames.length, 512);

session.dispose(); restored.dispose(); jointSession.dispose(); jointRestored.dispose(); limited.dispose();
world.dispose(); restoredPair.world.dispose(); jointWorld.dispose(); jointRestoredPair.world.dispose(); limitedWorld.dispose();
refuses(() => session.getState(), 'DISPOSED');
console.log(JSON.stringify({ result: 'ok', replayedSteps: 150, contactSteps: contacts,
  finalY: recording.finalState.bodies[0].positionM[1], jointReactionY,
  staleAndDamagedRefused: true, failedStepRetained: true, recordingLimitRetained: true }));
