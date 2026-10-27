import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFix, drawingIssues, type IssueContext } from '../src/drawing/issues';
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

// These pure fixtures cover the public Move contract seen in the d32 -> d33 regression.
// They do not replay cover.bcad or establish its browser/DXF acceptance.
type LinearResult = Extract<Resolved, { ok: true; kind: 'linear' }>;
function moveFixture(wide = false, fixedText = false, obstacles: Mark[] = []): IssueContext {
  const base = fixture(), extent = wide ? 200 : 100, middle = extent / 2;
  const specs: { dim: DrawingDimension; a: XY; b: XY; value: number; text: string }[] = [{
    dim: { id: 'auto-p2', view: 'front', kind: 'linear', auto: true, orient: 'horizontal',
      a: { at: 'end', edge: 'moving.a', near: [middle - 10, middle, 0] },
      b: { at: 'end', edge: 'moving.b', near: [middle + 10, middle, 0] },
      place: [middle, fixedText ? 34 : middle] },
    a: [middle - 10, middle], b: [middle + 10, middle], value: 20, text: '20',
  }];
  if (fixedText) specs.push({
    dim: { id: 'fixed-six', view: 'front', kind: 'linear', orient: 'vertical',
      a: { at: 'end', edge: 'fixed.a', near: [70, 26, 0] },
      b: { at: 'end', edge: 'fixed.b', near: [70, 32, 0] }, place: [41.2, 29] },
    a: [70, 26], b: [70, 32], value: 6, text: '6',
  });
  const layout: SheetLayout = { ...base.layout, size: [extent, extent],
    frame: [5, 5, extent - 5, extent - 5], title: [extent - 20, extent - 20, extent - 5, extent - 5],
    views: { ...base.layout.views,
      front: { ...base.layout.views.front, origin: [0, extent], box: [middle - 15, middle - 15, middle + 15, middle + 15] },
      iso: { ...base.layout.views.iso, hidden: true },
    } };
  const projection = { ...base.views.front, min: [0, 0] as XY, max: [extent, extent] as XY };
  const views: DrawingViews = { front: projection, top: projection, right: projection, iso: projection };
  const build = (settings: DrawingSettings): IssueContext => {
    const dimensions: LinearResult[] = settings.dimensions.map(dim => {
      const spec = specs.find(x => x.dim.id === dim.id)!;
      assert.ok(dim.kind === 'linear');
      return { ok: true, kind: 'linear', dim, a: spec.a, b: spec.b, value: spec.value, text: spec.text };
    });
    const groups: MarkGroup[] = [{ role: 'view', view: 'front', marks: obstacles },
      ...dimensions.map(r => ({ role: 'dimension' as const, id: r.dim.id, view: r.dim.view, marks: dimensionMarks(layout.views.front, r) }))];
    return { views, layout, settings, sheet: { size: layout.size, dimensions, groups }, callout: () => null, rebuild: build };
  };
  return build({ ...defaultDrawing(), scale: 1, dimensions: specs.map(x => x.dim) });
}
const visualIssues = (ctx: IssueContext) => drawingIssues(ctx).filter(x => ['TEXT_OVERLAP', 'TEXT_OVER_LINES', 'OFF_SHEET'].includes(x.code));
function movedContext(ctx: IssueContext, place: XY): IssueContext {
  return ctx.rebuild!(applyFix(ctx, { kind: 'move', dim: 'auto-p2', place }));
}
function checkMoveGeometry(ctx: IssueContext): void {
  const own = ctx.sheet.groups.find(g => g.id === 'auto-p2')!.marks;
  const held = ctx.sheet.groups.filter(g => g.id !== 'auto-p2').flatMap(g => g.marks);
  const heldBoxes = texts(held).map(bounds), ownBoxes = texts(own).map(bounds);
  for (const box of ownBoxes) {
    assert.ok(heldBoxes.every(other => !overlap(box, other)), 'moved text clears the fixed texts');
    assert.ok(segments(held).every(([a, b]) => !cuts(a, b, box)), 'moved text clears the existing geometry');
  }
  assert.ok(segments(own).every(([a, b]) => heldBoxes.every(box => !cuts(a, b, box))), 'new extensions, leaders and arrows clear every fixed text');
  const [x0, y0, x1, y1] = ctx.layout.frame;
  for (const [x, y] of [...segments(own).flat(), ...ownBoxes.flatMap(([a, b, c, d]) => [[a, b], [c, d]])]) {
    assert.ok(x >= x0 && x <= x1 && y >= y0 && y <= y1, 'candidate stays inside the original frame');
  }
}
function applyPublicMove(ctx: IssueContext): IssueContext {
  const before = JSON.stringify(ctx.settings);
  const issue = drawingIssues(ctx).find(x => x.code === 'TEXT_OVER_LINES' && x.dims?.includes('auto-p2'));
  assert.ok(issue, 'the original text has a real line collision');
  assert.ok(issue.fix?.kind === 'move', 'the public issue offers a Move');
  const next = ctx.rebuild!(applyFix(ctx, issue.fix));
  const withoutPlace = ({ place: _place, ...d }: DrawingDimension) => { void _place; return d; };
  assert.deepEqual(next.settings.dimensions.map(withoutPlace), ctx.settings.dimensions.map(withoutPlace), 'all refs, flags, tolerances and directions stay');
  assert.deepEqual(next.sheet.dimensions.map(r => r.ok ? [r.value, r.text] : null), ctx.sheet.dimensions.map(r => r.ok ? [r.value, r.text] : null), 'physical and displayed values stay');
  const styles = (c: IssueContext) => c.sheet.groups.flatMap(g => texts(g.marks).map(({ text, size, angle, bold, anchor }) => ({ id: g.id, text, size, angle, bold, anchor })));
  assert.deepEqual(styles(next), styles(ctx), 'all shown text, fonts and reading directions stay');
  assert.deepEqual(next.sheet.groups.filter(g => g.id !== 'auto-p2'), ctx.sheet.groups.filter(g => g.id !== 'auto-p2'), 'all fixed text and geometry stay');
  assert.equal(next.settings.scale, ctx.settings.scale);
  assert.deepEqual(next.layout, ctx.layout, 'page, scale, frame and view placements stay');
  assert.equal(JSON.stringify(ctx.settings), before, 'the input is not changed');
  assert.deepEqual(visualIssues(next), [], 'Move creates no new visual issue elsewhere on the sheet');
  checkMoveGeometry(next);
  return next;
}

