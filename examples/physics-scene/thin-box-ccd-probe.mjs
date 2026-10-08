import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';
import { admitCadSurfaceProxy } from '../../packages/barocss-physics/dist/cad-proxy.js';

const dt = 1 / 120;
const source = readFileSync(new URL('../physics-cad-scene/two-surfaces.barocad', import.meta.url), 'utf8');
const request = { sourceVersion: 0, sourceRevision: 'rev1', modelId: 'native_loader_demo' };
const moving = admitCadSurfaceProxy(source, { ...request, surfaceId: 'rational_panel',
  kind: 'dynamic', proxy: 'box', massKg: 1, initialOffsetM: [0, 0.28, 0],
  minimumHalfExtentM: 0.002 });
const fixture = admitCadSurfaceProxy(source, { ...request, surfaceId: 'flat_panel',
  kind: 'static', proxy: 'box', minimumHalfExtentM: 0.002 });
const movingCcd = { ...moving.body, ccd: true };
const config = (bodies) => ({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], bodies });
const refuses = (action, code) => assert.throws(action,
  (cause) => cause instanceof PhysicsError && cause.code === code);

function run(bodies) {
  const world = createPhysicsWorld(config(bodies));
  let first = null, last = null;
  for (let step = 1; step <= 120; step++) {
    const state = world.step(dt);
    if (!first && state.contacts.length) first = { step, state };
    last = state;
  }
  return { world, first, last };
}

const missed = run([moving.body, fixture.body]);
assert.equal(missed.first, null);
assert.ok(missed.last.bodies.find((body) => body.id === moving.bodyId).positionM[1] < fixture.body.positionM[1]);
missed.world.dispose();

const accepted = run([movingCcd, fixture.body]);
assert.equal(accepted.first.step, 25);
const first = accepted.first.state;
assert.equal(first.contacts.length, 1);
assert.equal(first.ccdHits.length, 1);
assert.equal(first.ccdHits[0].bodyId, moving.bodyId);
assert.equal(first.ccdHits[0].fixtureId, fixture.bodyId);
assert.deepEqual(first.ccdHits[0].normalFixtureToBody, [0, 1, 0]);
assert.ok(Math.abs(first.ccdHits[0].toiFraction - 0.09541284403669836) < 1e-12);
const finalMoving = accepted.last.bodies.find((body) => body.id === moving.bodyId);
const finalNativePlaneGapM = finalMoving.positionM[1] - fixture.body.positionM[1];
assert.ok(Math.abs(finalNativePlaneGapM - 0.004) < 1e-9);
assert.ok(accepted.last.bodies.every((body) => [...body.positionM, ...body.velocityMps].every(Number.isFinite)));

const prior = accepted.world.getState();
refuses(() => accepted.world.step(dt, [{ kind: 'torque', bodyId: moving.bodyId,
  torqueNm: [0, 0, 1] }]), 'INVALID_COMMAND');
assert.deepEqual(accepted.world.getState(), prior);
refuses(() => accepted.world.step(dt, [{ kind: 'impulse', bodyId: moving.bodyId,
  impulseNs: [0, 100000, 0] }]), 'NUMERIC_LIMIT');
assert.deepEqual(accepted.world.getState(), prior);
const next = accepted.world.step(dt);
accepted.world.dispose();

const reversed = run([fixture.body, movingCcd]);
assert.equal(reversed.first.step, accepted.first.step);
assert.deepEqual(reversed.first.state.contacts, first.contacts);
assert.deepEqual(reversed.first.state.ccdHits, first.ccdHits);
assert.deepEqual(reversed.last.bodies.map((body) => [body.id, body.positionM]).sort(),
  accepted.last.bodies.map((body) => [body.id, body.positionM]).sort());
assert.deepEqual(reversed.world.step(dt).bodies.map((body) => [body.id, body.positionM]).sort(),
  next.bodies.map((body) => [body.id, body.positionM]).sort());
reversed.world.dispose();

const overlap = createPhysicsWorld(config([
  { ...movingCcd, positionM: [0.05, 0.073, 0.02], velocityMps: [0, 0, 0] }, fixture.body]));
const overlapState = overlap.step(dt);
assert.equal(overlapState.ccdHits.length, 0);
assert.equal(overlapState.contacts.length, 1);
overlap.dispose();
const noEntry = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, 0, 0], bodies: [
  { ...movingCcd, velocityMps: [0, 1, 0] }, fixture.body] });
const noEntryState = noEntry.step(dt);
assert.equal(noEntryState.ccdHits.length, 0);
assert.equal(noEntryState.contacts.length, 0);
noEntry.dispose();

const offCentre = createPhysicsWorld(config([{ ...movingCcd, positionM: [0.06, 0.28, 0.02] },
  fixture.body]));
for (let step = 0; step < 24; step++) offCentre.step(dt);
const beforeRotation = offCentre.getState();
refuses(() => offCentre.step(dt), 'NUMERIC_LIMIT');
assert.deepEqual(offCentre.getState(), beforeRotation);
offCentre.dispose();

for (const invalid of [
  config([movingCcd, fixture.body, { ...fixture.body, id: 'fixture:extra' }]),
  config([{ ...movingCcd, orientation: [0, 0, Math.sin(0.1), Math.cos(0.1)] }, fixture.body]),
  config([movingCcd, { ...fixture.body, sensor: true }]),
  { ...config([movingCcd, fixture.body]), contactMode: 'persistent-box-v1' },
]) refuses(() => createPhysicsWorld(invalid), 'INVALID_CONFIG');

console.log(JSON.stringify({ result: 'ok', missedWithoutCcd: true,
  firstContactStep: accepted.first.step, toiFraction: first.ccdHits[0].toiFraction,
  finalNativePlaneGapM, reversedOrderMatches: true, initialOverlapDiscrete: true,
  noEntryDiscrete: true, rotatedCandidateRetained: true, invalidRetained: true }));
