// packages/barocss-physics/src/limits.ts
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
var SOLVER_PASSES = 8;

// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

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
  const magnitude2 = Math.hypot(...values);
  if (Math.abs(magnitude2 - 1) > 1e-6) error("INVALID_CONFIG", "orientation must have unit norm");
  return values.map((component) => component / magnitude2);
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
  const inertia2 = inertiaDiagonalKgM2 ?? [inertiaKgM2, inertiaKgM2, inertiaKgM2];
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
    inverseInertiaLocal: inertia2.map((value2) => 1 / value2),
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
  const admitted = /* @__PURE__ */ new Map();
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
    const previous = admitted.get(body.id) ?? {};
    if (Object.hasOwn(previous, valueKey)) error("INVALID_COMMAND", `duplicate ${kind} command for ${body.id}`);
    const bound = kind === "force" ? MAX_FORCE_N : kind === "impulse" ? MAX_IMPULSE_NS : kind === "torque" ? MAX_TORQUE_NM : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS : 1e4;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted;
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
  if (!Object.hasOwn(query, "includeSensors")) return true;
  if (typeof query.includeSensors !== "boolean") error("INVALID_QUERY", "includeSensors must be boolean");
  return query.includeSensors;
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
  const scale3 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale3,
    angularVelocity[1] * scale3,
    angularVelocity[2] * scale3,
    Math.cos(halfAngle)
  ];
  const next = multiplyQuaternion(delta, orientation);
  const norm2 = Math.hypot(...next);
  return next.map((component) => component / norm2);
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
var localPoint = (body, point) => rotate(inverse(body.orientation), sub(point, body.positionM));
var worldPoint = (body, point) => add(body.positionM, rotate(body.orientation, point));
function inverseInertia(body, vector2) {
  const local = rotate(inverse(body.orientation), vector2);
  return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}
function inertia(body, vector2) {
  const local = rotate(inverse(body.orientation), vector2);
  return rotate(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]));
}

// packages/barocss-physics/src/dynamic-anchor-pair.ts
function solvePairMatrix(columns, target) {
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
      error("NUMERIC_LIMIT", "dynamic pair effective mass is singular");
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
    error("NUMERIC_LIMIT", "dynamic pair correction is not finite");
  }
  return result;
}
function applyPairAngle(body, angle2, dt) {
  if (Math.hypot(...angle2) > 1) error("NUMERIC_LIMIT", "dynamic pair angular correction exceeds limit");
  body.orientation = advanceOrientation(body.orientation, angle2, 1);
  body.angularVelocityRadps = add(body.angularVelocityRadps, scale(angle2, 1 / dt));
}
function projectDynamicPairAnchors(a, b, anchorA, anchorB, dt) {
  const armA = rotate(a.orientation, anchorA);
  const armB = rotate(b.orientation, anchorB);
  const separation = sub(worldPoint(b, anchorB), worldPoint(a, anchorA));
  if (Math.hypot(...separation) > MAX_STEP_DISPLACEMENT_M) {
    error("NUMERIC_LIMIT", "dynamic pair anchor separation exceeds limit");
  }
  const basis2 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const columns = basis2.map((axis) => add(
    scale(axis, a.inverseMass + b.inverseMass),
    add(
      cross(inverseInertia(a, cross(armA, axis)), armA),
      cross(inverseInertia(b, cross(armB, axis)), armB)
    )
  ));
  const correction = solvePairMatrix(columns, scale(separation, -1));
  const moveA = scale(correction, -a.inverseMass);
  const moveB = scale(correction, b.inverseMass);
  a.positionM = add(a.positionM, moveA);
  b.positionM = add(b.positionM, moveB);
  a.velocityMps = add(a.velocityMps, scale(moveA, 1 / dt));
  b.velocityMps = add(b.velocityMps, scale(moveB, 1 / dt));
  applyPairAngle(a, scale(inverseInertia(a, cross(armA, correction)), -1), dt);
  applyPairAngle(b, inverseInertia(b, cross(armB, correction)), dt);
}

// packages/barocss-physics/src/dynamic-hinge-joint.ts
var magnitude = (vector2) => Math.hypot(...vector2);
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
    if (!action) continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector2) => vector2 !== void 0).some((vector2) => magnitude(sub(vector2, scale(axis, dot(vector2, axis)))) > 1e-12)) {
      error("INVALID_COMMAND", "dynamic hinge admits axis-aligned angular commands only");
    }
  }
}
function projectDynamicHingeJoint(joint, bodies, dt) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const axis = joint.axisWorld;
  const beforeLinear = [...b.velocityMps];
  const beforeAngular = [...b.angularVelocityRadps];
  const relative = multiplyQuaternion(b.orientation, inverse(a.orientation));
  const signed = dot([relative[0], relative[1], relative[2]], axis);
  if (magnitude(sub([relative[0], relative[1], relative[2]], scale(axis, signed))) > 1e-8) {
    error("NUMERIC_LIMIT", "dynamic hinge left its planar axis");
  }
  const raw = 2 * Math.atan2(signed, relative[3]);
  const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
  const angleRad = Math.max(joint.limitRad[0], Math.min(joint.limitRad[1], wrapped));
  const inverseA = dot(axis, inverseInertia(a, axis));
  const inverseB = dot(axis, inverseInertia(b, axis));
  const inverseSum = inverseA + inverseB;
  const excess = wrapped - angleRad;
  if (excess !== 0) {
    const angleA = excess * inverseA / inverseSum;
    const angleB = -excess * inverseB / inverseSum;
    a.orientation = advanceOrientation(a.orientation, scale(axis, angleA), 1);
    b.orientation = advanceOrientation(b.orientation, scale(axis, angleB), 1);
    a.angularVelocityRadps = add(a.angularVelocityRadps, scale(axis, angleA / dt));
    b.angularVelocityRadps = add(b.angularVelocityRadps, scale(axis, angleB / dt));
  }
  const relativeSpeed = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  if (angleRad === joint.limitRad[0] && relativeSpeed < 0 || angleRad === joint.limitRad[1] && relativeSpeed > 0) {
    const impulse = -relativeSpeed / inverseSum;
    a.angularVelocityRadps = sub(
      a.angularVelocityRadps,
      inverseInertia(a, scale(axis, impulse))
    );
    b.angularVelocityRadps = add(
      b.angularVelocityRadps,
      inverseInertia(b, scale(axis, impulse))
    );
  }
  projectDynamicPairAnchors(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular)),
    angleRad
  };
}

// packages/barocss-physics/src/capsule-contact.ts
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
function segmentBox(segmentStart, segmentEnd, extents) {
  const direction = sub(segmentEnd, segmentStart);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) < 1e-15) continue;
    for (const face of [-extents[axis], extents[axis]]) {
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
      const face = value < -extents[axis] ? -extents[axis] : value > extents[axis] ? extents[axis] : null;
      if (face === null) continue;
      numerator += direction[axis] * (segmentStart[axis] - face);
      denominator += direction[axis] ** 2;
    }
    const t = clamp(denominator ? -numerator / denominator : 0.5, low, high);
    const point2 = add(segmentStart, scale(direction, t));
    const nearest = point2.map((value, axis) => clamp(value, -extents[axis], extents[axis]));
    const delta = sub(point2, nearest), distance = dot(delta, delta);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(bestT - 0.5)) {
      bestT = t;
      bestDistance = distance;
    }
  }
  const point = add(segmentStart, scale(direction, bestT));
  return [point, point.map((value, axis) => clamp(value, -extents[axis], extents[axis]))];
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
  const [start, end] = capsuleEnds(capsule).map((point) => localPoint(box, point));
  const extents = box.shape.halfExtentsM;
  const [axisPoint, boxPoint] = segmentBox(start, end, extents);
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
    const gap = extents[axis] - side * axisPoint[axis];
    if (gap < bestGap) {
      bestGap = gap;
      bestAxis = axis;
      bestSide = side;
    }
  }
  const normalLocal = [0, 0, 0];
  normalLocal[bestAxis] = -bestSide;
  boxPoint[bestAxis] = bestSide * extents[bestAxis];
  return {
    normal: rotate(box.orientation, normalLocal),
    penetration: radius + bestGap,
    pointM: worldPoint(box, boxPoint)
  };
}

// packages/barocss-physics/src/collision.ts
function capsuleCenter(body, point) {
  const half = body.shape.halfLengthM;
  const local = localPoint(body, point);
  return worldPoint(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport(body, direction) {
  const axes = boxAxes(body);
  const extents = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents[index] : -extents[index];
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
  const extents = box.shape.halfExtentsM;
  const relative = localPoint(box, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents[index], Math.min(extents[index], value)));
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
    const gap = extents[index] - candidate * relative[index];
    if (gap < faceDistance) {
      faceDistance = gap;
      axis = index;
      side = candidate;
    }
  }
  const localNormal = [0, 0, 0];
  localNormal[axis] = -side;
  nearest[axis] = side * extents[axis];
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
function sphereOverlaps(center, radius, body) {
  if (body.shape.kind === "sphere") {
    return Math.hypot(...sub(center, body.positionM)) <= radius + body.shape.radiusM;
  }
  if (body.shape.kind === "capsule") {
    return Math.hypot(...sub(center, capsuleCenter(body, center))) <= radius + body.shape.radiusM;
  }
  const extents = body.shape.halfExtentsM;
  const local = localPoint(body, center);
  const delta = local.map((value, index) => Math.max(0, Math.abs(value) - extents[index]));
  return Math.hypot(...delta) <= radius;
}
function raySphere(origin, direction, center, radius) {
  const relative = sub(origin, center);
  const c = dot(relative, relative) - radius ** 2;
  if (c <= 0) return 0;
  const projection = dot(relative, direction);
  const discriminant = projection ** 2 - c;
  return projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
}
function rayDistance(origin, direction, body) {
  if (body.shape.kind === "sphere") return raySphere(origin, direction, body.positionM, body.shape.radiusM);
  const localOrigin = localPoint(body, origin);
  const localDirection = rotate(inverse(body.orientation), direction);
  if (body.shape.kind === "capsule") {
    const { radiusM: radius, halfLengthM: half } = body.shape;
    const closest = [0, Math.max(-half, Math.min(half, localOrigin[1])), 0];
    if (Math.hypot(...sub(localOrigin, closest)) <= radius) return 0;
    const results = [];
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
  let near2 = -Infinity, far = Infinity;
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
    near2 = Math.max(near2, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (far < near2) return null;
  }
  return far < 0 ? null : Math.max(0, near2);
}
function solve(a, b, hit) {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0) return { normalImpulseNs: 0, tangentImpulseNs: [0, 0, 0] };
  const armA = sub(hit.pointM, a.positionM), armB = sub(hit.pointM, b.positionM);
  const pointVelocityA = add(a.velocityMps, cross(a.angularVelocityRadps, armA));
  const pointVelocityB = add(b.velocityMps, cross(b.angularVelocityRadps, armB));
  const relativeSpeed = dot(hit.normal, sub(pointVelocityB, pointVelocityA));
  const torqueAxisA = cross(armA, hit.normal), torqueAxisB = cross(armB, hit.normal);
  const effectiveMass = inverseTotal + dot(torqueAxisA, inverseInertia(a, torqueAxisA)) + dot(torqueAxisB, inverseInertia(b, torqueAxisB));
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
  const tangentMass = inverseTotal + dot(tangentAxisA, inverseInertia(a, tangentAxisA)) + dot(tangentAxisB, inverseInertia(b, tangentAxisB));
  const required = speed / tangentMass;
  const dynamicFriction = Math.sqrt(a.frictionDynamic * b.frictionDynamic);
  const magnitude2 = required <= staticFriction * impulse ? required : Math.min(required, dynamicFriction * impulse);
  const tangentImpulse = scale(direction, -magnitude2);
  a.velocityMps = sub(a.velocityMps, scale(tangentImpulse, a.inverseMass));
  b.velocityMps = add(b.velocityMps, scale(tangentImpulse, b.inverseMass));
  a.angularVelocityRadps = sub(
    a.angularVelocityRadps,
    inverseInertia(a, cross(frictionArmA, tangentImpulse))
  );
  b.angularVelocityRadps = add(
    b.angularVelocityRadps,
    inverseInertia(b, cross(frictionArmB, tangentImpulse))
  );
  return { normalImpulseNs: impulse, tangentImpulseNs: tangentImpulse };
}
function validateResult(bodies, contacts) {
  for (const body of bodies) {
    for (const [label, values, bound] of [
      ["position", body.positionM, 1e4],
      ["velocity", body.velocityMps, 1e3],
      ["angularVelocity", body.angularVelocityRadps, 1e3]
    ]) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound)) error("NUMERIC_LIMIT", `${body.id} ${label} exceeded bounds`);
    }
    if (body.orientation.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body.orientation) - 1) > 1e-12) error("NUMERIC_LIMIT", `${body.id} orientation exceeded tolerance`);
  }
  if (contacts.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) || contact.normalAtoB.some((value) => !Number.isFinite(value)) || contact.pointM.some((value) => !Number.isFinite(value)) || contact.tangentImpulseNs.some((value) => !Number.isFinite(value)))) error("NUMERIC_LIMIT", "unsafe contact result");
}

// examples/physics-rigid-hinge-motor-reference/copy.ts
function copyData(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => copyData(item));
  const copied = {};
  for (const key of Object.keys(value)) {
    Object.defineProperty(copied, key, {
      value: copyData(value[key]),
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  return copied;
}
function ownData(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((k) => typeof k !== "string" || !keys.includes(k))) return null;
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
    Object.defineProperty(result, key, { value: descriptor.value, enumerable: true, configurable: true, writable: true });
  }
  return result;
}
function denseNumbers(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length || Reflect.ownKeys(value).length !== length + 1) return null;
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value)) return null;
    result.push(descriptor.value);
  }
  return result;
}

// packages/barocss-physics/src/dynamic-fixed-joint.ts
function orientationError(actual, desired) {
  const relative = multiplyQuaternion(actual, inverse(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector2 = scale([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector2);
  if (sine < 1e-12) return scale(vector2, 2);
  return scale(vector2, 2 * Math.atan2(sine, sign * relative[3]) / sine);
}
function projectDynamicFixedJoint(joint, bodies, dt) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const beforeLinear = [...b.velocityMps];
  const beforeAngular = [...b.angularVelocityRadps];
  const desired = multiplyQuaternion(a.orientation, joint.referenceOrientation);
  const angularError = orientationError(b.orientation, desired);
  if (Math.hypot(...angularError) > 1) {
    error("NUMERIC_LIMIT", "dynamic fixed joint relative orientation exceeds limit");
  }
  const basis2 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const angularColumns = basis2.map((axis) => add(inverseInertia(a, axis), inverseInertia(b, axis)));
  const angularImpulse = solvePairMatrix(angularColumns, scale(angularError, -1));
  applyPairAngle(a, scale(inverseInertia(a, angularImpulse), -1), dt);
  applyPairAngle(b, inverseInertia(b, angularImpulse), dt);
  projectDynamicPairAnchors(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular))
  };
}

