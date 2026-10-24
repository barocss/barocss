// An independent MMGS check at the kernel boundary. No facade or model adapter is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf, outputOf, checkOutput, surfaceAreaOf, reevaluate, saveCadPart, loadCadPart } from '@barocss/cad';

const cube = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { h: 10 }, features: [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
  { id: 'p', kind: 'extrude', sketch: 's', height: { parameter: 'h' } },
] };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);

test('MMGS cube: independent volume, mass, centroid and full centroidal tensor', () => {
  // #region mass
  const snapshot = evaluateCadPart(cube);
  const body = outputOf(snapshot, 'p');
  const result = massPropertiesOf(body, 2.7); // density g/cm³
  near(result.volume, 1000);                // mm³
  near(result.mass, 2.7);                   // g
  result.centroid.forEach(value => near(value, 5)); // mm
  result.inertia.forEach((row, i) => row.forEach((value, j) => near(value, i === j ? 45 : 0))); // g·mm²
  // #endregion mass
  assert.equal(checkOutput(body).valid, true);
  near(surfaceAreaOf(body), 600);
});

test('plain snapshots: free functions edit, save and reload without changing the input', () => {
  const first = evaluateCadPart(cube);
  const edited = reevaluate(first, { parameters: { h: 20 } });
  near(massPropertiesOf(outputOf(edited, 'p'), 2.7).volume, 2000);
  near(massPropertiesOf(outputOf(first, 'p'), 2.7).volume, 1000);
  const replaced = reevaluate(first, { document: { ...cube, parameters: { h: 5 } } });
  const reloaded = loadCadPart(saveCadPart(replaced));
  near(massPropertiesOf(outputOf(reloaded, 'p'), 2.7).volume, 500);
});
