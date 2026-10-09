import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BooleanExtrusionFeatureGraphError,
  serializeBooleanExtrusionFeatureGraph,
  updateBooleanExtrusionFeatureGraph,
  validateBooleanExtrusionFeatureGraph,
} from '@barocss/cad';
import { readBaroCadBooleanExtrusionFeatureGraph } from '@barocss/cad-interop/boolean-extrusion-feature-graph';

const sourceFlag = process.argv.indexOf('--source');
assert(sourceFlag >= 0 && sourceFlag + 1 < process.argv.length, 'pass --source <saved #903 demo-output directory>');
const directory = resolve(process.argv[sourceFlag + 1]);
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 4 };
const cases = [
  ['cross_union', 'dc1141e3552d1c28c0595282ffcc5efb3751272909fe1373b5e97c0fd170d1b3', 0, 24, 1, 2],
  ['containment_hole', '24c437a19d98f2e87fc4a69d488b17268c2e1aa93e2c7b0a6c3a18e45f2d72d2', 0, 32, 1, 2],
  ['strip_two_components', '66ecbd5c78313db03f1af6e5aa797d811fdfe1ae76921f1919d65fbeefc58f30', 0, 18, 2, 2],
  ['reverse_containment_empty', 'f62f23911362d3cc5a9dbbef5381f16f382894fb155d81407373bcffccdcc87a', 0, 0, 0, 2],
  ['union_height_edit', 'f85e228241b2d149219c65f81a7dc542692a020b366372c29b879c8a21354ec9', 1, 24, 1, 3],
  ['operation_intersection_edit', '3685288fe02c4f0ba9d276d15cfa6de83cfc23d6d737db491fadd987abc9fc2b', 2, 4, 1, 3],
  ['authored_corner_edit', 'a54eed6ec2dc22f9b08ba982491204d47b7d8996ef01c963a87ef894cc8a7eac', 3, 4.75, 1, 3],
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const accepted = new Map();
for (const [name, expectedHash, revision, area, shells, distance] of cases) {
  const file = resolve(directory, `${name}.authored-graph.json`);
  const bytes = readFileSync(file);
  assert.equal(sha256(bytes), expectedHash, `${name}: original file hash`);
  const text = bytes.toString('utf8');
  assert.deepEqual(Buffer.from(text, 'utf8'), bytes, `${name}: original strict UTF-8 bytes`);
  const read = readBaroCadBooleanExtrusionFeatureGraph(text, options);
  assert.equal(read.authoredText, text);
  assert(Object.isFrozen(read), `${name}: owned top-level read record`);
  assert.equal(read.native.document.id, revision === 0 ? `intent_${name}` : 'intent_cross_union');
  assert.equal(read.native.document.revision, revision);
  assert.equal(read.native.document.format, 'barocss-native-boolean-extrusion-feature-graph');
  assert.equal(read.native.document.lengthUnit, 'mm');
  assert.equal(read.native.document.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.deepEqual(read.native.report.featureOrder, ['face_b_feature', 'face_a_feature', 'boolean_feature', 'extrusion_feature']);
  assert.deepEqual(read.native.report.parameterOrder, ['base_height', 'height', 'unused']);
  assert.equal(read.native.report.nativeBuilderCallCount, 4);
  assert.deepEqual(read.native.report.nativeBuilderCalls, { faceInput: 2, coplanarBoolean: 1, normalExtrusion: 1 });
  assert.equal(read.native.report.summary.materialAreaUV, area);
  assert.equal(read.native.report.summary.componentCount, shells);
  assert.equal(read.native.report.summary.empty, shells === 0);
  assert.deepEqual(read.native.report.distances.map(item => item.valueMM), [distance]);
  assert.equal(read.native.report.summary.extrusions[0].distanceMM, distance);
  assert.equal('distance' in read.native.report, false);
  assert.equal('distanceMM' in read.native.report.summary, false);
  assert.equal(read.native.features.length, 4);
  assert.deepEqual(read.native.features.map(feature => feature.kind), ['face-input', 'face-input', 'coplanar-boolean', 'normal-extrusion']);
  for (const [i, feature] of read.native.features.entries()) {
    const binding = read.native.report.qualifiedBindings[i];
    assert.equal(binding.graphId, read.native.document.id);
    assert.equal(binding.revision, revision);
    assert.equal(binding.featureId, feature.featureId);
    assert.equal(binding.outputSlotId, feature.outputSlotId);
    assert(binding.nativeReferences.length > 0 || shells === 0);
    for (const ref of binding.nativeReferences) {
      assert.equal(ref.graphId, binding.graphId);
      assert.equal(ref.revision, revision);
      assert.equal(ref.featureId, feature.featureId);
      assert.equal(ref.outputSlotId, feature.outputSlotId);
    }
  }
  const boolean = read.native.features[2].evaluation;
  const extrusion = read.native.features[3].evaluation;
  assert.equal(boolean.components.length, shells);
  assert.equal(extrusion.shells.length, shells);
  assert.equal(read.native.report.summary.extrusions[0].shellIds.length, shells);
  assert.equal(read.native.report.summary.holeCount, name === 'containment_hole' ? 1 : 0);
  assert(extrusion.sources.length >= (shells === 0 ? 0 : 1));
  accepted.set(name, { read, file, hash: expectedHash });
}

const initial = accepted.get('cross_union');
const priorSnapshot = structuredClone(initial.read.native);
const independent = readBaroCadBooleanExtrusionFeatureGraph(initial.read.authoredText, options);
independent.native.document.parameters.find(parameter => parameter.id === 'base_height').definition.valueMM = 9;
assert.deepEqual(initial.read.native, priorSnapshot, 'separate reads own separate native graphs');
assert.equal(sha256(readFileSync(initial.file)), initial.hash);
const explicitWholeOwnedReport = validateBooleanExtrusionFeatureGraph(initial.read.native);
assert.deepEqual(explicitWholeOwnedReport, initial.read.native.report);
const edited = updateBooleanExtrusionFeatureGraph(initial.read.native, {
  expectedRevision: 0,
  revision: 1,
  parameterEdits: [{ parameterId: 'base_height', definition: { kind: 'literal', valueMM: 3 } }],
  faceEdits: [], booleanEdits: [], distanceEdits: [],
});
assert.deepEqual(edited.report.distances.map(item => item.valueMM), [3]);
assert.equal(edited.report.summary.extrusions[0].distanceMM, 3);
assert.notDeepEqual(edited.features[3].evaluation.vertices, priorSnapshot.features[3].evaluation.vertices);
const savedText = serializeBooleanExtrusionFeatureGraph(edited.document, edited.options);
const cold = readBaroCadBooleanExtrusionFeatureGraph(savedText, options);
assert.equal(cold.authoredText, savedText);
assert.equal(cold.native.document.revision, 1);
assert.deepEqual(cold.native, edited);
assert.deepEqual(initial.read.native, priorSnapshot);
assert.equal(sha256(readFileSync(initial.file)), initial.hash);

const candidate = JSON.parse(initial.read.authoredText);
const refuse = (name, text, candidateOptions, code) => {
  assert.throws(() => readBaroCadBooleanExtrusionFeatureGraph(text, candidateOptions), error =>
    error instanceof BooleanExtrusionFeatureGraphError && error.code === code, name);
  assert.deepEqual(initial.read.native, priorSnapshot, `${name}: prior accepted native result`);
  assert.equal(sha256(readFileSync(initial.file)), initial.hash, `${name}: prior file`);
};
refuse('truncated JSON', '{', options, 'JSON');
refuse('duplicate decoded JSON key', '{"format":0,"format":1}', options, 'JSON');
refuse('foreign format', JSON.stringify({ ...candidate, format: 'foreign' }), options, 'INPUT');
refuse('future version', JSON.stringify({ ...candidate, version: 1 }), options, 'INPUT');
refuse('invalid options budget', initial.read.authoredText,
  { maximumParameterResolutions: 2, maximumFeatureEvaluations: 4 }, 'BUDGET');
refuse('invalid options getter', initial.read.authoredText,
  { get maximumParameterResolutions() { throw new Error('getter must not run'); }, maximumFeatureEvaluations: 4 }, 'INPUT');
const brokenDependency = structuredClone(candidate);
brokenDependency.features.find(feature => feature.kind === 'coplanar-boolean').operandAFeatureId = 'missing';
refuse('missing dependency', JSON.stringify(brokenDependency), options, 'DEPENDENCY');
refuse('oversized text envelope', ' '.repeat(1048577), options, 'BUDGET');
const tampered = structuredClone(initial.read.native);
tampered.report.summary.materialAreaUV = 999;
assert.throws(() => validateBooleanExtrusionFeatureGraph(tampered), error =>
  error instanceof BooleanExtrusionFeatureGraphError && error.code === 'OWNED');
assert.deepEqual(initial.read.native, priorSnapshot);
console.log(JSON.stringify({ cases: cases.length, refusals: 9, nativeBuilderCallsPerRead: 4,
  extraWholeOwnedValidatorRebuild: true, updateRebuildsPriorAndCandidate: true,
  serializerReevaluatesAuthoredIntent: true, coldReadReevaluates: true,
  scope: 'real saved authored files; renderer-neutral native read only' }));
