// An independent MMGS check at the kernel boundary. No facade or model adapter is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleGeometry, HEIGHT, numberLabel } from '../docs/.vitepress/components/booleanGeometry.mjs';
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

// Keep the facade comparison in boolean-diagram.test.mjs for aggregate qualification.
// This check independently exercises the pinned kernel through its plain-data contract.
test('MMGS Boolean diagrams: 33 kernel volumes match the 0.001 mm³ display precision', () => {
  for (const [shape, positions] of [['box', [-12, 0, 5, 10, 15]], ['cylinder', [-4, 5, 8, 10, 13, 14]]]) {
    for (const x of positions) for (const operation of ['union', 'difference', 'intersect']) {
      const toolSketch = shape === 'box'
        ? { profile: 'rectangle', min: [x, 0], max: [x + 10, 10] }
        : { profile: 'circle', center: [x, 5], radius: 3 };
      const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
        { id: 'as', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
        { id: 'a', kind: 'extrude', sketch: 'as', height: HEIGHT },
        { id: 'bs', kind: 'sketch', ...toolSketch },
        { id: 'b', kind: 'extrude', sketch: 'bs', height: HEIGHT },
        { id: 'result', kind: operation, target: 'a', tool: 'b' },
      ] };
      const actual = evaluateCadPart(doc).outputs.reduce((sum, output) => sum + (output.bodyCount ? massPropertiesOf(output, 1).volume : 0), 0);
      assert.equal(numberLabel(actual), numberLabel(exampleGeometry(shape, x).areas[operation] * HEIGHT), `${shape} x=${x} ${operation}`);
    }
  }
});