// packages/barocss-physics/src/joints.ts
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
    if (input.kind !== "fixed" && input.kind !== "hinge") error("INVALID_CONFIG", "unsupported joint kind");
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
      if (Math.abs(Math.hypot(...axisWorld) - 1) > 1e-9) error("INVALID_CONFIG", "hinge axis must be unit length");
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
function projectJoint(joint, next, previous, dt) {
  const a = next[joint.aIndex], b = next[joint.bIndex];
  if (a.kind === "dynamic") return joint.kind === "fixed" ? projectDynamicFixedJoint(joint, next, dt) : projectDynamicHingeJoint(joint, next, dt);
  const beforeVelocity = [...b.velocityMps];
  const beforeAngular = [...b.angularVelocityRadps];
  let targetOrientation, angleRad;
  if (joint.kind === "fixed") {
    targetOrientation = multiplyQuaternion(a.orientation, joint.referenceOrientation);
    b.angularVelocityRadps = [0, 0, 0];
  } else {
    const axis = joint.axisWorld;
    const delta = multiplyQuaternion(b.orientation, inverse(joint.referenceOrientation));
    const signed = dot([delta[0], delta[1], delta[2]], axis);
    const raw = 2 * Math.atan2(signed, delta[3]);
    const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
    angleRad = Math.max(joint.limitRad[0], Math.min(joint.limitRad[1], wrapped));
    const half = angleRad / 2;
    targetOrientation = multiplyQuaternion([
      axis[0] * Math.sin(half),
      axis[1] * Math.sin(half),
      axis[2] * Math.sin(half),
      Math.cos(half)
    ], joint.referenceOrientation);
    let speed = dot(b.angularVelocityRadps, axis);
    if (angleRad === joint.limitRad[0] && speed < 0 || angleRad === joint.limitRad[1] && speed > 0) speed = 0;
    b.angularVelocityRadps = scale(axis, speed);
  }
  const norm2 = Math.hypot(...targetOrientation);
  b.orientation = targetOrientation.map((value) => value / norm2);
  const targetPosition = sub(worldPoint(a, joint.anchorALocalM), rotate(b.orientation, joint.anchorBLocalM));
  if (Math.hypot(...sub(targetPosition, b.positionM)) > MAX_STEP_DISPLACEMENT_M) {
    error("NUMERIC_LIMIT", `${joint.id} projection exceeded movement limit`);
  }
  b.positionM = targetPosition;
  b.velocityMps = scale(sub(targetPosition, previous[joint.bIndex].positionM), 1 / dt);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeVelocity), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular)),
    ...angleRad === void 0 ? {} : { angleRad }
  };
}

// examples/physics-rigid-hinge-limit-diagnostic/adapter.ts
var PAIR_MESSAGE = "private hinge diagnostic requires an admitted archived pair";
var POSE_MESSAGE = "private hinge diagnostic requires finite unit raw poses within original bounds";
function dense(value, size, bound) {
  return Array.isArray(value) && value.length === size && Array.from({ length: size }, (_, i) => i).every((i) => Object.hasOwn(value, i) && typeof value[i] === "number" && Number.isFinite(value[i]) && Math.abs(value[i]) <= bound);
}
function same(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function preparePair(config, state) {
  if (!config || !state || !Array.isArray(config.bodies) || config.bodies.length !== 2 || !Array.isArray(config.joints) || config.joints.length !== 1 || !Array.isArray(state.bodies) || state.bodies.length !== 2 || !Array.isArray(state.joints) || state.joints.length !== 1) error("INVALID_CONFIG", PAIR_MESSAGE);
  for (const [array, size] of [[config.bodies, 2], [config.joints, 1]]) if (!Array.from({ length: size }, (_, i) => i).every((i) => Object.hasOwn(array, i) && array[i] !== null && typeof array[i] === "object")) error("INVALID_CONFIG", PAIR_MESSAGE);
  if (Object.hasOwn(config, "gravityMps2") && (!dense(config.gravityMps2, 3, 1e3) || !same(config.gravityMps2, [0, 0, 0])) || Object.hasOwn(config, "fixedStepSeconds") && config.fixedStepSeconds !== 1 / 120) error("INVALID_CONFIG", PAIR_MESSAGE);
  if (config.bodies.some((b2) => Object.hasOwn(b2, "inertiaKgM2"))) error("INVALID_CONFIG", PAIR_MESSAGE);
  const bodies = config.bodies.map((b2) => parseBody(b2, false));
  const [a, b] = bodies, group = /^pairA([01])$/.exec(a.id);
  if (!group || b.id !== `pairB${group[1]}` || bodies.some((body) => body.kind !== "dynamic" || body.shape.kind !== "sphere" || body.shape.radiusM !== 0.1 || body.inverseMass !== 1 || body.inertiaKgM2 !== 0.4 * 0.1 ** 2 || body.restitution !== 0 || body.frictionStatic !== 1 || body.frictionDynamic !== 0.7 || body.ccd || body.sensor || body.collisionFilter || !same(body.velocityMps, [0, 0, 0]) || !same(body.angularVelocityRadps, [0, 0, 0]) || !same(body.orientation, [0, 0, 0, 1]))) error("INVALID_CONFIG", PAIR_MESSAGE);
  const origin = a.positionM[2];
  if (origin !== 0 && origin !== Number(group[1]) || !same(a.positionM, [-0.1, 0, origin]) || !same(b.positionM, [0.1, 0, origin])) error("INVALID_CONFIG", PAIR_MESSAGE);
  const joint = parseJoints(config.joints, bodies)[0];
  if (joint.id !== `hinge${group[1]}` || joint.kind !== "hinge" || joint.aIndex !== 0 || joint.bIndex !== 1 || !same(joint.anchorALocalM, [0.1, 0, 0]) || !same(joint.anchorBLocalM, [-0.1, 0, 0]) || !same(joint.axisWorld, [0, 0, 1]) || !same(joint.limitRad, [-0.8, 0.8]) || joint.motor?.targetSpeedRadps !== 0.5 || joint.motor.maxImpulseNms !== 1e-4 || joint.motor.maxReactionNms !== 0.01) error("INVALID_CONFIG", PAIR_MESSAGE);
  const report = state.joints[0];
  if (!report || report.id !== joint.id || report.kind !== "hinge" || report.aId !== a.id || report.bId !== b.id || typeof report.angleRad !== "number" || !Number.isFinite(report.angleRad)) error("INVALID_CONFIG", PAIR_MESSAGE);
  for (let index = 0; index < 2; index++) {
    const archived = state.bodies[index], body = bodies[index];
    if (!archived || archived.id !== body.id || archived.kind !== "dynamic" || archived.shape?.kind !== "sphere" || archived.shape.radiusM !== 0.1 || archived.inertiaKgM2 !== void 0 && archived.inertiaKgM2 !== body.inertiaKgM2) error("INVALID_CONFIG", PAIR_MESSAGE);
    if (!dense(archived.positionM, 3, 1e4) || !dense(archived.velocityMps, 3, 1e3) || !dense(archived.orientation, 4, 1) || !dense(archived.angularVelocityRadps, 3, 1e3) || Math.abs(Math.hypot(...archived.orientation) - 1) > 1e-9) error("INVALID_CONFIG", POSE_MESSAGE);
    body.positionM = [...archived.positionM];
    body.velocityMps = [...archived.velocityMps];
    body.orientation = [...archived.orientation];
    body.angularVelocityRadps = [...archived.angularVelocityRadps];
  }
  return { bodies, joint, reportedAngleRad: report.angleRad };
}

// examples/physics-rigid-coupled-hinge-reference/profile.ts
var ERRORS = { dt: "private coupled hinge step must equal 1/120", profile: "private coupled hinge profile is unsupported", pose: "private coupled hinge archived pose is invalid", result: "private coupled hinge result is invalid" };
var DT = 1 / 120;
function denseDataArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => i).every((i) => Object.hasOwn(value, i));
}
function profileError() {
  return error("INVALID_CONFIG", ERRORS.profile);
}
function poseError() {
  return error("NUMERIC_LIMIT", ERRORS.pose);
}
function data(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return denseDataArray(value) && value.every(data);
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === "string" && d !== void 0 && "value" in d && data(d.value);
  });
}
function copyCarrier(input) {
  if (!input || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null || !data(input)) poseError();
  if (!Number.isInteger(input.stepIndex) || input.stepIndex < 0 || input.stepIndex > 3600 || typeof input.timeSeconds !== "number" || input.timeSeconds !== input.stepIndex * DT) poseError();
  for (const field of ["bodies", "contacts", "events", "joints", "ccdHits"]) if (!denseDataArray(input[field])) poseError();
  if (input.bodies.length !== 2 || input.joints.length !== 1 || !input.pairStats || !["eligiblePairs", "candidatePairs", "aabbTests"].every((key) => {
    const v = input.pairStats[key];
    return typeof v === "number" && Number.isInteger(v) && v >= 0;
  })) poseError();
  return structuredClone(input);
}

// examples/physics-rigid-coupled-hinge-reference/admission.ts
function structural(config) {
  const input = record(config, "world");
  fields(input, ["fixedStepSeconds", "gravityMps2", "bodies", "joints", "broadPhase", "contactMode", "sceneMode"], "world");
  if (Object.hasOwn(input, "sceneMode") && input.sceneMode !== "large-v1") error("INVALID_CONFIG", "sceneMode must be large-v1 when present");
  if (Object.hasOwn(input, "broadPhase") && input.broadPhase !== "aabb") error("INVALID_CONFIG", "broadPhase must be aabb when present");
  if (Object.hasOwn(input, "contactMode") && input.contactMode !== "persistent-box-v1") error("INVALID_CONFIG", "contactMode must be persistent-box-v1 when present");
  const largeMode = input.sceneMode === "large-v1", persistent = input.contactMode === "persistent-box-v1";
  if (largeMode && (input.broadPhase !== "aabb" || persistent || Object.hasOwn(input, "joints"))) error("INVALID_CONFIG", "large-v1 requires aabb and excludes joints and persistent-box-v1");
  finite(input.fixedStepSeconds, 1 / 240, 1 / 30, "fixedStepSeconds");
  vector(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const bodyLimit = largeMode ? MAX_LARGE_BODIES : MAX_BODIES;
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > bodyLimit) error("INVALID_CONFIG", `bodies must contain 1..${bodyLimit} entries`);
  if (persistent && input.bodies.length > 4) error("INVALID_CONFIG", "persistent-box-v1 admits at most four bodies");
  if (!denseDataArray(input.bodies)) profileError();
  const bodies = input.bodies.map((b) => parseBody(b, largeMode));
  if (largeMode && bodies.some((b) => b.ccd)) error("INVALID_CONFIG", "large-v1 excludes CCD");
  if (!bodies.some((b) => b.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (new Set(bodies.map((b) => b.id)).size !== bodies.length) error("INVALID_CONFIG", "duplicate body ID");
  const joints = parseJoints(Object.hasOwn(input, "joints") ? input.joints : [], bodies);
  return { input, bodies, joints };
}
function knownBridge(phase, action) {
  try {
    return action();
  } catch (caught) {
    if (caught instanceof PhysicsError && caught.code === "INVALID_CONFIG" && (caught.message === PAIR_MESSAGE || caught.message === POSE_MESSAGE)) {
      if (phase === "profile") profileError();
      else poseError();
    }
    throw caught;
  }
}
function admit(config, state, dt) {
  if (dt !== DT) error("INVALID_STEP", ERRORS.dt);
  const parsed = structural(config);
  if (parsed.bodies.length !== 2 || parsed.joints.length !== 1 || parsed.joints[0].kind !== "hinge" || parsed.input.fixedStepSeconds !== DT || ["sceneMode", "broadPhase", "contactMode"].some((key) => Object.hasOwn(parsed.input, key))) profileError();
  const copiedConfig = structuredClone(config), joint = parsed.joints[0];
  const resting = { bodies: parsed.bodies, joints: [{ id: joint.id, kind: joint.kind, aId: parsed.bodies[joint.aIndex].id, bId: parsed.bodies[joint.bIndex].id, angleRad: 0 }] };
  knownBridge("profile", () => preparePair(copiedConfig, resting));
  const carrier = copyCarrier(state);
  const prepared = knownBridge("pose", () => preparePair(copiedConfig, carrier));
  return { bodies: prepared.bodies, joint: prepared.joint, carrier, config: copiedConfig };
}

// examples/physics-rigid-hinge-velocity-reference/profile.ts
var DT2 = 1 / 120;
var ERRORS2 = {
  dt: "private hinge velocity step must equal 1/120",
  profile: "private hinge velocity profile is unsupported",
  pose: "private hinge velocity archived pose is invalid",
  result: "private hinge velocity result is invalid",
  linear: "private hinge velocity linear data is invalid",
  system: "private hinge velocity system is singular or unsafe",
  certificate: "private hinge velocity certificate is invalid"
};
var GATE = 1e-10;
function fail(kind) {
  return error("NUMERIC_LIMIT", ERRORS2[kind]);
}
function exactFields(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every((k) => typeof k === "string" && keys.includes(k) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), "value"));
}
function dense2(value, size) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === size && Reflect.ownKeys(value).length === size + 1 && Array.from({ length: size }, (_, i) => i).every((i) => Object.hasOwn(value, i) && typeof value[i] === "number" && Number.isFinite(value[i]));
}
function matrix(value, rows, columns) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === rows && Reflect.ownKeys(value).length === rows + 1 && Array.from({ length: rows }, (_, i) => i).every((i) => Object.hasOwn(value, i) && dense2(value[i], columns));
}
function finiteData(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return Object.getPrototypeOf(value) === Array.prototype && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => i).every((i) => Object.hasOwn(value, i) && finiteData(value[i]));
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Reflect.ownKeys(value).every((k) => typeof k === "string" && finiteData(value[k]));
}
function bridge(action) {
  try {
    return action();
  } catch (thrown) {
    if (thrown instanceof PhysicsError) {
      if (thrown.code === "INVALID_CONFIG" && thrown.message === ERRORS.profile) error("INVALID_CONFIG", ERRORS2.profile);
      if (thrown.code === "NUMERIC_LIMIT" && thrown.message === ERRORS.pose) error("NUMERIC_LIMIT", ERRORS2.pose);
      if (thrown.code === "NUMERIC_LIMIT" && thrown.message === ERRORS.result) error("NUMERIC_LIMIT", ERRORS2.result);
    }
    throw thrown;
  }
}
function prepareInput(config, state, dt) {
  if (dt !== DT2) error("INVALID_STEP", ERRORS2.dt);
  return bridge(() => admit(config, state, dt));
}
function readProblem(value) {
  if (!exactFields(value, ["a", "b", "h", "y0", "stopKind", "stopRow"]) || !matrix(value.a, 11, 12) || !dense2(value.b, 11) || !dense2(value.h, 12) || value.h.some((x) => x <= 0) || !dense2(value.y0, 12)) fail("linear");
  if (value.stopKind !== "none" && value.stopKind !== "upper" && value.stopKind !== "lower") fail("linear");
  if (!dense2(value.stopRow, value.stopKind === "none" ? 0 : 12)) fail("linear");
  return structuredClone(value);
}

// examples/physics-rigid-hinge-motor-reference/errors.ts
var ERRORS3 = {
  ...ERRORS2,
  options: "private hinge motor options are invalid",
  reaction: "unsafe joint reaction",
  diagnostics: "private hinge motor diagnostics are invalid"
};
function reactionError() {
  throw new PhysicsError("NUMERIC_LIMIT", ERRORS3.reaction);
}

