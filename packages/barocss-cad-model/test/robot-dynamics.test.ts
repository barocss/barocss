import { gravityOf, robotViewOf } from '../src/robot/verbs';
import { BarocssError } from '../src/engine/refusal';
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
import { assembly, part } from '../src/api';
import { MATERIALS } from '../src/library/materials';

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
  tree.joints.forEach((jj, i) => assert.ok(Math.abs(j.torques[jj.key] / 1000 - closed[i]) < 1e-9 * Math.abs(closed[i]) + 1e-12, `${jj.key}: ${j.torques[jj.key]} vs ${closed[i]}`));
  assert.equal(j.gravity, STANDARD_GRAVITY * 1000);
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

test('direct canonical gravity reply uses degree inputs and the planar 3R closed form in Nmm', async () => {
  const doc = await planarArm(3), { tree, bodies } = await robotOf(doc), view = await robotViewOf(doc, bodies, evaluate);
  const values = { 'base~l1': 0.4 * 180 / Math.PI, 'l1~l2': -0.9 * 180 / Math.PI, 'l2~l3': 1.3 * 180 / Math.PI };
  const args = { values }, before = structuredClone(args), docBefore = JSON.stringify(doc);
  const th = [0.4, -0.5, 0.8], xJ = [0, 40 * Math.sin(th[0]), 40 * Math.sin(th[0]) + 40 * Math.sin(th[1])], xc = th.map((t, i) => xJ[i] + 20 * Math.sin(t));
  for (const [given, acceleration] of [[args, 9.80665], [{ ...args, g: [0, 0, -9810] }, 9.81]] as const) {
    const reply = gravityOf(view, given, tree);
    const closed = [0, 1, 2].map(i => -acceleration * xc.slice(i).reduce((s, x) => s + BLOCK_KG * (x - xJ[i]) / 1000, 0));
    tree.joints.forEach((joint, i) => {
      assert.ok(Math.abs(reply.torques[joint.key] / 1000 - closed[i]) < 1e-9 * Math.abs(closed[i]) + 1e-12);
      assert.equal(reply.units[joint.key], 'N·mm');
      assert.equal(reply.generalized[joint.key], reply.torques[joint.key]);
    });
    assert.equal(reply.gravity, acceleration === 9.81 ? 9810 : 9806.65);
    assert.equal('gravity_m_s2' in reply, false);
  }
  const tool = await dispatchTool({ doc, bodies }, 'gravity_torques', args, evaluate); assert.ok(!tool.isError, tool.content);
  assert.deepEqual(gravityOf(view, args, tree), JSON.parse(tool.content));
  assert.deepEqual(args, before); assert.equal(JSON.stringify(doc), docBefore);
});

test('direct canonical gravity reply throws BAD_VALUES with the existing full values, joint and gravity messages', async () => {
  const doc = await planarArm(3), { tree, bodies } = await robotOf(doc), view = await robotViewOf(doc, bodies, evaluate);
  const cases: [Record<string, unknown>, string][] = [
    [{ values: [] }, '"values" is {joint key: number}.'],
    [{ values: { 'base~l1': NaN } }, '"values" is {joint key: number}.'],
    [{ values: { absent: 1 } }, 'No joint absent; joints: base~l1, l1~l2, l2~l3.'],
    ...[null, [0, 0], [0, 0, Infinity], [0, 0, 'bad'], { x: 0, y: 0, z: -9810 }].map(g => [{ g }, '"g" is [x, y, z] in mm/s².'] satisfies [Record<string, unknown>, string]),
  ];
  const docBefore = JSON.stringify(doc);
  for (const [args, message] of cases) {
    const before = structuredClone(args);
    assert.throws(() => gravityOf(view, args, tree), e => e instanceof BarocssError && e.code === 'BAD_VALUES' && e.message === `[BAD_VALUES] ${message}`);
    assert.deepEqual(args, before);
  }
  assert.equal(JSON.stringify(doc), docBefore);
});


