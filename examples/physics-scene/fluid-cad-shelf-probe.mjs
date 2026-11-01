import { basename } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { waterModelData } from './fluid-viewer/scene.js';

export function qualifyCadShelf(provider,adapter,source) {
 const {admitCadFluidStaticData,assertCadProxyCurrent}=adapter;
const request = { sourceVersion: 0, sourceRevision: 'shelfRev1', modelId: 'fluid_shelf',
  surfaceId: 'shelf', kind: 'static', proxy: 'box', minimumHalfExtentM: 0.01 };
const current = { sourceText: source, currentRevision: 'shelfRev1' };
const dt = 1 / 120;
const sha = state => createHash('sha256').update(Buffer.from(state.fluids[0].positionsM.buffer,
  state.fluids[0].positionsM.byteOffset, state.fluids[0].positionsM.byteLength)).digest('hex');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const invalid = action => assert.throws(action, error =>
  error instanceof provider.PhysicsError && error.code === 'INVALID_CONFIG');


function penetrations(state, obstacle) {
  const low = obstacle.centerM.map((value, axis) =>
    value - obstacle.halfExtentsM[axis] - 0.0125);
  const high = obstacle.centerM.map((value, axis) =>
    value + obstacle.halfExtentsM[axis] + 0.0125);
  let inside = 0;
  for (let index = 0; index < 256; index++) {
    if ([0, 1, 2].every(axis => state.fluids[0].positionsM[index * 3 + axis] > low[axis] + 1e-9
      && state.fluids[0].positionsM[index * 3 + axis] < high[axis] - 1e-9)) inside++;
  }
  return inside;
}

const input = waterModelData();
const targetOptions = {...input.options,profile:'fluid-static-box-visual-v1'};
const admitted = admitCadFluidStaticData(input.model,targetOptions,source,request);
const shelf = provider.createPhysicsWorld(admitted.model,targetOptions);
const baseline = provider.createPhysicsWorld(input.model,input.options);
const proxy=admitted.proxy;
assert.equal(proxy.bodyId,'fixture:fluid_shelf.shelf');
const obstacle={centerM:[...proxy.body.initial.positionM],halfExtentsM:[...proxy.collider.geometry.halfExtentsM]};
assert.deepEqual(obstacle.centerM,[.35,.2,.25]);assert.deepEqual(obstacle.halfExtentsM,[.15,.01,.15]);
assert.match(proxy.lossLabel,/not the collision shape/);
const exposed=shelf.getModel();exposed.bodies.find(b=>b.id===proxy.bodyId).initial.positionM[0]=999;
assert.equal(shelf.getModel().bodies.find(b=>b.id===proxy.bodyId).initial.positionM[0],.35);

const outside = { ...request, minimumHalfExtentM: 1 };
invalid(() => admitCadFluidStaticData(input.model,targetOptions,source,outside));
invalid(() => admitCadFluidStaticData(input.model,targetOptions,source,{ ...request, kind: 'dynamic', massKg: 1 }));
invalid(() => admitCadFluidStaticData(input.model,targetOptions,source,{ ...request, initialOffsetM: [0, 0, 0] }));
const overlap = waterModelData();
overlap.model.fluids[0].initialPositionsM[0] = [0.3, 0.2, 0.3];
invalid(() => admitCadFluidStaticData(overlap.model,targetOptions,source,request));

const before = sha(shelf.getState());
for (const stale of [
  { sourceText: source, currentRevision: 'shelfRev2' },
  { sourceText: `${source}\n`, currentRevision: 'shelfRev1' },
  undefined,
]) {
  assert.throws(() => assertCadProxyCurrent(proxy,stale?.sourceText,stale?.currentRevision), error =>
    error instanceof provider.PhysicsError && error.code === 'STALE_SOURCE');
  assert.equal(sha(shelf.getState()), before);
  assert.equal(shelf.getState().stepIndex, 0);
}
assert.equal('reset' in shelf,false);

const baselineTimes = [], shelfTimes = [], receipts = [];
let cumulativeShelfHits = 0;
for (let step = 1; step <= 240; step++) {
  const startBaseline = performance.now();
  const bare = baseline.step([]);
  baselineTimes.push(performance.now() - startBaseline);
  const startShelf = performance.now();
  assertCadProxyCurrent(proxy,current.sourceText,current.currentRevision);
  const withShelf = shelf.step([]);
  shelfTimes.push(performance.now() - startShelf);
  cumulativeShelfHits += withShelf.fluids[0].diagnostics.obstacleHits;
  assert.equal(penetrations(withShelf, obstacle), 0);
  if ([60, 240].includes(step)) receipts.push({ step, bareSHA: sha(bare), shelfSHA: sha(withShelf),
    obstacleHits: withShelf.fluids[0].diagnostics.obstacleHits, cumulativeShelfHits,
    density: withShelf.fluids[0].diagnostics });
}
assert.ok(receipts[0].cumulativeShelfHits > 0);
assert.notEqual(receipts[0].bareSHA, receipts[0].shelfSHA);
assert.equal(receipts[1].bareSHA, '6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b');
const bareP95 = p95(baselineTimes), shelfP95 = p95(shelfTimes);
assert.ok(shelfP95 <= bareP95 * 1.5,
  `Shelf cost ${shelfP95} ms exceeds 1.5× baseline ${bareP95} ms`);
const copiedState = shelf.getState();
copiedState.fluids[0].positionsM[0] = 999;
assert.notEqual(shelf.getState().fluids[0].positionsM[0], 999);
const repeated = provider.createPhysicsWorld(admitted.model,targetOptions);
for (let step = 0; step < 240; step++) { assertCadProxyCurrent(proxy,current.sourceText,current.currentRevision); repeated.step([]); }
assert.equal(sha(repeated.getState()), sha(shelf.getState()));
repeated.dispose(); baseline.dispose(); shelf.dispose();
return { result: 'ok', obstacle: proxy.bodyId,
  receipts, bareP95, shelfP95, costRatio: shelfP95 / bareP95 };
}
if(typeof process!=='undefined'&&basename(process.argv[1]??'')==='fluid-cad-shelf-probe.mjs'){
 const nativeEntry=new URL('../../packages/barocss-physics/dist/index.js',import.meta.url).href;
 const cadEntry=new URL('../../packages/barocss-physics/dist/cad-proxy.js',import.meta.url).href;
 const source=await readFile(new URL('fluid-cad-shelf.barocad',import.meta.url),'utf8');
 console.log(JSON.stringify(qualifyCadShelf(await import(nativeEntry),await import(cadEntry),source)));
}
