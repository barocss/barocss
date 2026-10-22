import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { weldList, weldListSource } from '../src/frames/welds';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';

// FRd1 (O118): a frame's weld joints read off its geometry against closed forms (FR S0's P1) — the welded table (FR4b,
// sharp 40 × 40 × 3 tubes): 4 mitred corners, each seam the mitre face's outer loop 2 · (40 + 40√2); 8 lower-rail ends
// butted on the legs, each the tube's outline 4 · 40 = 160; 4 legs standing under the top's corners, found by contact
// (no corner joins them), each 160 meeting two rails. Sizes unset: the thinner wall, 3 mm, an estimate, said. Each end's
// bore (2(34 + 34√2) at a mitre, 4 · 34 elsewhere) welded only where the person says so: unsaid, not counted, said.

const root = resolve(import.meta.dirname, '..');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function table(): Promise<ChatState> {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures/frame-welded-table.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of calls.slice(0, 1)) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, r.content); state = r.state; }
  return state;
}
const MITRE = 2 * (40 + 40 * Math.SQRT2), SQUARE = 160, BORE_MITRE = 2 * (34 + 34 * Math.SQRT2), BORE = 4 * 34;

test('FRd1 the welded table\'s joints by closed form: 4 mitres 2 · (40 + 40√2) (butt welds), 8 butts and 4 legs on the top 160 each (fillets), 16 in all; every size the thinner wall, 3 mm, an estimate', async () => {
  const s = await table(), w = weldList(s.doc, s.bodies);
  const by = (k: string) => w.joints.filter(j => j.kind === k);
  assert.deepEqual([by('mitre').length, by('butt').length, by('on-face').length], [4, 8, 4], JSON.stringify(w.joints.map(j => [j.id, j.kind, j.meets])));
  for (const j of by('mitre')) { assert.ok(Math.abs(j.seamMM - MITRE) <= 1e-6, `${j.id} ${j.seamMM}`); assert.equal(j.weld.kind, 'butt'); assert.equal(j.seamBasis, 'exact'); }
  for (const j of [...by('butt'), ...by('on-face')]) { assert.ok(Math.abs(j.seamMM - SQUARE) <= 1e-6, `${j.id} ${j.seamMM}`); assert.equal(j.weld.kind, 'fillet'); }
  for (const j of by('on-face')) assert.equal(j.meets.length, 2, `${j.id} meets ${j.meets}`);
  for (const j of w.joints) assert.deepEqual([j.weld.sizeMM, j.weld.sizeBasis, j.weld.allRound], [3, 'estimate', true]);
  // (Each end's bore: its loop given, welded or not unsaid — never a default — so not in the seams.)
  for (const j of w.joints) { assert.equal(j.innerLoop!.welded, null); assert.ok(Math.abs(j.innerLoop!.mm - (j.kind === 'mitre' ? BORE_MITRE : BORE)) <= 1e-6, `${j.id} bore ${j.innerLoop!.mm}`); assert.equal(j.weldMM, j.seamMM); }
  assert.equal(w.totals.innerUnset, 16); assert.match(w.notes.join(' '), /inner loop .* yours to say .* none assumed/);
  assert.equal(new Set(w.joints.map(j => j.id)).size, 16, 'one id a joint');
  // (Ids by body and end: a corner by its lesser end — the first, b0_part0's start with b0_part3's end.)
  assert.equal(by('mitre')[0].id, 'b0_part0.start'); assert.deepEqual(by('mitre')[0].meets, ['b0_part3']);
  assert.ok(Math.abs(w.totals.seamMM - (4 * MITRE + 12 * SQUARE)) <= 1e-5, String(w.totals.seamMM));
  assert.match(w.notes.join(' '), /thinner wall .* an estimate/);
});

