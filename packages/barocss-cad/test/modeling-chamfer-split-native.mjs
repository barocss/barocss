import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { dividedRail, proveSplit, work, bodyHash } from './modeling-chamfer-split-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-chamfer-split-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', modelCalls: 0, tessellations: 0, stages: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  reportScope: 'Model feature indices only; provider split counters exclude wrapper cutter compilation',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
let pending = null;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++flow.modelCalls <= 6); pending = label; const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start, ...(result ? { recomputation: result.recomputation } : {}) }); pending = null; write(); return result;
};
try {
  const initial = stage('two-chamfer X16 split', dividedRail(cad).build), initialText = initial.save();
  work(initial, [], [0,1,2,3,4]); flow.baseline = proveSplit(initial, 'x', 16, 3032, 3032, 6);
  writeFileSync(resolve(directory, 'initial.cad-model.json'), initialText);
  const components = Object.keys(initial.bodies).map(name => {
    const body = convexBody(initial,name);
    const result = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 }); flow.tessellations++;
    assert.ok(result.report.triangleCount > 0);
    return { role: name, mesh: result.mesh, boundaries: result.boundaries, internalDiagonals: result.internalDiagonals, report: result.report,
      lineage: { kind: 'model-output', name, solidId: body.report.solidId,
        graph: { vertices: body.graph.vertices, faces: body.graph.faces, edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) } } };
  });
  flow.display = components.map(c => ({ name: c.role, triangles: c.report.triangleCount, nativeAuthority: c.report.nativeAuthority }));
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
    const outputs = Object.keys(initial.bodies).map(name => { const body = convexBody(initial,name); return { name, solidId: body.report.solidId, volumeMM3: body.certificate.volumeMM3 }; });
    const transport = { id: 1, ok: true, text: initialText,
      summary: { documentId: 'cad_model', revision: 0, source: 'model', parameters: initial.parameters, features: initial.features, outputs },
      display: { profile: 'model-outputs', documentId: 'cad_model', revision: 0, components, outcomes: outputs.map(o => ({ role: o.name, solidId: o.solidId, status: 'solid' })) } };
    const text = JSON.stringify(transport) + '\n'; assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    writeFileSync(resolve(output, 'baseline-transport.json'), text);
    flow.transport = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
  }
  const moved = stage('X8 split-only edit', () => initial.withParameters({ splitAt: 8 })), movedText = moved.save(), movedHash = bodyHash(moved);
  work(moved, [0,1,2,3], [4], initial); flow.moved = proveSplit(moved, 'x', 8, 1516, 4548, 6);
  stage('outside both-output refusal', () => {
    assert.throws(() => moved.withParameters({ splitAt: 40 }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'SELECTION'); assert.equal(error.operation, 'split');
      assert.deepEqual(error.cause, { side: 'positive', status: 'outside', sectionDimension: -1 });
      flow.refusal = { code: error.code, operation: error.operation, cause: error.cause }; return true;
    });
    assert.equal(moved.save(), movedText); assert.equal(bodyHash(moved), movedHash); assert.equal(initial.save(), initialText);
  });
  const edited = stage('back3 edit after refusal on same snapshot', () => moved.withParameters({ backDistance: 3 }));
  work(edited, [0,1,2], [3,4], moved); flow.backEdit = proveSplit(edited, 'x', 8, 1496, 4488, 6);
  flow.futureReuseAfterRefusal = true; flow.editedBodySHA256 = bodyHash(edited);
  writeFileSync(resolve(directory, 'edited.cad-model.json'), edited.save());
  const y = stage('one-chamfer Y12 split', dividedRail(cad, { axis: 'y', at: 12, bevels: 1 }).build);
  work(y, [], [0,1,2,3]); flow.y = proveSplit(y, 'y', 12, 3056, 3072, 4);
  const z = stage('two-chamfer Z4 split', dividedRail(cad, { axis: 'z', at: 4 }).build);
  work(z, [], [0,1,2,3,4]); flow.z = proveSplit(z, 'z', 4, 3072, 2992, 4);
  assert.equal(initial.save(), initialText); assert.equal(moved.save(), movedText); assert.equal(bodyHash(moved), movedHash);
  flow.oldAndNewSnapshotsIndependent = true; flow.initialBodySHA256 = bodyHash(initial);
  assert.equal(flow.modelCalls, 6); assert.equal(flow.tessellations, 2); flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = { pending, message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
