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
import { gravityTorques, linkMasses, STANDARD_GRAVITY, type LinkMass } from '../src/robot/dynamics';
import type { Joint, JointTree } from '../src/robot/joints';

// RD1 (O20): static gravity torques — the planar 2R and 3R closed forms to 1e-9 (arms of real blocks on Y-axis joints,
// their mass and centre from the block's analytic volume), G = ∂V/∂q against finite differences of the potential
// energy on random 3D trees, a gear follower's share by virtual work, the tool, the conformance case.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(calls: [string, object][]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }
let seed = 13; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const g0 = STANDARD_GRAVITY;

/** A block 20 × 20 × 80 with blind holes top and bottom and two through holes along Y at z 20 and 60 (as the 6R arm's). */
const block = () => build([['run_command', { command: 'box', values: { w: 20, d: 20, h: 80, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }],
  ['run_command', { command: 'hole', faces: ['n1.bottom'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 20 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 60 } }]]);
/** Its mass (kg, aluminium 2.70): the box less two Ø8 × 8 blind holes and two Ø8 × 20 through ones; its centre the box's (the holes in pairs about it). */
const BLOCK_KG = 2.7e-6 * (20 * 20 * 80 - 2 * Math.PI * 16 * 8 - 2 * Math.PI * 16 * 20);
/** An n-link planar arm in the XZ plane: an upright block (the base part), each next block beside the last on a Y-axis joint at its upper hole. */
async function planarArm(n: number): Promise<StudioDoc> {
  const b = await block(), ids = Array.from({ length: n }, (_, k) => `l${k + 1}`), mates: Mate[] = [];
  const instances: PartInstance[] = ids.map((id, k) => ({ id, name: id, doc: b, position: [0, 20 * (k + 1), 40 * (k + 1)], rotation: [0, 0, 0] }));
  ids.forEach((id, k) => { const p = k ? ids[k - 1] : 'base'; mates.push({ id: `c${k + 1}`, kind: 'concentric', a: { part: p, face: 'n5.side0' }, b: { part: id, face: 'n4.side0' } }, { id: `f${k + 1}`, kind: 'coincident', a: { part: p, face: 'n1.side2' }, b: { part: id, face: 'n1.side0' } }); });
  return { ...b, instances, mates };
}
async function robotOf(doc: StudioDoc) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, own = new Map([['base', r.bodies]]);
  for (const i of solved.instances ?? []) { const e = await evaluate(i.doc); assert.ok(e.ok); own.set(i.id, e.bodies); }
  const masses = linkMasses(tree, p => { if (p === 'base') return { doc, bodies: r.bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances!.find(x => x.id === p)!; return { doc: i.doc, bodies: own.get(p)!, position: i.position, rotation: i.rotation }; });
  return { tree, masses, bodies: r.bodies };
}

test('the planar 2R and 3R closed forms, to 1e-9: τ_j = −g Σ_{i≥j} m_i (x_ci − x_Jj), each link 40 mm joint to joint, its centre 20 mm up', async () => {
  for (const n of [2, 3]) {
    const { tree, masses } = await robotOf(await planarArm(n));
    assert.deepEqual(tree.joints.map(j => [j.type, j.axis.map(v => Math.round(v * 1e12) / 1e12 + 0)]), Array(n).fill(['continuous', [0, 1, 0]]));
    for (const id of tree.links.slice(1).map(l => l.id)) assert.ok(Math.abs(masses.get(id)!.massKg - BLOCK_KG) < 1e-12 * BLOCK_KG, `${id}: ${masses.get(id)!.massKg} vs ${BLOCK_KG}`);
    let worst = 0;
    for (let k = 0; k < 300; k++) {
      const q = Object.fromEntries(tree.joints.map(j => [j.key, (rand() * 2 - 1) * Math.PI])), G = gravityTorques(tree, masses, q).torques;
      // (In the plane: turning about +Y by θ takes (x, z) up a link to (z sin θ, z cos θ) — a joint 40 up, a centre 20 up.)
      const th = tree.joints.map((_, i) => tree.joints.slice(0, i + 1).reduce((s, j) => s + q[j.key], 0));
      const xJ = th.map((_, i) => th.slice(0, i).reduce((s, t) => s + 40 * Math.sin(t), 0)), xc = th.map((t, i) => xJ[i] + 20 * Math.sin(t));
      tree.joints.forEach((j, i) => {
        const closed = -g0 * xc.slice(i).reduce((s, x) => s + BLOCK_KG * (x - xJ[i]) / 1000, 0);
        worst = Math.max(worst, Math.abs(G[j.key] - closed) / Math.max(1e-12, Math.abs(closed), BLOCK_KG * g0 * 0.02));
      });
    }
    assert.ok(worst < 1e-9, `${n}R worst relative ${worst}`);
    // Upright: each centre over its joint, nothing to hold.
    assert.ok(Object.values(gravityTorques(tree, masses, {}).torques).every(t => Math.abs(t) < 1e-15));
  }
});

/** The potential energy (J) at q: −Σ m g·c, centres where FK puts them. */
const energy = (tree: JointTree, masses: ReadonlyMap<string, LinkMass>, q: Record<string, number>) => {
  const fk = forwardKinematics(tree, q); let v = 0;
  for (const [id, m] of masses) { const c = applyTo(fk.motions.get(id)!, m.com); v += m.massKg * g0 * c[2] / 1000; }
  return v;
};

test('G = ∂V/∂q on random 3D trees of turns and slides: central differences of the potential energy, to 1e-6', () => {
  for (let trial = 0; trial < 40; trial++) {
    const joints: Joint[] = [], ids = ['L0'], masses = new Map<string, LinkMass>([['L0', { massKg: 1, com: [0, 0, 0] }]]);
    for (let k = 1; k < 7; k++) {
      const a = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...a), parent = ids[Math.floor(rand() * ids.length)];
      joints.push({ key: `j${k}`, type: rand() < 0.7 ? 'continuous' : 'prismatic', parent, child: `L${k}`, axis: a.map(x => x / n) as [number, number, number], origin: [rand() * 400 - 200, rand() * 400 - 200, rand() * 400], mates: [] });
      ids.push(`L${k}`); masses.set(`L${k}`, { massKg: 0.1 + rand() * 3, com: [rand() * 400 - 200, rand() * 400 - 200, rand() * 400] });
    }
    const tree: JointTree = { version: 1, base: 'L0', links: ids.map(id => ({ id, part: id, name: id })), joints, loops: [], couplings: [], problems: [], notes: [] };
    const q = Object.fromEntries(joints.map(j => [j.key, j.type === 'prismatic' ? rand() * 100 - 50 : rand() * 6 - 3])), G = gravityTorques(tree, masses, q).torques;
    for (const j of joints) {
      // (A slide's q is in mm, its G per metre: the difference over h mm, ×1000.)
      const h = j.type === 'prismatic' ? 1e-3 : 1e-6, k = j.type === 'prismatic' ? 1000 : 1;
      const d = (energy(tree, masses, { ...q, [j.key]: q[j.key] + h }) - energy(tree, masses, { ...q, [j.key]: q[j.key] - h })) / (2 * h) * k;
      assert.ok(Math.abs(G[j.key] - d) < 1e-6 * Math.max(1, Math.abs(d)), `${trial} ${j.key}: ${G[j.key]} vs ${d}`);
    }
  }
});

