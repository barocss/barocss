import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { booleanAnalytic, brepMassProperties, cutList, cutPiece, dxfText, evaluateCadPart } from '@barocss/cad';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { toPartDocument } from '../src/engine/part';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, fixAll, issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { cutListSource } from '../src/app/cutList';

// FR4b (D128): the frames' acceptance — a welded table frame and a 2020-class T-slot frame, each built by the agent's
// tools in one turn from the calls in test/fixtures (the flow sends the same calls through the real chat), and the cut
// list on a drawing sheet as a table (the outer lane's O49). Acceptance by closed forms of the frames' dimensions, none
// read from the build: every member's volume, the cut list's rows and totals, no two members overlapping (welded or
// united, their sum). The kernel's conformance cases fr/accept-* hold the same part documents (WRITE_ACCEPTANCE=1).
const root = resolve(import.meta.dirname, '..'), conformance = join(root, '../../packages/barocss-cad/conformance/fr');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(name: string): Promise<{ state: ChatState; results: string[] }> {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures', `${name}.calls.json`), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  const results: string[] = [];
  for (const c of calls) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); state = r.state; results.push(r.content); }
  return { state, results };
}
const close = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const A_SHARP = 1600 - 34 * 34, RHO = 7850;
/** The tslot-20 section's area by its slots and bore (D123): a² less four slots wo·ds + (wu − wo)²/4, less the bore. */
const A_TSLOT = 400 - 4 * (6.2 * 6.1 + (11 - 6.2) ** 2 / 4) - Math.PI * 2.1 ** 2;
function caseFile(name: string, doc: StudioDoc, about: string, expect: object, oracle: string) {
  const file = join(conformance, `${name}.json`), partDocument = toPartDocument(doc);
  if (process.env.WRITE_ACCEPTANCE) writeFileSync(file, JSON.stringify({ id: `fr-${name}`, step: 'FR', decisions: ['D128'], about, input: { partDocument }, expect, oracle }, null, 2) + '\n');
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).input.partDocument, JSON.parse(JSON.stringify(partDocument)), `${name}: the conformance case holds the part the agent built`);
}
type Row = { quantity: number; axisLengthMM: number; ends: [string, string] };
const rowsOf = (rows: { quantity: number; axisLengthMM: number; ends: readonly { kind: string }[] }[]): Row[] => rows.map(r => ({ quantity: r.quantity, axisLengthMM: Math.round(r.axisLengthMM * 1e9) / 1e9, ends: [r.ends[0].kind, r.ends[1].kind] }));

