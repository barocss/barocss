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

import { printability, cavitiesOf } from '../src/print/rules';
import { withLook } from '../src/app/bodies';

const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
const report = async (doc: StudioDoc, direction?: [number, number, number]) => { const r = await printability(doc, bodiesOf(doc), evaluate, direction ? { direction } : {}); return Object.fromEntries(r.rules.map(x => [x.id, x])); };
const printed = (doc: StudioDoc, process = 'fdm', printer: string | undefined = 'fdm-256', material = 'abs') => { const d = { ...doc, process, ...(printer ? { printer } : {}) }; return withLook(d, bodiesOf(d)[0], { material }); };

test('AM3 printability on an ABS plate printed flat (FDM 256³): every rule passes; warp is the heuristic warpRisk × (60/100) × 1 = 0.48; a 100 mm plate 0.8 — warned; 300 mm long — off the bed; no orientation — the orientation\'s rules unknown, said; moulding — its own rules (O77)', async () => {
  let r = await report(printed(rectanglePart(60, 40, 2)), [0, 0, 1]);
  for (const id of ['wall', 'wall-rec', 'hole', 'horizontal-hole', 'cavity', 'bed-fit', 'overhang', 'warp', 'tip']) assert.equal(r[id].status, 'pass', `${id}: ${JSON.stringify(r[id])}`);
  assert.equal(r.gap.status, 'n/a');
  assert.ok(Math.abs(r.warp.value! - 0.8 * 0.6 * 1) < 1e-9); assert.equal(r.warp.source, 'P-FDM');
  r = await report(printed(rectanglePart(100, 40, 2)), [0, 0, 1]);
  assert.deepEqual([r.warp.status, +r.warp.value!.toFixed(9)], ['warn', 0.8]);
  r = await report(printed(rectanglePart(300, 40, 2)), [0, 0, 1]);
  assert.equal(r['bed-fit'].status, 'fail'); assert.ok(Math.abs(r['bed-fit'].value! - 300 / 256) < 1e-9);
  r = await report(printed(rectanglePart(60, 40, 2)));
  for (const id of ['bed-fit', 'overhang', 'warp', 'tip', 'horizontal-hole']) assert.equal(r[id].status, 'unknown', id);
  assert.match(r.warp.why!, /no orientation/);
  // (O77: moulding has its own rules now — test/mould.test.ts; here only that it is judged as moulding, not printing.)
  r = await report({ ...rectanglePart(60, 40, 2), process: 'injection' });
  assert.deepEqual(Object.keys(r), ['pull', 'finish', 'wall', 'wall-material', 'size', 'draft', 'undercut']);
});

test('AM3 rules that fail or warn: a hole too small to print open; a horizontal hole over 6 mm sags (warned) — built along its axis it does not; a tall pin tips; an enclosed cavity traps powder (SLS fails) where FDM fills it; SLS does not tip (n/a); bodies 0.1 mm apart may fuse; the gap rule as a requirement', async () => {
  // A 40 × 20 × 10 block with a Ø1 hole down and a Ø8 hole along X.
  const block = raw([
    { id: 'lib1_s', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'lib1_b', kind: 'extrude', sketch: 'lib1_s', height: 10 },
    { id: 'lib1_h', kind: 'hole', target: 'lib1_b', center: [5, 10], radius: 0.5 },
    { id: 'lib1_x', kind: 'hole', target: 'lib1_h', axis: 'x', side: 'min', center: [10, 5], radius: 4 }], 'lib1_x');
  let r = await report(printed(block), [0, 0, 1]);
  assert.equal(r.hole.status, 'fail'); assert.ok(Math.abs(r.hole.value! - 1) < 1e-9);
  assert.equal(r['horizontal-hole'].status, 'warn'); assert.ok(Math.abs(r['horizontal-hole'].value! - 8) < 1e-9);
  r = await report(printed(block), [1, 0, 0]);
  assert.equal(r['horizontal-hole'].status, 'pass');
  // A pin Ø4 × 40 standing: 40 / √(4π) = 11.3, past 4.
  const pin = raw([{ id: 'lib1_c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 }, { id: 'lib1_p', kind: 'extrude', sketch: 'lib1_c', height: 40 }], 'lib1_p');
  r = await report(printed(pin), [0, 0, 1]);
  // (Its round foot's area is the display mesh's — a polygon in the circle — to the chord error: within 1%.)
  assert.equal(r.tip.status, 'warn'); assert.ok(Math.abs(r.tip.value! / (40 / Math.sqrt(4 * Math.PI)) - 1) < 0.01, String(r.tip.value));
  // A closed box with a void inside.
  const hollow = raw([
    { id: 'lib1_o', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] }, { id: 'lib1_ob', kind: 'extrude', sketch: 'lib1_o', height: 30 },
    { id: 'lib1_i', kind: 'sketch', profile: 'rectangle', min: [5, 5], max: [25, 25] }, { id: 'lib1_ib', kind: 'extrude', sketch: 'lib1_i', height: 20, from: 5 },
    { id: 'lib1_v', kind: 'difference', target: 'lib1_ob', tool: 'lib1_ib' }], 'lib1_v');
  assert.equal(cavitiesOf(bodiesOf(hollow)[0].mesh), 1);
  r = await report(printed(hollow, 'sls', 'sls-300', 'pa12'), [0, 0, 1]);
  assert.deepEqual([r.cavity.status, r.cavity.value], ['fail', 1]); assert.match(r.cavity.message, /traps powder: give it 2 escape holes of at least Ø5 mm/);
  assert.match(String(r.cavity.why), /B-rep shells/); // (exact: the solid's inner shell, not the display mesh's pieces)
  assert.equal(r.tip.status, 'n/a');
  r = await report(printed(hollow), [0, 0, 1]);
  assert.equal(r.cavity.status, 'pass');
  // Two blocks 0.1 apart, printed together.
  let two = withNode(rectanglePart(20, 20, 5), { kind: 'sketch', profile: 'rectangle', min: [20.1, 0], max: [40, 20] });
  two = withNode(two, { kind: 'extrude', sketch: 2, height: 5 });
  r = await report(printed(two), [0, 0, 1]);
  assert.deepEqual([r.gap.status, r.gap.value], ['warn', 0.1]);
  const d = printed(two), q = await runCheck(d, bodiesOf(d), evaluate as never, { op: '>=', query: { fn: 'print_rule', rule: 'gap', direction: [0, 0, 1] }, value: 0.3 });
  assert.deepEqual([q.status, q.measured], ['fail', 0.1]);
});

import { searchOrientation, orientPart, buildBvh, rayHit, fibonacciDirections } from '../src/print/orient';

const tShape = () => {
  let t = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [15, 0], max: [25, 10] });
  t = withNode(t, { kind: 'extrude', sketch: 0, height: 20 });
  t = withNode(t, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 10] });
  t = withNode(t, { kind: 'extrude', sketch: 2, height: 5, from: 20 });
  return withNode(t, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
};

