import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Scene } from '@babylonjs/core/scene.js';
import { tessellateCoplanarFaceBooleanExtrusion, validateBooleanExtrusionFeatureGraph,
  validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph } from '@barocss/cad-interop/boolean-extrusion-feature-graph';
import { deriveBaroCadBooleanExtrusionFeatureMesh } from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import { createBaroCadBooleanExtrusionBabylonMesh } from '@barocss/cad-interop/babylon-boolean-extrusion-mesh';

const sourceFlag = process.argv.indexOf('--source');
assert(sourceFlag >= 0 && sourceFlag + 1 < process.argv.length, 'pass --source <saved #927 demo-output directory>');
const source = resolve(process.argv[sourceFlag + 1]);
const cases = [
  ['authentic_single_current_arrays', 'dc1141e3552d1c28c0595282ffcc5efb3751272909fe1373b5e97c0fd170d1b3', 0, [2]],
  ['three_shared_region_leaves', '720b97ffe660770ab42a26ea417a030b527720be7269f8514a2f6a47403e59c3', 0, [2, 3, 4]],
  ['shared_height_parameter_edit', 'ebf08856848c30dad0abcecca97a6af07d8177c06e5ffce4ef2694887e6c34eb', 1, [3, 4, 5]],
  ['atomic_all_leaf_parameter_repair', 'a057863f5f0a0aabdc0ab08b6cb3271b9ff4b715d0e6a6fc4bd19e37a0f8f931', 2, [4, 5, 6]],
  ['fourth_literal_extrusion_leaf', '63e2ad113d521ea2b00b7c9fe0553cbbf468bbe6ce4a6cc4190305027f365463', 3, [4, 5, 6, 7]],
  ['three_genuine_empty_leaves', '8b0edc228d2c828dbda1fe68e2ca19924c34bf0b12e8a26411672705163b5476', 0, [2, 3, 4]],
];
const graphOptionsFor = heights => ({ maximumParameterResolutions: 8,
  maximumFeatureEvaluations: heights.length + 3 });
const meshOptions = { meshId: 'shell_mesh', maximumVertices: 384, maximumTriangles: 288,
  maximumEdgePaths: 192, maximumNativeSamples: 1024 };
