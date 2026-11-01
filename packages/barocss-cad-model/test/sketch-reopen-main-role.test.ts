// D358: reopening a sketch whose main profile is a circle or slot (with a rectangle region beside it) and pressing Finish
// with no change keeps that profile as the main one, so its kind, its Extrude fields and its parameter bindings survive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { editFields } from '../src/app/editFields';
import { rebindDims, reopenedOrder, sketchShapes } from '../src/sketch/reopen';
import { profileOf } from '../src/sketch/loops';
import { joinOpen, splitAt } from '../src/sketch/trim';
import { attachCircle, sketchClick, startPicking } from '../src/sketch/select';
import { commitDimension, rulesWithoutCircle } from '../src/sketch/rules';
import type { SketchRule } from '../src/sketch/terms';
import { xyPlane } from '../src/sketch/plane';
import type { ModelNode, SketchNode } from '../src/engine/doc';
import type { SketchShape, SketchState } from '../src/sketch/types';

const square = [[20, -5], [40, -5], [40, 5], [20, 5]].map(start => ({ kind: 'line', start }));
const R = { parameter: 'R' };
const circleNode = (radius: unknown = 5) => ({ kind: 'sketch', profile: 'circle', center: [0, 0], radius, regions: [square] }) as unknown as SketchNode;
const rectPoly: SketchShape = { kind: 'polygon', closed: true, points: [[20, -5], [40, -5], [40, 5], [20, 5]], bulges: [0, 0, 0, 0] };
const strip = (n: SketchNode) => Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'id'));

/** Reopen as the studio does (Select tool, main ids remembered), optionally change `done`, Finish in the reopened order. */
function round(node: SketchNode, params: Record<string, number> = {}, edit?: (done: SketchShape[]) => SketchShape[]) {
  const { shape, done } = sketchShapes(node, params);
  const s = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0, ...(shape?.ids?.length ? { mainIds: shape.ids } : {}) } as never, 'select') as { shape: SketchShape | null; done: SketchShape[]; mainIds?: string[] };
  const p = profileOf(joinOpen(reopenedOrder(s.shape, edit ? edit(s.done) : s.done, s.mainIds)));
  assert.ok('node' in p, JSON.stringify(p)); return p.node as SketchNode;
}

test('circle main + rectangle region: unchanged reopen keeps the circle, the region and the ids, twice', () => {
  const first = profileOf([{ kind: 'circle', c: [0, 0], r: 5 }, rectPoly]); assert.ok('node' in first);
  const stored = first.node as SketchNode & { radius: number }, again = round(stored), third = round(again);
  assert.equal(again.profile, 'circle'); assert.deepEqual(strip(again), strip(stored)); assert.deepEqual(strip(third), strip(stored));
  assert.deepEqual(again.sideTags, stored.sideTags);
});

test('a hand-written circle main keeps its main, centre and radius', () => {
  const out = round(circleNode()) as unknown as { profile: string; center: number[]; radius: number; regions: unknown[] };
  assert.equal(out.profile, 'circle'); assert.deepEqual(out.center, [0, 0]); assert.equal(out.radius, 5); assert.equal(out.regions.length, 1);
});

test('a radius bound to a parameter stays bound and nothing is dropped', () => {
  const stored = circleNode(R), out = round(stored, { R: 5 }), r = rebindDims(stored, out, { R: 5 });
  assert.deepEqual((r.node as unknown as { radius: unknown }).radius, R); assert.deepEqual(r.dropped, []);
});

