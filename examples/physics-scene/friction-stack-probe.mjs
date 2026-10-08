import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 120;
const material = { static: 1, dynamic: 0.7 };
const ball = (id, y, velocityMps = [0, 0, 0], friction) => ({
  id, kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.25 },
  positionM: [0, y, 0], velocityMps, massKg: 1, restitution: 0,
  ...(friction ? { friction } : {}),
});
const floor = friction => ({ id: 'fixture:floor', kind: 'static',
  shape: { kind: 'box', halfExtentsM: [2, 0.1, 2] },
  positionM: [0, -0.1, 0], restitution: 0, ...(friction ? { friction } : {}) });
const create = bodies => createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], bodies });
const code = (action, expected) => assert.throws(action,
  error => error instanceof PhysicsError && error.code === expected);

function slide(friction) {
  const simulation = create([ball('part:slide', 0.25, [1, 0, 0], friction), floor(friction)]);
  let tangentTotal = 0;
  for (let index = 0; index < 120; index++) {
    const state = simulation.step(dt);
    tangentTotal += state.contacts.reduce((sum, contact) =>
      sum + Math.hypot(...contact.tangentImpulseNs), 0);
  }
  const state = simulation.getState();
  const result = { speedX: state.bodies[0].velocityMps[0],
    angularZ: state.bodies[0].angularVelocityRadps[2], tangentTotal };
  if (friction) {
    const before = simulation.getState().contacts[0].tangentImpulseNs[0];
    state.contacts[0].tangentImpulseNs[0] = 99;
    assert.equal(simulation.getState().contacts[0].tangentImpulseNs[0], before,
      'returned tangent impulse changed accepted state');
  }
  simulation.dispose();
  return result;
}
const frictionless = slide(null), frictional = slide(material);
assert.equal(frictionless.speedX, 1);
assert.equal(frictionless.angularZ, 0);
assert.equal(frictionless.tangentTotal, 0);
assert.ok(frictional.speedX < frictionless.speedX - 0.1, 'friction did not change sliding speed');
assert.ok(frictional.tangentTotal > 0.1, 'frictional contact reported no tangential impulse');
assert.ok(Math.abs(frictional.angularZ) > 0.1, 'friction did not rotate the sphere');

const stack = create([ball('part:lower', 0.25), ball('part:upper', 0.75), floor()]);
let maxPenetrationM = 0;
for (let index = 0; index < 240; index++) {
  const state = stack.step(dt);
  maxPenetrationM = Math.max(maxPenetrationM,
    ...state.contacts.map(contact => contact.penetrationM));
}
const [lower, upper] = stack.getState().bodies;
assert.ok(Math.abs(lower.positionM[1] - 0.25) < 0.001);
assert.ok(Math.abs(upper.positionM[1] - 0.75) < 0.001);
assert.ok(Math.abs(lower.velocityMps[1]) < 0.01);
assert.ok(Math.abs(upper.velocityMps[1]) < 0.01);
assert.ok(maxPenetrationM < 0.002);

code(() => create([ball('part:bad', 0.25, [0, 0, 0], { static: 0.2, dynamic: 0.3 })]), 'INVALID_CONFIG');
code(() => create([ball('part:bad', 0.25, [0, 0, 0], { static: NaN, dynamic: 0 })]), 'INVALID_CONFIG');
code(() => create([ball('part:bad', 0.25, [0, 0, 0], { static: 1 })]), 'INVALID_CONFIG');
code(() => create([ball('part:bad', 0.25, [0, 0, 0], { ...material, extra: 1 })]), 'INVALID_CONFIG');
const before = JSON.stringify(stack.getState());
code(() => stack.step(dt, [{ kind: 'angularImpulse', bodyId: 'part:lower',
  angularImpulseNms: [100000, 0, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(stack.getState()), before, 'failed numeric step changed accepted stack');
stack.dispose();

console.log(JSON.stringify({ result: 'ok', zeroFrictionSpeedX: frictionless.speedX,
  frictionSpeedX: frictional.speedX, frictionAngularZ: frictional.angularZ,
  tangentImpulseTotalNs: frictional.tangentTotal,
  stackY: [lower.positionM[1], upper.positionM[1]], maxPenetrationM,
  invalidRetainsState: true }));
