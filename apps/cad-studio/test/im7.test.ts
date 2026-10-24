import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { printability } from '@barocss/cad-model/print/rules';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import type { Half } from '@barocss/cad-model/mould/parting';
import { undercuts } from '@barocss/cad-model/mould/undercut';
import { mouldHalves, splitStraddles, toolingPlan } from '@barocss/cad-model/mould/tooling';

// IM7 S0 (O110): a mould's halves where no face needs a split, against closed forms — a 60 × 40 × 10 plate with a Ø10
// through hole moulded along +Z: its parting plane at the top (z = 10), the hole's rim a shut-off of area π·5²; the
// block (10 mm a side) less the part cut there: the moving half 80 · 60 · 10, the fixed half 80 · 60 · 20 − (24000 −
// 250π), together the block less the part. IM7b (O113): a rod across the pull, its side split along its isocline first (the
// kernel's D149) where its seam is not already on it, then moulded on the plane through its axis, each half 70·40·20 − 2500π;
// a rod tilted 45° slopes its parting line across faces not along the pull — MOULD_STEPPED, said.
// A side hole's side core: its direction across the pull, given on the refusal too. IM7a (O111): a cup's inside goes to
// the moving half as its core (by the rays: open above, on the part below), whichever half its walls were given; a
// stepped block's halves meet on its riser — each case's halves summing to the block less the part to 1e-6.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<StudioDoc> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s.doc;
}
const moulded = (doc: StudioDoc, sides?: Record<string, Half>): StudioDoc => {
  const d: StudioDoc = { ...doc, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'smooth', ...(sides ? { sides } : {}) } };
  return withLook(d, bodiesOf(d)[0], { material: 'abs' });
};
const sum = (bs: readonly BodyResult[]) => bs.reduce((t, b) => t + b.volume!, 0);
/** The plan after IM7b's isocline splits (O113): with the split document and bodies the halves are built on. */
function mould(d: StudioDoc) {
  const b = bodiesOf(d), pull = d.mould!.pull!, sp = splitStraddles(d, b, pull, d.mould?.sides ?? {});
  if (!sp.ok) return { p: { ok: false as const, code: sp.code, message: sp.message, waitsFor: null, sideCores: [], stuck: [] }, doc: d, bodies: b, split: [] as string[] };
  return { p: toolingPlan(sp.bodies, pull, sp.parting, undercuts(sp.bodies, pull).regions, 10, sp.resolved), doc: sp.doc, bodies: sp.bodies, split: sp.split };
}
const plan = (d: StudioDoc) => mould(d).p;
/** A rod Ø20 × 50 along X (its circle's seam along xAxis), and one tilted 45° in XZ. */
const rodAlong = (xAxis: [number, number, number], normal: [number, number, number] = [1, 0, 0]) => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal, xAxis } } as never), { kind: 'extrude', sketch: 0, height: 50 });
const holed = () => build([cmd('box', { w: 60, d: 40, h: 10, x: 0, y: 0, z: 0 }), cmd('hole', { d: 10, x: 30, y: 20 }, { faces: ['n1.top'] })]);

test('IM7 S0 a plate with a Ø10 through hole along +Z: one flat parting plane at z = 10; the hole\'s rim a shut-off (π·5² within the chord); no side core; the block 10 mm a side (an estimate)', async () => {
  const p = plan(moulded(await holed()));
  assert.ok(p.ok, JSON.stringify(p));
  assert.deepEqual([p.plan.axis, p.plan.sign, p.plan.planeAt, p.plan.margin, p.plan.block], ['z', 1, 10, 10, { min: [-10, -10, -10], max: [70, 50, 20] }]);
  assert.equal(p.plan.shutOffs.length, 1);
  const so = p.plan.shutOffs[0];
  assert.ok(Math.abs(so.area - Math.PI * 25) / (Math.PI * 25) < 0.02 && so.at === 10 && Math.abs(so.centroid[0] - 30) < 1e-3 && Math.abs(so.centroid[1] - 20) < 1e-3, JSON.stringify(so));
  assert.deepEqual([p.plan.sideCores.length, p.plan.stuck.length], [0, 0]);
});