test('a slot main + rectangle region keeps the slot as main', () => {
  const first = profileOf([{ kind: 'slot', a: [0, 0], b: [10, 0], r: 3 }, rectPoly]); assert.ok('node' in first);
  const stored = first.node as SketchNode, again = round(stored);
  // (The slot is rebuilt from its own loop, so numbers may differ in the last digits.)
  const shape = (n: SketchNode) => JSON.stringify(strip(n), (_, v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 + 0 : v);
  assert.equal(shape(again), shape(stored)); assert.equal(shape(round(again)), shape(stored));
  assert.deepEqual(again.sideTags, stored.sideTags);
});

test('a node without side tags (before R10a) keeps its main too', () => {
  const stored = circleNode(), out = round(stored);
  assert.equal(out.profile, 'circle');
  assert.equal((round(out) as unknown as { radius: number }).radius, 5);
});

test('main deleted: the order falls back and the rectangle becomes the main profile', () => {
  const out = round(circleNode(), {}, done => done.filter(x => x.kind !== 'circle'));
  assert.equal(out.profile, 'polygon');
});

const a: SketchShape = { kind: 'circle', c: [0, 0], r: 1, ids: ['e1'] }, b: SketchShape = { kind: 'circle', c: [5, 0], r: 1, ids: ['e2'] }, c: SketchShape = { kind: 'circle', c: [9, 0], r: 1, ids: ['e3'] };
test('reopenedOrder: no ids, empty ids or no match is [shape, ...done]', () => {
  assert.deepEqual(reopenedOrder(a, [b, c]), [a, b, c]); assert.deepEqual(reopenedOrder(a, [b, c], []), [a, b, c]);
  assert.deepEqual(reopenedOrder(a, [b, c], ['e9']), [a, b, c]); assert.deepEqual(reopenedOrder(null, [b], ['e1']), [b]);
});
test('reopenedOrder: the matching shape moves to the front, the other finished shapes follow and the edited shape is last', () => {
  assert.deepEqual(reopenedOrder(a, [b, c], ['e3']), [c, b, a]); assert.deepEqual(reopenedOrder(a, [b, c], ['e2']), [b, c, a]);
  assert.deepEqual(reopenedOrder(a, [b, c], ['e1']), [a, b, c]);
  assert.deepEqual(reopenedOrder({ ...a, ids: ['e1', 'e2'] }, [b], ['e1']), [{ ...a, ids: ['e1', 'e2'] }, b], 'the same length is needed');
});

test('the Extrude of the round-tripped circle still lists dia, cc0 and cc1', () => {
  const nodes = [round(circleNode()), { kind: 'extrude', sketch: 0, height: 10 }] as unknown as ModelNode[];
  const keys = editFields(nodes, 1).map(f => f.key);
  for (const k of ['dia', 'cc0', 'cc1']) assert.ok(keys.includes(k), `${k} in ${keys.join(',')}`);
});

// ---- D358 audit fixes: Finish with no edited shape, a clicked main circle, the stored order after the main.
const reopen = (node: SketchNode, params: Record<string, number> = {}) => {
  const { shape, done } = sketchShapes(node, params);
  return startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0, ...(shape?.ids?.length ? { mainIds: shape.ids } : {}) } as never, 'select') as SketchState & { done: SketchShape[] };
};
const finishOf = (s: SketchState) => { const p = profileOf(joinOpen(reopenedOrder(s.shape, s.done ?? [], s.mainIds))); assert.ok('node' in p, JSON.stringify(p)); return p.node as SketchNode; };
const twoRegions = () => { const p = profileOf([{ kind: 'circle', c: [0, 0], r: 5 }, rectPoly, { kind: 'polygon', closed: true, points: [[50, -5], [70, -5], [70, 5], [50, 5]], bulges: [0, 0, 0, 0] }]); assert.ok('node' in p); return p.node as SketchNode; };

test('F1: split a rectangle edge (shape is null afterwards): Finish keeps the circle main and its binding', () => {
  const stored = circleNode(R), s = reopen(stored, { R: 5 });
  assert.ok(s.shape && s.shape.kind !== 'circle'); assert.ok(s.done.some(x => x.kind === 'circle'));
  const r = splitAt(reopenedOrder(s.shape, s.done, s.mainIds).map(x => x.kind === 'polygon' ? { ...x, pending: false } : x), [30, -5], 0.5);
  assert.ok('shapes' in r, JSON.stringify(r));
  const out = finishOf({ ...s, shape: null, done: r.shapes });
  assert.equal(out.profile, 'circle'); const bound = rebindDims(stored, out, { R: 5 });
  assert.deepEqual(bound.dropped, []); assert.deepEqual((bound.node as unknown as { radius: unknown }).radius, R);
});

test('F1: Finish with shape null and every shape in done (tool switch) keeps the circle main', () => {
  const stored = circleNode(R), s = reopen(stored, { R: 5 });
  const out = finishOf({ ...s, shape: null, done: [s.shape!, ...s.done] });
  assert.equal(out.profile, 'circle'); assert.deepEqual(rebindDims(stored, out, { R: 5 }).dropped, []);
});

