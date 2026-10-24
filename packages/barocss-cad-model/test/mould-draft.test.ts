import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { withLook } from '../src/app/bodies';
import { draftField } from '../src/mould/draft';
import { printability } from '../src/print/rules';
import { dispatchTool } from '../src/chat/tools';

// IM2 (O78): the draft field from exact normals, against closed forms — a drafted cylinder (a cone: its taper at every
// sample), a box drafted θ (its four walls θ), a cylinder along the pull (0: steep) and across it (straddling, its
// isocline at the axis' height on the exact surface), a fillet (0 … 90° along it); the report's draft rule; mutants.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const extrude = (sketch: Record<string, unknown>, h: number, draft?: number): StudioDoc => withNode(withNode(emptyDoc(), sketch as never), { kind: 'extrude', sketch: 0, height: h, ...(draft !== undefined ? { draft } : {}) });
const field = (doc: StudioDoc, min: number, pull: [number, number, number] = [0, 0, 1]) => draftField(doc, bodiesOf(doc), pull, min).faces;
const byName = (fs: ReturnType<typeof field>, name: string) => { const f = fs.find(x => x.face === name); assert.ok(f, `${name} in ${fs.map(x => x.face).join(' ')}`); return f!; };

test('IM2 a cone (a cylinder drafted 3°): its side 3° at every sample to 1e-9 — drafted against 0.5° and 3°, steep against 5° (PM-T2); its top and bottom ±90°', () => {
  const doc = extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, 30, 3);
  for (const [min, cls] of [[0.5, 'drafted'], [3, 'drafted'], [5, 'steep']] as const) {
    const side = byName(field(doc, min), 'n1.side0');
    assert.equal(side.kind, 'surface'); assert.equal(side.cls, cls, `${min}°`);
    assert.ok(Math.abs(side.min - 3) <= 1e-9 && Math.abs(side.max - 3) <= 1e-9 && side.side === '+', JSON.stringify(side));
    if (cls === 'steep') assert.ok(Math.abs(side.belowArea - side.area) <= 1e-9 * side.area, 'all of it under 5°');
  }
  const fs = field(doc, 1);
  assert.ok(Math.abs(byName(fs, 'n1.top').min - 90) <= 1e-9 && Math.abs(byName(fs, 'n1.bottom').max + 90) <= 1e-9);
});

test('IM2 a box drafted 2°: its four walls 2° to 1e-9 (NURBS planes, projected); a box with none — its walls 0°, steep; pulled along +X instead its X faces ±90°, its Y and Z faces 0', () => {
  const box = (draft?: number) => extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, 10, draft);
  const fs = field(box(2), 1);
  // (A drafted extrusion's walls are NURBS planes to the display mesh — no exact plane recorded — so projected: still exact.)
  for (const k of [0, 1, 2, 3]) { const f = byName(fs, `n1.side${k}`); assert.ok(Math.abs(f.min - 2) <= 1e-9 && Math.abs(f.max - 2) <= 1e-9 && f.cls === 'drafted', JSON.stringify(f)); }
  const flat = field(box(), 0.5);
  for (const k of [0, 1, 2, 3]) { const f = byName(flat, `n1.side${k}`); assert.ok(Math.abs(f.steepest) <= 1e-12 && f.cls === 'steep', JSON.stringify(f)); }
  const x = field(box(), 0.5, [1, 0, 0]);
  assert.ok(Math.abs(byName(x, 'n1.side1').min - 90) <= 1e-12 && Math.abs(byName(x, 'n1.side3').max + 90) <= 1e-12);
  assert.equal(byName(x, 'n1.top').cls, 'steep');
});

test('IM2 cylinders: along the pull its side 0° (steep); across it straddling, both signs to ±90°, its isocline on the exact surface at the axis\' height (to 1e-9) and on the radius', () => {
  const along = byName(field(extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, 40), 0.5), 'n1.side0');
  assert.equal(along.kind, 'cylinder'); assert.ok(along.cls === 'steep' && Math.abs(along.steepest) <= 1e-12 && Math.abs(along.max) <= 1e-12, JSON.stringify(along));
  const across = field(extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, 40), 1);
  const side = byName(across, 'n1.side0');
  assert.equal(side.cls, 'straddle'); assert.equal(side.side, '±');
  assert.ok(side.min < -89.9 && side.max > 89.9, JSON.stringify(side));
  assert.ok(side.isocline!.length >= 4, String(side.isocline?.length));
  // (n·d = 0 on a cylinder about x: where z = 0 — the two lines y = ±10.)
  for (const p of side.isocline!) assert.ok(Math.abs(p[2]) <= 1e-9 && Math.abs(Math.abs(p[1]) - 10) <= 1e-3, JSON.stringify(p));
});

