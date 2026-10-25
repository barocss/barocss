import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection, ProjectedCurve, ProjectedEdge } from '@barocss/cad';
import type { Bom, BomLine } from '../src/bom/core';
import { balloonMarks, type Balloons, type BodyFaces } from '../src/drawing/balloons';
import { defaultDrawing, readDrawing, type DrawingViews, type ViewId, type XY } from '../src/drawing/types';
import type { SheetLayout } from '../src/drawing/views';
import { drawingIssues, type IssueContext } from '../src/drawing/issues';

// Source-only projection fixtures for the original C assembly BALLOON_NO_EDGE defect.
// These do not replay the original document, generate projections, or prove browser/Save-Open acceptance.
const IDS: readonly ViewId[] = ['front', 'top', 'right', 'iso'];
const line = (item: string, parts = [item], extra: Partial<BomLine> = {}): BomLine => ({ item, parts, qty: parts.length, material: null, mass: 0, source: null, ...extra });
const bomOf = (...lines: BomLine[]): Bom => ({ lines, totalQty: lines.reduce((n, l) => n + l.qty, 0), totalMass: 0 });
const curve = (a: XY, b: XY): ProjectedCurve => ({ kind: 'line', a, b });
const edge = (name: string, a: XY = [8, 10], b: XY = [24, 10], visible = true): ProjectedEdge => ({ name, kind: 'line', ends: [[a[0], a[1], 0], [b[0], b[1], 0]], circle: null, pieces: [{ curve: curve(a, b), visible }] });
function viewsOf(edges: Partial<Record<ViewId, readonly ProjectedEdge[]>>): DrawingViews {
  const pr = (id: ViewId): BrepProjection => ({ right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], min: [0, 0], max: [80, 60], edges: edges[id] ?? [] });
  return { front: pr('front'), top: pr('top'), right: pr('right'), iso: pr('iso') };
}
function layoutOf(shown: readonly ViewId[] = IDS): SheetLayout {
  const layout: SheetLayout = { size: [420, 297], scale: 1, fits: true, frame: [10, 10, 410, 287], title: [290, 270, 410, 287], views: {
    front: { id: 'front', scale: 0.5, origin: [30, 260], box: [30, 230, 70, 260] },
    top: { id: 'top', scale: 1, origin: [30, 120], box: [30, 60, 110, 120] },
    right: { id: 'right', scale: 2, origin: [230, 260], box: [230, 140, 390, 260] },
    iso: { id: 'iso', scale: 0.25, origin: [230, 90], box: [230, 75, 250, 90] },
  } };
  for (const id of IDS) if (!shown.includes(id)) layout.views[id].hidden = true;
  return layout;
}
const takenOf = (layout: SheetLayout) => [layout.title, ...IDS.filter(id => !layout.views[id].hidden).map(id => layout.views[id].box)];
const render = (layout: SheetLayout, views: DrawingViews, bom: Bom, bodies?: BodyFaces): Balloons => balloonMarks(layout, views, bom, takenOf(layout), bodies);
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-10, `${a} differs from ${b}`);

/** Independent expected sheet point and leader endpoint; no targetEdge, middleOf or toSheet call. */
function anchor(result: Balloons, no: number, view: ViewId, name: string, expected: XY): void {
  const p = result.placed.find(p => p.no === no); assert.ok(p);
  assert.equal(p.view, view); assert.equal(p.edge, name); near(p.tip[0], expected[0]); near(p.tip[1], expected[1]);
  const group = result.groups.find(g => g.id === String(no)); assert.ok(group);
  assert.equal(group.role, 'balloon'); assert.equal(group.view, view);
  assert.deepEqual(group.marks.flatMap(m => m.kind === 'text' ? [m.text] : []), [String(no)], 'BOM number is unchanged');
  const arrow = group.marks.find(m => m.kind === 'fill'), leader = group.marks.find(m => m.kind === 'line');
  assert.ok(arrow?.kind === 'fill' && leader?.kind === 'line', 'real leader and arrow are drawn');
  near(arrow.points[0][0], expected[0]); near(arrow.points[0][1], expected[1]);
  near((arrow.points[1][0] + arrow.points[2][0]) / 2, leader.b[0]);
  near((arrow.points[1][1] + arrow.points[2][1]) / 2, leader.b[1]);
  near(Math.hypot(expected[0] - leader.b[0], expected[1] - leader.b[1]), 2.2);
}

