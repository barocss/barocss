import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, statfsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { overlap, prove } from './modeling-intersection-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'), 'Run the native campaign with --no-opt');
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE ?? new URL('../dist/index.js', import.meta.url).pathname);
const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-intersection-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const stages = [], write = (file, value) => writeFileSync(resolve(directory, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
let pending = null, models = 0;
const stage = (label, action) => {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(++models <= 7); pending = label;
  const start = performance.now(), result = action();
  stages.push({ label, elapsedMS: performance.now() - start }); pending = null;
  write('source-stages.json', { entry, entrySHA256: createHash('sha256').update(readFileSync(entry)).digest('hex'), stages });
  return result;
};
try {
  const fixture = overlap(cad);
  // Authoring refusals must not consume the only Boolean slot or change this graph.
  assert.throws(() => fixture.blank.intersect(fixture.tool), error => error.code === 'CAPABILITY');
  assert.throws(() => fixture.blank.cut(fixture.tool, { axis: 'x' }), error => error.code === 'CAPABILITY');
  const initial = stage('source overlap', fixture.build), saved = initial.save();
  prove(convexBody(initial,'overlap'), 2176, [7, 15, 10]);
  assert.deepEqual(initial.features.map(f => f.kind), ['sketch', 'extrude', 'sketch', 'extrude', 'intersect']);
  assert.deepEqual(initial.features[4].dependencies, [1, 3]);
  const native = initial.evidence[4].native;
  assert.equal(native.outcome.solid, convexBody(initial,'overlap'));
  assert.equal(native.report.status, 'solid'); assert.equal(native.contact.dimension, 3);
  assert.ok(native.lineage.faces.some(face => new Set(face.sources.map(source => source.operand)).size === 2));
  assert.ok(Object.is(initial.evidence[0].native.document.points[0].position[0], -0));
  write('initial.cad-model.json', saved);
  const mesh = tessellateConvexPlanarSolid(convexBody(initial,'overlap'), { maximumFanTriangles: 40 });
  assert.ok(mesh.report.triangleCount > 0);
  assert.equal(mesh.mesh.indices.length % 3, 0);
  write('display.json', { namedOutput: 'overlap', vertices: mesh.mesh.positionsMM.length / 3, triangles: mesh.mesh.indices.length / 3, report: mesh.report });
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
    const body = convexBody(initial,'overlap');
    const transport = { id: 1, ok: true, text: saved,
      summary: { documentId: 'cad_model', revision: 0, source: 'model', parameters: initial.parameters,
        features: initial.features, outputs: [{ name: 'overlap', solidId: body.report.solidId, volumeMM3: body.certificate.volumeMM3 }] },
      display: { profile: 'model-outputs', documentId: 'cad_model', revision: 0,
        components: [{ role: 'overlap', mesh: mesh.mesh, boundaries: mesh.boundaries, internalDiagonals: mesh.internalDiagonals, report: mesh.report,
          lineage: { kind: 'model-output', name: 'overlap', solidId: body.report.solidId,
            graph: { vertices: body.graph.vertices, faces: body.graph.faces, edges: body.graph.edges.map(({ id, vertexIds, uses }) => ({ id, vertexIds, uses })) } } }],
        outcomes: [{ role: 'overlap', solidId: body.report.solidId, status: 'solid' }] } };
    const text = JSON.stringify(transport); assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    writeFileSync(resolve(output, 'baseline-transport.json'), text + '\n');
  }
  const edited = stage('move tool bounds +8', () => initial.withParameters({ leftX: 16, rightX: 48 }));
  prove(convexBody(edited,'overlap'), 1408, [7, 15, 10]); write('edited.cad-model.json', edited.save());
  const refuse = (label, edits, dimension) => stage(label, () => {
    assert.throws(() => initial.withParameters(edits), error => {
      assert.ok(error instanceof CadModelError); assert.equal(error.operation, 'intersect');
      if (dimension !== null) {
        assert.equal(error.code, 'SELECTION'); assert.equal(error.cause.contactDimension, dimension);
        assert.ok(error.message.includes(`contact dimension ${dimension}`)); assert.ok(Object.isFrozen(error.cause));
      } else {
        assert.equal(error.code, 'NATIVE'); assert.ok(error.cause instanceof Error); assert.equal(error.cause.code, 'REPRESENTABILITY');
      }
      write(label + '.refusal.json', { code: error.code, operation: error.operation, message: error.message,
        causeName: error.cause?.name, causeCode: error.cause?.code, causeStage: error.cause?.stage,
        contactDimension: error.cause?.contactDimension });
      return true;
    });
    assert.equal(initial.save(), saved); prove(convexBody(initial,'overlap'), 2176, [7, 15, 10]);
  });
  refuse('disjoint', { leftX: 64, rightX: 96 }, -1);
  refuse('face-touch', { leftX: 32, rightX: 64 }, 2);
  refuse('edge-touch', { leftX: 32, rightX: 64, lowY: 16, highY: 48 }, 1);
  refuse('non-dyadic', { rearX: 20, leftX: 24, rightX: 56, highY: 56 }, null);
  const beveled = stage('intersection then cardinal chamfer', overlap(cad, true).build);
  prove(convexBody(beveled,'overlap'), 2164, [8, 18, 12]);
  assert.deepEqual(beveled.evidence[5].native.metric.removedVolumeMM3, { numerator: '12', denominator: '1' });
  assert.equal(beveled.evidence[5].native.split.request.parent.request.options.solidId, beveled.evidence[4].native.outcome.solid.request.options.solidId);
  write('chamfer.cad-model.json', beveled.save());
  assert.equal(initial.save(), saved); assert.equal(models, 7);
  write('source-result.json', { status: 'passed', evaluations: models, tessellations: 1, stages,
    initial: { volumeMM3: 2176, faces: 7, edges: 15, vertices: 10 }, editedVolumeMM3: 1408, chamferVolumeMM3: 2164,
    providerWork: native.report.nativeWork, clipWork: native.report.clipWork,
    actualGPU: 'UNRUN', fullTransitiveNativeCoverage: 'NOT_MEASURED' });
} catch (error) {
  write('source-failure.json', { pending, models, stages, message: error.message, stack: error.stack, cause: error.cause?.message });
  throw error;
}
