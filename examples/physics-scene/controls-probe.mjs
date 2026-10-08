import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 60;
const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`);
const code = (operation, expected) => assert.throws(operation,
  (error) => error instanceof PhysicsError && error.code === expected);
const dynamic = (massKg = 2) => ({
  id: 'part:ball', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.1 },
  positionM: [0, 0, 0], velocityMps: [0, 0, 0], massKg, restitution: 0,
});
const world = () => createPhysicsWorld({
  fixedStepSeconds: dt, gravityMps2: [0, 0, 0], bodies: [dynamic()],
});

const force = { kind: 'force', bodyId: 'part:ball', forceN: [12, 0, 0] };
const impulse = { kind: 'impulse', bodyId: 'part:ball', impulseNs: [4, 0, 0] };
const moving = world();
let state = moving.step(dt, [force]);
near(state.bodies[0].velocityMps[0], 0.1, 'force velocity');
near(state.bodies[0].positionM[0], 1 / 600, 'force position');
state = moving.step(dt, [impulse]);
near(state.bodies[0].velocityMps[0], 2.1, 'impulse velocity');
near(state.bodies[0].positionM[0], 1 / 600 + 2.1 / 60, 'impulse position');
state = moving.step(dt);
near(state.bodies[0].velocityMps[0], 2.1, 'one-step force expiry');

const first = world(), second = world();
assert.deepEqual(first.step(dt, [force, impulse]), second.step(dt, [impulse, force]));
first.dispose();
second.dispose();

const press = createPhysicsWorld({
  fixedStepSeconds: dt, gravityMps2: [0, 0, 0],
  bodies: [
    { ...dynamic(1), shape: { kind: 'sphere', radiusM: 0.5 } },
    { id: 'tool:press', kind: 'kinematic', shape: { kind: 'box', halfExtentsM: [0.2, 0.2, 0.2] },
      positionM: [1, 0, 0], restitution: 0 },
  ],
});
const before = JSON.stringify(press.getState());
const bad = (commands, expected = 'INVALID_COMMAND') => {
  code(() => press.step(dt, commands), expected);
  assert.equal(JSON.stringify(press.getState()), before, 'failed command changed accepted state');
};
bad([{ kind: 'force', bodyId: 'tool:press', forceN: [1, 0, 0] }]);
bad([{ ...force }, { ...force }]);
bad([{ kind: 'impulse', bodyId: 'missing:part', impulseNs: [1, 0, 0] }]);
bad([{ kind: 'kinematicTarget', bodyId: 'tool:press', positionM: [NaN, 0, 0] }]);
const sparse = new Array(1);
bad(sparse);
bad([{ kind: 'kinematicTarget', bodyId: 'tool:press', positionM: [20, 0, 0] }], 'NUMERIC_LIMIT');

state = press.step(dt, [{ kind: 'kinematicTarget', bodyId: 'tool:press', positionM: [0.6, 0, 0] }]);
const pushed = state.bodies.find((body) => body.id === 'part:ball');
const tool = state.bodies.find((body) => body.id === 'tool:press');
near(tool.positionM[0], 0.6, 'kinematic position');
near(tool.velocityMps[0], -24, 'kinematic velocity');
assert.ok(pushed.positionM[0] < -0.09, 'moving box did not push sphere');
assert.ok(state.contacts.some((contact) => contact.aId === 'part:ball' &&
  contact.bId === 'tool:press' && contact.impulseNs > 0), 'kinematic contact missing');
state.bodies[0].positionM[0] = 123;
assert.notEqual(press.getState().bodies[0].positionM[0], 123, 'state was not copied');
state = press.step(dt);
near(state.bodies.find((body) => body.id === 'tool:press').positionM[0], 0.6, 'held target position');
near(state.bodies.find((body) => body.id === 'tool:press').velocityMps[0], 0, 'held target velocity');
press.dispose();
code(() => press.step(dt), 'DISPOSED');

const numeric = world();
const numericBefore = JSON.stringify(numeric.getState());
code(() => numeric.step(dt, [{ kind: 'force', bodyId: 'part:ball', forceN: [1000000, 0, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(numeric.getState()), numericBefore, 'numeric refusal changed accepted state');
numeric.dispose();
moving.dispose();
console.log(JSON.stringify({
  forceVelocityMps: 0.1,
  impulseVelocityMps: 2.1,
  kinematicVelocityMps: -24,
  kinematicContact: true,
  invalidCommandsRetainState: true,
}));
