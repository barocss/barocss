import { readDuty } from '@barocss/cad-model/robot/native/duty';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import type { Mate } from '@barocss/cad-model/assembly/mates';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { materialIdOf, withLook } from '@barocss/cad-model/app/bodies';
import { materialOf } from '@barocss/cad-model/library/materials';
import { solveDoc } from '@barocss/cad-model/assembly/edit';
import { nativeRobotCheckOfDoc, robotOfDoc, treeOfDoc } from '@barocss/cad-model/chat/robot';
import { linkBodies } from '@barocss/cad-model/robot/dynamics';
import { sizeActuators } from '@barocss/cad-model/robot/actuators';
import { jointSettingsOut, jointValuesOut } from '@barocss/cad-model/robot/units';
import { dutyJson } from '@barocss/cad-model/robot/reports';
import type { NativeDuty } from '@barocss/cad-model/robot/native/duty';
import type { HarnessReport } from '@barocss/cad-model/robot/native/harness';

// RD9 (O46, O47): the design-check harness v1, without FEA. A 3R arm (base, three 20 × 20 × 80 aluminium blocks on Z, Y,
// Y, a 60 mm steel cube locked on the last) from its mates, with limits and ratings: on a clean duty every margin is
// above 0; each seeded defect gives a negative margin at its own check and only there; what cannot be checked is
// unknown, never a pass. The model's consistency and a closed form; the numbers RD2's and RD3's own; the CLI.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const DIR = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rd/arm-3r');
async function build(calls: [string, object][]): Promise<StudioDoc> { let s: ChatState = { doc: emptyDoc(), bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s.doc; }
async function bodiesOf(doc: StudioDoc) { const e = await evaluate(doc); assert.ok(e.ok, JSON.stringify(!e.ok && e)); return e.bodies; }
async function made(doc: StudioDoc, material: string) { return withLook(doc, (await bodiesOf(doc))[0], { material }); }
export const RATINGS = { 'base~l1': { lower: -2.5, upper: 2.5, effort: 40, velocity: 3 }, 'l1~l2': { lower: -2, upper: 2, effort: 40, velocity: 3 }, 'l2~l3': { lower: -2.5, upper: 2.5, effort: 40, velocity: 3 } };
const storedRatings = Object.fromEntries(Object.entries(RATINGS).map(([key, value]) => [key, jointSettingsOut('revolute', value)]));
/** The arm-3r fixture, built from mates as a user would. */
async function arm3r(): Promise<StudioDoc> {
  const link = await made(await build([['run_command', { command: 'box', values: { w: 20, d: 20, h: 80, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }],
    ['run_command', { command: 'hole', faces: ['n1.bottom'], values: { type: 'blind', d: 8, depth: 8, x: 10, y: 10 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 20 } }], ['run_command', { command: 'hole', faces: ['n1.side2'], values: { d: 8, x: 10, y: 60 } }]]), 'al6061');
  const base = await made(await build([['run_command', { command: 'box', values: { w: 100, d: 100, h: 10, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 50, y: 50 } }]]), 'al6061');
  const payload = await made(await build([['run_command', { command: 'box', values: { w: 60, d: 60, h: 60, x: 0, y: 0, z: 0 } }]]), 'steel');
  const ids = ['l1', 'l2', 'l3'], axes = ['z', 'y', 'y'], mates: Mate[] = [];
  const instances: PartInstance[] = ids.map((id, k) => ({ id, name: `link ${k + 1}`, doc: link, position: [40, 40 + 20 * k, 10 + 50 * k], rotation: [0, 0, 0] }));
  instances.push({ id: 'payload', name: 'payload', doc: payload, position: [20, 60, 190], rotation: [0, 0, 0] });
  ids.forEach((id, k) => {
    const p = k ? ids[k - 1] : 'base';
    if (axes[k] === 'z') mates.push({ id: `c${k + 1}`, kind: 'concentric', a: { part: p, face: 'n2.side0' }, b: { part: id, face: 'n3.side0' } }, { id: `f${k + 1}`, kind: 'coincident', a: { part: p, face: 'n1.top' }, b: { part: id, face: 'n1.bottom' } });
    else mates.push({ id: `c${k + 1}`, kind: 'concentric', a: { part: p, face: 'n5.side0' }, b: { part: id, face: 'n4.side0' } }, { id: `f${k + 1}`, kind: 'coincident', a: { part: p, face: 'n1.side2' }, b: { part: id, face: 'n1.side0' } });
  });
  mates.push({ id: 'lock', kind: 'lock', a: { part: 'l3', face: '' }, b: { part: 'payload', face: '' }, rel: { position: [-20, -20, 80], rotation: [0, 0, 0] } });
  return { ...base, instances, mates, robot: { version: 1, joints: storedRatings } };
}
const P1 = { 'base~l1': 1, 'l1~l2': 0.9, 'l2~l3': 0.6 }, P2 = { 'base~l1': -0.8, 'l1~l2': -1, 'l2~l3': -0.7 };
export const DUTY: NativeDuty = { moves: [{ from: {}, to: P1, profile: 'trapezoid', limits: { velocity: 1, acceleration: 3 }, dwell_s: 0.5 }, { from: P1, to: P2, profile: 'trapezoid', limits: { velocity: 1, acceleration: 3 }, dwell_s: 0.5 }], life_h: 20000 };
async function frozen(): Promise<StudioDoc> {
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, 'robot.bcad'), JSON.stringify(await arm3r()));
    writeFileSync(join(DIR, 'duty.json'), JSON.stringify(DUTY, null, 1) + '\n');
    writeFileSync(join(DIR, 'case.json'), JSON.stringify({ case: 'arm-3r', step: 'RD9', note: 'A 3R arm (axes Z, Y, Y) of three 20 x 20 x 80 aluminium blocks on a base plate, a 60 mm steel cube locked on the last, from its mates, with limits and ratings (robot.joints). duty.json: two moves, out and back, 0.5 s dwells, 20000 h life. RD9 checks it (cad-cli robot-check); RD10 sizes it.' }, null, 1) + '\n');
  }
  const r = readStudioDoc(readFileSync(join(DIR, 'robot.bcad'), 'utf8')); assert.ok('doc' in r); return r.doc;
}
const check = async (doc: StudioDoc, duty: NativeDuty): Promise<HarnessReport> => nativeRobotCheckOfDoc(doc, await bodiesOf(doc), evaluate, duty);
const failing = (r: HarnessReport) => [...new Set(r.margins.filter(m => !m.ok).map(m => `${m.check}${m.joint ? ` ${m.joint}` : ''}`))].sort();
const rated = (doc: StudioDoc, key: string, patch: import('@barocss/cad-model/robot/joints').JointSettings): StudioDoc => ({ ...doc, robot: { version: 1, joints: { ...doc.robot!.joints, [key]: { ...doc.robot!.joints![key], ...jointSettingsOut('revolute', patch) } } } });

