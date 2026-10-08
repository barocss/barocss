import assert from 'node:assert/strict';
import { createPhysicsWorld } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const friction = { static: 1, dynamic: 0.7 };
const dynamicBox = (id, positionM, options = {}) => ({ id, kind: 'dynamic',
  shape: { kind: 'box', halfExtentsM: [0.25, 0.25, 0.25] }, positionM,
  velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction, ...options });
const floor = { id: 'fixture:floor', kind: 'static',
  shape: { kind: 'box', halfExtentsM: [2, 0.1, 2] },
  positionM: [0, -0.1, 0], restitution: 0, friction };
const makeWorld = (bodies, broadPhase) => createPhysicsWorld({ fixedStepSeconds: dt,
  gravityMps2: [0, -9.81, 0], bodies, ...(broadPhase ? { broadPhase } : {}) });
const near = (actual, expected, label, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);

function firstContact(bodies, broadPhase) {
  const world = makeWorld(bodies, broadPhase);
  const state = world.step(dt);
  world.dispose();
  assert.equal(state.contacts.length, 1);
  const contact = state.contacts[0];
  assert.deepEqual(contact.normalAtoB, [0, 1, 0]);
  near(contact.pointM[0], 0, 'contact X');
  near(contact.pointM[2], 0, 'contact Z');
  near(contact.penetrationM, 0.00068125, 'penetration');
  near(state.bodies.find((body) => body.id === 'part:box').angularVelocityRadps[0], 0, 'angular X');
  near(state.bodies.find((body) => body.id === 'part:box').angularVelocityRadps[2], 0, 'angular Z');
  return { contact, state };
}

const centered = dynamicBox('part:box', [0, 0.25, 0]);
const direct = firstContact([centered, floor]);
assert.deepEqual(firstContact([floor, centered]).contact, direct.contact);
assert.deepEqual(firstContact([centered, floor], 'aabb').contact, direct.contact);

const rotated = makeWorld([dynamicBox('part:box', [0.16, 0.3, 0],
  { orientation: [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)] }), floor]);
const rotatedState = rotated.step(dt);
assert.equal(rotatedState.contacts.length, 1);
const rotatedContact = rotatedState.contacts[0];
near(Math.hypot(...rotatedContact.normalAtoB), 1, 'rotated normal length');
assert.ok([...rotatedContact.pointM, rotatedContact.penetrationM].every(Number.isFinite));
assert.ok(Math.abs(rotatedContact.pointM[0]) <= 2 && Math.abs(rotatedContact.pointM[2]) <= 2);
rotated.dispose();

const stack = makeWorld([dynamicBox('part:lower', [0, 0.25, 0]),
  dynamicBox('part:upper', [0, 0.75, 0]), floor]);
let maxPenetrationM = 0;
for (let index = 0; index < 480; index++) {
  const state = stack.step(dt);
  maxPenetrationM = Math.max(maxPenetrationM,
    ...state.contacts.map((contact) => contact.penetrationM));
}
const stackState = stack.getState();
const lower = stackState.bodies.find((body) => body.id === 'part:lower');
const upper = stackState.bodies.find((body) => body.id === 'part:upper');
for (const [body, expectedY] of [[lower, 0.25], [upper, 0.75]]) {
  near(body.positionM[1], expectedY, `${body.id} height`, 0.001);
  assert.ok(Math.abs(body.positionM[0]) <= 0.001 && Math.abs(body.positionM[2]) <= 0.001);
  assert.ok(Math.abs(body.velocityMps[1]) <= 0.01);
  assert.ok(Math.hypot(...body.angularVelocityRadps) <= 0.01);
}
assert.ok(maxPenetrationM <= 0.002);
stack.dispose();

console.log(JSON.stringify({ result: 'ok', firstPointM: direct.contact.pointM,
  firstPenetrationM: direct.contact.penetrationM, maxStackPenetrationM: maxPenetrationM,
  finalStackY: [lower.positionM[1], upper.positionM[1]],
  rotatedContactPointM: rotatedContact.pointM }));
