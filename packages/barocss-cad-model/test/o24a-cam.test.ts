// O24 (a), PG-5: a cam mate — a lobe (a base circle and a nose joined by their tangents, the engine's) turning on its
// shaft, its flat-faced follower sliding toward it in a guide, and a valve pushed by the follower. The oracle: the
// lobe is the convex hull of its two circles, so its support along the follower's line is exactly
//   h(θ) = max(r_b, c cos θ + r_n)        (the nose at c out, along the follower's line at θ = 0)
// and the follower's lift is h(θ) − h(0); the valve moves with it. Also: through a 2:1 gear train from a crank, the
// sweep's bound, the exports' refusal (and leave_out), each refusal of the mate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { evaluatePart } from '../src/engine/evaluate';
import { treeOfDoc } from '../src/chat/robot';
import { forwardKinematics } from '../src/robot/fk';
import { checkPath } from '../src/robot/motion';
import { robotViewOf, sweepOf, treeOf, urdfOf, mjcfOf } from '../src/robot/verbs';
import { dispatchTool } from '../src/chat/tools';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const RB = 14, RN = 6, C = 14;
const box = (w: number, d: number, h: number, extra: ModelNode[] = []): StudioDoc => ({ ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] } as ModelNode, { kind: 'extrude', sketch: 0, height: h } as ModelNode, ...extra] });
/** The lobe: its base circle about the origin, its nose at (0, C), joined by their outer tangents; a shaft hole through it. */
function lobe(): StudioDoc {
  const a = (RB - RN) / C, b = Math.sqrt(1 - a * a), r = (v: number) => Math.round(v * 1e9) / 1e9;
  const p1: [number, number] = [r(RB * b), r(RB * a)], p2: [number, number] = [r(RN * b), r(C + RN * a)], q2: [number, number] = [r(-RN * b), r(C + RN * a)], q1: [number, number] = [r(-RB * b), r(RB * a)];
  return { ...emptyDoc(), nodes: [
    { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: p1 }, { kind: 'arc', start: p2, center: [0, C], direction: 'ccw' }, { kind: 'line', start: q2 }, { kind: 'arc', start: q1, center: [0, 0], direction: 'ccw' }] } as ModelNode,
    { kind: 'extrude', sketch: 0, height: 8 } as ModelNode,
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [0, 0], radius: 5 } as ModelNode,
  ] };
}
/** The face of a part's table facing `n` (its own coordinates), by name. */
async function faceFacing(doc: StudioDoc, n: [number, number, number]): Promise<string> {
  const { faceTableOf } = await import('../src/assembly/faces'), t = faceTableOf(doc);
  return Object.entries(t).find(([k, f]) => !k.startsWith('origin:') && f.kind === 'plane' && Math.abs(f.normal[0] - n[0]) + Math.abs(f.normal[1] - n[1]) + Math.abs(f.normal[2] - n[2]) < 1e-9)![0];
}
/** The cam on the base about (100, 100), its follower above it (its −Y face on the nose, sliding along Y under a grounded guide — on its bottom and its −X face's plane — 1 mm clear of the base), and a valve on the follower's top. */
async function camDoc(o: { seat?: number; valve?: boolean; skirt?: boolean; lobe?: false; back?: boolean } = {}): Promise<StudioDoc> {
  const base: StudioDoc = { ...box(200, 200, 10, [{ kind: 'hole', parent: { node: 1, side: 'solid' }, center: [100, 100], radius: 5 } as ModelNode]) };
  const W = 60, plain = box(W, 10, 8), follower = o.skirt ? box(W, 10, 8, [{ kind: 'sketch', profile: 'rectangle', min: [12, -10], max: [16, 0] } as ModelNode, { kind: 'extrude', sketch: 2, height: 8 } as ModelNode]) : plain, guide = box(10, 60, 10), valve = box(20, 30, 8);
  const [fY, fX, fTop] = await Promise.all([faceFacing(plain, [0, -1, 0]), faceFacing(plain, [1, 0, 0]), faceFacing(plain, [0, 1, 0])]);
  const [gX, vY, vX] = await Promise.all([faceFacing(guide, [-1, 0, 0]), faceFacing(valve, [0, -1, 0]), faceFacing(valve, [1, 0, 0])]);
  const top = 100 + C + RN + (o.seat ?? 0);
  const mates: Mate[] = [
    { id: 'shaftc', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'cam', face: 'n2.side0' } },
    { id: 'shaftf', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'cam', face: 'n1.bottom' } },
    { id: 'guide1', kind: 'coincident', a: { part: 'guide', face: 'n1.bottom' }, b: { part: 'follower', face: 'n1.top' } },
    { id: 'guide2', kind: 'coincident', a: { part: 'guide', face: gX }, b: { part: 'follower', face: fX } },
    ...(o.lobe === false ? [] : [{ id: 'lobe', kind: 'cam', a: { part: 'cam', face: 'n1.top' }, b: { part: 'follower', face: fY } } as Mate]),
    ...(o.valve ? [
      { id: 'vguide1', kind: 'coincident', a: { part: 'guide', face: 'n1.bottom' }, b: { part: 'valve', face: 'n1.top' } } as Mate,
      { id: 'vguide2', kind: 'coincident', a: { part: 'guide', face: gX }, b: { part: 'valve', face: vX } } as Mate,
      { id: 'push', kind: 'cam', a: { part: 'follower', face: fTop }, b: { part: 'valve', face: vY } } as Mate,
      ...(o.back ? [{ id: 'back', kind: 'cam', a: { part: 'valve', face: vY }, b: { part: 'follower', face: fTop } } as Mate] : []),
    ] : []),
  ];
  const slide = { lower: -10, upper: 10, effort: 50, velocity: 100 };
  return { ...base, robot: { version: 1, joints: { 'base~cam': { effort: 2, velocity: 3 }, 'follower~guide': slide, ...(o.valve ? { 'guide~valve': slide } : {}) } }, instances: [
    { id: 'cam', name: 'cam', doc: lobe(), position: [100, 100, 10], rotation: [0, 0, 0] },
    { id: 'follower', name: 'follower', doc: follower, position: [130 - W, top, 11], rotation: [0, 0, 0] },
    { id: 'guide', name: 'guide', doc: guide, position: [130, top - 20, 19], rotation: [0, 0, 0], grounded: true },
    ...(o.valve ? [{ id: 'valve', name: 'valve', doc: valve, position: [110, top + 10, 11] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }] : []),
  ], mates };
}
const h = (theta: number) => Math.max(RB, C * Math.cos(theta) + RN);

