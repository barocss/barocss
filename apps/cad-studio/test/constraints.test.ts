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

test('horizontal and vertical distances between points, also when the points line up', async () => {
  const { pointDimensionKeys, dimensionValue, dimensionLabel } = await import('../src/sketch/rules');
  // A quadrilateral whose points 2 and 4 share neither X nor Y.
  let s = close([[0, 0], [40, 0], [36, 21], [3, 23]]);
  assert.deepEqual(pointDimensionKeys(3, 1), { dist: 'dist1_3', dx: 'dx1_3', dy: 'dy1_3' });
  assert.equal(dimensionLabel(s, 'dx1_3'), 'Horizontal distance point 2 – point 4');
  assert.equal(dimensionValue(s, 'dx1_3'), 37); assert.equal(dimensionValue(s, 'dy1_3'), 23);
  const before = dof(s);
  const h = commitDimension(s, 'dx1_3', 30); assert.ok(h.ok, !h.ok ? h.reason : ''); s = h.shape;
  assert.ok(Math.abs(Math.abs(s.points[1][0] - s.points[3][0]) - 30) < 1e-6, JSON.stringify(s.points));
  assert.equal(dof(s), before - 1);
  const v = commitDimension(s, 'dy1_3', 15); assert.ok(v.ok, !v.ok ? v.reason : ''); s = v.shape;
  assert.ok(Math.abs(Math.abs(s.points[1][1] - s.points[3][1]) - 15) < 1e-6);
  assert.deepEqual(constraintEntries(s).filter(c => c.id.startsWith('rule')).map(c => c.label + ' ' + c.detail),
    ['Horizontal distance point 2 – point 4 = 30', 'Vertical distance point 2 – point 4 = 15']);
  // Points 1 and 2 lie on one horizontal edge: their vertical distance is 0 there, and a horizontal one is the edge length again (redundant once locked).
  const rect = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  const w = commitDimension(rect, 'dx0_2', 55); assert.ok(w.ok, !w.ok ? w.reason : '');
  assert.equal(len(w.shape, 0), 55);
  const again = commitDimension(w.shape, 'len0', 55);
  assert.match(!again.ok ? again.reason : '', /over-define/);
  // Points straight above each other (dx 0 as drawn) take a horizontal distance without collapsing.
  const tall = close([[0, 0], [30, 0], [30, 20], [0, 20]]);
  const apart = commitDimension(removeConstraint(tall, 'v:1'), 'dx1_2', 12); assert.ok(apart.ok, !apart.ok ? apart.reason : '');
  assert.ok(Math.abs(Math.abs(apart.shape.points[2][0] - apart.shape.points[1][0]) - 12) < 1e-6, JSON.stringify(apart.shape.points));
});

test('angle dimensions between two lines: at a shared corner, between separate edges, out of range refused', async () => {
  const { angleKey, dimensionValue, dimensionLabel } = await import('../src/sketch/rules');
  const { edgeAngle } = await import('../src/sketch/terms');
  let s = quad();
  // Edges 1 and 2 meet at point 2: the corner between them.
  assert.equal(dimensionKey(s, [E(0), E(1)]), 'ang0_1');
  assert.equal(angleKey(3, 0), 'ang0_3');
  const corner = (q: Polygon) => edgeAngle(q.points as P2[], 0, 1).degrees;
  assert.ok(Math.abs(dimensionValue(s, 'ang0_1')! - corner(s)) < 1e-9 && corner(s) > 75 && corner(s) < 85, String(corner(s)));
  assert.equal(dimensionLabel(s, 'ang0_1'), 'Angle edge 1 – edge 2');
  const before = dof(s);
  const r = commitDimension(s, 'ang0_1', 60); assert.ok(r.ok, !r.ok ? r.reason : ''); s = r.shape;
  assert.ok(Math.abs(corner(s) - 60) < 1e-6, String(corner(s)));
  assert.equal(dof(s), before - 1);
  assert.deepEqual(constraintEntries(s).filter(c => c.label === 'Angle').map(c => c.detail), ['edge 1 ∠ edge 2 = 60°']);
  // The corner at point 1 between the closing edge 4 and edge 1 (edge 4 ends there).
  const w = commitDimension(s, 'ang0_3', 80); assert.ok(w.ok, !w.ok ? w.reason : '');
  assert.ok(Math.abs(edgeAngle(w.shape.points as P2[], 0, 3).degrees - 80) < 1e-6);
  // A rectangle's corner is already 90°: an angle there over-defines; 0° and 180° are refused.
  const rect = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  assert.ok(Math.abs(dimensionValue(rect, 'ang1_2')! - 90) < 1e-9);
  assert.match((commitDimension(rect, 'ang1_2', 90) as { reason: string }).reason, /over-define/);
  assert.match((commitDimension(rect, 'ang1_2', 180) as { reason: string }).reason, /between 0° and 180°/);
  // Dimension tool: a line, then another line, opens their angle.
  const state: SketchState = { plane: xyPlane(), tool: 'dimension', shape: rect };
  const first = sketchClick(state, E(1), false);
  assert.equal(first.editDim, 'len1');
  assert.equal(sketchClick(first, E(2), false).editDim, 'ang1_2');
});

