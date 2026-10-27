import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { interference } from '../src/analysis/analysis';
import { processProfile } from '../src/library/materials';
import { fitsBed, planBedSplit, type SplitOptions } from '../src/print/splitBed';
import { isRefusal } from '../src/engine/refusal';

// AM6 (O51): a part too big for the bed split along one axis into the fewest even pieces that fit, with dowel or plug
// connectors. Piece volumes against the original (exactly before connectors, by the closed form after); each piece
// within the bed by AM1's rule; each bore's exact radius its pin's plus the fit; no overlap between any two of the
// assembled pieces and pins by the kernel's intersection; each refusal typed.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const FIT = processProfile('fdm')!.thresholds.fitGap.value;
async function box(w: number, d: number, h: number, extra: Partial<StudioDoc> = { printer: 'fdm-256', process: 'fdm' }): Promise<{ doc: StudioDoc; bodies: BodyResult[] }> {
  const s: ChatState = { doc: emptyDoc(), bodies: [] }, r = await dispatchTool(s, 'run_command', { command: 'box', values: { w, d, h, x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!r.isError, r.content); const doc = { ...r.state.doc, ...extra }, e = await evaluate(doc); assert.ok(e.ok); return { doc, bodies: e.bodies };
}
async function bodiesOf(doc: StudioDoc) { const e = await evaluate(doc); assert.ok(e.ok, JSON.stringify(!e.ok && e)); return e.bodies; }
const vol = (bs: readonly BodyResult[], keys: readonly string[]) => keys.reduce((s, k) => s + bs.find(b => b.key === k)!.volume!, 0);
const code = (f: () => unknown) => { try { f(); return 'none'; } catch (e) { return isRefusal(e) ? e.code : String(e); } };
const DOWEL: SplitOptions = { connector: 'dowel', d: 6, length: 20 };

test('a 300 mm bar on the 256 mm bed: two pieces that each fit; dowels at the fit; volumes by the closed form; no overlap anywhere', async () => {
  const { doc, bodies } = await box(300, 40, 20), V = bodies[0].volume!;
  const { doc: out, report } = planBedSplit(doc, bodies, DOWEL), bs = await bodiesOf(out);
  assert.deepEqual([report.axis, report.cuts, report.pieces.length, report.connectors.length, report.fit], ['x', [150], 2, 2, FIT]);
  assert.ok(report.pieces.every(p => p.fits), JSON.stringify(report.pieces));
  for (const p of report.pieces) { const b = bs.find(x => x.key === p.key)!, e = [0, 1, 2].map(k => b.mesh.bounds.max[k] - b.mesh.bounds.min[k]); assert.ok(fitsBed(e, 2, [256, 256, 256]) && e[0] <= 150 + 1e-9, JSON.stringify(e)); }
  // (Two per cut, spread along the cut face's longer side (Y, 40 mm), at its middle height.)
  assert.deepEqual(report.connectors.map(c => c.at), [[150, 13.33, 10], [150, 26.67, 10]]);
  // (Volumes: the pieces and pins = the bar − the bores (two a connector) + the pins.)
  const rB = 3 + FIT, depth = 10 + FIT, bores = 2 * 2 * Math.PI * rB * rB * depth, pins = 2 * Math.PI * 9 * 20;
  const pieces = vol(bs, report.pieces.map(p => p.key)), pinVol = vol(bs, report.connectors.map(c => c.pin!));
  assert.ok(Math.abs(pinVol - pins) <= 1e-9 * pins, `${pinVol} vs ${pins}`);
  assert.ok(Math.abs(pieces - (V - bores)) <= 1e-9 * V, `${pieces} vs ${V - bores}`);
  // (At the fit: each bore's exact cylinder against its pin's.)
  const radii = (key: string) => bs.find(b => b.key === key)!.mesh.faces.flatMap(f => (f.exact?.kind === 'cylinder' ? [f.exact.r] : []));
  for (const p of report.pieces) for (const r of radii(p.key)) assert.ok(Math.abs(r - rB) <= 1e-9, `${p.key}: bore r ${r}`);
  for (const c of report.connectors) { const rs = radii(c.pin!); assert.ok(rs.length && rs.every(r => Math.abs(r - 3) <= 1e-9) && Math.abs(rB - rs[0] - FIT) <= 1e-9, JSON.stringify(rs)); }
  // (Interference, exact: no two of them overlap — the cut faces touch, the pins sit in their bores with the fit.)
  const pairs = await interference(out, bs, evaluate, [...report.pieces.map(p => p.key), ...report.connectors.map(c => c.pin!)]);
  assert.equal(pairs.length, 6); assert.deepEqual(pairs.filter(p => 'overlap' in p), [], JSON.stringify(pairs));
  // (Before connectors, the cut alone: the pieces sum to the bar exactly.)
  const cutOnly = { ...out, nodes: out.nodes.slice(0, doc.nodes.length + 1) }, cb = await bodiesOf(cutOnly);
  assert.ok(Math.abs(cb.reduce((s, b) => s + b.volume!, 0) - V) <= 1e-9 * V);
});

test('the fewest pieces along the axis that needs it: 600 mm in three; a tall part along the build axis; plugs (the pin one with the lower piece)', async () => {
  const long = await box(600, 40, 20), r3 = planBedSplit(long.doc, long.bodies, DOWEL).report;
  assert.deepEqual([r3.axis, r3.cuts, r3.pieces.length, r3.pieces.every(p => p.fits)], ['x', [200, 400], 3, true]);
  const tall = await box(40, 40, 300), rz = planBedSplit(tall.doc, tall.bodies, DOWEL).report;
  assert.deepEqual([rz.axis, rz.cuts, rz.pieces.every(p => p.fits)], ['z', [150], true]);
  // (Plugs: the pin's lower half is in the lower piece's material, its upper half in the upper piece's bore.)
  const { doc, bodies } = await box(300, 40, 20), V = bodies[0].volume!, { doc: out, report } = planBedSplit(doc, bodies, { ...DOWEL, connector: 'plug' }), bs = await bodiesOf(out);
  assert.equal(bs.length, 2, 'two pieces, the pins one with the lower'); assert.ok(report.connectors.every(c => c.pin === null));
  const rB = 3 + FIT, want = V + 2 * (Math.PI * 9 * 10 - Math.PI * rB * rB * (10 + FIT));
  assert.ok(Math.abs(bs.reduce((s, b) => s + b.volume!, 0) - want) <= 1e-9 * V, `${bs.reduce((s, b) => s + b.volume!, 0)} vs ${want}`);
  assert.deepEqual((await interference(out, bs, evaluate)).filter(p => 'overlap' in p), []);
});

test('refusals, typed: it fits; two bodies; no printer; an oblique print direction; too big two ways; no room for the bore; a bad connector', async () => {
  const small = await box(100, 40, 20); assert.equal(code(() => planBedSplit(small.doc, small.bodies, DOWEL)), 'NOT_NEEDED');
  const bar = await box(300, 40, 20);
  assert.equal(code(() => planBedSplit(bar.doc, [...bar.bodies, bar.bodies[0]], DOWEL)), 'ONE_BODY');
  const { printer: _p, ...noPrinter } = bar.doc; void _p; assert.equal(code(() => planBedSplit(noPrinter as StudioDoc, bar.bodies, DOWEL)), 'NO_PRINTER');
  assert.equal(code(() => planBedSplit({ ...bar.doc, print: { direction: [1, 0, 1] } }, bar.bodies, DOWEL)), 'DIRECTION_NOT_AXIS');
  const plate = await box(300, 300, 20); assert.equal(code(() => planBedSplit(plate.doc, plate.bodies, DOWEL)), 'TOO_BIG_TWO_WAYS');
  const thin = await box(300, 8, 8); let msg = '';
  try { planBedSplit(thin.doc, thin.bodies, DOWEL); } catch (e) { msg = String(e); }
  assert.match(msg, /\[NO_ROOM\] cut 1 at x = 150: no room for 2 bores of Ø6\.\d+ with 2 mm of wall \(needs 5\.\d+ mm inside the cut face; it has 4\)/);
  for (const bad of [{ d: 0 }, { length: -1 }, { count: 9 }, { fit: 0 }]) assert.equal(code(() => planBedSplit(bar.doc, bar.bodies, { ...DOWEL, ...bad })), 'BAD_CONNECTOR', JSON.stringify(bad));
});
