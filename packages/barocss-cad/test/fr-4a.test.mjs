import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, cutPiece, cutList, cutListCsv } from '../dist/index.js';

// FR4a (D127): a frame's cut list. Oracles written here: axis lengths by closed form (the corners' planes on the centroidal
// line), long points L + (b/2)·tan α, a compound mitre's angles atan(cos ρ·tan θ) and atan(sin ρ·tan θ), mass ρ·A·L, the
// rows by hand, the totals their sums. Densities and sizes are test values.
const D = (features) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = (features) => evaluateCadPart(D(features));
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want}`);
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A = 1600 - 34 * 34, RHO = 7850;
const listOf = (snap, more = {}) => cutList(snap.outputs.filter(o => o.member).map(cutPiece), { densityKgPerM3: RHO, ...more });
const unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };

test('FR4a a mitred rectangle: two rows (600 × 2, 400 × 2), axis lengths and long points L + b, 45° ends, mass ρ·A·L; the totals', () => {
  const s = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], section: SHARP, corners: { default: 'mitre' } }]);
  const list = listOf(s, { material: 'steel (test)' });
  assert.deepEqual(list.rows.map(r => [r.item, r.quantity, r.pieces]), [[1, 2, ['f/0', 'f/2']], [2, 2, ['f/1', 'f/3']]]);
  list.rows.forEach((r, k) => {
    const L = k ? 400 : 600;
    near(r.axisLengthMM, L, 1e-12, `row ${k} axis`); near(r.longPointMM, L + 40, 1e-12, `row ${k} long point`); assert.equal(r.fromVolume, false);
    r.ends.forEach(e => { assert.equal(e.kind, 'mitre'); near(e.mitreDegrees, 45, 1e-12, 'mitre'); near(e.bevelDegrees, 0, 1e-12, 'bevel'); });
    near(r.massKG, RHO * A * L * 1e-9, 1e-12, `row ${k} mass`); near(r.totalMassKG, 2 * RHO * A * L * 1e-9, 1e-12, `row ${k} total`);
  });
  assert.equal(list.totals.quantity, 4); near(list.totals.axisLengthMM, 2000, 1e-12, 'total length'); near(list.totals.massKG, RHO * A * 2000 * 1e-9, 1e-12, 'total mass');
  // The rows' mass against the bodies' own (planar: exact).
  near(list.totals.massKG, s.outputs.reduce((m, o) => m + o.massProperties(RHO).massKG, 0), 1e-12, 'against the bodies');
});

test('FR4a an ordered table: legs (720, square, ×4) and two rails each way (by volume: 560 and 360); a 60° butt: the through member L + (b/2)sin φ, the other L − (b/2)/sin φ, its cut 30°, long point L_c + (b/2)tan 30°', () => {
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]];
  const t = listOf(run([{ id: 't', kind: 'frame', points, segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], section: SHARP, corners: { multi: 'order' } }]));
  assert.deepEqual(t.rows.map(r => [r.quantity, Math.round(r.axisLengthMM * 1e6) / 1e6, r.fromVolume]), [[4, 720, false], [2, 560, true], [2, 360, true]]);
  near(t.rows[1].longPointMM, 560, 1e-12, 'rail long point'); assert.deepEqual(t.rows[0].ends.map(e => e.kind), ['square', 'through']);
  near(t.totals.massKG, RHO * A * (4 * 720 + 2 * 560 + 2 * 360) * 1e-9, 1e-12, 'table mass');
  const phi = Math.PI / 3, P = [400, 0, 0], F = [400 - 300 * Math.cos(phi), 300 * Math.sin(phi), 0];
  const b = listOf(run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], P, F], segments: [[0, 1], [2, 1]], section: SHARP, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }]));
  const [through, butt] = b.rows, Lc = 300 - 20 / Math.sin(phi);
  near(through.axisLengthMM, 400 + 20 * Math.sin(phi), 1e-12, 'through'); near(butt.axisLengthMM, Lc, 1e-12, 'butt');
  near(butt.ends[1].mitreDegrees, 30, 1e-12, 'butt cut'); near(butt.ends[1].bevelDegrees, 0, 1e-12, 'no bevel');
  near(butt.longPointMM, Lc + 20 * Math.tan(Math.PI / 6), 1e-12, 'butt long point');
});

test('FR4a a compound mitre: a 3D corner, both members rolled ρ — mitre atan(cos ρ·tan θ), bevel atan(sin ρ·tan θ) on each end', () => {
  const p0 = [0, 0, 0], p = [200, 0, 0], p2 = [260, 90, 70], u1 = [1, 0, 0], u2 = unit(p2.map((x, k) => x - p[k]));
  const n = unit([u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]]), m = unit(u1.map((x, k) => x + u2[k]));
  const theta = Math.acos(u1[0] * m[0] + u1[1] * m[1] + u1[2] * m[2]);
  for (const rho of [0, 30, 60]) {
    const list = listOf(run([{ id: 'f', kind: 'frame', points: [p0, p, p2], segments: [[0, 1], [1, 2]], section: { ...SHARP, width: 60, height: 30 }, up: n, roll: rho, corners: { default: 'mitre' } }]));
    const r = rho * Math.PI / 180, mitre = Math.atan(Math.cos(r) * Math.tan(theta)) * 180 / Math.PI, bevel = Math.atan(Math.sin(r) * Math.tan(theta)) * 180 / Math.PI;
    const ends = list.rows.flatMap(row => row.ends.filter(e => e.kind === 'mitre'));
    assert.equal(ends.length, 2, `roll ${rho}`);
    ends.forEach(e => { near(e.mitreDegrees, mitre, 1e-9, `roll ${rho} mitre`); near(e.bevelDegrees, bevel, 1e-9, `roll ${rho} bevel`); });
  }
});

test('FR4a grouping: a reversible section\'s pieces match end for end; an angle\'s do not; a mirrored angle is its own row; a cope by its volume', () => {
  // A Z of flat tubes mitred at its two bends: the first piece square then mitred, the last mitred then square — the same
  // piece reversed (a tube is symmetric), so one row of two; the middle one its own.
  const flat = { ...SHARP, width: 40, height: 20, wall: 2 };
  const z = listOf(run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [500, 0, 0], [500, 300, 0], [1000, 300, 0]], segments: [[0, 1], [1, 2], [2, 3]], section: flat, corners: { default: 'mitre' } }]));
  assert.deepEqual(z.rows.map(r => [r.quantity, r.pieces]), [[2, ['f/0', 'f/2']], [1, ['f/1']]]);
  assert.deepEqual(z.rows[0].ends.map(e => e.kind), ['square', 'mitre']);
  // By hand: the same two pieces with a section that is not reversible (an angle) are two rows; reversible, one.
  const piece = (id, ends, reversible) => ({ id, section: 's', areaMM2: 100, mirrored: false, reversible, axisLengthMM: 500, fromVolume: false, longPointMM: 520, volumeMM3: 50000, ends });
  const sq = (end) => ({ end, kind: 'square', point: 0, mitreDegrees: 0, bevelDegrees: 0 }), mi = (end) => ({ end, kind: 'mitre', point: 1, mitreDegrees: 45, bevelDegrees: 0 });
  assert.equal(cutList([piece('a', [sq('start'), mi('end')], false), piece('b', [mi('start'), sq('end')], false)], { densityKgPerM3: RHO }).rows.length, 2);
  assert.equal(cutList([piece('a', [sq('start'), mi('end')], true), piece('b', [mi('start'), sq('end')], true)], { densityKgPerM3: RHO }).rows.length, 1);
  // A section's reversibility from its shape: a tube and a channel yes, an angle no.
  const rev = (section) => run([{ id: 'm', kind: 'frame-member', section, start: [0, 0, 0], end: [100, 0, 0] }]).output('m').member.reversible;
  assert.deepEqual([rev(SHARP), rev({ kind: 'channel', height: 80, width: 40, web: 5, flange: 8, rootRadius: 7 }), rev({ kind: 'angle', legX: 50, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 3 })], [true, true, false]);
  // Angles mirrored by override: the two stiles of a ladder, one turned over — two rows; unmirrored: one row of two.
  const ang = { kind: 'angle', legX: 50, legY: 30, thickness: 5, rootRadius: 6, toeRadius: 3 }, ladder = (o) => listOf(run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 1000, 0], [400, 0, 0], [400, 1000, 0]], segments: [[0, 1], [2, 3]], section: ang, anchor: 'origin', ...o }]));
  assert.deepEqual(ladder({}).rows.map(r => [r.quantity, r.mirrored]), [[2, false]]);
  assert.deepEqual(ladder({ overrides: [{ member: 1, mirror: true }] }).rows.map(r => [r.quantity, r.mirrored]), [[1, false], [1, true]]);
  // A coped T-joint: by volume, its mass ρ·V.
  const tee = run([{ id: 'f', kind: 'frame', points: [[-100, 0, 0], [100, 0, 0], [0, 0, 150], [0, 0, 0]], segments: [[0, 1], [2, 3]], section: { kind: 'round-tube', diameter: 50, wall: 2 }, overrides: [{ member: 1, section: { kind: 'round-tube', diameter: 25, wall: 2 } }], corners: { tee: 'cope' } }]);
  const c = listOf(tee).rows[1];
  assert.equal(c.fromVolume, true); assert.equal(c.ends[1].kind, 'cope'); assert.equal(c.ends[1].mitreDegrees, null);
  near(c.massKG, tee.outputs[1].massProperties(RHO).massKG, 1e-12, 'cope mass');
});

test('FR4a the CSV: a header, a row a group, the total; refusals NOT_A_MEMBER and DENSITY', () => {
  const s = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], section: SHARP, corners: { default: 'mitre' } }]);
  const csv = cutListCsv(listOf(s)).trim().split('\n');
  assert.equal(csv[0], 'item,quantity,section,material,axis length (mm),long point (mm),start cut,end cut,mass each (kg),mass (kg),pieces');
  assert.equal(csv.length, 4);
  assert.equal(csv[1], `1,2,rect-tube 40 × 40 × 3,,600,640,mitre 45°,mitre 45°,${Math.round(RHO * A * 600e-9 * 1e6) / 1e6},${Math.round(2 * RHO * A * 600e-9 * 1e6) / 1e6},f/0 f/2`);
  assert.match(csv[3], /^total,4,,,2000,,,,,/);
  // Pieces of their own materials: apart, each by its density.
  const pieces = s.outputs.map(cutPiece), mixed = cutList([{ ...pieces[0], material: 'al', densityKgPerM3: 2700 }, ...pieces.slice(1)], { densityKgPerM3: RHO, material: 'steel' });
  assert.deepEqual(mixed.rows.map(r => [r.quantity, r.material]), [[1, 'al'], [2, 'steel'], [1, 'steel']]);
  near(mixed.rows[0].massKG, 2700 * A * 600e-9, 1e-12, 'its own density');
  const box = run([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }]).output('e');
  assert.throws(() => cutPiece(box), /\[NOT_A_MEMBER\] e is not a frame member/);
  assert.throws(() => cutList([], { densityKgPerM3: 0 }), /\[DENSITY\]/);
});
