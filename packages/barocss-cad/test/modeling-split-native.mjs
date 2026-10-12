import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { splitPart, prove, zBounds, capPair } from './modeling-split-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-split-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', evaluations: 0, tessellations: 0, stages: [], refusals: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  providerCounterScope: 'Provider nativeWork excludes the public wrapper compilation of each generated cutter source',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
let pending = null;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++flow.evaluations <= 10); pending = label; const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start }); pending = null; write(); return result;
};
const volumes = (result, lower, upper, at, height = 8, count = 5) => {
  prove(convexBody(result,'lower'), lower); prove(convexBody(result,'upper'), upper);
  zBounds(convexBody(result,'lower'), 0, at); zBounds(convexBody(result,'upper'), at, height);
  const native = result.evidence[2].native; capPair(native, count);
  assert.deepEqual(native.report.volumeMM3.parent, { numerator: String(lower + upper), denominator: '1' });
  assert.deepEqual(native.report.volumeMM3.negative, convexBody(result,'lower').certificate.volumeMM3);
  assert.deepEqual(native.report.volumeMM3.positive, convexBody(result,'upper').certificate.volumeMM3);
};
try {
  const fixture = splitPart(cad);
  assert.throws(() => fixture.blank.split({ axis: 'z', at: 3 }), error => error.code === 'CAPABILITY');
  const initial = stage('source horizontal split at2', fixture.build), saved = initial.save();
  volumes(initial, 1792, 5376, 2);
  assert.deepEqual(initial.features.map(f => f.kind), ['sketch', 'extrude', 'split']);
  assert.deepEqual(initial.features[2].dependencies, [1]);
  const native = initial.evidence[2].native;
  flow.baseline = { lowerMM3: 1792, upperMM3: 5376, nativeWork: native.report.nativeWork, conservation: native.report.volumeMM3, capUsePairs: native.lineage.capUses.length };
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
    const transport = { id: 1, ok: true, text: saved,
      summary: { documentId: 'cad_model', revision: 0, source: 'model', parameters: initial.parameters, features: initial.features, outputs },
      display: { profile: 'model-outputs', documentId: 'cad_model', revision: 0, components, outcomes: outputs.map(o => ({ role: o.name, solidId: o.solidId, status: 'solid' })) } };
    const text = JSON.stringify(transport) + '\n'; assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    writeFileSync(resolve(output, 'baseline-transport.json'), text);
    flow.transport = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
  }
  const edited = stage('edit splitHeight4', () => initial.withParameters({ splitHeight: 4 }));
  volumes(edited, 3584, 3584, 4); assert.equal(initial.save(), saved);
  writeFileSync(resolve(directory, 'edited.cad-model.json'), edited.save());
  for (const [label, at, side, status, dimension] of [
    ['below-outside', -1, 'negative', 'outside', -1], ['bottom-tangent-signed-zero', -0, 'negative', 'tangent', 2],
    ['top-tangent', 8, 'positive', 'tangent', 2], ['above-outside', 9, 'positive', 'outside', -1],
  ]) stage(label, () => {
    assert.throws(() => initial.withParameters({ splitHeight: at }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'SELECTION'); assert.equal(error.operation, 'split');
      assert.deepEqual(error.cause, { side, status, sectionDimension: dimension }); assert.ok(Object.isFrozen(error.cause));
      flow.refusals.push({ label, code: error.code, operation: error.operation, message: error.message, cause: error.cause }); return true;
    });
    assert.equal(initial.save(), saved); prove(convexBody(initial,'lower'), 1792); prove(convexBody(initial,'upper'), 5376);
  });
  const tangent = stage('upper-only signed-zero tangent', splitPart(cad, { level: -0, mode: 'upper' }).build);
  prove(convexBody(tangent,'upper'), 7168); zBounds(convexBody(tangent,'upper'), 0, 8);
  assert.equal(tangent.evidence[2].native.negative.kind, 'empty');
  assert.deepEqual(convexBody(tangent,'upper'), tangent.evidence[2].native.request.parent);
  assert.ok(Object.is(tangent.parameters.splitHeight, -0)); assert.ok(tangent.save().includes('"splitHeight":-0'));
  const cutter = tangent.evidence[2].native.request.cutter;
  assert.ok(cutter.model.objects[0].controlPoints.flat().every(point => Object.is(point[2], -0)));
  assert.ok(cutter.source.includes('-0')); flow.signedZero = { authored: true, saved: true, cutterSourceAndModel: true };
  const outside = stage('lower-only above-outside', splitPart(cad, { level: 9, mode: 'lower' }).build);
  prove(convexBody(outside,'lower'), 7168); zBounds(convexBody(outside,'lower'), 0, 8);
  assert.equal(outside.evidence[2].native.positive.kind, 'empty'); assert.deepEqual(convexBody(outside,'lower'), outside.evidence[2].native.request.parent);
  const rectangle = stage('translated clockwise 3by5 height3 at1', splitPart(cad, { rectangle: true, height: 3, level: 1 }).build);
  volumes(rectangle, 15, 30, 1, 3, 4);
  const plane = rectangle.evidence[2].native.request.cutter.model.objects[0];
  assert.deepEqual(plane.knotsU, [0, 0, 3, 3]); assert.deepEqual(plane.knotsV, [0, 0, 5, 5]);
  flow.nonPowerOfTwo = { lowerMM3: 15, upperMM3: 30, knotsU: plane.knotsU, knotsV: plane.knotsV, clockwiseAndTranslated: true };
  const beveled = stage('lower split side cardinal chamfer', splitPart(cad, { chamfer: true }).build);
  prove(convexBody(beveled,'lower'), 1776); prove(convexBody(beveled,'upper'), 5376);
  assert.deepEqual(beveled.evidence[3].native.metric.removedVolumeMM3, { numerator: '16', denominator: '1' });
  flow.chamfer = { lowerMM3: 1776, upperMM3: 5376, removedMM3: 16 };
  assert.equal(flow.evaluations, 10); assert.equal(flow.tessellations, 2); assert.equal(initial.save(), saved);
  flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = { pending, message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
