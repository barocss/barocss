import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import type { PartInstance, StudioDoc } from '../src/engine/doc';
import { mjcfOfDoc, robotOfDoc, urdfOfDoc } from '../src/chat/robot';
import { dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { solveDoc } from '../src/chat/assembly';
import { forwardKinematics, type Motion } from '../src/robot/fk';
import { framePoses } from '../src/robot/frames';
import { frameTarget, frameTool, IkError, solveIk } from '../src/robot/ik';
import { workspaceMap } from '../src/robot/workspace';
import { mjcfFk, readMjcf } from '../src/robot/mjcfCheck';
import { readUrdf, urdfFk } from '../src/robot/urdfCheck';
import { modelFk, readSdf } from '../src/robot/modelCheck';
import { exportSdf } from '../src/robot/sdf';
import { exportUsd } from '../src/robot/usd';
import { rotationMatrix } from '../src/engine/placement';
import type { JointTree } from '../src/robot/joints';

// O12: tool and sensor frames on links — a TCP on arm-6r's last link, a camera on its third — kept beside the joints.
// FK moves each with its link; URDF, SDF and MJCF read back by our own readers put each frame where RM2's FK does at 21
// poses (to 1e-9 mm and 1e-9 in rotation); IK to a frame's pose reaches it; the workspace map of a frame is its link's
// at the frame's origin; a frame adds no mass; with no frames every export is byte for byte as before. Refusals typed.

const CASES = resolve(import.meta.dirname, '../../barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const bodiesOf = async (doc: StudioDoc) => { const r = await evaluate(doc); assert.ok(r.ok); return r.bodies as BodyResult[]; };
const arm6r = (): StudioDoc => JSON.parse(readFileSync(join(CASES, 'arm-6r', 'robot.bcad'), 'utf8'));
const FRAMES = { tcp: { link: 'l6', position: [5, -3, 40], rotation: [0, 90, 0], kind: 'tool' as const }, cam: { link: 'l3', position: [10, 20, 5], rotation: [30, -15, 60], kind: 'sensor' as const } };
const withFrames = (doc: StudioDoc, frames: Record<string, unknown> = FRAMES): StudioDoc => ({ ...doc, robot: { version: 1, frames } as StudioDoc['robot'] });
let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const moving = (t: JointTree) => t.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
const randomQ = (t: JointTree) => Object.fromEntries(moving(t).map(k => [k, (rand() * 2 - 1) * 2.5]));
const parse = (s: string) => JSON.parse(s) as Record<string, any>;

test('O12: each frame is its part\'s placement and its local pose; FK moves it with its link', async () => {
  const doc = withFrames(arm6r()), { tree } = await robotOfDoc(doc, await bodiesOf(doc), evaluate);
  assert.deepEqual(tree.frames!.map(f => [f.name, f.link, f.kind]), [['tcp', 'l6', 'tool'], ['cam', 'l3', 'sensor']]);
  assert.deepEqual(tree.problems, []);
  const l6 = solveDoc(doc).doc.instances!.find(i => i.id === 'l6')!, P = rotationMatrix(l6.rotation), L = rotationMatrix([0, 90, 0]), tcp = tree.frames![0];
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(tcp.o[i] - (P[i * 3] * 5 + P[i * 3 + 1] * -3 + P[i * 3 + 2] * 40 + l6.position[i])) < 1e-12);
    for (let j = 0; j < 3; j++) assert.ok(Math.abs(tcp.R[i * 3 + j] - (P[i * 3] * L[j] + P[i * 3 + 1] * L[3 + j] + P[i * 3 + 2] * L[6 + j])) < 1e-12);
  }
  // (At the solved pose the frame is where it was put, its part where the mates solve it; at another, its link's motion applied to it.)
  const home = framePoses(tree, forwardKinematics(tree, {}).motions).get('tcp')!;
  assert.deepEqual(home.o.map(v => +v.toFixed(9)), tcp.o.map(v => +v.toFixed(9)));
  const q = randomQ(tree), fk = forwardKinematics(tree, q), D = fk.motions.get('l6')!, at = framePoses(tree, fk.motions).get('tcp')!;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(at.o[i] - (D.R[i * 3] * tcp.o[0] + D.R[i * 3 + 1] * tcp.o[1] + D.R[i * 3 + 2] * tcp.o[2] + D.t[i])) < 1e-9);
});

