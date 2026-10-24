import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { tablesFor } from '../src/assembly/faces';
import { solveDoc } from '../src/assembly/edit';
import { dispatchTool } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { jointTreeOf, type Joint, type JointTree } from '../src/robot/joints';
import { applyTo, composeInto, forwardKinematics, gearPairAt, screwInto, sliderRange, type Motion } from '../src/robot/fk';
import { posedInstances } from '../src/robot/preview';

// RM2 (O15): forward kinematics over the joint tree — the planar 2R closed form to 1e-9, the product of exponentials
// against the moving-axis form on a random 3D tree, gear followers turning their pair with the tooth phase held,
// limits, slider ranges, the tool, and the preview leaving the evaluated bodies as they were.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const caseDoc = (name: string): StudioDoc => JSON.parse(readFileSync(resolve(CASES, name, 'case.json'), 'utf8')).input.document;
const treeOf = (doc: StudioDoc): JointTree => { const s = solveDoc(doc); return jointTreeOf(s.doc, { instances: s.doc.instances ?? [], problems: s.problems }, tablesFor(s.doc)); };
let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('planar 2R: the tip of the second arm where the closed form puts it, to 1e-9, over 200 random poses', () => {
  const t = treeOf(caseDoc('chain-2r'));
  assert.deepEqual(t.joints.map(j => [j.key, j.type]), [['base~a', 'continuous'], ['a~b', 'continuous']]);
  const J1 = t.joints[0].origin, l1 = 40, l2 = 40;
  // (b's far hole: 40 mm past its turning hole, which is 40 mm past a's, at home all along +X.)
  const tipHome = [J1[0] + l1 + l2, J1[1], 15];
  let worst = 0;
  for (let k = 0; k < 200; k++) {
    const q1 = (rand() * 2 - 1) * Math.PI, q2 = (rand() * 2 - 1) * Math.PI;
    const fk = forwardKinematics(t, { 'base~a': q1, 'a~b': q2 }), tip = applyTo(fk.motions.get('b')!, tipHome);
    const x = J1[0] + l1 * Math.cos(q1) + l2 * Math.cos(q1 + q2), y = J1[1] + l1 * Math.sin(q1) + l2 * Math.sin(q1 + q2);
    worst = Math.max(worst, Math.hypot(tip[0] - x, tip[1] - y, tip[2] - 15));
  }
  assert.ok(worst < 1e-9, `worst ${worst}`);
});

/** The moving-axis form: each joint's axis carried by its parent's motion, the turn made about it there, then the parent's. */
function movingAxis(tree: JointTree, q: Record<string, number>): Map<string, Motion> {
  const out = new Map<string, Motion>([[tree.base, { R: Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), t: new Float64Array(3) }]]);
  for (const j of tree.joints) {
    const P = out.get(j.parent)!, axis = [0, 1, 2].map(i => P.R[i * 3] * j.axis[0] + P.R[i * 3 + 1] * j.axis[1] + P.R[i * 3 + 2] * j.axis[2]) as [number, number, number];
    const moved: Joint = { ...j, axis, origin: applyTo(P, j.origin) };
    out.set(j.child, composeInto({ R: new Float64Array(9), t: new Float64Array(3) }, screwInto({ R: new Float64Array(9), t: new Float64Array(3) }, moved, q[j.key] ?? 0), P));
  }
  return out;
}

