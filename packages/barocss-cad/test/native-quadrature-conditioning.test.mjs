import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepMassProperties, brepSurfaceArea, checkBrep, transformBrep, prismaticFromProfile, transformPrismatic, brepFromPrismatic, isSolidMassError } from '../dist/index.js';
import { brepQuadratureIntegrals, wholePatchTest } from '../dist/brep/brep-mass-quadrature.js';
import { nativeCylinderNodes, assertNearRational } from './helpers/native-quadrature-oracle.mjs';
import { rational, fromNumber, add, div } from './helpers/prismatic-mass-oracle.mjs';

const captured = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/native-quadrature-thin-cylinder.json'), 'utf8'));
const reference = nativeCylinderNodes(captured);
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function normalInterval(brep, axis) {
  let lo = Infinity, hi = -Infinity;
  for (const vertex of brep.vertices) { lo = Math.min(lo, vertex.point[axis]); hi = Math.max(hi, vertex.point[axis]); }
  return [lo, hi];
}
function assertStructure(brep) {
  assert.equal(checkBrep(brep, { strict: true }).valid, true); assert.equal(brep.bodies.length, 1);
  assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.equal(new Set(brep.faces.map(f => f.name)).size, brep.faces.length);
}

test('native quadrature: accepted translated tiny native cylinder matches independent stored-node material moments', () => {
  const brep = structuredClone(captured), before = structuredClone(brep); assertStructure(brep);
  const mass = brepMassProperties(brep, 1), [lo, hi] = normalInterval(brep, 2);
  const whole = wholePatchTest(brep), sides = brep.faces.filter(f => f.surface.degreeU === 2);
  assert.equal(sides.length, 2); for (const side of sides) assert.equal(whole(side), true);
  assert.equal(brepQuadratureIntegrals(brep, 8).meshed, false);
  assert.equal(mass.method, 'quadrature'); assert.equal(reference.nodeCount, 572);
  assertNearRational(mass.volume, reference.volume, 1e-11 * Math.PI * 9 * (hi - lo), 'native stored-node volume');
  for (let k = 0; k < 3; k++) assertNearRational(mass.centroid[k], reference.centroid[k], 1e-7, `native centroid${k}`);
  assert.ok(mass.centroid[2] >= lo && mass.centroid[2] <= hi);
  assert.ok(Math.abs(brepSurfaceArea(brep) / (2 * Math.PI * 9) - 1) < 1e-11);
  assert.deepEqual(brep, before);
});

for (const [name, matrix, axis] of [
  ['identity', identity, 2], ['normal reflection', [1, 0, 0, 0, 1, 0, 0, 0, -1], 2],
  ['thin X', [0, 0, 1, 0, 1, 0, 1, 0, 0], 0], ['thin Y', [1, 0, 0, 0, 0, 1, 0, 1, 0], 1],
]) test(`native quadrature: ${name} preserves all centroid axes and side contributions`, () => {
  const brep = transformBrep(captured, { matrix }), before = structuredClone(brep), expected = [];
  for (let row = 0; row < 3; row++) {
    let value = rational(0n);
    for (let column = 0; column < 3; column++) if (matrix[3 * row + column]) {
      const x = reference.centroid[column]; value = add(value, rational(x.n * BigInt(matrix[3 * row + column]), x.d));
    }
    expected.push(value);
  }
  assertStructure(brep);
  const mass = brepMassProperties(brep, 7.85), [lo, hi] = normalInterval(brep, axis);
  assert.equal(mass.method, 'quadrature'); assertNearRational(mass.volume, reference.volume, 1e-11 * Math.PI * 9 * (hi - lo), 'cardinal volume');
  for (let k = 0; k < 3; k++) assertNearRational(mass.centroid[k], expected[k], 1e-7, `${name} centroid${k}`);
  assert.ok(mass.centroid[axis] >= lo && mass.centroid[axis] <= hi); assert.equal(mass.mass, 7.85 * mass.volume * 1e-3);
  assert.deepEqual(brep, before); assert.deepEqual(captured, JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/native-quadrature-thin-cylinder.json'), 'utf8')));
});

test('native quadrature: an exactly recentered captured normal interval retains the same material', () => {
  const [lo] = normalInterval(captured, 2), brep = transformBrep(captured, { matrix: identity, offset: [0, 0, -lo] });
  const [a, b] = normalInterval(brep, 2); assert.equal(a, 0); assert.equal(b, .34567890000000023 - .3456789);
  const mass = brepMassProperties(brep, 1); assertNearRational(mass.volume, reference.volume, 1e-11 * Math.PI * 9 * b, 'recentered volume');
  assertNearRational(mass.centroid[0], reference.centroid[0], 1e-7, 'recentered x'); assertNearRational(mass.centroid[1], reference.centroid[1], 1e-7, 'recentered y');
  assertNearRational(mass.centroid[2], div(fromNumber(b), rational(2n)), 1e-30, 'recentered exact normal midpoint');
});

for (const [from, height] of [[.3456789, .001], [-.3466789, .001], [.3456789, 5.00009], [.3456789, 7.00009]]) test(`native quadrature: ordinary native interval from${from}/h${height} retains provider and physical moments`, () => {
  const solid = transformPrismatic(prismaticFromProfile({ outer: [{ kind: 'arc', start: [3, 0], center: [0, 0], direction: 'ccw' }], height, from, tag: 'ordinary' }), { matrix: [1, 0, 0, 1], offset: [.1234567, -.2345678] });
  const brep = brepFromPrismatic(solid), before = structuredClone(brep), [lo, hi] = normalInterval(brep, 2), mass = brepMassProperties(brep, 1);
  assertStructure(brep); assert.equal(mass.method, 'quadrature'); assert.ok(Math.abs(mass.volume / (Math.PI * 9 * (hi - lo)) - 1) < 1e-11);
  assert.ok(Math.abs(mass.centroid[0] - .1234567) <= 1e-7); assert.ok(Math.abs(mass.centroid[1] + .2345678) <= 1e-7);
  assertNearRational(mass.centroid[2], div(add(fromNumber(lo), fromNumber(hi)), rational(2n)), 1e-7, 'ordinary midpoint');
  assert.ok(mass.centroid[2] >= lo && mass.centroid[2] <= hi); assert.deepEqual(brep, before);
});

test('native quadrature: density refusal and explicit tessellated option keep their contracts', () => {
  const brep = brepFromPrismatic(prismaticFromProfile({ outer: [{ kind: 'arc', start: [3, 0], center: [0, 0], direction: 'ccw' }], height: 2, tag: 'options' }));
  for (const density of [0, -1, NaN, Infinity]) assert.throws(() => brepMassProperties(brep, density), isSolidMassError);
  const mass = brepMassProperties(brep, 1, { quadratureSegments: 0, segmentsPerQuarter: 8 });
  assert.equal(mass.method, 'tessellated'); assert.ok(mass.volume > 0); assert.ok(mass.volumeBound >= 0);
});
