// @barocss/cad as a program uses it: a part document evaluated, its output measured, checked and written, a parameter
// edited, and a refusal. The @barocss/cad pages include the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { evaluateCadPart, CadPartError } from '@barocss/cad';
// #endregion import

test('a plate with a hole: evaluated, measured, valid, written as STEP and STL', () => {
  // #region part
  // A 60 × 40 plate, its thickness a parameter, with a Ø8 hole through it.
  const plate = {
    format: 'barocss-cad-part', version: 1, units: 'mm',
    parameters: { t: 8 },
    features: [
      { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
      { id: 'p', kind: 'extrude', sketch: 's', height: { parameter: 't' } },
      { id: 'h', kind: 'hole', target: 'p', center: [30, 20], radius: 4 },
    ],
  };
  const snapshot = evaluateCadPart(plate);
  const [body] = snapshot.outputs;          // the parts no later feature consumes
  // #endregion part

  // #region outputs
  const mass = body.massProperties(2700);   // aluminium, kg/m³
  assert.ok(Math.abs(mass.volumeMM3 - (60 * 40 * 8 - Math.PI * 16 * 8)) < 1e-6);   // mm³
  assert.equal(mass.method, 'closed-form');   // how it was integrated
  assert.ok(Math.abs(mass.massKG - mass.volumeMM3 * 2700e-9) < 1e-12);
  assert.equal(body.bodyCount, 1);
  assert.equal(body.validate().valid, true);   // strict B-rep validity
  assert.match(body.exportStep({ name: 'plate' }), /^ISO-10303-21;/);
  const stl = body.exportStl();             // binary STL of the display tessellation
  assert.equal(stl.length, 84 + 50 * new DataView(stl.buffer, stl.byteOffset).getUint32(80, true));
  // #endregion outputs
  assert.deepEqual(snapshot.features.map(f => f.id), ['s', 'p', 'h']);
});

test('a parameter edited: unchanged features reused', () => {
  const first = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { t: 8 },
    features: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { id: 'p', kind: 'extrude', sketch: 's', height: { parameter: 't' } }] });
  // #region edit
  const thicker = first.withParameters({ t: 10 });
  assert.ok(Math.abs(thicker.outputs[0].massProperties(2700).volumeMM3 - 60 * 40 * 10) < 1e-6);
  assert.deepEqual(thicker.recomputation.evaluated, ['p']);   // only the extrude ran again
  // #endregion edit
});

test('a refusal: a CadPartError with a code and the feature it comes from', () => {
  // #region refusal
  try {
    evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
      features: [{ id: 'p', kind: 'extrude', sketch: 'missing', height: 8 }] });
    assert.fail('refused');
  } catch (e) {
    assert.ok(e instanceof CadPartError);
    assert.equal(e.code, 'REFERENCE');
    assert.equal(e.feature, 'p');
  }
  // #endregion refusal
});
