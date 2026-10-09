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
import { validateBooleanExtrusionFeatureGraph, validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph } from '@barocss/cad-interop/boolean-extrusion-feature-graph';
import { deriveBaroCadBooleanExtrusionFeatureMesh } from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import { createBaroCadBooleanExtrusionBabylonMesh } from '@barocss/cad-interop/babylon-boolean-extrusion-mesh';

const sourceFlag = process.argv.indexOf('--source');
assert(sourceFlag >= 0 && sourceFlag + 1 < process.argv.length, 'pass --source <saved #922 directory>');
const directory = resolve(process.argv[sourceFlag + 1]);
const cases = [
  ['revision1_authentic', '3588850a7559512f77d7c02e6a9b3240240c93025742ec565c4f92526884f7c8', 10, 24],
  ['revision2_replace_face_a', 'c51b65f49f542654e4e8ed7fc175c4ab7dc4fcbdb89a7c36487beaa283a64cfd', 10, 24],
  ['revision3_replace_boolean', 'deee6fd9bb1b32a1a6c84528679b7a26ceff5cfa132212e4de9268e2c3bd9179', 6, 12],
  ['revision4_replace_extrusion', 'bb50d7c96035fdfca3d84ef89cc5f66e0bbd9df317cdc01bc0fad288218cf073', 6, 12],
  ['revision5_replace_both_inputs', 'cd13203b4ffa5ebfad263ce29d8d676c801c0234e1ec405f19d0357788050d2a', 6, 12],
  ['revision6_replace_complete_chain', '95af544e92f0bc8ea9574c7d5bca286309d94e8dfaeacca9aa8132ed80cc71fc', 6, 12],
];
const graphOptions = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 4 };
const meshOptions = { meshId: 'shell_mesh', maximumVertices: 384, maximumTriangles: 288,
  maximumEdgePaths: 192, maximumNativeSamples: 1024 };
