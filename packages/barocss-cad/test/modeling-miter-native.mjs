import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { miterRail, proveMiter, work, bodyHash } from './modeling-miter-fixture.mjs';
import { prove } from './modeling-intersection-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-miter-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', modelCalls: 0, tessellations: 0, stages: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  reportScope: 'Model feature indices only; provider split counters exclude wrapper cutter compilation',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
const disk = () => { const d = statfsSync(directory); assert.ok(d.bavail * d.bsize >= 500 * 1024 * 1024); };
const stage = (label, action) => {
  disk(); assert.ok(++flow.modelCalls <= 6); flow.pending = label; write(); const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start, ...(result ? { recomputation: result.recomputation } : {}) }); flow.pending = null; write(); return result;
};
const errorData = error => error instanceof Error ? { name: error.name, code: error.code, operation: error.operation, stage: error.stage, entity: error.entity, message: error.message, stack: error.stack, cause: errorData(error.cause) } : error;
try {
  const initial = stage('miter sum24 baseline', miterRail(cad).build), initialText = initial.save();
  work(initial, [], [0,1,2]); flow.baseline = proveMiter(initial, 24, 2304, 3840); flow.initialBodySHA256 = bodyHash(initial);
  writeFileSync(resolve(directory, 'initial.cad-model.json'), initialText);
  const components = Object.keys(initial.bodies).map(name => {
    const body = convexBody(initial,name);
    disk(); assert.ok(++flow.tessellations <= 2); write(); const result = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 });
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
  const moved = stage('sum32 split-only edit', () => initial.withParameters({ cutPosition: 32 })), movedText = moved.save(), movedHash = bodyHash(moved);
  work(moved, [0,1], [2], initial); flow.moved = proveMiter(moved, 32, 3840, 2304);
  stage('outside60 both-output refusal', () => {
    assert.throws(() => moved.withParameters({ cutPosition: 60 }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'SELECTION'); assert.equal(error.operation, 'split');
      assert.deepEqual(error.cause, { side: 'positive', status: 'outside', sectionDimension: -1 });
      flow.refusal = { code: error.code, operation: error.operation, cause: error.cause }; return true;
    });
    assert.equal(moved.save(), movedText); assert.equal(bodyHash(moved), movedHash); assert.equal(initial.save(), initialText);
  });
  const recovered = stage('sum28 recovery on same accepted snapshot', () => moved.withParameters({ cutPosition: 28 }));
  work(recovered, [0,1], [2], moved); flow.recovered = proveMiter(recovered, 28, 3072, 3072);
  flow.futureReuseAfterRefusal = true; flow.editedBodySHA256 = bodyHash(recovered);
  writeFileSync(resolve(directory, 'edited.cad-model.json'), recovered.save());
  const tangent = stage('signed negative-zero one-output tangent', miterRail(cad, { at: -0, occupiedOnly: true }).build);
  work(tangent, [], [0,1,2]); const native = tangent.evidence[2].native;
  assert.equal(native.report.status, 'tangent'); assert.equal(native.section.dimension, 1); assert.equal(native.negative.kind, 'empty');
  assert.equal(convexBody(tangent,'positive'), native.positive.solid); assert.deepEqual(convexBody(tangent,'positive'), native.request.parent); prove(convexBody(tangent,'positive'), 6144);
  assert.ok(Object.is(tangent.parameters.cutPosition, -0)); assert.ok(tangent.save().includes('"cutPosition":-0'));
  const plane = native.request.cutter.model.objects.find(o => o.id === native.request.cutter.surfaceId);
  assert.ok(Object.is(plane.controlPoints[0][0][1], -0)); assert.ok(native.request.cutter.source.includes('[0,-0,0]'));
  flow.tangent = { status: native.report.status, sectionDimension: native.section.dimension, positiveMM3: 6144, unchangedParent: true, signedZeroSource: true };
  const finished = stage('two-chamfer symmetric sum28', miterRail(cad, { at: 28, bevels: true }).build);
  work(finished, [], [0,1,2,3,4]); flow.chamferParent = proveMiter(finished, 28, 3008, 3008, 2);
  assert.equal(initial.save(), initialText); assert.equal(moved.save(), movedText); assert.equal(bodyHash(moved), movedHash);
  assert.equal(bodyHash(initial), flow.initialBodySHA256);
  flow.oldAndNewSnapshotsIndependent = true;
  assert.equal(flow.modelCalls, 6); assert.equal(flow.tessellations, 2); flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); write(); throw error; }
