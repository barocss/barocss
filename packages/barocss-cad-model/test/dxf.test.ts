import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dxfHatchLines, writeDxf, type DxfDocument, type DxfEntity } from '@barocss/cad';
import { brepsFor } from '../src/engine/evaluate';
import { starterDoc, type SketchNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { layoutSheet } from '../src/drawing/views';
import { snapPoints } from '../src/drawing/dimensions';
import { buildSheet, hatch, type Mark } from '../src/drawing/sheet';
import { sectionOf } from '../src/drawing/section';
import { sheetSvg } from '../src/io/svg';
import { arcEntity, sectionDxfDocument, sheetDxf, sheetDxfDocument } from '../src/io/dxf';
import { sketchDxfDocument } from '../src/sketch/dxf';
import { defaultDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';

// R11b (O1): the drawing, a section and a sketch as DXF. The documents handed to the kernel's writer are the
// kernel's conformance inputs (packages/barocss-cad/conformance/r11b/<case>/document.json); UPDATE_DXF_FIXTURES=1
// writes them anew (then scripts/dxf-fixtures.mjs there writes the files and the oracle's readings).

const fixtures = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/r11b');
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const viewsOf = (doc: StudioDoc): DrawingViews => {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views;
};

/** The fixture as committed (or written, with UPDATE_DXF_FIXTURES=1): the document must be it exactly. */
function fixture(name: string, doc: DxfDocument, base = 'document.json'): void {
  const file = resolve(fixtures, name, base), text = JSON.stringify(doc, null, 1) + '\n';
  if (process.env.UPDATE_DXF_FIXTURES) writeFileSync(file, text);
  assert.ok(readFileSync(file, 'utf8') === text, `${name}/${base}: the committed fixture (after a deliberate change: UPDATE_DXF_FIXTURES=1, then the kernel's scripts/dxf-fixtures.mjs)`);
}

/** The starter plate (64 × 32 × 8, Ø8 at 32, 16) with every kind of dimension, a tolerance of each kind, a note with a leader and section A–A. */
function plateDrawing() {
  const doc = starterDoc(), v = viewsOf(doc), f = snapPoints(v.front), r = snapPoints(v.right);
  const at = (s: typeof f, u: number, w: number) => s.find(p => near(p.at[0], u, 1e-6) && near(p.at[1], w, 1e-6))!.ref;
  const hole = v.top.edges.find(e => e.kind === 'circle')!;
  const lines = v.front.edges.filter(e => e.kind === 'line' && e.ends);
  const bottom = lines.find(e => e.ends!.every(p => Math.abs(p[2]) < 1e-9 && Math.abs(p[1]) < 1e-9))!, left = lines.find(e => e.ends!.every(p => Math.abs(p[0]) < 1e-9 && Math.abs(p[1]) < 1e-9))!;
  const mid = (e: typeof bottom) => [0, 1, 2].map(k => (e.ends![0][k] + e.ends![1][k]) / 2) as [number, number, number];
  const dimensions: DrawingDimension[] = [
    { id: 'd1', view: 'front', kind: 'linear', a: at(f, 0, 0), b: at(f, 64, 0), orient: 'horizontal', place: [32, -12], tol: { kind: 'symmetric', value: 0.1 } },
    { id: 'd2', view: 'front', kind: 'linear', a: at(f, 64, 0), b: at(f, 64, 8), orient: 'vertical', place: [74, 4], tol: { kind: 'deviation', upper: 0.05, lower: -0.1 } },
    { id: 'd3', view: 'right', kind: 'linear', a: at(r, 0, 0), b: at(r, 32, 8), orient: 'aligned', place: [10, 14] },
    { id: 'd4', view: 'top', kind: 'diameter', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [50, 40], tol: { kind: 'fit', code: 'H7' } },
    { id: 'd5', view: 'top', kind: 'radius', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [33, 17] },
    { id: 'd6', view: 'front', kind: 'angle', a: { edge: bottom.name, near: mid(bottom) }, b: { edge: left.name, near: mid(left) }, place: [5, 3] },
  ];
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions, section: { y: 16 }, notes: [{ id: 'n1', text: 'ALL EDGES BROKEN 0.5\nMATERIAL: AL 6061 (Ø ± °)', at: [150, 150], leader: { view: 'top', at: [10, 20] } }] };
  const cut = sectionOf(doc, 16); assert.ok(cut.ok);
  const layout = layoutSheet(v, settings, cut.projection);
  const sheet = buildSheet(v, layout, settings, { title: 'PLATE 64 × 32', date: '2026-10-19' }, [{ id: 'A', view: 'front', at: 16, projection: cut.projection, rings: cut.rings }]);
  assert.ok(sheet.dimensions.every(x => x.ok), JSON.stringify(sheet.dimensions.filter(x => !x.ok)));
  return { sheet, layout, cut };
}

type XY = [number, number];
/** Points of a DXF line, arc, circle or ellipse at n + 1 even steps (counter-clockwise, as DXF runs it). */
function curvePoints(e: DxfEntity, n: number): XY[] {
  const out: XY[] = [];
  for (let k = 0; k <= n; k++) {
    if (e.type === 'circle') { const t = 2 * Math.PI * k / n; out.push([e.center[0] + e.radius * Math.cos(t), e.center[1] + e.radius * Math.sin(t)]); }
    else if (e.type === 'arc') { let s = e.endDeg - e.startDeg; if (s <= 0) s += 360; const t = (e.startDeg + s * k / n) * Math.PI / 180; out.push([e.center[0] + e.radius * Math.cos(t), e.center[1] + e.radius * Math.sin(t)]); }
    else if (e.type === 'ellipse') { const t = e.start + (e.end - e.start) * k / n, [mx, my] = e.major; out.push([e.center[0] + mx * Math.cos(t) - my * e.ratio * Math.sin(t), e.center[1] + my * Math.cos(t) + mx * e.ratio * Math.sin(t)]); }
    else throw new Error(e.type);
  }
  return out;
}
const markArc = (m: Extract<Mark, { kind: 'arc' }>, H: number, n: number): XY[] => Array.from({ length: n + 1 }, (_, k) => { const t = m.t0 + (m.t1 - m.t0) * k / n; return [m.center[0] + m.u[0] * Math.cos(t) + m.v[0] * Math.sin(t), H - (m.center[1] + m.u[1] * Math.cos(t) + m.v[1] * Math.sin(t))]; });
const sameSet = (a: XY[], b: XY[], what: string) => { for (const p of a) assert.ok(b.some(q => near(p[0], q[0]) && near(p[1], q[1])), `${what}: ${p} in ${JSON.stringify(b)}`); };

test('an arc of the sheet becomes the same curve in DXF: circle, arc either way round, ellipse on its axes', () => {
  const cases: [XY, XY, XY, number, number][] = [
    [[10, 10], [3, 0], [0, 3], 0, 2 * Math.PI], [[10, 10], [3, 0], [0, 3], 0.3, 2], [[10, 10], [3, 0], [0, -3], 0.3, 2],
    [[0, 0], [4, 1], [-0.5, 2], 0.2, 2.5], [[0, 0], [4, 1], [0.5, -2], 0.2, 2.5], [[0, 0], [1, 2], [-3, 0.4], 0, 2 * Math.PI], [[5, 5], [0.8, 3], [2, 0], 1, 5],
  ];
  for (const [c, u, v, t0, t1] of cases) {
    const e = arcEntity(c, u, v, t0, t1, 'X'), want = Array.from({ length: 33 }, (_, k) => { const t = t0 + (t1 - t0) * k / 32; return [c[0] + u[0] * Math.cos(t) + v[0] * Math.sin(t), c[1] + u[1] * Math.cos(t) + v[1] * Math.sin(t)] as XY; });
    const got = curvePoints(e, 32);
    if (t1 - t0 < 2 * Math.PI - 1e-9) sameSet([want[0], want[32]], [got[0], got[32]], `${e.type} ends`);
    // The same points: every one of ours on its curve (both sampled finely, each near the other's polyline).
    const fine = curvePoints(e, 4096), on = (p: XY) => Math.min(...fine.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));
    for (const p of want) assert.ok(on(p) < 1e-2 * Math.hypot(...u), `${e.type} through ${p}`);
    if (e.type === 'ellipse') { assert.ok(e.ratio > 0 && e.ratio <= 1); }
  }
  assert.equal(arcEntity([0, 0], [2, 0], [0, 2], 0, 1, 'X').type, 'arc');
  assert.equal(arcEntity([0, 0], [2, 0], [0, 1], 0, 1, 'X').type, 'ellipse');
});

