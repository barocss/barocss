import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  tessellateQualifiedTranslatedStripBody,
  validateQualifiedTranslatedStripBodyMesh,
  QualifiedTranslatedStripBodyMeshError
} from '@barocss/cad';
import type {
  QualifiedTranslatedStripBodyResult,
  QualifiedTranslatedStripBodyMeshOptions
} from '@barocss/cad';

// This selected source-profile consumer runs from apps/library-docs.
// It consumes the complete supplied Body; it invokes no parent producer or demo.
const sourceProfile = '29f8934a63b449ecf1491e371e23b70e94d23fb1';
const inputPath = 'docs/public/examples/body-boundary-mesh/main.owned-body.json';
const inputBytes = readFileSync(resolve(inputPath));
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const inputHash = sha256(inputBytes);
assert.equal(inputBytes.length, 1997294);
assert.equal(inputHash, '6aa430ecc7775159b4bef758ab21363a75f186d84d15c8c4a56e8c00e2e6097d');
const body = JSON.parse(inputBytes.toString('utf8')) as QualifiedTranslatedStripBodyResult;
const originalBody = structuredClone(body);
const options: QualifiedTranslatedStripBodyMeshOptions = {
  evaluationId: 'main_mesh_eval', meshId: 'main_mesh',
  subdivisionsPerOriginalUSpan: 4, subdivisionsT: 4, subdivisionsW: 4,
  maximumVertices: 290, maximumTriangles: 576, maximumNativeSamples: 1104
};
const originalOptions = structuredClone(options);
const mesh = tessellateQualifiedTranslatedStripBody(body, options);
const report = validateQualifiedTranslatedStripBodyMesh(mesh);
assert.deepEqual(report, mesh.report);
assert.deepEqual(body, originalBody);
assert.deepEqual(options, originalOptions);
assert.deepEqual(mesh.body, originalBody);

function objectSet(value: unknown, result = new Set<object>()): Set<object> {
  if (value !== null && typeof value === 'object' && !result.has(value)) {
    result.add(value);
    for (const child of Object.values(value)) objectSet(child, result);
  }
  return result;
}
const callerObjects = objectSet(body);
assert.ok([...objectSet(mesh.body)].every(value => !callerObjects.has(value)));
assert.notEqual(report, mesh.report);
assert.notEqual(report.directCounts, mesh.report.directCounts);
assert.deepEqual(mesh.body.models.map(model => model.model.objects.length), [16, 2]);
assert.deepEqual([mesh.body.vertices.length, mesh.body.edges.length, mesh.body.faces.length,
  mesh.body.faces.reduce((sum, face) => sum + face.loop.uses.length, 0)], [8, 12, 6, 24]);
assert.equal(mesh.body.report.volumeMM3, 520);
assert.deepEqual(mesh.body.report.exactVolumeMM3, { numerator: '520', denominator: '1' });
assert.deepEqual([report.vertexCount, report.triangleCount, report.meshEdgeCount,
  report.faceSampleCount, report.useSampleCount, report.renderVertexCount], [290, 576, 864, 390, 216, 1728]);
assert.equal(report.spanCount, 4);
assert.equal(report.uStationCount, 17);
assert.equal(mesh.renderChunks.length, 6);
assert.equal(mesh.packet.positionEncoding, 'binary64-number');
assert.equal(mesh.packet.indexEncoding, 'uint32-number');
assert.equal(mesh.packet.lengthUnit, 'mm');
assert.equal(mesh.packet.sourceFrame, 'authored-xyz-no-axis-conversion');
assert.equal(mesh.packet.positionsMM.length, 290 * 3);
assert.equal(mesh.packet.indices.length, 576 * 3);
assert.ok(mesh.packet.positionsMM.every(Number.isFinite));
assert.ok(mesh.packet.indices.every(index => Number.isInteger(index) && index >= 0 && index < 290));
assert.deepEqual(mesh.packet.indices, mesh.packet.triangles.flatMap(triangle => triangle.vertexIndices));
assert.equal(mesh.proof.eulerCharacteristic, 2);
assert.equal(mesh.proof.connectedTriangles, true);
assert.equal(mesh.proof.connectedVertices, true);
assert.equal(mesh.proof.edgeIncidence.length, 864);
assert.ok(mesh.proof.edgeIncidence.every(edge => edge.uses.length === 2
  && edge.uses[0].from === edge.uses[1].to && edge.uses[0].to === edge.uses[1].from));