test('a follower\'s share is its leader\'s by virtual work: the generalized value equals dV/dq along the coupling', () => {
  const tree: JointTree = { version: 1, base: 'B', links: ['B', 'A', 'F'].map(id => ({ id, part: id, name: id })), loops: [], couplings: [], problems: [], notes: [],
    joints: [{ key: 'B~A', type: 'continuous', parent: 'B', child: 'A', axis: [0, 1, 0], origin: [0, 0, 0], mates: [] }, { key: 'B~F', type: 'continuous', parent: 'B', child: 'F', axis: [0, 1, 0], origin: [100, 0, 0], mates: [], mimic: { joint: 'B~A', multiplier: -0.5, offset: 0 } }] };
  const masses = new Map<string, LinkMass>([['B', { massKg: 1, com: [0, 0, 0] }], ['A', { massKg: 2, com: [50, 0, 0] }], ['F', { massKg: 3, com: [100, 0, 80] }]]);
  const q = 0.7, r = gravityTorques(tree, masses, { 'B~A': q }), h = 1e-6;
  const d = (energy(tree, masses, { 'B~A': q + h }) - energy(tree, masses, { 'B~A': q - h })) / (2 * h);
  assert.ok(Math.abs(r.generalized['B~A'] - d) < 1e-7, `${r.generalized['B~A']} vs ${d}`);
  assert.ok(Math.abs(r.generalized['B~A'] - (r.torques['B~A'] - 0.5 * r.torques['B~F'])) < 1e-15);
  assert.ok(!('B~F' in r.generalized), 'a follower is not an independent joint');
});