test('single iso view keeps the existing anchor, circle position, BOM number and occurrence', () => {
  const layout = layoutOf(['iso']), views = viewsOf({ iso: [edge('p1/n0.side|n0.top')] }), bom = bomOf(line('Plate', ['p1']));
  const result = render(layout, views, bom);
  assert.deepEqual([result.noEdge, result.unclear], [[], []]);
  assert.equal(result.placed.length, 1); assert.equal(result.placed[0].item, 'Plate');
  anchor(result, 1, 'iso', 'p1/n0.side|n0.top', [234, 87.5]);
  assert.deepEqual(result.placed[0].at, [234, 99.5], 'legacy nearest-side placement stays');
});

test('single front view keeps the existing front fallback', () => {
  const result = render(layoutOf(['front']), viewsOf({ front: [edge('p1/n0.side')] }), bomOf(line('Plate', ['p1'])));
  anchor(result, 1, 'front', 'p1/n0.side', [38, 255]);
  assert.deepEqual(result.noEdge, []);
});

for (const [view, expected] of [['top', [46, 110]], ['right', [262, 240]]] as const) test(`only ${view} shown: hidden preferred views cannot provide anchors`, () => {
  const views = viewsOf({ iso: [edge('p1/iso.side')], front: [edge('p1/front.side')], [view]: [edge('p1/n0.side')] });
  const result = render(layoutOf([view]), views, bomOf(line('Plate', ['p1'])));
  anchor(result, 1, view, 'p1/n0.side', [expected[0], expected[1]]);
  assert.deepEqual(result.noEdge, []);
});

test('different BOM parts use visible edges in different shown views with each view scale', () => {
  const layout = layoutOf(), views = viewsOf({
    iso: [edge('p1/n0.side')],
    front: [edge('p2/n0.side', [10, 20], [30, 20])],
    top: [edge('p3/n0.side', [10, 30], [30, 30])],
    right: [edge('p4/n0.side', [4, 20], [16, 20])],
  }), bom = bomOf(...[1, 2, 3, 4].map(n => line(`Part ${n}`, [`p${n}`])));
  const snapshot = JSON.stringify({ layout, views, bom }), result = render(layout, views, bom);
  anchor(result, 1, 'iso', 'p1/n0.side', [234, 87.5]);
  anchor(result, 2, 'front', 'p2/n0.side', [40, 250]);
  anchor(result, 3, 'top', 'p3/n0.side', [50, 90]);
  anchor(result, 4, 'right', 'p4/n0.side', [250, 220]);
  assert.deepEqual(result.placed.map(p => [p.no, p.item]), [[1, 'Part 1'], [2, 'Part 2'], [3, 'Part 3'], [4, 'Part 4']]);
  assert.deepEqual([result.noEdge, result.unclear], [[], []]);
  for (const p of result.placed) {
    const box = [p.at[0] - 3.5, p.at[1] - 3.5, p.at[0] + 3.5, p.at[1] + 3.5];
    assert.ok(box[0] >= 11 && box[1] >= 11 && box[2] <= 409 && box[3] <= 286, 'circle is within the unchanged sheet frame');
    for (const taken of takenOf(layout)) assert.ok(box[2] + 1 <= taken[0] || taken[2] + 1 <= box[0] || box[3] + 1 <= taken[1] || taken[3] + 1 <= box[1], 'circle clears existing views and title');
  }
  assert.equal(JSON.stringify({ layout, views, bom }), snapshot, 'projection, view placement, scale and BOM are not changed');
});

test('preferred view scans all occurrences before falling back; one balloon per grouped line', () => {
  const result = render(layoutOf(), viewsOf({ iso: [edge('p2/n0.side')], front: [edge('p1/n0.side')] }), bomOf(line('Two plates', ['p1', 'p2'])));
  assert.equal(result.placed.length, 1);
  anchor(result, 1, 'iso', 'p2/n0.side', [234, 87.5]);
});

test('occluded iso edge falls back to a visible front edge of the same occurrence', () => {
  const result = render(layoutOf(), viewsOf({ iso: [edge('p1/n0.side', [0, 0], [80, 60], false)], front: [edge('p1/n0.side', [10, 20], [30, 20])] }), bomOf(line('Plate', ['p1'])));
  anchor(result, 1, 'front', 'p1/n0.side', [40, 250]);
  assert.deepEqual(result.noEdge, []);
});