test('sketch history steps back and forward through outline edits, and only over the shape it left', async () => {
  const { SketchHistory } = await import('../src/sketch/history');
  const h = new SketchHistory(), a = quad();
  const b = ok(applyConstraint(a, [E(2)], 'horizontal')), c = removeConstraint(b, 'h:0');
  h.push(a, b); h.push(b, c);
  assert.equal(h.undo(c), b); assert.equal(h.undo(b), a); assert.equal(h.undo(a), null);
  assert.equal(h.redo(a), b); assert.equal(h.redo(b), c); assert.equal(h.redo(c), null);
  // A new edit after an undo drops the redo; a shape the history did not leave clears it.
  assert.equal(h.undo(c), b); h.push(b, a); assert.equal(h.redo(a), null);
  assert.equal(h.undo(quad()), null); assert.equal(h.canUndo, false);
});

test('overlapping shapes in one sketch are refused with a reason, never cut or crashed', async () => {
  const { profileOf } = await import('../src/sketch/loops');
  const rect = (a: P2, b: P2) => ({ kind: 'rectangle' as const, a, b }), circle = (c: P2, r: number) => ({ kind: 'circle' as const, c, r });
  const refused = (shapes: Parameters<typeof profileOf>[0]) => { const r = profileOf(shapes); assert.ok('error' in r, JSON.stringify(r)); return (r as { error: string }).error; };
  // U43, U41, U42: two crossing rectangles; a circle across the top or the right edge.
  assert.match(refused([rect([0, 0], [10, 10]), rect([5, 5], [15, 15])]), /Shapes 1 and 2 overlap/);
  assert.match(refused([rect([0, 0], [40, 20]), circle([20, 19], 5)]), /overlap/);
  assert.match(refused([rect([0, 0], [40, 20]), circle([38, 10], 5)]), /overlap/);
  // Two circles 12 apart; C1: each shape's first point inside the other.
  assert.match(refused([circle([0, 0], 10), circle([12, 0], 10)]), /overlap/);
  assert.match(refused([circle([0, 0], 10), rect([5, -3], [20, 3])]), /overlap/);
  // A hole fully inside and a separate region still work.
  const ok2 = profileOf([rect([0, 0], [40, 20]), circle([20, 10], 5), circle([60, 10], 5)]);
  assert.ok('node' in ok2 && ok2.node.holes?.length === 1 && ok2.node.regions?.length === 1);
});

