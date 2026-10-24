import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';

// O19 (D277): a stored name checked against what it named. A square's corner (40, 40) filleted by its positional name
// n1.side1|n1.side2; a vertex inserted upstream renumbers the sides, and the name then names the corner at (40, 0).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const square = (points, fillet) => D([
  { id: 'n0', kind: 'sketch', profile: 'polygon', points }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 10 },
  { id: 'n2', kind: 'fillet', target: 'n1', edges: ['n1.side1|n1.side2'], radius: 2, ...fillet }]);
const corner = { kind: 'line', at: [40, 40, 5], dir: [0, 0, 1], size: 10 };
const volume = doc => evaluateCadPart(doc).outputs[0].massProperties(1).volumeMM3;

test('O19: a fillet whose stored edge name moved to another corner after an upstream vertex insert refuses, typed, and never builds there', () => {
  const original = [[0, 0], [40, 0], [40, 40], [0, 40]], inserted = [[0, 0], [20, 0], [40, 0], [40, 40], [0, 40]];
  assert.ok(volume(square(original, { expect: { 'n1.side1|n1.side2': corner } })) > 0, 'the corner it named builds');
  // (Without `expect` the name builds where it now points: the silent move O19 is about.)
  assert.ok(volume(square(inserted, {})) > 0);
  assert.throws(() => evaluateCadPart(square(inserted, { expect: { 'n1.side1|n1.side2': corner } })), e => e.name === 'CadPartError' && e.code === 'REFERENCE_MOVED' && e.details.category === 'REFERENCE' && e.feature === 'n2'
    && e.message === 'n2: [REFERENCE_MOVED] fillet edge n1.side1|n1.side2 is no longer the edge it named (was at (40, 40, 5), now at (40, 0, 5); n1.side2|n1.side3 is at (40, 40, 5))');
});

test('O19: a dimension edit that keeps the names still builds on them, with expect', () => {
  // (The corner moves from (40, 40) to (50, 50); no other corner lies near (40, 40).)
  const grown = square([[0, 0], [50, 0], [50, 50], [0, 50]], { expect: { 'n1.side1|n1.side2': corner } });
  assert.equal(volume(grown), volume(square([[0, 0], [50, 0], [50, 50], [0, 50]], {})));
});

test('O19: a stored name now another kind of geometry refuses; a shell\'s open face and a chamfer are checked too', () => {
  const box = extra => D([{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 'n0', height: 10 }, ...extra]);
  const top = { kind: 'plane', at: [20, 15, 10], dir: [0, 0, 1], size: 1200 };
  assert.ok(volume(box([{ id: 's', kind: 'shell', target: 'n1', thickness: 1, open: ['n1.top'], expect: { 'n1.top': top } }])) > 0);
  assert.throws(() => evaluateCadPart(box([{ id: 's', kind: 'shell', target: 'n1', thickness: 1, open: ['n1.top'], expect: { 'n1.top': { ...top, dir: [0, 0, -1] } } }])),
    e => e.code === 'REFERENCE_MOVED' && /^s: \[REFERENCE_MOVED\] shell face n1.top is no longer the face it named .*it faces another way\)$/.test(e.message));
  assert.throws(() => evaluateCadPart(box([{ id: 'c', kind: 'chamfer', target: 'n1', edges: ['n1.side0|n1.top'], distance: 1, expect: { 'n1.side0|n1.top': { kind: 'curve', at: [20, 0, 10], dir: null, size: 40 } } }])),
    e => e.code === 'REFERENCE_MOVED' && /it is a line edge now, was curve\)$/.test(e.message));
});

test('O19: expect is checked as data: only the feature\'s own names, each a signature', () => {
  const base = [[0, 0], [40, 0], [40, 40], [0, 40]];
  assert.throws(() => evaluateCadPart(square(base, { expect: { 'n1.side0|n1.side1': corner } })), e => e.code === 'INPUT' && /expect names n1.side0\|n1.side1, which this fillet does not use/.test(e.message));
  assert.throws(() => evaluateCadPart(square(base, { expect: { 'n1.side1|n1.side2': { ...corner, at: [40, 40] } } })), e => e.code === 'INPUT' && /expect\.n1.side1\|n1.side2 must be/.test(e.message));
  assert.throws(() => evaluateCadPart(square(base, { expect: { 'n1.side1|n1.side2': { ...corner, kind: 'plane' } } })), e => e.code === 'INPUT' && /an edge's kind is line or curve/.test(e.message));
});
