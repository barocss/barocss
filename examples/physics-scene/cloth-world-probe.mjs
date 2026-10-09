import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createClothWorld } from '../../packages/barocss-physics/dist/cloth.js';
import { projectDistance } from '../../packages/barocss-physics/dist/cloth/constraints.js';
import { ClothSolver } from '../../packages/barocss-physics/dist/cloth/solver.js';
import { createClothTrial } from '../physics-cloth-spike/world.mjs';
import { CLOTH_FIXTURE } from '../physics-cloth-spike/fixture.mjs';

const dt = 1 / 120;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceTreeDirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
const scene = () => ({ format: 'barocss-cloth-scene', version: 1, revision: 'clothRev1',
  basis: 'right-handed-xyz-metres', fixedStepSeconds: dt, profile: 'pinned-sheet-sphere-v1' });
const hash = positions => createHash('sha256').update(Buffer.from(positions.buffer,
  positions.byteOffset, positions.byteLength)).digest('hex');
const refused = (action, code) => assert.throws(action, error => error instanceof Error && error.code === code);

function nearArrays(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  let maxDifference = 0;
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Number.isFinite(actual[i]), `non-finite element ${i}`);
    maxDifference = Math.max(maxDifference, Math.abs(actual[i] - expected[i]));
  }
  assert.ok(maxDifference <= tolerance, `array difference ${maxDifference} > ${tolerance}`);
  return maxDifference;
}

// This scalar expectation does not call the original or compiled cloth solver.
function scalarReference() {
  const positions = Float64Array.of(0, 0, 0, 1.2, 0, 0);
  const sheet = { positions, restPositions: positions.slice(), inverseMasses: Float64Array.of(1, 1),
    pins: [], triangles: new Uint16Array(), constraints: [], totalMassKg: 2 };
  const constraint = { a: 0, b: 1, rest: 1, kind: 'stretch', lambda: 0 };
  const alpha = 0.001 / (dt / 8) ** 2;
  const expectedLambda = -0.2 / (2 + alpha);
  const expectedLength = 1.2 + 2 * expectedLambda;
  projectDistance(sheet, constraint);
  assert.ok(Math.abs(constraint.lambda - expectedLambda) <= 1e-15);
  assert.ok(Math.abs(positions[3] - positions[0] - expectedLength) <= 1e-15);
  const after = positions.slice();
  projectDistance(sheet, constraint);
  nearArrays(positions, after, 1e-15);
  return { alpha, expectedLambda, expectedLength };
}

function sceneAdmission() {
  let getterCalls = 0;
  const accessor = scene();
  Object.defineProperty(accessor, 'revision', { enumerable: true, get() { getterCalls++; return 'clothRev1'; } });
  const invalid = [null, undefined, [], 1, 'scene', { ...scene(), extra: true },
    { ...scene(), [Symbol('extra')]: true }, accessor, Object.assign(Object.create({}), scene()), Object.assign(Object.create(null), scene()),
    { ...scene(), format: 'other' }, { ...scene(), version: 0 }, { ...scene(), version: '1' },
    { ...scene(), basis: 'left-handed-xyz-metres' }, { ...scene(), fixedStepSeconds: 1 / 60 },
    { ...scene(), fixedStepSeconds: Number.NaN }, { ...scene(), profile: 'arbitrary-mesh' }];
  for (const key of Object.keys(scene())) {
    const missing = scene(); delete missing[key]; invalid.push(missing);
  }
  for (const revision of ['', '1first', 'white space', '한글', 'a'.repeat(65), null, 1]) {
    invalid.push({ ...scene(), revision });
  }
  for (const value of invalid) refused(() => createClothWorld(value), 'INVALID_CONFIG');
  assert.equal(getterCalls, 0, 'configuration admission must not invoke getters');
  for (const revision of ['a', 'A'.repeat(64), 'cloth.rev_1:variant-0']) {
    const valid = createClothWorld({ ...scene(), revision });
    assert.equal(valid.getState().sceneRevision, revision); valid.dispose();
  }
  return { invalidConfigurations: invalid.length, gettersInvoked: getterCalls };
}

