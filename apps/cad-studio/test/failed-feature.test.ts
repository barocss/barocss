import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { failedFeatureText } from '../src/app/failedFeature';

const sketch: ModelNode = { kind: 'sketch', id: 'n11', profile: 'rectangle', min: [0, 0], max: [40, 30] };
const extrude: ModelNode = { kind: 'extrude', id: 'n23', sketch: 0, height: 20 };
const fillet: ModelNode = { kind: 'fillet', id: 'n41', parent: { node: 1, side: 'solid' }, edges: ['n23.side1|n23.top'], radius: 8 };
const accepted = [sketch, extrude, fillet];

test('D749: failure attribution follows a stable feature across different history positions', () => {
  const unrelated: ModelNode = { ...sketch, id: 'n2' };
  const candidate: ModelNode[] = [unrelated, sketch, { ...extrude, sketch: 1, height: 4 }, { ...fillet, parent: { node: 2, side: 'solid' } }];
  assert.equal(failedFeatureText('n41', candidate, accepted), 'Fillet R8 (n41)');
  assert.equal(failedFeatureText('n2', candidate, accepted), 'n2 · no matching history step');
  assert.equal(failedFeatureText('n0', candidate, accepted), 'n0 · no matching history step');
  assert.equal(failedFeatureText('n41', accepted.slice(0, 2), accepted), 'n41 · no matching history step');
  assert.equal(failedFeatureText('n41', accepted, [sketch, extrude]), 'n41 · no matching history step');
});

test('D749: supported internal IDs retain the full native ID beside the authored label', () => {
  const hole: ModelNode = {
    kind: 'hole', id: 'n45', parent: { node: 1, side: 'solid' }, center: [15, 10], radius: 2,
    pattern: { count: 3, step: [4, 0] },
  };
  const text: ModelNode = {
    kind: 'text', id: 'n49', text: 'AX', font: { blob: 'test', filename: 'test.ttf' }, size: 10, height: 2, tolerance: 0.01,
  };
  const history = [...accepted, hole, text];
  assert.match(failedFeatureText('n45_p1', history, history) ?? '', /^Hole Ø4 × 3 \(n45_p1\)$/);
  assert.equal(failedFeatureText('n49_g0_c1_extrude', history, history), 'Text · AX (n49_g0_c1_extrude)');
  assert.equal(failedFeatureText('n49_g00_c1_extrude', history, history), 'n49_g00_c1_extrude · no matching history step');
});

test('D749: missing, unrelated and ambiguous feature locations cannot name an authored step', () => {
  assert.equal(failedFeatureText(undefined, accepted, accepted), undefined);
  assert.equal(failedFeatureText('n41_turn0', accepted, accepted), 'n41_turn0 · no matching history step');
  assert.equal(failedFeatureText('lib0_turn0', accepted, accepted), 'lib0_turn0 · no matching history step');
  const different = [...accepted.slice(0, 2), { ...sketch, id: 'n41' }];
  assert.equal(failedFeatureText('n41', different, accepted), 'n41 · no matching history step');
});
