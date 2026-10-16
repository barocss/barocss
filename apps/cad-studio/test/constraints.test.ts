import test from 'node:test';
import assert from 'node:assert/strict';
import { settleShape } from '../src/sketch/settle';
import { arcOf, bulgeThrough, type P2 } from '../src/sketch/profile';
import {
  applyConstraint, commitDimension, constraintEntries, constraintOptions, dimensionKey, redundancy, removeConstraint, solveShape,
  type Polygon, type SketchPick,
} from '../src/sketch/rules';
import { nextPicks, pickSketch, sketchClick } from '../src/sketch/select';
import type { SketchState } from '../src/viewport/Viewport';
import { xyPlane } from '../src/sketch/plane';

const E = (i: number): SketchPick => ({ kind: 'edge', i }), Pt = (i: number): SketchPick => ({ kind: 'point', i });
const close = (points: P2[], bulges?: number[]): Polygon => {
  const open: Polygon = { kind: 'polygon', points, closed: false, bulges: bulges ?? points.map(() => 0) };
  const r = settleShape({ ...open, closed: true }, open);
  assert.equal(r.error, null); return r.shape as Polygon;
};
const ok = (r: ReturnType<typeof applyConstraint>) => { assert.ok(r.ok, !r.ok ? r.reason : ''); return r.shape; };
const dir = (s: Polygon, i: number): P2 => { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; return [b[0] - a[0], b[1] - a[1]]; };
const len = (s: Polygon, i: number) => Math.hypot(...dir(s, i));
const dof = (s: Polygon) => { const r = solveShape(s); assert.ok(r.ok); return r.dof; };

// A quadrilateral with only its bottom edge drawn horizontal.
const quad = () => close([[0, 0], [40, 0], [36, 21], [3, 23]]);

test('closing keeps the drawn H/V edges; removing one frees a degree of freedom', () => {
  const rect = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  assert.deepEqual(rect.hv, { h: [0, 2], v: [1, 3] });
  assert.deepEqual(constraintEntries(rect).map(c => c.label + ' ' + c.detail), ['Anchor point 1', 'Horizontal edge 1', 'Horizontal edge 3', 'Vertical edge 2', 'Vertical edge 4']);
  assert.equal(dof(rect), 2);
  const freed = removeConstraint(rect, 'v:1');
  assert.deepEqual(freed.hv, { h: [0, 2], v: [3] });
  assert.equal(dof(freed), 3);
  // The anchor is not removable.
  assert.equal(constraintEntries(rect)[0].removable, false);
});

test('parallel, perpendicular and equal length make the outline exact', () => {
  let s = quad();
  assert.deepEqual(s.hv, { h: [0], v: [] });
  const before = dof(s);
  s = ok(applyConstraint(s, [E(0), E(2)], 'parallel'));
  assert.ok(Math.abs(dir(s, 2)[1]) < 1e-6, JSON.stringify(s.points));
  assert.equal(dof(s), before - 1);
  assert.equal(constraintOptions(s, [E(0), E(2)]).parallel, 'Already parallel');
  s = ok(applyConstraint(s, [E(0), E(3)], 'perpendicular'));
  const d0 = dir(s, 0), d3 = dir(s, 3);
  assert.ok(Math.abs(d0[0] * d3[0] + d0[1] * d3[1]) < 1e-5);
  s = ok(applyConstraint(s, [E(0), E(2)], 'equal'));
  assert.ok(Math.abs(len(s, 0) - len(s, 2)) < 1e-6);
  assert.deepEqual(constraintEntries(s).filter(c => c.id.startsWith('rule')).map(c => c.label + ' ' + c.detail),
    ['Parallel edge 1 ∥ edge 3', 'Perpendicular edge 1 ⊥ edge 4', 'Equal length edge 1 = edge 3']);
  // Removing a rule leaves the geometry and gives the freedom back.
  const freed = removeConstraint(s, 'rule:2');
  assert.equal(dof(freed), dof(s) + 1);
});

