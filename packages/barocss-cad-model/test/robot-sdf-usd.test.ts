import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { mjcfOfDoc, robotOfDoc, urdfOfDoc } from '../src/chat/robot';
import { forwardKinematics } from '../src/robot/fk';
import { closureOfDoc } from '../src/robot/loop';
import { readMjcf } from '../src/robot/mjcfCheck';
import { readUrdf } from '../src/robot/urdfCheck';
import { exportSdf } from '../src/robot/sdf';
import { exportUsd } from '../src/robot/usd';
import { modelFk, readSdf, readUsda, type RobotModel } from '../src/robot/modelCheck';
import type { Mat3 } from '../src/robot/inertia';
import { fromQuat } from '../src/robot/modelCheck';
import type { JointTree } from '../src/robot/joints';

// RM9c (O62): SDF 1.11 and USD (UsdPhysics, .usda), checked by our own readers: the same tree back (names, masses and
// inertia to 1e-12, axes, limits), the four formats agreeing on arm-6r, FK from each file's frames equal to RM2's at 100
// poses to 1e-9 mm; a gear pair and a slide; the four-bar's loop as a ball / spherical joint; RM4/RM5's files unchanged.
// The external validators (usd-core, libsdformat) wait for the owner's go-ahead.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const bodiesOf = async (doc: StudioDoc) => { const r = await evaluate(doc); assert.ok(r.ok); return r.bodies as BodyResult[]; };
const caseDoc = (name: string): StudioDoc => JSON.parse(readFileSync(join(CASES, name, 'case.json'), 'utf8')).input.document;
const arm6r = (): StudioDoc => JSON.parse(readFileSync(join(CASES, 'arm-6r', 'robot.bcad'), 'utf8'));
let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
const tensorGap = (A: readonly number[], B: readonly number[]) => { const s = Math.max(...B.map(Math.abs)); return Math.max(...A.map((v, i) => Math.abs(v - B[i]))) / s; };

async function exportsOf(doc: StudioDoc) {
  const bodies = await bodiesOf(doc), r = await robotOfDoc(doc, bodies, evaluate), closures = r.tree.loops.map(l => closureOfDoc(doc, r.tree, l));
  const sdf = exportSdf(r.tree, r.partOf, 'robot', closures), usd = exportUsd(r.tree, r.partOf, 'robot', closures);
  assert.ok(sdf.ok, JSON.stringify(!sdf.ok && sdf.refusals)); assert.ok(usd.ok, JSON.stringify(!usd.ok && usd.refusals));
  return { tree: r.tree, sdf, usd, S: readSdf(sdf.sdf), U: readUsda(usd.usda), bodies };
}
/** RM2's FK against a file's: every link's frame (world, mm) at random values, the worst gap. */
function fkGap(tree: JointTree, model: RobotModel, names: { links: Record<string, string>; joints: Record<string, string> }, frames: Map<string, { R: Mat3; o: number[] }>, samples: number, values: (keys: string[]) => Record<string, number>): number {
  let worst = 0;
  for (let k = 0; k < samples; k++) {
    const q = values(tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key)), fk = forwardKinematics(tree, q);
    const named = Object.fromEntries(tree.joints.filter(j => !j.mimic && j.type !== 'fixed').map(j => [names.joints[j.key], j.type === 'prismatic' ? (q[j.key] ?? 0) / 1000 : q[j.key] ?? 0]));
    const got = modelFk(model, named);
    for (const l of tree.links) {
      const D = fk.motions.get(l.id)!, H = frames.get(l.id)!, p = got.get(names.links[l.id])!;
      const o = [0, 1, 2].map(i => D.R[i * 3] * H.o[0] + D.R[i * 3 + 1] * H.o[1] + D.R[i * 3 + 2] * H.o[2] + D.t[i]);
      const R = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => D.R[i * 3] * H.R[j] + D.R[i * 3 + 1] * H.R[3 + j] + D.R[i * 3 + 2] * H.R[6 + j]));
      worst = Math.max(worst, ...o.map((v, i) => Math.abs(v - p.o[i] * 1000)), ...R.map((v, i) => Math.abs(v - p.R[i]) * 1000));
    }
  }
  return worst;
}

