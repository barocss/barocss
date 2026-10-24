// RS1: the sample robots (samples/robots, scripts/robot-samples.ts) as the studio opens them. For each: the joint tree it
// is meant to be, its demo motion valid on it, FK at poses against a closed form (the chain's product of exponentials,
// written here from the home axes, Rodrigues; the gear and gripper ratios; the four-bar closed by its loop), and its
// URDF and MJCF read back — by our readers always, and by check_urdf and MuJoCo where they are installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { mjcfOfDoc, treeOfDoc, urdfOfDoc } from '../src/chat/robot';
import { forwardKinematics } from '../src/robot/fk';
import type { JointTree } from '../src/robot/joints';
import { closeLoop, closureOfDoc } from '../src/robot/loop';
import { checkPath, duration, timedPathOf } from '../src/robot/motion';
import { readMjcf, mjcfFk } from '../src/robot/mjcfCheck';
import { readUrdf } from '../src/robot/urdfCheck';
import { readRobot } from '../src/robot/joints';
import { samples } from '../scripts/robot-samples';
import { dispatchTool } from '../src/chat/tools';

const DIR = resolve(resolve(import.meta.dirname, '..'), 'samples/robots');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
interface Opened { id: string; doc: StudioDoc; bodies: BodyResult[]; tree: JointTree }
async function opened(id: string): Promise<Opened> {
  const read = readStudioDoc(readFileSync(join(DIR, `${id}.bcad`), 'utf8')); assert.ok('doc' in read, id);
  const r = await evaluate(read.doc); assert.ok(r.ok, id);
  return { id, doc: read.doc, bodies: r.bodies, tree: await treeOfDoc(read.doc, r.bodies, evaluate) };
}
const index = (): { id: string; title: string; about: string; file: string }[] => JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));

// ── The closed form: each link's motion as the product of its chain's joint motions, about their home axes ──
type M = { R: number[]; t: number[] };
const I3 = (): M => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] });
function jointMotion(axis: readonly number[], origin: readonly number[], type: string, q: number): M {
  if (type === 'prismatic') return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: axis.map(a => a * q) };
  const [x, y, z] = axis, c = Math.cos(q), s = Math.sin(q), v = 1 - c;
  const R = [c + x * x * v, x * y * v - z * s, x * z * v + y * s, y * x * v + z * s, c + y * y * v, y * z * v - x * s, z * x * v - y * s, z * y * v + x * s, c + z * z * v];
  return { R, t: [0, 1, 2].map(i => origin[i] - (R[i * 3] * origin[0] + R[i * 3 + 1] * origin[1] + R[i * 3 + 2] * origin[2])) };
}
const compose = (a: M, b: M): M => ({ R: [0, 1, 2].flatMap(i => [0, 1, 2].map(j => a.R[i * 3] * b.R[j] + a.R[i * 3 + 1] * b.R[3 + j] + a.R[i * 3 + 2] * b.R[6 + j])), t: [0, 1, 2].map(i => a.R[i * 3] * b.t[0] + a.R[i * 3 + 1] * b.t[1] + a.R[i * 3 + 2] * b.t[2] + a.t[i]) });
/** Every link's motion by the chain from the base link (a follower's value from its leader's, as its gears tie them). */
function closedForm(tree: JointTree, q: Readonly<Record<string, number>>): Map<string, M> {
  const value = (key: string): number => { const j = tree.joints.find(x => x.key === key)!; return j.mimic ? j.mimic.multiplier * value(j.mimic.joint) + j.mimic.offset : q[key] ?? 0; };
  const out = new Map<string, M>([[tree.base, I3()]]);
  const visit = (link: string) => { for (const j of tree.joints.filter(x => x.parent === link)) { out.set(j.child, compose(out.get(link)!, jointMotion(j.axis, j.origin, j.type, value(j.key)))); visit(j.child); } };
  visit(tree.base);
  return out;
}
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/** Driven joint values inside their limits (a turning joint without limits: ±π; a slide without: ±50 mm). */
const poseOf = (tree: JointTree) => Object.fromEntries(tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => {
  const lo = j.limit?.lower ?? (j.type === 'prismatic' ? -50 : -Math.PI), hi = j.limit?.upper ?? (j.type === 'prismatic' ? 50 : Math.PI);
  return [j.key, lo + rand() * (hi - lo)];
}));

