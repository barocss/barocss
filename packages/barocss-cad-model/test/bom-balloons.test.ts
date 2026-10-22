import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editRingRows } from '../src/engine/rings';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing, type DrawingSettings, type ViewId, type XY } from '../src/drawing/types';
import { fromSheet } from '../src/drawing/views';
import { balloonMarks } from '../src/drawing/balloons';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import type { ProjectedCurve } from '@barocss/cad';

// O147 B2: the BOM on the drawing — the 'bom' table numbered as the BOM panel and the purchase list number it, and one
// balloon a line on the iso view (the front view without it), each leading to a visible edge of an instance of its
// item, found by name; clear of the views and the texts on A3, in the SVG, PDF and DXF; said when a line shows no edge
// or a balloon finds no room.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
function run(doc: StudioDoc, id: string, pick: { bodies?: number[] }, values: Record<string, number | string> = {}) {
  const bodies = evaluated(doc);
  const ctx: Ctx = { doc, bodies, selection: { faces: [], edges: [], bodies: (pick.bodies ?? []).map(node => bodies.findIndex(b => b.ref?.node === node)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
function part(): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  const t = editRingRows(doc, [{ id: 'r20', shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, source: 'the maker\'s sheet' }]); assert.ok('doc' in t); doc = t.doc;
  doc = run(doc, 'retaining-ring', { bodies: [0] });
  return run(doc, 'pin', { bodies: [0] });
}
const asm = (p: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [0, 1].map(k => ({ id: `i${k}`, name: `shaft ${k}`, doc: p, position: [0, 60 * k, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] })) });
const sheetOf = (doc: StudioDoc, extra: Partial<DrawingSettings> = {}) => {
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }], ...extra });
  assert.ok(typeof i !== 'string', String(i));
  const meta = { ...i.meta, date: '2026-10-22' };
  return { i: { ...i, meta }, ctx: issueContext({ ...i, meta }) };
};
/** Whether a point (view coordinates) lies on a projected curve: exactly on a line or an arc, within 1e-6. */
function onCurve(c: ProjectedCurve, p: XY): boolean {
  if (c.kind === 'line') { const d = [c.b[0] - c.a[0], c.b[1] - c.a[1]], l2 = d[0] ** 2 + d[1] ** 2, s = ((p[0] - c.a[0]) * d[0] + (p[1] - c.a[1]) * d[1]) / l2; return s >= -1e-9 && s <= 1 + 1e-9 && Math.hypot(c.a[0] + s * d[0] - p[0], c.a[1] + s * d[1] - p[1]) < 1e-6; }
  if (c.kind === 'arc') {
    const q = [p[0] - c.center[0], p[1] - c.center[1]], det = c.u[0] * c.v[1] - c.v[0] * c.u[1];
    const co = (q[0] * c.v[1] - c.v[0] * q[1]) / det, si = (c.u[0] * q[1] - q[0] * c.u[1]) / det;
    return Math.abs(Math.hypot(co, si) - 1) < 1e-6;
  }
  return c.points.some((a, k) => k > 0 && onCurve({ kind: 'line', a: c.points[k - 1], b: a }, p));
}

test('the BOM table and its balloons: 2 copies — 4 lines numbered 1–4, 4 balloons 1–4 on the iso view, each tip on a visible edge of its item; nothing clashes on A3; in the SVG, PDF and DXF', () => {
  const doc = asm(part()), { i, ctx } = sheetOf(doc);
  const content = i.meta.tableContent!({ id: 'bom', from: 'bom' });
  assert.ok(!('error' in content), 'error' in content ? content.error : '');
  assert.deepEqual(content.rows.map(r => [r[0], r[1], r[2]]), [[1, 'shaft 0', 2], [2, 'key 6 × 6 × 18', 2], [3, 'retaining-ring Ø19 / Ø24 × 1.2', 2], [4, 'pin Ø4 × 20', 2]]);
  assert.deepEqual(content.rows.map(r => r[6]), ['made', 'bought', 'bought', 'bought']);
  const b = ctx.sheet.balloons!;
  assert.deepEqual(b.placed.map(p => [p.no, p.view]), [[1, 'iso'], [2, 'iso'], [3, 'iso'], [4, 'iso']]);
  assert.deepEqual([b.unclear, b.noEdge], [[], []]);
  // (Each tip on a visible piece of its named edge; the edge an instance's — the part's own shape for line 1, the element's node for the rest.)
  const node: Record<number, string | null> = { 1: null, 2: 'n1', 3: 'n2', 4: 'n3' };
  for (const p of b.placed) {
    const pr = i.views[p.view as ViewId], at = fromSheet(ctx.layout.views[p.view], p.tip), e = pr.edges.find(x => x.name === p.edge)!;
    assert.ok(e.pieces.some(x => x.visible && onCurve(x.curve, at)), `balloon ${p.no}: its tip is not on a visible piece of ${p.edge}`);
    assert.match(p.edge, /^i[01]\//);
    const faces = p.edge.slice(3).split('|');
    if (node[p.no]) assert.ok(faces.some(f => f.startsWith(`${node[p.no]}.`)), `balloon ${p.no}: ${p.edge}`);
    else assert.ok(faces.every(f => !/^n[123]\./.test(f)), `balloon 1 on an element's edge: ${p.edge}`);
  }
  // (Nothing on the sheet clashes: the only issues are what a sheet with no dimensions yet lacks.)
  assert.deepEqual(drawingIssues(ctx).map(x => x.code), ['HOLE_SIZE_MISSING', 'HOLE_NOT_LOCATED', 'STEP_NOT_LOCATED', 'OVERALL_MISSING']);
  // (Each balloon a circle with its number and a leader to an arrow; in every format.)
  const groups = ctx.sheet.groups.filter(g => g.role === 'balloon');
  assert.deepEqual(groups.map(g => [g.id, g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text), g.marks.filter(m => m.kind === 'arc').length, g.marks.filter(m => m.kind === 'fill').length]), [1, 2, 3, 4].map(n => [String(n), [String(n)], 1, 1]).sort((x, y) => groups.findIndex(g => g.id === x[0]) - groups.findIndex(g => g.id === y[0])));
  const svg = sheetSvg(ctx.sheet, 'asm'), pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'asm')), dxf = sheetDxf(ctx.sheet, ctx.layout).text;
  assert.equal(svg.split('<g class="balloon"').length - 1, 4);
  for (const g of groups) assert.ok(svg.includes(`data-dim="${g.id}">`) && svg.includes(`>${g.id}</text>`), `SVG ${g.id}`);
  assert.ok(pdf.includes('(BILL OF MATERIALS) Tj') && [1, 2, 3, 4].every(n => pdf.includes(`(${n}) Tj`)), 'PDF');
  assert.ok(dxf.includes('\nBILL OF MATERIALS\n') && [1, 2, 3, 4].every(n => dxf.includes(`\n${n}\n`)), 'DXF');
  // (Off by default: no balloons, and no BOM worked out when nothing reads it.)
  const off = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3' }); assert.ok(typeof off !== 'string');
  assert.equal(off.meta.bom, undefined);
  assert.equal(issueContext({ ...off, meta: { ...off.meta, date: '2026-10-22' } }).sheet.groups.filter(g => g.role === 'balloon').length, 0);
});