// examples/physics-rigid-hinge-motor-reference/report.ts
var REPORT_KEYS = ["id", "kind", "aId", "bId", "angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms"];
var nonempty = (value) => typeof value === "string" && value.length > 0;
var finite2 = (value) => typeof value === "number" && Number.isFinite(value);
function validateHingeMotorReport(value, identity) {
  const ids = ownData(identity, ["id", "aId", "bId"]);
  const report = ownData(value, REPORT_KEYS);
  if (!ids || !nonempty(ids.id) || !nonempty(ids.aId) || !nonempty(ids.bId) || !report || report.id !== ids.id || report.aId !== ids.aId || report.bId !== ids.bId || report.kind !== "hinge" || !finite2(report.angleRad) || !finite2(report.motorImpulseNms)) reactionError();
  const linear = denseNumbers(report.linearImpulseNs, 3), angular = denseNumbers(report.angularImpulseNms, 3);
  if (!linear || !angular) reactionError();
  return {
    id: ids.id,
    kind: "hinge",
    aId: ids.aId,
    bId: ids.bId,
    angleRad: report.angleRad,
    linearImpulseNs: linear,
    angularImpulseNms: angular,
    motorImpulseNms: report.motorImpulseNms
  };
}
function enforceHingeMotorReactionCap(jointId, angularImpulseNms) {
  const vector2 = denseNumbers(angularImpulseNms, 3);
  if (!nonempty(jointId) || !vector2) reactionError();
  const norm2 = Math.hypot(...vector2);
  if (!Number.isFinite(norm2)) reactionError();
  if (norm2 > 0.01) throw new PhysicsError("NUMERIC_LIMIT", `${jointId} exceeded motor reaction limit`);
}
function bodyCorrections(free, projected) {
  return projected.map((body, i) => ({
    bodyId: body.id,
    linearImpulseNs: scale(sub(body.velocityMps, free[i].velocityMps), 1 / free[i].inverseMass),
    angularImpulseNms: scale(sub(body.angularVelocityRadps, free[i].angularVelocityRadps), free[i].inertiaKgM2)
  }));
}
function makeReport(joint, free, projected, targetAngleRad, motorImpulseNms) {
  const corrections = bodyCorrections(free, projected);
  for (const c of corrections) if (!denseNumbers(c.linearImpulseNs, 3) || !denseNumbers(c.angularImpulseNms, 3)) reactionError();
  const identity = { id: joint.id, aId: free[joint.aIndex].id, bId: free[joint.bIndex].id };
  const b = corrections[joint.bIndex];
  const jointReport = validateHingeMotorReport({
    ...identity,
    kind: "hinge",
    angleRad: targetAngleRad,
    linearImpulseNs: [...b.linearImpulseNs],
    angularImpulseNms: [...b.angularImpulseNms],
    motorImpulseNms
  }, identity);
  const angularReactionNormNms = Math.hypot(...b.angularImpulseNms);
  if (!Number.isFinite(angularReactionNormNms)) reactionError();
  return {
    jointReport,
    bodyCorrections: copyData(corrections),
    reportCap: { angularReactionNormNms, maxReactionNms: 0.01, exceedsCap: angularReactionNormNms > 0.01 }
  };
}

// packages/barocss-physics/src/ccd-slab.ts
function sweepBox(start, end, halfExtents) {
  if (start.every((value, axis) => Math.abs(value) <= halfExtents[axis])) return null;
  const travel = sub(end, start);
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
    const near2 = Math.min(first, second);
    const far = Math.max(first, second);
    if (near2 > entry) {
      entry = near2;
      normalLocal = [0, 0, 0];
      normalLocal[axis] = velocity > 0 ? -1 : 1;
    }
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return normalLocal && entry <= 1 && exit >= 0 ? { fraction: entry, normalLocal } : null;
}

// packages/barocss-physics/src/ccd-box.ts
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
  if (previous.shape.kind !== "box" || fixture.shape.kind !== "box") return null;
  const fixtureHalfExtents = fixture.shape.halfExtentsM;
  const expanded = previous.shape.halfExtentsM.map((extent, axis) => extent + fixtureHalfExtents[axis]);
  const start = sub(previous.positionM, fixture.positionM);
  const end = sub(candidate.positionM, fixture.positionM);
  const hit = sweepBox(start, end, expanded);
  if (!hit) return null;
  const travel = sub(candidate.positionM, previous.positionM);
  candidate.positionM = sub(
    add(previous.positionM, scale(travel, hit.fraction)),
    scale(hit.normalLocal, 1e-9)
  );
  return {
    bodyId: previous.id,
    fixtureId: fixture.id,
    toiFraction: hit.fraction,
    normalFixtureToBody: hit.normalLocal
  };
}

// packages/barocss-physics/src/ccd.ts
function admitCcd(bodies, jointCount, gravity) {
  const selected2 = bodies.filter((body) => body.ccd);
  if (selected2.length === 0) return { kind: "none" };
  const sphereIndex = bodies.findIndex((body) => body.ccd);
  if (selected2.length === 1 && bodies.length === 2 && jointCount === 0 && gravity.every((component) => component === 0) && bodies.every((body) => body.kind === "dynamic" && body.shape.kind === "sphere" && !body.sensor)) {
    return { kind: "sphere-pair", sphereIndex, otherIndex: 1 - sphereIndex };
  }
  if (selected2.length === 1 && selected2[0].shape.kind === "box" && bodies.length === 2 && jointCount === 0) {
    const fixtureIndex = 1 - sphereIndex;
    if (bodies[sphereIndex].kind === "dynamic" && bodies[fixtureIndex].kind === "static" && !bodies[fixtureIndex].sensor && axisAlignedBox(bodies[sphereIndex]) && axisAlignedBox(bodies[fixtureIndex])) {
      return { kind: "box-pair", boxIndex: sphereIndex, fixtureIndex };
    }
  }
  const fixtures = bodies.filter((body) => body.kind === "static" && !body.sensor && body.shape.kind === "box");
  if (selected2.length !== 1 || bodies.length !== fixtures.length + 1 || bodies.filter((body) => body.kind === "dynamic").length !== 1 || fixtures.length < 1 || fixtures.length > 8 || jointCount !== 0) {
    error("INVALID_CONFIG", "unsupported CCD body pair or world profile");
  }
  if (selected2[0].shape.kind !== "sphere") {
    error("INVALID_CONFIG", "static-box CCD requires a dynamic sphere");
  }
  return {
    kind: "static-boxes",
    sphereIndex,
    fixtures: fixtures.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  };
}
function sweepSphere(previous, candidate, fixtures) {
  if (previous.shape.kind !== "sphere") return null;
  const radius = previous.shape.radiusM;
  const travel = sub(candidate.positionM, previous.positionM);
  let earliest = null;
  for (const fixture of fixtures) {
    if (fixture.shape.kind !== "box") continue;
    const expanded = fixture.shape.halfExtentsM.map((extent) => extent + radius);
    const hit = sweepBox(localPoint(fixture, previous.positionM), localPoint(fixture, candidate.positionM), expanded);
    if (!hit || earliest && hit.fraction >= earliest.toiFraction) continue;
    earliest = {
      bodyId: previous.id,
      fixtureId: fixture.id,
      toiFraction: hit.fraction,
      normalFixtureToBody: rotate(fixture.orientation, hit.normalLocal)
    };
  }
  if (earliest) {
    candidate.positionM = sub(
      add(previous.positionM, scale(travel, earliest.toiFraction)),
      scale(earliest.normalFixtureToBody, 1e-9)
    );
  }
  return earliest;
}

// examples/physics-rigid-hinge-velocity-world-reference/copy.ts
function copyData2(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => copyData2(item));
  const copied = {};
  for (const key of Object.keys(value)) {
    Object.defineProperty(copied, key, {
      value: copyData2(value[key]),
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  return copied;
}
function copyBodies(bodies) {
  return [copyBody(bodies[0]), copyBody(bodies[1]), copyBody(bodies[2]), copyBody(bodies[3])];
}
function copyPair(bodies) {
  return [copyBody(bodies[0]), copyBody(bodies[1])];
}

// examples/physics-rigid-hinge-velocity-world-reference/errors.ts
var WORLD_ERRORS = {
  profile: "private hinge velocity World profile is unsupported",
  options: "private hinge velocity World options are invalid",
  contact: "private hinge velocity World contact profile is unsupported",
  diagnostics: "private hinge velocity World diagnostics are invalid",
  result: "private hinge velocity World result is invalid"
};
function worldFailure(kind) {
  throw new PhysicsError(kind === "profile" || kind === "options" ? "INVALID_CONFIG" : "NUMERIC_LIMIT", WORLD_ERRORS[kind]);
}
function knownWorldCalculationError(value, bodies) {
  try {
    if (!(value instanceof PhysicsError)) return null;
    const code = Object.getOwnPropertyDescriptor(value, "code");
    const message = Object.getOwnPropertyDescriptor(value, "message");
    const name = Object.getOwnPropertyDescriptor(value, "name");
    if (!code || !message || !name || !("value" in code) || !("value" in message) || !("value" in name) || name.value !== "PhysicsError" || typeof message.value !== "string") return null;
    const numeric = [
      ERRORS2.pose,
      ERRORS2.result,
      ERRORS2.linear,
      ERRORS2.system,
      ERRORS2.certificate,
      WORLD_ERRORS.contact,
      WORLD_ERRORS.diagnostics,
      WORLD_ERRORS.result,
      "contact penetration exceeded limit",
      "unsafe contact result",
      "unsafe joint reaction",
      ...bodies.flatMap((body) => [
        `${body.id} exceeded angular movement limit`,
        `${body.id} exceeded step displacement limit`,
        `${body.id} position exceeded bounds`,
        `${body.id} velocity exceeded bounds`,
        `${body.id} angularVelocity exceeded bounds`,
        `${body.id} orientation exceeded tolerance`
      ])
    ];
    if (code.value === "NUMERIC_LIMIT" && numeric.includes(message.value) || code.value === "INVALID_CONFIG" && message.value === ERRORS2.profile || code.value === "INVALID_STEP" && message.value === ERRORS2.dt) {
      return { name: "PhysicsError", code: code.value, message: message.value };
    }
  } catch {
  }
  return null;
}

// examples/physics-rigid-hinge-velocity-world-reference/profile.ts
var PRIVATE_GROUP_PROFILE = "private multi-hinge reference requires literal HINGE2 fixture";
var equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
function admitPrivateConfiguration(input, bodies, gravity, dt) {
  if (dt !== 1 / 120 || !equal(gravity, [0, 0, 0]) || bodies.length !== 4 || ["broadPhase", "sceneMode", "contactMode"].some((key) => Object.hasOwn(input, key))) error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
  for (const body of bodies) {
    const match = /^pair([AB])([01])$/.exec(body.id);
    if (!match || body.kind !== "dynamic" || body.shape.kind !== "sphere" || body.shape.radiusM !== 0.1 || body.inverseMass !== 1 || body.restitution !== 0 || body.sensor || body.ccd || body.collisionFilter || body.frictionStatic !== 1 || body.frictionDynamic !== 0.7 || !equal(body.velocityMps, [0, 0, 0]) || !equal(body.angularVelocityRadps, [0, 0, 0]) || !equal(body.orientation, [0, 0, 0, 1]) || !equal(body.positionM, [match[1] === "A" ? -0.1 : 0.1, 0, Number(match[2])]) || body.inertiaKgM2 !== 0.4 * 0.1 ** 2) error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
  }
}
function parsePrivateGroups(value, bodies) {
  if (!Array.isArray(value) || value.length !== 2 || Reflect.ownKeys(value).length !== 3 || ![0, 1].every((i) => Object.hasOwn(value, i))) error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seen = /* @__PURE__ */ new Set();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
    const input = raw;
    const match = typeof input.id === "string" ? /^hinge([01])$/.exec(input.id) : null;
    if (!match || input.kind !== "hinge" || input.aId !== `pairA${match[1]}` || input.bId !== `pairB${match[1]}` || seen.has(String(input.aId)) || seen.has(String(input.bId))) error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
    const a = byId.get(String(input.aId)), b = byId.get(String(input.bId));
    if (!a || !b) error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
    const local = parseJoints([raw], [a.body, b.body])[0];
    if (!equal(local.anchorALocalM, [0.1, 0, 0]) || !equal(local.anchorBLocalM, [-0.1, 0, 0]) || !equal(local.axisWorld, [0, 0, 1]) || !equal(local.limitRad, [-0.8, 0.8]) || local.motor?.targetSpeedRadps !== 0.5 || local.motor.maxImpulseNms !== 1e-4 || local.motor.maxReactionNms !== 0.01)
      error("INVALID_CONFIG", PRIVATE_GROUP_PROFILE);
    seen.add(a.body.id);
    seen.add(b.body.id);
    return { ...local, aIndex: a.index, bIndex: b.index };
  });
}
function admitPrivateHingeScene(joint, bodies, gravity) {
  const inspected = bodies.map(copyBody), z = bodies[joint.aIndex].positionM[2];
  for (const index of [joint.aIndex, joint.bIndex]) inspected[index].positionM[2] -= z;
  admitDynamicHingeScene(joint, inspected, gravity);
}
function denseBodyArray(value) {
  return Object.getPrototypeOf(value) === Array.prototype && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => i).every((i) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    return !!descriptor && descriptor.enumerable && "value" in descriptor;
  });
}
function restBodyConfig(body) {
  return {
    id: body.id,
    kind: "dynamic",
    shape: copyShape(body.shape),
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    angularVelocityRadps: [...body.angularVelocityRadps],
    orientation: [...body.orientation],
    massKg: 1 / body.inverseMass,
    restitution: body.restitution,
    friction: { static: body.frictionStatic, dynamic: body.frictionDynamic }
  };
}
function admitWorldProfile(config) {
  const input = record(config, "world");
  fields(input, ["fixedStepSeconds", "gravityMps2", "bodies", "joints", "broadPhase", "contactMode", "sceneMode"], "world");
  if (Object.hasOwn(input, "sceneMode") && input.sceneMode !== "large-v1") error("INVALID_CONFIG", "sceneMode must be large-v1 when present");
  if (Object.hasOwn(input, "broadPhase") && input.broadPhase !== "aabb") error("INVALID_CONFIG", "broadPhase must be aabb when present");
  if (Object.hasOwn(input, "contactMode") && input.contactMode !== "persistent-box-v1") error("INVALID_CONFIG", "contactMode must be persistent-box-v1 when present");
  const useAabb = input.broadPhase === "aabb", usePersistentBox = input.contactMode === "persistent-box-v1";
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
  if (usePersistentBox && input.bodies.length > 4) error("INVALID_CONFIG", "persistent-box-v1 admits at most four bodies");
  if (!denseBodyArray(input.bodies)) worldFailure("profile");
  const bodies = input.bodies.map((value) => parseBody(value, largeMode));
  if (largeMode && bodies.some((body) => body.ccd)) error("INVALID_CONFIG", "large-v1 excludes CCD");
  if (!bodies.some((body) => body.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error("INVALID_CONFIG", "duplicate body ID");
  admitPrivateConfiguration(input, bodies, gravity, dt);
  const joints = parsePrivateGroups(input.joints, bodies);
  const dynamicHinges = joints.filter((joint) => joint.kind === "hinge" && bodies[joint.aIndex].kind === "dynamic");
  for (const hinge of dynamicHinges) admitPrivateHingeScene(hinge, bodies, gravity);
  const ccd = admitCcd(bodies, joints.length, gravity);
  if (ccd.kind === "box-pair" && usePersistentBox) error("INVALID_CONFIG", "box CCD excludes persistent-box-v1");
  if (bodies.some((body, i) => body.id !== ["pairA0", "pairB0", "pairA1", "pairB1"][i]) || joints.some((joint, i) => joint.id !== ["hinge0", "hinge1"][i]) || input.bodies.some((raw) => Object.hasOwn(raw, "inertiaKgM2") || Object.hasOwn(raw, "inertiaDiagonalKgM2"))) worldFailure("profile");
  const disabledPairs = new Set(joints.map((joint) => [bodies[joint.aIndex].id, bodies[joint.bIndex].id].sort().join("\0")));
  const pairs = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      if (disabledPairs.has([bodies[a].id, bodies[b].id].sort().join("\0"))) continue;
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 : bodies[left[0]].id > bodies[right[0]].id ? 1 : bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  const localJoints = joints.map((joint) => ({ ...copyData2(joint), aIndex: 0, bIndex: 1 }));
  const pairConfigs = joints.map((joint) => ({
    fixedStepSeconds: dt,
    gravityMps2: [...gravity],
    bodies: [restBodyConfig(bodies[joint.aIndex]), restBodyConfig(bodies[joint.bIndex])],
    joints: [{
      id: joint.id,
      kind: "hinge",
      aId: bodies[joint.aIndex].id,
      bId: bodies[joint.bIndex].id,
      anchorALocalM: [...joint.anchorALocalM],
      anchorBLocalM: [...joint.anchorBLocalM],
      axisWorld: [...joint.axisWorld],
      limitRad: [...joint.limitRad],
      motor: { ...joint.motor }
    }]
  }));
  return {
    dt,
    gravity: [...gravity],
    bodies: copyBodies(bodies),
    joints: copyData2(joints),
    pairs,
    pairConfigs,
    localJoints
  };
}

// examples/physics-rigid-hinge-velocity-world-reference/options.ts
function admitWorldOptions(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return worldFailure("options");
  const keys = Reflect.ownKeys(value);
  if (keys.length === 0 && ownData(value, []) !== null) return {};
  const input = ownData(value, ["observeAttempt"]);
  if (!input || typeof input.observeAttempt !== "function") return worldFailure("options");
  return { observeAttempt: input.observeAttempt };
}

// packages/barocss-physics/src/joint-motor.ts
function driveHingeMotor(joint, body, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0) return 0;
  const inverseAxisInertia = dot(axis, inverseInertia(body, axis));
  const speed = dot(body.angularVelocityRadps, axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseAxisInertia;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  body.angularVelocityRadps = add(
    body.angularVelocityRadps,
    inverseInertia(body, scale(axis, impulse))
  );
  return impulse;
}
function driveDynamicHingeMotor(joint, a, b, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0) return 0;
  const inverseSum = dot(axis, inverseInertia(a, axis)) + dot(axis, inverseInertia(b, axis));
  const speed = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseSum;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  a.angularVelocityRadps = sub(
    a.angularVelocityRadps,
    inverseInertia(a, scale(axis, impulse))
  );
  b.angularVelocityRadps = add(
    b.angularVelocityRadps,
    inverseInertia(b, scale(axis, impulse))
  );
  return impulse;
}

// examples/physics-rigid-hinge-motor-reference/motor-stages.ts
function applyOriginalMotor(bodies, joint, angleRad, calls) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], motor = joint.motor, axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  const relativeSpeedBeforeRadps = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  const blocked = angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0;
  calls.motorCalls = 1;
  const impulseNms = driveDynamicHingeMotor(joint, a, b, angleRad);
  const relativeSpeedAfterRadps = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  return {
    inputAngleRad: angleRad,
    targetSpeedRadps: motor.targetSpeedRadps,
    limitRad: [low, high],
    maxImpulseNms: motor.maxImpulseNms,
    blocked,
    impulseNms,
    relativeSpeedBeforeRadps,
    relativeSpeedAfterRadps
  };
}