const EXPECT: Record<string, [string, string][]> = {
  'arm-2r': [['base~a', 'revolute'], ['a~b', 'revolute']],
  scara: [['base~arm1', 'revolute'], ['arm1~arm2', 'revolute'], ['arm2~quill', 'prismatic'], ['quill~tool', 'revolute']],
  'arm-6r': [['base~l1', 'revolute'], ['l1~l2', 'revolute'], ['l2~l3', 'revolute'], ['l3~l4', 'revolute'], ['l4~l5', 'revolute'], ['l5~l6', 'revolute']],
  'gantry-ppp': [['base~x', 'prismatic'], ['x~y', 'prismatic'], ['y~z', 'prismatic']],
  'pan-tilt': [['base~pan', 'revolute'], ['pan~tilt', 'revolute']],
  gripper: [['base~left', 'revolute'], ['base~right', 'continuous']],
  'four-bar': [['base~crank', 'continuous'], ['crank~coupler', 'continuous'], ['base~rocker', 'continuous']],
  'gear-joint': [['base~g1', 'continuous'], ['base~g2', 'continuous']],
};

test('RS1: the samples on disk are what the script writes, listed in index.json, each a robot with one demo motion', () => {
  const list = index(), made = samples();
  assert.deepEqual(list.map(s => s.id), made.map(s => s.id));
  assert.deepEqual(list.map(s => s.id).sort(), Object.keys(EXPECT).sort());
  for (const s of made) {
    assert.equal(readFileSync(join(DIR, `${s.id}.bcad`), 'utf8'), JSON.stringify(s.doc) + '\n', `${s.id}: regenerate with node scripts/robot-samples.mjs`);
    assert.equal(readRobot(s.doc.robot).motions?.length, 1, s.id);
  }
});

test('RS1: each sample\'s joint tree (types, the gear followers) and its demo motion valid on it', async () => {
  for (const { id } of index()) {
    const o = await opened(id);
    assert.deepEqual(o.tree.joints.map(j => [j.key, j.type]), EXPECT[id], id);
    assert.deepEqual(o.tree.problems, [], id);
    const m = readRobot(o.doc.robot).motions![0], path = timedPathOf(o.tree, m.path);
    assert.deepEqual(checkPath(o.tree, path), [], `${id}: ${m.name}`);
    assert.ok(duration(path) > 0, id);
  }
  const g = (await opened('gripper')).tree.joints.find(j => j.key === 'base~right')!, gear = (await opened('gear-joint')).tree.joints.find(j => j.key === 'base~g2')!;
  assert.deepEqual(g.mimic, { joint: 'base~left', multiplier: -1, offset: 0 }, 'equal gears: the right finger the other way');
  assert.ok(Math.abs(gear.mimic!.multiplier + 2 / 3) < 1e-15, '20 : 30');
  assert.deepEqual((await opened('pan-tilt')).tree.frames?.map(f => [f.name, f.link, f.kind]), [['camera', 'tilt', 'sensor']]);
});

test('RS1: FK at 20 poses each against the closed form (the chain\'s product of exponentials), to 1e-9 mm', async () => {
  for (const id of Object.keys(EXPECT).filter(k => k !== 'four-bar')) {
    const { tree } = await opened(id);
    let worst = 0;
    for (let k = 0; k < 20; k++) {
      const q = poseOf(tree), fk = forwardKinematics(tree, q), cf = closedForm(tree, q);
      for (const l of tree.links) {
        const a = fk.motions.get(l.id)!, b = cf.get(l.id)!;
        worst = Math.max(worst, ...b.R.map((v, i) => Math.abs(v - a.R[i]) * 100), ...b.t.map((v, i) => Math.abs(v - a.t[i])));
      }
    }
    assert.ok(worst <= 1e-9, `${id}: ${worst}`);
  }
  // (Plain cases by hand: the gantry moves its ram by the three values; the 2R's elbow sits 40 mm from the shoulder.)
  const { tree } = await opened('gantry-ppp'), fk = forwardKinematics(tree, { 'base~x': 10, 'x~y': 20, 'y~z': -5 });
  assert.deepEqual([...fk.motions.get('z')!.t].map(v => +v.toFixed(12)), [10, 20, -5]);
  const two = (await opened('arm-2r')).tree, q1 = Math.PI / 3, at = forwardKinematics(two, { 'base~a': q1 }).motions.get('a')!, o = two.joints[1].origin;
  const p = [0, 1, 2].map(i => at.R[i * 3] * o[0] + at.R[i * 3 + 1] * o[1] + at.R[i * 3 + 2] * o[2] + at.t[i]);
  assert.ok(Math.abs(p[0] - (20 + 40 * Math.cos(q1))) < 1e-9 && Math.abs(p[1] - (20 + 40 * Math.sin(q1))) < 1e-9, JSON.stringify(p));
});

