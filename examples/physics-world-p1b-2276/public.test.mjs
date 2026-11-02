import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as Physics from '@barocss/physics';
import { createPhysicsScene, createPhysicsReplaySession, restorePhysicsReplaySession,
  serializePhysicsSnapshot, deserializePhysicsSnapshot } from '@barocss/physics/replay';
import { admitCadSurfaceProxy, cadProxyPose } from '@barocss/physics/cad-proxy';
import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
import { canonicalEncode, digest, sha256 } from '../../packages/barocss-physics/src/identity.js';

const dt = 1 / 120;
const options = { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' };
const sphere = (id = 'ball', positionM = [0, 2, 0], velocityMps = [0, 0, 0], massKg = 2) =>
  dynamicPart(id, { kind: 'sphere', radiusM: 0.2 }, { positionM, velocityMps }, massKg);
const model = (parts = [sphere()], gravityMps2 = [0, -9.81, 0]) => makeModel({ parts, gravityMps2 });
const code = expected => error => error instanceof Physics.PhysicsError && error.code === expected;
const near = (a, b, tolerance) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} vs ${b}, tolerance${tolerance}`);
const clone = value => structuredClone(value);

test('one target creation/step/query API; removed forms fail without fallback', () => {
  assert.equal(Physics.createPlanarPendulum, undefined);
  assert.throws(() => Physics.createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, 0, 0], bodies: [] }), code('INVALID_CONFIG'));
  const world = Physics.createPhysicsWorld(model(), options);
  try {
    for (const name of ['reset', 'setState', 'raycast', 'overlapSphere']) assert.equal(world[name], undefined);
    const initial = world.getState();
    assert.throws(() => world.step(dt), code('INVALID_COMMAND'));
    assert.deepEqual(world.getState(), initial);
    assert.equal(world.step().stepIndex, 1);
    const hit = world.query({ kind: 'raycast', originM: [0, 2, -1], direction: [0, 0, 1], maxDistanceM: 2, includeSensors: true });
    assert.equal(hit.kind, 'raycast'); assert.equal(hit.hit.bodyId, 'ball'); assert.equal(hit.hit.colliderId, 'ball.shape');
    assert.throws(() => world.query(null), code('INVALID_QUERY'));
    assert.throws(() => world.query({ kind: 'particles', includeSensors: true }), code('INVALID_QUERY'));
  } finally { world.dispose(); }
});

test('model/state copies, identity and typed refused-step continuation', () => {
  const input = model(), world = Physics.createPhysicsWorld(input, options), control = Physics.createPhysicsWorld(clone(input), options);
  try {
    const initial = world.getState();
    assert.match(initial.identity.modelDigest, /^sha256:[a-f0-9]{64}$/);
    assert.match(initial.identity.providerDigest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(initial.identity.modelDigest, digest(input));
    assert.equal(initial.identity.configurationDigest, digest(options));
    input.bodies[0].initial.positionM[0] = 99;
    const copiedModel = world.getModel(); copiedModel.colliders[0].geometry.radiusM = 9;
    assert.equal(world.getModel().colliders[0].geometry.radiusM, 0.2);
    const copy = world.getState(); copy.bodies[0].orientationXYZW[3] = 0; copy.identity.frameId = 'tampered';
    assert.deepEqual(world.getState(), initial);
    assert.throws(() => world.step([{ kind: 'impulse', bodyId: 'missing', impulseNs: [1, 0, 0] }]), error => {
      assert.ok(code('INVALID_COMMAND')(error)); assert.equal(error.details.operation, 'step');
      assert.deepEqual(error.details.accepted, { stepIndex: 0, timeSeconds: 0 }); return true;
    });
    assert.throws(() => world.step([{ kind: 'impulse', bodyId: 'ball', impulseNs: [100000, 0, 0] }]), code('NUMERIC_LIMIT'));
    assert.deepEqual(world.getState(), initial);
    for (let i = 0; i < 20; i++) assert.deepEqual(world.step(), control.step());
    world.dispose(); world.dispose();
    for (const read of [() => world.getModel(), () => world.getState(), () => world.step(), () => world.query(null)]) assert.throws(read, code('DISPOSED'));
  } finally { world.dispose(); control.dispose(); }
});

test('strict units, dense data, entity ownership and unchanged bounded admission', () => {
  const bad = mutate => { const input = model(); mutate(input); assert.throws(() => Physics.createPhysicsWorld(input, options), code('INVALID_CONFIG')); };
  bad(m => { m.units.length = 'mm'; });
  bad(m => { m.bodies[0].massKg = 0; });
  bad(m => { m.colliders[0].bodyId = 'unknown'; });
  bad(m => { m.colliders[0].id = m.bodies[0].id; });
  bad(m => { m.colliders.push(clone(m.colliders[0])); });
  bad(m => { m.colliders[0].local.positionM = [0.001, 0, 0]; });
  bad(m => { m.colliders[0].material.friction = { static: 1 }; });
  bad(m => { m.bodies[0].initial.velocityMps = [NaN, 0, 0]; });
  bad(m => { m.bodies[0].initial.positionM = new Float64Array([0, 2, 0]); });
  bad(m => { delete m.bodies[0].initial.positionM[0]; });
  let getterCalls = 0;
  bad(m => { Object.defineProperty(m, 'gravityMps2', { enumerable: true, get() { getterCalls++; return [0, 0, 0]; } }); });
  assert.equal(getterCalls, 0);
  const five = model(Array.from({ length: 5 }, (_, i) => sphere(`b${i}`, [i, 2, 0])));
  assert.throws(() => Physics.createPhysicsWorld(five, { ...options, profile: 'rigid-persistent-box-v1' }), code('INVALID_CONFIG'));
  assert.throws(() => Physics.createPhysicsWorld(model(), { ...options, profile: 'rigid-large-v1' }), code('INVALID_CONFIG'));
  assert.throws(() => Physics.createPhysicsWorld(model(), { ...options, profile: 'cloth-pinned-sphere-visual-v1', broadPhase: 'domain-fixed' }), code('INVALID_CONFIG'));
});

test('ballistic analytical convergence and force/impulse units retain original gates', t => {
  const errors = [60, 120, 240].map(hz => {
    const world = Physics.createPhysicsWorld(model(), { ...options, fixedStepSeconds: 1 / hz });
    try {
      let state;
      for (let i = 0; i < hz; i++) state = world.step();
      near(state.bodies[0].velocityMps[1], -9.81, 1e-11);
      const errorM = Math.abs(state.bodies[0].positionM[1] - (2 - 4.905));
      assert.ok(errorM < 0.083); return errorM;
    } finally { world.dispose(); }
  });
  const ratios = [errors[0] / errors[1], errors[1] / errors[2]];
  for (const ratio of ratios) assert.ok(ratio >= 1.99 && ratio <= 2.01);
  const world = Physics.createPhysicsWorld(model([sphere()], [0, 0, 0]), options);
  try {
    const first = world.step([{ kind: 'impulse', bodyId: 'ball', impulseNs: [2, 0, 0] },
      { kind: 'force', bodyId: 'ball', forceN: [0, 24, 0] }]);
    near(first.bodies[0].velocityMps[0], 1, 1e-12); near(first.bodies[0].velocityMps[1], 0.1, 1e-12);
    assert.deepEqual(world.step().bodies[0].velocityMps, first.bodies[0].velocityMps);
  } finally { world.dispose(); }
  t.diagnostic(JSON.stringify({ metric: 'p1b-ballistic', errorsM: errors, refinementRatios: ratios }));
});

test('canonical typed encoding matches frozen bytes and independent platform SHA-256', () => {
  const vectors = JSON.parse(readFileSync(new URL('../../packages/barocss-physics/design/p0/encoding-vectors.json', import.meta.url)));
  const values = [0, -0, 1, 'µ', [0, -0], [-0, 0], { b: 1, a: 0 }];
  for (let i = 0; i < values.length; i++) {
    const encoded = canonicalEncode(values[i]);
    assert.equal(Buffer.from(encoded).toString('hex'), vectors.vectors[i].encodedHex);
    assert.equal(sha256(encoded), vectors.vectors[i].expectedSha256);
    assert.equal(sha256(encoded), `sha256:${createHash('sha256').update(encoded).digest('hex')}`);
  }
  for (const n of [0, 1, 55, 56, 63, 64, 65, 255, 4096]) {
    const data = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 255);
    assert.equal(sha256(data), `sha256:${createHash('sha256').update(data).digest('hex')}`);
  }
  assert.notEqual(digest(0), digest(-0));
  assert.equal(digest({ b: 1, a: 0 }), digest({ a: 0, b: 1 }));
});

test('replay uses the same root model/options and bit-preserving wire without migration', () => {
  const input = model(); input.bodies[0].initial.velocityMps[0] = -0;
  const scene = createPhysicsScene(input, options, { revision: 'scene1', sourceRevision: null });
  const session = createPhysicsReplaySession(scene);
  let restored;
  try {
    assert.ok(Object.is(session.getScene().model.bodies[0].initial.velocityMps[0], -0));
    for (let i = 0; i < 10; i++) session.step();
    const snapshot = session.saveSnapshot(), bytes = serializePhysicsSnapshot(snapshot);
    assert.equal(Buffer.from(bytes.subarray(0, 8)).toString(), 'BCPHSNP1');
    const decoded = deserializePhysicsSnapshot(bytes);
    assert.ok(Object.is(decoded.scene.model.bodies[0].initial.velocityMps[0], -0));
    restored = restorePhysicsReplaySession(decoded, scene);
    for (let i = 0; i < 20; i++) assert.deepEqual(restored.step(), session.step());
    const accepted = session.saveSnapshot();
    assert.throws(() => session.step([{ kind: 'force', bodyId: 'missing', forceN: [1, 0, 0] }]), code('INVALID_COMMAND'));
    assert.deepEqual(session.saveSnapshot(), accepted);
    assert.throws(() => deserializePhysicsSnapshot(new TextEncoder().encode(JSON.stringify(snapshot))), code('INVALID_SNAPSHOT'));
    assert.throws(() => deserializePhysicsSnapshot(bytes.subarray(0, bytes.length - 1)), code('INVALID_SNAPSHOT'));
    assert.throws(() => deserializePhysicsSnapshot(Uint8Array.from([...bytes, 0])), code('INVALID_SNAPSHOT'));
    const stale = clone(scene); stale.model.revision = 'changed';
    assert.throws(() => restorePhysicsReplaySession(snapshot, stale), code('STALE_SNAPSHOT'));
  } finally { session.dispose(); restored?.dispose(); }
});

test('CAD data composes directly into model and independently preserves off-origin pose', () => {
  const source = `@model units_fixture { version: 0; length-unit: mm; @surface #panel {
    type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1];
    control-points:[[[20,-30,40],[20,-30,100]],[[120,10,40],[120,10,100]]]; weights:[[1,1],[1,1]]; } }`;
  const proxy = admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision: 'cadRev1', modelId: 'units_fixture',
    surfaceId: 'panel', kind: 'dynamic', proxy: 'box', massKg: 1, initialOffsetM: [0.1, 0, 0] });
  const m = makeModel({ parts: [{ body: proxy.body, collider: proxy.collider }], sourceBindings: [proxy.binding], gravityMps2: [0, 0, 0] });
  const world = Physics.createPhysicsWorld(m, options);
  try {
    proxy.collider.geometry.halfExtentsM.forEach((x, i) => near(x, [0.05, 0.02, 0.03][i], 1e-9));
    const body = clone(world.getState().bodies[0]); body.orientationXYZW = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const pose = cadProxyPose(proxy, body, source, 'cadRev1');
    pose.translation.forEach((x, i) => near(x, [160, -80, 0][i], 1e-6));
    assert.throws(() => cadProxyPose(proxy, body, source + '\n', 'cadRev1'), code('STALE_SOURCE'));
    assert.throws(() => cadProxyPose(proxy, body, source, 'cadRev2'), code('STALE_SOURCE'));
    assert.equal(world.getModel().sourceBindings[0].id, proxy.binding.id);
  } finally { world.dispose(); }
});


test('malformed later source binding produces a typed refusal, never an internal null dereference', () => {
  const input = model();
  input.sourceBindings = [{ id: 'bind1', sourceRevision: 'rev1', sourceDigest: digest('source'),
    modelId: 'native', occurrenceId: 'part1', entityIds: ['ball'],
    approximation: { kind: 'control-net-sphere', lossLabel: 'bounded proxy' } }, null];
  assert.throws(() => Physics.createPhysicsWorld(input, options), code('INVALID_CONFIG'));
});
