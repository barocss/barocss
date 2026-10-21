import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLengthUnit } from '../src/engine/stepUnits';
import { pdfMissing } from '../src/drawing/pdf';

test('STEP length units: millimetres, metres, inches, none declared', () => {
  assert.deepEqual(stepLengthUnit("#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#11=( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );"), { name: 'millimetres', toMM: 1, declared: true });
  assert.deepEqual(stepLengthUnit('#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT($,.METRE.) );'), { name: 'metres', toMM: 1000, declared: true });
  assert.deepEqual(stepLengthUnit("#5=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#10);\n#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#12=( CONVERSION_BASED_UNIT('INCH',#5) LENGTH_UNIT() NAMED_UNIT(#3) );").toMM, 25.4);
  assert.equal(stepLengthUnit("#4=( CONVERSION_BASED_UNIT('DEGREE',#6) NAMED_UNIT(#7) PLANE_ANGLE_UNIT() );\n#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#12=( CONVERSION_BASED_UNIT('INCH',#5) LENGTH_UNIT() NAMED_UNIT(#3) );").toMM, 25.4, 'an angle unit first');
  assert.deepEqual(stepLengthUnit('DATA; #1=CARTESIAN_POINT(\'\',(0.,0.,0.)); ENDSEC;'), { name: 'millimetres', toMM: 1, declared: false });
});

test('PDF: characters its standard fonts cannot show are found', () => {
  const sheet = { size: [297, 210] as [number, number], dimensions: [], groups: [{ role: 'note' as const, marks: [{ kind: 'text' as const, at: [0, 0] as [number, number], text: 'Ø8 ±0.1 — 볼트 ⌀', size: 3 }] }] };
  assert.deepEqual(pdfMissing(sheet as never), ['볼', '트', '⌀']);
});
