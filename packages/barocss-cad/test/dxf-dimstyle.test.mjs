import test from 'node:test';
import assert from 'node:assert/strict';
import { writeDxf, isDxfWriteError } from '../dist/index.js';

function records(text) {
  const lines = text.trimEnd().split('\n'), records = [];
  let current;
  for (let i = 0; i < lines.length; i += 2) {
    const pair = [Number(lines[i]), lines[i + 1]];
    if (pair[0] === 0) { current = []; records.push(current); }
    current?.push(pair);
  }
  return records;
}
const styleOf = text => records(text).find(r => r[0][1] === 'DIMSTYLE');
function withoutTextStyle(text) {
  return records(text).map(record => record[0][1] === 'DIMSTYLE' ? record.filter(([code]) => ![140, 77, 73, 74].includes(code)) : record);
}
const entity = {
  type: 'dimension', geometry: { kind: 'linear', p1: [0, 0], p2: [30, 0], line: [0, 10], angle: 0 },
  text: '1.181 [30]', textAt: [15, 10], measurement: 30,
  block: [{ type: 'text', text: '1.181 [30]', at: [15, 10], height: 3 }],
};
for (const version of ['AC1015', 'AC1009']) {
  test(`${version}: explicit dimension text defaults do not alter blocks, entities, units or reports`, () => {
    const doc = { units: 'mm', entities: [entity] }, legacy = writeDxf(doc, { version });
    const old = new Map(styleOf(legacy.text));
    assert.equal(Number(old.get(140)), 3.5); assert.equal(Number(old.get(77)), 1);
    assert.ok(!old.has(73) && !old.has(74), 'omitted style retains legacy byte sequence');
    assert.deepEqual(writeDxf({ ...doc, dimensionStyle: undefined }, { version }), legacy);
    for (const textHeight of [0.125, 4.75]) for (const textPlacement of ['above', 'center']) for (const textOrientation of ['aligned', 'horizontal']) {
      const result = writeDxf({ ...doc, dimensionStyle: { textHeight, textPlacement, textOrientation } }, { version });
      const style = new Map(styleOf(result.text));
      assert.equal(Number(style.get(140)), textHeight);
      assert.equal(Number(style.get(77)), textPlacement === 'above' ? 1 : 0);
      assert.equal(Number(style.get(73)), textOrientation === 'horizontal' ? 1 : 0);
      assert.equal(Number(style.get(74)), textOrientation === 'horizontal' ? 1 : 0);
      assert.deepEqual(withoutTextStyle(result.text), withoutTextStyle(legacy.text), 'only four DIMSTYLE fields may differ');
      assert.deepEqual(result.report, legacy.report);
    }
    const inch = writeDxf({ units: 'in', entities: [entity], dimensionStyle: { textHeight: 0.12, textPlacement: 'center', textOrientation: 'horizontal' } }, { version });
    assert.equal(Number(new Map(styleOf(inch.text)).get(140)), 0.12, 'height is in drawing units, not implicitly converted');
  });
  test(`${version}: missing or invalid dimension text style fields give the existing typed BAD_ENTITY refusal`, () => {
    const valid = { textHeight: 3, textPlacement: 'center', textOrientation: 'horizontal' };
    const invalid = [null, [], {}, ...[0, -1, Infinity, -Infinity, NaN, '3', undefined].map(textHeight => ({ ...valid, textHeight })),
      ...['below', '', undefined, 0].map(textPlacement => ({ ...valid, textPlacement })),
      ...['vertical', '', undefined, 0].map(textOrientation => ({ ...valid, textOrientation }))];
    for (const dimensionStyle of invalid) {
      assert.throws(() => writeDxf({ units: 'mm', entities: [entity], dimensionStyle }, { version }), error => isDxfWriteError(error) && error.code === 'BAD_ENTITY');
    }
  });
}
