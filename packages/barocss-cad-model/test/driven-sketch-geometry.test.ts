import test from 'node:test';
import assert from 'node:assert/strict';
import type { ModelNode, SketchNode } from '../src/engine/doc';
import { isRefusal } from '../src/engine/refusal';
import { assertDrivenSketchNode, bindSketchLengthNode, resolveDrivenSketch, unbindSketchLengthNode } from '../src/sketch/driven';
import { sketchShapes } from '../src/sketch/reopen';
import { solveShape } from '../src/sketch/rules';

// The retained D461/D536 authored geometry, including its two free DOFs. This
// test checks solver/source behavior only; Studio/native/physical proof is separate.
const source = (): ModelNode => ({
  kind: 'sketch', profile: 'loop', id: 'n0',
  segments: [
    { kind: 'line', start: [0, 0] }, { kind: 'line', start: [60, 0] }, { kind: 'line', start: [60, 20] },
    { kind: 'line', start: [20.5, 20] }, { kind: 'arc', start: [20.5, 37.5], center: [17.5, 37.5], direction: 'ccw' },
    { kind: 'line', start: [17.5, 40.5] }, { kind: 'line', start: [0, 40.5] },
  ],
  outline: { points: [[0, 0], [60, 0], [60, 20], [20.5, 20], [20.5, 37.5], [17.5, 40.5], [0, 40.5]], bulges: [0, 0, 0, 0, Math.tan(Math.PI / 8), 0, 0], lengths: { 0: 60, 1: 20 }, radii: { 4: 3 }, tangents: [4, 5], hv: { h: [0, 2, 5], v: [1, 3, 6] } },
  holes: [[{ kind: 'line', start: [5, 5] }, { kind: 'line', start: [15, 5] }, { kind: 'line', start: [15, 10] }, { kind: 'line', start: [5, 10] }]],
  sideTags: { outer: ['e1', 'e2', 'e3', 'e4', 'e12', 'e5', 'e6'], holes: [['e7', 'e8', 'e9', 'e10']] },
  construction: [{ kind: 'polygon', closed: false, points: [[0, 0], [60, 40]], bulges: [0, 0], construction: true, ids: ['e11'] }],
});
const bound = () => bindSketchLengthNode(source(), 'e1', 'Length', { Length: 64 });
const refuses = (fn: () => unknown, code: string, text?: RegExp) => assert.throws(fn, e => isRefusal(e) && e.code === code && (!text || text.test(e.message)));
const near = (a: number, b: number, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test('one stable line resolves from its original seed: 64 -> 68 -> 64 has no history drift', () => {
  const original = source(), before = JSON.stringify(original), node = bindSketchLengthNode(original, 'e1', 'Length', { Length: 64 }), frozen = JSON.stringify(node);
  const first = resolveDrivenSketch(node, { Length: 64 });
  const wider = resolveDrivenSketch(node, { Length: 68 });
  assert.deepEqual(resolveDrivenSketch(node, { Length: 64 }), first);
  for (const [resolved, value] of [[first, 64], [wider, 68]] as const) {
    assert.ok(resolved.profile === 'loop');
    const sk = resolved as Extract<SketchNode, { profile: 'loop' }>;
    assert.deepEqual(sk.outline?.lengths, { 0: value, 1: 20 });
    const pts = sk.outline!.points;
    near(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), value);
    near(Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]), 20);
    assert.deepEqual(sk.segments.map(s => s.start), pts);
    assert.deepEqual(sk.sideTags, node.seed.sideTags); assert.deepEqual(sk.holes, node.seed.holes); assert.deepEqual(sk.construction, node.seed.construction);
    assert.deepEqual(sk.outline!.radii, { 4: 3 }); assert.deepEqual(sk.outline!.tangents, [4, 5]); assert.deepEqual(sk.outline!.hv, node.seed.outline.hv);
    const reopened = sketchShapes(sk).shape; assert.ok(reopened?.kind === 'polygon'); const report = solveShape(reopened); assert.ok(report.ok); assert.equal(report.dof, 2);
  }
  assert.equal(JSON.stringify(original), before); assert.equal(JSON.stringify(node), frozen); assert.equal(node.seed.outline.lengths![0], 60);
});

