// O24 (a), PG-7: loops closed on their own mates — the engine's slider-crank (the piston on the rod's small end by a
// concentric-only wrist pin, a slide and a turn; in its bore by a concentric-only mate: the loop) against its closed
// form, whichever of the two the tree leaves out; the four-bar against the pin closer; the refusals.
// The oracle: the crankpin P where the crank's own motion puts it (FK of one joint), and the wrist pin W on the bore's
// line y = y_b at W.x = P.x + √(L² − (y_b − P.y)²) — the branch assembled (W ahead of P).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { evaluatePart } from '../src/engine/evaluate';
import { readStudioDoc } from '../src/engine/migrate';
import { treeOfDoc } from '../src/chat/robot';
import { forwardKinematics } from '../src/robot/fk';
import { closeLoop, closeLoops, closureOfDoc, loopCloserOf } from '../src/robot/loop';
import { isRefusal } from '../src/engine/refusal';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
type Hole = { axis: 'x' | 'z'; center: [number, number]; radius: number };
function block(w: number, d: number, h: number, holes: Hole[]): StudioDoc {
  const nodes: ModelNode[] = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] } as ModelNode, { kind: 'extrude', sketch: 0, height: h } as ModelNode];
  for (const o of holes) nodes.push({ kind: 'hole', parent: { node: nodes.length - 1, side: 'solid' }, center: o.center, radius: o.radius, ...(o.axis !== 'z' ? { axis: o.axis } : {}) } as ModelNode);
  return { ...emptyDoc(), nodes };
}
/** A slider-crank: crank r 30 about (30, 30), rod 70 (with e: its small end e off the crank's line), the bore along X at y = 30 + e. */
function sliderCrank(e: number, boreFirst = false): { doc: StudioDoc; W0: [number, number, number]; P0: [number, number, number]; L: number; yb: number } {
  const dx = Math.sqrt(70 * 70 - e * e), yb = 30 + e;
  const base = block(260, 80, 10, [{ axis: 'z', center: [30, 30], radius: 5 }]);
  const crank = block(40, 10, 5, [{ axis: 'z', center: [5, 5], radius: 5 }, { axis: 'z', center: [35, 5], radius: 2.5 }]);
  const rod = block(dx + 10, 10 + e, 5, [{ axis: 'z', center: [5, 5], radius: 2.5 }, { axis: 'z', center: [5 + dx, 5 + e], radius: 2 }]);
  const piston = block(20, 20, 20, [{ axis: 'z', center: [10, 10], radius: 2 }, { axis: 'x', center: [10, 10], radius: 3 }]);
  const cylinder = block(40, 20, 20, [{ axis: 'x', center: [10, 10], radius: 3 }]);
  const W0: [number, number, number] = [60 + dx, yb, 20];
  const pin: Mate = { id: 'wrist', kind: 'concentric', a: { part: 'rod', face: 'n3.side0' }, b: { part: 'piston', face: 'n2.side0' } };
  const bore: Mate = { id: 'bore', kind: 'concentric', a: { part: 'cylinder', face: 'n2.side0' }, b: { part: 'piston', face: 'n3.side0' } };
  const doc: StudioDoc = { ...base,
    instances: [
      { id: 'crank', name: 'crank', doc: crank, position: [25, 25, 10], rotation: [0, 0, 0] },
      { id: 'rod', name: 'rod', doc: rod, position: [55, 25, 15], rotation: [0, 0, 0] },
      { id: 'piston', name: 'piston', doc: piston, position: [W0[0] - 10, yb - 10, 20], rotation: [0, 0, 0] },
      { id: 'cylinder', name: 'cylinder', doc: cylinder, position: [200, yb - 10, 20], rotation: [0, 0, 0], grounded: true },
    ],
    mates: [
      { id: 'mainc', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'crank', face: 'n2.side0' } },
      { id: 'mainf', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'crank', face: 'n1.bottom' } },
      { id: 'pinc', kind: 'concentric', a: { part: 'crank', face: 'n3.side0' }, b: { part: 'rod', face: 'n2.side0' } },
      { id: 'pinf', kind: 'coincident', a: { part: 'crank', face: 'n1.top' }, b: { part: 'rod', face: 'n1.bottom' } },
      ...(boreFirst ? [bore, pin] : [pin, bore]),
    ] };
  return { doc, W0, P0: [60, 30, 15], L: 70, yb };
}
const at = (m: { R: Float64Array; t: Float64Array }, p: readonly number[]) => [0, 1, 2].map(i => m.R[i * 3] * p[0] + m.R[i * 3 + 1] * p[1] + m.R[i * 3 + 2] * p[2] + m.t[i]);

