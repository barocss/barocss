import type { Body, Vec3 } from './internal-types.js';
import { add, cross, dot, inverseInertia, scale } from './math.js';
import { error } from './validation.js';

function unsafeTangent(): never {
  return error('NUMERIC_LIMIT', 'unsafe static tangent response');
}

/** Solve the two physical tangent constraints; the caller owns the Coulomb branch. */
export function solveStaticTangent(a: Body, b: Body, armA: Vec3, armB: Vec3,
  normal: Vec3, direction: Vec3, speed: number, tangentMass: number): {
    impulseNs: Vec3; magnitudeNs: number;
  } {
  const perpendicular = cross(normal, direction);
  const length = Math.hypot(...perpendicular);
  if (!(length > 0) || !Number.isFinite(length)) unsafeTangent();
  const second = scale(perpendicular, 1 / length);
  const firstAxisA = cross(armA, direction), firstAxisB = cross(armB, direction);
  const secondAxisA = cross(armA, second), secondAxisB = cross(armB, second);
  const secondResponseA = inverseInertia(a, secondAxisA);
  const secondResponseB = inverseInertia(b, secondAxisB);
  const coupledMass = dot(firstAxisA, secondResponseA) + dot(firstAxisB, secondResponseB);
  const secondMass = a.inverseMass + b.inverseMass
    + dot(secondAxisA, secondResponseA) + dot(secondAxisB, secondResponseB);
  if (![tangentMass, coupledMass, secondMass].every(Number.isFinite)
    || !(tangentMass > 0) || !(secondMass > 0)) unsafeTangent();

  let firstImpulse: number, secondImpulse: number;
  if (coupledMass === 0) {
    // Keep the scalar arithmetic for uncoupled contacts, including exact
    // representable sphere static/dynamic boundaries.
    firstImpulse = -speed / tangentMass;
    secondImpulse = 0;
  } else if (tangentMass >= secondMass) {
    const ratio = coupledMass / tangentMass;
    const schur = secondMass - coupledMass * ratio;
    if (!Number.isFinite(ratio) || !(schur > 0) || !Number.isFinite(schur)) unsafeTangent();
    secondImpulse = speed * ratio / schur;
    firstImpulse = (-speed - coupledMass * secondImpulse) / tangentMass;
  } else {
    const ratio = coupledMass / secondMass;
    const schur = tangentMass - coupledMass * ratio;
    if (!Number.isFinite(ratio) || !(schur > 0) || !Number.isFinite(schur)) unsafeTangent();
    firstImpulse = -speed / schur;
    secondImpulse = -ratio * firstImpulse;
  }
  const magnitudeNs = coupledMass === 0 ? Math.abs(firstImpulse)
    : Math.hypot(firstImpulse, secondImpulse);
  const impulseNs = coupledMass === 0 ? scale(direction, firstImpulse)
    : add(scale(direction, firstImpulse), scale(second, secondImpulse));
  if (!Number.isFinite(magnitudeNs) || ![firstImpulse, secondImpulse, ...impulseNs].every(Number.isFinite)) {
    unsafeTangent();
  }
  return { impulseNs, magnitudeNs };
}