test('RS1: the demo motions\' durations in degrees (arm-2r\'s wave against the trapezoid\'s closed form); the arms carry real joint limits', async () => {
  const o = await opened('arm-2r'), wave = readRobot(o.doc.robot).motions![0];
  // (Three segments at 90°/s, 180°/s², each on its tightest joint: 90°, 180° and 90°, each past v²/a = 45°, so d/v + v/a.)
  const T = duration(timedPathOf(o.tree, wave.path));
  assert.ok(Math.abs(T - ((90 / 90 + 0.5) + (180 / 90 + 0.5) + (90 / 90 + 0.5))) <= 1e-12, `${T}`);
  // (Every moving joint has lower and upper limits, effort and velocity, but a gear follower and the joints that turn round: a crank, a gear, the loop's passive pins.)
  const unbounded: string[] = [];
  for (const s of index()) for (const j of (await opened(s.id)).tree.joints) if (j.type !== 'fixed' && !j.mimic) {
    assert.ok(j.limit?.effort !== undefined && j.limit.velocity !== undefined, `${s.id} ${j.key}: rated`);
    if (j.limit.lower === undefined || j.limit.upper === undefined) unbounded.push(`${s.id} ${j.key}`);
  }
  assert.deepEqual(unbounded.sort(), ['four-bar base~crank', 'four-bar base~rocker', 'four-bar crank~coupler', 'gear-joint base~g1']);
});

test('RS1 (O22): every sample\'s demo motion passes check_path clear along its timing; the four-bar refused, its loop not closed along a motion (LOOP_OPEN)', async () => {
  for (const s of index()) {
    const o = await opened(s.id), m = readRobot(o.doc.robot).motions![0];
    const out = await dispatchTool({ doc: o.doc, bodies: o.bodies }, 'check_path', { motion: m.name }, evaluate);
    if (o.tree.loops.length) { assert.ok(out.isError, s.id); assert.match(out.content, /\[LOOP_OPEN\]/); continue; }
    assert.ok(!out.isError, `${s.id}: ${out.content}`);
    const j = JSON.parse(out.content); assert.equal(j.clear, true, `${s.id} ${m.name}: ${out.content.slice(0, 300)}`);
  }
});

test('RS1: the four-bar closes its loop through its demo motion (the pins meet to 1e-9 mm)', async () => {
  const { doc, tree } = await opened('four-bar'), c = closureOfDoc(doc, tree, tree.loops[0]);
  let q: Record<string, number> = {};
  for (const deg of [20, 40, 60, 30, 0, -30, -60]) {
    const r = closeLoop(tree, c, 'base~crank', deg * Math.PI / 180, q); q = r.q;
    assert.ok(r.residualMM <= 1e-9, `${deg}°: ${r.residualMM}`);
  }
});