test('the product of exponentials equals the moving-axis form on a random 3D tree of turning and sliding joints', () => {
  for (let trial = 0; trial < 20; trial++) {
    const joints: Joint[] = [], links = ['L0'];
    for (let k = 1; k < 9; k++) {
      const parent = links[Math.floor(rand() * links.length)], a = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...a);
      joints.push({ key: `j${k}`, type: rand() < 0.7 ? 'continuous' : 'prismatic', parent, child: `L${k}`, axis: a.map(x => x / n) as [number, number, number], origin: [rand() * 200 - 100, rand() * 200 - 100, rand() * 200 - 100], mates: [] });
      links.push(`L${k}`);
    }
    const tree: JointTree = { version: 1, base: 'L0', links: links.map(id => ({ id, part: id, name: id })), joints, loops: [], couplings: [], problems: [], notes: [] };
    const q = Object.fromEntries(joints.map(j => [j.key, j.type === 'prismatic' ? rand() * 100 - 50 : rand() * 6 - 3]));
    const a = forwardKinematics(tree, q).motions, b = movingAxis(tree, q);
    for (const id of links) for (const p of [[0, 0, 0], [37, -12, 80]]) {
      const x = applyTo(a.get(id)!, p), y = applyTo(b.get(id)!, p);
      assert.ok(Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 1e-9, `${trial} ${id}`);
    }
    // (Rotations stay rotations: orthonormal.)
    for (const m of a.values()) { const R = m.R; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const d = R[i] * R[j] + R[3 + i] * R[3 + j] + R[6 + i] * R[6 + j]; assert.ok(Math.abs(d - (i === j ? 1 : 0)) < 1e-12); } }
  }
});

test('a gear pair turns together: the follower from its leader whatever it was given, the tooth phase held at every pose', async () => {
  const doc = caseDoc('gears'), r = await evaluate(doc); assert.ok(r.ok);
  const t = await treeOfDoc(doc, r.bodies, evaluate), c = t.couplings[0];
  const home = gearPairAt(c, {});
  for (let k = 0; k < 25; k++) {
    const q = (rand() * 2 - 1) * 4 * Math.PI, fk = forwardKinematics(t, { 'base~g1': q, 'base~g2': 123 });
    assert.ok(Math.abs(fk.values['base~g2'] - (-20 / 30) * q) < 1e-12, 'the follower from its leader');
    const at = gearPairAt(c, fk.values);
    const dPhase = Math.min(Math.abs(at.phaseDeg - home.phaseDeg), 360 / 30 - Math.abs(at.phaseDeg - home.phaseDeg));
    assert.ok(dPhase < 1e-6, `phase ${at.phaseDeg} vs ${home.phaseDeg}`);
    assert.ok(Math.abs(at.backlash - home.backlash) < 1e-9 && Math.abs(at.centerDistance - 50) < 1e-9);
  }
  // The wrong ratio does not hold it: the check would see the teeth move against each other.
  const wrong = gearPairAt(c, { 'base~g1': 0.3, 'base~g2': 0.3 * 20 / 30 });
  assert.ok(Math.abs(wrong.phaseDeg - home.phaseDeg) > 1e-3);
  // The follower's link turns about its own axis by its value.
  const fk = forwardKinematics(t, { 'base~g1': 0.6 }), g2 = t.joints.find(j => j.key === 'base~g2')!;
  const centre = applyTo(fk.motions.get('g2')!, g2.origin);
  assert.ok(Math.hypot(centre[0] - g2.origin[0], centre[1] - g2.origin[1]) < 1e-9, 'it turns on its axis');
});

test('limits: values outside are reported, not clamped; slider ranges; unknown joints', () => {
  const t = treeOf(caseDoc('revolute-limited'));
  const fk = forwardKinematics(t, { 'base~arm': 2, nope: 1 });
  assert.deepEqual([fk.outOfLimits, fk.unknown, fk.values['base~arm']], [['base~arm'], ['nope'], 2]);
  assert.deepEqual(sliderRange(t.joints[0]), { min: -1.5, max: 1.5, limited: true });
  const free = treeOf(caseDoc('revolute')).joints[0], slide = treeOf(caseDoc('cylindrical')).joints[0];
  assert.deepEqual(sliderRange(free), { min: -Math.PI, max: Math.PI, limited: false });
  assert.deepEqual(sliderRange(slide), { min: -50, max: 50, limited: false });
  // A prismatic joint slides its child by the value along its axis.
  const p = treeOf(caseDoc('prismatic')), m = forwardKinematics(p, { 'base~slider': 25 }).motions.get('slider')!;
  assert.deepEqual([...m.t], [25, 0, 0]);
});

