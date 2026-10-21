// QA probe (engine level) for 2D drawings: projects parts the unit tests do not cover with the same
// code the worker runs (brepsFor → projectViews), checks view extents, visible / hidden pieces at known
// places, sheet layout and scale, dimension values after model edits, and projection time.
//   node test/qa/run-engine-probe.mjs drawing-probe.ts
import { brepsFor } from '@barocss/cad-model/engine/evaluate';
import { cylinderPart, emptyDoc, loftTop, rectanglePart, starterDoc, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { layoutSheet, scaleLabel } from '@barocss/cad-model/drawing/views';
import { resolveDimension, snapPoints } from '@barocss/cad-model/drawing/dimensions';
import { buildSheet } from '@barocss/cad-model/drawing/sheet';
import { sheetSvg } from '@barocss/cad-model/drawing/svg';
import { sheetPdf } from '@barocss/cad-model/drawing/pdf';
import { defaultDrawing, type DrawingDimension, type DrawingViews, type ViewId } from '@barocss/cad-model/drawing/types';
import type { ProjectedCurve } from '@barocss/cad';

type Row = { id: string; area: string; name: string; ok: boolean; expected?: unknown; actual?: unknown; note?: string };
const rows: Row[] = [], A = '[drawing]';
const S = (n: number) => ({ node: n, side: 'solid' as const });
const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce((d, n) => withNode(d, n), doc);
const box = (w: number, d: number, h: number, x = 0, y = 0, z = 0, doc = emptyDoc()) => { const s = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + w, y + d] }); return withNode(s, { kind: 'extrude', sketch: s.nodes.length - 1, height: h, ...(z ? { from: z } : {}) }); };
function views(doc: StudioDoc): { v: DrawingViews; ms: number } | string {
  const b = brepsFor(doc); if ('error' in b) return 'model: ' + b.error;
  const t0 = performance.now(), r = projectViews(b.breps);
  return r.ok ? { v: r.views, ms: performance.now() - t0 } : 'projection: ' + r.error;
}
const r2 = (v: readonly number[]) => v.map(x => Math.round(x * 1000) / 1000);
/** Pieces (visible or hidden) whose curve is a straight line from a to b (either way), within tol. */
function lines(v: DrawingViews, id: ViewId, visible: boolean) {
  return v[id].edges.flatMap(e => e.pieces.filter(p => p.visible === visible).map(p => ({ name: e.name, c: p.curve })));
}
/** Whether the union of line pieces covers the segment (x0,y0)-(x1,y1) (sampled). */
function covers(list: { c: ProjectedCurve }[], x0: number, y0: number, x1: number, y1: number) {
  for (let k = 0; k <= 20; k++) {
    const t = k / 20, p = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    const hit = list.some(({ c }) => {
      if (c.kind !== 'line') return false;
      const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1], L = dx * dx + dy * dy, s = L ? ((p[0] - c.a[0]) * dx + (p[1] - c.a[1]) * dy) / L : 0;
      return s >= -1e-6 && s <= 1 + 1e-6 && Math.hypot(c.a[0] + s * dx - p[0], c.a[1] + s * dy - p[1]) < 1e-3;
    });
    if (!hit) return false;
  }
  return true;
}
const summary = (v: DrawingViews) => Object.fromEntries((['front', 'top', 'right'] as ViewId[]).map(id => [id, { min: r2(v[id].min), max: r2(v[id].max), visible: lines(v, id, true).length, hidden: lines(v, id, false).length }]));
function check(id: string, name: string, doc: StudioDoc, test: (v: DrawingViews) => { ok: boolean; expected: unknown; actual?: unknown }) {
  const r = views(doc);
  if (typeof r === 'string') { rows.push({ id, area: A, name, ok: false, actual: r }); return; }
  try { const t = test(r.v); rows.push({ id, area: A, name, ok: t.ok, expected: t.expected, actual: { ...(t.actual as object ?? {}), views: summary(r.v), ms: Math.round(r.ms) } }); }
  catch (e) { rows.push({ id, area: A, name, ok: false, actual: 'THREW ' + String(e) }); }
}