test('FR4b the welded table frame by the agent: a mitred 1000 × 600 top, four legs 730 under it, lower rails butted on the legs — every member by closed form, welded to one body and its sum; the cut list (5 rows of 12); on the drawing as a table', async () => {
  const { state, results } = await build('frame-welded-table'), bodies = state.bodies;
  assert.equal(bodies.length, 12);
  const lengths = [1000, 600, 1000, 600, 730, 730, 730, 730, 960, 560, 960, 560];
  bodies.forEach((b, k) => close(b.volumeMM3!, A_SHARP * lengths[k], 1e-12, `member ${k}`));
  // The agent's cut list: top rails mitred both ends, legs square, lower rails butted both ends.
  const out = JSON.parse(results[1]);
  assert.deepEqual(rowsOf(out.rows), [
    { quantity: 2, axisLengthMM: 1000, ends: ['mitre', 'mitre'] }, { quantity: 2, axisLengthMM: 600, ends: ['mitre', 'mitre'] },
    { quantity: 4, axisLengthMM: 730, ends: ['square', 'square'] }, { quantity: 2, axisLengthMM: 960, ends: ['butt', 'butt'] }, { quantity: 2, axisLengthMM: 560, ends: ['butt', 'butt'] }]);
  assert.equal(out.totals.quantity, 12); close(out.totals.axisLengthMM, 2 * 1600 + 4 * 730 + 2 * 1520, 1e-12, 'total length');
  assert.match(out.csv, /^item,quantity,section,material/);
  // Welded: the legs stand under the top's corners, the lower rails on the legs' faces — one body, no overlap.
  const snap = evaluateCadPart(toPartDocument(state.doc)), members = snap.outputs.filter(o => o.member);
  let w = members[0].brep; for (const o of members.slice(1)) w = booleanAnalytic(w, o.brep, 'union');
  assert.equal(w.bodies.length, 1); close(brepMassProperties(w, 1).volumeMM3, A_SHARP * lengths.reduce((a, b) => a + b, 0), 1e-12, 'welded');
  // In steel (a test value): the rows' mass ρ·A·L.
  const steel = cutList(members.map(o => cutPiece(o)), { densityKgPerM3: RHO });
  close(steel.totals.massKG, RHO * A_SHARP * lengths.reduce((a, b) => a + b, 0) * 1e-9, 1e-12, 'steel mass');
  // On the drawing: the cut list as a table (the 'cut-list' source), on the sheet and in its SVG.
  const content = cutListSource({ doc: state.doc, bodies });
  assert.ok(!('error' in content), JSON.stringify(content));
  assert.equal(content.title, 'CUT LIST'); assert.deepEqual(content.columns.map(c => c.label), ['ITEM', 'QTY', 'SECTION', 'MATERIAL', 'LENGTH', 'LONG POINT', 'START', 'END', 'MASS EA']);
  assert.deepEqual(content.rows.map(r => [r[1], r[4], r[6], r[7]]), [[2, 1000, 'MITRE 45', 'MITRE 45'], [2, 600, 'MITRE 45', 'MITRE 45'], [4, 730, 'SQUARE', 'SQUARE'], [2, 960, 'BUTT 0', 'BUTT 0'], [2, 560, 'BUTT 0', 'BUTT 0']]);
  assert.match(content.notes![0], /^12 pieces, 9160 mm, /); assert.match(content.notes!.at(-1)!, /estimates/);
  const settings = { ...readDrawing(state.doc.drawing), sheet: 'A3' as const, tables: [{ id: 'cut', from: 'cut-list' }] }, i = drawingInputs(state.doc, settings);
  assert.ok(typeof i !== 'string', String(i));
  const ctx = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-20' } }), g = ctx.sheet.groups.find(x => x.role === 'table');
  assert.ok(g, 'the table on the sheet');
  // (Placed clear by the sheet's own rule: R14's issue list finds nothing on it.)
  // (Placed clear by the sheet's own rule on A3: R14's issue list finds nothing on it. On A4 the 166 mm table cannot share
  // the sheet with the views at 1:20 — no room anywhere — so its overlap carries a fix, A3 at 1:20, which Fix all applies
  // and clears: the outer lane's O67, the follow-up D128 recorded; this expectation updated with it.)
  assert.deepEqual(drawingIssues(ctx).filter(x => x.tables?.includes('cut')).map(x => x.code), []);
  const a4 = drawingInputs(state.doc, { ...settings, sheet: 'A4' }); assert.ok(typeof a4 !== 'string');
  const a4in = { ...a4, meta: { ...a4.meta, date: '2026-10-20' } };
  // (FRa, O115: on A4 the 166 mm table has no room whole, so its rows go in blocks — each clear, the header in each, the
  // title on the first, the notes on the last, every row once in order — and the issue list finds nothing on it.)
  const a4ctx = issueContext(a4in), blocks = a4ctx.sheet.tables!.filter(x => x.id === 'cut');
  assert.ok(blocks.length >= 2 && blocks.every((b, k) => b.part![0] === k + 1 && b.part![1] === blocks.length), JSON.stringify(blocks));
  assert.deepEqual(drawingIssues(a4ctx).filter(x => x.tables?.includes('cut')).map(x => x.code), [], 'the A4 table clear');
  const groupsA4 = a4ctx.sheet.groups.filter(x => x.role === 'table' && x.id === 'cut'), textsOf = (gg: typeof groupsA4[number]) => gg.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text);
  // (The 166 mm table is wider than any room on this A4 at 1:20: its columns go in groups, ITEM leading each.)
  assert.ok(groupsA4.every(gg => textsOf(gg).includes('ITEM')), 'the key column in every block');
  for (const h of ['QTY', 'SECTION', 'MATERIAL', 'LENGTH [mm]', 'LONG POINT [mm]', 'START', 'END', 'MASS EA [kg]']) assert.ok(groupsA4.some(gg => textsOf(gg).includes(h)), `${h} in a block`);
  assert.deepEqual(groupsA4.map(gg => textsOf(gg).includes('CUT LIST')), groupsA4.map((_, k) => k === 0), 'the title on the first');
  assert.ok(textsOf(groupsA4.at(-1)!).some(t => /^12 pieces, 9160 mm, /.test(t)) && !groupsA4.slice(0, -1).some(gg => textsOf(gg).some(t => /^12 pieces/.test(t))), 'the notes on the last');
  // (Every row once in each column group — each item as often as the others — and in order within each block.)
  // (The ITEM column: the block's leftmost column of numbers.)
  const itemsOf = (gg: typeof groupsA4[number]) => {
    const nums = gg.marks.filter(m => m.kind === 'text' && /^[1-5]$/.test((m as { text: string }).text)) as { text: string; at: [number, number] }[], x = Math.min(...nums.map(m => m.at[0]));
    return nums.filter(m => Math.abs(m.at[0] - x) < 1e-6).sort((a, b) => a.at[1] - b.at[1]).map(m => Number(m.text));
  };
  const counts = [1, 2, 3, 4, 5].map(n => groupsA4.flatMap(itemsOf).filter(x => x === n).length);
  assert.ok(counts[0] >= 1 && counts.every(c => c === counts[0]), JSON.stringify(counts));
  for (const gg of groupsA4) { const it = itemsOf(gg); assert.ok(it.every((x, k) => k === 0 || x > it[k - 1]), JSON.stringify(it)); }
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) { const a = blocks[i].box, b = blocks[j].box; assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], 'blocks apart'); }
  // (The A3 fix stays for a person who wants it whole: Fix all on A4 has nothing to fix for the table now.)
  assert.deepEqual(fixAll(a4in).left.filter(x => x.tables?.includes('cut')), []);
  const svg = sheetSvg(ctx.sheet, 'welded-table');
  const texts = g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text);
  for (const t of ['CUT LIST', 'LENGTH [mm]', '1000.0', '730.0', 'MITRE 45', 'BUTT 0']) assert.ok(texts.includes(t), `the table: ${t}`);
  for (const t of texts) assert.ok(svg.includes(`>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}<`), `SVG: ${t}`);
  const pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'welded-table'));
  for (const t of texts.filter(x => /^[\x20-\x7e]+$/.test(x))) assert.ok(pdf.includes(`(${t.replace(/([()\\])/g, '\\$1')}) Tj`), `PDF: ${t}`);
  const dxf = sheetDxf(ctx.sheet, ctx.layout);
  for (const t of texts) assert.ok(dxf.text.includes(`\n${dxfText(t, false)}\n`), `DXF: ${t}`);
  caseFile('accept-welded-table', state.doc, 'FR4b acceptance: the welded table frame the agent builds (test/fixtures/frame-welded-table.calls.json): a mitred 1000 × 600 top of sharp 40 × 40 × 3 tubes, legs 730 under it, lower rails 150 up butted on the legs; its cut list in steel (a test value).',
    { outputs: lengths.map((L, k) => ({ volumeMM3: { value: A_SHARP * L, relTol: 1e-9 }, centroidMM: { value: bodies[k].centroid, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] })),
      cutList: { densityKgPerM3: RHO, absTol: 1e-9, rows: [[1000, 'mitre', 45, 1040, ['n0/0', 'n0/2']], [600, 'mitre', 45, 640, ['n0/1', 'n0/3']], [730, 'square', 0, 730, ['n0/4', 'n0/5', 'n0/6', 'n0/7']], [960, 'butt', 0, 960, ['n0/8', 'n0/10']], [560, 'butt', 0, 560, ['n0/9', 'n0/11']]].map(([L, kind, deg, lp, pieces]) => ({
        quantity: (pieces as string[]).length, pieces, axisLengthMM: L, longPointMM: lp, fromVolume: false, ends: [0, 1].map(() => ({ kind, mitreDegrees: deg, bevelDegrees: 0 })), massKG: RHO * A_SHARP * (L as number) * 1e-9 })),
        totals: { quantity: 12, axisLengthMM: 9160, massKG: RHO * A_SHARP * 9160e-9 } }, stepRoundTrip: { relTol: 1e-9 } },
    'Closed forms: the top\'s rails A·1000 and A·600 (mitre planes through the corners on their lines; long point L + 40), the legs A·730 (square, under the top), the lower rails A(L − 40) (butted on the legs\' faces); mass ρ·A·L. Centroids by this kernel.');
});

