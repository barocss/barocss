import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 30;
const sphere = (ccd, velocityMps = [0, -100, 0]) => ({
  id: 'part:fast', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.05 },
  positionM: [0, 1, 0], velocityMps, massKg: 1, restitution: 0,
  ...(ccd ? { ccd: true } : {}),
});
const floor = (id = 'fixture:thin') => ({
  id, kind: 'static', shape: { kind: 'box', halfExtentsM: [0.5, 0.01, 0.5] },
  positionM: [0, 0, 0], restitution: 0,
});
const create = (bodies) => createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, 0, 0], bodies });
const refuses = (action, code) => assert.throws(action,
  (error) => error instanceof PhysicsError && error.code === code);

const discrete = create([sphere(false), floor()]);
const missed = discrete.step(dt);
assert.equal(missed.bodies[0].positionM[1], 1 - 100 / 30);
assert.equal(missed.contacts.length, 0);
assert.deepEqual(missed.ccdHits, []);
discrete.dispose();

const continuous = create([sphere(true), floor()]);
const initial = continuous.getState();
assert.deepEqual(initial.ccdHits, []);
assert.equal(initial.bodies[0].ccd, true);
const caught = continuous.step(dt);
assert.equal(caught.ccdHits.length, 1);
assert.equal(caught.ccdHits[0].bodyId, 'part:fast');
assert.equal(caught.ccdHits[0].fixtureId, 'fixture:thin');
assert.ok(Math.abs(caught.ccdHits[0].toiFraction - 0.282) < 1e-12);
assert.deepEqual(caught.ccdHits[0].normalFixtureToBody, [0, 1, 0]);
assert.ok(caught.bodies[0].positionM[1] >= 0.06 - 1e-6);
assert.ok(caught.contacts.some((contact) => contact.aId === 'fixture:thin' && contact.bId === 'part:fast'));
assert.ok(caught.bodies[0].velocityMps[1] > -1e-8);
caught.ccdHits[0].normalFixtureToBody[1] = 99;
assert.equal(continuous.getState().ccdHits[0].normalFixtureToBody[1], 1);
const clear = continuous.step(dt);
assert.deepEqual(clear.ccdHits, []);
continuous.dispose();

const angled = create([sphere(true), { ...floor(), orientation: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)] }]);
const angledState = angled.step(dt);
assert.equal(angledState.ccdHits.length, 1);
assert.ok(Math.abs(angledState.ccdHits[0].normalFixtureToBody[0]) > 0.7);
assert.ok(angledState.bodies[0].positionM[1] > -0.1);
angled.dispose();

const noHit = create([sphere(true, [0, 100, 0]), floor()]);
assert.deepEqual(noHit.step(dt).ccdHits, []);
noHit.dispose();

refuses(() => create([{ ...sphere(true), ccd: false }, floor()]), 'INVALID_CONFIG');
refuses(() => create([{ ...sphere(true), shape: floor().shape,
  orientation: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)] }, floor()]), 'INVALID_CONFIG');
refuses(() => create([sphere(true), { ...floor(), sensor: true }]), 'INVALID_CONFIG');
refuses(() => create([sphere(true), floor(), sphere(false)]), 'INVALID_CONFIG');
refuses(() => create([sphere(true), floor(), { ...floor('fixture:second'), kind: 'kinematic' }]), 'INVALID_CONFIG');

const guarded = create([sphere(true), floor()]);
const before = JSON.stringify(guarded.getState());
refuses(() => guarded.step(dt, [{ kind: 'impulse', bodyId: 'part:fast', impulseNs: [0, -1000, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(guarded.getState()), before);
guarded.dispose();

console.log(JSON.stringify({ result: 'ok', discreteY: missed.bodies[0].positionM[1],
  ccdY: caught.bodies[0].positionM[1], toiFraction: caught.ccdHits[0].toiFraction,
  angledNormal: angledState.ccdHits[0].normalFixtureToBody, invalidRetainsState: true }));