test('IM2 a fillet (r 4) on a box\'s top edges: its exact draft runs 0 … 90° across it — steep at its foot; the area under the minimum by triangle centres, coarse (at most one strip)', () => {
  let doc = extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, 10);
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 4 } as never);
  const fs = field(doc, 1), fil = fs.filter(f => f.kind === 'cylinder' || f.kind === 'surface').find(f => f.max > 89);
  assert.ok(fil, fs.map(f => `${f.face}:${f.kind}`).join(' '));
  assert.ok(Math.abs(fil!.min) <= 1e-9 && Math.abs(fil!.max - 90) <= 1e-9 && fil!.cls === 'steep', JSON.stringify(fil));
  // (Uniform in angle along its arc, 1/90 of it is under 1°; by triangle centres, one strip of 11.25° each, none is — the
  // vertices say it is steep, the area is coarse.)
  assert.ok(fil!.belowArea >= 0 && fil!.belowArea <= fil!.area / 8 + 1e-9, JSON.stringify(fil));
});

test('IM2 in the manufacturability report: a 3°-drafted ABS cup passes PM-T1\'s 3°, warned under PM-T2\'s 5° (its walls named); an undrafted box warned; no finish — unknown; mutants', async () => {
  const cup = (draft: number, finish: string) => {
    let d = extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, 25, draft);
    d = { ...d, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish } };
    return withLook(d, bodiesOf(d)[0], { material: 'abs' });
  };
  const rule = async (d: StudioDoc) => (await printability(d, bodiesOf(d), evaluate)).rules.find(r => r.id === 'draft')!;
  assert.equal((await rule(cup(3, 'pm-t1'))).status, 'pass');
  const t2 = await rule(cup(3, 'pm-t2'));
  assert.equal(t2.status, 'warn'); assert.ok(Math.abs(t2.value! - 3) <= 1e-9 && t2.limit === 5); assert.deepEqual([...t2.entities!].sort(), ['n1.side0', 'n1.side1', 'n1.side2', 'n1.side3']);
  // (Mutants: no draft at all; 2° under PM-T1's 3°; 0.4° under smooth's 0.5°.)
  for (const [draft, finish] of [[0, 'smooth'], [2, 'pm-t1'], [0.4, 'smooth']] as const) assert.equal((await rule(cup(draft, finish))).status, 'warn', `${draft}° on ${finish}`);
  assert.equal((await rule(cup(0.5, 'smooth'))).status, 'pass');
  const none = cup(3, 'smooth'); delete none.mould!.finish;
  assert.match((await rule(none)).why!, /no finish/);
  const r = await printability(cup(3, 'pm-t1'), bodiesOf(cup(3, 'pm-t1')), evaluate);
  assert.ok(r.mould!.draft!.every(f => f.cls === 'drafted'), JSON.stringify(r.mould!.draft));
});

test('IM2 through the agent\'s tools: query.draft (v1 draft) judges curved faces now — a cone\'s side 3°; draft_min as a requirement reads the exact least', async () => {
  const doc = extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, 30, 3);
  const s = { doc, bodies: bodiesOf(doc) } as never as Parameters<typeof dispatchTool>[0];
  const out = JSON.parse((await dispatchTool(s, 'draft', { pull: [0, 0, 1], min_deg: 1 }, evaluate)).content);
  const side = out.walls.find((w: { face: string }) => w.face === 'n1.side0');
  assert.deepEqual([side.draft_deg, side.class], [3, 'drafted']); assert.deepEqual(out.under_min, []);
  const r = await dispatchTool(s, 'set_requirements', { requirements: [{ id: 'D', source: 'drafted', hard: true, check: { op: '>=', query: { fn: 'draft_min', pull: [0, 0, 1] }, value: 2.9 } }] }, evaluate);
  assert.ok(!r.isError, r.content);
  const spec = JSON.parse((await dispatchTool(r.state, 'check_spec', {}, evaluate)).content);
  assert.deepEqual([spec.summary.pass, spec.summary.fail], [1, 0], JSON.stringify(spec).slice(0, 400));
});