for (const [e, boreFirst] of [[0, false], [5, false], [5, true]] as const) {
  test(`O24 (a) PG-7: the slider-crank (e ${e}; the ${boreFirst ? 'wrist pin' : 'bore'} left out as the loop) closes on its mates at every 5° through 720°, the piston where the closed form puts it, to 1e-9 mm`, async () => {
    const s = sliderCrank(e, boreFirst), r = await evaluate(s.doc); assert.ok(r.ok);
    const tree = await treeOfDoc(s.doc, r.bodies, evaluate);
    assert.equal(tree.loops.length, 1); assert.deepEqual(tree.problems, []);
    assert.deepEqual(tree.loops[0].mates, [boreFirst ? 'wrist' : 'bore']);
    const c = loopCloserOf(s.doc, tree)!;
    assert.equal(c.freedom, 1, 'one degree of freedom: the crank');
    const crank = tree.joints.find(j => j.child === 'crank')!.key;
    // (The old closer refuses it: three turning joints only.)
    assert.throws(() => closureOfDoc(s.doc, tree, tree.loops[0]), (x: unknown) => isRefusal(x, 'NOT_ONE_LOOP', 'NO_PIN', 'NOT_PLANAR'));
    let q: Record<string, number> = {}, worst = 0, lo = Infinity, hi = -Infinity;
    for (let deg = 0; deg <= 720; deg += 5) {
      const out = closeLoops(tree, c, { [crank]: (deg * Math.PI) / 180 }, q); q = out.q;
      assert.ok(out.residualMM <= 1e-9, `${deg}°: ${out.residualMM}`);
      const fk = forwardKinematics(tree, q), P = at(fk.motions.get('crank')!, s.P0), W = at(fk.motions.get('piston')!, s.W0);
      const x = P[0] + Math.sqrt(s.L * s.L - (s.yb - P[1]) ** 2);
      worst = Math.max(worst, Math.abs(W[0] - x), Math.abs(W[1] - s.yb), Math.abs(W[2] - s.W0[2]));
      lo = Math.min(lo, W[0]); hi = Math.max(hi, W[0]);
    }
    assert.ok(worst <= 1e-9, `the piston off the closed form by ${worst} mm`);
    // (The stroke: from the closed form's extremes, 2r when e = 0.)
    if (e === 0) assert.ok(Math.abs(hi - lo - 60) < 1e-6, `stroke ${hi - lo}`);
    // (A jump straight to 200° gives the same pose as stepping there: continuation keeps the branch.)
    const jump = closeLoops(tree, c, { [crank]: (200 * Math.PI) / 180 }), walk = forwardKinematics(tree, jump.q);
    const x200 = at(walk.motions.get('crank')!, s.P0), W200 = at(walk.motions.get('piston')!, s.W0);
    assert.ok(Math.abs(W200[0] - (x200[0] + Math.sqrt(s.L * s.L - (s.yb - x200[1]) ** 2))) <= 1e-9);
  });
}

