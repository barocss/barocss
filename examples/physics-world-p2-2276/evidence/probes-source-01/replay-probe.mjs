// examples/physics-scene/replay-probe.mjs
import assert from "node:assert/strict";

// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
    this.details = { code, reason: message, operation: "create", phase: "admission", domain: "world", entityIds: [], accepted: null, ...details };
  }
  details;
};

// packages/barocss-physics/src/identity.ts
function copyData(input) {
  let count = 0;
  function copy(value, depth) {
    if (++count > 1e6 || depth > 32) throw new PhysicsError("INVALID_CONFIG", "data exceeds bounded depth or size");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") {
      for (const character of value) {
        const point = character.codePointAt(0);
        if (point >= 55296 && point <= 57343) throw new PhysicsError("INVALID_CONFIG", "strings must be well-formed Unicode");
      }
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "object" || value === null) throw new PhysicsError("INVALID_CONFIG", "only finite plain data is supported");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1 || !Array.from({ length: value.length }, (_, i) => descriptors[i]?.enumerable && "value" in descriptors[i]).every(Boolean)) {
        throw new PhysicsError("INVALID_CONFIG", "arrays must be dense ordinary data arrays");
      }
      return Array.from({ length: value.length }, (_, i) => copy(descriptors[i].value, depth + 1));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype || keys.some((key) => typeof key !== "string" || !/^[\x20-\x7e]+$/.test(key) || !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
      throw new PhysicsError("INVALID_CONFIG", "records must have plain ASCII data fields");
    }
    return Object.fromEntries(keys.map((key) => [key, copy(descriptors[key].value, depth + 1)]));
  }
  return copy(input, 0);
}
function canonicalEncode(input) {
  const value = copyData(input);
  const bytes = [];
  const encodeUtf8 = (text2) => {
    const result = [];
    for (const character of text2) {
      let point = character.codePointAt(0);
      if (point >= 55296 && point <= 57343) point = 65533;
      if (point < 128) result.push(point);
      else if (point < 2048) result.push(192 | point >> 6, 128 | point & 63);
      else if (point < 65536) result.push(224 | point >> 12, 128 | point >> 6 & 63, 128 | point & 63);
      else result.push(240 | point >> 18, 128 | point >> 12 & 63, 128 | point >> 6 & 63, 128 | point & 63);
    }
    return result;
  };
  const uint32 = (number2) => {
    for (let i = 0; i < 4; i++) bytes.push(number2 >>> i * 8 & 255);
  };
  function write(item) {
    if (item === null) {
      bytes.push(0);
      return;
    }
    if (typeof item === "boolean") {
      bytes.push(item ? 2 : 1);
      return;
    }
    if (typeof item === "string") {
      const encoded2 = encodeUtf8(item);
      bytes.push(3);
      uint32(encoded2.length);
      for (const byte of encoded2) bytes.push(byte);
      return;
    }
    if (typeof item === "number") {
      bytes.push(4);
      const data = new DataView(new ArrayBuffer(8));
      data.setFloat64(0, item, true);
      for (let i = 0; i < 8; i++) bytes.push(data.getUint8(i));
      return;
    }
    if (Array.isArray(item)) {
      bytes.push(5);
      uint32(item.length);
      for (const entry of item) write(entry);
      return;
    }
    const record3 = item;
    const keys = Object.keys(record3).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record3[key]);
    }
  }
  write(value);
  return Uint8Array.from(bytes);
}
var K = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
var rotate = (x, n) => x >>> n | x << 32 - n;
function sha256(bytes) {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const view = new DataView(padded.buffer);
  const bits = bytes.length * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
  view.setUint32(padded.length - 4, bits >>> 0);
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a2 = w[i - 15], b2 = w[i - 2];
      w[i] = w[i - 16] + (rotate(a2, 7) ^ rotate(a2, 18) ^ a2 >>> 3) + w[i - 7] + (rotate(b2, 17) ^ rotate(b2, 19) ^ b2 >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = j + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0;
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      j = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    for (const [i, v] of [a, b, c, d, e, f, g, j].entries()) h[i] = h[i] + v >>> 0;
  }
  return `sha256:${h.map((word) => word.toString(16).padStart(8, "0")).join("")}`;
}
function digest(value) {
  return sha256(canonicalEncode(value));
}

