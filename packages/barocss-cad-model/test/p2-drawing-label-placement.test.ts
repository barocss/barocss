import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingIssues, type IssueContext } from '../src/drawing/issues';
import { placeDimensionLabels } from '../src/drawing/layout';
import { dimensionMarks, type Mark, type MarkGroup } from '../src/drawing/sheet';
import { textWidth } from '../src/drawing/text';
import { defaultDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews, type XY } from '../src/drawing/types';
import type { Resolved } from '../src/drawing/dimensions';
import type { SheetLayout } from '../src/drawing/views';

// Source regression fixtures, not a replay or acceptance of the original product document.
// Original C8eb build-completed-report.json: case-bottom TEXT_OVERLAP 2.11/2.16 with the iso name;
// case-bottom and cover TEXT_OVER_LINES (cover includes 0.17). Original SHA:
// 8eb2022266215b5d54fed4074e43e5d91aa66ef9. The original report and drawing are read-only evidence.

type Box = [number, number, number, number];
type Text = Extract<Mark, { kind: 'text' }>;

// Independent axis-aligned geometry oracle for these horizontal/vertical-text fixtures.
// Font widths come from the existing metrics. No production collision helper is used below.
function bounds(m: Text): Box {
  const w = textWidth(m.text, m.size, !!m.bold), start = m.anchor === 'start' ? 0 : m.anchor === 'end' ? -w : -w / 2;
  const angle = -(m.angle ?? 0) * Math.PI / 180;
  assert.ok(Math.abs(Math.sin(angle * 2)) < 1e-10, 'oracle fixture text is horizontal or vertical');
  const points = [start, start + w].flatMap(x => [-0.8 * m.size, 0.22 * m.size].map(y => [m.at[0] + x * Math.cos(angle) - y * Math.sin(angle), m.at[1] + x * Math.sin(angle) + y * Math.cos(angle)]));
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
const overlap = (a: Box, b: Box) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.2 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.2;

// Intersect with the four edges after shrinking by the unchanged 0.2 mm issue clearance.
function cuts(a: XY, b: XY, box: Box): boolean {
  const [x0, y0, x1, y1] = [box[0] + 0.2, box[1] + 0.2, box[2] - 0.2, box[3] - 0.2];
  if (x1 <= x0 || y1 <= y0) return false;
  const inside = ([x, y]: XY) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inside(a) || inside(b)) return true;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const x of [x0, x1]) if (dx) { const t = (x - a[0]) / dx, y = a[1] + t * dy; if (t >= 0 && t <= 1 && y >= y0 && y <= y1) return true; }
  for (const y of [y0, y1]) if (dy) { const t = (y - a[1]) / dy, x = a[0] + t * dx; if (t >= 0 && t <= 1 && x >= x0 && x <= x1) return true; }
  return false;
}
function segments(marks: readonly Mark[]): [XY, XY][] {
  return marks.flatMap(m => m.kind === 'line' ? [[m.a, m.b] as [XY, XY]] : m.kind === 'fill' || m.kind === 'polyline' ? m.points.slice(1).map((p, k) => [m.points[k], p] as [XY, XY]).concat(m.kind === 'fill' ? [[m.points[m.points.length - 1], m.points[0]]] : []) : []);
}
const texts = (marks: readonly Mark[]) => marks.filter((m): m is Text => m.kind === 'text');
const line = (a: XY, b: XY): Mark => ({ kind: 'line', a, b, pen: 'thin' });

