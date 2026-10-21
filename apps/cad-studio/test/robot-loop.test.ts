import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Mate } from '@barocss/cad-model/assembly/mates';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { mjcfOfDoc, treeOfDoc } from '@barocss/cad-model/chat/robot';
import { connectViolations, mjcfFk, readMjcf } from '@barocss/cad-model/robot/mjcfCheck';
import { forwardKinematics } from '@barocss/cad-model/robot/fk';
import type { JointTree } from '@barocss/cad-model/robot/joints';
import { closeLoop, closureOf, closureOfDoc, type Closure } from '@barocss/cad-model/robot/loop';

// RM8 (O43): a four-bar loop closed. A crank–rocker (a 20, b 70, c 50, d 60 mm) built from mates as a user would: RM1's
// tree takes three turns and keeps the fourth pin as its loop. Driven by the crank through a full turn, the loop is
// closed on the branch it was assembled in; the rocker's angle against Freudenstein's closed form to 1e-9 rad, the pin
// shared by FK to 1e-9 mm. The other branch refused; a non-Grashof linkage's dead points have no closure.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
export const FOUR_BAR = { a: 20, b: 70, c: 50, d: 60, crank0: Math.PI / 3 };
async function build(calls: [string, object][]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }
/** Freudenstein's closed form: the rocker's angle at crank angle t2 (both from the ground line), on a branch (±1); null where the loop cannot close. */
export function freudenstein(a: number, b: number, c: number, d: number, t2: number, branch: 1 | -1): number | null {
  const K1 = d / a, K2 = d / c, K3 = (a * a - b * b + c * c + d * d) / (2 * a * c);
  const P = K1 - Math.cos(t2), Q = -Math.sin(t2), R = K3 - K2 * Math.cos(t2), h = Math.hypot(P, Q);
  if (Math.abs(R) > h) return null;
  return Math.atan2(Q, P) + branch * Math.acos(-R / h);
}
const bar = (L: number) => build([['run_command', { command: 'box', values: { w: L + 10, d: 10, h: 5, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 5, x: 5, y: 5 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 5, x: L + 5, y: 5 } }]]);
/** A bar placed with its first hole on `p` (world) and its length along angle `th`. */
function placed(id: string, doc: StudioDoc, p: number[], th: number, z: number): PartInstance {
  const c = Math.cos(th), s = Math.sin(th);
  return { id, name: id, doc, position: [p[0] - (c * 5 - s * 5), p[1] - (s * 5 + c * 5), z], rotation: [0, 0, th * 180 / Math.PI] };
}
/** The four-bar from mates: ground pivots A (20, 20) and D (80, 20) on a plate's top (z 10), assembled at crank 60°, open branch. */
export async function fourBar(dims = FOUR_BAR): Promise<StudioDoc> {
  const { a, b, c, d, crank0 } = dims, A = [20, 20], D = [20 + d, 20];
  const base = await build([['run_command', { command: 'box', values: { w: d + 40, d: 40, h: 10, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 5, x: 20, y: 20 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 5, x: 20 + d, y: 20 } }]]);
  const t4 = freudenstein(a, b, c, d, crank0, 1)!, B = [A[0] + a * Math.cos(crank0), A[1] + a * Math.sin(crank0)], C = [D[0] + c * Math.cos(t4), D[1] + c * Math.sin(t4)];
  const instances = [placed('crank', await bar(a), A, crank0, 10), placed('coupler', await bar(b), B, Math.atan2(C[1] - B[1], C[0] - B[0]), 15), placed('rocker', await bar(c), D, t4, 10)];
  const pin = (id: string, pa: string, fa: string, pb: string, fb: string, top: string): Mate[] => [{ id: `${id}c`, kind: 'concentric', a: { part: pa, face: fa }, b: { part: pb, face: fb } }, { id: `${id}f`, kind: 'coincident', a: { part: pa, face: top }, b: { part: pb, face: 'n1.bottom' } }];
  const mates = [...pin('A', 'base', 'n2.side0', 'crank', 'n2.side0', 'n1.top'), ...pin('B', 'crank', 'n3.side0', 'coupler', 'n2.side0', 'n1.top'), ...pin('D', 'base', 'n3.side0', 'rocker', 'n2.side0', 'n1.top'),
    { id: 'Cc', kind: 'concentric', a: { part: 'coupler', face: 'n3.side0' }, b: { part: 'rocker', face: 'n3.side0' } } as Mate];
  return { ...base, instances, mates };
}
async function treeAndClosure(doc: StudioDoc): Promise<{ tree: JointTree; c: Closure }> {
  const e = await evaluate(doc); assert.ok(e.ok);
  const tree = await treeOfDoc(doc, e.bodies, evaluate);
  assert.deepEqual(tree.problems, []); assert.equal(tree.loops.length, 1, JSON.stringify(tree.loops));
  return { tree, c: closureOfDoc(doc, tree, tree.loops[0]) };
}
/** The rocker's angle from the ground line at q, read by FK of its far pin (not by the closure). */
function rockerAngle(tree: JointTree, c: Closure, q: Readonly<Record<string, number>>): number {
  const m = forwardKinematics(tree, q).motions.get('rocker')!, p = c.point, x = m.R[0] * p[0] + m.R[1] * p[1] + m.R[2] * p[2] + m.t[0], y = m.R[3] * p[0] + m.R[4] * p[1] + m.R[5] * p[2] + m.t[1];
  return Math.atan2(y - 20, x - (20 + FOUR_BAR.d));
}
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