test('O24 (a) PG-7: the four-bar through the general closer equals the pin closer (RM8) to 1e-9; LOOP_PASSIVE, LOOP_MATE_UNSUPPORTED and a dead point refused', async () => {
  const read = readStudioDoc(readFileSync(join(resolve(import.meta.dirname, '..'), 'samples/robots/four-bar.bcad'), 'utf8')); assert.ok('doc' in read);
  const doc = read.doc, r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), c = loopCloserOf(doc, tree)!, pin = closureOfDoc(doc, tree, tree.loops[0]);
  assert.equal(c.freedom, 1);
  let qa: Record<string, number> = {}, qb: Record<string, number> = {};
  for (const deg of [20, 40, 60, 30, 0, -30, -60]) {
    qa = closeLoop(tree, pin, 'base~crank', (deg * Math.PI) / 180, qa).q; qb = closeLoops(tree, c, { 'base~crank': (deg * Math.PI) / 180 }, qb).q;
    for (const k of Object.keys(qa)) assert.ok(Math.abs(qa[k] - qb[k]) <= 1e-9, `${deg}° ${k}: ${qa[k]} vs ${qb[k]}`);
  }
  assert.throws(() => closeLoops(tree, c, { 'base~crank': 0.1, 'base~rocker': 0.1 }), (x: unknown) => isRefusal(x, 'LOOP_PASSIVE') && /has 1 degree of freedom: give 1 of /.test((x as Error).message));
  // (The rocker driven past where the crank can follow it: the linkage's toggle.)
  assert.throws(() => closeLoops(tree, c, { 'base~rocker': 3 }), (x: unknown) => isRefusal(x, 'DEAD_POINT', 'NO_CLOSURE') && /at base~rocker = 0\.901/.test((x as Error).message));
  // (A loop held by a mate no closure term holds: the slider-crank's bore turned into a tangent mate, its tree as before.)
  const s = sliderCrank(0), rs = await evaluate(s.doc); assert.ok(rs.ok);
  const ts = await treeOfDoc(s.doc, rs.bodies, evaluate), tangent = { ...s.doc, mates: s.doc.mates!.map(m => m.id === 'bore' ? { ...m, kind: 'tangent' as const } : m) };
  assert.throws(() => loopCloserOf(tangent, ts), (x: unknown) => isRefusal(x, 'LOOP_MATE_UNSUPPORTED') && /^\[LOOP_MATE_UNSUPPORTED\] bore \(tangent between cylinder\.n2\.side0 and piston\.n3\.side0\) closes a loop/.test((x as Error).message));
});

test('O24 (a) PG-7, the agent: forward_kinematics and set_pose close the slider-crank from its crank (the piston where the closed form puts it); a passive joint given is refused', async () => {
  const { dispatchTool } = await import('../src/chat/tools');
  const s = sliderCrank(0), r = await evaluate(s.doc); assert.ok(r.ok);
  const tree = await treeOfDoc(s.doc, r.bodies, evaluate), crank = tree.joints.find(j => j.child === 'crank')!.key, state = { doc: s.doc, bodies: r.bodies };
  const fk = await dispatchTool(state, 'forward_kinematics', { values: { [crank]: 60 } }, evaluate);
  assert.ok(!fk.isError, fk.content);
  const j = JSON.parse(fk.content);
  assert.deepEqual(j.loops.drivers, [crank]); assert.ok(j.loops.residual_mm <= 1e-9); assert.equal(j.loops.solved.length, 3);
  // (The piston's placement: moved along X only, by the closed form's x(60°) − x(0°).)
  const piston = j.links.find((l: { link: string }) => l.link === 'piston'), P = [30 + 30 * Math.cos(Math.PI / 3), 30 + 30 * Math.sin(Math.PI / 3) * Math.sign(tree.joints.find(x => x.key === crank)!.axis[2])];
  const x = P[0] + Math.sqrt(70 * 70 - (30 - P[1]) ** 2), x0 = 130;
  assert.ok(Math.abs(piston.position[0] - (s.W0[0] - 10 + (x - x0))) <= 1e-6 && Math.abs(piston.position[1] - 20) <= 1e-6, JSON.stringify(piston));
  const pose = await dispatchTool(state, 'set_pose', { values: { [crank]: 60 } }, evaluate);
  assert.ok(!pose.isError, pose.content); assert.deepEqual(JSON.parse(pose.content).links, j.links, 'set_pose in degrees: the same pose');
  const rod = tree.joints.find(k => k.child === 'rod')!.key;
  for (const [name, values] of [['forward_kinematics', { [crank]: 1, [rod]: 0.2 }], ['set_pose', { [crank]: 60, [rod]: 10 }]] as const) {
    const bad = await dispatchTool(state, name, { values }, evaluate);
    assert.ok(bad.isError, name); assert.match(bad.content, /\[LOOP_PASSIVE\] the loop has 1 degree of freedom: give 1 of /);
  }
});

