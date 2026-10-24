import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ProjectedCurve } from '@barocss/cad';
import { brepsFor } from '../src/engine/evaluate';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { layoutSheet, toSheet } from '../src/drawing/views';
import { buildSheet, type Mark, type Sheet } from '../src/drawing/sheet';
import { arcCrossings, clipCurveToDisk, clipProjectionToDisk, clipRingsToDisk, detailScale, segmentInDisk } from '../src/drawing/detail';
import { applyFix, drawingIssues, issueContext } from '../src/drawing/issues';
import { reorient } from '../src/drawing/reorient';
import { defaultDrawing, readDrawing, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import { checkManufacturingDrawing, withManufacturingDrawing } from '../src/drawing/options';
import { runDrawingTool } from '../src/chat/drawing';
import { sheetSvg } from '../src/io/svg';
import { sheetPdf } from '../src/io/pdf';
import { sheetDxf } from '../src/io/dxf';

// CG5 DR-1: detail views. Oracles: the circle crossings of lines, circular arcs and ellipses in closed form; the
// starter plate's (64 × 32 × 8, a Ø8 hole at 32, 16) edges inside a circle by hand; the inscribed polygon's area.

const viewsOf = (doc: StudioDoc, orientation?: 'x+'): DrawingViews => {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps, b.prefixes, orientation ? { orientation } : {}); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.views;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearXY = (p: readonly number[], q: readonly number[], eps = 1e-9) => near(p[0], q[0], eps) && near(p[1], q[1], eps);
const META = { title: 'plate', date: '2026-10-24' };
function sheetOf(settings: DrawingSettings, views = viewsOf(starterDoc())): { sheet: Sheet; layout: ReturnType<typeof layoutSheet>; views: DrawingViews } {
  const layout = layoutSheet(views, settings);
  return { sheet: buildSheet(views, layout, settings, META), layout, views };
}
const detailGroup = (s: Sheet, id: string) => s.groups.find(g => g.role === 'detail' && g.view === `detail:${id}`)!;
/** Every object with a `type` in ezdxf's reading (its entities, wherever the oracle's JSON nests them). */
function entitiesOf(x: unknown, out: Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(x)) { for (const y of x) entitiesOf(y, out); return out; }
  if (x && typeof x === 'object') { if ('type' in x) out.push(x as Record<string, unknown>); for (const y of Object.values(x)) entitiesOf(y, out); }
  return out;
}
const ctxFor = (settings: DrawingSettings) => issueContext({ views: viewsOf(starterDoc()), settings, callout: () => null, meta: META });

test('a segment against a circle: its inside interval from the quadratic, a tangent and a miss give none', () => {
  assert.deepEqual(segmentInDisk([-10, 0], [10, 0], [0, 0], 5), [0.25, 0.75]);
  // (y = 3 crosses x² = 16: t = (−4 + 10)/20 and (4 + 10)/20.)
  const t = segmentInDisk([-10, 3], [10, 3], [0, 0], 5)!;
  assert.ok(near(t[0], 0.3, 1e-15) && near(t[1], 0.7, 1e-15));
  assert.equal(segmentInDisk([-10, 5], [10, 5], [0, 0], 5), null);
  assert.equal(segmentInDisk([-10, 6], [10, 6], [0, 0], 5), null);
  assert.deepEqual(segmentInDisk([-1, 0], [1, 0], [0, 0], 5), [0, 1]);
  // (Starting inside: from 0 to the exit at x = 5.)
  assert.deepEqual(segmentInDisk([0, 0], [10, 0], [0, 0], 5), [0, 0.5]);
});