test('balloons on the front view when the iso is not shown; a line with no visible edge said (BALLOON_NO_EDGE); no room said (BALLOON_NOT_CLEAR); the table with no BOM says so', () => {
  const doc = asm(part()), front = sheetOf(doc, { views: ['front', 'top'] });
  assert.deepEqual(front.ctx.sheet.balloons!.placed.map(p => p.view), ['front', 'front', 'front', 'front']);
  const { i, ctx } = sheetOf(doc), bom = i.meta.bom!;
  const more = { ...bom, lines: [...bom.lines, { item: 'a part not placed', parts: ['i9'], qty: 1, material: null, massG: 0, source: null }] };
  const missing = issueContext({ ...i, meta: { ...i.meta, bom: more } });
  assert.deepEqual(missing.sheet.balloons!.noEdge, [5]);
  assert.match(drawingIssues(missing).find(x => x.code === 'BALLOON_NO_EDGE')!.message, /^BOM line 5: no edge of its item is visible in the iso view/);
  const none = balloonMarks(ctx.layout, i.views, bom, [ctx.layout.frame]);
  assert.deepEqual([none.unclear, none.placed.length], [[1, 2, 3, 4], 4]);
  const tight = { ...ctx.sheet, balloons: { placed: none.placed, unclear: none.unclear, noEdge: [] } };
  assert.match(drawingIssues({ ...ctx, sheet: tight }).find(x => x.code === 'BALLOON_NOT_CLEAR')!.message, /^Balloons 1, 2, 3, 4: no clear room beside the iso view/);
  assert.deepEqual(i.meta.tableContent!({ id: 'x', from: 'bom' }) && issueContext({ ...i, meta: { ...i.meta, tableContent: () => ({ error: 'the BOM was not worked out for this sheet' }) } }).sheet.tables!.map(t => t.error), ['the BOM was not worked out for this sheet']);
});

test('balloons keep clear of a table pinned by `at`: the BOM table pinned where balloon 1 stood — the balloons move off it; nothing overlaps', () => {
  const doc = asm(part()), { ctx } = sheetOf(doc), was = ctx.sheet.balloons!.placed.find(p => p.no === 1)!;
  const at: XY = [was.at[0] - 6, was.at[1] - 6];
  const { ctx: c2 } = sheetOf(doc, { tables: [{ id: 'bom', from: 'bom', at }] });
  const t = c2.sheet.tables!.find(x => x.id === 'bom')!.box, R = 3.5;
  assert.ok(t[0] <= was.at[0] && was.at[0] <= t[2] && t[1] <= was.at[1] && was.at[1] <= t[3], 'the table covers where balloon 1 was');
  for (const p of c2.sheet.balloons!.placed) assert.ok(p.at[0] + R <= t[0] || p.at[0] - R >= t[2] || p.at[1] + R <= t[1] || p.at[1] - R >= t[3], `balloon ${p.no} at ${p.at} on the table ${t}`);
  assert.deepEqual(c2.sheet.balloons!.unclear, []);
  // (The table where it was pinned may meet a view's name — that is the person's placing, said as ever; no balloon is in it.)
  assert.deepEqual(drawingIssues(c2).filter(x => /OVERLAP|OVER_LINES|BALLOON/.test(x.code) && /balloon/i.test(x.message)).map(x => x.message), []);
});