test('O12: URDF, SDF and MJCF write each frame as a fixed child link; read back, each is where FK puts it at 21 poses', async () => {
  const doc = withFrames(arm6r()), bodies = await bodiesOf(doc), { tree, partOf } = await robotOfDoc(doc, bodies, evaluate);
  const u = await urdfOfDoc(doc, bodies, evaluate, 'robot'), m = await mjcfOfDoc(doc, bodies, evaluate, 'robot'), s = exportSdf(tree, partOf, 'robot');
  assert.ok(u.ok && m.ok && s.ok);
  const ur = readUrdf(u.urdf, new Set(u.files.map(f => f.path))), mj = readMjcf(m.xml, new Set(m.files.map(f => f.path.replace(/^meshes\//, 'meshes/')))), sd = readSdf(s.sdf);
  assert.deepEqual(ur.issues, []); assert.deepEqual(mj.issues, []);
  for (const n of ['tcp', 'cam']) {
    const j = ur.model.joints.find(x => x.child === n)!; assert.equal(j.type, 'fixed'); assert.equal(ur.model.links.find(l => l.name === n)!.inertial, undefined, 'massless, as tool0');
    assert.equal(sd.joints.find(x => x.child === n)!.type, 'fixed');
    assert.ok(mj.model.bodies.find(b => b.name === n && !b.joint && !b.inertial), `MJCF: ${n} a welded body without mass`); assert.match(m.xml, new RegExp(`<site name="${n}" pos="0 0 0"/>`));
  }
  const base = u.frames.get(tree.base)!, Rb = base.R;
  let worst = 0;
  for (let k = 0; k < 21; k++) {
    const q = k ? randomQ(tree) : {}, fk = forwardKinematics(tree, q), want = framePoses(tree, fk.motions), named = Object.fromEntries(moving(tree).map(key => [u.names.joints[key], q[key] ?? 0]));
    const U = urdfFk(ur.model, named), M = mjcfFk(mj.model, named), S = modelFk(sd, named);
    for (const [n, w] of want) {
      // (URDF from its root link: the base link's frame put back.)
      const r = U.get(n)!, uo = [0, 1, 2].map(i => (Rb[i * 3] * r.t[0] + Rb[i * 3 + 1] * r.t[1] + Rb[i * 3 + 2] * r.t[2]) * 1000 + base.o[i]);
      const uR = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => Rb[i * 3] * r.R[j] + Rb[i * 3 + 1] * r.R[3 + j] + Rb[i * 3 + 2] * r.R[6 + j]));
      const mm = M.get(n)!, ss = S.get(n)!;
      for (const [o, R] of [[uo, uR], [mm.t.map(v => v * 1000), mm.R], [ss.o.map(v => v * 1000), ss.R]] as [number[], number[]][])
        worst = Math.max(worst, ...o.map((v, i) => Math.abs(v - w.o[i])), ...R.map((v, i) => Math.abs(v - w.R[i])));
    }
  }
  assert.ok(worst < 1e-9, `worst ${worst}`);
});

test('O12: a frame adds no mass; with no frames URDF, SDF, MJCF and USD are byte for byte as before', async () => {
  const plain = arm6r(), framed = withFrames(plain), bp = await bodiesOf(plain);
  const a = await robotOfDoc(plain, bp, evaluate), b = await robotOfDoc(framed, bp, evaluate);
  const ma = readMjcf((await mjcfOfDoc(plain, bp, evaluate, 'robot') as { xml: string }).xml).model, mb = readMjcf((await mjcfOfDoc(framed, bp, evaluate, 'robot') as { xml: string }).xml).model;
  const mass = (x: typeof ma) => x.bodies.reduce((s, y) => s + (y.inertial?.mass ?? 0), 0);
  assert.equal(mass(mb), mass(ma));
  for (const [name, file, out] of [['SDF', 'robot.sdf', (t: typeof a) => (exportSdf(t.tree, t.partOf, 'robot') as { sdf: string }).sdf], ['USD', 'robot.usda', (t: typeof a) => (exportUsd(t.tree, t.partOf, 'robot') as { usda: string }).usda]] as const) {
    assert.equal(out(a), readFileSync(join(CASES, 'arm-6r', file), 'utf8'), `${name} without frames: the committed file`);
    assert.notEqual(out(b), out(a));
  }
  assert.equal((await mjcfOfDoc(plain, bp, evaluate, 'robot') as { xml: string }).xml, readFileSync(join(CASES, 'arm-6r', 'robot.xml'), 'utf8'), 'MJCF without frames: the committed file');
  // (With frames, each export is the one without them plus its frames' lines only: every other line the same, in order.)
  const texts = async (t: typeof a, d: StudioDoc) => ({ URDF: (await urdfOfDoc(d, bp, evaluate, 'robot') as { urdf: string }).urdf, MJCF: (await mjcfOfDoc(d, bp, evaluate, 'robot') as { xml: string }).xml,
    SDF: (exportSdf(t.tree, t.partOf, 'robot') as { sdf: string }).sdf, USD: (exportUsd(t.tree, t.partOf, 'robot') as { usda: string }).usda });
  const before = await texts(a, plain), after = await texts(b, framed);
  for (const k of ['URDF', 'MJCF', 'SDF', 'USD'] as const) {
    const was = before[k].split('\n'), now = after[k].split('\n'), added: string[] = [];
    let i = 0;
    for (const line of now) { if (i < was.length && line === was[i]) i++; else added.push(line); }
    assert.equal(i, was.length, `${k}: every line without frames is still there, in order`);
    // (The added lines: per frame its link and fixed joint (URDF 6 lines, SDF 12), its welded body and site (MJCF 3), its
    // prim (USD 5) — and nothing else; each frame named in its own.)
    const per = { URDF: 6, SDF: 12, MJCF: 3, USD: 5 }[k];
    assert.equal(added.length, 2 * per, `${k}: ${added.length} lines added`);
    for (const n of ['tcp', 'cam']) assert.ok(added.filter(l => new RegExp(`\\b${n}(_fixed)?\\b`).test(l)).length >= (k === 'USD' ? 1 : 2), `${k}: ${n}'s lines`);
  }
  // (USD: each frame an Xform beneath its link's prim, no rigid body, no joint.)
  const usd = (exportUsd(b.tree, b.partOf, 'robot') as { usda: string }).usda;
  assert.match(usd, /^ {8}def Xform "tcp"\n {8}\{\n {12}matrix4d xformOp:transform = /m);
  assert.doesNotMatch(usd, /PhysicsFixedJoint "tcp/);
});

test('O12: IK to a frame\'s pose reaches it, in pose and in position mode; the workspace map of a frame is its link\'s at its origin', async () => {
  const doc = withFrames(arm6r()), { tree } = await robotOfDoc(doc, await bodiesOf(doc), evaluate);
  for (const name of ['tcp', 'cam']) {
    const q = randomQ(tree), want = framePoses(tree, forwardKinematics(tree, q).motions).get(name)!, pose: Motion = { R: Float64Array.from(want.R), t: Float64Array.from(want.o) };
    for (const mode of ['pose', 'position'] as const) {
      const r = solveIk(tree, frameTarget(tree, name, pose, mode));
      assert.ok(r.reached, `${name} ${mode}: ${r.errorM} m, ${r.errorRad} rad`);
      const got = framePoses(tree, forwardKinematics(tree, r.q).motions).get(name)!;
      assert.ok(Math.hypot(...got.o.map((v, i) => v - want.o[i])) < 0.1, `${name} ${mode}: the frame's origin within 0.1 mm`);
      if (mode === 'pose') assert.ok(Math.max(...got.R.map((v, i) => Math.abs(v - want.R[i]))) < 2e-3, `${name}: its axes too`);
    }
  }
  assert.throws(() => frameTarget(tree, 'gripper', { R: new Float64Array(9), t: new Float64Array(3) }), (e: unknown) => e instanceof IkError && e.code === 'NO_FRAME');
  const t = frameTool(tree, 'tcp');
  assert.deepEqual(workspaceMap(tree, { frame: 'tcp', samples: 300, h: 20 }), workspaceMap(tree, { link: t.link, tool: t.tool, samples: 300, h: 20 }));
});

test('O12: set_frames — refusals typed and named, the state the same; always proposed (the robot\'s settings); set_joints keeps the frames', async () => {
  const doc = arm6r(), s: ChatState = { doc, bodies: await bodiesOf(doc) };
  const loose: PartInstance = { id: 'loose', name: 'loose', doc: doc.instances![0].doc, position: [500, 0, 0], rotation: [0, 0, 0] };
  const s2: ChatState = { ...s, doc: { ...doc, instances: [...doc.instances!, loose] } };
  const rename = (id: string) => (id === 'l6' ? 'l-6' : id);
  const renamed: ChatState = { ...s, doc: { ...doc, instances: doc.instances!.map(i => ({ ...i, id: rename(i.id) })), mates: doc.mates!.map(m => ({ ...m, a: { ...m.a, part: rename(m.a.part) }, b: { ...m.b, part: rename(m.b.part) } })) } };
  const cases: [ChatState, Record<string, unknown>, RegExp][] = [
    [s, { tcp: { link: 'p9' } }, /^\[FRAME_LINK_MISSING\] frame tcp: no part p9/],
    [s2, { tcp: { link: 'loose' } }, /^\[FRAME_LINK_STALE\] frame tcp: loose is not a link of the robot as it stands/],
    [s, { '1x': { link: 'l6' } }, /^\[FRAME_NAME\] "1x"/],
    [s, { l6: { link: 'l6' } }, /^\[FRAME_NAME\] "l6" is the export name of link l6/],
    [s, { tcp: { link: 'l6', position: [1, 2] } }, /^\[FRAME_POSE\] frame tcp/],
    [s, { tcp: { link: 'l6', offset: 3 } }, /^\[FRAME_POSE\] frame tcp: no field offset/],
    [s, { tcp: null }, /^\[FRAME_NAME\] no frame tcp to remove/],
    // (After the exporters' own naming: instance l-6 is written l_6.)
    [renamed, { l_6: { link: 'l-6' } }, /^\[FRAME_NAME\] "l_6" is the export name of link l-6/],
  ];
  for (const [st, frames, want] of cases) {
    const r = await dispatchTool(st, 'set_frames', { frames }, evaluate);
    assert.ok(r.isError, JSON.stringify(frames)); assert.match(parse(r.content).error, want); assert.equal(r.state, st);
  }
  const ok = await dispatchTool(s, 'set_frames', { frames: FRAMES }, evaluate);
  assert.ok(!ok.isError, ok.content); assert.deepEqual(parse(ok.content).frames.map((f: { frame: string }) => f.frame), ['tcp', 'cam']);
  // (The robot's settings always need the user: refused directly at every level, proposed instead.)
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '4';
  try {
    const direct = await runTool(s, 'set_frames', { frames: FRAMES }, evaluate);
    assert.ok(direct.isError); assert.equal(parse(direct.content).code, 'needs_approval');
    const p = await runTool(s, 'propose', { title: 'a TCP', ops: [{ tool: 'set_frames', args: { frames: { tcp: FRAMES.tcp } } }] }, evaluate);
    assert.ok(!p.isError, p.content); assert.deepEqual(parse(p.content).risk.approval, ['robot']);
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
  const keyed = await dispatchTool(ok.state, 'get_joints', {}, evaluate), key = parse(keyed.content).joints[0].key;
  const limited = await dispatchTool(ok.state, 'set_joints', { joints: { [key]: { lower: -1, upper: 1 } } }, evaluate);
  assert.ok(!limited.isError, limited.content); assert.deepEqual(Object.keys((limited.state.doc.robot as { frames: object }).frames), ['tcp', 'cam']);
  const fk = parse((await dispatchTool(ok.state, 'forward_kinematics', { values: { [key]: 0.5 } }, evaluate)).content);
  assert.deepEqual(fk.frames.map((f: { frame: string; link: string }) => [f.frame, f.link]), [['tcp', 'l6'], ['cam', 'l3']]);
  // (A frame whose part is gone: get_joints shows the problem, and every export refuses it, typed.)
  const gone = withFrames({ ...doc, instances: doc.instances!.filter(i => i.id !== 'l6'), mates: doc.mates!.filter(m => m.a.part !== 'l6' && m.b.part !== 'l6') }, { tcp: FRAMES.tcp });
  const u = await urdfOfDoc(gone, s.bodies, evaluate, 'robot');
  assert.ok(!u.ok); assert.deepEqual(u.refusals.map(r => r.code), ['FRAME_LINK_MISSING']);
  // (A clash only one exporter sees: USD's root prim is named after the export.)
  const rooted = withFrames(doc, { robot: FRAMES.tcp }), rb = await robotOfDoc(rooted, s.bodies, evaluate);
  assert.ok((await urdfOfDoc(rooted, s.bodies, evaluate, 'robot')).ok);
  const ru = exportUsd(rb.tree, rb.partOf, 'robot'); assert.ok(!ru.ok); assert.match(ru.refusals[0].message, /^\[FRAME_NAME\] "robot" is taken in this export/);
});

// External read-back (run by hand; scripts/frames-oracle.py says how): with O12_ORACLE_OUT set, the framed arm's files and
// expect.json are written there; the three oracles' readings are committed under conformance/rm/arm-6r/frames/, and
// expect.json there must still be what the studio computes now.
test('O12: the frames read back by MuJoCo 3.3.0 (sites), usd-core (prims beneath their links) and check_urdf, as committed', async () => {
  const doc = withFrames(arm6r()), bodies = await bodiesOf(doc), { tree, partOf } = await robotOfDoc(doc, bodies, evaluate);
  const u = await urdfOfDoc(doc, bodies, evaluate, 'robot'), m = await mjcfOfDoc(doc, bodies, evaluate, 'robot'), usd = exportUsd(tree, partOf, 'robot');
  assert.ok(u.ok && m.ok && usd.ok);
  const plain = readMjcf((await mjcfOfDoc(arm6r(), bodies, evaluate, 'robot') as { xml: string }).xml).model;
  seed = 101;
  const samples = Array.from({ length: 21 }, (_, k) => {
    const q = k ? randomQ(tree) : {}, poses = framePoses(tree, forwardKinematics(tree, q).motions);
    return { q: Object.fromEntries(moving(tree).map(key => [m.names.joints[key], q[key] ?? 0])),
      frames: Object.fromEntries([...poses].map(([n, p]) => [n, { o: p.o.map(v => v / 1000), R: p.R, ...(k ? {} : { usd_path: `/robot/${usd.names.links[tree.frames!.find(f => f.name === n)!.link]}/${n}` }) }])) };
  });
  const expect = { tol: 1e-6, mass: plain.bodies.reduce((s, b) => s + (b.inertial?.mass ?? 0), 0), bodies: tree.links.length, joints: tree.joints.length, samples };
  const out = process.env.O12_ORACLE_OUT;
  if (out) {
    mkdirSync(join(out, 'meshes'), { recursive: true });
    writeFileSync(join(out, 'robot.urdf'), u.urdf); writeFileSync(join(out, 'robot.xml'), m.xml); writeFileSync(join(out, 'robot.usda'), usd.usda);
    for (const f of m.files) writeFileSync(join(out, f.path), f.data);
    writeFileSync(join(out, 'expect.json'), `${JSON.stringify(expect, null, 1)}\n`);
  }
  const dir = join(CASES, 'arm-6r', 'frames');
  assert.equal(readFileSync(join(dir, 'expect.json'), 'utf8'), `${JSON.stringify(expect, null, 1)}\n`, 'expect.json is what the studio computes now');
  const mj = JSON.parse(readFileSync(join(dir, 'oracle.mujoco-3.3.0.json'), 'utf8')), us = JSON.parse(readFileSync(join(dir, 'oracle.usd-core-26.8.json'), 'utf8')), cu = JSON.parse(readFileSync(join(dir, 'oracle.check_urdf.json'), 'utf8'));
  assert.equal(mj.oracle, 'mujoco 3.3.0'); assert.ok(mj.ok && mj.worst <= 1e-6 && mj.rows.length === 42 && mj.mass_gap <= 1e-12, `MuJoCo: ${mj.worst}`);
  assert.ok(us.ok && us.worst <= 1e-6 && us.bodies === tree.links.length && us.joints === tree.joints.length, `usd-core: ${us.worst}`);
  assert.ok(cu.ok && cu.returncode === 0); assert.deepEqual(cu.listed, ['cam', 'tcp']);
});