test('a circular arc against a circle: the crossing at π/3 in closed form; an ellipse’s four crossings at acos(±√(5/12)) to the last digits', () => {
  // (|p| = 10 and |p − (10, 0)| = 10 meet at x = 5, y = ±5√3: the upper half's arc is inside from 0 to π/3.)
  const arc: Extract<ProjectedCurve, { kind: 'arc' }> = { kind: 'arc', center: [0, 0], u: [10, 0], v: [0, 10], t0: 0, t1: Math.PI };
  const x = arcCrossings(arc, [10, 0], 10);
  assert.equal(x.length, 1); assert.ok(near(x[0], Math.PI / 3, 1e-14));
  const kept = clipCurveToDisk(arc, [10, 0], 10);
  assert.equal(kept.length, 1); assert.equal(kept[0].kind, 'arc');
  const k0 = kept[0] as typeof arc; assert.ok(near(k0.t0, 0, 1e-15) && near(k0.t1, Math.PI / 3, 1e-14));
  // (Reversed: the same piece, run backward.)
  const back = clipCurveToDisk({ ...arc, t0: Math.PI, t1: 0 }, [10, 0], 10)[0] as typeof arc;
  assert.ok(near(back.t0, Math.PI / 3, 1e-14) && near(back.t1, 0, 1e-15));
  // An ellipse 20 × 10 against r 15 about its centre: 400 cos² + 100 sin² = 225, cos² t = 5/12; inside about ±y.
  const e: typeof arc = { kind: 'arc', center: [0, 0], u: [20, 0], v: [0, 10], t0: 0, t1: 2 * Math.PI };
  const a = Math.acos(Math.sqrt(5 / 12)), want = [a, Math.PI - a, Math.PI + a, 2 * Math.PI - a];
  const got = arcCrossings(e, [0, 0], 15);
  assert.equal(got.length, 4); got.forEach((t, i) => assert.ok(near(t, want[i], 1e-12), `${t} vs ${want[i]}`));
  const pieces = clipCurveToDisk(e, [0, 0], 15) as (typeof arc)[];
  assert.equal(pieces.length, 2);
  assert.ok(near(pieces[0].t0, want[0], 1e-12) && near(pieces[0].t1, want[1], 1e-12) && near(pieces[1].t0, want[2], 1e-12) && near(pieces[1].t1, want[3], 1e-12));
});

test('a polyline against a circle: its inside runs, each cut at the crossings', () => {
  // (In at x = −3 on y = 4, out at x = 3; again on y = −4: two runs.)
  const runs = clipCurveToDisk({ kind: 'polyline', points: [[-10, 4], [10, 4], [10, -4], [-10, -4]] }, [0, 0], 5);
  assert.equal(runs.length, 2);
  const [r0, r1] = runs as Extract<ProjectedCurve, { kind: 'polyline' }>[];
  assert.ok(nearXY(r0.points[0], [-3, 4], 1e-12) && nearXY(r0.points.at(-1)!, [3, 4], 1e-12));
  assert.ok(nearXY(r1.points[0], [3, -4], 1e-12) && nearXY(r1.points.at(-1)!, [-3, -4], 1e-12));
  // (A run through a vertex inside the circle stays one run.)
  const one = clipCurveToDisk({ kind: 'polyline', points: [[-10, 0], [0, 1], [10, 0]] }, [0, 0], 5);
  assert.equal(one.length, 1); assert.equal((one[0] as Extract<ProjectedCurve, { kind: 'polyline' }>).points.length, 3);
});

test('rings clipped to a circle: a square larger than it becomes the inscribed 512-gon, its area (N/2)·r²·sin(2π/N); holes kept by index', () => {
  const N = 512, r = 5, out = clipRingsToDisk([[[-10, -10], [10, -10], [10, 10], [-10, 10]], [[100, 100], [101, 100], [101, 101]]], [0, 0], r);
  assert.deepEqual(out.kept, [0]);
  let area = 0; const p = out.rings[0];
  for (let k = 0; k < p.length; k++) { const a = p[k], b = p[(k + 1) % p.length]; area += a[0] * b[1] - b[0] * a[1]; }
  assert.ok(near(Math.abs(area) / 2, N / 2 * r * r * Math.sin(2 * Math.PI / N), 1e-9));
});