function fixture(value = 2.11, scale = 1, orient: 'horizontal' | 'vertical' = 'horizontal', blocked = false, follows = false): IssueContext {
  const a: XY = [49, 50], b: XY = orient === 'horizontal' ? [49 + value, 50] : [49, 50 + value];
  const dim: DrawingDimension = { id: 'auto-p2', view: 'front', kind: 'linear', auto: true, a: { at: 'end', edge: 'a', near: [a[0], a[1], 0] }, b: { at: 'end', edge: 'b', near: [b[0], b[1], 0] }, orient, place: orient === 'horizontal' ? [50, 50 - 16 / scale] : [49 - 16 / scale, 50] };
  const pr: DrawingViews['front'] = { right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], edges: [], min: [0, 0], max: [100, 100] };
  const views: DrawingViews = { front: pr, top: pr, right: pr, iso: pr };
  const layout: SheetLayout = { size: [100, 100], scale, fits: true, frame: [5, 5, 95, 95], title: [70, 82, 95, 95], views: {
    front: { id: 'front', scale, origin: [50 - 50 * scale, 50 + 50 * scale], box: [35, 35, 65, 65] },
    top: { id: 'top', scale, origin: [0, 0], box: [0, 0, 0, 0], hidden: true },
    right: { id: 'right', scale, origin: [0, 0], box: [0, 0, 0, 0], hidden: true },
    iso: { id: 'iso', scale, origin: [0, 0], box: [68, 10, 90, 30] },
  } };
  const resolved = (d: DrawingDimension): Extract<Resolved, { ok: true; kind: 'linear' }> => {
    assert.ok(d.kind === 'linear');
    return { ok: true, kind: 'linear', dim: d, a, b, value, text: String(value) };
  };
  const initialText = texts(dimensionMarks(layout.views.front, resolved(dim)))[0];
  const build = (settings: DrawingSettings): IssueContext => {
    const d = settings.dimensions[0], r = resolved(d), marks = dimensionMarks(layout.views.front, r);
    const label: Mark = { kind: 'text', at: follows ? texts(marks)[0].at : initialText.at, text: 'ISOMETRIC', size: 3.5, anchor: 'middle' };
    const groups: MarkGroup[] = [
      { role: 'view', view: 'front', marks: [line([25, 34], [65, 34])] },
      { role: 'label', view: 'iso', marks: [label] },
      { role: 'note', id: 'note', marks: [{ kind: 'text', at: [20, 76], text: 'KEEP', size: 3.5, anchor: 'start' }] },
      { role: 'dimension', id: 'fixed', view: 'front', marks: [line([20, 68], [65, 68])] },
      { role: 'dimension', id: d.id, view: d.view, marks },
    ];
    if (blocked) groups.push({ role: 'table', id: 'full', marks: [line([5, 5], [95, 5]), line([95, 5], [95, 95]), line([95, 95], [5, 95]), line([5, 95], [5, 5])] });
    return { views, layout, settings, callout: () => null, sheet: { size: [100, 100], groups, dimensions: [r], ...(blocked ? { tables: [{ id: 'full', box: [5, 5, 95, 95] as Box }] } : {}) }, rebuild: build };
  };
  return build({ ...defaultDrawing(), scale, dimensions: [dim] });
}

function checkGeometry(ctx: IssueContext): void {
  const own = ctx.sheet.groups.find(g => g.id === 'auto-p2')!.marks;
  const held = ctx.sheet.groups.filter(g => g.id !== 'auto-p2'), heldBoxes = held.flatMap(g => texts(g.marks).map(bounds));
  const lines = segments(own), boxes = texts(own).map(bounds), otherLines = segments(held.flatMap(g => g.marks));
  for (const box of boxes) {
    assert.ok(heldBoxes.every(b => !overlap(box, b)), 'dimension text clears every other text');
    assert.ok(otherLines.every(([a, b]) => !cuts(a, b, box)), 'dimension text clears body lines and other leaders');
    assert.ok(!overlap(box, ctx.layout.views.iso.box), 'dimension text clears the other view');
    assert.ok(!overlap(box, ctx.layout.title), 'dimension text clears the title');
  }
  for (const [a, b] of lines) {
    assert.ok(heldBoxes.every(box => !cuts(a, b, box)), 'new leaders and arrows clear other texts');
    assert.ok(!cuts(a, b, ctx.layout.views.iso.box), 'new lines clear the other view');
    assert.ok(!cuts(a, b, ctx.layout.title), 'new lines clear the title');
  }
  for (const [x, y] of [...lines.flat(), ...boxes.flatMap(([x0, y0, x1, y1]) => [[x0, y0], [x1, y1]])]) assert.ok(x >= 5 && x <= 95 && y >= 5 && y <= 95, 'inside the sheet frame');
}

for (const value of [2.11, 2.16, 0.17]) for (const scale of [1, 0.5]) for (const orient of ['horizontal', 'vertical'] as const) test(`P2 ${value}, scale ${scale}, ${orient}: real text moves clear of the iso name`, () => {
  const ctx = fixture(value, scale, orient), before = JSON.stringify(ctx.settings), label = ctx.sheet.groups.find(g => g.role === 'label')!;
  assert.ok(overlap(bounds(texts(ctx.sheet.groups.find(g => g.id === 'auto-p2')!.marks)[0]), bounds(texts(label.marks)[0])), 'independent initial collision');
  assert.ok(drawingIssues(ctx).some(x => x.code === 'TEXT_OVERLAP' && x.dims?.includes('auto-p2')));
  const result = placeDimensionLabels(ctx), next = ctx.rebuild!(result.settings);
  assert.notDeepEqual(result.settings.dimensions[0].place, ctx.settings.dimensions[0].place, 'a real candidate is selected');
  const withoutPlace = ({ place: _place, ...d }: DrawingDimension) => { void _place; return d; };
  assert.deepEqual(result.settings.dimensions.map(withoutPlace), ctx.settings.dimensions.map(withoutPlace), 'all references, flags, tolerances and direction stay');
  assert.deepEqual(next.sheet.dimensions.map(r => r.ok ? [r.value, r.text] : null), [[value, String(value)]], 'physical value and displayed value stay');
  const textStyle = (groups: MarkGroup[]) => texts(groups.find(g => g.id === 'auto-p2')!.marks).map(({ text, size, angle, bold, anchor }) => ({ text, size, angle, bold, anchor }));
  assert.deepEqual(textStyle(next.sheet.groups), textStyle(ctx.sheet.groups), 'shown text, font and direction stay');
  assert.equal(result.settings.scale, scale); assert.equal(JSON.stringify(ctx.settings), before, 'input stays intact');
  assert.deepEqual(next.sheet.groups.filter(g => g.id !== 'auto-p2'), ctx.sheet.groups.filter(g => g.id !== 'auto-p2'), 'body, labels and other leaders stay');
  assert.ok(!result.left.some(x => ['TEXT_OVERLAP', 'TEXT_OVER_LINES', 'OFF_SHEET'].includes(x.code) && x.dims?.includes('auto-p2')));
  checkGeometry(next);
});