test('the clean duty: every margin above 0, each listed — the actuators, the joints, the sweep — the model consistent; a rerun byte-identical', async () => {
  const doc = await frozen(), r = await check(doc, DUTY);
  assert.equal(r.ok, true, JSON.stringify({ least: r.least, unknowns: r.unknowns, failing: failing(r) }));
  const per = (c: string) => r.margins.filter(m => m.check === c).length;
  // (Two moves: three joints' ranges at both ends, velocity and effort; each joint's nine RD3 checks; one sweep a move.)
  assert.deepEqual([per('joint range'), per('joint velocity'), per('joint effort'), per('motor RMS torque'), per('reducer life L10'), per('sweep')], [12, 6, 6, 6, 6, 2]);
  assert.equal(r.margins.length, 12 + 6 + 6 + 6 * 9 + 2);
  assert.ok(r.consistency.length === 8 && r.consistency.every(c => c.ok), JSON.stringify(r.consistency));
  assert.deepEqual(r.unknowns, []); assert.ok(r.least!.margin > 0);
  console.log(`RD9: ${r.margins.length} margins, least ${r.least!.check} ${r.least!.joint ?? ''} ${r.least!.margin}; actuators ${JSON.stringify(Object.fromEntries(Object.entries(r.actuators).map(([k, v]) => [k, v[0].reducer])))}`);
  assert.equal(JSON.stringify(await check(doc, DUTY)), JSON.stringify(r), 'a rerun differs');
});