test('the default detail scale: the smallest standard scale at least twice the sheet’s', () => {
  assert.equal(detailScale({}, 1), 2); assert.equal(detailScale({}, 0.5), 1); assert.equal(detailScale({}, 0.2), 0.5);
  assert.equal(detailScale({}, 2), 5); assert.equal(detailScale({ scale: 10 }, 1), 10);
  // (Past 10:1 there is no standard one: twice.)
  assert.equal(detailScale({}, 10), 20);
});

test('a detail of the plate’s front view: the top edge from 32 to 40 and the hole’s hidden line from Z 4 to 8, exactly, at 5:1', () => {
  const v = viewsOf(starterDoc());
  // (Front: Z up; the top edge at Z 8 from X 0 to 64; the hole Ø8 at X 32 hidden from Z 0 to 8, its sides at X 28 and 36.)
  const clip = clipProjectionToDisk(v.front, [36, 8], 4);
  const pieces = clip.edges.flatMap(e => e.pieces.map(p => ({ visible: p.visible, c: p.curve })));
  const lines = pieces.filter(p => p.c.kind === 'line') as { visible: boolean; c: Extract<ProjectedCurve, { kind: 'line' }> }[];
  const top = lines.find(p => p.visible && near(p.c.a[1], 8) && near(p.c.b[1], 8))!;
  assert.ok(top, 'the top edge');
  assert.deepEqual([Math.min(top.c.a[0], top.c.b[0]), Math.max(top.c.a[0], top.c.b[0])].map(x => +x.toFixed(12)), [32, 40]);
  const side = lines.find(p => !p.visible && near(p.c.a[0], 36) && near(p.c.b[0], 36))!;
  assert.ok(side, 'the hole’s hidden side');
  assert.deepEqual([Math.min(side.c.a[1], side.c.b[1]), Math.max(side.c.a[1], side.c.b[1])].map(y => +y.toFixed(12)), [4, 8]);
  // (Nothing else of the plate is within 4 of (36, 8): the other side at X 28 is 8 away, the bottom at Z 0 is 8 away.)
  assert.equal(pieces.length, 2);
  assert.deepEqual([clip.min, clip.max], [[32, 4], [40, 12]]);
  // On the sheet: the detail's pieces at 5:1 about where it is put.
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', details: [{ id: 'B', view: 'front', center: [36, 8], radius: 4, scale: 5, at: [330, 80] }] };
  const { sheet, layout } = sheetOf(settings, v);
  const d = sheet.details![0], g = detailGroup(sheet, 'B');
  assert.equal(d.scale, 5); assert.deepEqual(d.placement.box, [310, 60, 350, 100]);
  // (The detail's point (u, v) is at (330 + 5(u − 36), 80 − 5(v − 8)).)
  const at = (u: number, w: number): [number, number] => [330 + 5 * (u - 36), 80 - 5 * (w - 8)];
  const seg = (m: Mark, a: number[], b: number[]) => m.kind === 'line' && ((nearXY(m.a, a) && nearXY(m.b, b)) || (nearXY(m.a, b) && nearXY(m.b, a)));
  assert.ok(g.marks.some(m => m.kind === 'line' && m.pen === 'visible' && seg(m, at(32, 8), at(40, 8))), 'the top edge at 5:1');
  assert.ok(g.marks.some(m => m.kind === 'line' && m.pen === 'hidden' && seg(m, at(36, 4), at(36, 8))), 'the hidden side at 5:1');
  const ring = g.marks.find(m => m.kind === 'arc' && m.pen === 'thin') as Extract<Mark, { kind: 'arc' }>;
  assert.ok(nearXY(ring.center, [330, 80]) && near(ring.u[0], 20) && near(ring.v[1], 20), 'its circle, radius 4 · 5');
  // On the front view: the circle at the sheet's scale and the letter; the name under the detail.
  const parent = sheet.groups.find(x => x.role === 'detail' && x.view === 'front')!, c = parent.marks[0] as Extract<Mark, { kind: 'arc' }>;
  assert.ok(nearXY(c.center, toSheet(layout.views.front, [36, 8])) && near(c.u[0], 4 * layout.scale));
  assert.ok(parent.marks.some(m => m.kind === 'text' && m.text === 'B'));
  assert.ok(sheet.groups.some(x => x.role === 'label' && x.marks.some(m => m.kind === 'text' && m.text === 'DETAIL B (5:1)')));
});