test('F2: clicking the main circle keeps its side id and the circle main, and the binding', () => {
  const first = profileOf([{ kind: 'circle', c: [0, 0], r: 5 }, rectPoly]); assert.ok('node' in first);
  const stored = { ...first.node, radius: R } as unknown as SketchNode, s = reopen(stored, { R: 5 });
  const i = s.done.findIndex(x => x.kind === 'circle'); assert.ok(i >= 0);
  const clicked = sketchClick(s, { kind: 'circle', i, done: true } as never, false);
  assert.ok(!clicked.done?.some(x => x.kind === 'circle'), 'the circle is attached to the outline');
  const out = finishOf(clicked);
  assert.equal(out.profile, 'circle'); assert.deepEqual(out.sideTags, (first.node as SketchNode).sideTags);
  const bound = rebindDims(stored, out, { R: 5 }); assert.deepEqual(bound.dropped, []); assert.deepEqual((bound.node as unknown as { radius: unknown }).radius, R);
});

test('F2: polygon main + circle region: clicking the circle keeps the circle region id', () => {
  const first = profileOf([rectPoly, { kind: 'circle', c: [60, 0], r: 4 }, { kind: 'circle', c: [80, 0], r: 4 }]); assert.ok('node' in first);
  const stored = first.node as SketchNode, s = reopen(stored), i = s.done.findIndex(x => x.kind === 'circle'); assert.ok(i === 0);
  const out = finishOf(sketchClick(s, { kind: 'circle', i, done: true } as never, false));
  assert.equal(out.profile, stored.profile); assert.deepEqual(out.sideTags, stored.sideTags);
});

test('F4: circle main + two rectangle regions: two no-op round trips give exactly the stored node', () => {
  const stored = twoRegions(), a = finishOf(reopen(stored)), b = finishOf(reopen(a));
  assert.deepEqual(a, stored); assert.deepEqual(b, stored); assert.equal(a.profile, 'circle');
});

test('F4: polygon main + circle region and the single-region case keep the stored order', () => {
  const p = profileOf([rectPoly, { kind: 'circle', c: [60, 0], r: 4 }]); assert.ok('node' in p);
  assert.deepEqual(finishOf(reopen(p.node as SketchNode)), p.node);
  const q = profileOf([rectPoly]); assert.ok('node' in q); assert.deepEqual(finishOf(reopen(q.node as SketchNode)), q.node);
});

test('reopenedOrder: the main rebuilt order is main, the other finished shapes, then the edited shape', () => {
  assert.deepEqual(reopenedOrder(c, [a, b], ['e1']), [a, b, c]);
  assert.deepEqual(reopenedOrder(c, [a, b], ['e2']), [b, a, c]);
  assert.deepEqual(reopenedOrder(null, [a, b, c], ['e3']), [c, a, b]);
});

test('reopenedOrder: a main circle attached to an outline comes back as its own shape first', () => {
  const poly: SketchShape = { kind: 'polygon', closed: true, points: [[20, -5], [40, -5], [40, 5], [20, 5]], bulges: [0, 0, 0, 0], ids: ['e2', 'e3', 'e4', 'e5'], circles: [{ c: [0, 0], r: 5 }, { c: [9, 9], r: 1 }], circleIds: ['e1', 'e9'] };
  const out = reopenedOrder(poly, [b], ['e1']);
  assert.deepEqual(out, [{ kind: 'circle', c: [0, 0], r: 5, ids: ['e1'] }, b, { ...poly, circles: [{ c: [9, 9], r: 1 }], circleIds: ['e9'] }]);
  const only = reopenedOrder({ ...poly, circles: [poly.circles![0]], circleIds: ['e1'] } as SketchShape, [], ['e1']);
  assert.deepEqual(only[1], { kind: 'polygon', closed: true, points: poly.points, bulges: poly.bulges, ids: poly.ids });
  assert.deepEqual(reopenedOrder(poly, [b], ['e7']), [poly, b], 'no circle with that id: the old fallback');
});

