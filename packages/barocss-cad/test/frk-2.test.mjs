import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, booleanAnalytic, brepMassProperties } from '../dist/index.js';

// FRk2 (D166): fillet weld beads on a frame's joints — a member's end landing square on other members' flat faces, and
// a gusset's two seams. Oracles written here, none of them the kernel's: the offset outline's areas A(s) = A₀ + P·s + c·s²
// (c = 4 for a sharp outline's mitred corners, π for a smooth one) integrated over the leg, P·z²/2 + (c/3)·z³; a bore's
// fillet P·z²/2 − (c/3)·z³; a fillet clipped flush at a face's edge, its straight runs z²/2 a mm; a gusset's four runs
// (l − c)·z² a seam; the beads welded with their members, one body of their sum. Every size is a test value.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = features => evaluateCadPart(D(features));
const volume = o => o.massProperties(1).volumeMM3;
const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want} (${Math.abs(got - want) / Math.max(1, Math.abs(want))})`);
const refuse = (features, code, re) => assert.throws(() => run(features), e => (e.details?.category ?? e.code) === code && re.test(e.message), String(re));
function welded(breps) { let b = breps[0]; for (const o of breps.slice(1)) b = booleanAnalytic(b, o, 'union'); return b; }
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, WIDE = { kind: 'rect-tube', width: 80, height: 80, wall: 4, outerRadius: 0 };
const z = 3;
/** A rail from x 500 ending on a post's face (the post along z, the rail's end at its middle), butted. */
const tee = (post, rail) => ({ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: post, ...(rail ? { overrides: [{ member: 1, section: rail }] } : {}), corners: { tee: 'butt' } });
const bead = (on, extra = {}) => ({ id: 'w', kind: 'weld-bead', frame: 'f', on, leg: z, ...extra });

test('FRk2 a bead on a rail butted on a wider post: the end\'s outline offset by the leg, drafted 45°, less the rail — P·z²/2 + (4/3)z³ (sharp), + (π/3)z³ (round-cornered); its centroid by moments; its report; welded with the rail and the post, their sum', () => {
  const s = run([tee(WIDE, SHARP), bead({ member: 1, end: 'end' })]), w = s.output('w'), V = 160 * z * z / 2 + 4 / 3 * z ** 3;
  near(volume(w), V, 1e-12, 'sharp');
  // Height above the face: ∫(P(z − h) + 4(z − h)²)·h dh = P·z³/6 + z⁴/3.
  near(w.massProperties(1).centroidMM[0], 40 + (160 * z ** 3 / 6 + z ** 4 / 3) / V, 1e-12, 'its centroid off the post\'s face');
  assert.equal(w.bodyCount, 1); assert.ok(w.validate().valid);
  const r = w.bead;
  assert.deepEqual([r.frame, r.on, r.kind, r.legMM, r.meets, r.corner], ['f', { member: 1, end: 'end' }, 'fillet', 3, [0], 'mitred']);
  near(r.throatMM, z / Math.SQRT2, 1e-15, 'throat'); near(r.volumeMM3, V, 1e-12, 'its volume');
  assert.deepEqual(r.seam, { lengthMM: 160, flushMM: 0, exact: true });
  const names = [...new Set(w.brep.faces.map(f => f.name))].sort();
  assert.ok(names.includes('w.fillet.top') && names.some(n => n.startsWith('w.fillet.side')) && names.some(n => n.startsWith('w.on.m1')), names.join(', '));
  const all = welded([s.outputs[0].brep, s.outputs[1].brep, w.brep]);
  assert.equal(all.bodies.length, 1); near(brepMassProperties(all, 1).volumeMM3, volume(s.outputs[0]) + volume(s.outputs[1]) + V, 1e-12, 'welded, their sum');
  // Round-cornered: the outline's arcs turn 2π in all, so c = π.
  const round = run([tee({ ...WIDE, outerRadius: 8 }, { ...SHARP, outerRadius: 6 }), bead({ member: 1, end: 'end' })]).output('w'), P = 160 - 48 + 12 * Math.PI;
  near(volume(round), P * z * z / 2 + Math.PI / 3 * z ** 3, 1e-11, 'round-cornered'); near(round.bead.seam.lengthMM, P, 1e-12, 'its seam');
});

test('FRk2 the bore\'s fillet too (inner): P_i·z²/2 − (c/3)z³ inside it, sharp and round-cornered bores; a start end (a post standing on a beam)', () => {
  const sharp = run([tee(WIDE, SHARP), bead({ member: 1, end: 'end' }, { inner: true })]).output('w');
  near(volume(sharp), 160 * 4.5 + 4 / 3 * 27 + 136 * 4.5 - 4 / 3 * 27, 1e-12, 'outer and inner');
  assert.deepEqual(sharp.bead.seam, { lengthMM: 296, flushMM: 0, exact: true, inner: true });
  assert.equal(sharp.bodyCount, 2, 'the wall between them');
  // A 60 × 60 × 4 rail with ro 8, ri 4 (concentric): the bore's rounds above the leg.
  const rail = { kind: 'rect-tube', width: 60, height: 60, wall: 4, outerRadius: 8 }, Po = 240 - 64 + 16 * Math.PI, Pi = 208 - 32 + 8 * Math.PI;
  const round = run([tee({ ...WIDE, width: 100, height: 100 }, rail), bead({ member: 1, end: 'end' }, { inner: true })]).output('w');
  near(volume(round), Po * 4.5 + Math.PI / 3 * 27 + Pi * 4.5 - Math.PI / 3 * 27, 1e-11, 'round-cornered, outer and inner');
  // A post standing on a beam's top (its start on the beam's middle, butted): the same bead from below.
  const stand = run([{ id: 'f', kind: 'frame', points: [[-400, 0, 0], [400, 0, 0], [0, 0, 0], [0, 0, 500]], segments: [[0, 1], [2, 3]], section: WIDE, overrides: [{ member: 1, section: SHARP }], corners: { tee: 'butt' } }, bead({ member: 1, end: 'start' })]).output('w');
  near(volume(stand), 160 * 4.5 + 36, 1e-12, 'at a start');
  near(stand.massProperties(1).centroidMM[2], 40 + (160 * 27 / 6 + 81 / 3) / 756, 1e-12, 'above the beam\'s top');
});

test('FRk2 flush sides: a rail as wide as its post keeps its fillets on the post\'s face — only the top and bottom runs, 40·z² (two bodies), flush 80; a leg under a mitred top\'s corner, on two rails, its outer sides flush with the frame\'s outside (360, two bodies, meets 4 and 7)', () => {
  const s = run([tee(SHARP), bead({ member: 1, end: 'end' })]), w = s.output('w');
  near(volume(w), 40 * z * z, 1e-12, 'the top and bottom runs');
  assert.equal(w.bodyCount, 2); assert.deepEqual(w.bead.seam, { lengthMM: 160, flushMM: 80, exact: true });
  near(w.massProperties(1).centroidMM[0], 20 + z / 3, 1e-12, 'on the face');
  const all = welded([s.outputs[0].brep, s.outputs[1].brep, w.brep]);
  near(brepMassProperties(all, 1).volumeMM3, volume(s.outputs[0]) + volume(s.outputs[1]) + 40 * z * z, 1e-12, 'welded, their sum');
  // A table: legs to z 730 under a top of rails on z 750, mitred; the first leg's top on the corner of rails 4 and 7.
  const pts = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 730], [600, 0, 730], [600, 400, 730], [0, 400, 730], [0, 0, 750], [600, 0, 750], [600, 400, 750], [0, 400, 750]];
  const t = run([{ id: 'f', kind: 'frame', points: pts, segments: [[0, 4], [1, 5], [2, 6], [3, 7], [8, 9], [9, 10], [10, 11], [11, 8]], section: SHARP, corners: { default: 'mitre' } }, bead({ member: 0, end: 'end' })]).output('w');
  // The inner sides' runs, 40 each: (x 20, y −20…20) on rail 4 and (y 20, x −20…20) on rail 7; their corner (x, y > 20) on neither.
  near(volume(t), 2 * 40 * z * z / 2, 1e-12, 'two runs');
  assert.deepEqual([t.bodyCount, t.bead.meets, t.bead.seam.flushMM], [2, [4, 7], 80]); assert.ok(t.validate().valid);
});

test('FRk2 a gusset\'s beads: both seams, both faces, (l − c)·z² a seam; their centroid by the four prisms\'; welded with the members and the gusset, their sum', () => {
  const s = run([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'mitre' } },
    { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [120, 100], thickness: 5, clip: 15 }, bead({ gusset: 'g' })]);
  const w = s.output('w'), VA = 105 * z * z, VB = 85 * z * z;
  near(volume(w), VA + VB, 1e-12, 'four runs'); assert.equal(w.bodyCount, 4);
  const c = w.massProperties(1).centroidMM;
  near(c[0], (VA * 87.5 + VB * (20 + z / 3)) / (VA + VB), 1e-12, 'x̄'); near(c[1], 0, 1e-12, 'ȳ'); near(c[2], (VA * (20 + z / 3) + VB * 77.5) / (VA + VB), 1e-12, 'z̄');
  assert.deepEqual([w.bead.on, w.bead.meets, w.bead.seam], [{ gusset: 'g' }, [0, 1], { lengthMM: 380, flushMM: 0, exact: true }]);
  const all = welded([...s.outputs.filter(o => o.member).map(o => o.brep), s.output('g').brep, w.brep]);
  assert.equal(all.bodies.length, 1);
  near(brepMassProperties(all, 1).volumeMM3, s.outputs.reduce((v, o) => v + volume(o), 0), 1e-9, 'welded, their sum');
});

test('FRk2 refusals: BEAD_KIND (a mitre, a cap, an end on nothing, inner without a bore), BEAD_SEAM_NOT_PLANAR (a cope), BEAD_ANGLE (a 60° butt), BEAD_SIZE (a clip under the leg, fillets off a gusset\'s face, a bore\'s rounds under the leg), INPUT and REFERENCE', () => {
  const L = { id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'mitre' } };
  refuse([L, bead({ member: 0, end: 'end' })], 'PARAMETER', /\[BEAD_KIND\] member 0's end is mitred: a mitre takes a groove weld/);
  refuse([L, { id: 'c', kind: 'end-cap', frame: 'f', member: 0, end: 'start', fit: 'over', thickness: 4 }, bead({ cap: 'c' })], 'PARAMETER', /\[BEAD_KIND\] a cap sits flush/);
  refuse([L, bead({ member: 0, end: 'start' })], 'PARAMETER', /\[BEAD_KIND\] member 0's start lands on no member's flat face of f/);
  refuse([tee(WIDE, { kind: 'angle', legX: 40, legY: 40, thickness: 4, rootRadius: 4, toeRadius: 0 }), bead({ member: 1, end: 'end' }, { inner: true })], 'PARAMETER', /\[BEAD_KIND\] member 1's end: its section has no bore/);
  refuse([{ ...tee({ kind: 'round-tube', diameter: 50, wall: 2 }, { kind: 'round-tube', diameter: 25, wall: 2 }), corners: { tee: 'cope' } }, bead({ member: 1, end: 'end' })], 'PARAMETER', /\[BEAD_SEAM_NOT_PLANAR\] member 1's end is coped/);
  refuse([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [300, 0, 400 + 300 * Math.sqrt(3)], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: WIDE, overrides: [{ member: 1, section: SHARP }], corners: { tee: 'butt' } }, bead({ member: 1, end: 'end' })], 'PARAMETER', /\[BEAD_ANGLE\] member 1's end meets its face at 60° from square/);
  const g = extra => [L, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [100, 100], thickness: 5, clip: 2, ...extra }, bead({ gusset: 'g' })];
  refuse(g({}), 'PARAMETER', /\[BEAD_SIZE\] gusset g's clip 2 is under the leg 3/);
  refuse(g({ clip: 5, thickness: 36 }), 'PARAMETER', /\[BEAD_SIZE\] gusset g's fillets run off member 0's flat face/);
  refuse([tee({ ...WIDE, width: 100, height: 100 }, { kind: 'rect-tube', width: 60, height: 60, wall: 4, outerRadius: 6 }), bead({ member: 1, end: 'end' }, { inner: true })], 'PARAMETER', /\[BEAD_SIZE\] member 1's end: a leg of 3 mm does not fit its bore/);
  refuse([tee(WIDE, SHARP), bead({ member: 1, end: 'middle' })], 'INPUT', /on.end must be start or end/);
  refuse([tee(WIDE, SHARP), bead({ member: 1, end: 'end' }, { leg: 0 })], 'PARAMETER', /leg/);
  refuse([tee(WIDE, SHARP), bead(5)], 'INPUT', /on must be/);
  refuse([tee(WIDE, SHARP), { id: 'x', kind: 'frame-member', section: SHARP, start: [0, 0, 0], end: [0, 0, 10] }, bead({ gusset: 'x' })], 'REFERENCE', /x is not a gusset/);
});