test('the four-bar from mates: three turns in the tree, the fourth pin its loop; closed through a full crank turn on its branch, against Freudenstein to 1e-9 rad', async () => {
  const doc = await fourBar(), { tree, c } = await treeAndClosure(doc);
  assert.deepEqual(tree.joints.map(j => [j.key, j.type]), [['base~crank', 'continuous'], ['crank~coupler', 'continuous'], ['base~rocker', 'continuous']]);
  assert.deepEqual(tree.loops[0].parts.slice().sort(), ['coupler', 'rocker']);
  assert.ok(Math.abs(c.point[0] - (80 + 50 * Math.cos(freudenstein(20, 70, 50, 60, Math.PI / 3, 1)!))) < 1e-9, JSON.stringify(c.point));
  const crank = tree.joints[0], sgn = crank.axis[2] > 0 ? 1 : -1;
  let q: Record<string, number> = {}, worstRad = 0, worstMM = 0;
  for (let k = 1; k <= 360; k++) {
    const dq = sgn * (k * Math.PI / 180), t2 = FOUR_BAR.crank0 + k * Math.PI / 180;
    const r = closeLoop(tree, c, 'base~crank', dq, q); q = r.q;
    // (The oracle: Freudenstein's branch at the crank's angle, and the coupler's length, by FK.)
    const want = freudenstein(20, 70, 50, 60, t2, 1)!;
    worstRad = Math.max(worstRad, Math.abs(wrap(rockerAngle(tree, c, q) - want)));
    const fk = forwardKinematics(tree, q), pa = fk.motions.get(c.a)!, pb = fk.motions.get(c.b)!, P = c.point;
    const at = (m: typeof pa) => [0, 1, 2].map(i => m.R[i * 3] * P[0] + m.R[i * 3 + 1] * P[1] + m.R[i * 3 + 2] * P[2] + m.t[i]);
    const xa = at(pa), xb = at(pb); worstMM = Math.max(worstMM, Math.hypot(xa[0] - xb[0], xa[1] - xb[1], xa[2] - xb[2]));
    assert.equal(r.branch, c.branch);
  }
  console.log(`RM8: 360 steps; rocker vs Freudenstein worst ${worstRad.toExponential(2)} rad; pin apart worst ${worstMM.toExponential(2)} mm`);
  assert.ok(worstRad <= 1e-9, String(worstRad)); assert.ok(worstMM <= 1e-9, String(worstMM));
});