test('hidden views, hidden pieces, degenerate pieces and other occurrences cannot supply an anchor', () => {
  const result = render(layoutOf(['iso', 'front']), viewsOf({
    iso: [edge('p1/n0.side', [0, 0], [80, 60], false), edge('p10/n0.side'), edge('p1/n1.side', [10, 10], [10, 10])],
    front: [edge('p2/n0.side')], top: [edge('p1/n0.side')],
  }), bomOf(line('No visible edge', ['p1']), line('Visible front', ['p2']), line('Absent', ['missing'])));
  assert.deepEqual(result.noEdge, [1, 3]); assert.deepEqual(result.placed.map(p => p.no), [2]);
  anchor(result, 2, 'front', 'p2/n0.side', [38, 255]);
});

test('no shown view keeps every required no-edge warning entry and draws nothing', () => {
  const result = render(layoutOf([]), viewsOf({ iso: [edge('p1/n0.side')], front: [edge('p2/n0.side')] }), bomOf(line('A', ['p1']), line('B', ['p2'])));
  assert.deepEqual(result, { groups: [], placed: [], unclear: [], noEdge: [1, 2] });
});

test('base-body identity and bought element identity stay separate across views', () => {
  const result = render(layoutOf(), viewsOf({
    iso: [edge('n8.side|n8.top'), edge('p1/n9.side')],
    front: [edge('p1/n0.side')], top: [edge('n1.side#1|n1.top#1')],
  }), bomOf(line('Base body', ['base:body0']), line('Placed part', ['p1']), line('Bearing', ['p1:n9'], { kind: 'bearing' })), { body0: ['n1.side', 'n1.top'] });
  anchor(result, 1, 'top', 'n1.side#1|n1.top#1', [46, 110]);
  anchor(result, 2, 'front', 'p1/n0.side', [38, 255]);
  anchor(result, 3, 'iso', 'p1/n9.side', [234, 87.5]);
  assert.deepEqual(result.noEdge, []);
});

test('a missing base-body face map never borrows a visible face of another body', () => {
  const result = render(layoutOf(), viewsOf({ iso: [edge('n8.side|n8.top')], front: [edge('n1.side|n1.top')] }), bomOf(line('Unknown body', ['base:missing'])), { another: ['n1.side', 'n1.top'] });
  assert.deepEqual(result.noEdge, [1]); assert.deepEqual(result.placed, []); assert.deepEqual(result.groups, []);
});

test('longest visible piece stays the anchor; a longer hidden piece does not win', () => {
  const own: ProjectedEdge = { ...edge('p1/n0.side'), pieces: [{ curve: curve([0, 0], [80, 60]), visible: false }, { curve: curve([2, 4], [6, 4]), visible: true }, { curve: curve([10, 20], [30, 20]), visible: true }] };
  anchor(render(layoutOf(), viewsOf({ top: [own] }), bomOf(line('Plate', ['p1']))), 1, 'top', own.name, [50, 100]);
});

test('visible polyline arc-length midpoint is mapped by the selected view', () => {
  const own: ProjectedEdge = { ...edge('p1/n0.side'), kind: 'curve', pieces: [{ visible: true, curve: { kind: 'polyline', points: [[0, 0], [0, 6], [8, 6]] } }] };
  anchor(render(layoutOf(), viewsOf({ top: [own] }), bomOf(line('Plate', ['p1']))), 1, 'top', own.name, [31, 114]);
});

test('visible circular arc midpoint remains on the real projected arc', () => {
  const own: ProjectedEdge = { ...edge('p1/n0.side'), kind: 'curve', pieces: [{ visible: true, curve: { kind: 'arc', center: [20, 20], u: [4, 0], v: [0, 4], t0: 0, t1: Math.PI } }] };
  anchor(render(layoutOf(), viewsOf({ right: [own] }), bomOf(line('Plate', ['p1']))), 1, 'right', own.name, [270, 212]);
});