// packages/barocss-physics/src/limits.ts
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_STEPS = 3600;
var MAX_STEP_DISPLACEMENT_M = 10;
var MAX_COMMANDS = 64;
var MAX_FORCE_N = 1e6;
var MAX_IMPULSE_NS = 1e5;
var MAX_TORQUE_NM = 1e6;
var MAX_ANGULAR_IMPULSE_NMS = 1e5;
var SOLVER_PASSES = 8;

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
function copyBody(body2) {
  return {
    ...body2,
    shape: copyShape(body2.shape),
    positionM: [...body2.positionM],
    velocityMps: [...body2.velocityMps],
    orientation: [...body2.orientation],
    angularVelocityRadps: [...body2.angularVelocityRadps],
    ...body2.collisionFilter ? { collisionFilter: { ...body2.collisionFilter } } : {},
    ...body2.inertiaDiagonalKgM2 ? { inertiaDiagonalKgM2: [...body2.inertiaDiagonalKgM2] } : {},
    inverseInertiaLocal: [...body2.inverseInertiaLocal]
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
  const byId = new Map(bodies.map((body2) => [body2.id, body2]));
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
    const body2 = typeof bodyId === "string" ? byId.get(bodyId) : void 0;
    if (!body2 || (kind === "kinematicTarget" ? body2.kind !== "kinematic" : body2.kind !== "dynamic")) {
      error("INVALID_COMMAND", `command ${index} targets an unknown or unsupported body`);
    }
    const previous = admitted.get(body2.id) ?? {};
    if (Object.hasOwn(previous, valueKey)) error("INVALID_COMMAND", `duplicate ${kind} command for ${body2.id}`);
    const bound = kind === "force" ? MAX_FORCE_N : kind === "impulse" ? MAX_IMPULSE_NS : kind === "torque" ? MAX_TORQUE_NM : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS : 1e4;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted.set(body2.id, { ...previous, [valueKey]: value });
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
function advanceOrientation(orientation, angularVelocity, dt2) {
  const speed = Math.hypot(...angularVelocity);
  if (speed === 0) return [...orientation];
  const halfAngle = speed * dt2 / 2;
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
function rotate2(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}
var localPoint = (body2, point) => rotate2(inverse(body2.orientation), sub(point, body2.positionM));
var worldPoint = (body2, point) => add(body2.positionM, rotate2(body2.orientation, point));
function inverseInertia(body2, vector3) {
  const local = rotate2(inverse(body2.orientation), vector3);
  return rotate2(body2.orientation, local.map((value, index) => value * body2.inverseInertiaLocal[index]));
}
function inertia(body2, vector3) {
  const local = rotate2(inverse(body2.orientation), vector3);
  return rotate2(body2.orientation, local.map((value, index) => value / body2.inverseInertiaLocal[index]));
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
function applyPairAngle(body2, angle, dt2) {
  if (Math.hypot(...angle) > 1) error("NUMERIC_LIMIT", "dynamic pair angular correction exceeds limit");
  body2.orientation = advanceOrientation(body2.orientation, angle, 1);
  body2.angularVelocityRadps = add(body2.angularVelocityRadps, scale(angle, 1 / dt2));
}
function projectDynamicPairAnchors(a, b, anchorA, anchorB, dt2) {
  const armA = rotate2(a.orientation, anchorA);
  const armB = rotate2(b.orientation, anchorB);
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
  a.velocityMps = add(a.velocityMps, scale(moveA, 1 / dt2));
  b.velocityMps = add(b.velocityMps, scale(moveB, 1 / dt2));
  applyPairAngle(a, scale(inverseInertia(a, cross(armA, correction)), -1), dt2);
  applyPairAngle(b, inverseInertia(b, cross(armB, correction)), dt2);
}

// packages/barocss-physics/src/dynamic-fixed-joint.ts
function orientationError(actual, desired) {
  const relative = multiplyQuaternion(actual, inverse(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector3 = scale([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector3);
  if (sine < 1e-12) return scale(vector3, 2);
  return scale(vector3, 2 * Math.atan2(sine, sign * relative[3]) / sine);
}
function projectDynamicFixedJoint(joint, bodies, dt2) {
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
  applyPairAngle(a, scale(inverseInertia(a, angularImpulse), -1), dt2);
  applyPairAngle(b, inverseInertia(b, angularImpulse), dt2);
  projectDynamicPairAnchors(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt2);
  return {
    id: joint.id,
    kind: joint.kind,
    aId: a.id,
    bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeLinear), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular))
  };
}

// packages/barocss-physics/src/dynamic-hinge-joint.ts
var magnitude = (vector3) => Math.hypot(...vector3);
var near = (a, b) => magnitude(sub(a, b)) <= 1e-9;
function offsetFixture(joint, a, b) {
  return near(a.positionM, [-0.1, 0, 0]) && near(b.positionM, [0.1, 0, 0]) && near(joint.anchorALocalM, [0.1, 0, 0]) && near(joint.anchorBLocalM, [-0.1, 0, 0]) && near(joint.axisWorld, [0, 0, 1]) && Math.abs(joint.limitRad[0] + 0.8) <= 1e-9 && Math.abs(joint.limitRad[1] - 0.8) <= 1e-9 && a.inverseMass === 1 && b.inverseMass === 1 && a.shape.kind === "sphere" && b.shape.kind === "sphere" && a.shape.radiusM === 0.1 && b.shape.radiusM === 0.1 && joint.motor?.targetSpeedRadps === 0.5 && joint.motor.maxImpulseNms === 1e-4 && joint.motor.maxReactionNms === 0.01;
}
function admitDynamicHingeScene(joint, bodies, gravity) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity2 = [0, 0, 0, 1];
  const centred = near(a.positionM, b.positionM) && magnitude(joint.anchorALocalM) === 0 && magnitude(joint.anchorBLocalM) === 0;
  if (magnitude(gravity) !== 0 || !centred && !offsetFixture(joint, a, b) || [a, b].some((body2) => magnitude(body2.velocityMps) !== 0 || magnitude(body2.angularVelocityRadps) !== 0 || body2.orientation.some((value, index) => Math.abs(value - identity2[index]) > 1e-12))) {
    error("INVALID_CONFIG", "dynamic hinge needs an admitted resting pair and zero gravity");
  }
}
function admitDynamicHingeCommands(joint, bodies, actions) {
  const axis = joint.axisWorld;
  for (const bodyIndex of [joint.aIndex, joint.bIndex]) {
    const action = actions.get(bodies[bodyIndex].id);
    if (!action) continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector3) => vector3 !== void 0).some((vector3) => magnitude(sub(vector3, scale(axis, dot(vector3, axis)))) > 1e-12)) {
      error("INVALID_COMMAND", "dynamic hinge admits axis-aligned angular commands only");
    }
  }
}
function projectDynamicHingeJoint(joint, bodies, dt2) {
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
    a.angularVelocityRadps = add(a.angularVelocityRadps, scale(axis, angleA / dt2));
    b.angularVelocityRadps = add(b.angularVelocityRadps, scale(axis, angleB / dt2));
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
  projectDynamicPairAnchors(a, b, joint.anchorALocalM, joint.anchorBLocalM, dt2);
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
  const byId = new Map(bodies.map((body2, index) => [body2.id, { body: body2, index }]));
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
function projectJoint(joint, next, previous, dt2) {
  const a = next[joint.aIndex], b = next[joint.bIndex];
  if (a.kind === "dynamic") return joint.kind === "fixed" ? projectDynamicFixedJoint(joint, next, dt2) : projectDynamicHingeJoint(joint, next, dt2);
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
  const targetPosition = sub(worldPoint(a, joint.anchorALocalM), rotate2(b.orientation, joint.anchorBLocalM));
  if (Math.hypot(...sub(targetPosition, b.positionM)) > MAX_STEP_DISPLACEMENT_M) {
    error("NUMERIC_LIMIT", `${joint.id} projection exceeded movement limit`);
  }
  b.positionM = targetPosition;
  b.velocityMps = scale(sub(targetPosition, previous[joint.bIndex].positionM), 1 / dt2);
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

// packages/barocss-physics/src/model-admission.ts
function exact(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) error("INVALID_CONFIG", `${label} must be a record`);
  const input = value;
  if (Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) error("INVALID_CONFIG", `${label} requires exact fields: ${keys.join(",")}`);
  return input;
}
function text(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) error("INVALID_CONFIG", `${label} must be a bounded nonempty string`);
  return value;
}
function list(value, maximum, label) {
  if (!Array.isArray(value) || value.length > maximum) error("INVALID_CONFIG", `${label} exceeds the profile bound`);
  return value;
}
function transform(value, label) {
  const t = exact(value, ["positionM", "orientationXYZW"], label);
  vector(t.positionM, -1e4, 1e4, `${label}.positionM`);
  if (!Array.isArray(t.orientationXYZW) || t.orientationXYZW.length !== 4) error("INVALID_CONFIG", `${label} requires an XYZW quaternion`);
  const q = t.orientationXYZW.map((x) => finite(x, -1, 1, label));
  if (Math.abs(Math.hypot(...q) - 1) > 1e-6) error("INVALID_CONFIG", `${label} quaternion must have unit norm`);
}
function admitModel(rawModel, rawOptions) {
  const model2 = copyData(rawModel);
  const options2 = copyData(rawOptions);
  const input = exact(model2, ["format", "version", "revision", "frame", "units", "gravityMps2", "bodies", "colliders", "joints", "cloths", "fluids", "sourceBindings"], "model");
  if (input.format !== "barocss-physics-model" || input.version !== 1) error("INVALID_CONFIG", "unsupported model format or version");
  text(input.revision, "revision");
  const frame = exact(input.frame, ["id", "basis", "rotation"], "frame");
  text(frame.id, "frame.id");
  if (frame.basis !== "right-handed-xyz" || frame.rotation !== "local-to-world-xyzw") error("INVALID_CONFIG", "unsupported frame convention");
  const units = exact(input.units, ["length", "mass", "time", "angle"], "units");
  if (units.length !== "m" || units.mass !== "kg" || units.time !== "s" || units.angle !== "rad") error("INVALID_CONFIG", "model units must be m/kg/s/rad");
  vector(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const opt = exact(options2, ["profile", "fixedStepSeconds", "broadPhase"], "options");
  if (!["rigid-discrete-v1", "rigid-persistent-box-v1", "rigid-large-v1"].includes(opt.profile)) error("INVALID_CONFIG", "profile is not implemented");
  finite(opt.fixedStepSeconds, 1 / 240, 1 / 30, "fixedStepSeconds");
  const large = opt.profile === "rigid-large-v1";
  if (opt.broadPhase !== "aabb" && (large || opt.broadPhase !== "direct")) error("INVALID_CONFIG", "unsupported broadPhase for profile");
  const bodyInputs = list(input.bodies, large ? 64 : opt.profile === "rigid-persistent-box-v1" ? 4 : 32, "bodies");
  if (bodyInputs.length === 0) error("INVALID_CONFIG", "at least one body is required");
  const colliders = list(input.colliders, bodyInputs.length, "colliders");
  const jointInputs = list(input.joints, large ? 0 : 8, "joints");
  list(input.cloths, 0, "cloths");
  list(input.fluids, 0, "fluids");
  const bindings = list(input.sourceBindings, 128, "sourceBindings");
  const ids2 = /* @__PURE__ */ new Set();
  function id(value) {
    if (typeof value !== "string" || !ID.test(value) || ids2.has(value)) error("INVALID_CONFIG", "invalid or duplicate global entity ID");
    ids2.add(value);
    return value;
  }
  const bodiesById = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const raw = value;
    const b = exact(value, raw?.kind === "dynamic" ? ["id", "kind", "massKg", "inertia", "initial"] : ["id", "kind", "initial"], "body");
    const bodyId = id(b.id);
    if (!["dynamic", "static", "kinematic"].includes(b.kind)) error("INVALID_CONFIG", "unsupported body kind");
    if (b.kind === "dynamic") {
      const initial = exact(b.initial, ["positionM", "orientationXYZW", "velocityMps", "angularVelocityRadps"], "initial");
      transform({ positionM: initial.positionM, orientationXYZW: initial.orientationXYZW }, "initial");
      vector(initial.velocityMps, -1e3, 1e3, "velocityMps");
      vector(initial.angularVelocityRadps, -1e3, 1e3, "angularVelocityRadps");
      finite(b.massKg, 1e-6, 1e6, "massKg");
      const i = b.inertia;
      exact(i, i?.kind === "sphere-isotropic" ? ["kind", "about", "frame", "kgM2"] : ["kind", "about", "frame"], "inertia");
      if (i.about !== "com" || i.frame !== "body-local" || !["primitive-com", "sphere-isotropic"].includes(i.kind)) error("INVALID_CONFIG", "unsupported inertia");
      if (i.kind === "sphere-isotropic") finite(i.kgM2, 1e-12, 1e12, "inertia.kgM2");
    } else transform(b.initial, "initial");
    bodiesById.set(bodyId, b);
  }
  const colliderByBody = /* @__PURE__ */ new Map();
  for (const value of colliders) {
    const c = exact(value, ["id", "bodyId", "geometry", "local", "material", "sensor", "ccd", "filter"], "collider");
    id(c.id);
    if (typeof c.bodyId !== "string" || !bodiesById.has(c.bodyId) || colliderByBody.has(c.bodyId)) error("INVALID_CONFIG", "collider requires a unique declared owner");
    transform(c.local, "collider.local");
    const local = c.local;
    if (local.positionM.some((x) => x !== 0) || local.orientationXYZW.some((x, i) => x !== (i === 3 ? 1 : 0))) error("INVALID_CONFIG", "only identity-local colliders are admitted");
    if (typeof c.sensor !== "boolean" || typeof c.ccd !== "boolean") error("INVALID_CONFIG", "sensor and ccd must be explicit booleans");
    const material = exact(c.material, ["restitution", "friction"], "material");
    exact(material.friction, ["static", "dynamic"], "friction");
    const filter = exact(c.filter, ["categoryBits", "maskBits"], "filter");
    if (!large && (filter.categoryBits !== 1 || filter.maskBits !== 65535)) error("INVALID_CONFIG", "non-large profile requires no-filter values");
    const body2 = bodiesById.get(c.bodyId);
    if (c.sensor && body2.kind === "dynamic" || c.ccd && body2.kind !== "dynamic") error("INVALID_CONFIG", "unsupported sensor or CCD body role");
    colliderByBody.set(c.bodyId, c);
  }
  if (colliderByBody.size !== bodyInputs.length) error("INVALID_CONFIG", "each rigid body requires exactly one collider");
  const bodies = bodyInputs.map((value) => {
    const b = value;
    const c = colliderByBody.get(b.id);
    const initial = b.initial;
    const material = c.material;
    const inertia2 = b.inertia;
    return parseBody({
      id: b.id,
      kind: b.kind,
      shape: c.geometry,
      positionM: initial.positionM,
      orientation: initial.orientationXYZW,
      restitution: material.restitution,
      friction: material.friction,
      ...large ? { collisionFilter: c.filter } : {},
      ...c.sensor ? { sensor: true } : {},
      ...c.ccd ? { ccd: true } : {},
      ...b.kind === "dynamic" ? {
        massKg: b.massKg,
        velocityMps: initial.velocityMps,
        angularVelocityRadps: initial.angularVelocityRadps,
        ...inertia2?.kind === "sphere-isotropic" ? { inertiaKgM2: inertia2.kgM2 } : {}
      } : {}
    }, large);
  });
  if (!bodies.some((b) => b.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (large && bodies.some((b) => b.ccd)) error("INVALID_CONFIG", "large profile excludes CCD");
  const numericJoints = jointInputs.map((value) => {
    const raw = value;
    const j = exact(value, raw?.kind === "hinge" ? ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"] : ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM"], "joint");
    id(j.id);
    if (j.kind !== "fixed" && j.kind !== "hinge") error("INVALID_CONFIG", "unsupported joint kind");
    if (j.kind === "hinge" && j.motor !== null) exact(j.motor, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
    return {
      id: j.id,
      kind: j.kind,
      aId: j.bodyAId,
      bId: j.bodyBId,
      anchorALocalM: j.anchorALocalM,
      anchorBLocalM: j.anchorBLocalM,
      ...j.kind === "hinge" ? { axisWorld: j.axisWorld, limitRad: j.limitRad, ...j.motor === null ? {} : { motor: j.motor } } : {}
    };
  });
  const joints = parseJoints(numericJoints, bodies);
  const numericalIds = new Set(ids2);
  for (const value of bindings) {
    const s = exact(value, ["id", "sourceRevision", "sourceDigest", "modelId", "occurrenceId", "entityIds", "approximation"], "sourceBinding");
    id(s.id);
    for (const key of ["sourceRevision", "modelId", "occurrenceId"]) text(s[key], key);
    if (typeof s.sourceDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(s.sourceDigest)) error("INVALID_CONFIG", "invalid source digest");
    const refs = list(s.entityIds, 128, "entityIds");
    if (refs.length === 0 || new Set(refs).size !== refs.length || refs.some((ref) => typeof ref !== "string" || !numericalIds.has(ref))) error("INVALID_CONFIG", "invalid source binding references");
    const a = exact(s.approximation, ["kind", "lossLabel"], "approximation");
    if (a.kind !== "control-net-box" && a.kind !== "control-net-sphere") error("INVALID_CONFIG", "unsupported approximation");
    text(a.lossLabel, "lossLabel");
  }
  return { model: model2, options: options2, bodies, joints };
}

// packages/barocss-physics/src/recording-owner.ts
var recordingWorlds = /* @__PURE__ */ new WeakMap();

// packages/barocss-physics/src/provider-manifest.generated.ts
var providerManifest = {
  "format": "barocss-physics-provider",
  "version": 1,
  "graph": "source",
  "entries": [
    "index.ts",
    "replay.ts"
  ],
  "files": {
    "broadphase.ts": "d93e38d78cc3d202481ceeba83631d528032426d03a8adafb2e461fc72a042a0",
    "capsule-contact.ts": "cc29d60423bd9a1883585cf164cca0b0736b9fc72e7feb3575c5208c7d892929",
    "capsule-query-error.ts": "fc49c7e09495dee70e9f5cea4782b29e1350f72a470a3059f1df3533768e565f",
    "capsule-query.ts": "ff66d04550032e0328793f52516edf1ad47fc427f954b031b5836defa14367d1",
    "capsule-query/admission.ts": "9b67efc7a8824ce49361485eff925afa50017e05bc23d900db5ec7c4e2c8760d",
    "capsule-query/geometry.ts": "5fdbe1eb40f46e930161e98244a9e5ec0e00c29297caf6f91d530c98df3df4a7",
    "capsule-query/profile.ts": "e74faf4a8d0d0e14765e97270619acebb4c2bff531d57bc42a0e3abf65d647ff",
    "capsule-query/snapshot.ts": "6a0994b1b55c962fe7ffc4e5fb55fd90404e1051568b16edf3adda8dc9adb7bd",
    "capsule-query/sweep.ts": "a8f4d16879b2ff88086ceec54cef19d04d58fb063893e7a146382cad59cbaf77",
    "capsule-query/types.ts": "c22d17887cd8ab889a443c828200310a4c560fd3b4f8ed49f3f1f60e5dd46f44",
    "ccd-box.ts": "43667cba73a01782cac3b9fe14828b67885229a6e09bc9f0e68b6a2d27057b43",
    "ccd-pair.ts": "570b434c19e432ccc3632bafa2c174df6dac9968e6c38b0f7d4416f75090231f",
    "ccd-slab.ts": "f2bad0028aa148ec00073d02a865273389f5a032ea9fc8a3c5b244af20b7e340",
    "ccd.ts": "040de88f74673b297164227ff5faada12f0eb190aa14a9471dbeb02f879a57ab",
    "character-controller.ts": "3895d5bcd44b99d7f036f0a8a9d95e4ced268c837a6aa293c5e09dfa791d3927",
    "character/admission.ts": "d83cdb8231620a18935d4d4d5e19ab7ec5440b043e1df71d49d5fa42f3fecb26",
    "character/core.ts": "6c6251e9782baed07be65cce68bfdbca14e2f930ca04a54ee6812cbbfc925a02",
    "character/ground.ts": "bd1621641ebc9300943b88c9083710218768454acb0a5e1ba8b330086d68c321",
    "character/math.ts": "df0e88c320d8a189004991cd5cfc3f8de3d7bb3eecb305bb01830a11191dcdc5",
    "character/profile.ts": "e6c57ae9bbb7f28221cf2ced05b7c17af5f575f2c6a60fa106ba5a98bb3c7c82",
    "character/query.ts": "9ef96eeb1529dc42466445529b100affc2f56913081f0c2fc169079cffe1a8cf",
    "character/slide.ts": "587d5512212e68fdc26068646152d2f8c52c3c6119d6c222de91b750c01fcd77",
    "character/state.ts": "6eb744c82f24604a8ecadd6e9d86406600119a3fbc7918129f93983df7cbf47e",
    "character/step-assist.ts": "9166857ad8509049a56d5b255ed59de17ee03e159581b495de7f1d985780c390",
    "character/types.ts": "866c5974fd99ec08b5dc6b5edf165241f4d02a8ed87274faf4cf35b19a3fb938",
    "collision.ts": "baa1492ee990bb156d4ba10deb45e0ddc31d31ab6555318c5f652043aa1ea501",
    "contact-manifold.ts": "bd5ded2eb5b22422eb020f44129ef1f5687fc84831b123d9a6dadbf7f0d69428",
    "dynamic-anchor-pair.ts": "8ff622a6ce007e5e7fcb43f0b7c08521615ddacbc8195cde1ac4f574304b579d",
    "dynamic-fixed-joint.ts": "f5a0fa82c062c7406f6edfeb2aeb169c927ddd8d0965957f630f87e118c52dfa",
    "dynamic-hinge-joint.ts": "69c816393446b6e06d66849840ecf88a7d28baf72bd30c792180616f55e455f2",
    "identity.ts": "ebabb654375eb0c213dca4db06769011248ed58f844b9c3f9038dfb676caf4be",
    "index.ts": "dc4085b1a0b4e2af15198e35c43125d907c4b0991fc1c57a24ee421bb7011d30",
    "internal-types.ts": "29f39921c4a9806e2ade9126a5748b1a17cafb40a8ade1d67fc303cafe2916a8",
    "joint-motor.ts": "9a50b0d006ca2386cd2d79b8ba162f6850a5d08d3eb1c7d03460d606559b56ea",
    "joints.ts": "b6d0ec667a96fc26ec43d9d812c5ffd0a3b7446d135bd9b18713059327c59181",
    "limits.ts": "748bad886bb7acf5fedc21b8251243b018858b7e5de2478c99fb86a9276c54c3",
    "math.ts": "d782fc9eab8f699e906cde0df580c625f054905f12999edf50fd60bf54e7a3c2",
    "model-admission.ts": "75ed6d033f6c76b90bb753458ea3464ad9126dd9ba7af82ca1fbe4f01bf8fdd9",
    "persistent-box-contact.ts": "2c117202db9bcb0b988b59f9add9cae57e09d175927122a313e7166720a63d9b",
    "recording-owner.ts": "ee19707328e6cd01493e7103c40eb5be7dcf31406eb3e72d1191eface8b94638",
    "replay-compare.ts": "918c89b8d8e84cdab25a951a44f8aa9368a904aa6a13804dafbef8ca81b421ec",
    "replay-json.ts": "f8527c8bfd845db706d6f1f2ee316cc5be0a717ba15f9b9957ac238571abfa66",
    "replay-validation.ts": "5fdbc90c06b8bd0e6fcc704447514400ea0d96c965f29d9ffa0b63063578f13c",
    "replay.ts": "58993f7a5dd3c5ae0e9de0a05ae4ae817177e19ebf4081de622cd27ef6787c32",
    "scene-profile.ts": "e927339931ce9ebbf2f13808017bd1106e4ed4dbfa4f63fdf2f2ed0376d94ff7",
    "sleep.ts": "f02ac9d68560fc8ce8f529c68a6d8657155e3f6b36beb4907534871e375569f2",
    "types.ts": "c7239aee629e9e331949c67bf49e43315cae50df1a8f90730b7d634b185ca182",
    "validation.ts": "651d12754b77f86493f399baf3c02d60d9ad1fe54e0ece664a05a4430e8a0f01",
    "world.ts": "59987cfa0ee5b23d5c146fedd91cc3eeb62fa5c695bc5c1a447b234868a00e9f"
  }
};

// packages/barocss-physics/src/joint-motor.ts
function driveHingeMotor(joint, body2, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0) return 0;
  const inverseAxisInertia = dot(axis, inverseInertia(body2, axis));
  const speed = dot(body2.angularVelocityRadps, axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseAxisInertia;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  body2.angularVelocityRadps = add(
    body2.angularVelocityRadps,
    inverseInertia(body2, scale(axis, impulse))
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
    normal: rotate2(box.orientation, scale(delta, 1 / distance)),
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
    normal: rotate2(box.orientation, normalLocal),
    penetration: radius + bestGap,
    pointM: worldPoint(box, boxPoint)
  };
}

// packages/barocss-physics/src/collision.ts
function capsuleCenter(body2, point) {
  const half = body2.shape.halfLengthM;
  const local = localPoint(body2, point);
  return worldPoint(body2, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body2) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body2.orientation, axis));
}
function boxSupport(body2, direction) {
  const axes = boxAxes(body2);
  const extents = body2.shape.halfExtentsM;
  return add(body2.positionM, axes.reduce((result, axis, index) => {
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
    normal: rotate2(box.orientation, scale(towardBox, 1 / distance)),
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
    normal: rotate2(box.orientation, localNormal),
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
function sphereOverlaps(center, radius, body2) {
  if (body2.shape.kind === "sphere") {
    return Math.hypot(...sub(center, body2.positionM)) <= radius + body2.shape.radiusM;
  }
  if (body2.shape.kind === "capsule") {
    return Math.hypot(...sub(center, capsuleCenter(body2, center))) <= radius + body2.shape.radiusM;
  }
  const extents = body2.shape.halfExtentsM;
  const local = localPoint(body2, center);
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
function rayDistance(origin, direction, body2) {
  if (body2.shape.kind === "sphere") return raySphere(origin, direction, body2.positionM, body2.shape.radiusM);
  const localOrigin = localPoint(body2, origin);
  const localDirection = rotate2(inverse(body2.orientation), direction);
  if (body2.shape.kind === "capsule") {
    const { radiusM: radius, halfLengthM: half } = body2.shape;
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
    const lower = -body2.shape.halfExtentsM[index];
    const upper = body2.shape.halfExtentsM[index];
    const component = localDirection[index];
    if (Math.abs(component) < 1e-12) {
      if (localOrigin[index] < lower || localOrigin[index] > upper) return null;
      continue;
    }
    const first2 = (lower - localOrigin[index]) / component;
    const second = (upper - localOrigin[index]) / component;
    near2 = Math.max(near2, Math.min(first2, second));
    far = Math.min(far, Math.max(first2, second));
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
function validateResult(bodies, contacts2) {
  for (const body2 of bodies) {
    for (const [label, values, bound] of [
      ["position", body2.positionM, 1e4],
      ["velocity", body2.velocityMps, 1e3],
      ["angularVelocity", body2.angularVelocityRadps, 1e3]
    ]) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound)) error("NUMERIC_LIMIT", `${body2.id} ${label} exceeded bounds`);
    }
    if (body2.orientation.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body2.orientation) - 1) > 1e-12) error("NUMERIC_LIMIT", `${body2.id} orientation exceeded tolerance`);
  }
  if (contacts2.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) || contact.normalAtoB.some((value) => !Number.isFinite(value)) || contact.pointM.some((value) => !Number.isFinite(value)) || contact.tangentImpulseNs.some((value) => !Number.isFinite(value)))) error("NUMERIC_LIMIT", "unsafe contact result");
}