test('arm-6r: SDF and USD read back to the same tree, and URDF, MJCF, SDF and USD agree on every link\'s mass, centre and inertia, every joint\'s axis and limits', async () => {
  const doc = arm6r(), { tree, sdf, S, U, bodies } = await exportsOf(doc);
  const u = await urdfOfDoc(doc, bodies, evaluate, 'robot'), m = await mjcfOfDoc(doc, bodies, evaluate, 'robot'); assert.ok(u.ok && m.ok);
  const ur = readUrdf(u.urdf).model, mj = readMjcf(m.xml).model;
  for (const model of [S, U]) {
    assert.deepEqual(model.links.map(l => l.name), tree.links.map(l => sdf.names.links[l.id]));
    assert.deepEqual(model.joints.map(j => [j.name, j.type, j.parent, j.child]), tree.joints.map(j => [sdf.names.joints[j.key], j.type, sdf.names.links[j.parent], sdf.names.links[j.child]]));
  }
  let worst = 0;
  for (const l of tree.links) {
    const n = sdf.names.links[l.id], s = S.links.find(x => x.name === n)!, us = U.links.find(x => x.name === n)!, a = ur.links.find(x => x.name === n)!.inertial!, b = mj.bodies.find(x => x.name === n)!.inertial!;
    // (URDF's six numbers and MJCF's fullinertia as the tensor: ixx ixy ixz iyy iyz izz; Ixx Iyy Izz Ixy Ixz Iyz.)
    const Iu = [a.I[0], a.I[1], a.I[2], a.I[1], a.I[3], a.I[4], a.I[2], a.I[4], a.I[5]], Im = [b.I[0], b.I[3], b.I[4], b.I[3], b.I[1], b.I[5], b.I[4], b.I[5], b.I[2]];
    for (const [mass, com, I] of [[a.mass, a.xyz, Iu], [b.mass, b.pos, Im]] as const) {
      worst = Math.max(worst, rel(s.mass, mass), rel(us.mass, mass), ...[0, 1, 2].map(i => Math.abs(s.com[i] - com[i])), ...[0, 1, 2].map(i => Math.abs(us.com[i] - com[i])), tensorGap(s.inertia, I), tensorGap(us.inertia, I));
    }
  }
  console.log(`RM9c arm-6r: the four formats' masses, centres and inertia agree to ${worst.toExponential(2)}`);
  assert.ok(worst <= 1e-12, String(worst));
  for (const j of tree.joints) {
    const n = sdf.names.joints[j.key], s = S.joints.find(x => x.name === n)!, us = U.joints.find(x => x.name === n)!, uj = ur.joints.find(x => x.name === n)!;
    assert.deepEqual(s.axis, uj.axis); assert.deepEqual(us.axis.map(v => Math.abs(v)), uj.axis.map(v => Math.abs(v)));
    for (const k of ['lower', 'upper', 'effort', 'velocity'] as const) { if (uj.limit?.[k] === undefined) continue; assert.ok(Math.abs(s.limit![k]! - uj.limit[k]!) <= 1e-12 && Math.abs(us.limit![k]! - uj.limit[k]!) <= 1e-12 * Math.max(1, Math.abs(uj.limit[k]!)), `${n} ${k}`); }
  }
  // (RM4/RM5's frozen files unchanged by RM9c.)
  assert.equal(m.xml, readFileSync(join(CASES, 'arm-6r', 'robot.xml'), 'utf8'));
});

