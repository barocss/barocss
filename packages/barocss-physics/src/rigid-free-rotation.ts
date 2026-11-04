/** Eighth-order composition of implicit midpoint free rotation; no retained state. */
import type { Body, Quat, Vec3 } from './internal-types.js';
import { advanceOrientation, inverse, multiplyQuaternion, rotate } from './math.js';
import { error } from './validation.js';

export interface FreeRotationResult {
  orientation: Quat;
  angularVelocityRadps: Vec3;
}

const exponents = Object.freeze([3, 5, 7] as const);
const roots = Object.freeze(exponents.map((exponent) => {
  // G1B_COEFFICIENT_POW: exactly one actual call per exponent and graph load.
  return Math.pow(2, 1 / exponent);
}));
const a = Object.freeze(roots.map((root) => 1 / (2 - root)));
const b = Object.freeze(a.map((value) => 1 - 2 * value));
let expanded: number[] = [1];
for (let level = 0; level < 3; level++) {
  expanded = [...expanded.map((value) => a[level] * value),
    ...expanded.map((value) => b[level] * value),
    ...expanded.map((value) => a[level] * value)];
}
export const triaxialFreeRotationCoefficients = Object.freeze({
  exponents, roots, a, b, weights: Object.freeze(expanded),
});

const ROUNDING_UNIT = 2 ** -52;
const unitVectorBound = (value: Vec3): boolean =>
  value.every((component) => Number.isFinite(component) && Math.abs(component) <= 1);
const maximumComponent = (value: Vec3): number =>
  Math.max(Math.abs(value[0]), Math.abs(value[1]), Math.abs(value[2]));

function field(p: Vec3, diagonal: Vec3): Vec3 {
  return [(diagonal[2] - diagonal[1]) * p[1] * p[2],
    (diagonal[0] - diagonal[2]) * p[2] * p[0],
    (diagonal[1] - diagonal[0]) * p[0] * p[1]];
}

function derivative(p: Vec3, diagonal: Vec3): [Vec3, Vec3, Vec3] {
  return [[0, (diagonal[2] - diagonal[1]) * p[2], (diagonal[2] - diagonal[1]) * p[1]],
    [(diagonal[0] - diagonal[2]) * p[2], 0, (diagonal[0] - diagonal[2]) * p[0]],
    [(diagonal[1] - diagonal[0]) * p[1], (diagonal[1] - diagonal[0]) * p[0], 0]];
}

function linearSolve(matrix: [Vec3, Vec3, Vec3], right: Vec3): {
  value: Vec3; residualMaximum: number; residualBound: number;
} {
  // G1B_LINEAR_SOLVE_ENTRY: one direct solve per fixed Newton update.
  const rows = matrix.map((row, index) => [...row, right[index]]);
  for (let column = 0; column < 3; column++) {
    let selected = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[selected][column])) selected = row;
    }
    if (selected !== column) [rows[selected], rows[column]] = [rows[column], rows[selected]];
    const selectedPivot = rows[column][column];
    const pivotMagnitude = Math.abs(selectedPivot);
    // G1B_LINEAR_PIVOT: observe column/selectedPivot/pivotMagnitude, no extra math.
    if (!Number.isFinite(selectedPivot) || pivotMagnitude < 1 / 4) {
      error('NUMERIC_LIMIT', 'triaxial midpoint pivot outside qualified bound');
    }
    for (let row = column + 1; row < 3; row++) {
      const multiplier = rows[row][column] / selectedPivot;
      rows[row][column] = 0;
      for (let entry = column + 1; entry < 4; entry++) rows[row][entry] -= multiplier * rows[column][entry];
    }
  }
  const result: Vec3 = [0, 0, 0];
  for (let row = 2; row >= 0; row--) {
    let total = rows[row][3];
    for (let column = row + 1; column < 3; column++) total -= rows[row][column] * result[column];
    result[row] = total / rows[row][row];
  }
  if (!result.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite triaxial midpoint correction');
  const residual = matrix.map((row, index) =>
    row.reduce((sum, value, column) => sum + value * result[column], 0) - right[index]) as Vec3;
  const matrixNorm = Math.max(...matrix.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0)));
  const residualMaximum = maximumComponent(residual);
  const residualScale = Math.max(1, matrixNorm * maximumComponent(result) + maximumComponent(right));
  const residualBound = 64 * ROUNDING_UNIT * residualScale;
  if (!Number.isFinite(residualMaximum) || !Number.isFinite(residualBound) || residualMaximum > residualBound) {
    // G1B_LINEAR_RESIDUAL_FAILURE: test-only failed-prefix residual/bound, zero normal records.
    error('NUMERIC_LIMIT', 'triaxial linear correction residual outside qualified bound');
  }
  return { value: result, residualMaximum, residualBound };
}