test('the plate drawing as DXF: every mark of the sheet, dimensions as DIMENSION entities, the section as a HATCH', () => {
  const { sheet, layout } = plateDrawing(), H = sheet.size[1];
  const doc = sheetDxfDocument(sheet, layout);
  fixture('plate-drawing', doc);
  const r = writeDxf(doc);
  assert.equal(r.report.modelSpace.DIMENSION, 6); assert.equal(r.report.modelSpace.INSERT, 1); assert.equal(r.report.modelSpace.HATCH, 1);
  // The frame and title block are TITLE_BLOCK: its lines and texts are the sheet's.
  const title = doc.blocks![0].entities, framed = sheet.groups.filter(g => g.role === 'frame' || g.role === 'title').flatMap(g => g.marks);
  assert.equal(title.filter(e => e.type === 'line').length, framed.filter(m => m.kind === 'line').length);
  assert.deepEqual(title.filter(e => e.type === 'text').map(e => e.type === 'text' && e.text), framed.filter(m => m.kind === 'text').map(m => m.kind === 'text' && m.text));
  // Each dimension block holds that dimension's marks; definition points measure the model value at the sheet's scale.
  const dims = doc.entities.filter((e): e is Extract<DxfEntity, { type: 'dimension' }> => e.type === 'dimension');
  const groups = sheet.groups.filter(x => x.role === 'dimension');
  assert.equal(groups.length, dims.length);
  for (const [k, d] of dims.entries()) {
    const g = groups[k], r = sheet.dimensions.find(y => y.ok && y.dim.id === g.id);
    assert.ok(r && r.ok && r.value === d.measurement, `dimension ${d.text}`);
    const geo = d.geometry;
    if (geo.kind === 'linear') { const L = geo.angleDeg === 0 ? Math.abs(geo.p2[0] - geo.p1[0]) : Math.abs(geo.p2[1] - geo.p1[1]); assert.ok(near(L, d.measurement! * layout.scale), `${d.text}: ${L}`); }
    if (geo.kind === 'aligned') assert.ok(near(Math.hypot(geo.p2[0] - geo.p1[0], geo.p2[1] - geo.p1[1]), d.measurement! * layout.scale));
    if (geo.kind === 'diameter') assert.ok(near(Math.hypot(geo.rim[0] - geo.opposite[0], geo.rim[1] - geo.opposite[1]), d.measurement! * layout.scale));
    if (geo.kind === 'radius') assert.ok(near(Math.hypot(geo.rim[0] - geo.center[0], geo.rim[1] - geo.center[1]), d.measurement! * layout.scale));
    if (geo.kind === 'angular') { const a = Math.atan2(geo.line1[1][1] - geo.line1[0][1], geo.line1[1][0] - geo.line1[0][0]), b = Math.atan2(geo.line2[1][1] - geo.line2[0][1], geo.line2[1][0] - geo.line2[0][0]); assert.ok(near(((b - a) * 180 / Math.PI + 360) % 360, d.measurement!, 1e-9)); }
    assert.equal(d.block.filter(e => e.type === 'text').length, g.marks.filter(m => m.kind === 'text').length);
    assert.equal(d.block.filter(e => e.type === 'solid' || e.type === 'hatch').length, g.marks.filter(m => m.kind === 'fill').length, 'arrowheads as solids, round dots as solid hatches');
  }
  assert.deepEqual(dims.map(d => d.text).sort(), ['64 ±0.1', '8 +0.05/-0.1', '90°', 'R4', 'Ø8 H7', String(Math.round(Math.hypot(32, 8) * 100) / 100)].sort());
  // Every line, arc and text of the views, labels, notes and section is there, in y-up coordinates.
  const rest = sheet.groups.filter(g => g.role !== 'frame' && g.role !== 'title' && g.role !== 'dimension').flatMap(g => g.marks);
  const plain = doc.entities.filter(e => e.type !== 'dimension' && e.type !== 'insert');
  assert.equal(plain.filter(e => e.type === 'line').length, rest.filter(m => m.kind === 'line').length);
  assert.equal(plain.filter(e => e.type === 'text').length, rest.filter(m => m.kind === 'text').length);
  const arcs = rest.filter((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc'), curves = plain.filter(e => e.type === 'arc' || e.type === 'circle' || e.type === 'ellipse');
  assert.equal(curves.length, arcs.length); assert.ok(arcs.length >= 4);
  arcs.forEach((m, i) => { const e = curves[i], want = markArc(m, H, 8), got = curvePoints(e, 8); if (m.t1 - m.t0 < 2 * Math.PI - 1e-9) sameSet([want[0], want[8]], [got[0], got[8]], `arc ${i} ends`); });
  assert.ok(curves.some(e => e.type === 'ellipse'), 'the iso view’s hole as an ellipse');
  // The section's hatch: the oracle-checked line family gives the sheet's own hatch lines, one for one.
  const mark = sheet.groups.find(g => g.role === 'section' && !g.view)!.marks.find((m): m is Extract<Mark, { kind: 'hatch' }> => m.kind === 'hatch')!;
  const h = plain.find((e): e is Extract<DxfEntity, { type: 'hatch' }> => e.type === 'hatch')!;
  assert.ok(h.fill.kind === 'lines');
  const ours = dxfHatchLines(h.loops, h.fill.angleDeg, h.fill.spacing, h.fill.origin).map(([a, b]) => [[a[0], H - a[1]], [b[0], H - b[1]]] as [XY, XY]);
  const sheetLines = hatch(mark.rings, mark.spacing);
  assert.equal(ours.length, sheetLines.length); assert.ok(ours.length > 10);
  for (const l of sheetLines) assert.ok(ours.some(([a, b]) => [[a, b], [b, a]].some(([p, q]) => near(p[0], l.a[0], 1e-9) && near(p[1], l.a[1], 1e-9) && near(q[0], l.b[0], 1e-9) && near(q[1], l.b[1], 1e-9))), `hatch line ${l.a} → ${l.b}`);
  // The SVG still draws the same hatch lines (the mark expands to them).
  assert.equal((sheetSvg(sheet, 't').match(/<line /g) ?? []).length, sheet.groups.flatMap(g => g.marks).reduce((n, m) => n + (m.kind === 'line' ? 1 : m.kind === 'hatch' ? hatch(m.rings, m.spacing).length : 0), 0));
  // R12: fills as solids, curves as polylines within 0.001 mm, the hatch as its lines; units not stored.
  fixture('plate-drawing', sheetDxfDocument(sheet, layout, 'AC1009'), 'document.AC1009.json');
  const r12 = sheetDxf(sheet, layout, 'AC1009');
  assert.ok(r12.report.r12 && r12.report.r12.ellipses > 0 && r12.report.r12.hatches === 1 && r12.report.r12.maxChordDeviation <= 1e-3);
  assert.equal(r12.report.modelSpace.HATCH, undefined);
});

test('section A–A alone at 1:1 and a sketch with arcs, holes and construction as DXF', () => {
  const { cut } = plateDrawing();
  assert.ok(cut.ok);
  const sec = sectionDxfDocument(cut);
  fixture('section-a-a', sec);
  const h = sec.entities.find((e): e is Extract<DxfEntity, { type: 'hatch' }> => e.type === 'hatch')!;
  assert.equal(h.loops.length, 2);
  assert.deepEqual(h.loops.map(l => [Math.min(...l.points.map(p => p[0])), Math.max(...l.points.map(p => p[0]))].map(x => Math.round(x * 1e6) / 1e6)).sort((a, b) => a[0] - b[0]), [[0, 28], [36, 64]]);
  // A rounded plate in its sketch plane, a parameter for its width, two holes and a construction slot.
  const sketch: SketchNode = {
    kind: 'sketch', profile: 'loop',
    segments: [
      { kind: 'line', start: [0, 0] }, { kind: 'line', start: [{ parameter: 'w' }, 0] }, { kind: 'arc', start: [{ parameter: 'w' }, 20], center: [{ parameter: 'w' }, 25], direction: 'ccw' },
      { kind: 'line', start: [{ parameter: 'w' }, 30] }, { kind: 'line', start: [0, 30] },
    ],
    holes: [[{ kind: 'arc', start: [14, 15], center: [10, 15], direction: 'ccw' }], [{ kind: 'arc', start: [32, 15], center: [30, 15], direction: 'cw' }, { kind: 'arc', start: [28, 15], center: [30, 15], direction: 'cw' }]],
    construction: [{ kind: 'slot', a: [5, 5], b: [15, 5], r: 2, construction: true }],
  };
  const sk = sketchDxfDocument(sketch, { w: 50 });
  fixture('sketch-plate', sk);
  const [outer, hole1, hole2, slot] = sk.entities;
  assert.ok(outer.type === 'lwpolyline' && outer.closed && outer.layer === 'PROFILE');
  assert.deepEqual(outer.points, [[0, 0], [50, 0], [50, 20], [50, 30], [0, 30]]);
  // The arc's bulge gives back its centre: a half turn bulging out to x = 55.
  assert.ok(near(outer.bulges![2], 1)); assert.deepEqual(outer.bulges!.filter((_, i) => i !== 2), [0, 0, 0, 0]);
  assert.deepEqual(hole1, { type: 'circle', center: [10, 15], radius: 4, layer: 'HOLES' });
  assert.ok(hole2.type === 'lwpolyline' && hole2.bulges!.every(b => near(b, -1)) && hole2.layer === 'HOLES');
  assert.ok(slot.type === 'lwpolyline' && slot.layer === 'CONSTRUCTION' && slot.bulges!.filter(b => b !== 0).length === 2);
  assert.throws(() => sketchDxfDocument(sketch, {}), /parameter “w”/);
  assert.equal(writeDxf(sk, { version: 'AC1009' }).report.modelSpace.POLYLINE, 3);
});