function stateCopiesAndSteps() {
  const input = scene(), world = createClothWorld(input), initial = world.getState();
  const expected = world.getState();
  assert.equal(initial.vertexCount, 289); assert.equal(initial.triangleCount, 512);
  assert.ok(initial.positionsM instanceof Float64Array);
  assert.ok(initial.velocitiesMps instanceof Float64Array);
  assert.ok(initial.triangles instanceof Uint16Array);
  assert.ok(initial.pinnedVertexIndices instanceof Uint16Array);
  assert.equal(initial.positionsM.length, 867); assert.equal(initial.triangles.length, 1536);
  assert.deepEqual([...initial.pinnedVertexIndices], [0, 16]);
  assert.deepEqual(initial.collider, { kind: 'sphere', centreM: [0, 0.1, 0], radiusM: 0.3, collisionOffsetM: 0.002 });
  assert.equal(initial.stepIndex, 0); assert.equal(initial.timeSeconds, 0);
  assert.equal(initial.profile, 'pinned-sheet-sphere-v1');
  input.revision = 'changed';
  initial.positionsM.fill(42); initial.velocitiesMps.fill(42); initial.triangles.fill(42);
  initial.pinnedVertexIndices.fill(42); initial.collider.centreM.fill(42);
  initial.collider.radiusM = 42; initial.diagnostics.totalMassKg = 42;
  assert.deepEqual(world.getState(), expected);
  for (const invalid of [Number.NaN, Infinity, -Infinity, 0, -dt, 1 / 60, dt + Number.EPSILON,
    '1/120', null, undefined, { valueOf: () => dt }]) {
    refused(() => world.step(invalid), 'INVALID_STEP');
    assert.deepEqual(world.getState(), expected);
  }
  const stepReturn = world.step(dt), stepExpected = world.getState();
  stepReturn.positionsM.fill(9); stepReturn.velocitiesMps.fill(9);
  stepReturn.collider.centreM.fill(9); stepReturn.diagnostics.maxPinDriftM = 9;
  assert.deepEqual(world.getState(), stepExpected);
  const resetReturn = world.reset();
  assert.deepEqual(resetReturn, expected);
  resetReturn.positionsM.fill(9); resetReturn.collider.centreM.fill(9);
  assert.deepEqual(world.getState(), expected);
  world.dispose(); world.dispose();
  refused(() => world.getState(), 'DISPOSED');
  refused(() => world.step(dt), 'DISPOSED');
  refused(() => world.reset(), 'DISPOSED');
  return { copiedState: true, invalidStepRetention: true, resetExact: true, disposedRefusal: true };
}

// Inject at the numerical boundary to make each otherwise unreachable guard run.
// Public state remains the assertion boundary; this does not configure an unsupported scene.
function numericRetention() {
  const original = ClothSolver.prototype.step;
  const faults = [
    ['position-nan', p => { p[51] = Number.NaN; }],
    ['velocity-infinite', (_p, v) => { v[51] = Infinity; }],
    ['position-bound', p => { p[51] = 10.01; }],
    ['negative-position-bound', p => { p[51] = -10.01; }],
    ['velocity-bound', (_p, v) => { v[51] = 1000.01; }],
    ['negative-velocity-bound', (_p, v) => { v[51] = -1000.01; }],
    ['structural-strain', p => { p[51] += 0.1; }],
    ['sphere-penetration', p => { p.set([0, 0.1, 0], 3 * 144); }],
    ['pin-drift', p => { p[0] += 1e-12; }],
  ];
  for (const [name, damage] of faults) {
    const world = createClothWorld(scene());
    world.step(dt);
    const before = world.getState();
    try {
      ClothSolver.prototype.step = function (sheet, positions, velocities) {
        original.call(this, sheet, positions, velocities);
        damage(positions, velocities);
      };
      refused(() => world.step(dt), 'NUMERIC_LIMIT');
      assert.deepEqual(world.getState(), before, `${name}: last accepted state must remain unchanged`);
    } finally { ClothSolver.prototype.step = original; }
    const recovered = world.step(dt), fresh = createClothWorld(scene());
    fresh.step(dt);
    assert.deepEqual(recovered, fresh.step(dt), `${name}: rejected candidate must not change later simulation`);
    world.dispose(); fresh.dispose();
  }
  return { faultCases: faults.map(([name]) => name), lastAcceptedStateRetained: true, recoveryExact: true };
}

