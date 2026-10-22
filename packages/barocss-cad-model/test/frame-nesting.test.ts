import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type FrameStockRow, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { personFile } from './person-file';
import { partCutList, type PartCutList } from '../src/app/cutList';
import { EXACT_PIECES, KERF_ESTIMATE_MM, nestCutList, nestingCsv, nestLowerBound, type Nesting } from '../src/frames/nesting';

// FRb (O116): 1D stock nesting against closed forms — FR S0's P2 (5 5 4 4 3 3 3 3 into 10s: three bars exactly where
// first-fit-decreasing takes four; four with a kerf of 0.5); the welded table's twelve long points (2 · 1040, 2 · 640,
// 4 · 730, 2 · 960, 2 · 560 = 9320 mm) into 6000 mm bars — two, as 9320 > 6000 forces — and, with 4000 mm bars too, one
// of each (10 000 mm: no sum of 4000s and 6000s lies in [9330, 10 000)); the waste always the bars less the pieces and
// the kerfs (n − bars cuts); counts, sections and lengths no stock takes refused by name; none loaded, said.

const root = resolve(import.meta.dirname, '..');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
/** A cut list of the given lengths (one row a length, one section unless given), for the nesting alone. */
const listOf = (lengths: readonly number[], section = 'S'): PartCutList => ({
  rows: lengths.map((L, k) => ({ item: k + 1, section, mirrored: false, quantity: 1, pieces: [`p${k}`], axisLengthMM: L, fromVolume: false, longPointMM: L, ends: [], massKG: 0, totalMassKG: 0 })),
  totals: { quantity: lengths.length, axisLengthMM: lengths.reduce((a, b) => a + b, 0), massKG: 0 }, names: {}, densityEstimate: true,
}) as never;
const docOf = (stock: FrameStockRow[], kerfMM?: number): StudioDoc => ({ ...emptyDoc(), frames: { version: 1, stock, ...(kerfMM !== undefined ? { kerfMM } : {}) } });
const nest = (lengths: readonly number[], stock: FrameStockRow[], kerf?: number): Nesting => { const r = nestCutList(docOf(stock, kerf), listOf(lengths)); assert.ok(r.ok, JSON.stringify(r)); return r.nesting; };
const ROD = (id: string, lengthMM: number, extra: Partial<FrameStockRow> = {}): FrameStockRow => ({ id, lengthMM, source: 'a test value', ...extra });
/** Every bar's pieces fit it with their kerfs, every piece once, the waste exact. */
function sound(n: Nesting, lengths: readonly number[], kerf: number) {
  for (const b of n.bars) assert.ok(b.usedMM + kerf * (b.pieces.length - 1) <= b.lengthMM + 1e-9 && Math.abs(b.offcutMM - (b.lengthMM - b.usedMM - b.kerfMM)) < 1e-9, JSON.stringify(b));
  assert.deepEqual(n.bars.flatMap(b => b.pieces.map(p => p.lengthMM)).concat(n.unplaced.map(p => p.lengthMM)).sort((a, b) => a - b), [...lengths].sort((a, b) => a - b));
  const pieces = n.bars.reduce((t, b) => t + b.usedMM, 0), cuts = n.bars.reduce((t, b) => t + b.pieces.length - 1, 0);
  assert.ok(Math.abs(n.totals.wasteMM - (n.totals.stockMM - pieces - kerf * cuts)) < 1e-6, JSON.stringify(n.totals));
}

test('FRb P2\'s oracle: 5 5 4 4 3 3 3 3 into 10s — exactly three bars (5 5 · 4 3 3 · 4 3 3, no waste) where first-fit-decreasing takes four; a kerf of 0.5, four bars and the waste 40 − 30 − 0.5 · 4', () => {
  const P = [5, 5, 4, 4, 3, 3, 3, 3];
  const a = nest(P, [ROD('R10', 10)], 0);
  assert.equal(a.totals.bars, 3); assert.equal(a.totals.wasteMM, 0); assert.equal(a.sections[0].method, 'exact'); assert.equal(a.sections[0].optimal, true);
  assert.deepEqual(a.bars.map(b => b.pieces.map(p => p.lengthMM)).sort(), [[4, 3, 3], [4, 3, 3], [5, 5]]);
  sound(a, P, 0);
  const b = nest(P, [ROD('R10', 10)], 0.5);
  assert.equal(b.totals.bars, 4); assert.equal(b.totals.stockMM, 40); assert.equal(b.totals.kerfMM, 0.5 * (8 - 4)); assert.equal(b.totals.wasteMM, 40 - 30 - 2);
  assert.deepEqual(b.kerf, { mm: 0.5, basis: 'set' });
  sound(b, P, 0.5);
});

