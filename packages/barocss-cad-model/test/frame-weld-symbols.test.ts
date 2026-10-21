import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing, type ViewId } from '../src/drawing/types';
import { inView } from '../src/drawing/dimensions';
import { fromSheet } from '../src/drawing/views';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { weldList } from '../src/frames/welds';

// FRd2 (O119): weld symbols in the views, our own glyphs — on the welded table every joint shown once (or said unshown),
// each arrow's tip on the midpoint of a visible edge of its joint's end face found by name in its view; the W-number, the
// size and the rings in the SVG, PDF and DXF; after a parameter edit moves a mitred corner (w 300 → 400), the same joint's
// arrow resolves by the same edge name and moves 100 along the view's x.

const root = resolve(import.meta.dirname, '..');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function table(): Promise<ChatState> {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures/frame-welded-table.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of calls.slice(0, 1)) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, r.content); state = r.state; }
  return state;
}
const sheetOf = (doc: StudioDoc, sheet: 'A3' | 'A4' = 'A3') => {
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet, weldSymbols: true });
  assert.ok(typeof i !== 'string', String(i));
  return { i, ctx: issueContext({ ...i, meta: { ...i.meta, date: '2026-10-21' } }) };
};
/** A placed arrow's tip against the midpoint of its named edge in its view (view coordinates). */
function onEdge(i: Exclude<ReturnType<typeof drawingInputs>, string>, layout: ReturnType<typeof issueContext>['layout'], p: { view: ViewId; tip: readonly [number, number] | number[]; edge: string }) {
  const pr = i.views[p.view], v = layout.views[p.view], at = fromSheet(v, p.tip);
  const e = pr.edges.find(x => x.name === p.edge && x.ends && Math.hypot(...(([0, 1] as const).map(k => (inView(pr, x.ends![0])[k] + inView(pr, x.ends![1])[k]) / 2 - at[k]) as [number, number])) < 1e-6);
  assert.ok(e, `${p.edge}: no such edge under the tip in ${p.view}`);
  assert.ok(e!.pieces.some(q => q.visible), `${p.edge} visible`);
  return at;
}

test('FRd2 the welded table\'s weld symbols on A3: every one of its 16 joints once (shown or said unshown), each arrow on the midpoint of a visible edge of its end face, found by name; W-numbers, sizes and rings in the SVG, PDF and DXF', async () => {
  const s = await table(), joints = weldList(s.doc, s.bodies).joints, { i, ctx } = sheetOf(s.doc), w = ctx.sheet.welds!;
  assert.equal(w.placed.length + w.unshown.length, 16);
  // (W8 and W13–W16 lie behind other members in every view: said in the issue list, the weld list holds them.)
  assert.deepEqual(w.unshown, ['W8', 'W13', 'W14', 'W15', 'W16']);
  const issue = drawingIssues(ctx).find(x => x.code === 'WELD_NOT_SHOWN');
  assert.ok(issue && issue.severity === 'warning' && /^Welds W8, W13, W14, W15, W16: no edge of the joint is visible/.test(issue.message), JSON.stringify(issue));
  assert.equal(w.placed.length, 11, `${w.placed.length} shown; unshown ${w.unshown}`);
  assert.equal(new Set(w.placed.map(p => p.label)).size, w.placed.length, 'each joint once');
  for (const p of w.placed) {
    const j = joints[Number(p.label.slice(1)) - 1];
    assert.equal(p.joint, j.id); assert.ok(p.edge.split('|').includes(j.face), `${p.edge} is an edge of ${j.face}`);
    onEdge(i, ctx.layout, p);
  }
  const groups = ctx.sheet.groups.filter(g => g.role === 'weld');
  assert.deepEqual(groups.map(g => g.id).sort(), w.placed.map(p => p.label).sort());
  // (Each symbol: the leader and reference lines, the arrowhead, the mark, the size 3* and its W-number; all round, a ring.)
  for (const g of groups) {
    const texts = g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text);
    assert.deepEqual(texts, ['3*', g.id]); assert.equal(g.marks.filter(m => m.kind === 'arc').length, 1); assert.equal(g.marks.filter(m => m.kind === 'fill').length, 1);
  }
  const svg = sheetSvg(ctx.sheet, 'welded-table'), pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'welded-table')), dxf = sheetDxf(ctx.sheet, ctx.layout).text;
  for (const p of w.placed) { assert.ok(svg.includes(`>${p.label}</text>`), `SVG ${p.label}`); assert.ok(pdf.includes(`(${p.label}) Tj`), `PDF ${p.label}`); assert.ok(dxf.includes(`\n${p.label}\n`), `DXF ${p.label}`); }
  // (Off by default: no symbols without the setting.)
  const off = drawingInputs(s.doc, { ...readDrawing(s.doc.drawing), sheet: 'A3' }); assert.ok(typeof off !== 'string');
  assert.equal(issueContext({ ...off, meta: { ...off.meta, date: '2026-10-21' } }).sheet.groups.filter(g => g.role === 'weld').length, 0);
});

test('FRd2 a seam\'s arrow follows a parameter edit: a mitred L 40 × 40 × 3 with its corner at x = w — w 300 → 400, the corner\'s joint keeps its id, its arrow resolves by the same edge name and moves 100 along the front view\'s x', async () => {
  const L = (w: number): StudioDoc => withNode({ ...emptyDoc(), parameters: { w } }, { kind: 'frame', points: [[0, 0, 0], [{ parameter: 'w' }, 0, 0], [{ parameter: 'w' }, 200, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } } as never);
  const at = (w: number) => {
    const doc = L(w), { i, ctx } = sheetOf(doc, 'A3'), p = ctx.sheet.welds!.placed;
    assert.equal(p.length, 1, JSON.stringify(ctx.sheet.welds));
    return { joint: p[0].joint, edge: p[0].edge, view: p[0].view, x: onEdge(i, ctx.layout, p[0])[0] };
  };
  const a = at(300), b = at(400);
  assert.equal(b.joint, a.joint); assert.equal(b.edge, a.edge); assert.equal(b.view, 'front');
  assert.ok(Math.abs(b.x - a.x - 100) <= 1e-6, `${a.x} → ${b.x}`);
});
