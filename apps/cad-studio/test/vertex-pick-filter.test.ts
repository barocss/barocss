import test from 'node:test';
import assert from 'node:assert/strict';
import { pickVertex } from '../src/viewport/vertexPick';

// Same collision class as D539: a valid outer edge hit and a different inner
// corner within the existing 7 px screen radius after zooming out.
const outer = { a: [60, -20, 0], b: [60, -20, 10] };
const inner = { a: [58, -18, 2], b: [58, -18, 10] };
const edges = [outer, inner];
const project = (p: readonly number[]) => {
  if (p === inner.a) return [104, 102];
  if (p === inner.b) return [110, 110];
  return [100, p[2] === 0 ? 90 : 110];
};

test('D539: Edges filter preserves a valid edge against a nearby inner vertex', () => {
  assert.deepEqual(pickVertex('all', 0, edges, 100, 100, project), { body: 0, at: inner.a }, 'collision is real under existing All priority');
  assert.equal(pickVertex('edge', 0, edges, 100, 100, project), null, 'actual hover/click corner picker cannot override the edge');
});

test('D539: Faces and Bodies filters cannot be replaced by nearby corners', () => {
  for (const filter of ['face', 'body'] as const) assert.equal(pickVertex(filter, 0, edges, 104, 102, project), null);
});

test('D539: All keeps nearest corner, strict 7 px boundary and no-body behavior', () => {
  assert.deepEqual(pickVertex('all', 3, edges, 104, 102, project), { body: 3, at: inner.a });
  const point = { a: [1, 2, 3], b: [4, 5, 6] };
  assert.equal(pickVertex('all', 0, [point], 0, 0, () => [7, 0]), null, 'exact radius is excluded');
  assert.deepEqual(pickVertex('all', 0, [point], 0, 0, p => p === point.b ? [6, 0] : [20, 0]), { body: 0, at: point.b });
  assert.equal(pickVertex('all', undefined, edges, 104, 102, project), null);
});

test('D539: All preserves printed-layer exclusion and returns a copy of the source point', () => {
  const hit = pickVertex('all', 0, edges, 104, 102, project, 2);
  assert.deepEqual(hit, { body: 0, at: inner.a });
  assert.notEqual(hit!.at, inner.a);
  hit!.at[0] = -999; assert.equal(inner.a[0], 58, 'picking never edits source geometry');
  assert.equal(pickVertex('all', 0, edges, 104, 102, project, 1), null);
});