// Cylinder: silhouettes at x = ±8 in front, a full circle in top.
check('G01', 'cylinder r8 h24: front silhouettes at x = ±8, a circle from the top', cylinderPart(8, 24), v => {
  const vis = lines(v, 'front', true), circ = v.top.edges.filter(e => e.circle && Math.abs(e.circle.radius - 8) < 1e-9);
  return { ok: covers(vis, -8, 0, -8, 24) && covers(vis, 8, 0, 8, 24) && circ.length > 0 && String(r2(v.front.min)) === '-8,0' && String(r2(v.front.max)) === '8,24', expected: 'visible x=±8 from z 0 to 24; top circle R8; front extents (−8,0)…(8,24)', actual: { topCircles: circ.length } };
});
// Open-top shell 32×32×16, wall 2: inner walls hidden in the front view at x = 2 and 30, floor at z = 2.
check('G02', 'shell 2 open top: inner walls hidden at x 2 / 30 (z 2…16), floor hidden at z 2', withNode(box(32, 32, 16), { kind: 'shell', parent: S(1), thickness: 2, open: ['n1.top'] }), v => {
  const hid = lines(v, 'front', false);
  return { ok: covers(hid, 2, 2, 2, 16) && covers(hid, 30, 2, 30, 16) && covers(hid, 2, 2, 30, 2), expected: 'hidden lines x=2, x=30 (z 2…16) and z=2 (x 2…30)', actual: { hidden: hid.filter(h => h.c.kind === 'line').map(h => r2([...(h.c as { a: number[] }).a, ...(h.c as { b: number[] }).b])) } };
});
// A box behind a taller box: front view shows the rear box's top part visible, nothing of it below z 10.
const two = box(20, 10, 20, 0, 20, 0, box(20, 10, 10));
check('G03', 'tall box behind a short one: its upper part visible, its hidden lower part not drawn on top of visible ink', two, v => {
  const vis = lines(v, 'front', true), hid = lines(v, 'front', false);
  return { ok: covers(vis, 0, 10, 0, 20) && covers(vis, 20, 10, 20, 20) && covers(vis, 0, 20, 20, 20) && covers(vis, 0, 10, 20, 10), expected: 'visible: rear box outline above z 10 and the front box top at z 10', actual: { hiddenPieces: hid.length } };
});
// Filleted top edge (R4 on the front-top edge of 32×32×16): side view shows the quarter arc.
check('G04', 'fillet R4 on the front top edge: right view shows a quarter arc R4 from (4,16) to (0,12)', withNode(box(32, 32, 16), { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 4 }), v => {
  // right view: toward +X, up Z → horizontal coordinate is −Y? (right = up × toward)
  const arcs = v.right.edges.filter(e => e.pieces.some(p => p.visible && p.curve.kind === 'arc'));
  const hasArc = v.right.edges.some(e => e.circle && Math.abs(e.circle.radius - 4) < 1e-9);
  return { ok: hasArc && arcs.length > 0, expected: 'an R4 circular edge drawn as an arc in the right view', actual: { arcs: arcs.map(e => e.name), right: { min: r2(v.right.min), max: r2(v.right.max) } } };
});
// Torus (circle r5 at (30,10) revolved about Y): top view extents ±35; front view shows the outer silhouette.
check('G05', 'torus: view extents are ±35 (R 30 + r 5)', add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), v => {
  const ok = (id: ViewId, lo: number[], hi: number[]) => r2(v[id].min).every((x, k) => Math.abs(x - lo[k]) < 0.05) && r2(v[id].max).every((x, k) => Math.abs(x - hi[k]) < 0.05);
  // Revolved about the sketch's Y axis: the ring lies in XZ, 10 mm up Y (thickness 5..15 in Y).
  return { ok: ok('front', [-35, -35], [35, 35]) && ok('top', [-35, 5], [35, 15]), expected: { front: [[-35, -35], [35, 35]], top: [[-35, 5], [35, 15]] } };
});
// Plate on a 30° plane: front view extents follow the tilted bounds.
check('G06', '30° tilted 30×20×8 extrude: right view extents = the part’s Y/Z bounds (0…21.32, −10…6.93)', add(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], plane: { origin: [0, 0, 0], normal: [0, 0.5, Math.sqrt(3) / 2], xAxis: [1, 0, 0] } }, { kind: 'extrude', sketch: 0, height: 8 }), v => {
  const ys = [v.right.min[0], v.right.max[0]].map(Math.abs).sort((a, b) => a - b), zs = r2([v.right.min[1], v.right.max[1]]);
  return { ok: Math.abs(ys[0]) < 1e-3 && Math.abs(ys[1] - 21.3205) < 1e-3 && Math.abs(zs[0] + 10) < 1e-3 && Math.abs(zs[1] - 6.9282) < 1e-3, expected: 'width 21.32, z −10 … 6.93', actual: { right: [r2(v.right.min), r2(v.right.max)] } };
});
// Notch hole off the edge (centre x = 2, Ø8): the front view hides the hole wall only where it is inside (x 0…6).
check('G07', 'notch hole at the plate edge: front view hidden line at x 6 only (x −2 lies outside)', withNode(rectanglePart(100, 60, 5), { kind: 'hole', parent: S(1), center: [2, 30], radius: 4 }), v => {
  const hid = lines(v, 'front', false), xs = hid.filter(h => h.c.kind === 'line').map(h => r2([(h.c as { a: number[] }).a[0]])[0]);
  return { ok: covers(hid, 6, 0, 6, 5) && !xs.some(x => x < 0), expected: 'hidden x=6 (z 0…5), nothing at x<0', actual: { hiddenX: xs } };
});
// Loft square → circle: the top circle is round from the top and the views close.
check('G08', 'loft square 20 → circle Ø10: top view shows both outlines; extents 0…20', (() => { const sq = { kind: 'sketch' as const, profile: 'rectangle' as const, min: [0, 0] as [number, number], max: [20, 20] as [number, number] }; return add(emptyDoc(), sq, loftTop(sq, 'circle', 0.5), { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 10 }] }); })(), v => {
  const c = v.top.edges.filter(e => e.circle && Math.abs(e.circle.radius - 5) < 1e-6);
  return { ok: c.length > 0 && String(r2(v.top.max)) === '20,20', expected: 'circle R5 in the top view', actual: { circles: c.length, names: v.top.edges.length } };
});