test('the forward_kinematics tool: placements as place_part takes them, the gear phase held, refusals', async () => {
  const doc = caseDoc('chain-2r'), r = await evaluate(doc); assert.ok(r.ok);
  const out = await dispatchTool({ doc, bodies: r.bodies }, 'forward_kinematics', { values: { 'base~a': Math.PI / 2 } }, evaluate);
  assert.ok(!out.isError && !out.changed, out.content);
  const j = JSON.parse(out.content), a = j.links.find((l: { link: string }) => l.link === 'a'), b = j.links.find((l: { link: string }) => l.link === 'b');
  // (a turned a quarter about its hole at (20, 20): its corner, 10 mm from the hole each way, goes round with it.)
  assert.deepEqual([a.rotation, b.rotation], [[0, 0, 90], [0, 0, 90]]);
  assert.deepEqual(a.position.slice(0, 2), [30, 10]);
  for (const bad of [{ values: { nope: 1 } }, { values: { 'base~a': 'x' } }]) assert.ok((await dispatchTool({ doc, bodies: r.bodies }, 'forward_kinematics', bad, evaluate)).isError);
  const g = caseDoc('gears'), rg = await evaluate(g); assert.ok(rg.ok);
  const gj = JSON.parse((await dispatchTool({ doc: g, bodies: rg.bodies }, 'forward_kinematics', { values: { 'base~g1': 1 } }, evaluate)).content);
  assert.deepEqual([gj.gears.length, gj.gears[0].held, Math.round(gj.values['base~g2'] * 1e9) / 1e9], [1, true, Math.round(-2 / 3 * 1e9) / 1e9]);
});

test('the preview: instances moved on copies, the evaluated bodies untouched; nothing moved at home', async () => {
  const doc = caseDoc('revolute'), s = solveDoc(doc), inst = s.doc.instances![0];
  const r = await evaluate(inst.doc); assert.ok(r.ok);
  const { placeBody } = await import('../src/engine/evaluate'), { rotationMatrix } = await import('../src/engine/placement');
  const placed = r.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(inst.rotation), inst.position));
  const before = Float32Array.from(placed[0].mesh.positions), t = treeOf(doc);
  const home = posedInstances([{ id: 'arm', bodies: placed }], forwardKinematics(t, {}));
  assert.equal(home[0].bodies, placed, 'at home the same bodies');
  const turned = posedInstances([{ id: 'arm', bodies: placed }], forwardKinematics(t, { 'base~arm': Math.PI }));
  assert.deepEqual(placed[0].mesh.positions, before, 'the evaluated mesh as it was');
  // (A half turn about the hole axis at (20, 20): the arm's box, x 10…70, now spans −30…30.)
  assert.ok(Math.abs(turned[0].bodies[0].mesh.bounds.min[0] + 30) < 1e-4 && Math.abs(turned[0].bodies[0].mesh.bounds.max[0] - 30) < 1e-4, JSON.stringify(turned[0].bodies[0].mesh.bounds));
});

test('the RM2 conformance cases: the 2R tip by its closed form, the gear follower and its held phase', async () => {
  const two = JSON.parse(readFileSync(resolve(CASES, 'fk-chain-2r', 'case.json'), 'utf8')), t = treeOf(caseDoc(two.of));
  for (const s of two.samples) { const p = applyTo(forwardKinematics(t, s.values).motions.get(s.link)!, s.point); assert.ok(Math.hypot(p[0] - s.expect[0], p[1] - s.expect[1], p[2] - s.expect[2]) <= two.tol, JSON.stringify(s)); }
  const g = JSON.parse(readFileSync(resolve(CASES, 'fk-gears', 'case.json'), 'utf8')), doc = caseDoc(g.of), r = await evaluate(doc); assert.ok(r.ok);
  const gt = await treeOfDoc(doc, r.bodies, evaluate), home = gearPairAt(gt.couplings[0], {});
  for (const s of g.samples) {
    const fk = forwardKinematics(gt, s.values), at = gearPairAt(gt.couplings[0], fk.values), d = Math.abs(at.phaseDeg - home.phaseDeg);
    assert.ok(Math.abs(fk.values[s.follower] - s.expect_follower) < 1e-12 && Math.min(d, 12 - d) <= g.tol_deg, JSON.stringify(s));
  }
});
