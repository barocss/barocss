import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, fixAll, issueContext } from '../src/drawing/issues';
import { readDrawing, type ViewId } from '../src/drawing/types';
import { inView } from '../src/drawing/dimensions';
import { fromSheet } from '../src/drawing/views';
import { sheetSvg } from '../src/io/svg';
import { sheetPdf } from '../src/io/pdf';
import { sheetDxf } from '../src/io/dxf';
import { weldList } from '../src/frames/welds';

// FRd2 (O119): weld symbols in the views, our own glyphs — on the welded table every joint shown once (O173: all 16),
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
  // (No pieces: wholly on visible ink, BrepProjection's contract — visible, another edge draws it; O173.)
  assert.ok(!e!.pieces.length || e!.pieces.some(q => q.visible), `${p.edge} visible`);
  return at;
}

test('FRd2 the welded table\'s weld symbols on A3: every one of its 16 joints once (shown or said unshown), each arrow on the midpoint of a visible edge of its end face, found by name; W-numbers, sizes and rings in the SVG, PDF and DXF', async () => {
  const s = await table(), joints = weldList(s.doc, s.bodies).joints, { i, ctx } = sheetOf(s.doc), w = ctx.sheet.welds!;
  assert.equal(w.placed.length + w.unshown.length, 16);
  // (O173: every joint is shown. W8 and W13–W16 were said unshown, "behind other members": their seam edges lie on
  // another member's visible outline — no pieces, wholly on visible ink — and a trimmed end face comes in pieces (#1),
  // each the face's. Neither had been read as seen.)
  assert.deepEqual(w.unshown, []);
  assert.equal(drawingIssues(ctx).find(x => x.code === 'WELD_NOT_SHOWN'), undefined);
  assert.equal(w.placed.length, 16, `${w.placed.length} shown; unshown ${w.unshown}`);
  assert.equal(new Set(w.placed.map(p => p.label)).size, w.placed.length, 'each joint once');
  for (const p of w.placed) {
    const j = joints[Number(p.label.slice(1)) - 1];
    assert.equal(p.joint, j.id); assert.ok(p.edge.split('|').some(f => f.replace(/#\d+$/, '') === j.face), `${p.edge} is an edge of ${j.face}`);
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

test('FRd2 weld symbols in the issue list\'s overlap checks: the welded table on A3 with both lists — no clash of a symbol with another, a dimension or a table; a note put on W1\'s number — TEXT_OVERLAP naming the symbol, the note the one moved, Fix all clears it', async () => {
  const s = await table();
  const base = { ...readDrawing(s.doc.drawing), sheet: 'A3' as const, weldSymbols: true, tables: [{ id: 'cut-list', from: 'cut-list' }, { id: 'weld-list', from: 'weld-list' }] };
  const i = drawingInputs(s.doc, base); assert.ok(typeof i !== 'string', String(i));
  const ctx = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-21' } });
  assert.deepEqual(drawingIssues(ctx).filter(x => x.welds?.length), [], 'clear');
  const w1 = ctx.sheet.groups.find(g => g.role === 'weld' && g.id === 'W1')!, label = w1.marks.find(m => m.kind === 'text' && (m as { text: string }).text === 'W1') as { at: [number, number] };
  const crowded = { ...base, notes: [{ id: 'nt', text: 'GRIND ALL WELDS', at: [label.at[0] - 12, label.at[1]] as [number, number] }] };
  const i2 = drawingInputs(s.doc, crowded); assert.ok(typeof i2 !== 'string');
  const in2 = { ...i2, meta: { ...i2.meta, date: '2026-10-21' } }, issues = drawingIssues(issueContext(in2));
  const clash = issues.find(x => x.code === 'TEXT_OVERLAP' && x.welds?.includes('W1'));
  assert.ok(clash && /weld symbol W1/.test(clash.message) && clash.notes?.includes('nt') && clash.fix?.kind === 'move-note', JSON.stringify(issues.filter(x => x.welds)));
  assert.deepEqual(fixAll(in2).left.filter(x => x.welds?.length), [], 'Fix all moves the note clear');
});
