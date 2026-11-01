// D356: a sketch whose dimensions are bound to parameters reopens at their current values, and Finish keeps each binding the person did not change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { editFields } from '../src/app/editFields';
import { editCommand } from '../src/app/editCommand';
import { withNode, type ModelNode } from '../src/engine/doc';
import { rebindDims, reopenedOrder, sketchShapes } from '../src/sketch/reopen';
import { profileOf } from '../src/sketch/loops';
import { joinOpen } from '../src/sketch/trim';
import { startPicking } from '../src/sketch/select';
import { xyPlane } from '../src/sketch/plane';
import type { SketchNode, StudioDoc } from '../src/engine/doc';
import type { SketchShape } from '../src/sketch/types';

const params = { W: 40, R: 5, X: 30 };
const docOf = (sketch: Record<string, unknown>): StudioDoc => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: params, nodes: [
  { kind: 'sketch', ...sketch, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as unknown as StudioDoc);

/** Reopen as the studio does, optionally edit the shape, finish: the profile node. */
function finish(node: SketchNode, edit?: (s: SketchShape) => SketchShape, doneEdit?: (d: SketchShape[]) => SketchShape[], ps: Record<string, number> = params) {
  const { shape, done } = sketchShapes(node, ps);
  const mainIds = shape?.ids?.length ? shape.ids : undefined;
  const s = startPicking({ plane: xyPlane(), tool: 'select', shape: shape && edit ? edit(shape) : shape, done, editNode: 0, ...(mainIds ? { mainIds } : {}) } as never, 'select') as { shape: SketchShape; done: SketchShape[] };
  // (Finish order as Studio keeps it: the stored main profile first, whatever Select moved.)
  const p = profileOf(joinOpen(reopenedOrder(s.shape, doneEdit ? doneEdit(s.done) : s.done, mainIds)));
  assert.ok('node' in p); return rebindDims(node, p.node, ps);
}
const refinish = (node: SketchNode, edit?: (s: SketchShape) => SketchShape): SketchNode => finish(node, edit).node;
const X = { parameter: 'X' }, W = { parameter: 'W' }, R = { parameter: 'R' };
/** The parameters still referenced anywhere in the node. */
const refsOf = (n: unknown): string[] => JSON.stringify(n).match(/"parameter":"\w+"/g)?.map(x => x.slice(13, -1)) ?? [];
const pointsOf = (n: SketchNode) => (n as Extract<SketchNode, { profile: 'polygon' }>).points;
const sketchNode = (sketch: Record<string, unknown>) => docOf(sketch).nodes[0] as SketchNode;
const strip = (n: SketchNode) => Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'sideTags' && k !== 'id'));
const evaluates = async (node: SketchNode, ps: Record<string, number> = params) => (await evaluateDoc({ ...docOf({}), parameters: ps, nodes: [{ ...node, id: 'n0' }, docOf({}).nodes[1]] } as StudioDoc, 1)).ok;

test('rectangle with max[0] bound reopens at the parameter and finishes unchanged with the binding', async () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] });
  const { shape } = sketchShapes(stored, params);
  assert.deepEqual(shape && shape.kind === 'rectangle' && [shape.a, shape.b], [[0, 0], [40, 40]]);
  const out = refinish(stored);
  assert.deepEqual(strip(out), strip(stored)); assert.ok(await evaluates(out));
});

test('rectangle with min[1] bound keeps it', async () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, { parameter: 'R' }], max: [60, 40] });
  const out = refinish(stored);
  assert.deepEqual(strip(out), strip(stored)); assert.ok(await evaluates(out));
});

test('changing the bound value makes it a number and says so', () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] });
  const bnd = finish(stored, s => ({ ...s, a: [0, 0], b: [45, 40] }) as SketchShape);
  assert.deepEqual((bnd.node as Extract<SketchNode, { profile: 'rectangle' }>).max, [45, 40]); assert.deepEqual(bnd.dropped, ['W']);
});