test('the other branch refused (BRANCH_FLIP); a non-Grashof linkage has no closure at its dead points (NO_CLOSURE), where Freudenstein has no root', async () => {
  const doc = await fourBar(), { tree, c } = await treeAndClosure(doc);
  // (Started from the crossed configuration: Newton closes there — on the other branch, refused.)
  const t2 = FOUR_BAR.crank0, t4x = freudenstein(20, 70, 50, 60, t2, -1)!, t40 = freudenstein(20, 70, 50, 60, t2, 1)!, rock = tree.joints.find(j => j.key === 'base~rocker')!;
  const B = [20 + 20 * Math.cos(t2), 20 + 20 * Math.sin(t2)], C0 = [80 + 50 * Math.cos(t40), 20 + 50 * Math.sin(t40)], Cx = [80 + 50 * Math.cos(t4x), 20 + 50 * Math.sin(t4x)];
  const sg = rock.axis[2] > 0 ? 1 : -1, sc = tree.joints.find(j => j.key === 'crank~coupler')!.axis[2] > 0 ? 1 : -1;
  const crossed = { 'base~rocker': sg * (t4x - t40), 'crank~coupler': sc * (Math.atan2(Cx[1] - B[1], Cx[0] - B[0]) - Math.atan2(C0[1] - B[1], C0[0] - B[0])) };
  assert.throws(() => closeLoop(tree, c, 'base~crank', 0, crossed), /BRANCH_FLIP/);
  assert.equal(closeLoop(tree, c, 'base~crank', 0, {}).residualMM <= 1e-12, true);
  // (A non-Grashof triple rocker, a 50, b 30, c 40, d 70: s + l = 100 > p + q = 90. Synthetic tree, the same planar loop.)
  const [a, b, cc, d] = [50, 30, 40, 70], th0 = Math.PI / 6, t4 = freudenstein(a, b, cc, d, th0, 1)!;
  assert.ok(Number.isFinite(t4), 'it assembles at 30°: |B − D| 36.6 mm, within |b − c| … b + c');
  const Bp = [a * Math.cos(th0), a * Math.sin(th0), 0], Cp = [d + cc * Math.cos(t4), cc * Math.sin(t4), 0];
  const tr: JointTree = { version: 1, base: 'g', links: ['g', 'k', 'u', 'r'].map(id => ({ id, part: id, name: id })), loops: [], couplings: [], problems: [], notes: [], joints: [
    { key: 'g~k', type: 'continuous', parent: 'g', child: 'k', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] },
    { key: 'k~u', type: 'continuous', parent: 'k', child: 'u', origin: Bp as [number, number, number], axis: [0, 0, 1], mates: [] },
    { key: 'g~r', type: 'continuous', parent: 'g', child: 'r', origin: [d, 0, 0], axis: [0, 0, 1], mates: [] }] };
  const cl = closureOf(tr, 'u', 'r', Cp, [0, 0, 1]);
  let q: Record<string, number> = {}, closedTo = 0, refusedAt: number | null = null;
  for (let k = 1; k <= 180; k++) {
    const t2 = th0 + k * Math.PI / 180;
    try { q = closeLoop(tr, cl, 'g~k', k * Math.PI / 180, q).q; closedTo = t2; assert.ok(freudenstein(a, b, cc, d, t2, 1) !== null, `closed at ${t2} where Freudenstein has no root`); }
    catch (e) { assert.match(String(e), /NO_CLOSURE/); refusedAt = t2; break; }
  }
  assert.ok(refusedAt !== null, 'a dead point reached');
  // (Freudenstein: a root at the last closed angle, none at the refused one.)
  assert.equal(freudenstein(a, b, cc, d, refusedAt!, 1), null, `refused at ${refusedAt} where a root exists`);
  assert.ok(freudenstein(a, b, cc, d, closedTo, 1) !== null);
  // (Not planar, or not one loop: refused.)
  assert.throws(() => closureOf({ ...tr, joints: tr.joints.map(j => (j.key === 'g~r' ? { ...j, axis: [0, 1, 0] as [number, number, number] } : j)) }, 'u', 'r', Cp, [0, 0, 1]), /NOT_PLANAR/);
});

