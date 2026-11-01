// D348: the feature editor's driving-dimension fields keep what is not the dimension — the sketch's stable id, its side ids
// (so a fillet stored on them still resolves), construction shapes, plane, body target and the generic node fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import type { ModelNode, SketchNode, StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { editFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/editFields';
import { outlineFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/outlineFields';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { commitDimension, type Polygon } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/types';

const L: [number, number][] = [[0, 0], [60, 0], [60, 20], [20, 20], [20, 40], [0, 40]];
const HOLE: [number, number][] = [[5, 5], [15, 5], [15, 10], [5, 10]];
const poly = (points: [number, number][]): Polygon => ({ kind: 'polygon', points, closed: true, bulges: points.map(() => 0) });

/** A closed polygon settled as the sketcher does, then dimensioned. */
function dimensioned(points: [number, number][], dims: Record<string, number>, extra: Partial<Polygon> = {}): Polygon {
  const raw = { ...poly(points), ...extra } as Polygon;
  const settled = settleShape(raw, { ...raw, closed: false });
  assert.equal(settled.error, null);
  let shape = settled.shape as Polygon;
  for (const [key, value] of Object.entries(dims)) {
    const r = commitDimension(shape, key, value);
    assert.ok(r.ok, JSON.stringify(r));
    shape = r.shape as Polygon;
  }
  return shape;
}
type Sk = SketchNode & { id?: string };
const withId = (n: SketchNode, id: string) => ({ ...n, id }) as unknown as Sk;
const nodeOf = (shapes: SketchShape[]): SketchNode => {
  const r = profileOf(shapes);
  assert.ok('node' in r, JSON.stringify(r));
  return r.node;
};
const numberField = (nodes: readonly ModelNode[], s: number, key: string) => {
  const f = outlineFields(nodes, s, '').find(x => x.key === key);
  assert.ok(f && f.kind === 'number', `no number field ${key}`);
  return f as Extract<typeof f, { kind: 'number' }>;
};

test('D348: a driving-dimension edit keeps the sketch id, side ids, construction and target', () => {
  const main = dimensioned(L, { len0: 60, len1: 20 });
  const construction = { kind: 'polygon', points: [[-10, -10], [80, -10]], closed: false, construction: true } as SketchShape;
  const plane = { origin: [0, 0, 5] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] };
  const on = { node: 3, side: 'solid' };
  const node = { ...nodeOf([main, poly(HOLE), construction]), id: 'n0', on, plane, suppressed: true, construction: [construction] } as unknown as SketchNode;
  assert.ok(node.sideTags?.holes, 'the node has a hole');
  const nodes: ModelNode[] = [node];
  const f = numberField(nodes, 0, 'olen0');
  const out = f.set(nodes, 70);
  assert.notEqual(out, nodes);
  const next = out[0] as SketchNode;
  for (const key of ['id', 'on', 'plane', 'suppressed', 'construction', 'sideTags'] as const) assert.deepEqual((next as unknown as Record<string, unknown>)[key], (node as unknown as Record<string, unknown>)[key], key);
  assert.deepEqual(next.outline?.lengths, { 0: 70, 1: 20 });
  assert.deepEqual(next.outline?.points, [[0, 0], [70, 0], [70, 20], [20, 20], [20, 40], [0, 40]]);
  assert.equal(f.get(out), 70);
  const reopened = sketchShapes(next);
  assert.ok(reopened.done.some(s => s.kind === 'polygon' && s.closed && s.points.length === 4), 'the hole comes back');
  assert.ok(reopened.done.some(s => s.construction), 'the construction line comes back');
});

test('D348: a fillet stored on the sketch\'s side ids still resolves after a dimension edit, and the volume follows', () => {
  const was = part('d348').extrude(sketch().polygon(L), { h: 10 })
    .fillet(b => b.edges().along('z').where(e => e.a[0] === 60 && e.a[1] === 20), { radius: 3 });
  const doc = was.doc;
  assert.deepEqual((doc.nodes[2] as { edges: string[] }).edges, ['n1.side[e2]|n1.side[e3]']);
  const main = dimensioned(L, { len0: 60, len1: 20 });
  const node = withId(nodeOf([main, poly(HOLE)]), 'n0');
  const nodes = doc.nodes.map((n, i) => i === 0 ? node : n);
  const start: StudioDoc = { ...doc, nodes };
  const filletVolume = 90 - 22.5 * Math.PI;
  assert.ok(Math.abs(part('x', start).mass({ density: 1 }).volume - (15500 - filletVolume)) < 1e-6);
  const f = editFields(nodes, 1).find(x => x.key.endsWith('olen0'));
  assert.ok(f && f.kind === 'number', 'the extrude editor lists the sketch dimension');
  if (!f || f.kind !== 'number') return;
  const edited = f.set(nodes, 70);
  const after: StudioDoc = { ...doc, nodes: edited };
  const r = evaluateDoc(after, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.deepEqual((edited[2] as { edges: string[] }).edges, ['n1.side[e2]|n1.side[e3]']);
  assert.ok(Math.abs(part('x', after).mass({ density: 1 }).volume - (17500 - filletVolume)) < 1e-6);
});

const RECT: [number, number][] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const TRI: [number, number][] = [[40, 5], [55, 5], [50, 20]];
const withCircle = (): Sk => {
  const main = dimensioned(RECT, { len0: 60, len1: 30 }, { circles: [{ c: [15, 15], r: 4 }] });
  const withDx = commitDimension(main, 'cdx0_0', 15);
  assert.ok(withDx.ok, JSON.stringify(withDx));
  return withId(nodeOf([withDx.shape as SketchShape, poly(TRI)]), 'n0');
};

test('D348: an attached circle and another loop keep their side ids through an edit', () => {
  const node = withCircle();
  assert.ok(node.sideTags?.holes?.length, 'circle and triangle are holes');
  const nodes: ModelNode[] = [node];
  const next = numberField(nodes, 0, 'olen0').set(nodes, 64)[0] as Sk;
  assert.equal(next.outline?.lengths?.[0], 64);
  assert.deepEqual(next.sideTags, node.sideTags);
});

test('D348: a node from before side ids stays without them (positional wall names stay valid)', () => {
  const node = withCircle();
  delete (node as { sideTags?: unknown }).sideTags;
  const nodes: ModelNode[] = [node];
  const next = numberField(nodes, 0, 'olen0').set(nodes, 64)[0] as Sk;
  assert.equal(next.outline?.lengths?.[0], 64);
  assert.equal('sideTags' in next, false);
});

test('D348: a value the constraints cannot take leaves the very same node list', () => {
  const node = withCircle();
  const nodes: ModelNode[] = [node];
  const f = numberField(nodes, 0, 'olen0');
  for (const v of [0, -5]) assert.equal(f.set(nodes, v), nodes);
  assert.deepEqual(nodes[0], node);
});
