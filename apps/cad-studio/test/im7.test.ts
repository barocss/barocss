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
import { partingLine, type Half } from '@barocss/cad-model/mould/parting';
import { undercuts } from '@barocss/cad-model/mould/undercut';
import { mouldHalves, toolingPlan } from '@barocss/cad-model/mould/tooling';

// IM7 S0 (O110): a mould's halves where no face needs a split, against closed forms — a 60 × 40 × 10 plate with a Ø10
// through hole moulded along +Z: its parting plane at the top (z = 10), the hole's rim a shut-off of area π·5²; the
// block (10 mm a side) less the part cut there: the moving half 80 · 60 · 10, the fixed half 80 · 60 · 20 − (24000 −
// 250π), together the block less the part. Refused with what each waits for: a cylinder across the pull straddles (D149);
// a cup's floor steps the parting line, and its core given to the moving half reaches below the rim (IM7a). A side hole's
// side core: its direction across the pull, given on the refusal too.

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
const plan = (d: StudioDoc) => { const b = bodiesOf(d), pull = d.mould!.pull!; return toolingPlan(b, pull, partingLine(d, b, pull, d.mould?.sides ?? {}), undercuts(b, pull).regions); };
const holed = () => build([cmd('box', { w: 60, d: 40, h: 10, x: 0, y: 0, z: 0 }), cmd('hole', { d: 10, x: 30, y: 20 }, { faces: ['n1.top'] })]);

test('IM7 S0 a plate with a Ø10 through hole along +Z: one flat parting plane at z = 10; the hole\'s rim a shut-off (π·5² within the chord); no side core; the block 10 mm a side (an estimate)', async () => {
  const p = plan(moulded(await holed()));
  assert.ok(p.ok, JSON.stringify(p));
  assert.deepEqual([p.plan.axis, p.plan.sign, p.plan.planeAt, p.plan.marginMM, p.plan.block], ['z', 1, 10, 10, { min: [-10, -10, -10], max: [70, 50, 20] }]);
  assert.equal(p.plan.shutOffs.length, 1);
  const so = p.plan.shutOffs[0];
  assert.ok(Math.abs(so.areaMM2 - Math.PI * 25) / (Math.PI * 25) < 0.02 && so.at === 10 && Math.abs(so.centroid[0] - 30) < 1e-3 && Math.abs(so.centroid[1] - 20) < 1e-3, JSON.stringify(so));
  assert.deepEqual([p.plan.sideCores.length, p.plan.stuck.length], [0, 0]);
});

test('IM7 S0 the halves: the block less the part cut at z = 10 — the moving half 80·60·10 = 48000, the fixed half 96000 − (24000 − 250π), together the block less the part (exact B-rep volumes, 1e-6)', async () => {
  const d = moulded(await holed()), b = bodiesOf(d), p = plan(d); assert.ok(p.ok);
  const h = mouldHalves(d, b, p.plan); assert.ok(h.ok, JSON.stringify(h));
  const part = 60 * 40 * 10 - Math.PI * 25 * 10, block = 80 * 60 * 30;
  assert.ok(Math.abs(h.plus.volumeMM3! - 48000) <= 1e-6 * 48000, String(h.plus.volumeMM3));
  assert.ok(Math.abs(h.minus.volumeMM3! - (80 * 60 * 20 - part)) <= 1e-6 * 72000, String(h.minus.volumeMM3));
  assert.ok(Math.abs(h.plus.volumeMM3! + h.minus.volumeMM3! - (block - part)) <= 1e-6 * block);
  assert.ok(h.plus.mesh.bounds.min[2] >= 10 - 1e-6 && h.minus.mesh.bounds.max[2] <= 10 + 1e-6, 'each half on its side of the plane');
});

test('IM7 S0 refused with what each waits for: a cylinder across the pull straddles — the kernel\'s face split (D149); a cup\'s floor steps the parting line, and its core put in the moving half reaches below the rim — IM7a', async () => {
  const rod = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } } as never), { kind: 'extrude', sketch: 0, height: 50 });
  const across = plan(moulded(rod)); assert.ok(!across.ok && across.code === 'MOULD_STRADDLE' && /D149, splitFaceAlongCurve/.test(across.waitsFor!), JSON.stringify(across));
  const cup = await build([cmd('box', { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 }), cmd('shell', { t: 2 }, { faces: ['n1.top'] })]);
  const stepped = plan(moulded(cup)); assert.ok(!stepped.ok && stepped.code === 'MOULD_STEPPED' && /IM7a/.test(stepped.waitsFor!), JSON.stringify(stepped));
  // (The person puts the cup's inside in the moving half: the rim is then the one plane, and the core reaches below it.)
  const b = bodiesOf(moulded(cup)), inner = b[0].mesh.faces.filter(f => f.kind === 'plane' && Math.abs(f.normal[2]) < 1e-9 && f.centroid[0] > 1 && f.centroid[0] < 59 && f.centroid[1] > 1 && f.centroid[1] < 39).map(f => f.name);
  assert.equal(inner.length, 4, inner.join(' '));
  const cored = plan(moulded(cup, Object.fromEntries(inner.map(n => [n, '+'])))); assert.ok(!cored.ok && cored.code === 'MOULD_ACROSS_PLANE' && /IM7a/.test(cored.waitsFor!), JSON.stringify(cored));
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

test('IM7 S0 cad-cli mould: the holed plate — exit 0, mould.json (the plane, the halves\' volumes, the shut-off, the margin an estimate) and mould.step of two solids; the rod across the pull — exit 1, MOULD_STRADDLE, waiting for D149', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'im7-')), part = join(dir, 'plate.bcad'), rodFile = join(dir, 'rod.bcad');
  writeFileSync(part, encodeStudioFile(moulded(await holed())));
  const rod = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } } as never), { kind: 'extrude', sketch: 0, height: 50 });
  writeFileSync(rodFile, encodeStudioFile(moulded(rod)));
  const cli = (...a: string[]) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'mould', ...a], { encoding: 'utf8', timeout: 180000 });
  let r = cli(part, '-o', join(dir, 'out'));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const j = JSON.parse(readFileSync(join(dir, 'out/mould.json'), 'utf8'));
  assert.deepEqual([j.format, j.axis, j.planeAt, j.shutOffs.length, j.halves.plus.volume_mm3, j.margin.basis], ['barocss-mould', 'z', 10, 1, 48000, 'estimate']);
  const step = readFileSync(join(dir, 'out/mould.step'), 'utf8');
  assert.ok(step.startsWith('ISO-10303-21;') && (step.match(/MANIFOLD_SOLID_BREP/g) ?? []).length === 2, 'two solids');
  r = cli(rodFile, '-o', join(dir, 'none')); assert.equal(r.status, 1); assert.match(r.stdout, /MOULD_STRADDLE/); assert.match(r.stdout, /D149/);
});
