import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type PartInstance, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { solveDoc } from '../src/assembly/edit';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { applyTo, forwardKinematics } from '../src/robot/fk';
import { coordinates, gravityTorques, linkBodies, massMatrix, moveTorques, rnea, STANDARD_GRAVITY, type LinkBody } from '../src/robot/dynamics';
import { at, onSegment, sCurve, sCurveTimes, trapezoid } from '../src/robot/profile';
import type { Joint, JointTree } from '../src/robot/joints';
import type { Mat3 } from '../src/robot/inertia';

// RD2 (O21): inverse dynamics and moves. The RNEA is checked against oracles that do not use it: M(q) from the
// geometric Jacobians (its columns = RNEA(q, 0, e_k) − G), the kinetic energy from FK velocities, the planar 2R
// Lagrangian closed form to 1e-9, M symmetric positive definite, and the energy balance ∫ q̇ᵀτ dt = ΔV along a move
// from rest to rest. The profiles' durations against their closed forms, their limits never exceeded; peak and RMS
// torque against the closed form of a joint with no gravity load.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(calls: [string, object][]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }
let seed = 17; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const g0 = STANDARD_GRAVITY;

/** A random 3D tree of turns and slides, each link with a mass, a centre and a random positive definite inertia. */
function randomRobot(n: number): { tree: JointTree; bodies: Map<string, LinkBody> } {
  const joints: Joint[] = [], ids = ['L0'], bodies = new Map<string, LinkBody>([['L0', { massKg: 1, com: [0, 0, 0], I: [1, 0, 0, 0, 1, 0, 0, 0, 1] }]]);
  for (let k = 1; k <= n; k++) {
    const a = [rand() - 0.5, rand() - 0.5, rand() - 0.5], len = Math.hypot(...a), parent = ids[Math.floor(rand() * ids.length)];
    joints.push({ key: `j${k}`, type: rand() < 0.7 ? 'continuous' : 'prismatic', parent, child: `L${k}`, axis: a.map(x => x / len) as [number, number, number], origin: [rand() * 300 - 150, rand() * 300 - 150, rand() * 300], mates: [] });
    ids.push(`L${k}`);
    // (I = AᵀA + εE: positive definite; kg·m², a few grams to kilograms.)
    const A = Array.from({ length: 9 }, () => (rand() - 0.5) * 0.1), I = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[i] * A[j] + A[3 + i] * A[3 + j] + A[6 + i] * A[6 + j] + (i === j ? 1e-4 : 0))) as Mat3;
    bodies.set(`L${k}`, { massKg: 0.1 + rand() * 2, com: [rand() * 300 - 150, rand() * 300 - 150, rand() * 300], I });
  }
  return { tree: { version: 1, base: 'L0', links: ids.map(id => ({ id, part: id, name: id })), joints, loops: [], couplings: [], problems: [], notes: [] }, bodies };
}
const randQ = (tree: JointTree, scale = 1) => Object.fromEntries(coordinates(tree).map(k => [k, (rand() * 2 - 1) * (tree.joints.find(j => j.key === k)!.type === 'prismatic' ? 50 : 3) * scale]));
/** SI rates: a slide's mm in metres. */
const siOf = (tree: JointTree, k: string, v: number) => (tree.joints.find(j => j.key === k)!.type === 'prismatic' ? v * 1e-3 : v);