test('a detail of the top view: the Ø8 hole alone, a diameter dimension on it reads 8 and is drawn 40 mm across', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', details: [{ id: 'C', view: 'top', center: [32, 16], radius: 6, scale: 5 }] };
  const v = viewsOf(starterDoc());
  const hole = v.top.edges.find(e => e.kind === 'circle')!;
  settings.dimensions = [{ id: 'd1', view: 'detail:C', kind: 'diameter', edge: hole.name, near: [36, 16, 8], place: [40, 22] }];
  const { sheet } = sheetOf(settings, v), d = sheet.details![0];
  // (The plate's outline is 16 or more from (32, 16): only the hole's rims are inside — its two halves at the top, drawn,
  // and at the bottom, on the same ink and so with no pieces, kept as the parent keeps them.)
  assert.equal(d.projection.edges.length, 4);
  assert.ok(d.projection.edges.every(e => e.kind === 'circle' && near(e.circle!.radius, 4) && nearXY(e.circle!.center, [32, 16], 1e-9)));
  const drawn = d.projection.edges.flatMap(e => e.pieces); assert.equal(drawn.length, 2); assert.ok(drawn.every(p => p.visible && p.curve.kind === 'arc'));
  const r = sheet.dimensions.find(x => x.dim.id === 'd1')!;
  assert.ok(r.ok && near(r.value, 8, 1e-12) && r.text === 'Ø8', JSON.stringify(r));
  const ctr = toSheet(d.placement, [32, 16]), arrows = sheetSvg(sheet, 'p') && sheet.groups.find(g => g.role === 'dimension' && g.id === 'd1')!.marks.filter(m => m.kind === 'fill' && m.head);
  // (Each arrow's tip on the circle drawn at 5:1: 4 · 5 = 20 from its centre.)
  assert.ok(arrows.length >= 1); for (const m of arrows) { const tip = (m as Extract<Mark, { kind: 'fill' }>).head!.tip; assert.ok(near(Math.hypot(tip[0] - ctr[0], tip[1] - ctr[1]), 20, 1e-9)); }
  // Placed in free room: clear of every view, the title block and inside the frame.
  const { layout } = sheetOf(settings, v), b = d.placement.box, meets = (q: number[]) => b[0] < q[2] && q[0] < b[2] && b[1] < q[3] && q[1] < b[3];
  for (const id of ['front', 'top', 'right', 'iso'] as const) assert.ok(!meets(layout.views[id].box), id);
  assert.ok(!meets(layout.title) && b[0] >= layout.frame[0] && b[2] <= layout.frame[2] && b[1] >= layout.frame[1] && b[3] <= layout.frame[3]);
  // The issue list: clean of detail issues.
  const ctx = ctxFor(settings);
  assert.deepEqual(drawingIssues(ctx).filter(x => x.code.startsWith('DETAIL') || x.code === 'DIMENSION_LOST').map(x => x.code), []);
});