test('FK from the SDF\'s and the USD\'s own frames equals RM2\'s at 100 poses to 1e-9 mm: the 6R arm, a gear pair (SDF\'s mimic), a slide', async () => {
  const turn = (keys: string[]) => Object.fromEntries(keys.map(k => [k, (rand() * 2 - 1) * Math.PI]));
  for (const [name, doc, values] of [['arm-6r', arm6r(), turn], ['gears', caseDoc('gears'), turn],
    ['cylindrical', { ...caseDoc('cylindrical'), robot: { version: 1 as const, joints: { 'base~arm#0': { lower: -20, upper: 20, effort: 50, velocity: 100 } } } }, (keys: string[]) => Object.fromEntries(keys.map(k => [k, k.endsWith('#0') ? rand() * 40 - 20 : (rand() * 2 - 1) * Math.PI]))]] as const) {
    const { tree, sdf, usd, S, U } = await exportsOf(doc as StudioDoc);
    assert.ok(sdf.ok && usd.ok);
    const gs = fkGap(tree, S, sdf.names, sdf.frames, 100, values), gu = fkGap(tree, U, usd.names, usd.frames, 100, values);
    console.log(`RM9c FK ${name}: SDF ${gs.toExponential(2)} mm, USD ${gu.toExponential(2)} mm`);
    assert.ok(gs <= 1e-9 && gu <= 1e-9, `${name}: ${gs} ${gu}`);
    if (name === 'gears') { assert.match(sdf.sdf, /<mimic joint="base_to_g1"><multiplier>-0\.6666666666666666<\/multiplier><offset>0<\/offset><reference>0<\/reference><\/mimic>/); assert.match(usd.usda, /custom string barocss:mimicJoint = "base_to_g1"/); assert.ok(usd.notes.some(x => /custom attributes/.test(x)), 'the coupling said to be a custom attribute'); }
    if (name === 'cylindrical') { assert.match(sdf.sdf, /type="prismatic"/); assert.match(sdf.sdf, /<lower>-0\.02<\/lower><upper>0\.02<\/upper>/); assert.match(usd.usda, /def PhysicsPrismaticJoint/); assert.match(usd.usda, /float physics:lowerLimit = -0\.02/); }
  }
});

test('the four-bar (RM8): its loop pin a ball joint in SDF and a spherical joint outside the articulation in USD, at the pin; the tree\'s FK unchanged', async () => {
  const doc = JSON.parse(readFileSync(join(CASES, 'four-bar', 'robot.bcad'), 'utf8')) as StudioDoc, { tree, sdf, usd, S, U } = await exportsOf(doc);
  assert.ok(sdf.ok && usd.ok);
  assert.equal(S.closures.length, 1); assert.equal(U.closures.length, 1);
  assert.match(sdf.sdf, /<joint name="loop_\w+" type="ball">/); assert.match(usd.usda, /def PhysicsSphericalJoint "loop_\w+"[\s\S]*?bool physics:excludeFromArticulation = true/);
  assert.ok(!sdf.notes.some(n => /A tree format/.test(n)), 'the loop is written, not noted as left out');
  // (At the solved pose the pin is where both links put it: the ball joint's pose in b's frame, the spherical joint's two local points.)
  const c = closureOfDoc(doc, tree, tree.loops[0]), A = sdf.frames.get(c.a)!, B = sdf.frames.get(c.b)!;
  const pin = (F: { R: Mat3; o: number[] }, p: readonly number[]) => [0, 1, 2].map(i => (F.R[i] * (p[0] - F.o[0]) + F.R[3 + i] * (p[1] - F.o[1]) + F.R[6 + i] * (p[2] - F.o[2])) / 1000);
  const ball = /<joint name="loop_\w+" type="ball">[\s\S]*?<pose>([^<]+)<\/pose>/.exec(sdf.sdf)![1].split(' ').map(Number).slice(0, 3);
  assert.ok(ball.every((v, i) => Math.abs(v - pin(B, c.point)[i]) <= 1e-12));
  const lp0 = /physics:localPos0 = \(([^)]+)\)\n\s*point3f physics:localPos1 = \(([^)]+)\)\n\s*bool physics:excludeFromArticulation/.exec(usd.usda)!;
  assert.ok(lp0[1].split(',').map(Number).every((v, i) => Math.abs(v - pin(A, c.point)[i]) <= 1e-12) && lp0[2].split(',').map(Number).every((v, i) => Math.abs(v - pin(B, c.point)[i]) <= 1e-12));
  const turn = (keys: string[]) => Object.fromEntries(keys.map(k => [k, (rand() * 2 - 1) * Math.PI]));
  assert.ok(fkGap(tree, S, sdf.names, sdf.frames, 20, turn) <= 1e-9 && fkGap(tree, U, usd.names, usd.frames, 20, turn) <= 1e-9);
});