function midpoint(p0: Vec3, diagonal: Vec3, signedStep: number): { p: Vec3; omegaMid: Vec3 } {
  // G1B_MIDPOINT_ENTRY: exactly27 signed stages per general macro flow.
  if (!Number.isFinite(signedStep) || !unitVectorBound(p0)) {
    error('NUMERIC_LIMIT', 'triaxial midpoint initial iterate outside bound');
  }
  const initialField = field(p0, diagonal);
  let guess = p0.map((value, index) => value + signedStep * initialField[index]) as Vec3;
  if (!unitVectorBound(guess)) error('NUMERIC_LIMIT', 'triaxial midpoint predictor outside bound');
  for (let update = 0; update < 4; update++) {
    const middle = p0.map((value, index) => (value + guess[index]) / 2) as Vec3;
    const velocity = field(middle, diagonal);
    const residual = guess.map((value, index) => value - p0[index] - signedStep * velocity[index]) as Vec3;
    const jacobianField = derivative(middle, diagonal);
    const perturbation = maximumComponent(jacobianField.map((row) =>
      row.reduce((sum, value) => sum + Math.abs(signedStep * value / 2), 0)) as Vec3);
    // G1B_NEWTON_CONDITION: observe update/middle/residual/perturbation.
    if (!unitVectorBound(middle) || !Number.isFinite(perturbation) || perturbation > 1 / 4) {
      error('NUMERIC_LIMIT', 'triaxial midpoint Jacobian outside qualified bound');
    }
    const jacobian = jacobianField.map((row, i) => row.map((value, j) =>
      (i === j ? 1 : 0) - signedStep * value / 2) as Vec3) as [Vec3, Vec3, Vec3];
    const linearResult = linearSolve(jacobian, residual.map((value) => -value) as Vec3);
    const correction = linearResult.value;
    const linearResidualMaximum = linearResult.residualMaximum;
    const linearResidualBound = linearResult.residualBound;
    guess = guess.map((value, index) => value + correction[index]) as Vec3;
    // G1B_NEWTON_UPDATE: one completed update; observe existing local values.
    if (!unitVectorBound(guess)) error('NUMERIC_LIMIT', 'triaxial midpoint update outside bound');
  }
  const middle = p0.map((value, index) => (value + guess[index]) / 2) as Vec3;
  const velocity = field(middle, diagonal);
  const residual = guess.map((value, index) => value - p0[index] - signedStep * velocity[index]) as Vec3;
  const residualMaximum = maximumComponent(residual);
  const residualScale = Math.max(1, maximumComponent(p0), maximumComponent(guess),
    maximumComponent(velocity.map((value) => signedStep * value) as Vec3));
  const residualBound = 64 * ROUNDING_UNIT * residualScale;
  const finalPerturbation = maximumComponent(derivative(middle, diagonal).map((row) =>
    row.reduce((sum, value) => sum + Math.abs(signedStep * value / 2), 0)) as Vec3);
  // G1B_MIDPOINT_RESIDUAL: actual final residual/pivot/range evidence is test-only.
  if (!unitVectorBound(middle) || !Number.isFinite(residualMaximum) ||
      !Number.isFinite(finalPerturbation) || finalPerturbation > 1 / 4 || residualMaximum > residualBound) {
    error('NUMERIC_LIMIT', 'triaxial midpoint residual outside qualified bound');
  }
  return { p: guess, omegaMid: middle.map((value, index) => value * diagonal[index]) as Vec3 };
}

