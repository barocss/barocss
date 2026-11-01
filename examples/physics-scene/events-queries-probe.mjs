import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/dist/index.js';

const code = (operation, expected) => assert.throws(operation,
  (error) => error instanceof PhysicsError && error.code === expected);
const dt = 1 / 30;
const sensor = createPhysicsWorld(makeModel({gravityMps2: [0, 0, 0], parts: [
    dynamicPart('part:ball', { kind: 'sphere', radiusM: 0.1 }, {positionM: [-0.35, 0, 0], velocityMps: [3, 0, 0]}, 1, {restitution: 0}),
    staticPart('sensor:box', { kind: 'box', halfExtentsM: [0.1, 0.2, 0.2] }, {positionM: [0, 0, 0]}, {restitution: 0, sensor: true}),
  ]}), {profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct'});
assert.deepEqual(sensor.getState().events, []);
assert.deepEqual(sensor.query({kind:'overlap-sphere',includeSensors:true, centerM: [0, 0, 0], radiusM: 0.05 }), {kind:'overlap-sphere',colliderIds:['sensor:box.shape']});
assert.deepEqual(sensor.query({kind:'overlap-sphere',includeSensors:false, centerM: [0, 0, 0], radiusM: 0.05 }), {kind:'overlap-sphere',colliderIds:[]});
assert.deepEqual(sensor.query({kind:'raycast',includeSensors:true, originM: [0, -1, 0], direction: [0, 1, 0], maxDistanceM: 2 }),
  {kind:'raycast',hit:{bodyId:'sensor:box',colliderId:'sensor:box.shape',distanceM:0.8}});
assert.deepEqual(sensor.query({kind:'raycast',includeSensors:false, originM: [0, -1, 0], direction: [0, 1, 0],
  maxDistanceM: 2 }), {kind:'raycast',hit:null});
assert.deepEqual(sensor.query({kind:'raycast',includeSensors:true, originM: [0, 0, 0], direction: [0, 1, 0], maxDistanceM: 1 }),
  {kind:'raycast',hit:{bodyId:'sensor:box',colliderId:'sensor:box.shape',distanceM:0}});
const stable = JSON.stringify(sensor.getState());
code(() => sensor.query({kind:'raycast',includeSensors:true, originM: [0, 0, 0], direction: [1, 1, 0], maxDistanceM: 1 }), 'INVALID_QUERY');
code(() => sensor.query({kind:'overlap-sphere',includeSensors:true, centerM: [0, 0, 0], radiusM: 0.05, extra: 1 }), 'INVALID_QUERY');
assert.equal(JSON.stringify(sensor.getState()), stable);

const phases = [];
for (let step = 0; step < 6; step++) {
  const state = sensor.step();
  phases.push(state.events.map((event) => event.phase));
  assert.deepEqual(state.contacts, [], 'sensor generated a physical contact');
  assert.equal(state.bodies[0].velocityMps[0], 3, 'sensor changed velocity');
}
assert.deepEqual(phases, [[], ['begin'], ['stay'], ['stay'], ['stay'], ['end']]);
assert.equal(sensor.getState().events[0].kind, 'sensor');
const eventCopy = sensor.getState();
eventCopy.events[0].phase = 'begin';
assert.equal(sensor.getState().events[0].phase, 'end', 'event result was not copied');
sensor.dispose();
code(() => sensor.query({kind:'overlap-sphere',includeSensors:true, centerM: [0, 0, 0], radiusM: 1 }), 'DISPOSED');

const contact = createPhysicsWorld(makeModel({gravityMps2: [0, 0, 0], parts: [
    dynamicPart('part:ball', { kind: 'sphere', radiusM: 0.1 }, {positionM: [0, 0.2, 0], velocityMps: [0, 0, 0]}, 1, {restitution: 0}),
    staticPart('fixture:box', { kind: 'box', halfExtentsM: [0.5, 0.1, 0.5] }, {positionM: [0, 0, 0]}, {restitution: 0}),
  ]}), {profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct'});
const event = (state, phase) => assert.deepEqual(state.events,
  [{colliderAId:'fixture:box.shape',colliderBId:'part:ball.shape',kind:'contact',phase}]);
event(contact.step(), 'begin');
event(contact.step(), 'stay');
const beforeFailure = JSON.stringify(contact.getState());
code(() => contact.step([{ kind: 'force', bodyId: 'missing', forceN: [0, 1, 0] }]), 'INVALID_COMMAND');
assert.equal(JSON.stringify(contact.getState()), beforeFailure, 'failed step changed event state');
event(contact.step([{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [0, 1, 0] }]), 'end');
assert.deepEqual(contact.getState().contacts, []);
contact.dispose();
console.log(JSON.stringify({
  sensorPhases: phases.flat(),
  physicalPhases: ['begin', 'stay', 'end'],
  rayDistanceM: 0.8,
  queryAndStepRefusalRetainState: true,
}));
