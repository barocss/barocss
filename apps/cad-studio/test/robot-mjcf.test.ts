import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type PartInstance, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { mjcfOfDoc, treeOfDoc, urdfOfDoc } from '../src/chat/robot';
import { forwardKinematics } from '../src/robot/fk';
import { quatOf, type MjcfResult } from '../src/robot/mjcf';
import { mjcfFk, readMjcf } from '@barocss/cad-model/robot/mjcfCheck';
import { readUrdf, urdfFk } from '@barocss/cad-model/robot/urdfCheck';
import { symmetricEigen, type Mat3 } from '../src/robot/inertia';
import { cliMain } from '../server/cadCli';

// RM5 (O18): MJCF export — the 6R arm built from its mates, its model read back against MuJoCo's structure, FK in
// MuJoCo's composition against RM2's and against the URDF's, quaternions, the checker's catches, the tool and the CLI.
// MuJoCo 3.3.0's reading (scripts/mjcf-oracle.py, run outside the product, O18) is committed beside the case: its gravity
// torques against RD1's, the arm hanging passive and damped; the last test holds the frozen export to it.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const bodiesOf = async (doc: StudioDoc) => { const r = await evaluate(doc); assert.ok(r.ok); return r.bodies as BodyResult[]; };
const caseDoc = (name: string): StudioDoc => JSON.parse(readFileSync(join(CASES, name, 'case.json'), 'utf8')).input.document;
async function build(calls: [string, object][]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }
async function exported(doc: StudioDoc): Promise<Extract<MjcfResult, { ok: true }>> { const r = await mjcfOfDoc(doc, await bodiesOf(doc), evaluate, 'robot'); assert.ok(r.ok, JSON.stringify(!r.ok && r.refusals)); return r; }
let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/**
 * The 6R arm: a base plate and six 20 × 20 × 80 blocks, each with blind vertical holes at both ends and two through
 * holes along Y (z 20 and 60). Wrists turn on Z (a block on the one below, the vertical holes on one axis); shoulders
 * on Y (a block beside the one before, its lower Y hole on the other's upper). Axes Z, Y, Y, Z, Y, Z.
 */