export function prepareFreeRotation(body: Body, dt: number): FreeRotationResult | null {
  // G1B_PREPARE_ENTRY: one call after actual angular actions/motors, before candidate writes.
  if (body.kind !== 'dynamic') return null;
  const moments: Vec3 = body.inertiaDiagonalKgM2 ??
    [body.inertiaKgM2!, body.inertiaKgM2!, body.inertiaKgM2!];
  if (!moments.every((value) => Number.isFinite(value) && value > 0) ||
      !Number.isFinite(dt) || dt <= 0) {
    error('NUMERIC_LIMIT', 'triaxial flow outside qualified time/inertia bounds');
  }
  if (moments[0] === moments[1] && moments[1] === moments[2]) return null;
  if (body.angularVelocityRadps.every((value) => value === 0)) {
    // Preserve the exact stationary state without scaling zero momentum.
    return { orientation: [...body.orientation], angularVelocityRadps: [...body.angularVelocityRadps] as Vec3 };
  }
  const magnitude = Math.hypot(...body.orientation);
  if (!Number.isFinite(magnitude) || magnitude === 0) error('NUMERIC_LIMIT', 'invalid triaxial orientation');
  let orientation = body.orientation.map((value) => value / magnitude) as Quat;
  const localOmega = rotate(inverse(orientation), body.angularVelocityRadps);
  if (!localOmega.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite triaxial body spin');
  const momentum = localOmega.map((value, index) => moments[index] * value) as Vec3;
  const momentumNorm = Math.hypot(...momentum);
  const momentumScale = 2 * momentumNorm;
  if (!momentum.every(Number.isFinite) || !Number.isFinite(momentumScale) || momentumNorm === 0) {
    error('NUMERIC_LIMIT', 'free rotation momentum outside finite range');
  }
  if (localOmega.filter((value) => value !== 0).length === 1) {
    // A single body-axis component has exact uniform rotation.
    return { orientation: advanceOrientation(orientation, body.angularVelocityRadps, dt),
      angularVelocityRadps: [...body.angularVelocityRadps] };
  }
  const diagonal = moments.map((value) => momentumScale / value) as Vec3;
  let p = momentum.map((value) => value / momentumScale) as Vec3;
  if (!diagonal.every(Number.isFinite) || Math.hypot(...p) > 1 / 2 + 4 * ROUNDING_UNIT) {
    error('NUMERIC_LIMIT', 'free rotation scaled momentum outside bound');
  }
  const maximumDifference = Math.max(Math.abs(diagonal[2] - diagonal[1]),
    Math.abs(diagonal[0] - diagonal[2]), Math.abs(diagonal[1] - diagonal[0]));
  const maximumWeight = Math.max(...triaxialFreeRotationCoefficients.weights.map(Math.abs));
  // |p_i| <= 1 gives ||h F'(p)/2||_infinity <= |h| max |D_i-D_j|.
  const subdivisions = Math.max(1, Math.ceil(4 * maximumWeight * dt * maximumDifference));
  if (!Number.isFinite(subdivisions) || subdivisions > 64) {
    error('NUMERIC_LIMIT', 'free rotation exceeded internal subdivision limit');
  }
  for (let subdivision = 0; subdivision < subdivisions; subdivision++) {
    for (let stage = 0; stage < 27; stage++) {
      const weight = triaxialFreeRotationCoefficients.weights[stage];
      if (!Number.isFinite(weight) || Math.abs(weight) >= 3) error('NUMERIC_LIMIT', 'invalid triaxial composition coefficient');
      const signedStep = weight * (dt / subdivisions);
      const prepared = midpoint(p, diagonal, signedStep);
      const vector = prepared.omegaMid.map((value) => signedStep * value / 2) as Vec3;
      const deltaNorm = Math.hypot(...vector, 1);
      if (!Number.isFinite(deltaNorm) || deltaNorm === 0) error('NUMERIC_LIMIT', 'invalid Cayley increment');
      const delta: Quat = [vector[0] / deltaNorm, vector[1] / deltaNorm, vector[2] / deltaNorm, 1 / deltaNorm];
      const composed = multiplyQuaternion(orientation, delta);
      const composedNorm = Math.hypot(...composed);
      if (!Number.isFinite(composedNorm) || composedNorm === 0) error('NUMERIC_LIMIT', 'nonfinite Cayley orientation');
      orientation = composed.map((value) => value / composedNorm) as Quat;
      p = prepared.p;
      // G1B_STAGE_COMPLETE: observe stage/weight/signedStep/p/orientation without recomputation.
    }
  }
  const angularVelocityRadps = rotate(orientation, p.map((value, index) => value * diagonal[index]) as Vec3);
  // G1B_GENERAL_RETURN: validate this result at the World boundary before assignment.
  return { orientation, angularVelocityRadps };
}
