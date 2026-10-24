import test from 'node:test';
import assert from 'node:assert/strict';
import { shaftSolid, seatedBearing, isBearingError, evaluateCadPart } from '../dist/index.js';

// FRk8a (D181): D158's housing shoulder against the row's Da max, found from the housing's faces. The row is D139's B1
// (the NSK 6204 page: d 20, D 47, B 14, r 1; da 25–26.5, Da max 42, ra max 1), a test row citing it. The housings are
// turned profiles written here; the oracle is the profile's own shoulder radius (arithmetic) against Da max ± 0.5.
const ROW = { id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, source: 'B1 (D139): the NSK 6204 page' };
const I = { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const code = c => e => isBearingError(e) && e.code === c;
/** The shaft of R12c.4's tests: Ø25 × 30, then the Ø20 seat from z 30; a ring groove 0.2 mm beyond the bearing's 14. */
function shaft() {
  const s = shaftSolid({ steps: [{ diameterMM: 25, lengthMM: 30 }, { diameterMM: 20, lengthMM: 50, grooves: [{ diameterMM: 19, widthMM: 1.3, atMM: 14.2 }] }] }, { id: 's' });
  return { report: s.report, place: I, brep: s.brep };
}
/** A housing turned about +Z from an (r, z) profile: the Ø47 seat over z 30–46, and its shoulder of radius rs at z 30 (below) or z 44 (above). */
function housing(rs, at = 'start') {
  const prof = at === 'start' ? [[rs, 26], [35, 26], [35, 46], [23.5, 46], [23.5, 30], [rs, 30]] : [[23.5, 26], [35, 26], [35, 48], [rs, 48], [rs, 44], [23.5, 44]];
  return evaluateCadPart(D([{ id: 'hs', kind: 'sketch', profile: 'loop', segments: prof.map(start => ({ kind: 'line', start })), plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
    { id: 'h', kind: 'revolve', sketch: 'hs', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }])).output('h').brep;
}

test('FRk8a the housing\'s shoulder from its faces: Ø40 and Ø41.5 (Da max 42 less 2 and 0.5) found at the bearing\'s located face and held; Ø42.5 (Da max + 0.5) refused SEAT_ABUTMENT', () => {
  for (const dia of [40, 41.5]) {
    const b = seatedBearing(ROW, shaft(), { step: 2, against: 'start', housing: housing(dia / 2) }, 'b');
    assert.deepEqual(b.report.housing.shoulder, { at: 'start', diameterMM: dia }, `Ø${dia}`);
    assert.deepEqual(b.report.warnings, [], `Ø${dia}: located, no warning`);
    assert.equal(b.report.housing.covered, true);
  }
  assert.throws(() => seatedBearing(ROW, shaft(), { step: 2, against: 'start', housing: housing(42.5 / 2) }, 'b'), e => code('SEAT_ABUTMENT')(e) && /shoulder Ø42\.5 at the bearing's start is above Da max 42/.test(e.message));
  // Without a Da max in the row the shoulder is found and reported, not checked.
  const { DaMaxMM, ...noDa } = ROW;
  assert.deepEqual(seatedBearing(noDa, shaft(), { step: 2, against: 'start', housing: housing(42.5 / 2) }, 'b').report.housing.shoulder, { at: 'start', diameterMM: 42.5 });
});

test('FRk8a a shoulder on the other face only is reported there with a warning; above Da max there it is refused too', () => {
  const b = seatedBearing(ROW, shaft(), { step: 2, against: 'start', housing: housing(20, 'end') }, 'b');
  assert.deepEqual(b.report.housing.shoulder, { at: 'end', diameterMM: 40 });
  assert.deepEqual(b.report.warnings, ['the housing has no shoulder at the bearing\'s start (its shaft\'s located side), only at its end']);
  assert.throws(() => seatedBearing(ROW, shaft(), { step: 2, against: 'start', housing: housing(21.5, 'end') }, 'b'), code('SEAT_ABUTMENT'));
});

test('FRk8a through the part model: the bearing\'s report carries the housing\'s shoulder; above Da max the code maps to GEOMETRY [SEAT_ABUTMENT]', () => {
  const feats = rs => [{ id: 's', kind: 'shaft', steps: [{ diameter: 25, length: 30 }, { diameter: 20, length: 50, grooves: [{ diameter: 19, width: 1.3, at: 14.2 }] }] },
    { id: 'hs', kind: 'sketch', profile: 'loop', segments: [[rs, 26], [35, 26], [35, 46], [23.5, 46], [23.5, 30], [rs, 30]].map(start => ({ kind: 'line', start })), plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
    { id: 'h', kind: 'revolve', sketch: 'hs', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 },
    { id: 'b', kind: 'bearing', row: ROW, shaft: 's', step: 2, against: 'start', housing: 'h' }];
  assert.deepEqual(evaluateCadPart(D(feats(20))).output('b').bearing.housing.shoulder, { at: 'start', diameterMM: 40 });
  assert.throws(() => evaluateCadPart(D(feats(21.25))), e => e.code === 'GEOMETRY' && e.message.includes('[SEAT_ABUTMENT]'));
});