assert.equal(mesh.proof.vertexLinks.length, 290);

const evaluated = mesh.faceSamples.filter(sample => sample.d1.status === 'evaluated');
const refusedC0 = mesh.faceSamples.filter(sample => sample.d1.status === 'refused-c0');
assert.equal(evaluated.length, 345);
assert.equal(refusedC0.length, 45);
for (const sample of evaluated) {
  assert.equal(sample.d1.status, 'evaluated');
  if (sample.d1.status !== 'evaluated') throw Error('Expected evaluated D1');
  assert.ok(sample.d1.orientedNormal.every(Number.isFinite));
}
for (const sample of refusedC0) {
  assert.equal(sample.d1.status, 'refused-c0');
  if (sample.d1.status !== 'refused-c0') throw Error('Expected refused C0');
  assert.equal(sample.d1.point, null);
  assert.equal(sample.d1.du, null);
  assert.equal(sample.d1.dv, null);
  assert.equal(sample.d1.orientedNormal, null);
}
assert.deepEqual(mesh.renderChunks.map(chunk => chunk.role), ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax']);
const chunkSummary = mesh.renderChunks.map(chunk => {
  const vertices = chunk.positionsMM.length / 3;
  assert.equal(chunk.normalSource, 'approximate-triangle-geometry');
  assert.equal(chunk.positionEncoding, 'float32-number');
  assert.equal(chunk.normalEncoding, 'float32-number');
  assert.equal(chunk.uvEncoding, 'binary64-number');
  assert.equal(chunk.indexEncoding, 'uint32-number');
  assert.equal(chunk.normals.length, vertices * 3);
  assert.equal(chunk.parametersUV.length, vertices * 2);
  assert.equal(chunk.indices.length, vertices);
  assert.equal(chunk.authorityIndices.length, vertices);
  assert.equal(chunk.faceSampleIndices.length, vertices);
  assert.equal(chunk.triangleIndices.length, vertices / 3);
  for (let corner = 0; corner < vertices; corner++) {
    assert.equal(chunk.indices[corner], corner);
    const authority = chunk.authorityIndices[corner];
    assert.ok(Number.isInteger(authority) && authority >= 0 && authority < 290);
    const triangle = mesh.packet.triangles[chunk.triangleIndices[Math.floor(corner / 3)]];
    assert.equal(triangle.faceId, chunk.faceId);
    assert.equal(triangle.role, chunk.role);
    assert.equal(triangle.vertexIndices[corner % 3], authority);
    assert.equal(triangle.faceSampleIndices[corner % 3], chunk.faceSampleIndices[corner]);
    const sample = mesh.faceSamples[chunk.faceSampleIndices[corner]];
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Object.is(chunk.positionsMM[corner * 3 + axis],
        Math.fround(mesh.packet.positionsMM[authority * 3 + axis])));
      assert.ok(Number.isFinite(chunk.normals[corner * 3 + axis]));
    }
    assert.ok(Math.abs(Math.hypot(...chunk.normals.slice(corner * 3, corner * 3 + 3)) - 1) <= 1e-5);
    for (let axis = 0; axis < 2; axis++) {
      assert.ok(Object.is(chunk.parametersUV[corner * 2 + axis], sample.uv[axis]));
    }
  }
  return { role: chunk.role, faceId: chunk.faceId, vertices, triangles: vertices / 3,
    normalSource: chunk.normalSource, positionEncoding: chunk.positionEncoding };
});
assert.deepEqual(chunkSummary.map(chunk => [chunk.vertices, chunk.triangles]), [
  [384, 128], [384, 128], [384, 128], [384, 128], [96, 32], [96, 32]
]);
for (const name of ['closedIndexedManifold', 'parentFlagsUnchanged', 'approximateTriangles',
  'facetNormalsApproximate', 'float32DisplayValidated'] as const) assert.equal(report.quality[name], true);
