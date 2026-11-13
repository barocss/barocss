// D355: reopening a finished sketch and pressing Finish with no change keeps every side id, so the features built
// on `n<k>.side[e<j>]` keep their walls (a rectangle turned into an outline for picking used to drop its ids).
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import type { SketchNode, StudioDoc } from '../src/engine/doc';
import { profileOf } from '../src/sketch/loops';
import { xyPlane } from '../src/sketch/plane';
import { rebindDims, sketchShapes } from '../src/sketch/reopen';
import { rectangleOutline, startPicking } from '../src/sketch/select';
import { joinOpen } from '../src/sketch/trim';
import type { SketchShape } from '../src/sketch/types';

type Node = Record<string, unknown>;
/** The sketch node Finish writes: the shapes joined, the profile, the construction shapes and curves kept. */
function finish(shape: SketchShape | null, done: SketchShape[], editNode: boolean): Node {
  const shapes = joinOpen((editNode && shape ? [shape, ...done] : [...done, ...(shape ? [shape] : [])]).map(x => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
  const profile = profileOf(shapes);
  assert.ok('node' in profile, JSON.stringify(profile));
  const refs = shapes.filter(x => x.construction || x.kind === 'bezier');
  return (refs.length ? { ...profile.node, construction: refs } : profile.node) as unknown as Node;
}
/** Reopen the node, switch to Select (as picking does), Finish with no change. */
function reopenFinish(node: Node): Node {
  const { shape, done } = sketchShapes(structuredClone(node) as unknown as SketchNode);
  const s = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as never, 'select');
  return finish(s.shape ?? null, s.done ?? [], true);
}

const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
const circle: SketchShape = { kind: 'circle', c: [5, 3], r: 1 };
const bezier: SketchShape = { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] };
const construction: SketchShape = { kind: 'polygon', points: [[0, 30], [5, 30]], closed: false, construction: true };
const poly = (points: [number, number][]): SketchShape => ({ kind: 'polygon', points, closed: true, bulges: points.map(() => 0) });

const cases: [string, SketchShape | null, SketchShape[]][] = [
  ['rectangle + circle hole', circle, [rect]],
  ['construction line first, then a rectangle', rect, [construction]],
  ['Bezier first, then a rectangle', rect, [bezier]],
  ['rectangle alone', rect, []],
  ['polygon + polygon hole', poly([[2, 2], [4, 2], [4, 4], [2, 4]]), [poly([[0, 0], [10, 0], [10, 8], [0, 8]])]],
  ['slot', { kind: 'slot', a: [0, 0], b: [10, 0], r: 3 }, []],
  ['rectangle drawn from its upper-right corner', { kind: 'rectangle', a: [10, 6], b: [0, 0] }, [circle]],
];
for (const [label, shape, done] of cases) {
  test(`D355: ${label}: reopen then Finish with no change keeps the side ids`, () => {
    const first = finish(shape, done, false), again = reopenFinish(first);
    assert.ok(first.sideTags, 'Finish writes side tags');
    assert.deepEqual(again.sideTags, first.sideTags);
    assert.deepEqual(reopenFinish(again).sideTags, first.sideTags, 'and again');
  });
}

test('D355: rectangleOutline keeps the ids by side and the construction flag', () => {
  const o = rectangleOutline({ kind: 'rectangle', a: [10, 6], b: [0, 0], ids: ['e1', 'e2', 'e3', 'e4'], construction: true })!;
  // Rectangle runs from a=(10,6): e1 (10,6)-(0,6), e2 (0,6)-(0,0), e3 (0,0)-(10,0), e4 (10,0)-(10,6); the outline from (0,0).
  assert.deepEqual(o.ids, ['e3', 'e4', 'e1', 'e2']);
  assert.equal(o.construction, true);
  assert.equal(rectangleOutline({ kind: 'rectangle', a: [0, 0], b: [10, 6] })!.ids, undefined);
});

