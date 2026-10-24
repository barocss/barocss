import test from 'node:test';
import assert from 'node:assert/strict';
import { shaftSolid, seatedBearing, bearingEnvelope, bearingRowProblem, isBearingError, checkBrep, brepMassProperties, evaluateCadPart, outputOf } from '../dist/index.js';
import { brepBounds } from '../dist/brep/brep-bounds.js';

// R12c.4 (D158): bearing envelopes from the user's rows, on a shaft's seat and in a housing. The row is D139's B1 (the
// NSK 6204 page: d 20, D 47, B 14, r 1; da 25–26.5, Da max 42, ra max 1), a test row citing it; the rings' deviations
// and the fit rows are test values flagged estimates. Oracles written here: the envelope's Pappus volume (D139 S0's
// construction: the rectangle less four corner squares plus quarter discs, 19800.6522 mm³); the abutment rules by
// arithmetic on the row; the fits' clearances (hole − shaft) by arithmetic; no overlap by volumes.

const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volume;
const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want}`);
const code = c => e => isBearingError(e) && e.code === c;
const I = { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
const ROW = { id: '6204', designation: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, DaMax: 42, raMax: 1, source: 'B1 (D139): the NSK 6204 page' };
const FITS = [{ id: 'seat-fits', rows: [{ class: 'k5', over: 18, upTo: 30, upperUM: 11, lowerUM: 2, estimate: true }, { class: 'H7', over: 30, upTo: 50, upperUM: 25, lowerUM: 0, estimate: true }] }];
/** A shaft Ø25 × 30, Ø20 × 50 (the seat from z 30), a Ø19 × 1.3 groove `gap` beyond the bearing's 14. */
function shaft(over = {}) {
  const s = shaftSolid({ steps: [{ diameter: over.shoulder ?? 25, length: 30, fillet: over.fillet }, { diameter: over.seat ?? 20, length: over.seatLength ?? 50, grooves: over.gap === null ? [] : [{ diameter: 19, width: 1.3, at: 14 + (over.gap ?? 0.2) }] }] }, { id: 's' });
  return { report: s.report, place: I, brep: s.brep };
}
const S0 = (() => { const r = 1, y0 = 10, y1 = 23.5, B = 14, k = 4 * r / (3 * Math.PI), Ay = B * (y1 - y0) * (y0 + y1) / 2;
  return 2 * Math.PI * (Ay + 2 * (-(r * r) * (y0 + r / 2) + Math.PI * r * r / 4 * (y0 + r - k)) + 2 * (-(r * r) * (y1 - r / 2) + Math.PI * r * r / 4 * (y1 - r + k))); })();

test('R12c.4 envelope: a 6204 from the user\'s row — the rounded section revolved, Pappus (S0\'s 19800.6522); faces named; rows checked', () => {
  near(S0, 19800.6522, 1e-4, 'S0\'s figure');
  const e = bearingEnvelope(ROW, 'b');
  assert.equal(checkBrep(e).valid, true); assert.equal(checkBrep(e).topology[0].genus, 1);
  near(vol(e), S0, 1e-6, 'Pappus');
  assert.deepEqual([...new Set(e.faces.map(f => f.name.replace(/#\d+$/, '')))].sort(), ['b.bore', 'b.corner1', 'b.corner2', 'b.corner3', 'b.corner4', 'b.face0', 'b.face1', 'b.outside']);
  for (const [bad, why] of [[{ ...ROW, bore: undefined, boreMM: ROW.bore }, /unknown field boreMM/], [{ ...ROW, source: undefined }, /never neither/], [{ ...ROW, estimate: true }, /not both/], [{ ...ROW, outside: 18 }, /must exceed its bore/], [{ ...ROW, chamfer: 8 }, /too large/], [{ ...ROW, daMin: 27 }, /da min is above da max/], [{ ...ROW, boreDeviationUM: [-10, 0] }, /upper ≥ lower/], [{ ...ROW, extra: 1 }, /unknown field/]])
    assert.match(bearingRowProblem(bad) ?? 'accepted', why);
  assert.equal(bearingRowProblem(ROW), null);
});

test('R12c.4 seat: on the Ø20 seat against the Ø25 shoulder (within da 25–26.5, sharp: within ra max 1), the other side by the ring groove — no overlap with the shaft (S0: untouched)', () => {
  const sh = shaft(), b = seatedBearing(ROW, sh, { step: 2, against: 'start' }, 'b');
  assert.equal(checkBrep(b.brep).valid, true);
  const bb = brepBounds(b.brep); near(bb.min[2], 30, 1e-9, 'against the shoulder'); near(bb.max[2], 44, 1e-9, 'B'); near(bb.max[0], 23.5, 1e-9, 'D/2');
  assert.deepEqual([b.report.seat.shoulder, b.report.seat.located, b.report.warnings], [25, 'ring groove 1', []]);
  near(b.report.seat.overlap, 0, 1e-9 * vol(sh.brep), 'no overlap');
  assert.equal(b.report.notForStructuralCalculation, true); assert.equal(b.report.source, 'B1 (D139): the NSK 6204 page');
  // A fillet r 0.8 at the shoulder clears the bearing's r 1 corner.
  const f = seatedBearing(ROW, shaft({ fillet: 0.8 }), { step: 2, against: 'start' }, 'b');
  near(f.report.seat.overlap, 0, 1e-6, 'fillet 0.8 under the r 1 corner'); near(f.report.seat.shoulderFillet, 0.8, 0, 'fillet');
  // Against the seat's end instead: no shoulder there (it ends the shaft).
  assert.throws(() => seatedBearing(ROW, sh, { step: 2, against: 'end' }, 'b'), e => code('SEAT_ABUTMENT')(e) && /no shoulder at its end/.test(e.message));
  // No groove: the other side unlocated, a warning.
  assert.match(seatedBearing(ROW, shaft({ gap: null }), { step: 2, against: 'start' }, 'b').report.warnings[0], /not located/);
  // A groove 2 mm off the face is no location.
  assert.equal(seatedBearing(ROW, shaft({ gap: 2 }), { step: 2, against: 'start' }, 'b').report.seat.located, null);
});

test('R12c.4 refusals: SEAT_ABUTMENT for a shoulder outside da min…da max, a fillet past ra max, a seat shorter than B; SEAT_FIT for a seat not at the bore\'s size', () => {
  for (const [over, why] of [[{ shoulder: 27 }, /above da max 26\.5/], [{ shoulder: 24.5 }, /below da min 25/], [{ fillet: 1.5 }, /fillet r 1\.5 exceeds ra max 1/], [{ seatLength: 10, gap: null }, /shorter than the bearing's 14/]])
    assert.throws(() => seatedBearing(ROW, shaft(over), { step: 2, against: 'start' }, 'b'), e => code('SEAT_ABUTMENT')(e) && why.test(e.message), JSON.stringify(over));
  assert.throws(() => seatedBearing(ROW, shaft({ seat: 20.5 }), { step: 2, against: 'start' }, 'b'), e => code('SEAT_FIT')(e) && /bore is Ø20/.test(e.message));
  // Without ra max in its row, the bearing's own corner r bounds the fillet.
  const noRa = { ...ROW, raMax: undefined };
  assert.throws(() => seatedBearing(noRa, shaft({ fillet: 1.2 }), { step: 2, against: 'start' }, 'b'), e => code('SEAT_ABUTMENT')(e) && /the bearing's corner r 1/.test(e.message));
  assert.throws(() => seatedBearing(ROW, shaft(), { step: 3, against: 'start' }, 'b'), code('INVALID_INPUT'));
});

test('R12c.4 housing and fits: a Ø47 bore on the axis covers it, no overlap; k5 on the shaft against the bore\'s [0, −10] is interference −21…−2, H7 in the housing against the OD\'s [0, −11] clearance 0…+36 (arithmetic, test rows)', () => {
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  const housing = (dx, z0 = 28, h = 20) => outputOf(evaluateCadPart(D([{ id: 'o', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 35, plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'oe', kind: 'extrude', sketch: 'o', height: h },
    { id: 'c', kind: 'sketch', profile: 'circle', center: [dx, 0], radius: 23.5, plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'ce', kind: 'extrude', sketch: 'c', height: 100 }, { id: 'h', kind: 'difference', target: 'oe', tool: 'ce' }])), 'h').brep;
  const row = { ...ROW, boreDeviationUM: [0, -10], outsideDeviationUM: [0, -11] };
  const b = seatedBearing(row, shaft(), { step: 2, against: 'start', housing: housing(0), fit: { tables: FITS, shaft: 'k5', housing: 'H7' } }, 'b');
  // (A plain through bore has no shoulder: FRk8a says so, D181.)
  assert.deepEqual([b.report.housing.covered, b.report.housing.shoulder, b.report.warnings], [true, null, ['the housing has no shoulder at either face of the bearing: its outer ring is not located (a cover or a ring is not modelled)']]); near(b.report.housing.overlap, 0, 1e-6, 'housing');
  assert.deepEqual([b.report.shaftFit.kind, b.report.shaftFit.clearanceMinUM, b.report.shaftFit.clearanceMaxUM], ['interference', -21, -2]);
  assert.deepEqual([b.report.housingFit.kind, b.report.housingFit.clearanceMinUM, b.report.housingFit.clearanceMaxUM], ['clearance', 0, 36]);
  assert.throws(() => seatedBearing(row, shaft(), { step: 2, against: 'start', housing: housing(0.5) }, 'b'), e => code('SEAT_FIT')(e) && /no Ø47 bore on the bearing's axis/.test(e.message));
  assert.match(seatedBearing(row, shaft(), { step: 2, against: 'start', housing: housing(0, 34, 6) }, 'b').report.warnings[0], /does not cover the bearing/);
  assert.throws(() => seatedBearing(row, shaft(), { step: 2, against: 'start', fit: { tables: FITS, shaft: 'm6' } }, 'b'), e => code('SEAT_FIT')(e) && /load a row for m6/.test(e.message));
  // Without the rings' deviations: the seat's limits only.
  const plain = seatedBearing(ROW, shaft(), { step: 2, against: 'start', fit: { tables: FITS, shaft: 'k5' } }, 'b');
  assert.deepEqual([plain.report.shaftFit.limit.min, plain.report.shaftFit.limit.max, plain.report.shaftFit.kind], [20.002, 20.011, undefined]);
});

test('R12c.4 part model: a shaft turned and moved, a bearing on its seat and in a housing; the codes mapped', () => {
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  const feats = [{ id: 's', kind: 'shaft', steps: [{ diameter: 25, length: 30 }, { diameter: 20, length: 50, grooves: [{ diameter: 19, width: 1.3, at: 14.2 }] }], center: [60, 0], from: 5, rotation: 30 },
    { id: 'o', kind: 'sketch', profile: 'circle', center: [60, 0], radius: 35, plane: { origin: [0, 0, 33], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'oe', kind: 'extrude', sketch: 'o', height: 20 },
    { id: 'c', kind: 'sketch', profile: 'circle', center: [60, 0], radius: 23.5, plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'ce', kind: 'extrude', sketch: 'c', height: 100 }, { id: 'h', kind: 'difference', target: 'oe', tool: 'ce' },
    { id: 'b', kind: 'bearing', row: ROW, shaft: 's', step: 2, against: 'start', housing: 'h' }];
  const snap = evaluateCadPart(D(feats)), b = outputOf(snap, 'b'), bb = brepBounds(b.brep);
  near(bb.min[2], 35, 1e-9, 'z'); near((bb.min[0] + bb.max[0]) / 2, 60, 1e-9, 'x'); assert.equal(b.bearing.seat.located, 'ring groove 1'); assert.equal(b.bearing.housing.covered, true);
  assert.ok(snap.outputs.some(o => o.id === 's') && snap.outputs.some(o => o.id === 'h'), 'the shaft and the housing stay outputs');
  const refused = (patch, c, tag) => assert.throws(() => evaluateCadPart(D(feats.map(f => f.id === 'b' ? { ...f, ...patch } : f))), e => (e.details?.category ?? e.code) === c && e.message.includes(`[${tag}]`), tag);
  refused({ row: { ...ROW, daMax: 24.9, daMin: 22 } }, 'GEOMETRY', 'SEAT_ABUTMENT');
  refused({ row: { ...ROW, bore: 17 } }, 'GEOMETRY', 'SEAT_FIT');
  refused({ row: { ...ROW, source: undefined } }, 'INPUT', 'INVALID_INPUT');
});