// (usd-core 26.8, the owner's go-ahead: the frozen arm-6r and four-bar stages read by OpenUSD and UsdPhysics' own parser,
// scripts/usd-oracle.py, its readings committed beside each case; compared here with the studio's numbers.)
test('the frozen arm-6r and four-bar USD stages; usd-core 26.8\'s UsdPhysics reading of them equals our numbers', async () => {
  for (const name of ['arm-6r', 'four-bar']) {
    const doc = JSON.parse(readFileSync(join(CASES, name, 'robot.bcad'), 'utf8')) as StudioDoc, { tree, sdf, usd } = await exportsOf(doc), file = join(CASES, name, 'robot.usda');
    assert.ok(sdf.ok && usd.ok);
    if (process.env.UPDATE_USD_CASE || !existsSync(file)) { writeFileSync(file, usd.usda); writeFileSync(join(CASES, name, 'robot.sdf'), sdf.sdf); }
    assert.equal(readFileSync(file, 'utf8'), usd.usda, `${name}: the USD export is the frozen one`);
    assert.equal(readFileSync(join(CASES, name, 'robot.sdf'), 'utf8'), sdf.sdf, `${name}: the SDF export is the frozen one`);
    const reading = join(CASES, name, 'oracle.usd-core-26.8.json');
    if (!existsSync(reading)) { console.log(`RM9c ${name}: no usd-core reading yet (scripts/usd-oracle.py)`); continue; }
    const o = JSON.parse(readFileSync(reading, 'utf8'));
    assert.deepEqual(o.composition_errors, []); assert.equal(o.metersPerUnit, 1); assert.equal(o.kilogramsPerUnit, 1); assert.equal(o.upAxis, 'Z');
    // (USD's float attributes to 1e-6 relative; the frames as UsdPhysics' descriptors hold them — single precision, GfVec3f
    // and GfQuatf, though the file's matrix4d is double: 2⁻²⁴ of the arm's 0.3 m is 2e-8 — to 1e-7.)
    let worst = 0, worstF = 0;
    const f32 = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
    for (const l of tree.links) {
      const n = usd.names.links[l.id], b = o.bodies[n], F = usd.frames.get(l.id)!; assert.ok(b, `${name}: body ${n} read`);
      const R = fromQuat(...(b.rotation as [number, number, number, number]));
      worstF = Math.max(worstF, ...[0, 1, 2].map(i => Math.abs(b.position[i] - F.o[i] / 1000)), ...R.map((v, i) => Math.abs(v - F.R[i])));
    }
    // (Masses, centres and inertia against the SDF's — which the four formats agree with to 1e-16, test 1.)
    const S = readSdf(sdf.sdf);
    for (const sl of S.links) {
      const b = o.bodies[sl.name]; if (!b || !b.principalAxes) continue;
      worst = Math.max(worst, f32(b.mass, sl.mass), ...[0, 1, 2].map(i => Math.abs(b.centerOfMass[i] - sl.com[i]) / Math.max(1e-3, Math.abs(sl.com[i]))));
      const A = fromQuat(...(b.principalAxes as [number, number, number, number])), d = b.diagonalInertia, I = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[i * 3] * d[0] * A[j * 3] + A[i * 3 + 1] * d[1] * A[j * 3 + 1] + A[i * 3 + 2] * d[2] * A[j * 3 + 2]));
      worst = Math.max(worst, tensorGap(I, sl.inertia));
    }
    for (const j of tree.joints) {
      const n = usd.names.joints[j.key], r = o.joints[n]; assert.ok(r, `${name}: joint ${n} read`);
      assert.equal(r.body0, usd.names.links[j.parent]); assert.equal(r.body1, usd.names.links[j.child]);
      assert.equal(r.type, j.type === 'prismatic' ? 'PrismaticJoint' : j.type === 'fixed' ? 'FixedJoint' : 'RevoluteJoint');
      if (j.type !== 'fixed') assert.match(String(r.axis), /Z/);
      assert.equal(r.excludeFromArticulation, false);
    }
    const loops = Object.values(o.joints).filter((r: unknown) => (r as { type: string }).type === 'SphericalJoint') as { excludeFromArticulation: boolean }[];
    assert.equal(loops.length, tree.loops.length); assert.ok(loops.every(r => r.excludeFromArticulation));
    assert.equal(o.articulations.length, 1);
    console.log(`RM9c usd-core ${o.usd} ${name}: ${Object.keys(o.bodies).length} bodies, ${Object.keys(o.joints).length} joints, articulation ${o.articulations[0].bodies}/${o.articulations[0].joints}; frames to ${worstF.toExponential(2)}, mass properties to ${worst.toExponential(2)}`);
    assert.ok(worstF <= 1e-7, String(worstF)); assert.ok(worst <= 1e-6, String(worst));
  }
});
