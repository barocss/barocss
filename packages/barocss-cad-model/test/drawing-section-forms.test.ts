import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { BrepProjection, ProjectedCurve } from '@barocss/cad';
import { brepsFor } from '../src/engine/evaluate';
import { rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { sectionOf, sectionsCut } from '../src/drawing/section';
import { layoutSheet, toSheet } from '../src/drawing/views';
import { buildSheet, sectionExtents, sheetSections, type Mark, type Sheet } from '../src/drawing/sheet';
import { snapPoints } from '../src/drawing/dimensions';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { reorient } from '../src/drawing/reorient';
import { defaultDrawing, readDrawing, sameSection, sectionsOf, type DrawingSection, type DrawingSettings, type DrawingViews, type XY } from '../src/drawing/types';
import { checkManufacturingDrawing } from '../src/drawing/options';
import { runDrawingTool } from '../src/chat/drawing';
import { sheetSvg } from '../src/io/svg';
import { sheetDxf } from '../src/io/dxf';

// CG5 DR-4: removed and revolved sections. Oracles by hand:
// - a bar 100 × 10 × 20 (X, Y, Z) with a Ø6 hole along Z at (50, 5): the plane X 50 (the right view's section, at −50:
//   its depth is −X) cuts it through the hole, so its cut face is y 0–2 and 8–10 by z 0–20 (the section's own
//   coordinates are (y, z)); nothing else of the bar lies on the plane. Turned onto the front view (u = x, v = z) about
//   its trace X 50, centred on it: u = 50 + (y − 5), so the faces at u 45–47 and 53–55, z 0–20.
// - the starter plate (64 × 32 × 8, Ø8 at (32, 16)) cut by Z 4 (the top view's section, at −4): its face the 64 × 32
//   rectangle less the Ø8 circle, in the top view's coordinates (x, y). Removed at 2:1 with its centre at (300, 60) on A3:
//   the circle's centre at (300, 60), radius 8; its box 236–364 × 28–92.

const bar = (): StudioDoc => withNode(rectanglePart(100, 10, 20), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [50, 5], radius: 3 });
const viewsOf = (doc: StudioDoc): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b)); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearXY = (p: readonly number[], q: readonly number[], eps = 1e-9) => near(p[0], q[0], eps) && near(p[1], q[1], eps);
const META = { title: 'part', date: '2026-10-24' };
type Line = Extract<ProjectedCurve, { kind: 'line' }>;
const lines = (pr: BrepProjection) => pr.edges.flatMap(e => e.pieces.map(p => p.curve)).filter((c): c is Line => c.kind === 'line');
/** Each line as its sorted ends, rounded, sorted: a set to compare. */
const lineSet = (ls: readonly { a: readonly number[]; b: readonly number[] }[]) => ls.map(l => [[+l.a[0].toFixed(9), +l.a[1].toFixed(9)], [+l.b[0].toFixed(9), +l.b[1].toFixed(9)]].sort((p, q) => p[0] - q[0] || p[1] - q[1])).map(x => JSON.stringify(x)).sort();
const xs = (rings: readonly (readonly XY[])[]) => rings.map(r => [Math.min(...r.map(p => p[0])), Math.max(...r.map(p => p[0]))].map(x => +x.toFixed(9))).sort((a, b) => a[0] - b[0]);

function sheetOf(doc: StudioDoc, settings: DrawingSettings): { sheet: Sheet; layout: ReturnType<typeof layoutSheet>; views: DrawingViews } {
  const views = viewsOf(doc), cut = sheetSections(sectionsCut(doc, sectionsOf(settings)));
  const layout = layoutSheet(views, settings, sectionExtents(settings, cut));
  return { sheet: buildSheet(views, layout, settings, META, cut), layout, views };
}