test('FRb the welded table frame (FR4b): its 12 long points, 9320 mm, into 6000 mm bars at a 3 mm kerf — two bars (9320 > 6000), the waste 12 000 − 9320 − 3 · 10 = 2650; with 4000 mm bars too, one of each, 10 000 mm and the waste 650', async () => {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures/frame-welded-table.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of calls) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool}: ${r.content}`); state = r.state; }
  const longs = [1040, 1040, 640, 640, 730, 730, 730, 730, 960, 960, 560, 560];
  // (No stock loaded: the cut list says how to load it.)
  let r = await dispatchTool(state, 'cut_list', {}, evaluate), out = JSON.parse(r.content);
  assert.match(out.nesting.error, /^\[NEST_NO_STOCK\] .*none is built in/);
  const L6 = personFile('frame-stock.json', [{ id: 'L6', length: 6000, source: 'a test value' }]);
  r = await dispatchTool({ ...state, rowFiles: L6.rowFiles }, 'set_frame_stock', { file: L6.file, kerf: 3 }, evaluate); assert.ok(!r.isError, r.content); state = r.state;
  out = JSON.parse((await dispatchTool(state, 'cut_list', {}, evaluate)).content);
  const two = out.nesting as Nesting;
  assert.equal(two.totals.bars, 2); assert.equal(two.totals.stockMM, 12000); assert.equal(two.totals.piecesMM, 9320); assert.equal(two.totals.wasteMM, 12000 - 9320 - 3 * 10);
  assert.equal(two.sections.length, 1); assert.equal(two.sections[0].method, 'exact'); assert.equal(two.sections[0].optimal, true);
  sound(two, longs, 3);
  // (Each piece by its body key and name, from the cut list's rows.)
  const keys = partCutList(state.doc, state.bodies)!.rows.flatMap(x => x.pieces);
  assert.deepEqual(two.bars.flatMap(b => b.pieces.map(p => p.key)).sort(), [...keys].sort());
  const L4 = personFile('frame-stock-more.json', [{ id: 'L4', length: 4000, source: 'a test value' }]);
  r = await dispatchTool({ ...state, rowFiles: L4.rowFiles }, 'set_frame_stock', { file: L4.file }, evaluate); assert.ok(!r.isError, r.content); state = r.state;
  assert.deepEqual(state.doc.frames?.stock?.map(x => x.id), ['L6', 'L4'], 'the file adds L4; L6 stays');
  const mixed = nestCutList(state.doc, partCutList(state.doc, state.bodies)); assert.ok(mixed.ok);
  assert.deepEqual(mixed.nesting.bars.map(b => b.stock).sort(), ['L4', 'L6']); assert.equal(mixed.nesting.totals.stockMM, 10000); assert.equal(mixed.nesting.totals.wasteMM, 10000 - 9320 - 30);
  sound(mixed.nesting, longs, 3);
  // (The CSV: a line a bar and the totals.)
  const csv = nestingCsv(mixed.nesting).trim().split('\n');
  assert.equal(csv[0], 'bar,stock,section,length_mm,pieces,pieces_mm,kerf_mm,offcut_mm'); assert.equal(csv.length, 4); assert.match(csv[3], /^total,,,10000,,9320,30,650$/);
});

test('FRb the stock\'s rules: a tie in length goes to the fewer bars; a count runs out (NEST_STOCK_SHORT) and a piece longer than every length (NEST_TOO_LONG), each by name; a row of another section unused; the kerf unset an estimate', () => {
  // (2900 + 3 + 2900 = 5803 fits one 6000; two 3000s are 6000 too: one bar.)
  const tie = nest([2900, 2900], [ROD('A3', 3000), ROD('A6', 6000)], 3);
  assert.deepEqual(tie.bars.map(b => b.stock), ['A6']);
  // (One 6000 only: two of four 2000s fit it (2000 · 3 + 6 > 6000), two are short.)
  const short = nest([2000, 2000, 2000, 2000], [ROD('C6', 6000, { count: 1 })], 3);
  assert.equal(short.totals.bars, 1); assert.deepEqual(short.unplaced.map(p => p.code), ['NEST_STOCK_SHORT', 'NEST_STOCK_SHORT']);
  const long = nest([7000, 1000], [ROD('A6', 6000)], 3);
  assert.deepEqual(long.unplaced.map(p => [p.lengthMM, p.code]), [[7000, 'NEST_TOO_LONG']]); assert.equal(long.totals.bars, 1);
  const r = nestCutList(docOf([ROD('X6', 6000, { section: 'other' })]), listOf([1000]));
  assert.ok(r.ok); assert.deepEqual(r.nesting.unplaced.map(p => p.code), ['NEST_TOO_LONG']);
  const est = nest([1000, 1000], [ROD('A6', 6000)]);
  assert.deepEqual(est.kerf, { mm: KERF_ESTIMATE_MM, basis: 'estimate' }); assert.equal(est.bars[0].kerfMM, KERF_ESTIMATE_MM);
  const none = nestCutList(emptyDoc(), listOf([1000])); assert.ok(!none.ok && none.code === 'NEST_NO_STOCK');
  const empty = nestCutList(docOf([ROD('A6', 6000)]), null); assert.ok(!empty.ok && empty.code === 'NEST_NO_PIECES');
});

test(`FRb past ${EXACT_PIECES} pieces first-fit-decreasing, its gap said: 40 pieces of 1000 into 6000 at a kerf of 0 — 7 bars (6 a bar), at the lower bound 42 000 (six bars hold 36 000 < 40 000), so optimal; a mixed list, the plan never under its bound; every piece placed and the waste exact`, () => {
  const P = Array.from({ length: 40 }, () => 1000), n = nest(P, [ROD('A6', 6000)], 0);
  assert.equal(n.sections[0].method, 'first-fit-decreasing'); assert.equal(n.sections[0].optimal, true); assert.match(n.sections[0].note!, /40 pieces: first-fit-decreasing \(exact up to 14\); at the lower bound: optimal/);
  assert.equal(n.totals.bars, 7); assert.equal(n.sections[0].lowerBoundMM, 42000); assert.equal(n.totals.wasteMM, 2000);
  sound(n, P, 0);
  // (A mixed list FFD does not close: 6000 and 2500 bars, 16 of 1900 at kerf 3 — three a 6000 bar (5706), one a 2500.)
  const Q = Array.from({ length: 16 }, () => 1900), m = nest(Q, [ROD('A6', 6000), ROD('A2', 2500)], 3);
  assert.equal(m.sections[0].method, 'first-fit-decreasing'); sound(m, Q, 3);
  assert.ok(m.totals.stockMM >= m.sections[0].lowerBoundMM - 1e-9, JSON.stringify(m.sections[0]));
  if (!m.sections[0].optimal) assert.match(m.sections[0].note!, /mm over the lower bound at most/);
  // (The bound: b bars hold the pieces and n − b kerfs, and b of the shortest stock; the least over b.)
  // (P2 at a kerf of 0.5: three bars cannot hold 30 + 2.5; four can — 40, the optimum. The table: one bar cannot hold 9353 — 12 000.)
  assert.equal(nestLowerBound(30, 8, 0.5, 10, 10), 40);
  assert.equal(nestLowerBound(9320, 12, 3, 6000, 6000), 12000);
});

test('FRb set_frame_stock refuses by name: no source, a length of 0, a count of 1.5, an empty section, two rows of one id, a kerf of 25; rows the agent writes', async () => {
  const s: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const [rows, re] of [
    [[{ id: 'a', length: 6000 }], /\[FRAME_STOCK_ROW\] row 0: an id and a source/],
    [[{ id: 'a', length: 0, source: 's' }], /\[FRAME_STOCK_ROW\] row 0 \(a\): length/],
    [[{ id: 'a', length: 6000, count: 1.5, source: 's' }], /\[FRAME_STOCK_ROW\] row 0 \(a\): count/],
    [[{ id: 'a', length: 6000, section: '', source: 's' }], /\[FRAME_STOCK_ROW\] row 0 \(a\): section/],
    [[{ id: 'a', length: 6000, source: 's' }, { id: 'a', length: 3000, source: 's' }], /two rows with one id/],
    [undefined, /\[FRAME_KERF\]/],
  ] as const) {
    const f = personFile('frame-stock.json', rows ?? []);
    const r = await dispatchTool({ ...s, rowFiles: f.rowFiles }, 'set_frame_stock', rows ? { file: f.file } : { kerf: 25 }, evaluate);
    assert.ok(r.isError, JSON.stringify(rows)); assert.match(JSON.parse(r.content).error, re);
  }
  const good = [{ id: 'a', length: 6000, count: 4, section: 'RHS', source: 'the shop' }], f = personFile('frame-stock.json', good);
  const raw = await dispatchTool({ ...s, rowFiles: f.rowFiles }, 'set_frame_stock', { rows: good, kerf: 2 }, evaluate);
  assert.ok(raw.isError); assert.match(JSON.parse(raw.content).error, /ROWS_NOT_FROM_PERSON/);
  const ok = await dispatchTool({ ...s, rowFiles: f.rowFiles }, 'set_frame_stock', { file: f.file, kerf: 2 }, evaluate);
  assert.ok(!ok.isError, ok.content); assert.deepEqual(ok.state.doc.frames, { version: 1, stock: [{ id: 'a', lengthMM: 6000, count: 4, section: 'RHS', source: 'the shop' }], kerfMM: 2 });
});