test('FR4b the 2020 T-slot frame by the agent: four uprights 500, rails 380 and 280 between their faces at the bottom and the top, every member square — A·L each, no two overlapping (united, their sum); the cut list (3 rows of 12)', async () => {
  const { state, results } = await build('frame-tslot'), bodies = state.bodies;
  assert.equal(bodies.length, 12);
  const lengths = [500, 500, 500, 500, 380, 380, 280, 280, 380, 380, 280, 280];
  bodies.forEach((b, k) => close(b.volumeMM3!, A_TSLOT * lengths[k], 1e-12, `member ${k}`));
  const out = JSON.parse(results[1]);
  assert.deepEqual(rowsOf(out.rows), [{ quantity: 4, axisLengthMM: 500, ends: ['square', 'square'] }, { quantity: 4, axisLengthMM: 380, ends: ['square', 'square'] }, { quantity: 4, axisLengthMM: 280, ends: ['square', 'square'] }]);
  // No two members overlap: they touch on faces only, so united they weigh their sum.
  const snap = evaluateCadPart(toPartDocument(state.doc)), members = snap.outputs.filter(o => o.member);
  let u = members[0].brep; for (const o of members.slice(1)) u = booleanAnalytic(u, o.brep, 'union');
  close(brepMassProperties(u, 1).volumeMM3, A_TSLOT * lengths.reduce((a, b) => a + b, 0), 1e-9, 'united');
  // Its notes: the section's area, A by the closed form to the note's 3 decimals; the agent gave the slot sizes, so no estimate warning.
  assert.ok(bodies[0].notes!.some(n => n.text.startsWith('Member: ') && n.text.includes(`section ${+A_TSLOT.toFixed(3)} mm²`) && n.text.includes('length 500')), JSON.stringify(bodies[0].notes));
  assert.ok(!bodies.some(b => b.notes!.some(n => n.warning)), 'no warnings: square ends between faces, no clash');
  caseFile('accept-tslot-frame', state.doc, 'FR4b acceptance: the 2020-class T-slot frame the agent builds (test/fixtures/frame-tslot.calls.json): 400 × 300 × 500, four uprights and eight rails between their faces, all square; the slot sizes are the tslot-20 library\'s estimates.',
    { outputs: lengths.map((L, k) => ({ volumeMM3: { value: A_TSLOT * L, relTol: 1e-9 }, centroidMM: { value: bodies[k].centroid, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] })),
      cutList: { densityKgPerM3: 2700, absTol: 1e-9, rows: [[500, ['n0/0', 'n0/1', 'n0/2', 'n0/3']], [380, ['n0/4', 'n0/5', 'n0/8', 'n0/9']], [280, ['n0/6', 'n0/7', 'n0/10', 'n0/11']]].map(([L, pieces]) => ({
        quantity: 4, pieces, axisLengthMM: L, longPointMM: L, fromVolume: false, ends: [0, 1].map(() => ({ kind: 'square', mitreDegrees: 0, bevelDegrees: 0 })), massKG: 2700 * A_TSLOT * (L as number) * 1e-9 })),
        totals: { quantity: 12, axisLengthMM: 4 * (500 + 380 + 280), massKG: 2700 * A_TSLOT * 4 * (500 + 380 + 280) * 1e-9 } }, stepRoundTrip: { relTol: 1e-9 } },
    'Closed forms: the section a² less four slots wo·ds + (wu − wo)²/4 less the bore π(2.1)²; uprights A·500, rails A·380 and A·280 between the uprights\' faces; square ends; mass ρ·A·L at 2700 kg/m³ (a test value). Centroids by this kernel.');
});
