import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';
import { admitCadSurfaceProxy, assertCadProxyCurrent, cadProxyPose } from '../../packages/barocss-physics/dist/cad-proxy.js';

const source = readFileSync(new URL('two-surfaces.barocad', import.meta.url), 'utf8');
const modelId = 'native_loader_demo', sourceRevision = 'rev1';
const dynamic = admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'rational_panel', kind: 'dynamic', proxy: 'sphere', massKg: 1, initialOffsetM: [0, 0.28, 0] });
const fixture = admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'flat_panel', kind: 'static', proxy: 'box', minimumHalfExtentM: 0.01 });
assert.equal(dynamic.bodyId, 'part:native_loader_demo.rational_panel');
assert.equal(fixture.bodyId, 'fixture:native_loader_demo.flat_panel');
assert.deepEqual(dynamic.sourceCenterMM, [50, 0, 20]);
assert.deepEqual(fixture.sourceCenterMM, [50, 70, 20]);
assert.deepEqual(dynamic.body.positionM, [0.05, 0.28, 0.02]);
assert.deepEqual(fixture.body.positionM, [0.05, 0.07, 0.02]);
assert.deepEqual(fixture.body.shape.halfExtentsM, [0.05, 0.01, 0.02]);
assert.ok(Math.abs(dynamic.body.shape.radiusM - Math.hypot(0.05, 0.02)) < 1e-12);
assert.match(dynamic.lossLabel, /not the collision shape/);
assert.ok(Object.isFrozen(dynamic) && Object.isFrozen(dynamic.body));

const dt = 1 / 120;
const world = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [dynamic.body, fixture.body] });
const start = world.getState();
const moving = start.bodies.find((body) => body.id === dynamic.bodyId);
const fixed = start.bodies.find((body) => body.id === fixture.bodyId);
assert.deepEqual(cadProxyPose(dynamic, moving, source, sourceRevision),
  { targetId: dynamic.bodyId, translation: [0, 280, 0], rotation: [0, 0, 0, 1] });
assert.deepEqual(cadProxyPose(fixture, fixed, source, sourceRevision).translation, [0, 0, 0]);
let contactStep = null, contactState;
for (let step = 1; step <= 120; step++) {
  const state = world.step(dt);
  if (state.contacts.some((contact) => contact.aId === fixture.bodyId && contact.bId === dynamic.bodyId)) {
    contactStep = step;
    contactState = state;
    break;
  }
}
assert.ok(contactStep !== null, 'native-derived proxy never contacted the fixture');
const finalBody = contactState.bodies.find((body) => body.id === dynamic.bodyId);
const finalPose = cadProxyPose(dynamic, finalBody, source, sourceRevision);
assert.equal(finalPose.targetId, dynamic.bodyId);
assert.ok(finalPose.translation[1] < 280);

const refuses = (action, code) => assert.throws(action,
  (error) => error instanceof PhysicsError && error.code === code);
const accepted = JSON.stringify(world.getState());
refuses(() => assertCadProxyCurrent(dynamic, `${source} `, sourceRevision), 'STALE_SOURCE');
refuses(() => assertCadProxyCurrent(dynamic, source, 'rev2'), 'STALE_SOURCE');
refuses(() => cadProxyPose(dynamic, finalBody, `${source} `, sourceRevision), 'STALE_SOURCE');
refuses(() => cadProxyPose(dynamic, { ...finalBody, id: fixture.bodyId }, source, sourceRevision), 'INVALID_CONFIG');
refuses(() => admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'reference_edge', kind: 'static', proxy: 'box' }), 'INVALID_CONFIG');
refuses(() => admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId: 'wrong',
  surfaceId: 'flat_panel', kind: 'static', proxy: 'box' }), 'INVALID_CONFIG');
refuses(() => admitCadSurfaceProxy('invalid', { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'flat_panel', kind: 'static', proxy: 'box' }), 'INVALID_CONFIG');
refuses(() => admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'flat_panel', kind: 'static', proxy: 'box', minimumHalfExtentM: NaN }), 'INVALID_CONFIG');
assert.equal(JSON.stringify(world.getState()), accepted, 'failed admission changed accepted Physics world');
world.dispose();

console.log(JSON.stringify({ result: 'ok', dynamicId: dynamic.bodyId, fixtureId: fixture.bodyId,
  contactStep, firstPositionM: dynamic.body.positionM, contactPositionM: finalBody.positionM,
  staleSourceRefused: true, acceptedWorldRetained: true }));
