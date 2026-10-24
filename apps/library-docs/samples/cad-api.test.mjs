// The kernel's object facade (`@barocss/cad/api`, experimental, R7): the same bracket over a CadPartDocument, its `.doc`
// the very document written by hand, its mass, STEP and STL the kernel's own, and the refusals typed. The Object API
// page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part, BarocssError } from '@barocss/cad/api';
// #endregion import
import { evaluateCadPart } from '@barocss/cad';

const unstamped = text => text.replace(/^FILE_NAME\(.*$/m, '');

test('the bracket through the kernel facade: the hand-written document, the kernel\'s results', () => {
  // #region bracket
  const bracket = part('bracket')
    .box(80, 40, 10)
    .hole({ at: [20, 20], diameterMM: 8 })
    .fillet(body => body.edges().along('z'), 2);

  const mass = bracket.mass(2.7);           // a density in g/cm³: the kernel keeps no material library
  const step = bracket.step();              // STEP AP214 text
  const stl = bracket.stl();                // binary STL
  const meshes = bracket.meshes();          // [{ key, positions, normals, indices }], one a body
  // #endregion bracket

  // #region doc
  // The CadPartDocument it builds: string ids the facade assigns in feature order, each feature naming its target.
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 40] },
    { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 10 },
    { id: 'hole1', kind: 'hole', target: 'extrude1', center: [20, 20], radius: 4 },
    { id: 'fillet1', kind: 'fillet', target: 'hole1', radius: 2,
      edges: ['extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3', 'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3'] },
  ] };
  assert.deepEqual(bracket.doc, doc);
  // #endregion doc

  const [out] = evaluateCadPart(doc).outputs, kernel = out.massProperties(2700);   // kg/m³ in the kernel
  assert.equal(mass.volumeMM3, kernel.volumeMM3);
  assert.equal(mass.massG, kernel.massKG * 1000);
  assert.equal(unstamped(step), unstamped(out.exportStep({ name: 'bracket' })));
  assert.deepEqual(stl, out.exportStl());
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].key, 'fillet1');
});

test('refusals: the facade\'s own codes, the kernel\'s passed through with the feature', () => {
  // #region refusals
  assert.throws(() => part().mass(2.7), e => e instanceof BarocssError && e.code === 'NO_BODY');
  assert.throws(() => part().box(10, 10, 10).mass(-1), e => e instanceof BarocssError && e.code === 'DENSITY');
  // A fillet too large for its walls: the kernel's refusal, with the feature it came from.
  assert.throws(() => part().box(10, 10, 10).fillet(body => body.edges().along('z'), 50).mass(2.7),
    e => e instanceof BarocssError && e.code === 'RADIUS_EXCEEDS_FACE' && e.where === 'evaluate' && e.details?.feature === 'fillet1'
      && e.message.startsWith('[RADIUS_EXCEEDS_FACE] '));
  // #endregion refusals
});