const displayOptions = { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = new Map(cases.map(([name, hash]) => {
  const bytes = readFileSync(resolve(directory, `${name}.authored-graph.json`));
  assert.equal(sha256(bytes), hash, `${name}: exact saved authored file`);
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
const engine = new NullEngine(), scene = new Scene(engine);
scene.useRightHandedSystem = true;
const caller = new Mesh('caller-owned', scene);
let evidence;
try {
  const outputs = new Map();
  let checkedPositions = 0, checkedUV = 0, checkedTrueEdgeCoordinates = 0, disposedResources = 0;
  for (const [name, , faces, edges] of cases) {
    const fixture = fixtures.get(name);
    const read = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/saved/${name}`, graphOptions);
    assert.deepEqual(Buffer.from(read.authoredText, 'utf8'), fixture.bytes);
    assert.deepEqual(read, readBaroCadBooleanExtrusionFeatureGraph(fixture.bytes.toString('utf8'), graphOptions));
    assert.deepEqual(read.native, fixture.paired);
    assert.deepEqual(validateBooleanExtrusionFeatureGraph(read.native), read.native.report);
    const extrusion = read.native.features.find(row => row.kind === 'normal-extrusion');
    const selection = { graphId: read.native.document.id, revision: read.native.document.revision,
      featureId: extrusion.featureId, outputSlotId: extrusion.outputSlotId };
    const derived = deriveBaroCadBooleanExtrusionFeatureMesh(read.native, selection, meshOptions);
    assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(derived.nativeMesh), derived.nativeMesh.report);
    assert.equal(derived.binding.featureId, selection.featureId);
    const display = createBaroCadBooleanExtrusionBabylonMesh(scene, derived.nativeMesh, displayOptions);
    assert.equal(display.shells.length, 1);
    assert.equal(display.faces.length, faces);
    assert.equal(display.edges.length, edges);
    assert.equal(display.root.getChildMeshes().length, faces);
    assert.equal(display.edgeRoot.getChildMeshes().length, edges);
    assert.equal(display.edgeRoot.isEnabled(), false);
    assert.deepEqual(display.shells.map(item => item.shellId),
      derived.nativeMesh.shellRanges.map(item => item.shellId));
    for (const item of display.faces) {
      assert(item.object instanceof Mesh && !(item.object instanceof LinesMesh));
      assert.deepEqual(item.sourceAssetIds, derived.nativeMesh.mesh.binding.sourceAssetIds);
      const positions = item.object.getVerticesData('position');
      const uv = item.object.getVerticesData('_CAD_UV');
      assert.equal(item.object.getVerticesData('uv'), null);
      for (let i = 0; i < positions.length; i++) {
        assert(Object.is(positions[i], Math.fround(derived.nativeMesh.mesh.positionsMM[i] * 0.001)));
        checkedPositions++;
      }
      for (let i = 0; i < uv.length; i++) {
        assert(Object.is(uv[i], Math.fround(derived.nativeMesh.mesh.parametersUV[i])));
        checkedUV++;
      }
    }
    for (const item of display.edges) {
      assert(item.object instanceof LinesMesh);
      assert(!display.internalEdges.some(edge => edge.id === item.path.edgeId));
      const actual = item.object.getVerticesData('position');
      const expected = item.path.samples.flatMap(sample => sample.curveD1.point);
      assert.equal(actual.length, expected.length);
      for (let i = 0; i < actual.length; i++) {
        assert(Object.is(actual[i], Math.fround(expected[i] * 0.001)));
        checkedTrueEdgeCoordinates++;
      }
    }
    const disposed = [];
    for (const item of display.faces) {
      item.object.onDisposeObservable.add(() => disposed.push('face'));
      item.object.material.onDisposeObservable.add(() => disposed.push('material'));
    }
    for (const item of display.edges) item.object.onDisposeObservable.add(() => disposed.push('edge'));
    display.dispose(); display.dispose();
    assert.equal(disposed.length, 2 * faces + edges);
    disposedResources += disposed.length;
    assert(display.root.isDisposed() && display.edgeRoot.isDisposed());
    assert(!caller.isDisposed() && scene.meshes.includes(caller));
    outputs.set(name, { read, selection, derived });
  }
  assert.notDeepEqual(outputs.get('revision1_authentic').derived.nativeMesh.mesh.positionsMM,
    outputs.get('revision3_replace_boolean').derived.nativeMesh.mesh.positionsMM);
  const accepted = outputs.get('revision6_replace_complete_chain');
  const display = createBaroCadBooleanExtrusionBabylonMesh(scene, accepted.derived.nativeMesh, displayOptions);
  const previousMeshes = new Set(scene.meshes), previousGraph = structuredClone(accepted.read.native);
  let refused = 0;
  for (const action of [
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.read.native,
      { ...accepted.selection, revision: 5 }, meshOptions),
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.read.native,
      { ...accepted.selection, outputSlotId: 'wrong' }, meshOptions),
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.read.native, accepted.selection,
      { ...meshOptions, maximumTriangles: 0 }),
    () => { const forged = structuredClone(accepted.read.native);
      forged.report.qualifiedBindings.at(-1).nativeReferences[0].nativeId = 'forged';
      return deriveBaroCadBooleanExtrusionFeatureMesh(forged, accepted.selection, meshOptions); },
  ]) { assert.throws(action); refused++; }
  scene.useRightHandedSystem = false;
  assert.throws(() => createBaroCadBooleanExtrusionBabylonMesh(scene, accepted.derived.nativeMesh, displayOptions));
  scene.useRightHandedSystem = true; refused++;
  assert.deepEqual(new Set(scene.meshes), previousMeshes);
  assert.deepEqual(accepted.read.native, previousGraph);
  assert(display.faces.every(item => !item.object.isDisposed()));
  display.dispose();
  assert(!caller.isDisposed() && !scene.isDisposed);
  for (const [, fixture] of fixtures) assert.equal(sha256(fixture.bytes), fixture.hash);
  evidence = { savedRevisions: cases.length, faces: cases.map(item => item[2]),
    trueEdges: cases.map(item => item[3]), checkedPositions, checkedUV, checkedTrueEdgeCoordinates,
    refused, disposedResources, exactAuthoredAndPairedResults: true,
    revisionChangedGeometry: true, priorGraphAndSceneRetained: true };
} finally {
  scene.dispose(); engine.dispose();
  server.closeAllConnections(); server.close();
  await once(server, 'close');
}
console.log(JSON.stringify(evidence));