test('the loop in MJCF: an equality <connect> at its pin (our reader: closed at the solver\'s poses to 1e-9 m); the frozen four-bar case and what the MuJoCo oracle runs', async () => {
  const doc = await fourBar(), e = await evaluate(doc); assert.ok(e.ok);
  const r = await mjcfOfDoc(doc, e.bodies, evaluate, 'robot'); assert.ok(r.ok, JSON.stringify(!r.ok && r.refusals));
  assert.match(r.xml, /<equality>\n {4}<connect name="loop_coupler_rocker" body1="coupler" body2="rocker" anchor="[^"]+"\/>\n {2}<\/equality>/);
  const { model, issues } = readMjcf(r.xml, new Set(r.files.map(f => f.path)));
  assert.deepEqual(issues, []); assert.equal(model.connects.length, 1);
  const { tree, c } = await treeAndClosure(doc), name = (k: string) => r.names.joints[k];
  const samples: { crank: number; values: Record<string, number> }[] = [];
  let q: Record<string, number> = {};
  for (let k = 0; k <= 360; k++) {
    q = closeLoop(tree, c, 'base~crank', (tree.joints[0].axis[2] > 0 ? 1 : -1) * k * Math.PI / 180, q).q;
    const v = Object.fromEntries(Object.entries(q).map(([key, x]) => [name(key), x]));
    assert.ok(connectViolations(model, v)[0].m <= 1e-9, `${k}°: ${connectViolations(model, v)[0].m}`);
    if (k % 30 === 0 && k < 360) samples.push({ crank: FOUR_BAR.crank0 + k * Math.PI / 180, values: v });
  }
  // (Open: the closure drives nothing; not at its pin: the violation is the pin's offset.)
  assert.ok(connectViolations(model, { [name('base~crank')]: 0.5 })[0].m > 1e-3);
  // (A tree without loops is written as before: RM5's frozen arm-6r robot.xml, test/robot-mjcf.test.ts, byte for byte.)
  const dir = join(CASES, 'four-bar');
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'robot.bcad'), JSON.stringify(doc));
    writeFileSync(join(dir, 'robot.xml'), r.xml);
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'four-bar', step: 'RM8', note: 'A crank-rocker four-bar (a 20, b 70, c 50, d 60 mm; Grashof) from its mates, assembled at crank 60 deg on the open branch. robot.xml is its MJCF with the loop as <equality><connect> (frozen); expect.json is what scripts/loop-oracle.py checks in MuJoCo against Freudenstein.' }, null, 1) + '\n');
    // (The pins, each in its body's frame (m) from MuJoCo's own reading of the frozen file: the oracle takes the angles from MuJoCo's kinematics.)
    const z = mjcfFk(model, {}), local = (body: string, w: number[]) => { const P = z.get(body)!, d = [w[0] - P.t[0], w[1] - P.t[1], w[2] - P.t[2]]; return [0, 1, 2].map(i => P.R[i] * d[0] + P.R[3 + i] * d[1] + P.R[6 + i] * d[2]); };
    const B0 = [20 + 20 * Math.cos(FOUR_BAR.crank0), 20 + 20 * Math.sin(FOUR_BAR.crank0), 15].map(v => v / 1000), C0 = [c.point[0] / 1000, c.point[1] / 1000, c.point[2] / 1000];
    writeFileSync(join(dir, 'expect.json'), JSON.stringify({
      dims: { a: 0.02, b: 0.07, c: 0.05, d: 0.06 }, branch: 1, ground: { A: [0.02, 0.02], D: [0.08, 0.02] },
      pins: { crank: { body: 'crank', local: local('crank', B0) }, rocker: { body: 'rocker', local: local('rocker', C0) }, coupler_b: { body: 'coupler', local: local('coupler', B0) } },
      static: { tol_m: 1e-9, tol_rad: 1e-9, samples }, dynamic: { seconds: 2, timestep: 0.0001, gravity: [0, -9.81, 0], tol_m: 1e-4, tol_rad: 1e-3 },
    }, null, 1) + '\n');
  }
  assert.equal(r.xml, readFileSync(join(dir, 'robot.xml'), 'utf8'), 'the MJCF as frozen');
  assert.ok(existsSync(join(dir, 'expect.json')));
});

test('MuJoCo 3.3.0\'s reading of the frozen four-bar (O45): closed at our poses to 1e-9 m and on Freudenstein to 1e-9 rad; held through a passive run within 1e-4 m and 1e-3 rad, the branch kept', () => {
  const dir = join(CASES, 'four-bar'), o = JSON.parse(readFileSync(join(dir, 'oracle.mujoco-3.3.0.json'), 'utf8')), e = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8'));
  assert.equal(o.oracle, 'mujoco 3.3.0'); assert.equal(o.ok, true);
  assert.equal(o.static.rows.length, 12); assert.ok(o.static.rows.every((r: { rows: number }) => r.rows === 3), 'a connect: three equality rows');
  assert.ok(o.static.worst_violation_m <= e.static.tol_m && o.static.worst_angle_rad <= e.static.tol_rad, JSON.stringify([o.static.worst_violation_m, o.static.worst_angle_rad]));
  const d = o.dynamic;
  assert.ok(d.violation_max_m <= 1e-4 && d.angle_err_max_rad <= 1e-3 && d.branch_kept && d.warnings === 0 && d.crank_span_rad > 6, JSON.stringify(d));
});
