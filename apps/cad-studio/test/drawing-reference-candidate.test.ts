import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectedEdge } from '@barocss/cad';
import type { ViewPlacement } from '@barocss/cad-model/drawing/views';
import { referenceCandidate } from '../src/ui/drawing/referenceCandidate';

const placement: ViewPlacement = { id: 'top', scale: 2, origin: [100, 100], box: [100, 90, 110, 100] };
const edge: ProjectedEdge = {
  name: 'current',
  kind: 'line',
  ends: null,
  circle: null,
  pieces: [
    { visible: true, curve: { kind: 'line', a: [0, 5], b: [3, 5] } },
    { visible: false, curve: { kind: 'line', a: [3, 5], b: [5, 5] } },
  ],
};

test('reference preview uses only visible pieces of the uniquely named projected edge', () => {
  const result = referenceCandidate(placement, { edges: [{ ...edge, name: 'other' }, edge] }, edge.name);
  assert.ok('markup' in result);
  assert.match(result.markup, /^<line x1="100" y1="90" x2="106" y2="90" [^>]+\/>$/);
  assert.doesNotMatch(result.markup, /110/);
});

test('reference preview refuses missing, duplicated and fully hidden projected edges', () => {
  assert.deepEqual(referenceCandidate(placement, { edges: [] }, edge.name), { reason: 'the candidate is not in this view.' });
  assert.deepEqual(referenceCandidate(placement, { edges: [edge, { ...edge, pieces: [] }] }, edge.name), { reason: 'the candidate has more than one projected edge in this view.' });
  for (const pieces of [[], edge.pieces.filter(piece => !piece.visible)]) {
    assert.deepEqual(referenceCandidate(placement, { edges: [{ ...edge, pieces }] }, edge.name), { reason: 'the candidate has no visible segments in this view.' });
  }
});
