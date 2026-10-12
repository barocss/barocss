import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { derivedRail, proveDimensions, work, bodyHash } from './modeling-dimensions-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-dimensions-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', modelCalls: 0, tessellations: 0, stages: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  reportScope: 'Accepted model feature indices only; no speed or transitive native-work claim',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
let pending = null;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++flow.modelCalls <= 6); pending = label; const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start, ...(result ? { recomputation: result.recomputation } : {}) }); pending = null; write(); return result;
};
try {
  const initial = stage('derived width32 midpoint', derivedRail(cad).build), initialText = initial.save();
  work(initial, [], [0,1,2,3,4]); flow.baseline = proveDimensions(initial, 16, 3032, 3032);
  flow.initialBodySHA256 = bodyHash(initial);
  const prior = JSON.parse(readFileSync(new URL('./modeling-chamfer-split-evidence/source-flow.json', import.meta.url), 'utf8'));
  assert.equal(flow.initialBodySHA256, prior.initialBodySHA256); flow.literalPredecessorBodyParity = true;
  writeFileSync(resolve(directory, 'initial.cad-model.json'), initialText);
  const body = initial.bodies.negative, result = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 }); flow.tessellations++;
  assert.ok(result.report.triangleCount > 0); flow.display = { side: 'negative', triangles: result.report.triangleCount, nativeAuthority: result.report.nativeAuthority };
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
    const component = { role: 'negative', mesh: result.mesh, boundaries: result.boundaries, internalDiagonals: result.internalDiagonals, report: result.report,
      lineage: { kind: 'model-output', name: 'negative', solidId: body.report.solidId,
        graph: { vertices: body.graph.vertices, faces: body.graph.faces, edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) } } };
    const text = JSON.stringify({ text: initialText, parameters: initial.parameters, features: initial.features, bodySHA256: flow.initialBodySHA256, negativeComponent: component }) + '\n';
    assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024); writeFileSync(resolve(output, 'baseline-native.json'), text);
    flow.transfer = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
  }
  const offset = stage('offset4 only', () => initial.withParameters({ offset: 4 }));
  work(offset, [0,1,2,3], [4], initial); flow.offset = proveDimensions(offset, 20, 3790, 2274);
  const wider = stage('width40 from offset4', () => offset.withParameters({ width: 40 })), widerText = wider.save(), widerHash = bodyHash(wider);
  work(wider, [], [0,1,2,3,4], offset); flow.wider = proveDimensions(wider, 24, 4548, 3032);
  stage('offset40 empty-side refusal', () => {
    assert.throws(() => wider.withParameters({ offset: 40 }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'SELECTION'); assert.equal(error.operation, 'split');
      assert.deepEqual(error.cause, { side: 'positive', status: 'outside', sectionDimension: -1 });
      flow.refusal = { code: error.code, operation: error.operation, cause: error.cause }; return true;
    });
    assert.equal(wider.save(), widerText); assert.equal(bodyHash(wider), widerHash);
  });
  const recovered = stage('offset0 after refusal on same snapshot', () => wider.withParameters({ offset: 0 }));
  work(recovered, [0,1,2,3], [4], wider); flow.recovered = proveDimensions(recovered, 20, 3790, 3790);
  const signed = stage('referenced offset negative-zero edit', () => recovered.withParameters({ offset: -0 }));
  work(signed, [0,1,2,3], [4], recovered); flow.signedZero = proveDimensions(signed, 20, 3790, 3790);
  assert.ok(Object.is(signed.parameters.offset, -0)); assert.ok(signed.save().includes('"offset":-0')); assert.ok(Object.is(recovered.parameters.offset, 0));
  assert.equal(bodyHash(signed), bodyHash(recovered)); assert.notEqual(signed.save(), recovered.save());
  assert.equal(initial.save(), initialText); assert.equal(wider.save(), widerText); assert.equal(bodyHash(wider), widerHash);
  flow.futureReuseAfterRefusal = true; flow.referencedSignedZeroPreserved = true; flow.oldAndNewSnapshotsIndependent = true;
  flow.editedBodySHA256 = bodyHash(signed); writeFileSync(resolve(directory, 'edited.cad-model.json'), signed.save());
  assert.equal(flow.modelCalls, 6); assert.equal(flow.tessellations, 1); flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = { pending, message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
