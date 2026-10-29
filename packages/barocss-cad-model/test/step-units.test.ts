import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLengthUnit } from '../src/engine/stepUnits';
import { pdfMissing } from '../src/io/pdf';
import { isRefusal } from '../src/engine/refusal';

test('STEP length units: millimetres, metres, inches, none declared', () => {
  assert.deepEqual(stepLengthUnit("#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#11=( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );"), { name: 'millimetres', to: 1, declared: true });
  assert.deepEqual(stepLengthUnit('#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT($,.METRE.) );'), { name: 'metres', to: 1000, declared: true });
  assert.deepEqual(stepLengthUnit("#5=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#10);\n#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#12=( CONVERSION_BASED_UNIT('INCH',#5) LENGTH_UNIT() NAMED_UNIT(#3) );").to, 25.4);
  assert.equal(stepLengthUnit("#4=( CONVERSION_BASED_UNIT('DEGREE',#6) NAMED_UNIT(#7) PLANE_ANGLE_UNIT() );\n#10=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );\n#12=( CONVERSION_BASED_UNIT('INCH',#5) LENGTH_UNIT() NAMED_UNIT(#3) );").to, 25.4, 'an angle unit first');
  assert.deepEqual(stepLengthUnit('DATA; #1=CARTESIAN_POINT(\'\',(0.,0.,0.)); ENDSEC;'), { name: 'millimetres', to: 1, declared: false });
});

test('PDF: characters its standard fonts cannot show are found', () => {
  const sheet = { size: [297, 210] as [number, number], dimensions: [], groups: [{ role: 'note' as const, marks: [{ kind: 'text' as const, at: [0, 0] as [number, number], text: 'Ø8 ±0.1 — 볼트 ⌀', size: 3 }] }] };
  assert.deepEqual(pdfMissing(sheet as never), ['볼', '트', '⌀']);
});

test('STEP supported prefixes and no-prefix declarations retain their exact factors in either entity order', () => {
  for (const [prefix, name, to] of [['MILLI', 'millimetres', 1], ['CENTI', 'centimetres', 10], ['DECI', 'decimetres', 100], ['KILO', 'kilometres', 1e6], ['MICRO', 'micrometres', 1e-3], ['', 'metres', 1000]] as const) {
    const si = `SI_UNIT(${prefix ? `.${prefix}.` : '$'},.METRE.)`;
    for (const entity of [`LENGTH_UNIT() NAMED_UNIT(*) ${si}`, `${si} NAMED_UNIT(*) LENGTH_UNIT()`]) assert.deepEqual(stepLengthUnit(`#10=(${entity});`), { name, to, declared: true });
  }
  assert.deepEqual(stepLengthUnit("#12=(CONVERSION_BASED_UNIT('FOOT',#5) LENGTH_UNIT() NAMED_UNIT(#3));"), { name: 'feet', to: 304.8, declared: true });
});

test('STEP declared unsupported SI length prefixes are typed refusals even beside supported length declarations', () => {
  const mm = '#10=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));';
  const inch = "#12=(CONVERSION_BASED_UNIT('INCH',#5) LENGTH_UNIT() NAMED_UNIT(#3));";
  for (const prefix of ['NANO', 'PICO', 'UNSUPPORTED']) for (const entity of [`LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.${prefix}.,.METRE.)`, `SI_UNIT(.${prefix.toLowerCase()}.,.METRE.) NAMED_UNIT(*) LENGTH_UNIT()`]) {
    const declared = `#20=(${entity});`;
    for (const text of [declared, mm + declared, declared + mm, inch + declared, declared + inch]) assert.throws(() => stepLengthUnit(text), error => isRefusal(error, 'NOT_READ') && error.message.includes(prefix) && /unsupported.*length.*prefix/i.test(error.message));
  }
  const angle = '#3=(PLANE_ANGLE_UNIT() NAMED_UNIT(*) SI_UNIT(.NANO.,.RADIAN.));';
  assert.deepEqual(stepLengthUnit(angle), { name: 'millimetres', to: 1, declared: false });
  assert.deepEqual(stepLengthUnit(angle + mm), { name: 'millimetres', to: 1, declared: true });
});
