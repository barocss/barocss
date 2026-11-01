// D416: complete short linear-label bounds, not exact glyph ink. The old eight byte controls contained collisions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rectanglePart, starterDoc } from '../src/engine/doc';
import { brepsFor } from '../src/engine/evaluate';
import { projectViews } from '../src/drawing/project';
import { snapPoints } from '../src/drawing/dimensions';
import { defaultDrawing, type DrawingDimension, type DrawingSettings } from '../src/drawing/types';
import { basicBox, buildSheet, datumMarks, dimensionMarks, frameMarks, type Mark } from '../src/drawing/sheet';
import { layoutSheet } from '../src/drawing/views';
import { textCorners } from '../src/drawing/text';
import { drawingIssues, segmentHitsQuad } from '../src/drawing/issues';
import { presetFor } from '../src/drawing/standard';
import { sheetDxf, sheetDxfDocument } from '../src/io/dxf';

type XY = readonly number[];
function overlaps(a: readonly XY[], b: readonly XY[]): boolean {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const axis = [-(q[1] - p[1]), q[0] - p[0]];
    if (!axis[0] && !axis[1]) continue;
    const left = a.map(point => point[0] * axis[0] + point[1] * axis[1]);
    const right = b.map(point => point[0] * axis[0] + point[1] * axis[1]);
    if (Math.min(Math.max(...left), Math.max(...right)) <= Math.max(Math.min(...left), Math.min(...right))) return false;
  }
  return true;
}
const source = brepsFor(starterDoc()); assert.ok('breps' in source);
const projected = projectViews(source.breps, source.prefixes); assert.ok(projected.ok);
const views = projected.views, points = snapPoints(views.front);
const at = (x: number, z: number) => points.find(p => Math.abs(p.at[0] - x) < 1e-9 && Math.abs(p.at[1] - z) < 1e-9)!.ref;
const dimension: DrawingDimension = { id: 'd2', kind: 'linear', view: 'front', orient: 'vertical', a: at(64, 0), b: at(64, 8), place: [74, 4], tol: { kind: 'deviation', upper: 0.05, lower: -0.1 } };
const hole = views.top.edges.find(edge => edge.kind === 'circle')!;
const circleDimensions: DrawingDimension[] = (['radius', 'diameter'] as const).map(kind => ({ id: kind, kind, view: 'top', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [33, 17] }));
const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const cases: { id: string; standard: 'plain' | 'iso' | 'asme'; dual: boolean; settings: DrawingSettings; layout: ReturnType<typeof layoutSheet>; sheet: ReturnType<typeof buildSheet>; marks: Mark[]; circles: ReturnType<typeof buildSheet>; circleLayout: ReturnType<typeof layoutSheet> }[] = [];
for (const standard of ['plain', 'iso', 'asme'] as const) for (const units of ['mm', 'inch'] as const) for (const dual of [false, true]) {
  const id = `${standard}-${units}-${dual ? 'dual' : 'single'}`;
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [dimension], scale: 1, units, dual, ...(standard === 'plain' ? {} : { standard }) };
  const layout = layoutSheet(views, settings), sheet = buildSheet(views, layout, settings, { title: 'Linear clearance', date: '2026-11-01' });
  const marks = sheet.groups.find(group => group.role === 'dimension' && group.id === 'd2')!.marks;
  const circleSettings = { ...settings, dimensions: circleDimensions }, circleLayout = layoutSheet(views, circleSettings);
  const circles = buildSheet(views, circleLayout, circleSettings, { title: 'Circle control', date: '2026-11-01' });
  cases.push({ id, standard, dual, settings, layout, sheet, marks, circles, circleLayout });
}
if (process.env.LINEAR_CLEARANCE_NATIVE_OUT) writeFileSync(process.env.LINEAR_CLEARANCE_NATIVE_OUT, JSON.stringify({ ...starterDoc(), drawing: cases[0].settings }));
const controls = Object.fromEntries(cases.map(c => [c.id, {
  geometry: hash(c.marks.filter(mark => mark.kind !== 'text' && !(mark.kind === 'line' && mark.role === 'leader'))),
  textPayload: hash(c.marks.filter(mark => mark.kind === 'text').map(({ at: _at, ...text }) => { void _at; return text; })),
  circleMarks: hash(c.circles.groups.filter(group => group.role === 'dimension')),
  circleDxf: ['AC1015', 'AC1009'].map(version => hash(sheetDxf(c.circles, c.circleLayout, version as 'AC1015' | 'AC1009').text)),
}]));
const controlFile = join(import.meta.dirname, 'fixtures/drawing-linear-clearance-controls.json');
if (process.env.UPDATE_LINEAR_CLEARANCE_CONTROLS) writeFileSync(controlFile, JSON.stringify(controls, null, 2) + '\n');
for (const c of cases) {
  test(`${c.id}: short linear text bounds clear own extensions, dimension segments, arrows and views without changing authored data`, () => {
    const texts = c.marks.filter((mark): mark is Extract<Mark, { kind: 'text' }> => mark.kind === 'text');
    const heads = c.marks.filter((mark): mark is Extract<Mark, { kind: 'fill' }> => mark.kind === 'fill' && !!mark.head);
    assert.equal(heads.length, 2);
    for (const text of texts) {
      const box = textCorners(text.at, text.text, text.size, text.anchor, text.angle ?? 0, !!text.bold);
      for (const head of heads) assert.equal(overlaps(box, head.points), false, `${text.text}: text bound intersects arrow`);
      for (const m of c.marks) if (m.kind === 'line') assert.equal(segmentHitsQuad(m.a, m.b, box, 0), false, `${text.text}: own ${m.role}`);
      for (const id of ['front', 'top', 'right', 'iso'] as const) {
        const v = c.layout.views[id]; if (v.hidden) continue;
        const [x0, y0, x1, y1] = v.box;
        assert.equal(overlaps(box, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), false, `${text.text}: view ${id}`);
      }
    }
    assert.deepEqual(c.settings.dimensions, [dimension]);
    const resolved = c.sheet.dimensions[0]; assert.ok(resolved.ok); assert.equal(resolved.value, 8);
    assert.deepEqual(resolved.dim, dimension);
  });
}
test('fixed line/arrow geometry, numeric payloads and circle controls retain exact output; collided linear positions are not byte controls', () => {
  assert.deepEqual(controls, JSON.parse(readFileSync(controlFile, 'utf8')));
});

