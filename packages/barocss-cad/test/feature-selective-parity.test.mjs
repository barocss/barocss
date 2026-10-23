import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } from '../dist/index.js';
import { planBooleanExtrusionImpactV1 } from '../dist/exact-proof/feature-impact-plan-v1.js';

const fixture = fileURLToPath(new URL('./fixtures/boolean-extrusion.authored-graph.json', import.meta.url));
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 7 };
const empty = { parameterEdits: [], faceEdits: [], booleanEdits: [], distanceEdits: [] };

test('actual Native graph selective eligibility: unaffected evaluations equal a full rebuild', { timeout: 120000 }, () => {
  const original = evaluateBooleanExtrusionFeatureGraph(JSON.parse(readFileSync(fixture, 'utf8')), options);
  const before = structuredClone(original);
  const cases = [
    {
      name: 'height drives derived distance and extrusion',
      edit: { parameterEdits: [{ parameterId: 'base_height', definition: { kind: 'literal', valueMM: 3 } }] },
      input: { parameterIds: ['base_height'], featureIds: [] },
      affected: ['extrusion_feature'],
      unaffected: ['face_a_feature', 'face_b_feature', 'boolean_feature'],
    },
    {
      name: 'unused signed-zero parameter invalidates no geometry',
      edit: { parameterEdits: [{ parameterId: 'unused', definition: { kind: 'literal', valueMM: 0 } }] },
      input: { parameterIds: ['unused'], featureIds: [] },
      affected: [],
      unaffected: ['face_a_feature', 'face_b_feature', 'boolean_feature', 'extrusion_feature'],
    },
    {
      name: 'extrusion distance edit invalidates only its leaf',
      edit: { distanceEdits: [{ featureId: 'extrusion_feature', definition: { kind: 'literal', valueMM: 4 } }] },
      input: { parameterIds: [], featureIds: ['extrusion_feature'] },
      affected: ['extrusion_feature'],
      unaffected: ['face_a_feature', 'face_b_feature', 'boolean_feature'],
    },
  ];

  for (const scenario of cases) {
    const edits = { ...structuredClone(empty), ...scenario.edit, expectedRevision: 0, revision: 1 };
    const editsBefore = structuredClone(edits);
    const plan = planBooleanExtrusionImpactV1(original.report, scenario.input);
    assert.deepEqual([...plan.affectedFeatureIds].sort(), [...scenario.affected].sort(), scenario.name);
    assert.deepEqual([...plan.unaffectedFeatureIds].sort(), [...scenario.unaffected].sort(), scenario.name);
    assert.equal(plan.evaluationMode, 'analysis-only-full-rebuild-required');

    const next = updateBooleanExtrusionFeatureGraph(original, edits);
    assert.equal(next.document.revision, 1);
    assert.equal(next.report.quality.selectiveRecomputationClaimed, false);
    // This is evidence of eligibility only. Current update still invokes every builder.
    assert.equal(next.report.nativeBuilderCallCount, original.report.nativeBuilderCallCount);
    for (const id of plan.unaffectedFeatureIds) {
      const priorRow = original.features.find(row => row.featureId === id);
      const nextRow = next.features.find(row => row.featureId === id);
      assert.ok(priorRow && nextRow, 'complete Native evaluated feature set');
      assert.deepEqual(nextRow.evaluation, priorRow.evaluation, scenario.name + ': ' + id);
    }
    assert.deepEqual(original, before, scenario.name + ': accepted graph may not mutate');
    assert.deepEqual(edits, editsBefore, scenario.name + ': caller edits may not mutate');
  }

  assert.throws(() => updateBooleanExtrusionFeatureGraph(original, {
    ...structuredClone(empty), expectedRevision: 99, revision: 1,
    parameterEdits: [{ parameterId: 'base_height', definition: { kind: 'literal', valueMM: 4 } }],
  }), /revision/i);
  assert.deepEqual(original, before, 'failed edit cannot modify accepted graph');
});
