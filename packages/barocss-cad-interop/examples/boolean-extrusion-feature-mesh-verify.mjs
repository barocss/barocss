import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { evaluateBooleanExtrusionFeatureGraph, tessellateCoplanarFaceBooleanExtrusion, validateBooleanExtrusionFeatureGraph,
  validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph } from '@barocss/cad-interop/boolean-extrusion-feature-graph';
import { deriveBaroCadBooleanExtrusionFeatureMesh } from '@barocss/cad-interop/boolean-extrusion-feature-mesh';

const argument = name => {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && index + 1 < process.argv.length, `pass ${name} <saved CAD directory>`);
  return resolve(process.argv[index + 1]);
};
const source = argument('--source');
const topology = argument('--topology');
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 4 };
const meshOptions = { meshId: 'shell_mesh', maximumVertices: 384, maximumTriangles: 288,
  maximumEdgePaths: 192, maximumNativeSamples: 1024 };
const cases = [
  ['revision1_authentic', '3588850a7559512f77d7c02e6a9b3240240c93025742ec565c4f92526884f7c8', source],
  ['revision2_replace_face_a', 'c51b65f49f542654e4e8ed7fc175c4ab7dc4fcbdb89a7c36487beaa283a64cfd', source],
  ['revision3_replace_boolean', 'deee6fd9bb1b32a1a6c84528679b7a26ceff5cfa132212e4de9268e2c3bd9179', source],
  ['revision4_replace_extrusion', 'bb50d7c96035fdfca3d84ef89cc5f66e0bbd9df317cdc01bc0fad288218cf073', source],
  ['revision5_replace_both_inputs', 'cd13203b4ffa5ebfad263ce29d8d676c801c0234e1ec405f19d0357788050d2a', source],
  ['revision6_replace_complete_chain', '95af544e92f0bc8ea9574c7d5bca286309d94e8dfaeacca9aa8132ed80cc71fc', source],
  ['containment_hole', '24c437a19d98f2e87fc4a69d488b17268c2e1aa93e2c7b0a6c3a18e45f2d72d2', topology],
  ['reverse_containment_empty', 'f62f23911362d3cc5a9dbbef5381f16f382894fb155d81407373bcffccdcc87a', topology],
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = new Map(cases.map(([name, hash, directory]) => {
  const bytes = readFileSync(resolve(directory, `${name}.authored-graph.json`));
  assert.equal(sha256(bytes), hash, `${name}: exact saved file`);
  const paired = JSON.parse(readFileSync(resolve(directory, `${name}.owned-graph-result.json`), 'utf8'));
  return [name, { bytes, hash, paired }];
}));
const server = createServer((request, response) => {
  const name = request.url?.slice('/saved/'.length);
  if (request.url?.startsWith('/saved/') && fixtures.has(name)) {
    const bytes = fixtures.get(name).bytes;
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
    response.end(bytes); return;
  }
  response.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let evidence;
try {
  const outputs = new Map();
  for (const [name] of cases) {
    const fixture = fixtures.get(name);
    const loaded = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/saved/${name}`, options);
    assert.deepEqual(Buffer.from(loaded.authoredText, 'utf8'), fixture.bytes);
    assert.deepEqual(loaded, readBaroCadBooleanExtrusionFeatureGraph(fixture.bytes.toString('utf8'), options));
    assert.deepEqual(loaded.native, evaluateBooleanExtrusionFeatureGraph(fixture.paired.document,
      fixture.paired.options), `${name}: current result rebuilt from saved authored intent`);
    assert.deepEqual(validateBooleanExtrusionFeatureGraph(loaded.native), loaded.native.report);
    const extrusion = loaded.native.features.find(feature => feature.kind === 'normal-extrusion');
    assert(extrusion, `${name}: evaluated extrusion`);
    const selection = { graphId: loaded.native.document.id, revision: loaded.native.document.revision,
      featureId: extrusion.featureId, outputSlotId: extrusion.outputSlotId };
    const { binding, nativeMesh } = deriveBaroCadBooleanExtrusionFeatureMesh(loaded.native, selection, meshOptions);
    const expectedBinding = loaded.native.report.qualifiedBindings.find(row => row.featureId === extrusion.featureId);
    assert.deepEqual(binding, expectedBinding);
    assert.equal(binding.kind, 'normal-extrusion');
    assert.deepEqual(nativeMesh, tessellateCoplanarFaceBooleanExtrusion(extrusion.evaluation, meshOptions));
    assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(nativeMesh), nativeMesh.report);
    assert.equal(nativeMesh.report.extrusionEvaluationId, extrusion.evaluation.options.evaluationId);
    assert.deepEqual(nativeMesh.mesh.binding.sourceAssetIds, binding.sources.map(item => item.assetId));
    assert(nativeMesh.edgePaths.every(path => path.samples.length === 3));
    assert(nativeMesh.faceRanges.every(face => face.internalEdges.every(edge =>
      edge.kind.startsWith('display-'))));
    outputs.set(name, { loaded, selection, binding, nativeMesh });
  }
  const revisions = cases.slice(0, 6).map(([name]) => outputs.get(name).nativeMesh);
  assert.deepEqual(revisions[0].mesh.positionsMM, revisions[1].mesh.positionsMM,
    'face replacement retains these exact display positions');
  assert.notEqual(outputs.get('revision1_authentic').loaded.native.document.features.find(row =>
    row.kind === 'face-input' && row.id.startsWith('face_a')).id,
  outputs.get('revision2_replace_face_a').loaded.native.document.features.find(row =>
    row.kind === 'face-input' && row.id.startsWith('face_a')).id);
  assert.notDeepEqual(revisions[1].mesh.positionsMM, revisions[2].mesh.positionsMM);
  assert.notEqual(outputs.get('revision3_replace_boolean').binding.featureId,
    outputs.get('revision6_replace_complete_chain').binding.featureId);
  assert.equal(outputs.get('containment_hole').nativeMesh.report.holeCount, 1);
  assert.equal(outputs.get('reverse_containment_empty').nativeMesh.report.empty, true);
  assert.equal(outputs.get('reverse_containment_empty').nativeMesh.report.triangleCount, 0);

  const accepted = outputs.get('revision6_replace_complete_chain');
  const acceptedGraph = structuredClone(accepted.loaded.native);
  const acceptedMesh = structuredClone(accepted.nativeMesh);
  const reject = (graph, selection, opts = meshOptions) => {
    assert.throws(() => deriveBaroCadBooleanExtrusionFeatureMesh(graph, selection, opts));
    assert.deepEqual(accepted.loaded.native, acceptedGraph);
    assert.deepEqual(accepted.nativeMesh, acceptedMesh);
  };
  let refused = 0;
  for (const change of [{ graphId: 'wrong' }, { revision: 5 }, { featureId: 'wrong' },
    { outputSlotId: 'wrong' }]) { reject(accepted.loaded.native, { ...accepted.selection, ...change }); refused++; }
  for (const kind of ['face-input', 'coplanar-boolean']) {
    const feature = accepted.loaded.native.features.find(row => row.kind === kind);
    reject(accepted.loaded.native, { ...accepted.selection, featureId: feature.featureId,
      outputSlotId: feature.outputSlotId }); refused++;
  }
  reject(accepted.loaded.native, { ...accepted.selection, extra: 1 }); refused++;
  reject(accepted.loaded.native, { ...accepted.selection, revision: NaN }); refused++;
  reject(accepted.loaded.native, accepted.selection, { ...meshOptions, maximumTriangles: 0 }); refused++;
  const forged = structuredClone(accepted.loaded.native);
  forged.report.qualifiedBindings.at(-1).nativeReferences[0].nativeId = 'forged';
  reject(forged, accepted.selection); refused++;
  for (const [, fixture] of fixtures) assert.equal(sha256(fixture.bytes), fixture.hash);
  evidence = { savedFiles: cases.length, featureRevisions: 6, refused,
    triangleCounts: cases.map(([name]) => outputs.get(name).nativeMesh.report.triangleCount),
    edgePathCounts: cases.map(([name]) => outputs.get(name).nativeMesh.report.edgePathCount),
    featureIds: cases.slice(0, 6).map(([name]) => outputs.get(name).binding.featureId),
    currentResultsRebuiltFromAuthored: true, exactPublicCadMeshes: true, qualifiedBindings: true,
    topology: { hole: true, empty: true }, priorFilesGraphsAndMeshRetained: true,
    work: 'each read, graph validation, tessellation and mesh validation reconstructs separately' };
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
console.log(JSON.stringify(evidence));