// examples/physics-rigid-coupled-hinge-reference/candidate.ts
function angle(a, b, axis) {
  const q = multiplyQuaternion(b.orientation, inverse(a.orientation));
  const raw = 2 * Math.atan2(dot([q[0], q[1], q[2]], axis), q[3]);
  return raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
}
function momentum(bodies, origin) {
  const masses = bodies.map((b) => 1 / b.inverseMass), total = masses[0] + masses[1];
  const centerOfMassM = scale(add(scale(bodies[0].positionM, masses[0]), scale(bodies[1].positionM, masses[1])), 1 / total);
  const linearMomentumVectorKgMps = bodies.reduce((sum, b, i) => add(sum, scale(b.velocityMps, masses[i])), [0, 0, 0]);
  const orbitalAngularMomentumVectorKgM2ps = bodies.reduce((sum, b, i) => add(sum, scale(cross(sub(b.positionM, origin), b.velocityMps), masses[i])), [0, 0, 0]);
  const spinAngularMomentumVectorKgM2ps = bodies.reduce((sum, b) => add(sum, scale(b.angularVelocityRadps, b.inertiaKgM2)), [0, 0, 0]);
  const angularMomentumVectorKgM2ps = add(orbitalAngularMomentumVectorKgM2ps, spinAngularMomentumVectorKgM2ps);
  const energyJ = bodies.reduce((sum, b, i) => sum + 0.5 * masses[i] * dot(b.velocityMps, b.velocityMps) + 0.5 * b.inertiaKgM2 * dot(b.angularVelocityRadps, b.angularVelocityRadps), 0);
  return { centerOfMassM, linearMomentumVectorKgMps, orbitalAngularMomentumVectorKgM2ps, spinAngularMomentumVectorKgM2ps, angularMomentumVectorKgM2ps, energyJ };
}
function measure(bodies, joint, origin) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], relativeAngleRad = angle(a, b, joint.axisWorld), anchorAM = worldPoint(a, joint.anchorALocalM), anchorBM = worldPoint(b, joint.anchorBLocalM);
  const axisDeviationRad = Math.max(...bodies.map((body) => {
    const axis = rotate(body.orientation, [0, 0, 1]);
    return Math.atan2(Math.hypot(axis[0], axis[1]), axis[2]);
  }));
  return { relativeAngleRad, anchorAM, anchorBM, anchorGapM: Math.hypot(...sub(anchorBM, anchorAM)), axisDeviationRad, quaternionNormError: Math.max(...bodies.map((b2) => Math.abs(Math.hypot(...b2.orientation) - 1))), limitExcessRad: Math.max(0, joint.limitRad[0] - relativeAngleRad, relativeAngleRad - joint.limitRad[1]), ...momentum(bodies, origin) };
}
function finiteData2(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(finiteData2);
  if (value && typeof value === "object") return Object.values(value).every(finiteData2);
  return false;
}
function projectCoupledHingeCandidate(config, state, dt) {
  const input = admit(config, state, dt), before = input.bodies.map(copyBody), bodies = input.bodies.map(copyBody), joint = input.joint;
  const origin = scale(add(input.config.bodies[0].positionM, input.config.bodies[1].positionM), 0.5), beforeMetric = measure(before, joint, origin);
  const targetAngleRad = Math.max(joint.limitRad[0], Math.min(joint.limitRad[1], beforeMetric.relativeAngleRad)), excess = beforeMetric.relativeAngleRad - targetAngleRad;
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], axis = joint.axisWorld, inverseA = dot(axis, inverseInertia(a, axis)), inverseB = dot(axis, inverseInertia(b, axis)), inverseSum = inverseA + inverseB;
  const angleCorrectionsRad = [excess * inverseA / inverseSum, -excess * inverseB / inverseSum];
  a.orientation = advanceOrientation(a.orientation, scale(axis, angleCorrectionsRad[0]), 1);
  b.orientation = advanceOrientation(b.orientation, scale(axis, angleCorrectionsRad[1]), 1);
  const massA = 1 / a.inverseMass, massB = 1 / b.inverseMass, totalMass = massA + massB;
  const center = scale(add(scale(before[joint.aIndex].positionM, massA), scale(before[joint.bIndex].positionM, massB)), 1 / totalMass);
  const offset = sub(rotate(b.orientation, joint.anchorBLocalM), rotate(a.orientation, joint.anchorALocalM));
  a.positionM = add(center, scale(offset, massB / totalMass));
  b.positionM = sub(center, scale(offset, massA / totalMass));
  validateResult(bodies, []);
  const afterMetric = measure(bodies, joint, origin), velocityBitsUnchanged = bodies.every((body, i) => body.velocityMps.every((v, k) => Object.is(v, before[i].velocityMps[k]))), angularVelocityBitsUnchanged = bodies.every((body, i) => body.angularVelocityRadps.every((v, k) => Object.is(v, before[i].angularVelocityRadps[k])));
  const poseReport = { jointId: joint.id, finalAngleRad: afterMetric.relativeAngleRad, targetAngleRad };
  const diagnostics = { before: beforeMetric, after: afterMetric, targetAngleRad, angleCorrectionsRad, translationCorrectionsM: bodies.map((body, i) => sub(body.positionM, before[i].positionM)), sourceStepIndex: input.carrier.stepIndex, sourceTimeSeconds: input.carrier.timeSeconds, velocityBitsUnchanged, angularVelocityBitsUnchanged, lawEvaluations: 1 };
  if (!finiteData2(poseReport) || !finiteData2(diagnostics) || !velocityBitsUnchanged || !angularVelocityBitsUnchanged) error("NUMERIC_LIMIT", ERRORS.result);
  return { bodies: bodies.map(copyBody), poseReport: structuredClone(poseReport), diagnostics: structuredClone(diagnostics) };
}

// examples/physics-rigid-hinge-velocity-reference/diagnostics.ts
function measureBodies(bodies, joint, origin) {
  const masses = bodies.map((b2) => 1 / b2.inverseMass), total = masses[0] + masses[1];
  const centerOfMassM = scale(add(scale(bodies[0].positionM, masses[0]), scale(bodies[1].positionM, masses[1])), 1 / total);
  const linearMomentumVectorKgMps = bodies.reduce((sum, b2, i) => add(sum, scale(b2.velocityMps, masses[i])), [0, 0, 0]);
  const orbitalAngularMomentumVectorKgM2ps = bodies.reduce((sum, b2, i) => add(sum, scale(cross(sub(b2.positionM, origin), b2.velocityMps), masses[i])), [0, 0, 0]);
  const spinAngularMomentumVectorKgM2ps = bodies.reduce((sum, b2) => add(sum, scale(b2.angularVelocityRadps, b2.inertiaKgM2)), [0, 0, 0]);
  const angularMomentumVectorKgM2ps = add(orbitalAngularMomentumVectorKgM2ps, spinAngularMomentumVectorKgM2ps);
  const energyJ = bodies.reduce((sum, b2, i) => sum + 0.5 * masses[i] * dot(b2.velocityMps, b2.velocityMps) + 0.5 * b2.inertiaKgM2 * dot(b2.angularVelocityRadps, b2.angularVelocityRadps), 0);
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], relative = multiplyQuaternion(b.orientation, inverse(a.orientation));
  const raw = 2 * Math.atan2(dot([relative[0], relative[1], relative[2]], joint.axisWorld), relative[3]);
  const relativeAngleRad = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
  const anchorAM = worldPoint(a, joint.anchorALocalM), anchorBM = worldPoint(b, joint.anchorBLocalM);
  const anchorVelocityAMps = add(a.velocityMps, cross(a.angularVelocityRadps, rotate(a.orientation, joint.anchorALocalM)));
  const anchorVelocityBMps = add(b.velocityMps, cross(b.angularVelocityRadps, rotate(b.orientation, joint.anchorBLocalM)));
  const axisDeviationRad = Math.max(...bodies.map((body) => {
    const axis = rotate(body.orientation, [0, 0, 1]);
    return Math.atan2(Math.hypot(axis[0], axis[1]), axis[2]);
  }));
  return {
    relativeAngleRad,
    anchorAM,
    anchorBM,
    anchorGapM: Math.hypot(...sub(anchorBM, anchorAM)),
    axisDeviationRad,
    quaternionNormError: Math.max(...bodies.map((body) => Math.abs(Math.hypot(...body.orientation) - 1))),
    limitExcessRad: Math.max(0, joint.limitRad[0] - relativeAngleRad, relativeAngleRad - joint.limitRad[1]),
    centerOfMassM,
    linearMomentumVectorKgMps,
    orbitalAngularMomentumVectorKgM2ps,
    spinAngularMomentumVectorKgM2ps,
    angularMomentumVectorKgM2ps,
    energyJ,
    anchorVelocityAMps,
    anchorVelocityBMps,
    anchorRelativeVelocityMps: sub(anchorVelocityAMps, anchorVelocityBMps),
    relativeAngularVelocityRadps: sub(b.angularVelocityRadps, a.angularVelocityRadps)
  };
}

// examples/physics-rigid-hinge-velocity-reference/rows.ts
var DOF_ORDER = ["vAx", "vAy", "vAz", "wAx", "wAy", "wAz", "vBx", "vBy", "vBz", "wBx", "wBy", "wBz"];
var ROW_IDS = ["P.x", "P.y", "P.z", "L.x", "L.y", "L.z", "anchor.x", "anchor.y", "anchor.z", "transverse.x", "transverse.y"];
var skew = (r) => [[0, -r[2], r[1]], [r[2], 0, -r[0]], [-r[1], r[0], 0]];
var canonical = (value) => value === 0 ? 0 : value;
function makeRows(beforeBodies, finalBodies, joint, before, origin, target) {
  const masses = beforeBodies.map((body) => 1 / body.inverseMass), inertias = beforeBodies.map((body) => body.inertiaKgM2);
  const center = [...before.centerOfMassM], centeredTarget = sub(before.angularMomentumVectorKgM2ps, cross(sub(center, origin), before.linearMomentumVectorKgMps));
  const physicalA = Array.from({ length: 11 }, () => Array(12).fill(0));
  const rA = rotate(finalBodies[0].orientation, joint.anchorALocalM), rB = rotate(finalBodies[1].orientation, joint.anchorBLocalM);
  const ra = skew(rA), rb = skew(rB), sa = skew(sub(finalBodies[0].positionM, center)), sb = skew(sub(finalBodies[1].positionM, center));
  for (let i = 0; i < 3; i++) {
    physicalA[i][i] = masses[0];
    physicalA[i][6 + i] = masses[1];
    for (let j = 0; j < 3; j++) {
      physicalA[3 + i][j] = masses[0] * sa[i][j];
      physicalA[3 + i][6 + j] = masses[1] * sb[i][j];
      physicalA[6 + i][3 + j] = -ra[i][j];
      physicalA[6 + i][9 + j] = rb[i][j];
    }
    physicalA[3 + i][3 + i] = inertias[0];
    physicalA[3 + i][9 + i] = inertias[1];
    physicalA[6 + i][i] = 1;
    physicalA[6 + i][6 + i] = -1;
  }
  physicalA[9][3] = -1;
  physicalA[9][9] = 1;
  physicalA[10][4] = -1;
  physicalA[10][10] = 1;
  for (const row of physicalA) for (let j = 0; j < 12; j++) row[j] = canonical(row[j]);
  const physicalB = [...before.linearMomentumVectorKgMps, ...centeredTarget, 0, 0, 0, 0, 0];
  const physicalH = [...Array(3).fill(masses[0]), ...Array(3).fill(inertias[0]), ...Array(3).fill(masses[1]), ...Array(3).fill(inertias[1])];
  const physicalX0 = beforeBodies.flatMap((body) => [...body.velocityMps, ...body.angularVelocityRadps]);
  const columnScales = [1, 1, 1, 10, 10, 10, 1, 1, 1, 10, 10, 10], rowDivisors = [1, 1, 1, 0.1, 0.1, 0.1, 1, 1, 1, 10, 10];
  const dimensionlessA = physicalA.map((row, i) => row.map((value, j) => value * columnScales[j] / rowDivisors[i]));
  const dimensionlessB = physicalB.map((value, i) => value / rowDivisors[i]);
  const dimensionlessH = physicalH.map((value, j) => value * columnScales[j] * columnScales[j] / 1);
  const dimensionlessX0 = physicalX0.map((value, j) => value / columnScales[j]);
  const stopKind = target === joint.limitRad[1] ? "upper" : target === joint.limitRad[0] ? "lower" : "none";
  const physicalStopRow = stopKind === "none" ? [] : Array(12).fill(0);
  if (stopKind !== "none") {
    physicalStopRow[5] = stopKind === "upper" ? -1 : 1;
    physicalStopRow[11] = -physicalStopRow[5];
  }
  const dimensionlessStopRow = physicalStopRow.map((value, j) => value * columnScales[j] / 10);
  const h = sub(rA, rB), d = sub(finalBodies[1].positionM, finalBodies[0].positionM);
  const rankSufficientMarginKgM2 = 2 * inertias[0] - masses[0] * Math.hypot(...h) * Math.hypot(...sub(d, h));
  const problem = { a: dimensionlessA, b: dimensionlessB, h: dimensionlessH, y0: dimensionlessX0, stopKind, stopRow: dimensionlessStopRow };
  const result = {
    dofOrder: [...DOF_ORDER],
    rowIds: [...ROW_IDS],
    physicalA,
    physicalB,
    physicalH,
    physicalX0,
    columnScales,
    rowDivisors,
    dimensionlessA,
    dimensionlessB,
    dimensionlessH,
    dimensionlessX0,
    centerOfMassOriginM: center,
    originalOriginM: [...origin],
    stopKind,
    physicalStopRow,
    dimensionlessStopRow,
    rankSufficientMarginKgM2,
    problem
  };
  if (!finiteData(result) || physicalH.some((value) => value <= 0)) fail("linear");
  return result;
}