test('the cut face alone: the bar at X 50 — its eight outline lines exactly, no far-side edge, no silhouette', () => {
  const full = sectionOf(bar(), -50, 'y-', 'right'), face = sectionOf(bar(), -50, 'y-', 'right', undefined, undefined, true);
  assert.ok(full.ok && face.ok); if (!full.ok || !face.ok) return;
  assert.deepEqual(xs(face.rings), [[0, 2], [8, 10]]);
  // (By hand: verticals at y 0, 2, 8, 10 over z 0–20; horizontals at z 0 and 20 over y 0–2 and 8–10.)
  const want = [[0, 0, 0, 20], [2, 0, 2, 20], [8, 0, 8, 20], [10, 0, 10, 20], [0, 0, 2, 0], [8, 0, 10, 0], [0, 20, 2, 20], [8, 20, 10, 20]].map(([a, b, c, d]) => ({ a: [a, b], b: [c, d] }));
  assert.deepEqual(lineSet(lines(face.projection)), lineSet(want));
  assert.ok(face.projection.edges.every(e => e.kind !== 'silhouette' && e.ends && e.ends.every(p => near(p[0], 50, 1e-9))), 'every kept edge on the plane X 50');
  assert.ok(full.projection.edges.length > face.projection.edges.length, 'the full section shows the far side too');
  assert.deepEqual([face.projection.min, face.projection.max], [[0, 0], [10, 20]]);
});

test('the plate’s cut face at Z 4: the rectangle and the Ø8 circle exact (arcs about (32, 16), radius 4, a whole turn)', () => {
  const face = sectionOf(starterDoc(), -4, 'y-', 'top', undefined, undefined, true);
  assert.ok(face.ok); if (!face.ok) return;
  assert.deepEqual(lineSet(lines(face.projection)), lineSet([{ a: [0, 0], b: [64, 0] }, { a: [64, 0], b: [64, 32] }, { a: [0, 32], b: [64, 32] }, { a: [0, 0], b: [0, 32] }]));
  const arcs = face.projection.edges.flatMap(e => e.pieces.map(p => p.curve)).filter((c): c is Extract<ProjectedCurve, { kind: 'arc' }> => c.kind === 'arc');
  assert.ok(arcs.length >= 1 && arcs.every(c => nearXY(c.center, [32, 16]) && near(Math.hypot(c.u[0], c.u[1]), 4) && near(Math.hypot(c.v[0], c.v[1]), 4) && near(c.u[0] * c.v[0] + c.u[1] * c.v[1], 0)), JSON.stringify(arcs));
  assert.ok(near(arcs.reduce((t, c) => t + Math.abs(c.t1 - c.t0), 0), 2 * Math.PI, 1e-9));
  assert.deepEqual(xs(face.rings).length, 2, 'the outer ring and the hole’s');
});