test('AM4 orientation: a T prints on its flat side (whole outline on the bed, lowest, no support), upright it overhangs, upside down it does not; a plate flat; the same model the same answer every time; the top three with their normalised terms and the profile\'s weights; the ray tree hits what the brute force hits', () => {
  const t = { ...tShape(), process: 'fdm' }, b = bodiesOf(t)[0];
  const r = orientPart(t, [b], faceTableOf(t), processProfile('fdm')) as ReturnType<typeof searchOrientation>;
  assert.ok(typeof r !== 'string');
  assert.ok(Math.abs(Math.abs(r.best.direction[1]) - 1) < 1e-9, JSON.stringify(r.best)); assert.equal(r.best.supportMM3, 0); assert.equal(r.best.overhangMM2, 0); assert.equal(r.best.heightMM, 10); assert.ok(Math.abs(r.best.contactMM2 - 400) < 1e-6);
  const up = overhangOf(b.mesh, faceTableOf(t), 45, [0, 0, 1]), down = overhangOf(b.mesh, faceTableOf(t), 45, [0, 0, -1]);
  assert.ok(Math.abs(up.totalMM2 - 300) < 1e-6, String(up.totalMM2)); assert.equal(down.totalMM2, 0); assert.ok(r.candidates >= 64);
  assert.equal(r.top.length, 3); assert.ok(r.top.every((x, i) => i === 0 || x.score >= r.top[i - 1].score));
  assert.deepEqual(r.weights, { support: 2, overhang: 1, height: 0.5, contact: 0.5 });
  assert.ok(r.top.every(x => ['support', 'overhang', 'height', 'contact'].every(k => Number.isFinite((x.terms as unknown as Record<string, number>)[k]))));
  const again = orientPart(t, [bodiesOf(t)[0]], faceTableOf(t), processProfile('fdm')) as typeof r;
  assert.deepEqual(again.top.map(x => [x.index, x.score]), r.top.map(x => [x.index, x.score]));
  const plate = rectanglePart(60, 40, 2), pr = searchOrientation(bodiesOf(plate)[0].mesh, faceTableOf(plate), 45);
  assert.ok(Math.abs(Math.abs(pr.best.direction[2]) - 1) < 1e-9, JSON.stringify(pr.best.direction));
  // The ray tree against a brute force over every triangle: 200 rays through the T.
  const bvh = buildBvh(b.mesh), P = b.mesh.positions, I = b.mesh.indices;
  const brute = (o: number[], d: number[]) => { let best = Infinity; for (let k = 0; k < I.length; k += 3) { const a = [P[3 * I[k]], P[3 * I[k] + 1], P[3 * I[k] + 2]], c = [P[3 * I[k + 1]], P[3 * I[k + 1] + 1], P[3 * I[k + 1] + 2]], f = [P[3 * I[k + 2]], P[3 * I[k + 2] + 1], P[3 * I[k + 2] + 2]];
    const e1 = c.map((x, j) => x - a[j]), e2 = f.map((x, j) => x - a[j]), h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-14) continue; const s = o.map((x, j) => x - a[j]), u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det; if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det; if (v < 0 || u + v > 1) continue;
    const tt = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det; if (tt > 1e-6 && tt < best) best = tt; } return best; };
  const dirs = fibonacciDirections(200);
  for (let i = 0; i < 200; i++) { const o = [20 + 10 * Math.sin(i), 5 + 3 * Math.cos(i), 12 + 8 * Math.sin(2 * i)]; assert.equal(rayHit(bvh, o, dirs[i]), brute(o, dirs[i]), `ray ${i}`); }
});