/** An outline whose circle indices every circle-indexed rule kind names (circles 0, 1, 2), for the rule rewrite. */
const allKinds = [
  { kind: 'cdist', a: 0, circle: 1, value: 1 }, { kind: 'cdx', a: 0, circle: 2, value: 2 }, { kind: 'cdy', a: 0, circle: 0, value: 3 },
  { kind: 'cedge', edge: 0, circle: 2, axis: 0, value: 4 }, { kind: 'cedge', edge: 1, circle: 1, axis: 1, value: 5 },
  { kind: 'ctan', edge: 0, circle: 2 }, { kind: 'ctan', edge: 0, circle: 0 },
  { kind: 'ccdist', a: 1, b: 2, value: 6 }, { kind: 'ccdx', a: 0, b: 2, value: 7 }, { kind: 'ccdy', a: 2, b: 1, value: 8 },
  { kind: 'cconc', a: 1, b: 2 }, { kind: 'cconc', a: 0, b: 1 },
  { kind: 'fix', point: 1, at: [0, 0] }, { kind: 'equal', a: 1, b: 2 }, { kind: 'distance', a: 1, b: 2, value: 9 },
] as unknown as SketchRule[];

test('rulesWithoutCircle: every circle-indexed rule kind drops circle 1 and renumbers circle 2 to 1', () => {
  assert.deepEqual(rulesWithoutCircle(allKinds, 1), [
    { kind: 'cdx', a: 0, circle: 1, value: 2 }, { kind: 'cdy', a: 0, circle: 0, value: 3 },
    { kind: 'cedge', edge: 0, circle: 1, axis: 0, value: 4 },
    { kind: 'ctan', edge: 0, circle: 1 }, { kind: 'ctan', edge: 0, circle: 0 },
    { kind: 'ccdx', a: 0, b: 1, value: 7 },
    // (points and edges are untouched)
    { kind: 'fix', point: 1, at: [0, 0] }, { kind: 'equal', a: 1, b: 2 }, { kind: 'distance', a: 1, b: 2, value: 9 },
  ]);
  assert.deepEqual(rulesWithoutCircle(allKinds, 0).filter(r => r.kind === 'ccdist' || r.kind === 'ccdy' || r.kind === 'cedge'),
    [{ kind: 'cedge', edge: 0, circle: 1, axis: 0, value: 4 }, { kind: 'cedge', edge: 1, circle: 0, axis: 1, value: 5 }, { kind: 'ccdist', a: 0, b: 1, value: 6 }, { kind: 'ccdy', a: 1, b: 0, value: 8 }]);
  assert.deepEqual(rulesWithoutCircle(allKinds, 5), allKinds, 'no circle 5: nothing changes');
});

test('N1: pulling the attached main circle out keeps the other circles\' rules on the same physical circles', () => {
  const first = profileOf([{ kind: 'circle', c: [0, 0], r: 5 }, rectPoly, { kind: 'circle', c: [60, 0], r: 3 }, { kind: 'circle', c: [80, 0], r: 2 }]); assert.ok('node' in first);
  const { shape, done } = sketchShapes(first.node as SketchNode);
  let s = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0, ...(shape?.ids?.length ? { mainIds: shape.ids } : {}) } as never, 'dimension') as SketchState;
  const at = (r: number) => (s.done ?? []).findIndex(x => x.kind === 'circle' && x.r === r);
  s = sketchClick(s, { kind: 'circle', i: at(5), done: true }, false); s = { ...s, picked: [], editDim: null };
  s = sketchClick(s, { kind: 'point', i: 1 }, false); s = sketchClick(s, { kind: 'circle', i: 0 }, false);
  assert.equal(s.editDim, 'cdist1_0');
  const own = commitDimension(s.shape as never, s.editDim!, 20); assert.ok(own.ok); if (!own.ok) return;
  s = { ...s, shape: own.shape, editDim: null, picked: [] };
  s = sketchClick(s, { kind: 'point', i: 0 }, false); s = sketchClick(s, { kind: 'circle', i: at(3), done: true }, false);
  assert.equal(s.editDim, 'cdist0_1');
  const r = commitDimension(s.shape as never, s.editDim!, 45); assert.ok(r.ok); if (!r.ok) return;
  s = { ...s, shape: r.shape, editDim: null, picked: [] };
  s = sketchClick(s, { kind: 'circle', i: at(2), done: true }, false);
  const r2 = commitDimension(s.shape as never, 'cdist0_2', 30); assert.ok(r2.ok); if (!r2.ok) return;
  const poly = r2.shape, ids = poly.circleIds!, physical = (p: typeof poly, rule: SketchRule) => { const j = (rule as { circle: number }).circle; return [p.circles![j].r, p.circleIds![j]]; };
  assert.deepEqual(poly.circles!.map(c => c.r), [5, 3, 2]);
  assert.equal((poly.rules ?? []).length, 3, 'a rule on the main circle and one on each other circle');
  const before = (poly.rules ?? []).map(x => physical(poly, x)).filter(([r]) => r !== 5);
  const out = reopenedOrder(poly, s.done ?? [], s.mainIds), rest = out[out.length - 1] as typeof poly;
  assert.equal(out[0].kind, 'circle'); assert.deepEqual(rest.circles!.map(c => c.r), [3, 2]); assert.deepEqual(rest.circleIds, ids.slice(1));
  assert.ok(!(rest.rules ?? []).some(x => (x as { circle: number }).circle >= rest.circles!.length), 'no rule names a missing circle');
  assert.ok(before.length === 2 && (rest.rules ?? []).every(x => physical(rest, x)[0] !== 5) && (rest.rules ?? []).length === 2, JSON.stringify(rest.rules));
  assert.deepEqual((rest.rules ?? []).map(x => physical(rest, x)), before, 'each rule still names the same physical circle');
  // The rules still solve with the circles where they are.
  const solved = commitDimension(rest, 'cdist0_0', (rest.rules![0] as { value: number }).value); assert.ok(solved.ok);
});

