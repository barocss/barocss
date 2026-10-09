import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError as RootPhysicsError } from '@barocss/physics';
import { createClothWorld, PhysicsError as ClothPhysicsError } from '@barocss/physics/cloth';
import { createFluidWorld, PhysicsError as FluidPhysicsError } from '@barocss/physics/fluid';
import { createCadFluidWorld, PhysicsError as CadFluidPhysicsError } from '@barocss/physics/fluid-cad';

const observe = process.argv.includes('--observe');
const constructors = { root: RootPhysicsError, cloth: ClothPhysicsError,
  fluid: FluidPhysicsError, fluidCad: CadFluidPhysicsError };
for (const constructor of Object.values(constructors)) assert.equal(typeof constructor, 'function');
const identityMatrix = Object.fromEntries(Object.entries(constructors).map(([name, constructor]) =>
  [name, Object.fromEntries(Object.entries(constructors).map(([other, value]) => [other, constructor === value]))]));
const allConstructorsEqual = Object.values(identityMatrix).every(row => Object.values(row).every(Boolean));
const errors = [];

function catchActual(label, owner, action, expectedCode, expectedMessage) {
  let caught;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `${label} must throw an actual Error`);
  assert.ok(caught instanceof constructors[owner], `${label} must retain its own exported constructor`);
  assert.equal(caught.constructor, constructors[owner]);
  assert.equal(caught.code, expectedCode); assert.equal(caught.name, 'PhysicsError');
  assert.equal(caught.message, expectedMessage);
  const instanceofMatrix = Object.fromEntries(Object.entries(constructors).map(([name, constructor]) =>
    [name, caught instanceof constructor]));
  errors.push({ label, ownerEntry: owner, code: caught.code, name: caught.name, message: caught.message,
    ownConstructor: true, instanceof: instanceofMatrix, allEntries: Object.values(instanceofMatrix).every(Boolean),
    causePresent: 'cause' in caught, causeOwnProperty: Object.hasOwn(caught, 'cause'),
    causeType: typeof caught.cause });
  if (!observe) assert.ok(Object.values(instanceofMatrix).every(Boolean), `${label} must be instanceof every existing entry`);
}

const cloth = createClothWorld({ format: 'barocss-cloth-scene', version: 1,
  revision: 'errorEntry1', basis: 'right-handed-xyz-metres',
  fixedStepSeconds: 1 / 120, profile: 'pinned-sheet-sphere-v1' });
let clothState;
try {
  clothState = cloth.step(1 / 120);
  assert.equal(clothState.stepIndex, 1); assert.equal(clothState.vertexCount, 289);
} finally { cloth.dispose(); }
catchActual('cloth-real-disposed', 'cloth', () => cloth.getState(), 'DISPOSED', 'Cloth world is disposed');

const rigid = createPhysicsWorld({ fixedStepSeconds: 1 / 120, gravityMps2: [0, -9.81, 0],
  bodies: [{ id: 'part:entry', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.1 },
    positionM: [0, 1, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0 }] });
try {
  const before = rigid.getState();
  catchActual('root-real-invalid-step', 'root', () => rigid.step(0), 'INVALID_STEP',
    'step must equal configured fixedStepSeconds');
  assert.deepEqual(rigid.getState(), before, 'Invalid dt must retain the complete accepted rigid state');
} finally { rigid.dispose(); }

catchActual('root-malformed-config', 'root', () => createPhysicsWorld(null),
  'INVALID_CONFIG', 'world must be an object');
catchActual('cloth-malformed-config', 'cloth', () => createClothWorld(null),
  'INVALID_CONFIG', 'Unsupported ClothSceneV1 contract');
catchActual('fluid-malformed-config', 'fluid', () => createFluidWorld(null),
  'INVALID_CONFIG', 'Fluid scene must be a plain object');
catchActual('fluid-cad-malformed-config', 'fluidCad', () => createCadFluidWorld(null, '', null),
  'INVALID_CONFIG', 'First CAD fluid obstacle requires FluidSceneV1');

if (!observe) assert.ok(allConstructorsEqual, 'The four existing PhysicsError exports must be identical');
console.log(JSON.stringify({ ok: true, observe, allConstructorsEqual, identityMatrix, errors,
  cloth: { stepIndex: clothState.stepIndex, vertexCount: clothState.vertexCount, disposed: true },
  rigid: { invalidDt: 0, completeAcceptedStateRetained: true, disposed: true },
  scope: 'One own package graph; no identity promise across versions, realms or independent consumer bundles' }));