test('numeric materialization, binding and unbinding do not alias the persisted source', () => {
  const original = source(), node = bindSketchLengthNode(original, 'e1', 'Length', { Length: 64 }), before = JSON.stringify(node);
  assert.ok(original.kind === 'sketch' && original.profile === 'loop'); original.segments[0].start[0] = 99;
  const resolved = unbindSketchLengthNode(node, { Length: 68 }); assert.ok(resolved.profile === 'loop');
  resolved.segments[0].start[0] = 98; resolved.outline!.points[0][0] = 97; resolved.holes![0][0].start[0] = 96;
  (resolved.construction![0] as { points: number[][] }).points[0][0] = 95;
  assert.equal(JSON.stringify(node), before); assert.equal(resolveDrivenSketch(node, { Length: 68 }).outline!.points[0][0], 0);
});

test('whole-profile admission refuses overlap and hole-to-region changes without rewriting the seed', () => {
  const node = bound(), before = JSON.stringify(node);
  refuses(() => resolveDrivenSketch(node, { Length: 10 }), 'REFUSED', /Shapes 1 and 2 overlap/);
  refuses(() => resolveDrivenSketch(node, { Length: 4 }), 'REFUSED', /hole, region or side identity/);
  assert.equal(JSON.stringify(node), before); assert.deepEqual(resolveDrivenSketch(node, { Length: 64 }).sideTags, node.seed.sideTags);
});

test('stable entity and existing numeric driving length are required; ordinal fallback is refused', () => {
  for (const entity of ['missing', 'e7', 'e12', 'e3']) refuses(() => bindSketchLengthNode(source(), entity, 'Length', { Length: 64 }), 'PARAMETER_UNBINDABLE');
  const node = source(); assert.ok(node.kind === 'sketch'); delete node.sideTags;
  refuses(() => bindSketchLengthNode(node, 'e1', 'Length', { Length: 64 }), 'PARAMETER_UNBINDABLE');
  const duplicate = bound(); duplicate.seed.sideTags.outer[1] = 'e1'; refuses(() => resolveDrivenSketch(duplicate, { Length: 64 }), 'PARAMETER_UNBINDABLE');
});

test('missing or inherited parameters, nonfinite values and nonpositive lengths refuse explicitly', () => {
  const node = bound();
  refuses(() => resolveDrivenSketch(node, {}), 'PARAMETER_UNKNOWN');
  refuses(() => resolveDrivenSketch(node, Object.create({ Length: 64 })), 'PARAMETER_UNKNOWN');
  for (const value of [NaN, Infinity, -Infinity, 0, -1, .0009]) refuses(() => resolveDrivenSketch(node, { Length: value }), 'VALUE');
});

test('strict saved validation refuses unknown fields, stale geometry and ignored rule references', () => {
  const mutate = (edit: (x: any) => void) => { const x: any = bound(); edit(x); refuses(() => assertDrivenSketchNode(x, { Length: 64 }), 'PARAMETER_UNBINDABLE'); };
  mutate(x => x.version = 2); mutate(x => x.solved = {}); mutate(x => x.seed.cache = {}); mutate(x => x.bindings.push(x.bindings[0]));
  mutate(x => x.seed.outline.lengths[0] = { parameter: 'Other' }); mutate(x => x.seed.segments[1].start[0] = 59);
  mutate(x => x.seed.outline.lengths[0] = 59); mutate(x => x.seed.outline.radii[4] = 4);
  mutate(x => x.seed.outline.rules = [{ kind: 'future-rule', a: 0, b: 1 }]);
  mutate(x => x.seed.outline.rules = [{ kind: 'parallel', a: 0, b: 4 }]);
  mutate(x => x.seed.outline.rules = [{ kind: 'distance', a: 0, b: 1, value: 60, ignored: 1 }]);
  mutate(x => x.seed.outline.hv.h.push(4)); mutate(x => x.seed.outline.radii[0] = 3);
  mutate(x => x.seed.outline.rules = [{ kind: 'dx', a: 0, b: 1, value: -60 }]);
  mutate(x => x.plane = { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [0, 0, 2] });
  mutate(x => x.on = { node: 0, side: 'missing' });
});