test('regeneration and serialized input round-trip retain BOM and occurrence identity', () => {
  const layout = layoutOf(), bom = bomOf(line('Plate', ['p1'])), settings = { ...defaultDrawing(), views: [...IDS], balloons: true };
  const before = render(layout, viewsOf({ front: [edge('p1/n0.side')] }), bom);
  anchor(before, 1, 'front', 'p1/n0.side', [38, 255]);
  const views = viewsOf({ top: [edge('p1/n0.side', [20, 30], [40, 30])] });
  const saved = JSON.stringify({ layout, views, bom, settings }), opened = JSON.parse(saved) as { layout: SheetLayout; views: DrawingViews; bom: Bom; settings: typeof settings };
  assert.equal(readDrawing(opened.settings).balloons, true);
  assert.deepEqual(opened.bom.lines[0].parts, ['p1']);
  const after = render(opened.layout, opened.views, opened.bom);
  anchor(after, 1, 'top', 'p1/n0.side', [60, 90]);
  assert.deepEqual(after.placed.map(p => [p.no, p.item, p.edge]), before.placed.map(p => [p.no, p.item, p.edge]));
  assert.deepEqual(after, render(layout, views, bom), 'round-trip has the same regenerated selection and marks');
  const gone = render(opened.layout, viewsOf({ top: [edge('p1/n0.side', [20, 30], [40, 30], false)] }), opened.bom);
  assert.deepEqual(gone.noEdge, [1]); assert.deepEqual(gone.placed, [], 'regeneration cannot keep a stale hidden anchor');
});

test('lack of balloon room stays unclear and never changes the visible edge identity', () => {
  const layout = layoutOf(), views = viewsOf({ top: [edge('p1/n0.side')] }), bom = bomOf(line('Plate', ['p1']));
  const result = balloonMarks(layout, views, bom, [layout.frame]);
  assert.deepEqual(result.unclear, [1]); assert.deepEqual(result.noEdge, []);
  anchor(result, 1, 'top', 'p1/n0.side', [46, 110]);
});

// Synthetic diagnostic contexts only: the original 16 placement cases above remain unchanged.
// These cases do not replay C, build native projections, or establish document/browser acceptance.
function balloonWarnings(layout: SheetLayout, views: DrawingViews, balloons: Balloons) {
  const ctx: IssueContext = {
    views, layout, settings: { ...defaultDrawing(), views: [...IDS], balloons: true },
    sheet: { size: layout.size, groups: balloons.groups, dimensions: [], balloons }, callout: () => null,
  };
  const before = JSON.stringify({ ctx, balloons });
  const issues = drawingIssues(ctx).filter(x => x.code === 'BALLOON_NOT_CLEAR' || x.code === 'BALLOON_NO_EDGE');
  assert.equal(JSON.stringify({ ctx, balloons }), before, 'diagnostics preserve BOM numbers, selected views/edges, tips, circle positions, groups and input geometry');
  return issues;
}

test('balloon diagnostic names the unclear top placement rather than the first clear iso placement', () => {
  const layout = layoutOf(), views = viewsOf({ iso: [edge('p1/n0.side')], top: [edge('p2/n0.side')] });
  const result = render(layout, views, bomOf(line('A', ['p1']), line('B', ['p2'])));
  assert.equal(result.placed[0].view, 'iso');
  assert.deepEqual(balloonWarnings(layout, views, { ...result, unclear: [2] }), [{
    code: 'BALLOON_NOT_CLEAR', severity: 'warning',
    message: 'Balloon 2: no clear room beside the top view, so it sits at the nearest place, over other marks. A larger sheet or a smaller scale gives room.',
  }]);
  anchor(result, 2, 'top', 'p2/n0.side', [46, 110]);
});

test('balloon diagnostic lists only actual unclear views and lists a repeated view once', () => {
  const layout = layoutOf(), views = viewsOf({ iso: [edge('p1/n0.side')], top: [edge('p2/n0.side'), edge('p4/n0.side', [30, 20], [50, 20])], right: [edge('p3/n0.side')] });
  const result = render(layout, views, bomOf(...[1, 2, 3, 4].map(n => line(`Part ${n}`, [`p${n}`]))));
  assert.deepEqual(balloonWarnings(layout, views, { ...result, unclear: [2, 3, 4] }), [{
    code: 'BALLOON_NOT_CLEAR', severity: 'warning',
    message: 'Balloons 2, 3, 4: no clear room beside the top, right views, so they sit at the nearest place, over other marks. A larger sheet or a smaller scale gives room.',
  }]);
});