test('circle radius bound', async () => {
  const stored = sketchNode({ profile: 'circle', center: [0, 0], radius: { parameter: 'R' } });
  const { shape } = sketchShapes(stored, params);
  assert.ok(shape?.kind === 'circle' && shape.r === 5);
  const out = refinish(stored);
  assert.deepEqual(strip(out), strip(stored)); assert.ok(await evaluates(out));
});

test('polygon point coordinate bound', async () => {
  const stored = sketchNode({ profile: 'polygon', points: [[0, 0], [{ parameter: 'X' }, 0], [30, 20]] });
  const { shape } = sketchShapes(stored, params);
  assert.ok(shape?.kind === 'polygon'); assert.deepEqual(shape.points, [[0, 0], [30, 0], [30, 20]]);
  const out = refinish(stored) as Extract<SketchNode, { points: unknown }>;
  assert.deepEqual(out.points[1], [{ parameter: 'X' }, 0]); assert.ok(await evaluates(out));
});

test('a missing parameter refuses the reopen with no NaN', () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, 0], max: [{ parameter: 'Gone' }, 40] });
  assert.throws(() => sketchShapes(stored, params), /Gone/);
  assert.throws(() => sketchShapes(stored), /Gone/);
});

test('loop segment start and arc centre bound', async () => {
  const stored = sketchNode({ profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [W, 0], center: [W, 10], direction: 'ccw' }, { kind: 'line', start: [40, 20] }, { kind: 'line', start: [0, 20] }] });
  assert.ok(await evaluates(stored));
  const out = refinish(stored) as Extract<SketchNode, { profile: 'loop' }>;
  assert.equal(out.profile, 'loop'); assert.deepEqual(out.segments[1].start, [W, 0]); assert.deepEqual((out.segments[1] as { center: unknown }).center, [W, 10]);
  assert.ok(await evaluates(out));
});

test('circle centre bound through the feature editor (cc0, cc1) reopens and finishes unchanged with both bindings', async () => {
  let doc = withNode({ ...docOf({ profile: 'circle', center: [3, 4], radius: 5 }), parameters: { X: 3, Y: 4 } } as StudioDoc, { kind: 'extrude', sketch: 0, height: 5 } as never);
  const e = doc.nodes.length - 1;
  for (const [key, name] of [['cc0', 'X'], ['cc1', 'Y']]) {
    const field = editFields(doc.nodes, e, doc.parameters).find(f => f.key === key) as unknown as { bind(n: unknown, name: string): ModelNode[] | null };
    const bound = field.bind(doc.nodes, name); assert.ok(bound); doc = { ...doc, nodes: bound };
  }
  const stored = doc.nodes[0] as SketchNode; assert.deepEqual((stored as { center: unknown }).center, [X, { parameter: 'Y' }]);
  const out = finish(stored, undefined, undefined, doc.parameters); assert.deepEqual(out.dropped, []);
  assert.deepEqual((out.node as { center: unknown }).center, [X, { parameter: 'Y' }]); assert.ok(await evaluates(out.node, doc.parameters));
});

test('region and hole bindings are kept; a region the person deleted is dropped and reported', () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, 0], max: [100, 40],
    regions: [[{ kind: 'line', start: [110, 0] }, { kind: 'line', start: [X, 0] }, { kind: 'line', start: [X, 40] }, { kind: 'line', start: [110, 40] }]],
    holes: [[{ kind: 'arc', start: [{ parameter: 'S' }, 20], center: [25, 20], direction: 'ccw' }]] });
  const ps = { X: 130, S: 30 }, same = finish(stored, undefined, undefined, ps);
  assert.deepEqual(same.dropped, []); assert.deepEqual(refsOf(same.node).sort(), ['S', 'X', 'X']);
  assert.deepEqual((same.node as { holes: { start: unknown }[][] }).holes[0][0].start, [{ parameter: 'S' }, 20]);
  const gone = finish(stored, undefined, d => d.filter(x => x.kind !== 'polygon' && x.kind !== 'rectangle'), ps);
  assert.deepEqual(gone.dropped, ['X']); assert.deepEqual(refsOf(gone.node), ['S']);
});