test('seeded defects: each a negative margin at its own check and only there; a missing rating unknown, never a pass', async () => {
  const doc = await frozen();
  // (A move past a limit: base~l1 to 2.7, its upper 2.5.)
  const past = await check(doc, { ...DUTY, moves: [{ ...DUTY.moves[0], to: { ...P1, 'base~l1': 2.7 } }] });
  assert.deepEqual(failing(past), ['joint range base~l1']); assert.ok(past.margins.find(m => m.check === 'joint range' && !m.ok)!.margin < 0);
  // (A velocity rating below the profile's peak; an effort rating below the peak torque.)
  assert.deepEqual(failing(await check(rated(doc, 'l1~l2', { velocity: 0.5 }), DUTY)), ['joint velocity l1~l2']);
  assert.deepEqual(failing(await check(rated(doc, 'l1~l2', { effort: 1 }), DUTY)), ['joint effort l1~l2']);
  // (A colliding move: the payload into the base.)
  const hit = await check(doc, { ...DUTY, moves: [{ ...DUTY.moves[0], to: { 'l1~l2': 1.2, 'l2~l3': 1.5 } }] });
  assert.deepEqual(failing(hit), ['sweep']); assert.match(hit.margins.find(m => m.check === 'sweep')!.detail!, /^contact base–payload at s /);
  // (An undersized actuator given: a fast duty (6 rad/s cruise, 60 rad/s², the ratings raised to allow it) with the shoulder on the 100:1
  // reducer — its motor would run past its torque–speed line — the others on 50:1: the failing RD3 checks the shoulder's.)
  const fastDoc: StudioDoc = { ...doc, robot: { version: 1, joints: Object.fromEntries(Object.entries(RATINGS).map(([k, v]) => [k, jointSettingsOut('revolute', { ...v, velocity: 10 })])) } };
  const fast: NativeDuty = { ...DUTY, moves: DUTY.moves.map(m => ({ ...m, limits: { velocity: 6, acceleration: 60 } })) };
  const on = (reducer: string) => ({ motor: 'maxon-608131', reducer: `hd-csg-14-${reducer}-2a-r-bb-lw` });
  const small = await check(fastDoc, { ...fast, actuators: { 'base~l1': on('50'), 'l1~l2': on('100'), 'l2~l3': on('50') } });
  const f = failing(small);
  assert.ok(f.length >= 1 && f.every(x => x.endsWith(' l1~l2') && !x.startsWith('joint ')), JSON.stringify(f));
  assert.deepEqual(failing(await check(fastDoc, { ...fast, actuators: { 'base~l1': on('50'), 'l1~l2': on('50'), 'l2~l3': on('50') } })), [], 'on 50:1 the shoulder is clean');
  // (A missing rating: unknown, the report not ok, no margin made up for it.)
  const { effort: _e, ...noEffort } = RATINGS['l2~l3']; void _e;
  const missing = await check({ ...doc, robot: { version: 1, joints: { ...storedRatings, 'l2~l3': jointSettingsOut('revolute', noEffort) } } }, DUTY);
  assert.equal(missing.ok, false); assert.deepEqual(failing(missing), []);
  assert.deepEqual(missing.unknowns.map(u => [u.check, u.joint, u.code]), [['joint effort', 'l2~l3', 'LIMITS_MISSING'], ['joint effort', 'l2~l3', 'LIMITS_MISSING']]);
  // (An actuator not in the catalogue: unknown.)
  const none = await check(doc, { ...DUTY, actuators: { 'base~l1': { motor: 'maxon-608131', reducer: 'nope' } } });
  assert.ok(none.unknowns.some(u => u.code === 'NO_ACTUATOR' && /no reducer nope/.test(u.why)) && none.unknowns.some(u => u.code === 'NO_ACTUATOR' && /no actuator given for l1~l2/.test(u.why)));
});