test('IM7 S0 the halves: the block less the part cut at z = 10 — the moving half 80·60·10 = 48000, the fixed half 96000 − (24000 − 250π), together the block less the part (exact B-rep volumes, 1e-6)', async () => {
  const d = moulded(await holed()), b = bodiesOf(d), p = plan(d); assert.ok(p.ok);
  const h = mouldHalves(d, b, p.plan); assert.ok(h.ok, JSON.stringify(h));
  const part = 60 * 40 * 10 - Math.PI * 25 * 10, block = 80 * 60 * 30;
  assert.ok(Math.abs(sum(h.plus) - 48000) <= 1e-6 * 48000, String(sum(h.plus)));
  assert.ok(Math.abs(sum(h.minus) - (80 * 60 * 20 - part)) <= 1e-6 * 72000, String(sum(h.minus)));
  assert.ok(Math.abs(sum(h.plus) + sum(h.minus) - (block - part)) <= 1e-6 * block);
  assert.ok(h.plus.every(b => b.mesh.bounds.min[2] >= 10 - 1e-6) && h.minus.every(b => b.mesh.bounds.max[2] <= 10 + 1e-6), 'each half on its side of the plane');
});

test('IM7b a rod across the pull (Ø20 × 50 along X): its side split along its isocline (D149) where its seam is off it, none needed where its seam is on it; either way the plane through its axis (z = 0), each half 70·40·20 − 2500π, the block less the part to 1e-6', async () => {
  const block = 70 * 40 * 40, part = 2500 * Math.PI * 2, half = 70 * 40 * 20 - 2500 * Math.PI;
  for (const [xAxis, splits] of [[[0, 1, 0], 0], [[0, 0, 1], 2]] as const) {
    const m = mould(moulded(rodAlong([...xAxis]))); assert.ok(m.p.ok, JSON.stringify(m.p));
    assert.equal(m.split.length, splits, `seam along ${xAxis}: ${m.split.join(', ')}`);
    assert.equal(m.doc.nodes.filter(n => n.kind === 'split-face').length, splits, 'the splits in the document\'s history');
    assert.deepEqual([m.p.plan.levels, m.p.plan.cuts], [[0], [{ axis: 'z', at: 0 }]]);
    const h = mouldHalves(m.doc, m.bodies, m.p.plan); assert.ok(h.ok, JSON.stringify(h));
    assert.ok(Math.abs(sum(h.plus) - half) <= 1e-6 * block && Math.abs(sum(h.minus) - half) <= 1e-6 * block, `${sum(h.plus)} ${sum(h.minus)} vs ${half}`);
    assert.ok(Math.abs(sum(h.plus) + sum(h.minus) - (block - part)) <= 1e-6 * block);
  }
  // (Tilted 45° in XZ: its isocline lines slope, across faces not along the pull — a parting surface off the axis planes.)
  const tilted = plan(moulded(rodAlong([0, 1, 0], [Math.SQRT1_2, 0, Math.SQRT1_2])));
  assert.ok(!tilted.ok && tilted.code === 'MOULD_STEPPED' && /off the axis planes/.test(tilted.waitsFor!), JSON.stringify(tilted).slice(0, 300));
});

test('IM7a a cup (60 × 40 × 25 shelled 2, open at the top): its inside the moving half\'s core — with its walls in the fixed half (the parting line stepped 2 and 25, the inner walls the risers) or in the moving one (the rim the one plane); either way the moving half 46368 + 48000, the fixed 108000, the block less the part to 1e-6', async () => {
  const cup = await build([cmd('box', { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 }), cmd('shell', { t: 2 }, { faces: ['n1.top'] })]);
  const b = bodiesOf(moulded(cup)), inner = b[0].mesh.faces.filter(f => f.kind === 'plane' && Math.abs(f.normal[2]) < 1e-9 && f.centroid[0] > 1 && f.centroid[0] < 59 && f.centroid[1] > 1 && f.centroid[1] < 39).map(f => f.name);
  assert.equal(inner.length, 4, inner.join(' '));
  const block = 80 * 60 * 45, part = 60 * 40 * 25 - 56 * 36 * 23, inside = 56 * 36 * 23;
  for (const [d, levels] of [[moulded(cup), [2, 25]], [moulded(cup, Object.fromEntries(inner.map(n => [n, '+']))), [25]]] as const) {
    const p = plan(d); assert.ok(p.ok, JSON.stringify(p));
    assert.deepEqual(p.plan.levels, levels);
    const h = mouldHalves(d, bodiesOf(d), p.plan); assert.ok(h.ok, JSON.stringify(h));
    assert.ok(Math.abs(sum(h.plus) - (inside + 80 * 60 * 10)) <= 1e-6 * block, `${levels}: plus ${sum(h.plus)}`);
    assert.ok(Math.abs(sum(h.minus) - (80 * 60 * 35 - 60 * 40 * 25)) <= 1e-6 * block, `${levels}: minus ${sum(h.minus)}`);
    assert.ok(Math.abs(sum(h.plus) + sum(h.minus) - (block - part)) <= 1e-6 * block);
    assert.ok(h.lumps.some(l => l.half === '+' && l.basis === 'over the part'), 'the core: open above, on the part below');
  }
});

