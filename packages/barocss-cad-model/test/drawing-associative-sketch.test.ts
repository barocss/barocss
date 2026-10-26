import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection, ProjectedEdge } from '@barocss/cad';
import { drawingInputs } from '../src/chat/drawing';
import { rectanglePart, withNode, type PlanarFaceOutlineInsetAssociation, type StudioDoc } from '../src/engine/doc';
import { featureId } from '../src/engine/ids';
import { resolveDimension } from '../src/drawing/dimensions';

// Requires the common associative-sketch producer present at e456e7f3; the older author worktree lacks it.
// Independent rectangular-solid oracle, model mm: lower box 60×24×4 and upper island 56×20×4.
// The 1e-9 comparison follows the existing sketch-associative-inset test convention.
const EPS = 1e-9;
type XY = readonly [number, number];
type XYZ = readonly [number, number, number];
const samePoint = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, k) => Number.isFinite(v) && Math.abs(v - b[k]) <= EPS);
const near = (actual: number, expected: number) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= EPS, `${actual} != ${expected} model mm`);

function document(linked: boolean): StudioDoc {
  let doc = rectanglePart(40, 24, 8);
  const association: PlanarFaceOutlineInsetAssociation = {
    kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' },
    sourceFeature: featureId(doc.nodes, 1), face: `${featureId(doc.nodes, 1)}.top`, insetMM: 2,
  };
  doc = withNode(doc, {
    kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24],
    holes: [[
      { kind: 'line', start: [2, 2] }, { kind: 'line', start: [38, 2] },
      { kind: 'line', start: [38, 22] }, { kind: 'line', start: [2, 22] },
    ]],
    plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] },
    on: { node: 1, side: 'solid' }, ...(linked ? { association } : {}),
  });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 4, from: -4 });
  doc = withNode(doc, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const edited = structuredClone(doc), source = edited.nodes[0];
  assert.ok(source.kind === 'sketch' && source.profile === 'rectangle');
  source.max[0] = 60;
  return edited;
}

function edgeWithEnds(pr: BrepProjection, a: XYZ, b: XYZ): ProjectedEdge | undefined {
  return pr.edges.find(e => e.kind === 'line' && e.ends && (
    (samePoint(e.ends[0], a) && samePoint(e.ends[1], b)) ||
    (samePoint(e.ends[0], b) && samePoint(e.ends[1], a))
  ));
}

function boundary(pr: BrepProjection, corners: readonly XYZ[]): void {
  for (let k = 0; k < corners.length; k++) {
    const a = corners[k], b = corners[(k + 1) % corners.length];
    assert.ok(edgeWithEnds(pr, a, b), `actual 3D boundary ${JSON.stringify([a, b])}`);
  }
}

// Check support across visible line fragments, without fixing their count, names or order.
function visibleSegment(pr: BrepProjection, a: XY, b: XY): void {
  const axis = a[0] === b[0] ? 1 : 0, fixed = 1 - axis;
  assert.equal(a[fixed], b[fixed], 'the literal oracle segment is axis aligned');
  const lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
  const intervals = pr.edges.flatMap(e => e.pieces.flatMap(p => {
    const c = p.curve;
    if (!p.visible || c.kind !== 'line' || !samePoint([c.a[fixed]], [a[fixed]]) || !samePoint([c.b[fixed]], [a[fixed]])) return [];
    return [[Math.min(c.a[axis], c.b[axis]), Math.max(c.a[axis], c.b[axis])]];
  })).sort((x, y) => x[0] - y[0]);
  let reached = lo;
  for (const [start, end] of intervals) {
    if (end < reached - EPS) continue;
    if (start > reached + EPS) break;
    reached = Math.max(reached, end);
  }
  assert.ok(reached >= hi - EPS, `visible projection covers ${JSON.stringify([a, b])}`);
}

test('Drawing consumes the current linked inset boundary and cut depth without rewriting its saved cache', () => {
  const doc = document(true), before = structuredClone(doc);
  const input = drawingInputs(doc);
  assert.ok(typeof input !== 'string', typeof input === 'string' ? input : '');
  const { top, front } = input.views;
  assert.ok(samePoint(top.right, [1, 0, 0])); assert.ok(samePoint(top.up, [0, 1, 0]));
  assert.ok(samePoint(front.right, [1, 0, 0])); assert.ok(samePoint(front.up, [0, 0, 1]));
  near(top.min[0], 0); near(top.min[1], 0); near(top.max[0], 60); near(top.max[1], 24);
  boundary(top, [[0, 0, 4], [60, 0, 4], [60, 24, 4], [0, 24, 4]]);
  boundary(top, [[2, 2, 8], [58, 2, 8], [58, 22, 8], [2, 22, 8]]);
  for (const [a, b] of [
    [[0, 0], [60, 0]], [[60, 0], [60, 24]], [[60, 24], [0, 24]], [[0, 24], [0, 0]],
    [[2, 2], [58, 2]], [[58, 2], [58, 22]], [[58, 22], [2, 22]], [[2, 22], [2, 2]],
  ] as const) visibleSegment(top, a, b);
  for (const [a, b] of [
    [[0, 0], [60, 0]], [[0, 4], [60, 4]], [[2, 4], [2, 8]], [[58, 4], [58, 8]], [[2, 8], [58, 8]],
  ] as const) visibleSegment(front, a, b);
  const side = edgeWithEnds(front, [2, 2, 4], [2, 2, 8]);
  assert.ok(side, 'the current island has a four-mm vertical edge');
  const depth = resolveDimension(input.views, {
    id: 'depth', view: 'front', kind: 'linear', orient: 'vertical', place: [-4, 6],
    a: { edge: side.name, at: 'end', near: [2, 2, 4] },
    b: { edge: side.name, at: 'end', near: [2, 2, 8] },
  });
  assert.ok(depth.ok && depth.kind === 'linear', JSON.stringify(depth));
  near(depth.value, 4); assert.equal(depth.text, '4');
  assert.deepEqual(doc, before, 'Drawing preserves source nodes, recipe and the saved 40/36-mm cache');
});

test('Drawing keeps the legacy copied inset at x38 and x40 despite the same sixty-mm outer bounds', () => {
  const doc = document(false), before = structuredClone(doc);
  const input = drawingInputs(doc);
  assert.ok(typeof input !== 'string', typeof input === 'string' ? input : '');
  const top = input.views.top;
  // The whole source still spans sixty mm, so bounds alone cannot reject stale copied geometry.
  near(top.min[0], 0); near(top.max[0], 60); near(top.max[1], 24);
  boundary(top, [[2, 2, 8], [38, 2, 8], [38, 22, 8], [2, 22, 8]]);
  assert.ok(edgeWithEnds(top, [40, 0, 8], [40, 24, 8]), 'the copied cut ends at x40');
  visibleSegment(top, [2, 2], [38, 2]);
  visibleSegment(top, [38, 2], [38, 22]);
  visibleSegment(top, [40, 0], [40, 24]);
  const cache = doc.nodes[2];
  assert.ok(cache.kind === 'sketch');
  assert.equal(cache.association, undefined, 'legacy snapshots acquire no association');
  assert.deepEqual(doc, before, 'Drawing must not upgrade or rewrite the legacy snapshot');
});