test('a finished outline keeps its constraints in the sketch node; the feature editor drives its dimensions', async () => {
  const { shapeNode } = await import('../src/sketch/loops');
  const { featureOf } = await import('../src/engine/part');
  const { editFields } = await import('../src/app/editFields');
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const { emptyDoc, withNode } = await import('../src/engine/doc');
  let s = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  s = (commitDimension(s, 'len0', 60) as { shape: Polygon }).shape;
  s = (commitDimension(s, 'dist0_2', 65) as { shape: Polygon }).shape;
  const node = shapeNode(s)!;
  assert.equal(node.profile, 'polygon');
  assert.deepEqual(node.outline?.hv, { h: [0, 2], v: [1, 3] });
  assert.deepEqual(node.outline?.lengths, { 0: 60 });
  assert.deepEqual(node.outline?.rules, [{ kind: 'distance', a: 0, b: 2, value: 65 }]);
  // The kernel takes the solved profile only.
  assert.equal('outline' in (featureOf(node, 0) as object), false);
  let d = withNode(withNode(emptyDoc(), node), { kind: 'extrude', sketch: 0, height: 5 });
  assert.ok(evaluateDoc(d, 2).ok);
  const fields = editFields(d.nodes, 1).filter(f => f.kind === 'number');
  const len = fields.find(f => f.label === 'Length of edge 1')!, dist = fields.find(f => f.label === 'Distance point 1 – point 3')!;
  assert.ok(len && dist, fields.map(f => f.label).join(', '));
  assert.equal(len.get(d.nodes), 60); assert.ok(Math.abs(dist.get(d.nodes) - 65) < 1e-9);
  // Width 40 with the diagonal held at 65: the height follows.
  const nodes = len.kind === 'number' ? len.set(d.nodes, 40) : d.nodes;
  const pts = (nodes[0] as { points: P2[] }).points, h = Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1]));
  assert.ok(Math.abs(h - Math.sqrt(65 ** 2 - 40 ** 2)) < 1e-6, JSON.stringify(pts));
  assert.equal((nodes[0] as { outline: { lengths: Record<number, number> } }).outline.lengths[0], 40);
  // A value the constraints cannot take (longer than the diagonal) changes nothing.
  assert.equal(len.kind === 'number' && len.set(nodes, 70), nodes);
  d = { ...d, nodes };
  assert.ok(evaluateDoc(d, 2).ok);
});

test('a finished sketch node comes back as its shapes: the kept outline with its constraints, loops, regions and holes', async () => {
  const { sketchShapes, loopShape } = await import('../src/sketch/reopen');
  const { shapeNode, profileOf } = await import('../src/sketch/loops');
  const { outlineSegments } = await import('../src/sketch/profile');
  // A constrained outline round-trips with every constraint.
  let s = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  s = (commitDimension(s, 'len0', 60) as { shape: Polygon }).shape;
  const back = sketchShapes(shapeNode(s)!).shape as Polygon;
  assert.deepEqual(back.points, s.points); assert.deepEqual(back.lengths, { 0: 60 }); assert.deepEqual(back.hv, s.hv);
  assert.equal(dof(back), dof(s));
  // A line + arc loop gives back its points and bulges; one full arc is a circle.
  const pts: P2[] = [[0, 0], [30, 0], [30, 20], [0, 20]], bulges = [0, 0.4, 0, -0.3];
  const loop = loopShape(outlineSegments(pts, bulges)) as Polygon;
  assert.deepEqual(loop.points, pts);
  loop.bulges!.forEach((b, i) => assert.ok(Math.abs(b - bulges[i]) < 1e-9, `${b} vs ${bulges[i]}`));
  assert.deepEqual(loopShape([{ kind: 'arc', start: [15, 5], center: [10, 5], direction: 'ccw' }]), { kind: 'circle', c: [10, 5], r: 5 });
  // A plate with a hole and a separate boss: the main rectangle first, then the region and the hole.
  const r = profileOf([{ kind: 'rectangle', a: [0, 0], b: [40, 20] }, { kind: 'circle', c: [20, 10], r: 4 }, { kind: 'circle', c: [60, 10], r: 5 }]);
  assert.ok('node' in r);
  const shapes = sketchShapes(r.node);
  assert.deepEqual(shapes.shape, { kind: 'rectangle', a: [0, 0], b: [40, 20] });
  assert.deepEqual(shapes.done.map(d => d.kind), ['circle', 'circle']);
  // And profiles again to the same node.
  assert.deepEqual(profileOf([shapes.shape!, ...shapes.done]), r);
});

