import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import {
  BooleanExtrusionFeatureGraphError,
  serializeBooleanExtrusionFeatureGraph,
  transactBooleanExtrusionFeatureGraphParameters,
  validateBooleanExtrusionFeatureGraph,
} from '@barocss/cad';
import {
  loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph,
} from '@barocss/cad-interop/boolean-extrusion-feature-graph';

const sourceFlag = process.argv.indexOf('--source');
assert(sourceFlag >= 0 && sourceFlag + 1 < process.argv.length, 'pass --source <saved #915 demo-output directory>');
const directory = resolve(process.argv[sourceFlag + 1]);
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 4 };
const cases = [
  ['revision0_authentic', 'dc1141e3552d1c28c0595282ffcc5efb3751272909fe1373b5e97c0fd170d1b3', 3047, 3, 2, ['base_height', 'height', 'unused']],
  ['revision1_replace_height', '3588850a7559512f77d7c02e6a9b3240240c93025742ec565c4f92526884f7c8', 2952, 2, 3, ['unused', 'design_height']],
  ['revision2_create_dependency', '9d5ce1b9aa23a89f2f79ecfab876fb07fe3fb1d2bcee3dc6808811d6f5ade3ef', 3055, 3, 4, ['unused', 'new_base', 'design_height']],
  ['revision3_repair_removed_dependency', 'f8a9952082d1d46f1bd7364f0b1eb1f3f55c25d52c2c943d1dc7f505a771ed53', 2952, 2, 5, ['unused', 'design_height']],
  ['revision4_literal_without_parameters', 'b52522c2a595a156334def4578f6f0ca3a2241280058cf6073057671fc72ab7b', 2763, 0, 2, []],
  ['revision5_eight_unused', '9c7c8adb6a96177b828f7383a3372f1f01ee1ae9e0bd12732817003ca72f0b31', 3339, 8, 2, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']],
  ['revision6_transient_nine_final_eight', 'c0c6bc117b0cb1badaa0a55d4be9cc739be5b580e5553848a6faad9c4515f0da', 3341, 8, 2, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p_new']],
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const files = new Map(cases.map(([name, hash, size]) => {
  const bytes = readFileSync(resolve(directory, `${name}.authored-graph.json`));
  assert.equal(bytes.length, size, `${name}: exact original byte length`);
  assert.equal(sha256(bytes), hash, `${name}: exact original SHA-256`);
  const paired = JSON.parse(readFileSync(resolve(directory, `${name}.owned-graph-result.json`), 'utf8'));
  return [name, { bytes, paired, hash }];
}));
let editedText = null;
const server = createServer((request, response) => {
  const name = request.url?.slice('/saved/'.length);
  if (request.url?.startsWith('/saved/') && files.has(name)) {
    const bytes = files.get(name).bytes;
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
    response.end(bytes); return;
  }
  if (request.url === '/edited' && editedText !== null) {
    const bytes = Buffer.from(editedText, 'utf8');
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
  const reads = new Map();
  for (const [index, [name, , size, parameterCount, distance, parameterOrder]] of cases.entries()) {
    const url = `${base}/saved/${name}`;
    const progress = [];
    const read = await loadBaroCadBooleanExtrusionFeatureGraph(url, options, {
      onProgress(event) { assert(Object.isFrozen(event)); progress.push(event); },
    });
    const fixture = files.get(name);
    assert.equal(progress.at(-1)?.loadedBytes, size);
    assert.equal(progress.at(-1)?.declaredTotalBytes, size);
    assert.deepEqual(Buffer.from(read.authoredText, 'utf8'), fixture.bytes);
    assert.equal(sha256(Buffer.from(read.authoredText, 'utf8')), fixture.hash);
    assert.deepEqual(read, readBaroCadBooleanExtrusionFeatureGraph(fixture.bytes.toString('utf8'), options));
    assert.deepEqual(read.native, fixture.paired, `${name}: complete saved native result`);
    assert.deepEqual(validateBooleanExtrusionFeatureGraph(read.native), read.native.report);
    assert.equal(read.native.document.revision, index);
    assert.equal(read.native.document.parameters.length, parameterCount);
    assert.deepEqual(read.native.report.parameterOrder, parameterOrder);
    assert.equal(read.native.report.summary.distanceMM, distance);
    assert.equal(read.native.report.nativeBuilderCallCount, 4);
    assert.deepEqual(read.native.features.map(feature => feature.kind),
      ['face-input', 'face-input', 'coplanar-boolean', 'normal-extrusion']);
    for (const [featureIndex, binding] of read.native.report.qualifiedBindings.entries()) {
      const feature = read.native.features[featureIndex];
      assert.equal(binding.graphId, read.native.document.id);
      assert.equal(binding.revision, index);
      assert.equal(binding.featureId, feature.featureId);
      assert.equal(binding.outputSlotId, feature.outputSlotId);
      for (const reference of binding.nativeReferences) {
        assert.equal(reference.graphId, binding.graphId);
        assert.equal(reference.revision, index);
        assert.equal(reference.featureId, binding.featureId);
        assert.equal(reference.outputSlotId, binding.outputSlotId);
      }
    }
    reads.set(name, read);
  }
  const priorRead = reads.get('revision3_repair_removed_dependency');
  const prior = structuredClone(priorRead.native);
  const edited = transactBooleanExtrusionFeatureGraphParameters(priorRead.native, {
    expectedRevision: 3, revision: 4,
    parameterOperations: [{ kind: 'upsert', parameter: {
      id: 'design_height', type: 'length', definition: { kind: 'literal', valueMM: 6 },
    } }],
    distanceEdits: [],
  });
  assert.equal(edited.report.summary.distanceMM, 6);
  assert.notDeepEqual(edited.features[3].evaluation.vertices, prior.features[3].evaluation.vertices);
  editedText = serializeBooleanExtrusionFeatureGraph(edited.document, edited.options);
  assert.equal(JSON.parse(editedText).features.length, 4, 'saved file contains authored intent only');
  const cold = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/edited`, options);
  assert.equal(cold.authoredText, editedText);
  assert.deepEqual(cold.native, edited, 'cold HTTP read rebuilds edited native geometry');
  assert.deepEqual(priorRead.native, prior, 'prior accepted URL result remains intact');
  assert.equal(sha256(files.get('revision3_repair_removed_dependency').bytes),
    files.get('revision3_repair_removed_dependency').hash);
  let refused = 0;
  await assert.rejects(() => Promise.resolve().then(() => transactBooleanExtrusionFeatureGraphParameters(priorRead.native, {
    expectedRevision: 2, revision: 4,
    parameterOperations: [{ kind: 'upsert', parameter: {
      id: 'design_height', type: 'length', definition: { kind: 'literal', valueMM: 7 },
    } }], distanceEdits: [],
  })), error => error instanceof BooleanExtrusionFeatureGraphError && error.code === 'REVISION');
  refused++;
  await assert.rejects(() => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/missing`, options));
  refused++;
  assert.deepEqual(priorRead.native, prior);
  assert.deepEqual(cold.native, edited);
  for (const [, fixture] of files) assert.equal(sha256(fixture.bytes), fixture.hash);
  evidence = { savedRevisions: cases.length, parameterCounts: cases.map(item => item[3]),
    distancesMM: cases.map(item => item[4]), newHostDistanceMM: 6, refused,
    exactPairedNativeResults: true, coldHttpRead: true, priorFilesAndResultsRetained: true,
    nativeWork: 'each parse, explicit validator, transaction, serializer and cold read reconstruct separately',
    scope: 'real #915 authored files; existing neutral Loader APIs only' };
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
console.log(JSON.stringify(evidence));