test('a body line through the initial text requires a real clear candidate', () => {
  const ctx = fixture();
  ctx.sheet.groups = ctx.sheet.groups.filter(g => g.role !== 'label');
  const at = texts(ctx.sheet.groups.find(g => g.id === 'auto-p2')!.marks)[0].at;
  const obstacle: MarkGroup = { role: 'view', view: 'front', marks: [line([20, at[1] - 1], [65, at[1] - 1])] };
  ctx.sheet.groups.push(obstacle);
  const rebuild = ctx.rebuild!;
  ctx.rebuild = settings => { const next = rebuild(settings); next.sheet.groups = next.sheet.groups.filter(g => g.role !== 'label'); next.sheet.groups.push(obstacle); return next; };
  assert.ok(drawingIssues(ctx).some(x => x.code === 'TEXT_OVER_LINES' && x.dims?.includes('auto-p2')));
  const result = placeDimensionLabels(ctx), next = ctx.rebuild(result.settings);
  assert.notDeepEqual(result.settings.dimensions[0].place, ctx.settings.dimensions[0].place);
  checkGeometry(next);
});

test('insufficient space preserves the required dimension and its unresolved collision', () => {
  const ctx = fixture(2.11, 1, 'horizontal', true), result = placeDimensionLabels(ctx);
  assert.deepEqual(result.settings, ctx.settings);
  assert.ok(result.left.some(x => x.code === 'TEXT_OVERLAP' && x.dims?.includes('auto-p2')));
});

test('a collision revealed by sheet rebuild rejects the candidate', () => {
  const ctx = fixture(2.11, 1, 'horizontal', false, true), result = placeDimensionLabels(ctx);
  assert.deepEqual(result.settings, ctx.settings);
  assert.ok(result.left.some(x => x.code === 'TEXT_OVERLAP' && x.dims?.includes('auto-p2')));
});

test('a manual dimension is not moved or removed', () => {
  const ctx = fixture(); delete ctx.settings.dimensions[0].auto;
  assert.deepEqual(placeDimensionLabels(ctx).settings, ctx.settings);
});

for (const kind of ['radius', 'diameter'] as const) test(`${kind}: a real leader candidate clears the fixed text`, () => {
  const base = fixture(), radius = 4, value = kind === 'radius' ? radius : 2 * radius;
  const dim: DrawingDimension = { id: 'auto-p2', view: 'front', kind, auto: true, edge: 'circle', near: [50, 50, 0], place: [60, 40] };
  const resolved = (d: DrawingDimension): Extract<Resolved, { ok: true; kind: 'radius' | 'diameter' }> => {
    assert.ok(d.kind === 'radius' || d.kind === 'diameter');
    return { ok: true, kind, dim: d, center: [50, 50], radius, value, text: `${kind === 'radius' ? 'R' : 'Ø'}${value}` };
  };
  const initialText = texts(dimensionMarks(base.layout.views.front, resolved(dim)))[0];
  const build = (settings: DrawingSettings): IssueContext => {
    const r = resolved(settings.dimensions[0]);
    return { ...base, settings, sheet: { ...base.sheet, dimensions: [r], groups: [
      ...base.sheet.groups.filter(g => g.id !== 'auto-p2' && g.role !== 'label'),
      { role: 'label', view: 'iso', marks: [{ ...initialText, text: 'ISOMETRIC' }] },
      { role: 'dimension', id: dim.id, view: 'front', marks: dimensionMarks(base.layout.views.front, r) },
    ] }, rebuild: build };
  };
  const ctx = build({ ...base.settings, dimensions: [dim] });
  assert.ok(drawingIssues(ctx).some(x => x.code === 'TEXT_OVERLAP' && x.dims?.includes(dim.id)));
  const result = placeDimensionLabels(ctx), next = build(result.settings);
  assert.notDeepEqual(result.settings.dimensions[0].place, dim.place);
  assert.equal(result.settings.dimensions.length, 1);
  assert.deepEqual(next.sheet.dimensions.map(r => r.ok ? [r.value, r.text] : null), [[value, resolved(dim).text]]);
  checkGeometry(next);
});