test('a Rectangle-tool rectangle stays a rectangle after Select / Dimension while it still is one (QA S3, K29)', async () => {
  const { rectangleOutline } = await import('../src/sketch/select');
  const { shapeNode } = await import('../src/sketch/loops');
  const { editFields } = await import('../src/app/editFields');
  const { emptyDoc, withNode } = await import('../src/engine/doc');
  const outline = rectangleOutline({ kind: 'rectangle', a: [0, 0], b: [40, 20] })!;
  assert.deepEqual(shapeNode(outline), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] });
  // A typed width keeps it a rectangle; the editor then offers width, depth and corner.
  const wide = (commitDimension(outline, 'len0', 55) as { shape: Polygon }).shape;
  const node = shapeNode(wide)!;
  assert.deepEqual(node, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [55, 20] });
  const d = withNode(withNode(emptyDoc(), node), { kind: 'extrude', sketch: 0, height: 5 });
  assert.deepEqual(editFields(d.nodes, 1).map(f => f.label).slice(0, 4), ['Width', 'Depth', 'Corner X', 'Corner Y']);
  // A removed H/V edge or an explicit rule makes it an outline again.
  assert.equal(shapeNode(removeConstraint(outline, 'v:1'))!.profile, 'polygon');
  const fixed = ok(applyConstraint(outline, [Pt(2)], 'fix'));
  assert.equal(shapeNode(fixed)!.profile, 'polygon');
  assert.ok(shapeNode(fixed)!.outline?.rules?.length);
  // A line-tool outline of the same shape stays a polygon.
  assert.equal(shapeNode(close([[0, 0], [40, 0], [40, 20], [0, 20]]))!.profile, 'polygon');
});

test('a circle is placed from the outline: picked from the sketch, centre distances, diameter, saved, reopened, edited', async () => {
  const { sketchClick, attachCircle, pickSketch } = await import('../src/sketch/select');
  const { profileOf, shapeNode } = await import('../src/sketch/loops');
  const { sketchShapes } = await import('../src/sketch/reopen');
  const { editFields } = await import('../src/app/editFields');
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const { emptyDoc, withNode } = await import('../src/engine/doc');
  const plate = (commitDimension(close([[0, 0], [40, 0], [40, 20], [0, 20]]), 'len0', 40) as { shape: Polygon }).shape;
  const hole = { kind: 'circle' as const, c: [12, 9] as P2, r: 3 };
  // The Dimension tool: point 1, then the finished circle, opens the distance to its centre and attaches the circle.
  let state: SketchState = { plane: xyPlane(), tool: 'dimension', shape: plate, done: [hole] };
  const project = (u: number, v: number) => [u * 10, 400 - v * 10];
  assert.deepEqual(pickSketch(plate, project, 150, 310, state.done), { kind: 'circle', i: 0, done: true });
  state = sketchClick(state, Pt(0), false);
  state = sketchClick(state, { kind: 'circle', i: 0, done: true }, false);
  assert.equal(state.editDim, 'cdist0_0'); assert.deepEqual(state.done, []);
  let s = state.shape as Polygon;
  assert.deepEqual(s.circles, [{ c: [12, 9], r: 3 }]);
  assert.equal(dimensionKey(s, [Pt(0), { kind: 'circle', i: 0 }]), 'cdist0_0');
  assert.match(constraintOptions(s, [{ kind: 'circle', i: 0 }]).fix ?? '', /circle takes dimensions/);
  // Horizontal 10 and vertical 6 from point 1: the centre lands there; the rest of the plate is 1 DOF (its height).
  const before = dof(s);
  s = (commitDimension(s, 'cdx0_0', 10) as { shape: Polygon }).shape;
  s = (commitDimension(s, 'cdy0_0', 6) as { shape: Polygon }).shape;
  assert.deepEqual(s.circles![0].c, [10, 6]); assert.equal(dof(s), before - 2);
  const d = commitDimension(s, 'cdia0', 8); assert.ok(d.ok); s = d.shape; assert.equal(s.circles![0].r, 4);
  assert.deepEqual(constraintEntries(s).filter(c => c.id.startsWith('rule')).map(c => c.label + ' ' + c.detail),
    ['Horizontal distance point 1 – circle 1 = 10', 'Vertical distance point 1 – circle 1 = 6']);
  // A distance the plate cannot give conflicts; dimensioning the centre again over-defines.
  assert.match((commitDimension(s, 'cdist0_0', 50) as { reason: string }).reason, /conflict/);
  // The profile: the plate with the circle as its hole, and the outline keeps the circle and its rules.
  const r = profileOf([s]); assert.ok('node' in r);
  assert.equal(r.node.holes?.length, 1); assert.deepEqual(r.node.outline?.circles, [{ c: [10, 6], r: 4 }]);
  let doc = withNode(withNode(emptyDoc(), r.node), { kind: 'extrude', sketch: 0, height: 5 });
  assert.ok(evaluateDoc(doc, 2).ok);
  // Reopened: the circle comes back on the outline, not beside it.
  const back = sketchShapes(r.node);
  assert.deepEqual((back.shape as Polygon).circles, [{ c: [10, 6], r: 4 }]); assert.deepEqual(back.done, []);
  // The feature editor moves the hole by its horizontal distance.
  const f = editFields(doc.nodes, 1).find(x => x.label === 'Horizontal distance point 1 – circle 1')!;
  assert.ok(f && f.kind === 'number'); assert.equal(f.get(doc.nodes), 10);
  const nodes = f.kind === 'number' ? f.set(doc.nodes, 25) : doc.nodes;
  assert.deepEqual((nodes[0] as { outline: { circles: unknown } }).outline.circles, [{ c: [25, 6], r: 4 }]);
  doc = { ...doc, nodes }; assert.ok(evaluateDoc(doc, 2).ok);
  assert.equal(attachCircle({ plane: xyPlane(), tool: 'select', shape: plate, done: [] }, 0), null);
  void shapeNode;
});