export async function arm6r(): Promise<StudioDoc> {
  const link = await build([['run_command', { command: 'box', values: { w: 20, d: 20, h: 80, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }],
    ['run_command', { command: 'hole', faces: ['n1.bottom'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 20 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 60 } }]]);
  const base = await build([['run_command', { command: 'box', values: { w: 100, d: 100, h: 10, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 50, y: 50 } }]]);
  const ids = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'], axes = ['z', 'y', 'y', 'z', 'y', 'z'], mates: Mate[] = [];
  const instances: PartInstance[] = ids.map((id, k) => ({ id, name: `link ${k + 1}`, doc: link, position: [40, 40 + 20 * k, 10 + 50 * k], rotation: [0, 0, 0] }));
  ids.forEach((id, k) => {
    const p = k ? ids[k - 1] : 'base';
    if (axes[k] === 'z') mates.push({ id: `c${k + 1}`, kind: 'concentric', a: { part: p, face: 'n2.side0' }, b: { part: id, face: 'n3.side0' } }, { id: `f${k + 1}`, kind: 'coincident', a: { part: p, face: 'n1.top' }, b: { part: id, face: 'n1.bottom' } });
    else mates.push({ id: `c${k + 1}`, kind: 'concentric', a: { part: p, face: 'n5.side0' }, b: { part: id, face: 'n4.side0' } }, { id: `f${k + 1}`, kind: 'coincident', a: { part: p, face: 'n1.side2' }, b: { part: id, face: 'n1.side0' } });
  });
  return { ...base, instances, mates };
}

test('quaternions: unit, w ≥ 0, and back to the same rotation, near a half turn too', () => {
  const back = ([w, x, y, z]: number[]) => [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
  for (let k = 0; k < 300; k++) {
    const a = [rand() - 0.5, rand() - 0.5, rand() - 0.5], n = Math.hypot(...a), th = k < 10 ? Math.PI - 1e-9 * k : rand() * 2 * Math.PI, [x, y, z] = a.map(v => v / n), c = Math.cos(th), s = Math.sin(th), v = 1 - c;
    const R: Mat3 = [v * x * x + c, v * x * y - s * z, v * x * z + s * y, v * x * y + s * z, v * y * y + c, v * y * z - s * x, v * x * z - s * y, v * y * z + s * x, v * z * z + c], q = quatOf(R);
    assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-14 && q[0] >= 0 && back(q).every((m, i) => Math.abs(m - R[i]) < 1e-12), String(k));
  }
});

test('the 6R arm\'s MJCF read back: MuJoCo\'s structure, seven nested bodies, six hinges on their bodies\' Z, meshes present', async () => {
  const doc = await arm6r(), r = await exported(doc), { model, issues } = readMjcf(r.xml, new Set(r.files.map(f => f.path)));
  assert.deepEqual(issues, []);
  assert.deepEqual(model.bodies.map(b => [b.name, b.parent]), [['base', null], ['l1', 'base'], ['l2', 'l1'], ['l3', 'l2'], ['l4', 'l3'], ['l5', 'l4'], ['l6', 'l5']]);
  assert.deepEqual(model.bodies.slice(1).map(b => [b.joint!.type, b.joint!.axis, b.joint!.range]), Array(6).fill(['hinge', [0, 0, 1], undefined]));
  assert.equal(model.meshes.size, 14);
  assert.ok(model.bodies.every(b => b.inertial && b.inertial.mass > 0));
  assert.match(r.xml, /<option gravity="0 0 -9\.81"\/>/);
  assert.doesNotMatch(r.xml, / damping=| frictionloss=| armature=|<actuator/, 'a passive model: nothing invented');
});

/** RM2's FK of each link frame (world, m) against MJCF's at the same values, and the URDF's too. */
async function threeWay(doc: StudioDoc, samples: number, values: (keys: string[]) => Record<string, number>) {
  const bodies = await bodiesOf(doc), tree = await treeOfDoc(doc, bodies, evaluate), m = await exported(doc), u = await urdfOfDoc(doc, bodies, evaluate, 'robot');
  assert.ok(u.ok);
  const mj = readMjcf(m.xml).model, ur = readUrdf(u.urdf).model, root = m.frames.get(tree.base)!;
  let worst = 0, worstUrdf = 0;
  for (let k = 0; k < samples; k++) {
    const q = values(tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key)), fk = forwardKinematics(tree, q);
    const named = Object.fromEntries(Object.entries(fk.values).map(([key, v]) => [m.names.joints[key], tree.joints.find(j => j.key === key)!.type === 'prismatic' ? v / 1000 : v]));
    const a = mjcfFk(mj, named), b = urdfFk(ur, named);
    for (const l of tree.links) {
      const D = fk.motions.get(l.id)!, H = m.frames.get(l.id)!, name = m.names.links[l.id];
      const o = [0, 1, 2].map(i => (D.R[i * 3] * H.o[0] + D.R[i * 3 + 1] * H.o[1] + D.R[i * 3 + 2] * H.o[2] + D.t[i]) / 1000), R = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => D.R[i * 3] * H.R[j] + D.R[i * 3 + 1] * H.R[3 + j] + D.R[i * 3 + 2] * H.R[6 + j]));
      const p = a.get(name)!;
      worst = Math.max(worst, ...o.map((v, i) => Math.abs(v - p.t[i])), ...R.map((v, i) => Math.abs(v - p.R[i])));
      // (The URDF's root is the base link at its own frame; MJCF's world holds the base where it stands.)
      const ub = b.get(name)!, rel = [0, 1, 2].map(i => root.R[i] * (p.t[0] - root.o[0] / 1000) + root.R[3 + i] * (p.t[1] - root.o[1] / 1000) + root.R[6 + i] * (p.t[2] - root.o[2] / 1000));
      worstUrdf = Math.max(worstUrdf, ...rel.map((v, i) => Math.abs(v - ub.t[i])));
    }
  }
  return { worst, worstUrdf, m };
}