const displayOptions = { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = new Map(cases.map(([name, hash]) => {
  const bytes = readFileSync(resolve(source, `${name}.authored-graph.json`));
  assert.equal(sha256(bytes), hash, `${name}: saved authored bytes`);
  const paired = JSON.parse(readFileSync(resolve(source, `${name}.owned-graph-result.json`), 'utf8'));
  return [name, { bytes, paired, hash }];
}));
const server = createServer((request, response) => {
  const name = request.url?.slice('/saved/'.length);
  if (request.url?.startsWith('/saved/') && fixtures.has(name)) {
    const bytes = fixtures.get(name).bytes;
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length,
      connection: 'close' });
    response.end(bytes); return;
  }
  response.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const engine = new NullEngine(), scene = new Scene(engine);
scene.useRightHandedSystem = true;
const caller = new Mesh('caller-owned', scene);
const records = new Map();
let refused = 0, checkedPositions = 0, checkedNormals = 0, checkedUV = 0,
  checkedIndices = 0, checkedTrueEdgeCoordinates = 0, disposedResources = 0;
try {
  for (const [name, , revision, heights] of cases) {
    const fixture = fixtures.get(name);
    const graphOptions = graphOptionsFor(heights);
    const direct = readBaroCadBooleanExtrusionFeatureGraph(fixture.bytes.toString('utf8'), graphOptions);
    const http = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/saved/${name}`, graphOptions);
    assert.deepEqual(http, direct, `${name}: direct and HTTP results`);
    assert.deepEqual(http.native, fixture.paired, `${name}: saved current owned result`);
    assert.equal(http.native.document.revision, revision);
    assert.deepEqual(validateBooleanExtrusionFeatureGraph(http.native), http.native.report);
    assert.deepEqual(http.native.report.distances.map(row => row.valueMM), heights);
    assert.deepEqual(http.native.report.summary.extrusions.map(row => row.distanceMM), heights);
    assert.equal('distance' in http.native.report, false);
    assert.equal('distanceMM' in http.native.report.summary, false);
    const leaves = http.native.features.filter(row => row.kind === 'normal-extrusion');
    assert.equal(leaves.length, heights.length);
    assert.equal(http.native.features.length, heights.length + 3);
    assert.equal(http.native.report.nativeBuilderCallCount, heights.length + 3);
    assert.equal(http.native.report.qualifiedBindings.length, heights.length + 3);
    const meshes = new Map();
    for (const [index, leaf] of leaves.entries()) {
      const selection = { graphId: http.native.document.id, revision,
        featureId: leaf.featureId, outputSlotId: leaf.outputSlotId };
      const derived = deriveBaroCadBooleanExtrusionFeatureMesh(http.native, selection, meshOptions);
      assert.deepEqual(derived.binding, http.native.report.qualifiedBindings.find(row =>
        row.featureId === leaf.featureId && row.outputSlotId === leaf.outputSlotId));
      assert.deepEqual(derived.nativeMesh,
        tessellateCoplanarFaceBooleanExtrusion(leaf.evaluation, meshOptions));
      assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(derived.nativeMesh), derived.nativeMesh.report);
      assert.equal(derived.nativeMesh.report.extrusionEvaluationId, leaf.evaluation.options.evaluationId);
      assert.equal(derived.nativeMesh.report.empty, name === 'three_genuine_empty_leaves');
      assert.equal(http.native.report.summary.extrusions[index].featureId, leaf.featureId);
      assert.equal(http.native.report.summary.extrusions[index].outputSlotId, leaf.outputSlotId);
      const display = createBaroCadBooleanExtrusionBabylonMesh(scene, derived.nativeMesh, displayOptions);
      assert.deepEqual(display.shells.map(item => item.shellId),
        derived.nativeMesh.shellRanges.map(item => item.shellId));
      assert.equal(display.faces.length, derived.nativeMesh.report.faceRangeCount);
      assert.equal(display.edges.length, derived.nativeMesh.report.edgePathCount);
      assert.equal(display.root.getChildMeshes().length, display.faces.length);
      assert.equal(display.edgeRoot.getChildMeshes().length, display.edges.length);
      assert.equal(display.edgeRoot.isEnabled(), false);
      for (const face of display.faces) {
        assert(face.object instanceof Mesh && !(face.object instanceof LinesMesh));
        assert.deepEqual(face.face, derived.nativeMesh.faceRanges.find(row => row.faceId === face.face.faceId));
        assert.equal(face.extrusionEvaluationId, leaf.evaluation.options.evaluationId);
        assert.deepEqual(face.sourceAssetIds, derived.nativeMesh.mesh.binding.sourceAssetIds);
        const positions = face.object.getVerticesData('position');
        const normals = face.object.getVerticesData('normal');
        const uv = face.object.getVerticesData('_CAD_UV');
        assert.equal(face.object.getVerticesData('uv'), null);
        for (let i = 0; i < positions.length; i++) {
          assert(Object.is(positions[i], Math.fround(derived.nativeMesh.mesh.positionsMM[i] * 0.001)));
          checkedPositions++;
          assert(Object.is(normals[i], Math.fround(derived.nativeMesh.mesh.normals[i])));
          checkedNormals++;
        }
        for (let i = 0; i < uv.length; i++) {
          assert(Object.is(uv[i], Math.fround(derived.nativeMesh.mesh.parametersUV[i])));
          checkedUV++;
        }
        assert.deepEqual(Array.from(face.object.getIndices()),
          derived.nativeMesh.mesh.indices.slice(face.face.indexStart, face.face.indexStart + face.face.indexCount));
        checkedIndices += face.face.indexCount;
      }
      for (const edge of display.edges) {
        assert(edge.object instanceof LinesMesh);
        assert(!display.internalEdges.some(row => row.id === edge.path.edgeId));
        assert.deepEqual(edge.path, derived.nativeMesh.edgePaths.find(row => row.edgeId === edge.path.edgeId));
        const positions = edge.object.getVerticesData('position');
        const expected = edge.path.samples.flatMap(sample => sample.curveD1.point);
        assert.equal(positions.length, expected.length);
        for (let i = 0; i < positions.length; i++) {
          assert(Object.is(positions[i], Math.fround(expected[i] * 0.001)));
          checkedTrueEdgeCoordinates++;
        }
      }
      const disposed = [];
      for (const face of display.faces) {
        face.object.onDisposeObservable.add(() => disposed.push('face'));
        face.object.material.onDisposeObservable.add(() => disposed.push('material'));
      }
      for (const edge of display.edges) edge.object.onDisposeObservable.add(() => disposed.push('edge'));
      display.dispose(); display.dispose();
      assert.equal(disposed.length, 2 * display.faces.length + display.edges.length);
      disposedResources += disposed.length;
      assert(display.root.isDisposed() && display.edgeRoot.isDisposed());
      assert.deepEqual(scene.meshes, [caller]);
      meshes.set(leaf.featureId, { selection, derived });
    }
    assert.equal(new Set(leaves.map(row => row.evaluation.options.evaluationId)).size, leaves.length);
    assert.equal(new Set(leaves.flatMap(row => row.evaluation.shells.map(shell => shell.id))).size,
      leaves.reduce((sum, row) => sum + row.evaluation.shells.length, 0));
    records.set(name, { http, leaves, meshes });
    assert.equal(sha256(readFileSync(resolve(source, `${name}.authored-graph.json`))), fixture.hash);
  }
  const accepted = records.get('three_shared_region_leaves');
  const before = structuredClone(accepted.http.native);
  const chosen = accepted.meshes.get('leaf_middle');
  const expectedMesh = structuredClone(chosen.derived.nativeMesh);
  const acceptedDisplay = createBaroCadBooleanExtrusionBabylonMesh(scene, chosen.derived.nativeMesh, displayOptions);
  const previousMeshes = new Set(scene.meshes);
  for (const selection of [
    { ...chosen.selection, featureId: 'leaf_low', outputSlotId: 'leaf_slot_1' },
    { ...chosen.selection, featureId: 'leaf_middle', outputSlotId: 'leaf_slot_0' },
    { ...chosen.selection, revision: 1 },
    { ...chosen.selection, featureId: 'boolean_feature', outputSlotId: 'boolean_slot' },
    { ...chosen.selection, featureId: 'unknown' },
  ]) {
    assert.throws(() => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.http.native, selection, meshOptions));
    refused++;
  }
  const forged = structuredClone(accepted.http.native);
  forged.report.qualifiedBindings.at(-1).nativeReferences[0].nativeId = 'forged';
  assert.throws(() => deriveBaroCadBooleanExtrusionFeatureMesh(forged, chosen.selection, meshOptions));
  refused++;
  assert.throws(() => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.http.native,
    chosen.selection, { ...meshOptions, maximumTriangles: 0 }));
  refused++;
  scene.useRightHandedSystem = false;
  assert.throws(() => createBaroCadBooleanExtrusionBabylonMesh(scene, chosen.derived.nativeMesh, displayOptions));
  scene.useRightHandedSystem = true; refused++;
  assert.deepEqual(new Set(scene.meshes), previousMeshes);
  assert(acceptedDisplay.faces.every(face => !face.object.isDisposed()));
  assert.deepEqual(accepted.http.native, before);
  assert.deepEqual(chosen.derived.nativeMesh, expectedMesh);
  acceptedDisplay.dispose();
  assert.deepEqual(scene.meshes, [caller]);
} finally {
  scene.dispose(); engine.dispose();
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
console.log(JSON.stringify({ savedFiles: cases.length, outputCounts: cases.map(([, , , heights]) => heights.length),
  heightsMM: cases.map(([, , , heights]) => heights), emptyOutputs: 3, refused,
  directAndHttpEqual: true, currentPairedResultsEqual: true, exactPublicCadMeshes: true,
  siblingSelectionsQualified: true, checkedPositions, checkedNormals, checkedUV, checkedIndices,
  checkedTrueEdgeCoordinates, disposedResources, priorAcceptedAndSceneRetained: true }));