// packages/barocss-physics/src/contact-manifold.ts
var basis = (body2) => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body2.orientation, axis));
function referenceFace(body2, axes, normal) {
  for (let axis = 0; axis < 3; axis++) {
    const alignment = dot(axes[axis], normal);
    if (Math.abs(alignment) >= 1 - 1e-6) {
      return {
        body: body2,
        axes,
        extents: body2.shape.halfExtentsM,
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
    const a = dot(sub(current, centre), axis) - limit - 1e-9;
    const b = dot(sub(next, centre), axis) - limit - 1e-9;
    const insideA = a <= 0, insideB = b <= 0;
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
  const selected = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, point) => u * point.u + v * point.v > u * best.u + v * best.v ? point : best, candidates[0]));
  const unique = selected.filter((point, index) => selected.findIndex((other) => Math.hypot(...sub(point.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first2, second) => first2.u - second.u || first2.v - second.v);
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
    const first2 = (-halfExtents[axis] - start[axis]) / velocity;
    const second = (halfExtents[axis] - start[axis]) / velocity;
    const near2 = Math.min(first2, second);
    const far = Math.max(first2, second);
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
function axisAlignedBox(body2) {
  return body2.shape.kind === "box" && body2.orientation.slice(0, 3).every((component) => Math.abs(component) <= ANGULAR_TOLERANCE) && Math.abs(body2.orientation[3] - 1) <= ANGULAR_TOLERANCE && body2.angularVelocityRadps.every((component) => Math.abs(component) <= ANGULAR_TOLERANCE);
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
  const selected = bodies.filter((body2) => body2.ccd);
  if (selected.length === 0) return { kind: "none" };
  const sphereIndex = bodies.findIndex((body2) => body2.ccd);
  if (selected.length === 1 && bodies.length === 2 && jointCount === 0 && gravity.every((component) => component === 0) && bodies.every((body2) => body2.kind === "dynamic" && body2.shape.kind === "sphere" && !body2.sensor)) {
    return { kind: "sphere-pair", sphereIndex, otherIndex: 1 - sphereIndex };
  }
  if (selected.length === 1 && selected[0].shape.kind === "box" && bodies.length === 2 && jointCount === 0) {
    const fixtureIndex = 1 - sphereIndex;
    if (bodies[sphereIndex].kind === "dynamic" && bodies[fixtureIndex].kind === "static" && !bodies[fixtureIndex].sensor && axisAlignedBox(bodies[sphereIndex]) && axisAlignedBox(bodies[fixtureIndex])) {
      return { kind: "box-pair", boxIndex: sphereIndex, fixtureIndex };
    }
  }
  const fixtures = bodies.filter((body2) => body2.kind === "static" && !body2.sensor && body2.shape.kind === "box");
  if (selected.length !== 1 || bodies.length !== fixtures.length + 1 || bodies.filter((body2) => body2.kind === "dynamic").length !== 1 || fixtures.length < 1 || fixtures.length > 8 || jointCount !== 0) {
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
      normalFixtureToBody: rotate2(fixture.orientation, hit.normalLocal)
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
function bodyBounds(body2) {
  const shape2 = body2.shape;
  let half;
  if (shape2.kind === "sphere") {
    half = [shape2.radiusM, shape2.radiusM, shape2.radiusM];
  } else if (shape2.kind === "capsule") {
    const axis = rotate2(body2.orientation, [0, 1, 0]);
    half = axis.map((value) => shape2.radiusM + shape2.halfLengthM * Math.abs(value));
  } else {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body2.orientation, axis));
    half = [0, 1, 2].map((axis) => axes.reduce((extent, basis2, localAxis) => extent + Math.abs(basis2[axis]) * shape2.halfExtentsM[localAxis], 0));
  }
  const min = body2.positionM.map((value, axis) => value - half[axis]);
  const max = body2.positionM.map((value, axis) => value + half[axis]);
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
  const dynamics = [a, b].filter((body2) => body2.kind === "dynamic");
  return dynamics.length > 0 && dynamics.every((body2) => body2.sleeping === true) && [a, b].every((body2) => body2.kind !== "kinematic" || Math.hypot(...body2.velocityMps) === 0);
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
  const indexById = new Map(bodies.map((body2, index) => [body2.id, index]));
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
    const body2 = bodies[index];
    const action = actions.get(body2.id);
    if (body2.kind === "dynamic" && (nonzero(action?.forceN) || nonzero(action?.impulseNs) || nonzero(action?.torqueNm) || nonzero(action?.angularImpulseNms))) queue.push(index);
    if (body2.kind === "kinematic" && action?.positionM && action.positionM.some((value, axis) => value !== body2.positionM[axis])) {
      for (const contact of previousContacts) {
        const otherId = contact.aId === body2.id ? contact.bId : contact.bId === body2.id ? contact.aId : null;
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
function updateSleeping(bodies, contacts2, sleepFrames) {
  const indexById = new Map(bodies.map((body2, index) => [body2.id, index]));
  const neighbors = bodies.map(() => []);
  const supported = bodies.map(() => false);
  const movingFixture = bodies.map(() => false);
  for (const contact of contacts2) {
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
function publicState(bodies, contacts2, events, joints, ccdHits, pairStats, stepIndex, dt2, identity2, colliderIds) {
  return {
    identity: { ...identity2 },
    stepIndex,
    timeSeconds: stepIndex * dt2,
    bodies: bodies.map((body2) => ({
      id: body2.id,
      kind: body2.kind,
      positionM: [...body2.positionM],
      orientationXYZW: [...body2.orientation],
      velocityMps: [...body2.velocityMps],
      angularVelocityRadps: [...body2.angularVelocityRadps],
      sleeping: body2.sleeping ?? false
    })),
    contacts: contacts2.map((contact) => ({
      colliderAId: colliderIds.get(contact.aId),
      colliderBId: colliderIds.get(contact.bId),
      bodyAId: contact.aId,
      bodyBId: contact.bId,
      normalAtoB: [...contact.normalAtoB],
      pointM: [...contact.pointM],
      penetrationM: contact.penetrationM,
      normalImpulseNs: contact.impulseNs,
      tangentImpulseOnBNs: [...contact.tangentImpulseNs]
    })),
    events: events.map((event) => ({
      colliderAId: colliderIds.get(event.aId),
      colliderBId: colliderIds.get(event.bId),
      kind: event.kind,
      phase: event.phase
    })),
    joints: joints.map((joint) => ({
      id: joint.id,
      bodyAId: joint.aId,
      bodyBId: joint.bId,
      linearImpulseOnBNs: [...joint.linearImpulseNs],
      angularImpulseOnBNms: [...joint.angularImpulseNms],
      angleRad: joint.angleRad ?? null,
      motorImpulseNms: joint.motorImpulseNms ?? null
    })),
    ccdHits: ccdHits.map((hit) => ({
      bodyId: hit.bodyId,
      colliderId: colliderIds.get(hit.fixtureId),
      toiFraction: hit.toiFraction,
      normalFixtureToBody: [...hit.normalFixtureToBody]
    })),
    cloths: [],
    fluids: [],
    pairStats: { ...pairStats }
  };
}
function createPhysicsWorld(model2, options2) {
  const admitted = admitModel(model2, options2);
  const dt2 = admitted.options.fixedStepSeconds;
  const gravity = [...admitted.model.gravityMps2];
  const useAabb = admitted.options.broadPhase === "aabb";
  const usePersistentBox = admitted.options.profile === "rigid-persistent-box-v1";
  const largeMode = admitted.options.profile === "rigid-large-v1";
  let bodies = admitted.bodies;
  let joints = admitted.joints;
  let modelCopy2 = admitted.model;
  let optionsCopy = admitted.options;
  const colliderIds = new Map(admitted.model.colliders.map((collider2) => [collider2.bodyId, collider2.id]));
  const identity2 = {
    modelRevision: admitted.model.revision,
    modelDigest: digest(admitted.model),
    configurationDigest: digest(admitted.options),
    providerDigest: digest(providerManifest),
    profile: admitted.options.profile,
    frameId: admitted.model.frame.id,
    fixedStepSeconds: dt2
  };
  let dynamicHinge = joints.find((joint) => joint.kind === "hinge" && bodies[joint.aIndex].kind === "dynamic");
  if (dynamicHinge) admitDynamicHingeScene(dynamicHinge, bodies, gravity);
  let ccd = admitCcd(bodies, joints.length, gravity);
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
  let contacts2 = [];
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
  let owner = null;
  let advancingOwner = null;
  const ensureActive = () => {
    if (disposed) error("DISPOSED", "world is disposed");
  };
  const world2 = {
    getModel() {
      ensureActive();
      return copyData(modelCopy2);
    },
    getState() {
      ensureActive();
      return publicState(bodies, contacts2, events, jointStates, ccdHits, pairStats, stepIndex, dt2, identity2, colliderIds);
    },
    step(commands = []) {
      ensureActive();
      if (owner !== advancingOwner) error("WORLD_OWNED", "World has an exclusive recorder");
      if (stepIndex >= MAX_STEPS) error("WORLD_LIMIT", "world step limit reached");
      if (owner && (owner.recording.frames.length >= 512 || Array.isArray(commands) && owner.commandCount + commands.length > 4096)) {
        error("WORLD_LIMIT", "recording frame or command limit reached");
      }
      let admittedCommands;
      try {
        admittedCommands = copyData(commands);
      } catch (failure) {
        if (failure instanceof PhysicsError && failure.code === "INVALID_CONFIG") error("INVALID_COMMAND", failure.message);
        throw failure;
      }
      if (owner && Array.isArray(admittedCommands) && owner.commandCount + admittedCommands.length > 4096) {
        error("WORLD_LIMIT", "recording command limit reached");
      }
      const actions = parseCommands(admittedCommands, bodies);
      const recordedCommands = owner ? admittedCommands : null;
      if (dynamicHinge) admitDynamicHingeCommands(dynamicHinge, bodies, actions);
      if (ccd.kind === "box-pair") rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
      const next = bodies.map(copyBody);
      const motorImpulses = joints.map(() => 0);
      const nextSleepFrames = sleepFrames.slice();
      if (largeMode) wakeForActions(next, contacts2, actions, nextSleepFrames);
      for (const body2 of next) {
        if (body2.kind !== "dynamic" || largeMode && body2.sleeping) continue;
        const action = actions.get(body2.id);
        body2.angularVelocityRadps = add(
          body2.angularVelocityRadps,
          inverseInertia(body2, add(
            action?.angularImpulseNms ?? [0, 0, 0],
            scale(action?.torqueNm ?? [0, 0, 0], dt2)
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
        const body2 = next[bodyIndex];
        const action = actions.get(body2.id);
        if (body2.kind === "kinematic") {
          const target = action?.positionM ?? body2.positionM;
          const delta = target.map((value, index) => value - body2.positionM[index]);
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M || delta.some((value) => Math.abs(value / dt2) > 1e3)) {
            error("NUMERIC_LIMIT", `${body2.id} exceeded kinematic movement limit`);
          }
          body2.velocityMps = delta.map((value) => value / dt2);
          body2.positionM = [...target];
        } else if (body2.kind === "dynamic") {
          if (largeMode && body2.sleeping) continue;
          if (body2.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e3) || Math.hypot(...body2.angularVelocityRadps) * dt2 > 10) {
            error("NUMERIC_LIMIT", `${body2.id} exceeded angular movement limit`);
          }
          body2.orientation = advanceOrientation(body2.orientation, body2.angularVelocityRadps, dt2);
          for (let i = 0; i < 3; i++) {
            body2.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body2.inverseMass;
            body2.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body2.inverseMass) * dt2;
          }
          if (Math.hypot(...body2.velocityMps) * dt2 > MAX_STEP_DISPLACEMENT_M) {
            error("NUMERIC_LIMIT", `${body2.id} exceeded step displacement limit`);
          }
          for (let i = 0; i < 3; i++) body2.positionM[i] += body2.velocityMps[i] * dt2;
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
          const reaction = projectJoint(joints[index], next, bodies, dt2);
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
      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt2, identity2, colliderIds);
      const preparedRecording = owner ? owner.prepare(recordedCommands, state) : null;
      const preparedCommandCount = owner ? owner.commandCount + recordedCommands.length : 0;
      bodies = next;
      contacts2 = nextContacts;
      events = nextEvents;
      jointStates = nextJoints;
      ccdHits = nextCcdHits;
      pairStats = nextPairStats;
      activePairs = nextActive;
      persistentPoints = nextPersistentPoints;
      sleepFrames = nextSleepFrames;
      stepIndex++;
      if (owner) {
        owner.recording = preparedRecording;
        owner.commandCount = preparedCommandCount;
      }
      return state;
    },
    query(input) {
      ensureActive();
      const data = queryRecord(input, ["kind", "includeSensors"], ["centerM", "radiusM", "originM", "direction", "maxDistanceM"]);
      const sensors = includeSensors(data);
      if (data.kind === "overlap-sphere") {
        const query3 = queryRecord(data, ["kind", "centerM", "radiusM", "includeSensors"], []);
        const center = queryVector(query3.centerM, 1e4, "centerM");
        const radius = queryNumber(query3.radiusM, 1e-4, 1e3, "radiusM");
        return { kind: "overlap-sphere", colliderIds: bodies.filter((body2) => (sensors || !body2.sensor) && sphereOverlaps(center, radius, body2)).map((body2) => body2.id).sort().map((id) => colliderIds.get(id)) };
      }
      if (data.kind !== "raycast") error("INVALID_QUERY", "unsupported query kind");
      const query2 = queryRecord(data, ["kind", "originM", "direction", "maxDistanceM", "includeSensors"], []);
      const origin = queryVector(query2.originM, 1e4, "originM");
      const direction = queryVector(query2.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) error("INVALID_QUERY", "direction must be a unit 3-vector");
      const limit = queryNumber(query2.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
      let best = null;
      for (const body2 of bodies) {
        if (!sensors && body2.sensor) continue;
        const distance = rayDistance(origin, direction, body2);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM || distance === best.distanceM && body2.id < best.bodyId) best = { bodyId: body2.id, distanceM: distance };
      }
      return { kind: "raycast", hit: best === null ? null : { ...best, colliderId: colliderIds.get(best.bodyId) } };
    },
    dispose() {
      disposed = true;
      if (owner) {
        owner.recording = null;
        owner.commandCount = 0;
        owner = null;
      }
      optionsCopy = null;
      bodies = [];
      contacts2 = [];
      events = [];
      ccdHits = [];
      activePairs.clear();
      persistentPoints.clear();
      sleepFrames = [];
      jointStates = [];
      joints = [];
      dynamicHinge = void 0;
      ccd = { kind: "none" };
      pairs.length = 0;
      colliderIds.clear();
      modelCopy2 = null;
    }
  };
  let running = false;
  function guarded(operation, action) {
    if (disposed) throw new PhysicsError("DISPOSED", "world is disposed", {
      operation,
      phase: "lifecycle",
      domain: "world",
      entityIds: [],
      accepted: { stepIndex, timeSeconds: stepIndex * dt2 }
    });
    if (running) throw new PhysicsError("REENTRANT_CALL", "World call is reentrant", {
      operation,
      phase: "lifecycle",
      domain: "world",
      entityIds: [],
      accepted: { stepIndex, timeSeconds: stepIndex * dt2 }
    });
    running = true;
    try {
      return action();
    } catch (failure) {
      if (!(failure instanceof PhysicsError)) throw failure;
      const enriched = new PhysicsError(failure.code, failure.message, {
        operation,
        phase: ["DISPOSED", "WORLD_OWNED", "REENTRANT_CALL"].includes(failure.code) ? "lifecycle" : failure.code === "WORLD_LIMIT" ? "budget" : failure.code === "NUMERIC_LIMIT" ? "validation" : "admission",
        domain: "rigid",
        entityIds: failure.details.entityIds,
        accepted: { stepIndex, timeSeconds: stepIndex * dt2 }
      });
      enriched.stack = failure.stack;
      throw enriched;
    } finally {
      running = false;
    }
  }
  const getModel = world2.getModel;
  const getState = world2.getState;
  const step = world2.step;
  const query = world2.query;
  const dispose = world2.dispose;
  world2.getModel = () => guarded("read", getModel);
  world2.getState = () => guarded("read", getState);
  world2.step = (commands) => guarded("step", () => step(commands));
  world2.query = (input) => guarded("query", () => query(input));
  world2.dispose = () => {
    if (!disposed) guarded("read", dispose);
  };
  recordingWorlds.set(world2, {
    attach: (prepare) => guarded("record", () => {
      if (owner) error("WORLD_OWNED", "World has an exclusive recorder");
      if (stepIndex !== 0) error("INVALID_SNAPSHOT", "recording must attach at step zero");
      const prepared = prepare({ model: copyData(modelCopy2), options: copyData(optionsCopy), state: getState() });
      owner = prepared;
      return prepared;
    }),
    detach: (current) => {
      if (!disposed) guarded("record", () => {
        if (owner === current) owner = null;
        current.recording = null;
        current.commandCount = 0;
      });
    },
    read: (current) => guarded("record", () => {
      if (owner !== current) error("DISPOSED", "recorder is detached");
      return getState();
    }),
    step: (current, commands) => guarded("record", () => {
      if (owner !== current) error("DISPOSED", "recorder is detached");
      advancingOwner = current;
      try {
        return step(commands);
      } finally {
        advancingOwner = null;
      }
    })
  });
  return world2;
}

// packages/barocss-physics/src/character/profile.ts
var DT = 1 / 120;
var WALKABLE = Math.cos(10 * Math.PI / 180);

// packages/barocss-physics/src/replay-json.ts
function replayError(code, message) {
  throw new PhysicsError(code, message);
}
function copyValue(input, label, depth, budget) {
  if (++budget.nodes > 5e4 || depth > 32) replayError("INVALID_SNAPSHOT", `${label} exceeds JSON depth or size`);
  budget.bytes += input === null || typeof input === "boolean" ? 1 : typeof input === "number" ? 9 : 5;
  if (budget.bytes + 8 > MAX_RECORDING_BYTES) replayError("INVALID_SNAPSHOT", `${label} exceeds byte limit`);
  if (input === null || typeof input === "boolean") return input;
  if (typeof input === "string") {
    for (const character of input) {
      const point = character.codePointAt(0);
      budget.bytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
      if (point >= 55296 && point <= 57343) replayError("INVALID_SNAPSHOT", `${label} contains malformed Unicode`);
    }
    if (budget.bytes + 8 > MAX_RECORDING_BYTES) replayError("INVALID_SNAPSHOT", `${label} string exceeds byte limit`);
    return input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) replayError("INVALID_SNAPSHOT", `${label} contains a nonfinite number`);
    return input;
  }
  if (typeof input !== "object" || Object.getPrototypeOf(input) !== (Array.isArray(input) ? Array.prototype : Object.prototype)) {
    replayError("INVALID_SNAPSHOT", `${label} must be plain JSON-compatible data`);
  }
  if (budget.seen.has(input)) replayError("INVALID_SNAPSHOT", `${label} has a cycle`);
  budget.seen.add(input);
  let output;
  if (Array.isArray(input)) {
    if (input.length > 4096 || Reflect.ownKeys(input).length !== input.length + 1) {
      replayError("INVALID_SNAPSHOT", `${label} must be a bounded dense array`);
    }
    const copied = [];
    for (let index = 0; index < input.length; index++) {
      const field = Object.getOwnPropertyDescriptor(input, String(index));
      if (!field?.enumerable || !("value" in field)) replayError("INVALID_SNAPSHOT", `${label}[${index}] must be data`);
      copied.push(copyValue(field.value, `${label}[${index}]`, depth + 1, budget));
    }
    output = copied;
  } else {
    const keys = Reflect.ownKeys(input);
    if (keys.length > 64 || keys.some((key) => typeof key !== "string" || !/^[\x20-\x7e]+$/.test(key))) {
      replayError("INVALID_SNAPSHOT", `${label} has unsupported fields`);
    }
    budget.nodes += keys.length;
    budget.bytes += keys.reduce((total, key) => total + 5 + key.length, 0);
    if (budget.nodes > 5e4 || budget.bytes + 8 > MAX_RECORDING_BYTES) replayError("INVALID_SNAPSHOT", `${label} exceeds size limit`);
    const copied = {};
    for (const key of keys) {
      const field = Object.getOwnPropertyDescriptor(input, key);
      if (!field?.enumerable || !("value" in field)) replayError("INVALID_SNAPSHOT", `${label}.${key} must be data`);
      Object.defineProperty(copied, key, { value: copyValue(field.value, `${label}.${key}`, depth + 1, budget), enumerable: true, writable: true, configurable: true });
    }
    output = copied;
  }
  budget.seen.delete(input);
  return output;
}
function copyReplayJson(input, label) {
  return copyValue(input, label, 0, { nodes: 0, bytes: 0, seen: /* @__PURE__ */ new Set() });
}
function exactFields(value, fields2, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).length !== fields2.length || Reflect.ownKeys(value).some((key) => typeof key !== "string" || !fields2.includes(key))) {
    replayError("INVALID_SNAPSHOT", `${label} has missing or unsupported fields`);
  }
}
function equivalentReplayIdentity(left, right) {
  const a = canonicalEncode(left), b = canonicalEncode(right);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
var RECORDING_MAGIC = Uint8Array.of(66, 67, 80, 72, 82, 69, 67, 49);
var MAX_RECORDING_BYTES = 1024 * 1024;
function encodeRecordingData(input) {
  const data = canonicalEncode(copyReplayJson(input, "recording"));
  if (data.length + RECORDING_MAGIC.length > MAX_RECORDING_BYTES) replayError("INVALID_SNAPSHOT", "recording exceeds byte limit");
  const bytes = new Uint8Array(data.length + RECORDING_MAGIC.length);
  bytes.set(RECORDING_MAGIC);
  bytes.set(data, RECORDING_MAGIC.length);
  return bytes;
}
function decodeRecordingData(input) {
  if (!(input instanceof Uint8Array) || input.length > MAX_RECORDING_BYTES || input.length <= RECORDING_MAGIC.length || !RECORDING_MAGIC.every((byte, index) => input[index] === byte)) {
    replayError("INVALID_SNAPSHOT", "unsupported recording wire format or byte limit");
  }
  const bytes = Uint8Array.from(input);
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let offset = RECORDING_MAGIC.length, nodes = 0;
  function take(length) {
    if (length > bytes.length - offset) replayError("INVALID_SNAPSHOT", "truncated recording");
    const start = offset;
    offset += length;
    return start;
  }
  function uint32() {
    return view.getUint32(take(4), true);
  }
  function read(depth) {
    if (++nodes > 5e4 || depth > 32) replayError("INVALID_SNAPSHOT", "recording exceeds node or depth limit");
    const tag = bytes[take(1)];
    if (tag === 0) return null;
    if (tag === 1 || tag === 2) return tag === 2;
    if (tag === 3) {
      const length = uint32(), start = take(length);
      return decoder.decode(bytes.subarray(start, start + length));
    }
    if (tag === 4) {
      const value = view.getFloat64(take(8), true);
      if (!Number.isFinite(value)) replayError("INVALID_SNAPSHOT", "recording contains nonfinite number");
      return value;
    }
    if (tag === 5) {
      const length = uint32();
      if (length > 4096) replayError("INVALID_SNAPSHOT", "recording array exceeds limit");
      return Array.from({ length }, () => read(depth + 1));
    }
    if (tag === 6) {
      const length = uint32();
      if (length > 64) replayError("INVALID_SNAPSHOT", "recording record exceeds limit");
      const result = {};
      let previous;
      for (let i = 0; i < length; i++) {
        const key = read(depth + 1);
        if (typeof key !== "string" || !/^[\x20-\x7e]+$/.test(key) || previous !== void 0 && key <= previous) {
          replayError("INVALID_SNAPSHOT", "recording record keys must be unique canonical ASCII");
        }
        Object.defineProperty(result, key, { value: read(depth + 1), enumerable: true, writable: true, configurable: true });
        previous = key;
      }
      return result;
    }
    replayError("INVALID_SNAPSHOT", "unknown recording data tag");
  }
  try {
    const result = read(0);
    if (offset !== bytes.length) replayError("INVALID_SNAPSHOT", "recording has trailing bytes");
    return result;
  } catch (error2) {
    if (error2 instanceof PhysicsError) throw error2;
    replayError("INVALID_SNAPSHOT", "invalid recording encoding");
  }
}

// packages/barocss-physics/src/replay-compare.ts
function equivalentReplayValue(left, right) {
  if (typeof left === "number" || typeof right === "number") {
    return typeof left === "number" && typeof right === "number" && Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return left === right;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equivalentReplayValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equivalentReplayValue(
    left[key],
    right[key]
  ));
}

// packages/barocss-physics/src/replay-validation.ts
function record2(value, keys, label) {
  exactFields(value, keys, label);
  return value;
}
function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) replayError("INVALID_SNAPSHOT", "state number is invalid");
}
function vector2(value, length = 3) {
  if (!Array.isArray(value) || value.length !== length) replayError("INVALID_SNAPSHOT", "state vector is invalid");
  value.forEach(number);
}
function ids(values, expected2, fields2, validate) {
  if (!Array.isArray(values) || values.length !== expected2.length) replayError("INVALID_SNAPSHOT", "state entity list differs from model");
  values.forEach((value, index) => {
    const data = record2(value, fields2, "state entity");
    if (data.id !== expected2[index]) replayError("INVALID_SNAPSHOT", "state entity ID differs from model");
    validate(data);
  });
}
function identity(value) {
  const data = record2(value, ["modelRevision", "modelDigest", "configurationDigest", "providerDigest", "profile", "frameId", "fixedStepSeconds"], "identity");
  for (const name of ["modelDigest", "configurationDigest", "providerDigest"]) {
    if (typeof data[name] !== "string" || !/^sha256:[a-f0-9]{64}$/.test(data[name])) replayError("INVALID_SNAPSHOT", "identity digest is invalid");
  }
  if (typeof data.modelRevision !== "string" || typeof data.frameId !== "string" || typeof data.profile !== "string") replayError("INVALID_SNAPSHOT", "identity fields are invalid");
  number(data.fixedStepSeconds);
}
function admitRecording(input) {
  const copied = copyReplayJson(input, "recording");
  const data = record2(copied, ["format", "version", "model", "options", "identity", "frames", "finalState"], "recording");
  if (data.format !== "barocss-physics-recording" || data.version !== 1) replayError("INVALID_SNAPSHOT", "unsupported recording");
  encodeRecordingData(copied);
  if (canonicalEncode(data.model).length > 128 * 1024) replayError("INVALID_SNAPSHOT", "recording model exceeds byte limit");
  let admitted;
  try {
    admitted = admitModel(data.model, data.options);
  } catch {
    replayError("INVALID_SNAPSHOT", "recording model or options are invalid");
  }
  const model2 = admitted.model, options2 = admitted.options;
  identity(data.identity);
  if (!Array.isArray(data.frames) || data.frames.length > 512) replayError("INVALID_SNAPSHOT", "recording frame limit exceeded");
  let commandCount = 0;
  for (const [index, frame] of data.frames.entries()) {
    const f = record2(frame, ["stepIndex", "commands"], "frame");
    if (f.stepIndex !== index + 1 || !Array.isArray(f.commands) || f.commands.length > 64) replayError("INVALID_SNAPSHOT", "frame cursor or commands are invalid");
    commandCount += f.commands.length;
    try {
      parseCommands(f.commands, admitted.bodies);
    } catch {
      replayError("INVALID_SNAPSHOT", "frame commands are invalid");
    }
  }
  if (commandCount > 4096) replayError("INVALID_SNAPSHOT", "recording command limit exceeded");
  const state = record2(data.finalState, ["identity", "stepIndex", "timeSeconds", "bodies", "joints", "contacts", "events", "ccdHits", "cloths", "fluids", "pairStats"], "final state");
  identity(state.identity);
  if (state.stepIndex !== data.frames.length || state.timeSeconds !== data.frames.length * options2.fixedStepSeconds) replayError("INVALID_SNAPSHOT", "final cursor differs from log");
  if (!equivalentReplayIdentity(data.identity, state.identity)) replayError("INVALID_SNAPSHOT", "final identity differs from recording");
  const ident = data.identity;
  if (ident.modelRevision !== model2.revision || ident.modelDigest !== digest(model2) || ident.configurationDigest !== digest(options2) || ident.profile !== options2.profile || ident.frameId !== model2.frame.id || !Object.is(ident.fixedStepSeconds, options2.fixedStepSeconds)) replayError("INVALID_SNAPSHOT", "recording identity differs from inputs");
  ids(state.bodies, model2.bodies.map((b) => b.id), ["id", "kind", "positionM", "orientationXYZW", "velocityMps", "angularVelocityRadps", "sleeping"], (b) => {
    const source = model2.bodies.find((item) => item.id === b.id);
    if (b.kind !== source.kind || typeof b.sleeping !== "boolean") replayError("INVALID_SNAPSHOT", "body state kind or sleep flag is invalid");
    vector2(b.positionM);
    vector2(b.orientationXYZW, 4);
    vector2(b.velocityMps);
    vector2(b.angularVelocityRadps);
  });
  const bodyIds = new Set(model2.bodies.map((b) => b.id)), colliders = new Map(model2.colliders.map((c) => [c.id, c.bodyId]));
  const body2 = (value) => {
    if (typeof value !== "string" || !bodyIds.has(value)) replayError("INVALID_SNAPSHOT", "unknown body ID");
  };
  const collider2 = (value) => {
    if (typeof value !== "string" || !colliders.has(value)) replayError("INVALID_SNAPSHOT", "unknown collider ID");
  };
  ids(state.joints, model2.joints.map((j) => j.id), ["id", "bodyAId", "bodyBId", "linearImpulseOnBNs", "angularImpulseOnBNms", "angleRad", "motorImpulseNms"], (j) => {
    const source = model2.joints.find((item) => item.id === j.id);
    if (j.bodyAId !== source.bodyAId || j.bodyBId !== source.bodyBId) replayError("INVALID_SNAPSHOT", "joint owners differ");
    vector2(j.linearImpulseOnBNs);
    vector2(j.angularImpulseOnBNms);
    if (source.kind === "fixed" ? j.angleRad !== null : typeof j.angleRad !== "number") replayError("INVALID_SNAPSHOT", "joint angle is invalid");
    if (source.kind === "hinge" && source.motor ? typeof j.motorImpulseNms !== "number" : j.motorImpulseNms !== null) replayError("INVALID_SNAPSHOT", "joint motor state is invalid");
  });
  function entries(value, keys, check) {
    if (!Array.isArray(value)) replayError("INVALID_SNAPSHOT", "state list is invalid");
    value.forEach((item) => check(record2(item, keys, "state observation")));
  }
  entries(state.contacts, ["colliderAId", "colliderBId", "bodyAId", "bodyBId", "normalAtoB", "pointM", "penetrationM", "normalImpulseNs", "tangentImpulseOnBNs"], (c) => {
    body2(c.bodyAId);
    body2(c.bodyBId);
    collider2(c.colliderAId);
    collider2(c.colliderBId);
    if (colliders.get(c.colliderAId) !== c.bodyAId || colliders.get(c.colliderBId) !== c.bodyBId) replayError("INVALID_SNAPSHOT", "contact owner differs");
    vector2(c.normalAtoB);
    vector2(c.pointM);
    vector2(c.tangentImpulseOnBNs);
    number(c.penetrationM);
    number(c.normalImpulseNs);
  });
  entries(state.events, ["colliderAId", "colliderBId", "kind", "phase"], (e) => {
    collider2(e.colliderAId);
    collider2(e.colliderBId);
    if (!["contact", "sensor"].includes(e.kind) || !["begin", "stay", "end"].includes(e.phase)) replayError("INVALID_SNAPSHOT", "event is invalid");
  });
  entries(state.ccdHits, ["bodyId", "colliderId", "toiFraction", "normalFixtureToBody"], (h) => {
    body2(h.bodyId);
    collider2(h.colliderId);
    number(h.toiFraction);
    vector2(h.normalFixtureToBody);
  });
  if (!Array.isArray(state.cloths) || state.cloths.length || !Array.isArray(state.fluids) || state.fluids.length) replayError("INVALID_SNAPSHOT", "domain recording is unsupported");
  const stats = record2(state.pairStats, ["eligiblePairs", "candidatePairs", "aabbTests"], "pair stats");
  for (const value of Object.values(stats)) if (!Number.isSafeInteger(value) || value < 0) replayError("INVALID_SNAPSHOT", "pair stats are invalid");
  return copied;
}

// packages/barocss-physics/src/replay.ts
function recordedState(state) {
  if (state.cloths.length || state.fluids.length) replayError("INVALID_SNAPSHOT", "domain recording is unsupported");
  return copyReplayJson({ ...state, cloths: [], fluids: [] }, "state");
}
function attachRecorder(world2) {
  const access = recordingWorlds.get(world2);
  if (!access) replayError("INVALID_SNAPSHOT", "recorder requires a genuine World");
  const owner = access.attach(({ model: model2, options: options2, state }) => {
    if (canonicalEncode(model2).length > 128 * 1024) replayError("WORLD_LIMIT", "recording model exceeds byte limit");
    const initial = {
      format: "barocss-physics-recording",
      version: 1,
      model: model2,
      options: options2,
      identity: state.identity,
      frames: [],
      finalState: recordedState(state)
    };
    encodeRecordingData(initial);
    const preparedOwner = {
      recording: initial,
      commandCount: 0,
      prepare(commands, next) {
        const recording2 = {
          ...preparedOwner.recording,
          frames: [...preparedOwner.recording.frames, { stepIndex: next.stepIndex, commands: copyReplayJson(commands, "commands") }],
          finalState: recordedState(next)
        };
        try {
          encodeRecordingData(recording2);
        } catch (error2) {
          if (error2 instanceof PhysicsError && error2.code === "INVALID_SNAPSHOT") replayError("WORLD_LIMIT", "recording data exceeds resource bounds");
          throw error2;
        }
        return recording2;
      }
    };
    return preparedOwner;
  });
  let detached = false;
  return {
    getState: () => access.read(owner),
    step: (commands = []) => access.step(owner, commands),
    saveRecording() {
      access.read(owner);
      return copyReplayJson(owner.recording, "recording");
    },
    dispose() {
      if (!detached) {
        access.detach(owner);
        detached = true;
      }
    }
  };
}
function restoreRecording(input, expectedInput) {
  const recording2 = admitRecording(input);
  const expected2 = copyReplayJson(expectedInput, "expected identity");
  exactFields(expected2, ["model", "options", "providerDigest"], "expected identity");
  if (!equivalentReplayIdentity(recording2.model, expected2.model) || !equivalentReplayIdentity(recording2.options, expected2.options) || recording2.identity.providerDigest !== expected2.providerDigest) replayError("STALE_SNAPSHOT", "recording identity differs from expected inputs");
  let world2;
  try {
    world2 = createPhysicsWorld(recording2.model, recording2.options);
    if (!equivalentReplayIdentity(world2.getState().identity, recording2.identity)) replayError("STALE_SNAPSHOT", "recording provider differs from current provider");
    const recorder = createPhysicsRecorder(world2);
    for (const frame of recording2.frames) recorder.step(frame.commands);
    if (!equivalentReplayValue(recorder.getState(), recording2.finalState)) replayError("INVALID_SNAPSHOT", "final state differs from reconstructed state");
    return { world: world2, recorder };
  } catch (error2) {
    world2?.dispose();
    if (error2 instanceof PhysicsError && error2.code === "STALE_SNAPSHOT") throw error2;
    replayError("INVALID_SNAPSHOT", "recording reconstruction failed");
  }
}
function serializeRecording(input) {
  const recording2 = admitRecording(input);
  const candidate = restorePhysicsRecording(recording2, { model: recording2.model, options: recording2.options, providerDigest: recording2.identity.providerDigest });
  try {
    return encodeRecordingData(recording2);
  } finally {
    candidate.world.dispose();
  }
}
function deserializeRecording(bytes) {
  const recording2 = admitRecording(decodeRecordingData(bytes));
  const candidate = restorePhysicsRecording(recording2, { model: recording2.model, options: recording2.options, providerDigest: recording2.identity.providerDigest });
  try {
    return copyReplayJson(recording2, "recording");
  } finally {
    candidate.world.dispose();
  }
}
function recordingOperation(operation, action) {
  try {
    return action();
  } catch (failure) {
    if (!(failure instanceof PhysicsError)) throw failure;
    const error2 = new PhysicsError(failure.code, failure.message, {
      operation,
      domain: "recording",
      entityIds: failure.details.entityIds,
      accepted: operation === "record" ? failure.details.accepted : null,
      phase: failure.code === "STALE_SNAPSHOT" ? "identity" : failure.code === "WORLD_LIMIT" ? "budget" : ["DISPOSED", "WORLD_OWNED", "REENTRANT_CALL"].includes(failure.code) ? "lifecycle" : "validation"
    });
    error2.stack = failure.stack;
    throw error2;
  }
}
function createPhysicsRecorder(world2) {
  return recordingOperation("record", () => attachRecorder(world2));
}
function restorePhysicsRecording(recording2, expected2) {
  return recordingOperation("restore", () => restoreRecording(recording2, expected2));
}
function serializePhysicsRecording(recording2) {
  return recordingOperation("record", () => serializeRecording(recording2));
}
function deserializePhysicsRecording(bytes) {
  return recordingOperation("record", () => deserializeRecording(bytes));
}

// examples/physics-scene/replay-probe.mjs
var dt = 1 / 120;
var body = (id, kind, positionM) => kind === "dynamic" ? {
  id,
  kind,
  initial: {
    positionM,
    orientationXYZW: [0, 0, 0, 1],
    velocityMps: [0, 0, 0],
    angularVelocityRadps: [0, 0, 0]
  },
  massKg: 1,
  inertia: { kind: "primitive-com", about: "com", frame: "body-local" }
} : { id, kind, initial: { positionM, orientationXYZW: [0, 0, 0, 1] } };
var collider = (bodyId, geometry) => ({
  id: `${bodyId}:collider`,
  bodyId,
  geometry,
  local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
  material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
  sensor: false,
  ccd: false,
  filter: { categoryBits: 1, maskBits: 65535 }
});
var options = { profile: "rigid-discrete-v1", fixedStepSeconds: dt, broadPhase: "direct" };
var model = {
  format: "barocss-physics-model",
  version: 1,
  revision: "replayModel1",
  frame: { id: "world", basis: "right-handed-xyz", rotation: "local-to-world-xyzw" },
  units: { length: "m", mass: "kg", time: "s", angle: "rad" },
  gravityMps2: [0, -9.81, 0],
  bodies: [body("part:ball", "dynamic", [0, 1.2, 0]), body("fixture:floor", "static", [0, 0, 0])],
  colliders: [
    collider("part:ball", { kind: "sphere", radiusM: 0.1 }),
    collider("fixture:floor", { kind: "box", halfExtentsM: [1, 0.5, 1] })
  ],
  joints: [],
  cloths: [],
  fluids: [],
  sourceBindings: []
};
model.sourceBindings = [{
  id: "source:ball",
  sourceRevision: "rev1",
  sourceDigest: "sha256:" + "1".repeat(64),
  modelId: "replayModel",
  occurrenceId: "ball",
  entityIds: ["part:ball", "part:ball:collider"],
  approximation: { kind: "control-net-sphere", lossLabel: "bounded replay fixture" }
}];
var world = createPhysicsWorld(model, options);
var session = createPhysicsRecorder(world);
var expected = { model, options, providerDigest: world.getState().identity.providerDigest };
var first = session.step([{ kind: "impulse", bodyId: "part:ball", impulseNs: [0, 0.5, 0] }]);
assert.equal(first.stepIndex, 1);
var beforeInvalid = JSON.stringify(session.getState());
var beforeFrames = session.saveRecording().frames.length;
assert.throws(
  () => session.step([{ kind: "impulse", bodyId: "missing", impulseNs: [0, 1, 0] }]),
  (error2) => error2 instanceof PhysicsError && error2.code === "INVALID_COMMAND"
);
assert.equal(JSON.stringify(session.getState()), beforeInvalid);
assert.equal(session.saveRecording().frames.length, beforeFrames);
var contacts = 0;
for (let index = 1; index < 150; index++) {
  const state = session.step();
  if (state.contacts.length) contacts++;
}
assert.ok(contacts > 0);
var recording = session.saveRecording();
assert.equal(recording.finalState.stepIndex, 150);
assert.equal(recording.finalState.timeSeconds, 150 * dt);
assert.equal(recording.frames.length, 150);
assert.equal(recording.frames[0].commands[0].kind, "impulse");
assert.equal(recording.frames[1].commands.length, 0);
var encoded = serializePhysicsRecording(recording);
var parsed = deserializePhysicsRecording(encoded);
var restoredPair = restorePhysicsRecording(parsed, expected);
var restored = restoredPair.recorder;
assert.deepEqual(restored.getState(), session.getState());
assert.deepEqual(restored.step(), session.step());
var modelCopy = session.saveRecording();
modelCopy.model.bodies[0].initial.positionM[1] = 999;
assert.equal(session.saveRecording().model.bodies[0].initial.positionM[1], 1.2);
var savedCopy = session.saveRecording();
savedCopy.frames[0].commands[0].impulseNs[1] = 99;
assert.equal(session.saveRecording().frames[0].commands[0].impulseNs[1], 0.5);
var refuses = (action, code) => assert.throws(
  action,
  (error2) => error2 instanceof PhysicsError && error2.code === code
);
var negativeZeroModel = { ...model, gravityMps2: [-0, -9.81, 0] };
var negativeZeroWorld = createPhysicsWorld(negativeZeroModel, options);
var negativeZeroSession = createPhysicsRecorder(negativeZeroWorld);
var signedZeroBytes = serializePhysicsRecording(negativeZeroSession.saveRecording());
assert.equal(Buffer.from(signedZeroBytes.subarray(0, 8)).toString("ascii"), "BCPHREC1");
assert.ok(Object.is(deserializePhysicsRecording(signedZeroBytes).model.gravityMps2[0], -0));
refuses(() => deserializePhysicsRecording(Buffer.from(JSON.stringify(recording))), "INVALID_SNAPSHOT");
refuses(() => deserializePhysicsRecording(signedZeroBytes.subarray(0, -1)), "INVALID_SNAPSHOT");
refuses(() => deserializePhysicsRecording(Uint8Array.from([...signedZeroBytes, 0])), "INVALID_SNAPSHOT");
negativeZeroSession.dispose();
negativeZeroWorld.dispose();
refuses(() => restorePhysicsRecording(parsed, { ...expected, model: { ...model, revision: "changed" } }), "STALE_SNAPSHOT");
var staleSourceModel = { ...model, sourceBindings: model.sourceBindings.map((binding) => ({ ...binding, sourceRevision: "rev2" })) };
refuses(() => restorePhysicsRecording(parsed, { ...expected, model: staleSourceModel }), "STALE_SNAPSHOT");
refuses(() => restorePhysicsRecording(parsed, { ...expected, providerDigest: "sha256:" + "0".repeat(64) }), "STALE_SNAPSHOT");
refuses(() => restorePhysicsRecording({ ...parsed, version: 2 }, expected), "INVALID_SNAPSHOT");
var damagedState = structuredClone(parsed);
damagedState.finalState.stepIndex++;
refuses(() => restorePhysicsRecording(damagedState, expected), "INVALID_SNAPSHOT");
var damagedCommand = structuredClone(parsed);
damagedCommand.frames.at(-1).commands = [{ kind: "impulse", bodyId: "part:ball", impulseNs: [0, 1, 0] }];
refuses(() => restorePhysicsRecording(damagedCommand, expected), "INVALID_SNAPSHOT");
var sparse = structuredClone(parsed);
delete sparse.frames[3];
refuses(() => restorePhysicsRecording(sparse, expected), "INVALID_SNAPSHOT");
refuses(() => createPhysicsWorld({ ...model, gravityMps2: [0, NaN, 0] }, options), "INVALID_CONFIG");
assert.deepEqual(restored.getState(), session.getState(), "failed restore changed accepted session");
var jointModel = {
  ...model,
  revision: "jointModel1",
  sourceBindings: [],
  bodies: [body("fixture:anchor", "static", [0, 0, 0]), body("part:held", "dynamic", [0, 0, 0])],
  colliders: [
    collider("fixture:anchor", { kind: "sphere", radiusM: 0.1 }),
    collider("part:held", { kind: "sphere", radiusM: 0.1 })
  ],
  joints: [{
    id: "joint:fixed",
    kind: "fixed",
    bodyAId: "fixture:anchor",
    bodyBId: "part:held",
    anchorALocalM: [0, 0, 0],
    anchorBLocalM: [0, 0, 0]
  }]
};
var jointWorld = createPhysicsWorld(jointModel, options);
var jointSession = createPhysicsRecorder(jointWorld);
jointSession.step();
jointSession.step();
var jointRestoredPair = restorePhysicsRecording(
  deserializePhysicsRecording(serializePhysicsRecording(jointSession.saveRecording())),
  { model: jointModel, options, providerDigest: jointWorld.getState().identity.providerDigest }
);
var jointRestored = jointRestoredPair.recorder;
assert.deepEqual(jointRestored.getState(), jointSession.getState());
var jointReactionY = jointRestored.getState().joints[0].linearImpulseOnBNs[1];
assert.ok(jointReactionY > 0);
var limitedModel = {
  ...model,
  revision: "limitModel1",
  sourceBindings: [],
  gravityMps2: [0, 0, 0],
  bodies: [body("part:idle", "dynamic", [0, 0, 0])],
  colliders: [collider("part:idle", { kind: "sphere", radiusM: 0.1 })]
};
var limitedWorld = createPhysicsWorld(limitedModel, options);
var limited = createPhysicsRecorder(limitedWorld);
for (let index = 0; index < 512; index++) limited.step();
var atLimit = JSON.stringify(limited.getState());
refuses(() => limited.step(), "WORLD_LIMIT");
assert.equal(JSON.stringify(limited.getState()), atLimit);
assert.equal(limited.saveRecording().frames.length, 512);
session.dispose();
restored.dispose();
jointSession.dispose();
jointRestored.dispose();
limited.dispose();
world.dispose();
restoredPair.world.dispose();
jointWorld.dispose();
jointRestoredPair.world.dispose();
limitedWorld.dispose();
refuses(() => session.getState(), "DISPOSED");
console.log(JSON.stringify({
  result: "ok",
  replayedSteps: 150,
  contactSteps: contacts,
  finalY: recording.finalState.bodies[0].positionM[1],
  jointReactionY,
  staleAndDamagedRefused: true,
  failedStepRetained: true,
  recordingLimitRetained: true
}));
