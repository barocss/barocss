import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { dispatchTool } from '@barocss/cad-model/chat/tools';
import { partingLine } from '@barocss/cad-model/mould/parting';
import { printability } from '@barocss/cad-model/print/rules';

// IM5 (O81): the parting line against closed forms — a box (its walls along the pull: by default in the − half, the
// loop round the top, 2(w + d) long, flat; put in the + half, round the bottom), a box drafted 2° (its walls + by
// their draft: the loop round the bottom), a cylinder lying across the pull (straddling: its isocline the two lines
// z = 0, 2 × 40 long, then the caps' upper halves — 80 + two 16-gon half circles, stepped 0 … 10; to be split along
// it, not built); the person's halves; the report's rule.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const extrude = (sketch: Record<string, unknown>, h: number, draft?: number): StudioDoc => withNode(withNode(emptyDoc(), sketch as never), { kind: 'extrude', sketch: 0, height: h, ...(draft !== undefined ? { draft } : {}) });
const box = (draft?: number) => extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, 10, draft);
const crossCylinder = () => extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, 40);
// (The display mesh's half circle: 16 chords of a radius-10 circle.)
const halfCircle = 2 * 16 * 10 * Math.sin(Math.PI / 32);

test('IM5 a box pulled along +Z: its walls along the pull go to the − half by default — one loop round the top, 140 long, flat at 10; put in the + half, the loop round the bottom at 0', () => {
  const doc = box(), p = partingLine(doc, bodiesOf(doc), [0, 0, 1]);
  assert.deepEqual(p.faces.filter(f => f.basis === 'wall default').map(f => f.face).sort(), ['n1.side0', 'n1.side1', 'n1.side2', 'n1.side3']);
  assert.equal(p.loops.length, 1); assert.deepEqual(p.split, []);
  const [l] = p.loops;
  assert.ok(l.closed && l.flat && Math.abs(l.lengthMM - 140) <= 1e-9 && Math.abs(l.rangeMM[0] - 10) <= 1e-6, JSON.stringify(l));
  const up = partingLine(doc, bodiesOf(doc), [0, 0, 1], { 'n1.side0': '+', 'n1.side1': '+', 'n1.side2': '+', 'n1.side3': '+' });
  assert.ok(up.loops.length === 1 && up.loops[0].flat && Math.abs(up.loops[0].rangeMM[0]) <= 1e-6 && Math.abs(up.loops[0].lengthMM - 140) <= 1e-9, JSON.stringify(up.loops));
});

test('IM5 a box drafted 2°: its walls in the + half by their draft — the loop round the bottom, the sketch\'s 140, at 0', () => {
  const doc = box(2), p = partingLine(doc, bodiesOf(doc), [0, 0, 1]);
  assert.ok(p.faces.filter(f => f.face.startsWith('n1.side')).every(f => f.half === '+' && f.basis === 'draft'), JSON.stringify(p.faces));
  assert.ok(p.loops.length === 1 && p.loops[0].closed && p.loops[0].flat && Math.abs(p.loops[0].rangeMM[0]) <= 1e-6 && Math.abs(p.loops[0].lengthMM - 140) <= 1e-9, JSON.stringify(p.loops));
});

test('IM5 a cylinder lying across the pull: straddling, its isocline z = 0 traced on the exact surface (80 long), the loop closed round it and the caps\' upper halves, stepped; to split — or put whole in one half: then two loops round the caps', () => {
  const doc = crossCylinder(), p = partingLine(doc, bodiesOf(doc), [0, 0, 1]);
  assert.deepEqual(p.split.map(x => [x.face, +x.isoclineMM.toFixed(9)]), [['n1.side0', 80]]);
  assert.equal(p.loops.length, 1);
  const [l] = p.loops;
  assert.ok(l.closed && !l.flat && Math.abs(l.lengthMM - (80 + 2 * halfCircle)) <= 1e-4 && Math.abs(l.rangeMM[0]) <= 1e-6 && Math.abs(l.rangeMM[1] - 10) <= 1e-4, JSON.stringify(l));
  // (The isocline's points on z = 0 exactly: the bisection on the exact normal.)
  assert.ok(l.points.filter(q => Math.abs(q[2]) <= 1e-9).length >= 4);
  const whole = partingLine(doc, bodiesOf(doc), [0, 0, 1], { 'n1.side0': '+' });
  assert.deepEqual(whole.split, []); assert.equal(whole.loops.length, 2);
  for (const x of whole.loops) assert.ok(x.closed && Math.abs(x.lengthMM - 2 * halfCircle) <= 1e-4, JSON.stringify(x));
});

test('IM5 in the manufacturability report: a box passes (one flat loop); the cross cylinder warned (the face to split named, the split not built); its halves set — the doc\'s sides, or the tool\'s; no pull — unknown', async () => {
  const moulded = (d: StudioDoc, sides?: Record<string, '+' | '-'>): StudioDoc => withLook({ ...d, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'smooth', ...(sides ? { sides } : {}) } }, bodiesOf(d)[0], { material: 'abs' });
  const rule = async (d: StudioDoc, o: { sides?: Record<string, '+' | '-'> } = {}) => (await printability(d, bodiesOf(d), evaluate, o)).rules.find(r => r.id === 'parting')!;
  const b = await rule(moulded(box()));
  assert.equal(b.status, 'pass'); assert.match(b.message, /^1 parting loop \(flat, 140 mm\)$/);
  const c = await rule(moulded(crossCylinder()));
  assert.equal(c.status, 'warn'); assert.deepEqual(c.entities, ['n1.side0']); assert.match(c.message, /n1\.side0 80 mm\): each must be split there .* a face split by a curve, not built/);
  assert.equal((await rule(moulded(crossCylinder(), { 'n1.side0': '+' }))).status, 'pass');
  // (All of it in the − half — the caps go there by default: no edge between halves, no loop — warned, said.)
  const all = await rule(moulded(crossCylinder()), { sides: { 'n1.side0': '-' } });
  assert.equal(all.status, 'warn'); assert.match(all.message, /^0 parting loops$/);
  const none = moulded(box()); delete none.mould!.pull;
  assert.equal((await rule(none)).status, 'unknown');
  // (Through the tool: sides as an argument; a bad one refused.)
  const s = { doc: moulded(crossCylinder()), bodies: bodiesOf(crossCylinder()) } as never as Parameters<typeof dispatchTool>[0];
  const out = JSON.parse((await dispatchTool(s, 'check_printability', { sides: { 'n1.side0': '+' } }, evaluate)).content);
  assert.equal(out.rules.find((r: { id: string }) => r.id === 'parting').status, 'pass'); assert.equal(out.mould.parting.loops.length, 2);
  assert.ok((await dispatchTool(s, 'check_printability', { sides: { 'n1.side0': 'up' } }, evaluate)).isError);
});
