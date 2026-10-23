// @barocss/cad's exchange formats in small: a part to STEP and back through the import feature, and a DXF written the
// same way twice. The formats page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, writeDxf } from '@barocss/cad';

const plate = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
    { id: 'p', kind: 'extrude', sketch: 's', height: 8 },
    { id: 'h', kind: 'hole', target: 'p', center: [30, 20], radius: 4 },
  ] };

test('STEP out and back: the same volume, strictly valid', () => {
  // #region step
  const [body] = evaluateCadPart(plate).outputs;
  const step = body.exportStep({ name: 'plate' });          // exact B-rep, AP214
  const back = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
    features: [{ id: 'i', kind: 'import', step }] });       // a STEP file as a feature
  const [read] = back.outputs;
  assert.ok(Math.abs(read.massProperties(2700).volumeMM3 - body.massProperties(2700).volumeMM3) < 1e-6);
  assert.equal(read.validate().valid, true);
  // #endregion step
  assert.match(step, /FILE_DESCRIPTION\(\('BaroCSS CAD part'\)/);
});

test('DXF: a deterministic file, DXF 2000 or R12', () => {
  // #region dxf
  const sheet = { units: 'mm', entities: [
    { type: 'line', a: [0, 0], b: [60, 0] }, { type: 'line', a: [60, 0], b: [60, 40] },
    { type: 'line', a: [60, 40], b: [0, 40] }, { type: 'line', a: [0, 40], b: [0, 0] },
    { type: 'circle', center: [30, 20], radius: 4 },
  ] };
  const a = writeDxf(sheet), b = writeDxf(sheet);             // DXF 2000 (AC1015) by default
  assert.equal(a.text, b.text);                               // no time stamps: the same document, the same file
  assert.deepEqual(a.report.modelSpace, { LINE: 4, CIRCLE: 1 });
  const r12 = writeDxf(sheet, { version: 'AC1009' });        // R12
  assert.match(r12.text, /AC1009/);
  // #endregion dxf
});