test('Select / Dimension after drawing a circle edit the outline drawn before it; the circle stays beside it', async () => {
  const { startPicking, rectangleOutline } = await import('../src/sketch/select');
  const rect = { kind: 'rectangle' as const, a: [0, 0] as P2, b: [40, 20] as P2 }, hole = { kind: 'circle' as const, c: [10, 10] as P2, r: 3 };
  const s = startPicking({ plane: xyPlane(), tool: 'circle', shape: hole, done: [rect] }, 'dimension');
  assert.deepEqual(s.shape, rectangleOutline(rect)); assert.deepEqual(s.done, [hole]);
});

test('circles are placed from horizontal / vertical edges and from each other', async () => {
  const { sketchClick } = await import('../src/sketch/select');
  const { edgeCircleKey, circlePairKeys, dimensionLabel } = await import('../src/sketch/rules');
  const { outlineFields } = await import('../src/sketch/outlineFields');
  const { profileOf } = await import('../src/sketch/loops');
  let s: Polygon = { ...close([[0, 0], [60, 0], [60, 30], [0, 30]]), circles: [{ c: [12, 10], r: 3 }, { c: [40, 18], r: 3 }] };
  s = (commitDimension(s, 'len0', 60) as { shape: Polygon }).shape; s = (commitDimension(s, 'len1', 30) as { shape: Polygon }).shape;
  // Bottom edge 1 (horizontal): measured along Y; left edge 4 (vertical): along X; a slanted edge has no such key.
  assert.equal(edgeCircleKey(s, 0, 0), 'cedge0_0'); assert.equal(dimensionLabel(s, 'cedge0_0'), 'Distance edge 1 – circle 1');
  assert.equal(dimensionKey(s, [E(3), { kind: 'circle', i: 0 }]), 'cedge3_0');
  assert.equal(edgeCircleKey(quad(), 2, 0), null);
  let r = commitDimension(s, 'cedge0_0', 8); assert.ok(r.ok, !r.ok ? r.reason : ''); s = r.shape;
  r = commitDimension(s, 'cedge3_0', 15); assert.ok(r.ok, !r.ok ? r.reason : ''); s = r.shape;
  assert.deepEqual(s.circles![0].c, [15, 8]);
  // Circle 2 from circle 1: 25 along X, 12 along Y.
  assert.deepEqual(circlePairKeys(1, 0), { dist: 'ccdist0_1', dx: 'ccdx0_1', dy: 'ccdy0_1' });
  r = commitDimension(s, 'ccdx0_1', 25); assert.ok(r.ok, !r.ok ? r.reason : ''); s = r.shape;
  r = commitDimension(s, 'ccdy0_1', 12); assert.ok(r.ok, !r.ok ? r.reason : ''); s = r.shape;
  assert.deepEqual(s.circles![1].c, [40, 20]); assert.equal(dof(s), 0);
  // One more is refused: over-defined, or past the solver's 16 points / segments with a clear reason.
  assert.match((commitDimension(s, 'ccdist0_1', 30) as { reason: string }).reason, /over-define|conflict|Too many points/);
  assert.deepEqual(constraintEntries(s).filter(c => c.id.startsWith('rule')).map(c => c.label + ' ' + c.detail), [
    'Distance edge 1 – circle 1 = 8', 'Distance edge 4 – circle 1 = 15', 'Horizontal distance circle 1 – circle 2 = 25', 'Vertical distance circle 1 – circle 2 = 12']);
  // The Dimension tool: an edge then a circle, a circle then a circle.
  const st: SketchState = { plane: xyPlane(), tool: 'dimension', shape: s };
  assert.equal(sketchClick(sketchClick(st, E(0), false), { kind: 'circle', i: 1 }, false).editDim, 'cedge0_1');
  assert.equal(sketchClick(sketchClick(st, { kind: 'circle', i: 1 }, false), { kind: 'circle', i: 0 }, false).editDim, 'ccdist0_1');
  // Saved and driven from the feature editor.
  const pr = profileOf([s]); assert.ok('node' in pr);
  const labels = outlineFields([pr.node], 0, '').map(f => f.label);
  assert.ok(labels.includes('Distance edge 1 – circle 1') && labels.includes('Vertical distance circle 1 – circle 2'), labels.join(', '));
});

