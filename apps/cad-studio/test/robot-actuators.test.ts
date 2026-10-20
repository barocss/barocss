import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type PartInstance, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { solveDoc } from '../src/chat/assembly';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { coordinates, linkBodies, massMatrix, rnea, type LinkBody } from '../src/robot/dynamics';
import type { JointTree } from '../src/robot/joints';
import { MOTOR_FIELDS, MOTORS, REDUCER_FIELDS, REDUCERS, si, sizeActuators, type Check, type Motor, type Reducer, type Value } from '../src/robot/actuators';

// RD3 (O22): actuator sizing. The checks against their closed forms on a joint with no gravity load (a trapezoid: the
// motor torque constant on each segment, so every integral is exact), the dwell's share of the RMS exactly, the choice
// against an independent enumeration of the lighter pairs, and every value's source.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const RPM = 60 / (2 * Math.PI);
async function robotOf(doc: StudioDoc) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, own = new Map([['base', r.bodies]]);
  for (const i of solved.instances ?? []) { const e = await evaluate(i.doc); assert.ok(e.ok); own.set(i.id, e.bodies); }
  const bodies = linkBodies(tree, p => { if (p === 'base') return { doc, bodies: r.bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances!.find(x => x.id === p)!; return { doc: i.doc, bodies: own.get(p)!, position: i.position, rotation: i.rotation }; });
  return { doc, tree, bodies, evaluated: r.bodies };
}
const byName = (cs: readonly Check[], name: string) => { const c = cs.find(x => x.name === name); assert.ok(c, name); return c!; };
const near = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(b));

/** The closed form of the cycle out and back on a trapezoid, a joint with load inertia J and no gravity. */
function closedForm(J: number, d: number, v: number, a: number, dwell: number, m: Motor, r: Reducer) {
  const N = si(r.ratio), eta = si(r.efficiency), Jd = si(m.rotorInertia) + si(r.inputInertia), Tf = si(m.noLoadCurrent) * si(m.torqueConstant);
  const ta = v / a, tv = d / v - ta, T = d / v + ta, Tc = 2 * T + 2 * dwell, A = J * a / (N * eta) + Jd * N * a;
  // (Out: +A + T_f on the ramp up, T_f cruising, −A + T_f on the ramp down; back the same mirrored.)
  const rms = Math.sqrt(2 * (ta * (A + Tf) ** 2 + tv * Tf * Tf + ta * (A - Tf) ** 2) / Tc), nm = N * v * RPM;
  const Tav = J * a * Math.cbrt(v * ta / d), nav = N * RPM * 2 * d / Tc, life = si(r.ratedLife) * (si(r.ratedTorque) / Tav) ** 3 * (si(r.ratedInputSpeed) / nav);
  return { T, Tc, rms, nm, over: A + Tf - (si(m.noLoadSpeed) - nm) / si(m.speedTorqueGradient), ratio: J / (N * N) / Jd, peak: J * a, Tav, nav, life };
}

