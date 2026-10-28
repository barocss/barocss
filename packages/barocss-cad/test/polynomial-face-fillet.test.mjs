import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSurface, evaluateCadPart, outputOf, massPropertiesOf, checkOutput, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';
import { polynomialRunSurface } from '../dist/blend/polynomial-run.js';

const doc = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const controls = [[0, 0, 0], [0, 0, 4], [2, 0, 8], [-2, 0, 12], [0, 0, 16], [0, 0, 20]];
const guide = { kind: 'nurbs', degree: 5, knots: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], controlPoints: controls };
const base = [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
  { id: 'L', kind: 'loft', sections: [{ sketch: 's', z: 0 }, { sketch: 's', z: 20 }], guide },
];
const fillet = (radius, faces = ['L.side0', 'L.side3']) => ({ id: 'f', kind: 'face-fillet', target: 'L', faces, radius });

// Independent geometry: the crease is C(t) = (20t²(1-t)²(1-2t), 0, 20t).
// A square corner removes r²(1-π/4) per unit arc length. Both end tangents are vertical, so the integrated signed
// curvature term is zero and the body's end planes are normal to the crease there. Simpson integration of |C'|
// does not use the kernel's NURBS evaluator, fillet sections, or mass quadrature.
function expectedVolume(radius) {
  const count = 4096;
  let sum = 0;
  for (let i = 0; i <= count; i++) {
    const t = i / count, dx = 40 * t - 240 * t * t + 400 * t ** 3 - 200 * t ** 4;
    sum += (i === 0 || i === count ? 1 : i % 2 ? 4 : 2) * Math.hypot(20, dx);
  }
  return 8000 - radius * radius * (1 - Math.PI / 4) * sum / (3 * count);
}

test('polynomial run preserves the original parameter and extrapolates degrees 2–5 in either direction', () => {
  for (let degree = 2; degree <= 5; degree++) {
    // Bezier coefficients of x=t², y=u, z=t for every admitted degree; the authored v domain is [2, 6].
    const row = Array.from({ length: degree + 1 }, (_, i) => [i * (i - 1) / (degree * (degree - 1)), 0, i / degree]);
    const surface = { kind: 'surface', id: 'p', degreeU: 1, degreeV: degree, knotsU: [0, 0, 1, 1],
      knotsV: [...Array(degree + 1).fill(2), ...Array(degree + 1).fill(6)],
      controlPoints: [row, row.map(([x, , z]) => [x, 1, z])], weights: [Array(degree + 1).fill(1), Array(degree + 1).fill(1)] };
    const saved = structuredClone(surface), run = polynomialRunSurface(surface);
    for (const t of [-0.25, 0, 0.2, 0.5, 1, 1.25]) {
      const point = evaluateSurface(run, 0.3, 2 + 4 * t);
      [t * t, 0.3, t].forEach((expected, axis) => close(point[axis], expected, 1e-13));
    }
    const transposed = { ...surface, degreeU: degree, degreeV: 1, knotsU: surface.knotsV, knotsV: surface.knotsU,
      controlPoints: row.map((p, j) => [p, surface.controlPoints[1][j]]), weights: row.map(() => [1, 1]) };
    const other = polynomialRunSurface(transposed);
    for (const t of [-0.25, 0.3, 1.25]) {
      const point = evaluateSurface(other, 2 + 4 * t, 0.3);
      [t * t, 0.3, t].forEach((expected, axis) => close(point[axis], expected, 1e-13));
    }
    assert.deepEqual(surface, saved, 'authored surfaces remain unchanged');
  }
});

test('polynomial run uses the represented extension of a small offset knot domain', () => {
  const lo = 1, hi = 1 + 5 * Number.EPSILON;
  const surface = { kind: 'surface', id: 'offset', degreeU: 1, degreeV: 2,
    knotsU: [0, 0, 1, 1], knotsV: [lo, lo, lo, hi, hi, hi],
    controlPoints: [[[0, 0, 0], [0, 0, 0.5], [1, 0, 1]], [[0, 1, 0], [0, 1, 0.5], [1, 1, 1]]], weights: [[1, 1, 1], [1, 1, 1]] };
  const run = polynomialRunSurface(surface);
  assert.notEqual(run, surface);
  for (const parameter of [lo, lo + Number.EPSILON, lo + 3 * Number.EPSILON, hi]) {
    const t = (parameter - lo) / (hi - lo), point = evaluateSurface(run, 0.3, parameter);
    [t * t, 0.3, t].forEach((expected, axis) => close(point[axis], expected, 1e-13));
  }
});

