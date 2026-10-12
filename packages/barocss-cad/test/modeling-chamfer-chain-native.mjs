import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chamferPart, chainProof, prove } from './modeling-chamfer-chain-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, ConvexPlanarSolidChamferError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-chamfer-chain-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', evaluations: 0, tessellations: 0, stages: [], refusals: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  providerCounterScope: 'Each unchanged chamfer provider reports its own direct split work; these are not whole-model transitive counts',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
let pending = null;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++flow.evaluations <= 6); pending = label; const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start }); pending = null; write(); return result;
};
try {
  const initial = stage('source front1 back2', chamferPart(cad).build), saved = initial.save();
  flow.baseline = chainProof(initial, 16, 64, 6064);
  const body = convexBody(initial,'part'), display = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 }); flow.tessellations++;
  assert.ok(display.report.triangleCount > 0); flow.display = { triangles: display.report.triangleCount, nativeAuthority: display.report.nativeAuthority };
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
    const outputs = [{ name: 'part', solidId: body.report.solidId, volumeMM3: body.certificate.volumeMM3 }];
    const transport = { id: 1, ok: true, text: saved,
      summary: { documentId: 'cad_model', revision: 0, source: 'model', parameters: initial.parameters, features: initial.features, outputs },
      display: { profile: 'model-outputs', documentId: 'cad_model', revision: 0,
        components: [{ role: 'part', mesh: display.mesh, boundaries: display.boundaries, internalDiagonals: display.internalDiagonals, report: display.report,
          lineage: { kind: 'model-output', name: 'part', solidId: body.report.solidId,
            graph: { vertices: body.graph.vertices, faces: body.graph.faces, edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) } } }],
        outcomes: [{ role: 'part', solidId: body.report.solidId, status: 'solid' }] } };
    const text = JSON.stringify(transport) + '\n'; assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    writeFileSync(resolve(output, 'baseline-transport.json'), text);
    flow.transport = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
  }
  const edited = stage('edit back3', () => initial.withParameters({ backDistance: 3 }));
  flow.backEdit = chainProof(edited, 16, 144, 5984); assert.equal(initial.save(), saved);
  writeFileSync(resolve(directory, 'edited.cad-model.json'), edited.save());
  const joint = stage('joint edit front2 back3', () => initial.withParameters({ frontDistance: 2, backDistance: 3 }));
  flow.jointEdit = chainProof(joint, 64, 144, 5936); assert.equal(initial.save(), saved);
  for (const [label, edits, code] of [
    ['removed original edge selection', { backY: 0 }, 'SELECTION'],
    ['noncardinal new bevel edge', { backY: 1 }, 'NATIVE'],
    ['zero second distance', { backDistance: 0 }, 'PARAMETER'],
  ]) stage(label, () => {
    assert.throws(() => initial.withParameters(edits), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, code); assert.equal(error.operation, 'chamfer');
      const refusal = { label, code: error.code, operation: error.operation, message: error.message };
      if (code === 'NATIVE') {
        assert.ok(error.cause instanceof ConvexPlanarSolidChamferError); assert.equal(error.cause.code, 'METRIC');
        refusal.cause = { name: error.cause.name, code: error.cause.code, stage: error.cause.stage, entity: error.cause.entity, message: error.cause.message };
      }
      flow.refusals.push(refusal); return true;
    });
    assert.equal(initial.save(), saved); prove(convexBody(initial,'part'), 6064);
    assert.deepEqual(initial.evidence[3].native.split.request.parent, initial.evidence[2].native.split.negative.solid);
  });
  assert.equal(flow.evaluations, 6); assert.equal(flow.tessellations, 1); assert.equal(initial.save(), saved);
  flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = { pending, message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