test('the checks against their closed forms: a joint with no gravity load on a trapezoid, out and back with dwells (to 1e-9)', async () => {
  const doc = JSON.parse(readFileSync(join(CASES, 'revolute', 'case.json'), 'utf8')).input.document as StudioDoc, { tree, bodies } = await robotOf(doc), key = coordinates(tree)[0];
  const J = massMatrix(tree, bodies, {}).M[0][0], d = 2, v = 1.5, a = 4, dwell = 0.5;
  for (const r of [REDUCERS[0], REDUCERS.find(x => x.name === 'CSG-20-100-2A-GR-BB-LW')!]) {
    const s = sizeActuators(tree, bodies, {}, { [key]: d }, 'trapezoid', () => ({ velocity: v, acceleration: a }), { dwell, motors: MOTORS, reducers: [r], life: 1 });
    const cf = closedForm(J, d, v, a, dwell, MOTORS[0], r), j = s.joints[0];
    assert.ok(near(s.moveS, cf.T, 1e-12) && near(s.cycleS, cf.Tc, 1e-12), `${s.moveS} ${s.cycleS}`);
    assert.ok(j.choice && j.choice.reducer === r.id, JSON.stringify(j.rejected));
    const c = j.checks;
    assert.ok(near(byName(c, 'motor RMS torque').value, cf.rms), `RMS ${byName(c, 'motor RMS torque').value} vs ${cf.rms}`);
    assert.ok(near(byName(c, 'motor torque–speed line').value, cf.over), `line ${byName(c, 'motor torque–speed line').value} vs ${cf.over}`);
    assert.ok(near(byName(c, 'motor speed').value, cf.nm) && near(byName(c, 'reducer input speed').value, cf.nm));
    assert.ok(near(byName(c, 'inertia ratio').value, cf.ratio));
    assert.ok(near(byName(c, 'reducer repeated peak torque').value, cf.peak));
    assert.ok(near(byName(c, 'reducer average torque').value, cf.Tav), `T_av ${byName(c, 'reducer average torque').value} vs ${cf.Tav}`);
    assert.ok(near(byName(c, 'reducer average input speed').value, cf.nav));
    assert.ok(near(byName(c, 'reducer life L10').value, cf.life), `life ${byName(c, 'reducer life L10').value} vs ${cf.life}`);
    // (The limits are the pages' values, in SI.)
    assert.equal(byName(c, 'motor RMS torque').limit, 0.134); assert.equal(byName(c, 'reducer repeated peak torque').limit, si(r.repeatedPeakTorque));
    assert.equal(byName(c, 'motor RMS torque').limitSource, 'page'); assert.equal(byName(c, 'reducer input speed').limitSource, 'estimate'); assert.equal(byName(c, 'inertia ratio').limitSource, 'rule');
  }
  // An S-curve: the RMS and cube mean are no longer piecewise constant; Simpson over 256 samples a segment, against a
  // dense independent sum (the motor torque from the RNEA at 20 000 points a segment, trapezoid rule).
  const jk = 40, s = sizeActuators(tree, bodies, {}, { [key]: d }, 's-curve', () => ({ velocity: v, acceleration: a, jerk: jk }), { reducers: [REDUCERS[2]] }), c = s.joints[0].checks;
  assert.ok(s.joints[0].choice, JSON.stringify(s.joints[0].rejected));
  const r = REDUCERS[2], m = MOTORS[0], N = si(r.ratio), eta = si(r.efficiency), Jd = si(m.rotorInertia) + si(r.inputInertia), Tf = si(m.noLoadCurrent) * si(m.torqueConstant);
  let sq = 0, peak = 0;
  for (const dir of [1, -1]) {
    const { sCurve, onSegment } = await import('../src/robot/profile'), p = sCurve(d, v, a, jk);
    for (const seg of p.segments) {
      const n = 20000, h = (seg.t1 - seg.t0) / n;
      for (let i = 0; i <= n; i++) {
        const x = onSegment(seg, seg.t0 + i * h), q = dir > 0 ? x.s : d - x.s, qd = dir * x.v, qdd = dir * x.a;
        const tau = rnea(tree, bodies, { [key]: q }, { [key]: qd }, { [key]: qdd })[key], tm = tau / (N * eta) + Jd * N * qdd + Tf * dir;
        sq += (i === 0 || i === n ? 0.5 : 1) * h * tm * tm; peak = Math.max(peak, Math.abs(tm));
      }
    }
  }
  const rmsDense = Math.sqrt(sq / s.cycleS);
  assert.ok(near(byName(c, 'motor RMS torque').value, rmsDense, 1e-7), `S-curve RMS ${byName(c, 'motor RMS torque').value} vs ${rmsDense}`);
});

