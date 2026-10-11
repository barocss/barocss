// packages/barocss-physics/dist/types.js
var PhysicsError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

// packages/barocss-physics/dist/limits.js
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_BODIES = 32;
var MAX_LARGE_BODIES = 64;
var MAX_STEPS = 3600;
var MAX_STEP_DISPLACEMENT_M = 10;
var MAX_COMMANDS = 64;
var MAX_FORCE_N = 1e6;
var MAX_IMPULSE_NS = 1e5;
var MAX_TORQUE_NM = 1e6;
var MAX_ANGULAR_IMPULSE_NMS = 1e5;

// packages/barocss-physics/dist/validation.js
function error(code, message) {
  throw new PhysicsError(code, message);
}
function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    error("INVALID_CONFIG", `${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    error("INVALID_CONFIG", `${label} must be a plain object`);
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
  if (!Array.isArray(value) || value.length !== 3)
    error("INVALID_CONFIG", `${label} must be a 3-vector`);
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
  const magnitude3 = Math.hypot(...values);
  if (Math.abs(magnitude3 - 1) > 1e-6)
    error("INVALID_CONFIG", "orientation must have unit norm");
  return values.map((component) => component / magnitude3);
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
  if (typeof input.id !== "string" || !ID.test(input.id))
    error("INVALID_CONFIG", "invalid body ID");
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
  if (Object.hasOwn(input, "sensor") && input.sensor !== true)
    error("INVALID_CONFIG", "sensor must be true");
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
  const inertia3 = inertiaDiagonalKgM2 ?? [inertiaKgM2, inertiaKgM2, inertiaKgM2];
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
    inverseInertiaLocal: inertia3.map((value2) => 1 / value2),
    inverseMass: 1 / massKg,
    restitution,
    frictionStatic: material.static,
    frictionDynamic: material.dynamic
  };
}
function copyShape(value) {
  return value.kind === "sphere" ? { kind: "sphere", radiusM: value.radiusM } : value.kind === "box" ? { kind: "box", halfExtentsM: [...value.halfExtentsM] } : { kind: "capsule", radiusM: value.radiusM, halfLengthM: value.halfLengthM };
}
function copyBody(body) {
  return {
    ...body,
    shape: copyShape(body.shape),
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    orientation: [...body.orientation],
    angularVelocityRadps: [...body.angularVelocityRadps],
    ...body.collisionFilter ? { collisionFilter: { ...body.collisionFilter } } : {},
    ...body.inertiaDiagonalKgM2 ? { inertiaDiagonalKgM2: [...body.inertiaDiagonalKgM2] } : {},
    inverseInertiaLocal: [...body.inverseInertiaLocal]
  };
}
function commandVector(input, bound, label) {
  if (!Array.isArray(input) || input.length !== 3 || Reflect.ownKeys(input).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(input, index))) {
    error("INVALID_COMMAND", `${label} must be a dense 3-vector`);
  }
  const result = [input[0], input[1], input[2]];
  if (result.some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > bound)) {
    error("INVALID_COMMAND", `${label} must have finite components within \xB1${bound}`);
  }
  return result;
}
function parseCommands(input, bodies) {
  if (!Array.isArray(input) || input.length > MAX_COMMANDS || Reflect.ownKeys(input).length !== input.length + 1 || !Array.from({ length: input.length }, (_, index) => Object.hasOwn(input, index)).every(Boolean)) {
    error("INVALID_COMMAND", `commands must be a dense array of at most ${MAX_COMMANDS}`);
  }
  const byId = new Map(bodies.map((body) => [body.id, body]));
  const admitted2 = /* @__PURE__ */ new Map();
  for (const [index, raw] of input.entries()) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw) || Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null) {
      error("INVALID_COMMAND", `command ${index} must be a plain object`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const keys = Reflect.ownKeys(raw);
    const kind = descriptors.kind?.value;
    const valueKey = kind === "force" ? "forceN" : kind === "impulse" ? "impulseNs" : kind === "torque" ? "torqueNm" : kind === "angularImpulse" ? "angularImpulseNms" : kind === "kinematicTarget" ? "positionM" : null;
    if (!valueKey || keys.length !== 3 || keys.some((key) => typeof key !== "string" || !["kind", "bodyId", valueKey].includes(key)) || ["kind", "bodyId", valueKey].some((key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
      error("INVALID_COMMAND", `command ${index} has unsupported fields`);
    }
    const bodyId = descriptors.bodyId.value;
    const body = typeof bodyId === "string" ? byId.get(bodyId) : void 0;
    if (!body || (kind === "kinematicTarget" ? body.kind !== "kinematic" : body.kind !== "dynamic")) {
      error("INVALID_COMMAND", `command ${index} targets an unknown or unsupported body`);
    }
    const previous = admitted2.get(body.id) ?? {};
    if (Object.hasOwn(previous, valueKey))
      error("INVALID_COMMAND", `duplicate ${kind} command for ${body.id}`);
    const bound = kind === "force" ? MAX_FORCE_N : kind === "impulse" ? MAX_IMPULSE_NS : kind === "torque" ? MAX_TORQUE_NM : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS : 1e4;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted2.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted2;
}
function queryRecord(input, required, optional) {
  if (input === null || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
    error("INVALID_QUERY", "query must be a plain object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key !== "string" || ![...required, ...optional].includes(key)) || required.some((key) => !Object.hasOwn(descriptors, key)) || keys.some((key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
    error("INVALID_QUERY", "query has missing or unsupported fields");
  }
  return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
}
function queryVector(input, bound, label) {
  if (!Array.isArray(input) || input.length !== 3 || Reflect.ownKeys(input).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(input, index))) {
    error("INVALID_QUERY", `${label} must be a dense 3-vector`);
  }
  const values = [input[0], input[1], input[2]];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > bound)) {
    error("INVALID_QUERY", `${label} components must be finite within \xB1${bound}`);
  }
  return values;
}
function queryNumber(input, min, max, label) {
  if (typeof input !== "number" || !Number.isFinite(input) || input < min || input > max) {
    error("INVALID_QUERY", `${label} must be finite and in [${min}, ${max}]`);
  }
  return input;
}
function includeSensors(query) {
  if (!Object.hasOwn(query, "includeSensors"))
    return true;
  if (typeof query.includeSensors !== "boolean")
    error("INVALID_QUERY", "includeSensors must be boolean");
  return query.includeSensors;
}

// packages/barocss-physics/dist/math.js
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
  if (speed === 0)
    return [...orientation];
  const halfAngle = speed * dt / 2;
  const scale3 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale3,
    angularVelocity[1] * scale3,
    angularVelocity[2] * scale3,
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
var localPoint = (body, point2) => rotate(inverse(body.orientation), sub(point2, body.positionM));
var worldPoint = (body, point2) => add(body.positionM, rotate(body.orientation, point2));
function inverseInertia(body, vector4) {
  const local = rotate(inverse(body.orientation), vector4);
  return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}

// packages/barocss-physics/dist/capsule-contact.js
var clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function capsuleEnds(body) {
  const half = body.shape.halfLengthM;
  return [worldPoint(body, [0, -half, 0]), worldPoint(body, [0, half, 0])];
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
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
      candidates.push([s, t]);
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
  const direction2 = sub(segmentEnd, segmentStart);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction2[axis]) < 1e-15)
      continue;
    for (const face of [-extents2[axis], extents2[axis]]) {
      const t = (face - segmentStart[axis]) / direction2[axis];
      if (t > 0 && t < 1)
        breaks.push(t);
    }
  }
  breaks.sort((a, b) => a - b);
  let bestT = 0.5, bestDistance = Infinity;
  for (let interval = 0; interval < breaks.length - 1; interval++) {
    const low = breaks[interval], high = breaks[interval + 1];
    if (high - low < 1e-15)
      continue;
    const midpoint = (low + high) / 2;
    let numerator = 0, denominator = 0;
    for (let axis = 0; axis < 3; axis++) {
      const value = segmentStart[axis] + midpoint * direction2[axis];
      const face = value < -extents2[axis] ? -extents2[axis] : value > extents2[axis] ? extents2[axis] : null;
      if (face === null)
        continue;
      numerator += direction2[axis] * (segmentStart[axis] - face);
      denominator += direction2[axis] ** 2;
    }
    const t = clamp(denominator ? -numerator / denominator : 0.5, low, high);
    const point3 = add(segmentStart, scale(direction2, t));
    const nearest = point3.map((value, axis) => clamp(value, -extents2[axis], extents2[axis]));
    const delta = sub(point3, nearest), distance = dot(delta, delta);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(bestT - 0.5)) {
      bestT = t;
      bestDistance = distance;
    }
  }
  const point2 = add(segmentStart, scale(direction2, bestT));
  return [point2, point2.map((value, axis) => clamp(value, -extents2[axis], extents2[axis]))];
}
function capsuleCapsule(a, b) {
  const [aPoint, bPoint] = segmentPair(...capsuleEnds(a), ...capsuleEnds(b));
  const delta = sub(bPoint, aPoint), distance = Math.hypot(...delta);
  const aRadius = a.shape.radiusM;
  const bRadius = b.shape.radiusM;
  if (distance > aRadius + bRadius)
    return null;
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
  if (distance > radius)
    return null;
  if (distance > 1e-12)
    return {
      normal: rotate(box.orientation, scale(delta, 1 / distance)),
      penetration: radius - distance,
      pointM: worldPoint(box, boxPoint)
    };
  let bestAxis = 0, bestSide = -1, bestGap = Infinity;
  for (let axis = 0; axis < 3; axis++)
    for (const side of [-1, 1]) {
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

// packages/barocss-physics/dist/collision.js
function capsuleCenter(body, point2) {
  const half = body.shape.halfLengthM;
  const local = localPoint(body, point2);
  return worldPoint(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport(body, direction2) {
  const axes = boxAxes(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction2);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
    return add(result, scale(axis, offset));
  }, [0, 0, 0]));
}
function sphereSphere(a, b) {
  const aRadius = a.shape.radiusM;
  const bRadius = b.shape.radiusM;
  const delta = sub(b.positionM, a.positionM);
  const distance = Math.hypot(...delta);
  if (distance > aRadius + bRadius)
    return null;
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
  if (distance > radius)
    return null;
  if (distance > 0)
    return {
      normal: rotate(box.orientation, scale(towardBox, 1 / distance)),
      penetration: Math.max(0, radius - distance),
      pointM: worldPoint(box, nearest)
    };
  let axis = 0, side = -1, faceDistance = Infinity;
  for (let index = 0; index < 3; index++)
    for (const candidate of [-1, 1]) {
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
  if (distance > capsuleRadius + sphereRadius)
    return null;
  const normal = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  return {
    normal,
    penetration: Math.max(0, capsuleRadius + sphereRadius - distance),
    pointM: scale(add(add(center, scale(normal, capsuleRadius)), sub(sphere.positionM, scale(normal, sphereRadius))), 0.5)
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
    if (length < 1e-12)
      continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis3, index) => sum + extentA[index] * Math.abs(dot(basis3, axis)), 0);
    const radiusB = axesB.reduce((sum, basis3, index) => sum + extentB[index] * Math.abs(dot(basis3, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    if (overlap < -1e-12)
      return null;
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
  if (a.shape.kind === "sphere" && b.shape.kind === "sphere")
    return sphereSphere(a, b);
  if (a.shape.kind === "sphere" && b.shape.kind === "box")
    return sphereBox(a, b);
  if (a.shape.kind === "box" && b.shape.kind === "sphere") {
    const hit = sphereBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === "capsule" && b.shape.kind === "sphere")
    return capsuleSphere(a, b);
  if (a.shape.kind === "sphere" && b.shape.kind === "capsule") {
    const hit = capsuleSphere(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === "box" && b.shape.kind === "box")
    return boxBox(a, b);
  if (a.shape.kind === "capsule" && b.shape.kind === "box")
    return capsuleBox(a, b);
  if (a.shape.kind === "box" && b.shape.kind === "capsule") {
    const hit = capsuleBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === "capsule" && b.shape.kind === "capsule")
    return capsuleCapsule(a, b);
  return null;
}
function sphereOverlaps(center, radius, body) {
  if (body.shape.kind === "sphere") {
    return Math.hypot(...sub(center, body.positionM)) <= radius + body.shape.radiusM;
  }
  if (body.shape.kind === "capsule") {
    return Math.hypot(...sub(center, capsuleCenter(body, center))) <= radius + body.shape.radiusM;
  }
  const extents2 = body.shape.halfExtentsM;
  const local = localPoint(body, center);
  const delta = local.map((value, index) => Math.max(0, Math.abs(value) - extents2[index]));
  return Math.hypot(...delta) <= radius;
}
function raySphere(origin, direction2, center, radius) {
  const relative = sub(origin, center);
  const c = dot(relative, relative) - radius ** 2;
  if (c <= 0)
    return 0;
  const projection = dot(relative, direction2);
  const discriminant = projection ** 2 - c;
  return projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
}
function rayDistance(origin, direction2, body) {
  if (body.shape.kind === "sphere")
    return raySphere(origin, direction2, body.positionM, body.shape.radiusM);
  const localOrigin = localPoint(body, origin);
  const localDirection = rotate(inverse(body.orientation), direction2);
  if (body.shape.kind === "capsule") {
    const { radiusM: radius, halfLengthM: half } = body.shape;
    const closest = [0, Math.max(-half, Math.min(half, localOrigin[1])), 0];
    if (Math.hypot(...sub(localOrigin, closest)) <= radius)
      return 0;
    const results = [];
    for (const y of [-half, half]) {
      const hit = raySphere(localOrigin, localDirection, [0, y, 0], radius);
      if (hit !== null)
        results.push(hit);
    }
    const a = localDirection[0] ** 2 + localDirection[2] ** 2;
    if (a > 1e-12) {
      const b = 2 * (localOrigin[0] * localDirection[0] + localOrigin[2] * localDirection[2]);
      const c = localOrigin[0] ** 2 + localOrigin[2] ** 2 - radius ** 2;
      const discriminant = b ** 2 - 4 * a * c;
      if (discriminant >= 0)
        for (const sign of [-1, 1]) {
          const hit = (-b + sign * Math.sqrt(discriminant)) / (2 * a);
          const y = localOrigin[1] + localDirection[1] * hit;
          if (hit >= 0 && y >= -half && y <= half)
            results.push(hit);
        }
    }
    return results.length ? Math.min(...results) : null;
  }
  let near3 = -Infinity, far = Infinity;
  for (let index = 0; index < 3; index++) {
    const lower = -body.shape.halfExtentsM[index];
    const upper = body.shape.halfExtentsM[index];
    const component = localDirection[index];
    if (Math.abs(component) < 1e-12) {
      if (localOrigin[index] < lower || localOrigin[index] > upper)
        return null;
      continue;
    }
    const first = (lower - localOrigin[index]) / component;
    const second = (upper - localOrigin[index]) / component;
    near3 = Math.max(near3, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (far < near3)
      return null;
  }
  return far < 0 ? null : Math.max(0, near3);
}
function validateResult(bodies, contacts) {
  for (const body of bodies) {
    for (const [label, values, bound] of [
      ["position", body.positionM, 1e4],
      ["velocity", body.velocityMps, 1e3],
      ["angularVelocity", body.angularVelocityRadps, 1e3]
    ]) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound))
        error("NUMERIC_LIMIT", `${body.id} ${label} exceeded bounds`);
    }
    if (body.orientation.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body.orientation) - 1) > 1e-12)
      error("NUMERIC_LIMIT", `${body.id} orientation exceeded tolerance`);
  }
  if (contacts.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) || contact.normalAtoB.some((value) => !Number.isFinite(value)) || contact.pointM.some((value) => !Number.isFinite(value)) || contact.tangentImpulseNs.some((value) => !Number.isFinite(value))))
    error("NUMERIC_LIMIT", "unsafe contact result");
}

// packages/barocss-physics/dist/persistent-box-contact.js
function apply(a, b, pointM, impulse) {
  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
  a.velocityMps = sub(a.velocityMps, scale(impulse, a.inverseMass));
  b.velocityMps = add(b.velocityMps, scale(impulse, b.inverseMass));
  a.angularVelocityRadps = sub(a.angularVelocityRadps, inverseInertia(a, cross(armA, impulse)));
  b.angularVelocityRadps = add(b.angularVelocityRadps, inverseInertia(b, cross(armB, impulse)));
}
function relativeVelocity(a, b, pointM) {
  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
  return sub(add(b.velocityMps, cross(b.angularVelocityRadps, armB)), add(a.velocityMps, cross(a.angularVelocityRadps, armA)));
}
function effectiveInverseMass(a, b, pointM, direction2) {
  const torqueA = cross(sub(pointM, a.positionM), direction2);
  const torqueB = cross(sub(pointM, b.positionM), direction2);
  return a.inverseMass + b.inverseMass + dot(torqueA, inverseInertia(a, torqueA)) + dot(torqueB, inverseInertia(b, torqueB));
}
function warmStartPoint(a, b, pointM, normal, impulse) {
  apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));
}
function solvePersistentPoint(a, b, pointM, normal, impulse) {
  const normalSpeed = dot(relativeVelocity(a, b, pointM), normal);
  const normalMass = effectiveInverseMass(a, b, pointM, normal);
  const nextNormal = Math.max(0, impulse.normalNs - normalSpeed / normalMass);
  const deltaNormal = nextNormal - impulse.normalNs;
  impulse.normalNs = nextNormal;
  if (deltaNormal !== 0)
    apply(a, b, pointM, scale(normal, deltaNormal));
  const relative = relativeVelocity(a, b, pointM);
  const tangent = sub(relative, scale(normal, dot(relative, normal)));
  const tangentSpeed = Math.hypot(...tangent);
  if (tangentSpeed < 1e-12)
    return;
  const direction2 = scale(tangent, 1 / tangentSpeed);
  const tangentMass = effectiveInverseMass(a, b, pointM, direction2);
  const requested = sub(impulse.tangentNs, scale(direction2, tangentSpeed / tangentMass));
  const requestedMagnitude = Math.hypot(...requested);
  const staticLimit = Math.sqrt(a.frictionStatic * b.frictionStatic) * impulse.normalNs;
  const dynamicLimit = Math.sqrt(a.frictionDynamic * b.frictionDynamic) * impulse.normalNs;
  const limit = requestedMagnitude <= staticLimit ? staticLimit : dynamicLimit;
  const nextTangent = requestedMagnitude > limit && requestedMagnitude > 0 ? scale(requested, limit / requestedMagnitude) : requested;
  const deltaTangent = sub(nextTangent, impulse.tangentNs);
  impulse.tangentNs = nextTangent;
  apply(a, b, pointM, deltaTangent);
}

// examples/physics-rigid-feature-contact-reference/warm-cache.ts
function emptyWarmCacheStats() {
  return { testedPatches: 0, compatiblePatches: 0, incompatiblePatches: 0, reusedPoints: 0, coldPoints: 0 };
}
function compatiblePatch(cache, pairKey2, points, family) {
  if (family !== "face") return false;
  const prefix = `${pairKey2}\0`;
  const current = new Set(points.map((point2) => `${prefix}${point2.id}`));
  const previous = [...cache.keys()].filter((key) => key.startsWith(prefix));
  return current.size > 0 && current.size === points.length && points.every((point2) => point2.id.startsWith("face:")) && previous.length === current.size && previous.every((key) => key.slice(prefix.length).startsWith("face:") && current.has(key));
}

// examples/physics-rigid-feature-geometry/sat-feature.ts
var FEATURE_INPUT_MESSAGE = "private feature geometry requires two admitted boxes";
var DIAGNOSTIC_TIE_TOLERANCE_M = 1e-12;
function boxAxes2(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport2(body, direction2) {
  const axes = boxAxes2(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction2);
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
    const radiusA = axesA.reduce((sum, basis3, index) => sum + extentA[index] * Math.abs(dot(basis3, axis)), 0);
    const radiusB = axesB.reduce((sum, basis3, index) => sum + extentB[index] * Math.abs(dot(basis3, axis)), 0);
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

// examples/physics-rigid-feature-geometry/face-contact.ts
function clipFace(polygon, centre, axis, limit) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = dot(sub(p, centre), axis) - limit, dq = dot(sub(q, centre), axis) - limit;
    if (dp <= 0) out.push([...p]);
    if (dp <= 0 !== dq <= 0) out.push(add(p, scale(sub(q, p), dp / (dp - dq))));
  }
  return out;
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
  const points = unique.map((p, i) => point(`${prefix}:${i}`, isA ? p.r : p.p, isA ? p.p : p.r, planeNormalAtoB));
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
      uniquePhysicalFeatureClaimed: false
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
function supportEdge(body, axis, direction2) {
  const axes = basis(body), e = extents(body), sides = [0, 0, 0];
  let centre = [...body.positionM];
  for (let i = 0; i < 3; i++) if (i !== axis) {
    sides[i] = dot(axes[i], direction2) < 0 ? -1 : 1;
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
function witnessInside(body, w) {
  const local = basis(body).map((axis) => dot(sub(w, body.positionM), axis)), e = extents(body);
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

// examples/physics-rigid-feature-contact-reference/geometry-adapter.ts
var FEATURE_WITNESS_MESSAGE = "private feature contact requires valid box witnesses";
function adaptContactGeometry(a, b) {
  let geometry;
  try {
    geometry = featureContact(a, b);
  } catch (caught) {
    if (caught instanceof PhysicsError && (caught.code === "INVALID_CONFIG" || caught.code === "NUMERIC_LIMIT")) {
      error("NUMERIC_LIMIT", FEATURE_WITNESS_MESSAGE);
    }
    throw caught;
  }
  if (!geometry) return null;
  const points = geometry.points.map((point2) => ({
    id: point2.key,
    pointM: [...point2.midpointM],
    witnessAM: [...point2.witnessAM],
    witnessBM: [...point2.witnessBM],
    normalGapM: point2.normalGapM,
    pointPenetrationM: point2.pointPenetrationM
  }));
  const sum = points.reduce((value, point2) => add(value, point2.pointM), [0, 0, 0]);
  return {
    family: geometry.family,
    normal: [...geometry.planeNormalAtoB],
    satNormalAtoB: [...geometry.selection.hit.normal],
    satPenetrationM: geometry.selection.hit.penetration,
    points,
    meanPointM: sum.map((value) => value / points.length)
  };
}

// examples/physics-rigid-full-pair-position-world/full-pair-input.mjs
var MESSAGES = Object.freeze({
  input: "full-pair position reference input is invalid",
  limit: "full-pair position reference admits at most nine bodies and thirty-six rows",
  empty: "full-pair position reference requires at least one body",
  ids: "full-pair position reference body IDs must be nonempty and unique",
  mass: "full-pair position reference inverse mass is invalid",
  endpoints: "full-pair position reference row endpoints are invalid",
  normal: "full-pair position reference normal must be finite and unit length",
  bound: "full-pair position reference bound must be finite and between minus ten and ten metres",
  result: "full-pair position reference result is invalid",
  workLimits: "full-pair position reference work limits are invalid"
});
var FullPairPositionReferenceError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FullPairPositionReferenceError";
    this.code = code;
  }
};
var DEFAULT_LIMITS = Object.freeze({
  iterations: 1024,
  activeChanges: 1024,
  rankChecks: 2048,
  linearSolves: 2048,
  constraintTests: 262144,
  exactIntegerOperations: 1e6,
  reducedRationalBits: 8192,
  intermediateIntegerBits: 16385
});
var COUNTER_KEYS = Object.freeze(["iterations", "activeChanges", "rankChecks", "linearSolves", "constraintTests", "factorizations", "blockRightHandSides", "exactIntegerOperations", "exactPeakBits"]);
function zeroFullPairCounters() {
  return Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0]));
}
function requireFull(condition, key = "input", code = "INVALID_INPUT") {
  if (!condition) throw new FullPairPositionReferenceError(code, MESSAGES[key]);
}
function dataRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some((k) => typeof k !== "string" || !keys.includes(k))) return null;
  const copy = {};
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(value, k);
    if (!d || !Object.hasOwn(d, "value")) return null;
    Object.defineProperty(copy, k, { value: d.value, enumerable: true, writable: true, configurable: true });
  }
  return copy;
}
function dataArray(value, size) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) || length.value < 0) return null;
  const n = length.value;
  if (size !== void 0 && n !== size) return null;
  const own = Reflect.ownKeys(value);
  if (own.length !== n + 1) return null;
  const copy = [];
  for (let i = 0; i < n; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, "value")) return null;
    copy.push(d.value);
  }
  return copy;
}
function dataFiniteVector(value, size) {
  const a = dataArray(value, size);
  return a && a.every((v) => typeof v === "number" && Number.isFinite(v)) ? a : null;
}
function validateFullPairProblem(value) {
  const p = dataRecord(value, ["bodies", "rows"]);
  requireFull(p !== null);
  const bodies = dataArray(p.bodies), rows = dataArray(p.rows);
  requireFull(bodies !== null && rows !== null);
  requireFull(bodies.length <= 9 && rows.length <= 36, "limit", "PROFILE_LIMIT");
  requireFull(bodies.length > 0, "empty");
  const checkedBodies = [], ids = /* @__PURE__ */ new Set();
  for (const raw of bodies) {
    const b = dataRecord(raw, ["id", "inverseMass"]);
    requireFull(b !== null);
    requireFull(typeof b.id === "string" && b.id.length > 0 && !ids.has(b.id), "ids");
    ids.add(b.id);
    requireFull(typeof b.inverseMass === "number" && Number.isFinite(b.inverseMass) && (b.inverseMass === 0 || b.inverseMass >= 1e-6 && b.inverseMass <= 1e6), "mass");
    checkedBodies.push({ id: b.id, inverseMass: b.inverseMass });
  }
  const checkedRows = [];
  for (const raw of rows) {
    const row = dataRecord(raw, ["aId", "bId", "normal", "boundM"]);
    requireFull(row !== null);
    requireFull(ids.has(row.aId) && ids.has(row.bId) && row.aId !== row.bId, "endpoints");
    const normal = dataFiniteVector(row.normal, 3);
    requireFull(normal !== null && Math.abs(Math.hypot(...normal) - 1) <= 1e-12, "normal");
    requireFull(typeof row.boundM === "number" && Number.isFinite(row.boundM) && row.boundM >= -10 && row.boundM <= 10, "bound");
    checkedRows.push({ aId: row.aId, bId: row.bId, normal: [...normal], boundM: row.boundM });
  }
  return { bodies: checkedBodies, rows: checkedRows };
}
function validateWorkLimits(value) {
  const limits = dataRecord(value, Object.keys(DEFAULT_LIMITS));
  requireFull(limits !== null, "workLimits");
  for (const k of Object.keys(DEFAULT_LIMITS)) requireFull(Number.isSafeInteger(limits[k]) && limits[k] >= 0 && limits[k] <= DEFAULT_LIMITS[k], "workLimits");
  return { ...limits };
}
var CoreStop = class extends Error {
  constructor(status, reason) {
    super(reason);
    this.name = "FullPairCoreStop";
    this.status = status;
    this.reason = reason;
  }
};
function unsafe(reason) {
  throw new CoreStop("NUMERIC_UNSAFE", reason);
}
function finite2(value) {
  if (!Number.isFinite(value)) unsafe("nonfinite");
  return value;
}
function createMeter(limits = DEFAULT_LIMITS) {
  const selected = validateWorkLimits(limits), counters = zeroFullPairCounters();
  return {
    limits: selected,
    counters,
    take(key, amount = 1) {
      const next = counters[key] + amount;
      if (!Number.isSafeInteger(next) || next > selected[key]) throw new CoreStop("WORK_LIMIT", "budget:" + key);
      counters[key] = next;
    },
    bits(value, reduced = false) {
      const size = value === 0n ? 0 : (value < 0n ? -value : value).toString(2).length;
      const key = reduced ? "reducedRationalBits" : "intermediateIntegerBits";
      if (size > selected[key]) throw new CoreStop("WORK_LIMIT", "budget:" + key);
      counters.exactPeakBits = Math.max(counters.exactPeakBits, size);
      return size;
    },
    plannedBits(size) {
      if (size > selected.intermediateIntegerBits) throw new CoreStop("WORK_LIMIT", "budget:intermediateIntegerBits");
    }
  };
}

// examples/physics-rigid-full-pair-position-world/full-pair-linear.mjs
var EPS = 1e-12;
var PIVOT = 1e-14;
var normInfVector = (v) => Math.max(0, ...v.map(Math.abs));
var normInfMatrix = (m) => Math.max(0, ...m.map((row) => row.reduce((s, v) => finite2(s + Math.abs(v)), 0)));
function dot2(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum = finite2(sum + finite2(a[i] * b[i]));
  return sum;
}
function prepareModel(problem) {
  const offsets = [], D = [];
  for (const body of problem.bodies) {
    if (body.inverseMass === 0) offsets.push(null);
    else {
      offsets.push(D.length);
      D.push(body.inverseMass, body.inverseMass, body.inverseMass);
    }
  }
  const locations = new Map(problem.bodies.map((b2, i) => [b2.id, i]));
  const A = problem.rows.map((row) => {
    const a = Array(D.length).fill(0), ia = offsets[locations.get(row.aId)], ib = offsets[locations.get(row.bId)];
    for (let k = 0; k < 3; k++) {
      if (ia !== null) a[ia + k] = -row.normal[k];
      if (ib !== null) a[ib + k] = row.normal[k];
    }
    return a;
  });
  const b = problem.rows.map((row) => row.boundM), G = A.map((left) => A.map((right) => {
    let sum = 0;
    for (let k = 0; k < D.length; k++) sum = finite2(sum + finite2(finite2(left[k] * D[k]) * right[k]));
    return sum;
  }));
  return { problem, A, b, D, G, offsets, dynamicDof: D.length };
}
function reconstruct(model, lambda) {
  return model.D.map((inverseMass, k) => {
    let sum = 0;
    for (let i = 0; i < model.A.length; i++) sum = finite2(sum + finite2(model.A[i][k] * lambda[i]));
    return finite2(inverseMass * sum);
  });
}
function margins(model, u, meter) {
  return model.A.map((row, i) => {
    meter?.take("constraintTests");
    return finite2(dot2(row, u) - model.b[i]);
  });
}
function translations(model, u) {
  return model.problem.bodies.map((body, i) => ({ id: body.id, u: model.offsets[i] === null ? [0, 0, 0] : u.slice(model.offsets[i], model.offsets[i] + 3) }));
}
function fullCertificate(model, u, lambda, meter) {
  const primalMarginsM = margins(model, u, meter);
  let stationarityKgM = 0;
  for (let k = 0; k < u.length; k++) {
    let sum = 0;
    for (let i = 0; i < lambda.length; i++) sum = finite2(sum + finite2(model.A[i][k] * lambda[i]));
    stationarityKgM = Math.max(stationarityKgM, Math.abs(finite2(u[k] / model.D[k] - sum)));
  }
  const certificate = {
    primalViolationM: Math.max(0, ...primalMarginsM.map((v) => -v)),
    negativeMultiplierKgM: Math.max(0, ...lambda.map((v) => -v)),
    complementarityKgM2: Math.max(0, ...lambda.map((v, i) => Math.abs(finite2(v * primalMarginsM[i])))),
    stationarityKgM
  };
  let objectiveKgM2 = 0;
  for (let i = 0; i < model.problem.bodies.length; i++) {
    const start = model.offsets[i];
    if (start === null) continue;
    let square = 0;
    for (let k = 0; k < 3; k++) square = finite2(square + finite2(u[start + k] * u[start + k]));
    objectiveKgM2 = finite2(objectiveKgM2 + finite2(square / model.problem.bodies[i].inverseMass / 2));
  }
  return { primalMarginsM, certificate, objectiveKgM2 };
}
function checkIterate(model, u, lambda, W, pending, meter) {
  if (u.some((v) => !Number.isFinite(v)) || lambda.some((v) => !Number.isFinite(v))) unsafe("nonfinite");
  if (lambda.some((v) => v < 0)) unsafe("negative-multiplier");
  const allowed = new Set(W);
  if (pending !== null) allowed.add(pending);
  if (lambda.some((v, i) => v !== 0 && !allowed.has(i))) unsafe("iterate-certificate");
  for (const i of W) {
    meter.take("constraintTests");
    if (Math.abs(finite2(dot2(model.A[i], u) - model.b[i])) > EPS) unsafe("iterate-certificate");
  }
  for (let k = 0; k < u.length; k++) {
    let sum = 0;
    for (let i = 0; i < lambda.length; i++) sum = finite2(sum + finite2(model.A[i][k] * lambda[i]));
    if (Math.abs(finite2(u[k] / model.D[k] - sum)) > EPS) unsafe("iterate-certificate");
  }
}
function solveBasis(matrix, rhs, meter) {
  const n = rhs.length;
  if (n === 0) return { r: [], inverse: [], condition: null };
  meter.take("linearSolves");
  meter.counters.factorizations++;
  meter.counters.blockRightHandSides += 1 + n;
  const scale3 = Math.max(1, ...matrix.flat().map(Math.abs)), aug = matrix.map((row, i) => [...row, rhs[i], ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    if (!Number.isFinite(aug[pivot][col])) unsafe("nonfinite");
    if (Math.abs(aug[pivot][col]) <= PIVOT * scale3) unsafe("pivot");
    [aug[pivot], aug[col]] = [aug[col], aug[pivot]];
    for (let row = col + 1; row < n; row++) {
      const ratio = finite2(aug[row][col] / aug[col][col]);
      for (let k = col; k < 2 * n + 1; k++) aug[row][k] = finite2(aug[row][k] - finite2(ratio * aug[col][k]));
    }
  }
  const solved = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let row = n - 1; row >= 0; row--) for (let k = 0; k < n + 1; k++) {
    let value = aug[row][n + k];
    for (let col = row + 1; col < n; col++) value = finite2(value - finite2(aug[row][col] * solved[col][k]));
    solved[row][k] = finite2(value / aug[row][row]);
  }
  const r = solved.map((row) => row[0]), inverse3 = solved.map((row) => row.slice(1));
  const normG = normInfMatrix(matrix), condition = finite2(normG * normInfMatrix(inverse3));
  if (condition > 1e12) unsafe("condition");
  const residual = normInfVector(matrix.map((row, i) => finite2(dot2(row, r) - rhs[i]))), denominator = finite2(Math.max(1, finite2(normG * normInfVector(r)) + normInfVector(rhs)));
  if (finite2(residual / denominator) > EPS) unsafe("factor-residual");
  const product = matrix.map((row, i) => Array.from({ length: n }, (_, j) => finite2(dot2(row, inverse3.map((x) => x[j])) - (i === j ? 1 : 0))));
  if (normInfMatrix(product) > EPS) unsafe("factor-residual");
  return { r, inverse: inverse3, condition };
}
function direction(model, W, p, r, meter) {
  const z = model.D.map((inv, k) => {
    let projection = 0;
    for (let j = 0; j < W.length; j++) projection = finite2(projection + finite2(model.A[W[j]][k] * r[j]));
    return finite2(inv * finite2(model.A[p][k] - projection));
  });
  meter.take("rankChecks");
  const delta = dot2(model.A[p], z), scale3 = Math.max(1, model.G[p][p]);
  let zMz = 0;
  for (let k = 0; k < z.length; k++) zMz = finite2(zMz + finite2(finite2(z[k] * z[k]) / model.D[k]));
  const orthogonal = normInfVector(W.map((i) => dot2(model.A[i], z))), orthScale = Math.max(1, ...W.map((i) => Math.abs(model.G[i][p])), ...W.map((i) => {
    let sum = 0;
    for (let j = 0; j < W.length; j++) sum = finite2(sum + Math.abs(finite2(model.G[i][W[j]] * r[j])));
    return sum;
  }));
  if (finite2(orthogonal / orthScale) > EPS || finite2(Math.abs(finite2(delta - zMz)) / Math.max(1, Math.abs(delta), Math.abs(zMz), Math.abs(model.G[p][p]))) > EPS) unsafe("direction-residual");
  if (delta < -PIVOT * scale3) unsafe("direction-residual");
  return { z, delta, near: Math.abs(delta) <= PIVOT * scale3 || W.length + 1 > model.dynamicDof };
}

// examples/physics-rigid-full-pair-position-world/full-pair-exact.mjs
var ZERO = Object.freeze({ n: 0n, d: 1n });
var ONE = Object.freeze({ n: 1n, d: 1n });
var bits = (x) => x === 0n ? 0 : (x < 0n ? -x : x).toString(2).length;
function operation(meter, estimate, fn) {
  meter.plannedBits(estimate);
  meter.take("exactIntegerOperations");
  const x = fn();
  meter.bits(x);
  return x;
}
var addI = (a, b, m) => operation(m, Math.max(bits(a), bits(b)) + 1, () => a + b);
var subI = (a, b, m) => operation(m, Math.max(bits(a), bits(b)) + 1, () => a - b);
var mulI = (a, b, m) => operation(m, bits(a) + bits(b), () => a * b);
var divI = (a, b, m) => operation(m, bits(a), () => a / b);
var remI = (a, b, m) => operation(m, bits(a), () => a % b);
var shiftI = (a, k, m) => operation(m, bits(a) + k, () => a << BigInt(k));
function absI(a, m) {
  return a < 0n ? subI(0n, a, m) : a;
}
function gcd(a, b, m) {
  a = absI(a, m);
  b = absI(b, m);
  while (b !== 0n) {
    const next = remI(a, b, m);
    a = b;
    b = next;
  }
  return a;
}
function checked(q, m) {
  m.bits(q.n, true);
  m.bits(q.d, true);
  return q;
}
function rational(n, d, m) {
  if (d === 0n) unsafe("uncertified-infeasibility");
  if (d < 0n) {
    n = subI(0n, n, m);
    d = subI(0n, d, m);
  }
  if (n === 0n) return checked(ZERO, m);
  const g = gcd(n, d, m);
  return checked({ n: divI(n, g, m), d: divI(d, g, m) }, m);
}
function addQ(a, b, m) {
  if (a.n === 0n) return checked(b, m);
  if (b.n === 0n) return checked(a, m);
  return rational(addI(mulI(a.n, b.d, m), mulI(b.n, a.d, m), m), mulI(a.d, b.d, m), m);
}
function negQ(a, m) {
  return a.n === 0n ? checked(ZERO, m) : checked({ n: subI(0n, a.n, m), d: a.d }, m);
}
function subQ(a, b, m) {
  return addQ(a, negQ(b, m), m);
}
function mulQ(a, b, m) {
  if (a.n === 0n || b.n === 0n) return checked(ZERO, m);
  return rational(mulI(a.n, b.n, m), mulI(a.d, b.d, m), m);
}
function divQ(a, b, m) {
  if (b.n === 0n) unsafe("uncertified-infeasibility");
  if (a.n === 0n) return checked(ZERO, m);
  return rational(mulI(a.n, b.d, m), mulI(a.d, b.n, m), m);
}
var text = (q) => `${q.n}/${q.d}`;
function fromNumber(value, m) {
  if (!Number.isFinite(value)) unsafe("nonfinite");
  if (value === 0) return checked(ZERO, m);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  const raw = view.getBigUint64(0, false);
  const sign = raw >> 63n, exponent = Number(raw >> 52n & 2047n), fraction = raw & (1n << 52n) - 1n;
  let n = exponent === 0 ? fraction : addI(1n << 52n, fraction, m), d = 1n;
  const shift = exponent === 0 ? -1074 : exponent - 1023 - 52;
  if (shift >= 0) n = shiftI(n, shift, m);
  else d = shiftI(d, -shift, m);
  if (sign) n = subI(0n, n, m);
  return rational(n, d, m);
}
function toNumber(q, m) {
  if (q.n === 0n) return 0;
  const negative = q.n < 0n, n = absI(q.n, m), d = q.d;
  let exponent = bits(n) - bits(d);
  if (exponent >= 0) {
    if (n < shiftI(d, exponent, m)) exponent--;
  } else if (shiftI(n, -exponent, m) < d) exponent--;
  if (exponent > 1023) unsafe("dependency-conversion");
  const quantum = Math.max(exponent - 52, -1074), numerator = quantum < 0 ? shiftI(n, -quantum, m) : n, denominator = quantum > 0 ? shiftI(d, quantum, m) : d;
  let significand = divI(numerator, denominator, m);
  const remainder = remI(numerator, denominator, m), twice = mulI(remainder, 2n, m);
  if (twice > denominator || twice === denominator && remI(significand, 2n, m) !== 0n) significand = addI(significand, 1n, m);
  const result = (negative ? -1 : 1) * Number(significand) * 2 ** quantum;
  if (!Number.isFinite(result) || result === 0 || result < 0 !== negative) unsafe("dependency-conversion");
  return result;
}
function makeExactSystem(model, meter) {
  const A = model.A.map((row) => row.map((x) => fromNumber(x, meter))), D = model.D.map((x) => fromNumber(x, meter)), b = model.b.map((x) => fromNumber(x, meter)), cache = /* @__PURE__ */ new Map();
  return { A, D, b, gram(i, j) {
    const key = i + ":" + j;
    if (cache.has(key)) return cache.get(key);
    let sum = checked(ZERO, meter);
    for (let k = 0; k < D.length; k++) if (A[i][k].n !== 0n && A[j][k].n !== 0n) sum = addQ(sum, mulQ(mulQ(A[i][k], D[k], meter), A[j][k], meter), meter);
    cache.set(key, sum);
    return sum;
  } };
}
function solveExact(matrix, rhs, m) {
  const n = rhs.length;
  if (n === 0) return [];
  m.take("linearSolves");
  m.counters.factorizations++;
  m.counters.blockRightHandSides++;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (pivot < n && a[pivot][col].n === 0n) pivot++;
    if (pivot === n) unsafe("dependent-basis");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < n; row++) {
      if (a[row][col].n === 0n) continue;
      const ratio = divQ(a[row][col], a[col][col], m);
      for (let k = col; k <= n; k++) a[row][k] = subQ(a[row][k], mulQ(ratio, a[col][k], m), m);
    }
  }
  const x = Array(n).fill(ZERO);
  for (let row = n - 1; row >= 0; row--) {
    let value = a[row][n];
    for (let col = row + 1; col < n; col++) value = subQ(value, mulQ(a[row][col], x[col], m), m);
    x[row] = divQ(value, a[row][row], m);
  }
  return x;
}
function exactDependency(system, W, p, meter) {
  const rExact = solveExact(W.map((i) => W.map((j) => system.gram(i, j))), W.map((i) => system.gram(i, p)), meter);
  for (let k = 0; k < system.D.length; k++) {
    let projection = checked(ZERO, meter);
    for (let j = 0; j < W.length; j++) projection = addQ(projection, mulQ(system.A[W[j]][k], rExact[j], meter), meter);
    if (subQ(system.A[p][k], projection, meter).n !== 0n) return { dependent: false, rExact: [], r: [] };
  }
  return { dependent: true, rExact };
}
function dependencyNumbers(rExact, meter) {
  return rExact.map((x) => toNumber(x, meter));
}
function verifyWeights(system, weights, meter) {
  if (weights.length !== system.b.length || weights.some((w) => w.n < 0n)) return null;
  let sum = checked(ZERO, meter);
  for (const w of weights) sum = addQ(sum, w, meter);
  if (sum.n !== sum.d) return null;
  const dynamicDot = [];
  for (let k = 0; k < system.D.length; k++) {
    let dot4 = checked(ZERO, meter);
    for (let i = 0; i < weights.length; i++) dot4 = addQ(dot4, mulQ(system.A[i][k], weights[i], meter), meter);
    if (dot4.n !== 0n) return null;
    dynamicDot.push(text(dot4));
  }
  let boundDot = checked(ZERO, meter);
  for (let i = 0; i < weights.length; i++) boundDot = addQ(boundDot, mulQ(system.b[i], weights[i], meter), meter);
  if (boundDot.n <= 0n) return null;
  return { weights: weights.map(text), sumWeights: "1/1", dynamicDot, boundDotM: text(boundDot) };
}
function makeInfeasibilityCertificate(system, W, p, rExact, meter) {
  const weights = Array(system.b.length).fill(ZERO);
  weights[p] = checked(ONE, meter);
  for (let j = 0; j < W.length; j++) weights[W[j]] = negQ(rExact[j], meter);
  if (weights.some((w) => w.n < 0n)) unsafe("uncertified-infeasibility");
  let sum = checked(ZERO, meter);
  for (const w of weights) sum = addQ(sum, w, meter);
  if (sum.n <= 0n) unsafe("uncertified-infeasibility");
  const normalized = weights.map((w) => divQ(w, sum, meter)), proof = verifyWeights(system, normalized, meter);
  if (proof === null) unsafe("uncertified-infeasibility");
  return proof;
}
function parseCanonical(value, meter) {
  if (typeof value !== "string" || value.length > 4937 || !/^(?:0|-?[1-9][0-9]*)\/[1-9][0-9]*$/.test(value)) return null;
  const [ns, ds] = value.split("/");
  if (ns.replace("-", "").length > 2467 || ds.length > 2467) return null;
  meter.take("exactIntegerOperations");
  const n = BigInt(ns);
  meter.bits(n, true);
  meter.take("exactIntegerOperations");
  const d = BigInt(ds);
  meter.bits(d, true);
  const q = rational(n, d, meter);
  return text(q) === value ? q : null;
}
function verifyInfeasibilityCertificate(problem, certificate, meter = createMeter()) {
  const model = prepareModel(problem), system = makeExactSystem(model, meter), weights = [];
  for (const value of certificate.weights) {
    const q = parseCanonical(value, meter);
    if (q === null) return false;
    weights.push(q);
  }
  const checkedProof = verifyWeights(system, weights, meter);
  if (checkedProof === null) return false;
  return certificate.sumWeights === "1/1" && certificate.boundDotM === checkedProof.boundDotM && certificate.dynamicDot.length === checkedProof.dynamicDot.length && certificate.dynamicDot.every((x, i) => x === checkedProof.dynamicDot[i]);
}

// examples/physics-rigid-full-pair-position-world/full-pair-core.mjs
var copySafe = (s) => ({ uDynamic: [...s.u], lambdaKgM: [...s.lambda], pendingRow: s.pending, pendingLambdaKgM: s.pending === null ? 0 : s.lambda[s.pending], basisRows: [...s.W] });
function ieeeState(s) {
  const view = new DataView(new ArrayBuffer(8));
  const encode = (x) => {
    view.setFloat64(0, x, false);
    return view.getBigUint64(0, false).toString(16);
  };
  return s.W.join(",") + "|" + String(s.pending) + "|" + s.u.map(encode).join(",") + "|" + s.lambda.map(encode).join(",");
}
function context(state, meter) {
  return { iteration: meter.counters.iterations, enteringRow: state.pending, basisBefore: [...state.W], basisAfter: [...state.W], blocker: null, stepKgM: null, schurInverseKg: null, condition: null, exactDependent: null };
}
function traceEntry(ctx, action, state) {
  return { ...ctx, basisBefore: [...ctx.basisBefore], basisAfter: [...state.W], action };
}
function runFullPairCore(rawProblem, limits = DEFAULT_LIMITS) {
  const problem = validateFullPairProblem(rawProblem), meter = createMeter(limits), model = prepareModel(problem), n = problem.rows.length;
  let state = { u: Array(model.dynamicDof).fill(0), lambda: Array(n).fill(0), W: [], pending: null }, ctx = context(state, meter), exact = null;
  const trace = [], seen = /* @__PURE__ */ new Set();
  const getExact = () => exact ?? (exact = makeExactSystem(model, meter));
  const common = () => ({ basisRows: [...state.W], basisRank: state.W.length, dynamicDof: model.dynamicDof, counters: { ...meter.counters }, trace: trace.map((x) => ({ ...x, basisBefore: [...x.basisBefore], basisAfter: [...x.basisAfter] })), lastSafeIterate: copySafe(state), worldStepped: false });
  const refused = (status, reason, proof = null) => ({ ok: false, status, ...common(), translations: null, lambdaKgM: null, primalMarginsM: null, objectiveKgM2: null, certificate: null, infeasibilityCertificate: proof, reason });
  try {
    for (let i = 0; i < n; i++) {
      meter.take("constraintTests");
      if (model.A[i].every((x) => x === 0) && model.b[i] > 0) {
        const proof = makeInfeasibilityCertificate(getExact(), [], i, [], meter);
        ctx.exactDependent = true;
        trace.push(traceEntry(ctx, "infeasible", state));
        return refused("INFEASIBLE", null, proof);
      }
    }
    while (true) {
      if (state.pending === null) {
        ctx = context(state, meter);
        const allMargins = margins(model, state.u, meter);
        if (state.W.some((i) => Math.abs(allMargins[i]) > EPS)) unsafe("iterate-certificate");
        const p2 = allMargins.findIndex((v, i) => v < -EPS && !state.W.includes(i));
        if (p2 < 0) {
          const u2 = reconstruct(model, state.lambda), checked2 = fullCertificate(model, u2, state.lambda, meter), bodyTranslations = translations(model, u2);
          if (Object.values(checked2.certificate).some((v) => !Number.isFinite(v) || v > EPS) || checked2.objectiveKgM2 < 0) unsafe("result-certificate");
          if (bodyTranslations.some((t) => Math.hypot(...t.u) > 10)) unsafe("translation-bound");
          state = { ...state, u: u2 };
          return { ok: true, status: "SOLVED", ...common(), translations: bodyTranslations, lambdaKgM: [...state.lambda], primalMarginsM: [...checked2.primalMarginsM], objectiveKgM2: checked2.objectiveKgM2, certificate: { ...checked2.certificate }, infeasibilityCertificate: null, reason: null };
        }
        state = { ...state, pending: p2 };
      }
      ctx = context(state, meter);
      meter.take("iterations");
      ctx.iteration = meter.counters.iterations;
      const key = ieeeState(state);
      if (seen.has(key)) throw new CoreStop("WORK_LIMIT", "cycle");
      seen.add(key);
      const p = state.pending, W = state.W, solved = solveBasis(W.map((i) => W.map((j) => model.G[i][j])), W.map((i) => model.G[i][p]), meter);
      ctx.condition = solved.condition;
      let r = solved.r;
      const projected = direction(model, W, p, r, meter);
      ctx.schurInverseKg = projected.delta;
      let dependent = false;
      if (projected.near) {
        meter.take("rankChecks");
        const relation = exactDependency(getExact(), W, p, meter);
        ctx.exactDependent = relation.dependent;
        if (!relation.dependent) unsafe("near-dependent-independent");
        dependent = true;
        if (!relation.rExact.some((x) => x.n > 0n)) {
          const proof = makeInfeasibilityCertificate(getExact(), W, p, relation.rExact, meter);
          trace.push(traceEntry(ctx, "infeasible", state));
          return refused("INFEASIBLE", null, proof);
        }
        r = dependencyNumbers(relation.rExact, meter);
      }
      let dualStep = Infinity, blocker = null;
      for (let j = 0; j < W.length; j++) if (r[j] > 0) {
        const step2 = finite2(state.lambda[W[j]] / r[j]);
        if (step2 < 0) unsafe("negative-step");
        if (step2 < dualStep || step2 === dualStep && (blocker === null || W[j] < blocker)) {
          dualStep = step2;
          blocker = W[j];
        }
      }
      let primalStep = Infinity;
      if (!dependent) {
        meter.take("constraintTests");
        const deficit = finite2(model.b[p] - dot2(model.A[p], state.u));
        primalStep = finite2(deficit / projected.delta);
        if (primalStep < 0) unsafe("negative-step");
      }
      const drop = dualStep <= primalStep, step = drop ? dualStep : primalStep;
      if (!Number.isFinite(step)) unsafe("uncertified-infeasibility");
      ctx.stepKgM = step;
      ctx.blocker = drop ? blocker : null;
      if (drop && blocker === null) unsafe("uncertified-infeasibility");
      const lambda = [...state.lambda];
      for (let j = 0; j < W.length; j++) lambda[W[j]] = finite2(lambda[W[j]] - finite2(step * r[j]));
      lambda[p] = finite2(lambda[p] + step);
      if (drop) lambda[blocker] = 0;
      const nextW = drop ? W.filter((i) => i !== blocker) : [...W, p].sort((a, b) => a - b), pending = drop ? p : null, u = reconstruct(model, lambda);
      checkIterate(model, u, lambda, nextW, pending, meter);
      meter.take("activeChanges");
      state = { u, lambda, W: nextW, pending };
      trace.push(traceEntry(ctx, drop ? dependent ? "dependent-drop" : "drop" : "add", state));
    }
  } catch (error3) {
    if (!(error3 instanceof CoreStop)) throw error3;
    ctx.iteration = meter.counters.iterations;
    trace.push(traceEntry(ctx, error3.status === "WORK_LIMIT" ? "work-limit" : "unsafe", state));
    return refused(error3.status, error3.reason);
  }
}

// examples/physics-rigid-full-pair-position-world/full-pair-solver.mjs
var RESULT_KEYS = ["ok", "status", "basisRows", "basisRank", "dynamicDof", "counters", "trace", "lastSafeIterate", "translations", "lambdaKgM", "primalMarginsM", "objectiveKgM2", "certificate", "infeasibilityCertificate", "reason", "worldStepped"];
var CERT_KEYS = ["primalViolationM", "negativeMultiplierKgM", "complementarityKgM2", "stationarityKgM"];
var TRACE_KEYS = ["iteration", "enteringRow", "basisBefore", "basisAfter", "action", "blocker", "stepKgM", "schurInverseKg", "condition", "exactDependent"];
var UNSAFE_REASONS = ["nonfinite", "negative-step", "negative-multiplier", "pivot", "condition", "factor-residual", "direction-residual", "near-dependent-independent", "dependent-basis", "dependency-conversion", "uncertified-infeasibility", "iterate-certificate", "result-certificate", "translation-bound"];
var WORK_REASONS = [...Object.keys(DEFAULT_LIMITS).map((k) => "budget:" + k), "cycle"];
var fail = (condition) => requireFull(condition, "result", "NUMERIC_LIMIT");
var finiteNumber = (x) => typeof x === "number" && Number.isFinite(x);
var integer = (x) => Number.isSafeInteger(x) && x >= 0;
var sameVector = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
function checkedArithmetic(fn) {
  try {
    return fn();
  } catch (error3) {
    if (error3 instanceof CoreStop) requireFull(false, "result", "NUMERIC_LIMIT");
    throw error3;
  }
}
function indices(raw, n, d) {
  const a = dataArray(raw);
  fail(a !== null && a.length <= d && a.every((v, i) => integer(v) && v < n && (i === 0 || v > a[i - 1])));
  return a;
}
function numberVector(raw, size) {
  const a = dataFiniteVector(raw, size);
  fail(a !== null);
  return a;
}
function indexOrNull(value, n) {
  fail(value === null || integer(value) && value < n);
  return value;
}
function checkedCounters(raw, d, n) {
  const c = dataRecord(raw, COUNTER_KEYS);
  fail(c !== null && COUNTER_KEYS.every((k) => integer(c[k])));
  for (const k of ["iterations", "activeChanges", "rankChecks", "linearSolves", "constraintTests", "exactIntegerOperations"]) fail(c[k] <= DEFAULT_LIMITS[k]);
  fail(c.exactPeakBits <= DEFAULT_LIMITS.intermediateIntegerBits && c.activeChanges <= c.iterations && c.rankChecks <= 2 * c.iterations && c.linearSolves <= 2 * c.iterations);
  fail(c.factorizations <= c.linearSolves && c.blockRightHandSides >= c.factorizations && c.blockRightHandSides <= (Math.min(d, n) + 1) * c.factorizations);
  if (n === 0) fail(["iterations", "activeChanges", "rankChecks", "linearSolves", "constraintTests", "factorizations", "blockRightHandSides", "exactIntegerOperations", "exactPeakBits"].every((k) => c[k] === 0));
  return { ...c };
}
function checkedTrace(raw, n, d, counters, basisRows) {
  const entries = dataArray(raw);
  fail(entries !== null && entries.length <= counters.iterations + 1);
  const trace = [];
  let previous = [], iteration = 0, changes = 0;
  for (const rawEntry of entries) {
    const e = dataRecord(rawEntry, TRACE_KEYS);
    fail(e !== null && integer(e.iteration) && e.iteration >= iteration && e.iteration <= counters.iterations);
    const before = indices(e.basisBefore, n, d), after = indices(e.basisAfter, n, d);
    fail(sameVector(before, previous));
    const enteringRow = indexOrNull(e.enteringRow, n), blocker = indexOrNull(e.blocker, n);
    fail(["add", "drop", "dependent-drop", "infeasible", "unsafe", "work-limit"].includes(e.action) && (e.exactDependent === null || typeof e.exactDependent === "boolean"));
    fail(e.stepKgM === null || finiteNumber(e.stepKgM) && e.stepKgM >= 0);
    fail(e.schurInverseKg === null || finiteNumber(e.schurInverseKg));
    fail(e.condition === null || finiteNumber(e.condition) && e.condition >= 0);
    if (e.action === "add") {
      fail(e.iteration > 0 && enteringRow !== null && !before.includes(enteringRow) && blocker === null && e.stepKgM !== null && e.exactDependent !== true);
      fail(sameVector(after, [...before, enteringRow].sort((a, b) => a - b)));
      changes++;
    } else if (e.action === "drop" || e.action === "dependent-drop") {
      fail(e.iteration > 0 && enteringRow !== null && !before.includes(enteringRow) && blocker !== null && before.includes(blocker) && e.stepKgM !== null);
      fail((e.action === "dependent-drop" ? e.exactDependent === true : e.exactDependent !== true) && sameVector(after, before.filter((i) => i !== blocker)));
      changes++;
    } else fail(sameVector(before, after));
    trace.push({ ...e, basisBefore: [...before], basisAfter: [...after] });
    previous = after;
    iteration = e.iteration;
  }
  fail(changes === counters.activeChanges && sameVector(previous, basisRows));
  return trace;
}
function checkedSafe(raw, model, basisRows) {
  const s = dataRecord(raw, ["uDynamic", "lambdaKgM", "pendingRow", "pendingLambdaKgM", "basisRows"]);
  fail(s !== null);
  const u = numberVector(s.uDynamic, model.dynamicDof), lambda = numberVector(s.lambdaKgM, model.A.length), basis3 = indices(s.basisRows, model.A.length, model.dynamicDof), pending = indexOrNull(s.pendingRow, model.A.length);
  fail(sameVector(basis3, basisRows) && finiteNumber(s.pendingLambdaKgM) && s.pendingLambdaKgM >= 0 && lambda.every((v) => v >= 0));
  fail(pending === null ? s.pendingLambdaKgM === 0 : !basis3.includes(pending) && Object.is(s.pendingLambdaKgM, lambda[pending]));
  const expected = checkedArithmetic(() => reconstruct(model, lambda));
  fail(u.every((v, k) => Math.abs(v - expected[k]) <= EPS));
  checkedArithmetic(() => checkIterate(model, u, lambda, basis3, pending, createMeter()));
  return { uDynamic: [...u], lambdaKgM: [...lambda], pendingRow: pending, pendingLambdaKgM: s.pendingLambdaKgM, basisRows: [...basis3] };
}
function checkedInfeasibility(problem, model, raw) {
  const proof = dataRecord(raw, ["weights", "sumWeights", "dynamicDot", "boundDotM"]);
  fail(proof !== null);
  const weights = dataArray(proof.weights, problem.rows.length), dynamicDot = dataArray(proof.dynamicDot, model.dynamicDof);
  fail(weights !== null && weights.every((v) => typeof v === "string") && dynamicDot !== null && dynamicDot.every((v) => v === "0/1") && proof.sumWeights === "1/1" && typeof proof.boundDotM === "string");
  const copied = { weights: [...weights], sumWeights: "1/1", dynamicDot: [...dynamicDot], boundDotM: proof.boundDotM };
  fail(checkedArithmetic(() => verifyInfeasibilityCertificate(problem, copied, createMeter())));
  return copied;
}
function validateFullPairResult(rawProblem, rawResult) {
  const problem = validateFullPairProblem(rawProblem);
  try {
    const model = checkedArithmetic(() => prepareModel(problem)), r = dataRecord(rawResult, RESULT_KEYS);
    fail(r !== null);
    fail(typeof r.ok === "boolean" && ["SOLVED", "INFEASIBLE", "NUMERIC_UNSAFE", "WORK_LIMIT"].includes(r.status) && r.worldStepped === false);
    const basisRows = indices(r.basisRows, problem.rows.length, model.dynamicDof);
    fail(integer(r.basisRank) && r.basisRank === basisRows.length && r.dynamicDof === model.dynamicDof);
    const counters = checkedCounters(r.counters, model.dynamicDof, problem.rows.length), trace = checkedTrace(r.trace, problem.rows.length, model.dynamicDof, counters, basisRows), lastSafeIterate = checkedSafe(r.lastSafeIterate, model, basisRows);
    const common = { basisRows: [...basisRows], basisRank: basisRows.length, dynamicDof: model.dynamicDof, counters, trace, lastSafeIterate, worldStepped: false };
    if (r.status === "SOLVED") {
      fail(r.ok === true && r.reason === null && r.infeasibilityCertificate === null && lastSafeIterate.pendingRow === null);
      const ts = dataArray(r.translations, problem.bodies.length);
      fail(ts !== null);
      const translations2 = [];
      for (let i = 0; i < ts.length; i++) {
        const t = dataRecord(ts[i], ["id", "u"]);
        fail(t !== null && t.id === problem.bodies[i].id);
        const u2 = numberVector(t.u, 3);
        fail(Math.hypot(...u2) <= 10);
        if (problem.bodies[i].inverseMass === 0) fail(u2.every((v) => Object.is(v, 0)));
        translations2.push({ id: t.id, u: [...u2] });
      }
      const lambdaKgM = numberVector(r.lambdaKgM, problem.rows.length), primalMarginsM = numberVector(r.primalMarginsM, problem.rows.length), certificate = dataRecord(r.certificate, CERT_KEYS);
      fail(certificate !== null && CERT_KEYS.every((k) => finiteNumber(certificate[k]) && certificate[k] >= 0 && certificate[k] <= EPS) && finiteNumber(r.objectiveKgM2) && r.objectiveKgM2 >= 0);
      fail(sameVector(lambdaKgM, lastSafeIterate.lambdaKgM));
      const u = translations2.flatMap((t, i) => model.offsets[i] === null ? [] : t.u);
      fail(sameVector(u, lastSafeIterate.uDynamic));
      const actual = checkedArithmetic(() => fullCertificate(model, u, lambdaKgM, createMeter()));
      fail(actual.primalMarginsM.every((v, i) => v >= -EPS && Math.abs(v - primalMarginsM[i]) <= EPS) && Math.abs(actual.objectiveKgM2 - r.objectiveKgM2) <= EPS);
      fail(CERT_KEYS.every((k) => actual.certificate[k] <= EPS && Math.abs(actual.certificate[k] - certificate[k]) <= EPS));
      return { ok: true, status: "SOLVED", ...common, translations: translations2, lambdaKgM: [...lambdaKgM], primalMarginsM: [...primalMarginsM], objectiveKgM2: r.objectiveKgM2, certificate: { ...certificate }, infeasibilityCertificate: null, reason: null };
    }
    fail(r.ok === false && ["translations", "lambdaKgM", "primalMarginsM", "objectiveKgM2", "certificate"].every((k) => r[k] === null));
    let infeasibilityCertificate = null;
    if (r.status === "INFEASIBLE") {
      fail(r.reason === null);
      infeasibilityCertificate = checkedInfeasibility(problem, model, r.infeasibilityCertificate);
    } else {
      fail(r.infeasibilityCertificate === null);
      fail((r.status === "NUMERIC_UNSAFE" ? UNSAFE_REASONS : WORK_REASONS).includes(r.reason));
    }
    return { ok: false, status: r.status, ...common, translations: null, lambdaKgM: null, primalMarginsM: null, objectiveKgM2: null, certificate: null, infeasibilityCertificate, reason: r.reason };
  } catch (error3) {
    throw error3;
  }
}
function solveFullPairPosition(problem) {
  return validateFullPairResult(problem, runFullPairCore(problem, DEFAULT_LIMITS));
}

// examples/physics-rigid-signed-separation-reference/signed-sat.ts
var FEATURE_INPUT_MESSAGE2 = "signed position reference requires admitted raw boxes";
var AXIS_MESSAGE = "signed position reference requires a fresh supported pre-SAT axis";
var DIAGNOSTIC_TIE_TOLERANCE_M2 = 1e-12;
function denseFinite(value, size, bound) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === size && Reflect.ownKeys(value).length === size + 1 && Array.from({ length: size }, (_, i) => i).every((i) => Object.hasOwn(value, i) && typeof value[i] === "number" && Number.isFinite(value[i]) && Math.abs(value[i]) <= bound);
}
function admittedRawBox(body) {
  return body !== null && typeof body === "object" && typeof body.id === "string" && ID.test(body.id) && (body.kind === "dynamic" || body.kind === "static") && body.shape?.kind === "box" && denseFinite(body.shape.halfExtentsM, 3, 1e3) && body.shape.halfExtentsM.every((v) => v >= 1e-4) && denseFinite(body.positionM, 3, 1e4) && denseFinite(body.velocityMps, 3, 1e3) && denseFinite(body.angularVelocityRadps, 3, 1e3) && denseFinite(body.orientation, 4, 1) && Math.abs(Math.hypot(...body.orientation) - 1) <= 1e-9 && typeof body.inverseMass === "number" && Number.isFinite(body.inverseMass) && (body.kind === "static" ? body.inverseMass === 0 : body.inverseMass >= 1e-6 && body.inverseMass <= 1e6);
}
function boxAxes3(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport3(body, direction2) {
  const axes = boxAxes3(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction2);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
    return add(result, scale(axis, offset));
  }, [0, 0, 0]));
}
function featureAt2(candidateIndex) {
  if (candidateIndex < 3) return { kind: "face-a", axisA: candidateIndex };
  if (candidateIndex < 6) return { kind: "face-b", axisB: candidateIndex - 3 };
  const crossIndex = candidateIndex - 6;
  return { kind: "edge-cross", axisA: Math.floor(crossIndex / 3), axisB: crossIndex % 3 };
}
function featureLabel2(feature) {
  if (feature.kind === "face-a") return `A.face.${feature.axisA}`;
  if (feature.kind === "face-b") return `B.face.${feature.axisB}`;
  return `A.edge.${feature.axisA}xB.edge.${feature.axisB}`;
}
function inspectSignedBoxSAT(a, b) {
  if (!admittedRawBox(a) || !admittedRawBox(b)) {
    error("INVALID_CONFIG", FEATURE_INPUT_MESSAGE2);
  }
  const axesA = boxAxes3(a), axesB = boxAxes3(b);
  const extentA = a.shape.halfExtentsM, extentB = b.shape.halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis = [1, 0, 0], bestOverlap = Infinity;
  let bestCandidateIndex = 0, bestRawLength = 0;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross(axisA, axisB)))];
  const diagnostics = [];
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const length = Math.hypot(...candidate);
    const feature2 = featureAt2(candidateIndex);
    const diagnostic = {
      candidateIndex,
      label: featureLabel2(feature2),
      feature: feature2,
      rawAxisLength: length,
      skippedByOriginalCutoff: length < 1e-12,
      signedDistanceM: null,
      overlapM: null,
      axis: null,
      orientedNormal: null,
      radiusAM: null,
      radiusBM: null
    };
    diagnostics.push(diagnostic);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis3, index) => sum + extentA[index] * Math.abs(dot(basis3, axis)), 0);
    const radiusB = axesB.reduce((sum, basis3, index) => sum + extentB[index] * Math.abs(dot(basis3, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    diagnostic.signedDistanceM = signedDistance;
    diagnostic.overlapM = overlap;
    diagnostic.axis = [...axis];
    diagnostic.orientedNormal = scale(axis, signedDistance < 0 ? -1 : 1);
    diagnostic.radiusAM = radiusA;
    diagnostic.radiusBM = radiusB;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale(axis, signedDistance < 0 ? -1 : 1);
      bestCandidateIndex = candidateIndex;
      bestRawLength = length;
    }
  }
  if (!Number.isFinite(bestOverlap) || !Number.isFinite(bestRawLength) || bestRawLength < 1e-12) error("NUMERIC_LIMIT", AXIS_MESSAGE);
  const aPoint = boxSupport3(a, bestAxis);
  const bPoint = boxSupport3(b, scale(bestAxis, -1));
  const pointM = scale(add(aPoint, bPoint), 0.5);
  const feature = featureAt2(bestCandidateIndex);
  return {
    normal: [...bestAxis],
    boundM: bestOverlap,
    pointM: [...pointM],
    feature,
    label: featureLabel2(feature),
    candidateIndex: bestCandidateIndex,
    rawAxisLength: bestRawLength,
    candidates: diagnostics,
    ambiguity: {
      exactMinimumCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null && candidate.overlapM === bestOverlap).map((candidate) => candidate.candidateIndex),
      withinDiagnosticTieToleranceCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null && Math.abs(candidate.overlapM - bestOverlap) <= DIAGNOSTIC_TIE_TOLERANCE_M2).map((candidate) => candidate.candidateIndex),
      skippedCandidateIndices: diagnostics.filter((candidate) => candidate.skippedByOriginalCutoff).map((candidate) => candidate.candidateIndex),
      diagnosticTieToleranceM: DIAGNOSTIC_TIE_TOLERANCE_M2,
      uniquePhysicalFeatureClaimed: false
    }
  };
}

// examples/physics-rigid-full-pair-position-world/full-pair-rows.ts
var FULL_PAIR_ERRORS = {
  INPUT: "private full-pair position input is invalid",
  PROFILE: "private full-pair position profile is unsupported",
  RANGE: "private full-pair position signed bound exceeds the admitted range",
  GEOMETRY: "private full-pair position requires fresh matching box geometry",
  INFEASIBLE: "private full-pair position constraints are infeasible",
  NUMERIC_UNSAFE: "private full-pair position solve is numerically unsafe",
  WORK_LIMIT: "private full-pair position solve exceeded its work limit",
  RESULT: "private full-pair position result is invalid",
  NONPENETRATION: "private full-pair position result left an overlapping pair"
};
function refuse(key) {
  throw new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS[key]);
}
function mapFullPairError(error3) {
  try {
    if (error3 instanceof FullPairPositionReferenceError) {
      if (error3.code === "PROFILE_LIMIT" && error3.message === MESSAGES.limit) {
        return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.PROFILE);
      }
      if (error3.code === "INVALID_INPUT" && [
        MESSAGES.input,
        MESSAGES.empty,
        MESSAGES.ids,
        MESSAGES.mass,
        MESSAGES.endpoints,
        MESSAGES.normal,
        MESSAGES.bound,
        MESSAGES.workLimits
      ].includes(error3.message)) {
        return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.INPUT);
      }
      if (error3.code === "NUMERIC_LIMIT" && error3.message === MESSAGES.result) {
        return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.RESULT);
      }
    }
    if (error3 instanceof PhysicsError && (error3.code === "INVALID_CONFIG" && error3.message === FEATURE_INPUT_MESSAGE2 || error3.code === "NUMERIC_LIMIT" && error3.message === AXIS_MESSAGE)) {
      return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.GEOMETRY);
    }
  } catch {
  }
  return error3;
}
function ordinaryDense(value, size) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && (size === void 0 || value.length === size) && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => i).every((i) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, i);
    return descriptor !== void 0 && "value" in descriptor;
  });
}
function finiteVector(value, size, bound = Infinity) {
  return ordinaryDense(value, size) && value.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= bound);
}
function record2(value) {
  return value !== null && typeof value === "object";
}
function checkedFullPairInputs(bodies, pairs) {
  if (!ordinaryDense(bodies) || !ordinaryDense(pairs) || bodies.length === 0) refuse("INPUT");
  if (bodies.length > 9 || pairs.length > 36) refuse("PROFILE");
  const ids = /* @__PURE__ */ new Set();
  for (const body of bodies) {
    if (!record2(body) || typeof body.id !== "string" || !ID.test(body.id) || ids.has(body.id) || !finiteVector(body.positionM, 3) || !finiteVector(body.velocityMps, 3) || !finiteVector(body.orientation, 4) || !finiteVector(body.angularVelocityRadps, 3) || typeof body.inverseMass !== "number" || !Number.isFinite(body.inverseMass)) refuse("INPUT");
    ids.add(body.id);
    if (body.kind !== "dynamic" && body.kind !== "static" || body.shape?.kind !== "box" || body.sensor || body.ccd || body.collisionFilter || !finiteVector(body.shape.halfExtentsM, 3, 1e3) || body.shape.halfExtentsM.some((v) => v < 1e-4) || body.restitution !== 0 || !finiteVector(body.inverseInertiaLocal, 3) || body.inverseInertiaLocal.some((v) => v < 0) || (body.kind === "static" ? body.inverseMass !== 0 : body.inverseMass < 1e-6 || body.inverseMass > 1e6)) {
      refuse("PROFILE");
    }
  }
  validateResult(bodies, []);
  const expected = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      expected.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  expected.sort((l, r) => bodies[l[0]].id < bodies[r[0]].id ? -1 : bodies[l[0]].id > bodies[r[0]].id ? 1 : bodies[l[1]].id < bodies[r[1]].id ? -1 : 1);
  if (pairs.length !== expected.length || pairs.some((p, i) => !ordinaryDense(p, 2) || p[0] !== expected[i][0] || p[1] !== expected[i][1])) refuse("INPUT");
}
function pairKey(bodies, a, b) {
  return `${bodies[a].id}\0${bodies[b].id}`;
}
function compactSelection(full) {
  return {
    normal: [...full.normal],
    boundM: full.boundM,
    candidateIndex: full.candidateIndex,
    pointM: [...full.pointM],
    rawAxisLength: full.rawAxisLength,
    label: full.label,
    feature: { ...full.feature }
  };
}
function freshSelection(a, b) {
  return compactSelection(inspectSignedBoxSAT(a, b));
}
function buildFullPairProblem(bodies, pairs, capture) {
  checkedFullPairInputs(bodies, pairs);
  const result = capture ?? {
    problem: { bodies: bodies.map((b) => ({ id: b.id, inverseMass: b.inverseMass })), rows: [] },
    rowSources: [],
    initialDetections: [],
    pairObservations: [],
    tests: 0,
    hits: 0,
    signedPreQueries: 0
  };
  for (const [aIndex, bIndex] of pairs) {
    const a = bodies[aIndex], b = bodies[bIndex], key = pairKey(bodies, aIndex, bIndex);
    result.tests++;
    const hit = detect(a, b);
    result.initialDetections.push({ pairKey: key, aIndex, bIndex, hit: hit ? structuredClone(hit) : null });
    if (hit !== null) result.hits++;
    result.signedPreQueries++;
    const selection = freshSelection(a, b);
    result.pairObservations.push({ pairKey: key, aIndex, bIndex, selection });
    if (hit !== null && (!hit.normal.every((v, d) => v === selection.normal[d]) || Math.max(0, selection.boundM) !== hit.penetration)) refuse("GEOMETRY");
    result.rowSources.push({
      rowIndex: result.problem.rows.length,
      pairKey: key,
      aIndex,
      bIndex,
      selection: structuredClone(selection)
    });
    result.problem.rows.push({
      aId: a.id,
      bId: b.id,
      normal: [...selection.normal],
      boundM: selection.boundM
    });
  }
  if (result.pairObservations.some((p) => p.selection.boundM < -10 || p.selection.boundM > 10)) refuse("RANGE");
  return result;
}
function inspectFullPairHypothesis(bodies, pairs, capture = [], progress) {
  for (const [aIndex, bIndex] of pairs) {
    if (progress) progress.postPairTests++;
    capture.push({
      pairKey: pairKey(bodies, aIndex, bIndex),
      aIndex,
      bIndex,
      selection: freshSelection(bodies[aIndex], bodies[bIndex])
    });
  }
  return capture;
}

// examples/physics-rigid-full-pair-position-world/full-pair-apply.ts
function same(a, b) {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return Object.is(a, b);
  const ka = Reflect.ownKeys(a), kb = Reflect.ownKeys(b);
  return ka.length === kb.length && ka.every((k) => kb.includes(k) && same(Reflect.get(a, k), Reflect.get(b, k)));
}
function vector2(value, size) {
  return ordinaryDense(value, size) && value.every((x) => typeof x === "number" && Number.isFinite(x));
}
function applyFullPairTranslationsOnce(preBodies, problem, result) {
  try {
    const checked2 = validateFullPairResult(problem, result);
    if (checked2.status !== "SOLVED" || checked2.ok !== true || !ordinaryDense(preBodies) || preBodies.length < 1 || preBodies.length > 9 || problem.bodies.length !== preBodies.length) refuse("RESULT");
    for (let i = 0; i < preBodies.length; i++) {
      const body = preBodies[i];
      if (!body || body.id !== problem.bodies[i].id || body.inverseMass !== problem.bodies[i].inverseMass || !vector2(body.positionM, 3) || !vector2(body.velocityMps, 3) || !vector2(body.orientation, 4) || !vector2(body.angularVelocityRadps, 3)) refuse("RESULT");
    }
    validateResult(preBodies, []);
    const bodies = preBodies.map(copyBody), rounding = [];
    for (let i = 0; i < preBodies.length; i++) {
      const before = preBodies[i], body = bodies[i], u = checked2.translations[i].u;
      if (Math.hypot(...u) > 10 || before.inverseMass === 0 && !u.every((v) => v === 0)) refuse("RESULT");
      const roundedFinalM = before.inverseMass === 0 ? [...before.positionM] : before.positionM.map((v, j) => v + u[j]);
      if (!roundedFinalM.every(Number.isFinite)) refuse("RESULT");
      body.positionM = roundedFinalM;
      const actualDeltaM = body.positionM.map((v, j) => v - before.positionM[j]);
      if (before.inverseMass === 0 && (!u.every((v) => v === 0) || !same(body, before))) refuse("RESULT");
      if (!same({ ...body, positionM: before.positionM }, before)) refuse("RESULT");
      rounding.push({
        id: body.id,
        nominalTranslationM: [...u],
        roundedFinalM: [...roundedFinalM],
        actualDeltaM,
        nominalActualDeltaDifferenceM: actualDeltaM.map((v, j) => v - u[j]),
        exactRoundedFinalMatch: true,
        staticPositionAdditionPerformed: false,
        dynamicPositionAdditionPerformed: before.inverseMass > 0
      });
    }
    validateResult(bodies, []);
    return {
      bodies: bodies.map(copyBody),
      rounding: structuredClone(rounding),
      applications: 1,
      worldCreated: false,
      worldStepped: false
    };
  } catch (error3) {
    throw mapFullPairError(error3);
  }
}

// examples/physics-rigid-full-pair-position-world/full-pair-phase.ts
function zeroFullPairPositionStats() {
  return {
    tests: 0,
    hits: 0,
    rows: 0,
    signedPreQueries: 0,
    solverCalls: 0,
    postPairTests: 0,
    maxTranslationM: 0,
    workingApplicationCount: 0,
    solverCounters: {
      iterations: 0,
      activeChanges: 0,
      rankChecks: 0,
      linearSolves: 0,
      constraintTests: 0,
      factorizations: 0,
      blockRightHandSides: 0,
      exactIntegerOperations: 0,
      exactPeakBits: 0
    },
    certificate: null
  };
}
function errorRecord(error3) {
  let result = {
    kind: "unexpected-error",
    name: "ThrownValue",
    message: "Unexpected non-Error exception"
  };
  try {
    if (error3 instanceof Error) result = { kind: "unexpected-error", name: error3.name, message: error3.message };
    if (error3 instanceof PhysicsError) {
      result = { kind: "typed-refusal", name: error3.name, code: error3.code, message: error3.message };
    }
  } catch {
  }
  return result;
}
function runFullPairPositionPhase(workingBodies, sortedPairs, options = {}) {
  const stats = zeroFullPairPositionStats();
  const attempt = {
    preBodies: [],
    pairs: [],
    initialDetections: [],
    pairObservations: [],
    problem: null,
    rowSources: [],
    result: null,
    hypotheticalBodies: null,
    rounding: null,
    finalPairObservations: [],
    failurePair: null,
    workingApplicationCount: 0,
    error: null
  };
  const capture = {
    problem: { bodies: [], rows: [] },
    rowSources: attempt.rowSources,
    initialDetections: attempt.initialDetections,
    pairObservations: attempt.pairObservations,
    tests: 0,
    hits: 0,
    signedPreQueries: 0
  };
  const updatePreStats = () => {
    stats.tests = capture.tests;
    stats.hits = capture.hits;
    stats.rows = capture.problem.rows.length;
    stats.signedPreQueries = capture.signedPreQueries;
  };
  try {
    checkedFullPairInputs(workingBodies, sortedPairs);
    attempt.preBodies = workingBodies.map(copyBody);
    attempt.pairs = sortedPairs.map(([a, b]) => [a, b]);
    capture.problem.bodies = attempt.preBodies.map((b) => ({ id: b.id, inverseMass: b.inverseMass }));
    attempt.problem = capture.problem;
    buildFullPairProblem(attempt.preBodies, attempt.pairs, capture);
    updatePreStats();
    const problem = validateFullPairProblem(capture.problem);
    stats.solverCalls++;
    const raw = (options.solve ?? solveFullPairPosition)(structuredClone(problem));
    const checked2 = validateFullPairResult(problem, raw);
    attempt.result = checked2;
    stats.solverCounters = structuredClone(checked2.counters);
    if (checked2.status === "INFEASIBLE") refuse("INFEASIBLE");
    if (checked2.status === "NUMERIC_UNSAFE") refuse("NUMERIC_UNSAFE");
    if (checked2.status === "WORK_LIMIT") refuse("WORK_LIMIT");
    if (checked2.status !== "SOLVED" || checked2.ok !== true) refuse("RESULT");
    stats.maxTranslationM = Math.max(0, ...checked2.translations.map((t) => Math.hypot(...t.u)));
    stats.certificate = structuredClone(checked2.certificate);
    const applied = applyFullPairTranslationsOnce(attempt.preBodies, problem, checked2);
    attempt.hypotheticalBodies = applied.bodies;
    attempt.rounding = applied.rounding;
    inspectFullPairHypothesis(applied.bodies, attempt.pairs, attempt.finalPairObservations, stats);
    attempt.failurePair = attempt.finalPairObservations.find((p) => p.selection.boundM > 1e-12)?.pairKey ?? null;
    if (attempt.failurePair !== null) refuse("NONPENETRATION");
  } catch (caught) {
    updatePreStats();
    const error3 = mapFullPairError(caught);
    const record4 = errorRecord(error3);
    if (attempt.failurePair === null && record4.kind === "typed-refusal" && record4.code === "NUMERIC_LIMIT" && record4.message === FULL_PAIR_ERRORS.RANGE) {
      attempt.failurePair = attempt.pairObservations.find((p) => p.selection.boundM < -10 || p.selection.boundM > 10)?.pairKey ?? null;
    }
    attempt.error = record4;
    options.observeAttempt?.(structuredClone(attempt));
    throw error3;
  }
  options.observeAttempt?.(structuredClone(attempt));
  for (let i = 0; i < workingBodies.length; i++) if (workingBodies[i].inverseMass > 0) {
    workingBodies[i].positionM = [...attempt.hypotheticalBodies[i].positionM];
  }
  attempt.workingApplicationCount = 1;
  stats.workingApplicationCount = 1;
  return { stats: structuredClone(stats), attempt: structuredClone(attempt) };
}

// examples/physics-rigid-full-pair-position-world/global-island.ts
var GLOBAL_CONTACT_SWEEPS = 64;
var GLOBAL_PHASE_MESSAGE = "private global contact island phase order is invalid";
function copyImpulse(impulse) {
  return { normalNs: impulse.normalNs, tangentNs: [...impulse.tangentNs] };
}
var FrozenContactIsland = class _FrozenContactIsland {
  #bodies;
  #pairs;
  #prior;
  #patches = [];
  #pointsMap = /* @__PURE__ */ new Map();
  #pairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
  #globalStats = _FrozenContactIsland.zeroStats();
  #warmStats = emptyWarmCacheStats();
  #positionStats = zeroFullPairPositionStats();
  #attempt = null;
  #pointLedger = [];
  #options;
  #phase = "assembled";
  static zeroStats() {
    return {
      assemblyTests: 0,
      patches: 0,
      facePatches: 0,
      edgePatches: 0,
      points: 0,
      globalSweeps: 0,
      pointUpdates: 0,
      positionSweeps: 0,
      positionTests: 0,
      positionHits: 0
    };
  }
  constructor(nextBodies, sortedPairs, prior, options = {}) {
    this.#options = { ...options };
    this.#bodies = nextBodies.slice();
    this.#pairs = sortedPairs.map(([a, b]) => [a, b]);
    this.#prior = new Map([...prior].map(([key, impulse]) => [key, copyImpulse(impulse)]));
    for (const [aIndex, bIndex] of this.#pairs) {
      this.#globalStats.assemblyTests++;
      this.#pairStats.eligiblePairs++;
      this.#pairStats.candidatePairs++;
      const a = this.#bodies[aIndex], b = this.#bodies[bIndex];
      const hit = detect(a, b);
      if (!hit) continue;
      if (hit.penetration > MAX_STEP_DISPLACEMENT_M) {
        error("NUMERIC_LIMIT", "contact penetration exceeded limit");
      }
      const actual = adaptContactGeometry(a, b);
      if (!actual) error("NUMERIC_LIMIT", FEATURE_WITNESS_MESSAGE);
      const patch = {
        aIndex,
        bIndex,
        aId: a.id,
        bId: b.id,
        pairKey: `${a.id}\0${b.id}`,
        family: actual.family,
        normal: actual.normal,
        satNormalAtoB: actual.satNormalAtoB,
        penetrationM: hit.penetration,
        points: actual.points,
        meanPointM: actual.meanPointM
      };
      this.#patches.push(patch);
      this.#globalStats.patches++;
      if (patch.family === "face") this.#globalStats.facePatches++;
      else this.#globalStats.edgePatches++;
      this.#globalStats.points += patch.points.length;
    }
  }
  /** Initialize every point, warm every eligible patch, then solve globally. */
  solve() {
    this.#requirePhase("assembled");
    const warmRows = [];
    for (const patch of this.#patches) {
      const compatible = compatiblePatch(this.#prior, patch.pairKey, patch.points, patch.family);
      this.#warmStats.testedPatches++;
      if (compatible) this.#warmStats.compatiblePatches++;
      else this.#warmStats.incompatiblePatches++;
      for (const point2 of patch.points) {
        const key = `${patch.pairKey}\0${point2.id}`;
        const prior = compatible ? this.#prior.get(key) : void 0;
        const impulse = prior ? copyImpulse(prior) : { normalNs: 0, tangentNs: [0, 0, 0] };
        this.#pointsMap.set(key, impulse);
        this.#pointLedger.push({
          aId: patch.aId,
          bId: patch.bId,
          aIndex: patch.aIndex,
          bIndex: patch.bIndex,
          pairKey: patch.pairKey,
          pointId: point2.id,
          family: patch.family,
          pointM: [...point2.pointM],
          normal: [...patch.normal],
          aPositionM: [...this.#bodies[patch.aIndex].positionM],
          bPositionM: [...this.#bodies[patch.bIndex].positionM],
          warm: copyImpulse(impulse),
          final: copyImpulse(impulse)
        });
        if (prior) {
          this.#warmStats.reusedPoints++;
          warmRows.push({ patch, point: point2, impulse });
        } else {
          this.#warmStats.coldPoints++;
        }
      }
    }
    for (const { patch, point: point2, impulse } of warmRows) {
      warmStartPoint(
        this.#bodies[patch.aIndex],
        this.#bodies[patch.bIndex],
        point2.pointM,
        patch.normal,
        impulse
      );
    }
    for (let sweep = 0; sweep < GLOBAL_CONTACT_SWEEPS; sweep++) {
      this.#globalStats.globalSweeps++;
      for (const patch of this.#patches) {
        const order = sweep % 2 ? [...patch.points].reverse() : patch.points;
        for (const point2 of order) {
          const impulse = this.#pointsMap.get(`${patch.pairKey}\0${point2.id}`);
          solvePersistentPoint(
            this.#bodies[patch.aIndex],
            this.#bodies[patch.bIndex],
            point2.pointM,
            patch.normal,
            impulse
          );
          this.#globalStats.pointUpdates++;
        }
      }
    }
    for (const point2 of this.#pointLedger) {
      point2.final = copyImpulse(this.#pointsMap.get(`${point2.pairKey}\0${point2.pointId}`));
    }
    this.#phase = "solved";
  }
  /** Fresh geometry for position-only correction; no new velocity/cache rows. */
  projectPositions() {
    this.#requirePhase("solved");
    const result = runFullPairPositionPhase(this.#bodies, this.#pairs, this.#options);
    this.#positionStats = result.stats;
    this.#attempt = result.attempt;
    this.#globalStats.positionSweeps = 1;
    this.#globalStats.positionTests = result.stats.tests;
    this.#globalStats.positionHits = result.stats.hits;
    this.#phase = "projected";
  }
  getFullPairPositionStats() {
    return structuredClone(this.#positionStats);
  }
  getFullPairPositionAttempt() {
    return structuredClone(this.#attempt);
  }
  /** Net step J uses final accumulators, including the warm impulse applied once. */
  getPointLedger() {
    this.#requirePhase("solved");
    return structuredClone(this.#pointLedger);
  }
  getGlobalStats() {
    return { ...this.#globalStats };
  }
  getWarmCacheStats() {
    return { ...this.#warmStats };
  }
  /** Assembly geometry and final accumulated impulses, not final force data. */
  result() {
    this.#requirePhase("projected");
    const contacts = this.#patches.map((patch) => {
      let impulseNs = 0;
      let tangentImpulseNs = [0, 0, 0];
      for (const point2 of patch.points) {
        const impulse = this.#pointsMap.get(`${patch.pairKey}\0${point2.id}`);
        impulseNs += impulse.normalNs;
        tangentImpulseNs = add(tangentImpulseNs, impulse.tangentNs);
      }
      return {
        aId: patch.aId,
        bId: patch.bId,
        normalAtoB: [...patch.normal],
        pointM: [...patch.meanPointM],
        penetrationM: patch.penetrationM,
        impulseNs,
        tangentImpulseNs
      };
    });
    return {
      contacts,
      pointsMap: new Map([...this.#pointsMap].map(([key, impulse]) => [key, copyImpulse(impulse)])),
      pairStats: { ...this.#pairStats },
      globalStats: this.getGlobalStats(),
      warmCacheStats: this.getWarmCacheStats()
    };
  }
  #requirePhase(expected) {
    if (this.#phase !== expected) error("NUMERIC_LIMIT", GLOBAL_PHASE_MESSAGE);
  }
};

// packages/barocss-physics/dist/dynamic-hinge-joint.js
var magnitude = (vector4) => Math.hypot(...vector4);
var near = (a, b) => magnitude(sub(a, b)) <= 1e-9;
function offsetFixture(joint, a, b) {
  return near(a.positionM, [-0.1, 0, 0]) && near(b.positionM, [0.1, 0, 0]) && near(joint.anchorALocalM, [0.1, 0, 0]) && near(joint.anchorBLocalM, [-0.1, 0, 0]) && near(joint.axisWorld, [0, 0, 1]) && Math.abs(joint.limitRad[0] + 0.8) <= 1e-9 && Math.abs(joint.limitRad[1] - 0.8) <= 1e-9 && a.inverseMass === 1 && b.inverseMass === 1 && a.shape.kind === "sphere" && b.shape.kind === "sphere" && a.shape.radiusM === 0.1 && b.shape.radiusM === 0.1 && joint.motor?.targetSpeedRadps === 0.5 && joint.motor.maxImpulseNms === 1e-4 && joint.motor.maxReactionNms === 0.01;
}
function admitDynamicHingeScene(joint, bodies, gravity) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity = [0, 0, 0, 1];
  const centred = near(a.positionM, b.positionM) && magnitude(joint.anchorALocalM) === 0 && magnitude(joint.anchorBLocalM) === 0;
  if (magnitude(gravity) !== 0 || !centred && !offsetFixture(joint, a, b) || [a, b].some((body) => magnitude(body.velocityMps) !== 0 || magnitude(body.angularVelocityRadps) !== 0 || body.orientation.some((value, index) => Math.abs(value - identity[index]) > 1e-12))) {
    error("INVALID_CONFIG", "dynamic hinge needs an admitted resting pair and zero gravity");
  }
}
function admitDynamicHingeCommands(joint, bodies, actions) {
  const axis = joint.axisWorld;
  for (const bodyIndex of [joint.aIndex, joint.bIndex]) {
    const action = actions.get(bodies[bodyIndex].id);
    if (!action)
      continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector4) => vector4 !== void 0).some((vector4) => magnitude(sub(vector4, scale(axis, dot(vector4, axis)))) > 1e-12)) {
      error("INVALID_COMMAND", "dynamic hinge admits axis-aligned angular commands only");
    }
  }
}

// packages/barocss-physics/dist/joints.js
function denseJointVector(value, bound, label) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error("INVALID_CONFIG", `${label} must be a dense 3-vector`);
  }
  return vector(value, -bound, bound, label);
}
function parseJoints(value, bodies) {
  if (!Array.isArray(value) || value.length > 8 || Reflect.ownKeys(value).length !== value.length + 1 || !Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(Boolean)) {
    error("INVALID_CONFIG", "joints must be a dense array of at most 8");
  }
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seenIds = /* @__PURE__ */ new Set(), seenDynamic = /* @__PURE__ */ new Set();
  const joints = value.map((raw) => {
    const input = record(raw, "joint");
    if (input.kind !== "fixed" && input.kind !== "hinge")
      error("INVALID_CONFIG", "unsupported joint kind");
    fields(input, input.kind === "fixed" ? ["id", "kind", "aId", "bId", "anchorALocalM", "anchorBLocalM"] : ["id", "kind", "aId", "bId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"], "joint");
    if (typeof input.id !== "string" || !ID.test(input.id) || seenIds.has(input.id)) {
      error("INVALID_CONFIG", "joint IDs must be unique valid identifiers");
    }
    const a = typeof input.aId === "string" ? byId.get(input.aId) : void 0;
    const b = typeof input.bId === "string" ? byId.get(input.bId) : void 0;
    if (!a || !b || a.index === b.index || b.body.kind !== "dynamic" || seenDynamic.has(b.body.id)) {
      error("INVALID_CONFIG", "joint needs a distinct A and unique dynamic B");
    }
    if (a.body.kind === "dynamic" && (value.length !== 1 || bodies.length !== 2 || a.body.shape.kind !== "sphere" || b.body.shape.kind !== "sphere")) {
      error("INVALID_CONFIG", "dynamic pair supports one joint between two dynamic spheres");
    }
    const anchorALocalM = denseJointVector(input.anchorALocalM, 100, "anchorALocalM");
    const anchorBLocalM = denseJointVector(input.anchorBLocalM, 100, "anchorBLocalM");
    if (Math.hypot(...sub(worldPoint(a.body, anchorALocalM), worldPoint(b.body, anchorBLocalM))) > 1e-6) {
      error("INVALID_CONFIG", "initial joint anchors must coincide");
    }
    let axisWorld, limitRad;
    let motor;
    if (input.kind === "hinge") {
      axisWorld = denseJointVector(input.axisWorld, 1 + 1e-9, "axisWorld");
      if (Math.abs(Math.hypot(...axisWorld) - 1) > 1e-9)
        error("INVALID_CONFIG", "hinge axis must be unit length");
      const limits = input.limitRad;
      if (!Array.isArray(limits) || limits.length !== 2 || Reflect.ownKeys(limits).length !== 3 || ![0, 1].every((index) => Object.hasOwn(limits, index))) {
        error("INVALID_CONFIG", "hinge limits must be a dense pair");
      }
      const low = finite(limits[0], -Math.PI / 2, 0, "limitRad[0]");
      const high = finite(limits[1], 0, Math.PI / 2, "limitRad[1]");
      limitRad = [low, high];
      if (Object.hasOwn(input, "motor")) {
        const motorInput = record(input.motor, "motor");
        fields(motorInput, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
        const targetSpeedRadps = finite(motorInput.targetSpeedRadps, -2, 2, "motor.targetSpeedRadps");
        const maxImpulseNms = finite(motorInput.maxImpulseNms, 0, 0.05, "motor.maxImpulseNms");
        const maxReactionNms = finite(motorInput.maxReactionNms, 0, 1, "motor.maxReactionNms");
        if (maxImpulseNms === 0 || maxReactionNms === 0) {
          error("INVALID_CONFIG", "motor impulse and reaction limits must be positive");
        }
        motor = { targetSpeedRadps, maxImpulseNms, maxReactionNms };
      }
    }
    seenIds.add(input.id);
    seenDynamic.add(b.body.id);
    return {
      id: input.id,
      kind: input.kind,
      aIndex: a.index,
      bIndex: b.index,
      anchorALocalM,
      anchorBLocalM,
      referenceOrientation: input.kind === "fixed" ? multiplyQuaternion(inverse(a.body.orientation), b.body.orientation) : [...b.body.orientation],
      ...axisWorld ? { axisWorld } : {},
      ...limitRad ? { limitRad } : {},
      ...motor ? { motor } : {}
    };
  });
  return joints;
}

// packages/barocss-physics/dist/joint-motor.js
function driveHingeMotor(joint, body, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0)
    return 0;
  const inverseAxisInertia = dot(axis, inverseInertia(body, axis));
  const speed = dot(body.angularVelocityRadps, axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseAxisInertia;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  body.angularVelocityRadps = add(body.angularVelocityRadps, inverseInertia(body, scale(axis, impulse)));
  return impulse;
}
function driveDynamicHingeMotor(joint, a, b, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0)
    return 0;
  const inverseSum = dot(axis, inverseInertia(a, axis)) + dot(axis, inverseInertia(b, axis));
  const speed = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseSum;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  a.angularVelocityRadps = sub(a.angularVelocityRadps, inverseInertia(a, scale(axis, impulse)));
  b.angularVelocityRadps = add(b.angularVelocityRadps, inverseInertia(b, scale(axis, impulse)));
  return impulse;
}

// packages/barocss-physics/dist/ccd-slab.js
function sweepBox(start, end, halfExtents) {
  if (start.every((value, axis) => Math.abs(value) <= halfExtents[axis]))
    return null;
  const travel = sub(end, start);
  let entry = 0;
  let exit = 1;
  let normalLocal = null;
  for (let axis = 0; axis < 3; axis++) {
    const velocity = travel[axis];
    if (velocity === 0) {
      if (Math.abs(start[axis]) > halfExtents[axis])
        return null;
      continue;
    }
    const first = (-halfExtents[axis] - start[axis]) / velocity;
    const second = (halfExtents[axis] - start[axis]) / velocity;
    const near3 = Math.min(first, second);
    const far = Math.max(first, second);
    if (near3 > entry) {
      entry = near3;
      normalLocal = [0, 0, 0];
      normalLocal[axis] = velocity > 0 ? -1 : 1;
    }
    exit = Math.min(exit, far);
    if (entry > exit)
      return null;
  }
  return normalLocal && entry <= 1 && exit >= 0 ? { fraction: entry, normalLocal } : null;
}

// packages/barocss-physics/dist/ccd-box.js
var ANGULAR_TOLERANCE = 1e-12;
function axisAlignedBox(body) {
  return body.shape.kind === "box" && body.orientation.slice(0, 3).every((component) => Math.abs(component) <= ANGULAR_TOLERANCE) && Math.abs(body.orientation[3] - 1) <= ANGULAR_TOLERANCE && body.angularVelocityRadps.every((component) => Math.abs(component) <= ANGULAR_TOLERANCE);
}
function rejectAngularBoxCommand(action) {
  if (action?.torqueNm?.some((component) => component !== 0) || action?.angularImpulseNms?.some((component) => component !== 0)) {
    error("INVALID_COMMAND", "axis-aligned box CCD excludes angular commands");
  }
}
function sweepDynamicBox(previous, candidate, fixture) {
  if (!axisAlignedBox(previous) || !axisAlignedBox(candidate) || !axisAlignedBox(fixture)) {
    error("NUMERIC_LIMIT", "box CCD candidate rotated outside the admitted profile");
  }
  if (previous.shape.kind !== "box" || fixture.shape.kind !== "box")
    return null;
  const fixtureHalfExtents = fixture.shape.halfExtentsM;
  const expanded = previous.shape.halfExtentsM.map((extent, axis) => extent + fixtureHalfExtents[axis]);
  const start = sub(previous.positionM, fixture.positionM);
  const end = sub(candidate.positionM, fixture.positionM);
  const hit = sweepBox(start, end, expanded);
  if (!hit)
    return null;
  const travel = sub(candidate.positionM, previous.positionM);
  candidate.positionM = sub(add(previous.positionM, scale(travel, hit.fraction)), scale(hit.normalLocal, 1e-9));
  return {
    bodyId: previous.id,
    fixtureId: fixture.id,
    toiFraction: hit.fraction,
    normalFixtureToBody: hit.normalLocal
  };
}

// packages/barocss-physics/dist/ccd.js
function admitCcd(bodies, jointCount, gravity) {
  const selected = bodies.filter((body) => body.ccd);
  if (selected.length === 0)
    return { kind: "none" };
  const sphereIndex = bodies.findIndex((body) => body.ccd);
  if (selected.length === 1 && bodies.length === 2 && jointCount === 0 && gravity.every((component) => component === 0) && bodies.every((body) => body.kind === "dynamic" && body.shape.kind === "sphere" && !body.sensor)) {
    return { kind: "sphere-pair", sphereIndex, otherIndex: 1 - sphereIndex };
  }
  if (selected.length === 1 && selected[0].shape.kind === "box" && bodies.length === 2 && jointCount === 0) {
    const fixtureIndex = 1 - sphereIndex;
    if (bodies[sphereIndex].kind === "dynamic" && bodies[fixtureIndex].kind === "static" && !bodies[fixtureIndex].sensor && axisAlignedBox(bodies[sphereIndex]) && axisAlignedBox(bodies[fixtureIndex])) {
      return { kind: "box-pair", boxIndex: sphereIndex, fixtureIndex };
    }
  }
  const fixtures = bodies.filter((body) => body.kind === "static" && !body.sensor && body.shape.kind === "box");
  if (selected.length !== 1 || bodies.length !== fixtures.length + 1 || bodies.filter((body) => body.kind === "dynamic").length !== 1 || fixtures.length < 1 || fixtures.length > 8 || jointCount !== 0) {
    error("INVALID_CONFIG", "unsupported CCD body pair or world profile");
  }
  if (selected[0].shape.kind !== "sphere") {
    error("INVALID_CONFIG", "static-box CCD requires a dynamic sphere");
  }
  return {
    kind: "static-boxes",
    sphereIndex,
    fixtures: fixtures.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  };
}
function sweepSphere(previous, candidate, fixtures) {
  if (previous.shape.kind !== "sphere")
    return null;
  const radius = previous.shape.radiusM;
  const travel = sub(candidate.positionM, previous.positionM);
  let earliest = null;
  for (const fixture of fixtures) {
    if (fixture.shape.kind !== "box")
      continue;
    const expanded = fixture.shape.halfExtentsM.map((extent) => extent + radius);
    const hit = sweepBox(localPoint(fixture, previous.positionM), localPoint(fixture, candidate.positionM), expanded);
    if (!hit || earliest && hit.fraction >= earliest.toiFraction)
      continue;
    earliest = {
      bodyId: previous.id,
      fixtureId: fixture.id,
      toiFraction: hit.fraction,
      normalFixtureToBody: rotate(fixture.orientation, hit.normalLocal)
    };
  }
  if (earliest) {
    candidate.positionM = sub(add(previous.positionM, scale(travel, earliest.toiFraction)), scale(earliest.normalFixtureToBody, 1e-9));
  }
  return earliest;
}

// packages/barocss-physics/dist/ccd-pair.js
function sweepSpherePair(markedStart, markedEnd, otherStart, otherEnd) {
  if (markedStart.shape.kind !== "sphere" || otherStart.shape.kind !== "sphere")
    return null;
  const radius = markedStart.shape.radiusM + otherStart.shape.radiusM;
  const relativeStart = sub(markedStart.positionM, otherStart.positionM);
  const distanceSquared = dot(relativeStart, relativeStart);
  if (distanceSquared <= radius * radius)
    return null;
  const markedTravel = sub(markedEnd.positionM, markedStart.positionM);
  const otherTravel = sub(otherEnd.positionM, otherStart.positionM);
  const relativeTravel = sub(markedTravel, otherTravel);
  const a = dot(relativeTravel, relativeTravel);
  if (a === 0)
    return null;
  const b = 2 * dot(relativeStart, relativeTravel);
  if (b >= 0)
    return null;
  const discriminant = b * b - 4 * a * (distanceSquared - radius * radius);
  if (!Number.isFinite(discriminant))
    error("NUMERIC_LIMIT", "unsafe sphere-pair sweep");
  if (discriminant < 0)
    return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    return null;
  const markedAtHit = add(markedStart.positionM, scale(markedTravel, fraction));
  const otherAtHit = add(otherStart.positionM, scale(otherTravel, fraction));
  const separation = sub(markedAtHit, otherAtHit);
  const length = Math.hypot(...separation);
  if (!(length > 0) || !Number.isFinite(length))
    error("NUMERIC_LIMIT", "unsafe sphere-pair normal");
  const normalFixtureToBody = scale(separation, 1 / length);
  markedEnd.positionM = sub(markedAtHit, scale(normalFixtureToBody, 5e-10));
  otherEnd.positionM = add(otherAtHit, scale(normalFixtureToBody, 5e-10));
  return {
    bodyId: markedStart.id,
    fixtureId: otherStart.id,
    toiFraction: fraction,
    normalFixtureToBody
  };
}

// packages/barocss-physics/dist/scene-profile.js
function filterAllowsPair(a, b) {
  const left = a.collisionFilter;
  const right = b.collisionFilter;
  if (!left || !right)
    return true;
  return (left.maskBits & right.categoryBits) !== 0 && (right.maskBits & left.categoryBits) !== 0;
}

// packages/barocss-physics/dist/sleep.js
var REST_STEPS = 60;
var LINEAR_REST_MPS = 0.02;
var ANGULAR_REST_RADPS = 0.02;
function nonzero(value) {
  return value?.some((component) => component !== 0) ?? false;
}
function wakeForActions(bodies, previousContacts, actions, sleepFrames) {
  const indexById = new Map(bodies.map((body, index) => [body.id, index]));
  const neighbors = bodies.map(() => []);
  for (const contact of previousContacts) {
    const a = indexById.get(contact.aId);
    const b = indexById.get(contact.bId);
    if (bodies[a].kind === "dynamic" && bodies[b].kind === "dynamic") {
      neighbors[a].push(b);
      neighbors[b].push(a);
    }
  }
  const queue = [];
  for (let index = 0; index < bodies.length; index++) {
    const body = bodies[index];
    const action = actions.get(body.id);
    if (body.kind === "dynamic" && (nonzero(action?.forceN) || nonzero(action?.impulseNs) || nonzero(action?.torqueNm) || nonzero(action?.angularImpulseNms)))
      queue.push(index);
    if (body.kind === "kinematic" && action?.positionM && action.positionM.some((value, axis) => value !== body.positionM[axis])) {
      for (const contact of previousContacts) {
        const otherId = contact.aId === body.id ? contact.bId : contact.bId === body.id ? contact.aId : null;
        const other = otherId ? indexById.get(otherId) : void 0;
        if (other !== void 0 && bodies[other].kind === "dynamic")
          queue.push(other);
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (seen.has(index))
      continue;
    seen.add(index);
    bodies[index].sleeping = false;
    sleepFrames[index] = 0;
    for (const other of neighbors[index])
      if (!seen.has(other))
        queue.push(other);
  }
}
function updateSleeping(bodies, contacts, sleepFrames) {
  const indexById = new Map(bodies.map((body, index) => [body.id, index]));
  const neighbors = bodies.map(() => []);
  const supported = bodies.map(() => false);
  const movingFixture = bodies.map(() => false);
  for (const contact of contacts) {
    const a = indexById.get(contact.aId);
    const b = indexById.get(contact.bId);
    const left = bodies[a], right = bodies[b];
    if (left.kind === "dynamic" && right.kind === "dynamic") {
      neighbors[a].push(b);
      neighbors[b].push(a);
    } else if (left.kind === "dynamic" || right.kind === "dynamic") {
      const dynamic = left.kind === "dynamic" ? a : b;
      const fixture = left.kind === "dynamic" ? right : left;
      supported[dynamic] = true;
      movingFixture[dynamic] ||= fixture.kind === "kinematic" && Math.hypot(...fixture.velocityMps) > 0;
    }
  }
  const visited = /* @__PURE__ */ new Set();
  for (let index = 0; index < bodies.length; index++) {
    if (bodies[index].kind !== "dynamic" || visited.has(index))
      continue;
    const island = [index];
    visited.add(index);
    for (let cursor = 0; cursor < island.length; cursor++) {
      for (const other of neighbors[island[cursor]])
        if (!visited.has(other)) {
          visited.add(other);
          island.push(other);
        }
    }
    const asleep = island.filter((member) => bodies[member].sleeping).length;
    if (!island.some((member) => supported[member]) || island.some((member) => movingFixture[member]) || asleep > 0 && asleep < island.length) {
      for (const member of island) {
        bodies[member].sleeping = false;
        sleepFrames[member] = 0;
      }
      continue;
    }
    if (asleep === island.length)
      continue;
    const atRest = island.every((member) => Math.hypot(...bodies[member].velocityMps) <= LINEAR_REST_MPS && Math.hypot(...bodies[member].angularVelocityRadps) <= ANGULAR_REST_RADPS);
    for (const member of island)
      sleepFrames[member] = atRest ? sleepFrames[member] + 1 : 0;
    if (island.every((member) => sleepFrames[member] >= REST_STEPS)) {
      for (const member of island) {
        bodies[member].sleeping = true;
        bodies[member].velocityMps = [0, 0, 0];
        bodies[member].angularVelocityRadps = [0, 0, 0];
      }
    }
  }
}

// examples/physics-rigid-full-pair-position-world/reference-world.ts
function publicState(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt) {
  return {
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor, ccd, collisionFilter: collisionFilter3, sleeping }) => ({
      id,
      kind,
      shape: copyShape(collider),
      positionM: [...positionM],
      velocityMps: [...velocityMps],
      orientation: [...orientation],
      angularVelocityRadps: [...angularVelocityRadps],
      ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
      ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2: [...inertiaDiagonalKgM2] },
      ...sensor ? { sensor: true } : {},
      ...ccd ? { ccd: true } : {},
      ...collisionFilter3 ? { collisionFilter: { ...collisionFilter3 } } : {},
      ...sleeping !== void 0 ? { sleeping } : {}
    })),
    contacts: contacts.map(({ aId, bId, normalAtoB, pointM, penetrationM, impulseNs, tangentImpulseNs }) => ({
      aId,
      bId,
      normalAtoB: [...normalAtoB],
      pointM: [...pointM],
      penetrationM,
      impulseNs,
      tangentImpulseNs: [...tangentImpulseNs]
    })),
    events: events.map((event) => ({ ...event })),
    joints: joints.map((joint) => ({
      ...joint,
      linearImpulseNs: [...joint.linearImpulseNs],
      angularImpulseNms: [...joint.angularImpulseNms]
    })),
    ccdHits: ccdHits.map((hit) => ({ ...hit, normalFixtureToBody: [...hit.normalFixtureToBody] })),
    pairStats: { ...pairStats }
  };
}
function createPhysicsWorld(config, privateOptions = {}) {
  const options = { ...privateOptions };
  const input = record(config, "world");
  fields(input, ["fixedStepSeconds", "gravityMps2", "bodies", "joints", "broadPhase", "contactMode", "sceneMode"], "world");
  if (Object.hasOwn(input, "sceneMode") && input.sceneMode !== "large-v1") {
    error("INVALID_CONFIG", "sceneMode must be large-v1 when present");
  }
  if (Object.hasOwn(input, "broadPhase") && input.broadPhase !== "aabb") {
    error("INVALID_CONFIG", "broadPhase must be aabb when present");
  }
  if (Object.hasOwn(input, "contactMode") && input.contactMode !== "persistent-box-v1") {
    error("INVALID_CONFIG", "contactMode must be persistent-box-v1 when present");
  }
  const useAabb = input.broadPhase === "aabb";
  const usePersistentBox = input.contactMode === "persistent-box-v1";
  const largeMode = input.sceneMode === "large-v1";
  if (largeMode && (!useAabb || usePersistentBox || Object.hasOwn(input, "joints"))) {
    error("INVALID_CONFIG", "large-v1 requires aabb and excludes joints and persistent-box-v1");
  }
  const dt = finite(input.fixedStepSeconds, 1 / 240, 1 / 30, "fixedStepSeconds");
  const gravity = vector(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const bodyLimit = largeMode ? MAX_LARGE_BODIES : MAX_BODIES;
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > bodyLimit) {
    error("INVALID_CONFIG", `bodies must contain 1..${bodyLimit} entries`);
  }
  if (usePersistentBox && input.bodies.length > 9) {
    error("INVALID_CONFIG", "private feature contact reference admits at most nine bodies");
  }
  let bodies = input.bodies.map((value) => parseBody(value, largeMode));
  if (largeMode && bodies.some((body) => body.ccd)) {
    error("INVALID_CONFIG", "large-v1 excludes CCD");
  }
  if (!bodies.some((body) => body.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error("INVALID_CONFIG", "duplicate body ID");
  if (!usePersistentBox || Object.hasOwn(input, "joints") || Object.hasOwn(input, "sceneMode") || Object.hasOwn(input, "broadPhase") || bodies.some((body) => body.shape.kind !== "box" || body.kind === "kinematic" || body.sensor || body.ccd || body.collisionFilter)) {
    error("INVALID_CONFIG", "private feature contact reference requires persistent boxes and excludes joints, sceneMode, broadPhase, kinematic, sensor, CCD and filters");
  }
  if (bodies.some((body) => body.restitution !== 0)) {
    error("INVALID_CONFIG", "private global contact reference requires zero restitution");
  }
  const joints = parseJoints(Object.hasOwn(input, "joints") ? input.joints : [], bodies);
  const dynamicHinge = joints.find((joint) => joint.kind === "hinge" && bodies[joint.aIndex].kind === "dynamic");
  if (dynamicHinge) admitDynamicHingeScene(dynamicHinge, bodies, gravity);
  const ccd = admitCcd(bodies, joints.length, gravity);
  if (ccd.kind === "box-pair" && usePersistentBox) {
    error("INVALID_CONFIG", "box CCD excludes persistent-box-v1");
  }
  const disabledPairs = new Set(joints.map((joint) => [bodies[joint.aIndex].id, bodies[joint.bIndex].id].sort().join("\0")));
  const pairs = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if ((bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) && (!largeMode || filterAllowsPair(bodies[a], bodies[b]))) {
      if (disabledPairs.has([bodies[a].id, bodies[b].id].sort().join("\0"))) continue;
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 : bodies[left[0]].id > bodies[right[0]].id ? 1 : bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  let contacts = [];
  let events = [];
  let ccdHits = [];
  let pairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
  let jointStates = joints.map((joint) => ({
    id: joint.id,
    kind: joint.kind,
    aId: bodies[joint.aIndex].id,
    bId: bodies[joint.bIndex].id,
    linearImpulseNs: [0, 0, 0],
    angularImpulseNms: [0, 0, 0],
    ...joint.kind === "hinge" ? { angleRad: 0 } : {},
    ...joint.motor ? { motorImpulseNms: 0 } : {}
  }));
  let activePairs = /* @__PURE__ */ new Map();
  let persistentPoints = /* @__PURE__ */ new Map();
  let sleepFrames = bodies.map(() => 0);
  let globalStats = FrozenContactIsland.zeroStats();
  let warmCacheStats = emptyWarmCacheStats();
  let positionStats = zeroFullPairPositionStats();
  let positionAttempt = null;
  let stepLedger = null;
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => {
    if (disposed) error("DISPOSED", "world is disposed");
  };
  return {
    getGlobalContactStats() {
      ensureActive();
      return { ...globalStats };
    },
    getWarmCacheStats() {
      ensureActive();
      return { ...warmCacheStats };
    },
    getFullPairPositionStats() {
      ensureActive();
      return structuredClone(positionStats);
    },
    getFullPairPositionAttempt() {
      ensureActive();
      return structuredClone(positionAttempt);
    },
    getStepLedger() {
      ensureActive();
      return structuredClone(stepLedger);
    },
    getWarmCacheSnapshot() {
      ensureActive();
      return [...persistentPoints].map(([key, p]) => [key, { normalNs: p.normalNs, tangentNs: [...p.tangentNs] }]);
    },
    getState() {
      ensureActive();
      return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error("INVALID_STEP", "step must equal configured fixedStepSeconds");
      if (stepIndex >= MAX_STEPS) error("WORLD_LIMIT", "world step limit reached");
      const actions = parseCommands(commands, bodies);
      if (dynamicHinge) admitDynamicHingeCommands(dynamicHinge, bodies, actions);
      if (ccd.kind === "box-pair") rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
      const beforeBodies = bodies.map(copyBody);
      const next = bodies.map(copyBody);
      const motorImpulses = joints.map(() => 0);
      const nextSleepFrames = sleepFrames.slice();
      if (largeMode) wakeForActions(next, contacts, actions, nextSleepFrames);
      for (const body of next) {
        if (body.kind !== "dynamic" || largeMode && body.sleeping) continue;
        const action = actions.get(body.id);
        body.angularVelocityRadps = add(
          body.angularVelocityRadps,
          inverseInertia(body, add(
            action?.angularImpulseNms ?? [0, 0, 0],
            scale(action?.torqueNm ?? [0, 0, 0], dt)
          ))
        );
      }
      for (let index = 0; index < joints.length; index++) {
        const joint = joints[index];
        if (!joint.motor) continue;
        motorImpulses[index] = next[joint.aIndex].kind === "dynamic" ? driveDynamicHingeMotor(
          joint,
          next[joint.aIndex],
          next[joint.bIndex],
          jointStates[index].angleRad
        ) : driveHingeMotor(joint, next[joint.bIndex], jointStates[index].angleRad);
      }
      for (let bodyIndex = 0; bodyIndex < next.length; bodyIndex++) {
        const body = next[bodyIndex];
        const action = actions.get(body.id);
        if (body.kind === "kinematic") {
          const target = action?.positionM ?? body.positionM;
          const delta = target.map((value, index) => value - body.positionM[index]);
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M || delta.some((value) => Math.abs(value / dt) > 1e3)) {
            error("NUMERIC_LIMIT", `${body.id} exceeded kinematic movement limit`);
          }
          body.velocityMps = delta.map((value) => value / dt);
          body.positionM = [...target];
        } else if (body.kind === "dynamic") {
          if (largeMode && body.sleeping) continue;
          if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e3) || Math.hypot(...body.angularVelocityRadps) * dt > 10) {
            error("NUMERIC_LIMIT", `${body.id} exceeded angular movement limit`);
          }
          body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, dt);
          for (let i = 0; i < 3; i++) {
            body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
            body.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * dt;
          }
          if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M) {
            error("NUMERIC_LIMIT", `${body.id} exceeded step displacement limit`);
          }
          for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;
        }
      }
      const freeBodies = next.map(copyBody);
      const hit = ccd.kind === "static-boxes" ? sweepSphere(bodies[ccd.sphereIndex], next[ccd.sphereIndex], ccd.fixtures) : ccd.kind === "sphere-pair" ? sweepSpherePair(
        bodies[ccd.sphereIndex],
        next[ccd.sphereIndex],
        bodies[ccd.otherIndex],
        next[ccd.otherIndex]
      ) : ccd.kind === "box-pair" ? sweepDynamicBox(
        bodies[ccd.boxIndex],
        next[ccd.boxIndex],
        next[ccd.fixtureIndex]
      ) : null;
      const nextCcdHits = hit ? [hit] : [];
      const ledgerBase = {
        beforeBodies,
        freeBodies,
        fixedStepSeconds: dt,
        gravityMps2: [...gravity],
        actions: structuredClone([...actions])
      };
      const observeStep = (stage, velocity, final, points) => {
        if (!options.observeStepAttempt) return;
        const attempt = {
          stage,
          ledger: { ...ledgerBase, velocityBodies: velocity, finalBodies: final, points }
        };
        options.observeStepAttempt(structuredClone(attempt));
      };
      observeStep("free-ready", null, null, null);
      const island = new FrozenContactIsland(next, pairs, persistentPoints, options);
      island.solve();
      const velocityBodies = next.map(copyBody);
      const pointLedger = island.getPointLedger();
      observeStep("velocity-ready", velocityBodies, null, pointLedger);
      island.projectPositions();
      const {
        contacts: nextContacts,
        pointsMap: nextPersistentPoints,
        pairStats: nextPairStats,
        globalStats: nextGlobalStats,
        warmCacheStats: nextWarmCacheStats
      } = island.result();
      const nextPositionStats = island.getFullPairPositionStats();
      const nextPositionAttempt = island.getFullPairPositionAttempt();
      const sensed = /* @__PURE__ */ new Map();
      const nextJoints = jointStates.map((joint) => ({
        ...joint,
        linearImpulseNs: [0, 0, 0],
        angularImpulseNms: [0, 0, 0]
      }));
      if (largeMode) updateSleeping(next, nextContacts, nextSleepFrames);
      const nextActive = new Map(sensed);
      for (const contact of nextContacts) {
        nextActive.set(
          `${contact.aId}\0${contact.bId}`,
          { aId: contact.aId, bId: contact.bId, kind: "contact" }
        );
      }
      const nextEvents = [.../* @__PURE__ */ new Set([...activePairs.keys(), ...nextActive.keys()])].sort().map((key) => {
        const current = nextActive.get(key);
        const previous = activePairs.get(key);
        return { ...current ?? previous, phase: current ? previous ? "stay" : "begin" : "end" };
      });
      const finalBodies = next.map(copyBody);
      observeStep("closure-ready", velocityBodies, finalBodies, pointLedger);
      for (let index = 0; index < next.length; index++) {
        if (next[index].kind !== "dynamic") continue;
        const movement = Math.hypot(...next[index].positionM.map((x, axis) => x - bodies[index].positionM[axis]));
        if (!Number.isFinite(movement) || movement > MAX_STEP_DISPLACEMENT_M) error("NUMERIC_LIMIT", FULL_PAIR_ERRORS.RESULT);
      }
      validateResult(next, nextContacts);
      if (ccd.kind === "box-pair" && !axisAlignedBox(next[ccd.boxIndex])) {
        error("NUMERIC_LIMIT", "box CCD contact rotated outside the admitted profile");
      }
      if (nextJoints.some((joint) => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some((value) => !Number.isFinite(value)) || joint.angleRad !== void 0 && !Number.isFinite(joint.angleRad))) {
        error("NUMERIC_LIMIT", "unsafe joint reaction");
      }
      for (let index = 0; index < joints.length; index++) {
        const motor = joints[index].motor;
        if (motor && Math.hypot(...nextJoints[index].angularImpulseNms) > motor.maxReactionNms) {
          error("NUMERIC_LIMIT", `${joints[index].id} exceeded motor reaction limit`);
        }
      }
      const nextStepLedger = {
        ...ledgerBase,
        velocityBodies,
        finalBodies,
        points: pointLedger
      };
      globalStats = nextGlobalStats;
      warmCacheStats = nextWarmCacheStats;
      positionStats = nextPositionStats;
      positionAttempt = nextPositionAttempt;
      stepLedger = nextStepLedger;
      bodies = next;
      contacts = nextContacts;
      events = nextEvents;
      jointStates = nextJoints;
      ccdHits = nextCcdHits;
      pairStats = nextPairStats;
      activePairs = nextActive;
      persistentPoints = nextPersistentPoints;
      sleepFrames = nextSleepFrames;
      stepIndex++;
      return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    overlapSphere(input2) {
      ensureActive();
      const query = queryRecord(input2, ["centerM", "radiusM"], ["includeSensors"]);
      const center = queryVector(query.centerM, 1e4, "centerM");
      const radius = queryNumber(query.radiusM, 1e-4, 1e3, "radiusM");
      const sensors = includeSensors(query);
      return bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body)).map((body) => body.id).sort();
    },
    raycast(input2) {
      ensureActive();
      const query = queryRecord(input2, ["originM", "direction", "maxDistanceM"], ["includeSensors"]);
      const origin = queryVector(query.originM, 1e4, "originM");
      const direction2 = queryVector(query.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction2) - 1) > 1e-9) {
        error("INVALID_QUERY", "direction must be a unit 3-vector");
      }
      const limit = queryNumber(query.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
      const sensors = includeSensors(query);
      let best = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction2, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId) {
          best = { bodyId: body.id, distanceM: distance };
        }
      }
      return best;
    },
    dispose() {
      disposed = true;
      bodies = [];
      contacts = [];
      events = [];
      ccdHits = [];
      activePairs.clear();
      persistentPoints.clear();
      sleepFrames = [];
      positionAttempt = null;
      stepLedger = null;
    }
  };
}

// packages/barocss-physics/dist/index.js
var ID2 = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_BODIES2 = 32;
var MAX_LARGE_BODIES2 = 64;
var MAX_STEPS2 = 3600;
var MAX_STEP_DISPLACEMENT_M2 = 10;
var MAX_COMMANDS2 = 64;
var MAX_FORCE_N2 = 1e6;
var MAX_IMPULSE_NS2 = 1e5;
var MAX_TORQUE_NM2 = 1e6;
var MAX_ANGULAR_IMPULSE_NMS2 = 1e5;
var SOLVER_PASSES2 = 8;
function error2(code, message) {
  throw new PhysicsError(code, message);
}
function record3(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) error2("INVALID_CONFIG", `${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) error2("INVALID_CONFIG", `${label} must be a plain object`);
  return value;
}
function fields2(value, allowed, label) {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.includes(key))) {
    error2("INVALID_CONFIG", `${label} has an unsupported field`);
  }
}
function finite3(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    error2("INVALID_CONFIG", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function vector3(value, min, max, label) {
  if (!Array.isArray(value) || value.length !== 3) error2("INVALID_CONFIG", `${label} must be a 3-vector`);
  return [0, 1, 2].map((index) => finite3(value[index], min, max, `${label}[${index}]`));
}
function angularVector2(value) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error2("INVALID_CONFIG", "angularVelocityRadps must be a dense 3-vector");
  }
  return vector3(value, -1e3, 1e3, "angularVelocityRadps");
}
function quaternion2(value) {
  if (!Array.isArray(value) || value.length !== 4 || Reflect.ownKeys(value).length !== 5 || ![0, 1, 2, 3].every((index) => Object.hasOwn(value, index))) {
    error2("INVALID_CONFIG", "orientation must be a dense [x,y,z,w] quaternion");
  }
  const values = value.map((component) => finite3(component, -1, 1, "orientation"));
  const magnitude22 = Math.hypot(...values);
  if (Math.abs(magnitude22 - 1) > 1e-6) error2("INVALID_CONFIG", "orientation must have unit norm");
  return values.map((component) => component / magnitude22);
}
function shape2(value) {
  const input = record3(value, "shape");
  if (input.kind === "sphere") {
    fields2(input, ["kind", "radiusM"], "sphere");
    return { kind: "sphere", radiusM: finite3(input.radiusM, 1e-4, 1e3, "radiusM") };
  }
  if (input.kind === "box") {
    fields2(input, ["kind", "halfExtentsM"], "box");
    return { kind: "box", halfExtentsM: vector3(input.halfExtentsM, 1e-4, 1e3, "halfExtentsM") };
  }
  if (input.kind === "capsule") {
    fields2(input, ["kind", "radiusM", "halfLengthM"], "capsule");
    return {
      kind: "capsule",
      radiusM: finite3(input.radiusM, 1e-4, 1e3, "radiusM"),
      halfLengthM: finite3(input.halfLengthM, 1e-4, 1e3, "halfLengthM")
    };
  }
  return error2("INVALID_CONFIG", "unsupported collider shape");
}
function friction2(value) {
  const input = record3(value, "friction");
  fields2(input, ["static", "dynamic"], "friction");
  const staticCoefficient = finite3(input.static, 0, 2, "friction.static");
  const dynamicCoefficient = finite3(input.dynamic, 0, staticCoefficient, "friction.dynamic");
  return { static: staticCoefficient, dynamic: dynamicCoefficient };
}
function collisionFilter2(value) {
  const input = record3(value, "collisionFilter");
  fields2(input, ["categoryBits", "maskBits"], "collisionFilter");
  if (!Number.isInteger(input.categoryBits) || !Number.isInteger(input.maskBits)) {
    error2("INVALID_CONFIG", "collision filter bits must be integers");
  }
  return {
    categoryBits: finite3(input.categoryBits, 1, 65535, "categoryBits"),
    maskBits: finite3(input.maskBits, 0, 65535, "maskBits")
  };
}
function parseBody2(value, largeMode = false) {
  const input = record3(value, "body");
  if (typeof input.id !== "string" || !ID2.test(input.id)) error2("INVALID_CONFIG", "invalid body ID");
  if (input.kind !== "dynamic" && input.kind !== "static" && input.kind !== "kinematic") {
    error2("INVALID_CONFIG", "invalid body kind");
  }
  const kind = input.kind;
  fields2(input, kind === "dynamic" ? [
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
  if (Object.hasOwn(input, "sensor") && input.sensor !== true) error2("INVALID_CONFIG", "sensor must be true");
  const sensor = input.sensor === true;
  const parsedShape = shape2(input.shape);
  if (Object.hasOwn(input, "ccd") && (input.ccd !== true || parsedShape.kind !== "sphere" && parsedShape.kind !== "box")) {
    error2("INVALID_CONFIG", "ccd is supported for dynamic spheres or boxes only and must be true");
  }
  const positionM = vector3(input.positionM, -1e4, 1e4, "positionM");
  const restitution = finite3(input.restitution, 0, 1, "restitution");
  const material = Object.hasOwn(input, "friction") ? friction2(input.friction) : { static: 0, dynamic: 0 };
  const filter = largeMode ? Object.hasOwn(input, "collisionFilter") ? collisionFilter2(input.collisionFilter) : { categoryBits: 1, maskBits: 65535 } : void 0;
  const orientation = Object.hasOwn(input, "orientation") ? quaternion2(input.orientation) : [0, 0, 0, 1];
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
  const massKg = finite3(input.massKg, 1e-6, 1e6, "massKg");
  if (parsedShape.kind !== "sphere" && Object.hasOwn(input, "inertiaKgM2")) {
    error2("INVALID_CONFIG", "inertiaKgM2 override is supported for spheres only");
  }
  const inertiaKgM2 = parsedShape.kind === "sphere" ? Object.hasOwn(input, "inertiaKgM2") ? finite3(input.inertiaKgM2, 1e-12, 1e12, "inertiaKgM2") : 0.4 * massKg * parsedShape.radiusM ** 2 : void 0;
  const inertiaDiagonalKgM2 = parsedShape.kind === "box" ? [
    massKg / 3 * (parsedShape.halfExtentsM[1] ** 2 + parsedShape.halfExtentsM[2] ** 2),
    massKg / 3 * (parsedShape.halfExtentsM[0] ** 2 + parsedShape.halfExtentsM[2] ** 2),
    massKg / 3 * (parsedShape.halfExtentsM[0] ** 2 + parsedShape.halfExtentsM[1] ** 2)
  ] : parsedShape.kind === "capsule" ? Array(3).fill(0.4 * massKg * (parsedShape.radiusM + parsedShape.halfLengthM) ** 2) : void 0;
  const inertia22 = inertiaDiagonalKgM2 ?? [inertiaKgM2, inertiaKgM2, inertiaKgM2];
  return {
    id: input.id,
    kind,
    shape: parsedShape,
    positionM,
    sensor,
    ...filter ? { collisionFilter: filter, sleeping: false } : {},
    ...input.ccd === true ? { ccd: true } : {},
    velocityMps: vector3(input.velocityMps, -1e3, 1e3, "velocityMps"),
    orientation,
    angularVelocityRadps: Object.hasOwn(input, "angularVelocityRadps") ? angularVector2(input.angularVelocityRadps) : [0, 0, 0],
    ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
    ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2 },
    inverseInertiaLocal: inertia22.map((value2) => 1 / value2),
    inverseMass: 1 / massKg,
    restitution,
    frictionStatic: material.static,
    frictionDynamic: material.dynamic
  };
}
function copyShape2(value) {
  return value.kind === "sphere" ? { kind: "sphere", radiusM: value.radiusM } : value.kind === "box" ? { kind: "box", halfExtentsM: [...value.halfExtentsM] } : { kind: "capsule", radiusM: value.radiusM, halfLengthM: value.halfLengthM };
}
function copyBody2(body) {
  return {
    ...body,
    shape: copyShape2(body.shape),
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    orientation: [...body.orientation],
    angularVelocityRadps: [...body.angularVelocityRadps],
    ...body.collisionFilter ? { collisionFilter: { ...body.collisionFilter } } : {},
    ...body.inertiaDiagonalKgM2 ? { inertiaDiagonalKgM2: [...body.inertiaDiagonalKgM2] } : {},
    inverseInertiaLocal: [...body.inverseInertiaLocal]
  };
}
function commandVector2(input, bound, label) {
  if (!Array.isArray(input) || input.length !== 3 || Reflect.ownKeys(input).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(input, index))) {
    error2("INVALID_COMMAND", `${label} must be a dense 3-vector`);
  }
  const result = [input[0], input[1], input[2]];
  if (result.some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > bound)) {
    error2("INVALID_COMMAND", `${label} must have finite components within \xB1${bound}`);
  }
  return result;
}
function parseCommands2(input, bodies) {
  if (!Array.isArray(input) || input.length > MAX_COMMANDS2 || Reflect.ownKeys(input).length !== input.length + 1 || !Array.from({ length: input.length }, (_, index) => Object.hasOwn(input, index)).every(Boolean)) {
    error2("INVALID_COMMAND", `commands must be a dense array of at most ${MAX_COMMANDS2}`);
  }
  const byId = new Map(bodies.map((body) => [body.id, body]));
  const admitted2 = /* @__PURE__ */ new Map();
  for (const [index, raw] of input.entries()) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw) || Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null) {
      error2("INVALID_COMMAND", `command ${index} must be a plain object`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const keys = Reflect.ownKeys(raw);
    const kind = descriptors.kind?.value;
    const valueKey = kind === "force" ? "forceN" : kind === "impulse" ? "impulseNs" : kind === "torque" ? "torqueNm" : kind === "angularImpulse" ? "angularImpulseNms" : kind === "kinematicTarget" ? "positionM" : null;
    if (!valueKey || keys.length !== 3 || keys.some((key) => typeof key !== "string" || !["kind", "bodyId", valueKey].includes(key)) || ["kind", "bodyId", valueKey].some((key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
      error2("INVALID_COMMAND", `command ${index} has unsupported fields`);
    }
    const bodyId = descriptors.bodyId.value;
    const body = typeof bodyId === "string" ? byId.get(bodyId) : void 0;
    if (!body || (kind === "kinematicTarget" ? body.kind !== "kinematic" : body.kind !== "dynamic")) {
      error2("INVALID_COMMAND", `command ${index} targets an unknown or unsupported body`);
    }
    const previous = admitted2.get(body.id) ?? {};
    if (Object.hasOwn(previous, valueKey)) error2("INVALID_COMMAND", `duplicate ${kind} command for ${body.id}`);
    const bound = kind === "force" ? MAX_FORCE_N2 : kind === "impulse" ? MAX_IMPULSE_NS2 : kind === "torque" ? MAX_TORQUE_NM2 : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS2 : 1e4;
    const value = commandVector2(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted2.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted2;
}
function queryRecord2(input, required, optional) {
  if (input === null || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
    error2("INVALID_QUERY", "query must be a plain object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key !== "string" || ![...required, ...optional].includes(key)) || required.some((key) => !Object.hasOwn(descriptors, key)) || keys.some((key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
    error2("INVALID_QUERY", "query has missing or unsupported fields");
  }
  return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
}
function queryVector2(input, bound, label) {
  if (!Array.isArray(input) || input.length !== 3 || Reflect.ownKeys(input).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(input, index))) {
    error2("INVALID_QUERY", `${label} must be a dense 3-vector`);
  }
  const values = [input[0], input[1], input[2]];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > bound)) {
    error2("INVALID_QUERY", `${label} components must be finite within \xB1${bound}`);
  }
  return values;
}
function queryNumber2(input, min, max, label) {
  if (typeof input !== "number" || !Number.isFinite(input) || input < min || input > max) {
    error2("INVALID_QUERY", `${label} must be finite and in [${min}, ${max}]`);
  }
  return input;
}
function includeSensors2(query) {
  if (!Object.hasOwn(query, "includeSensors")) return true;
  if (typeof query.includeSensors !== "boolean") error2("INVALID_QUERY", "includeSensors must be boolean");
  return query.includeSensors;
}
function multiplyQuaternion2(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}
function advanceOrientation2(orientation, angularVelocity, dt) {
  const speed = Math.hypot(...angularVelocity);
  if (speed === 0) return [...orientation];
  const halfAngle = speed * dt / 2;
  const scale3 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale3,
    angularVelocity[1] * scale3,
    angularVelocity[2] * scale3,
    Math.cos(halfAngle)
  ];
  const next = multiplyQuaternion2(delta, orientation);
  const norm2 = Math.hypot(...next);
  return next.map((component) => component / norm2);
}
var add2 = (a, b) => a.map((value, index) => value + b[index]);
var sub2 = (a, b) => a.map((value, index) => value - b[index]);
var scale2 = (a, value) => a.map((component) => component * value);
var dot3 = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var inverse2 = (q) => [-q[0], -q[1], -q[2], q[3]];
function rotate2(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale2(cross2(axis, v), 2);
  return add2(v, add2(scale2(t, q[3]), cross2(axis, t)));
}
var localPoint2 = (body, point2) => rotate2(inverse2(body.orientation), sub2(point2, body.positionM));
var worldPoint2 = (body, point2) => add2(body.positionM, rotate2(body.orientation, point2));
function inverseInertia2(body, vector22) {
  const local = rotate2(inverse2(body.orientation), vector22);
  return rotate2(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}
function inertia2(body, vector22) {
  const local = rotate2(inverse2(body.orientation), vector22);
  return rotate2(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]));
}
function solvePairMatrix2(columns, target) {
  const rows = [0, 1, 2].map((row) => [
    columns[0][row],
    columns[1][row],
    columns[2][row],
    target[row]
  ]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (!Number.isFinite(rows[pivot][column]) || Math.abs(rows[pivot][column]) < 1e-12) {
      error2("NUMERIC_LIMIT", "dynamic pair effective mass is singular");
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index < 4; index++) rows[column][index] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index < 4; index++) rows[row][index] -= factor * rows[column][index];
    }
  }
  const result = rows.map((row) => row[3]);
  if (result.some((value) => !Number.isFinite(value))) {
    error2("NUMERIC_LIMIT", "dynamic pair correction is not finite");
  }
  return result;
}
function applyPairAngle2(body, angle, dt) {
  if (Math.hypot(...angle) > 1) error2("NUMERIC_LIMIT", "dynamic pair angular correction exceeds limit");
  body.orientation = advanceOrientation2(body.orientation, angle, 1);
  body.angularVelocityRadps = add2(body.angularVelocityRadps, scale2(angle, 1 / dt));
}
function projectDynamicPairAnchors2(a, b, anchorA, anchorB, dt) {
  const armA = rotate2(a.orientation, anchorA);
  const armB = rotate2(b.orientation, anchorB);
  const separation = sub2(worldPoint2(b, anchorB), worldPoint2(a, anchorA));
  if (Math.hypot(...separation) > MAX_STEP_DISPLACEMENT_M2) {
    error2("NUMERIC_LIMIT", "dynamic pair anchor separation exceeds limit");
  }
  const basis22 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const columns = basis22.map((axis) => add2(
    scale2(axis, a.inverseMass + b.inverseMass),
    add2(
      cross2(inverseInertia2(a, cross2(armA, axis)), armA),
      cross2(inverseInertia2(b, cross2(armB, axis)), armB)
    )
  ));
  const correction = solvePairMatrix2(columns, scale2(separation, -1));
  const moveA = scale2(correction, -a.inverseMass);
  const moveB = scale2(correction, b.inverseMass);
  a.positionM = add2(a.positionM, moveA);
  b.positionM = add2(b.positionM, moveB);
  a.velocityMps = add2(a.velocityMps, scale2(moveA, 1 / dt));
  b.velocityMps = add2(b.velocityMps, scale2(moveB, 1 / dt));
  applyPairAngle2(a, scale2(inverseInertia2(a, cross2(armA, correction)), -1), dt);
  applyPairAngle2(b, inverseInertia2(b, cross2(armB, correction)), dt);
}
function orientationError(actual, desired) {
  const relative = multiplyQuaternion2(actual, inverse2(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector22 = scale2([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector22);
  if (sine < 1e-12) return scale2(vector22, 2);
  return scale2(vector22, 2 * Math.atan2(sine, sign * relative[3]) / sine);
}
function projectDynamicFixedJoint2(joint, bodies, dt) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const beforeLinear = [...b.velocityMps];
  const beforeAngular = [...b.angularVelocityRadps];
  const desired = multiplyQuaternion2(a.orientation, joint.referenceOrientation);
  const angularError = orientationError(b.orientation, desired);
  if (Math.hypot(...angularError) > 1) {
    error2("NUMERIC_LIMIT", "dynamic fixed joint relative orientation exceeds limit");
  }
  const basis22 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const angularColumns = basis22.map((axis) => add2(inverseInertia2(a, axis), inverseInertia2(b, axis)));
  const angularImpulse = solvePairMatrix2(angularColumns, scale2(angularError, -1));
  applyPairAngle2(a, scale2(inverseInertia2(a, angularImpulse), -1), dt);
  applyPairAngle2(b, inverseInertia2(b, angularImpulse), dt);
  projectDynamicPairAnchors2(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale2(sub2(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia2(b, sub2(b.angularVelocityRadps, beforeAngular))
  };
}
var magnitude2 = (vector22) => Math.hypot(...vector22);
var near2 = (a, b) => magnitude2(sub2(a, b)) <= 1e-9;
function offsetFixture2(joint, a, b) {
  return near2(a.positionM, [-0.1, 0, 0]) && near2(b.positionM, [0.1, 0, 0]) && near2(joint.anchorALocalM, [0.1, 0, 0]) && near2(joint.anchorBLocalM, [-0.1, 0, 0]) && near2(joint.axisWorld, [0, 0, 1]) && Math.abs(joint.limitRad[0] + 0.8) <= 1e-9 && Math.abs(joint.limitRad[1] - 0.8) <= 1e-9 && a.inverseMass === 1 && b.inverseMass === 1 && a.shape.kind === "sphere" && b.shape.kind === "sphere" && a.shape.radiusM === 0.1 && b.shape.radiusM === 0.1 && joint.motor?.targetSpeedRadps === 0.5 && joint.motor.maxImpulseNms === 1e-4 && joint.motor.maxReactionNms === 0.01;
}
function admitDynamicHingeScene2(joint, bodies, gravity) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity2 = [0, 0, 0, 1];
  const centred = near2(a.positionM, b.positionM) && magnitude2(joint.anchorALocalM) === 0 && magnitude2(joint.anchorBLocalM) === 0;
  if (magnitude2(gravity) !== 0 || !centred && !offsetFixture2(joint, a, b) || [a, b].some((body) => magnitude2(body.velocityMps) !== 0 || magnitude2(body.angularVelocityRadps) !== 0 || body.orientation.some((value, index) => Math.abs(value - identity2[index]) > 1e-12))) {
    error2("INVALID_CONFIG", "dynamic hinge needs an admitted resting pair and zero gravity");
  }
}
function admitDynamicHingeCommands2(joint, bodies, actions) {
  const axis = joint.axisWorld;
  for (const bodyIndex of [joint.aIndex, joint.bIndex]) {
    const action = actions.get(bodies[bodyIndex].id);
    if (!action) continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector22) => vector22 !== void 0).some((vector22) => magnitude2(sub2(vector22, scale2(axis, dot3(vector22, axis)))) > 1e-12)) {
      error2("INVALID_COMMAND", "dynamic hinge admits axis-aligned angular commands only");
    }
  }
}
function projectDynamicHingeJoint2(joint, bodies, dt) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const axis = joint.axisWorld;
  const beforeLinear = [...b.velocityMps];
  const beforeAngular = [...b.angularVelocityRadps];
  const relative = multiplyQuaternion2(b.orientation, inverse2(a.orientation));
  const signed = dot3([relative[0], relative[1], relative[2]], axis);
  if (magnitude2(sub2([relative[0], relative[1], relative[2]], scale2(axis, signed))) > 1e-8) {
    error2("NUMERIC_LIMIT", "dynamic hinge left its planar axis");
  }
  const raw = 2 * Math.atan2(signed, relative[3]);
  const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
  const angleRad = Math.max(joint.limitRad[0], Math.min(joint.limitRad[1], wrapped));
  const inverseA = dot3(axis, inverseInertia2(a, axis));
  const inverseB = dot3(axis, inverseInertia2(b, axis));
  const inverseSum = inverseA + inverseB;
  const excess = wrapped - angleRad;
  if (excess !== 0) {
    const angleA = excess * inverseA / inverseSum;
    const angleB = -excess * inverseB / inverseSum;
    a.orientation = advanceOrientation2(a.orientation, scale2(axis, angleA), 1);
    b.orientation = advanceOrientation2(b.orientation, scale2(axis, angleB), 1);
    a.angularVelocityRadps = add2(a.angularVelocityRadps, scale2(axis, angleA / dt));
    b.angularVelocityRadps = add2(b.angularVelocityRadps, scale2(axis, angleB / dt));
  }
  const relativeSpeed = dot3(sub2(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  if (angleRad === joint.limitRad[0] && relativeSpeed < 0 || angleRad === joint.limitRad[1] && relativeSpeed > 0) {
    const impulse = -relativeSpeed / inverseSum;
    a.angularVelocityRadps = sub2(
      a.angularVelocityRadps,
      inverseInertia2(a, scale2(axis, impulse))
    );
    b.angularVelocityRadps = add2(
      b.angularVelocityRadps,
      inverseInertia2(b, scale2(axis, impulse))
    );
  }
  projectDynamicPairAnchors2(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale2(sub2(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia2(b, sub2(b.angularVelocityRadps, beforeAngular)),
    angleRad
  };
}
function denseJointVector2(value, bound, label) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error2("INVALID_CONFIG", `${label} must be a dense 3-vector`);
  }
  return vector3(value, -bound, bound, label);
}
function parseJoints2(value, bodies) {
  if (!Array.isArray(value) || value.length > 8 || Reflect.ownKeys(value).length !== value.length + 1 || !Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(Boolean)) {
    error2("INVALID_CONFIG", "joints must be a dense array of at most 8");
  }
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seenIds = /* @__PURE__ */ new Set(), seenDynamic = /* @__PURE__ */ new Set();
  const joints = value.map((raw) => {
    const input = record3(raw, "joint");
    if (input.kind !== "fixed" && input.kind !== "hinge") error2("INVALID_CONFIG", "unsupported joint kind");
    fields2(input, input.kind === "fixed" ? ["id", "kind", "aId", "bId", "anchorALocalM", "anchorBLocalM"] : ["id", "kind", "aId", "bId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"], "joint");
    if (typeof input.id !== "string" || !ID2.test(input.id) || seenIds.has(input.id)) {
      error2("INVALID_CONFIG", "joint IDs must be unique valid identifiers");
    }
    const a = typeof input.aId === "string" ? byId.get(input.aId) : void 0;
    const b = typeof input.bId === "string" ? byId.get(input.bId) : void 0;
    if (!a || !b || a.index === b.index || b.body.kind !== "dynamic" || seenDynamic.has(b.body.id)) {
      error2("INVALID_CONFIG", "joint needs a distinct A and unique dynamic B");
    }
    if (a.body.kind === "dynamic" && (value.length !== 1 || bodies.length !== 2 || a.body.shape.kind !== "sphere" || b.body.shape.kind !== "sphere")) {
      error2("INVALID_CONFIG", "dynamic pair supports one joint between two dynamic spheres");
    }
    const anchorALocalM = denseJointVector2(input.anchorALocalM, 100, "anchorALocalM");
    const anchorBLocalM = denseJointVector2(input.anchorBLocalM, 100, "anchorBLocalM");
    if (Math.hypot(...sub2(worldPoint2(a.body, anchorALocalM), worldPoint2(b.body, anchorBLocalM))) > 1e-6) {
      error2("INVALID_CONFIG", "initial joint anchors must coincide");
    }
    let axisWorld, limitRad;
    let motor;
    if (input.kind === "hinge") {
      axisWorld = denseJointVector2(input.axisWorld, 1 + 1e-9, "axisWorld");
      if (Math.abs(Math.hypot(...axisWorld) - 1) > 1e-9) error2("INVALID_CONFIG", "hinge axis must be unit length");
      const limits = input.limitRad;
      if (!Array.isArray(limits) || limits.length !== 2 || Reflect.ownKeys(limits).length !== 3 || ![0, 1].every((index) => Object.hasOwn(limits, index))) {
        error2("INVALID_CONFIG", "hinge limits must be a dense pair");
      }
      const low = finite3(limits[0], -Math.PI / 2, 0, "limitRad[0]");
      const high = finite3(limits[1], 0, Math.PI / 2, "limitRad[1]");
      limitRad = [low, high];
      if (Object.hasOwn(input, "motor")) {
        const motorInput = record3(input.motor, "motor");
        fields2(motorInput, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
        const targetSpeedRadps = finite3(motorInput.targetSpeedRadps, -2, 2, "motor.targetSpeedRadps");
        const maxImpulseNms = finite3(motorInput.maxImpulseNms, 0, 0.05, "motor.maxImpulseNms");
        const maxReactionNms = finite3(motorInput.maxReactionNms, 0, 1, "motor.maxReactionNms");
        if (maxImpulseNms === 0 || maxReactionNms === 0) {
          error2("INVALID_CONFIG", "motor impulse and reaction limits must be positive");
        }
        motor = { targetSpeedRadps, maxImpulseNms, maxReactionNms };
      }
    }
    seenIds.add(input.id);
    seenDynamic.add(b.body.id);
    return {
      id: input.id,
      kind: input.kind,
      aIndex: a.index,
      bIndex: b.index,
      anchorALocalM,
      anchorBLocalM,
      referenceOrientation: input.kind === "fixed" ? multiplyQuaternion2(inverse2(a.body.orientation), b.body.orientation) : [...b.body.orientation],
      ...axisWorld ? { axisWorld } : {},
      ...limitRad ? { limitRad } : {},
      ...motor ? { motor } : {}
    };
  });
  return joints;
}
function projectJoint2(joint, next, previous, dt) {
  const a = next[joint.aIndex], b = next[joint.bIndex];
  if (a.kind === "dynamic") return joint.kind === "fixed" ? projectDynamicFixedJoint2(joint, next, dt) : projectDynamicHingeJoint2(joint, next, dt);
  const beforeVelocity = [...b.velocityMps];
  const beforeAngular = [...b.angularVelocityRadps];
  let targetOrientation, angleRad;
  if (joint.kind === "fixed") {
    targetOrientation = multiplyQuaternion2(a.orientation, joint.referenceOrientation);
    b.angularVelocityRadps = [0, 0, 0];
  } else {
    const axis = joint.axisWorld;
    const delta = multiplyQuaternion2(b.orientation, inverse2(joint.referenceOrientation));
    const signed = dot3([delta[0], delta[1], delta[2]], axis);
    const raw = 2 * Math.atan2(signed, delta[3]);
    const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
    angleRad = Math.max(joint.limitRad[0], Math.min(joint.limitRad[1], wrapped));
    const half = angleRad / 2;
    targetOrientation = multiplyQuaternion2([
      axis[0] * Math.sin(half),
      axis[1] * Math.sin(half),
      axis[2] * Math.sin(half),
      Math.cos(half)
    ], joint.referenceOrientation);
    let speed = dot3(b.angularVelocityRadps, axis);
    if (angleRad === joint.limitRad[0] && speed < 0 || angleRad === joint.limitRad[1] && speed > 0) speed = 0;
    b.angularVelocityRadps = scale2(axis, speed);
  }
  const norm2 = Math.hypot(...targetOrientation);
  b.orientation = targetOrientation.map((value) => value / norm2);
  const targetPosition = sub2(worldPoint2(a, joint.anchorALocalM), rotate2(b.orientation, joint.anchorBLocalM));
  if (Math.hypot(...sub2(targetPosition, b.positionM)) > MAX_STEP_DISPLACEMENT_M2) {
    error2("NUMERIC_LIMIT", `${joint.id} projection exceeded movement limit`);
  }
  b.positionM = targetPosition;
  b.velocityMps = scale2(sub2(targetPosition, previous[joint.bIndex].positionM), 1 / dt);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale2(sub2(b.velocityMps, beforeVelocity), 1 / b.inverseMass),
    angularImpulseNms: inertia2(b, sub2(b.angularVelocityRadps, beforeAngular)),
    ...angleRad === void 0 ? {} : { angleRad }
  };
}
function driveHingeMotor2(joint, body, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0) return 0;
  const inverseAxisInertia = dot3(axis, inverseInertia2(body, axis));
  const speed = dot3(body.angularVelocityRadps, axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseAxisInertia;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  body.angularVelocityRadps = add2(
    body.angularVelocityRadps,
    inverseInertia2(body, scale2(axis, impulse))
  );
  return impulse;
}
function driveDynamicHingeMotor2(joint, a, b, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0) return 0;
  const inverseSum = dot3(axis, inverseInertia2(a, axis)) + dot3(axis, inverseInertia2(b, axis));
  const speed = dot3(sub2(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseSum;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  a.angularVelocityRadps = sub2(
    a.angularVelocityRadps,
    inverseInertia2(a, scale2(axis, impulse))
  );
  b.angularVelocityRadps = add2(
    b.angularVelocityRadps,
    inverseInertia2(b, scale2(axis, impulse))
  );
  return impulse;
}
var clamp3 = (value, low, high) => Math.max(low, Math.min(high, value));
function capsuleEnds2(body) {
  const half = body.shape.halfLengthM;
  return [worldPoint2(body, [0, -half, 0]), worldPoint2(body, [0, half, 0])];
}
function segmentPair2(a0, a1, b0, b1) {
  const u = sub2(a1, a0), v = sub2(b1, b0), w = sub2(a0, b0);
  const aa = dot3(u, u), bb = dot3(u, v), cc = dot3(v, v);
  const dd = dot3(u, w), ee = dot3(v, w), determinant = aa * cc - bb * bb;
  const candidates = [
    [0, clamp3(ee / cc, 0, 1)],
    [1, clamp3((bb + ee) / cc, 0, 1)],
    [clamp3(-dd / aa, 0, 1), 0],
    [clamp3((bb - dd) / aa, 0, 1), 1],
    [0.5, clamp3((bb * 0.5 + ee) / cc, 0, 1)],
    [clamp3((bb * 0.5 - dd) / aa, 0, 1), 0.5]
  ];
  if (determinant > 1e-12 * aa * cc) {
    const s = (bb * ee - cc * dd) / determinant;
    const t = (aa * ee - bb * dd) / determinant;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) candidates.push([s, t]);
  }
  let best = candidates[0], bestDistance = Infinity, bestTie = Infinity;
  for (const candidate of candidates) {
    const difference = sub2(add2(a0, scale2(u, candidate[0])), add2(b0, scale2(v, candidate[1])));
    const distance = dot3(difference, difference);
    const tie = Math.abs(candidate[0] - 0.5) + Math.abs(candidate[1] - 0.5);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && tie < bestTie) {
      best = candidate;
      bestDistance = distance;
      bestTie = tie;
    }
  }
  return [add2(a0, scale2(u, best[0])), add2(b0, scale2(v, best[1]))];
}
function segmentBox2(segmentStart, segmentEnd, extents2) {
  const direction2 = sub2(segmentEnd, segmentStart);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction2[axis]) < 1e-15) continue;
    for (const face of [-extents2[axis], extents2[axis]]) {
      const t = (face - segmentStart[axis]) / direction2[axis];
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
      const value = segmentStart[axis] + midpoint * direction2[axis];
      const face = value < -extents2[axis] ? -extents2[axis] : value > extents2[axis] ? extents2[axis] : null;
      if (face === null) continue;
      numerator += direction2[axis] * (segmentStart[axis] - face);
      denominator += direction2[axis] ** 2;
    }
    const t = clamp3(denominator ? -numerator / denominator : 0.5, low, high);
    const point22 = add2(segmentStart, scale2(direction2, t));
    const nearest = point22.map((value, axis) => clamp3(value, -extents2[axis], extents2[axis]));
    const delta = sub2(point22, nearest), distance = dot3(delta, delta);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(bestT - 0.5)) {
      bestT = t;
      bestDistance = distance;
    }
  }
  const point2 = add2(segmentStart, scale2(direction2, bestT));
  return [point2, point2.map((value, axis) => clamp3(value, -extents2[axis], extents2[axis]))];
}
function capsuleCapsule2(a, b) {
  const [aPoint, bPoint] = segmentPair2(...capsuleEnds2(a), ...capsuleEnds2(b));
  const delta = sub2(bPoint, aPoint), distance = Math.hypot(...delta);
  const aRadius = a.shape.radiusM;
  const bRadius = b.shape.radiusM;
  if (distance > aRadius + bRadius) return null;
  const centerDelta = sub2(b.positionM, a.positionM);
  const normal = distance > 1e-12 ? scale2(delta, 1 / distance) : Math.hypot(...centerDelta) > 1e-12 ? scale2(centerDelta, 1 / Math.hypot(...centerDelta)) : a.id < b.id ? [1, 0, 0] : [-1, 0, 0];
  const surfaceA = add2(aPoint, scale2(normal, aRadius));
  const surfaceB = sub2(bPoint, scale2(normal, bRadius));
  return {
    normal,
    penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale2(add2(surfaceA, surfaceB), 0.5)
  };
}
function capsuleBox2(capsule, box) {
  const [start, end] = capsuleEnds2(capsule).map((point2) => localPoint2(box, point2));
  const extents2 = box.shape.halfExtentsM;
  const [axisPoint, boxPoint] = segmentBox2(start, end, extents2);
  const delta = sub2(boxPoint, axisPoint), distance = Math.hypot(...delta);
  const radius = capsule.shape.radiusM;
  if (distance > radius) return null;
  if (distance > 1e-12) return {
    normal: rotate2(box.orientation, scale2(delta, 1 / distance)),
    penetration: radius - distance,
    pointM: worldPoint2(box, boxPoint)
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
    normal: rotate2(box.orientation, normalLocal),
    penetration: radius + bestGap,
    pointM: worldPoint2(box, boxPoint)
  };
}
function capsuleCenter2(body, point2) {
  const half = body.shape.halfLengthM;
  const local = localPoint2(body, point2);
  return worldPoint2(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes4(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
}
function boxSupport4(body, direction2) {
  const axes = boxAxes4(body);
  const extents2 = body.shape.halfExtentsM;
  return add2(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot3(axis, direction2);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
    return add2(result, scale2(axis, offset));
  }, [0, 0, 0]));
}
function sphereSphere2(a, b) {
  const aRadius = a.shape.radiusM;
  const bRadius = b.shape.radiusM;
  const delta = sub2(b.positionM, a.positionM);
  const distance = Math.hypot(...delta);
  if (distance > aRadius + bRadius) return null;
  const normal = distance === 0 ? [1, 0, 0] : scale2(delta, 1 / distance);
  const aSurface = add2(a.positionM, scale2(normal, aRadius));
  const bSurface = sub2(b.positionM, scale2(normal, bRadius));
  return {
    normal,
    penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale2(add2(aSurface, bSurface), 0.5)
  };
}
function sphereBox2(sphere, box) {
  const radius = sphere.shape.radiusM;
  const extents2 = box.shape.halfExtentsM;
  const relative = localPoint2(box, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents2[index], Math.min(extents2[index], value)));
  const towardBox = sub2(nearest, relative);
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return {
    normal: rotate2(box.orientation, scale2(towardBox, 1 / distance)),
    penetration: Math.max(0, radius - distance),
    pointM: worldPoint2(box, nearest)
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
    normal: rotate2(box.orientation, localNormal),
    penetration: radius + faceDistance,
    pointM: worldPoint2(box, nearest)
  };
}
function capsuleSphere2(capsule, sphere) {
  const center = capsuleCenter2(capsule, sphere.positionM);
  const delta = sub2(sphere.positionM, center);
  const distance = Math.hypot(...delta);
  const capsuleRadius = capsule.shape.radiusM;
  const sphereRadius = sphere.shape.radiusM;
  if (distance > capsuleRadius + sphereRadius) return null;
  const normal = distance === 0 ? [1, 0, 0] : scale2(delta, 1 / distance);
  return {
    normal,
    penetration: Math.max(0, capsuleRadius + sphereRadius - distance),
    pointM: scale2(add2(
      add2(center, scale2(normal, capsuleRadius)),
      sub2(sphere.positionM, scale2(normal, sphereRadius))
    ), 0.5)
  };
}
function boxBox2(a, b) {
  const axesA = boxAxes4(a), axesB = boxAxes4(b);
  const extentA = a.shape.halfExtentsM, extentB = b.shape.halfExtentsM;
  const delta = sub2(b.positionM, a.positionM);
  let bestAxis = [1, 0, 0], bestOverlap = Infinity;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross2(axisA, axisB)))];
  for (const candidate of candidates) {
    const length = Math.hypot(...candidate);
    if (length < 1e-12) continue;
    const axis = scale2(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis22, index) => sum + extentA[index] * Math.abs(dot3(basis22, axis)), 0);
    const radiusB = axesB.reduce((sum, basis22, index) => sum + extentB[index] * Math.abs(dot3(basis22, axis)), 0);
    const signedDistance = dot3(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    if (overlap < -1e-12) return null;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale2(axis, signedDistance < 0 ? -1 : 1);
    }
  }
  const aPoint = boxSupport4(a, bestAxis);
  const bPoint = boxSupport4(b, scale2(bestAxis, -1));
  return { normal: bestAxis, penetration: Math.max(0, bestOverlap), pointM: scale2(add2(aPoint, bPoint), 0.5) };
}
function detect3(a, b) {
  if (a.shape.kind === "sphere" && b.shape.kind === "sphere") return sphereSphere2(a, b);
  if (a.shape.kind === "sphere" && b.shape.kind === "box") return sphereBox2(a, b);
  if (a.shape.kind === "box" && b.shape.kind === "sphere") {
    const hit = sphereBox2(b, a);
    return hit && { ...hit, normal: scale2(hit.normal, -1) };
  }
  if (a.shape.kind === "capsule" && b.shape.kind === "sphere") return capsuleSphere2(a, b);
  if (a.shape.kind === "sphere" && b.shape.kind === "capsule") {
    const hit = capsuleSphere2(b, a);
    return hit && { ...hit, normal: scale2(hit.normal, -1) };
  }
  if (a.shape.kind === "box" && b.shape.kind === "box") return boxBox2(a, b);
  if (a.shape.kind === "capsule" && b.shape.kind === "box") return capsuleBox2(a, b);
  if (a.shape.kind === "box" && b.shape.kind === "capsule") {
    const hit = capsuleBox2(b, a);
    return hit && { ...hit, normal: scale2(hit.normal, -1) };
  }
  if (a.shape.kind === "capsule" && b.shape.kind === "capsule") return capsuleCapsule2(a, b);
  return null;
}
function sphereOverlaps2(center, radius, body) {
  if (body.shape.kind === "sphere") {
    return Math.hypot(...sub2(center, body.positionM)) <= radius + body.shape.radiusM;
  }
  if (body.shape.kind === "capsule") {
    return Math.hypot(...sub2(center, capsuleCenter2(body, center))) <= radius + body.shape.radiusM;
  }
  const extents2 = body.shape.halfExtentsM;
  const local = localPoint2(body, center);
  const delta = local.map((value, index) => Math.max(0, Math.abs(value) - extents2[index]));
  return Math.hypot(...delta) <= radius;
}
function raySphere2(origin, direction2, center, radius) {
  const relative = sub2(origin, center);
  const c = dot3(relative, relative) - radius ** 2;
  if (c <= 0) return 0;
  const projection = dot3(relative, direction2);
  const discriminant = projection ** 2 - c;
  return projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
}
function rayDistance2(origin, direction2, body) {
  if (body.shape.kind === "sphere") return raySphere2(origin, direction2, body.positionM, body.shape.radiusM);
  const localOrigin = localPoint2(body, origin);
  const localDirection = rotate2(inverse2(body.orientation), direction2);
  if (body.shape.kind === "capsule") {
    const { radiusM: radius, halfLengthM: half } = body.shape;
    const closest = [0, Math.max(-half, Math.min(half, localOrigin[1])), 0];
    if (Math.hypot(...sub2(localOrigin, closest)) <= radius) return 0;
    const results = [];
    for (const y of [-half, half]) {
      const hit = raySphere2(localOrigin, localDirection, [0, y, 0], radius);
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
  let near22 = -Infinity, far = Infinity;
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
    near22 = Math.max(near22, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (far < near22) return null;
  }
  return far < 0 ? null : Math.max(0, near22);
}
function solve2(a, b, hit) {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0) return { normalImpulseNs: 0, tangentImpulseNs: [0, 0, 0] };
  const armA = sub2(hit.pointM, a.positionM), armB = sub2(hit.pointM, b.positionM);
  const pointVelocityA = add2(a.velocityMps, cross2(a.angularVelocityRadps, armA));
  const pointVelocityB = add2(b.velocityMps, cross2(b.angularVelocityRadps, armB));
  const relativeSpeed = dot3(hit.normal, sub2(pointVelocityB, pointVelocityA));
  const torqueAxisA = cross2(armA, hit.normal), torqueAxisB = cross2(armB, hit.normal);
  const effectiveMass = inverseTotal + dot3(torqueAxisA, inverseInertia2(a, torqueAxisA)) + dot3(torqueAxisB, inverseInertia2(b, torqueAxisB));
  let impulse = 0;
  if (relativeSpeed < 0) {
    const bounce = -relativeSpeed > 0.5 ? Math.min(a.restitution, b.restitution) : 0;
    impulse = -(1 + bounce) * relativeSpeed / effectiveMass;
  }
  a.angularVelocityRadps = sub2(a.angularVelocityRadps, scale2(inverseInertia2(a, torqueAxisA), impulse));
  b.angularVelocityRadps = add2(b.angularVelocityRadps, scale2(inverseInertia2(b, torqueAxisB), impulse));
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
  const frictionArmA = sub2(hit.pointM, a.positionM);
  const frictionArmB = sub2(hit.pointM, b.positionM);
  const afterA = add2(a.velocityMps, cross2(a.angularVelocityRadps, frictionArmA));
  const afterB = add2(b.velocityMps, cross2(b.angularVelocityRadps, frictionArmB));
  const relative = sub2(afterB, afterA);
  const tangent = sub2(relative, scale2(hit.normal, dot3(relative, hit.normal)));
  const speed = Math.hypot(...tangent);
  if (speed === 0) return { normalImpulseNs: impulse, tangentImpulseNs: [0, 0, 0] };
  const direction2 = scale2(tangent, 1 / speed);
  const tangentAxisA = cross2(frictionArmA, direction2), tangentAxisB = cross2(frictionArmB, direction2);
  const tangentMass = inverseTotal + dot3(tangentAxisA, inverseInertia2(a, tangentAxisA)) + dot3(tangentAxisB, inverseInertia2(b, tangentAxisB));
  const required = speed / tangentMass;
  const dynamicFriction = Math.sqrt(a.frictionDynamic * b.frictionDynamic);
  const magnitude22 = required <= staticFriction * impulse ? required : Math.min(required, dynamicFriction * impulse);
  const tangentImpulse = scale2(direction2, -magnitude22);
  a.velocityMps = sub2(a.velocityMps, scale2(tangentImpulse, a.inverseMass));
  b.velocityMps = add2(b.velocityMps, scale2(tangentImpulse, b.inverseMass));
  a.angularVelocityRadps = sub2(
    a.angularVelocityRadps,
    inverseInertia2(a, cross2(frictionArmA, tangentImpulse))
  );
  b.angularVelocityRadps = add2(
    b.angularVelocityRadps,
    inverseInertia2(b, cross2(frictionArmB, tangentImpulse))
  );
  return { normalImpulseNs: impulse, tangentImpulseNs: tangentImpulse };
}
function validateResult2(bodies, contacts) {
  for (const body of bodies) {
    for (const [label, values, bound] of [
      ["position", body.positionM, 1e4],
      ["velocity", body.velocityMps, 1e3],
      ["angularVelocity", body.angularVelocityRadps, 1e3]
    ]) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound)) error2("NUMERIC_LIMIT", `${body.id} ${label} exceeded bounds`);
    }
    if (body.orientation.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body.orientation) - 1) > 1e-12) error2("NUMERIC_LIMIT", `${body.id} orientation exceeded tolerance`);
  }
  if (contacts.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) || contact.normalAtoB.some((value) => !Number.isFinite(value)) || contact.pointM.some((value) => !Number.isFinite(value)) || contact.tangentImpulseNs.some((value) => !Number.isFinite(value)))) error2("NUMERIC_LIMIT", "unsafe contact result");
}
var basis2 = (body) => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
function referenceFace(body, axes, normal) {
  for (let axis = 0; axis < 3; axis++) {
    const alignment = dot3(axes[axis], normal);
    if (Math.abs(alignment) >= 1 - 1e-6) {
      return {
        body,
        axes,
        extents: body.shape.halfExtentsM,
        axis,
        side: Math.sign(alignment)
      };
    }
  }
  return null;
}
function clip(polygon, centre, axis, limit) {
  const result = [];
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index], next = polygon[(index + 1) % polygon.length];
    const a = dot3(sub2(current, centre), axis) - limit;
    const b = dot3(sub2(next, centre), axis) - limit;
    const insideA = a <= 1e-9, insideB = b <= 1e-9;
    if (insideA) result.push(current);
    if (insideA !== insideB) result.push(add2(current, scale2(sub2(next, current), a / (a - b))));
  }
  return result;
}
function faceVertices(face) {
  const tangents = [0, 1, 2].filter((axis) => axis !== face.axis);
  const centre = add2(face.body.positionM, scale2(
    face.axes[face.axis],
    face.side * face.extents[face.axis]
  ));
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => add2(
    add2(centre, scale2(face.axes[tangents[0]], u * face.extents[tangents[0]])),
    scale2(face.axes[tangents[1]], v * face.extents[tangents[1]])
  ));
}
function boxFaceManifold(a, b, hit) {
  if (a.shape.kind !== "box" || b.shape.kind !== "box") return null;
  const axesA = basis2(a), axesB = basis2(b);
  const faceA = referenceFace(a, axesA, hit.normal);
  const faceB = referenceFace(b, axesB, scale2(hit.normal, -1));
  const reference = faceA ?? faceB;
  if (!reference) return null;
  const incidentBody = reference.body === a ? b : a;
  const incidentAxes = reference.body === a ? axesB : axesA;
  const normal = reference.body === a ? hit.normal : scale2(hit.normal, -1);
  let incidentAxis = 0, greatest = -Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const alignment = Math.abs(dot3(incidentAxes[axis], normal));
    if (alignment > greatest) {
      greatest = alignment;
      incidentAxis = axis;
    }
  }
  const incident = {
    body: incidentBody,
    axes: incidentAxes,
    extents: incidentBody.shape.halfExtentsM,
    axis: incidentAxis,
    side: dot3(incidentAxes[incidentAxis], normal) > 0 ? -1 : 1
  };
  const centre = add2(reference.body.positionM, scale2(
    reference.axes[reference.axis],
    reference.side * reference.extents[reference.axis]
  ));
  const tangents = [0, 1, 2].filter((axis) => axis !== reference.axis);
  let polygon = faceVertices(incident);
  for (const axis of tangents) {
    polygon = clip(polygon, centre, reference.axes[axis], reference.extents[axis]);
    polygon = clip(polygon, centre, scale2(reference.axes[axis], -1), reference.extents[axis]);
  }
  const candidates = polygon.map((point2) => {
    const separation = dot3(sub2(point2, centre), normal);
    const midpoint = sub2(point2, scale2(normal, separation / 2));
    return {
      pointM: midpoint,
      separation,
      u: dot3(sub2(midpoint, centre), reference.axes[tangents[0]]),
      v: dot3(sub2(midpoint, centre), reference.axes[tangents[1]])
    };
  }).filter((point2) => point2.separation <= 1e-6);
  if (!candidates.length) return null;
  const selected = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, point2) => u * point2.u + v * point2.v > u * best.u + v * best.v ? point2 : best, candidates[0]));
  const unique = selected.filter((point2, index) => selected.findIndex((other) => Math.hypot(...sub2(point2.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first, second) => first.u - second.u || first.v - second.v);
  return unique.map((point2, index) => ({ id: `${reference.body.id}:${reference.axis}:${reference.side}:${index}`, pointM: point2.pointM }));
}
function apply2(a, b, pointM, impulse) {
  const armA = sub2(pointM, a.positionM), armB = sub2(pointM, b.positionM);
  a.velocityMps = sub2(a.velocityMps, scale2(impulse, a.inverseMass));
  b.velocityMps = add2(b.velocityMps, scale2(impulse, b.inverseMass));
  a.angularVelocityRadps = sub2(
    a.angularVelocityRadps,
    inverseInertia2(a, cross2(armA, impulse))
  );
  b.angularVelocityRadps = add2(
    b.angularVelocityRadps,
    inverseInertia2(b, cross2(armB, impulse))
  );
}
function relativeVelocity2(a, b, pointM) {
  const armA = sub2(pointM, a.positionM), armB = sub2(pointM, b.positionM);
  return sub2(
    add2(b.velocityMps, cross2(b.angularVelocityRadps, armB)),
    add2(a.velocityMps, cross2(a.angularVelocityRadps, armA))
  );
}
function effectiveInverseMass2(a, b, pointM, direction2) {
  const torqueA = cross2(sub2(pointM, a.positionM), direction2);
  const torqueB = cross2(sub2(pointM, b.positionM), direction2);
  return a.inverseMass + b.inverseMass + dot3(torqueA, inverseInertia2(a, torqueA)) + dot3(torqueB, inverseInertia2(b, torqueB));
}
function warmStartPoint2(a, b, pointM, normal, impulse) {
  apply2(a, b, pointM, add2(scale2(normal, impulse.normalNs), impulse.tangentNs));
}
function solvePersistentPoint2(a, b, pointM, normal, impulse) {
  const normalSpeed = dot3(relativeVelocity2(a, b, pointM), normal);
  const normalMass = effectiveInverseMass2(a, b, pointM, normal);
  const nextNormal = Math.max(0, impulse.normalNs - normalSpeed / normalMass);
  const deltaNormal = nextNormal - impulse.normalNs;
  impulse.normalNs = nextNormal;
  if (deltaNormal !== 0) apply2(a, b, pointM, scale2(normal, deltaNormal));
  const relative = relativeVelocity2(a, b, pointM);
  const tangent = sub2(relative, scale2(normal, dot3(relative, normal)));
  const tangentSpeed = Math.hypot(...tangent);
  if (tangentSpeed < 1e-12) return;
  const direction2 = scale2(tangent, 1 / tangentSpeed);
  const tangentMass = effectiveInverseMass2(a, b, pointM, direction2);
  const requested = sub2(impulse.tangentNs, scale2(direction2, tangentSpeed / tangentMass));
  const requestedMagnitude = Math.hypot(...requested);
  const staticLimit = Math.sqrt(a.frictionStatic * b.frictionStatic) * impulse.normalNs;
  const dynamicLimit = Math.sqrt(a.frictionDynamic * b.frictionDynamic) * impulse.normalNs;
  const limit = requestedMagnitude <= staticLimit ? staticLimit : dynamicLimit;
  const nextTangent = requestedMagnitude > limit && requestedMagnitude > 0 ? scale2(requested, limit / requestedMagnitude) : requested;
  const deltaTangent = sub2(nextTangent, impulse.tangentNs);
  impulse.tangentNs = nextTangent;
  apply2(a, b, pointM, deltaTangent);
}
function correctPersistentPair(a, b, normal, penetration) {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0 || penetration <= 0) return;
  const correction = scale2(normal, penetration / inverseTotal);
  a.positionM = sub2(a.positionM, scale2(correction, a.inverseMass));
  b.positionM = add2(b.positionM, scale2(correction, b.inverseMass));
}
function sweepBox2(start, end, halfExtents) {
  if (start.every((value, axis) => Math.abs(value) <= halfExtents[axis])) return null;
  const travel = sub2(end, start);
  let entry = 0;
  let exit = 1;
  let normalLocal = null;
  for (let axis = 0; axis < 3; axis++) {
    const velocity = travel[axis];
    if (velocity === 0) {
      if (Math.abs(start[axis]) > halfExtents[axis]) return null;
      continue;
    }
    const first = (-halfExtents[axis] - start[axis]) / velocity;
    const second = (halfExtents[axis] - start[axis]) / velocity;
    const near22 = Math.min(first, second);
    const far = Math.max(first, second);
    if (near22 > entry) {
      entry = near22;
      normalLocal = [0, 0, 0];
      normalLocal[axis] = velocity > 0 ? -1 : 1;
    }
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return normalLocal && entry <= 1 && exit >= 0 ? { fraction: entry, normalLocal } : null;
}
var ANGULAR_TOLERANCE2 = 1e-12;
function axisAlignedBox2(body) {
  return body.shape.kind === "box" && body.orientation.slice(0, 3).every((component) => Math.abs(component) <= ANGULAR_TOLERANCE2) && Math.abs(body.orientation[3] - 1) <= ANGULAR_TOLERANCE2 && body.angularVelocityRadps.every((component) => Math.abs(component) <= ANGULAR_TOLERANCE2);
}
function rejectAngularBoxCommand2(action) {
  if (action?.torqueNm?.some((component) => component !== 0) || action?.angularImpulseNms?.some((component) => component !== 0)) {
    error2("INVALID_COMMAND", "axis-aligned box CCD excludes angular commands");
  }
}
function sweepDynamicBox2(previous, candidate, fixture) {
  if (!axisAlignedBox2(previous) || !axisAlignedBox2(candidate) || !axisAlignedBox2(fixture)) {
    error2("NUMERIC_LIMIT", "box CCD candidate rotated outside the admitted profile");
  }
  if (previous.shape.kind !== "box" || fixture.shape.kind !== "box") return null;
  const fixtureHalfExtents = fixture.shape.halfExtentsM;
  const expanded = previous.shape.halfExtentsM.map((extent, axis) => extent + fixtureHalfExtents[axis]);
  const start = sub2(previous.positionM, fixture.positionM);
  const end = sub2(candidate.positionM, fixture.positionM);
  const hit = sweepBox2(start, end, expanded);
  if (!hit) return null;
  const travel = sub2(candidate.positionM, previous.positionM);
  candidate.positionM = sub2(
    add2(previous.positionM, scale2(travel, hit.fraction)),
    scale2(hit.normalLocal, 1e-9)
  );
  return {
    bodyId: previous.id,
    fixtureId: fixture.id,
    toiFraction: hit.fraction,
    normalFixtureToBody: hit.normalLocal
  };
}
function admitCcd2(bodies, jointCount, gravity) {
  const selected = bodies.filter((body) => body.ccd);
  if (selected.length === 0) return { kind: "none" };
  const sphereIndex = bodies.findIndex((body) => body.ccd);
  if (selected.length === 1 && bodies.length === 2 && jointCount === 0 && gravity.every((component) => component === 0) && bodies.every((body) => body.kind === "dynamic" && body.shape.kind === "sphere" && !body.sensor)) {
    return { kind: "sphere-pair", sphereIndex, otherIndex: 1 - sphereIndex };
  }
  if (selected.length === 1 && selected[0].shape.kind === "box" && bodies.length === 2 && jointCount === 0) {
    const fixtureIndex = 1 - sphereIndex;
    if (bodies[sphereIndex].kind === "dynamic" && bodies[fixtureIndex].kind === "static" && !bodies[fixtureIndex].sensor && axisAlignedBox2(bodies[sphereIndex]) && axisAlignedBox2(bodies[fixtureIndex])) {
      return { kind: "box-pair", boxIndex: sphereIndex, fixtureIndex };
    }
  }
  const fixtures = bodies.filter((body) => body.kind === "static" && !body.sensor && body.shape.kind === "box");
  if (selected.length !== 1 || bodies.length !== fixtures.length + 1 || bodies.filter((body) => body.kind === "dynamic").length !== 1 || fixtures.length < 1 || fixtures.length > 8 || jointCount !== 0) {
    error2("INVALID_CONFIG", "unsupported CCD body pair or world profile");
  }
  if (selected[0].shape.kind !== "sphere") {
    error2("INVALID_CONFIG", "static-box CCD requires a dynamic sphere");
  }
  return {
    kind: "static-boxes",
    sphereIndex,
    fixtures: fixtures.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  };
}
function sweepSphere2(previous, candidate, fixtures) {
  if (previous.shape.kind !== "sphere") return null;
  const radius = previous.shape.radiusM;
  const travel = sub2(candidate.positionM, previous.positionM);
  let earliest = null;
  for (const fixture of fixtures) {
    if (fixture.shape.kind !== "box") continue;
    const expanded = fixture.shape.halfExtentsM.map((extent) => extent + radius);
    const hit = sweepBox2(localPoint2(fixture, previous.positionM), localPoint2(fixture, candidate.positionM), expanded);
    if (!hit || earliest && hit.fraction >= earliest.toiFraction) continue;
    earliest = {
      bodyId: previous.id,
      fixtureId: fixture.id,
      toiFraction: hit.fraction,
      normalFixtureToBody: rotate2(fixture.orientation, hit.normalLocal)
    };
  }
  if (earliest) {
    candidate.positionM = sub2(
      add2(previous.positionM, scale2(travel, earliest.toiFraction)),
      scale2(earliest.normalFixtureToBody, 1e-9)
    );
  }
  return earliest;
}
function sweepSpherePair2(markedStart, markedEnd, otherStart, otherEnd) {
  if (markedStart.shape.kind !== "sphere" || otherStart.shape.kind !== "sphere") return null;
  const radius = markedStart.shape.radiusM + otherStart.shape.radiusM;
  const relativeStart = sub2(markedStart.positionM, otherStart.positionM);
  const distanceSquared = dot3(relativeStart, relativeStart);
  if (distanceSquared <= radius * radius) return null;
  const markedTravel = sub2(markedEnd.positionM, markedStart.positionM);
  const otherTravel = sub2(otherEnd.positionM, otherStart.positionM);
  const relativeTravel = sub2(markedTravel, otherTravel);
  const a = dot3(relativeTravel, relativeTravel);
  if (a === 0) return null;
  const b = 2 * dot3(relativeStart, relativeTravel);
  if (b >= 0) return null;
  const discriminant = b * b - 4 * a * (distanceSquared - radius * radius);
  if (!Number.isFinite(discriminant)) error2("NUMERIC_LIMIT", "unsafe sphere-pair sweep");
  if (discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  const markedAtHit = add2(markedStart.positionM, scale2(markedTravel, fraction));
  const otherAtHit = add2(otherStart.positionM, scale2(otherTravel, fraction));
  const separation = sub2(markedAtHit, otherAtHit);
  const length = Math.hypot(...separation);
  if (!(length > 0) || !Number.isFinite(length)) error2("NUMERIC_LIMIT", "unsafe sphere-pair normal");
  const normalFixtureToBody = scale2(separation, 1 / length);
  markedEnd.positionM = sub2(markedAtHit, scale2(normalFixtureToBody, 5e-10));
  otherEnd.positionM = add2(otherAtHit, scale2(normalFixtureToBody, 5e-10));
  return {
    bodyId: markedStart.id,
    fixtureId: otherStart.id,
    toiFraction: fraction,
    normalFixtureToBody
  };
}
function bodyBounds(body) {
  const shape22 = body.shape;
  let half;
  if (shape22.kind === "sphere") {
    half = [shape22.radiusM, shape22.radiusM, shape22.radiusM];
  } else if (shape22.kind === "capsule") {
    const axis = rotate2(body.orientation, [0, 1, 0]);
    half = axis.map((value) => shape22.radiusM + shape22.halfLengthM * Math.abs(value));
  } else {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
    half = [0, 1, 2].map((axis) => axes.reduce((extent, basis22, localAxis) => extent + Math.abs(basis22[axis]) * shape22.halfExtentsM[localAxis], 0));
  }
  const min = body.positionM.map((value, axis) => value - half[axis]);
  const max = body.positionM.map((value, axis) => value + half[axis]);
  if ([...min, ...max].some((value) => !Number.isFinite(value))) error2("NUMERIC_LIMIT", "nonfinite broad-phase bounds");
  return { min, max };
}
function boundsOverlap(a, b) {
  for (let axis = 0; axis < 3; axis++) {
    if (a.max[axis] + 1e-9 < b.min[axis] || b.max[axis] + 1e-9 < a.min[axis]) return false;
  }
  return true;
}
function filterAllowsPair2(a, b) {
  const left = a.collisionFilter;
  const right = b.collisionFilter;
  if (!left || !right) return true;
  return (left.maskBits & right.categoryBits) !== 0 && (right.maskBits & left.categoryBits) !== 0;
}
function dormantPair2(a, b) {
  const dynamics = [a, b].filter((body) => body.kind === "dynamic");
  return dynamics.length > 0 && dynamics.every((body) => body.sleeping === true) && [a, b].every((body) => body.kind !== "kinematic" || Math.hypot(...body.velocityMps) === 0);
}
function wakeOnContact2(a, b, sleepFrames, aIndex, bIndex) {
  if (dormantPair2(a, b)) return;
  if (a.kind === "dynamic" && a.sleeping && (b.kind === "dynamic" && !b.sleeping || b.kind === "kinematic" && Math.hypot(...b.velocityMps) > 0)) {
    a.sleeping = false;
    sleepFrames[aIndex] = 0;
  }
  if (b.kind === "dynamic" && b.sleeping && (a.kind === "dynamic" && !a.sleeping || a.kind === "kinematic" && Math.hypot(...a.velocityMps) > 0)) {
    b.sleeping = false;
    sleepFrames[bIndex] = 0;
  }
}
var REST_STEPS2 = 60;
var LINEAR_REST_MPS2 = 0.02;
var ANGULAR_REST_RADPS2 = 0.02;
function nonzero2(value) {
  return value?.some((component) => component !== 0) ?? false;
}
function wakeForActions2(bodies, previousContacts, actions, sleepFrames) {
  const indexById = new Map(bodies.map((body, index) => [body.id, index]));
  const neighbors = bodies.map(() => []);
  for (const contact of previousContacts) {
    const a = indexById.get(contact.aId);
    const b = indexById.get(contact.bId);
    if (bodies[a].kind === "dynamic" && bodies[b].kind === "dynamic") {
      neighbors[a].push(b);
      neighbors[b].push(a);
    }
  }
  const queue = [];
  for (let index = 0; index < bodies.length; index++) {
    const body = bodies[index];
    const action = actions.get(body.id);
    if (body.kind === "dynamic" && (nonzero2(action?.forceN) || nonzero2(action?.impulseNs) || nonzero2(action?.torqueNm) || nonzero2(action?.angularImpulseNms))) queue.push(index);
    if (body.kind === "kinematic" && action?.positionM && action.positionM.some((value, axis) => value !== body.positionM[axis])) {
      for (const contact of previousContacts) {
        const otherId = contact.aId === body.id ? contact.bId : contact.bId === body.id ? contact.aId : null;
        const other = otherId ? indexById.get(otherId) : void 0;
        if (other !== void 0 && bodies[other].kind === "dynamic") queue.push(other);
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (seen.has(index)) continue;
    seen.add(index);
    bodies[index].sleeping = false;
    sleepFrames[index] = 0;
    for (const other of neighbors[index]) if (!seen.has(other)) queue.push(other);
  }
}
function updateSleeping2(bodies, contacts, sleepFrames) {
  const indexById = new Map(bodies.map((body, index) => [body.id, index]));
  const neighbors = bodies.map(() => []);
  const supported = bodies.map(() => false);
  const movingFixture = bodies.map(() => false);
  for (const contact of contacts) {
    const a = indexById.get(contact.aId);
    const b = indexById.get(contact.bId);
    const left = bodies[a], right = bodies[b];
    if (left.kind === "dynamic" && right.kind === "dynamic") {
      neighbors[a].push(b);
      neighbors[b].push(a);
    } else if (left.kind === "dynamic" || right.kind === "dynamic") {
      const dynamic = left.kind === "dynamic" ? a : b;
      const fixture = left.kind === "dynamic" ? right : left;
      supported[dynamic] = true;
      movingFixture[dynamic] ||= fixture.kind === "kinematic" && Math.hypot(...fixture.velocityMps) > 0;
    }
  }
  const visited = /* @__PURE__ */ new Set();
  for (let index = 0; index < bodies.length; index++) {
    if (bodies[index].kind !== "dynamic" || visited.has(index)) continue;
    const island = [index];
    visited.add(index);
    for (let cursor = 0; cursor < island.length; cursor++) {
      for (const other of neighbors[island[cursor]]) if (!visited.has(other)) {
        visited.add(other);
        island.push(other);
      }
    }
    const asleep = island.filter((member) => bodies[member].sleeping).length;
    if (!island.some((member) => supported[member]) || island.some((member) => movingFixture[member]) || asleep > 0 && asleep < island.length) {
      for (const member of island) {
        bodies[member].sleeping = false;
        sleepFrames[member] = 0;
      }
      continue;
    }
    if (asleep === island.length) continue;
    const atRest = island.every((member) => Math.hypot(...bodies[member].velocityMps) <= LINEAR_REST_MPS2 && Math.hypot(...bodies[member].angularVelocityRadps) <= ANGULAR_REST_RADPS2);
    for (const member of island) sleepFrames[member] = atRest ? sleepFrames[member] + 1 : 0;
    if (island.every((member) => sleepFrames[member] >= REST_STEPS2)) {
      for (const member of island) {
        bodies[member].sleeping = true;
        bodies[member].velocityMps = [0, 0, 0];
        bodies[member].angularVelocityRadps = [0, 0, 0];
      }
    }
  }
}
function publicState2(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt) {
  return {
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor, ccd, collisionFilter: collisionFilter22, sleeping }) => ({
      id,
      kind,
      shape: copyShape2(collider),
      positionM: [...positionM],
      velocityMps: [...velocityMps],
      orientation: [...orientation],
      angularVelocityRadps: [...angularVelocityRadps],
      ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
      ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2: [...inertiaDiagonalKgM2] },
      ...sensor ? { sensor: true } : {},
      ...ccd ? { ccd: true } : {},
      ...collisionFilter22 ? { collisionFilter: { ...collisionFilter22 } } : {},
      ...sleeping !== void 0 ? { sleeping } : {}
    })),
    contacts: contacts.map(({ aId, bId, normalAtoB, pointM, penetrationM, impulseNs, tangentImpulseNs }) => ({
      aId,
      bId,
      normalAtoB: [...normalAtoB],
      pointM: [...pointM],
      penetrationM,
      impulseNs,
      tangentImpulseNs: [...tangentImpulseNs]
    })),
    events: events.map((event) => ({ ...event })),
    joints: joints.map((joint) => ({
      ...joint,
      linearImpulseNs: [...joint.linearImpulseNs],
      angularImpulseNms: [...joint.angularImpulseNms]
    })),
    ccdHits: ccdHits.map((hit) => ({ ...hit, normalFixtureToBody: [...hit.normalFixtureToBody] })),
    pairStats: { ...pairStats }
  };
}
function createPhysicsWorld2(config) {
  const input = record3(config, "world");
  fields2(input, ["fixedStepSeconds", "gravityMps2", "bodies", "joints", "broadPhase", "contactMode", "sceneMode"], "world");
  if (Object.hasOwn(input, "sceneMode") && input.sceneMode !== "large-v1") {
    error2("INVALID_CONFIG", "sceneMode must be large-v1 when present");
  }
  if (Object.hasOwn(input, "broadPhase") && input.broadPhase !== "aabb") {
    error2("INVALID_CONFIG", "broadPhase must be aabb when present");
  }
  if (Object.hasOwn(input, "contactMode") && input.contactMode !== "persistent-box-v1") {
    error2("INVALID_CONFIG", "contactMode must be persistent-box-v1 when present");
  }
  const useAabb = input.broadPhase === "aabb";
  const usePersistentBox = input.contactMode === "persistent-box-v1";
  const largeMode = input.sceneMode === "large-v1";
  if (largeMode && (!useAabb || usePersistentBox || Object.hasOwn(input, "joints"))) {
    error2("INVALID_CONFIG", "large-v1 requires aabb and excludes joints and persistent-box-v1");
  }
  const dt = finite3(input.fixedStepSeconds, 1 / 240, 1 / 30, "fixedStepSeconds");
  const gravity = vector3(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const bodyLimit = largeMode ? MAX_LARGE_BODIES2 : MAX_BODIES2;
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > bodyLimit) {
    error2("INVALID_CONFIG", `bodies must contain 1..${bodyLimit} entries`);
  }
  if (usePersistentBox && input.bodies.length > 4) {
    error2("INVALID_CONFIG", "persistent-box-v1 admits at most four bodies");
  }
  let bodies = input.bodies.map((value) => parseBody2(value, largeMode));
  if (largeMode && bodies.some((body) => body.ccd)) {
    error2("INVALID_CONFIG", "large-v1 excludes CCD");
  }
  if (!bodies.some((body) => body.kind === "dynamic")) error2("INVALID_CONFIG", "at least one dynamic body is required");
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error2("INVALID_CONFIG", "duplicate body ID");
  const joints = parseJoints2(Object.hasOwn(input, "joints") ? input.joints : [], bodies);
  const dynamicHinge = joints.find((joint) => joint.kind === "hinge" && bodies[joint.aIndex].kind === "dynamic");
  if (dynamicHinge) admitDynamicHingeScene2(dynamicHinge, bodies, gravity);
  const ccd = admitCcd2(bodies, joints.length, gravity);
  if (ccd.kind === "box-pair" && usePersistentBox) {
    error2("INVALID_CONFIG", "box CCD excludes persistent-box-v1");
  }
  const disabledPairs = new Set(joints.map((joint) => [bodies[joint.aIndex].id, bodies[joint.bIndex].id].sort().join("\0")));
  const pairs = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if ((bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) && (!largeMode || filterAllowsPair2(bodies[a], bodies[b]))) {
      if (disabledPairs.has([bodies[a].id, bodies[b].id].sort().join("\0"))) continue;
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 : bodies[left[0]].id > bodies[right[0]].id ? 1 : bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  let contacts = [];
  let events = [];
  let ccdHits = [];
  let pairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
  let jointStates = joints.map((joint) => ({
    id: joint.id,
    kind: joint.kind,
    aId: bodies[joint.aIndex].id,
    bId: bodies[joint.bIndex].id,
    linearImpulseNs: [0, 0, 0],
    angularImpulseNms: [0, 0, 0],
    ...joint.kind === "hinge" ? { angleRad: 0 } : {},
    ...joint.motor ? { motorImpulseNms: 0 } : {}
  }));
  let activePairs = /* @__PURE__ */ new Map();
  let persistentPoints = /* @__PURE__ */ new Map();
  let sleepFrames = bodies.map(() => 0);
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => {
    if (disposed) error2("DISPOSED", "world is disposed");
  };
  return {
    getState() {
      ensureActive();
      return publicState2(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error2("INVALID_STEP", "step must equal configured fixedStepSeconds");
      if (stepIndex >= MAX_STEPS2) error2("WORLD_LIMIT", "world step limit reached");
      const actions = parseCommands2(commands, bodies);
      if (dynamicHinge) admitDynamicHingeCommands2(dynamicHinge, bodies, actions);
      if (ccd.kind === "box-pair") rejectAngularBoxCommand2(actions.get(bodies[ccd.boxIndex].id));
      const next = bodies.map(copyBody2);
      const motorImpulses = joints.map(() => 0);
      const nextSleepFrames = sleepFrames.slice();
      if (largeMode) wakeForActions2(next, contacts, actions, nextSleepFrames);
      for (const body of next) {
        if (body.kind !== "dynamic" || largeMode && body.sleeping) continue;
        const action = actions.get(body.id);
        body.angularVelocityRadps = add2(
          body.angularVelocityRadps,
          inverseInertia2(body, add2(
            action?.angularImpulseNms ?? [0, 0, 0],
            scale2(action?.torqueNm ?? [0, 0, 0], dt)
          ))
        );
      }
      for (let index = 0; index < joints.length; index++) {
        const joint = joints[index];
        if (!joint.motor) continue;
        motorImpulses[index] = next[joint.aIndex].kind === "dynamic" ? driveDynamicHingeMotor2(
          joint,
          next[joint.aIndex],
          next[joint.bIndex],
          jointStates[index].angleRad
        ) : driveHingeMotor2(joint, next[joint.bIndex], jointStates[index].angleRad);
      }
      for (let bodyIndex = 0; bodyIndex < next.length; bodyIndex++) {
        const body = next[bodyIndex];
        const action = actions.get(body.id);
        if (body.kind === "kinematic") {
          const target = action?.positionM ?? body.positionM;
          const delta = target.map((value, index) => value - body.positionM[index]);
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M2 || delta.some((value) => Math.abs(value / dt) > 1e3)) {
            error2("NUMERIC_LIMIT", `${body.id} exceeded kinematic movement limit`);
          }
          body.velocityMps = delta.map((value) => value / dt);
          body.positionM = [...target];
        } else if (body.kind === "dynamic") {
          if (largeMode && body.sleeping) continue;
          if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e3) || Math.hypot(...body.angularVelocityRadps) * dt > 10) {
            error2("NUMERIC_LIMIT", `${body.id} exceeded angular movement limit`);
          }
          body.orientation = advanceOrientation2(body.orientation, body.angularVelocityRadps, dt);
          for (let i = 0; i < 3; i++) {
            body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
            body.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * dt;
          }
          if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M2) {
            error2("NUMERIC_LIMIT", `${body.id} exceeded step displacement limit`);
          }
          for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;
        }
      }
      const hit = ccd.kind === "static-boxes" ? sweepSphere2(bodies[ccd.sphereIndex], next[ccd.sphereIndex], ccd.fixtures) : ccd.kind === "sphere-pair" ? sweepSpherePair2(
        bodies[ccd.sphereIndex],
        next[ccd.sphereIndex],
        bodies[ccd.otherIndex],
        next[ccd.otherIndex]
      ) : ccd.kind === "box-pair" ? sweepDynamicBox2(
        bodies[ccd.boxIndex],
        next[ccd.boxIndex],
        next[ccd.fixtureIndex]
      ) : null;
      const nextCcdHits = hit ? [hit] : [];
      const nextPairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
      const found = /* @__PURE__ */ new Map();
      const nextPersistentPoints = /* @__PURE__ */ new Map();
      const sensed = /* @__PURE__ */ new Map();
      const nextJoints = jointStates.map((joint, index) => ({
        ...joint,
        linearImpulseNs: [0, 0, 0],
        angularImpulseNms: [0, 0, 0],
        ...joint.motorImpulseNms === void 0 ? {} : { motorImpulseNms: motorImpulses[index] }
      }));
      const bounds = useAabb ? next.map(bodyBounds) : null;
      for (let pass = 0; pass < SOLVER_PASSES2; pass++) {
        if (bounds && pass > 0) for (let index = 0; index < next.length; index++) {
          if (next[index].kind !== "static") bounds[index] = bodyBounds(next[index]);
        }
        for (const [aIndex, bIndex] of pairs) {
          nextPairStats.eligiblePairs++;
          if (largeMode && pass > 0 && dormantPair2(next[aIndex], next[bIndex])) continue;
          if (bounds) {
            nextPairStats.aabbTests++;
            if (!boundsOverlap(bounds[aIndex], bounds[bIndex])) continue;
          }
          nextPairStats.candidatePairs++;
          const a = next[aIndex], b = next[bIndex];
          const hit2 = detect3(a, b);
          if (!hit2) continue;
          if (hit2.penetration > MAX_STEP_DISPLACEMENT_M2) error2("NUMERIC_LIMIT", "contact penetration exceeded limit");
          const key = `${a.id}\0${b.id}`;
          if (a.sensor || b.sensor) {
            sensed.set(key, { aId: a.id, bId: b.id, kind: "sensor" });
            continue;
          }
          if (largeMode) wakeOnContact2(a, b, nextSleepFrames, aIndex, bIndex);
          let contact = found.get(key);
          if (!contact) {
            contact = {
              aId: a.id,
              bId: b.id,
              normalAtoB: [...hit2.normal],
              pointM: [...hit2.pointM],
              penetrationM: 0,
              impulseNs: 0,
              tangentImpulseNs: [0, 0, 0]
            };
            found.set(key, contact);
          }
          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit2) : null;
          const points = manifold?.map((entry) => entry.pointM) ?? [hit2.pointM];
          contact.pointM = points.reduce((sum, point2) => add2(sum, point2), [0, 0, 0]).map((value) => value / points.length);
          contact.penetrationM = Math.max(contact.penetrationM, hit2.penetration);
          if (largeMode && dormantPair2(a, b)) continue;
          if (manifold) {
            for (const point2 of manifold) {
              const pointKey = `${key}\0${point2.id}`;
              let impulse = nextPersistentPoints.get(pointKey);
              if (!impulse) {
                const prior = persistentPoints.get(pointKey);
                impulse = prior ? { normalNs: prior.normalNs, tangentNs: [...prior.tangentNs] } : { normalNs: 0, tangentNs: [0, 0, 0] };
                nextPersistentPoints.set(pointKey, impulse);
                if (prior) warmStartPoint2(a, b, point2.pointM, hit2.normal, impulse);
              }
            }
            for (let iteration = 0; iteration < 8; iteration++) {
              const order = iteration % 2 ? [...manifold].reverse() : manifold;
              for (const point2 of order) {
                const impulse = nextPersistentPoints.get(`${key}\0${point2.id}`);
                solvePersistentPoint2(a, b, point2.pointM, hit2.normal, impulse);
              }
            }
            correctPersistentPair(a, b, hit2.normal, hit2.penetration);
            contact.impulseNs = 0;
            contact.tangentImpulseNs = [0, 0, 0];
            for (const point2 of manifold) {
              const impulse = nextPersistentPoints.get(`${key}\0${point2.id}`);
              contact.impulseNs += impulse.normalNs;
              contact.tangentImpulseNs = add2(contact.tangentImpulseNs, impulse.tangentNs);
            }
          } else {
            const resolved = solve2(a, b, hit2);
            contact.impulseNs += resolved.normalImpulseNs;
            contact.tangentImpulseNs = add2(contact.tangentImpulseNs, resolved.tangentImpulseNs);
          }
          if (bounds) {
            bounds[aIndex] = bodyBounds(a);
            bounds[bIndex] = bodyBounds(b);
          }
        }
        for (let index = 0; index < joints.length; index++) {
          const reaction = projectJoint2(joints[index], next, bodies, dt);
          nextJoints[index].linearImpulseNs = add2(nextJoints[index].linearImpulseNs, reaction.linearImpulseNs);
          nextJoints[index].angularImpulseNms = add2(nextJoints[index].angularImpulseNms, reaction.angularImpulseNms);
          if (reaction.angleRad !== void 0) nextJoints[index].angleRad = reaction.angleRad;
        }
      }
      const nextContacts = [...found.values()];
      if (largeMode) updateSleeping2(next, nextContacts, nextSleepFrames);
      const nextActive = new Map(sensed);
      for (const contact of nextContacts) {
        nextActive.set(
          `${contact.aId}\0${contact.bId}`,
          { aId: contact.aId, bId: contact.bId, kind: "contact" }
        );
      }
      const nextEvents = [.../* @__PURE__ */ new Set([...activePairs.keys(), ...nextActive.keys()])].sort().map((key) => {
        const current = nextActive.get(key);
        const previous = activePairs.get(key);
        return { ...current ?? previous, phase: current ? previous ? "stay" : "begin" : "end" };
      });
      validateResult2(next, nextContacts);
      if (ccd.kind === "box-pair" && !axisAlignedBox2(next[ccd.boxIndex])) {
        error2("NUMERIC_LIMIT", "box CCD contact rotated outside the admitted profile");
      }
      if (nextJoints.some((joint) => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some((value) => !Number.isFinite(value)) || joint.angleRad !== void 0 && !Number.isFinite(joint.angleRad))) {
        error2("NUMERIC_LIMIT", "unsafe joint reaction");
      }
      for (let index = 0; index < joints.length; index++) {
        const motor = joints[index].motor;
        if (motor && Math.hypot(...nextJoints[index].angularImpulseNms) > motor.maxReactionNms) {
          error2("NUMERIC_LIMIT", `${joints[index].id} exceeded motor reaction limit`);
        }
      }
      bodies = next;
      contacts = nextContacts;
      events = nextEvents;
      jointStates = nextJoints;
      ccdHits = nextCcdHits;
      pairStats = nextPairStats;
      activePairs = nextActive;
      persistentPoints = nextPersistentPoints;
      sleepFrames = nextSleepFrames;
      stepIndex++;
      return publicState2(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    overlapSphere(input2) {
      ensureActive();
      const query = queryRecord2(input2, ["centerM", "radiusM"], ["includeSensors"]);
      const center = queryVector2(query.centerM, 1e4, "centerM");
      const radius = queryNumber2(query.radiusM, 1e-4, 1e3, "radiusM");
      const sensors = includeSensors2(query);
      return bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps2(center, radius, body)).map((body) => body.id).sort();
    },
    raycast(input2) {
      ensureActive();
      const query = queryRecord2(input2, ["originM", "direction", "maxDistanceM"], ["includeSensors"]);
      const origin = queryVector2(query.originM, 1e4, "originM");
      const direction2 = queryVector2(query.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction2) - 1) > 1e-9) {
        error2("INVALID_QUERY", "direction must be a unit 3-vector");
      }
      const limit = queryNumber2(query.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
      const sensors = includeSensors2(query);
      let best = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance2(origin, direction2, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId) {
          best = { bodyId: body.id, distanceM: distance };
        }
      }
      return best;
    },
    dispose() {
      disposed = true;
      bodies = [];
      contacts = [];
      events = [];
      ccdHits = [];
      activePairs.clear();
      persistentPoints.clear();
      sleepFrames = [];
    }
  };
}
var DT = 1 / 120;
var WALKABLE = Math.cos(10 * Math.PI / 180);
export {
  DEFAULT_LIMITS,
  FULL_PAIR_ERRORS,
  FrozenContactIsland,
  FullPairPositionReferenceError,
  GLOBAL_PHASE_MESSAGE,
  MESSAGES,
  PhysicsError,
  adaptContactGeometry,
  applyFullPairTranslationsOnce,
  buildFullPairProblem,
  checkedFullPairInputs,
  compatiblePatch,
  copyBody,
  createPhysicsWorld as createCandidateWorld,
  createPhysicsWorld2 as createOriginalWorld,
  featureContact,
  inspectFullPairHypothesis,
  inspectSignedBoxSAT,
  parseBody,
  runFullPairCore,
  runFullPairPositionPhase,
  solveFullPairPosition,
  validateFullPairProblem,
  validateFullPairResult,
  zeroFullPairPositionStats
};