// examples/physics-rigid-hinge-velocity-reference/linear-solver.ts
function checked(value, kind = "system") {
  if (!Number.isFinite(value)) fail(kind);
  return value;
}
function dot2(a, b, kind = "system") {
  let sum = 0;
  for (let j = 0; j < a.length; j++) sum = checked(sum + checked(a[j] * b[j], kind), kind);
  return sum;
}
function normInf(a, kind = "system") {
  let maximum = 0;
  for (const row of a) {
    let sum = 0;
    for (const value of row) sum = checked(sum + Math.abs(value), kind);
    maximum = Math.max(maximum, sum);
  }
  return maximum;
}
function selected(problem, active) {
  return { a: active ? [...problem.a.map((row) => [...row]), [...problem.stopRow]] : problem.a.map((row) => [...row]), b: active ? [...problem.b, 0] : [...problem.b] };
}
function gram(a, h, kind = "system") {
  for (const value of h) checked(1 / value, kind);
  return a.map((row) => a.map((other) => {
    let sum = 0;
    for (let j = 0; j < 12; j++) {
      const divided = checked(row[j] / h[j], kind);
      sum = checked(sum + checked(divided * other[j], kind), kind);
    }
    return sum;
  }));
}
function safeReciprocals(problem) {
  for (const value of problem.h) checked(1 / value);
}
function fromLambda(problem, a, lambda, kind = "system") {
  const y = [];
  for (let j = 0; j < 12; j++) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum = checked(sum + checked(a[i][j] * lambda[i], kind), kind);
    y.push(checked(problem.y0[j] + checked(sum / problem.h[j], kind), kind));
  }
  return y;
}
function objective(problem, y) {
  let sum = 0;
  for (let j = 0; j < 12; j++) {
    const difference = checked(y[j] - problem.y0[j], "certificate");
    const square = checked(difference * difference, "certificate");
    sum = checked(sum + checked(problem.h[j] * square, "certificate"), "certificate");
  }
  return checked(0.5 * sum, "certificate");
}
function phaseResiduals(g, rhs, lambda, inverse2, kind = "system") {
  let linear = 0, inverseError = 0;
  for (let i = 0; i < g.length; i++) {
    linear = Math.max(linear, Math.abs(checked(dot2(g[i], lambda, kind) - rhs[i], kind)));
    let rowError = 0;
    for (let j = 0; j < g.length; j++) {
      let sum = 0;
      for (let k = 0; k < g.length; k++) sum = checked(sum + checked(g[i][k] * inverse2[k][j], kind), kind);
      rowError = checked(rowError + Math.abs(checked(sum - (i === j ? 1 : 0), kind)), kind);
    }
    inverseError = Math.max(inverseError, rowError);
  }
  return { linear, inverse: inverseError };
}
function solvePhase(problem, active) {
  const system = selected(problem, active), a = system.a, b = system.b, n = a.length, g = gram(a, problem.h), rhs = b.map((value, i) => checked(value - dot2(a[i], problem.y0)));
  const norm2 = normInf(g), threshold = checked(1e-12 * Math.max(1, norm2));
  const augmented = g.map((row, i) => [...row, rhs[i], ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]), pivots = [];
  for (let k = 0; k < n; k++) {
    let chosen = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(augmented[i][k]) > Math.abs(augmented[chosen][k])) chosen = i;
    if (Math.abs(augmented[chosen][k]) <= threshold) fail("system");
    if (chosen !== k) [augmented[k], augmented[chosen]] = [augmented[chosen], augmented[k]];
    const pivot = augmented[k][k];
    pivots.push(pivot);
    for (let i = k + 1; i < n; i++) {
      const factor = checked(augmented[i][k] / pivot);
      augmented[i][k] = 0;
      for (let j = k + 1; j <= 2 * n; j++) augmented[i][j] = checked(augmented[i][j] - checked(factor * augmented[k][j]));
    }
  }
  const solutions = [];
  for (let column = n; column <= 2 * n; column++) {
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum = checked(sum + checked(augmented[i][j] * x[j]));
      x[i] = checked(checked(augmented[i][column] - sum) / augmented[i][i]);
    }
    solutions.push(x);
  }
  const lambda = solutions[0], inverse2 = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => solutions[j + 1][i]));
  const conditionInf = checked(norm2 * normInf(inverse2));
  if (conditionInf > 1e12) fail("system");
  const y = fromLambda(problem, a, lambda), residuals = phaseResiduals(g, rhs, lambda, inverse2);
  if (residuals.linear > GATE || residuals.inverse > GATE) fail("certificate");
  return { rowIds: Array.from({ length: n }, (_, i) => i), rowCount: n, pivots, inverse: inverse2, normInf: norm2, conditionInf, lambda, y, residuals };
}
function certificate(problem, result) {
  const system = selected(problem, result.activeStop), a = system.a, b = system.b;
  let primal = 0, stationarity = 0;
  for (let i = 0; i < a.length; i++) primal = Math.max(primal, Math.abs(checked(dot2(a[i], result.y, "certificate") - b[i], "certificate")));
  for (let j = 0; j < 12; j++) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum = checked(sum + checked(a[i][j] * result.lambda[i], "certificate"), "certificate");
    const lhs = checked(problem.h[j] * checked(result.y[j] - problem.y0[j], "certificate"), "certificate");
    stationarity = Math.max(stationarity, Math.abs(checked(lhs - sum, "certificate")));
  }
  const signed = problem.stopKind === "none" ? 0 : dot2(problem.stopRow, result.y, "certificate"), mu = result.activeStop ? -result.lambda[11] : 0;
  const negativeMu = Math.max(0, -mu), complementarity = Math.abs(checked(mu * signed, "certificate"));
  const objectiveError = Math.abs(checked(objective(problem, result.y) - result.objectiveDimensionless, "certificate"));
  const value = { primal, stationarity, negativeMu, complementarity, objective: objectiveError };
  if (problem.stopKind !== "none" && signed > GATE || Object.values(value).some((v) => v > GATE) || result.objectiveDimensionless < 0) fail("certificate");
  return value;
}
function exactIdentity(problem) {
  return problem.a.every((row, i) => checked(dot2(row, problem.y0) - problem.b[i]) === 0) && (problem.stopKind === "none" || dot2(problem.stopRow, problem.y0) <= 0);
}
function readPhase(value, n) {
  if (!exactFields(value, ["rowIds", "rowCount", "pivots", "inverse", "normInf", "conditionInf", "lambda", "y", "residuals"]) || value.rowCount !== n || !dense2(value.rowIds, n) || value.rowIds.some((id, i) => id !== i) || !dense2(value.pivots, n) || !matrix(value.inverse, n, n) || !dense2(value.lambda, n) || !dense2(value.y, 12) || typeof value.normInf !== "number" || !Number.isFinite(value.normInf) || value.normInf < 0 || typeof value.conditionInf !== "number" || !Number.isFinite(value.conditionInf) || value.conditionInf < 0 || !exactFields(value.residuals, ["linear", "inverse"]) || ![value.residuals.linear, value.residuals.inverse].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)) fail("certificate");
  return value;
}
function validatePhase(problem, phase, active) {
  const system = selected(problem, active), g = gram(system.a, problem.h, "certificate"), rhs = system.b.map((value, i) => checked(value - dot2(system.a[i], problem.y0, "certificate"), "certificate"));
  const norm2 = normInf(g, "certificate"), condition = checked(norm2 * normInf(phase.inverse, "certificate"), "certificate");
  if (!Object.is(norm2, phase.normInf) || !Object.is(condition, phase.conditionInf) || condition > 1e12 || phase.pivots.some((value) => Math.abs(value) <= 1e-12 * Math.max(1, norm2))) fail("certificate");
  const residuals = phaseResiduals(g, rhs, phase.lambda, phase.inverse, "certificate");
  if (residuals.linear > GATE || residuals.inverse > GATE || !Object.is(residuals.linear, phase.residuals.linear) || !Object.is(residuals.inverse, phase.residuals.inverse)) fail("certificate");
  const y = fromLambda(problem, system.a, phase.lambda, "certificate");
  if (y.some((v, i) => !Object.is(v, phase.y[i]))) fail("certificate");
}
function validateVelocityCertificate(problemValue, resultValue) {
  const problem = readProblem(problemValue);
  safeReciprocals(problem);
  if (!exactFields(resultValue, ["y", "lambda", "activeStop", "identity", "solveAttempts", "phases", "objectiveDimensionless", "certificate"]) || typeof resultValue.activeStop !== "boolean" || typeof resultValue.identity !== "boolean" || !dense2(resultValue.y, 12) || !dense2(resultValue.lambda, resultValue.activeStop ? 12 : 11) || typeof resultValue.objectiveDimensionless !== "number" || !Number.isFinite(resultValue.objectiveDimensionless) || !Number.isInteger(resultValue.solveAttempts) || !Array.isArray(resultValue.phases) || Object.getPrototypeOf(resultValue.phases) !== Array.prototype || Reflect.ownKeys(resultValue.phases).length !== resultValue.phases.length + 1 || !Array.from({ length: resultValue.phases.length }, (_, i) => i).every((i) => Object.hasOwn(resultValue.phases, i)) || !exactFields(resultValue.certificate, ["primal", "stationarity", "negativeMu", "complementarity", "objective"]) || Object.values(resultValue.certificate).some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) fail("certificate");
  const result = resultValue, identity = exactIdentity(problem);
  if (result.identity !== identity || result.phases.length !== result.solveAttempts) fail("certificate");
  if (identity) {
    if (result.solveAttempts !== 0 || result.activeStop || result.lambda.some((value) => value !== 0) || result.y.some((value, j) => !Object.is(value, problem.y0[j]))) fail("certificate");
  } else {
    if (result.solveAttempts !== 1 && result.solveAttempts !== 2) fail("certificate");
    const equality = readPhase(result.phases[0], 11);
    validatePhase(problem, equality, false);
    const active = problem.stopKind !== "none" && dot2(problem.stopRow, equality.y, "certificate") > 0;
    if (result.activeStop !== active || result.solveAttempts !== (active ? 2 : 1)) fail("certificate");
    if (active) validatePhase(problem, readPhase(result.phases[1], 12), true);
    const final = result.phases[result.phases.length - 1];
    if (result.y.some((value, j) => !Object.is(value, final.y[j])) || result.lambda.some((value, i) => !Object.is(value, final.lambda[i]))) fail("certificate");
  }
  const computed = certificate(problem, result);
  for (const key of Object.keys(computed)) if (Math.abs(computed[key] - result.certificate[key]) > GATE) fail("certificate");
  return { ...computed };
}
function solveDimensionlessVelocity(value) {
  const problem = readProblem(value);
  safeReciprocals(problem);
  const identity = exactIdentity(problem);
  let phases = [], activeStop = false, y, lambda;
  if (identity) {
    y = [...problem.y0];
    lambda = Array(11).fill(0);
  } else {
    phases = [solvePhase(problem, false)];
    activeStop = problem.stopKind !== "none" && dot2(problem.stopRow, phases[0].y) > 0;
    if (activeStop) phases.push(solvePhase(problem, true));
    const final = phases[phases.length - 1];
    y = [...final.y];
    lambda = [...final.lambda];
  }
  const result = { y, lambda, activeStop, identity, solveAttempts: phases.length, phases, objectiveDimensionless: objective(problem, y), certificate: { primal: 0, stationarity: 0, negativeMu: 0, complementarity: 0, objective: 0 } };
  result.certificate = certificate(problem, result);
  validateVelocityCertificate(problem, result);
  return structuredClone(result);
}

// examples/physics-rigid-hinge-velocity-reference/candidate.ts
function projectHingePoseVelocityReference(config, state, dt) {
  const input = prepareInput(config, state, dt), beforeBodies = input.bodies.map(copyBody);
  const originalOriginM = scale(add(input.config.bodies[0].positionM, input.config.bodies[1].positionM), 0.5);
  const before = measureBodies(beforeBodies, input.joint, originalOriginM);
  const pose = bridge(() => projectCoupledHingeCandidate(input.config, input.carrier, DT2));
  const bodies = pose.bodies.map(copyBody), rows = makeRows(beforeBodies, bodies, input.joint, before, originalOriginM, pose.poseReport.targetAngleRad);
  const result = solveDimensionlessVelocity(rows.problem);
  if (!result.identity) {
    for (let i = 0; i < 2; i++) {
      bodies[i].velocityMps = result.y.slice(i * 6, i * 6 + 3).map((value, j) => value * rows.columnScales[i * 6 + j]);
      bodies[i].angularVelocityRadps = result.y.slice(i * 6 + 3, i * 6 + 6).map((value, j) => value * rows.columnScales[i * 6 + 3 + j]);
    }
  }
  validateResult(bodies, []);
  const after = measureBodies(bodies, input.joint, originalOriginM);
  const velocityCorrections = { linearMps: bodies.map((body, i) => sub(body.velocityMps, beforeBodies[i].velocityMps)), angularRadps: bodies.map((body, i) => sub(body.angularVelocityRadps, beforeBodies[i].angularVelocityRadps)) };
  const changedComponents = bodies.map((body, i) => [...body.velocityMps, ...body.angularVelocityRadps].map((value, j) => !Object.is(value, [...beforeBodies[i].velocityMps, ...beforeBodies[i].angularVelocityRadps][j])));
  const identityVelocityBitsPreserved = result.identity && changedComponents.every((row) => row.every((changed) => !changed));
  const finalX = bodies.flatMap((body) => [...body.velocityMps, ...body.angularVelocityRadps]);
  let sum = 0;
  for (let j = 0; j < 12; j++) {
    const delta = finalX[j] - rows.physicalX0[j];
    sum += rows.physicalH[j] * (delta * delta);
  }
  const objectiveJ = 0.5 * sum;
  const physicalLambda = result.lambda.map((value, i) => 1 * value / (i === 11 ? 10 : rows.rowDivisors[i]));
  const projection = {
    dofOrder: rows.dofOrder,
    rowIds: result.activeStop ? [...rows.rowIds, `stop.${rows.stopKind}`] : rows.rowIds,
    physicalA: rows.physicalA,
    physicalB: rows.physicalB,
    physicalH: rows.physicalH,
    physicalX0: rows.physicalX0,
    columnScales: rows.columnScales,
    rowDivisors: rows.rowDivisors,
    dimensionlessA: rows.dimensionlessA,
    dimensionlessB: rows.dimensionlessB,
    dimensionlessH: rows.dimensionlessH,
    dimensionlessX0: rows.dimensionlessX0,
    centerOfMassOriginM: rows.centerOfMassOriginM,
    originalOriginM: rows.originalOriginM,
    stopKind: rows.stopKind,
    physicalStopRow: rows.physicalStopRow,
    dimensionlessStopRow: rows.dimensionlessStopRow,
    result,
    physicalLambda,
    objectiveJ,
    rankSufficientMarginKgM2: rows.rankSufficientMarginKgM2
  };
  const diagnostics = { poseStage: pose.diagnostics, before, after, velocityCorrections, projection, changedComponents, identityVelocityBitsPreserved, poseLawEvaluations: 1, sourceStepIndex: input.carrier.stepIndex, sourceTimeSeconds: input.carrier.timeSeconds };
  if (!finiteData(diagnostics) || !finiteData(pose.poseReport) || objectiveJ < 0 || result.identity && !identityVelocityBitsPreserved) fail("result");
  return { bodies: bodies.map(copyBody), poseReport: structuredClone(pose.poseReport), diagnostics: structuredClone(diagnostics) };
}