test('the dwell\'s share of the RMS is exact: RMS² T_c grows by dwell × (τ_hold(q1)² + τ_hold(q0)²)/(N η)² on a gravity-loaded joint', async () => {
  const b = await build([['run_command', { command: 'box', values: { w: 20, d: 20, h: 80, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 20 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 60 } }]]);
  const inst: PartInstance[] = [{ id: 'l1', name: 'l1', doc: b, position: [0, 20, 40], rotation: [0, 0, 0] }];
  const mates: Mate[] = [{ id: 'c1', kind: 'concentric', a: { part: 'base', face: 'n3.side0' }, b: { part: 'l1', face: 'n2.side0' } }, { id: 'f1', kind: 'coincident', a: { part: 'base', face: 'n1.side2' }, b: { part: 'l1', face: 'n1.side0' } }];
  const { tree, bodies } = await robotOf({ ...b, instances: inst, mates }), key = coordinates(tree)[0], to = { [key]: 0.8 }, lim = () => ({ velocity: 1, acceleration: 3 });
  const zero = { [key]: 0 }, h1 = rnea(tree, bodies, to, zero, zero)[key], h0 = rnea(tree, bodies, {}, zero, zero)[key];
  assert.ok(Math.abs(h1) > 1e-4 && Math.abs(h0 - h1) > 1e-6, `a gravity load: ${h0} ${h1}`);
  const r = REDUCERS[0], N = si(r.ratio), eta = si(r.efficiency), opts = { reducers: [r], inertiaRatio: 1e9 };
  const s0 = sizeActuators(tree, bodies, {}, to, 'trapezoid', lim, opts), s1 = sizeActuators(tree, bodies, {}, to, 'trapezoid', lim, { ...opts, dwell: 2 });
  const rms = (s: typeof s0) => byName(s.joints[0].checks, 'motor RMS torque').value;
  const lhs = rms(s1) ** 2 * s1.cycleS - rms(s0) ** 2 * s0.cycleS, rhs = 2 * (h1 * h1 + h0 * h0) / (N * eta) ** 2;
  assert.ok(near(lhs, rhs, 1e-9), `${lhs} vs ${rhs}`);
  // (The dwell adds no speed: the cube mean is the same, the average input speed falls by the cycle's growth.)
  assert.ok(near(byName(s1.joints[0].checks, 'reducer average torque').value, byName(s0.joints[0].checks, 'reducer average torque').value));
  assert.ok(near(byName(s1.joints[0].checks, 'reducer average input speed').value * s1.cycleS, byName(s0.joints[0].checks, 'reducer average input speed').value * s0.cycleS));
});
async function build(calls: [string, object][]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }

/** A heavy one-joint arm (no CAD: 10 kg, its centre 300 mm out on a horizontal axis) and a stronger motor for it, every
 * value of which is a test estimate: so that the small reducers fail and the choice is not the first. */
function heavyArm(): { tree: JointTree; bodies: Map<string, LinkBody>; motor: Motor } {
  const tree: JointTree = { version: 1, base: 'L0', links: [{ id: 'L0', part: 'L0', name: 'L0' }, { id: 'L1', part: 'L1', name: 'L1' }], joints: [{ key: 'j1', type: 'continuous', parent: 'L0', child: 'L1', axis: [0, 1, 0], origin: [0, 0, 0], mates: [] }], loops: [], couplings: [], problems: [], notes: [] };
  const bodies = new Map<string, LinkBody>([['L0', { massKg: 1, com: [0, 0, 0], I: [1, 0, 0, 0, 1, 0, 0, 0, 1] }], ['L1', { massKg: 10, com: [300, 0, 0], I: [0.02, 0, 0, 0, 0.1, 0, 0, 0, 0.1] }]]);
  const e = (v: number, unit: string): Value => ({ v, unit, src: { estimate: 'a test motor: four times the 608131 page\'s torques, for the selection test only' } }), m = MOTORS[0];
  const motor: Motor = { ...m, id: 'test-strong', name: 'test motor', nominalTorque: e(4 * m.nominalTorque.v, 'mNm'), stallTorque: e(4 * m.stallTorque.v, 'mNm'), speedTorqueGradient: e(m.speedTorqueGradient.v / 4, 'rpm/mNm'), torqueConstant: e(4 * m.torqueConstant.v, 'mNm/A'), mass: e(450, 'g') };
  return { tree, bodies, motor };
}