test('D355: a fillet on a named side edge survives reopen and Finish with no change (same edge, same volume)', () => {
  const first = finish(circle, [rect], false), tags = (first.sideTags as { outer: string[] }).outer;
  const edge = `n1.side[${tags[1]}]|n1.side[${tags[2]}]`; // the corner (10, 6)
  const was = part('d355').extrude(sketch().polygon([[0, 0], [10, 0], [10, 6], [0, 6]]), { h: 5 })
    .fillet(b => b.edges().along('z').where(e => e.a[0] === 10 && e.a[1] === 6), { radius: 1 }).doc;
  const build = (node: Node): StudioDoc => ({ ...was, nodes: was.nodes.map((n, i) => i === 0 ? { ...node, id: (n as { id?: string }).id } as never : i === 2 ? { ...n, edges: [edge] } as never : n) });
  const before = build(first), after = build(reopenFinish(first));
  const edges = (d: StudioDoc) => {
    const r = evaluateDoc(d, 1);
    assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
    // (The named edge on the body before the fillet.)
    return part('x', { ...d, nodes: d.nodes.slice(0, 2) }).select().edges().where(e => e.names.includes(edge)).list().map(e => [e.a, e.b]);
  };
  assert.equal(JSON.stringify((after.nodes[0] as unknown as Node).sideTags), JSON.stringify(first.sideTags));
  const e0 = edges(before), e1 = edges(after);
  assert.ok(e0.length > 0);
  assert.deepEqual(e1, e0);
  assert.equal(part('x', after).mass({ density: 1 }).volume, part('x', before).mass({ density: 1 }).volume);
});

test('Slot editing requires matching literal authored metadata and leaves legacy loops ordinary', () => {
  const result = profileOf([{ kind: 'slot', a: [10, 15], b: [48.9711, 37.5], r: 7 }]);
  assert.ok('node' in result && result.node.profile === 'loop');
  const node = result.node;
  const bytes = JSON.stringify(node);
  const reopened = sketchShapes(JSON.parse(bytes));
  assert.deepEqual(reopened.shape, { kind: 'slot', ...node.slot, ids: node.sideTags?.outer });
  assert.deepEqual(finish(reopened.shape, reopened.done, true), node);
  const { slot, ...legacy } = node;
  assert.ok(slot);
  assert.equal(sketchShapes(legacy).shape?.kind, 'polygon');
  assert.equal(sketchShapes({ ...node, slot: { ...slot, r: 8 } }).shape?.kind, 'polygon');

  const bound = structuredClone(node);
  bound.segments[0].start[0] = { parameter: 'X' };
  assert.equal(sketchShapes(bound, { X: Number(node.segments[0].start[0]) }).shape?.kind, 'polygon');
  const invalidHint = { ...node, slot: { ...slot, r: { parameter: 'missing' } } } as unknown as SketchNode;
  assert.equal(sketchShapes(invalidHint).shape?.kind, 'polygon');
  assert.deepEqual(rebindDims(invalidHint, legacy).dropped, []);
});

test('D1096 restores authored Length only on the matching literal region', () => {
  const secondary = rectangleOutline({ kind: 'rectangle', a: [20, 0], b: [44.125, 6] })!;
  secondary.points[1][1] += 5e-10;
  secondary.lengths = { 0: 24.12500004 };
  const result = profileOf([rect, secondary]);
  assert.ok('node' in result);
  const node: SketchNode = JSON.parse(JSON.stringify(result.node));
  const recipes = node.regionLengths;
  assert.equal(recipes?.length, 1);
  assert.deepEqual(recipes[0].sides, node.sideTags?.regions?.[0]);
  assert.deepEqual(recipes[0].points, node.regions?.[0].map(segment => segment.start));
  const polygon = (source: SketchNode, parameters = {}) => {
    const region = sketchShapes(source, parameters).done[0];
    assert.equal(region.kind, 'polygon');
    return region;
  };
  const reopened = polygon(node);
  assert.deepEqual(reopened.lengths, secondary.lengths);
  assert.deepEqual(reopened.hv, secondary.hv);
  assert.deepEqual(reopenFinish(node as unknown as Node).regionLengths, recipes);
  const { regionLengths: _, ...legacy } = node;
  assert.equal(polygon(legacy).lengths, undefined);
  const malformed = [
    [{ ...recipes[0], sides: [...recipes[0].sides].reverse() }],
    [{ ...recipes[0], points: [[21, 0], ...recipes[0].points.slice(1)] }],
    [{ ...recipes[0], lengths: { 0: 40 } }],
    [{ ...recipes[0], hv: { h: [1], v: [] } }],
    [{ ...recipes[0], lengths: { 0: { parameter: 'missing' } } }],
    [recipes[0], recipes[0]],
  ];
  for (const recipe of malformed) {
    const bad = { ...node, regionLengths: recipe } as SketchNode;
    assert.equal(polygon(bad).lengths, undefined);
    assert.deepEqual(rebindDims(bad, legacy).dropped, []);
  }
  const bound = structuredClone(node);
  bound.regions![0][0].start[0] = { parameter: 'X' };
  assert.equal(polygon(bound, { X: 20 }).lengths, undefined);
});