function triangleSamples(state) {
  const { positionsM: p, triangles, collider } = state;
  let maxLoss = 0;
  for (let t = 0; t < triangles.length; t += 3) {
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]) {
      const relative = [0, 1, 2].map(axis => weights.reduce((sum, weight, i) =>
        sum + weight * p[3 * triangles[t + i] + axis], 0) - collider.centreM[axis]);
      maxLoss = Math.max(maxLoss, collider.radiusM - Math.hypot(...relative));
    }
  }
  return maxLoss;
}

function referenceAndSampling() {
  const world = createClothWorld(scene());
  const reference = createClothTrial(CLOTH_FIXTURE, 'xpbd', 2, 8);
  const snapshots = [];
  let peakSampledPenetrationM = 0, peakStep = 0, peakStructuralExtension = 0;
  let final;
  for (let step = 0; step <= 240; step++) {
    const state = step ? world.step(dt) : world.getState();
    if (step) reference.step();
    assert.equal(state.stepIndex, step); assert.equal(state.timeSeconds, step * dt);
    assert.ok(state.diagnostics.maxStructuralExtension <= 0.10);
    assert.ok(state.diagnostics.maxVertexPenetrationM <= 1e-6);
    assert.equal(state.diagnostics.maxPinDriftM, 0);
    assert.ok(Math.abs(state.diagnostics.totalMassKg - 0.2) <= 1e-14);
    assert.ok(state.velocitiesMps.every(Number.isFinite));
    peakStructuralExtension = Math.max(peakStructuralExtension, state.diagnostics.maxStructuralExtension);
    const sampled = triangleSamples(state);
    if (sampled > peakSampledPenetrationM) { peakSampledPenetrationM = sampled; peakStep = step; }
    if ([0, 60, 240].includes(step)) {
      const positionDifference = nearArrays(state.positionsM, reference.sheet.positions);
      const velocityDifference = nearArrays(state.velocitiesMps, reference.velocities);
      assert.deepEqual(state.triangles, reference.sheet.triangles);
      snapshots.push({ step, positionDifference, velocityDifference,
        positionSha256: hash(state.positionsM), sampledPenetrationM: sampled, diagnostics: state.diagnostics });
    }
    final = state;
  }
  assert.ok(peakSampledPenetrationM <= 0.002, 'sampled triangle loss must meet separate display-loss gate');
  refused(() => world.step(dt), 'WORLD_LIMIT'); assert.deepEqual(world.getState(), final);
  const reset = world.reset(), fresh = createClothWorld(scene());
  assert.deepEqual(reset, fresh.getState());
  world.dispose(); fresh.dispose();
  return { snapshots, peakStructuralExtension, peakSampledPenetrationM, peakStep,
    samplesPerTriangle: 4, continuousTriangleCollision: false, maxStepRetention: true,
    resetAfterLimitExact: true, finalPositionSha256: hash(final.positionsM) };
}

function warmBenchmark(expectedFinalHash) {
  const run = timed => {
    const world = createClothWorld(scene()), times = [];
    let state;
    for (let step = 0; step < 240; step++) {
      const start = performance.now();
      state = world.step(dt);
      if (timed) times.push(performance.now() - start);
    }
    assert.equal(hash(state.positionsM), expectedFinalHash);
    world.dispose();
    return times;
  };
  run(false);
  const trials = [run(true), run(true), run(true)].map(times => {
    const sorted = [...times].sort((a, b) => a - b);
    const p95StepMs = sorted[Math.ceil(sorted.length * 0.95) - 1];
    assert.ok(p95StepMs <= 1000 / 120, `public CPU step p95 ${p95StepMs} ms exceeds budget`);
    return { steps: times.length, medianStepMs: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95StepMs, maxStepMs: sorted.at(-1) };
  });
  return { warmupSteps: 240, trials, includesCandidateCopiesDiagnosticsAndStateCopies: true,
    excludesReferenceAndTriangleSampling: true, gpuCompletionMeasured: false, repeatedFinalHash: expectedFinalHash };
}

const scalar = scalarReference();
const admission = sceneAdmission();
const lifecycle = stateCopiesAndSteps();
const numeric = numericRetention();
const reference = referenceAndSampling();
const benchmark = warmBenchmark(reference.finalPositionSha256);
console.log(JSON.stringify({ result: 'ok', scope: 'frozen numerical CPU cloth profile only',
  nodeVersion: process.version, sourceHead, sourceTreeDirty, scalar, admission, lifecycle, numeric, reference, benchmark }));