// ── RS6: the slider-crank's motion closed along it ──
/** The slider-crank (e 0) with a stored motion — the crank a full turn at 90°/s, 180°/s² — and optionally a grounded block behind the piston's stroke. */
async function withMotion(block: boolean): Promise<{ doc: StudioDoc; crank: string }> {
  const s = sliderCrank(0), r = await evaluate(s.doc); assert.ok(r.ok);
  const crank = (await treeOfDoc(s.doc, r.bodies, evaluate)).joints.find(j => j.child === 'crank')!.key;
  // (The block: x 45 … 65, over the piston's height but clear of the rod beneath it (z 25 … 40).)
  const stop = { ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] } as ModelNode, { kind: 'extrude', sketch: 0, height: 15 } as ModelNode] };
  const doc: StudioDoc = { ...s.doc, robot: { version: 1, motions: [{ name: 'turn', path: { waypoints: [{}, { [crank]: 360 }], profile: 'trapezoid', limits: { default: { velocity: 90, acceleration: 180 } } } }] },
    instances: [...s.doc.instances!, ...(block ? [{ id: 'stop', name: 'stop', doc: stop, position: [45, 20, 25] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], grounded: true }] : [])] };
  return { doc, crank };
}
const pistonX = (theta: number) => { const P = [30 + 30 * Math.cos(theta), 30 + 30 * Math.sin(theta)]; return P[0] + Math.sqrt(70 * 70 - (30 - P[1]) ** 2); };

test('RS6: play_motion closes the slider-crank\'s loop at every sample — the piston where the closed form puts it; check_path sweeps the closed path in 1° chords, clear', async () => {
  const { dispatchTool } = await import('../src/chat/tools');
  const { doc, crank } = await withMotion(false), r = await evaluate(doc); assert.ok(r.ok);
  const s = { doc, bodies: r.bodies }, tree = await treeOfDoc(doc, r.bodies, evaluate), sign = Math.sign(tree.joints.find(j => j.key === crank)!.axis[2]);
  const play = JSON.parse((await dispatchTool(s, 'play_motion', { motion: 'turn', samples: 25 }, evaluate)).content);
  assert.equal(play.samples.length, 25);
  for (const f of play.samples as { values: Record<string, number>; links: { link: string; position: number[] }[] }[]) {
    const theta = (f.values[crank] * Math.PI / 180) * sign, piston = f.links.find(l => l.link === 'piston')!;
    assert.ok(Math.abs(piston.position[0] + 10 - pistonX(theta)) <= 1e-6, `${f.values[crank]}°: ${piston.position[0] + 10} vs ${pistonX(theta)}`);
  }
  const check = JSON.parse((await dispatchTool(s, 'check_path', { motion: 'turn' }, evaluate)).content);
  assert.equal(check.clear, true, JSON.stringify(check).slice(0, 400));
  assert.equal(check.loops.chords, 360); assert.ok(check.loops.chord_residual_mm < 0.01, `${check.loops.chord_residual_mm}`);
  // (A waypoint names the driver: one giving a passive loop joint is refused, as pose refuses it.)
  const rod = tree.joints.find(j => j.child === 'rod')!.key, bad = await dispatchTool(s, 'set_waypoint', { motion: 'turn', values: { [crank]: 90, [rod]: 10 } }, evaluate);
  assert.ok(bad.isError); assert.match(bad.content, /\[LOOP_PASSIVE\]/);
});

test('RS6: check_path finds the piston meeting a block behind its stroke where the closed form puts it, to the chord\'s error', async () => {
  const { dispatchTool } = await import('../src/chat/tools');
  const { doc, crank } = await withMotion(true), r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), sign = Math.sign(tree.joints.find(j => j.key === crank)!.axis[2]);
  const check = JSON.parse((await dispatchTool({ doc, bodies: r.bodies }, 'check_path', { motion: 'turn' }, evaluate)).content);
  assert.equal(check.clear, false, JSON.stringify(check).slice(0, 300)); assert.deepEqual([...check.contact.links].sort(), ['piston', 'stop']);
  // (The closed form: the piston's back face (W.x − 10) at the block's face (x 65), first on the way out: bisection on [0, π].)
  let lo = 0, hi = Math.PI; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (pistonX(m) - 10 > 65) lo = m; else hi = m; }
  const theta = Math.abs(check.contact.values[crank] * Math.PI / 180); void sign;
  assert.ok(Math.abs(theta - lo) < 1e-3, `contact at ${theta} rad, the closed form ${lo}`);
});
