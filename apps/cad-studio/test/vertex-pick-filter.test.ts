import test from 'node:test';
import assert from 'node:assert/strict';
import { bindNativeVertexPick, currentNativeVertexPoints, pickVertex } from '../src/viewport/vertexPick';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';

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

test('three native picks retain document and mesh identity and refuse overlapping endpoint IDs', () => {
  const doc = rectanglePart(60, 30, 10), evaluated = evaluatePart(doc, 1);
  assert.ok(evaluated.ok);
  const mesh = evaluated.bodies[0].mesh;
  const xy = (point: readonly number[]) => [point[0], point[1]];
  const face = mesh.faces.find(face => face.normal[2] > 0.99)!.index;
  const source = { mesh, face };
  const picks = [[0, 0], [60, 0], [60, 30]].map(([x, y]) => {
    const hit = pickVertex('all', 0, mesh.edges, x, y, xy, undefined, source);
    assert.ok(hit);
    bindNativeVertexPick(hit, doc);
    return hit;
  });
  assert.deepEqual(currentNativeVertexPoints(doc, evaluated.bodies, picks), [[0, 0, 10], [60, 0, 10], [60, 30, 10]]);
  assert.equal(currentNativeVertexPoints({ ...doc }, evaluated.bodies, picks), null);
  assert.equal(currentNativeVertexPoints(doc, [{ ...evaluated.bodies[0], mesh: { ...mesh } }], picks), null);
  assert.equal(currentNativeVertexPoints(doc, evaluated.bodies, [picks[0], picks[0], picks[2]]), null);

  const overlapping = [...mesh.edges, { a: [0, 0, 10], b: [0, 30, 10], faces: [face], nativeVertices: ['separate', 'other'] as const }];
  const hit = pickVertex('all', 0, overlapping, 0, 0, xy, undefined, source);
  assert.ok(hit);
  bindNativeVertexPick(hit, doc);
  assert.equal(currentNativeVertexPoints(doc, evaluated.bodies, [hit, picks[1], picks[2]]), null);

  const hidden = pickVertex('all', 0, mesh.edges, 0, 0, point => point[2] === 0 ? xy(point) : [point[0] + 10, point[1] + 10], undefined, source);
  assert.deepEqual(hidden, { body: 0, at: [0, 0, 0] });
  bindNativeVertexPick(hidden!, doc);
  assert.equal(currentNativeVertexPoints(doc, evaluated.bodies, [hidden!, picks[1], picks[2]]), null);
});

test('orthographic vertex overlap uses camera depth and leaves separated endpoints alone', () => {
  const doc = rectanglePart(60, 30, 10), evaluated = evaluatePart(doc, 1);
  assert.ok(evaluated.ok);
  const mesh = evaluated.bodies[0].mesh;
  const edge = mesh.edges.find(edge => edge.nativeVertices && edge.a[2] !== edge.b[2])!;
  const source = { mesh, edge: edge.index };
  const project = (point: readonly number[]) => [point[2] / 500, 0, point[2] / 10];
  const front = edge.a[2] < edge.b[2] ? edge.a : edge.b;
  const rear = edge.a[2] > edge.b[2] ? edge.a : edge.b;
  assert.deepEqual(pickVertex('all', 0, [edge], 0.02, 0, project, undefined, source, true)?.at, front);
  assert.deepEqual(pickVertex('all', 0, [edge], 0.02, 0, project, undefined, source)?.at, rear);
  const separated = (point: readonly number[]) => [point[2] / 2, 0, point[2] / 10];
  assert.deepEqual(pickVertex('all', 0, [edge], 5, 0, separated, undefined, source, true)?.at, rear);
});
