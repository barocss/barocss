import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { evaluateBooleanExtrusionFeatureGraph, measureCoplanarFaceBooleanExtrusion,
  validateBooleanExtrusionFeatureGraph, validateCoplanarFaceBooleanExtrusionProperties } from '@barocss/cad';
import { loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph } from '@barocss/cad-interop/boolean-extrusion-feature-graph';
import { deriveBaroCadBooleanExtrusionFeatureProperties }
  from '@barocss/cad-interop/boolean-extrusion-feature-properties';

const argument = name => {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && index + 1 < process.argv.length, `pass ${name} <saved CAD directory>`);
  return resolve(process.argv[index + 1]);
};
const source = argument('--source'), topology = argument('--topology');
const cases = [
  ['authentic_single_current_arrays', 'dc1141e3552d1c28c0595282ffcc5efb3751272909fe1373b5e97c0fd170d1b3', 0, [2], source, true],
  ['three_shared_region_leaves', '720b97ffe660770ab42a26ea417a030b527720be7269f8514a2f6a47403e59c3', 0, [2, 3, 4], source, true],
  ['shared_height_parameter_edit', 'ebf08856848c30dad0abcecca97a6af07d8177c06e5ffce4ef2694887e6c34eb', 1, [3, 4, 5], source, true],
  ['atomic_all_leaf_parameter_repair', 'a057863f5f0a0aabdc0ab08b6cb3271b9ff4b715d0e6a6fc4bd19e37a0f8f931', 2, [4, 5, 6], source, true],
  ['fourth_literal_extrusion_leaf', '63e2ad113d521ea2b00b7c9fe0553cbbf468bbe6ce4a6cc4190305027f365463', 3, [4, 5, 6, 7], source, true],
  ['three_genuine_empty_leaves', '8b0edc228d2c828dbda1fe68e2ca19924c34bf0b12e8a26411672705163b5476', 0, [2, 3, 4], source, true],
  ['containment_hole', '24c437a19d98f2e87fc4a69d488b17268c2e1aa93e2c7b0a6c3a18e45f2d72d2', 0, [2], topology, false],
  ['reverse_containment_empty', 'f62f23911362d3cc5a9dbbef5381f16f382894fb155d81407373bcffccdcc87a', 0, [2], topology, false],
];
const graphOptionsFor = heights => ({ maximumParameterResolutions: 8,
  maximumFeatureEvaluations: heights.length + 3 });