test('removed at 2:1 at (300, 60) on A3: the circle centred there, radius 8; its box; its name with the scale; the cutting line at Z 4 in the front view; a dimension reads 64 drawn 128', () => {
  const s: DrawingSection = { id: 'B', view: 'top', at: -4, removed: { at: [300, 60], scale: 2 } };
  const pr = sectionOf(starterDoc(), -4, 'y-', 'top', undefined, undefined, true); assert.ok(pr.ok); if (!pr.ok) return;
  const snap = snapPoints(pr.projection), a = snap.find(p => nearXY(p.at, [0, 0]))!, b = snap.find(p => nearXY(p.at, [64, 0]))!;
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', scale: 1, sections: [s], dimensions: [{ id: 'd1', view: 'section:B', kind: 'linear', a: a.ref, b: b.ref, orient: 'horizontal', place: [32, -8] }] };
  const { sheet, layout } = sheetOf(starterDoc(), settings);
  assert.deepEqual(layout.sections ?? [], [], 'no room in the rows');
  const placed = sheet.sections!.find(x => x.id === 'B')!;
  assert.equal(placed.form, 'removed');
  assert.deepEqual(placed.placement.box, [236, 28, 364, 92]);
  const g = sheet.groups.find(x => x.role === 'section' && x.id === 'B' && x.marks.some(m => m.kind === 'hatch'))!;
  const circles = g.marks.filter((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc');
  assert.ok(circles.length >= 1 && circles.every(m => nearXY(m.center, [300, 60]) && near(Math.hypot(m.u[0], m.u[1]), 8)), JSON.stringify(circles));
  const edges = g.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line');
  assert.deepEqual(lineSet(edges), lineSet([{ a: [236, 92], b: [364, 92] }, { a: [364, 92], b: [364, 28] }, { a: [236, 28], b: [364, 28] }, { a: [236, 92], b: [236, 28] }]));
  assert.ok(g.marks.every(m => m.kind !== 'line' || m.pen === 'visible'));
  assert.ok(sheet.groups.some(x => x.role === 'label' && x.marks.some(m => m.kind === 'text' && m.text === 'SECTION B–B (2:1)')));
  // (Its cutting line: in the front view, the horizontal chain line at Z 4.)
  const cutLine = sheet.groups.find(x => x.role === 'section' && x.id === 'B' && x.view === 'front')!.marks.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'center')!;
  const z4 = toSheet(layout.views.front, [0, 4])[1];
  assert.ok(near(cutLine.a[1], z4) && near(cutLine.b[1], z4));
  // (The dimension: 64 from the model, its ends at x 0 and 64 of the face, 128 sheet mm apart.)
  const r = sheet.dimensions.find(x => x.dim.id === 'd1')!;
  assert.ok(r.ok && near(r.value, 64), JSON.stringify(r));
  const tips = sheet.groups.find(x => x.role === 'dimension' && x.id === 'd1')!.marks.flatMap(m => m.kind === 'fill' && m.head ? [m.head.tip] : []);
  assert.equal(tips.length, 2);
  assert.ok(near(Math.abs(tips[0][0] - tips[1][0]), 128), JSON.stringify(tips));
  assert.ok(tips.every(t => near(t[0], 236) || near(t[0], 364)));
  // Placed by itself (no `at`): clear of the views, inside the frame; and moving it does not cut it again (same cut).
  const auto = sheetOf(starterDoc(), { ...settings, dimensions: [], sections: [{ ...s, removed: { scale: 2 } }] });
  const box = auto.sheet.sections!.find(x => x.id === 'B')!.placement.box, f = auto.layout.frame;
  assert.ok(box[0] >= f[0] && box[2] <= f[2] && box[1] >= f[1] && box[3] <= f[3]);
  for (const v of ['front', 'top', 'right', 'iso'] as const) { const o = auto.layout.views[v].box; assert.ok(box[2] <= o[0] || o[2] <= box[0] || box[3] <= o[1] || o[3] <= box[1], `clear of ${v}`); }
  assert.ok(sameSection(s, { ...s, removed: {} }) && !sameSection(s, { id: 'B', view: 'top', at: -4 }));
});

test('revolved: the bar’s X 50 section turned onto the front view, its faces at u 45–47 and 53–55 by z 0–20, a centreline along X 50', () => {
  const s: DrawingSection = { id: 'B', view: 'right', at: -50, revolved: true };
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', scale: 1, sections: [s] };
  const { sheet, layout } = sheetOf(bar(), settings);
  const front = layout.views.front, P = (u: number, v: number) => toSheet(front, [u, v]);
  const placed = sheet.sections!.find(x => x.id === 'B')!;
  assert.equal(placed.form, 'revolved'); assert.equal(placed.on, 'front');
  const g = sheet.groups.find(x => x.role === 'section' && x.id === 'B')!;
  assert.equal(g.view, 'front');
  const drawn = g.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'visible');
  const want = [[45, 0, 45, 20], [47, 0, 47, 20], [53, 0, 53, 20], [55, 0, 55, 20], [45, 0, 47, 0], [53, 0, 55, 0], [45, 20, 47, 20], [53, 20, 55, 20]].map(([a, b, c, d]) => ({ a: P(a, b), b: P(c, d) }));
  assert.deepEqual(lineSet(drawn), lineSet(want));
  const axis = g.marks.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'center')!;
  assert.ok(near(axis.a[0], P(50, 0)[0]) && near(axis.b[0], P(50, 0)[0]) && near(Math.min(axis.a[1], axis.b[1]), P(50, 20)[1] - 3) && near(Math.max(axis.a[1], axis.b[1]), P(50, 0)[1] + 3), JSON.stringify(axis));
  const hatch = g.marks.find((m): m is Extract<Mark, { kind: 'hatch' }> => m.kind === 'hatch')!;
  assert.deepEqual(xs(hatch.rings).map(([lo, hi]) => [+(lo - front.origin[0]).toFixed(6), +(hi - front.origin[0]).toFixed(6)]), [[45, 47], [53, 55]]);
  // (No name, no cutting line; nothing in the rows.)
  assert.ok(!sheet.groups.some(x => x.role === 'label' && x.marks.some(m => m.kind === 'text' && m.text.startsWith('SECTION B'))));
  assert.equal(sheet.groups.filter(x => x.role === 'section' && x.id === 'B').length, 1);
  assert.deepEqual(layout.sections ?? [], []);
  // A front section (Y 5, through the hole's axis) turns onto the top view instead: there u = x, v = y; its face x 0–47
  // and 53–100 by z 0–20 shows at v = 5 + (z − 10), so y −5 to 15.
  const t = sheetOf(bar(), { ...settings, sections: [{ id: 'C', view: 'front', at: 5, revolved: true }] });
  const tc = t.sheet.groups.find(x => x.role === 'section' && x.id === 'C')!;
  assert.equal(tc.view, 'top');
  const T = (u: number, v: number) => toSheet(t.layout.views.top, [u, v]);
  const tl = tc.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'visible');
  assert.deepEqual(lineSet(tl), lineSet([[0, -5, 0, 15], [47, -5, 47, 15], [53, -5, 53, 15], [100, -5, 100, 15], [0, -5, 47, -5], [53, -5, 100, -5], [0, 15, 47, 15], [53, 15, 100, 15]].map(([a, b, c, d]) => ({ a: T(a, b), b: T(c, d) }))));
});