// Independent behavior oracles use the public primitive renderer as the pre-pass baseline.
function rectangleViews(size: number) {
  const evaluated = brepsFor(rectanglePart(size, size, size)); assert.ok('breps' in evaluated);
  const p = projectViews(evaluated.breps, evaluated.prefixes); assert.ok(p.ok); return p.views;
}
const smallViews = rectangleViews(8), squareViews = rectangleViews(50);
function pointRef(v: typeof views, x: number, y: number) { const p = snapPoints(v.front).find(p => Math.abs(p.at[0] - x) < 1e-9 && Math.abs(p.at[1] - y) < 1e-9); assert.ok(p); return p.ref; }
function scene(v: typeof views, settings: DrawingSettings) {
  const layout = layoutSheet(v, settings), sheet = buildSheet(v, layout, settings, { title: 'Behavior', date: '2026-11-01' });
  const r = sheet.dimensions[0]; assert.ok(r.ok);
  const raw = dimensionMarks(layout.views.front, r, presetFor(settings)); if (r.dim.basic) raw.push(...basicBox(raw));
  const group = sheet.groups.find(g => g.role === 'dimension' && g.id === r.dim.id)!;
  return { layout, sheet, raw, group, r };
}
function fixedMarks(marks: readonly Mark[]) { return marks.filter(m => m.kind !== 'text' && !(m.kind === 'polyline' && m.role === 'frame') && !(m.kind === 'line' && m.role === 'leader')); }
function textMarks(marks: readonly Mark[]) { return marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text'); }
function assertOwnClear(marks: readonly Mark[]) {
  for (const m of textMarks(marks)) {
    const box = textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold);
    for (const fixed of fixedMarks(marks)) {
      if (fixed.kind === 'line') assert.equal(segmentHitsQuad(fixed.a, fixed.b, box, 0), false, `text ${m.text} over ${fixed.role}`);
      else if (fixed.kind === 'fill') assert.equal(overlaps(box, fixed.points), false, `text ${m.text} over head`);
    }
  }
}
for (const orient of ['horizontal', 'vertical', 'aligned'] as const) for (const reverse of [false, true]) for (const scale of [0.5, 1, 2]) {
  test(`${orient} reversed=${reverse} scale=${scale}: deterministic candidate, fixed geometry and authored quantities`, () => {
    const a = pointRef(smallViews, 0, 0), b = orient === 'horizontal' ? pointRef(smallViews, 8, 0) : orient === 'vertical' ? pointRef(smallViews, 0, 8) : pointRef(smallViews, 8, 8);
    const d: DrawingDimension = { id: 'short', kind: 'linear', view: 'front', orient, a: reverse ? b : a, b: reverse ? a : b, place: orient === 'horizontal' ? [4, -12] : orient === 'vertical' ? [20, 4] : [20, -12], tol: { kind: 'deviation', upper: 0.05, lower: -0.1 } };
    const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale, units: 'inch', dual: true };
    const before = structuredClone(settings), s = scene(smallViews, settings), again = scene(smallViews, settings);
    assert.deepEqual(settings, before); assert.deepEqual(s.r.dim, d);
    assert.deepEqual(fixedMarks(s.group.marks), fixedMarks(s.raw));
    assert.deepEqual(s.group.marks, again.group.marks);
    if (orient === 'horizontal' || (orient === 'aligned' && scale >= 1)) {
      // A label-only endpoint candidate is insufficient: its straight connector is blocked by fixed geometry.
      assert.deepEqual(s.group.marks, s.raw);
      assert.ok(drawingIssues({ views: smallViews, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id)));
    } else assertOwnClear(s.group.marks);
  });
}
test('long safe aligned 45-degree original stays byte-identical and has no false own-line issue', () => {
  const d: DrawingDimension = { id: 'diagonal', kind: 'linear', view: 'front', orient: 'aligned', a: pointRef(squareViews, 0, 0), b: pointRef(squareViews, 50, 50), place: [-20, 70] };
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1 }, s = scene(squareViews, settings);
  assert.deepEqual(s.group.marks, s.raw);
  assertOwnClear(s.group.marks);
  const issues = drawingIssues({ views: squareViews, settings, layout: s.layout, sheet: s.sheet, callout: () => null });
  assert.equal(issues.some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id)), false);
});
test('long safe horizontal original stays byte-identical', () => {
  const d: DrawingDimension = { id: 'long', kind: 'linear', view: 'front', orient: 'horizontal', a: at(0, 0), b: at(64, 0), place: [32, -12], tol: { kind: 'symmetric', value: 0.1 } };
  const s = scene(views, { ...defaultDrawing(), dimensions: [d], scale: 1 }); assert.deepEqual(s.group.marks, s.raw);
});
function markCoordinates(m: Mark): readonly XY[] {
  if (m.kind === 'text') return [m.at]; if (m.kind === 'line') return [m.a, m.b];
  if (m.kind === 'arc') return [m.center]; if (m.kind === 'hatch') return m.rings.flat(); return m.points;
}
function assertTranslated(before: readonly Mark[], after: readonly Mark[], delta: readonly number[]) {
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    const a = markCoordinates(before[i]), b = markCoordinates(after[i]); assert.equal(b.length, a.length);
    for (let j = 0; j < a.length; j++) for (const k of [0, 1]) assert.ok(Math.abs(b[j][k] - a[j][k] - delta[k]) < 1e-10);
  }
}
test('basic box and source-attached frame move atomically; datum and standalone frame stay fixed', () => {
  const edge = views.front.edges.find(e => e.ends && e.pieces.some(p => p.visible))!;
  const settings: DrawingSettings = { ...defaultDrawing(), scale: 1, dimensions: [{ ...dimension, basic: true }], datums: [{ id: 'datum', letter: 'A', view: 'front', edge: { edge: edge.name, near: [...edge.ends![0]] as [number, number, number] }, place: [-14, -14] }], frames: [{ id: 'attached', dim: 'd2', characteristic: 'flatness', value: 0.1, datums: [] }, { id: 'standalone', view: 'front', place: [8, -25], characteristic: 'flatness', value: 0.2, datums: [] }] };
  const s = scene(views, settings), oldText = textMarks(s.raw)[0], newText = textMarks(s.group.marks)[0], delta = [newText.at[0] - oldText.at[0], newText.at[1] - oldText.at[1]];
  assert.ok(Math.hypot(...delta) > 1);
  const oldMoving = s.raw.filter(m => m.kind === 'text' || m.kind === 'polyline'), newMoving = s.group.marks.filter(m => m.kind === 'text' || m.kind === 'polyline');
  assertTranslated(oldMoving, newMoving, delta); assert.deepEqual(fixedMarks(s.group.marks), fixedMarks(s.raw));
  assertTranslated(frameMarks(oldText, settings.frames![0], presetFor(settings)), s.sheet.groups.find(g => g.id === 'attached')!.marks, delta);
  assert.deepEqual(s.sheet.groups.find(g => g.id === 'datum')!.marks, datumMarks(s.layout, views, settings.datums![0], presetFor(settings)));
  const independent = buildSheet(views, s.layout, { ...settings, dimensions: [] }, { title: 'Behavior', date: '2026-11-01' });
  assert.deepEqual(s.sheet.groups.find(g => g.id === 'standalone'), independent.groups.find(g => g.id === 'standalone'));
});
test('no safe corridor retains original and reports existing own-line issue without an unproved move fix', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [dimension], scale: 1, tables: [{ id: 'block', at: [10, 10], columns: [{ key: 'x', label: 'W'.repeat(180) }], rows: Array.from({ length: 45 }, () => ['blocked']) }] };
  const s = scene(views, settings); assert.deepEqual(s.group.marks, s.raw);
  const issues = drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null });
  const issue = issues.find(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes('d2')); assert.ok(issue); assert.equal(issue.fix, undefined);
});
test('zero outward direction retains original and surfaces existing typed issue', () => {
  const d = { ...dimension, place: [64, 4] as [number, number] }, settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1 }, s = scene(views, settings);
  assert.deepEqual(s.group.marks, s.raw);
  const issues = drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null });
  assert.ok(issues.some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes('d2')));
});
test('an existing ASME text gap remains fixed when an authored note overlaps it', () => {
  const d: DrawingDimension = { id: 'gap', kind: 'linear', view: 'front', orient: 'horizontal', a: at(0, 0), b: at(64, 0), place: [32, -12] };
  const base: DrawingSettings = { ...defaultDrawing(), standard: 'asme', dimensions: [d], scale: 1 }, first = scene(views, base), t = textMarks(first.raw)[0];
  assert.equal(first.raw.filter(m => m.kind === 'line' && m.role === 'dimension').length, 2);
  const settings = { ...base, notes: [{ id: 'overlap', text: 'BLOCK', at: [t.at[0] - 3, t.at[1] - 3] as [number, number] }] }, s = scene(views, settings);
  assert.deepEqual(s.group.marks, s.raw);
  assert.ok(drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).some(i => i.code === 'TEXT_OVERLAP' && i.dims?.includes('gap')));
});
test('decoration-only own collision is reported even when the nominal text clears the extension', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), scale: 1, dimensions: [{ ...dimension, basic: true }] }, s = scene(views, settings);
  const extension = s.group.marks.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'extension')!;
  const x = (extension.a[0] + extension.b[0]) / 2, y = extension.a[1];
  const border = s.group.marks.findIndex(m => m.kind === 'polyline' && m.role === 'frame');
  s.group.marks[border] = { kind: 'polyline', pen: 'thin', role: 'frame', points: [[x - 1, y - 1], [x + 1, y - 1], [x + 1, y + 1], [x - 1, y + 1], [x - 1, y - 1]] };
  assertOwnClear(s.group.marks);
  const issue = drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).find(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes('d2'));
  assert.ok(issue); assert.equal(issue.fix, undefined);
});
test('oriented safe basic bounds do not create an own-line issue after atomic placement', () => {
  const d: DrawingDimension = { id: 'basic-diagonal', kind: 'linear', view: 'front', orient: 'aligned', a: pointRef(smallViews, 0, 0), b: pointRef(smallViews, 8, 8), place: [-25, 25], basic: true };
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1, units: 'inch', precision: { inch: 3 } }, s = scene(smallViews, settings);
  assertOwnClear(s.group.marks);
  assert.equal(drawingIssues({ views: smallViews, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id)), false);
});
test('a fitting long basic box touching its own line is eligible and moves with its text', () => {
  const d: DrawingDimension = { id: 'basic-long', kind: 'linear', view: 'front', orient: 'horizontal', a: at(0, 0), b: at(64, 0), place: [32, 12], basic: true };
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1 }, s = scene(views, settings);
  const a = textMarks(s.raw)[0], b = textMarks(s.group.marks)[0], delta = [b.at[0] - a.at[0], b.at[1] - a.at[1]];
  assert.ok(Math.hypot(...delta) > 1); assertTranslated(s.raw.filter(m => m.kind === 'text' || m.kind === 'polyline'), s.group.marks.filter(m => m.kind === 'text' || m.kind === 'polyline'), delta);
  assert.deepEqual(fixedMarks(s.group.marks), fixedMarks(s.raw)); assertOwnClear(s.group.marks);
});
for (const units of ['mm', 'inch'] as const) test(`ASME dual ${units}: blocked outward-only candidate uses an endpoint corridor`, () => {
  const c = cases.find(c => c.id === `asme-${units}-dual`)!, r = c.sheet.dimensions[0]; assert.ok(r.ok);
  const raw = dimensionMarks(c.layout.views.front, r, presetFor(c.settings)), before = textMarks(raw)[0], after = textMarks(c.marks)[0];
  // Outward is horizontal here. A nonzero vertical shift proves the accepted candidate is an endpoint corridor.
  assert.ok(Math.abs(after.at[1] - before.at[1]) > 1);
  assertOwnClear(c.marks); assert.deepEqual(fixedMarks(c.marks), fixedMarks(raw));
});
test('near-line safe rotated basic payload uses its polygon rather than its Cartesian envelope', () => {
  const d: DrawingDimension = { id: 'near-diagonal', kind: 'linear', view: 'front', orient: 'aligned', a: pointRef(squareViews, 0, 0), b: pointRef(squareViews, 50, 50), place: [-20, 70], basic: true };
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1 }, s = scene(squareViews, settings);
  // Independent source-owned basic box translated 1 mm away from the own line: its quad clears the stroke,
  // while the Cartesian envelope still intersects the long diagonal segment's envelope.
  const diagonal = -Math.SQRT1_2, delta = [diagonal, diagonal];
  const moving = structuredClone(s.raw);
  for (const m of moving) {
    if (m.kind === 'text') m.at = [m.at[0] + delta[0], m.at[1] + delta[1]];
    else if (m.kind === 'polyline') m.points = m.points.map(p => [p[0] + delta[0], p[1] + delta[1]]);
  }
  s.group.marks = moving; assertOwnClear(moving);
  assert.equal(drawingIssues({ views: squareViews, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id)), false);
});
test('round-cap-only overlap of a fixed own segment reports the existing line issue', () => {
  const d: DrawingDimension = { id: 'cap', kind: 'linear', view: 'front', orient: 'horizontal', a: at(0, 0), b: at(64, 0), place: [32, -12] }, settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1 }, s = scene(views, settings);
  const t = textMarks(s.group.marks)[0], q = textCorners(t.at, t.text, t.size, t.anchor, t.angle ?? 0, !!t.bold), x = q[0][0], y = (q[0][1] + q[3][1]) / 2;
  const index = s.group.marks.findIndex(m => m.kind === 'line' && m.role === 'extension');
  const cap: Mark = { kind: 'line', a: [x - 5, y], b: [x - 0.05, y], role: 'extension', pen: 'thin' }; s.group.marks[index] = cap;
  assert.equal(segmentHitsQuad(cap.a, cap.b, q, 0), false); // The centerline alone is clear.
  const issue = drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).find(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id));
  assert.ok(issue); assert.equal(issue.fix, undefined);
});
test('fixed datum leader crossing a retained linear payload is surfaced without an own-line clash', () => {
  const d: DrawingDimension = { id: 'leader', kind: 'linear', view: 'front', orient: 'horizontal', a: at(0, 0), b: at(64, 0), place: [32, -12] }, settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1 }, s = scene(views, settings);
  assertOwnClear(s.group.marks);
  const t = textMarks(s.group.marks)[0], q = textCorners(t.at, t.text, t.size, t.anchor, t.angle ?? 0, !!t.bold), x = (q[0][0] + q[1][0]) / 2, y = (q[0][1] + q[3][1]) / 2;
  // No datum text box: only its fixed leader intersects, which the former text-only issue scan missed.
  s.sheet.groups.push({ role: 'datum', id: 'fixed-leader', view: 'front', marks: [{ kind: 'line', a: [x, y - 5], b: [x, y + 5], pen: 'thin', role: 'leader' }] });
  const issue = drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).find(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id));
  assert.ok(issue); assert.equal(issue.fix, undefined);
});