test('FK read back from the MJCF equals RM2\'s and the URDF\'s: the 6R arm (200 poses), the gear pair (an equality), a slide chain', async () => {
  const turn = (keys: string[]) => Object.fromEntries(keys.map(k => [k, (rand() * 2 - 1) * Math.PI]));
  const a = await threeWay(await arm6r(), 200, turn);
  assert.ok(a.worst < 1e-12 && a.worstUrdf < 1e-12, `${a.worst} ${a.worstUrdf}`);
  const g = await threeWay(caseDoc('gears'), 20, turn);
  assert.ok(g.worst < 1e-12, String(g.worst));
  assert.match(g.m.xml, /<joint joint1="base_to_g2" joint2="base_to_g1" polycoef="0 -0\.6666666666666666 0 0 0"\/>/);
  const cyl = { ...caseDoc('cylindrical'), robot: { version: 1 as const, joints: { 'base~arm#0': { lower: -20, upper: 20, effort: 50, velocity: 100 } } } };
  const c = await threeWay(cyl, 30, keys => Object.fromEntries(keys.map(k => [k, k.endsWith('#0') ? rand() * 40 - 20 : (rand() * 2 - 1) * Math.PI])));
  assert.ok(c.worst < 1e-12, String(c.worst));
  assert.match(c.m.xml, /type="slide" pos="0 0 0" axis="0 0 1" range="-0\.02 0\.02"/);
});