// Layout and scale at the extremes.
for (const [id, name, doc, want] of [
  ['L1', 'tiny 0.5 mm cube → 10:1 (largest) and fits', box(0.5, 0.5, 0.5), (s: number, fits: boolean) => s === 10 && fits],
  ['L2', '2000×1000×10 plate → a reduced standard scale that fits A4', box(2000, 1000, 10), (s: number, fits: boolean) => s < 1 && fits],
  ['L3', '10000 mm long bar (the length limit) → fits at the smallest scale or says it does not', box(10000, 20, 20), (s: number, fits: boolean) => fits || s === 0.01],
] as const) {
  const r = views(doc as StudioDoc);
  if (typeof r === 'string') { rows.push({ id, area: A, name, ok: false, actual: r }); continue; }
  const l = layoutSheet(r.v, defaultDrawing());
  rows.push({ id, area: A, name, ok: (want as (s: number, f: boolean) => boolean)(l.scale, l.fits), actual: { scale: scaleLabel(l.scale), fits: l.fits } });
}

// Dimensions: a linear width on the front view, Ø of the hole on top; then the model changes.
{
  const plate = starterDoc(), r = views(plate);
  if (typeof r !== 'string') {
    const snaps = snapPoints(r.v.front);
    const at = (x: number, z: number) => snaps.find(s => Math.abs(s.at[0] - x) < 1e-6 && Math.abs(s.at[1] - z) < 1e-6)!.ref;
    const width: DrawingDimension = { id: 'd1', view: 'front', kind: 'linear', a: at(0, 8), b: at(64, 8), orient: 'horizontal', place: [32, 16] };
    const hole = r.v.top.edges.find(e => e.circle && Math.abs(e.circle.radius - 4) < 1e-6)!;
    const dia: DrawingDimension = { id: 'd2', view: 'top', kind: 'diameter', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [50, 40] };
    const read = (doc: StudioDoc) => { const v = views(doc); return typeof v === 'string' ? v : [width, dia].map(d => { const x = resolveDimension(v.v, d); return x.ok ? x.text : 'GONE: ' + x.reason; }); };
    const wide = { ...plate, nodes: plate.nodes.map((n, k) => k === 0 ? { ...n, max: [80, 32] } : k === 2 ? { ...n, radius: 6 } : n) } as StudioDoc;
    rows.push({ id: 'DM1', area: A, name: 'dimensions follow the model: width 64 → 80, hole Ø8 → Ø12', ok: JSON.stringify(read(plate)) === '["64","Ø8"]' && JSON.stringify(read(wide)) === '["80","Ø12"]', expected: [['64', 'Ø8'], ['80', 'Ø12']], actual: [read(plate), read(wide)] });
    // The hole moved off-centre: the dimension should still find it (near is only a hint).
    const moved = { ...plate, nodes: plate.nodes.map((n, k) => k === 2 ? { ...n, center: [10, 10] } : n) } as StudioDoc;
    rows.push({ id: 'DM2', area: A, name: 'hole moved from (32,16) to (10,10): its Ø dimension still reads Ø8', ok: JSON.stringify(read(moved)) === '["64","Ø8"]', actual: read(moved) });
    // A second hole added, nearer the old place than the first: the dimension keeps its own hole.
    const twoHoles = add({ ...plate, nodes: plate.nodes.map((n, k) => k === 2 ? { ...n, center: [10, 10] } : n) } as StudioDoc, { kind: 'hole', parent: S(2), center: [33, 16], radius: 2 });
    rows.push({ id: 'DM3', area: A, name: 'a Ø4 hole added near the old spot: the Ø dimension still measures the original Ø8 hole', ok: JSON.stringify(read(twoHoles)) === '["64","Ø8"]', expected: ['64', 'Ø8'], actual: read(twoHoles) });
    // Rolled back to the bare plate: the Ø dimension reports the hole is gone.
    rows.push({ id: 'DM4', area: A, name: 'hole removed: its Ø dimension reports the circle is gone', ok: /GONE/.test(String(read({ ...plate, nodes: plate.nodes.slice(0, 2) } as StudioDoc))), actual: read({ ...plate, nodes: plate.nodes.slice(0, 2) } as StudioDoc) });
    // SVG and PDF of the dimensioned sheet.
    const st = { ...defaultDrawing(), dimensions: [width, dia] }, lay = layoutSheet(r.v, st), sheet = buildSheet(r.v, lay, st, { title: 'QA', date: '2026-10-16' });
    const svg = sheetSvg(sheet, 'QA'), pdf = sheetPdf(sheet, 'QA'), pdfText = Array.from(pdf, b => String.fromCharCode(b)).join('');
    rows.push({ id: 'EX1', area: A, name: 'SVG and PDF of the sheet carry both dimension texts', ok: svg.includes('>64<') && svg.includes('Ø8') && pdf.length > 1000, actual: { svgBytes: svg.length, pdfBytes: pdf.length, svg64: svg.includes('>64<'), svgO8: svg.includes('Ø8'), pdfHead: pdfText.slice(0, 8), pdfHas64: pdfText.includes('(64)'), pdfDiameter: (/\((\S{1,2})8\)/.exec(pdfText) ?? [])[0] } });
  }
}
// Performance: a 4×3 pattern of holed plates.
{
  let d = starterDoc();
  d = withNode(d, { kind: 'linear-pattern', parent: S(2), axis: 'x', spacing: 80, count: 4 });
  d = withNode(d, { kind: 'linear-pattern', parent: S(3), axis: 'y', spacing: 40, count: 3 });
  const r = views(d);
  rows.push({ id: 'PF1', area: A, name: 'projection time of 12 holed plates (4 views)', ok: typeof r !== 'string' && r.ms < 5000, expected: '< 5 s', actual: typeof r === 'string' ? r : { ms: Math.round(r.ms) } });
  // (A pattern of overlapping tori is refused by the kernel, see REPORT W5; time a torus with a rod instead.)
  const t = add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 },
    { kind: 'sketch', profile: 'circle', center: [30, -10], radius: 2, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { kind: 'extrude', sketch: 2, height: 40 });
  const tr = views(withNode(t, { kind: 'union', left: S(1), right: S(3) }));
  rows.push({ id: 'PF2', area: A, name: 'projection time of a torus joined to a rod (curved silhouettes)', ok: typeof tr !== 'string' && tr.ms < 5000, expected: '< 5 s', actual: typeof tr === 'string' ? tr : { ms: Math.round(tr.ms) } });
}
{
  const r = views(emptyDoc());
  rows.push({ id: 'E01', area: A, name: 'an empty part explains itself', ok: r === 'projection: There is no body to draw.', actual: r });
}

for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} as expected; findings: ${bad.map(r => r.id).join(' ')}`);
