// QA probe: the exported drawing files checked numerically. Builds sheets exactly as the workspace does
// (brepsFor → projectViews → layoutSheet → buildSheet → sheetSvg / sheetPdf), parses the SVG back into
// lines by pen and compares their positions with the model geometry mapped through the view placement;
// centre marks, hidden lines, instances, the title block and the PDF's stroke count are checked too.
//   node test/qa/run-engine-probe.mjs drawing-svg-probe.ts
import { brepsFor } from '../../src/engine/evaluate';
import { emptyDoc, rectanglePart, starterDoc, withNode, type ModelNode, type PartInstance, type StudioDoc } from '../../src/engine/doc';
import { projectViews } from '../../src/drawing/project';
import { layoutSheet, toSheet } from '../../src/drawing/views';
import { buildSheet, PENS } from '../../src/drawing/sheet';
import { sheetSvg } from '../../src/drawing/svg';
import { sheetPdf } from '../../src/drawing/pdf';
import { resolveDimension, snapPoints } from '../../src/drawing/dimensions';
import { defaultDrawing, type DrawingSettings, type DrawingViews, type ViewId } from '../../src/drawing/types';

type Row = { id: string; area: string; name: string; ok: boolean; expected?: unknown; actual?: unknown };
const rows: Row[] = [], A = '[drawing]';
const S = (n: number) => ({ node: n, side: 'solid' as const });
const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce((d, n) => withNode(d, n), doc);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

interface Line { x1: number; y1: number; x2: number; y2: number; pen: string; view: string }
function sheetOf(doc: StudioDoc, settings: DrawingSettings = defaultDrawing(), title = 'QA') {
  const b = brepsFor(doc); if ('error' in b) throw new Error(b.error);
  const r = projectViews(b.breps, b.prefixes); if (!r.ok) throw new Error(r.error);
  const layout = layoutSheet(r.views, settings), sheet = buildSheet(r.views, layout, settings, { title, date: '2026-10-16' });
  const svg = sheetSvg(sheet, title), pdf = Array.from(sheetPdf(sheet, title), c => String.fromCharCode(c)).join('');
  // Parse the SVG back: <g … data-view="front"> … <line …/> with its stroke style naming the pen.
  const lines: Line[] = [], counts: Record<string, Record<string, number>> = {};
  const penOf = (style: string) => { const w = /stroke-width="([\d.]+)"/.exec(style)?.[1], d = /stroke-dasharray="([^"]+)"/.exec(style)?.[1];
    return Object.entries(PENS).find(([, p]) => String(p.width) === w && (p.dash?.join(' ') ?? '') === (d ?? ''))?.[0] ?? `?${w}/${d}`; };
  for (const g of svg.matchAll(/<g class="([^"]+)"(?: data-view="(\w+)")?[^>]*>(.*?)<\/g>/g)) {
    const view = g[2] ?? g[1];
    for (const el of g[3].matchAll(/<(line|polyline|path)\s([^>]*)\/>/g)) {
      const pen = penOf(el[2]); (counts[view] ??= {})[`${el[1]}:${pen}`] = ((counts[view] ?? {})[`${el[1]}:${pen}`] ?? 0) + 1;
      if (el[1] === 'line') { const a = (k: string) => Number(new RegExp(`${k}="([-\\d.]+)"`).exec(el[2])![1]); lines.push({ x1: a('x1'), y1: a('y1'), x2: a('x2'), y2: a('y2'), pen, view }); }
    }
  }
  return { views: r.views, layout, sheet, svg, pdf, lines, counts };
}
/** A line on the sheet between two view points (model mm in the view), either way round. */
function hasLine(s: ReturnType<typeof sheetOf>, view: ViewId, pen: string, a: number[], b: number[], tol = 2e-3) {
  const v = s.layout.views[view], p = toSheet(v, a), q = toSheet(v, b);
  return s.lines.some(l => l.view === view && l.pen === pen && ((Math.hypot(l.x1 - p[0], l.y1 - p[1]) < tol && Math.hypot(l.x2 - q[0], l.y2 - q[1]) < tol) || (Math.hypot(l.x1 - q[0], l.y1 - q[1]) < tol && Math.hypot(l.x2 - p[0], l.y2 - p[1]) < tol)));
}
const linesOf = (s: ReturnType<typeof sheetOf>, view: string, pen: string) => s.lines.filter(l => l.view === view && l.pen === pen);
function run(id: string, name: string, f: () => { ok: boolean; expected?: unknown; actual?: unknown }) {
  try { rows.push({ id, area: A, name, ...f() }); } catch (e) { rows.push({ id, area: A, name, ok: false, actual: 'THREW ' + String(e).slice(0, 200) }); }
}