test('a detail of a section: the cut faces clipped and hatched; its parent removed, the detail is an issue with a fix that takes it and its dimensions away', () => {
  // (A section square to the front view through the hole's middle; the plate's cut face, the hole's gap in it.)
  const v = viewsOf(starterDoc());
  const ring: [number, number][][] = [[[0, 0], [28, 0], [28, 8], [0, 8]], [[36, 0], [64, 0], [64, 8], [36, 8]]];
  const section = { id: 'A', view: 'front' as const, at: 16, projection: v.front, rings: ring };
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', section: { y: 16 }, details: [{ id: 'B', view: 'section:A', center: [28, 4], radius: 3, scale: 5 }] };
  const layout = layoutSheet(v, settings, [{ id: 'A', view: 'front', min: v.front.min, max: v.front.max }]);
  const sheet = buildSheet(v, layout, settings, META, [section]), g = detailGroup(sheet, 'B');
  const h = g.marks.filter(m => m.kind === 'hatch') as Extract<Mark, { kind: 'hatch' }>[];
  assert.equal(h.length, 1); assert.equal(h[0].rings.length, 1, 'only the left ring reaches the circle');
  // (The left ring's part within 3 of (28, 4): x ≤ 28, its area half the circle's, as the inscribed polygon's half.)
  const placed = sheet.details![0].placement, back = h[0].rings[0].map(q => [(q[0] - placed.origin[0]) / 5, (placed.origin[1] - q[1]) / 5]);
  assert.ok(back.every(p => p[0] <= 28 + 1e-9));
  let area = 0; for (let k = 0; k < back.length; k++) { const a = back[k], b = back[(k + 1) % back.length]; area += a[0] * b[1] - b[0] * a[1]; }
  assert.ok(near(Math.abs(area) / 2, 256 / 2 * 9 * Math.sin(2 * Math.PI / 512), 1e-9));
  // (Sections show no hidden lines: none in the detail of one.)
  assert.ok(!g.marks.some(m => 'pen' in m && m.pen === 'hidden'));
  // Without the section, the detail has no parent: DETAIL_PARENT_MISSING, fixed by removing it and its dimension.
  const orphan: DrawingSettings = { ...settings, section: undefined, dimensions: [{ id: 'd1', view: 'detail:B', kind: 'radius', edge: 'x', near: [0, 0, 0], place: [0, 0] }] };
  delete orphan.section;
  const ctx = ctxFor(orphan), issues = drawingIssues(ctx), miss = issues.find(x => x.code === 'DETAIL_PARENT_MISSING')!;
  assert.ok(miss && miss.severity === 'error' && /section A–A is not on the sheet/.test(miss.message));
  assert.ok(issues.some(x => x.code === 'DIMENSION_LOST' && /detail B/.test(x.message)));
  const fixed = applyFix(ctx, miss.fix!);
  assert.equal(fixed.details, undefined); assert.deepEqual(fixed.dimensions, []);
});

test('an empty circle is a warning; a detail with no room is an error', () => {
  const empty = ctxFor({ ...defaultDrawing(), details: [{ id: 'B', view: 'top', center: [16, 8], radius: 2 }] });
  assert.deepEqual(drawingIssues(empty).filter(x => x.code.startsWith('DETAIL')).map(x => [x.code, x.severity]), [['DETAIL_EMPTY', 'warning']]);
  // (A 100 mm circle at 5:1 is a 1 m detail: no A4 sheet has room.)
  const big = ctxFor({ ...defaultDrawing(), details: [{ id: 'B', view: 'top', center: [32, 16], radius: 100, scale: 5 }] });
  assert.deepEqual(drawingIssues(big).filter(x => x.code.startsWith('DETAIL')).map(x => x.code), ['DETAIL_NO_ROOM']);
});

