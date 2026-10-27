import test from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, type ToleranceSuggestion } from '../src/drawing/tolerance';
import { defaultDrawing, type DrawingFrame, type DrawingSettings } from '../src/drawing/types';

const dimension: DrawingSettings['dimensions'][number] = { id: 'hole', kind: 'diameter', view: 'top', edge: 'hole.edge', near: [4, 4, 0], place: [10, 10] };
const location: DrawingSettings['dimensions'][number] = { id: 'location', kind: 'linear', view: 'front', a: { edge: 'edge', at: 'end', near: [0, 0, 0] }, b: { edge: 'edge', at: 'end', near: [10, 0, 0] }, orient: 'horizontal', place: [0, -5], tol: { kind: 'symmetric', value: 0.2 } };
const proposal: ToleranceSuggestion = { id: 'position-hole', kind: 'position', message: 'Position', basis: 'estimate', estimate: true, change: { kind: 'frame', frame: { id: 'frame-hole', dim: 'hole', characteristic: 'position', value: 0.2, datums: ['A'] }, basic: ['location'] } };
const composite: DrawingFrame = { id: 'authored', dim: 'hole', characteristic: 'position', value: 0.1, datums: ['A'], composite: { value: 0.05, datums: ['B'], material: 'maximum' } };
const settings = (): DrawingSettings => ({ ...defaultDrawing(), dimensions: [structuredClone(dimension), structuredClone(location)] });

function rejectedWithoutChange(current: DrawingSettings) {
  const before = structuredClone(current);
  const result = applySuggestion(current, proposal);
  assert.equal(result, current, 'a stale frame suggestion returns the original settings object');
  assert.deepEqual(current, before, 'the frame, dimensions and tolerance stay unchanged');
  assert.deepEqual(current.dimensions.find(d => d.id === 'location')?.tol, { kind: 'symmetric', value: 0.2 });
  assert.equal(current.dimensions.find(d => d.id === 'location')?.basic, undefined);
}

test('a stale suggestion cannot replace an authored composite or make its location dimension basic', () => {
  const current = { ...settings(), frames: [structuredClone(composite)] };
  rejectedWithoutChange(current);
  assert.deepEqual(current.frames[0], composite);
});

test('a colliding frame ID cannot replace a standalone or another attached frame', () => {
  const standalone: DrawingFrame = { id: 'frame-hole', view: 'front', place: [1, 2], characteristic: 'flatness', value: 0.1, datums: [] };
  const otherAttached: DrawingFrame = { id: 'frame-hole', dim: 'location', characteristic: 'flatness', value: 0.1, datums: [] };
  for (const frame of [standalone, otherAttached]) rejectedWithoutChange({ ...settings(), frames: [frame] });
});

test('a suggestion for a deleted dimension leaves all other settings intact', () => {
  const current = { ...settings(), dimensions: [structuredClone(location)] };
  rejectedWithoutChange(current);
});

test('a valid suggestion still adds its frame and makes the requested dimension basic', () => {
  const unrelated: DrawingFrame = { id: 'other', view: 'front', place: [1, 2], characteristic: 'flatness', value: 0.1, datums: [] };
  const current = { ...settings(), frames: [unrelated] }, before = structuredClone(current);
  const result = applySuggestion(current, proposal);
  assert.notEqual(result, current);
  assert.equal(result.frames?.length, 2);
  assert.deepEqual(result.frames?.[0], unrelated);
  assert.deepEqual(result.frames?.[1], proposal.change.kind === 'frame' ? proposal.change.frame : null);
  const updated = result.dimensions.find(d => d.id === 'location');
  assert.equal(updated?.basic, true);
  assert.equal(updated?.tol, undefined);
  assert.deepEqual(result.dimensions.find(d => d.id === 'hole'), dimension);
  assert.deepEqual(current, before, 'successful application does not mutate the input');
});