test('the choice is the lightest pair that passes: every lighter pair fails a check of its own, by an enumeration one pair at a time', () => {
  const { tree, bodies, motor } = heavyArm(), to = { j1: 1.5 }, lim = () => ({ velocity: 1, acceleration: 4 }), opts = { life: 20000, dwell: 0.5, motors: [motor] };
  const all = sizeActuators(tree, bodies, {}, to, 'trapezoid', lim, opts), j = all.joints[0];
  assert.ok(j.choice, JSON.stringify(j.rejected));
  assert.equal(j.candidates, REDUCERS.length);
  assert.equal(j.feasible + Object.entries(j.rejected).filter(([k]) => !k.endsWith('(refined)')).reduce((s, [, n]) => s + n, 0), j.candidates);
  const chosen = REDUCERS.find(r => r.id === j.choice!.reducer)!, mass = (r: Reducer) => si(motor.mass) + si(r.mass);
  const lighter = REDUCERS.filter(r => mass(r) < mass(chosen));
  assert.ok(lighter.length >= 3 && Object.keys(j.rejected).length > 0, `${chosen.name}: ${lighter.length} lighter, ${JSON.stringify(j.rejected)}`);
  for (const r of REDUCERS) {
    const one = sizeActuators(tree, bodies, {}, to, 'trapezoid', lim, { ...opts, reducers: [r] }).joints[0];
    if (mass(r) < mass(chosen)) assert.equal(one.choice, null, `${r.name} is lighter and passes`);
    if (r === chosen) assert.ok(one.choice && one.checks.every(c => c.ok));
  }
  // (The test motor's values are estimates: they are said so.)
  assert.ok(j.estimates.includes('motor.nominalTorque') && j.estimates.includes('reducer.efficiency'), j.estimates.join());
  // (A longer life required rejects at least as many.)
  assert.ok(sizeActuators(tree, bodies, {}, to, 'trapezoid', lim, { ...opts, life: 2e7 }).joints[0].feasible <= j.feasible);
});

