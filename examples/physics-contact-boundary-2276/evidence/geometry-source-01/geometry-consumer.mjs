var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// examples/physics-contact-boundary-2276/geometry-consumer.mjs
import assert4 from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// examples/physics-contact-boundary-2276/geometry-entry.ts
var geometry_entry_exports = {};
__export(geometry_entry_exports, {
  PhysicsError: () => PhysicsError,
  add: () => add,
  advanceOrientation: () => advanceOrientation,
  clipFace: () => clipFace,
  closestSegments: () => closestSegments,
  detect: () => detect,
  faceContact: () => faceContact,
  featureContact: () => featureContact,
  inverseInertia: () => inverseInertia,
  parseBody: () => parseBody,
  scale: () => scale,
  selectBoxSATFeature: () => selectBoxSATFeature
});

// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

// packages/barocss-physics/src/limits.ts
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_STEP_DISPLACEMENT_M = 10;

// packages/barocss-physics/src/validation.ts
function error(code, message) {
  throw new PhysicsError(code, message);
}
function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) error("INVALID_CONFIG", `${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) error("INVALID_CONFIG", `${label} must be a plain object`);
  return value;
}
function fields(value, allowed, label) {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.includes(key))) {
    error("INVALID_CONFIG", `${label} has an unsupported field`);
  }
}
function finite(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    error("INVALID_CONFIG", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function vector(value, min, max, label) {
  if (!Array.isArray(value) || value.length !== 3) error("INVALID_CONFIG", `${label} must be a 3-vector`);
  return [0, 1, 2].map((index) => finite(value[index], min, max, `${label}[${index}]`));
}
function angularVector(value) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error("INVALID_CONFIG", "angularVelocityRadps must be a dense 3-vector");
  }
  return vector(value, -1e3, 1e3, "angularVelocityRadps");
}
function quaternion(value) {
  if (!Array.isArray(value) || value.length !== 4 || Reflect.ownKeys(value).length !== 5 || ![0, 1, 2, 3].every((index) => Object.hasOwn(value, index))) {
    error("INVALID_CONFIG", "orientation must be a dense [x,y,z,w] quaternion");
  }
  const values = value.map((component) => finite(component, -1, 1, "orientation"));
  const magnitude = Math.hypot(...values);
  if (Math.abs(magnitude - 1) > 1e-6) error("INVALID_CONFIG", "orientation must have unit norm");
  return values.map((component) => component / magnitude);
}
function shape(value) {
  const input = record(value, "shape");
  if (input.kind === "sphere") {
    fields(input, ["kind", "radiusM"], "sphere");
    return { kind: "sphere", radiusM: finite(input.radiusM, 1e-4, 1e3, "radiusM") };
  }
  if (input.kind === "box") {
    fields(input, ["kind", "halfExtentsM"], "box");
    return { kind: "box", halfExtentsM: vector(input.halfExtentsM, 1e-4, 1e3, "halfExtentsM") };
  }
  if (input.kind === "capsule") {
    fields(input, ["kind", "radiusM", "halfLengthM"], "capsule");
    return {
      kind: "capsule",
      radiusM: finite(input.radiusM, 1e-4, 1e3, "radiusM"),
      halfLengthM: finite(input.halfLengthM, 1e-4, 1e3, "halfLengthM")
    };
  }
  return error("INVALID_CONFIG", "unsupported collider shape");
}
function friction(value) {
  const input = record(value, "friction");
  fields(input, ["static", "dynamic"], "friction");
  const staticCoefficient = finite(input.static, 0, 2, "friction.static");
  const dynamicCoefficient = finite(input.dynamic, 0, staticCoefficient, "friction.dynamic");
  return { static: staticCoefficient, dynamic: dynamicCoefficient };
}
function collisionFilter(value) {
  const input = record(value, "collisionFilter");
  fields(input, ["categoryBits", "maskBits"], "collisionFilter");
  if (!Number.isInteger(input.categoryBits) || !Number.isInteger(input.maskBits)) {
    error("INVALID_CONFIG", "collision filter bits must be integers");
  }
  return {
    categoryBits: finite(input.categoryBits, 1, 65535, "categoryBits"),
    maskBits: finite(input.maskBits, 0, 65535, "maskBits")
  };
}
function parseBody(value, largeMode = false) {
  const input = record(value, "body");
  if (typeof input.id !== "string" || !ID.test(input.id)) error("INVALID_CONFIG", "invalid body ID");
  if (input.kind !== "dynamic" && input.kind !== "static" && input.kind !== "kinematic") {
    error("INVALID_CONFIG", "invalid body kind");
  }
  const kind = input.kind;
  fields(input, kind === "dynamic" ? [
    "id",
    "kind",
    "shape",
    "positionM",
    "velocityMps",
    "massKg",
    "restitution",
    "orientation",
    "angularVelocityRadps",
    "inertiaKgM2",
    "friction",
    "ccd",
    ...largeMode ? ["collisionFilter"] : []
  ] : [
    "id",
    "kind",
    "shape",
    "positionM",
    "restitution",
    "orientation",
    "sensor",
    "friction",
    ...largeMode ? ["collisionFilter"] : []
  ], "body");
  if (Object.hasOwn(input, "sensor") && input.sensor !== true) error("INVALID_CONFIG", "sensor must be true");
  const sensor = input.sensor === true;
  const parsedShape = shape(input.shape);
  if (Object.hasOwn(input, "ccd") && (input.ccd !== true || parsedShape.kind !== "sphere" && parsedShape.kind !== "box")) {
    error("INVALID_CONFIG", "ccd is supported for dynamic spheres or boxes only and must be true");
  }
  const positionM = vector(input.positionM, -1e4, 1e4, "positionM");
  const restitution = finite(input.restitution, 0, 1, "restitution");
  const material = Object.hasOwn(input, "friction") ? friction(input.friction) : { static: 0, dynamic: 0 };
  const filter = largeMode ? Object.hasOwn(input, "collisionFilter") ? collisionFilter(input.collisionFilter) : { categoryBits: 1, maskBits: 65535 } : void 0;
  const orientation = Object.hasOwn(input, "orientation") ? quaternion(input.orientation) : [0, 0, 0, 1];
  if (kind !== "dynamic") {
    return {
      id: input.id,
      kind,
      shape: parsedShape,
      positionM,
      velocityMps: [0, 0, 0],
      orientation,
      angularVelocityRadps: [0, 0, 0],
      inverseInertiaLocal: [0, 0, 0],
      sensor,
      inverseMass: 0,
      restitution,
      frictionStatic: material.static,
      frictionDynamic: material.dynamic,
      ...filter ? { collisionFilter: filter } : {}
    };
  }
  const massKg = finite(input.massKg, 1e-6, 1e6, "massKg");
  if (parsedShape.kind !== "sphere" && Object.hasOwn(input, "inertiaKgM2")) {
    error("INVALID_CONFIG", "inertiaKgM2 override is supported for spheres only");
  }
  const inertiaKgM2 = parsedShape.kind === "sphere" ? Object.hasOwn(input, "inertiaKgM2") ? finite(input.inertiaKgM2, 1e-12, 1e12, "inertiaKgM2") : 0.4 * massKg * parsedShape.radiusM ** 2 : void 0;
  const inertiaDiagonalKgM2 = parsedShape.kind === "box" ? [
    massKg / 3 * (parsedShape.halfExtentsM[1] ** 2 + parsedShape.halfExtentsM[2] ** 2),
    massKg / 3 * (parsedShape.halfExtentsM[0] ** 2 + parsedShape.halfExtentsM[2] ** 2),
    massKg / 3 * (parsedShape.halfExtentsM[0] ** 2 + parsedShape.halfExtentsM[1] ** 2)
  ] : parsedShape.kind === "capsule" ? Array(3).fill(0.4 * massKg * (parsedShape.radiusM + parsedShape.halfLengthM) ** 2) : void 0;
  const inertia = inertiaDiagonalKgM2 ?? [inertiaKgM2, inertiaKgM2, inertiaKgM2];
  return {
    id: input.id,
    kind,
    shape: parsedShape,
    positionM,
    sensor,
    ...filter ? { collisionFilter: filter, sleeping: false } : {},
    ...input.ccd === true ? { ccd: true } : {},
    velocityMps: vector(input.velocityMps, -1e3, 1e3, "velocityMps"),
    orientation,
    angularVelocityRadps: Object.hasOwn(input, "angularVelocityRadps") ? angularVector(input.angularVelocityRadps) : [0, 0, 0],
    ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
    ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2 },
    inverseInertiaLocal: inertia.map((value2) => 1 / value2),
    inverseMass: 1 / massKg,
    restitution,
    frictionStatic: material.static,
    frictionDynamic: material.dynamic
  };
}

// packages/barocss-physics/src/math.ts
function multiplyQuaternion(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}
function advanceOrientation(orientation, angularVelocity, dt) {
  const speed = Math.hypot(...angularVelocity);
  if (speed === 0) return [...orientation];
  const halfAngle = speed * dt / 2;
  const scale2 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale2,
    angularVelocity[1] * scale2,
    angularVelocity[2] * scale2,
    Math.cos(halfAngle)
  ];
  const next = multiplyQuaternion(delta, orientation);
  const norm = Math.hypot(...next);
  return next.map((component) => component / norm);
}
var add = (a, b) => a.map((value, index) => value + b[index]);
var sub = (a, b) => a.map((value, index) => value - b[index]);
var scale = (a, value) => a.map((component) => component * value);
var dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
function rotate(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}
var localPoint = (body2, point2) => rotate(inverse(body2.orientation), sub(point2, body2.positionM));
var worldPoint = (body2, point2) => add(body2.positionM, rotate(body2.orientation, point2));
function inverseInertia(body2, vector2) {
  const local = rotate(inverse(body2.orientation), vector2);
  return rotate(body2.orientation, local.map((value, index) => value * body2.inverseInertiaLocal[index]));
}

// packages/barocss-physics/src/capsule-contact.ts
var clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function capsuleEnds(body2) {
  const half = body2.shape.halfLengthM;
  return [worldPoint(body2, [0, -half, 0]), worldPoint(body2, [0, half, 0])];
}
function segmentPair(a0, a1, b0, b1) {
  const u = sub(a1, a0), v = sub(b1, b0), w = sub(a0, b0);
  const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v);
  const dd = dot(u, w), ee = dot(v, w), determinant = aa * cc - bb * bb;
  const candidates = [
    [0, clamp(ee / cc, 0, 1)],
    [1, clamp((bb + ee) / cc, 0, 1)],
    [clamp(-dd / aa, 0, 1), 0],
    [clamp((bb - dd) / aa, 0, 1), 1],
    [0.5, clamp((bb * 0.5 + ee) / cc, 0, 1)],
    [clamp((bb * 0.5 - dd) / aa, 0, 1), 0.5]
  ];
  if (determinant > 1e-12 * aa * cc) {
    const s = (bb * ee - cc * dd) / determinant;
    const t = (aa * ee - bb * dd) / determinant;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) candidates.push([s, t]);
  }
  let best = candidates[0], bestDistance = Infinity, bestTie = Infinity;
  for (const candidate of candidates) {
    const difference = sub(add(a0, scale(u, candidate[0])), add(b0, scale(v, candidate[1])));
    const distance = dot(difference, difference);
    const tie = Math.abs(candidate[0] - 0.5) + Math.abs(candidate[1] - 0.5);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && tie < bestTie) {
      best = candidate;
      bestDistance = distance;
      bestTie = tie;
    }
  }
  return [add(a0, scale(u, best[0])), add(b0, scale(v, best[1]))];
}
function segmentBox(segmentStart, segmentEnd, extents2) {
  const direction = sub(segmentEnd, segmentStart);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) < 1e-15) continue;
    for (const face of [-extents2[axis], extents2[axis]]) {
      const t = (face - segmentStart[axis]) / direction[axis];
      if (t > 0 && t < 1) breaks.push(t);
    }
  }
  breaks.sort((a, b) => a - b);
  let bestT = 0.5, bestDistance = Infinity;
  for (let interval = 0; interval < breaks.length - 1; interval++) {
    const low = breaks[interval], high = breaks[interval + 1];
    if (high - low < 1e-15) continue;
    const midpoint = (low + high) / 2;
    let numerator = 0, denominator = 0;
    for (let axis = 0; axis < 3; axis++) {
      const value = segmentStart[axis] + midpoint * direction[axis];
      const face = value < -extents2[axis] ? -extents2[axis] : value > extents2[axis] ? extents2[axis] : null;
      if (face === null) continue;
      numerator += direction[axis] * (segmentStart[axis] - face);
      denominator += direction[axis] ** 2;
    }
    const t = clamp(denominator ? -numerator / denominator : 0.5, low, high);
    const point3 = add(segmentStart, scale(direction, t));
    const nearest = point3.map((value, axis) => clamp(value, -extents2[axis], extents2[axis]));
    const delta = sub(point3, nearest), distance = dot(delta, delta);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(bestT - 0.5)) {
      bestT = t;
      bestDistance = distance;
    }
  }
  const point2 = add(segmentStart, scale(direction, bestT));
  return [point2, point2.map((value, axis) => clamp(value, -extents2[axis], extents2[axis]))];
}
function capsuleCapsule(a, b) {
  const [aPoint, bPoint] = segmentPair(...capsuleEnds(a), ...capsuleEnds(b));
  const delta = sub(bPoint, aPoint), distance = Math.hypot(...delta);
  const aRadius = a.shape.radiusM;
  const bRadius = b.shape.radiusM;
  if (distance > aRadius + bRadius) return null;
  const centerDelta = sub(b.positionM, a.positionM);
  const normal = distance > 1e-12 ? scale(delta, 1 / distance) : Math.hypot(...centerDelta) > 1e-12 ? scale(centerDelta, 1 / Math.hypot(...centerDelta)) : a.id < b.id ? [1, 0, 0] : [-1, 0, 0];
  const surfaceA = add(aPoint, scale(normal, aRadius));
  const surfaceB = sub(bPoint, scale(normal, bRadius));
  return {
    normal,
    penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale(add(surfaceA, surfaceB), 0.5)
  };
}
function capsuleBox(capsule, box) {
  const [start, end] = capsuleEnds(capsule).map((point2) => localPoint(box, point2));
  const extents2 = box.shape.halfExtentsM;
  const [axisPoint, boxPoint] = segmentBox(start, end, extents2);
  const delta = sub(boxPoint, axisPoint), distance = Math.hypot(...delta);
  const radius = capsule.shape.radiusM;
  if (distance > radius) return null;
  if (distance > 1e-12) return {
    normal: rotate(box.orientation, scale(delta, 1 / distance)),
    penetration: radius - distance,
    pointM: worldPoint(box, boxPoint)
  };
  let bestAxis = 0, bestSide = -1, bestGap = Infinity;
  for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
    const gap = extents2[axis] - side * axisPoint[axis];
    if (gap < bestGap) {
      bestGap = gap;
      bestAxis = axis;
      bestSide = side;
    }
  }
  const normalLocal = [0, 0, 0];
  normalLocal[bestAxis] = -bestSide;
  boxPoint[bestAxis] = bestSide * extents2[bestAxis];
  return {
    normal: rotate(box.orientation, normalLocal),
    penetration: radius + bestGap,
    pointM: worldPoint(box, boxPoint)
  };
}

// packages/barocss-physics/src/collision.ts
function capsuleCenter(body2, point2) {
  const half = body2.shape.halfLengthM;
  const local = localPoint(body2, point2);
  return worldPoint(body2, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body2) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body2.orientation, axis));
}
function boxSupport(body2, direction) {
  const axes = boxAxes(body2);
  const extents2 = body2.shape.halfExtentsM;
  return add(body2.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
    return add(result, scale(axis, offset));
  }, [0, 0, 0]));
}
function sphereSphere(a, b) {
  const aRadius = a.shape.radiusM;
  const bRadius = b.shape.radiusM;
  const delta = sub(b.positionM, a.positionM);
  const distance = Math.hypot(...delta);
  if (distance > aRadius + bRadius) return null;
  const normal = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  const aSurface = add(a.positionM, scale(normal, aRadius));
  const bSurface = sub(b.positionM, scale(normal, bRadius));
  return {
    normal,
    penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale(add(aSurface, bSurface), 0.5)
  };
}
function sphereBox(sphere, box) {
  const radius = sphere.shape.radiusM;
  const extents2 = box.shape.halfExtentsM;
  const relative = localPoint(box, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents2[index], Math.min(extents2[index], value)));
  const towardBox = sub(nearest, relative);
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return {
    normal: rotate(box.orientation, scale(towardBox, 1 / distance)),
    penetration: Math.max(0, radius - distance),
    pointM: worldPoint(box, nearest)
  };
  let axis = 0, side = -1, faceDistance = Infinity;
  for (let index = 0; index < 3; index++) for (const candidate of [-1, 1]) {
    const gap = extents2[index] - candidate * relative[index];
    if (gap < faceDistance) {
      faceDistance = gap;
      axis = index;
      side = candidate;
    }
  }
  const localNormal = [0, 0, 0];
  localNormal[axis] = -side;
  nearest[axis] = side * extents2[axis];
  return {
    normal: rotate(box.orientation, localNormal),
    penetration: radius + faceDistance,
    pointM: worldPoint(box, nearest)
  };
}
function capsuleSphere(capsule, sphere) {
  const center = capsuleCenter(capsule, sphere.positionM);
  const delta = sub(sphere.positionM, center);
  const distance = Math.hypot(...delta);
  const capsuleRadius = capsule.shape.radiusM;
  const sphereRadius = sphere.shape.radiusM;
  if (distance > capsuleRadius + sphereRadius) return null;
  const normal = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  return {
    normal,
    penetration: Math.max(0, capsuleRadius + sphereRadius - distance),
    pointM: scale(add(
      add(center, scale(normal, capsuleRadius)),
      sub(sphere.positionM, scale(normal, sphereRadius))
    ), 0.5)
  };
}
function boxBox(a, b) {
  const axesA = boxAxes(a), axesB = boxAxes(b);
  const extentA = a.shape.halfExtentsM, extentB = b.shape.halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis = [1, 0, 0], bestOverlap = Infinity;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross(axisA, axisB)))];
  for (const candidate of candidates) {
    const length = Math.hypot(...candidate);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis2, index) => sum + extentA[index] * Math.abs(dot(basis2, axis)), 0);
    const radiusB = axesB.reduce((sum, basis2, index) => sum + extentB[index] * Math.abs(dot(basis2, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    if (overlap < -1e-12) return null;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale(axis, signedDistance < 0 ? -1 : 1);
    }
  }
  const aPoint = boxSupport(a, bestAxis);
  const bPoint = boxSupport(b, scale(bestAxis, -1));
  return { normal: bestAxis, penetration: Math.max(0, bestOverlap), pointM: scale(add(aPoint, bPoint), 0.5) };
}
function detect(a, b) {
  if (a.shape.kind === "sphere" && b.shape.kind === "sphere") return sphereSphere(a, b);
  if (a.shape.kind === "sphere" && b.shape.kind === "box") return sphereBox(a, b);
  if (a.shape.kind === "box" && b.shape.kind === "sphere") {
    const hit = sphereBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === "capsule" && b.shape.kind === "sphere") return capsuleSphere(a, b);
  if (a.shape.kind === "sphere" && b.shape.kind === "capsule") {
    const hit = capsuleSphere(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === "box" && b.shape.kind === "box") return boxBox(a, b);
  if (a.shape.kind === "capsule" && b.shape.kind === "box") return capsuleBox(a, b);
  if (a.shape.kind === "box" && b.shape.kind === "capsule") {
    const hit = capsuleBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === "capsule" && b.shape.kind === "capsule") return capsuleCapsule(a, b);
  return null;
}

// examples/physics-rigid-feature-geometry/sat-feature.ts
var FEATURE_INPUT_MESSAGE = "private feature geometry requires two admitted boxes";
var DIAGNOSTIC_TIE_TOLERANCE_M = 1e-12;
function boxAxes2(body2) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body2.orientation, axis));
}
function boxSupport2(body2, direction) {
  const axes = boxAxes2(body2);
  const extents2 = body2.shape.halfExtentsM;
  return add(body2.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
    return add(result, scale(axis, offset));
  }, [0, 0, 0]));
}
function featureAt(candidateIndex) {
  if (candidateIndex < 3) return { kind: "face-a", axisA: candidateIndex };
  if (candidateIndex < 6) return { kind: "face-b", axisB: candidateIndex - 3 };
  const crossIndex = candidateIndex - 6;
  return { kind: "edge-cross", axisA: Math.floor(crossIndex / 3), axisB: crossIndex % 3 };
}
function featureLabel(feature) {
  if (feature.kind === "face-a") return `A.face.${feature.axisA}`;
  if (feature.kind === "face-b") return `B.face.${feature.axisB}`;
  return `A.edge.${feature.axisA}xB.edge.${feature.axisB}`;
}
function selectBoxSATFeature(a, b) {
  if (a.shape.kind !== "box" || b.shape.kind !== "box") {
    error("INVALID_CONFIG", FEATURE_INPUT_MESSAGE);
  }
  const axesA = boxAxes2(a), axesB = boxAxes2(b);
  const extentA = a.shape.halfExtentsM, extentB = b.shape.halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis = [1, 0, 0], bestOverlap = Infinity;
  let bestCandidateIndex = 0, bestRawLength = 0;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross(axisA, axisB)))];
  const diagnostics = [];
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const length = Math.hypot(...candidate);
    const feature2 = featureAt(candidateIndex);
    const diagnostic = {
      candidateIndex,
      label: featureLabel(feature2),
      feature: feature2,
      rawAxisLength: length,
      skippedByOriginalCutoff: length < 1e-12,
      signedDistanceM: null,
      overlapM: null
    };
    diagnostics.push(diagnostic);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis2, index) => sum + extentA[index] * Math.abs(dot(basis2, axis)), 0);
    const radiusB = axesB.reduce((sum, basis2, index) => sum + extentB[index] * Math.abs(dot(basis2, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    diagnostic.signedDistanceM = signedDistance;
    diagnostic.overlapM = overlap;
    if (overlap < -1e-12) return null;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale(axis, signedDistance < 0 ? -1 : 1);
      bestCandidateIndex = candidateIndex;
      bestRawLength = length;
    }
  }
  const aPoint = boxSupport2(a, bestAxis);
  const bPoint = boxSupport2(b, scale(bestAxis, -1));
  const originalHit = {
    normal: bestAxis,
    penetration: Math.max(0, bestOverlap),
    pointM: scale(add(aPoint, bPoint), 0.5)
  };
  const feature = featureAt(bestCandidateIndex);
  return {
    hit: {
      normal: [...originalHit.normal],
      penetration: originalHit.penetration,
      pointM: [...originalHit.pointM]
    },
    feature,
    label: featureLabel(feature),
    candidateIndex: bestCandidateIndex,
    rawAxisLength: bestRawLength,
    candidates: diagnostics,
    ambiguity: {
      exactMinimumCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null && candidate.overlapM === bestOverlap).map((candidate) => candidate.candidateIndex),
      withinDiagnosticTieToleranceCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null && Math.abs(candidate.overlapM - bestOverlap) <= DIAGNOSTIC_TIE_TOLERANCE_M).map((candidate) => candidate.candidateIndex),
      skippedCandidateIndices: diagnostics.filter((candidate) => candidate.skippedByOriginalCutoff).map((candidate) => candidate.candidateIndex),
      diagnosticTieToleranceM: DIAGNOSTIC_TIE_TOLERANCE_M,
      uniquePhysicalFeatureClaimed: false
    }
  };
}

// examples/physics-rigid-feature-geometry/witness.ts
var WITNESS_MESSAGE = "private feature contact requires valid box witnesses";
var WITNESS_TOLERANCE_M = 1e-12;
var DUPLICATE_TOLERANCE_M = 1e-12;
var basis = (b) => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => rotate(b.orientation, v));
var extents = (b) => b.shape.halfExtentsM;
function unit(v) {
  const n = Math.hypot(...v);
  if (!Number.isFinite(n) || n < 1e-12) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  return scale(v, 1 / n);
}
function point(key, a, b, n) {
  const gap = dot(sub(b, a), n);
  const result = {
    key,
    witnessAM: [...a],
    witnessBM: [...b],
    midpointM: scale(add(a, b), 0.5),
    normalGapM: gap,
    pointPenetrationM: Math.max(0, -gap)
  };
  if (![...a, ...b, ...result.midpointM, gap, result.pointPenetrationM].every(Number.isFinite) || gap > WITNESS_TOLERANCE_M) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  return result;
}

// examples/physics-rigid-feature-geometry/strict-line.ts
var STRICT_LINE_LIMITS = Object.freeze({
  rationalOperations: 2e5,
  integerOperations: 2e6,
  integerBits: 16384,
  roundingSteps: 16
});
var StrictLineFailure = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StrictLineFailure";
  }
};
var ZERO = { n: 0n, d: 1n };
var ieee = new DataView(new ArrayBuffer(8));
function nextAfterToward(value, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) throw new StrictLineFailure("nonfinite nextafter");
  if (value === target) return value;
  if (value === 0) return target > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE;
  ieee.setFloat64(0, value, false);
  let bits = ieee.getBigUint64(0, false);
  bits += target > value === value > 0 ? 1n : -1n;
  ieee.setBigUint64(0, bits, false);
  const result = ieee.getFloat64(0, false);
  if (!Number.isFinite(result)) throw new StrictLineFailure("nextafter overflow");
  return result;
}
var Arithmetic = class {
  counters = { rationalOperations: 0, integerOperations: 0, peakIntegerBits: 0 };
  tick(amount = 1) {
    this.counters.integerOperations += amount;
    if (this.counters.integerOperations > STRICT_LINE_LIMITS.integerOperations) throw new StrictLineFailure("integer work limit");
  }
  op() {
    if (++this.counters.rationalOperations > STRICT_LINE_LIMITS.rationalOperations) throw new StrictLineFailure("rational work limit");
  }
  checked(value) {
    const bits = (value < 0n ? -value : value).toString(2).length;
    this.counters.peakIntegerBits = Math.max(this.counters.peakIntegerBits, bits);
    if (bits > STRICT_LINE_LIMITS.integerBits) throw new StrictLineFailure("integer bit limit");
    return value;
  }
  multiply(a, b) {
    this.tick();
    return this.checked(a * b);
  }
  sum(a, b) {
    this.tick();
    return this.checked(a + b);
  }
  shifted(value, bits) {
    this.tick();
    return this.checked(value << BigInt(bits));
  }
  make(n, d = 1n) {
    this.checked(n);
    this.checked(d);
    if (d === 0n) throw new StrictLineFailure("zero rational denominator");
    if (n === 0n) return ZERO;
    if (d < 0n) {
      this.tick(2);
      n = -n;
      d = -d;
    }
    let a = n < 0n ? -n : n, b = d;
    while (b !== 0n) {
      this.tick();
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    this.tick(2);
    return { n: n / a, d: d / a };
  }
  from(value) {
    this.op();
    if (!Number.isFinite(value)) throw new StrictLineFailure("nonfinite exact operand");
    ieee.setFloat64(0, value, false);
    const bits = ieee.getBigUint64(0, false), negative = bits >> 63n !== 0n;
    const exponent = Number(bits >> 52n & 2047n), fraction = bits & (1n << 52n) - 1n;
    const significand = exponent === 0 ? fraction : fraction + (1n << 52n);
    const power = exponent === 0 ? -1074 : exponent - 1023 - 52;
    const n = negative ? -significand : significand;
    return power >= 0 ? this.make(this.shifted(n, power)) : this.make(n, this.shifted(1n, -power));
  }
  add(a, b) {
    this.op();
    return this.make(this.sum(this.multiply(a.n, b.d), this.multiply(b.n, a.d)), this.multiply(a.d, b.d));
  }
  neg(a) {
    this.op();
    this.tick();
    return { n: -a.n, d: a.d };
  }
  sub(a, b) {
    return this.add(a, this.neg(b));
  }
  mul(a, b) {
    this.op();
    return this.make(this.multiply(a.n, b.n), this.multiply(a.d, b.d));
  }
  div(a, b) {
    this.op();
    return this.make(this.multiply(a.n, b.d), this.multiply(a.d, b.n));
  }
  compare(a, b) {
    this.op();
    const difference = this.sum(this.multiply(a.n, b.d), -this.multiply(b.n, a.d));
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }
  abs(a) {
    return a.n < 0n ? this.neg(a) : a;
  }
  vec(value, length = 3) {
    if (value.length !== length || !Array.from({ length }, (_, i) => i).every((i) => Object.hasOwn(value, i))) throw new StrictLineFailure("dense exact vector required");
    return value.map((x) => this.from(x));
  }
  dot(a, b) {
    return a.reduce((value, x, i) => this.add(value, this.mul(x, b[i])), ZERO);
  }
  /** Correct nearest-even conversion, including subnormals; no Number(BigInt)/Number(BigInt). */
  number(value) {
    this.op();
    if (value.n === 0n) return 0;
    const negative = value.n < 0n, n = negative ? -value.n : value.n, d = value.d;
    let exponent = n.toString(2).length - d.toString(2).length;
    if (exponent >= 0 ? n < this.shifted(d, exponent) : this.shifted(n, -exponent) < d) exponent--;
    const unit2 = Math.max(-1074, exponent - 52);
    const numerator = unit2 < 0 ? this.shifted(n, -unit2) : n;
    const denominator = unit2 > 0 ? this.shifted(d, unit2) : d;
    this.tick(2);
    let quotient = numerator / denominator;
    const remainder = numerator % denominator;
    const twice = this.shifted(remainder, 1);
    if (twice > denominator || twice === denominator && (quotient & 1n) !== 0n) {
      this.tick();
      quotient++;
    }
    const result = Number(quotient) * Math.pow(2, unit2);
    if (!Number.isFinite(result)) throw new StrictLineFailure("rounded witness overflow");
    return negative ? -result : result;
  }
};
var StrictLineContext = class {
  m = new Arithmetic();
  boxes;
  normal;
  tolerance;
  constructor(a, b, normal) {
    this.normal = this.m.vec(normal);
    if (this.normal.every((x) => x.n === 0n)) throw new StrictLineFailure("zero line direction");
    this.tolerance = this.m.from(1e-12);
    this.boxes = [this.box(a), this.box(b)];
  }
  stats() {
    return { ...this.m.counters };
  }
  box(body2) {
    if (body2.shape.kind !== "box") throw new StrictLineFailure("box required");
    const m = this.m, [x, y, z, w] = m.vec(body2.orientation, 4), norm2 = m.dot([x, y, z, w], [x, y, z, w]);
    if (norm2.n === 0n) throw new StrictLineFailure("zero quaternion");
    const two = m.from(2), square = (q) => m.mul(q, q);
    const twice = (a, b) => m.mul(two, m.mul(a, b));
    const diagonal = (a, b) => m.div(m.sub(norm2, m.mul(two, m.add(square(a), square(b)))), norm2);
    const entry = (a, b, c, d, sign) => m.div(sign === 1 ? m.add(twice(a, b), twice(c, d)) : m.sub(twice(a, b), twice(c, d)), norm2);
    const rotation = [
      [diagonal(y, z), entry(x, y, z, w, -1), entry(x, z, y, w, 1)],
      [entry(x, y, z, w, 1), diagonal(x, z), entry(y, z, x, w, -1)],
      [entry(x, z, y, w, -1), entry(y, z, x, w, 1), diagonal(x, y)]
    ];
    const extent = m.vec(body2.shape.halfExtentsM);
    if (extent.some((value) => value.n <= 0n)) throw new StrictLineFailure("positive extents required");
    return { centre: m.vec(body2.positionM), extent, rotation };
  }
  local(box, world, direction = false) {
    const relative = direction ? world : world.map((value, i) => this.m.sub(value, box.centre[i]));
    return [0, 1, 2].map((axis) => this.m.dot(box.rotation.map((row) => row[axis]), relative));
  }
  interval(box, p) {
    const m = this.m, u = this.local(box, p), d = this.local(box, this.normal, true);
    let low = null, high = null;
    for (let i = 0; i < 3; i++) {
      if (d[i].n === 0n) {
        if (m.compare(m.abs(u[i]), box.extent[i]) > 0) return false;
        continue;
      }
      const first = m.div(m.sub(m.neg(box.extent[i]), u[i]), d[i]), second = m.div(m.sub(box.extent[i], u[i]), d[i]);
      const lower = m.compare(first, second) <= 0 ? first : second, upper = lower === first ? second : first;
      if (low === null || m.compare(lower, low) > 0) low = lower;
      if (high === null || m.compare(upper, high) < 0) high = upper;
      if (low !== null && high !== null && m.compare(low, high) > 0) return false;
    }
    return true;
  }
  /** Strict closed slabs. No epsilon, tolerance addition or direction threshold. */
  check(midpoint) {
    const p = this.m.vec(midpoint);
    return this.interval(this.boxes[0], p) && this.interval(this.boxes[1], p);
  }
  onFace(which, plane, witness) {
    const m = this.m, box = this.boxes[which], local = this.local(box, m.vec(witness));
    if (!Number.isInteger(plane.axis) || plane.axis < 0 || plane.axis > 2 || Math.abs(plane.side) !== 1) throw new StrictLineFailure("face selector");
    if (local.some((value, i) => m.compare(m.sub(m.abs(value), box.extent[i]), this.tolerance) > 0)) return false;
    return m.compare(m.abs(m.sub(local[plane.axis], m.mul(m.from(plane.side), box.extent[plane.axis]))), this.tolerance) <= 0;
  }
  movementWithin(original, moved) {
    const m = this.m, a = m.vec(original), b = m.vec(moved), delta = a.map((value, i) => m.sub(b[i], value));
    return m.compare(m.dot(delta, delta), m.mul(this.tolerance, this.tolerance)) <= 0;
  }
  projectedPair(seed, faceA, faceB) {
    const m = this.m, p = m.vec(seed);
    return [faceA, faceB].map((face, which) => {
      if (!Number.isInteger(face.axis) || face.axis < 0 || face.axis > 2 || Math.abs(face.side) !== 1) throw new StrictLineFailure("face selector");
      const box = this.boxes[which], u = this.local(box, p), d = this.local(box, this.normal, true), axis = face.axis;
      if (d[axis].n === 0n) throw new StrictLineFailure("line parallel to selected face");
      const t = m.div(m.sub(m.mul(m.from(face.side), box.extent[axis]), u[axis]), d[axis]);
      return p.map((value, i) => m.number(m.add(value, m.mul(this.normal[i], t))));
    });
  }
};

// examples/physics-rigid-feature-geometry/face-contact.ts
function clipFace(polygon, centre, axis, limit) {
  const out2 = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = dot(sub(p, centre), axis) - limit, dq = dot(sub(q, centre), axis) - limit;
    if (dp <= 0) out2.push([...p]);
    if (dp <= 0 !== dq <= 0) out2.push(add(p, scale(sub(q, p), dp / (dp - dq))));
  }
  return out2;
}
function faceContact(a, b, selection) {
  const f = selection.feature;
  if (f.kind === "edge-cross") error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const isA = f.kind === "face-a", ref = isA ? a : b, inc = isA ? b : a;
  const axis = f.kind === "face-a" ? f.axisA : f.axisB, ra = basis(ref), ia = basis(inc), re = extents(ref), ie = extents(inc);
  const outward = isA ? selection.hit.normal : scale(selection.hit.normal, -1);
  const side = dot(ra[axis], outward) < 0 ? -1 : 1, n = unit(scale(ra[axis], side));
  const centre = add(ref.positionM, scale(ra[axis], side * re[axis]));
  let incidentAxis = 0, greatest = -Infinity;
  for (let i = 0; i < 3; i++) {
    const v = Math.abs(dot(ia[i], n));
    if (v > greatest) {
      greatest = v;
      incidentAxis = i;
    }
  }
  const incidentSide = dot(ia[incidentAxis], n) > 0 ? -1 : 1;
  const incidentCentre = add(inc.positionM, scale(ia[incidentAxis], incidentSide * ie[incidentAxis]));
  const it = [0, 1, 2].filter((i) => i !== incidentAxis), rt = [0, 1, 2].filter((i) => i !== axis);
  let poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => add(add(incidentCentre, scale(ia[it[0]], u * ie[it[0]])), scale(ia[it[1]], v * ie[it[1]])));
  for (const i of rt) {
    poly = clipFace(poly, centre, ra[i], re[i]);
    poly = clipFace(poly, centre, scale(ra[i], -1), re[i]);
  }
  const planeNormalAtoB = isA ? n : scale(n, -1);
  const candidates = poly.map((p) => {
    const separation = dot(sub(p, centre), n), r = sub(p, scale(n, separation));
    return { p, r, separation, u: dot(sub(r, centre), ra[rt[0]]), v: dot(sub(r, centre), ra[rt[1]]) };
  }).filter((p) => p.separation <= WITNESS_TOLERANCE_M);
  if (!candidates.length) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const selected = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, p) => u * p.u + v * p.v > u * best.u + v * best.v ? p : best, candidates[0]));
  const unique = selected.filter((p, i) => selected.findIndex((q) => Math.hypot(...sub(p.r, q.r)) <= DUPLICATE_TOLERANCE_M) === i);
  unique.sort((p, q) => p.u - q.u || p.v - q.v);
  const prefix = `face:${ref.id}:${axis}:${side}:${inc.id}:${incidentAxis}:${incidentSide}`;
  const referencePlane = { axis, side }, incidentPlane = { axis: incidentAxis, side: incidentSide };
  const faceA = isA ? referencePlane : incidentPlane, faceB = isA ? incidentPlane : referencePlane;
  const interior = scale(candidates.reduce((sum, p) => add(sum, scale(add(p.r, p.p), 0.5)), [0, 0, 0]), 1 / candidates.length);
  let movedPoints = 0, maximumSteps = 0;
  let exact;
  let points;
  try {
    exact = new StrictLineContext(a, b, planeNormalAtoB);
    points = unique.map((p, i) => {
      const original = point(`${prefix}:${i}`, isA ? p.r : p.p, isA ? p.p : p.r, planeNormalAtoB);
      const certified = (candidate) => exact.check(candidate.midpointM) && exact.onFace(0, faceA, candidate.witnessAM) && exact.onFace(1, faceB, candidate.witnessBM);
      if (certified(original)) return original;
      let seed = [...original.midpointM];
      for (let step = 1; step <= STRICT_LINE_LIMITS.roundingSteps; step++) {
        seed = seed.map((value, k) => nextAfterToward(value, interior[k]));
        const [witnessA, witnessB] = exact.projectedPair(seed, faceA, faceB);
        const candidate = point(original.key, witnessA, witnessB, planeNormalAtoB);
        if (!exact.movementWithin(original.witnessAM, candidate.witnessAM) || !exact.movementWithin(original.witnessBM, candidate.witnessBM) || !exact.movementWithin(original.midpointM, candidate.midpointM)) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
        if (certified(candidate)) {
          movedPoints++;
          maximumSteps = Math.max(maximumSteps, step);
          return candidate;
        }
      }
      error("NUMERIC_LIMIT", WITNESS_MESSAGE);
    });
  } catch (caught) {
    if (caught instanceof StrictLineFailure) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
    throw caught;
  }
  const exactWork = exact.stats();
  return {
    selection: structuredClone(selection),
    family: "face",
    planeNormalAtoB,
    reference: { body: isA ? "a" : "b", axis, side, incidentAxis, incidentSide },
    points,
    conditioning: {
      clippedVertices: poly.length,
      candidates: candidates.length,
      retainedPoints: points.length,
      rawAxisLength: selection.rawAxisLength,
      uniquePhysicalFeatureClaimed: false,
      strictLineCertified: true,
      boundaryRoundingMovedPoints: movedPoints,
      boundaryRoundingMaximumSteps: maximumSteps,
      exactRationalOperations: exactWork.rationalOperations,
      exactIntegerOperations: exactWork.integerOperations,
      exactPeakIntegerBits: exactWork.peakIntegerBits
    }
  };
}

// examples/physics-rigid-feature-geometry/edge-contact.ts
var clamp2 = (v) => Math.max(0, Math.min(1, v));
function closestSegments(p, p1, q, q1) {
  const u = sub(p1, p), v = sub(q1, q), r = sub(q, p), uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), c = cross(u, v), den = dot(c, c);
  if (![...p, ...p1, ...q, ...q1, uu, vv, den].every(Number.isFinite) || uu <= 0 || vv <= 0) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const pairs = [
    { s: 0, t: clamp2(-dot(r, v) / vv) },
    { s: 1, t: clamp2((uv - dot(r, v)) / vv) },
    { s: clamp2(dot(r, u) / uu), t: 0 },
    { s: clamp2((dot(r, u) + uv) / uu), t: 1 }
  ];
  if (den > 0) {
    const s = dot(cross(r, v), c) / den, t = dot(cross(r, u), c) / den;
    if (Number.isFinite(s) && Number.isFinite(t) && s >= 0 && s <= 1 && t >= 0 && t <= 1) pairs.push({ s, t });
  }
  let best = pairs[0], bestDistance = Infinity;
  for (const pair of pairs) {
    const d = sub(add(p, scale(u, pair.s)), add(q, scale(v, pair.t))), ds = dot(d, d);
    if (ds < bestDistance) {
      best = pair;
      bestDistance = ds;
    }
  }
  return {
    a: add(p, scale(u, best.s)),
    b: add(q, scale(v, best.t)),
    parameterA: best.s,
    parameterB: best.t,
    crossSquared: den,
    distanceSquared: bestDistance,
    parallel: den === 0,
    boundary: best.s === 0 || best.s === 1 || best.t === 0 || best.t === 1
  };
}
function supportEdge(body2, axis, direction) {
  const axes = basis(body2), e = extents(body2), sides = [0, 0, 0];
  let centre = [...body2.positionM];
  for (let i = 0; i < 3; i++) if (i !== axis) {
    sides[i] = dot(axes[i], direction) < 0 ? -1 : 1;
    centre = add(centre, scale(axes[i], sides[i] * e[i]));
  }
  return { lo: sub(centre, scale(axes[axis], e[axis])), hi: add(centre, scale(axes[axis], e[axis])), sides };
}
function edgeContact(a, b, selection) {
  const f = selection.feature;
  if (f.kind !== "edge-cross") error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const n = [...selection.hit.normal], ea = supportEdge(a, f.axisA, n), eb = supportEdge(b, f.axisB, scale(n, -1));
  const nearest = closestSegments(ea.lo, ea.hi, eb.lo, eb.hi);
  const difference = sub(nearest.b, nearest.a), gap = dot(difference, n), tangent = sub(difference, scale(n, gap));
  if (Math.hypot(...tangent) > WITNESS_TOLERANCE_M) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const key = `edge:${a.id}:${f.axisA}:${ea.sides.join(",")}:${b.id}:${f.axisB}:${eb.sides.join(",")}`;
  return {
    selection: structuredClone(selection),
    family: "edge",
    planeNormalAtoB: n,
    edges: { axisA: f.axisA, axisB: f.axisB, sidesA: ea.sides, sidesB: eb.sides, parameterA: nearest.parameterA, parameterB: nearest.parameterB },
    points: [point(key, nearest.a, nearest.b, n)],
    conditioning: {
      crossSquared: nearest.crossSquared,
      rawAxisLength: selection.rawAxisLength,
      parallel: nearest.parallel,
      boundary: nearest.boundary,
      tangentDistanceM: Math.hypot(...tangent),
      uniquePhysicalFeatureClaimed: false
    }
  };
}

// examples/physics-rigid-feature-geometry/geometry.ts
function witnessInside(body2, w) {
  const local = basis(body2).map((axis) => dot(sub(w, body2.positionM), axis)), e = extents(body2);
  return local.every((v, i) => Number.isFinite(v) && Math.abs(v) <= e[i] + WITNESS_TOLERANCE_M);
}
function denseVector(v, size, min, max) {
  return Array.isArray(v) && v.length === size && Array.from({ length: size }, (_, i) => i).every((i) => Object.hasOwn(v, i) && Number.isFinite(v[i]) && v[i] >= min && v[i] <= max);
}
function admitted(b) {
  return b !== null && typeof b === "object" && typeof b.id === "string" && ID.test(b.id) && ["dynamic", "static", "kinematic"].includes(b.kind) && b.shape?.kind === "box" && denseVector(b.shape.halfExtentsM, 3, 1e-4, 1e3) && denseVector(b.positionM, 3, -1e4, 1e4) && denseVector(b.orientation, 4, -1, 1) && Math.abs(Math.hypot(...b.orientation) - 1) <= 1e-9;
}
function featureContact(a, b) {
  if (!admitted(a) || !admitted(b) || a.id === b.id) error("INVALID_CONFIG", FEATURE_INPUT_MESSAGE);
  const selection = selectBoxSATFeature(a, b);
  if (!selection) return null;
  if (selection.hit.penetration > MAX_STEP_DISPLACEMENT_M) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const geometry = selection.feature.kind === "edge-cross" ? edgeContact(a, b, selection) : faceContact(a, b, selection);
  if (!geometry.points.length || geometry.points.some((p) => !witnessInside(a, p.witnessAM) || !witnessInside(b, p.witnessBM))) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  return geometry;
}

// examples/physics-rigid-feature-geometry/controls.mjs
import assert2 from "node:assert/strict";

// examples/physics-rigid-feature-geometry/archive.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
var digest = (b) => createHash("sha256").update(b).digest("hex");
var verify = (b, h, n) => assert.equal(digest(b), h, `${n}: hash mismatch`);
function restoreWorking(report, raw) {
  const bodies = structuredClone(report.workingBodies);
  assert.equal(raw.length, bodies.length * 13 * 8);
  verify(raw, report.workingRawSha256, "working fields");
  let offset = 0;
  for (const b of bodies) for (const [field, size] of [["positionM", 3], ["velocityMps", 3], ["orientation", 4], ["angularVelocityRadps", 3]]) {
    assert.equal(b[field].length, size);
    for (let i = 0; i < size; i++) {
      const v = raw.readDoubleLE(offset);
      offset += 8;
      assert.ok(Number.isFinite(v) && v === b[field][i]);
      b[field][i] = v;
    }
  }
  return bodies;
}

// examples/physics-rigid-feature-geometry/controls.mjs
var quat = (axis, angle) => axis.map((v) => v * Math.sin(angle / 2)).concat(Math.cos(angle / 2));
var body = (m, id, positionM = [0, 0, 0], orientation = [0, 0, 0, 1], halfExtentsM = [1, 1, 1]) => m.parseBody({ id, kind: "dynamic", shape: { kind: "box", halfExtentsM }, positionM, orientation, velocityMps: [0, 0, 0], massKg: 1, restitution: 0 });
var close = (a, b) => assert2.ok(Math.abs(a - b) <= 1e-12, `${a} != ${b}`);
async function controls(m, reference2) {
  const rows = [];
  let count = 0;
  for (const [name, pos, q, extent] of [
    ["aligned", [0, 1.8, 0], [0, 0, 0, 1], [1, 1, 1]],
    ["touch", [0, 2, 0], [0, 0, 0, 1], [1, 1, 1]],
    ["rotated-face", [0, 1.7, 0], quat([0, 1, 0], 0.2), [1, 1, 1]],
    ["containment", [0, 0, 0], [0, 0, 0, 1], [0.25, 0.25, 0.25]]
  ]) {
    const a2 = body(m, "a"), b2 = body(m, "b", pos, q, extent), saved2 = structuredClone([a2, b2]);
    const g = m.featureContact(a2, b2);
    assert2.ok(g && g.points.length > 0 && g.points.length <= 4);
    assert2.equal(new Set(g.points.map((p2) => p2.key)).size, g.points.length);
    if (name === "aligned") {
      assert2.equal(g.points.length, 4);
      for (const point2 of g.points) close(point2.normalGapM, -0.2);
    }
    assert2.deepEqual(g.selection.hit, m.detect(a2, b2));
    assert2.deepEqual(m.featureContact(a2, b2), g);
    assert2.deepEqual([a2, b2], saved2);
    const ref = await reference2.ask({ a: a2, b: b2, geometry: g });
    assert2.equal(ref.ok, true, JSON.stringify(ref));
    rows.push({ name, geometry: g, reference: ref });
    count++;
    const swapped = m.featureContact(b2, a2);
    assert2.ok(swapped);
    const swapRef = await reference2.ask({ a: b2, b: a2, geometry: swapped });
    assert2.equal(swapRef.ok, true, JSON.stringify(swapRef));
    rows.push({ name: name + "-swapped", geometry: swapped, reference: swapRef });
    count++;
  }
  const a = body(m, "a"), b = body(m, "b", [0, 3, 0]);
  assert2.equal(m.featureContact(a, b), null);
  assert2.equal(m.selectBoxSATFeature(a, b), null);
  count++;
  const rotated = body(m, "a", [0, 0, 0], quat([0, 0, 1], 0.2)), above = body(m, "b", [0, 1.8, 0]);
  const selection = m.selectBoxSATFeature(rotated, above);
  assert2.ok(selection);
  assert2.equal(selection.feature.kind, "face-b");
  const bg = m.featureContact(rotated, above);
  assert2.equal(bg.reference.body, "b");
  const br = await reference2.ask({ a: rotated, b: above, geometry: bg });
  assert2.equal(br.ok, true, JSON.stringify(br));
  rows.push({ name: "reference-b", geometry: bg, reference: br });
  count++;
  const p = [-1, 0, 0], p1 = [1, 0, 0];
  for (const [name, q, q1, s, t, d] of [
    ["skew-interior", [0, -1, 1], [0, 1, 1], 0.5, 0.5, 1],
    ["endpoint-clamped", [3, -1, 1], [3, 1, 1], 1, 0.5, 5],
    ["parallel", [-1, 1, 0], [1, 1, 0], 0, 0, 1],
    ["near-parallel", [-1, 1, 0], [1, 1 + 1e-10, 0], 0, 0, 1]
  ]) {
    const n = m.closestSegments(p, p1, q, q1);
    close(n.parameterA, s);
    close(n.parameterB, t);
    close(n.distanceSquared, d);
    const ref = await reference2.ask({ segments: { p, p1, q, q1, result: n } });
    assert2.equal(ref.ok, true, JSON.stringify(ref));
    rows.push({ name, nearest: n, reference: ref });
    count++;
  }
  assert2.throws(() => m.closestSegments(p, p, p, p1), (e) => e.code === "NUMERIC_LIMIT" && e.message === "private feature contact requires valid box witnesses");
  count++;
  const fake = m.selectBoxSATFeature(a, body(m, "b", [0, 2, 0]));
  assert2.throws(() => m.faceContact(a, b, fake), (e) => e.code === "NUMERIC_LIMIT" && e.message === "private feature contact requires valid box witnesses");
  count++;
  const repeated = [[0, 0, 0], [0, 0, 0], [0, 1, 0]];
  assert2.deepEqual(m.clipFace(repeated, [0, 0, 0], [1, 0, 0], 1), repeated);
  count++;
  const square = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], clipped = m.clipFace(square, [0, 0, 0], [1, 0, 0], 0);
  assert2.equal(clipped.length, 4);
  assert2.ok(clipped.every((p2) => p2[0] <= 0));
  assert2.equal(clipped.filter((p2) => p2[0] === 0).length, 2);
  count++;
  const touchingEdge = body(m, "b", [2, 2, 0]), dedup = m.featureContact(a, touchingEdge);
  assert2.equal(dedup.points.length, 2);
  assert2.ok(dedup.conditioning.clippedVertices > dedup.points.length);
  for (const point2 of dedup.points) {
    close(point2.witnessAM[0], 1);
    close(point2.witnessAM[1], 1);
    close(Math.abs(point2.witnessAM[2]), 1);
    close(point2.normalGapM, 0);
  }
  const duplicateRef = await reference2.ask({ a, b: touchingEdge, geometry: dedup });
  assert2.equal(duplicateRef.ok, true, JSON.stringify(duplicateRef));
  rows.push({ name: "duplicate-contact-elimination", geometry: dedup, reference: duplicateRef });
  count++;
  const signB = body(m, "b", [0, 1.8, 0], [0, 0, 0, -1]);
  assert2.deepEqual(m.featureContact(a, signB), m.featureContact(a, body(m, "b", [0, 1.8, 0])));
  count++;
  const same = body(m, "b", [0, 1.8, 0]);
  const original = m.featureContact(a, same);
  const copy = structuredClone(original);
  original.points[0].witnessAM[0] = 999;
  original.selection.hit.normal[0] = 999;
  assert2.deepEqual(m.featureContact(a, same), copy);
  count++;
  for (const edit of [(x) => {
    x.id = "a";
  }, (x) => {
    x.positionM[0] = NaN;
  }, (x) => {
    x.orientation = [0, 0, 0, 0];
  }, (x) => {
    x.shape.halfExtentsM[0] = 0;
  }, (x) => {
    x.shape = { kind: "sphere", radiusM: 1 };
  }, (x) => {
    delete x.positionM[1];
  }, (x) => {
    delete x.shape.halfExtentsM[1];
  }, (x) => {
    delete x.orientation[1];
  }]) {
    const invalid = structuredClone(same);
    edit(invalid);
    const saved2 = structuredClone([a, invalid]);
    assert2.throws(() => m.featureContact(a, invalid), (e) => e.code === "INVALID_CONFIG" && e.message === "private feature geometry requires two admitted boxes");
    assert2.deepEqual([a, invalid], saved2);
    count++;
  }
  const huge = body(m, "b", [0, 0, 0], [0, 0, 0, 1], [20, 20, 20]), hugeA = body(m, "a", [0, 0, 0], [0, 0, 0, 1], [20, 20, 20]);
  const saved = structuredClone([hugeA, huge]);
  assert2.throws(() => m.featureContact(hugeA, huge), (e) => e.code === "NUMERIC_LIMIT" && e.message === "private feature contact requires valid box witnesses");
  assert2.deepEqual([hugeA, huge], saved);
  count++;
  for (const [name, edit, violation] of [["witness", (g) => {
    g.points[0].witnessAM[1] += 0.1;
  }, "referenceFaceMembershipM"], ["midpoint", (g) => {
    g.points[0].midpointM[0] += 0.1;
  }, "midpointIdentityM"], ["gap", (g) => {
    g.points[0].normalGapM += 0.1;
  }, "normalGapIdentityM"]]) {
    const g = m.featureContact(a, same);
    edit(g);
    const ref = await reference2.ask({ a, b: same, geometry: g });
    assert2.equal(ref.ok, false, "reference must reject changed " + name);
    assert2.ok(ref.violations.some((v) => v.includes(violation)), JSON.stringify(ref));
    count++;
  }
  const badSegment = m.closestSegments(p, p1, [0, -1, 1], [0, 1, 1]);
  badSegment.a = [-1, 0, 0];
  badSegment.parameterA = 0;
  const badRef = await reference2.ask({ segments: { p, p1, q: [0, -1, 1], q1: [0, 1, 1], result: badSegment } });
  assert2.equal(badRef.ok, false);
  assert2.ok(badRef.violations.some((v) => v.includes("StationaryOrEndpointResidualM")));
  count++;
  const raw = Buffer.alloc(13 * 8), fields2 = [...a.positionM, ...a.velocityMps, ...a.orientation, ...a.angularVelocityRadps];
  fields2[0] = -0;
  fields2.forEach((v, i) => raw.writeDoubleLE(v, i * 8));
  const archived = { workingBodies: [structuredClone(a)], workingRawSha256: digest(raw) };
  const restored = restoreWorking(archived, raw);
  assert2.ok(Object.is(restored[0].positionM[0], -0));
  assert2.ok(!Object.is(archived.workingBodies[0].positionM[0], -0));
  count++;
  assert2.throws(() => verify(Buffer.from("corrupt"), digest(raw), "control"));
  assert2.throws(() => restoreWorking(archived, raw.subarray(0, 8)));
  count++;
  const nonfinite = Buffer.from(raw);
  nonfinite.writeDoubleLE(NaN, 0);
  assert2.throws(() => restoreWorking({ ...archived, workingRawSha256: digest(nonfinite) }, nonfinite));
  count++;
  return { passed: count, rows, worldStepped: false };
}

// examples/physics-rigid-contact-diagnostic/observer.mjs
import assert3 from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
function observer(path) {
  const child = spawn("python3", [path], { stdio: ["pipe", "pipe", "pipe"] });
  let pending = null, stderr = "";
  child.stderr.on("data", (data) => stderr += data);
  createInterface({ input: child.stdout }).on("line", (line) => {
    if (!pending) throw new Error("unsolicited geometry output");
    const request = pending;
    pending = null;
    try {
      request.resolve(JSON.parse(line));
    } catch (error2) {
      request.reject(error2);
    }
  });
  child.on("error", (error2) => pending?.reject(error2));
  child.on("exit", (code) => {
    if (pending) {
      pending.reject(new Error(`geometry exit ${code}: ${stderr}`));
      pending = null;
    }
  });
  return {
    ask(data) {
      assert3.equal(pending, null);
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        child.stdin.write(JSON.stringify(data) + "\n");
      });
    },
    close() {
      child.stdin.end();
    },
    stderr() {
      return stderr;
    }
  };
}

// examples/physics-contact-boundary-2276/geometry-consumer.mjs
var [fixturePath, out, referencePath] = process.argv.slice(2);
var fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
var generated = { version: 1, cases: [] };
var pairRecords = [];
var reference = observer(referencePath);
function save(name, data) {
  writeFileSync(join(out, name + ".json"), JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
}
function restoreBodies(source, rawHex) {
  const bodies = structuredClone(source), bytes = Buffer.from(rawHex, "hex");
  let offset = 0;
  for (const body2 of bodies) for (const [field, count] of [["positionM", 3], ["velocityMps", 3], ["orientation", 4], ["angularVelocityRadps", 3]]) {
    body2[field] = Array.from({ length: count }, () => {
      const value = bytes.readDoubleLE(offset);
      offset += 8;
      return value;
    });
  }
  assert4.equal(offset, bytes.length);
  return bodies;
}
function operands(points) {
  const bytes = Buffer.alloc(points.length * 48);
  let offset = 0;
  for (const point2 of points) for (const value of [...point2.pointM, ...point2.normal]) {
    bytes.writeDoubleLE(value, offset);
    offset += 8;
  }
  return bytes.toString("hex");
}
try {
  for (const selected of fixture.cases) {
    const bodies = restoreBodies(selected.freeBodies, selected.freeBodyRawHex), saved = structuredClone(bodies);
    const groups = /* @__PURE__ */ new Map();
    for (const point2 of selected.originalPointLedger) {
      if (!groups.has(point2.pairKey)) groups.set(point2.pairKey, []);
      groups.get(point2.pairKey).push(point2);
    }
    const replacement = /* @__PURE__ */ new Map();
    for (const [pairKey, original] of groups) {
      const a = bodies[original[0].aIndex], b = bodies[original[0].bIndex];
      const geometry = featureContact(a, b);
      assert4.ok(geometry && geometry.family === "face");
      assert4.equal(geometry.points.length, original.length, "row count changed");
      for (let i = 0; i < original.length; i++) {
        assert4.equal(geometry.points[i].key, original[i].pointId, "point identity/order changed");
        replacement.set(pairKey + "\0" + original[i].pointId, {
          ...structuredClone(original[i]),
          pointM: [...geometry.points[i].midpointM],
          normal: [...geometry.planeNormalAtoB]
        });
      }
      assert4.deepEqual(bodies, saved, "generator changed input");
      assert4.deepEqual(featureContact(a, b), geometry, "same-input geometry differs");
      const result2 = await reference.ask({ a, b, geometry });
      pairRecords.push({ caseId: selected.caseId, pairKey, geometry, reference: result2 });
      assert4.ok(result2.ok && result2.resolved, "paired surface reference: " + JSON.stringify(result2.violations));
    }
    const pointLedger = selected.originalPointLedger.map((point2) => replacement.get(point2.pairKey + "\0" + point2.pointId));
    assert4.equal(pointLedger.length, 32);
    generated.cases.push({ caseId: selected.caseId, pointLedger, pointOperandF64leHex: operands(pointLedger) });
  }
  save("generated", generated);
  save("paired-witnesses", pairRecords);
  const result = await controls(geometry_entry_exports, reference);
  save("controls", result);
  assert4.equal(reference.stderr(), "");
  process.stdout.write(JSON.stringify({
    cases: generated.cases.length,
    rows: generated.cases.reduce((n, c) => n + c.pointLedger.length, 0),
    pairedReferences: pairRecords.length,
    featureControls: result.passed
  }) + "\n");
} catch (error2) {
  save("generation-failure", { name: error2.name, message: error2.message, partial: generated, pairedWitnesses: pairRecords });
  throw error2;
} finally {
  reference.close();
}