test('saved and offered details: kept when valid; set_drawing refuses bad ones, a letter a section has, a missing parent section, and changing one with dimensions', () => {
  const kept = readDrawing({ details: [{ id: 'B', view: 'top', center: [1, 2], radius: 3, scale: 4, at: [5, 6] }, { id: 'B', view: 'top', center: [0, 0], radius: 1 }, { id: 'C', view: 'iso', center: [0, 0], radius: 1 }, { id: 'D', view: 'front', center: [0, 0], radius: -1 }] });
  assert.deepEqual(kept.details, [{ id: 'B', view: 'top', center: [1, 2], radius: 3, scale: 4, at: [5, 6] }]);
  assert.equal(readDrawing({}).details, undefined);
  assert.match(checkManufacturingDrawing({ details: [{ id: 'B', view: 'top', center: [0, 0], radius: 1, extra: 1 }] })[0].message, /^\[DRAWING_OPTIONS\]/);
  assert.match(checkManufacturingDrawing({ sections: [{ id: 'B', view: 'front', at: 1 }], details: [{ id: 'B', view: 'top', center: [0, 0], radius: 1 }] })[0].message, /not a section's/);
  assert.deepEqual(checkManufacturingDrawing({ details: [{ id: 'B', view: 'section:A', center: [0, 0], radius: 1 }] }), []);
  const base: DrawingSettings = { ...defaultDrawing(), section: { y: 16 } };
  assert.throws(() => withManufacturingDrawing(base, { details: [{ id: 'A', view: 'top', center: [0, 0], radius: 1 }] }), /DRAWING_DETAIL_LETTER/);
  assert.throws(() => withManufacturingDrawing(base, { details: [{ id: 'B', view: 'section:C', center: [0, 0], radius: 1 }] }), /DRAWING_DETAIL_PARENT/);
  assert.throws(() => withManufacturingDrawing({ ...base, details: [{ id: 'B', view: 'section:A', center: [0, 0], radius: 1 }] }, { sections: [] }), /DRAWING_DETAIL_PARENT/);
  const withDim: DrawingSettings = { ...base, details: [{ id: 'B', view: 'top', center: [0, 0], radius: 1 }], dimensions: [{ id: 'd1', view: 'detail:B', kind: 'radius', edge: 'x', near: [0, 0, 0], place: [0, 0] }] };
  assert.throws(() => withManufacturingDrawing(withDim, { details: [] }), /DRAWING_DETAIL_REFERENCES/);
  // (Its scale and place may change.)
  assert.deepEqual(withManufacturingDrawing(withDim, { details: [{ id: 'B', view: 'top', center: [0, 0], radius: 1, scale: 10, at: [1, 1] }] }).details, [{ id: 'B', view: 'top', center: [0, 0], radius: 1, scale: 10, at: [1, 1] }]);
});

test('the agent’s set_drawing adds a detail and reads it back on the sheet; a bad one is refused with its code', () => {
  const doc = starterDoc();
  const r = runDrawingTool(doc, 'set_drawing', { sheet: 'A3', details: [{ id: 'B', view: 'top', center: [32, 16], radius: 6, scale: 5 }] });
  assert.ok(!('error' in r), JSON.stringify(r));
  if ('error' in r) return;
  assert.deepEqual(readDrawing(r.doc.drawing).details, [{ id: 'B', view: 'top', center: [32, 16], radius: 6, scale: 5 }]);
  assert.ok(!(r.content.issues as { code: string }[]).some(x => x.code.startsWith('DETAIL')));
  const bad = runDrawingTool(doc, 'set_drawing', { details: [{ id: 'B', view: 'section:A', center: [0, 0], radius: 1 }] });
  assert.ok('error' in bad && /DRAWING_DETAIL_PARENT/.test(bad.error));
});

test('turning the drawing to a front from +X: a detail on the front view goes with its view, its centre and dimension carried, the value kept', () => {
  const v = viewsOf(starterDoc()), turnedViews = viewsOf(starterDoc(), 'x+');
  const hole = v.top.edges.find(e => e.kind === 'circle')!;
  const settings: DrawingSettings = { ...defaultDrawing(), details: [{ id: 'B', view: 'top', center: [32, 16], radius: 6 }, { id: 'C', view: 'front', center: [36, 8], radius: 4 }], dimensions: [{ id: 'd1', view: 'detail:B', kind: 'diameter', edge: hole.name, near: [36, 16, 8], place: [40, 22] }] };
  const r = reorient(v, turnedViews, settings, 'x+');
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  // (From +X the front shows Y across and Z up; the old front (X across) is now the right view. The model point (36, ·, 8)'s new coordinates.)
  const c = r.settings.details!.find(x => x.id === 'C')!, was = v.front, now = turnedViews[c.view as 'right'];
  assert.equal(c.view, 'right');
  const q = [0, 1, 2].map(k => 36 * was.right[k] + 8 * was.up[k]);
  assert.ok(nearXY(c.center, [q[0] * now.right[0] + q[1] * now.right[1] + q[2] * now.right[2], q[0] * now.up[0] + q[1] * now.up[1] + q[2] * now.up[2]]));
  const b = r.settings.details!.find(x => x.id === 'B')!;
  assert.equal(b.view, 'top');
  const after = buildSheet(turnedViews, layoutSheet(turnedViews, r.settings), r.settings, META);
  const d1 = after.dimensions.find(x => x.dim.id === 'd1')!;
  assert.ok(d1.ok && near(d1.value, 8, 1e-12), JSON.stringify(d1));
  // The detail of the turned top view still holds the hole alone.
  assert.ok(after.details!.find(x => x.id === 'B')!.projection.edges.every(e => e.kind === 'circle' && near(e.circle!.radius, 4)));
});

test('written: the detail in the SVG and the PDF; the DXF read back by ezdxf — its circle, the clipped lines at 5:1 and the dimension’s text', () => {
  const v = viewsOf(starterDoc());
  const hole = v.top.edges.find(e => e.kind === 'circle')!;
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', details: [{ id: 'B', view: 'front', center: [36, 8], radius: 4, scale: 5, at: [330, 80] }, { id: 'C', view: 'top', center: [32, 16], radius: 6, scale: 5, at: [330, 160] }], dimensions: [{ id: 'd1', view: 'detail:C', kind: 'diameter', edge: hole.name, near: [36, 16, 8], place: [40, 22] }] };
  const { sheet, layout } = sheetOf(settings, v);
  const svg = sheetSvg(sheet, 'plate');
  assert.ok(svg.includes('<g class="detail" data-view="detail:B"') && svg.includes('>DETAIL B (5:1)<') && svg.includes('>DETAIL C (5:1)<'));
  const pdf = new TextDecoder('latin1').decode(sheetPdf(sheet, 'plate'));
  assert.ok(pdf.includes('(DETAIL B \\(5:1\\)) Tj'));
  const dxf = sheetDxf(sheet, layout);
  const py = join(homedir(), '.cache/barocss-ezdxf/bin/python'), script = resolve(import.meta.dirname, '../../barocss-cad/scripts/dxf-oracle.py');
  if (!existsSync(py)) { console.log('ezdxf not installed at ~/.cache/barocss-ezdxf: the read-back is skipped'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'dr1-')), file = join(dir, 'detail.dxf');
  writeFileSync(file, dxf.bytes);
  const o = JSON.parse(execFileSync(py, ['-I', script, file], { encoding: 'utf8' }));
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(o.audit?.errors ?? o.errors ?? [], []);
  const all = JSON.stringify(o), H = 297, flat = entitiesOf(o, []);
  // (DXF y is up: a sheet point (x, y) is (x, 297 − y).)
  const circle = flat.find(e => e.type === 'CIRCLE' && nearXY(e.center as number[], [330, H - 80], 1e-6) && near(e.radius as number, 20, 1e-6));
  assert.ok(circle, 'the detail’s circle, radius 20, at (330, 217)');
  const line = flat.find(e => e.type === 'LINE' && ((nearXY(e.a as number[], [310, H - 80], 1e-6) && nearXY(e.b as number[], [350, H - 80], 1e-6)) || (nearXY(e.b as number[], [310, H - 80], 1e-6) && nearXY(e.a as number[], [350, H - 80], 1e-6))));
  assert.ok(line, 'the top edge from X 32 to 40 at 5:1');
  assert.ok(all.includes('"DETAIL B (5:1)"') && all.includes('Ø8'), 'the name and the dimension’s text');
});
