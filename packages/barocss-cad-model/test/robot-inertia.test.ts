import { symmetricEigen3 } from '@barocss/cad';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { tablesFor } from '../src/assembly/faces';
import { rotationMatrix } from '../src/engine/placement';
import { solveDoc } from '../src/assembly/edit';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { MATERIALS } from '../src/library/materials';
import { jointTreeOf } from '../src/robot/joints';
import { linkFrames, linkInertia, rotateInertia, type Frame, type Mat3 } from '../src/robot/inertia';

// RM3 (O16): link inertia — an analytic rotated, off-origin cuboid (I = R·diag·Rᵀ about its moved centre), the same in
// any link frame (I_L = Rᵀ I R), its principal moments the cuboid's own; a cylinder; densities; bodies combined by the
// parallel-axis theorem; the checks typed (positive definite, the triangle inequality); the link frames; the tool.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(calls: [string, object][], doc = emptyDoc()): Promise<ChatState> { let s: ChatState = { doc, bodies: [] }; for (const [t, a] of calls) { const r = await dispatchTool(s, t, a, evaluate); assert.ok(!r.isError, r.content); s = r.state; } return s; }
const I3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1], AT_PART: Frame = { origin: [0, 0, 0], R: I3 };
const mul = (a: Mat3, b: Mat3): Mat3 => { const r = new Array(9).fill(0) as Mat3; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
const tr = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const rot = (axis: 'x' | 'z', deg: number): Mat3 => { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return axis === 'z' ? [c, -s, 0, s, c, 0, 0, 0, 1] : [1, 0, 0, 0, c, -s, 0, s, c]; };
const close = (a: readonly number[], b: readonly number[], rel: number) => { const scale = Math.max(...b.map(Math.abs)); return a.every((x, i) => Math.abs(x - b[i]) <= rel * scale); };

// The cuboid: 40 × 20 × 10 mm from (15, −7, 3), turned 30° about Z then 50° about X, both through the origin.
const W = 40, D = 20, H = 10, RHO = 2.7, M = W * D * H * RHO * 1e-6;
const DIAG: Mat3 = [M * (D * D + H * H) / 12e6, 0, 0, 0, M * (W * W + H * H) / 12e6, 0, 0, 0, M * (W * W + D * D) / 12e6];
const ROT = mul(rot('x', 50), rot('z', 30)), CENTRE = [35, 3, 8];
const cuboid = () => build([['run_command', { command: 'box', values: { w: W, d: D, h: H, x: 15, y: -7, z: 3 } }], ['run_command', { command: 'rotate', bodies: ['b1'], values: { axis: 'z', angle: 30, px: 0, py: 0, pz: 0 } }], ['run_command', { command: 'rotate', bodies: ['b2'], values: { axis: 'x', angle: 50, px: 0, py: 0, pz: 0 } }]]);

test('an analytic rotated, off-origin cuboid: mass, the moved centre, I = R·diag·Rᵀ, to 1e-12', async () => {
  const s = await cuboid(), l = linkInertia('L', 'base', s.doc, s.bodies, AT_PART);
  const centre = [0, 1, 2].map(i => ROT[i * 3] * CENTRE[0] + ROT[i * 3 + 1] * CENTRE[1] + ROT[i * 3 + 2] * CENTRE[2] );
  assert.ok(Math.abs(l.massKg - M) < 1e-15, String(l.massKg));
  assert.ok(close(l.comM, centre.map(v => v / 1000), 1e-12), `${l.comM} vs ${centre}`);
  assert.ok(close(l.inertia, mul(mul(ROT, DIAG), tr(ROT)), 1e-12), JSON.stringify(l.inertia));
  assert.ok(close(l.principal.moments, [DIAG[0], DIAG[4], DIAG[8]], 1e-12), 'its principal moments are the cuboid\'s');
  assert.deepEqual(l.issues.map(i => i.code), ['MATERIAL_ASSUMED']);
});

test('the same cuboid in any link frame: I_L = Rᵀ I R, the centre Rᵀ (c − o); principal moments unchanged', async () => {
  const s = await cuboid();
  for (let k = 0; k < 10; k++) {
    const F = mul(rot('z', 37 * k + 11), mul(rot('x', 23 * k - 40), rot('z', 7 * k))), o: [number, number, number] = [k * 3 - 10, 5 - k, 2 * k];
    const l = linkInertia('L', 'base', s.doc, s.bodies, { origin: o, R: F });
    const world = mul(mul(ROT, DIAG), tr(ROT)), expect = mul(mul(tr(F), world), F);
    const c = [0, 1, 2].map(i => ROT[i * 3] * CENTRE[0] + ROT[i * 3 + 1] * CENTRE[1] + ROT[i * 3 + 2] * CENTRE[2] - o[i]);
    assert.ok(close(l.inertia, expect, 1e-12), String(k));
    assert.ok(close(l.comM, [0, 1, 2].map(j => (F[j] * c[0] + F[3 + j] * c[1] + F[6 + j] * c[2]) / 1000), 1e-12), String(k));
    assert.ok(close(l.principal.moments, [DIAG[0], DIAG[4], DIAG[8]], 1e-12), String(k));
  }
});

test('a cylinder\'s analytic inertia; another material scales mass and inertia by its density', async () => {
  const s = await build([['run_command', { command: 'cylinder', values: { r: 10, h: 30, x: 0, y: 0, z: 0 } }]]), m = Math.PI * 100 * 30 * RHO * 1e-6;
  const l = linkInertia('L', 'base', s.doc, s.bodies, AT_PART);
  assert.ok(close([l.inertia[0], l.inertia[4], l.inertia[8]], [m * (3 * 100 + 900) / 12e6, m * (3 * 100 + 900) / 12e6, m * 100 / 2e6], 1e-12));
  const steel = MATERIALS.find(x => Math.abs(x.gPerCm3 - RHO) > 1)!, key = s.bodies[0].key;
  const heavy = linkInertia('L', 'base', { ...s.doc, bodies: { [key]: { material: steel.id } } } as StudioDoc, s.bodies, AT_PART);
  assert.ok(Math.abs(heavy.massKg / l.massKg - steel.gPerCm3 / RHO) < 1e-12 && Math.abs(heavy.inertia[8] / l.inertia[8] - steel.gPerCm3 / RHO) < 1e-12);
  assert.deepEqual([heavy.bodies[0].material, heavy.bodies[0].assumed, heavy.issues], [steel.label, false, []]);
});

test('two bodies combined by the parallel-axis theorem: the pair of cuboids\' closed form', async () => {
  // A 20 × 10 × 10 block at the origin and another 100 mm along X: the centre between them, each moved to it.
  const s = await build([['run_command', { command: 'box', values: { w: 20, d: 10, h: 10, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'box', values: { w: 20, d: 10, h: 10, x: 100, y: 0, z: 0 } }]]);
  const l = linkInertia('L', 'base', s.doc, s.bodies, AT_PART), m = 20 * 10 * 10 * RHO * 1e-6, d = 0.05;
  assert.equal(l.bodies.length, 2);
  assert.ok(close(l.comM, [0.06, 0.005, 0.005], 1e-12));
  const own = [m * (100 + 100) / 12e6, m * (400 + 100) / 12e6, m * (400 + 100) / 12e6];
  assert.ok(close([l.inertia[0], l.inertia[4], l.inertia[8]], [2 * own[0], 2 * (own[1] + m * d * d), 2 * (own[2] + m * d * d)], 1e-12), JSON.stringify(l.inertia));
});

test('the checks, typed: not positive definite, the triangle inequality, no volume, a massless dummy', () => {
  const body = (key: string, I: number[][] | undefined, volume: number | null = 1000): BodyResult => ({ key, family: 'planar', mesh: { faces: [] } as never, volumeMM3: volume, massG: null, centroid: [0, 0, 0], ...(I ? { inertia: I } : {}) });
  const doc = emptyDoc();
  assert.deepEqual(linkInertia('L', 'base', doc, [body('b1', [[1, 0, 0], [0, 1, 0], [0, 0, 3]])], AT_PART).issues.map(i => i.code), ['MATERIAL_ASSUMED', 'TRIANGLE']);
  assert.ok(linkInertia('L', 'base', doc, [body('b1', [[-1, 0, 0], [0, 1, 0], [0, 0, 1]])], AT_PART).issues.some(i => i.code === 'NOT_SPD'));
  assert.deepEqual(linkInertia('L', 'base', doc, [body('b1', undefined, null)], AT_PART).issues.map(i => i.code), ['NO_VOLUME', 'NO_BODY']);
  const dummy = linkInertia('L__1', null, null, [], AT_PART);
  assert.deepEqual([dummy.massKg, dummy.issues.map(i => i.code)], [0, ['NO_BODY']]);
});

test('the eigen-solver: random symmetric matrices rebuilt from their eigenpairs, the vectors orthonormal; I_L = Rᵀ I R', () => {
  let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let k = 0; k < 200; k++) {
    const a = [rand(), rand(), rand(), rand(), rand(), rand()], S: Mat3 = [a[0], a[1], a[2], a[1], a[3], a[4], a[2], a[4], a[5]];
    const { values, vectors: V } = symmetricEigen3(S), back = mul(mul(V, [values[0], 0, 0, 0, values[1], 0, 0, 0, values[2]]), tr(V));
    assert.ok(back.every((x, i) => Math.abs(x - S[i]) < 1e-12) && values[0] <= values[1] && values[1] <= values[2]);
    assert.ok(mul(tr(V), V).every((x, i) => Math.abs(x - I3[i]) < 1e-12));
  }
  const R = rot('z', 90);
  assert.deepEqual(rotateInertia([1, 0, 0, 0, 2, 0, 0, 0, 3], R).map(x => Math.round(x * 1e12) / 1e12 + 0), [2, 0, 0, 0, 1, 0, 0, 0, 3]);
});

test('link frames: at the joint\'s point, Z along its axis, in the part\'s coordinates — checked through world coordinates on a turned instance', async () => {
  const c = JSON.parse(readFileSync(join(CASES, 'revolute', 'case.json'), 'utf8')).input.document as StudioDoc;
  for (const rotation of [[0, 0, 0], [0, 0, 90], [0, 0, -35]] as [number, number, number][]) {
    const doc = { ...c, instances: c.instances!.map(i => ({ ...i, rotation })) }, s = solveDoc(doc), t = jointTreeOf(s.doc, { instances: s.doc.instances!, problems: s.problems }, tablesFor(s.doc));
    const arm = s.doc.instances![0], frames = linkFrames(t, p => p === 'base' ? null : arm), f = frames.get('arm')!, j = t.joints[0];
    const P = rotationMatrix(arm.rotation) as unknown as Mat3, toWorld = (v: readonly number[]) => [0, 1, 2].map(i => P[i * 3] * v[0] + P[i * 3 + 1] * v[1] + P[i * 3 + 2] * v[2] + arm.position[i]);
    const zWorld = [0, 1, 2].map(i => P[i * 3] * f.R[2] + P[i * 3 + 1] * f.R[5] + P[i * 3 + 2] * f.R[8]);
    assert.ok(close(toWorld(f.origin), j.origin, 1e-12) && close(zWorld, j.axis, 1e-12), JSON.stringify({ rotation, f }));
    assert.ok(close(mul(tr(f.R), f.R), I3, 1e-12) && Math.abs(f.R[0] * (f.R[4] * f.R[8] - f.R[5] * f.R[7]) - f.R[1] * (f.R[3] * f.R[8] - f.R[5] * f.R[6]) + f.R[2] * (f.R[3] * f.R[7] - f.R[4] * f.R[6]) - 1) < 1e-12, 'a right-handed frame');
    assert.deepEqual(frames.get('base'), { origin: [0, 0, 0], R: I3 }, 'the base link: its part frame');
  }
});

test('the link_inertia tool on the 2R arm; the conformance case (rm/inertia-cuboid)', async () => {
  const doc = JSON.parse(readFileSync(join(CASES, 'chain-2r', 'case.json'), 'utf8')).input.document as StudioDoc, r = await evaluate(doc); assert.ok(r.ok);
  const out = await dispatchTool({ doc, bodies: r.bodies }, 'link_inertia', {}, evaluate), j = JSON.parse(out.content);
  assert.ok(!out.isError && !out.changed, out.content);
  assert.deepEqual(j.links.map((l: { link: string }) => l.link), ['base', 'a', 'b']);
  const a = j.links[1], b = j.links[2], armMass = (60 * 20 * 5 - 2 * Math.PI * 25 * 5) * RHO * 1e-6;
  // (The tool gives 10 significant figures.)
  assert.ok(Math.abs(a.mass_kg - armMass) < 1e-10 * armMass && a.mass_kg === b.mass_kg, `${a.mass_kg} vs ${armMass}`);
  // (The arm's centre, (30, 10, 2.5) in its part, from its turning hole at (10, 10, 0): 20 mm along X, 2.5 up.)
  assert.ok(close(a.com_m, [0.02, 0, 0.0025], 1e-9), JSON.stringify(a.com_m));
  assert.ok(a.issues.some((i: { code: string }) => i.code === 'MATERIAL_ASSUMED'));
  // The conformance case: the cuboid's document and its analytic answer, written from the closed form.
  const file = join(CASES, 'inertia-cuboid', 'case.json'), s = await cuboid();
  if (process.env.UPDATE_RM_FIXTURES) {
    mkdirSync(join(CASES, 'inertia-cuboid'), { recursive: true });
    const centre = [0, 1, 2].map(i => (ROT[i * 3] * CENTRE[0] + ROT[i * 3 + 1] * CENTRE[1] + ROT[i * 3 + 2] * CENTRE[2]) / 1000);
    writeFileSync(file, JSON.stringify({ case: 'inertia-cuboid', step: 'RM3', note: 'A 40 × 20 × 10 mm aluminium (2.70 g/cm³) cuboid from (15, −7, 3), turned 30° about Z then 50° about X through the origin: m = 0.0216 kg; I about its centre R·diag(m(d²+h²)/12, m(w²+h²)/12, m(w²+d²)/12)·Rᵀ, R = Rx(50°)·Rz(30°); in the part frame, SI.', input: { document: s.doc }, expect: { mass_kg: M, com_m: centre, inertia_kg_m2: mul(mul(ROT, DIAG), tr(ROT)), principal_kg_m2: [DIAG[0], DIAG[4], DIAG[8]] }, tol_rel: 1e-12 }, null, 1) + '\n');
  }
  const k = JSON.parse(readFileSync(file, 'utf8')), rk = await evaluate(k.input.document); assert.ok(rk.ok);
  const l = linkInertia('L', 'base', k.input.document, rk.bodies, AT_PART);
  assert.ok(Math.abs(l.massKg - k.expect.mass_kg) < 1e-15 && close(l.comM, k.expect.com_m, k.tol_rel) && close(l.inertia, k.expect.inertia_kg_m2, k.tol_rel) && close(l.principal.moments, k.expect.principal_kg_m2, k.tol_rel));
});