// examples/physics-rigid-hinge-velocity-world-reference/diagnostics.ts
var PAIR_KEYS = [
  "jointId",
  "aId",
  "bId",
  "acceptedReportAngleRad",
  "rawSourceAngleRad",
  "rawFreeAngleRad",
  "rawPostContactAngleRad",
  "rawFinalAngleRad",
  "parsedActions",
  "motor",
  "projection",
  "jointReport",
  "bodyCorrections",
  "energyByPhase",
  "work",
  "reportCap",
  "metrics",
  "calls"
];
var FRAME_KEYS = ["sourceBodies", "angularBodies", "motorBodies", "freeBodies", "postContactBodies", "projectedBodies"];
var METRIC_KEYS = [
  "relativeAngleRad",
  "anchorAM",
  "anchorBM",
  "anchorGapM",
  "axisDeviationRad",
  "quaternionNormError",
  "limitExcessRad",
  "centerOfMassM",
  "linearMomentumVectorKgMps",
  "orbitalAngularMomentumVectorKgM2ps",
  "spinAngularMomentumVectorKgM2ps",
  "angularMomentumVectorKgM2ps",
  "energyJ",
  "anchorVelocityAMps",
  "anchorVelocityBMps",
  "anchorRelativeVelocityMps",
  "relativeAngularVelocityRadps"
];
var ENERGY_KEYS = ["sourceJ", "angularJ", "motorJ", "freeJ", "postContactJ", "projectedJ"];
var WORK_KEYS = [
  "externalAngularByBodyJ",
  "externalAngularTotalJ",
  "motorMidpointJ",
  "motorSpinMidpointJ",
  "motorResidualJ",
  "freeDeltaKJ",
  "projectionDeltaKJ",
  "projectionObjectiveJ",
  "contactDeltaKJ"
];
var METRIC_STAGES = ["source", "angular", "motor", "free", "postContact", "projected"];
function spinMidpoint(before, after) {
  return before.map((body, i) => 0.5 * body.inertiaKgM2 * dot(
    sub(after[i].angularVelocityRadps, body.angularVelocityRadps),
    add(body.angularVelocityRadps, after[i].angularVelocityRadps)
  ));
}
function makePairDiagnostic(profile, attempt, index) {
  const global = profile.joints[index], local = profile.localJoints[index], progress2 = attempt.pairProgress[index];
  const angularFrame = attempt.frames.angularBodies, motorFrame = attempt.frames.motorBodies;
  const freeFrame = attempt.frames.freeBodies, postContactFrame = attempt.frames.postContactBodies;
  const motor = progress2.motor, projection = progress2.projection, report = progress2.report;
  if (!angularFrame || !motorFrame || !freeFrame || !postContactFrame || !motor || !projection || !report) worldFailure("diagnostics");
  const select = (bodies) => copyPair([bodies[global.aIndex], bodies[global.bIndex]]);
  const source = select(attempt.frames.sourceBodies), angular = select(angularFrame), motorBodies = select(motorFrame);
  const free = select(freeFrame), postContact = select(postContactFrame), projected = copyPair(projection.bodies);
  const config = profile.pairConfigs[index];
  const origin = scale(add(config.bodies[0].positionM, config.bodies[1].positionM), 0.5);
  const metrics = {
    source: measureBodies(source, local, origin),
    angular: measureBodies(angular, local, origin),
    motor: measureBodies(motorBodies, local, origin),
    free: measureBodies(free, local, origin),
    postContact: measureBodies(postContact, local, origin),
    projected: measureBodies(projected, local, origin)
  };
  const energyByPhase = {
    sourceJ: metrics.source.energyJ,
    angularJ: metrics.angular.energyJ,
    motorJ: metrics.motor.energyJ,
    freeJ: metrics.free.energyJ,
    postContactJ: metrics.postContact.energyJ,
    projectedJ: metrics.projected.energyJ
  };
  const externalAngularByBodyJ = spinMidpoint(source, angular), motorByBody = spinMidpoint(angular, motorBodies);
  const motorMidpointJ = motor.impulseNms * (motor.relativeSpeedBeforeRadps + motor.relativeSpeedAfterRadps) * 0.5;
  const motorSpinMidpointJ = motorByBody[0] + motorByBody[1];
  const work = {
    externalAngularByBodyJ,
    externalAngularTotalJ: externalAngularByBodyJ[0] + externalAngularByBodyJ[1],
    motorMidpointJ,
    motorSpinMidpointJ,
    motorResidualJ: motorSpinMidpointJ - motorMidpointJ,
    freeDeltaKJ: energyByPhase.freeJ - energyByPhase.motorJ,
    projectionDeltaKJ: energyByPhase.projectedJ - energyByPhase.postContactJ,
    projectionObjectiveJ: projection.diagnostics.projection.objectiveJ,
    contactDeltaKJ: energyByPhase.postContactJ - energyByPhase.freeJ
  };
  const result = {
    jointId: global.id,
    aId: source[0].id,
    bId: source[1].id,
    acceptedReportAngleRad: attempt.acceptedReportAnglesRad[index],
    rawSourceAngleRad: metrics.source.relativeAngleRad,
    rawFreeAngleRad: metrics.free.relativeAngleRad,
    rawPostContactAngleRad: metrics.postContact.relativeAngleRad,
    rawFinalAngleRad: metrics.projected.relativeAngleRad,
    parsedActions: copyData2([attempt.parsedActions[global.aIndex], attempt.parsedActions[global.bIndex]]),
    motor: copyData2(motor),
    projection: copyData2(projection),
    jointReport: copyData2(report.jointReport),
    bodyCorrections: copyData2(report.bodyCorrections),
    energyByPhase,
    work,
    reportCap: copyData2(report.reportCap),
    metrics,
    calls: copyData2(progress2.calls)
  };
  validatePairDiagnostic(result);
  return copyData2(result);
}
function makeWorldDiagnostics(profile, attempt) {
  const { frames } = attempt;
  if (!frames.angularBodies || !frames.motorBodies || !frames.freeBodies || !frames.postContactBodies || !frames.projectedBodies || !attempt.pairs[0] || !attempt.pairs[1]) worldFailure("diagnostics");
  const completeFrames = {
    sourceBodies: frames.sourceBodies,
    angularBodies: frames.angularBodies,
    motorBodies: frames.motorBodies,
    freeBodies: frames.freeBodies,
    postContactBodies: frames.postContactBodies,
    projectedBodies: frames.projectedBodies
  };
  const result = {
    sourceStepIndex: attempt.sourceStepIndex,
    sourceTimeSeconds: attempt.sourceTimeSeconds,
    acceptedStepIndex: attempt.attemptedStepIndex,
    acceptedTimeSeconds: attempt.attemptedTimeSeconds,
    fixedStepSeconds: profile.dt,
    frames: completeFrames,
    pairs: [attempt.pairs[0], attempt.pairs[1]],
    contactPasses: attempt.contactPasses,
    pairStats: attempt.pairStats,
    calls: attempt.calls,
    contactChecks: attempt.contactChecks
  };
  return copyData2(result);
}
function finiteTree(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean" || typeof value === "string") return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let i = 0; i < value.length; i++) {
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      if (!d || !d.enumerable || !("value" in d) || !finiteTree(d.value)) return false;
    }
    return true;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === "string" && d !== void 0 && d.enumerable && "value" in d && finiteTree(d.value);
  });
}
function ordinaryDense(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length || Reflect.ownKeys(value).length !== length + 1) return false;
  return Array.from({ length }, (_, i) => i).every((i) => {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    return !!d && d.enumerable && "value" in d;
  });
}
function validatePairDiagnostic(value) {
  if (!ownData(value, PAIR_KEYS) || PAIR_KEYS.filter((key) => key !== "parsedActions").some((key) => !finiteTree(value[key])) || !ordinaryDense(value.parsedActions, 2) || !ordinaryDense(value.bodyCorrections, 2) || !ownData(value.motor, [
    "inputAngleRad",
    "targetSpeedRadps",
    "limitRad",
    "maxImpulseNms",
    "blocked",
    "impulseNms",
    "relativeSpeedBeforeRadps",
    "relativeSpeedAfterRadps"
  ]) || !ownData(value.projection, ["bodies", "poseReport", "diagnostics"]) || !ownData(value.jointReport, ["id", "kind", "aId", "bId", "angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms"]) || !ownData(value.energyByPhase, ENERGY_KEYS) || !ownData(value.work, WORK_KEYS) || !ownData(value.reportCap, ["angularReactionNormNms", "maxReactionNms", "exceedsCap"]) || !ownData(value.metrics, METRIC_STAGES) || !ownData(value.calls, ["motorCalls", "projectionCalls", "reportCalls"]) || value.calls.motorCalls !== 1 || value.calls.projectionCalls !== 1 || value.calls.reportCalls !== 1 || Object.values(value.energyByPhase).some((energy) => energy < 0) || value.work.projectionObjectiveJ < 0 || value.reportCap.maxReactionNms !== 0.01 || value.reportCap.exceedsCap !== value.reportCap.angularReactionNormNms > 0.01 || !denseNumbers(value.work.externalAngularByBodyJ, 2)) worldFailure("diagnostics");
  const ids = [value.aId, value.bId];
  for (let i = 0; i < 2; i++) {
    const action = ownData(value.parsedActions[i], ["bodyId", "torqueNm", "angularImpulseNms"]);
    const correction = ownData(value.bodyCorrections[i], ["bodyId", "linearImpulseNs", "angularImpulseNms"]);
    if (!action || action.bodyId !== ids[i] || action.torqueNm !== null && !denseNumbers(action.torqueNm, 3) || action.angularImpulseNms !== null && !denseNumbers(action.angularImpulseNms, 3) || !correction || correction.bodyId !== ids[i] || !denseNumbers(correction.linearImpulseNs, 3) || !denseNumbers(correction.angularImpulseNms, 3)) worldFailure("diagnostics");
  }
  for (const stage of METRIC_STAGES) if (!ownData(value.metrics[stage], METRIC_KEYS) || value.metrics[stage].energyJ < 0) worldFailure("diagnostics");
}
function validateWorldDiagnostics(value) {
  if (!ownData(value, [
    "sourceStepIndex",
    "sourceTimeSeconds",
    "acceptedStepIndex",
    "acceptedTimeSeconds",
    "fixedStepSeconds",
    "frames",
    "pairs",
    "contactPasses",
    "pairStats",
    "calls",
    "contactChecks"
  ]) || !Number.isSafeInteger(value.sourceStepIndex) || value.sourceStepIndex < 0 || value.sourceStepIndex > 3600 || value.fixedStepSeconds !== 1 / 120 || value.sourceTimeSeconds !== value.sourceStepIndex * value.fixedStepSeconds || value.acceptedStepIndex !== value.sourceStepIndex + 1 || value.acceptedTimeSeconds !== value.acceptedStepIndex * value.fixedStepSeconds || !ownData(value.frames, FRAME_KEYS) || !ordinaryDense(value.pairs, 2) || !ownData(value.pairStats, ["eligiblePairs", "candidatePairs", "aabbTests"]) || !ownData(value.calls, ["angularUpdates", "freeIntegrations", "motorCalls", "projectionCalls", "reportCalls"]) || !finiteTree(value.frames) || !finiteTree(value.pairStats) || !finiteTree(value.calls) || value.calls.angularUpdates !== 4 || value.calls.freeIntegrations !== 4 || value.calls.motorCalls !== 2 || value.calls.projectionCalls !== 2 || value.calls.reportCalls !== 2 || value.contactPasses !== 8 || value.pairStats.eligiblePairs !== 32 || value.pairStats.candidatePairs !== 32 || value.pairStats.aabbTests !== 0 || !ordinaryDense(value.contactChecks, 32)) worldFailure("diagnostics");
  for (const key of FRAME_KEYS) if (!ordinaryDense(value.frames[key], 4)) worldFailure("diagnostics");
  for (const pair of value.pairs) validatePairDiagnostic(pair);
  for (let i = 0; i < value.contactChecks.length; i++) {
    const check = value.contactChecks[i];
    if (!ownData(check, ["pass", "pairIndex", "aId", "bId", "aPositionM", "bPositionM", "hit"]) || check.pass !== Math.floor(i / 4) || check.pairIndex !== i % 4 || check.hit !== null || !denseNumbers(check.aPositionM, 3) || !denseNumbers(check.bPositionM, 3) || typeof check.aId !== "string" || typeof check.bId !== "string") worldFailure("diagnostics");
  }
}