test('FRd1 the person\'s welds through the chat: a mitre set to a 4 mm fillet with a note — weld_list shows it set, the rest estimated; a joint the part lacks refused (WELD_JOINT_UNKNOWN, the ids listed); a record whose joint is gone listed as orphaned, not dropped', async () => {
  let s = await table();
  const before = JSON.parse((await dispatchTool(s, 'weld_list', {}, evaluate)).content), mitre = before.joints.find((j: { kind: string }) => j.kind === 'mitre');
  assert.equal(before.joints[0].label, 'W1');
  let r = await dispatchTool(s, 'set_welds', { welds: [{ joint: mitre.id, kind: 'fillet', size: 4, inner: true, notes: 'grind flush' }, { joint: 'b0_part8.start', inner: false }] }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  const after = JSON.parse((await dispatchTool(s, 'weld_list', {}, evaluate)).content), j = after.joints.find((x: { id: string }) => x.id === mitre.id);
  assert.deepEqual(j.weld, { kind: 'fillet', sizeMM: 4, sizeBasis: 'set', allRound: true, notes: 'grind flush' });
  assert.equal(after.joints.filter((x: { weld: { sizeBasis: string } }) => x.weld.sizeBasis === 'estimate').length, 15);
  // (The bore welded where said: the mitre's seam with its inner loop; the butt's said not; the other 14 still unsaid.)
  assert.equal(j.innerLoop.welded, true); assert.ok(Math.abs(j.weldMM - (MITRE + BORE_MITRE)) <= 1e-6, String(j.weldMM));
  assert.equal(after.joints.find((x: { id: string }) => x.id === 'b0_part8.start').innerLoop.welded, false);
  assert.equal(after.totals.innerUnset, 14); assert.ok(Math.abs(after.totals.seamMM - (4 * MITRE + 12 * SQUARE + BORE_MITRE)) <= 1e-5, String(after.totals.seamMM));
  r = await dispatchTool(s, 'set_welds', { welds: [{ joint: 'b9.side', size: 3 }] }, evaluate);
  assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /^\[WELD_JOINT_UNKNOWN\] weld 0: no joint "b9\.side" \(joints: .*\)/);
  for (const [welds, re] of [[[{ joint: mitre.id, size: 0 }], /size is mm/], [[{ joint: mitre.id, kind: 'spot' }], /kind is fillet or butt/], [[{ joint: mitre.id, colour: 1 }], /no field "colour"/], [[{ joint: mitre.id, inner: 'yes' }], /inner .* is true or false/]] as const) {
    const x = await dispatchTool(s, 'set_welds', { welds } as never, evaluate); assert.ok(x.isError); assert.match(JSON.parse(x.content).error, re);
  }
  // (The record stays when its joint goes: here the frame's corners made butts, so the mitre's id is no joint.)
  const frame = s.doc.nodes.findIndex(n => n.kind === 'frame');
  r = await dispatchTool(s, 'edit_feature', { index: frame, feature: { ...s.doc.nodes[frame], corners: { default: 'butt', tee: 'butt' } } }, evaluate); assert.ok(!r.isError, r.content);
  const gone = JSON.parse((await dispatchTool(r.state, 'weld_list', {}, evaluate)).content);
  assert.deepEqual(gone.orphaned.map((o: { joint: string }) => o.joint), [mitre.id]);
});

test('FRd1 the weld list on the drawing (the \'weld-list\' table, beside the cut list): W1–W16, the members by their cut-list items, the estimated sizes starred, the seams\' total; clear on A3', async () => {
  const s = await table(), content = weldListSource({ doc: s.doc, bodies: s.bodies });
  assert.ok(!('error' in content), JSON.stringify(content));
  assert.equal(content.title, 'WELD LIST'); assert.deepEqual(content.columns.map(c => c.label), ['WELD', 'JOINT', 'ITEMS', 'WELD KIND', 'SIZE', 'SEAM', 'BORE', 'ALL ROUND']);
  assert.ok(content.rows.every(r => r[6] === '?'), 'every bore unsaid');
  assert.deepEqual(content.rows.map(r => r[0]), Array.from({ length: 16 }, (_, k) => `W${k + 1}`));
  assert.ok(content.rows.every(r => r[4] === '3*'));
  // (The cut list's rows: 1 the 1000 rails, 2 the 600s, 3 the legs, 4 the 960s, 5 the 560s — a mitre joins a 1 and a 2.)
  assert.ok(content.rows.filter(r => r[1] === 'MITRE').every(r => r[2] === '1 · 2' || r[2] === '2 · 1'), JSON.stringify(content.rows));
  assert.match(content.notes![0], /^16 welds, seams 2692\.5 mm in all \(the bores marked \? not counted\)$/); assert.equal(content.notes![1], 'BORE ?: whether the inner loop is welded is not said'); assert.match(content.notes![2], /^\* the thinner wall .* an estimate/);
  const settings = { ...readDrawing(s.doc.drawing), sheet: 'A3' as const, tables: [{ id: 'weld-list', from: 'weld-list' }] }, i = drawingInputs(s.doc, settings);
  assert.ok(typeof i !== 'string', String(i));
  const ctx = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-21' } });
  assert.ok(ctx.sheet.groups.some(g => g.role === 'table' && g.id === 'weld-list'));
  assert.deepEqual(drawingIssues(ctx).filter(x => x.tables?.includes('weld-list')).map(x => x.code), []);
});