test('closed form: the holding torques at the shoulder-horizontal pose, g Σ m dz from the parts\' own masses and centres, to 1e-9; the harness\'s numbers RD2\'s and RD3\'s own', async () => {
  const doc = await frozen(), e = await bodiesOf(doc), tree = await treeOfDoc(doc, e, evaluate);
  // (At q = 0 each part's mass and centre (world); turned π/2 about a Y axis, a centre dz above it is dz out along X.)
  const parts: { id: string; m: number; c: number[] }[] = [];
  for (const inst of solveDoc(doc).doc.instances!) {
    // (Mass by volume × density, unrounded: mass_properties gives grams to 3 decimals.)
    const b = await bodiesOf(inst.doc), mp = b.map(x => ({ mass_g: x.volume! * materialOf(materialIdOf(inst.doc, x)).density / 1000 })), vol = b.reduce((s, x) => s + x.volume!, 0);
    const c = [0, 1, 2].map(i => b.reduce((s, x) => s + x.volume! * x.centroid![i], 0) / vol);
    parts.push({ id: inst.id, m: mp.reduce((s, x) => s + x.mass_g, 0) / 1000, c: [c[0] + inst.position[0], c[1] + inst.position[1], c[2] + inst.position[2]] });
  }
  const g = 9.80665, j2 = tree.joints.find(j => j.key === 'l1~l2')!, j3 = tree.joints.find(j => j.key === 'l2~l3')!;
  const about = (z: number, ids: string[]) => g * parts.filter(p => ids.includes(p.id)).reduce((s, p) => s + p.m * (p.c[2] - z) / 1000, 0);
  const want = { 'l1~l2': about(j2.origin[2], ['l2', 'l3', 'payload']), 'l2~l3': about(j3.origin[2], ['l3', 'payload']) };
  const got = JSON.parse((await dispatchTool({ doc, bodies: e }, 'gravity_torques', { values: { 'l1~l2': 90 } }, evaluate)).content).torques as Record<string, number>;
  for (const k of ['l1~l2', 'l2~l3'] as const) assert.ok(Math.abs(Math.abs(got[k] / 1000) - Math.abs(want[k])) <= 1e-9 * Math.abs(want[k]), `${k}: ${got[k]} vs ${want[k]}`);
  // (The harness's effort is RD2's peak or RD1's hold (10 significant figures, as the tools print them); its RD3 checks
  // sizeActuators' own for the pair it picks, the same values.)
  const r = await check(doc, DUTY), mv = DUTY.moves[0];
  const tool = async (name: string, args: object) => JSON.parse((await dispatchTool({ doc, bodies: e }, name, args, evaluate)).content);
  const publicMove = dutyJson(tree, { moves: [mv] }).moves[0];
  const mt = [await tool('motion_torques', { from: publicMove.from, to: publicMove.to, profile: publicMove.profile, joint_limits: publicMove.joint_limits }), await tool('motion_torques', { from: publicMove.to, to: publicMove.from, profile: publicMove.profile, joint_limits: publicMove.joint_limits })];
  const holds = [(await tool('gravity_torques', { values: jointValuesOut(tree, mv.from) })).torques, (await tool('gravity_torques', { values: jointValuesOut(tree, mv.to) })).torques];
  for (const k of ['base~l1', 'l1~l2', 'l2~l3']) {
    const peak = Math.max(...mt.map(x => x.joints[k].peak / 1000), ...holds.map(h => Math.abs(h[k] / 1000)));
    const h = r.margins.find(m => m.check === 'joint effort' && m.joint === k && m.move === 0)!;
    assert.ok(Math.abs(h.value - peak) <= 1e-9 * Math.max(1, peak), `${k}: ${h.value} vs ${peak}`);
  }
  const rob = await robotOfDoc(doc, e, evaluate), sized = sizeActuators(rob.tree, linkBodies(rob.tree, rob.partOf), mv.from, mv.to, 'trapezoid', () => mv.limits!, { dwell: 0.5, life: 20000 });
  for (const js of sized.joints) {
    assert.deepEqual(r.actuators[js.key][0], { motor: js.choice!.motor, reducer: js.choice!.reducer });
    for (const c of js.checks) { const h = r.margins.find(m => m.check === c.name && m.joint === js.key && m.move === 0)!; assert.ok(Math.abs(h.value - c.value) <= 1e-9 * Math.max(1, Math.abs(c.value)) || (!Number.isFinite(c.value) && h.value === c.value), `${js.key} ${c.name}: ${h.value} vs ${c.value}`); }
  }
});

