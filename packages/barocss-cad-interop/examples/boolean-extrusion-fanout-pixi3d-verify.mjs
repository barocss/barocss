import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { tessellateCoplanarFaceBooleanExtrusion, validateBooleanExtrusionFeatureGraph,
  validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph } from '@barocss/cad-interop/boolean-extrusion-feature-graph';
import { deriveBaroCadBooleanExtrusionFeatureMesh } from '@barocss/cad-interop/boolean-extrusion-feature-mesh';

const sourceFlag = process.argv.indexOf('--source');
assert(sourceFlag >= 0 && sourceFlag + 1 < process.argv.length,
  'pass --source <saved #927 demo-output directory>');
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
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = new Map(cases.map(([name, expectedHash]) => {
  const bytes = readFileSync(resolve(source, `${name}.authored-graph.json`));
  assert.equal(hash(bytes), expectedHash, `${name}: saved authored bytes`);
  const paired = JSON.parse(readFileSync(resolve(source, `${name}.owned-graph-result.json`), 'utf8'));
  return [name, { bytes, paired, expectedHash }];
}));
const server = createServer((request, response) => {
  const name = request.url?.slice('/saved/'.length);
  if (request.url?.startsWith('/saved/') && fixtures.has(name)) {
    const bytes = fixtures.get(name).bytes;
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length,
      connection: 'close' });
    response.end(bytes);
    return;
  }
  response.writeHead(404, { connection: 'close' }).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let selected = 0, empty = 0, faces = 0, trueEdges = 0, refusals = 0;
let accepted;
try {
  for (const [name, , revision, heights] of cases) {
    const fixture = fixtures.get(name);
    const graphOptions = graphOptionsFor(heights);
    const direct = readBaroCadBooleanExtrusionFeatureGraph(fixture.bytes.toString('utf8'), graphOptions);
    const http = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/saved/${name}`, graphOptions);
    assert.deepEqual(http, direct, `${name}: direct/HTTP result`);
    assert.deepEqual(http.native, fixture.paired, `${name}: current paired owned graph`);
    assert.deepEqual(validateBooleanExtrusionFeatureGraph(http.native), http.native.report);
    assert.equal(http.native.document.revision, revision);
    assert.deepEqual(http.native.report.distances.map(row => row.valueMM), heights);
    assert.deepEqual(http.native.report.summary.extrusions.map(row => row.distanceMM), heights);
    assert.equal(http.native.features.length, heights.length + 3);
    const leaves = http.native.features.filter(row => row.kind === 'normal-extrusion');
    assert.equal(leaves.length, heights.length);
    const evaluationIds = new Set(), shellIds = new Set();
    for (const leaf of leaves) {
      const selection = { graphId: http.native.document.id, revision,
        featureId: leaf.featureId, outputSlotId: leaf.outputSlotId };
      const graphBefore = structuredClone(http.native);
      const derived = deriveBaroCadBooleanExtrusionFeatureMesh(http.native, selection, meshOptions);
      assert.deepEqual(http.native, graphBefore);
      assert.deepEqual(derived.binding, http.native.report.qualifiedBindings.find(row =>
        row.featureId === leaf.featureId && row.outputSlotId === leaf.outputSlotId));
      assert.deepEqual(derived.nativeMesh,
        tessellateCoplanarFaceBooleanExtrusion(leaf.evaluation, meshOptions));
      assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(derived.nativeMesh),
        derived.nativeMesh.report);
      assert.equal(derived.nativeMesh.report.extrusionEvaluationId, leaf.evaluation.options.evaluationId);
      assert.equal(derived.nativeMesh.report.empty, name === 'three_genuine_empty_leaves');
      assert(derived.nativeMesh.mesh.indices.every(index => index <= 65535));
      assert.equal(derived.nativeMesh.faceRanges.length, derived.nativeMesh.report.faceRangeCount);
      assert.equal(derived.nativeMesh.edgePaths.length, derived.nativeMesh.report.edgePathCount);
      for (const path of derived.nativeMesh.edgePaths) {
        assert.equal(path.samples.length, 3);
        assert(!derived.nativeMesh.faceRanges.some(face => face.internalEdges.some(edge => edge.id === path.edgeId)));
      }
      assert(!evaluationIds.has(leaf.evaluation.options.evaluationId));
      evaluationIds.add(leaf.evaluation.options.evaluationId);
      for (const shell of derived.nativeMesh.shellRanges) {
        assert(!shellIds.has(shell.shellId));
        shellIds.add(shell.shellId);
      }
      selected++;
      empty += Number(derived.nativeMesh.report.empty);
      faces += derived.nativeMesh.faceRanges.length;
      trueEdges += derived.nativeMesh.edgePaths.length;
      if (name === 'three_shared_region_leaves' && leaf.featureId === 'leaf_middle') {
        accepted = { graph: http.native, selection, derived };
      }
    }
    assert.equal(hash(readFileSync(resolve(source, `${name}.authored-graph.json`))), fixture.expectedHash);
  }
  assert(accepted);
  const graphBefore = structuredClone(accepted.graph);
  const meshBefore = structuredClone(accepted.derived.nativeMesh);
  const forged = structuredClone(accepted.graph);
  forged.report.qualifiedBindings.find(row => row.nativeReferences.length).nativeReferences[0].nativeId = 'forged';
  for (const action of [
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.graph,
      { ...accepted.selection, revision: accepted.selection.revision + 1 }, meshOptions),
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.graph,
      { ...accepted.selection, featureId: 'leaf_low' }, meshOptions),
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.graph,
      { ...accepted.selection, outputSlotId: 'leaf_slot_0' }, meshOptions),
    () => deriveBaroCadBooleanExtrusionFeatureMesh(forged, accepted.selection, meshOptions),
    () => deriveBaroCadBooleanExtrusionFeatureMesh(accepted.graph, accepted.selection,
      { ...meshOptions, maximumTriangles: 0 }),
  ]) { assert.throws(action); refusals++; }
  assert.deepEqual(accepted.graph, graphBefore);
  assert.deepEqual(accepted.derived.nativeMesh, meshBefore);
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
assert.equal(selected, 17);
assert.equal(empty, 3);
console.log(JSON.stringify({ savedFiles: cases.length, outputCounts: cases.map(row => row[3].length),
  selected, empty, faces, trueEdges, refusals, directAndHttpEqual: true,
  currentPairedResultsEqual: true, exactPublicCadMeshes: true,
  independentSiblingIdentity: true, acceptedDataRetained: true,
  genericNodePixiExecution: false }));