test('a dimension may not push an attached circle across the outline or off it; Finish refuses a crossing one', async () => {
  const { profileOf } = await import('../src/sketch/loops');
  const plate = { ...close([[0, 0], [60, 0], [60, 25], [0, 25]]), circles: [{ c: [30, 12] as P2, r: 4 }] };
  const off = commitDimension(plate, 'cdx0_0', 70);
  assert.ok(!off.ok && /off the outline/.test(off.reason), JSON.stringify(off));
  // At x 58 a sample of the Ø8 circle lands exactly on the edge x 60: still an overlap.
  const across = commitDimension(plate, 'cdx0_0', 58);
  assert.ok(!across.ok && /across the edge/.test(across.reason), JSON.stringify(across));
  const grown = commitDimension(plate, 'cdia0', 30);
  assert.ok(!grown.ok && /across the edge/.test(grown.reason), JSON.stringify(grown));
  assert.ok(commitDimension(plate, 'cdx0_0', 50).ok, 'still inside');
  // A circle already across the edge (attached as drawn) is refused when the sketch is finished.
  const r = profileOf([{ ...plate, circles: [{ c: [58, 12], r: 4 }] }]);
  assert.ok('error' in r && /overlap/.test(r.error), JSON.stringify(r));
  // A hole touching the edge from inside (its first sample on the edge) is still a hole.
  const touching = profileOf([{ ...plate, circles: [{ c: [56, 12], r: 4 }] }]);
  assert.ok('node' in touching && touching.node.holes?.length === 1 && !touching.node.regions, JSON.stringify(touching));
  // Drawn shapes: a circle across the plate's edge, with a sample exactly on it.
  const d = profileOf([{ kind: 'rectangle', a: [0, 0], b: [60, 25] }, { kind: 'circle', c: [58, 12], r: 4 }]);
  assert.ok('error' in d, JSON.stringify(d));
});

test('a plate with six fully placed holes solves (the kernel’s larger sketch profile)', async () => {
  const { solveOutline } = await import('../src/sketch/profile');
  const pts: [number, number][] = [[0, 0], [80, 0], [80, 40], [0, 40]];
  const circles: [number, number][] = [[10, 10], [40, 10], [70, 10], [10, 30], [40, 30], [70, 30]];
  const rules = circles.flatMap((c, k) => [{ kind: 'cdx' as const, a: 0, circle: k, value: c[0] }, { kind: 'cdy' as const, a: 0, circle: k, value: c[1] }]);
  const r = solveOutline(pts, { lengths: { 0: 80, 1: 40 }, rules, circles: circles.map(c => [c[0] + 0.4, c[1] - 0.3] as [number, number]) });
  assert.ok(r.ok, r.ok ? '' : r.reason);
  assert.deepEqual(r.ok && r.circles?.map(c => c.map(v => Math.round(v * 1e6) / 1e6)), circles);
});
