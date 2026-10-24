import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { withLook } from '../src/app/bodies';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { wallsOf } from '../src/mould/walls';
import { printability } from '../src/print/rules';

// IM4 (O80): walls, ribs, bosses, inside corners and thick sections, on analytic shells and constructed features —
// a shelled box (t 2: its nominal and thinnest 2, its eight inside corners sharp), a rib inside it (1.2 = 0.6 t passes,
// 2 = t warned), a boss (its wall R − r against 0.6 … 1 t), an L bracket's inside corner (rounded 2 ≥ 0.5 t, 1 under,
// none sharp), a floor made thick (uneven, a thick section) and a solid boss (a thick section, its diameter).

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const shell = [cmd('box', { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 }), cmd('shell', { t: 2 }, { faces: ['n1.top'] })];
const withRib = (w: number) => [...shell, cmd('box', { w, d: 36, h: 15, x: 30, y: 2, z: 2 }), cmd('union', {}, { bodies: ['b2', 'b4'] })];
const withBoss = (r: number, bore: number | null) => [...shell, cmd('cylinder', { r, h: 12, x: 15, y: 20, z: 2 }), ...(bore ? [cmd('hole', { type: 'blind', d: bore, depth: 10, x: 15, y: 20 }, { faces: ['n4.top'] })] : []), cmd('union', {}, { bodies: ['b2', bore ? 'b5' : 'b4'] })];
const lBracket = (r: number | null) => [cmd('box', { w: 40, d: 20, h: 3, x: 0, y: 0, z: 0 }), cmd('box', { w: 3, d: 20, h: 30, x: 0, y: 0, z: 0 }), cmd('union', {}, { bodies: ['b1', 'b3'] }), ...(r ? [cmd('fillet', { radius: r }, { edges: [{ between: ['n1.top', 'n3.side1'] }] })] : [])];
const report = async (s: ChatState) => {
  const d = withLook({ ...s.doc, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'smooth' } }, s.bodies[0], { material: 'abs' });
  const r = await printability(d, s.bodies, evaluate); return Object.fromEntries(r.rules.map(x => [x.id, x]));
};

test('IM4 a shelled box, t 2: its nominal wall and thinnest 2 (the open rim reads its wall, not its height), even; no rib, no boss, no thick section; its eight inside corners sharp', async () => {
  const s = await build(shell), [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.ok(Math.abs(w.nominal! - 2) <= 1e-6 && Math.abs(w.thinnestMM! - 2) <= 1e-6 && Math.abs(w.thick95MM! - 2) <= 1e-6, JSON.stringify(w));
  assert.deepEqual([w.ribs, w.bosses, w.fillets, w.thick], [[], [], [], null]);
  // (Four along the floor, four up the corners: 56, 36, 56, 36 and 23 each.)
  assert.deepEqual(w.sharp.map(c => +c.length.toFixed(6)).sort((a, b) => a - b), [23, 23, 23, 23, 36, 36, 56, 56]);
  const r = await report(s);
  assert.deepEqual([r['wall-uniform'].status, r.rib.status, r.boss.status, r['inside-radius'].status, r.sink.status], ['pass', 'n/a', 'n/a', 'warn', 'pass']);
  assert.match(r['inside-radius'].message, /8 sharp/); assert.equal(r['inside-radius'].limit, 1);
});

test('IM4 a rib inside the box: found between its two faces, 1.2 mm (0.6 t) passes; 2 mm (t, the mutant) warned — sink opposite', async () => {
  const s = await build(withRib(1.2)), [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.equal(w.ribs.length, 1); assert.ok(Math.abs(w.ribs[0].thickness - 1.2) <= 1e-9, JSON.stringify(w.ribs));
  assert.equal((await report(s)).rib.status, 'pass');
  const thick = await report(await build(withRib(2)));
  assert.equal(thick.rib.status, 'warn'); assert.equal(thick.rib.value, 1); assert.match(thick.rib.message, /sink on the face opposite/);
});

test('IM4 bosses: an outer cylinder with a bore on its axis — R 3, bore Ø2.5: wall 1.75 = 0.875 t passes; R 5 (wall 3.75, the mutant) warned; R 5 solid: no boss, a thick section about its diameter', async () => {
  let s = await build(withBoss(3, 2.5)), [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.equal(w.bosses.length, 1); assert.ok(Math.abs(w.bosses[0].wall - 1.75) <= 1e-9, JSON.stringify(w.bosses));
  assert.equal((await report(s)).boss.status, 'pass');
  assert.equal((await report(await build(withBoss(5, 2.5)))).boss.status, 'warn');
  s = await build(withBoss(5, null)); [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.deepEqual(w.bosses, []);
  assert.ok(w.thick && w.thick.max > 2 / 0.6 && w.thick.max <= 10 + 1e-9 && w.thick.faces.includes('n4.side0'), JSON.stringify(w.thick));
  const r = await report(s); assert.equal(r.sink.status, 'warn'); assert.equal(r.boss.status, 'n/a');
});

test('IM4 an L bracket (t 3), its inside corner: rounded 2 (≥ 0.5 t) passes, its fillet found with its exact radius; 1 under (warned); none — one sharp corner, 20 long', async () => {
  let s = await build(lBracket(2)), [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.ok(Math.abs(w.nominal! - 3) <= 1e-6, String(w.nominal));
  assert.deepEqual(w.fillets.map(f => +f.radius.toFixed(9)), [2]); assert.deepEqual(w.sharp, []);
  assert.equal((await report(s))['inside-radius'].status, 'pass');
  assert.equal((await report(await build(lBracket(1))))['inside-radius'].status, 'warn');
  s = await build(lBracket(null)); [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.deepEqual(w.sharp.map(c => +c.length.toFixed(9)), [20]);
});

test('IM4 a floor made 5 thick in a 2 mm box: uneven (its thick sections 5 against the nominal 2 — 0.4 under 0.6), and a thick section on it', async () => {
  const s = await build([...shell, cmd('box', { w: 56, d: 36, h: 3, x: 2, y: 2, z: 2 }), cmd('union', {}, { bodies: ['b2', 'b4'] })]), [w] = wallsOf(s.doc, s.bodies, 0.6);
  assert.ok(Math.abs(w.nominal! - 2) <= 1e-6 && Math.abs(w.thick95MM! - 5) <= 1e-6, JSON.stringify(w));
  const r = await report(s);
  assert.equal(r['wall-uniform'].status, 'warn'); assert.equal(r['wall-uniform'].value, 0.4);
  assert.equal(r.sink.status, 'warn');
});