test('AM4 performance: 100 000 triangles oriented (well under 6 s even under load; the bench holds it to 1.2 s); the snap hook\'s print-plane rule read from the chosen orientation', async () => {
  // A bumpy sphere-like mesh, 224 × 224 quads, 100 352 triangles.
  const n = 224, P: number[] = [], I: number[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j < n; j++) { const th = Math.PI * i / n, ph = 2 * Math.PI * j / n, r = 20 + 2 * Math.sin(5 * th) * Math.cos(3 * ph); P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)); }
  // (The poles welded: rows 0 and n each one point.)
  const at = (i: number, j: number) => i === 0 ? 0 : i === n ? n * n : (i * n + (j % n));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1); if (i > 0) I.push(a, b, d); if (i < n - 1) I.push(b, c, d); else I.push(b, c, d); }
  const doc = withNode(emptyDoc(), { kind: 'mesh', name: 'bump', unit: 'mm', positions: P, indices: I, representation: 'facets' } as never);
  const r0 = evaluateDoc(doc, 1); assert.ok(r0.ok, r0.ok ? '' : r0.error.hint);
  const mesh = r0.ok ? r0.bodies[0].mesh : null!;
  const tris = mesh.indices.length / 3; assert.ok(tris >= 99_000, String(tris));
  const r = searchOrientation(mesh, faceTableOf(doc), 45);
  // (A wall-clock bound, so with room for a loaded machine — the suite beside the kernel's once took it past 2 s; the
  // measure is the bench row 'print: orientation search, 100k triangles', budget 1.2 s, about 0.6 s alone.)
  assert.ok(r.ms < 6000, `${r.ms} ms for ${tris} triangles`);
  if (process.env.AM_PERF) console.log(`AM4 perf: ${tris} triangles, ${r.candidates} candidates, ${r.ms.toFixed(0)} ms`);
  // The snap hook on a plate's top face: printed up +Z its beam stands up (across the layers) — warned; up +X it lies in them.
  const { addLibraryPartToBody } = await import('../src/library/libraries');
  const plate = (direction: [number, number, number]) => withLook({ ...rectanglePart(60, 40, 3), process: 'fdm', print: { direction } }, bodiesOf(rectanglePart(60, 40, 3))[0], { material: 'abs' });
  const on = (direction: [number, number, number]) => (addLibraryPartToBody(plate(direction), 'enclosure', 'snap-hook', {}, { body: { node: 1, side: 'solid' }, face: 'n1.top', point: [30, 20, 3], normal: [0, 0, 1] }) as { node: Extract<ModelNode, { kind: 'library' }> }).node;
  assert.ok(on([0, 0, 1]).warnings.some(w => /^print-plane: printed in layers/.test(w)));
  assert.ok(!on([1, 0, 0]).warnings.some(w => /^print-plane/.test(w)), on([1, 0, 0]).warnings.join(' | '));
});

test('AM4 through the agent tool: orient_for_print scores (apply false changes nothing), then applies the best direction to the document\'s print settings; refused with no process chosen', async () => {
  const { runTool } = await import('../src/chat/tools');
  const { evaluatePart } = await import('../src/engine/evaluate');
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1);
  const doc = { ...tShape(), process: 'fdm' }, r0 = await evaluate(doc); assert.ok(r0.ok);
  const s = { doc, bodies: r0.ok ? r0.bodies : [] };
  const dry = await runTool(s, 'orient_for_print', { apply: false }, evaluate);
  assert.ok(!dry.isError, dry.content); assert.equal(dry.state.doc.print, undefined);
  const out = JSON.parse(dry.content);
  assert.equal(out.top.length, 3); assert.deepEqual(Object.keys(out.top[0].terms).sort(), ['contact', 'height', 'overhang', 'support']);
  const applied = await runTool(s, 'orient_for_print', {}, evaluate);
  assert.ok(!applied.isError, applied.content);
  const set = applied.state.doc.print?.direction; assert.ok(set && set.every((v, i) => Math.abs(v - out.best.direction[i]) < 1e-6 && !Object.is(v, -0)), JSON.stringify(set));
  const none = await runTool({ ...s, doc: tShape() }, 'orient_for_print', {}, evaluate);
  assert.ok(none.isError, none.content);
});
