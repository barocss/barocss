import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { cardinalPart, prove, bounds, capPair } from './modeling-cardinal-split-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, ConvexPlanarSolidSplitError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-cardinal-split-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flow = { status: 'running', evaluations: 0, tessellations: 0, stages: [], refusals: [], fullTransitiveNativeCoverage: 'NOT_MEASURED',
  providerCounterScope: 'Provider nativeWork excludes the public wrapper compilation of each generated cutter source',
  entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex') };
const write = () => writeFileSync(resolve(directory, 'source-flow.json'), JSON.stringify(flow, null, 2) + '\n');
let pending = null;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++flow.evaluations <= 11); pending = label; const start = performance.now(), result = action();
  flow.stages.push({ label, elapsedMS: performance.now() - start }); pending = null; write(); return result;
};
const volumes = (result, negative, positive, axis, min, at, max, height = 8) => {
  prove(result.bodies.negative, negative); prove(result.bodies.positive, positive);
  bounds(result.bodies.negative, axis, min, at); bounds(result.bodies.positive, axis, at, max);
  for (const body of Object.values(result.bodies)) bounds(body, 2, 0, height);
  const native = result.evidence[2].native; capPair(native, axis);
  assert.deepEqual(native.report.volumeMM3.parent, { numerator: String(negative + positive), denominator: '1' });
  assert.deepEqual(native.report.volumeMM3.negative, result.bodies.negative.certificate.volumeMM3);
  assert.deepEqual(native.report.volumeMM3.positive, result.bodies.positive.certificate.volumeMM3);
};
try {
  const initial = stage('source X16', cardinalPart(cad).build), saved = initial.save();
  volumes(initial, 4096, 3072, 0, 0, 16, 32);
  assert.deepEqual(initial.features[2], { kind: 'split', index: 2, dependencies: [1] });
  flow.baseline = { volumesMM3: [4096, 3072], nativeWork: initial.evidence[2].native.report.nativeWork, conservation: initial.evidence[2].native.report.volumeMM3 };
  const components = Object.entries(initial.bodies).map(([name, body]) => {
    const result = tessellateConvexPlanarSolid(body, { maximumFanTriangles: 40 }); flow.tessellations++;
    assert.ok(result.report.triangleCount > 0);
    return { role: name, mesh: result.mesh, boundaries: result.boundaries, internalDiagonals: result.internalDiagonals, report: result.report,
      lineage: { kind: 'model-output', name, solidId: body.report.solidId,
        graph: { vertices: body.graph.vertices, faces: body.graph.faces, edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) } } };
  });
  flow.display = components.map(c => ({ name: c.role, triangles: c.report.triangleCount, nativeAuthority: c.report.nativeAuthority }));
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
    const outputs = Object.entries(initial.bodies).map(([name, body]) => ({ name, solidId: body.report.solidId, volumeMM3: body.certificate.volumeMM3 }));
    const transport = { id: 1, ok: true, text: saved,
      summary: { documentId: 'cad_model', revision: 0, source: 'model', parameters: initial.parameters, features: initial.features, outputs },
      display: { profile: 'model-outputs', documentId: 'cad_model', revision: 0, components, outcomes: outputs.map(o => ({ role: o.name, solidId: o.solidId, status: 'solid' })) } };
    const text = JSON.stringify(transport) + '\n'; assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    writeFileSync(resolve(output, 'baseline-transport.json'), text);
    flow.transport = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
  }
  const edited = stage('edit X24', () => initial.withParameters({ splitAt: 24 }));
  volumes(edited, 5888, 1280, 0, 0, 24, 32); assert.equal(initial.save(), saved);
  writeFileSync(resolve(directory, 'edited.cad-model.json'), edited.save());
  const y = stage('source Y16', cardinalPart(cad, { axis: 'y' }).build), ySaved = y.save();
  volumes(y, 4096, 3072, 1, 0, 16, 32);
  const yEdited = stage('edit Y24', () => y.withParameters({ splitAt: 24 }));
  volumes(yEdited, 5888, 1280, 1, 0, 24, 32); assert.equal(y.save(), ySaved);
  flow.axisEditVolumesMM3 = { x: [5888, 1280], y: [5888, 1280] };
  const xRectangle = stage('translated clockwise rectangle X2', cardinalPart(cad, { axis: 'x', at: 2, rectangle: true }).build);
  volumes(xRectangle, 15, 30, 0, 1, 2, 4, 3);
  const yRectangle = stage('translated clockwise rectangle Y3', cardinalPart(cad, { axis: 'y', at: 3, rectangle: true }).build);
  volumes(yRectangle, 9, 36, 1, 2, 3, 7, 3);
  const xp = xRectangle.evidence[2].native.request.cutter.model.objects[0], yp = yRectangle.evidence[2].native.request.cutter.model.objects[0];
  assert.deepEqual([xp.knotsU, xp.knotsV], [[0,0,5,5], [0,0,3,3]]);
  assert.deepEqual([yp.knotsU, yp.knotsV], [[0,0,3,3], [0,0,3,3]]);
  flow.clockwiseTranslated = { xVolumesMM3: [15,30], yVolumesMM3: [9,36], xKnots: [xp.knotsU,xp.knotsV], yKnots: [yp.knotsU,yp.knotsV] };
  for (const [label, accepted, text, at, side] of [
    ['X below-outside', initial, saved, -1, 'negative'], ['Y above-outside', y, ySaved, 33, 'positive'],
  ]) stage(label, () => {
    assert.throws(() => accepted.withParameters({ splitAt: at }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'SELECTION'); assert.equal(error.operation, 'split');
      assert.deepEqual(error.cause, { side, status: 'outside', sectionDimension: -1 }); assert.ok(Object.isFrozen(error.cause));
      flow.refusals.push({ label, code: error.code, operation: error.operation, message: error.message, cause: error.cause }); return true;
    });
    assert.equal(accepted.save(), text); prove(accepted.bodies.negative, 4096); prove(accepted.bodies.positive, 3072);
  });
  const xTangent = stage('positive-only X signed-zero tangent', cardinalPart(cad, { at: -0, mode: 'positive' }).build);
  const yTangent = stage('negative-only Y32 tangent', cardinalPart(cad, { axis: 'y', at: 32, mode: 'negative' }).build);
  for (const [result, side, empty] of [[xTangent,'positive','negative'], [yTangent,'negative','positive']]) {
    prove(result.bodies[side], 7168); assert.equal(result.evidence[2].native[empty].kind, 'empty');
    assert.equal(result.evidence[2].native.report.status, 'tangent'); assert.equal(result.evidence[2].native.section.dimension, 2);
    assert.deepEqual(result.bodies[side], result.evidence[2].native.request.parent);
  }
  assert.ok(Object.is(xTangent.parameters.splitAt, -0) && xTangent.save().includes('"splitAt":-0'));
  const cutter = xTangent.evidence[2].native.request.cutter;
  assert.ok(cutter.model.objects[0].controlPoints.flat().every(point => Object.is(point[0], -0))); assert.ok(cutter.source.includes('-0'));
  flow.tangentVolumesMM3 = [7168,7168]; flow.signedZero = { authored: true, saved: true, cutterSourceAndModel: true };
  stage('X non-dyadic crossing Y80/3', () => {
    assert.throws(() => initial.withParameters({ rearX: 20, splitAt: 24 }), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'split');
      assert.ok(error.cause instanceof ConvexPlanarSolidSplitError); assert.equal(error.cause.code, 'REPRESENTABILITY');
      flow.nativeRefusal = { code: error.code, operation: error.operation, cause: { name: error.cause.name, code: error.cause.code, stage: error.cause.stage, entity: error.cause.entity, message: error.cause.message } }; return true;
    });
    assert.equal(initial.save(), saved); prove(initial.bodies.negative, 4096); prove(initial.bodies.positive, 3072);
  });
  assert.equal(flow.evaluations, 11); assert.equal(flow.tessellations, 2); assert.equal(initial.save(), saved);
  flow.status = 'passed'; flow.actualGPU = 'UNRUN'; write();
} catch (error) { flow.status = 'failed'; flow.failure = { pending, message: error.message, stack: error.stack, cause: error.cause?.message }; write(); throw error; }