test('O24 (a) PG-5: the follower\'s lift is the lobe\'s support — max(r_b, c cos θ + r_n) − h(0) — at 72 cam angles, to 1e-9 mm; the valve pushed with it', async () => {
  const doc = await camDoc({ valve: true }), r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate);
  assert.deepEqual(tree.problems, []);
  const camJ = tree.joints.find(j => j.child === 'cam')!, folJ = tree.joints.find(j => j.child === 'follower')!, valJ = tree.joints.find(j => j.child === 'valve')!;
  assert.equal(folJ.type, 'prismatic'); assert.ok(folJ.cam && folJ.mimic?.joint === camJ.key);
  assert.deepEqual(tree.cams!.map(c => [c.kind, c.mate, c.leader, c.follower]), [['cam', 'lobe', camJ.key, folJ.key], ['push', 'push', folJ.key, valJ.key]]);
  const sign = Math.sign(folJ.axis[1]);
  for (let k = 0; k < 72; k++) {
    const theta = (k * 2 * Math.PI) / 72, fk = forwardKinematics(tree, { [camJ.key]: theta });
    const lift = fk.values[folJ.key] * sign;
    assert.ok(Math.abs(lift - (h(theta) - h(0))) <= 1e-9, `${(k * 5)}°: ${lift} vs ${h(theta) - h(0)}`);
    // (The follower's face, where FK puts it, on the lobe; the valve on the follower.)
    const yFace = fk.motions.get('follower')!.t[1] + 100 + C + RN;
    assert.ok(Math.abs(yFace - (100 + h(theta))) <= 1e-9);
    assert.ok(Math.abs(fk.motions.get('valve')!.t[1] - fk.motions.get('follower')!.t[1]) <= 1e-9, 'the valve moves with the follower');
  }
  assert.deepEqual(tree.cams![0].lift, [-(C + RN - RB), 0]);
  // (The follower and the valve follow: given their own values, refused as a gear's follower is.)
  assert.deepEqual(checkPath(tree, { waypoints: [{}, { [folJ.key]: 1 }], profile: 'trapezoid', limits: { default: { v: 1, a: 1 } } }).map(p => p.code), ['JOINT_MIMIC']);
});