test('the gravity_torques tool on the planar 3R; the conformance case (rm/gravity-3r: the closed form\'s values)', async () => {
  const doc = await planarArm(3), { tree, bodies } = await robotOf(doc), q = { 'base~l1': 0.4, 'l1~l2': -0.9, 'l2~l3': 1.3 };
  const out = await dispatchTool({ doc, bodies }, 'gravity_torques', { values: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v * 180 / Math.PI])) }, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed, out.content);
  const th = [0.4, -0.5, 0.8], xJ = [0, 40 * Math.sin(th[0]), 40 * Math.sin(th[0]) + 40 * Math.sin(th[1])], xc = th.map((t, i) => xJ[i] + 20 * Math.sin(t));
  const closed = [0, 1, 2].map(i => -g0 * xc.slice(i).reduce((s, x) => s + BLOCK_KG * (x - xJ[i]) / 1000, 0));
  tree.joints.forEach((jj, i) => assert.ok(Math.abs(j.torques[jj.key] - closed[i]) < 1e-9 * Math.abs(closed[i]) + 1e-12, `${jj.key}: ${j.torques[jj.key]} vs ${closed[i]}`));
  assert.equal(j.gravity_m_s2, STANDARD_GRAVITY);
  assert.ok((await dispatchTool({ doc, bodies }, 'gravity_torques', { values: { nope: 1 } }, evaluate)).isError);
  const dir = join(CASES, 'gravity-3r');
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'gravity-3r', step: 'RD1', note: 'A planar 3R arm of three 20 × 20 × 80 aluminium blocks on Y-axis joints beside an upright one, joints 40 mm apart, each centre 20 mm above its lower joint; g = 9.80665 on −Z. τ_j = −g Σ_{i≥j} m_i (x_ci − x_Jj), m = 2.70e-6 (20·20·80 − 2π·16·8 − 2π·16·20) kg, absolute angles θ = (0.4, −0.5, 0.8): the closed form.', input: { document: doc, values: q }, expect: { torques_N_m: Object.fromEntries(tree.joints.map((jj, i) => [jj.key, closed[i]])), tol_rel: 1e-9 } }, null, 1) + '\n');
  }
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')), rr = await robotOf(c.input.document), G = gravityTorques(rr.tree, rr.masses, c.input.values).torques;
  for (const [k, v] of Object.entries(c.expect.torques_N_m) as [string, number][]) assert.ok(Math.abs(G[k] - v) < c.expect.tol_rel * Math.abs(v) + 1e-12, k);
});

test('gravityTorques with a link the base does not reach yet (a part added, not yet mated; a joint mid-edit) — no throw: the reached joint\'s torque by closed form (1 kg at 100 mm, about y: −0.980665 N·m), the rest said ROBOT_NOT_READY', () => {
  const tree = { version: 1 as const, base: 'L0', links: [{ id: 'L0', part: 'base', name: 'base' }, { id: 'L1', part: 'p1', name: 'arm' }, { id: 'L2', part: 'p2', name: 'loose' }],
    joints: [{ key: 'j1', type: 'revolute' as const, parent: 'L0', child: 'L1', origin: [0, 0, 0] as [number, number, number], axis: [0, 1, 0] as [number, number, number], mates: [] },
      { key: 'j2', type: 'revolute' as const, parent: 'L9', child: 'L2', origin: [0, 0, 0] as [number, number, number], axis: [0, 1, 0] as [number, number, number], mates: [] }],
    loops: [], couplings: [], problems: [], notes: [] };
  const masses = new Map([['L1', { massKg: 1, com: [100, 0, 0] as [number, number, number] }], ['L2', { massKg: 2, com: [0, 0, 50] as [number, number, number] }]]);
  const r = gravityTorques(tree as never, masses, {});
  assert.ok(Math.abs(r.torques.j1 - -0.980665) <= 1e-12, String(r.torques.j1));
  assert.equal('j2' in r.torques, false); assert.equal('j2' in r.generalized, false);
  assert.deepEqual([r.notReady?.code, r.notReady?.links, r.notReady?.joints], ['ROBOT_NOT_READY', ['L2'], ['j2']]);
  assert.equal(gravityTorques(tree as never, new Map([['L1', masses.get('L1')!]]), {}).notReady?.links.length, 0, 'a massless unreached link: only its joint said');
});
