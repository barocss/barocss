import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, placeBody, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { rotationMatrix } from '@barocss/cad-model/assembly/mates';
import { solveDoc } from '@barocss/cad-model/chat/assembly';
import { mjcfOfDoc, treeOfDoc } from '@barocss/cad-model/chat/robot';
import { applyTo, forwardKinematics } from '@barocss/cad-model/robot/fk';
import { convexHull } from '@barocss/cad-model/robot/hull';
import { meshDistance, meshesMeet, sweepLinks, sweepPath } from '@barocss/cad-model/robot/sweep';
import { CCD_TOLERANCE, sweepTimed, timePath, timeAt } from '../src/robot/ccd';
import { at, trapezoid } from '@barocss/cad-model/robot/profile';

// RM9a (O62): continuous collision along a timed, multi-segment joint path. The 2R arm swung into the post on a trapezoid:
// its time of impact against the plane's separating-axis contact angle mapped through the trapezoid's closed form; two
// segments, the contact on the second; MuJoCo's own first contact (its hulls are these boxes); the 6R arm folding on an
// S-curve against a dense exact check; the bench within twice RM6's.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const hullPts = (p: Float64Array) => convexHull(p).positions;
async function robot(doc: StudioDoc) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, world = new Map<string, BodyResult[]>([['base', r.bodies]]);
  for (const i of solved.instances ?? []) {
    const e = await evaluate(i.doc); assert.ok(e.ok);
    world.set(i.id, e.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)));
  }
  return { tree, links: sweepLinks(tree, p => world.get(p), hullPts), bodies: r.bodies };
}
function armAndPost(): StudioDoc {
  const d: StudioDoc = JSON.parse(readFileSync(join(CASES, 'chain-2r', 'case.json'), 'utf8')).input.document;
  return { ...d, instances: [...d.instances!, { id: 'post', name: 'post', doc: rectanglePart(10, 10, 30), position: [30, 60, 0], rotation: [0, 0, 0], grounded: true }] };
}
/** RM6's oracle: the first angle at which the swung arm meets the post, in the plane — separating axes, bisection to 1e-15. */
function firstContactInPlane(qFrom: number, qTo: number): number {
  const rect = (x0: number, x1: number, y0: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const turn = (p: number[][], q: number) => p.map(([x, y]) => [x * Math.cos(q) - y * Math.sin(q), x * Math.sin(q) + y * Math.cos(q)]);
  const overlap = (A: number[][], B: number[][]) => {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % 4], n = [y1 - y0, x0 - x1], l = Math.hypot(n[0], n[1]);
      const pa = A.map(p => (p[0] * n[0] + p[1] * n[1]) / l), pb = B.map(p => (p[0] * n[0] + p[1] * n[1]) / l);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
    return true;
  };
  const post = rect(10, 20, 40, 50), hit = (q: number) => overlap(turn(rect(-10, 50, -10, 10), q), post) || overlap(turn(rect(30, 90, -10, 10), q), post);
  let lo = qFrom, hi = NaN;
  for (let q = qFrom; q <= qTo; q += 1e-3) { if (hit(q)) { hi = q; break; } lo = q; }
  if (Number.isNaN(hi)) return Infinity;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (m === lo || m === hi) break; if (hit(m)) hi = m; else lo = m; }
  return hi;
}
/** The trapezoid's own closed-form inverse: the time a rest-to-rest move of distance D (limits v, a) has gone x. */
function trapezoidTime(D: number, v: number, a: number, x: number): number {
  const ta = v / a, da = a * ta * ta / 2;
  if (D < v * v / a) { const tt = Math.sqrt(D / a); return x <= D / 2 ? Math.sqrt(2 * x / a) : 2 * tt - Math.sqrt(2 * (D - x) / a); }
  if (x <= da) return Math.sqrt(2 * x / a);
  if (x <= D - da) return ta + (x - da) / v;
  return 2 * ta + (D - 2 * da) / v - Math.sqrt(2 * (D - x) / a);
}
const LIMITS = { default: { v: 1, a: 2, j: 20 } };

test('the normalised profile: every joint within its limits, all starting and stopping together; u⁻¹ exact', () => {
  const seg = trapezoid(1, 0.5, 1);
  for (const s of [0, 1e-9, 0.1, 0.25, 0.5, 0.75, 0.999999, 1]) assert.ok(Math.abs(at(seg, timeAt(seg, s)).s - s) <= 1e-15, String(s));
  assert.ok(Math.abs(timeAt(seg, 0.6) - trapezoidTime(1, 0.5, 1, 0.6)) <= 1e-12);
});

