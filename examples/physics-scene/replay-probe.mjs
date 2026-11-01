import assert from 'node:assert/strict';
import { PhysicsError } from '../../packages/barocss-physics/dist/index.js';
import { createPhysicsScene, createPhysicsReplaySession, restorePhysicsReplaySession, serializePhysicsSnapshot, deserializePhysicsSnapshot } from '../../packages/barocss-physics/dist/replay.js';

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
const scene = createPhysicsScene(model, options, { revision: 'scene1', sourceRevision: 'rev1' });
const session = createPhysicsReplaySession(scene);
const first = session.step([{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 0.5, 0] }]);
assert.equal(first.stepIndex, 1);
const beforeInvalid = JSON.stringify(session.getState());
const beforeFrames = session.saveSnapshot().frames.length;
assert.throws(() => session.step([{ kind: 'impulse', bodyId: 'missing', impulseNs: [0, 1, 0] }]),
  (error) => error instanceof PhysicsError && error.code === 'INVALID_COMMAND');
assert.equal(JSON.stringify(session.getState()), beforeInvalid);
assert.equal(session.saveSnapshot().frames.length, beforeFrames);
let contacts = 0;
for (let index = 1; index < 150; index++) {
  const state = session.step();
  if (state.contacts.length) contacts++;
}
assert.ok(contacts > 0);
const snapshot = session.saveSnapshot();
assert.equal(snapshot.finalState.stepIndex, 150);
assert.equal(snapshot.finalState.timeSeconds, 150 * dt);
assert.equal(snapshot.frames.length, 150);
assert.equal(snapshot.frames[0].commands[0].kind, 'impulse');
assert.equal(snapshot.frames[1].commands.length, 0);
const encoded = serializePhysicsSnapshot(snapshot);
const parsed = deserializePhysicsSnapshot(encoded);
const sameScene = { sourceRevision: scene.sourceRevision, model: scene.model, options: scene.options, identity: scene.identity,
  revision: scene.revision, version: 1, format: scene.format };
const restored = restorePhysicsReplaySession(parsed, sameScene);
assert.deepEqual(restored.getState(), session.getState());
assert.deepEqual(restored.step(), session.step());
const sceneCopy = session.getScene();
sceneCopy.model.bodies[0].initial.positionM[1] = 999;
assert.equal(session.getScene().model.bodies[0].initial.positionM[1], 1.2);
const savedCopy = session.saveSnapshot();
savedCopy.frames[0].commands[0].impulseNs[1] = 99;
assert.equal(session.saveSnapshot().frames[0].commands[0].impulseNs[1], 0.5);

const refuses = (action, code) => assert.throws(action,
  (error) => error instanceof PhysicsError && error.code === code);
const negativeZeroScene = createPhysicsScene({ ...model, gravityMps2: [-0, -9.81, 0] }, options,
  { revision: 'signedZero1', sourceRevision: null });
const negativeZeroSession = createPhysicsReplaySession(negativeZeroScene);
const signedZeroBytes = serializePhysicsSnapshot(negativeZeroSession.saveSnapshot());
assert.equal(Buffer.from(signedZeroBytes.subarray(0, 8)).toString('ascii'), 'BCPHSNP1');
assert.ok(Object.is(deserializePhysicsSnapshot(signedZeroBytes).scene.model.gravityMps2[0], -0));
refuses(() => deserializePhysicsSnapshot(Buffer.from(JSON.stringify(snapshot))), 'INVALID_SNAPSHOT');
refuses(() => deserializePhysicsSnapshot(signedZeroBytes.subarray(0, -1)), 'INVALID_SNAPSHOT');
refuses(() => deserializePhysicsSnapshot(Uint8Array.from([...signedZeroBytes, 0])), 'INVALID_SNAPSHOT');
negativeZeroSession.dispose();
const staleRevision = createPhysicsScene(model, options, { revision: 'scene2', sourceRevision: 'rev1' });
const staleSource = createPhysicsScene(model, options, { revision: 'scene1', sourceRevision: 'rev2' });
refuses(() => restorePhysicsReplaySession(parsed, staleRevision), 'STALE_SNAPSHOT');
refuses(() => restorePhysicsReplaySession(parsed, staleSource), 'STALE_SNAPSHOT');
refuses(() => restorePhysicsReplaySession({ ...parsed, version: 2 }, scene), 'INVALID_SNAPSHOT');
const damagedState = structuredClone(parsed);
damagedState.finalState.stepIndex++;
refuses(() => restorePhysicsReplaySession(damagedState, scene), 'INVALID_SNAPSHOT');
const damagedCommand = structuredClone(parsed);
damagedCommand.frames.at(-1).commands = [{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 1, 0] }];
refuses(() => restorePhysicsReplaySession(damagedCommand, scene), 'INVALID_SNAPSHOT');
const sparse = structuredClone(parsed);
delete sparse.frames[3];
refuses(() => restorePhysicsReplaySession(sparse, scene), 'INVALID_SNAPSHOT');
refuses(() => createPhysicsScene({ ...model, gravityMps2: [0, NaN, 0] }, options,
  { revision: 'bad', sourceRevision: null }), 'INVALID_CONFIG');
assert.deepEqual(restored.getState(), session.getState(), 'failed restore changed accepted session');

const jointScene = createPhysicsScene({ ...model, revision: 'jointModel1',
  bodies: [body('fixture:anchor', 'static', [0, 0, 0]), body('part:held', 'dynamic', [0, 0, 0])],
  colliders: [collider('fixture:anchor', { kind: 'sphere', radiusM: 0.1 }),
    collider('part:held', { kind: 'sphere', radiusM: 0.1 })],
  joints: [{ id: 'joint:fixed', kind: 'fixed', bodyAId: 'fixture:anchor', bodyBId: 'part:held',
    anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0] }] }, options,
{ revision: 'joint1', sourceRevision: null });
const jointSession = createPhysicsReplaySession(jointScene);
jointSession.step();
jointSession.step();
const jointRestored = restorePhysicsReplaySession(deserializePhysicsSnapshot(serializePhysicsSnapshot(jointSession.saveSnapshot())), jointScene);
assert.deepEqual(jointRestored.getState(), jointSession.getState());
const jointReactionY = jointRestored.getState().joints[0].linearImpulseOnBNs[1];
assert.ok(jointReactionY > 0);

const limitedScene = createPhysicsScene({ ...model, revision: 'limitModel1', gravityMps2: [0, 0, 0],
  bodies: [body('part:idle', 'dynamic', [0, 0, 0])],
  colliders: [collider('part:idle', { kind: 'sphere', radiusM: 0.1 })] }, options,
{ revision: 'limit1', sourceRevision: null });
const limited = createPhysicsReplaySession(limitedScene);
for (let index = 0; index < 512; index++) limited.step();
const atLimit = JSON.stringify(limited.getState());
refuses(() => limited.step(), 'WORLD_LIMIT');
assert.equal(JSON.stringify(limited.getState()), atLimit);
assert.equal(limited.saveSnapshot().frames.length, 512);

session.dispose(); restored.dispose(); jointSession.dispose(); jointRestored.dispose(); limited.dispose();
refuses(() => session.getState(), 'DISPOSED');
console.log(JSON.stringify({ result: 'ok', replayedSteps: 150, contactSteps: contacts,
  finalY: snapshot.finalState.bodies[0].positionM[1], jointReactionY,
  staleAndDamagedRefused: true, failedStepRetained: true, recordingLimitRetained: true }));
