import { g1Control } from './g1-test-control.js';
/** Private exact symmetric-top free flow. No retained state or public hooks. */
import type { Body, Quat, Vec3 } from './internal-types.js';
import { add, scale, dot, rotate, advanceOrientation, multiplyQuaternion } from './math.js';
import { error } from './validation.js';

export interface FreeRotationResult {
  orientation: Quat;
  angularVelocityRadps: Vec3;
}

export function prepareAxisymmetricFreeRotation(body: Body, dt: number): FreeRotationResult | null {
  // G1_FREE_PREPARE_ENTRY: one dispatch per awake dynamic free stage.
  g1Control.count('prepare');
  if (body.kind !== 'dynamic' || body.shape.kind !== 'box') return null;
  const moments = body.inertiaDiagonalKgM2;
  if (!moments || moments[0] === moments[1] && moments[1] === moments[2]) return null;
  const half = body.shape.halfExtentsM;
  let axis: number;
  let repeated: number;
  if (half[0] === half[1] && moments[0] === moments[1]) {
    axis = 2; repeated = moments[0];
  } else if (half[1] === half[2] && moments[1] === moments[2]) {
    axis = 0; repeated = moments[1];
  } else if (half[0] === half[2] && moments[0] === moments[2]) {
    axis = 1; repeated = moments[0];
  } else return null;
  const distinct = moments[axis];
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(repeated) || repeated <= 0 ||
      !Number.isFinite(distinct) || distinct <= 0) error('NUMERIC_LIMIT', 'invalid symmetric-top free-flow data');
  // G1_AXISYMMETRIC_ENTRY: eligible repeated-moment primitive box.
  g1Control.count('eligible');
  if (body.angularVelocityRadps.every(value => value === 0)) {
    // G1_ZERO_SPIN_RETURN: retain the actual zero/quaternion word signs.
  g1Control.count('zero');
    return { orientation: [...body.orientation], angularVelocityRadps: [...body.angularVelocityRadps] };
  }
  // G1_NONZERO_SYMMETRIC_FLOW: exactly two rotation factors, no retry.
  g1Control.count('nonzero');
  const magnitude = Math.hypot(...body.orientation);
  if (!Number.isFinite(magnitude) || magnitude === 0) error('NUMERIC_LIMIT', 'invalid free-flow orientation');
  const q0 = body.orientation.map(value => value / magnitude) as Quat;
  const localAxis: Vec3 = [0, 0, 0]; localAxis[axis] = 1;
  const worldAxis = rotate(q0, localAxis);
  const parallelSpeed = dot(body.angularVelocityRadps, worldAxis);
  const momentum = add(scale(body.angularVelocityRadps, repeated),
    scale(worldAxis, (distinct - repeated) * parallelSpeed));
  const precession = scale(momentum, 1 / repeated);
  const bodySpin = (repeated - distinct) * parallelSpeed / repeated;
  const left = advanceOrientation(q0, precession, dt);
  const halfAngle = bodySpin * dt / 2;
  // G1_BODY_SPIN_SIN: one native sine for the body factor.
  const sine = g1Control.trig('bodySin', Math.sin(halfAngle));
  // G1_BODY_SPIN_COS: one native cosine for the body factor.
  const cosine = g1Control.trig('bodyCos', Math.cos(halfAngle));
  const right: Quat = [localAxis[0] * sine, localAxis[1] * sine, localAxis[2] * sine, cosine];
  const composed = multiplyQuaternion(left, right);
  const norm = Math.hypot(...composed);
  if (!Number.isFinite(norm) || norm === 0) error('NUMERIC_LIMIT', 'nonfinite symmetric-top orientation');
  const orientation = composed.map(value => value / norm) as Quat;
  const angularVelocityRadps = add(precession, scale(rotate(orientation, localAxis), bodySpin));
  return { orientation, angularVelocityRadps };
}

export function validateFreeRotationResult(result: FreeRotationResult, dt: number): void {
  // G1_FREE_VALIDATE_ENTRY: after test-only replacement, before candidate writes.
  g1Control.count('validate');
  if (result.angularVelocityRadps.some(value => !Number.isFinite(value) || Math.abs(value) > 1000) ||
      !Number.isFinite(dt) || dt <= 0 || Math.hypot(...result.angularVelocityRadps) * dt > 10) {
    error('NUMERIC_LIMIT', 'free rotation exceeded angular movement limit');
  }
  if (result.orientation.some(value => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...result.orientation) - 1) > 1e-12) {
    error('NUMERIC_LIMIT', 'free rotation orientation exceeded tolerance');
  }
}