// examples/physics-rigid-hinge-velocity-world-reference/postcontact-pair.ts
function projectPostContactPairReference(config, carrier, dt) {
  return copyData2(projectHingePoseVelocityReference(config, carrier, dt));
}
function beginPairCall(attempt, index, operation) {
  const key = operation === "motor" ? "motorCalls" : operation === "projection" ? "projectionCalls" : "reportCalls";
  attempt.calls[key]++;
  attempt.pairProgress[index].calls[key] = 1;
  attempt.pairProgress[index].lastCall = { operation, ordinal: attempt.calls[key], outcome: "started" };
}
function completePairCall(attempt, index, operation) {
  const key = operation === "motor" ? "motorCalls" : operation === "projection" ? "projectionCalls" : "reportCalls";
  attempt.pairProgress[index].completedCalls[key] = 1;
  attempt.pairProgress[index].lastCall.outcome = "returned";
}
function publicCarrierBody(body) {
  return {
    id: body.id,
    kind: body.kind,
    shape: copyShape(body.shape),
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    orientation: [...body.orientation],
    angularVelocityRadps: [...body.angularVelocityRadps],
    inertiaKgM2: body.inertiaKgM2
  };
}
function pairRawHex(bodies) {
  const bytes = new Uint8Array(208), view = new DataView(bytes.buffer);
  let cursor = 0;
  for (const body of bodies) for (const value of [...body.positionM, ...body.velocityMps, ...body.orientation, ...body.angularVelocityRadps]) {
    view.setFloat64(cursor, value, true);
    cursor += 8;
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function runPostContactStage(profile, next, attempt, jointStates) {
  const postContact = attempt.frames.postContactBodies;
  for (const index of [0, 1]) {
    const global = profile.joints[index], local = profile.localJoints[index];
    const before = copyPair([postContact[global.aIndex], postContact[global.bIndex]]);
    const carrier = {
      stepIndex: attempt.sourceStepIndex,
      timeSeconds: attempt.sourceTimeSeconds,
      bodies: before.map(publicCarrierBody),
      contacts: [],
      events: [],
      joints: [{ ...copyData2(jointStates[index]), angleRad: attempt.acceptedReportAnglesRad[index] }],
      ccdHits: [],
      pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 }
    };
    beginPairCall(attempt, index, "projection");
    const projection = projectPostContactPairReference(profile.pairConfigs[index], carrier, profile.dt);
    completePairCall(attempt, index, "projection");
    attempt.pairProgress[index].projection = copyData2(projection);
    attempt.pairProgress[index].projectedRawHex = pairRawHex(copyPair(projection.bodies));
    const returned = copyPair(projection.bodies);
    next[global.aIndex] = returned[0];
    next[global.bIndex] = returned[1];
    beginPairCall(attempt, index, "report");
    const report = makeReport(
      local,
      before,
      copyPair(projection.bodies),
      projection.poseReport.targetAngleRad,
      attempt.pairProgress[index].motor.impulseNms
    );
    completePairCall(attempt, index, "report");
    attempt.pairProgress[index].report = copyData2(report);
    const diagnostic = makePairDiagnostic(profile, attempt, index);
    attempt.pairs[index] = copyData2(diagnostic);
    attempt.stage = index === 0 ? "pair0-ready" : "pair1-ready";
  }
  attempt.frames.projectedBodies = copyBodies(next);
}

// examples/physics-rigid-hinge-velocity-world-reference/stages.ts
var emptyPairCalls = () => ({ motorCalls: 0, projectionCalls: 0, reportCalls: 0 });
function progress(jointId) {
  return {
    jointId,
    motor: null,
    projection: null,
    report: null,
    calls: emptyPairCalls(),
    completedCalls: emptyPairCalls(),
    lastCall: null,
    projectedRawHex: null
  };
}
function makeWorldAttempt(profile, sourceBodies, jointStates, sourceStepIndex, actions) {
  const parsedActions = sourceBodies.map((body) => {
    const action = actions.get(body.id);
    return {
      bodyId: body.id,
      torqueNm: action?.torqueNm ? [...action.torqueNm] : null,
      angularImpulseNms: action?.angularImpulseNms ? [...action.angularImpulseNms] : null
    };
  });
  return {
    stage: "admitted",
    sourceStepIndex,
    sourceTimeSeconds: sourceStepIndex * profile.dt,
    attemptedStepIndex: sourceStepIndex + 1,
    attemptedTimeSeconds: (sourceStepIndex + 1) * profile.dt,
    acceptedReportAnglesRad: [jointStates[0].angleRad, jointStates[1].angleRad],
    parsedActions: copyData2(parsedActions),
    frames: {
      sourceBodies: copyBodies(sourceBodies),
      angularBodies: null,
      motorBodies: null,
      freeBodies: null,
      postContactBodies: null,
      projectedBodies: null
    },
    pairs: [null, null],
    pairProgress: [progress(profile.joints[0].id), progress(profile.joints[1].id)],
    contactPasses: 0,
    pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 },
    calls: { angularUpdates: 0, freeIntegrations: 0, motorCalls: 0, projectionCalls: 0, reportCalls: 0 },
    contactChecks: [],
    error: null
  };
}
function runAngularStage(_profile, next, attempt, actions) {
  for (const body of next) {
    if (body.kind !== "dynamic") continue;
    attempt.calls.angularUpdates++;
    const action = actions.get(body.id);
    body.angularVelocityRadps = add(
      body.angularVelocityRadps,
      inverseInertia(body, add(
        action?.angularImpulseNms ?? [0, 0, 0],
        scale(action?.torqueNm ?? [0, 0, 0], _profile.dt)
      ))
    );
  }
  attempt.frames.angularBodies = copyBodies(next);
  attempt.stage = "angular-ready";
}
function runMotorStage(profile, next, attempt, jointStates) {
  for (const index of [0, 1]) {
    const joint = profile.joints[index];
    beginPairCall(attempt, index, "motor");
    const motor = applyOriginalMotor(
      [next[joint.aIndex], next[joint.bIndex]],
      profile.localJoints[index],
      jointStates[index].angleRad,
      attempt.pairProgress[index].calls
    );
    completePairCall(attempt, index, "motor");
    attempt.pairProgress[index].motor = copyData2(motor);
  }
  attempt.frames.motorBodies = copyBodies(next);
  attempt.stage = "motor-ready";
}
function runFreeStage(profile, next, attempt, actions) {
  for (const body of next) {
    if (body.kind !== "dynamic") continue;
    attempt.calls.freeIntegrations++;
    const action = actions.get(body.id);
    if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e3) || Math.hypot(...body.angularVelocityRadps) * profile.dt > 10) {
      error("NUMERIC_LIMIT", `${body.id} exceeded angular movement limit`);
    }
    body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, profile.dt);
    for (let i = 0; i < 3; i++) {
      body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
      body.velocityMps[i] += (profile.gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * profile.dt;
    }
    if (Math.hypot(...body.velocityMps) * profile.dt > MAX_STEP_DISPLACEMENT_M) {
      error("NUMERIC_LIMIT", `${body.id} exceeded step displacement limit`);
    }
    for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * profile.dt;
  }
  attempt.frames.freeBodies = copyBodies(next);
  attempt.stage = "free-ready";
}
function runContactStage(profile, next, attempt, _priorPersistentPoints) {
  const found = /* @__PURE__ */ new Map();
  const persistentPoints = /* @__PURE__ */ new Map();
  const sensed = /* @__PURE__ */ new Map();
  for (let pass = 0; pass < SOLVER_PASSES; pass++) {
    for (let pairIndex = 0; pairIndex < profile.pairs.length; pairIndex++) {
      const [aIndex, bIndex] = profile.pairs[pairIndex];
      attempt.pairStats.eligiblePairs++;
      attempt.pairStats.candidatePairs++;
      const a = next[aIndex], b = next[bIndex];
      const aPositionM = [...a.positionM], bPositionM = [...b.positionM];
      const hit = detect(a, b);
      attempt.contactChecks.push({ pass, pairIndex, aId: a.id, bId: b.id, aPositionM, bPositionM, hit: copyData2(hit) });
      if (!hit) continue;
      if (hit.penetration > MAX_STEP_DISPLACEMENT_M) error("NUMERIC_LIMIT", "contact penetration exceeded limit");
      const key = `${a.id}\0${b.id}`;
      if (a.sensor || b.sensor) {
        sensed.set(key, { aId: a.id, bId: b.id, kind: "sensor" });
        continue;
      }
      let contact = found.get(key);
      if (!contact) {
        contact = {
          aId: a.id,
          bId: b.id,
          normalAtoB: [...hit.normal],
          pointM: [...hit.pointM],
          penetrationM: 0,
          impulseNs: 0,
          tangentImpulseNs: [0, 0, 0]
        };
        found.set(key, contact);
      }
      const points = [hit.pointM];
      contact.pointM = points.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / points.length);
      contact.penetrationM = Math.max(contact.penetrationM, hit.penetration);
      const resolved = solve(a, b, hit);
      contact.impulseNs += resolved.normalImpulseNs;
      contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
    }
    attempt.contactPasses++;
  }
  attempt.frames.postContactBodies = copyBodies(next);
  attempt.stage = "contact-ready";
  if (attempt.contactChecks.some((check) => check.hit !== null)) worldFailure("contact");
  return { contacts: [...found.values()], persistentPoints, sensed };
}
function markKnownRefusedCall(attempt) {
  for (const entry of attempt.pairProgress) {
    if (entry.lastCall?.outcome === "started") entry.lastCall.outcome = "known-refused";
  }
}

// examples/physics-rigid-hinge-velocity-world-reference/world-store.ts
function publicState(store, dt) {
  const { bodies, contacts, events, joints, ccdHits, pairStats, stepIndex } = store;
  return {
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor, ccd, collisionFilter: collisionFilter2, sleeping }) => ({
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
      ...collisionFilter2 ? { collisionFilter: { ...collisionFilter2 } } : {},
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
function transactionSnapshot(store, dt) {
  return {
    stepIndex: store.stepIndex,
    timeSeconds: store.stepIndex * dt,
    bodies: copyBodies(store.bodies),
    contacts: copyData2(store.contacts),
    events: copyData2(store.events),
    joints: copyData2(store.joints),
    ccdHits: copyData2(store.ccdHits),
    pairStats: { ...store.pairStats },
    activePairs: [...store.activePairs].map(([key, value]) => [key, copyData2(value)]),
    persistentPoints: [...store.persistentPoints].map(([key, value]) => [key, copyData2(value)]),
    sleepFrames: store.sleepFrames.slice(),
    diagnostics: copyData2(store.diagnostics)
  };
}

// examples/physics-rigid-hinge-velocity-world-reference/world-query.ts
function overlapAccepted(bodies, input) {
  const query = queryRecord(input, ["centerM", "radiusM"], ["includeSensors"]);
  const center = queryVector(query.centerM, 1e4, "centerM");
  const radius = queryNumber(query.radiusM, 1e-4, 1e3, "radiusM");
  const sensors = includeSensors(query);
  return bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body)).map((body) => body.id).sort();
}
function raycastAccepted(bodies, input) {
  const query = queryRecord(input, ["originM", "direction", "maxDistanceM"], ["includeSensors"]);
  const origin = queryVector(query.originM, 1e4, "originM");
  const direction = queryVector(query.direction, 1 + 1e-9, "direction");
  if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) error("INVALID_QUERY", "direction must be a unit 3-vector");
  const limit = queryNumber(query.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
  const sensors = includeSensors(query);
  let best = null;
  for (const body of bodies) {
    if (!sensors && body.sensor) continue;
    const distance = rayDistance(origin, direction, body);
    if (distance === null || distance > limit) continue;
    if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId)
      best = { bodyId: body.id, distanceM: distance };
  }
  return best;
}

// examples/physics-rigid-hinge-velocity-world-reference/world.ts
function createHingeVelocityWorldCandidate(config, privateOptions = {}) {
  const profile = admitWorldProfile(config);
  const options = admitWorldOptions(privateOptions);
  const dt = profile.dt;
  let store = {
    bodies: copyBodies(profile.bodies),
    contacts: [],
    events: [],
    ccdHits: [],
    pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 },
    joints: profile.joints.map((joint) => ({
      id: joint.id,
      kind: joint.kind,
      aId: profile.bodies[joint.aIndex].id,
      bId: profile.bodies[joint.bIndex].id,
      linearImpulseNs: [0, 0, 0],
      angularImpulseNms: [0, 0, 0],
      ...joint.kind === "hinge" ? { angleRad: 0 } : {},
      ...joint.motor ? { motorImpulseNms: 0 } : {}
    })),
    activePairs: /* @__PURE__ */ new Map(),
    persistentPoints: /* @__PURE__ */ new Map(),
    sleepFrames: profile.bodies.map(() => 0),
    stepIndex: 0,
    diagnostics: null
  };
  let disposed = false;
  const ensureActive = () => {
    if (disposed) error("DISPOSED", "world is disposed");
  };
  return {
    getState() {
      ensureActive();
      return publicState(store, dt);
    },
    getDiagnostics() {
      ensureActive();
      return copyData2(store.diagnostics);
    },
    getTransactionSnapshot() {
      ensureActive();
      return transactionSnapshot(store, dt);
    },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error("INVALID_STEP", "step must equal configured fixedStepSeconds");
      if (store.stepIndex >= MAX_STEPS) error("WORLD_LIMIT", "world step limit reached");
      const actions = parseCommands(commands, store.bodies);
      for (const hinge of profile.joints) admitDynamicHingeCommands(hinge, store.bodies, actions);
      const next = copyBodies(store.bodies);
      const attempt = makeWorldAttempt(profile, store.bodies, store.joints, store.stepIndex, actions);
      let staged;
      try {
        runAngularStage(profile, next, attempt, actions);
        runMotorStage(profile, next, attempt, store.joints);
        runFreeStage(profile, next, attempt, actions);
        const contact = runContactStage(profile, next, attempt, store.persistentPoints);
        runPostContactStage(profile, next, attempt, store.joints);
        const nextJoints = attempt.pairs.map((pair) => {
          if (pair === null) worldFailure("diagnostics");
          return copyData2(pair.jointReport);
        });
        const nextActive = new Map(contact.sensed);
        for (const entry of contact.contacts) nextActive.set(
          `${entry.aId}\0${entry.bId}`,
          { aId: entry.aId, bId: entry.bId, kind: "contact" }
        );
        const nextEvents = [.../* @__PURE__ */ new Set([...store.activePairs.keys(), ...nextActive.keys()])].sort().map((key) => {
          const current = nextActive.get(key), previous = store.activePairs.get(key);
          return { ...current ?? previous, phase: current ? previous ? "stay" : "begin" : "end" };
        });
        const diagnostics = makeWorldDiagnostics(profile, attempt);
        validateResult(next, contact.contacts);
        if (nextJoints.some((joint) => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some((value) => !Number.isFinite(value)) || joint.angleRad !== void 0 && !Number.isFinite(joint.angleRad)))
          error("NUMERIC_LIMIT", "unsafe joint reaction");
        validateWorldDiagnostics(diagnostics);
        for (let index = 0; index < next.length; index++) {
          const delta = next[index].positionM.map((value, component) => value - store.bodies[index].positionM[component]);
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M) worldFailure("result");
        }
        attempt.stage = "report-ready";
        staged = {
          bodies: next,
          contacts: contact.contacts,
          events: nextEvents,
          joints: nextJoints,
          ccdHits: [],
          pairStats: { ...attempt.pairStats },
          activePairs: nextActive,
          persistentPoints: contact.persistentPoints,
          sleepFrames: store.sleepFrames.slice(),
          stepIndex: store.stepIndex + 1,
          diagnostics
        };
      } catch (received) {
        const known = knownWorldCalculationError(received, store.bodies);
        if (known === null) throw received;
        markKnownRefusedCall(attempt);
        attempt.error = known;
        options.observeAttempt?.(copyData2(attempt));
        throw received;
      }
      options.observeAttempt?.(copyData2(attempt));
      for (const joint of staged.joints) enforceHingeMotorReactionCap(joint.id, joint.angularImpulseNms);
      store = staged;
      return publicState(store, dt);
    },
    overlapSphere(input) {
      ensureActive();
      return overlapAccepted(store.bodies, input);
    },
    raycast(input) {
      ensureActive();
      return raycastAccepted(store.bodies, input);
    },
    dispose() {
      disposed = true;
      store.bodies = [];
      store.contacts = [];
      store.events = [];
      store.ccdHits = [];
      store.activePairs.clear();
      store.persistentPoints.clear();
      store.sleepFrames = [];
      store.diagnostics = null;
    }
  };
}