test('saved, offered and refused forms; SECTION_NO_ROOM; turning refused (SECTION_KIND); the agent sets a removed section', () => {
  const kept = readDrawing({ sections: [{ id: 'B', view: 'top', at: -4, removed: { at: [1, 2], scale: 2 } }, { id: 'C', view: 'right', at: -50, revolved: true }, { id: 'D', view: 'front', at: 1, dir: [1, 1, 0], removed: {} }, { id: 'E', view: 'front', at: 1, dir: [1, 1, 0], revolved: true }, { id: 'F', view: 'front', at: 1, half: { line: 'vertical', at: 0, cut: 'after' }, removed: {} }, { id: 'G', view: 'front', at: 1, removed: { scale: -1 } }] }).sections!;
  assert.deepEqual(kept.map(x => [x.id, x.removed ?? null, x.revolved ?? null, !!x.dir, !!x.half]), [['B', { at: [1, 2], scale: 2 }, null, false, false], ['C', null, true, false, false], ['D', {}, null, true, false], ['E', null, null, true, false], ['F', null, null, false, true], ['G', null, null, false, false]]);
  const bad = (sections: unknown[]) => checkManufacturingDrawing({ sections })[0]?.message ?? '';
  assert.match(bad([{ id: 'B', view: 'front', at: 1, dir: [1, 0, 0], revolved: true }]), /revolved/);
  assert.match(bad([{ id: 'B', view: 'front', at: 1, removed: {}, revolved: true }]), /not both/);
  assert.match(bad([{ id: 'B', view: 'front', at: 1, steps: [{ past: 0, at: 2 }], removed: {} }]), /half or steps/);
  assert.match(bad([{ id: 'B', view: 'front', at: 1, removed: { scale: 0 } }]), /removed/);
  assert.equal(bad([{ id: 'B', view: 'front', at: 1, dir: [1, 1, 0], removed: { at: [10, 10] } }]), '');
  // No room: the plate at 10:1 (640 × 320 sheet mm) on A3.
  const views = viewsOf(starterDoc()), settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', sections: [{ id: 'B', view: 'top', at: -4, removed: { scale: 10 } }] };
  const sections = sheetSections(sectionsCut(starterDoc(), sectionsOf(settings)));
  const issues = drawingIssues(issueContext({ views, settings, sections, callout: () => null, meta: META }));
  assert.ok(issues.some(i => i.code === 'SECTION_NO_ROOM' && i.severity === 'error' && /10:1/.test(i.message)), JSON.stringify(issues.map(i => i.code)));
  const sb = brepsFor(starterDoc()); assert.ok('breps' in sb); const x = projectViews(sb.breps, sb.prefixes, { orientation: 'x+' }); assert.ok(x.ok); if (!x.ok) return;
  const t = reorient(views, x.views, settings, 'x+');
  assert.ok(!t.ok && t.code === 'SECTION_KIND' && /removed/.test(t.message));
  const r = runDrawingTool(starterDoc(), 'set_drawing', { sheet: 'A3', sections: [{ id: 'B', view: 'top', at: -4, removed: { scale: 2 } }, { id: 'C', view: 'right', at: -32, revolved: false }] });
  assert.ok(!('error' in r), JSON.stringify(r)); if ('error' in r) return;
  assert.deepEqual(readDrawing(r.doc.drawing).sections, [{ id: 'B', view: 'top', at: -4, removed: { scale: 2 } }, { id: 'C', view: 'right', at: -32 }]);
});