test('M from the Jacobians equals the RNEA\'s columns (RNEA(q, 0, e_k) − G), and RNEA = M q̈ + C + G with C = RNEA(q, q̇, 0) − G', () => {
  for (let trial = 0; trial < 40; trial++) {
    const { tree, bodies } = randomRobot(6), q = randQ(tree), { keys, M } = massMatrix(tree, bodies, q), zero = Object.fromEntries(keys.map(k => [k, 0]));
    const G = rnea(tree, bodies, q, zero, zero), scale = Math.max(...M.flat().map(Math.abs));
    keys.forEach((k, c) => {
      // (A unit acceleration in SI: 1 rad/s², or 1 m/s² = 1000 mm/s² for a slide.)
      const e = { ...zero, [k]: tree.joints.find(j => j.key === k)!.type === 'prismatic' ? 1000 : 1 }, col = rnea(tree, bodies, q, zero, e);
      keys.forEach((r, i) => assert.ok(Math.abs(col[r] - G[r] - M[i][c]) < 1e-9 * scale, `${trial} M[${r},${k}]: ${col[r] - G[r]} vs ${M[i][c]}`));
    });
    const qd = randQ(tree), qdd = randQ(tree), C = rnea(tree, bodies, q, qd, zero), full = rnea(tree, bodies, q, qd, qdd);
    keys.forEach((r, i) => { const Mq = keys.reduce((s, k, c) => s + M[i][c] * siOf(tree, k, qdd[k]), 0); assert.ok(Math.abs(full[r] - (Mq + C[r])) < 1e-9 * Math.max(1, Math.abs(full[r]))); });
    // (Gravity's part of the RNEA is RD1's G.)
    const G1 = gravityTorques(tree, bodies, q).torques;
    for (const k of keys) assert.ok(Math.abs(G[k] - G1[k]) < 1e-9 * Math.max(1, Math.abs(G1[k])), `G ${k}`);
  }
});

test('M is symmetric positive definite; ½ q̇ᵀ M q̇ is the kinetic energy Σ ½ m v² + ½ ωᵀ I ω from FK velocities (central differences)', () => {
  for (let trial = 0; trial < 40; trial++) {
    const { tree, bodies } = randomRobot(5), q = randQ(tree), qd = randQ(tree, 0.5), { keys, M } = massMatrix(tree, bodies, q);
    for (let i = 0; i < keys.length; i++) for (let j = 0; j < keys.length; j++) assert.ok(Math.abs(M[i][j] - M[j][i]) < 1e-12 * Math.max(1, Math.abs(M[i][j])));
    // Cholesky: every pivot above 0.
    const L = M.map(r => r.map(() => 0));
    for (let i = 0; i < keys.length; i++) for (let j = 0; j <= i; j++) {
      let s = M[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { assert.ok(s > 0, `${trial}: not positive definite`); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    const v = keys.map(k => siOf(tree, k, qd[k])), T = 0.5 * keys.reduce((s, _, i) => s + keys.reduce((t, __, j) => t + v[i] * M[i][j] * v[j], 0), 0);
    const h = 1e-6, plus = forwardKinematics(tree, Object.fromEntries(keys.map(k => [k, q[k] + h * qd[k]]))), minus = forwardKinematics(tree, Object.fromEntries(keys.map(k => [k, q[k] - h * qd[k]])));
    let T2 = 0;
    for (const [id, b] of bodies) {
      const P = plus.motions.get(id)!, Q = minus.motions.get(id)!, cp = applyTo(P, b.com), cq = applyTo(Q, b.com), vel = [0, 1, 2].map(i => (cp[i] - cq[i]) / (2 * h) / 1000);
      // (ω from R₊ R₋ᵀ ≈ E + 2h [ω]×; the world inertia at q from its rotation R₀ = (R₊ + R₋)/2 to second order.)
      const Rr = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => P.R[i * 3] * Q.R[j * 3] + P.R[i * 3 + 1] * Q.R[j * 3 + 1] + P.R[i * 3 + 2] * Q.R[j * 3 + 2]));
      const w = [(Rr[7] - Rr[5]) / (4 * h), (Rr[2] - Rr[6]) / (4 * h), (Rr[3] - Rr[1]) / (4 * h)];
      const R0 = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (P.R[i] + Q.R[i]) / 2), RI = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => [0, 1, 2].reduce((s, k) => s + R0[i * 3 + k] * [0, 1, 2].reduce((t, l) => t + b.I[k * 3 + l] * R0[j * 3 + l], 0), 0)));
      T2 += 0.5 * b.massKg * (vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2) + 0.5 * [0, 1, 2].reduce((s, i) => s + w[i] * [0, 1, 2].reduce((t, j) => t + RI[i * 3 + j] * w[j], 0), 0);
    }
    assert.ok(Math.abs(T - T2) < 1e-6 * Math.max(1e-9, T), `${trial}: ½q̇ᵀMq̇ ${T} vs ${T2}`);
  }
});

