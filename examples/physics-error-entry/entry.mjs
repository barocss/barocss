import { copyPhysicsModelPreset } from '../physics-model-data-2276/model-data.mjs';
import { createPhysicsRecorder } from '@barocss/physics/replay';
import { admitCadFluidStaticData } from '@barocss/physics/cad-proxy';
import { makeModel, dynamicPart } from '../physics-model-input/model.mjs';
import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError as RootPhysicsError } from '@barocss/physics';

const observe = process.argv.includes('--observe');
const constructors = { root: RootPhysicsError };
for (const constructor of Object.values(constructors)) assert.equal(typeof constructor, 'function');
const identityMatrix = Object.fromEntries(Object.entries(constructors).map(([name, constructor]) =>
  [name, Object.fromEntries(Object.entries(constructors).map(([other, value]) => [other, constructor === value]))]));
const allConstructorsEqual = Object.values(identityMatrix).every(row => Object.values(row).every(Boolean));
const errors = [];

function catchActual(label, owner, action, expectedCode) {
  let caught;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `${label} must throw an actual Error`);
  assert.ok(caught instanceof RootPhysicsError, `${label} must retain its own exported constructor`);
  assert.equal(caught.constructor, RootPhysicsError);
  assert.equal(caught.code, expectedCode); assert.equal(caught.name, 'PhysicsError');
  const instanceofMatrix = Object.fromEntries(Object.entries(constructors).map(([name, constructor]) =>
    [name, caught instanceof constructor]));
  errors.push({ label, ownerEntry: owner, code: caught.code, name: caught.name, message: caught.message,
    ownConstructor: true, instanceof: instanceofMatrix, allEntries: Object.values(instanceofMatrix).every(Boolean),
    causePresent: 'cause' in caught, causeOwnProperty: Object.hasOwn(caught, 'cause'),
    causeType: typeof caught.cause });
  if (!observe) assert.ok(Object.values(instanceofMatrix).every(Boolean), `${label} must be instanceof every existing entry`);
}

const clothInput = copyPhysicsModelPreset('cloth-pinned-sphere-visual-v1');
const cloth = createPhysicsWorld(clothInput.model, clothInput.options);
let clothState;
try {
  clothState = cloth.step([]);
  assert.equal(clothState.stepIndex, 1); assert.equal(clothState.cloths[0].positionsM.length / 3, 289);
} finally { cloth.dispose(); }
catchActual('cloth-real-disposed', 'root', () => cloth.getState(), 'DISPOSED');

const options = { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' };
const rigid = createPhysicsWorld(makeModel({ parts: [dynamicPart('part:entry',
  { kind: 'sphere', radiusM: 0.1 }, { positionM: [0, 1, 0] })] }), options);
try {
  const before = rigid.getState();
  catchActual('root-real-invalid-command-argument', 'root', () => rigid.step(0), 'INVALID_COMMAND');
  assert.deepEqual(rigid.getState(), before, 'Invalid command argument must retain the complete accepted rigid state');
} finally { rigid.dispose(); }

catchActual('root-malformed-config', 'root', () => createPhysicsWorld(null, options),
  'INVALID_CONFIG');
catchActual('cloth-malformed-model', 'root', () => createPhysicsWorld(null, clothInput.options), 'INVALID_CONFIG');
const fluidInput = copyPhysicsModelPreset('fluid-basin-visual-v1');
catchActual('fluid-malformed-model', 'root', () => createPhysicsWorld(null, fluidInput.options), 'INVALID_CONFIG');
catchActual('cad-data-malformed-request', 'cad-proxy', () => admitCadFluidStaticData(fluidInput.model,
  {...fluidInput.options, profile:'fluid-static-box-visual-v1'}, '', null), 'INVALID_CONFIG');
catchActual('replay-requires-genuine-world', 'replay', () => createPhysicsRecorder({}), 'INVALID_SNAPSHOT');

if (!observe) assert.ok(allConstructorsEqual, 'Actual failures must use the canonical root PhysicsError');
console.log(JSON.stringify({ ok: true, observe, allConstructorsEqual, identityMatrix, errors,
  cloth: { stepIndex: clothState.stepIndex, vertexCount: clothState.cloths[0].positionsM.length / 3, disposed: true },
  rigid: { invalidCommandArgument: 0, completeAcceptedStateRetained: true, disposed: true },
  scope: 'One own package graph; no identity promise across versions, realms or independent consumer bundles' }));
