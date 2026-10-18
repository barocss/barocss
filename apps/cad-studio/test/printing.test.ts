import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS_DATA, checkMaterials, printerProfile, processProfile } from '../src/library/materials';

// AM (D72–): 3D printing — process and printer profiles (AM1).
test('AM1 profiles: five processes (SLS and MJF added), every printing one with every printing threshold sourced; five generic printers on printing processes with their build volumes; the data checks clean', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  assert.deepEqual(MATERIALS_DATA.profiles.map(p => [p.id, !!p.additive]), [['injection', false], ['fdm', true], ['sla', true], ['sls', true], ['mjf', true]]);
  for (const p of MATERIALS_DATA.profiles.filter(x => x.additive)) for (const k of ['minWallUnsupported', 'maxOverhangDeg', 'maxBridgeMM', 'minHoleMM', 'fitGap', 'escapeHoleMM', 'escapeHoles', 'horizontalHoleMM']) {
    const t = p.thresholds[k]; assert.ok(t && Number.isFinite(t.value) && t.source in MATERIALS_DATA.sources, `${p.id}.${k}`);
  }
  // (Powder supports itself: no overhang limit, escape holes for the powder; FDM needs none.)
  assert.deepEqual([processProfile('sls')!.thresholds.maxOverhangDeg.value, processProfile('sls')!.thresholds.escapeHoles.value, processProfile('fdm')!.thresholds.escapeHoles.value], [90, 2, 0]);
  assert.deepEqual(MATERIALS_DATA.printers.map(p => [p.id, p.process]), [['fdm-256', 'fdm'], ['fdm-220', 'fdm'], ['sla-desktop', 'sla'], ['sls-300', 'sls'], ['mjf-380', 'mjf']]);
  assert.deepEqual(printerProfile('fdm-256')!.buildMM, [256, 256, 256]);
  // A broken entry is caught: a printer on a moulding process, a threshold missing.
  const bad = { ...MATERIALS_DATA, printers: [...MATERIALS_DATA.printers, { ...MATERIALS_DATA.printers[0], id: 'x', process: 'injection' }], profiles: MATERIALS_DATA.profiles.map(p => p.id === 'sla' ? { ...p, thresholds: { ...p.thresholds, minHoleMM: undefined as never } } : p) };
  const problems = checkMaterials(bad as never);
  assert.ok(problems.includes('printer x: injection is not a printing process') && problems.includes('sla: no minHoleMM'), problems.join(' | '));
});

import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { faceTableOf } from '../src/assembly/faces';
import { overhangOf } from '../src/print/overhang';
import { runCheck } from '../src/chat/spec';

const bodiesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.hint); return r.ok ? r.bodies : []; };
/** A body from raw part-model features (a library node, as a library part is). */
function raw(features: object[], output: string): StudioDoc {
  const node = { kind: 'library', name: 'test shape', library: { library: 'test', version: '1.0.0', part: 'x', params: {}, values: {} }, prefix: 'lib1', features, outputs: [output], interfaces: [], warnings: [] } as unknown as ModelNode;
  return withNode(emptyDoc(), node);
}
const XZ = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const over = (doc: StudioDoc, limit = 45, dir?: [number, number, number]) => { const b = bodiesOf(doc)[0]; return overhangOf(b.mesh, faceTableOf(doc), limit, dir); };

test('AM2 overhang map: a box on the bed none (its bottom on the bed, left out); a T\'s arms their undersides exactly (300 mm²); a slope 60° from the vertical counted against 45°, one 30° not; built along −X another answer; a lying cylinder\'s lower quarter-turn band, by its display triangles, said approximate', () => {
  const box = over(rectanglePart(20, 20, 10));
  assert.deepEqual([box.totalMM2, box.faces.length], [0, 0]); assert.ok(Math.abs(box.bedMM2 - 400) < 1e-6);
  let t = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [15, 0], max: [25, 10] });
  t = withNode(t, { kind: 'extrude', sketch: 0, height: 20 });
  t = withNode(t, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 10] });
  t = withNode(t, { kind: 'extrude', sketch: 2, height: 5, from: 20 });
  t = withNode(t, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const T = over(t);
  assert.ok(Math.abs(T.totalMM2 - 300) < 1e-6, String(T.totalMM2)); assert.ok(T.faces.every(f => f.exact && Math.abs(f.worstDeg - 90) < 1e-9)); assert.equal(T.approximate, false);
  const slope = (deg: number) => { const h = 10 / Math.tan(deg * Math.PI / 180); return { h, doc: raw([{ id: 'lib1_s', kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [20, h], [0, h]], plane: XZ }, { id: 'lib1_x', kind: 'extrude', sketch: 'lib1_s', height: 10 }], 'lib1_x') }; };
  const s60 = slope(60), r60 = over(s60.doc);
  assert.ok(Math.abs(r60.totalMM2 - Math.hypot(10, s60.h) * 10) < 1e-4, String(r60.totalMM2)); assert.ok(Math.abs(r60.faces[0].worstDeg - 60) < 1e-4);
  assert.equal(over(slope(30).doc).totalMM2, 0);
  // Built along −X (the part on its side): the 20 × 10 face at x 0 is on the bed now, the T's column end overhangs.
  const side = over(t, 45, [-1, 0, 0]);
  assert.ok(side.bedMM2 > 0 && side.totalMM2 > 0);
  // A cylinder R 5 lying along Y (its axis 5 up): the band within 45° of straight down, 5 × π/2 × 20 = 157.08, by triangles.
  const cyl = over(raw([{ id: 'lib1_c', kind: 'sketch', profile: 'circle', center: [0, 5], radius: 5, plane: XZ }, { id: 'lib1_x', kind: 'extrude', sketch: 'lib1_c', height: 20 }], 'lib1_x'));
  assert.equal(cyl.approximate, true); assert.ok(Math.abs(cyl.totalMM2 / (5 * Math.PI / 2 * 20) - 1) < 0.03, String(cyl.totalMM2));
});

test('AM2 overhang_area as a requirement: FDM measures it; powder (SLS) has no limit — none; moulding is not printing — unknown; no process — unknown', async () => {
  let t = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [15, 0], max: [25, 10] });
  t = withNode(t, { kind: 'extrude', sketch: 0, height: 20 });
  t = withNode(t, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 10] });
  t = withNode(t, { kind: 'extrude', sketch: 2, height: 5, from: 20 });
  t = withNode(t, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const q = { op: '<=' as const, query: { fn: 'overhang_area' as const }, value: 0 };
  const run = (process?: string) => { const d = { ...t, ...(process ? { process } : {}) }; return runCheck(d, bodiesOf(d), (async () => evaluateDoc(d, 1)) as never, q); };
  const fdm = await run('fdm'); assert.deepEqual([fdm.status, fdm.measured], ['fail', 300]);
  const sls = await run('sls'); assert.deepEqual([sls.status, sls.measured], ['pass', 0]);
  assert.equal((await run('injection')).status, 'unknown'); assert.equal((await run()).status, 'unknown');
});