/** The planar 2R of RD1 (blocks on Y-axis joints beside an upright one). */
async function planar2R() {
  const b = await build([['run_command', { command: 'box', values: { w: 20, d: 20, h: 80, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }],
    ['run_command', { command: 'hole', faces: ['n1.bottom'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 20 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 60 } }]]);
  const ids = ['l1', 'l2'], mates: Mate[] = [], instances: PartInstance[] = ids.map((id, k) => ({ id, name: id, doc: b, position: [0, 20 * (k + 1), 40 * (k + 1)], rotation: [0, 0, 0] }));
  ids.forEach((id, k) => { const p = k ? ids[k - 1] : 'base'; mates.push({ id: `c${k + 1}`, kind: 'concentric', a: { part: p, face: 'n5.side0' }, b: { part: id, face: 'n4.side0' } }, { id: `f${k + 1}`, kind: 'coincident', a: { part: p, face: 'n1.side2' }, b: { part: id, face: 'n1.side0' } }); });
  return robotOf({ ...b, instances, mates });
}
async function robotOf(doc: StudioDoc) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, own = new Map([['base', r.bodies]]);
  for (const i of solved.instances ?? []) { const e = await evaluate(i.doc); assert.ok(e.ok); own.set(i.id, e.bodies); }
  const bodies = linkBodies(tree, p => { if (p === 'base') return { doc, bodies: r.bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances!.find(x => x.id === p)!; return { doc: i.doc, bodies: own.get(p)!, position: i.position, rotation: i.rotation }; });
  return { doc, tree, bodies, evaluated: r.bodies };
}

test('the planar 2R Lagrangian closed form, to 1e-9: M11, M12, M22 with I + m lc² terms, the Coriolis h = m2 l1 lc sin q2, gravity', async () => {
  const { tree, bodies } = await planar2R(), [k1, k2] = coordinates(tree);
  const m = bodies.get('l1')!.massKg, Ic = bodies.get('l1')!.I[4], l1 = 0.04, lc = 0.02;
  assert.ok(Math.abs(bodies.get('l2')!.I[4] - Ic) < 1e-18, 'the same block');
  let worst = 0;
  for (let k = 0; k < 300; k++) {
    const q1 = (rand() * 2 - 1) * Math.PI, q2 = (rand() * 2 - 1) * Math.PI, d1 = rand() * 6 - 3, d2 = rand() * 6 - 3, a1 = rand() * 20 - 10, a2 = rand() * 20 - 10;
    const tau = rnea(tree, bodies, { [k1]: q1, [k2]: q2 }, { [k1]: d1, [k2]: d2 }, { [k1]: a1, [k2]: a2 });
    const M11 = 2 * Ic + m * lc * lc + m * (l1 * l1 + lc * lc + 2 * l1 * lc * Math.cos(q2)), M12 = Ic + m * (lc * lc + l1 * lc * Math.cos(q2)), M22 = Ic + m * lc * lc, h = m * l1 * lc * Math.sin(q2);
    // (Gravity in the plane, angles from upright about +Y: x = z sin θ, as RD1's closed form.)
    const G1 = -g0 * (m * lc * Math.sin(q1) + m * (l1 * Math.sin(q1) + lc * Math.sin(q1 + q2))), G2 = -g0 * m * lc * Math.sin(q1 + q2);
    const t1 = M11 * a1 + M12 * a2 - h * (2 * d1 * d2 + d2 * d2) + G1, t2 = M12 * a1 + M22 * a2 + h * d1 * d1 + G2;
    worst = Math.max(worst, Math.abs(tau[k1] - t1) / Math.max(1e-6, Math.abs(t1)), Math.abs(tau[k2] - t2) / Math.max(1e-6, Math.abs(t2)));
  }
  assert.ok(worst < 1e-9, `worst relative ${worst}`);
});

test('the energy balance along a move from rest to rest: ∫ q̇ᵀτ dt = V(end) − V(start), the RNEA\'s τ along an S-curve', async () => {
  const check = (tree: JointTree, bodies: Map<string, LinkBody>, q1: Record<string, number>) => {
    const keys = coordinates(tree), p = sCurve(1, 0.8, 3, 20);
    let work = 0;
    for (const seg of p.segments) {
      const n = 400, hh = (seg.t1 - seg.t0) / n;
      for (let i = 0; i <= n; i++) {
        const s = at(p, seg.t0 + i * hh), q = Object.fromEntries(keys.map(k => [k, s.s * q1[k]])), qd = Object.fromEntries(keys.map(k => [k, s.v * q1[k]])), qdd = Object.fromEntries(keys.map(k => [k, s.a * q1[k]]));
        const tau = rnea(tree, bodies, q, qd, qdd), power = keys.reduce((acc, k) => acc + tau[k] * siOf(tree, k, qd[k]), 0);
        work += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * power * hh / 3;
      }
    }
    const V = (q: Record<string, number>) => { const fk = forwardKinematics(tree, q); let v = 0; for (const [id, b] of bodies) v += b.massKg * g0 * applyTo(fk.motions.get(id)!, b.com)[2] / 1000; return v; };
    const dV = V(q1) - V({});
    return { work, dV };
  };
  for (let trial = 0; trial < 10; trial++) { const { tree, bodies } = randomRobot(5), q1 = randQ(tree, 0.5), r = check(tree, bodies, q1); assert.ok(Math.abs(r.work - r.dV) < 1e-6 * Math.max(1, Math.abs(r.dV)), `${trial}: ${r.work} vs ${r.dV}`); }
  const { tree, bodies } = await planar2R(), [k1, k2] = coordinates(tree), r = check(tree, bodies, { [k1]: 1.1, [k2]: -0.7 });
  assert.ok(Math.abs(r.work - r.dV) < 1e-7 * Math.max(1e-3, Math.abs(r.dV)), `2R: ${r.work} vs ${r.dV}`);
});

test('the profiles: durations against their closed forms, rest to rest, the distance exact, the limits never exceeded', () => {
  const cases: [string, ReturnType<typeof trapezoid>, number, { v: number; a: number; j?: number }][] = [];
  // Trapezoid: v reached → d/v + v/a; not → 2√(d/a).
  cases.push(['trapezoid', trapezoid(2, 0.5, 1), 2 / 0.5 + 0.5 / 1, { v: 0.5, a: 1 }], ['triangular', trapezoid(0.1, 0.5, 1), 2 * Math.sqrt(0.1 / 1), { v: 0.5, a: 1 }], ['backwards', trapezoid(-2, 0.5, 1), 4.5, { v: 0.5, a: 1 }]);
  // S-curve: everything reached → d/v + v/a + a/j; neither v nor a → 4 (d / 2j)^⅓.
  cases.push(['s-curve, all reached', sCurve(2, 0.5, 1, 10), 2 / 0.5 + 0.5 / 1 + 1 / 10, { v: 0.5, a: 1, j: 10 }], ['s-curve, a and v not reached', sCurve(1e-3, 0.5, 1, 10), 4 * Math.cbrt(1e-3 / 20), { v: 0.5, a: 1, j: 10 }]);
  for (const [name, p, T, l] of cases) {
    assert.ok(Math.abs(p.duration - T) < 1e-12 * T, `${name}: ${p.duration} vs ${T}`);
    const end = at(p, p.duration - 1e-15), last = p.segments.at(-1)!, u = last.t1 - last.t0;
    const sEnd = last.s + last.v * u + last.a * u * u / 2 + last.j * u * u * u / 6, vEnd = last.v + last.a * u + last.j * u * u / 2;
    assert.ok(Math.abs(sEnd - p.distance) < 1e-12 * Math.abs(p.distance) && Math.abs(vEnd) < 1e-12 && Math.abs(end.s - p.distance) < 1e-9, `${name}: ends at ${sEnd}, v ${vEnd}`);
    assert.ok(p.vPeak <= l.v * (1 + 1e-12) && p.aPeak <= l.a * (1 + 1e-12) && (l.j === undefined || p.jPeak <= l.j * (1 + 1e-12)), `${name}: peaks ${p.vPeak} ${p.aPeak} ${p.jPeak}`);
    for (let i = 0; i <= 2000; i++) { const s = at(p, p.duration * i / 2000); assert.ok(Math.abs(s.v) <= l.v * (1 + 1e-12) && Math.abs(s.a) <= l.a * (1 + 1e-12), `${name} at ${i}`); }
    // (Continuous: position and velocity, and acceleration for the S-curve, at every segment end.)
    for (let k = 1; k < p.segments.length; k++) { const a = p.segments[k - 1], b = p.segments[k], dt = a.t1 - a.t0, s = a.s + a.v * dt + a.a * dt * dt / 2 + a.j * dt ** 3 / 6, v = a.v + a.a * dt + a.j * dt * dt / 2, acc = a.a + a.j * dt;
      assert.ok(Math.abs(s - b.s) < 1e-12 && Math.abs(v - b.v) < 1e-12 && (p.kind === 'trapezoid' || Math.abs(acc - b.a) < 1e-12), `${name} at segment ${k}`); }
  }
  // v not reached, a reached: the end at d, a at its limit, v below its.
  const mid = sCurve(0.3, 0.5, 1, 10), t = sCurveTimes(0.3, 0.5, 1, 10);
  assert.ok(t.Tv === 0 && Math.abs(mid.aPeak - 1) < 1e-12 && mid.vPeak < 0.5 && Math.abs(at(mid, mid.duration - 1e-12).s - 0.3) < 1e-9, JSON.stringify(t));
});

test('peak and RMS torque of a joint with no gravity load, against the closed form: |τ| = J a on the ramps, RMS = J a √(2 t_a / T)', async () => {
  const doc = JSON.parse(readFileSync(join(CASES, 'revolute', 'case.json'), 'utf8')).input.document as StudioDoc, { tree, bodies } = await robotOf(doc), key = coordinates(tree)[0];
  const J = massMatrix(tree, bodies, {}).M[0][0], dq = 2, v = 1.5, a = 4;
  const tr = moveTorques(tree, bodies, {}, { [key]: dq }, 'trapezoid', () => ({ velocity: v, acceleration: a })), ta = v / a, T = dq / v + ta;
  assert.ok(Math.abs(tr.duration - T) < 1e-12, String(tr.duration));
  assert.ok(Math.abs(tr.joints[key].peak - J * a) < 1e-9 * J * a, `${tr.joints[key].peak} vs ${J * a}`);
  assert.ok(Math.abs(tr.joints[key].rms - J * a * Math.sqrt(2 * ta / T)) < 1e-9 * J * a, `${tr.joints[key].rms} vs ${J * a * Math.sqrt(2 * ta / T)}`);
  assert.match(tr.sampling, /every segment end and 256 samples a segment/);
  // The S-curve: the ramps' ∫a² = A² Tj / 3 each, the constant part A² (Ta − 2Tj): RMS from them; the peak J A.
  const j = 40, sc = moveTorques(tree, bodies, {}, { [key]: dq }, 's-curve', () => ({ velocity: v, acceleration: a, jerk: j })), tt = sCurveTimes(dq, v, a, j), A = j * tt.Tj;
  const int = 2 * (2 * A * A * tt.Tj / 3 + A * A * (tt.Ta - 2 * tt.Tj)), Ts = 2 * tt.Ta + tt.Tv;
  assert.ok(Math.abs(sc.duration - Ts) < 1e-12 && Math.abs(sc.joints[key].peak - J * A) < 1e-9 * J * A && Math.abs(sc.joints[key].rms - J * Math.sqrt(int / Ts)) < 1e-9 * J * A, JSON.stringify(sc.joints[key]));
  assert.ok(sc.joints[key].vPeak <= v * (1 + 1e-12) && sc.joints[key].aPeak <= a * (1 + 1e-12) && sc.joints[key].jPeak <= j * (1 + 1e-12));
});

test('the motion_torques tool on the planar 2R; the conformance case (rm/move-2r: closed-form profile, the Lagrangian\'s peak)', async () => {
  const { doc, tree, bodies, evaluated } = await planar2R(), [k1, k2] = coordinates(tree), to = { [k1]: 1.2, [k2]: -0.8 };
  const out = await dispatchTool({ doc, bodies: evaluated }, 'motion_torques', { to: Object.fromEntries(Object.entries(to).map(([k, v]) => [k, v * 180 / Math.PI])), profile: 's-curve', limits: { velocity: 180 / Math.PI, acceleration: 4 * 180 / Math.PI, jerk: 40 * 180 / Math.PI } }, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed && j.profile === 's-curve' && j.joints[k1].peak_N_m > 0, out.content);
  const ref = moveTorques(tree, bodies, {}, to, 's-curve', () => ({ velocity: 1, acceleration: 4, jerk: 40 }));
  assert.ok(Math.abs(j.duration_s - ref.duration) < 1e-9 && Math.abs(j.joints[k1].peak_N_m - ref.joints[k1].peak) < 1e-9);
  assert.ok((await dispatchTool({ doc, bodies: evaluated }, 'motion_torques', { to, profile: 's-curve', limits: { velocity: 1, acceleration: 4 } }, evaluate)).isError, 'an S-curve without jerk');
  const dir = join(CASES, 'move-2r');
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(dir, { recursive: true });
    // (The expected peak from the Lagrangian closed form along the closed-form profile, sampled independently of moveTorques: 20 000 points.)
    const m = bodies.get('l1')!.massKg, Ic = bodies.get('l1')!.I[4], l1 = 0.04, lc = 0.02, p = sCurve(1, 1 / 1.2, 4 / 1.2, 40 / 1.2);
    // (Every segment by its own polynomial, both ends included — the peak may sit where the jerk switches — 4 000 points each.)
    let peak1 = 0, peak2 = 0;
    for (const seg of p.segments) for (let i = 0; i <= 4000; i++) {
      const s = onSegment(seg, seg.t0 + (seg.t1 - seg.t0) * i / 4000), q1 = 1.2 * s.s, q2 = -0.8 * s.s, d1 = 1.2 * s.v, d2 = -0.8 * s.v, a1 = 1.2 * s.a, a2 = -0.8 * s.a;
      const M11 = 2 * Ic + m * lc * lc + m * (l1 * l1 + lc * lc + 2 * l1 * lc * Math.cos(q2)), M12 = Ic + m * (lc * lc + l1 * lc * Math.cos(q2)), M22 = Ic + m * lc * lc, h = m * l1 * lc * Math.sin(q2);
      const G1 = -g0 * (m * lc * Math.sin(q1) + m * (l1 * Math.sin(q1) + lc * Math.sin(q1 + q2))), G2 = -g0 * m * lc * Math.sin(q1 + q2);
      peak1 = Math.max(peak1, Math.abs(M11 * a1 + M12 * a2 - h * (2 * d1 * d2 + d2 * d2) + G1)); peak2 = Math.max(peak2, Math.abs(M12 * a1 + M22 * a2 + h * d1 * d1 + G2));
    }
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'move-2r', step: 'RD2', note: 'The planar 2R of RD1 moved (1.2, −0.8) rad from upright along one S-curve on the path (limits 1 rad/s, 4 rad/s², 40 rad/s³ on the larger share): its duration by the closed form, d/v + v/a + a/j on the path; the peak torques from the 2R Lagrangian closed form along that profile, sampled by each segment\'s polynomial at 4 001 points including its ends, where the jerk switches (to 1e-6 of the sampler\'s refined peak).', input: { document: doc, to, profile: 's-curve', limits: { velocity: 1, acceleration: 4, jerk: 40 } }, expect: { duration_s: p.duration, peak_N_m: { [k1]: peak1, [k2]: peak2 }, tol_rel: 1e-6 } }, null, 1) + '\n');
  }
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')), rr = await robotOf(c.input.document), mm = moveTorques(rr.tree, rr.bodies, {}, c.input.to, 's-curve', () => c.input.limits);
  assert.ok(Math.abs(mm.duration - c.expect.duration_s) < 1e-12 * c.expect.duration_s, `${mm.duration} vs ${c.expect.duration_s}`);
  for (const [k, v] of Object.entries(c.expect.peak_N_m) as [string, number][]) assert.ok(Math.abs(mm.joints[k].peak - v) <= c.expect.tol_rel * v, `${k}: ${mm.joints[k].peak} vs ${v}`);
  // (The sampler's peak is never below the dense closed-form sampling's: it refines, it does not miss.)
  for (const [k, v] of Object.entries(c.expect.peak_N_m) as [string, number][]) assert.ok(mm.joints[k].peak >= v * (1 - 1e-12));
});