test('F1 (D358): circle first with a rectangle region, reopened and finished unchanged: the circle stays the main profile and keeps its binding', async () => {
  const stored = sketchNode({ profile: 'circle', center: [0, 0], radius: R, regions: [[{ kind: 'line', start: [20, -5] }, { kind: 'line', start: [40, -5] }, { kind: 'line', start: [40, 5] }, { kind: 'line', start: [20, 5] }]] });
  const out = finish(stored, undefined, undefined, { R: 5 });
  assert.deepEqual(out.dropped, []); assert.deepEqual(refsOf(out.node), ['R']); assert.equal(out.node.profile, 'circle'); assert.ok(await evaluates(out.node));
});

test('loops swapping slots keep their binding when the form matches, and nothing is bound across forms', () => {
  const stored = sketchNode({ profile: 'polygon', points: [[0, 0], [10, 0], [10, 10]], regions: [[{ kind: 'line', start: [20, 0] }, { kind: 'line', start: [X, 0] }, { kind: 'line', start: [30, 10] }]] });
  const next = { kind: 'sketch', profile: 'polygon', points: [[20, 0], [30, 0], [30, 10]], regions: [[{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [10, 0] }, { kind: 'line', start: [10, 10] }]] } as unknown as SketchNode;
  // (Representations differ: a region is a loop, the main shape a polygon, so nothing may be bound across them.)
  const out = rebindDims(stored, next, { X: 30 }); assert.deepEqual(out.dropped, ['X']); assert.deepEqual(refsOf(out.node), []);
  const loopMain = sketchNode({ profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [10, 0] }, { kind: 'line', start: [10, 10] }], regions: [[{ kind: 'line', start: [20, 0] }, { kind: 'line', start: [X, 0] }, { kind: 'line', start: [30, 10] }]] });
  const swapped = { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [20, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 10] }], regions: [[{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [10, 0] }, { kind: 'line', start: [10, 10] }]] } as unknown as SketchNode;
  const kept = rebindDims(loopMain, swapped, { X: 30 }); assert.deepEqual(kept.dropped, []);
  assert.deepEqual((kept.node as { segments: { start: unknown }[] }).segments[1].start, [X, 0]);
});

test('F2: a deleted, rotated or inserted vertex never lands the binding on another vertex', () => {
  const stored = sketchNode({ profile: 'polygon', points: [[0, 0], [X, 0], [30, 20], [0, 20]] }), ps = { X: 30 };
  const poly = (points: [number, number][]) => (s: SketchShape) => ({ ...s, points, bulges: points.map(() => 0) }) as SketchShape;
  const cases: Record<string, [number, number][]> = {
    B1: [[0, 0], [30, 20], [0, 20]], B4: [[30, 0], [30, 20], [0, 20], [0, 0]], B2: [[0, 0], [15, -5], [30, 0], [30, 20], [0, 20]] };
  for (const [name, points] of Object.entries(cases)) {
    const out = finish(stored, poly(points), undefined, ps);
    assert.deepEqual(out.dropped, ['X'], name); assert.deepEqual(refsOf(out.node), [], name); assert.deepEqual(pointsOf(out.node), points, name);
  }
  // (Unchanged, the same vertex keeps it.)
  const same = finish(stored, undefined, undefined, ps); assert.deepEqual(same.dropped, []); assert.deepEqual(pointsOf(same.node)[1], [X, 0]);
});