test('D1100 restores radius and tangency only on the exact literal native hole', () => {
  const hole: SketchShape = { kind: 'polygon', closed: true,
    points: [[4, 2], [16, 2], [18, 4], [18, 6], [16, 8], [4, 8], [2, 6], [2, 4]],
    bulges: Array.from({ length: 8 }, (_, i) => i % 2 ? Math.tan(Math.PI / 8) : 0),
    radii: { 1: 2, 3: 2, 5: 2, 7: 2 }, tangents: [0, 1, 2, 3, 4, 5, 6, 7], hv: { h: [0, 4], v: [2, 6] } };
  const result = profileOf([{ kind: 'rectangle', a: [0, 0], b: [20, 10] }, hole]);
  assert.ok('node' in result);
  const node: SketchNode = JSON.parse(JSON.stringify(result.node));
  const recipes = node.holeOutlines;
  assert.equal(recipes?.length, 1);
  const reopened = (source: SketchNode, params = {}) => {
    const shape = sketchShapes(source, params).done[0];
    assert.equal(shape.kind, 'polygon');
    return shape;
  };
  assert.deepEqual(reopened(node).radii, hole.radii);
  assert.deepEqual(reopened(node).tangents, hole.tangents);
  assert.deepEqual(reopened(node).hv, hole.hv);
  assert.deepEqual(reopenFinish(node as unknown as Node).holeOutlines, recipes);
  const { radii: _unlocked, ...unlocked } = reopened(node);
  const remade = profileOf([{ kind: 'rectangle', a: [0, 0], b: [20, 10] }, unlocked]);
  assert.ok('node' in remade);
  assert.deepEqual(reopened(remade.node).tangents, hole.tangents);
  assert.deepEqual(reopened(remade.node).hv, hole.hv);
  assert.equal(reopened(remade.node).radii, undefined);
  const { holeOutlines: _, ...legacy } = node;
  assert.equal(reopened(legacy).radii, undefined);
  const recipe = recipes[0], outline = recipe.outline;
  for (const bad of [
    { ...recipe, sides: [...recipe.sides].reverse() },
    { ...recipe, outline: { ...outline, bulges: outline.bulges?.map(b => -b) } },
    { ...recipe, outline: { ...outline, tangents: [0, 8] } },
    { ...recipe, outline: { ...outline, radii: { 1: 3 } } },
    { ...recipe, outline: { ...outline, radii: { 1: { parameter: 'missing' } } } },
  ]) {
    const malformed = { ...node, holeOutlines: [bad] } as SketchNode;
    assert.equal(reopened(malformed).radii, undefined);
    assert.deepEqual(rebindDims(malformed, legacy).dropped, []);
  }
  assert.equal(reopened({ ...node, holeOutlines: [recipe, recipe] }).radii, undefined);
  const bound = structuredClone(node);
  bound.holes![0][0].start[0] = { parameter: 'X' };
  assert.equal(reopened(bound, { X: 4 }).radii, undefined);
});