const propertiesOptions = { maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8 };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = new Map(cases.map(([name, hash, , , directory]) => {
  const bytes = readFileSync(resolve(directory, `${name}.authored-graph.json`));
  assert.equal(sha256(bytes), hash, `${name}: exact authored bytes`);
  const paired = JSON.parse(readFileSync(resolve(directory, `${name}.owned-graph-result.json`), 'utf8'));
  return [name, { bytes, paired, hash, directory }];
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
const outputs = new Map();
let refused = 0, measuredLeaves = 0, copiedComponents = 0;
try {
  for (const [name, , revision, heights, , current] of cases) {
    const fixture = fixtures.get(name);
    const graphOptions = graphOptionsFor(heights);
    const direct = readBaroCadBooleanExtrusionFeatureGraph(fixture.bytes.toString('utf8'), graphOptions);
    const http = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/saved/${name}`, graphOptions);
    assert.deepEqual(http, direct, `${name}: direct/HTTP reader equality`);
    assert.deepEqual(Buffer.from(http.authoredText, 'utf8'), fixture.bytes);
    assert.deepEqual(http.native, current ? fixture.paired :
      evaluateBooleanExtrusionFeatureGraph(fixture.paired.document, fixture.paired.options),
    `${name}: current paired result or historical authored rebuild`);
    assert.deepEqual(validateBooleanExtrusionFeatureGraph(http.native), http.native.report);
    assert.equal(http.native.document.revision, revision);
    assert.deepEqual(http.native.report.distances.map(row => row.valueMM), heights);
    const leaves = http.native.features.filter(row => row.kind === 'normal-extrusion');
    assert.equal(leaves.length, heights.length);
    const selected = new Map();
    for (const [index, leaf] of leaves.entries()) {
      const selection = { graphId: http.native.document.id, revision,
        featureId: leaf.featureId, outputSlotId: leaf.outputSlotId };
      const derived = deriveBaroCadBooleanExtrusionFeatureProperties(http.native, selection, propertiesOptions);
      const expectedBinding = http.native.report.qualifiedBindings.find(row =>
        row.featureId === leaf.featureId && row.outputSlotId === leaf.outputSlotId);
      assert.deepEqual(derived.binding, expectedBinding);
      assert.deepEqual(derived.nativeProperties,
        measureCoplanarFaceBooleanExtrusion(leaf.evaluation, propertiesOptions));
      assert.deepEqual(validateCoplanarFaceBooleanExtrusionProperties(derived.nativeProperties),
        derived.nativeProperties.report);
      const properties = derived.nativeProperties;
      assert.equal(properties.report.evaluationId, leaf.evaluation.options.evaluationId);
      assert.equal(properties.report.distanceMM, heights[index]);
      assert.equal(properties.report.lengthUnit, 'mm');
      assert.equal(properties.report.areaUnit, 'mm2');
      assert.equal(properties.report.volumeUnit, 'mm3');
      assert.equal(properties.report.sourceFrame, 'authored-xyz-no-axis-conversion');
      assert.equal(properties.report.surfaceD1EvaluationCount, properties.components.length);
      assert.equal(properties.report.solid, false);
      assert.equal(properties.report.quality.constructionEstimateOnly, true);
      assert.equal(properties.report.empty, name.includes('empty'));
      for (const component of properties.components) {
        assert(leaf.evaluation.shells.some(shell => shell.id === component.shellId));
        assert(derived.binding.nativeReferences.some(ref => ref.nativeId === component.shellId));
        assert(leaf.evaluation.region.loops.some(loop => loop.id === component.outerLoopId));
        for (const holeId of component.holeLoopIds) {
          assert(leaf.evaluation.region.loops.some(loop => loop.id === holeId));
        }
        assert(component.areaMM2 > 0 && component.volumeMM3 > 0);
        for (let axis = 0; axis < 3; axis++) {
          const expected = component.capCentroidMM[axis] + leaf.evaluation.translationMM[axis] * 0.5;
          assert(Math.abs(component.centroidMM[axis] - expected) <= 1e-10);
        }
        copiedComponents++;
      }
      if (properties.report.empty) {
        assert.equal(properties.report.areaMM2, 0);
        assert.equal(properties.report.volumeMM3, 0);
        assert.equal(properties.report.centroidMM, null);
        assert.deepEqual(properties.components, []);
      } else {
        assert(properties.report.areaMM2 > 0 && properties.report.volumeMM3 > 0);
        assert.equal(properties.report.centroidMM.length, 3);
        const expectedVolume = properties.report.areaMM2 * heights[index];
        assert(Math.abs(properties.report.volumeMM3 - expectedVolume) <= 1e-9);
      }
      selected.set(leaf.featureId, { selection, derived });
      measuredLeaves++;
    }
    const properties = [...selected.values()].map(item => item.derived.nativeProperties.report);
    assert(properties.every(row => row.areaMM2 === properties[0].areaMM2),
      `${name}: sibling leaves share actual native region area`);
    if (properties.length > 1 && !properties[0].empty) {
      assert(properties.every((row, i) => i === 0 || row.volumeMM3 > properties[i - 1].volumeMM3));
      assert(properties.every((row, i) => i === 0 || row.centroidMM.some((value, axis) =>
        value !== properties[i - 1].centroidMM[axis])));
    }
    if (name === 'containment_hole') assert.equal(properties[0].holeCount, 1);
    if (name === 'reverse_containment_empty') assert.equal(properties[0].empty, true);
    assert.equal(sha256(readFileSync(resolve(fixture.directory, `${name}.authored-graph.json`))), fixture.hash);
    outputs.set(name, { http, selected });
  }
  const accepted = outputs.get('three_shared_region_leaves');
  const chosen = accepted.selected.get('leaf_middle');
  const priorGraph = structuredClone(accepted.http.native);
  const priorProperties = structuredClone(chosen.derived.nativeProperties);
  for (const change of [
    { graphId: 'wrong' }, { revision: 1 }, { featureId: 'leaf_low' },
    { outputSlotId: 'leaf_slot_0' }, { featureId: 'boolean_feature', outputSlotId: 'boolean_slot' },
  ]) {
    assert.throws(() => deriveBaroCadBooleanExtrusionFeatureProperties(accepted.http.native,
      { ...chosen.selection, ...change }, propertiesOptions));
    refused++;
  }
  const forged = structuredClone(accepted.http.native);
  forged.report.qualifiedBindings.at(-1).nativeReferences[0].nativeId = 'forged';
  assert.throws(() => deriveBaroCadBooleanExtrusionFeatureProperties(forged,
    chosen.selection, propertiesOptions)); refused++;
  assert.throws(() => deriveBaroCadBooleanExtrusionFeatureProperties(accepted.http.native,
    chosen.selection, { ...propertiesOptions, maximumBoundarySegments: 0 })); refused++;
  assert.throws(() => deriveBaroCadBooleanExtrusionFeatureProperties(accepted.http.native,
    chosen.selection, { ...propertiesOptions, maximumSurfaceEvaluations: 0 })); refused++;
  assert.throws(() => deriveBaroCadBooleanExtrusionFeatureProperties(accepted.http.native,
    chosen.selection, { get maximumBoundarySegments() { throw new Error('getter must not run'); },
      maximumSurfaceEvaluations: 8 })); refused++;
  const independent = deriveBaroCadBooleanExtrusionFeatureProperties(accepted.http.native,
    chosen.selection, propertiesOptions);
  assert.notStrictEqual(independent.binding, chosen.derived.binding);
  assert.notStrictEqual(independent.nativeProperties, chosen.derived.nativeProperties);
  assert.notStrictEqual(independent.nativeProperties.extrusion,
    accepted.http.native.features.find(row => row.featureId === chosen.selection.featureId).evaluation);
  assert.deepEqual(accepted.http.native, priorGraph);
  assert.deepEqual(chosen.derived.nativeProperties, priorProperties);
} finally {
  server.closeAllConnections(); server.close();
  await once(server, 'close');
}
const reports = name => [...outputs.get(name).selected.values()].map(item => item.derived.nativeProperties.report);
console.log(JSON.stringify({ savedFiles: cases.length, currentFiles: 6, historicalAuthoredRebuilds: 2,
  measuredLeaves, copiedComponents, emptyOutputs: 4, refused, exactPublicCadProperties: true,
  directAndHttpEqual: true, priorGraphPropertiesAndFilesRetained: true,
  baseAreaMM2: reports('three_shared_region_leaves')[0].areaMM2,
  initialVolumesMM3: reports('three_shared_region_leaves').map(row => row.volumeMM3),
  editedVolumesMM3: reports('shared_height_parameter_edit').map(row => row.volumeMM3),
  initialCentroidsMM: reports('three_shared_region_leaves').map(row => row.centroidMM),
  holeAreaMM2: reports('containment_hole')[0].areaMM2,
  work: 'whole graph validation, native measure parent validation and owned property reconstruction are separate' }));