test('every catalogue value has its source: a product page (URL, the date read, its label) or a flagged estimate with why', () => {
  for (const m of MOTORS) for (const f of MOTOR_FIELDS) assertSourced(m[f], `${m.id}.${f}`);
  for (const r of REDUCERS) for (const f of REDUCER_FIELDS) assertSourced(r[f], `${r.id}.${f}`);
  // (The pages' values that the HTML gave: the motor's every field; the reducers' torques, speed and mass.)
  assert.ok(MOTOR_FIELDS.every(f => 'page' in MOTORS[0][f].src));
  for (const r of REDUCERS) {
    for (const f of ['ratio', 'ratedTorque', 'averageTorqueLimit', 'repeatedPeakTorque', 'momentaryPeakTorque', 'averageInputSpeed', 'mass'] as const) assert.ok('page' in r[f].src && (r[f].src as { page: string }).page.endsWith(r.name.toLowerCase()), `${r.id}.${f}`);
    for (const f of ['maxInputSpeed', 'inputInertia', 'efficiency', 'ratedInputSpeed', 'ratedLife'] as const) assert.ok('estimate' in r[f].src, `${r.id}.${f} is flagged`);
    // (The limits in the pages' order: rated ≤ average ≤ repeated peak ≤ momentary peak.)
    assert.ok(si(r.ratedTorque) <= si(r.averageTorqueLimit) && si(r.averageTorqueLimit) <= si(r.repeatedPeakTorque) && si(r.repeatedPeakTorque) <= si(r.momentaryPeakTorque), r.id);
  }
  // (The motor's page values hold together: k_t × stall current ≈ stall torque, the line through no-load speed and stall.)
  const m = MOTORS[0];
  assert.ok(Math.abs(si(m.torqueConstant) * 40.3 - si(m.stallTorque)) / si(m.stallTorque) < 0.01);
  assert.ok(Math.abs(si(m.noLoadSpeed) / si(m.speedTorqueGradient) - si(m.stallTorque)) / si(m.stallTorque) < 0.03);
});
function assertSourced(x: Value, what: string) {
  assert.ok(Number.isFinite(x.v) && typeof x.unit === 'string', what);
  const s = x.src as Record<string, string>;
  if ('page' in s) { assert.match(s.page, /^https:\/\/www\.(maxongroup\.com|harmonicdrive\.net)\//, what); assert.equal(s.read, '2026-10-20', what); assert.ok(s.label.length > 2, what); }
  else assert.ok((s.estimate ?? s.derived ?? '').length > 20, `${what}: why`);
  si(x);
}

test('the size_actuators tool; refusals (a value with no source, an unknown unit, a slide); the conformance case (rm/size-1r: the closed forms)', async () => {
  const doc = JSON.parse(readFileSync(join(CASES, 'revolute', 'case.json'), 'utf8')).input.document as StudioDoc, { tree, bodies, evaluated } = await robotOf(doc), key = coordinates(tree)[0];
  const args = { to: { [key]: 2 }, profile: 'trapezoid', limits: { velocity: 1.5, acceleration: 4 }, dwell_s: 0.5, life_h: 1 };
  const out = await dispatchTool({ doc, bodies: evaluated }, 'size_actuators', args, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed, out.content);
  const joint = j.joints[0];
  assert.ok(joint.choice && joint.checks.every((c: { ok: boolean }) => c.ok), out.content);
  assert.ok(joint.sources.length === 2 && joint.sources.every((s: { page: string; read: string; labels: object }) => s.read === '2026-10-20' && Object.keys(s.labels).length >= 7), JSON.stringify(joint.sources));
  assert.ok(Object.keys(joint.estimates).length === 5 && j.pending_worked_examples.length === 2 && /momentary/.test(j.model), JSON.stringify(joint.estimates));
  const bad = (extra: object) => dispatchTool({ doc, bodies: evaluated }, 'size_actuators', { ...args, ...extra }, evaluate);
  const noSrc = { ...MOTORS[0], id: 'x', nominalTorque: { v: 1, unit: 'Nm' } };
  assert.match((await bad({ motors: [noSrc] })).content, /needs its source/);
  assert.match((await bad({ motors: [{ ...MOTORS[0], id: 'y', mass: { v: 1, unit: 'lb', src: { estimate: 'x' } } }] })).content, /unit of/);
  assert.match((await bad({ only_given: true })).content, /No motor or no reducer/);
  assert.match((await bad({ limits: undefined })).content, /none is assumed/);
  // (Given entries alone: the chosen pair is the given one.)
  const own = await bad({ only_given: true, motors: [{ ...MOTORS[0], id: 'mine' }], reducers: [{ ...REDUCERS[5], id: 'mine-r' }] });
  assert.ok(!own.isError && JSON.parse(own.content).joints[0].choice.motor === 'mine', own.content);
  const slide = await robotOf(JSON.parse(readFileSync(join(CASES, 'prismatic', 'case.json'), 'utf8')).input.document as StudioDoc), sk = coordinates(slide.tree)[0];
  const sl = sizeActuators(slide.tree, slide.bodies, {}, { [sk]: 10 }, 'trapezoid', () => ({ velocity: 50, acceleration: 200 }));
  assert.ok(sl.joints.length === 0 && /a slide/.test(sl.skipped[0].why), JSON.stringify(sl.skipped));
  const dir = join(CASES, 'size-1r'), J = massMatrix(tree, bodies, {}).M[0][0], r = REDUCERS.find(x => x.id === joint.choice.reducer)!, cf = closedForm(J, 2, 1.5, 4, 0.5, MOTORS[0], r);
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'size-1r', step: 'RD3', note: 'The one-joint revolute case (vertical axis: no gravity load) moved 2 rad and back on a trapezoid (1.5 rad/s, 4 rad/s²) with 0.5 s dwells, life 1 h required. The lightest pair from the built-in catalogue; its checks by the closed forms of the cycle (the load inertia J = M₁₁): motor torque A ± T_f on the ramps, T_f cruising, A = J a/(N η) + (J_m + J_in) N a; RMS over the cycle; T_av = J a (v t_a/d)^⅓; n_av = N·2d/T_c; L10 = L_n (T_r/T_av)³ (n_r/n_av); the line check A + T_f − (n_0 − N v)/(Δn/ΔM).', input: { document: doc, ...args }, expect: { reducer: r.id, motor: MOTORS[0].id, load_inertia_kg_m2: J, checks: { 'motor RMS torque': cf.rms, 'motor torque–speed line': cf.over, 'motor speed': cf.nm, 'inertia ratio': cf.ratio, 'reducer repeated peak torque': cf.peak, 'reducer average torque': cf.Tav, 'reducer average input speed': cf.nav, 'reducer life L10': cf.life }, tol_rel: 1e-9 } }, null, 1) + '\n');
  }
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
  assert.equal(joint.choice.reducer, c.expect.reducer);
  for (const [name, v] of Object.entries(c.expect.checks as Record<string, number>)) { const got = joint.checks.find((x: { name: string }) => x.name === name).value; assert.ok(near(got, v, 1e-9), `${name}: ${got} vs ${v}`); }
});