test('a real solve failure preserves its reason and phase without changing the authored source', () => {
  const original = source(); assert.ok(original.kind === 'sketch'); original.outline!.rules = [{ kind: 'fix', point: 1, at: [60, 0] }];
  const before = JSON.stringify(original);
  refuses(() => bindSketchLengthNode(original, 'e1', 'Length', { Length: 64 }), 'REFUSED', /Conflict|solve|constraint/i);
  assert.equal(JSON.stringify(original), before);
});

test('all supported node context survives binding, resolution and detach', () => {
  const original = { ...source(), plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on: { node: 7, side: 'solid' }, suppressed: true, held: 'held', bought: false, rematched: { a: 'b' }, sigs: { edge: { k: 'line', p: [60, 20, 5], d: [0, 0, 1], s: 10 } } } as ModelNode;
  const node = bindSketchLengthNode(original, 'e1', 'Length', { Length: 64 });
  for (const result of [node, resolveDrivenSketch(node, { Length: 64 }), unbindSketchLengthNode(node, { Length: 64 })]) for (const key of ['id', 'plane', 'on', 'suppressed', 'held', 'bought', 'rematched', 'sigs']) assert.deepEqual((result as any)[key], (original as any)[key]);
});

test('rebinding the same entity keeps the source; a second entity requires detach', () => {
  const node = bound(); const rebound = bindSketchLengthNode(node, 'e1', 'Other', { Length: 64, Other: 68 });
  assert.deepEqual(rebound.seed, node.seed); assert.equal(rebound.bindings[0].value.parameter, 'Other');
  refuses(() => bindSketchLengthNode(node, 'e2', 'Other', { Length: 64, Other: 68 }), 'PARAMETER_UNBINDABLE');
});

test('a positive stable target at ordinal one changes that line and preserves ordinal zero', () => {
  const node = bindSketchLengthNode(source(), 'e2', 'Height', { Height: 24 });
  const resolved = resolveDrivenSketch(node, { Height: 24 });
  assert.deepEqual(resolved.outline!.lengths, { 0: 60, 1: 24 });
  const p = resolved.outline!.points;
  near(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), 60);
  near(Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]), 24);
  assert.equal(node.bindings[0].entity, 'e2'); assert.deepEqual(resolved.sideTags, node.seed.sideTags);
});

test('attached circles match original geometry tightly and cannot hide changes to separate holes', () => {
  const original = source(); assert.ok(original.kind === 'sketch');
  // profileOf keeps attached circles ahead of separate holes in the same role.
  original.outline!.circles = [{ c: [25, 10], r: 2 }];
  original.holes!.unshift([{ kind: 'arc', start: [27, 10], center: [25, 10], direction: 'ccw' }]);
  original.sideTags!.holes!.unshift(['e13']);
  const node = bindSketchLengthNode(original, 'e1', 'Length', { Length: 64 });
  const resolved = resolveDrivenSketch(node, { Length: 68 });
  assert.deepEqual(resolved.holes![1], original.holes![1]); assert.deepEqual(resolved.sideTags, original.sideTags);
  const shifted = structuredClone(node); shifted.seed.outline.circles![0].c[0] += 5e-7;
  refuses(() => resolveDrivenSketch(shifted, { Length: 64 }), 'PARAMETER_UNBINDABLE', /original full-circle/);
  assert.deepEqual(node.seed.holes![1], original.holes![1]);
});