function connectors(marks: readonly Mark[]) { return marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'leader'); }
function strokeQuad(m: Extract<Mark, { kind: 'line' }>, trim = 0) {
  const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length, h = 0.125;
  const a = [m.a[0] + ux * (trim - h), m.a[1] + uy * (trim - h)], b = [m.b[0] + ux * h, m.b[1] + uy * h];
  return [[a[0] - uy * h, a[1] + ux * h], [b[0] - uy * h, b[1] + ux * h], [b[0] + uy * h, b[1] - ux * h], [a[0] + uy * h, a[1] - ux * h]];
}
for (const c of cases) test(`${c.id}: connector exists only for endpoint fallback and exports as one extra derived LINE`, () => {
  const lines = connectors(c.marks), expected = c.standard === 'asme' && c.dual ? 1 : 0;
  assert.equal(lines.length, expected);
  if (!lines.length) return;
  const line = lines[0]; assert.equal(c.marks.at(-1), line); assert.equal(line.pen, 'thin');
  const heads = c.marks.filter((m): m is Extract<Mark, { kind: 'fill' }> => m.kind === 'fill' && !!m.head);
  assert.ok(heads.some(h => JSON.stringify(h.head!.tip) === JSON.stringify(line.a)));
  assert.ok(Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1]) > 0.625);
  const full = strokeQuad(line), tail = strokeQuad(line, 0.5);
  for (const text of textMarks(c.marks)) assert.equal(overlaps(full, textCorners(text.at, text.text, text.size, text.anchor, text.angle ?? 0, !!text.bold)), false);
  // All own fixed primitives are screened outside the intentional shared terminal.
  for (const m of fixedMarks(c.marks)) {
    if (m.kind === 'line') assert.equal(overlaps(tail, strokeQuad(m)), false);
    else if (m.kind === 'fill') assert.equal(overlaps(tail, m.points), false);
  }
  for (const version of ['AC1009', 'AC1015'] as const) {
    const doc = sheetDxfDocument(c.sheet, c.layout, version), native = doc.entities.find(e => e.type === 'dimension'); assert.ok(native && native.type === 'dimension');
    const blockLines = native.block.filter(e => e.type === 'line'); assert.equal(blockLines.length, 4);
    const end = blockLines.at(-1)!; assert.ok(end.type === 'line');
    assert.deepEqual(end.a, [line.a[0], c.sheet.size[1] - line.a[1]]); assert.deepEqual(end.b, [line.b[0], c.sheet.size[1] - line.b[1]]);
    assert.equal(native.measurement, 8);
  }
  const issues = drawingIssues({ views, settings: c.settings, layout: c.layout, sheet: c.sheet, callout: () => null });
  assert.equal(issues.some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes('d2')), false);
});
test('blocked straight connector declines the formerly detached horizontal fallback and keeps the existing issue', () => {
  const d: DrawingDimension = { id: 'blocked-connector', kind: 'linear', view: 'front', orient: 'horizontal', a: pointRef(smallViews, 0, 0), b: pointRef(smallViews, 8, 0), place: [4, -12], tol: { kind: 'deviation', upper: 0.05, lower: -0.1 } };
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d], scale: 1, units: 'inch', dual: true }, s = scene(smallViews, settings);
  assert.deepEqual(s.group.marks, s.raw); assert.equal(connectors(s.group.marks).length, 0);
  const issue = drawingIssues({ views: smallViews, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).find(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes(d.id));
  assert.ok(issue); assert.equal(issue.fix, undefined);
});
test('endpoint connector associates the whole basic and attached-frame cluster without detaching its frame', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), scale: 1, standard: 'asme', units: 'inch', dual: true, dimensions: [{ ...dimension, basic: true }], frames: [{ id: 'connected-frame', dim: 'd2', characteristic: 'flatness', value: 0.1, datums: [] }] }, s = scene(views, settings);
  const old = textMarks(s.raw)[0], shown = textMarks(s.group.marks)[0], delta = [shown.at[0] - old.at[0], shown.at[1] - old.at[1]], lines = connectors(s.group.marks);
  assert.equal(lines.length, 1);
  assert.deepEqual(fixedMarks(s.group.marks), fixedMarks(s.raw));
  assertTranslated(s.raw.filter(m => m.kind === 'text' || m.kind === 'polyline'), s.group.marks.filter(m => m.kind === 'text' || m.kind === 'polyline'), delta);
  const control = s.sheet.groups.find(g => g.id === 'connected-frame')!;
  assertTranslated(frameMarks(old, settings.frames![0], presetFor(settings)), control.marks, delta);
  const full = strokeQuad(lines[0]);
  for (const m of [...s.group.marks, ...control.marks]) if (m.kind === 'text') assert.equal(overlaps(full, textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold)), false);
  assert.equal(drawingIssues({ views, settings, layout: s.layout, sheet: s.sheet, callout: () => null }).some(i => i.code === 'TEXT_OVER_LINES' && i.dims?.includes('d2')), false);
});
for (const units of ['mm', 'inch'] as const) test(`ASME dual ${units}: reversing authored endpoints preserves the successful connector geometry`, () => {
  const original = cases.find(c => c.id === `asme-${units}-dual`)!, d: DrawingDimension = { ...dimension, a: dimension.b, b: dimension.a };
  const settings = { ...original.settings, dimensions: [d] }, reversed = scene(views, settings);
  assert.deepEqual(textMarks(reversed.group.marks), textMarks(original.marks));
  assert.deepEqual(connectors(reversed.group.marks), connectors(original.marks));
  assert.equal(connectors(reversed.group.marks).length, 1);
  assert.deepEqual(reversed.r.dim, d);
});