test('O75: a stated stop — the reducer\'s momentary peak torque checked against J·a on the one-joint case (to 1e-9); absent, no such check; a stop past every pair\'s limit leaves none feasible', async () => {
  const doc = JSON.parse(readFileSync(join(CASES, 'revolute', 'case.json'), 'utf8')).input.document as StudioDoc, { tree, bodies } = await robotOf(doc), key = coordinates(tree)[0];
  const J = massMatrix(tree, bodies, {}).M[0][0], lim = () => ({ velocity: 1.5, acceleration: 4 }), r = REDUCERS[0];
  const plain = sizeActuators(tree, bodies, {}, { [key]: 2 }, 'trapezoid', lim, { reducers: [r] });
  assert.ok(!plain.joints[0].checks.some(c => c.name === 'reducer momentary peak torque'), 'no stop stated: not checked');
  const s = sizeActuators(tree, bodies, {}, { [key]: 2 }, 'trapezoid', lim, { reducers: [r], estop: 200 }), c = byName(s.joints[0].checks, 'reducer momentary peak torque');
  // (One joint, no gravity load: its torque at a stop is J·a — no speed term about its fixed axis.)
  assert.ok(near(c.value, J * 200), `${c.value} vs ${J * 200}`); assert.equal(c.limit, si(r.momentaryPeakTorque)); assert.equal(c.limitSource, 'page');
  const huge = sizeActuators(tree, bodies, {}, { [key]: 2 }, 'trapezoid', lim, { reducers: [r], estop: 2 * si(r.momentaryPeakTorque) / J });
  assert.equal(huge.joints[0].choice, null); assert.ok(huge.joints[0].rejected['reducer momentary peak torque'] > 0, JSON.stringify(huge.joints[0].rejected));
});

test('O75: sizing coupled — each chosen pair a point mass at its joint on the parent link; the shoulder\'s load inertia grows by M·d² of the elbow\'s; the choices settled and a fixed point', async () => {
  const { sizeCoupled, withPointMass } = await import('../src/robot/actuators');
  const doc = JSON.parse(readFileSync(join(CASES, 'chain-2r', 'case.json'), 'utf8')).input.document as StudioDoc, { tree, bodies } = await robotOf(doc), keys = coordinates(tree);
  const lim = () => ({ velocity: 3, acceleration: 20 }), to = { [keys[0]]: 1, [keys[1]]: -1 };
  const c = sizeCoupled(tree, bodies, {}, to, 'trapezoid', lim);
  assert.ok(c.settled && c.rounds <= 6, JSON.stringify([c.rounds, c.settled]));
  const elbow = tree.joints.find(j => j.key === keys[1])!, onElbow = c.added.find(a => a.joint === keys[1])!;
  assert.equal(onElbow.link, elbow.parent);
  // (The shoulder's diagonal of M grows by the elbow pair's mass times its axis' squared distance from the shoulder's, m².)
  const sh = tree.joints.find(j => j.key === keys[0])!, d = Math.hypot(elbow.origin[0] - sh.origin[0], elbow.origin[1] - sh.origin[1]) / 1000;
  const M0 = massMatrix(tree, bodies, {}).M[0][0], M1 = massMatrix(tree, c.bodies, {}).M[0][0];
  assert.ok(near(M1 - M0, onElbow.massKg * d * d, 1e-9), `${M1 - M0} vs ${onElbow.massKg * d * d}`);
  // (A fixed point: sized once more on the coupled bodies, the same choices.)
  const again = sizeActuators(tree, c.bodies, {}, to, 'trapezoid', lim);
  assert.deepEqual(again.joints.map(j => j.choice?.reducer), c.sizing.joints.map(j => j.choice?.reducer));
  // (The point mass by the parallel-axis rule: a mass at the centre adds nothing to I.)
  const b0 = bodies.get(elbow.parent)!, same = withPointMass(b0, 1, b0.com);
  assert.ok(same.I.every((v, i) => Math.abs(v - b0.I[i]) <= 1e-15) && near(same.massKg, b0.massKg + 1));
});