test('single-view balloon diagnostics preserve existing singular and plural wording', () => {
  for (const view of ['iso', 'front'] as const) {
    const layout = layoutOf([view]), views = viewsOf({ [view]: [edge('p1/n0.side'), edge('p2/n0.side', [30, 20], [50, 20])] });
    const one = balloonMarks(layout, views, bomOf(line('A', ['p1'])), [layout.frame]);
    assert.deepEqual(balloonWarnings(layout, views, one), [{
      code: 'BALLOON_NOT_CLEAR', severity: 'warning',
      message: `Balloon 1: no clear room beside the ${view} view, so it sits at the nearest place, over other marks. A larger sheet or a smaller scale gives room.`,
    }]);
    const two = balloonMarks(layout, views, bomOf(line('A', ['p1']), line('B', ['p2'])), [layout.frame]);
    assert.deepEqual(balloonWarnings(layout, views, two), [{
      code: 'BALLOON_NOT_CLEAR', severity: 'warning',
      message: `Balloons 1, 2: no clear room beside the ${view} view, so they sit at the nearest place, over other marks. A larger sheet or a smaller scale gives room.`,
    }]);
  }
});

test('no-edge diagnostic reports failure in every shown base view while keeping the legacy iso prefix', () => {
  const layout = layoutOf(), views = viewsOf({ iso: [edge('p1/n0.side', [8, 10], [24, 10], false)], front: [edge('p10/n0.side')] });
  const one = render(layout, views, bomOf(line('A', ['p1'])));
  const warnings = balloonWarnings(layout, views, one);
  assert.deepEqual(warnings, [{
    code: 'BALLOON_NO_EDGE', severity: 'warning',
    message: 'BOM line 1: no edge of its item is visible in the iso view or any other shown base view (front, top, right), so no balloon is drawn. The BOM table holds it.',
  }]);
  assert.match(warnings[0].message, /^BOM line 1: no edge of its item is visible in the iso view/);
  const two = render(layout, views, bomOf(line('A', ['p1']), line('B', ['p2'])));
  assert.deepEqual(balloonWarnings(layout, views, two), [{
    code: 'BALLOON_NO_EDGE', severity: 'warning',
    message: 'BOM lines 1, 2: no edge of their items is visible in the iso view or any other shown base view (front, top, right), so no balloon is drawn. The BOM table holds them.',
  }]);
  assert.deepEqual([two.noEdge, two.placed, two.groups], [[1, 2], [], []]);
});

test('single shown front view keeps the existing no-edge diagnostic wording', () => {
  const layout = layoutOf(['front']), views = viewsOf({ iso: [edge('p1/n0.side')] });
  assert.deepEqual(balloonWarnings(layout, views, render(layout, views, bomOf(line('A', ['p1'])))), [{
    code: 'BALLOON_NO_EDGE', severity: 'warning',
    message: 'BOM line 1: no edge of its item is visible in the front view, so no balloon is drawn. The BOM table holds it.',
  }]);
});

test('no-edge diagnostic reads actual shown top/right placements rather than settings preferences', () => {
  const layout = layoutOf(['top', 'right']), views = viewsOf({ iso: [edge('p1/n0.side')], front: [edge('p1/n0.side')] });
  assert.deepEqual(balloonWarnings(layout, views, render(layout, views, bomOf(line('A', ['p1'])))), [{
    code: 'BALLOON_NO_EDGE', severity: 'warning',
    message: 'BOM line 1: no edge of its item is visible in the top view or any other shown base view (right), so no balloon is drawn. The BOM table holds it.',
  }]);
});

test('no shown base view is explained without inventing an iso or front search', () => {
  const layout = layoutOf([]), views = viewsOf({ iso: [edge('p1/n0.side')], front: [edge('p1/n0.side')] });
  assert.deepEqual(balloonWarnings(layout, views, render(layout, views, bomOf(line('A', ['p1'])))), [{
    code: 'BALLOON_NO_EDGE', severity: 'warning',
    message: 'BOM line 1: no edge of its item is visible on this sheet because no base view is shown, so no balloon is drawn. The BOM table holds it.',
  }]);
});

test('clear multi-view balloons add neither balloon warning nor selection metadata', () => {
  const layout = layoutOf(), views = viewsOf({ iso: [edge('p1/n0.side')], top: [edge('p2/n0.side')] });
  const result = render(layout, views, bomOf(line('A', ['p1']), line('B', ['p2'])));
  assert.deepEqual([result.unclear, result.noEdge], [[], []]);
  assert.deepEqual(balloonWarnings(layout, views, result), []);
  anchor(result, 1, 'iso', 'p1/n0.side', [234, 87.5]);
  anchor(result, 2, 'top', 'p2/n0.side', [46, 110]);
});
