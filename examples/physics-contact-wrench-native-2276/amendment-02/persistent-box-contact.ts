import {actualContribution,emptyContribution,combineContribution,type PairContribution} from './producer.js';
import { bodyWords, phaseKind, phaseApplyBefore, phaseApplyAfter, phaseNoNormal, phaseCorrectionBefore, phaseCorrectionAfter } from './private-phase.js';
import type { Body, Vec3 } from './internal-types.js';
import { add, cross, dot, inverseInertia, scale, sub } from './math.js';

export interface PointImpulse { normalNs: number; tangentNs: Vec3 }

function apply(a: Body, b: Body, pointM: Vec3, impulse: Vec3): PairContribution {
  const traceApply = phaseApplyBefore(a,b,pointM,impulse);
  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
  a.velocityMps = sub(a.velocityMps, scale(impulse, a.inverseMass));
  b.velocityMps = add(b.velocityMps, scale(impulse, b.inverseMass));
  a.angularVelocityRadps = sub(a.angularVelocityRadps,
    inverseInertia(a, cross(armA, impulse)));
  b.angularVelocityRadps = add(b.angularVelocityRadps,
    inverseInertia(b, cross(armB, impulse)));
  const producerContribution=actualContribution(pointM,impulse);
  phaseApplyAfter(traceApply,a,b);
  return producerContribution;
}

function relativeVelocity(a: Body, b: Body, pointM: Vec3): Vec3 {
  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
  return sub(add(b.velocityMps, cross(b.angularVelocityRadps, armB)),
    add(a.velocityMps, cross(a.angularVelocityRadps, armA)));
}

function effectiveInverseMass(a: Body, b: Body, pointM: Vec3, direction: Vec3): number {
  const torqueA = cross(sub(pointM, a.positionM), direction);
  const torqueB = cross(sub(pointM, b.positionM), direction);
  return a.inverseMass + b.inverseMass + dot(torqueA, inverseInertia(a, torqueA))
    + dot(torqueB, inverseInertia(b, torqueB));
}

export function warmStartPoint(a: Body, b: Body, pointM: Vec3, normal: Vec3,
  impulse: PointImpulse): PairContribution {
  phaseKind('warm',{actualPriorApplication:true});
  return apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));
}

export function solvePersistentPoint(a: Body, b: Body, pointM: Vec3, normal: Vec3,
  impulse: PointImpulse, normalTargetMps: number): PairContribution {
  let producerContribution=emptyContribution();
  const normalSpeed = dot(relativeVelocity(a, b, pointM), normal);
  const normalMass = effectiveInverseMass(a, b, pointM, normal);
  const nextNormal = Math.max(0, normalTargetMps === 0
    ? impulse.normalNs - normalSpeed / normalMass
    : impulse.normalNs + (normalTargetMps - normalSpeed) / normalMass);
  const deltaNormal = nextNormal - impulse.normalNs;
  impulse.normalNs = nextNormal;
  phaseKind('normal',{normalTargetMps,normalSpeed,normalMass,deltaNormal});
  if (deltaNormal !== 0) producerContribution=combineContribution(producerContribution,apply(a, b, pointM, scale(normal, deltaNormal))); else phaseNoNormal();

  const relative = relativeVelocity(a, b, pointM);
  const tangent = sub(relative, scale(normal, dot(relative, normal)));
  const tangentSpeed = Math.hypot(...tangent);
  // Even when tangential speed is zero, a reduced normal impulse may
  // invalidate previously accumulated friction. Reproject the cache instead
  // of returning with a now-impossible Coulomb impulse.
  let requested = impulse.tangentNs;
  if (tangentSpeed >= 1e-12) {
    const direction = scale(tangent, 1 / tangentSpeed);
    const tangentMass = effectiveInverseMass(a, b, pointM, direction);
    requested = sub(impulse.tangentNs, scale(direction, tangentSpeed / tangentMass));
  }
  const requestedMagnitude = Math.hypot(...requested);
  const staticLimit = Math.sqrt(a.frictionStatic * b.frictionStatic) * impulse.normalNs;
  const dynamicLimit = Math.sqrt(a.frictionDynamic * b.frictionDynamic) * impulse.normalNs;
  const limit = requestedMagnitude <= staticLimit ? staticLimit : dynamicLimit;
  const nextTangent = requestedMagnitude > limit && requestedMagnitude > 0
    ? scale(requested, limit / requestedMagnitude) : requested;
  const deltaTangent = sub(nextTangent, impulse.tangentNs);
  impulse.tangentNs = nextTangent;
  phaseKind('tangent',{tangentSpeed,requestedMagnitude,staticLimit,dynamicLimit,branch:requestedMagnitude<=staticLimit?'static':'dynamic'});
  producerContribution=combineContribution(producerContribution,apply(a, b, pointM, deltaTangent));
  return producerContribution;
}

export function correctPersistentPair(a: Body, b: Body, normal: Vec3,
  penetration: number): void {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0 || penetration <= 0) return;
  const traceCorrection=phaseCorrectionBefore(a,b,normal,penetration);
  const correction = scale(normal, penetration / inverseTotal);
  a.positionM = sub(a.positionM, scale(correction, a.inverseMass));
  b.positionM = add(b.positionM, scale(correction, b.inverseMass));
  phaseCorrectionAfter(traceCorrection,a,b);
}
