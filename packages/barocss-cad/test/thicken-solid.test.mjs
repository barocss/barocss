import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, CadPartError, massPropertiesOf } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const w = Math.SQRT1_2;
// A flat 20 × 10 patch, and a quarter of a cylinder of radius 10 (axis Y, 10 long) facing out.
const FLAT = { degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 0, 0], [0, 10, 0]], [[20, 0, 0], [20, 10, 0]]], weights: [[1, 1], [1, 1]] };
const QUARTER = { degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[10, 0, 0], [10, 10, 0]], [[10, 0, 10], [10, 10, 10]], [[0, 0, 10], [0, 10, 10]]], weights: [[1, 1], [w, w], [1, 1]] };

test('thicken: a flat patch is a plate; a cylinder patch a curved wall of the annulus area times its length', () => {
  const plate = evaluateCadPart(D([{ id: 't', kind: 'thicken', surface: FLAT, thickness: 2 }])).outputs[0];
  assert.deepEqual(checkBrep(plate.brep).issues, []);
  assert.ok(Math.abs(massPropertiesOf(plate).volume - 400) < 1e-6);
  const both = evaluateCadPart(D([{ id: 't', kind: 'thicken', surface: FLAT, thickness: 2, side: 'both' }])).outputs[0];
  const zs = both.brep.vertices.map(v => v.point[2]); assert.deepEqual([Math.min(...zs), Math.max(...zs)], [-1, 1]);
  // Which way is out on the cylinder patch depends on its parameterisation; the wall is ¼ of the annulus 10–12 (or 8–10) by 10 long.
  for (const side of ['normal', 'reverse']) {
    const wall = evaluateCadPart(D([{ id: 't', kind: 'thicken', surface: QUARTER, thickness: 2, side }])).outputs[0], v = massPropertiesOf(wall).volume;
    const outer = Math.PI * (144 - 100) / 4 * 10, inner = Math.PI * (100 - 64) / 4 * 10;
    assert.ok(Math.abs(v - outer) / outer < 0.01 || Math.abs(v - inner) / inner < 0.01, `${side}: ${v}`);
  }
  assert.throws(() => evaluateCadPart(D([{ id: 't', kind: 'thicken', surface: FLAT, thickness: 0 }])), e => e instanceof CadPartError);
});
