import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/engine/evaluate';
import { evaluateCadPart, type BearingRow } from '@barocss/cad';
import { commands, type Ctx } from '../src/app/commands';
import { emptyDoc } from '../src/engine/doc';
import { toPartDocument } from '../src/engine/part';
import { bearingInExternalHousing, relativeHousingPose, type HousingPose } from '../src/engine/bearingHousing';

// Source cases only until the A9-7 execution lease. This helper is not the saved link or the UI integration.
const origin: HousingPose = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
const turned: HousingPose = { m: [0, -1, 0, 1, 0, 0, 0, 0, 1], t: [100, 50, 7] };
const row: BearingRow = { id: '6204-test', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, raMax: 1, outsideDeviationUM: [0, -11], source: 'A9-7 test row' };
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
function bodies(bore = 47, height = 20) {
  const shaft = cmd('shaft'), tube = cmd('tube');
  const s = shaft.build!(blank, { ...shaft.defaults!(blank), ks: 0, gs: 0, r: 0 });
  const h = tube.build!(blank, { ...tube.defaults!(blank), r: 35, ri: bore / 2, h: height, x: 0, y: 0, z: 14 });
  const own = evaluateCadPart(toPartDocument(s)).outputs[0], target = evaluateCadPart(toPartDocument(h)).outputs[0];
  assert.ok(own.shaft);
  return { shaft: { report: own.shaft, brep: own.brep, place: { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] as const, offset: [0, 0, 0] as const } }, target: target.brep };
}

test('A9-7 geometry: current relative poses cancel a common rotation and translation', () => {
  assert.deepEqual(relativeHousingPose(turned, turned), { matrix: origin.m, offset: origin.t });
  assert.deepEqual(relativeHousingPose(turned, { ...turned, t: [100, 51, 7] }).offset, [1, 0, 0]);
  const { shaft, target } = bodies(), before = JSON.stringify({ row, shaft, target });
  const result = bearingInExternalHousing({ row, shaft, ownerPose: turned, target: { brep: target, pose: turned }, step: 1, against: 'end', id: 'bearing-test', fit: { tables: [{ id: 'test-fits', rows: [{ class: 'H7', over: 30, upTo: 50, lowerUM: 0, upperUM: 25, estimate: true }] }], housing: 'H7' } });
  assert.equal(result.report.housing!.bore, 47); assert.equal(result.report.housing!.covered, true);
  assert.ok(Math.abs(result.report.housing!.overlap) < 1e-6);
  assert.equal(result.report.source, row.source); assert.equal(result.report.estimate, false);
  assert.equal(result.report.housingFit!.limit.class, 'H7'); assert.equal(result.report.housingFit!.limit.estimate, true);
  assert.equal(result.report.housingFit!.clearanceMinUM, 0); assert.equal(result.report.housingFit!.clearanceMaxUM, 36);
  assert.equal(JSON.stringify({ row, shaft, target }), before, 'the actual geometry and row are not rewritten');
});

test('A9-7 geometry: off-axis and wrong-diameter targets use the actual native refusal', () => {
  const { shaft, target } = bodies();
  const run = (brep = target, pose = origin) => bearingInExternalHousing({ row, shaft, ownerPose: origin, target: { brep, pose }, step: 1, against: 'end', id: 'bearing-test' });
  assert.throws(() => run(target, { ...origin, t: [1, 0, 0] }), /no Ø47 bore on the bearing's axis/);
  assert.throws(() => run(target, { m: [1, 0, 0, 0, 0, -1, 0, 1, 0], t: origin.t }), /no Ø47 bore on the bearing's axis/);
  assert.throws(() => run(bodies(48).target), /no Ø47 bore on the bearing's axis/);
});

test('A9-7 geometry: a short real bore remains partial, with the native warning retained', () => {
  const { shaft, target } = bodies(47, 5);
  const result = bearingInExternalHousing({ row, shaft, ownerPose: origin, target: { brep: target, pose: origin }, step: 1, against: 'end', id: 'bearing-test' });
  assert.equal(result.report.housing!.covered, false);
  assert.ok(result.report.warnings.some(w => w.includes('does not cover the bearing')));
});

test('A9-7 geometry: absent exact target and invalid/non-rigid poses do not return a checked housing', () => {
  const { shaft } = bodies();
  assert.throws(() => bearingInExternalHousing({ row, shaft, ownerPose: origin, step: 1, against: 'end', id: 'bearing-test' }), /BEARING_HOUSING_REFERENCE/);
  for (const invalid of [{ ...origin, m: [1, 0] }, { ...origin, t: [NaN, 0, 0] }, { ...origin, m: [2, 0, 0, 0, 1, 0, 0, 0, 1] }, { ...origin, m: [-1, 0, 0, 0, 1, 0, 0, 0, 1] }]) {
    assert.throws(() => relativeHousingPose(invalid, origin), /BEARING_HOUSING_POSE/);
    assert.throws(() => relativeHousingPose(origin, invalid), /BEARING_HOUSING_POSE/);
  }
});