// packages/barocss-physics/src/contact-manifold.ts
var basis = (body) => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
function referenceFace(body, axes, normal) {
  for (let axis = 0; axis < 3; axis++) {
    const alignment = dot(axes[axis], normal);
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
    const a = dot(sub(current, centre), axis) - limit;
    const b = dot(sub(next, centre), axis) - limit;
    const insideA = a <= 1e-9, insideB = b <= 1e-9;
    if (insideA) result.push(current);
    if (insideA !== insideB) result.push(add(current, scale(sub(next, current), a / (a - b))));
  }
  return result;
}
function faceVertices(face) {
  const tangents = [0, 1, 2].filter((axis) => axis !== face.axis);
  const centre = add(face.body.positionM, scale(
    face.axes[face.axis],
    face.side * face.extents[face.axis]
  ));
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => add(
    add(centre, scale(face.axes[tangents[0]], u * face.extents[tangents[0]])),
    scale(face.axes[tangents[1]], v * face.extents[tangents[1]])
  ));
}
function boxFaceManifold(a, b, hit) {
  if (a.shape.kind !== "box" || b.shape.kind !== "box") return null;
  const axesA = basis(a), axesB = basis(b);
  const faceA = referenceFace(a, axesA, hit.normal);
  const faceB = referenceFace(b, axesB, scale(hit.normal, -1));
  const reference = faceA ?? faceB;
  if (!reference) return null;
  const incidentBody = reference.body === a ? b : a;
  const incidentAxes = reference.body === a ? axesB : axesA;
  const normal = reference.body === a ? hit.normal : scale(hit.normal, -1);
  let incidentAxis = 0, greatest = -Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const alignment = Math.abs(dot(incidentAxes[axis], normal));
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
    side: dot(incidentAxes[incidentAxis], normal) > 0 ? -1 : 1
  };
  const centre = add(reference.body.positionM, scale(
    reference.axes[reference.axis],
    reference.side * reference.extents[reference.axis]
  ));
  const tangents = [0, 1, 2].filter((axis) => axis !== reference.axis);
  let polygon = faceVertices(incident);
  for (const axis of tangents) {
    polygon = clip(polygon, centre, reference.axes[axis], reference.extents[axis]);
    polygon = clip(polygon, centre, scale(reference.axes[axis], -1), reference.extents[axis]);
  }
  const candidates = polygon.map((point) => {
    const separation = dot(sub(point, centre), normal);
    const midpoint = sub(point, scale(normal, separation / 2));
    return {
      pointM: midpoint,
      separation,
      u: dot(sub(midpoint, centre), reference.axes[tangents[0]]),
      v: dot(sub(midpoint, centre), reference.axes[tangents[1]])
    };
  }).filter((point) => point.separation <= 1e-6);
  if (!candidates.length) return null;
  const selected2 = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, point) => u * point.u + v * point.v > u * best.u + v * best.v ? point : best, candidates[0]));
  const unique = selected2.filter((point, index) => selected2.findIndex((other) => Math.hypot(...sub(point.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first, second) => first.u - second.u || first.v - second.v);
  return unique.map((point, index) => ({ id: `${reference.body.id}:${reference.axis}:${reference.side}:${index}`, pointM: point.pointM }));
}

// packages/barocss-physics/src/persistent-box-contact.ts
function apply(a, b, pointM, impulse) {
  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
  a.velocityMps = sub(a.velocityMps, scale(impulse, a.inverseMass));
  b.velocityMps = add(b.velocityMps, scale(impulse, b.inverseMass));
  a.angularVelocityRadps = sub(
    a.angularVelocityRadps,
    inverseInertia(a, cross(armA, impulse))
  );
  b.angularVelocityRadps = add(
    b.angularVelocityRadps,
    inverseInertia(b, cross(armB, impulse))
  );
}
function relativeVelocity(a, b, pointM) {
  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
  return sub(
    add(b.velocityMps, cross(b.angularVelocityRadps, armB)),
    add(a.velocityMps, cross(a.angularVelocityRadps, armA))
  );
}
function effectiveInverseMass(a, b, pointM, direction) {
  const torqueA = cross(sub(pointM, a.positionM), direction);
  const torqueB = cross(sub(pointM, b.positionM), direction);
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
  if (deltaNormal !== 0) apply(a, b, pointM, scale(normal, deltaNormal));
  const relative = relativeVelocity(a, b, pointM);
  const tangent = sub(relative, scale(normal, dot(relative, normal)));
  const tangentSpeed = Math.hypot(...tangent);
  if (tangentSpeed < 1e-12) return;
  const direction = scale(tangent, 1 / tangentSpeed);
  const tangentMass = effectiveInverseMass(a, b, pointM, direction);
  const requested = sub(impulse.tangentNs, scale(direction, tangentSpeed / tangentMass));
  const requestedMagnitude = Math.hypot(...requested);
  const staticLimit = Math.sqrt(a.frictionStatic * b.frictionStatic) * impulse.normalNs;
  const dynamicLimit = Math.sqrt(a.frictionDynamic * b.frictionDynamic) * impulse.normalNs;
  const limit = requestedMagnitude <= staticLimit ? staticLimit : dynamicLimit;
  const nextTangent = requestedMagnitude > limit && requestedMagnitude > 0 ? scale(requested, limit / requestedMagnitude) : requested;
  const deltaTangent = sub(nextTangent, impulse.tangentNs);
  impulse.tangentNs = nextTangent;
  apply(a, b, pointM, deltaTangent);
}
function correctPersistentPair(a, b, normal, penetration) {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0 || penetration <= 0) return;
  const correction = scale(normal, penetration / inverseTotal);
  a.positionM = sub(a.positionM, scale(correction, a.inverseMass));
  b.positionM = add(b.positionM, scale(correction, b.inverseMass));
}

// packages/barocss-physics/src/ccd-pair.ts
function sweepSpherePair(markedStart, markedEnd, otherStart, otherEnd) {
  if (markedStart.shape.kind !== "sphere" || otherStart.shape.kind !== "sphere") return null;
  const radius = markedStart.shape.radiusM + otherStart.shape.radiusM;
  const relativeStart = sub(markedStart.positionM, otherStart.positionM);
  const distanceSquared = dot(relativeStart, relativeStart);
  if (distanceSquared <= radius * radius) return null;
  const markedTravel = sub(markedEnd.positionM, markedStart.positionM);
  const otherTravel = sub(otherEnd.positionM, otherStart.positionM);
  const relativeTravel = sub(markedTravel, otherTravel);
  const a = dot(relativeTravel, relativeTravel);
  if (a === 0) return null;
  const b = 2 * dot(relativeStart, relativeTravel);
  if (b >= 0) return null;
  const discriminant = b * b - 4 * a * (distanceSquared - radius * radius);
  if (!Number.isFinite(discriminant)) error("NUMERIC_LIMIT", "unsafe sphere-pair sweep");
  if (discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  const markedAtHit = add(markedStart.positionM, scale(markedTravel, fraction));
  const otherAtHit = add(otherStart.positionM, scale(otherTravel, fraction));
  const separation = sub(markedAtHit, otherAtHit);
  const length = Math.hypot(...separation);
  if (!(length > 0) || !Number.isFinite(length)) error("NUMERIC_LIMIT", "unsafe sphere-pair normal");
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

// packages/barocss-physics/src/broadphase.ts
function bodyBounds(body) {
  const shape2 = body.shape;
  let half;
  if (shape2.kind === "sphere") {
    half = [shape2.radiusM, shape2.radiusM, shape2.radiusM];
  } else if (shape2.kind === "capsule") {
    const axis = rotate(body.orientation, [0, 1, 0]);
    half = axis.map((value) => shape2.radiusM + shape2.halfLengthM * Math.abs(value));
  } else {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
    half = [0, 1, 2].map((axis) => axes.reduce((extent, basis2, localAxis) => extent + Math.abs(basis2[axis]) * shape2.halfExtentsM[localAxis], 0));
  }
  const min = body.positionM.map((value, axis) => value - half[axis]);
  const max = body.positionM.map((value, axis) => value + half[axis]);
  if ([...min, ...max].some((value) => !Number.isFinite(value))) error("NUMERIC_LIMIT", "nonfinite broad-phase bounds");
  return { min, max };
}
function boundsOverlap(a, b) {
  for (let axis = 0; axis < 3; axis++) {
    if (a.max[axis] + 1e-9 < b.min[axis] || b.max[axis] + 1e-9 < a.min[axis]) return false;
  }
  return true;
}

// packages/barocss-physics/src/scene-profile.ts
function filterAllowsPair(a, b) {
  const left = a.collisionFilter;
  const right = b.collisionFilter;
  if (!left || !right) return true;
  return (left.maskBits & right.categoryBits) !== 0 && (right.maskBits & left.categoryBits) !== 0;
}
function dormantPair(a, b) {
  const dynamics = [a, b].filter((body) => body.kind === "dynamic");
  return dynamics.length > 0 && dynamics.every((body) => body.sleeping === true) && [a, b].every((body) => body.kind !== "kinematic" || Math.hypot(...body.velocityMps) === 0);
}
function wakeOnContact(a, b, sleepFrames, aIndex, bIndex) {
  if (dormantPair(a, b)) return;
  if (a.kind === "dynamic" && a.sleeping && (b.kind === "dynamic" && !b.sleeping || b.kind === "kinematic" && Math.hypot(...b.velocityMps) > 0)) {
    a.sleeping = false;
    sleepFrames[aIndex] = 0;
  }
  if (b.kind === "dynamic" && b.sleeping && (a.kind === "dynamic" && !a.sleeping || a.kind === "kinematic" && Math.hypot(...a.velocityMps) > 0)) {
    b.sleeping = false;
    sleepFrames[bIndex] = 0;
  }
}

// packages/barocss-physics/src/sleep.ts
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
    if (body.kind === "dynamic" && (nonzero(action?.forceN) || nonzero(action?.impulseNs) || nonzero(action?.torqueNm) || nonzero(action?.angularImpulseNms))) queue.push(index);
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
    const atRest = island.every((member) => Math.hypot(...bodies[member].velocityMps) <= LINEAR_REST_MPS && Math.hypot(...bodies[member].angularVelocityRadps) <= ANGULAR_REST_RADPS);
    for (const member of island) sleepFrames[member] = atRest ? sleepFrames[member] + 1 : 0;
    if (island.every((member) => sleepFrames[member] >= REST_STEPS)) {
      for (const member of island) {
        bodies[member].sleeping = true;
        bodies[member].velocityMps = [0, 0, 0];
        bodies[member].angularVelocityRadps = [0, 0, 0];
      }
    }
  }
}

// packages/barocss-physics/src/world.ts
function publicState2(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt) {
  return {
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor, ccd, collisionFilter: collisionFilter2, sleeping }) => ({
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
      ...collisionFilter2 ? { collisionFilter: { ...collisionFilter2 } } : {},
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
function createPhysicsWorld(config) {
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
  if (usePersistentBox && input.bodies.length > 4) {
    error("INVALID_CONFIG", "persistent-box-v1 admits at most four bodies");
  }
  let bodies = input.bodies.map((value) => parseBody(value, largeMode));
  if (largeMode && bodies.some((body) => body.ccd)) {
    error("INVALID_CONFIG", "large-v1 excludes CCD");
  }
  if (!bodies.some((body) => body.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error("INVALID_CONFIG", "duplicate body ID");
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
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => {
    if (disposed) error("DISPOSED", "world is disposed");
  };
  return {
    getState() {
      ensureActive();
      return publicState2(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error("INVALID_STEP", "step must equal configured fixedStepSeconds");
      if (stepIndex >= MAX_STEPS) error("WORLD_LIMIT", "world step limit reached");
      const actions = parseCommands(commands, bodies);
      if (dynamicHinge) admitDynamicHingeCommands(dynamicHinge, bodies, actions);
      if (ccd.kind === "box-pair") rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
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
      for (let pass = 0; pass < SOLVER_PASSES; pass++) {
        if (bounds && pass > 0) for (let index = 0; index < next.length; index++) {
          if (next[index].kind !== "static") bounds[index] = bodyBounds(next[index]);
        }
        for (const [aIndex, bIndex] of pairs) {
          nextPairStats.eligiblePairs++;
          if (largeMode && pass > 0 && dormantPair(next[aIndex], next[bIndex])) continue;
          if (bounds) {
            nextPairStats.aabbTests++;
            if (!boundsOverlap(bounds[aIndex], bounds[bIndex])) continue;
          }
          nextPairStats.candidatePairs++;
          const a = next[aIndex], b = next[bIndex];
          const hit2 = detect(a, b);
          if (!hit2) continue;
          if (hit2.penetration > MAX_STEP_DISPLACEMENT_M) error("NUMERIC_LIMIT", "contact penetration exceeded limit");
          const key = `${a.id}\0${b.id}`;
          if (a.sensor || b.sensor) {
            sensed.set(key, { aId: a.id, bId: b.id, kind: "sensor" });
            continue;
          }
          if (largeMode) wakeOnContact(a, b, nextSleepFrames, aIndex, bIndex);
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
          contact.pointM = points.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / points.length);
          contact.penetrationM = Math.max(contact.penetrationM, hit2.penetration);
          if (largeMode && dormantPair(a, b)) continue;
          if (manifold) {
            for (const point of manifold) {
              const pointKey = `${key}\0${point.id}`;
              let impulse = nextPersistentPoints.get(pointKey);
              if (!impulse) {
                const prior = persistentPoints.get(pointKey);
                impulse = prior ? { normalNs: prior.normalNs, tangentNs: [...prior.tangentNs] } : { normalNs: 0, tangentNs: [0, 0, 0] };
                nextPersistentPoints.set(pointKey, impulse);
                if (prior) warmStartPoint(a, b, point.pointM, hit2.normal, impulse);
              }
            }
            for (let iteration = 0; iteration < 8; iteration++) {
              const order = iteration % 2 ? [...manifold].reverse() : manifold;
              for (const point of order) {
                const impulse = nextPersistentPoints.get(`${key}\0${point.id}`);
                solvePersistentPoint(a, b, point.pointM, hit2.normal, impulse);
              }
            }
            correctPersistentPair(a, b, hit2.normal, hit2.penetration);
            contact.impulseNs = 0;
            contact.tangentImpulseNs = [0, 0, 0];
            for (const point of manifold) {
              const impulse = nextPersistentPoints.get(`${key}\0${point.id}`);
              contact.impulseNs += impulse.normalNs;
              contact.tangentImpulseNs = add(contact.tangentImpulseNs, impulse.tangentNs);
            }
          } else {
            const resolved = solve(a, b, hit2);
            contact.impulseNs += resolved.normalImpulseNs;
            contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
          }
          if (bounds) {
            bounds[aIndex] = bodyBounds(a);
            bounds[bIndex] = bodyBounds(b);
          }
        }
        for (let index = 0; index < joints.length; index++) {
          const reaction = projectJoint(joints[index], next, bodies, dt);
          nextJoints[index].linearImpulseNs = add(nextJoints[index].linearImpulseNs, reaction.linearImpulseNs);
          nextJoints[index].angularImpulseNms = add(nextJoints[index].angularImpulseNms, reaction.angularImpulseNms);
          if (reaction.angleRad !== void 0) nextJoints[index].angleRad = reaction.angleRad;
        }
      }
      const nextContacts = [...found.values()];
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
      const direction = queryVector(query.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) {
        error("INVALID_QUERY", "direction must be a unit 3-vector");
      }
      const limit = queryNumber(query.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
      const sensors = includeSensors(query);
      let best = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction, body);
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

// packages/barocss-physics/src/character/profile.ts
var DT3 = 1 / 120;
var WALKABLE = Math.cos(10 * Math.PI / 180);
export {
  PhysicsError,
  createHingeVelocityWorldCandidate,
  createPhysicsWorld
};