test('FRd1 a seam along curved sides: an RHS 20 × 20 × 2 with 3 mm outer corners butted in a T on a sharp 40 × 40 × 3 — the seam the display mesh\'s loop, below 2(20 + 20) − 8 · 3 + 2π · 3 = 74.850 and within 0.5 % of it, said as basis mesh; the size the thinner wall, 2', async () => {
  const doc = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [200, 0, 0], [200, 300, 0]], segments: [[0, 1], [2, 3]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 },
    overrides: [{ member: 1, section: { kind: 'rect-tube', width: 20, height: 20, wall: 2, outerRadius: 3 } }], corners: { tee: 'butt' } } as never);
  const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const w = weldList(doc, r.bodies);
  assert.equal(w.joints.length, 1, JSON.stringify(w.joints.map(j => [j.id, j.kind])));
  const j = w.joints[0], exact = 80 - 24 + 6 * Math.PI;
  assert.equal(j.kind, 'butt'); assert.equal(j.seamBasis, 'mesh'); assert.equal(j.weld.sizeMM, 2);
  assert.ok(j.seamMM <= exact + 1e-9 && j.seamMM > 0.995 * exact, `${j.seamMM} vs ${exact}`);
});

test('A9-1 a table frame\'s top corners, three members trimmed in order: the leg runs through (no joint at its run-on end); each rail end is a butt on its leg — 8 joints of 160, sizes 3 (estimate); the person\'s records taken; a bead there refused by the kernel, said, the part still built', async () => {
  const RHS = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  const lib = await dispatchTool(s, 'features', { action: 'frame_sections', rows: [{ id: 'R40', name: 'RHS 40', section: RHS, source: 'a test value' }] }, evaluate); assert.ok(!lib.isError, lib.content); s = lib.state;
  const f = await dispatchTool(s, 'features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } }, evaluate);
  assert.ok(!f.isError, f.content); s = f.state;
  const w = weldList(s.doc, s.bodies), rails = ['b0_part4', 'b0_part5', 'b0_part6', 'b0_part7'], legs = ['b0_part0', 'b0_part1', 'b0_part2', 'b0_part3'];
  assert.deepEqual(w.joints.map(j => j.id).sort(), rails.flatMap(r => [`${r}.end`, `${r}.start`]).sort());
  for (const j of w.joints) {
    assert.equal(j.kind, 'butt'); assert.equal(j.meets.length, 1); assert.ok(legs.includes(j.meets[0]), `${j.id} meets ${j.meets}`);
    assert.ok(Math.abs(j.seamMM - SQUARE) < 1e-6 && j.seamBasis === 'exact', `${j.id}: ${j.seamMM}`);
    assert.deepEqual([j.weld.kind, j.weld.sizeMM, j.weld.sizeBasis], ['fillet', 3, 'estimate']);
  }
  // (Each leg meets the two rails of its corner — one rail's trim names the other rail; its end face lies on the leg.)
  for (const leg of legs) assert.equal(w.joints.filter(j => j.meets[0] === leg).length, 2, leg);
  const r = await dispatchTool(s, 'features', { action: 'welds', welds: w.joints.map(j => ({ joint: j.id, size: 3 })) }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const after = weldList(s.doc, s.bodies);
  assert.equal(after.joints.length, 8);
  for (const j of after.joints) assert.ok(j.bead && 'refused' in j.bead && /^\[BEAD_SEAM_NOT_PLANAR\]/.test(j.bead.refused), JSON.stringify(j.bead));
  assert.equal(s.bodies.filter(b => b.cutPiece).length, 8, 'the frame still built');
});
