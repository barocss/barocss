import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createCadFluidWorld, PhysicsError } from '../../packages/barocss-physics/dist/fluid-cad.js';
import { createFluidWorld } from '../../packages/barocss-physics/dist/fluid.js';

const source = await readFile(new URL('fluid-cad-shelf.barocad', import.meta.url), 'utf8');
const request = { sourceVersion: 0, sourceRevision: 'shelfRev1', modelId: 'fluid_shelf',
  surfaceId: 'shelf', kind: 'static', proxy: 'box', minimumHalfExtentM: 0.01 };
const current = { sourceText: source, currentRevision: 'shelfRev1' };
const dt = 1 / 120;
const sha = state => createHash('sha256').update(Buffer.from(state.positionsM.buffer,
  state.positionsM.byteOffset, state.positionsM.byteLength)).digest('hex');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const invalid = action => assert.throws(action, error =>
  error instanceof PhysicsError && error.code === 'INVALID_CONFIG');

function scene() {
  const initialPositionsM = [];
  for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    initialPositionsM.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
  }
  return { format: 'barocss-fluid-scene', version: 1, revision: 'waterRev1',
    basis: 'right-handed-xyz-metres', fixedStepSeconds: dt,
    gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM };
}

function penetrations(state, obstacle) {
  const low = obstacle.centerM.map((value, axis) =>
    value - obstacle.halfExtentsM[axis] - 0.0125);
  const high = obstacle.centerM.map((value, axis) =>
    value + obstacle.halfExtentsM[axis] + 0.0125);
  let inside = 0;
  for (let index = 0; index < 256; index++) {
    if ([0, 1, 2].every(axis => state.positionsM[index * 3 + axis] > low[axis] + 1e-9
      && state.positionsM[index * 3 + axis] < high[axis] - 1e-9)) inside++;
  }
  return inside;
}

const shelf = createCadFluidWorld(scene(), source, request);
const baseline = createFluidWorld(scene());
const obstacle = shelf.getObstacle();
assert.equal(obstacle.bodyId, 'fixture:fluid_shelf.shelf');
assert.deepEqual(obstacle.centerM, [0.35, 0.2, 0.25]);
assert.deepEqual(obstacle.halfExtentsM, [0.15, 0.01, 0.15]);
assert.match(obstacle.lossLabel, /not the collision shape/);
obstacle.centerM[0] = 999;
assert.equal(shelf.getObstacle().centerM[0], 0.35);

const outside = { ...request, minimumHalfExtentM: 1 };
invalid(() => createCadFluidWorld(scene(), source, outside));
invalid(() => createCadFluidWorld(scene(), source, { ...request, kind: 'dynamic', massKg: 1 }));
invalid(() => createCadFluidWorld(scene(), source, { ...request, initialOffsetM: [0, 0, 0] }));
const overlap = scene();
overlap.initialPositionsM[0] = [0.3, 0.2, 0.3];
invalid(() => createCadFluidWorld(overlap, source, request));

const before = sha(shelf.getState());
for (const stale of [
  { sourceText: source, currentRevision: 'shelfRev2' },
  { sourceText: `${source}\n`, currentRevision: 'shelfRev1' },
  undefined,
]) {
  assert.throws(() => shelf.step(dt, stale), error =>
    error instanceof PhysicsError && error.code === 'STALE_SOURCE');
  assert.equal(sha(shelf.getState()), before);
  assert.equal(shelf.getState().stepIndex, 0);
}
assert.throws(() => shelf.reset({ sourceText: source, currentRevision: 'shelfRev2' }), error =>
  error instanceof PhysicsError && error.code === 'STALE_SOURCE');

const baselineTimes = [], shelfTimes = [], receipts = [];
let cumulativeShelfHits = 0;
for (let step = 1; step <= 240; step++) {
  const startBaseline = performance.now();
  const bare = baseline.step(dt);
  baselineTimes.push(performance.now() - startBaseline);
  const startShelf = performance.now();
  const withShelf = shelf.step(dt, current);
  shelfTimes.push(performance.now() - startShelf);
  cumulativeShelfHits += withShelf.obstacleHits;
  assert.equal(penetrations(withShelf, shelf.getObstacle()), 0);
  if ([60, 240].includes(step)) receipts.push({ step, bareSHA: sha(bare), shelfSHA: sha(withShelf),
    obstacleHits: withShelf.obstacleHits, cumulativeShelfHits,
    density: withShelf.diagnostics });
}
assert.ok(receipts[0].cumulativeShelfHits > 0);
assert.notEqual(receipts[0].bareSHA, receipts[0].shelfSHA);
assert.equal(receipts[1].bareSHA, '6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b');
const bareP95 = p95(baselineTimes), shelfP95 = p95(shelfTimes);
assert.ok(shelfP95 <= bareP95 * 1.5,
  `Shelf cost ${shelfP95} ms exceeds 1.5× baseline ${bareP95} ms`);
const copiedState = shelf.getState();
copiedState.positionsM[0] = 999;
assert.notEqual(shelf.getState().positionsM[0], 999);
const repeated = createCadFluidWorld(scene(), source, request);
for (let step = 0; step < 240; step++) repeated.step(dt, current);
assert.equal(sha(repeated.getState()), sha(shelf.getState()));
repeated.dispose(); baseline.dispose(); shelf.dispose();
console.log(JSON.stringify({ result: 'ok', obstacle: obstacle.bodyId,
  receipts, bareP95, shelfP95, costRatio: shelfP95 / bareP95 }));