test('the 2R arm swung into the post on a trapezoid: the time of impact where the plane\'s separating axes put it, to 1e-9 s', async () => {
  const { tree, links } = await robot(armAndPost()), qStar = firstContactInPlane(0, 2);
  const r = sweepTimed(tree, links, { waypoints: [{ 'base~a': 0 }, { 'base~a': 2 }], profile: 'trapezoid', limits: LIMITS });
  // (q(t) = 2u(t): a trapezoid of distance 2 at v 1, a 2 — its closed form, not the code's.)
  const tStar = trapezoidTime(2, 1, 2, qStar);
  console.log(`RM9a post: toi ${r.toi?.toFixed(12)} s vs ${tStar.toFixed(12)} s (|Δ| ${Math.abs((r.toi ?? NaN) - tStar).toExponential(2)}), q* ${qStar.toFixed(12)}, ${r.samples} samples`);
  assert.ok(!r.clear && r.links!.includes('post'), JSON.stringify(r.links));
  assert.ok(Math.abs(r.toi! - tStar) <= 1e-9, `${r.toi} vs ${tStar}`);
  // (Nothing before it: the profile's clearances all above the tolerance until the impact.)
  assert.ok(r.clearanceProfile.every(([t, mm]) => t >= r.toi! - 1e-15 || mm > CCD_TOLERANCE));
  assert.ok(r.clearanceProfile.every((p, i, a) => i === 0 || p[0] >= a[i - 1][0]), 'in time order');
});

test('two segments: out clear, then back into the post — the contact on the second at its oracle time; the first\'s least clearance against a dense exact sampling', async () => {
  const { tree, links } = await robot(armAndPost()), out = -Math.PI / 2;
  const r = sweepTimed(tree, links, { waypoints: [{ 'base~a': 0 }, { 'base~a': out }, { 'base~a': 2 }], profile: 'trapezoid', limits: LIMITS });
  const T1 = trapezoidTime(Math.PI / 2, 1, 2, Math.PI / 2), qStar = firstContactInPlane(out, 2), tStar = T1 + trapezoidTime(2 - out, 1, 2, qStar - out);
  assert.equal(r.segment, 1); assert.ok(Math.abs(r.segments[1].t0 - T1) <= 1e-12);
  assert.ok(Math.abs(r.toi! - tStar) <= 1e-9, `${r.toi} vs ${tStar}`);
  // (Segment 1's least clearance: our samples' against 400 dense ones over the same pairs (RM6's), the exact mesh distance,
  // within the dense step's motion bound — the arm's farthest point from its pivot, 90 mm, times the step's turn.)
  const first = r.clearanceProfile.filter(([t]) => t <= T1), ours = Math.min(...first.map(p => p[1])), pairs = sweepPath(tree, links, {}, { 'base~a': out }).pairs;
  let dense = Infinity;
  for (let k = 0; k <= 400; k++) {
    const fk = forwardKinematics(tree, { 'base~a': out * k / 400 }), P = new Map(links.map(l => { const m = fk.motions.get(l.link)!, p = new Float64Array(l.positions.length); for (let i = 0; i < p.length; i += 3) { const v = applyTo(m, [l.positions[i], l.positions[i + 1], l.positions[i + 2]]); p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; } return [l.link, { p, i: l.indices }]; }));
    for (const [A, B] of pairs) { const a = P.get(A)!, b = P.get(B)!; dense = Math.min(dense, meshDistance(a.p, a.i, b.p, b.i)); }
  }
  const bound = 90 * (Math.PI / 2) / 400;
  console.log(`RM9a two segments: toi ${r.toi!.toFixed(9)} s (oracle ${tStar.toFixed(9)}); segment 1 least clearance ${ours.toFixed(6)} mm vs dense ${dense.toFixed(6)} mm (± ${bound.toFixed(3)})`);
  assert.ok(Math.abs(ours - dense) <= bound, `${ours} vs ${dense}`);
});

