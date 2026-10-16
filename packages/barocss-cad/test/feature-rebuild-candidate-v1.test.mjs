import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareBooleanExtrusionRebuildV1 } from '../dist/feature-rebuild-candidate-v1.js';

// Explicit refusal controls; a full native fixture test remains a separate gate.
test('transactional rebuild candidate refuses invalid or absent owned state', () => {
  const edits = { expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [], distanceEdits: [] };
  assert.throws(() => prepareBooleanExtrusionRebuildV1(null, edits));
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, edits));
  assert.throws(() => prepareBooleanExtrusionRebuildV1({ report: { revision: 0 } }, edits));
});


test('transactional candidate refuses accessor edits without invoking caller code', () => {
  let reads = 0;
  const hostile = { expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [] };
  Object.defineProperty(hostile, 'distanceEdits', { enumerable: true, get() { reads++; return []; } });
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, hostile), /Own edit values required/);
  assert.equal(reads, 0);
});

test('transactional candidate refuses cyclic and sparse edit inputs before native execution', () => {
  const cyclic = { expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [], distanceEdits: [] };
  cyclic.faceEdits.push(cyclic);
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, cyclic), /Cyclic edit snapshot refused/);
  const sparse = { expectedRevision: 0, revision: 1, parameterEdits: new Array(1), faceEdits: [], booleanEdits: [], distanceEdits: [] };
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, sparse), /Dense bounded edit array required|Sparse edit array refused/);
});


test('real authored Native graph rebuild generates a separately owned candidate and impact', { timeout: 120000 }, async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { resolve } = await import('node:path');
  const { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } = await import('../dist/index.js');
  const fixture = resolve(fileURLToPath(new URL('./fixtures/boolean-extrusion.authored-graph.json', import.meta.url)));
  const document = JSON.parse(readFileSync(fixture, 'utf8'));
  const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };
  const previous = evaluateBooleanExtrusionFeatureGraph(document, options);
  const before = structuredClone(previous);
  const edits = { expectedRevision: 0, revision: 1,
    parameterEdits: [{ parameterId: 'base_height', definition: { kind: 'literal', valueMM: 3 } }],
    faceEdits: [], booleanEdits: [], distanceEdits: [] };
  const editsBefore = structuredClone(edits);
  const prepared = prepareBooleanExtrusionRebuildV1(previous, edits);
  const independent = updateBooleanExtrusionFeatureGraph(previous, edits);
  const { planBooleanExtrusionImpactV1 } = await import('../dist/feature-impact-plan-v1.js');
  const directImpact = planBooleanExtrusionImpactV1(previous.report, {
    parameterIds: ['base_height'], featureIds: [],
  });
  assert.deepEqual(prepared.impact, directImpact, 'native distance effects belong in core impact analyzer');
  assert.deepEqual(prepared.candidate, independent);
  assert.equal(prepared.priorRevision, 0);
  assert.equal(prepared.candidateRevision, 1);
  assert.equal(prepared.evaluationMode, 'complete-native-rebuild-candidate');
  assert.equal(prepared.impact.evaluationMode, 'analysis-only-full-rebuild-required');
  assert.ok(prepared.impact.affectedParameterIds.includes('base_height'));
  assert.ok(prepared.impact.affectedParameterIds.includes('design_height'));
  assert.ok(prepared.impact.affectedFeatureIds.includes('extrusion_feature'));
  assert.deepEqual(previous, before);
  assert.deepEqual(edits, editsBefore);
  const invalid = { ...edits, expectedRevision: 77 };
  assert.throws(() => prepareBooleanExtrusionRebuildV1(previous, invalid));
  assert.deepEqual(previous, before, 'failed candidate may not mutate accepted Native state');
});