test('O24 (a) PG-5: the cam as the agent sees it — get_joints\' couplings, pose closes the lift, a sweep stays certified with its bound, exports refuse it (leave_out writes it free)', async () => {
  const doc = await camDoc(), r = await evaluate(doc); assert.ok(r.ok);
  const view = await robotViewOf(doc, r.bodies, evaluate), tree = treeOf(view), camJ = tree.joints.find(j => j.child === 'cam')!, folJ = tree.joints.find(j => j.child === 'follower')!;
  const s = { doc, bodies: r.bodies };
  const joints = JSON.parse((await dispatchTool(s, 'get_joints', {}, evaluate)).content);
  assert.equal(joints.cams[0].kind, 'cam'); assert.equal(joints.cams[0].follower, folJ.key);
  const pose = JSON.parse((await dispatchTool(s, 'set_pose', { values: { [camJ.key]: 90 } }, evaluate)).content);
  assert.ok(Math.abs(Math.abs(pose.values[folJ.key]) - (C + RN - RB)) <= 1e-9, `a quarter turn: the base circle under the follower, 6 mm down: ${JSON.stringify(pose).slice(0, 300)}`);
  // (A half turn swept: certified clear — the follower rides the lobe, its seat designed — with the lift's bound.)
  const sw = sweepOf(view, {}, { [camJ.key]: Math.PI }, tree);
  assert.equal(sw.reply.clear, true, JSON.stringify(sw.reply).slice(0, 400));
  assert.match(sw.reply.designed.find(d => d.links.includes('follower') && d.links.includes('cam'))!.why, /^a cam \(lobe\): follower's face rides cam by design$/);
  for (const [f, args] of [[urdfOf, {}], [mjcfOf, {}]] as const) {
    const refused = f(view, 'cam', tree);
    assert.equal(refused.ok, false); assert.deepEqual((refused as { refusals: { code: string }[] }).refusals.map(x => x.code), ['CAM_UNSUPPORTED']);
    const free = f(view, 'cam', tree, { leaveOut: ['cam'] });
    assert.ok(free.ok, JSON.stringify(free)); assert.ok(free.notes.some(n => /follows a cam \(lobe\): left out/.test(n)), JSON.stringify(free.notes)); void args;
  }
  const refusedTool = await dispatchTool(s, 'export_urdf', {}, evaluate);
  assert.ok(refusedTool.isError); assert.match(refusedTool.content, /\[CAM_UNSUPPORTED\]/);
  assert.ok(!(await dispatchTool(s, 'export_urdf', { leave_out: ['cam'] }, evaluate)).isError);
});

test('O24 (a) PG-5: a follower off the lobe is not coupled (CAM_NOT_SEATED), said so', async () => {
  const doc = await camDoc({ seat: 0.5 }), r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate);
  assert.deepEqual(tree.problems.map(p => p.code), ['CAM_NOT_SEATED']); assert.match(tree.problems[0].message, /^lobe: follower\.\S+ is 0\.500000 mm off the lobe at the solved pose$/);
  assert.equal(tree.cams, undefined); assert.equal(tree.joints.find(j => j.child === 'follower')!.mimic, undefined);
});

test('O24 (a) PG-5: the sweep still reports a real crash between cam and follower — a skirt under the follower\'s face, beside the lobe, hit by the nose swinging toward it and clear of it swinging away', async () => {
  // (The skirt: 4 mm wide, 10 mm down from the face, 18 mm left of the cam's centre — the nose, 14 out with r 6, reaches it near a quarter turn.)
  const doc = await camDoc({ skirt: true }), r = await evaluate(doc); assert.ok(r.ok);
  const view = await robotViewOf(doc, r.bodies, evaluate), tree = treeOf(view), camJ = tree.joints.find(j => j.child === 'cam')!;
  assert.ok(tree.joints.find(j => j.child === 'follower')!.cam, 'seated and coupled');
  // (Which way the joint turns the nose toward −X: the nose's tip after a small turn.)
  const toward = forwardKinematics(tree, { [camJ.key]: 0.1 }).motions.get('cam')!, tipX = toward.R[0] * 100 + toward.R[1] * (100 + C + RN) + toward.R[2] * 14 + toward.t[0];
  const sense = tipX < 100 ? 1 : -1;
  const hit = sweepOf(view, {}, { [camJ.key]: (sense * Math.PI) / 2 }, tree), away = sweepOf(view, {}, { [camJ.key]: (-sense * Math.PI) / 2 }, tree);
  assert.equal(hit.reply.clear, false, JSON.stringify(hit.reply).slice(0, 300)); assert.deepEqual([...hit.reply.contact!.links].sort(), ['cam', 'follower']); assert.ok(hit.reply.contact!.s > 0);
  assert.equal(away.reply.clear, true, JSON.stringify(away.reply).slice(0, 300));
});

test('O24 (a) PG-5: couplings that lead round to themselves are refused (COUPLING_CYCLE), a joint coupled twice (COUPLED_TWICE)', async () => {
  const cyc = await camDoc({ valve: true, lobe: false, back: true }), rc = await evaluate(cyc); assert.ok(rc.ok);
  const tc = await treeOfDoc(cyc, rc.bodies, evaluate);
  assert.deepEqual(tc.problems.map(p => p.code), ['COUPLING_CYCLE']);
  assert.equal(tc.joints.filter(j => j.mimic).length, 1, 'one of the two pushes kept');
  const twice = await camDoc({ valve: true, back: true }), rt = await evaluate(twice); assert.ok(rt.ok);
  const tt = await treeOfDoc(twice, rt.bodies, evaluate);
  assert.deepEqual(tt.problems.map(p => p.code), ['COUPLED_TWICE']); assert.match(tt.problems[0].message, /^back: \S+ already follows /);
});