test('a constraint the others already imply is refused as over-defining; a conflict is refused', () => {
  let s = ok(applyConstraint(quad(), [E(0), E(2)], 'parallel'));
  // Edge 3 is parallel to the horizontal edge 1: horizontal is implied.
  const redundant = applyConstraint(s, [E(2)], 'horizontal');
  assert.equal(redundant.ok, false);
  assert.match(!redundant.ok ? redundant.reason : '', /Horizontal edge 3 is already implied by the other constraints — adding it would over-define the sketch/);
  // Perpendicular to a parallel pair cannot hold.
  const conflict = applyConstraint(s, [E(0), E(2)], 'perpendicular');
  assert.equal(conflict.ok, false);
  assert.match(!conflict.ok ? conflict.reason : '', /conflict/);
  // A horizontal edge cannot also be made vertical.
  const rect = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  const clash = applyConstraint(rect, [E(0)], 'vertical');
  assert.match(!clash.ok ? clash.reason : '', /edge 1 is horizontal: remove that constraint first/);
  // Explicit horizontal on a slanted edge.
  s = ok(applyConstraint(quad(), [E(2)], 'horizontal'));
  assert.deepEqual(s.hv, { h: [0, 2], v: [] });
  assert.ok(Math.abs(dir(s, 2)[1]) < 1e-6);
});

test('fix holds a point; the anchor is already fixed', () => {
  const s = quad();
  assert.equal(constraintOptions(s, [Pt(0)]).fix, 'Point 1 is the sketch anchor: it is already fixed');
  const fixed = ok(applyConstraint(s, [Pt(2)], 'fix'));
  assert.equal(dof(fixed), dof(s) - 2);
  // A dimension next to the fixed point moves only the other end.
  const moved = commitDimension(fixed, 'len1', 40);
  assert.ok(moved.ok, !moved.ok ? moved.reason : '');
  assert.deepEqual(moved.shape.points[2], [36, 21]);
  assert.equal(constraintOptions(fixed, [Pt(2)]).fix, 'Already fixed');
  assert.ok(constraintOptions(s, [Pt(2), E(1)]).fix);
});

test('dimensions: edge lengths, point distances, redundant and conflicting values', () => {
  let s = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  assert.equal(dimensionKey(s, [E(0)]), 'len0');
  assert.equal(dimensionKey(s, [Pt(0), Pt(1)]), 'len0');
  assert.equal(dimensionKey(s, [Pt(3), Pt(0)]), 'len3');
  assert.equal(dimensionKey(s, [Pt(0), Pt(2)]), 'dist0_2');
  assert.equal(dimensionKey(s, [Pt(0), E(1)]), null);
  const w = commitDimension(s, 'len0', 60); assert.ok(w.ok); s = w.shape;
  assert.equal(len(s, 0), 60); assert.equal(len(s, 2), 60);
  // A diagonal of 65 with width 60: height 25.
  const d = commitDimension(s, 'dist0_2', 65); assert.ok(d.ok, !d.ok ? d.reason : ''); s = d.shape;
  assert.ok(Math.abs(len(s, 1) - 25) < 1e-6, String(len(s, 1)));
  assert.equal(dof(s), 0);
  assert.deepEqual(constraintEntries(s).filter(c => c.label === 'Distance').map(c => c.detail), ['point 1 – point 3 = 65']);
  // Editing the same distance replaces it.
  const again = commitDimension(s, 'dist0_2', 61); assert.ok(again.ok); assert.ok(Math.abs(len(again.shape, 1) - 11) < 1e-6);
  assert.equal(again.shape.rules?.length, 1);
  // Fully defined: one more length (even the current one) over-defines; a different one conflicts.
  const extra = commitDimension(s, 'len1', 25);
  assert.match(!extra.ok ? extra.reason : '', /over-define/);
  const wrong = commitDimension(s, 'len2', 50);
  assert.match(!wrong.ok ? wrong.reason : '', /Length of edge 3 = 50: These constraints conflict/);
  assert.match((commitDimension(s, 'len0', 0) as { reason: string }).reason, /greater than 0/);
});

