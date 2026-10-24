import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { exportStudioStep } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { processProfile } from '@barocss/cad-model/library/materials';
import { machinability } from '@barocss/cad-model/machining/report';
import { chooseStock, stockDoc } from '@barocss/cad-model/machining/stock';
import { turningOf } from '@barocss/cad-model/machining/turning';
import { holesOf } from '@barocss/cad-model/machining/holes';
import { personFile } from './person-file';

// CNC7b (O102): stock from the shop's list — the user's, none built in — against closed forms: O100's plate (its box
// 120 × 80 × 28 with the boss) takes the smallest block holding 122 × 82 × 30 (1 mm a face, an estimate), centred; with
// 2 mm set, 125 × 85 × 32; a turned shaft Ø20 × 52 the thinnest bar ≥ Ø22, cut to 54; none loaded, none fits — said;
// the stock exported as a body whose volume is the block's to the mm³; set_stock's rows refused by name. The lists are
// files the person supplied (rows rule b); rows the agent writes are refused.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
type Call = [string, Record<string, unknown>] | [string, Record<string, unknown>, ChatState['rowFiles']];
async function build(calls: Call[], start = emptyDoc()): Promise<ChatState> {
  const e = evaluateDoc(start, 1);
  let s = { doc: start, bodies: e.ok ? e.bodies : [], turnBase: start } as never as ChatState;
  for (const [tool, args, rowFiles] of calls) { const r = await dispatchTool(rowFiles ? { ...s, rowFiles } : s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
/** set_stock with a stock list the person supplied as a file. */
const stockList = (rows: unknown[]): Call => { const f = personFile('stock.json', rows); return ['set_stock', { file: f.file }, f.rowFiles]; };
const PLATE: Call[] = [cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }), cmd('cylinder', { r: 6, h: 8, x: 30, y: 50, z: 20 }), ['run_command', { command: 'union', values: {}, bodies: ['b1', 'b3'] }]];
const BLOCKS = [{ id: 'P25', kind: 'block', size: [150, 100, 25], source: 'the shop' }, { id: 'B32', kind: 'block', size: [125, 85, 32], source: 'the shop' }, { id: 'B40', kind: 'block', size: [200, 100, 40], source: 'the shop' }, { id: 'B30', kind: 'block', size: [30, 122, 82], source: 'the shop' }];
const milling = processProfile('cnc-milling')!, turning = processProfile('cnc-turning')!;
const rule = (s: ChatState, p = milling) => machinability(s.doc, s.bodies, p).rules.find(r => r.id === 'stock')!;

test('CNC7b a block: O100\'s plate (120 × 80 × 28 with its boss) — 122 × 82 × 30 at 1 mm a face (an estimate, said), laid along the part and centred on it; 2 mm set — 125 × 85 × 32', async () => {
  let s = await build([...PLATE, stockList(BLOCKS)]);
  let r = chooseStock(s.doc, s.bodies, 'cnc-milling');
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual([r.choice.row.id, r.choice.size, r.choice.allowance], ['B30', [122, 82, 30], { mm: 1, basis: 'estimate' }]);
  assert.deepEqual(r.choice.placement, { min: [-1, -1, -1], max: [121, 81, 29] });
  assert.equal(rule(s).status, 'pass'); assert.match(rule(s).message, /stock B30: 122 × 82 × 30 mm \(the shop\), 1 mm a face \(an estimate: set yours\)/);
  s = await build([['set_stock', { allowance: 2 }]], s.doc);
  r = chooseStock(s.doc, s.bodies, 'cnc-milling'); assert.ok(r.ok);
  assert.deepEqual([r.choice.row.id, r.choice.size, r.choice.allowance.basis], ['B32', [125, 85, 32], 'set']);
});

test('CNC7b none loaded — unknown, STOCK_NONE_LOADED (none built in); none fits — warned, STOCK_NONE_FITS, the size needed said', async () => {
  let s = await build(PLATE);
  assert.deepEqual([rule(s).status, /STOCK_NONE_LOADED/.test(rule(s).message)], ['unknown', true]);
  s = await build([stockList([BLOCKS[0]])], s.doc);
  assert.equal(rule(s).status, 'warn'); assert.match(rule(s).message, /STOCK_NONE_FITS: no block on the list holds 122 × 82 × 30 mm/);
});

test('CNC7b a bar: a turned shaft Ø20 × 52 — the thinnest bar ≥ Ø22 (Ø25 and Ø16 not taken), cut to 54 along its axis from y = −1; one too short refused', async () => {
  const shaft = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 52], [0, 52]] }), { kind: 'revolve', sketch: 0, axis: 'y', angle: 360 } as never);
  let s = await build([stockList([{ id: 'R16', kind: 'bar', diameter: 16, source: 'the shop' }, { id: 'R25', kind: 'bar', diameter: 25, source: 'the shop' }, { id: 'R22', kind: 'bar', diameter: 22, maxLength: 1000, source: 'the shop' }])], shaft);
  const tu = turningOf(s.doc, s.bodies, holesOf(s.bodies)), r = chooseStock(s.doc, s.bodies, 'cnc-turning', tu);
  assert.ok(r.ok, JSON.stringify(r));
  const p = r.choice.placement as { start: number[]; axis: number[]; length: number; diameter: number };
  assert.deepEqual([r.choice.row.id, r.choice.size, Math.abs(p.axis[1]), p.length], ['R22', [22, 54], 1, 54]);
  assert.ok(Math.abs(p.start[1] * p.axis[1] + 1) <= 1e-6, JSON.stringify(p.start));
  assert.equal(rule(s, turning).status, 'pass');
  // (The good bars removed by name (O155) and a bar too short added: lists merge by id (O150).)
  s = await build([['set_stock', { remove: ['R16', 'R25', 'R22'] }], stockList([{ id: 'R22s', kind: 'bar', diameter: 22, maxLength: 50, source: 'the shop' }])], s.doc);
  assert.deepEqual(s.doc.machining?.stock?.map(r => r.id), ['R22s']);
  assert.equal(rule(s, turning).status, 'warn');
});

