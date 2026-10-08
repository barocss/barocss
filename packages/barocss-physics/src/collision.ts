import type { Body, BoxShape, CapsuleShape, Hit, PhysicsContact, SphereShape, Vec3 } from './types.js';
import { error } from './validation.js';
import { add, sub, scale, dot, cross, inverse, rotate, localPoint, worldPoint, inverseInertia } from './math.js';
import { capsuleBox, capsuleCapsule } from './capsule-contact.js';

function capsuleCenter(body: Body, point: Vec3): Vec3 {
  const half = (body.shape as CapsuleShape).halfLengthM;
  const local = localPoint(body, point);
  return worldPoint(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body: Body): Vec3[] {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis as Vec3));
}
function boxSupport(body: Body, direction: Vec3): Vec3 {
  const axes = boxAxes(body);
  const extents = (body.shape as BoxShape).halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) =>
    add(result, scale(axis, dot(axis, direction) >= 0 ? extents[index] : -extents[index])), [0, 0, 0] as Vec3));
}
function sphereSphere(a: Body, b: Body): Hit | null {
  const aRadius = (a.shape as SphereShape).radiusM;
  const bRadius = (b.shape as SphereShape).radiusM;
  const delta = sub(b.positionM, a.positionM);
  const distance = Math.hypot(...delta);
  if (distance > aRadius + bRadius) return null;
  const normal: Vec3 = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  const aSurface = add(a.positionM, scale(normal, aRadius));
  const bSurface = sub(b.positionM, scale(normal, bRadius));
  return { normal, penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale(add(aSurface, bSurface), 0.5) };
}
function sphereBox(sphere: Body, box: Body): Hit | null {
  const radius = (sphere.shape as SphereShape).radiusM;
  const extents = (box.shape as BoxShape).halfExtentsM;
  const relative = localPoint(box, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents[index], Math.min(extents[index], value))) as Vec3;
  const towardBox = sub(nearest, relative);
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return { normal: rotate(box.orientation, scale(towardBox, 1 / distance)),
    penetration: Math.max(0, radius - distance), pointM: worldPoint(box, nearest) };
  // Inside or on a face: axis X, Y, Z; negative face first on a tie.
  let axis = 0, side = -1, faceDistance = Infinity;
  for (let index = 0; index < 3; index++) for (const candidate of [-1, 1]) {
    const gap = extents[index] - candidate * relative[index];
    if (gap < faceDistance) { faceDistance = gap; axis = index; side = candidate; }
  }
  const localNormal: Vec3 = [0, 0, 0];
  localNormal[axis] = -side;
  nearest[axis] = side * extents[axis];
  return { normal: rotate(box.orientation, localNormal), penetration: radius + faceDistance,
    pointM: worldPoint(box, nearest) };
}
function capsuleSphere(capsule: Body, sphere: Body): Hit | null {
  const center = capsuleCenter(capsule, sphere.positionM);
  const delta = sub(sphere.positionM, center);
  const distance = Math.hypot(...delta);
  const capsuleRadius = (capsule.shape as CapsuleShape).radiusM;
  const sphereRadius = (sphere.shape as SphereShape).radiusM;
  if (distance > capsuleRadius + sphereRadius) return null;
  const normal: Vec3 = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  return { normal, penetration: Math.max(0, capsuleRadius + sphereRadius - distance),
    pointM: scale(add(add(center, scale(normal, capsuleRadius)),
      sub(sphere.positionM, scale(normal, sphereRadius))), 0.5) };
}
function boxBox(a: Body, b: Body): Hit | null {
  const axesA = boxAxes(a), axesB = boxAxes(b);
  const extentA = (a.shape as BoxShape).halfExtentsM, extentB = (b.shape as BoxShape).halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis: Vec3 = [1, 0, 0], bestOverlap = Infinity;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross(axisA, axisB)))];
  for (const candidate of candidates) {
    const length = Math.hypot(...candidate);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis, index) => sum + extentA[index] * Math.abs(dot(basis, axis)), 0);
    const radiusB = axesB.reduce((sum, basis, index) => sum + extentB[index] * Math.abs(dot(basis, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    if (overlap < -1e-12) return null;
    if (overlap < bestOverlap) { bestOverlap = overlap; bestAxis = scale(axis, signedDistance < 0 ? -1 : 1); }
  }
  const aPoint = boxSupport(a, bestAxis);
  const bPoint = boxSupport(b, scale(bestAxis, -1));
  return { normal: bestAxis, penetration: Math.max(0, bestOverlap), pointM: scale(add(aPoint, bPoint), 0.5) };
}
export function detect(a: Body, b: Body): Hit | null {
  if (a.shape.kind === 'sphere' && b.shape.kind === 'sphere') return sphereSphere(a, b);
  if (a.shape.kind === 'sphere' && b.shape.kind === 'box') return sphereBox(a, b);
  if (a.shape.kind === 'box' && b.shape.kind === 'sphere') {
    const hit = sphereBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === 'capsule' && b.shape.kind === 'sphere') return capsuleSphere(a, b);
  if (a.shape.kind === 'sphere' && b.shape.kind === 'capsule') {
    const hit = capsuleSphere(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === 'box' && b.shape.kind === 'box') return boxBox(a, b);
  if (a.shape.kind === 'capsule' && b.shape.kind === 'box') return capsuleBox(a, b);
  if (a.shape.kind === 'box' && b.shape.kind === 'capsule') {
    const hit = capsuleBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === 'capsule' && b.shape.kind === 'capsule') return capsuleCapsule(a, b);
  return null;
}
export function sphereOverlaps(center: Vec3, radius: number, body: Body): boolean {
  if (body.shape.kind === 'sphere') {
    return Math.hypot(...sub(center, body.positionM)) <= radius + body.shape.radiusM;
  }
  if (body.shape.kind === 'capsule') {
    return Math.hypot(...sub(center, capsuleCenter(body, center))) <= radius + body.shape.radiusM;
  }
  const extents = body.shape.halfExtentsM;
  const local = localPoint(body, center);
  const delta = local.map((value, index) => Math.max(0, Math.abs(value) - extents[index]));
  return Math.hypot(...delta) <= radius;
}
function raySphere(origin: Vec3, direction: Vec3, center: Vec3, radius: number): number | null {
  const relative = sub(origin, center);
  const c = dot(relative, relative) - radius ** 2;
  if (c <= 0) return 0;
  const projection = dot(relative, direction);
  const discriminant = projection ** 2 - c;
  return projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
}
export function rayDistance(origin: Vec3, direction: Vec3, body: Body): number | null {
  if (body.shape.kind === 'sphere') return raySphere(origin, direction, body.positionM, body.shape.radiusM);
  const localOrigin = localPoint(body, origin);
  const localDirection = rotate(inverse(body.orientation), direction);
  if (body.shape.kind === 'capsule') {
    const { radiusM: radius, halfLengthM: half } = body.shape;
    const closest: Vec3 = [0, Math.max(-half, Math.min(half, localOrigin[1])), 0];
    if (Math.hypot(...sub(localOrigin, closest)) <= radius) return 0;
    const results: number[] = [];
    for (const y of [-half, half]) {
      const hit = raySphere(localOrigin, localDirection, [0, y, 0], radius);
      if (hit !== null) results.push(hit);
    }
    const a = localDirection[0] ** 2 + localDirection[2] ** 2;
    if (a > 1e-12) {
      const b = 2 * (localOrigin[0] * localDirection[0] + localOrigin[2] * localDirection[2]);
      const c = localOrigin[0] ** 2 + localOrigin[2] ** 2 - radius ** 2;
      const discriminant = b ** 2 - 4 * a * c;
      if (discriminant >= 0) for (const sign of [-1, 1]) {
        const hit = (-b + sign * Math.sqrt(discriminant)) / (2 * a);
        const y = localOrigin[1] + localDirection[1] * hit;
        if (hit >= 0 && y >= -half && y <= half) results.push(hit);
      }
    }
    return results.length ? Math.min(...results) : null;
  }
  let near = -Infinity, far = Infinity;
  for (let index = 0; index < 3; index++) {
    const lower = -body.shape.halfExtentsM[index];
    const upper = body.shape.halfExtentsM[index];
    const component = localDirection[index];
    if (Math.abs(component) < 1e-12) {
      if (localOrigin[index] < lower || localOrigin[index] > upper) return null;
      continue;
    }
    const first = (lower - localOrigin[index]) / component;
    const second = (upper - localOrigin[index]) / component;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (far < near) return null;
  }
  return far < 0 ? null : Math.max(0, near);
}
export function solve(a: Body, b: Body, hit: Hit): { normalImpulseNs: number; tangentImpulseNs: Vec3 } {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0) return { normalImpulseNs: 0, tangentImpulseNs: [0, 0, 0] };
  const armA = sub(hit.pointM, a.positionM), armB = sub(hit.pointM, b.positionM);
  const pointVelocityA = add(a.velocityMps, cross(a.angularVelocityRadps, armA));
  const pointVelocityB = add(b.velocityMps, cross(b.angularVelocityRadps, armB));
  const relativeSpeed = dot(hit.normal, sub(pointVelocityB, pointVelocityA));
  const torqueAxisA = cross(armA, hit.normal), torqueAxisB = cross(armB, hit.normal);
  const effectiveMass = inverseTotal + dot(torqueAxisA, inverseInertia(a, torqueAxisA))
    + dot(torqueAxisB, inverseInertia(b, torqueAxisB));
  let impulse = 0;
  if (relativeSpeed < 0) {
    const bounce = -relativeSpeed > 0.5 ? Math.min(a.restitution, b.restitution) : 0;
    impulse = -(1 + bounce) * relativeSpeed / effectiveMass;
  }
  a.angularVelocityRadps = sub(a.angularVelocityRadps, scale(inverseInertia(a, torqueAxisA), impulse));
  b.angularVelocityRadps = add(b.angularVelocityRadps, scale(inverseInertia(b, torqueAxisB), impulse));
  for (let i = 0; i < 3; i++) {
    a.velocityMps[i] -= hit.normal[i] * impulse * a.inverseMass;
    b.velocityMps[i] += hit.normal[i] * impulse * b.inverseMass;
    a.positionM[i] -= hit.normal[i] * hit.penetration * a.inverseMass / inverseTotal;
    b.positionM[i] += hit.normal[i] * hit.penetration * b.inverseMass / inverseTotal;
  }
  const staticFriction = Math.sqrt(a.frictionStatic * b.frictionStatic);
  if (impulse === 0 || staticFriction === 0) {
    return { normalImpulseNs: impulse, tangentImpulseNs: [0, 0, 0] };
  }
  const frictionArmA = sub(hit.pointM, a.positionM);
  const frictionArmB = sub(hit.pointM, b.positionM);
  const afterA = add(a.velocityMps, cross(a.angularVelocityRadps, frictionArmA));
  const afterB = add(b.velocityMps, cross(b.angularVelocityRadps, frictionArmB));
  const relative = sub(afterB, afterA);
  const tangent = sub(relative, scale(hit.normal, dot(relative, hit.normal)));
  const speed = Math.hypot(...tangent);
  if (speed === 0) return { normalImpulseNs: impulse, tangentImpulseNs: [0, 0, 0] };
  const direction = scale(tangent, 1 / speed);
  const tangentAxisA = cross(frictionArmA, direction), tangentAxisB = cross(frictionArmB, direction);
  const tangentMass = inverseTotal + dot(tangentAxisA, inverseInertia(a, tangentAxisA))
    + dot(tangentAxisB, inverseInertia(b, tangentAxisB));
  const required = speed / tangentMass;
  const dynamicFriction = Math.sqrt(a.frictionDynamic * b.frictionDynamic);
  const magnitude = required <= staticFriction * impulse
    ? required : Math.min(required, dynamicFriction * impulse);
  const tangentImpulse = scale(direction, -magnitude);
  a.velocityMps = sub(a.velocityMps, scale(tangentImpulse, a.inverseMass));
  b.velocityMps = add(b.velocityMps, scale(tangentImpulse, b.inverseMass));
  a.angularVelocityRadps = sub(a.angularVelocityRadps,
    inverseInertia(a, cross(frictionArmA, tangentImpulse)));
  b.angularVelocityRadps = add(b.angularVelocityRadps,
    inverseInertia(b, cross(frictionArmB, tangentImpulse)));
  return { normalImpulseNs: impulse, tangentImpulseNs: tangentImpulse };
}
export function validateResult(bodies: Body[], contacts: PhysicsContact[]): void {
  for (const body of bodies) {
    for (const [label, values, bound] of [['position', body.positionM, 10000], ['velocity', body.velocityMps, 1000],
      ['angularVelocity', body.angularVelocityRadps, 1000]] as const) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound)) error('NUMERIC_LIMIT', `${body.id} ${label} exceeded bounds`);
    }
    if (body.orientation.some((value) => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...body.orientation) - 1) > 1e-12) error('NUMERIC_LIMIT', `${body.id} orientation exceeded tolerance`);
  }
  if (contacts.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) ||
    contact.normalAtoB.some((value) => !Number.isFinite(value)) ||
    contact.pointM.some((value) => !Number.isFinite(value)) ||
    contact.tangentImpulseNs.some((value) => !Number.isFinite(value)))) error('NUMERIC_LIMIT', 'unsafe contact result');
}