for (const name of ['welding', 'snapping', 'meshGeometricEmbedding', 'globalApproximationError',
  'newSolidCertification', 'manufacturing', 'rendererAcceptance', 'loaderAcceptance', 'publication'] as const) {
  assert.equal(report.quality[name], false);
}
assert.equal(report.workScope, 'new-root-native-attempts-parent-validation-work-retained-and-excluded');
assert.equal(report.directCounts.nativeAttemptCount, 1104);
assert.equal(report.directCounts.surfaceD1EvaluatedCount, 345);
assert.equal(report.directCounts.surfaceD1RefusedCount, 45);
for (const name of ['sourceCompilationCount', 'sourceWriterCount', 'newBodyConstructionCount',
  'rationalFloatConversionCount', 'rootSolverCount'] as const) assert.equal(report.directCounts[name], 0);

let accepted = mesh;
const acceptedReference = accepted;
const acceptedValue = structuredClone(accepted);
const tampered = structuredClone(mesh);
tampered.packet.positionsMM[0] += .125;
let refusalCode: string | null = null;
try {
  validateQualifiedTranslatedStripBodyMesh(tampered);
  accepted = tampered;
} catch (error) {
  assert.ok(error instanceof QualifiedTranslatedStripBodyMeshError);
  assert.equal(error.code, 'OWNED');
  refusalCode = error.code;
}
assert.equal(refusalCode, 'OWNED');
assert.equal(accepted, acceptedReference);
assert.deepEqual(accepted, acceptedValue);
assert.deepEqual(body, originalBody);
const reread = readFileSync(resolve(inputPath));
assert.deepEqual(reread, inputBytes);
assert.equal(sha256(reread), inputHash);

function negativeZeroCount(value: unknown): number {
  if (typeof value === 'number') return Object.is(value, -0) ? 1 : 0;
  if (value !== null && typeof value === 'object') {
    return Object.values(value).reduce<number>((sum, child) => sum + negativeZeroCount(child), 0);
  }
  return 0;
}
// Extract display vectors only after successful complete mesh admission.
// These summary vectors are not a serialized complete Body or mesh authority.
const receipt = {
  format: 'barocss-docs-body-mesh-consumer-v1', status: 'passed', sourceProfile,
  node: process.version,
  input: { path: inputPath, bytes: inputBytes.length, sha256: inputHash, bytesRetained: true },
  nativeBody: { vertices: 8, edges: 12, faces: 6, uses: 24, modelObjects: [16, 2],
    volumeMM3: mesh.body.report.volumeMM3, exactVolumeMM3: mesh.body.report.exactVolumeMM3,
    negativeZeroNumbers: negativeZeroCount(mesh.body), completeValueRetained: true, copied: true },
  options, vertexCount: report.vertexCount, triangleCount: report.triangleCount,
  meshEdgeCount: report.meshEdgeCount, faceSampleCount: report.faceSampleCount,
  useSampleCount: report.useSampleCount, renderVertexCount: report.renderVertexCount,
  nativeNormals: { evaluated: evaluated.length, refusedC0: refusedC0.length, refusedNormalsNull: true },
  chunks: chunkSummary, quality: report.quality, directCounts: report.directCounts,
  workScope: report.workScope, reportCopied: true,
  refusal: { edit: 'packet.positionsMM[0] += .125', code: refusalCode,
    acceptedReferenceAndValueRetained: true },
  visualization: {
    positionsMM: [...mesh.packet.positionsMM], indices: [...mesh.packet.indices],
    triangles: mesh.packet.triangles.map(triangle => ({ role: triangle.role,
      faceId: triangle.faceId, vertexIndices: [...triangle.vertexIndices] })),
    edgePaths: mesh.edgePaths.map(edge => ({ role: edge.role, edgeId: edge.edgeId,
      vertexIndices: edge.samples.map(sample => sample.vertexIndex) })),
    bounds: mesh.packet.bounds
  },
  scope: 'One fixed-profile CPU tessellation and full owned validation of a complete original Body. Display vectors follow admission and are not complete serialized mesh authority. Indexed topology and approximate facet chunks are distinct from parent material proof; no renderer/Loader, new Solid, geometric embedding, global error, manufacturing or publication claim.'
};
writeFileSync(resolve('evidence/body-mesh-consumer.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, sourceProfile,
  vertices: receipt.vertexCount, triangles: receipt.triangleCount,
  chunks: receipt.chunks.length, nativeNormals: receipt.nativeNormals,
  refusal: refusalCode, acceptedRetained: true }));