test('public Move rejects a new extension through an unchanged dimension six', () => {
  const ctx = moveFixture(false, true, [line([45, 64], [55, 64])]);
  const fixed = ctx.sheet.groups.find(g => g.id === 'fixed-six')!;
  assert.equal(texts(fixed.marks)[0].text, '6');
  assert.deepEqual(visualIssues(ctx).map(x => x.dims), [['auto-p2']], 'the six starts clear');
  // This is the former first outward 8 mm candidate: its own text clears, but its extension does not.
  const unsafe = movedContext(ctx, [50, 26]);
  const own = unsafe.sheet.groups.find(g => g.id === 'auto-p2')!.marks;
  const fixedBox = bounds(texts(fixed.marks)[0]);
  assert.ok(texts(own).every(t => !overlap(bounds(t), fixedBox)), 'testing the moved text alone misses the regression');
  assert.ok(segments(own).some(([a, b]) => cuts(a, b, fixedBox)), 'an independent oracle finds the new extension collision');
  assert.ok(visualIssues(unsafe).some(x => x.code === 'TEXT_OVER_LINES' && x.dims?.includes('fixed-six')));
  const next = applyPublicMove(ctx);
  assert.notDeepEqual(next.settings.dimensions[0].place, [50, 26], 'the unsafe candidate is not offered');
  assert.deepEqual(next.settings.dimensions[1], ctx.settings.dimensions[1], 'the fixed six is not moved to hide the collision');
});

test('public Move finds a 2 mm normal gap missed by all six 8 mm rows', () => {
  const rows = [0, ...Array.from({ length: 6 }, (_, k) => 8 * (k + 1)).flatMap(mm => [-mm, mm])];
  const ctx = moveFixture(false, false, rows.map(mm => line([48, 47.8 + mm], [52, 47.8 + mm])));
  for (const mm of rows.filter(mm => mm !== 0)) {
    const candidate = movedContext(ctx, [50, 50 + mm]);
    const box = bounds(texts(candidate.sheet.groups.find(g => g.id === 'auto-p2')!.marks)[0]);
    assert.ok(segments(ctx.sheet.groups[0].marks).some(([a, b]) => cuts(a, b, box)), 'each old 8 mm row is independently blocked');
  }
  checkMoveGeometry(movedContext(ctx, [50, 52]));
  const next = applyPublicMove(ctx), place = next.settings.dimensions[0].place;
  assert.equal(place[0], 50, 'only the normal component moves');
  assert.equal(Math.abs(place[1] - 50), 2, 'the safe gap is two paper mm away');
});

test('public Move searches beyond six rows when the nearer normal positions are blocked', () => {
  const ctx = moveFixture(true, false, [line([100, 45], [100, 153])]);
  for (const mm of [0, 8, 16, 24, 32, 40, 48]) for (const sign of [-1, 1]) {
    const candidate = movedContext(ctx, [100, 100 + sign * mm]);
    const box = bounds(texts(candidate.sheet.groups.find(g => g.id === 'auto-p2')!.marks)[0]);
    assert.ok(cuts([100, 45], [100, 153], box), 'all six old normal rows remain blocked');
  }
  checkMoveGeometry(movedContext(ctx, [100, 156]));
  const next = applyPublicMove(ctx), place = next.settings.dimensions[0].place;
  assert.equal(place[0], 100, 'measurement direction stays fixed');
  assert.ok(Math.abs(place[1] - 100) > 48, 'a real safe spot lies beyond the old 48 mm range');
});