test('polynomial run leaves rational, closed, multi-span and unrepresentable end domains unchanged', () => {
  const surface = { kind: 'surface', id: 'p', degreeU: 1, degreeV: 2, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 0, 1, 1, 1],
    controlPoints: [[[0, 0, 0], [1, 0, 1], [0, 0, 2]], [[0, 1, 0], [1, 1, 1], [0, 1, 2]]], weights: [[1, 0.8, 1], [1, 0.8, 1]] };
  assert.equal(polynomialRunSurface(surface), surface);
  const closed = { ...surface, weights: [[1, 1, 1], [1, 1, 1]], controlPoints: [
    [[0, 0, 0], [1, 0, 1], [0, 0, 0]], [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
  ] };
  assert.equal(polynomialRunSurface(closed), closed);
  const multi = { ...surface, knotsV: [0, 0, 0, 0.5, 1, 1, 1], controlPoints: [
    [[0, 0, 0], [1, 0, 1], [1, 0, 2], [0, 0, 3]], [[0, 1, 0], [1, 1, 1], [1, 1, 2], [0, 1, 3]],
  ], weights: [[1, 1, 1, 1], [1, 1, 1, 1]] };
  assert.equal(polynomialRunSurface(multi), multi);
  const narrow = { ...surface, knotsV: [1, 1, 1, 1 + Number.EPSILON, 1 + Number.EPSILON, 1 + Number.EPSILON], weights: [[1, 1, 1], [1, 1, 1]] };
  assert.equal(polynomialRunSurface(narrow), narrow, 'a quarter-domain margin must be representable at both ends');
});

test('polynomial run skips extrapolation beyond the existing geometry coordinate bound', () => {
  const surface = { kind: 'surface', id: 'large', degreeU: 1, degreeV: 2,
    knotsU: [0, 0, 1, 1], knotsV: [0, 0, 0, 1, 1, 1],
    controlPoints: [[[0, 0, 0], [10, 0, 500000], [0, 0, 1000000]], [[0, 1, 0], [10, 1, 500000], [0, 1, 1000000]]],
    weights: [[1, 1, 1], [1, 1, 1]] };
  assert.deepEqual(evaluateSurface(surface, 0.5, 1), [0, 0.5, 1000000]);
  assert.equal(polynomialRunSurface(surface), surface);
});

test('face fillet on a quintic guided loft follows the independent swept-corner volume, in both face orders', () => {
  for (const faces of [['L.side0', 'L.side3'], ['L.side3', 'L.side0']]) {
    const input = doc([...base, fillet(0.5, faces)]), saved = structuredClone(input);
    const output = outputOf(evaluateCadPart(input), 'f'), check = checkOutput(output);
    assert.equal(check.valid, true, JSON.stringify(check.issues)); assert.equal(check.counts.bodies, 1);
    close(massPropertiesOf(output).volume, expectedVolume(0.5));
    assert.ok(output.brep.faces.some(f => f.name?.startsWith('f.face')));
    assert.equal(output.fillet.length, 1);
    assert.ok(output.fillet[0].contact <= 2.5e-7); assert.ok(output.fillet[0].section <= 1e-6);
    assert.deepEqual(input, saved);
  }
});

test('polynomial face fillet radius survives native save/open and retains typed non-adjacent refusal', () => {
  const input = doc([...base, fillet(0.25)]), opened = loadCadPart(saveCadPart(evaluateCadPart(input)));
  assert.deepEqual(opened.document, input);
  const output = outputOf(opened, 'f');
  assert.equal(checkOutput(output).valid, true); close(massPropertiesOf(output).volume, expectedVolume(0.25));
  assert.throws(() => evaluateCadPart(doc([...input.features,
    { id: 'g', kind: 'face-fillet', target: 'f', faces: ['L.side0', 'L.side3'], radius: 0.5 },
  ])), error => error instanceof CadPartError && error.code === 'FACE_FILLET_FACE');
});