test('the checker catches what MuJoCo\'s compiler would refuse: angles not radians, a missing mesh, a bad quaternion, an empty range, an equality to nothing, an inertia not positive', async () => {
  const r = await exported(caseDoc('revolute-limited')), files = new Set(r.files.map(f => f.path));
  assert.deepEqual(readMjcf(r.xml, files).issues, []);
  assert.match(r.xml, /type="hinge" pos="0 0 0" axis="0 0 1" range="-1\.5 1\.5"/);
  const hit = (xml: string, re: RegExp) => assert.ok(readMjcf(xml, files).issues.some(i => re.test(i)), String(re));
  hit(r.xml.replace('angle="radian"', 'angle="degree"'), /not "radian"/);
  assert.ok(readMjcf(r.xml, new Set()).issues.some(i => /no file meshes\/arm\.stl/.test(i)), 'a mesh file missing');
  hit(r.xml.replace(/quat="1 0 0 0"/, 'quat="1 1 0 0"'), /not a unit quaternion/);
  hit(r.xml.replace('range="-1.5 1.5"', 'range="1.5 -1.5"'), /range is not lower < upper/);
  hit(r.xml.replace('</worldbody>', '</worldbody>\n  <equality><joint joint1="nope" joint2="base_to_arm" polycoef="0 1 0 0 0"/></equality>'), /equality: no joint nope/);
  hit(r.xml.replace(/fullinertia="[^"]*"/, 'fullinertia="1 1 -1 0 0 0"'), /not positive definite/);
  hit(r.xml.replace(/fullinertia="[^"]*"/, 'fullinertia="1 1 3 0 0 0"'), /triangle/);
  hit(r.xml.replace(/<inertial [^>]*\/>\s*<joint/, '<joint'), /moving body without <inertial>/);
});

test('the export_mjcf tool and cad-cli mjcf; the arm-6r conformance case with what the gravity oracle will run (pending)', async () => {
  const doc = await arm6r(), out = await dispatchTool({ doc, bodies: await bodiesOf(doc) }, 'export_mjcf', {}, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed && j.check.length === 0 && j.files.length === 14 && /<mujoco model="robot">/.test(j.mjcf), out.content.slice(0, 300));
  const dir = join(CASES, 'arm-6r'), r = await exported(doc), tree = await treeOfDoc(doc, await bodiesOf(doc), evaluate);
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'robot.bcad'), JSON.stringify(doc));
    const { model } = readMjcf(r.xml), links = model.bodies.map(b => { const I = b.inertial!.I, e = symmetricEigen([I[0], I[3], I[4], I[3], I[1], I[5], I[4], I[5], I[2]]); return { name: b.name, mass: b.inertial!.mass, com: b.inertial!.pos, principal: e.values }; });
    const samples = [{}, Object.fromEntries(tree.joints.map((x, i) => [x.key, [0.3, -0.8, 1.2, 0.5, -1.4, 2.0][i]]))];
    const fk = samples.map(s => { const v = Object.fromEntries(Object.entries(forwardKinematics(tree, s).values).map(([k, x]) => [r.names.joints[k], x])); return { values: v, links: Object.fromEntries([...mjcfFk(model, v)].map(([n, p]) => [n, { position: p.t, rotation: p.R }])) }; });
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'arm-6r', step: 'RM5', note: 'A 6R arm (axes Z, Y, Y, Z, Y, Z) of six 20 × 20 × 80 aluminium blocks on a base plate, from its mates. robot.xml is its MJCF (frozen); expect.json is what scripts/mjcf-oracle.py checks in MuJoCo: masses, centres, principal inertia, body frames at two poses, and the arm hanging under gravity (pending the owner\'s go-ahead, O18).' }, null, 1) + '\n');
    writeFileSync(join(dir, 'robot.xml'), r.xml);
    // (The gravity torques MuJoCo's bias must equal at each pose — RD1's, at MJCF's 9.81 — and the hang from the second pose:
    // the pose the mates solve to is an upright equilibrium, every torque 0, from which nothing would fall, O18.)
    const gravity = [];
    for (const v of fk.map(f => f.values)) {
      const back = Object.fromEntries(Object.entries(v).map(([n, x]) => [Object.entries(r.names.joints).find(([, m]) => m === n)![0], x]));
      const g = JSON.parse((await dispatchTool({ doc, bodies: await bodiesOf(doc) }, 'gravity_torques', { values: back, g: [0, 0, -9.81] }, evaluate)).content);
      gravity.push({ values: v, torques: Object.fromEntries(Object.entries(g.torques as Record<string, number>).map(([k, t]) => [r.names.joints[k], t])) });
    }
    writeFileSync(join(dir, 'expect.json'), JSON.stringify({ tol: 1e-6, links, fk, gravity, hang: { from: fk[1].values, passive_seconds: 5, damped_seconds: 30, damping: 0.002 } }, null, 1) + '\n');
  }
  assert.equal(r.xml, readFileSync(join(dir, 'robot.xml'), 'utf8'), 'the MJCF as frozen');
  assert.ok(existsSync(join(dir, 'expect.json')));
  const tmp = mkdtempSync(join(tmpdir(), 'cad-mjcf-')); let printed = '';
  const code = await cliMain(['mjcf', join(dir, 'robot.bcad'), '-o', tmp], { stdout: { write: (s: string) => { printed += s; return true; } } as never, stderr: { write: () => true } as never });
  assert.equal(code, 0, printed);
  assert.deepEqual([JSON.parse(printed).check, JSON.parse(printed).bodies], [[], 7]);
  assert.equal(readFileSync(join(tmp, 'robot.xml'), 'utf8'), r.xml);
});

test('MuJoCo 3.3.0\'s reading of the frozen arm-6r export (O18): bodies, frames and gravity torques to 1e-6; passive energy to 1e-4; the damped hang settles and falls', () => {
  const dir = join(CASES, 'arm-6r'), o = JSON.parse(readFileSync(join(dir, 'oracle.mujoco-3.3.0.json'), 'utf8'));
  assert.equal(o.oracle, 'mujoco 3.3.0'); assert.equal(o.ok, true);
  assert.ok(o.worst <= 1e-6 && o.rows.length === 51 && o.rows.filter((r: { what: string }) => r.what.startsWith('gravity')).length === 2, String(o.worst));
  assert.ok(o.hang.passive.energy_drift < 1e-4 && o.hang.passive.warnings === 0, JSON.stringify(o.hang.passive));
  assert.ok(o.hang.damped.energy_rise < 1e-9 && o.hang.damped.qvel_max < 1e-3 && o.hang.damped.com_height_end < o.hang.damped.com_height_start, JSON.stringify(o.hang.damped));
  // (The reading is of this export: the frozen robot.xml the oracle loaded, its expectations the same file.)
  assert.ok(readFileSync(join(dir, 'robot.xml'), 'utf8').length > 0 && JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8')).gravity.length === 2);
});

