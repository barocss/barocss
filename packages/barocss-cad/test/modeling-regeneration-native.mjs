import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { regeneratingPart, provePart, work, bodyHash } from './modeling-regeneration-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, ConvexPlanarSolidChamferError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-regeneration-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', modelCalls: 0, tessellations: 0, stages: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  modelCallDefinition: 'One selected build/load/withParameters call; no-op and unused-parameter calls included',
  reportScope: 'Accepted model feature indices only; no transitive native count, savings or speed claim',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
let pending = null;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++flow.modelCalls <= 8); pending = label; const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start, ...(result ? { recomputation: result.recomputation } : {}) }); pending = null; write(); return result;
};
try {
  const initial = stage('cold source build', regeneratingPart(cad).build), initialText = initial.save();
  work(initial, [], [0,1,2,3]); flow.baseline = provePart(initial, 32, 8, 1, 2);
  writeFileSync(resolve(directory, 'initial.cad-model.json'), initialText);
  const mesh = tessellateConvexPlanarSolid(convexBody(initial,'part'), { maximumFanTriangles: 40 }); flow.tessellations++;
  assert.ok(mesh.report.triangleCount > 0); flow.display = { triangles: mesh.report.triangleCount, nativeAuthority: mesh.report.nativeAuthority };
  const edited = stage('back distance3 only', () => initial.withParameters({ backDistance: 3 })), editedText = edited.save();
  work(edited, [0,1,2], [3], initial); flow.backEdit = provePart(edited, 32, 8, 1, 3);
  flow.editedBodySHA256 = bodyHash(edited); writeFileSync(resolve(directory, 'edited.cad-model.json'), editedText);
  const joint = stage('branch from edited first distance2', () => edited.withParameters({ frontDistance: 2 }));
  work(joint, [0,1], [2,3], edited); flow.jointEdit = provePart(joint, 32, 8, 2, 3);
  const taller = stage('branch from original height10', () => initial.withParameters({ height: 10 }));
  work(taller, [0], [1,2,3], initial); flow.heightEdit = provePart(taller, 32, 10, 1, 2);
  const wider = stage('branch from original width40', () => initial.withParameters({ width: 40 }));
  work(wider, [], [0,1,2,3], initial); flow.widthEdit = provePart(wider, 40, 8, 1, 2);
  const noop = stage('same-value edit on edited snapshot', () => edited.withParameters({ backDistance: 3 }));
  work(noop, [0,1,2,3], [], edited); assert.equal(noop.save(), editedText); provePart(noop, 32, 8, 1, 3);
  assert.equal(initial.save(), initialText); assert.equal(edited.save(), editedText);
  stage('noncardinal selection refusal from original', () => {
    assert.throws(() => initial.withParameters({ backY: 1 }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'chamfer');
      assert.ok(error.cause instanceof ConvexPlanarSolidChamferError); assert.equal(error.cause.code, 'METRIC');
      flow.refusal = { code: error.code, operation: error.operation, cause: { name: error.cause.name, code: error.cause.code, stage: error.cause.stage, entity: error.cause.entity, message: error.cause.message } }; return true;
    });
    assert.equal(initial.save(), initialText); assert.equal(edited.save(), editedText); provePart(initial, 32, 8, 1, 2);
  });
  const afterRefusal = stage('unused signed-zero edit after refusal', () => initial.withParameters({ unused: -0 }));
  work(afterRefusal, [0,1,2,3], [], initial); provePart(afterRefusal, 32, 8, 1, 2);
  assert.ok(Object.is(afterRefusal.parameters.unused, -0)); assert.ok(afterRefusal.save().includes('"unused":-0'));
  assert.ok(Object.is(initial.parameters.unused, 0)); assert.equal(initial.save(), initialText); assert.equal(edited.save(), editedText);
  assert.notEqual(afterRefusal.save(), initialText);
  assert.throws(() => { afterRefusal.recomputation.reusedFeatures.push(9); }, TypeError);
  for (const snapshot of [initial, edited, joint, taller, wider, noop, afterRefusal]) {
    const d = JSON.parse(snapshot.save()); assert.deepEqual(Object.keys(d).sort(), ['format','nodes','outputs','parameters','schema','units']);
  }
  flow.oldAndNewSnapshotsIndependent = true; flow.futureReuseAfterRefusal = true; flow.unusedSignedZeroPreserved = true;
  flow.initialBodySHA256 = bodyHash(initial);
  assert.equal(flow.modelCalls, 8); assert.equal(flow.tessellations, 1); flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = { pending, message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