test('C1: deleting region 0 does not hand its binding to region 1; deleting an unbound region 0 moves region 1 up and keeps its binding', () => {
  const sq = (x0: number, x1: number | { parameter: string }) => [{ kind: 'line', start: [x0, 0] }, { kind: 'line', start: [x1, 0] }, { kind: 'line', start: [x1, 40] }, { kind: 'line', start: [x0, 40] }];
  const ps = { X: 100 }, drop0 = (d: SketchShape[]) => d.slice(1);
  const a = sketchNode({ profile: 'rectangle', min: [0, 0], max: [40, 40], regions: [sq(60, X), sq(120, 140)] });
  const outA = finish(a, undefined, drop0, ps); assert.deepEqual(outA.dropped, ['X']); assert.deepEqual(refsOf(outA.node), []);
  const b = sketchNode({ profile: 'rectangle', min: [0, 0], max: [40, 40], regions: [sq(60, 80), sq(120, X)] });
  const outB = finish(b, undefined, drop0, { X: 140 }); assert.deepEqual(outB.dropped, []); assert.deepEqual(refsOf(outB.node), ['X', 'X']);
  assert.deepEqual((outB.node as { regions: { start: unknown }[][] }).regions[0][1].start, [X, 0]);
});

test('F3: a loop that changes form drops its binding and says so; untouched loops keep theirs', async () => {
  const rect = sketchNode({ profile: 'rectangle', min: [0, 0], max: [W, 40], regions: [[{ kind: 'line', start: [60, 0] }, { kind: 'line', start: [X, 0] }, { kind: 'line', start: [X, 40] }, { kind: 'line', start: [60, 40] }]] });
  const ps = { W: 40, X: 80 }, W0 = 40;
  const moved = finish(rect, () => ({ kind: 'polygon', closed: true, points: [[-5, -5], [W0, 0], [W0, 40], [0, 40]], bulges: [0, 0, 0, 0] }) as SketchShape, undefined, ps);
  assert.equal(moved.node.profile, 'polygon'); assert.deepEqual(moved.dropped, ['W']); assert.deepEqual(refsOf(moved.node), ['X', 'X']);
  // concave polygon -> loop (form changes though the values do not)
  const concave = sketchNode({ profile: 'polygon', points: [[0, 0], [W, 0], [20, 10], [W, 40], [0, 40]] });
  const c = finish(concave, undefined, undefined, ps); assert.equal(c.node.profile, 'loop'); assert.deepEqual(c.dropped, ['W']); assert.ok(await evaluates(c.node));
  // convex line-only loop -> polygon
  const convex = sketchNode({ profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [W, 0] }, { kind: 'line', start: [W, 40] }, { kind: 'line', start: [0, 40] }] });
  const v = finish(convex, undefined, undefined, ps); assert.equal(v.node.profile, 'polygon'); assert.deepEqual(v.dropped, ['W']);
  // a hole arc whose start the sketcher rewrites
  const hole = sketchNode({ profile: 'rectangle', min: [0, 0], max: [60, 40], holes: [[{ kind: 'arc', start: [25, { parameter: 'Y' }], center: [25, 10], direction: 'ccw' }]] });
  const h = finish(hole, undefined, undefined, { Y: 15 }); assert.deepEqual(h.dropped, ['Y']); assert.deepEqual(refsOf(h.node), []);
  // a construction entry
  const cons = sketchNode({ profile: 'rectangle', min: [0, 0], max: [60, 40], construction: [{ kind: 'circle', c: [W, 10], r: 3, construction: true }] });
  const k = finish(cons, undefined, undefined, ps); assert.deepEqual(k.dropped, ['W']); assert.deepEqual(refsOf(k.node), []);
});