test('N1: a main circle with no rules attached leaves the outline\'s rules alone', () => {
  const poly: SketchShape = { kind: 'polygon', closed: true, points: rectPoly.kind === 'polygon' ? rectPoly.points : [], bulges: [0, 0, 0, 0], circles: [{ c: [60, 0], r: 3 }, { c: [0, 0], r: 5 }], circleIds: ['e9', 'e1'], rules: [{ kind: 'cdist', a: 0, circle: 0, value: 45 } as SketchRule, { kind: 'cdist', a: 1, circle: 1, value: 20 } as SketchRule] };
  const out = reopenedOrder(poly, [], ['e1']), rest = out[1] as typeof poly;
  assert.deepEqual(rest.rules, [{ kind: 'cdist', a: 0, circle: 0, value: 45 }]); assert.deepEqual(rest.circleIds, ['e9']);
});

test('attachCircle: ids out of step stay out of step; in-step ids gain exactly the circle\'s id', () => {
  const poly: SketchShape = { kind: 'polygon', closed: true, points: [[20, -5], [40, -5], [40, 5], [20, 5]], bulges: [0, 0, 0, 0] };
  const dot: SketchShape = { kind: 'circle', c: [0, 0], r: 5, ids: ['e1'] };
  const state = (shape: SketchShape) => ({ plane: xyPlane(), tool: 'dimension', shape, done: [dot] }) as unknown as SketchState;
  // circles but no ids: the id is not added (they stay out of step, and Finish renews them)
  const none = attachCircle(state({ ...poly, circles: [{ c: [9, 9], r: 1 }] } as SketchShape), 0); assert.ok(none);
  assert.equal((none.state.shape as { circleIds?: string[] }).circleIds, undefined); assert.equal((none.state.shape as { circles: unknown[] }).circles.length, 2);
  const short = attachCircle(state({ ...poly, circles: [{ c: [9, 9], r: 1 }, { c: [8, 8], r: 1 }], circleIds: ['e7'] } as SketchShape), 0); assert.ok(short);
  assert.deepEqual((short.state.shape as { circleIds?: string[] }).circleIds, ['e7']);
  // in step: exactly one id appended
  const ok = attachCircle(state({ ...poly, circles: [{ c: [9, 9], r: 1 }], circleIds: ['e7'] } as SketchShape), 0); assert.ok(ok);
  assert.deepEqual((ok.state.shape as { circleIds?: string[] }).circleIds, ['e7', 'e1']);
  const first = attachCircle(state(poly), 0); assert.ok(first);
  assert.deepEqual((first.state.shape as { circleIds?: string[] }).circleIds, ['e1']);
});