// ---- The starter plate (64×32×8, Ø8 at 32,16), third angle, A4 1:1.
const P = sheetOf(starterDoc());
run('SV1', 'front view outline: 4 visible lines making the 64 × 8 rectangle', () => {
  const ok = hasLine(P, 'front', 'visible', [0, 0], [64, 0]) && hasLine(P, 'front', 'visible', [64, 0], [64, 8]) && hasLine(P, 'front', 'visible', [64, 8], [0, 8]) && hasLine(P, 'front', 'visible', [0, 8], [0, 0]);
  return { ok: ok && linesOf(P, 'front', 'visible').length === 4, expected: '4 visible lines, corners (0,0)…(64,8) at 1:1', actual: { visible: linesOf(P, 'front', 'visible').length, scale: P.layout.scale } };
});
run('SV2', 'front view hole: 2 dashed hidden lines at x 28 and 36, z 0…8', () => ({
  ok: hasLine(P, 'front', 'hidden', [28, 0], [28, 8]) && hasLine(P, 'front', 'hidden', [36, 0], [36, 8]) && linesOf(P, 'front', 'hidden').length === 2,
  expected: 'x=28 and x=36 dashed (3 1.5), 0.35', actual: linesOf(P, 'front', 'hidden').map(l => [l.x1, l.y1, l.x2, l.y2].map(r3)),
}));
run('SV3', 'right view hole: hidden at y 12 and 20 (right view looks along −X: its horizontal runs along −Y?)', () => {
  const h = linesOf(P, 'right', 'hidden'), v = P.layout.views.right;
  // Which way Y runs in the right view: the view's own 2D frame from the projection.
  const right = P.views.right.right, ySign = Math.sign(right[1]);
  return { ok: h.length === 2 && hasLine(P, 'right', 'hidden', [ySign * 12, 0], [ySign * 12, 8]) && hasLine(P, 'right', 'hidden', [ySign * 20, 0], [ySign * 20, 8]), expected: 'two hidden lines at Y = 12 and 20', actual: { count: h.length, viewRight: right, origin: v.origin } };
});
run('SV4', 'top view: the hole drawn as a full circle R4 (visible), no hidden lines', () => {
  const holes = P.views.top.edges.filter(e => e.circle && Math.abs(e.circle.radius - 4) < 1e-6);
  const paths = (P.counts.top?.['path:visible'] ?? 0);
  return { ok: holes.length > 0 && paths >= 1 && !linesOf(P, 'top', 'hidden').length, actual: { circleEdges: holes.length, svgArcPaths: paths, counts: P.counts.top } };
});
run('SV5', 'centre mark on the hole in the top view: a cross at (32,16), arms 4 + 2.5 mm each side', () => {
  const ok = hasLine(P, 'top', 'center', [32 - 6.5, 16], [32 + 6.5, 16]) && hasLine(P, 'top', 'center', [32, 16 - 6.5], [32, 16 + 6.5]);
  return { ok: ok && linesOf(P, 'top', 'center').length === 2, expected: 'horizontal (25.5,16)–(38.5,16) and vertical (32,9.5)–(32,22.5)', actual: linesOf(P, 'top', 'center').map(l => [l.x1, l.y1, l.x2, l.y2].map(r3)) };
});
run('SV6', 'centreline of the hole in the front view: vertical at x 32 from z −2.5 to 10.5', () => ({
  ok: hasLine(P, 'front', 'center', [32, -2.5], [32, 10.5]) && linesOf(P, 'front', 'center').length === 1,
  actual: linesOf(P, 'front', 'center').map(l => [l.x1, l.y1, l.x2, l.y2].map(r3)),
}));
run('SV7', 'isometric: no hidden and no centre lines', () => ({ ok: !linesOf(P, 'iso', 'hidden').length && !linesOf(P, 'iso', 'center').length, actual: P.counts.iso }));
run('SV8', 'title block texts: title, SCALE 1:1, UNITS mm, SHEET A4, THIRD ANGLE', () => {
  const t = [...P.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
  return { ok: ['QA', '1:1', 'mm', 'A4', 'THIRD ANGLE', 'FRONT', 'TOP', 'RIGHT', 'ISOMETRIC'].every(x => t.includes(x)), actual: t };
});
run('SV9', 'PDF: as many stroked paths as SVG lines + polylines + paths, same dash patterns', () => {
  const svgStrokes = Object.values(P.counts).flatMap(c => Object.entries(c)).reduce((s, [, n]) => s + n, 0);
  const pdfStrokes = (P.pdf.match(/ S\n/g) ?? []).length;
  const dash = (txt: string) => [...txt.matchAll(/\[([\d. ]*)\] 0 d/g)].map(m => m[1]);
  const pdfDashes = [...new Set(dash(P.pdf))].sort(), svgDashes = [...new Set([...P.svg.matchAll(/stroke-dasharray="([^"]+)"/g)].map(m => m[1]))].concat('').sort();
  return { ok: pdfStrokes === svgStrokes && JSON.stringify(pdfDashes) === JSON.stringify(svgDashes), expected: { strokes: svgStrokes, dashes: svgDashes }, actual: { strokes: pdfStrokes, dashes: pdfDashes } };
});
run('SV10', 'SVG prints at true size: width 297mm height 210mm, viewBox 0 0 297 210; front outline 64 sheet-mm wide at 1:1', () => {
  const ok = /width="297mm" height="210mm" viewBox="0 0 297 210"/.test(P.svg);
  const f = linesOf(P, 'front', 'visible').filter(l => Math.abs(l.y1 - l.y2) < 1e-6).map(l => Math.abs(l.x2 - l.x1));
  return { ok: ok && f.every(w => Math.abs(w - 64) < 1e-3), actual: { header: ok, horizontalWidths: f } };
});
run('SV11', 'hidden lines off: no dashed 0.35 strokes in SVG or PDF', () => {
  const s = sheetOf(starterDoc(), { ...defaultDrawing(), hidden: false });
  return { ok: !s.svg.includes('stroke-dasharray="3 1.5"') && !s.pdf.includes('[3 1.5] 0 d'), actual: { svgHidden: s.svg.includes('3 1.5'), pdfHidden: s.pdf.includes('[3 1.5] 0 d') } };
});
run('SV12', 'centre lines off: no chain strokes', () => {
  const s = sheetOf(starterDoc(), { ...defaultDrawing(), centers: false });
  return { ok: !s.svg.includes('8 1.5 1.5 1.5'), actual: { chain: (s.svg.match(/8 1\.5 1\.5 1\.5/g) ?? []).length } };
});

// ---- Other parts.
run('SV13', 'side hole along X (Ø4 at y10, z5 through 20×20×10): round with a cross in the right view, centrelines in front and top', () => {
  const s = sheetOf(withNode(rectanglePart(20, 20, 10), { kind: 'hole', parent: S(1), center: [10, 5], radius: 2, axis: 'x' }));
  // (PAST is 2.5 sheet mm, so in model mm it is 2.5 / scale.)
  const k = 2.5 / s.layout.scale;
  return { ok: linesOf(s, 'right', 'center').length === 2 && hasLine(s, 'front', 'center', [-k, 5], [20 + k, 5]) && linesOf(s, 'top', 'center').length === 1, expected: 'right: cross; front: z=5 from x 0 to 20 plus 2.5 sheet mm each end; top: one centreline', actual: { right: linesOf(s, 'right', 'center').length, front: linesOf(s, 'front', 'center').map(l => [l.x1, l.y1, l.x2, l.y2].map(r3)), top: linesOf(s, 'top', 'center').length } };
});
run('SV14', 'fillet R4 on a vertical edge: an arc, but no centre mark (not a whole circle)', () => {
  const s = sheetOf(withNode(rectanglePart(32, 32, 16), { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.side1'], radius: 4 }));
  return { ok: !linesOf(s, 'top', 'center').length && (s.counts.top?.['path:visible'] ?? 0) >= 1, actual: s.counts.top };
});
run('SV15', 'Ø16 boss on the starter plate: one cross per centre, sized by the largest circle', () => {
  const boss = add(starterDoc(), { kind: 'sketch', profile: 'circle', center: [12, 16], radius: 8 }, { kind: 'extrude', sketch: 3, height: 10, from: 8 }, { kind: 'union', left: S(2), right: S(4) });
  const s = sheetOf(boss);
  return { ok: linesOf(s, 'top', 'center').length === 4 && hasLine(s, 'top', 'center', [12 - 10.5, 16], [12 + 10.5, 16]), expected: '2 crosses (hole and boss); boss arms 8 + 2.5', actual: linesOf(s, 'top', 'center').map(l => [l.x1, l.y1, l.x2, l.y2].map(r3)) };
});
run('SV16', 'a long title stays inside the 120 mm title block', () => {
  const title = 'Bracket-01 assembly with long descriptive name rev C';
  const s = sheetOf(starterDoc(), defaultDrawing(), title);
  const tb = s.layout.title, text = [...s.svg.matchAll(/<text fill="#000" stroke="none" x="([\d.]+)" y="([\d.]+)" font-size="5"[^>]*>([^<]*)<\/text>/g)][0];
  // Helvetica-Bold averages ~0.6 em per character.
  const est = Number(text[1]) + title.length * 5 * 0.6;
  return { ok: est <= tb[2] - 54, expected: `text ends before the projection symbol at x ${tb[2] - 55}`, actual: { start: Number(text[1]), estimatedEnd: r3(est), blockRight: tb[2] } };
});

// ---- Instances on the sheet.
const block: StudioDoc = rectanglePart(10, 10, 4);
const inst = (position: [number, number, number]): PartInstance => ({ id: 'inst1', name: 'block', doc: block, position, rotation: [0, 0, 0] });
run('SV17', 'placed instance drawn beside the plate: top view extents reach x 110, its edges named inst1/…', () => {
  const s = sheetOf({ ...starterDoc(), instances: [inst([100, 0, 0])] });
  const names = s.views.top.edges.filter(e => e.name.startsWith('inst1/')).length;
  return { ok: Math.abs(s.views.top.max[0] - 110) < 1e-6 && names > 0 && hasLine(s, 'front', 'visible', [100, 0], [110, 0]), expected: 'top max x 110; block outline in the front view', actual: { topMax: s.views.top.max, instEdges: names } };
});
run('SV18', 'linear dimension from the plate corner to the instance corner reads 36', () => {
  const s = sheetOf({ ...starterDoc(), instances: [inst([100, 0, 0])] });
  const sp = snapPoints(s.views.front), at = (x: number, z: number) => sp.find(p => Math.abs(p.at[0] - x) < 1e-6 && Math.abs(p.at[1] - z) < 1e-6)?.ref;
  const a = at(64, 0), b = at(100, 0);
  if (!a || !b) return { ok: false, actual: 'snap points missing', expected: { a: !!a, b: !!b } };
  const r = resolveDimension(s.views as DrawingViews, { id: 'd', view: 'front', kind: 'linear', a, b, orient: 'horizontal', place: [82, -10] });
  // Move the instance: the dimension follows it.
  const s2 = sheetOf({ ...starterDoc(), instances: [inst([120, 0, 0])] }), r2 = resolveDimension(s2.views as DrawingViews, { id: 'd', view: 'front', kind: 'linear', a, b, orient: 'horizontal', place: [82, -10] });
  return { ok: r.ok && r.text === '36' && r2.ok && r2.text === '56', expected: ['36', 'after moving the block to x 120: 56'], actual: [r.ok ? r.text : r.reason, r2.ok ? r2.text : r2.reason] };
});
run('SV19', 'instance in front of the plate hides the plate behind it (block at y −20 covering x 10…20)', () => {
  const s = sheetOf({ ...starterDoc(), instances: [{ ...inst([10, -20, 0]), doc: rectanglePart(10, 10, 20) }] });
  // The plate's top edge (z 8) behind the 20-high block is hidden between x 10 and 20.
  const vis = linesOf(s, 'front', 'visible').filter(l => Math.abs(l.y1 - l.y2) < 1e-6 && Math.abs(l.y1 - toSheet(s.layout.views.front, [0, 8])[1]) < 1e-3);
  const spans = vis.map(l => [Math.min(l.x1, l.x2), Math.max(l.x1, l.x2)].map(x => r3((x - s.layout.views.front.origin[0]) / s.layout.scale)));
  return { ok: !spans.some(([a, b]) => a < 19 && b > 11), expected: 'plate top edge not visible over x 10…20', actual: spans };
});
run('SV20', 'a hidden instance is left off the sheet', () => {
  const s = sheetOf({ ...starterDoc(), instances: [{ ...inst([100, 0, 0]), hidden: true }] });
  return { ok: Math.abs(s.views.top.max[0] - 64) < 1e-6, actual: s.views.top.max };
});

for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} as expected; findings: ${bad.map(r => r.id).join(' ')}`);
