import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, exportStep, importStep, brepSurfaceArea, brepMassProperties, stepValidationProperties, compareValidationProperties, threadSolid } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const pi = Math.PI;
const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];

test('surface area over the exact surfaces: closed forms to 1e-12, a helical bolt above its fine mesh', () => {
  const cyl = evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'c', kind: 'extrude', sketch: 's', height: 10 }])).outputs[0];
  for (const [o, want] of [[cyl, 150 * pi], [evaluateCadPart(D(box)).outputs[0], 3800], [evaluateCadPart(D([...box, { id: 'h', kind: 'hole', target: 'e', center: [20, 15], radius: 5 }])).outputs[0], 3800 - 50 * pi + 100 * pi]])
    assert.ok(Math.abs(o.surfaceArea() - want) < 1e-12 * want, `${o.surfaceArea()} vs ${want}`);
  const bolt = threadSolid({ id: 'b', diameter: 8, pitch: 1.25, length: 30, hex: { across: 13, height: 5.3 } }), exact = brepSurfaceArea(bolt), mesh = brepSurfaceArea(bolt, { quadratureSegments: 0, segmentsPerQuarter: 32 });
  assert.ok(exact > mesh && exact - mesh < 1e-3 * exact, `${exact} vs mesh ${mesh}`);
});

test('STEP carries CAx-IF validation properties; they read back and agree with the model; leaving them out writes none', () => {
  const o = evaluateCadPart(D([...box, { id: 'h', kind: 'hole', target: 'e', center: [20, 15], radius: 5 }])).outputs[0], step = o.exportStep();
  assert.match(step, /PROPERTY_DEFINITION\('geometric validation property','volume of /);
  assert.match(step, /MEASURE_REPRESENTATION_ITEM\('volume measure',VOLUME_MEASURE\(/);
  assert.match(step, /\(DERIVED_UNIT\(\(#\d+\)\)VOLUME_UNIT\(\)\)/);
  const g = stepValidationProperties(step), m = o.massProperties(1);
  assert.ok(Math.abs(g.volumeMM3 - (12000 - 250 * pi)) < 1e-9 * 12000);
  assert.ok(Math.abs(g.areaMM2 - (3800 + 50 * pi)) < 1e-9 * 3800);
  assert.deepEqual(g.centroidMM.map(x => +x.toFixed(9)), m.centroidMM.map(x => +x.toFixed(9)));
  assert.deepEqual(g.box, { min: [0, 0, 0], max: [40, 30, 10] });
  const back = importStep(step), mb = brepMassProperties(back, 1);
  const c = compareValidationProperties(g, { volumeMM3: mb.volumeMM3, areaMM2: brepSurfaceArea(back), centroidMM: mb.centroidMM, box: g.box });
  assert.equal(c.ok, true); assert.ok(c.volume.difference < 1e-12);
  // A model 2 % smaller than the file says fails the 1 % volume limit.
  assert.equal(compareValidationProperties(g, { volumeMM3: g.volumeMM3 * 0.98, areaMM2: g.areaMM2, centroidMM: g.centroidMM, box: g.box }).volume.ok, false);
  assert.doesNotMatch(exportStep(o.brep, { validationProperties: false }), /geometric validation property/);
});

test('a STEP of two bodies with the same names imports with them numbered in file order', () => {
  const outs = evaluateCadPart(D([...box, { id: 'h0', kind: 'hole', target: 'e', center: [10, 10], radius: 2 }, { id: 'h1', kind: 'hole', target: 'e', center: [30, 10], radius: 2 }])).outputs;
  const back = importStep(exportStep(outs.map(o => o.brep)));
  const names = back.faces.map(f => f.name);
  assert.equal(new Set(names).size, names.length, 'unique');
  assert.ok(names.includes('e.top#1') && names.includes('e.top#2'), names.join(' '));
  // Names only one body has (its own hole's faces) come back unchanged.
  for (const n of outs[0].brep.faces.map(f => f.name).filter(n => n.startsWith('h0.'))) assert.ok(names.includes(n), `${n} kept`);
});