test('CNC7b the export: the stock as a body — the block 122 × 82 × 30 to 1e-6 mm³, the bar π·11²·54 within the chord; its STEP an ISO-10303-21 file', async () => {
  const s = await build([...PLATE, stockList(BLOCKS)]), r = chooseStock(s.doc, s.bodies, 'cnc-milling'); assert.ok(r.ok);
  const blk = evaluateDoc(stockDoc(r.choice), 1); assert.ok(blk.ok);
  assert.ok(Math.abs(blk.bodies[0].volume! - 122 * 82 * 30) <= 1e-6, String(blk.bodies[0].volume));
  const step = exportStudioStep(stockDoc(r.choice), { name: 'stock' }); assert.match(step.text, /^ISO-10303-21;/);
  const bar = stockDoc({ ...r.choice, placement: { start: [0, -1, 0], axis: [0, 1, 0], length: 54, diameter: 22 } }), be = evaluateDoc(bar, 1); assert.ok(be.ok);
  const exact = Math.PI * 121 * 54; assert.ok(Math.abs(be.bodies[0].volume! - exact) / exact < 0.01, String(be.bodies[0].volume));
});

test('CNC7b set_stock refuses by name: a row without a source, a block of two sides, two rows of one id, a negative allowance', async () => {
  const s = await build(PLATE);
  for (const [rows, re] of [
    [[{ id: 'A', kind: 'block', size: [1, 2, 3] }], /\[STOCK_ROW\] row 0: an id and a source/],
    [[{ id: 'A', kind: 'block', size: [1, 2], source: 's' }], /\[STOCK_ROW\] row 0 \(A\): a block has size/],
    [[{ id: 'A', kind: 'bar', diameter: 5, source: 's' }, { id: 'A', kind: 'bar', diameter: 6, source: 's' }], /two rows with one id/],
  ] as const) {
    const f = personFile('stock.json', rows), r = await dispatchTool({ ...s, rowFiles: f.rowFiles }, 'set_stock', { file: f.file }, evaluate);
    assert.ok(r.isError); assert.match(JSON.parse(r.content).error, re);
  }
  // (A negative allowance; and rows the agent writes itself, refused whatever they hold.)
  for (const [args, re] of [[{ allowance: -1 }, /\[STOCK_ALLOWANCE\]/], [{ rows: [BLOCKS[0]] }, /\[ROWS_NOT_FROM_PERSON\]/]] as const) {
    const r = await dispatchTool(s, 'set_stock', args as Record<string, unknown>, evaluate); assert.ok(r.isError); assert.match(JSON.parse(r.content).error, re);
  }
});

test('CNC7b cad-cli stock: the saved plate with a list given — exit 0, stock.json (B30, the allowance an estimate) and stock.step; with none — exit 1, STOCK_NONE_LOADED', async () => {
  const s = await build(PLATE), dir = mkdtempSync(join(tmpdir(), 'cnc-stock-')), part = join(dir, 'plate.bcad'), list = join(dir, 'list.json');
  writeFileSync(part, encodeStudioFile(s.doc)); writeFileSync(list, JSON.stringify(BLOCKS));
  const cli = (...a: string[]) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'stock', ...a], { encoding: 'utf8', timeout: 120000 });
  let r = cli(part, '-o', join(dir, 'out'), '--list', list);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const sj = JSON.parse(readFileSync(join(dir, 'out/stock.json'), 'utf8'));
  assert.deepEqual([sj.row.id, sj.size, sj.allowance.basis], ['B30', [122, 82, 30], 'estimate']); assert.ok(existsSync(join(dir, 'out/stock.step')));
  r = cli(part, '-o', join(dir, 'none')); assert.equal(r.status, 1); assert.match(r.stdout, /STOCK_NONE_LOADED/);
});