test('RS1: URDF and MJCF exported and read back by our readers: FK through the files equals ours, to 1e-12 m', async () => {
  for (const id of Object.keys(EXPECT)) {
    const { doc, bodies, tree } = await opened(id), m = await mjcfOfDoc(doc, bodies, evaluate, id);
    assert.ok(m.ok, `${id}: ${JSON.stringify(!m.ok && m.refusals)}`);
    const read = readMjcf(m.xml, new Set(m.files.map(f => f.path)));
    assert.deepEqual(read.issues, [], id);
    if (id !== 'four-bar') { const u = await urdfOfDoc(doc, bodies, evaluate, id); assert.ok(u.ok, id); assert.ok(readUrdf(u.urdf).model.joints.length >= tree.joints.length, id); }
    let worst = 0;
    for (let k = 0; k < (id === 'four-bar' ? 0 : 5); k++) {
      const fk = forwardKinematics(tree, poseOf(tree));
      const named = Object.fromEntries(Object.entries(fk.values).map(([key, v]) => [m.names.joints[key], tree.joints.find(j => j.key === key)!.type === 'prismatic' ? v / 1000 : v]));
      const files = mjcfFk(read.model, named);
      for (const l of tree.links) {
        const D = fk.motions.get(l.id)!, H = m.frames.get(l.id)!, p = files.get(m.names.links[l.id])!;
        const o = [0, 1, 2].map(i => (D.R[i * 3] * H.o[0] + D.R[i * 3 + 1] * H.o[1] + D.R[i * 3 + 2] * H.o[2] + D.t[i]) / 1000);
        worst = Math.max(worst, ...o.map((v, i) => Math.abs(v - p.t[i])));
      }
    }
    assert.ok(worst <= 1e-12, `${id}: ${worst}`);
  }
});

const CHECK_URDF = ['/opt/homebrew/bin/check_urdf', '/usr/local/bin/check_urdf', '/usr/bin/check_urdf'].find(existsSync);
const MUJOCO = join(process.env.HOME ?? '', '.cache/barocss-mujoco/bin/python'), ORACLE = resolve(import.meta.dirname, '../scripts/robot-fk-oracle.py');
test('RS1: check_urdf reads every open-chain sample\'s URDF; MuJoCo\'s kinematics of each MJCF equals our reader\'s (where installed)', { skip: !CHECK_URDF && !existsSync(MUJOCO) ? 'neither check_urdf nor MuJoCo installed' : false }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rs1-'));
  try {
    for (const id of Object.keys(EXPECT)) {
      const { doc, bodies, tree } = await opened(id), here = join(dir, id); mkdirSync(here);
      if (CHECK_URDF && id !== 'four-bar') {
        const u = await urdfOfDoc(doc, bodies, evaluate, id); assert.ok(u.ok);
        writeFileSync(join(here, 'robot.urdf'), u.urdf);
        const r = spawnSync(CHECK_URDF, [join(here, 'robot.urdf')], { encoding: 'utf8' });
        assert.equal(r.status, 0, `${id}: ${r.stdout}${r.stderr}`);
      }
      if (existsSync(MUJOCO)) {
        const m = await mjcfOfDoc(doc, bodies, evaluate, id); assert.ok(m.ok);
        for (const f of m.files) { mkdirSync(join(here, f.path, '..'), { recursive: true }); writeFileSync(join(here, f.path), f.data); }
        writeFileSync(join(here, 'robot.xml'), m.xml);
        const read = readMjcf(m.xml).model, poses = [0, 1, 2].map(() => { const fk = forwardKinematics(tree, poseOf(tree)); return Object.fromEntries(Object.entries(fk.values).map(([key, v]) => [m.names.joints[key], tree.joints.find(j => j.key === key)!.type === 'prismatic' ? v / 1000 : v])); });
        const r = spawnSync(MUJOCO, ['-I', ORACLE], { input: JSON.stringify({ model: join(here, 'robot.xml'), poses }), encoding: 'utf8' });
        assert.equal(r.status, 0, `${id}: ${r.stderr}`);
        const theirs = JSON.parse(r.stdout) as Record<string, { t: number[]; R: number[] }>[];
        let worst = 0;
        poses.forEach((q, k) => { const ours = mjcfFk(read, q); for (const [name, p] of ours) { const b = theirs[k][name]; if (b) worst = Math.max(worst, ...p.t.map((v, i) => Math.abs(v - b.t[i])), ...p.R.map((v, i) => Math.abs(v - b.R[i]))); } });
        assert.ok(worst <= 1e-9, `${id}: MuJoCo ${worst}`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
