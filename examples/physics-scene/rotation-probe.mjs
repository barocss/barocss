import { makeModel, dynamicPart } from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const dt = 1 / 60;
const near = (actual, expected, label, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} !== ${expected}`);
const code = (action, expected) => assert.throws(action,
  error => error instanceof PhysicsError && error.code === expected);
const sphere = (initial = {}, inertia = {kind:'primitive-com',about:'com',frame:'body-local'}) => dynamicPart('part:rotor', {kind:'sphere',radiusM:1}, {positionM:[0,0,0],velocityMps:[0,0,0],...initial}, 1, {restitution:0,inertia});
const create = (body = sphere()) => createPhysicsWorld(makeModel({gravityMps2: [0, 0, 0], parts: [body]}), {profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct'});

const impulse = { kind: 'angularImpulse', bodyId: 'part:rotor', angularImpulseNms: [0, 0, 0.4] };
const rotor = create();
let state = rotor.step([impulse]);
near(0.4 * rotor.getModel().bodies[0].massKg * rotor.getModel().colliders[0].geometry.radiusM ** 2, 0.4, 'sphere inertia');
near(state.bodies[0].angularVelocityRadps[2], 1, 'angular impulse speed');
near(state.bodies[0].orientationXYZW[2], Math.sin(1 / 120), 'first-step qz');
near(state.bodies[0].orientationXYZW[3], Math.cos(1 / 120), 'first-step qw');
for (let i = 1; i < 60; i++) state = rotor.step();
near(state.bodies[0].orientationXYZW[2], Math.sin(0.5), '60-step qz');
near(state.bodies[0].orientationXYZW[3], Math.cos(0.5), '60-step qw');
near(Math.hypot(...state.bodies[0].orientationXYZW), 1, 'unit quaternion', 1e-12);
state.bodies[0].orientationXYZW[2] = 99;
state.bodies[0].angularVelocityRadps[2] = 99;
near(rotor.getState().bodies[0].orientationXYZW[2], Math.sin(0.5), 'copied orientation');
near(rotor.getState().bodies[0].angularVelocityRadps[2], 1, 'copied angular velocity');

const torqueWorld = create();
state = torqueWorld.step([{ kind: 'torque', bodyId: 'part:rotor', torqueNm: [0, 0, 24] }]);
near(state.bodies[0].angularVelocityRadps[2], 1, 'one-step torque');
near(torqueWorld.step().bodies[0].angularVelocityRadps[2], 1, 'torque expiry');

const quarterTurnX = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const framed = create(sphere({ orientationXYZW: quarterTurnX }));
state = framed.step([impulse]);
const sine = Math.sin(1 / 120), cosine = Math.cos(1 / 120);
near(state.bodies[0].orientationXYZW[0], Math.SQRT1_2 * cosine, 'world-frame qx');
near(state.bodies[0].orientationXYZW[1], Math.SQRT1_2 * sine, 'world-frame qy');
near(state.bodies[0].orientationXYZW[2], Math.SQRT1_2 * sine, 'world-frame qz');
near(state.bodies[0].orientationXYZW[3], Math.SQRT1_2 * cosine, 'world-frame qw');

const before = JSON.stringify(rotor.getState());
code(() => rotor.step([impulse, impulse]), 'INVALID_COMMAND');
code(() => rotor.step([{ kind: 'torque', bodyId: 'part:rotor', torqueNm: [NaN, 0, 0] }]), 'INVALID_COMMAND');
code(() => rotor.step([{ kind: 'angularImpulse', bodyId: 'part:rotor', angularImpulseNms: [100000, 0, 0] }]), 'NUMERIC_LIMIT');
assert.equal(JSON.stringify(rotor.getState()), before, 'failed angular step changed accepted state');
code(() => create(sphere({ orientationXYZW: [0, 0, 0, 2] })), 'INVALID_CONFIG');
code(() => create(sphere({}, {kind:'sphere-isotropic',about:'com',frame:'body-local',kgM2:0})), 'INVALID_CONFIG');
code(() => create(sphere({ angularVelocityRadps: [0, 0] })), 'INVALID_CONFIG');
const override = create(sphere({orientationXYZW:[0,0,0,1]}, {kind:'sphere-isotropic',about:'com',frame:'body-local',kgM2:0.8}));
near(override.step([impulse]).bodies[0].angularVelocityRadps[2], 0.5, 'inertia override');

rotor.dispose(); torqueWorld.dispose(); override.dispose(); framed.dispose();
code(() => rotor.step(), 'DISPOSED');
console.log(JSON.stringify({ result: 'ok', inertiaKgM2: 0.4, angularVelocityRadps: 1,
  quaternionAfterOneSecond: [0, 0, Math.sin(0.5), Math.cos(0.5)],
  unitNorm: 1, invalidRetainsState: true }));