test('cad-cli robot-check: the frozen arm and duty exit 0; a seeded duty exits 1 with its failing margin; a malformed duty is refused', async () => {
  const doc = await frozen(), tree = await treeOfDoc(doc, await bodiesOf(doc), evaluate);
  const run = (args: string[]) => new Promise<{ code: number; out: string; err: string }>(ok => {
    const child = spawn(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', er = ''; child.stdout.on('data', c => { o += c; }); child.stderr.on('data', c => { er += c; }); child.on('close', code => ok({ code: code ?? -1, out: o, err: er }));
  });
  const tmp = mkdtempSync(join(tmpdir(), 'rd9-'));
  try {
    writeFileSync(join(tmp, 'duty.json'), JSON.stringify(dutyJson(tree, DUTY)));
    const a = await run(['robot-check', join(DIR, 'robot.bcad'), join(tmp, 'duty.json')]);
    assert.equal(a.code, 0, a.err); const publicReport = JSON.parse(a.out); assert.equal(publicReport.ok, true);
    assert.ok(publicReport.consistency.every((c: Record<string, unknown>) => 'errorRatio' in c && 'limitRatio' in c && !('value' in c) && !('tol' in c)));
    assert.ok(publicReport.margins.some((m: { unit: string }) => m.unit === 'N·mm'));
    assert.ok(publicReport.margins.every((m: { unit: string }) => !['rad', 'rad/s', 'N·m', 'rpm', 'h'].includes(m.unit)));
    writeFileSync(join(tmp, 'past.json'), JSON.stringify(dutyJson(tree, { ...DUTY, moves: [{ ...DUTY.moves[0], to: { ...P1, 'base~l1': 2.7 } }] })));
    const b = await run(['robot-check', join(DIR, 'robot.bcad'), join(tmp, 'past.json')]);
    assert.equal(b.code, 1); assert.equal(JSON.parse(b.out).least.check, 'joint range');
    writeFileSync(join(tmp, 'bad.json'), JSON.stringify({ moves: [{ to: { 'l1~l2': 1 }, profile: 'trapezoid' }] }));
    const c = await run(['robot-check', join(DIR, 'robot.bcad'), join(tmp, 'bad.json')]);
    assert.equal(c.code, 2); assert.match(c.err, /move 0: l1~l2: give its limits/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  assert.ok(existsSync(join(DIR, 'case.json')));
  // The frozen internal duty is supplied through the canonical public boundary.
  const d = readDuty(tree, dutyJson(tree, JSON.parse(readFileSync(join(DIR, 'duty.json'), 'utf8'))));
  assert.ok(!('error' in d)); assert.deepEqual((d as NativeDuty).moves.length, 2);
});