test('an over-defined outline is reported; settling refuses an edit that adds redundancy', () => {
  const rect = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  const locked = { ...rect, lengths: { 0: 40, 1: 20 } };
  assert.equal(redundancy(solveShape(locked)), 0);
  const over = { ...locked, lengths: { 0: 40, 1: 20, 2: 40 } };
  assert.equal(redundancy(solveShape(over)), 1);
  const r = settleShape(over, locked);
  assert.equal(r.shape, locked);
  assert.match(r.error ?? '', /over-define/);
});

test('coincident puts a point on an arc centre; concentric from two arcs', () => {
  // A quarter-disc sector drawn by hand: its corner a little off the arc's centre.
  const a: P2 = [30, 0], b: P2 = [0, 30];
  const s = close([[0, 0], a, b], [0, bulgeThrough(a, b, [22, 22]), 0]);
  assert.match(constraintOptions(s, [Pt(1), E(1)]).coincident ?? '', /end of arc 2/);
  const on = ok(applyConstraint(s, [Pt(0), E(1)], 'coincident'));
  const arc = arcOf(on.points[1], on.points[2], on.bulges![1]);
  assert.ok(Math.hypot(arc.center[0] - on.points[0][0], arc.center[1] - on.points[0][1]) < 1e-5, JSON.stringify(arc));
  assert.deepEqual(constraintEntries(on).find(c => c.label === 'Coincident')?.detail, 'point 1 · arc 2 centre');
  // Equal on mixed lines and arcs is refused.
  assert.ok(constraintOptions(s, [E(0), E(1)]).equal);
});

test('picking points before edges in screen space, and the Select / Dimension clicks', () => {
  const s = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  const project = (u: number, v: number) => [u * 10, 400 - v * 10];
  assert.deepEqual(pickSketch(s, project, 403, 398), { kind: 'point', i: 1 });
  assert.deepEqual(pickSketch(s, project, 200, 404), { kind: 'edge', i: 0 });
  assert.equal(pickSketch(s, project, 200, 300), null);
  assert.deepEqual(nextPicks([E(0)], E(2), true), [E(0), E(2)]);
  assert.deepEqual(nextPicks([E(0), E(2)], E(0), true), [E(2)]);
  assert.deepEqual(nextPicks([E(0)], Pt(1), false), [Pt(1)]);
  const state: SketchState = { plane: xyPlane(), tool: 'dimension', shape: s };
  assert.equal(sketchClick(state, E(1), false).editDim, 'len1');
  const first = sketchClick(state, Pt(0), false);
  assert.deepEqual(first.picked, [Pt(0)]);
  assert.equal(sketchClick(first, Pt(2), false).editDim, 'dist0_2');
  assert.deepEqual(sketchClick({ ...state, tool: 'select' }, E(3), false).picked, [E(3)]);
});

test('Select / Dimension turn a rectangle into an outline with its H/V edges; with none current, the last shape comes back', async () => {
  const { rectangleOutline, startPicking } = await import('../src/sketch/select');
  const rect = { kind: 'rectangle' as const, a: [40, 20] as P2, b: [0, 0] as P2 };
  const outline = rectangleOutline(rect)!;
  assert.deepEqual(outline.points, [[0, 0], [40, 0], [40, 20], [0, 20]]);
  assert.deepEqual(outline.hv, { h: [0, 2], v: [1, 3] });
  assert.equal(dof(outline), 2);
  const w = commitDimension(outline, 'len0', 55); assert.ok(w.ok); assert.equal(len(w.shape, 2), 55);
  assert.equal(rectangleOutline({ kind: 'rectangle', a: [0, 0], b: [0.5, 10] }), null);
  const s = startPicking({ plane: xyPlane(), tool: 'rectangle', shape: rect }, 'dimension');
  assert.equal(s.tool, 'dimension'); assert.deepEqual(s.shape, outline);
  // A finished rectangle is brought back when nothing is current.
  const back = startPicking({ plane: xyPlane(), tool: 'circle', shape: null, done: [{ kind: 'circle', c: [0, 0], r: 5 }, rect] }, 'select');
  assert.deepEqual(back.shape, outline); assert.deepEqual(back.done, [{ kind: 'circle', c: [0, 0], r: 5 }]);
});
