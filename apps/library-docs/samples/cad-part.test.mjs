// @barocss/cad as a program uses it: a part written through the object facade, its document evaluated by the core,
// measured, checked and written; a parameter edited in the core's document; and a refusal. The @barocss/cad pages
// include the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part } from '@barocss/cad/api';                       // the object facade
import { evaluateCadPart, CadPartError } from '@barocss/cad';   // the core: the part document and its evaluation
// #endregion import

test('a plate with a hole: written, evaluated, measured, valid, written as STEP and STL', () => {
  // #region part
  // A 60 × 40 × 8 plate with a Ø8 hole through it.
  const plate = part('plate')
    .box({ w: 60, d: 40, h: 8 })
    .hole(body => body.faces().facing('+z'), { d: 8, x: 30, y: 20 });

  const doc = plate.doc;                    // the part document: its features in order
  assert.deepEqual(doc.features.map(f => [f.id, f.kind]), [['sketch1', 'sketch'], ['extrude1', 'extrude'], ['hole1', 'hole']]);
  const snapshot = evaluateCadPart(doc);    // what the facade evaluates
  const [body] = snapshot.outputs;          // the parts no later feature consumes
  // #endregion part

  // #region outputs
  const mass = plate.mass({ density: 2.7 });          // aluminium: mm³, g, mm, g·mm²
  assert.ok(Math.abs(mass.volumeMM3 - (60 * 40 * 8 - Math.PI * 16 * 8)) < 1e-6);
  assert.ok(Math.abs(mass.massG - mass.volumeMM3 * 2.7e-3) < 1e-9);
  assert.equal(body.validate().valid, true);   // strict B-rep validity, on the core's output
  assert.match(plate.step(), /^ISO-10303-21;/);
  const stl = plate.stl();                  // binary STL of the display tessellation
  assert.equal(stl.length, 84 + 50 * new DataView(stl.buffer, stl.byteOffset).getUint32(80, true));
  // #endregion outputs
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
