import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ProjectedCurve } from '@barocss/cad';
import { brepsFor } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { fromSheet, layoutSheet, toSheet } from '../src/drawing/views';
import { buildSheet, type Mark } from '../src/drawing/sheet';
import { backThroughBreaks, clipCurveOutside, clipRingsOutside, readBreaks, suggestBreak, throughBreaks, viewBreaksOf, type ViewBreak } from '../src/drawing/breaks';
import { applyFix, drawingIssues, issueContext } from '../src/drawing/issues';
import { defaultDrawing, readDrawing, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import { checkManufacturingDrawing } from '../src/drawing/options';
import { runDrawingTool } from '../src/chat/drawing';
import { sheetDxf } from '../src/io/dxf';

// CG5 DR-2: broken views. Oracles: the band's sides on lines and arcs in closed form; a 500 × 20 × 20 bar (a Ø8 hole at
// X 450) broken from X 100 to 400 at 1:2 — its views 0.5·(500 − 300) + 6 = 106 mm long, every point past the break at
// 0.5·(x − 300) + 6 from the view's left, by hand.

const bar = (): StudioDoc => withNode(rectanglePart(500, 20, 20), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [450, 10], radius: 4 });
const viewsOf = (doc: StudioDoc): DrawingViews => {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.views;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const META = { title: 'bar', date: '2026-10-24' };
const BROKEN: DrawingSettings = { ...defaultDrawing(), scale: 0.5, breaks: [{ axis: 'x', from: 100, to: 400 }] };

test('a coordinate through breaks: shifted back past a band less its gap, the band squeezed to the gap, and back again', () => {
  const b: ViewBreak[] = [{ axis: 0, from: 100, to: 400, gap: 12 }, { axis: 0, from: 450, to: 480, gap: 12 }];
  assert.equal(throughBreaks(b, 0, 50), 50);
  assert.equal(throughBreaks(b, 0, 100), 100);
  assert.equal(throughBreaks(b, 0, 400), 112);
  assert.equal(throughBreaks(b, 0, 250), 106);
  assert.equal(throughBreaks(b, 0, 470), 470 - 288 - (470 - 450) * (1 - 12 / 30));
  assert.equal(throughBreaks(b, 0, 500), 500 - 288 - 18);
  assert.equal(throughBreaks(b, 1, 500), 500, 'the other axis untouched');
  for (const w of [0, 99, 100, 150, 399.5, 400, 420, 455, 480, 600]) assert.ok(near(backThroughBreaks(b, 0, throughBreaks(b, 0, w)), w, 1e-9), String(w));
});

test('curves outside a band: a line split at the band’s sides; a circle’s arcs at ±π/3 and ±2π/3 in closed form; rings split in two', () => {
  const band: ViewBreak = { axis: 0, from: -5, to: 5, gap: 1 };
  const parts = clipCurveOutside({ kind: 'line', a: [-10, 1], b: [10, 1] }, band) as Extract<ProjectedCurve, { kind: 'line' }>[];
  assert.deepEqual(parts.map(p => [p.a[0], p.b[0]]), [[-10, -5], [5, 10]]);
  // (x = 10 cos t: 5 at ±π/3, −5 at ±2π/3; outside the band where |cos t| ≥ ½.)
  const arcs = clipCurveOutside({ kind: 'arc', center: [0, 0], u: [10, 0], v: [0, 10], t0: 0, t1: 2 * Math.PI }, band) as Extract<ProjectedCurve, { kind: 'arc' }>[];
  const want = [[0, Math.PI / 3], [2 * Math.PI / 3, 4 * Math.PI / 3], [5 * Math.PI / 3, 2 * Math.PI]];
  assert.equal(arcs.length, 3); arcs.forEach((a, i) => assert.ok(near(a.t0, want[i][0], 1e-14) && near(a.t1, want[i][1], 1e-14), JSON.stringify(a)));
  // (An ellipse's sides too: x = 20 cos t against ±5.)
  const e = clipCurveOutside({ kind: 'arc', center: [0, 0], u: [20, 0], v: [0, 3], t0: 0, t1: Math.PI }, band) as Extract<ProjectedCurve, { kind: 'arc' }>[];
  assert.ok(near(e[0].t1, Math.acos(0.25), 1e-14) && near(e[1].t0, Math.acos(-0.25), 1e-14));
  const r = clipRingsOutside([[[-10, 0], [10, 0], [10, 2], [-10, 2]]], [band]);
  assert.deepEqual(r.kept, [0, 0]);
  assert.deepEqual(r.rings.map(x => [Math.min(...x.map(p => p[0])), Math.max(...x.map(p => p[0]))]), [[-10, -5], [5, 10]]);
});

test('saved breaks kept when valid; set_drawing’s check refuses a reversed or overlapping one', () => {
  assert.deepEqual(readDrawing({ breaks: [{ axis: 'x', from: 1, to: 2 }, { axis: 'x', from: 1.5, to: 3 }, { axis: 'w', from: 0, to: 1 }, { axis: 'z', from: 2, to: 1 }] }).breaks, [{ axis: 'x', from: 1, to: 2 }]);
  assert.equal(readBreaks([]), null);
  assert.match(checkManufacturingDrawing({ breaks: [{ axis: 'x', from: 2, to: 1 }] })[0].message, /from < to/);
  assert.match(checkManufacturingDrawing({ breaks: [{ axis: 'x', from: 0, to: 10 }, { axis: 'x', from: 10, to: 20 }] })[0].message, /overlaps/);
  assert.deepEqual(checkManufacturingDrawing({ breaks: [{ axis: 'x', from: 0, to: 10 }, { axis: 'y', from: 0, to: 10 }] }), []);
});

test('the bar broken from X 100 to 400 at 1:2: the front and top views 106 mm long and in projection, the right view whole; the hole at 0.5·(450 − 300) + 6', () => {
  const v = viewsOf(bar()), layout = layoutSheet(v, BROKEN), { front, top, right } = layout.views;
  assert.ok(near(front.box[2] - front.box[0], 106) && near(top.box[2] - top.box[0], 106), `${front.box} ${top.box}`);
  assert.equal(right.breaks, undefined); assert.ok(near(right.box[2] - right.box[0], 10));
  // (The front's X runs across: the gap is 6 sheet mm, 12 model mm at 1:2.)
  assert.deepEqual(front.breaks, [{ axis: 0, from: 100, to: 400, gap: 12 }]);
  for (const x of [0, 50, 100, 400, 450, 500]) {
    const want = front.box[0] + (x <= 100 ? 0.5 * x : 0.5 * (x - 300) + 6);
    assert.ok(near(toSheet(front, [x, 0])[0], want), `front ${x}`);
    assert.ok(near(toSheet(top, [x, 0])[0], want), `top ${x}: in projection with the front`);
    assert.ok(near(fromSheet(front, toSheet(front, [x, 7]))[0], x) && near(fromSheet(front, toSheet(front, [x, 7]))[1], 7));
  }
  const sheet = buildSheet(v, layout, BROKEN, META);
  const g = sheet.groups.find(x => x.role === 'view' && x.view === 'front')!;
  // The top edge Z 20 in two pieces, X 0–100 and 400–500, drawn 50 and 50 mm with the 6 mm gap between.
  const y20 = toSheet(front, [0, 20])[1];
  const top20 = g.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'visible' && near(m.a[1], y20) && near(m.b[1], y20)).map(m => [Math.min(m.a[0], m.b[0]) - front.box[0], Math.max(m.a[0], m.b[0]) - front.box[0]]).sort((a, b) => a[0] - b[0]);
  assert.equal(top20.length, 2); assert.ok(near(top20[0][0], 0) && near(top20[0][1], 50) && near(top20[1][0], 56) && near(top20[1][1], 106), JSON.stringify(top20));
  // Break lines at both sides of the gap, across the view.
  const lines = g.marks.filter((m): m is Extract<Mark, { kind: 'polyline' }> => m.kind === 'polyline' && m.pen === 'thin');
  assert.deepEqual(lines.map(m => +(m.points[0][0] - front.box[0]).toFixed(9)), [50, 56]);
  assert.ok(lines.every(m => m.points[0][1] < front.box[1] && m.points.at(-1)![1] > front.box[3]));
  // The hole's circle in the top view, past the break.
  const t = sheet.groups.find(x => x.role === 'view' && x.view === 'top')!, c = t.marks.find((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc' && near(Math.hypot(m.u[0], m.u[1]), 2))!;
  assert.ok(c && near(c.center[0] - top.box[0], 81), JSON.stringify(c?.center));
});

test('a dimension across the break reads 500 and is drawn 106 long; the break lets Auto take 1:1 where the whole bar takes 1:5', () => {
  const v = viewsOf(bar()), e = v.front.edges.find(x => x.kind === 'line' && x.ends && near(x.ends[0][2], 20) && near(x.ends[1][2], 20) && near(Math.abs(x.ends[0][0] - x.ends[1][0]), 500))!;
  assert.ok(e, 'the front view’s top edge');
  const settings: DrawingSettings = { ...BROKEN, dimensions: [{ id: 'd1', view: 'front', kind: 'linear', a: { edge: e.name, at: 'end', near: [0, 0, 20] }, b: { edge: e.name, at: 'end', near: [500, 0, 20] }, orient: 'horizontal', place: [250, 40] }] };
  const layout = layoutSheet(v, settings), sheet = buildSheet(v, layout, settings, META), r = sheet.dimensions[0];
  assert.ok(r.ok && near(r.value, 500) && r.text === '500', JSON.stringify(r));
  const tips = sheet.groups.find(x => x.role === 'dimension' && x.id === 'd1')!.marks.filter((m): m is Extract<Mark, { kind: 'fill' }> => m.kind === 'fill' && !!m.head).map(m => m.head!.tip[0]);
  assert.equal(tips.length, 2); assert.ok(near(Math.abs(tips[0] - tips[1]), 106), String(tips));
  // (Without the isometric view, which is never broken: on A4, 500·s + 20·s + 22 ≤ 249 gives 1:5 whole; broken,
  // 200·s + 6 + 20·s + 22 ≤ 249 lets 1:1 fit.)
  const auto = (s: DrawingSettings) => { const x: DrawingSettings = { ...s, views: ['front', 'top', 'right'] }; delete x.scale; return layoutSheet(v, x); };
  const whole = auto(defaultDrawing()), broken = auto(BROKEN);
  assert.equal(whole.scale, 0.2); assert.equal(broken.scale, 1); assert.ok(broken.fits);
});

test('a section of the broken front is broken too: its cut face in two parts, in projection with the view', () => {
  const v = viewsOf(bar());
  const section = { id: 'A', view: 'front' as const, at: 10, projection: v.front, rings: [[[0, 0], [500, 0], [500, 20], [0, 20]]] as [number, number][][] };
  const settings: DrawingSettings = { ...BROKEN, sheet: 'A3', section: { y: 10 } };
  const layout = layoutSheet(v, settings, [{ id: 'A', view: 'front', min: v.front.min, max: v.front.max }]);
  const p = layout.sections![0];
  assert.deepEqual(p.breaks, layout.views.front.breaks); assert.ok(near(p.box[2] - p.box[0], 106));
  const sheet = buildSheet(v, layout, settings, META, [section]), g = sheet.groups.find(x => x.role === 'section' && x.marks.some(m => m.kind === 'hatch'))!;
  const h = g.marks.find((m): m is Extract<Mark, { kind: 'hatch' }> => m.kind === 'hatch')!, placed = sheet.sections![0].placement;
  assert.deepEqual(h.rings.map(r => [Math.min(...r.map(q => q[0])) - placed.box[0], Math.max(...r.map(q => q[0])) - placed.box[0]].map(x => +x.toFixed(9))), [[0, 50], [56, 106]]);
});

test('a break that misses the part is a warning whose fix removes it; the agent adds one, and an overlapping one is refused', () => {
  const v = viewsOf(bar()), ctx = issueContext({ views: v, settings: { ...defaultDrawing(), breaks: [{ axis: 'x', from: 1000, to: 1100 }] }, callout: () => null, meta: META });
  const x = drawingIssues(ctx).find(i => i.code === 'BREAK_NO_VIEW')!;
  assert.ok(x && x.severity === 'warning'); assert.equal(applyFix(ctx, x.fix!).breaks, undefined);
  assert.deepEqual(viewBreaksOf(v.right, [{ axis: 'x', from: 100, to: 400 }]), [], 'the right view looks along X');
  assert.deepEqual(suggestBreak(v as never), { axis: 'x', from: 167, to: 333 });
  const r = runDrawingTool(bar(), 'set_drawing', { breaks: [{ axis: 'x', from: 100, to: 400 }] });
  assert.ok(!('error' in r), JSON.stringify(r)); if ('error' in r) return;
  assert.deepEqual(readDrawing(r.doc.drawing).breaks, [{ axis: 'x', from: 100, to: 400 }]);
  const bad = runDrawingTool(bar(), 'set_drawing', { breaks: [{ axis: 'x', from: 100, to: 400 }, { axis: 'x', from: 300, to: 450 }] });
  assert.ok('error' in bad && /DRAWING_OPTIONS/.test(bad.error));
});

test('written: the broken front’s edge pieces read back by ezdxf at their shifted places', () => {
  const v = viewsOf(bar()), layout = layoutSheet(v, BROKEN), sheet = buildSheet(v, layout, BROKEN, META), dxf = sheetDxf(sheet, layout);
  const py = join(homedir(), '.cache/barocss-ezdxf/bin/python'), script = resolve(import.meta.dirname, '../../barocss-cad/scripts/dxf-oracle.py');
  if (!existsSync(py)) { console.log('ezdxf not installed at ~/.cache/barocss-ezdxf: the read-back is skipped'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'dr2-')), file = join(dir, 'broken.dxf');
  writeFileSync(file, dxf.bytes);
  const o = JSON.parse(execFileSync(py, ['-I', script, file], { encoding: 'utf8' }));
  rmSync(dir, { recursive: true, force: true });
  const H = 210, f = layout.views.front, y = H - toSheet(f, [0, 20])[1], lines = entitiesOf(o, []).filter(e => e.type === 'LINE');
  const has = (x0: number, x1: number) => lines.some(e => { const a = e.a as number[], b = e.b as number[]; return near(a[1], y, 1e-6) && near(b[1], y, 1e-6) && near(Math.min(a[0], b[0]), f.box[0] + x0, 1e-6) && near(Math.max(a[0], b[0]), f.box[0] + x1, 1e-6); });
  assert.ok(has(0, 50) && has(56, 106), 'the top edge’s two pieces');
  assert.ok(!has(0, 106) && !has(0, 250), 'no whole edge');
});

function entitiesOf(x: unknown, out: Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(x)) { for (const y of x) entitiesOf(y, out); return out; }
  if (x && typeof x === 'object') { if ('type' in x) out.push(x as Record<string, unknown>); for (const y of Object.values(x)) entitiesOf(y, out); }
  return out;
}