test('public two-link gravity: explicit aluminium mass binds the CAD static-moment oracle through the existing degree/MMGS boundary', () => {
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
  const vector = (actual: readonly number[], expected: readonly number[]) => {
    assert.equal(actual.length, 3); expected.forEach((value, i) => near(actual[i], value));
  };
  const aluminium = MATERIALS.find(m => m.id === 'al6061');
  assert.ok(aluminium); assert.equal(aluminium.density, 2.7);
  const link1 = part('link1').box({ w: 20, d: 4, h: 4, x: 0, y: -2, z: -2 }).material('al6061');
  const link2 = part('link2').box({ w: 10, d: 4, h: 4, x: 0, y: -2, z: -2 }).material('al6061');
  const firstBefore = structuredClone(link1.doc), secondBefore = structuredClone(link2.doc);
  near(link1.mass().mass, 0.864); near(link2.mass().mass, 0.432);
  // The root has no geometry. Two origin-plane pairs leave existing independent +Y turning joints.
  const doc: StudioDoc = { ...emptyDoc(), instances: [
    { id: 'link1', name: 'link1', doc: link1.doc, position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'link2', name: 'link2', doc: link2.doc, position: [20, 0, 0], rotation: [0, 0, 0] },
  ], mates: [
    { id: 'axis1', kind: 'concentric', a: { part: 'base', face: 'origin:xz', at: {} }, b: { part: 'link1', face: 'origin:xz', at: {} } },
    { id: 'seat1', kind: 'coincident', a: { part: 'base', face: 'origin:xz' }, b: { part: 'link1', face: 'origin:xz' } },
    { id: 'axis2', kind: 'concentric', a: { part: 'link1', face: 'origin:xz', at: { offset: [20, 0, 0] } }, b: { part: 'link2', face: 'origin:xz', at: {} } },
    { id: 'seat2', kind: 'coincident', a: { part: 'link1', face: 'origin:xz' }, b: { part: 'link2', face: 'origin:xz' } },
  ], robot: { version: 1, base: 'base' } };
  const before = structuredClone(doc);
  // assembly takes a name and a StudioPart carrying the document, not a raw document overload.
  const robot = assembly('serial-links', part('empty-base', doc)).robot(), tree = robot.joints();
  assert.deepEqual(tree.problems, []); assert.deepEqual(tree.loops, []); assert.deepEqual(tree.couplings, []);
  assert.equal(tree.base, 'base'); assert.equal(tree.joints.length, 2);
  const first = tree.joints.find(j => j.child === 'link1'), second = tree.joints.find(j => j.child === 'link2');
  assert.ok(first && second);
  assert.equal(first.parent, 'base'); assert.equal(second.parent, 'link1');
  for (const joint of [first, second]) {
    assert.ok(joint.type === 'continuous' || joint.type === 'revolute');
    assert.equal(joint.mimic, undefined); vector(joint.axis, [0, 1, 0]);
  }
  vector(first.origin, [0, 0, 0]); vector(second.origin, [20, 0, 0]);
  const inertias = robot.inertia().links;
  for (const [id, expectedMass] of [['link1', 0.864], ['link2', 0.432]] as const) {
    const link = inertias.find(l => l.link === id); assert.ok(link); near(link.mass, expectedMass);
    assert.ok(link.bodies.length > 0);
    assert.ok(link.bodies.every(b => !b.assumed && b.material === aluminium.label));
    assert.ok(!link.issues.some(issue => issue.code === 'MATERIAL_ASSUMED'));
  }
  // Public joint values are degrees; public gravity is mm/s^2; public holding torque is N mm.
  const gravity: [number, number, number] = [0, 0, -9806.65], gravityBefore = [...gravity];
  // Authored 3D COM/pivot radicals are independent of the Model FK and mass replies.
  const sqrt3 = Math.sqrt(3), shoulder = [0, 0, 0] as const;
  const fixedCases = [
    { q1: 0, q2: 0, elbow: [20, 0, 0], c1: [10, 0, 0], c2: [25, 0, 0], cadHolding: [-0.1765197, -0.0196133] },
    { q1: 60, q2: -30, elbow: [10, 0, -10 * sqrt3], c1: [5, 0, -5 * sqrt3], c2: [10 + 5 * sqrt3 / 2, 0, -10 * sqrt3 - 5 / 2], cadHolding: [-9.80665 * (8 + sqrt3) / 1000, -9.80665 * sqrt3 / 1000] },
    { q1: -30, q2: 90, elbow: [10 * sqrt3, 0, 10], c1: [5 * sqrt3, 0, 5], c2: [10 * sqrt3 + 5 / 2, 0, 10 - 5 * sqrt3 / 2], cadHolding: [-9.80665 * (8 * sqrt3 + 1) / 1000, -9.80665 / 1000] },
  ] as const;
  const force1 = [0, 0, -0.000864 * 9.80665], force2 = [0, 0, -0.000432 * 9.80665];
  // Test-only -(r cross F). World r is in mm, force is in N, so holding is N mm.
  const holdingY = (com: readonly number[], pivot: readonly number[], force: readonly number[]) => {
    const r = com.map((x, i) => x - pivot[i]);
    return -(r[2] * force[0] - r[0] * force[2]);
  };
  for (const fixed of fixedCases) {
    const { q1, q2 } = fixed;
    const values: Record<string, number> = { [first.key]: q1, [second.key]: q2 }, valuesBefore: Record<string, number> = { ...values };
    const a = q1 * Math.PI / 180, b = (q1 + q2) * Math.PI / 180;
    const pose = robot.pose(values);
    assert.deepEqual(pose.out_of_limits, []);
    near(pose.values[first.key], q1); near(pose.values[second.key], q2);
    const p1 = pose.links.find(link => link.link === 'link1'), p2 = pose.links.find(link => link.link === 'link2');
    assert.ok(p1 && p2);
    vector(p1.position, [0, 0, 0]); vector(p1.rotation, [0, q1, 0]);
    // The existing public pose rounds coordinates to six decimals; round only the analytic pose expectation.
    vector(p2.position, [20 * Math.cos(a), 0, -20 * Math.sin(a)].map(x => Math.round(x * 1e6) / 1e6));
    vector(p2.rotation, [0, q1 + q2, 0]);
    const result = robot.gravity(values, gravity);
    assert.equal(result.notReady, undefined); near(result.gravity, 9806.65);
    assert.deepEqual(Object.keys(result.torques).sort(), [first.key, second.key].sort());
    assert.deepEqual(Object.keys(result.generalized).sort(), [first.key, second.key].sort());
    // Fixed independent kg masses at rho=2.7. These are holding torques: the negative of r cross F.
    const holding = [-9.80665 * (0.000864 * 10 * Math.cos(a) + 0.000432 * (20 * Math.cos(a) + 5 * Math.cos(b))),
      -9.80665 * 0.000432 * 5 * Math.cos(b)];
    const crossHolding = [holdingY(fixed.c1, shoulder, force1) + holdingY(fixed.c2, shoulder, force2),
      holdingY(fixed.c2, fixed.elbow, force2)];
    // Test-only density comparison with the fixed CAD rho=2.5 radical table; no production converter.
    const cadHolding = fixed.cadHolding;
    [first.key, second.key].forEach((key, i) => {
      assert.equal(result.units[key], 'N·mm'); near(result.torques[key], holding[i]);
      near(result.torques[key], crossHolding[i]); near(crossHolding[i], holding[i]);
      near(result.torques[key], cadHolding[i] * 27 / 25); near(result.generalized[key], holding[i]);
    });
    assert.deepEqual(values, valuesBefore); assert.deepEqual(gravity, gravityBefore);
  }
  assert.deepEqual(doc, before); assert.deepEqual(robot.doc, before);
  assert.deepEqual(link1.doc, firstBefore); assert.deepEqual(link2.doc, secondBefore);
});