test('IM7a a stepped block (50 × 40 × 20 beside 50 × 40 × 10, along X): the parting line at z = 20 and z = 10, the step\'s wall (x = 50) its riser; the moving half 36000 + 72000, the fixed 120000, the block less the part to 1e-6', async () => {
  const d = moulded(await build([cmd('box', { w: 50, d: 40, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 50, d: 40, h: 10, x: 50, y: 0, z: 0 }), ['run_command', { command: 'union', values: {}, bodies: ['b1', 'b3'] }]]));
  const p = plan(d); assert.ok(p.ok, JSON.stringify(p));
  assert.deepEqual([p.plan.levels, p.plan.cuts], [[10, 20], [{ axis: 'z', at: 10 }, { axis: 'z', at: 20 }, { axis: 'x', at: 50 }]]);
  const h = mouldHalves(d, bodiesOf(d), p.plan); assert.ok(h.ok, JSON.stringify(h));
  const block = 120 * 60 * 40, part = 50 * 40 * 20 + 50 * 40 * 10;
  assert.ok(Math.abs(sum(h.plus) - (60 * 60 * 10 + 60 * 60 * 20)) <= 1e-6 * block, `plus ${sum(h.plus)}`);
  assert.ok(Math.abs(sum(h.minus) - 120000) <= 1e-6 * block, `minus ${sum(h.minus)}`);
  assert.ok(Math.abs(sum(h.plus) + sum(h.minus) - (block - part)) <= 1e-6 * block);
});

test('IM7 S0 side cores: a block with a side hole along X — its side core\'s direction across the pull (±X, from IM3), given on the refusal too (its wall straddles: D149); the report\'s tooling rule says both', async () => {
  const d = moulded(await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { d: 6, x: 15, y: 10 }, { faces: ['n1.side3'] })]));
  const p = plan(d); assert.ok(!p.ok, JSON.stringify(p));
  assert.equal(p.sideCores.length, 1); assert.ok(Math.abs(Math.abs(p.sideCores[0].direction[0]) - 1) <= 1e-9 && Math.abs(p.sideCores[0].direction[2]) <= 1e-9, JSON.stringify(p.sideCores[0]));
  const r = (await printability(d, bodiesOf(d), evaluate)).rules.find(x => x.id === 'tooling')!;
  assert.equal(r.status, 'unknown'); assert.match(r.message, /^the halves: \[MOULD_\w+\]; 1 side core \(\[-?1, 0, 0\]\)/);
  const ok = (await printability(moulded(await holed()), bodiesOf(moulded(await holed())), evaluate)).rules.find(x => x.id === 'tooling')!;
  assert.equal(ok.status, 'pass'); assert.match(ok.message, /two halves on a flat parting plane \(z = 10\): 1 shut-off, 0 side cores/);
});

test('IM7 S0 cad-cli mould: the holed plate — exit 0, mould.json (the plane, the halves\' volumes, the shut-off, the margin an estimate) and mould.step of two solids; the rod tilted 45° — exit 1, MOULD_STEPPED (a parting surface off the axis planes)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'im7-')), part = join(dir, 'plate.bcad'), rodFile = join(dir, 'rod.bcad');
  writeFileSync(part, encodeStudioFile(moulded(await holed())));
  writeFileSync(rodFile, encodeStudioFile(moulded(rodAlong([0, 1, 0], [Math.SQRT1_2, 0, Math.SQRT1_2]))));
  const cli = (...a: string[]) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'mould', ...a], { encoding: 'utf8', timeout: 180000 });
  let r = cli(part, '-o', join(dir, 'out'));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = JSON.parse(readFileSync(join(dir, 'out/mould.json'), 'utf8'));
  assert.deepEqual([j.format, j.axis, j.planeAt, j.shutOffs.length, j.halves.plus.volume_mm3, j.margin.basis], ['barocss-mould', 'z', 10, 1, 48000, 'estimate']);
  const step = readFileSync(join(dir, 'out/mould.step'), 'utf8');
  assert.ok(step.startsWith('ISO-10303-21;') && (step.match(/MANIFOLD_SOLID_BREP/g) ?? []).length === 2, 'two solids');
  r = cli(rodFile, '-o', join(dir, 'none')); assert.equal(r.status, 1); assert.match(r.stdout, /MOULD_STEPPED/); assert.match(r.stdout, /off the axis planes/);
});