test('the 6R arm folding on an S-curve: no earlier contact in 2000 exact samples; in contact to the tolerance at the time of impact; within the S0\'s budget (twice RM6\'s 225 ms)', async () => {
  const doc: StudioDoc = JSON.parse(readFileSync(join(CASES, 'arm-6r', 'robot.bcad'), 'utf8')), { tree, links } = await robot(doc);
  const to = { 'l1~l2': 1.2, 'l2~l3': 2.6, 'l4~l5': -2.4 };
  // (Each timed at its best of three, alternating: a first run pays for the JIT and caches.)
  let rm6 = sweepPath(tree, links, {}, to), r = sweepTimed(tree, links, { waypoints: [{}, to], profile: 's-curve', limits: LIMITS }), tRm6 = Infinity, tCcd = Infinity;
  for (let k = 0; k < 3; k++) {
    let t0 = performance.now(); rm6 = sweepPath(tree, links, {}, to); tRm6 = Math.min(tRm6, performance.now() - t0);
    t0 = performance.now(); r = sweepTimed(tree, links, { waypoints: [{}, to], profile: 's-curve', limits: LIMITS }); tCcd = Math.min(tCcd, performance.now() - t0);
  }
  console.log(`RM9a 6R: toi ${r.toi?.toFixed(9)} s, ${r.links?.join('–')}, ${r.samples} samples; ${tCcd.toFixed(0)} ms vs RM6 ${tRm6.toFixed(0)} ms (${rm6.samples} samples)`);
  assert.ok(!r.clear && rm6.contact && r.links!.join() === rm6.contact.links.join());
  const [g] = timePath(tree, { waypoints: [{}, to], profile: 's-curve', limits: LIMITS }), sToi = at(g.profile!, r.toi!).s;
  assert.ok(Math.abs(sToi - rm6.contact!.s) <= 1e-4, `s ${sToi} vs RM6 ${rm6.contact!.s}`);
  const keys = Object.keys(to) as (keyof typeof to)[], pose = (s: number) => { const fk = forwardKinematics(tree, Object.fromEntries(keys.map(x => [x, s * to[x]]))); return new Map(links.map(l => { const m = fk.motions.get(l.link)!, p = new Float64Array(l.positions.length); for (let i = 0; i < p.length; i += 3) { const v = applyTo(m, [l.positions[i], l.positions[i + 1], l.positions[i + 2]]); p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; } return [l.link, { p, i: l.indices }]; })); };
  const pairs = rm6.pairs;
  for (let k = 0; k < 2000; k++) { const P = pose(sToi * k / 2000); for (const [A, B] of pairs) { const a = P.get(A)!, b = P.get(B)!; assert.ok(!meshesMeet(a.p, a.i, b.p, b.i), `${A}–${B} meet at s ${sToi * k / 2000} before the impact`); } }
  const P = pose(sToi), [A, B] = r.links!, a = P.get(A)!, b = P.get(B)!;
  assert.ok(meshDistance(a.p, a.i, b.p, b.i) <= 1e-6, 'in contact to the tolerance');
  // (The S0's budget: twice RM6's 225 ms. RM6 itself is now ~7 ms: meshDistance prunes triangle pairs by their boxes.)
  assert.ok(tCcd <= 2 * 225, `${tCcd} ms vs RM6 ${tRm6} ms`);
});

test('MuJoCo\'s first contact (kinematic replay, its hulls these boxes) equals ours within 1e-6 s; the case written for it', async () => {
  const doc = armAndPost(), { tree, links, bodies } = await robot(doc), dir = join(CASES, 'ccd-post');
  const path = { waypoints: [{ 'base~a': 0 }, { 'base~a': 2 }], profile: 'trapezoid' as const, limits: LIMITS }, r = sweepTimed(tree, links, path);
  if (process.env.UPDATE_CCD_CASE || !existsSync(join(dir, 'case.json'))) {
    mkdirSync(join(dir, 'model', 'meshes'), { recursive: true });
    const m = await mjcfOfDoc(doc, bodies, evaluate, 'arm'); assert.ok(m.ok);
    writeFileSync(join(dir, 'model', 'arm.xml'), m.xml);
    for (const f of m.files) { mkdirSync(join(dir, 'model', f.path, '..'), { recursive: true }); writeFileSync(join(dir, 'model', f.path), f.data); }
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'ccd-post', step: 'RM9a', note: 'The 2R arm turned on base~a from 0 to 2 rad on a trapezoid (v 1 rad/s, a 2 rad/s²) beside a grounded post: the time of impact from the plane\'s separating-axis contact angle through the trapezoid\'s closed form, independent of the sweep. MuJoCo\'s replay (scripts/ccd-oracle.py) reads model/arm.xml.', input: { document: doc, path }, expect: { toi_s: trapezoidTime(2, 1, 2, firstContactInPlane(0, 2)), tol_s: 1e-9, with: 'post', mujoco: { joint: 'base_to_a', from: 0, to: 2, v: 1, a: 2, geom: 'post_collision' } } }, null, 1) + '\n');
  }
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
  assert.ok(Math.abs(r.toi! - c.expect.toi_s) <= c.expect.tol_s, `${r.toi} vs ${c.expect.toi_s}`);
  const reading = join(dir, 'oracle.mujoco-3.3.0.json');
  if (!existsSync(reading)) { console.log('RM9a MuJoCo: no reading yet (scripts/ccd-oracle.py)'); return; }
  const mj = JSON.parse(readFileSync(reading, 'utf8'));
  console.log(`RM9a MuJoCo: first contact ${mj.toi_s.toFixed(9)} s vs ours ${r.toi!.toFixed(9)} s (|Δ| ${Math.abs(mj.toi_s - r.toi!).toExponential(2)}), ${mj.geoms.join('–')}`);
  assert.ok(Math.abs(mj.toi_s - r.toi!) <= 1e-6, `${mj.toi_s} vs ${r.toi}`);
});
