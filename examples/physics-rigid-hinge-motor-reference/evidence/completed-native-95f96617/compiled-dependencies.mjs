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
  const magnitude2 = Math.hypot(...values);
  if (Math.abs(magnitude2 - 1) > 1e-6)
    error("INVALID_CONFIG", "orientation must have unit norm");
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
    if (Object.hasOwn(previous, valueKey))
      error("INVALID_COMMAND", `duplicate ${kind} command for ${body.id}`);
    const bound = kind === "force" ? MAX_FORCE_N : kind === "impulse" ? MAX_IMPULSE_NS : kind === "torque" ? MAX_TORQUE_NM : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS : 1e4;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted;
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
var worldPoint = (body, point) => add(body.positionM, rotate(body.orientation, point));
function inverseInertia(body, vector2) {
  const local = rotate(inverse(body.orientation), vector2);
  return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}

// packages/barocss-physics/dist/dynamic-hinge-joint.js
var magnitude = (vector2) => Math.hypot(...vector2);
function admitDynamicHingeCommands(joint, bodies, actions) {
  const axis = joint.axisWorld;
  for (const bodyIndex of [joint.aIndex, joint.bIndex]) {
    const action = actions.get(bodies[bodyIndex].id);
    if (!action)
      continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector2) => vector2 !== void 0).some((vector2) => magnitude(sub(vector2, scale(axis, dot(vector2, axis)))) > 1e-12)) {
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

// packages/barocss-physics/dist/collision.js
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
  const norm = normInf(g), threshold = checked(1e-12 * Math.max(1, norm));
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
  const conditionInf = checked(norm * normInf(inverse2));
  if (conditionInf > 1e12) fail("system");
  const y = fromLambda(problem, a, lambda), residuals = phaseResiduals(g, rhs, lambda, inverse2);
  if (residuals.linear > GATE || residuals.inverse > GATE) fail("certificate");
  return { rowIds: Array.from({ length: n }, (_, i) => i), rowCount: n, pivots, inverse: inverse2, normInf: norm, conditionInf, lambda, y, residuals };
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
  const norm = normInf(g, "certificate"), condition = checked(norm * normInf(phase.inverse, "certificate"), "certificate");
  if (!Object.is(norm, phase.normInf) || !Object.is(condition, phase.conditionInf) || condition > 1e12 || phase.pivots.some((value) => Math.abs(value) <= 1e-12 * Math.max(1, norm))) fail("certificate");
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
function copyPair(bodies) {
  return [copyBody(bodies[0]), copyBody(bodies[1])];
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
function diagnosticsError() {
  throw new PhysicsError("NUMERIC_LIMIT", ERRORS3.diagnostics);
}
function knownCalculationError(value, bodies) {
  try {
    if (!(value instanceof PhysicsError)) return null;
    const code = Object.getOwnPropertyDescriptor(value, "code");
    const message = Object.getOwnPropertyDescriptor(value, "message");
    const name = Object.getOwnPropertyDescriptor(value, "name");
    if (!code || !message || !name || !("value" in code) || !("value" in message) || !("value" in name) || name.value !== "PhysicsError" || typeof message.value !== "string") return null;
    const numeric = [
      ERRORS3.pose,
      ERRORS3.result,
      ERRORS3.linear,
      ERRORS3.system,
      ERRORS3.certificate,
      ERRORS3.reaction,
      ERRORS3.diagnostics,
      ...bodies.flatMap((b) => [
        `${b.id} exceeded angular movement limit`,
        `${b.id} exceeded step displacement limit`,
        `${b.id} position exceeded bounds`,
        `${b.id} velocity exceeded bounds`,
        `${b.id} angularVelocity exceeded bounds`,
        `${b.id} orientation exceeded tolerance`
      ])
    ];
    if (code.value === "NUMERIC_LIMIT" && numeric.includes(message.value) || code.value === "INVALID_CONFIG" && message.value === ERRORS3.profile || code.value === "INVALID_STEP" && message.value === ERRORS3.dt) {
      return { name: "PhysicsError", code: code.value, message: message.value };
    }
  } catch {
  }
  return null;
}

// examples/physics-rigid-hinge-motor-reference/options.ts
function admitOptions(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PhysicsError("INVALID_CONFIG", ERRORS3.options);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length === 0 && ownData(value, []) !== null) return {};
  const input = ownData(value, ["observeAttempt"]);
  if (!input || typeof input.observeAttempt !== "function") {
    throw new PhysicsError("INVALID_CONFIG", ERRORS3.options);
  }
  return { observeAttempt: input.observeAttempt };
}

// packages/barocss-physics/dist/joint-motor.js
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

// examples/physics-rigid-hinge-motor-reference/motor-stages.ts
function actionRecords(bodies, actions) {
  return bodies.map((body) => {
    const action = actions.get(body.id);
    return {
      bodyId: body.id,
      torqueNm: action?.torqueNm ? [...action.torqueNm] : null,
      angularImpulseNms: action?.angularImpulseNms ? [...action.angularImpulseNms] : null
    };
  });
}
function applyAngularCommands(bodies, actions, dt) {
  for (const body of bodies) {
    const action = actions.get(body.id);
    body.angularVelocityRadps = add(
      body.angularVelocityRadps,
      inverseInertia(body, add(
        action?.angularImpulseNms ?? [0, 0, 0],
        scale(action?.torqueNm ?? [0, 0, 0], dt)
      ))
    );
  }
}
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
function integrateFree(bodies, actions, gravity, dt) {
  for (const body of bodies) {
    const action = actions.get(body.id);
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
function makeFreeCarrier(carrier, free) {
  const result = copyData(carrier);
  for (let i = 0; i < 2; i++) {
    result.bodies[i].positionM = [...free[i].positionM];
    result.bodies[i].velocityMps = [...free[i].velocityMps];
    result.bodies[i].orientation = [...free[i].orientation];
    result.bodies[i].angularVelocityRadps = [...free[i].angularVelocityRadps];
  }
  return result;
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
  const norm = Math.hypot(...vector2);
  if (!Number.isFinite(norm)) reactionError();
  if (norm > 0.01) throw new PhysicsError("NUMERIC_LIMIT", `${jointId} exceeded motor reaction limit`);
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

// examples/physics-rigid-hinge-motor-reference/diagnostics.ts
function spinMidpoint(before, after) {
  return before.map((body, i) => 0.5 * body.inertiaKgM2 * dot(
    sub(after[i].angularVelocityRadps, body.angularVelocityRadps),
    add(body.angularVelocityRadps, after[i].angularVelocityRadps)
  ));
}
function makeDiagnostics(input) {
  const frames = input.frames;
  const metrics = {
    source: measureBodies(frames.sourceBodies, input.joint, input.origin),
    angular: measureBodies(frames.angularBodies, input.joint, input.origin),
    motor: measureBodies(frames.motorBodies, input.joint, input.origin),
    free: measureBodies(frames.freeBodies, input.joint, input.origin),
    projected: measureBodies(frames.projectedBodies, input.joint, input.origin)
  };
  const energyByPhase = {
    sourceJ: metrics.source.energyJ,
    angularJ: metrics.angular.energyJ,
    motorJ: metrics.motor.energyJ,
    freeJ: metrics.free.energyJ,
    projectedJ: metrics.projected.energyJ
  };
  const externalAngularByBodyJ = spinMidpoint(frames.sourceBodies, frames.angularBodies);
  const motorByBody = spinMidpoint(frames.angularBodies, frames.motorBodies);
  const motorMidpointJ = input.motor.impulseNms * (input.motor.relativeSpeedBeforeRadps + input.motor.relativeSpeedAfterRadps) * 0.5;
  const motorSpinMidpointJ = motorByBody[0] + motorByBody[1];
  const work = {
    externalAngularByBodyJ,
    externalAngularTotalJ: externalAngularByBodyJ[0] + externalAngularByBodyJ[1],
    motorMidpointJ,
    motorSpinMidpointJ,
    motorResidualJ: motorSpinMidpointJ - motorMidpointJ,
    freeDeltaKJ: energyByPhase.freeJ - energyByPhase.motorJ,
    projectionDeltaKJ: energyByPhase.projectedJ - energyByPhase.freeJ,
    projectionObjectiveJ: input.projection.diagnostics.projection.objectiveJ
  };
  const result = {
    sourceStepIndex: input.sourceStepIndex,
    sourceTimeSeconds: input.sourceTimeSeconds,
    acceptedReportAngleRad: input.acceptedReportAngleRad,
    rawSourceAngleRad: metrics.source.relativeAngleRad,
    rawFreeAngleRad: metrics.free.relativeAngleRad,
    rawFinalAngleRad: metrics.projected.relativeAngleRad,
    parsedActions: copyData(input.parsedActions),
    frames: copyData(frames),
    metrics: copyData(metrics),
    motor: copyData(input.motor),
    projection: copyData(input.projection),
    bodyCorrections: copyData(input.bodyCorrections),
    energyByPhase: copyData(energyByPhase),
    work: copyData(work),
    reportCap: copyData(input.reportCap),
    calls: { motorCalls: 1, projectionCalls: 1 }
  };
  validateDiagnostics(result);
  return copyData(result);
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
function validateDiagnostics(value) {
  const keys = [
    "sourceStepIndex",
    "sourceTimeSeconds",
    "acceptedReportAngleRad",
    "rawSourceAngleRad",
    "rawFreeAngleRad",
    "rawFinalAngleRad",
    "parsedActions",
    "frames",
    "metrics",
    "motor",
    "projection",
    "bodyCorrections",
    "energyByPhase",
    "work",
    "reportCap",
    "calls"
  ];
  if (!ownData(value, keys) || !Number.isSafeInteger(value.sourceStepIndex) || value.sourceStepIndex < 0 || value.sourceStepIndex > 3600 || value.sourceTimeSeconds !== value.sourceStepIndex * (1 / 120)) diagnosticsError();
  if (!Array.isArray(value.parsedActions) || value.parsedActions.length !== 2 || Reflect.ownKeys(value.parsedActions).length !== 3) diagnosticsError();
  for (let i = 0; i < 2; i++) {
    const action = ownData(value.parsedActions[i], ["bodyId", "torqueNm", "angularImpulseNms"]);
    if (!action || action.bodyId !== value.frames.sourceBodies[i].id || action.torqueNm !== null && denseNumbers(action.torqueNm, 3) === null || action.angularImpulseNms !== null && denseNumbers(action.angularImpulseNms, 3) === null) diagnosticsError();
  }
  for (const key of keys.filter((k) => k !== "parsedActions")) {
    if (!finiteTree(value[key])) diagnosticsError();
  }
  if (!ownData(value.frames, ["sourceBodies", "angularBodies", "motorBodies", "freeBodies", "projectedBodies"]) || Object.values(value.frames).some((pair) => pair.length !== 2) || !ownData(value.metrics, ["source", "angular", "motor", "free", "projected"]) || !ownData(value.motor, [
    "inputAngleRad",
    "targetSpeedRadps",
    "limitRad",
    "maxImpulseNms",
    "blocked",
    "impulseNms",
    "relativeSpeedBeforeRadps",
    "relativeSpeedAfterRadps"
  ]) || !ownData(value.projection, ["bodies", "poseReport", "diagnostics"]) || !ownData(value.energyByPhase, ["sourceJ", "angularJ", "motorJ", "freeJ", "projectedJ"]) || !ownData(value.work, [
    "externalAngularByBodyJ",
    "externalAngularTotalJ",
    "motorMidpointJ",
    "motorSpinMidpointJ",
    "motorResidualJ",
    "freeDeltaKJ",
    "projectionDeltaKJ",
    "projectionObjectiveJ"
  ]) || !ownData(value.reportCap, ["angularReactionNormNms", "maxReactionNms", "exceedsCap"]) || !ownData(value.calls, ["motorCalls", "projectionCalls"]) || value.calls.motorCalls !== 1 || value.calls.projectionCalls !== 1 || Object.values(value.energyByPhase).some((energy) => energy < 0) || value.work.projectionObjectiveJ < 0 || !denseNumbers(value.work.externalAngularByBodyJ, 2) || value.reportCap.maxReactionNms !== 0.01 || value.reportCap.exceedsCap !== value.reportCap.angularReactionNormNms > 0.01) diagnosticsError();
}

// examples/physics-rigid-hinge-motor-reference/candidate.ts
function advanceDrivenHingePairReference(config, carrier, dt, commands = [], privateOptions = {}) {
  const input = prepareInput(config, carrier, dt);
  const source = copyPair(input.bodies);
  const actions = parseCommands(commands, source);
  admitDynamicHingeCommands(input.joint, source, actions);
  const options = admitOptions(privateOptions);
  const parsedActions = actionRecords(source, actions), working = copyPair(source);
  const attempt = {
    stage: "admitted",
    sourceStepIndex: input.carrier.stepIndex,
    sourceTimeSeconds: input.carrier.timeSeconds,
    acceptedReportAngleRad: input.carrier.joints[0].angleRad,
    parsedActions: copyData(parsedActions),
    frames: {
      sourceBodies: copyPair(source),
      angularBodies: null,
      motorBodies: null,
      freeBodies: null,
      projectedBodies: null
    },
    motor: null,
    projection: null,
    jointReport: null,
    bodyCorrections: null,
    energyByPhase: null,
    work: null,
    reportCap: null,
    calls: { motorCalls: 0, projectionCalls: 0 },
    error: null
  };
  let diagnostics = null;
  let failure = null;
  try {
    applyAngularCommands(working, actions, dt);
    attempt.frames.angularBodies = copyPair(working);
    attempt.stage = "angular-ready";
    const motor = applyOriginalMotor(working, input.joint, attempt.acceptedReportAngleRad, attempt.calls);
    attempt.motor = copyData(motor);
    attempt.frames.motorBodies = copyPair(working);
    attempt.stage = "motor-ready";
    integrateFree(working, actions, input.config.gravityMps2, dt);
    attempt.frames.freeBodies = copyPair(working);
    attempt.stage = "free-ready";
    const freeCarrier = makeFreeCarrier(input.carrier, working);
    attempt.calls.projectionCalls = 1;
    const projection = projectHingePoseVelocityReference(input.config, freeCarrier, dt);
    attempt.projection = copyData(projection);
    attempt.frames.projectedBodies = copyPair(projection.bodies);
    attempt.stage = "projection-ready";
    const report = makeReport(
      input.joint,
      working,
      copyPair(projection.bodies),
      projection.poseReport.targetAngleRad,
      motor.impulseNms
    );
    const origin = scale(add(input.config.bodies[0].positionM, input.config.bodies[1].positionM), 0.5);
    const frames = {
      sourceBodies: copyPair(source),
      angularBodies: copyPair(attempt.frames.angularBodies),
      motorBodies: copyPair(attempt.frames.motorBodies),
      freeBodies: copyPair(working),
      projectedBodies: copyPair(projection.bodies)
    };
    diagnostics = makeDiagnostics({
      sourceStepIndex: attempt.sourceStepIndex,
      sourceTimeSeconds: attempt.sourceTimeSeconds,
      acceptedReportAngleRad: attempt.acceptedReportAngleRad,
      parsedActions,
      frames,
      joint: input.joint,
      origin,
      motor,
      projection,
      bodyCorrections: report.bodyCorrections,
      reportCap: report.reportCap
    });
    attempt.jointReport = copyData(report.jointReport);
    attempt.bodyCorrections = copyData(report.bodyCorrections);
    attempt.reportCap = copyData(report.reportCap);
    attempt.energyByPhase = copyData(diagnostics.energyByPhase);
    attempt.work = copyData(diagnostics.work);
    attempt.stage = "report-ready";
  } catch (received) {
    const known = knownCalculationError(received, source);
    if (known === null) throw received;
    attempt.error = known;
    failure = { value: received };
  }
  if (failure !== null) {
    options.observeAttempt?.(copyData(attempt));
    throw failure.value;
  }
  options.observeAttempt?.(copyData(attempt));
  enforceHingeMotorReactionCap(input.joint.id, attempt.jointReport.angularImpulseNms);
  return {
    bodies: copyPair(attempt.frames.projectedBodies),
    jointReport: copyData(attempt.jointReport),
    diagnostics: copyData(diagnostics)
  };
}
export {
  ERRORS3 as ERRORS,
  PhysicsError,
  admitDynamicHingeCommands,
  advanceDrivenHingePairReference,
  driveDynamicHingeMotor,
  enforceHingeMotorReactionCap,
  parseCommands,
  prepareInput,
  validateHingeMotorReport
};