test('an unbound change keeps the other binding of a rectangle or a circle; a point list does not', () => {
  const rect = sketchNode({ profile: 'rectangle', min: [0, 0], max: [W, 40] });
  const height = finish(rect, s => ({ ...s, b: [40, 50] }) as SketchShape);
  assert.deepEqual((height.node as { max: unknown }).max, [W, 50]); assert.deepEqual(height.dropped, []);
  const width = finish(rect, s => ({ ...s, b: [45, 40] }) as SketchShape);
  assert.deepEqual((width.node as { max: unknown }).max, [45, 40]); assert.deepEqual(width.dropped, ['W']);
  const radius = sketchNode({ profile: 'circle', center: [0, 0], radius: R });
  const moved = finish(radius, s => ({ ...s, c: [7, 3] }) as SketchShape);
  assert.deepEqual((moved.node as { center: unknown; radius: unknown }).center, [7, 3]); assert.deepEqual((moved.node as { radius: unknown }).radius, R); assert.deepEqual(moved.dropped, []);
  const centre = sketchNode({ profile: 'circle', center: [X, 0], radius: 5 });
  const bigger = finish(centre, s => ({ ...s, r: 8 }) as SketchShape);
  assert.deepEqual((bigger.node as { center: unknown; radius: unknown }).center, [X, 0]); assert.equal((bigger.node as { radius: unknown }).radius, 8); assert.deepEqual(bigger.dropped, []);
  const resized = finish(centre, s => ({ ...s, c: [31, 0] }) as SketchShape);
  assert.deepEqual(resized.dropped, ['X']);
  // A point list: a binding stays only while the other points are unchanged.
  const poly = sketchNode({ profile: 'polygon', points: [[0, 0], [X, 0], [30, 10]] });
  const same = rebindDims(poly, { kind: 'sketch', profile: 'polygon', points: [[0, 0], [30, 0], [30, 10]] } as unknown as SketchNode, { X: 30 });
  assert.deepEqual(same.dropped, []);
  const other = rebindDims(poly, { kind: 'sketch', profile: 'polygon', points: [[1, 0], [30, 0], [30, 10]] } as unknown as SketchNode, { X: 30 });
  assert.deepEqual(other.dropped, ['X']); assert.deepEqual(refsOf(other.node), []);
});

test('a non-finite parameter value is refused as having no finite value; a missing one as not there', () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, 0], max: [W, 40] });
  for (const bad of [NaN, Infinity, -Infinity]) assert.throws(() => sketchShapes(stored, { W: bad }), /\[PARAMETER_UNKNOWN\].*W.*has no finite value/);
  assert.throws(() => sketchShapes(stored, {}), /W, which this document does not have/);
  const next = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40] } as unknown as SketchNode;
  assert.deepEqual(rebindDims(stored, next, { W: NaN }).dropped, ['W']); assert.deepEqual(rebindDims(stored, next, {}).dropped, ['W']);
});

test('the same value within 1e-9 relative keeps the binding; 1e-6 away does not', () => {
  const stored = sketchNode({ profile: 'rectangle', min: [0, 0], max: [W, 40] });
  const at = (x: number) => rebindDims(stored, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [x, 40] } as unknown as SketchNode, { W: 1000 });
  assert.deepEqual(at(1000 + 1e-7).dropped, []); assert.deepEqual(at(1000 + 1e-3).dropped, ['W']);
  assert.deepEqual(at(1000 + 1e-8).dropped, []);
  const small = (x: number) => rebindDims(sketchNode({ profile: 'rectangle', min: [0, 0], max: [W, 40] }), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [x, 40] } as unknown as SketchNode, { W: 1 });
  assert.deepEqual(small(1 + 1e-10).dropped, []); assert.deepEqual(small(1 + 1e-6).dropped, ['W']);
});