test('written: the removed section in the SVG; the DXF read back by ezdxf — its circle r 8 at (300, 60), its outline, two hatch loops, its name', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', scale: 1, sections: [{ id: 'B', view: 'top', at: -4, removed: { at: [300, 60], scale: 2 } }] };
  const { sheet, layout } = sheetOf(starterDoc(), settings);
  assert.ok(sheetSvg(sheet, 'plate').includes('>SECTION B–B (2:1)<'));
  const py = join(homedir(), '.cache/barocss-ezdxf/bin/python'), script = resolve(import.meta.dirname, '../../barocss-cad/scripts/dxf-oracle.py');
  if (!existsSync(py)) { console.log('ezdxf not installed at ~/.cache/barocss-ezdxf: the read-back is skipped'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'dr4-')), file = join(dir, 'removed.dxf');
  writeFileSync(file, sheetDxf(sheet, layout).bytes);
  const o = JSON.parse(execFileSync(py, ['-I', script, file], { encoding: 'utf8' }));
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(o.audit?.errors ?? o.errors ?? [], []);
  const H = 297, flat = entitiesOf(o, []);
  // (DXF y is up: a sheet point (x, y) is (x, 297 − y). The circle whole, or arcs about it summing to a turn.)
  const round = flat.filter(e => (e.type === 'CIRCLE' || e.type === 'ARC') && nearXY(e.center as number[], [300, H - 60], 1e-6) && near(e.radius as number, 8, 1e-6));
  const turn = round.reduce((t, e) => t + (e.type === 'CIRCLE' ? 360 : (((e.endDeg as number) - (e.startDeg as number)) % 360 + 360) % 360), 0);
  assert.ok(near(turn, 360, 1e-6), JSON.stringify(round));
  const top = flat.find(e => e.type === 'LINE' && ((nearXY(e.a as number[], [236, H - 28], 1e-6) && nearXY(e.b as number[], [364, H - 28], 1e-6)) || (nearXY(e.b as number[], [236, H - 28], 1e-6) && nearXY(e.a as number[], [364, H - 28], 1e-6))));
  assert.ok(top, 'the outline’s far edge, 128 long at y 28');
  const hatch = flat.filter(e => e.type === 'HATCH' && e.layer === 'HATCH');
  assert.equal(hatch.length, 1); assert.equal((hatch[0].loops as unknown[]).length, 2, 'the face and the hole');
  assert.ok(JSON.stringify(o).includes('"SECTION B–B (2:1)"'));
});

function entitiesOf(x: unknown, out: Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(x)) { for (const y of x) entitiesOf(y, out); return out; }
  if (x && typeof x === 'object') { if ('type' in x) out.push(x as Record<string, unknown>); for (const y of Object.values(x)) entitiesOf(y, out); }
  return out;
}