test('D348: an outline field edit keeps the bindings of loops it did not touch, given the parameters', () => {
  const profile = profileOf([{ kind: 'polygon', closed: true, points: [[4, 4], [52, 4], [52, 20], [28, 20], [28, 36], [4, 36]], hv: { h: [0, 2, 4], v: [1, 3, 5] }, lengths: { 0: 48 } },
    { kind: 'polygon', closed: true, points: [[70, 0], [80, 0], [80, 10]], bulges: [0, 0, 0] }]); assert.ok('node' in profile);
  const node = profile.node as Extract<SketchNode, { profile: 'loop' }>; assert.ok(node.regions?.length === 1 && node.outline);
  const bound = { ...node, regions: node.regions!.map(l => l.map((sg, i) => i === 1 ? { ...sg, start: [X, sg.start[1]] } : sg)) } as SketchNode;
  const nodes = [{ ...bound, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 5, id: 'n1' }] as never[];
  const edit = (ps?: Record<string, number>) => { const f = editFields(nodes, 1, ps).find(x => x.key === 'olen0'); assert.ok(f && f.kind === 'number'); return f.set(nodes, 60); };
  const kept = edit({ X: 80 })[0] as Extract<SketchNode, { profile: 'loop' }>;
  assert.deepEqual(kept.segments[1].start, [64, 4]); assert.deepEqual(kept.regions![0][1].start, [X, 0]);
  // (Without the parameters the sketch cannot be read back: nothing is changed.)
  assert.deepEqual(edit({}), nodes);
  // The bound loop itself re-solved: its binding is a number now (a field's set has no notice channel; the Studio's Finish says it).
  const boundMain = { ...node, segments: node.segments.map((sg, i) => i === 5 ? { ...sg, start: [X, sg.start[1]] } : sg) } as SketchNode;
  const main = [{ ...boundMain, id: 'n0' }, nodes[1]] as never[];
  const moved = (editFields(main, 1, { X: 4 }).find(x => x.key === 'olen0') as { set(n: unknown, v: number): ModelNode[] }).set(main, 60)[0] as Extract<SketchNode, { profile: 'loop' }>;
  assert.deepEqual(moved.segments[5].start, [4, 36]);
});

test('editCommand given the document reads bound sketch values: their fields are there, and an edit keeps the other binding', async () => {
  const doc = { ...docOf({ profile: 'rectangle', min: [0, 0], max: [W, 40] }), parameters: { W: 60 } } as StudioDoc;
  const keys = (c: ReturnType<typeof editCommand>) => c?.fields?.({ doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } }).map(f => f.key) ?? [];
  assert.ok(!keys(editCommand(1, doc.nodes)).includes('w'), 'without parameters a bound value has no field');
  const edit = editCommand(1, doc.nodes, doc); assert.ok(edit?.build && edit.defaults);
  assert.ok(keys(edit).includes('w'));
  const ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } } as never, values = edit.defaults!(ctx);
  assert.equal(values.d, 40); assert.equal(values.w, 60);
  const built = edit.build!(ctx, { ...values, d: 50 });
  assert.deepEqual((built.nodes[0] as { max: unknown }).max, [W, 50]); assert.ok(await evaluates(built.nodes[0] as SketchNode, { W: 60 }));
});

test('a loop of another form never takes a binding, even when its values line up (line,line vs one arc; an arc turning the other way)', () => {
  const line = (start: [number | { parameter: string }, number]) => ({ kind: 'line' as const, start });
  const arc = (start: [number, number], center: [number, number], direction: 'ccw' | 'cw') => ({ kind: 'arc' as const, start, center, direction });
  const node = (segments: unknown[]) => ({ kind: 'sketch', profile: 'loop', segments }) as unknown as SketchNode;
  const lines = rebindDims(node([line([W, 0]), line([0, 0])]), node([arc([40, 0], [0, 0], 'ccw')]), { W: 40 });
  assert.deepEqual(lines.dropped, ['W']); assert.deepEqual(refsOf(lines.node), []);
  const turn = rebindDims(node([arc([W, 0] as never, [0, 0], 'ccw'), line([0, 10])]), node([arc([40, 0], [0, 0], 'cw'), line([0, 10])]), { W: 40 });
  assert.deepEqual(turn.dropped, ['W']); assert.deepEqual(refsOf(turn.node), []);
});
