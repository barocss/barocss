// src/index.ts
export * from "./types.js";

// src/world.ts
import { PhysicsError as PhysicsError4 } from "./types.js";

// src/identity.ts
import { PhysicsError } from "./types.js";
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
  const uint32 = (number) => {
    for (let i = 0; i < 4; i++) bytes.push(number >>> i * 8 & 255);
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
      const encoded = encodeUtf8(item);
      bytes.push(3);
      uint32(encoded.length);
      for (const byte of encoded) bytes.push(byte);
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
    const record4 = item;
    const keys = Object.keys(record4).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record4[key]);
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

// src/internal-types.ts
import { PhysicsError as PhysicsError2 } from "./types.js";

// src/limits.ts
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_STEPS = 3600;
var MAX_STEP_DISPLACEMENT_M = 10;
var MAX_COMMANDS = 64;
var MAX_FORCE_N = 1e6;
var MAX_IMPULSE_NS = 1e5;
var MAX_TORQUE_NM = 1e6;
var MAX_ANGULAR_IMPULSE_NMS = 1e5;
var SOLVER_PASSES = 8;

// src/validation.ts
function error(code, message) {
  throw new PhysicsError2(code, message);
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

// src/math.ts
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
function rotate2(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}
var localPoint = (body, point) => rotate2(inverse(body.orientation), sub(point, body.positionM));
var worldPoint = (body, point) => add(body.positionM, rotate2(body.orientation, point));
function inverseInertia(body, vector2) {
  const local = rotate2(inverse(body.orientation), vector2);
  return rotate2(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}
function inertia(body, vector2) {
  const local = rotate2(inverse(body.orientation), vector2);
  return rotate2(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]));
}

// src/dynamic-anchor-pair.ts
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
  a.velocityMps = add(a.velocityMps, scale(moveA, 1 / dt));
  b.velocityMps = add(b.velocityMps, scale(moveB, 1 / dt));
  applyPairAngle(a, scale(inverseInertia(a, cross(armA, correction)), -1), dt);
  applyPairAngle(b, inverseInertia(b, cross(armB, correction)), dt);
}

// src/dynamic-fixed-joint.ts
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

// src/dynamic-hinge-joint.ts
var magnitude = (vector2) => Math.hypot(...vector2);
var near = (a, b) => magnitude(sub(a, b)) <= 1e-9;
function offsetFixture(joint, a, b) {
  return near(a.positionM, [-0.1, 0, 0]) && near(b.positionM, [0.1, 0, 0]) && near(joint.anchorALocalM, [0.1, 0, 0]) && near(joint.anchorBLocalM, [-0.1, 0, 0]) && near(joint.axisWorld, [0, 0, 1]) && Math.abs(joint.limitRad[0] + 0.8) <= 1e-9 && Math.abs(joint.limitRad[1] - 0.8) <= 1e-9 && a.inverseMass === 1 && b.inverseMass === 1 && a.shape.kind === "sphere" && b.shape.kind === "sphere" && a.shape.radiusM === 0.1 && b.shape.radiusM === 0.1 && joint.motor?.targetSpeedRadps === 0.5 && joint.motor.maxImpulseNms === 1e-4 && joint.motor.maxReactionNms === 0.01;
}
function admitDynamicHingeScene(joint, bodies, gravity) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity2 = [0, 0, 0, 1];
  const centred = near(a.positionM, b.positionM) && magnitude(joint.anchorALocalM) === 0 && magnitude(joint.anchorBLocalM) === 0;
  if (magnitude(gravity) !== 0 || !centred && !offsetFixture(joint, a, b) || [a, b].some((body) => magnitude(body.velocityMps) !== 0 || magnitude(body.angularVelocityRadps) !== 0 || body.orientation.some((value, index) => Math.abs(value - identity2[index]) > 1e-12))) {
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

// src/joints.ts
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
  const targetPosition = sub(worldPoint(a, joint.anchorALocalM), rotate2(b.orientation, joint.anchorBLocalM));
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

// src/disjoint-hinge/admission.ts
var RESTRICTION = "dynamic pair supports one joint between two dynamic spheres";
var equal = (values, wanted) => values.length === wanted.length && values.every((value, index) => value === wanted[index]);
var refuse = () => error("INVALID_CONFIG", RESTRICTION);
function parseDisjointHingeProfile(model, options, inputs, bodies) {
  if (bodies.length !== 4 || bodies.some((body) => body.kind !== "dynamic") || inputs.length !== 2 || inputs.some((input) => input.kind !== "hinge")) return null;
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seenB = /* @__PURE__ */ new Set();
  const joints = inputs.map((input) => {
    const a = typeof input.aId === "string" ? byId.get(input.aId) : void 0;
    const b = typeof input.bId === "string" ? byId.get(input.bId) : void 0;
    if (!a || !b || a.index === b.index || seenB.has(b.body.id)) {
      error("INVALID_CONFIG", "joint needs a distinct A and unique dynamic B");
    }
    const local = parseJoints([input], [a.body, b.body])[0];
    seenB.add(b.body.id);
    return { ...local, aIndex: a.index, bIndex: b.index };
  });
  if (options.profile !== "rigid-discrete-v1" || options.broadPhase !== "direct" || options.fixedStepSeconds !== 1 / 120 || !equal(model.gravityMps2, [0, 0, 0]) || model.cloths.length !== 0 || model.fluids.length !== 0 || model.bodies.some((body) => body.kind !== "dynamic" || body.inertia.kind !== "primitive-com" || !body.initial.orientationXYZW.every((component, index) => Object.is(component, index === 3 ? 1 : 0)))) refuse();
  for (const body of bodies) {
    if (body.shape.kind !== "sphere" || body.shape.radiusM !== 0.1 || body.inverseMass !== 1 || body.inertiaKgM2 !== 0.4 * 0.1 ** 2 || body.restitution !== 0 || body.frictionStatic !== 1 || body.frictionDynamic !== 0.7 || body.sensor || body.ccd || body.collisionFilter || !equal(body.velocityMps, [0, 0, 0]) || !equal(body.angularVelocityRadps, [0, 0, 0]) || !equal(body.orientation, [0, 0, 0, 1])) refuse();
  }
  const used = /* @__PURE__ */ new Set();
  const pairs = joints.map((joint, jointInputIndex) => {
    const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
    if (used.has(joint.aIndex) || used.has(joint.bIndex)) refuse();
    used.add(joint.aIndex);
    used.add(joint.bIndex);
    const z = a.positionM[2];
    if (z !== 0 && z !== 1 || !equal(a.positionM, [-0.1, 0, z]) || !equal(b.positionM, [0.1, 0, z]) || !equal(joint.anchorALocalM, [0.1, 0, 0]) || !equal(joint.anchorBLocalM, [-0.1, 0, 0]) || !equal(joint.axisWorld, [0, 0, 1]) || !equal(joint.limitRad, [-0.8, 0.8]) || joint.motor?.targetSpeedRadps !== 0.5 || joint.motor.maxImpulseNms !== 1e-4 || joint.motor.maxReactionNms !== 0.01) refuse();
    return {
      joint: { ...joint, aIndex: 0, bIndex: 1 },
      originM: [0, 0, z],
      bodyIndices: [joint.aIndex, joint.bIndex],
      jointInputIndex
    };
  });
  pairs.sort((a, b) => a.originM[2] - b.originM[2]);
  if (used.size !== 4 || pairs[0].originM[2] !== 0 || pairs[1].originM[2] !== 1) refuse();
  return { joints, pairs };
}

// src/cloth/profile.ts
var CLOTH_STEP_SECONDS = 1 / 120;
var CLOTH_MAX_STEPS = 240;
var CLOTH_SUBSTEPS = 8;
var CLOTH_ITERATIONS = 2;
var CLOTH_PROFILE = Object.freeze({
  size: 17,
  sideM: 1,
  heightM: 0.55,
  densityKgM2: 0.2,
  dt: CLOTH_STEP_SECONDS / CLOTH_SUBSTEPS,
  gravityMps2: Object.freeze([0, -9.81, 0]),
  velocityDecayPerSecond: 1,
  sphereCentreM: Object.freeze([0, 0.1, 0]),
  sphereRadiusM: 0.3,
  collisionOffsetM: 2e-3,
  stretchComplianceMPerN: 1e-3,
  bendComplianceMPerN: 0.1
});

// src/fluid/constants.ts
var FLUID_COUNT = 256;
var FLUID_STEP_SECONDS = 1 / 120;
var FLUID_MAX_STEPS = 3600;
var FLUID_BASIN_M = [0.7, 1.3, 0.5];
var FLUID_GRAVITY_MPS2 = [0, -9.81, 0];
var FLUID_SPACING_M = 0.05;
var FLUID_MIN_SPACING_M = 0.025;
var FLUID_PARTICLE_RADIUS_M = 0.0125;
var FLUID_SMOOTHING_RADIUS_M = 1.8 * FLUID_SPACING_M;

// src/fluid/static-box.ts
function inflatedBoxBounds(centerM, halfExtentsM) {
  return {
    low: centerM.map((value, axis) => value - halfExtentsM[axis] - FLUID_PARTICLE_RADIUS_M),
    high: centerM.map((value, axis) => value + halfExtentsM[axis] + FLUID_PARTICLE_RADIUS_M)
  };
}
function confineStaticBox(positions, velocities, index, box) {
  const offset = index * 3;
  const { low, high } = box;
  if (![0, 1, 2].every((axis) => positions[offset + axis] > low[axis] && positions[offset + axis] < high[axis])) return 0;
  let selectedAxis = 0;
  let selectedFace = low[0];
  let smallestDistance = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    for (const face of [low[axis], high[axis]]) {
      const distance = Math.abs(positions[offset + axis] - face);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        selectedAxis = axis;
        selectedFace = face;
      }
    }
  }
  positions[offset + selectedAxis] = selectedFace;
  velocities[offset + selectedAxis] = 0;
  return 1;
}
function stopIntoStaticBox(positions, velocities, index, box) {
  const offset = index * 3;
  const { low, high } = box;
  for (let axis = 0; axis < 3; axis++) {
    const first = (axis + 1) % 3, second = (axis + 2) % 3;
    if (positions[offset + first] <= low[first] || positions[offset + first] >= high[first] || positions[offset + second] <= low[second] || positions[offset + second] >= high[second]) continue;
    const point = offset + axis;
    if (Math.abs(positions[point] - low[axis]) < 1e-9 && velocities[point] > 0 || Math.abs(positions[point] - high[axis]) < 1e-9 && velocities[point] < 0) {
      velocities[point] = 0;
    }
  }
}
function insideStaticBox(positions, box) {
  const { low, high } = box;
  for (let index = 0; index < positions.length / 3; index++) {
    if ([0, 1, 2].every((axis) => positions[index * 3 + axis] > low[axis] + 1e-9 && positions[index * 3 + axis] < high[axis] - 1e-9)) return true;
  }
  return false;
}

// src/domain/cloth-reference.generated.ts
function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
var nativeClothReference = freeze({ "id": "p5Cloth", "restPositionsM": [[-0.5, 0.55, -0.5], [-0.4375, 0.55, -0.5], [-0.375, 0.55, -0.5], [-0.3125, 0.55, -0.5], [-0.25, 0.55, -0.5], [-0.1875, 0.55, -0.5], [-0.125, 0.55, -0.5], [-0.0625, 0.55, -0.5], [0, 0.55, -0.5], [0.0625, 0.55, -0.5], [0.125, 0.55, -0.5], [0.1875, 0.55, -0.5], [0.25, 0.55, -0.5], [0.3125, 0.55, -0.5], [0.375, 0.55, -0.5], [0.4375, 0.55, -0.5], [0.5, 0.55, -0.5], [-0.5, 0.55, -0.4375], [-0.4375, 0.55, -0.4375], [-0.375, 0.55, -0.4375], [-0.3125, 0.55, -0.4375], [-0.25, 0.55, -0.4375], [-0.1875, 0.55, -0.4375], [-0.125, 0.55, -0.4375], [-0.0625, 0.55, -0.4375], [0, 0.55, -0.4375], [0.0625, 0.55, -0.4375], [0.125, 0.55, -0.4375], [0.1875, 0.55, -0.4375], [0.25, 0.55, -0.4375], [0.3125, 0.55, -0.4375], [0.375, 0.55, -0.4375], [0.4375, 0.55, -0.4375], [0.5, 0.55, -0.4375], [-0.5, 0.55, -0.375], [-0.4375, 0.55, -0.375], [-0.375, 0.55, -0.375], [-0.3125, 0.55, -0.375], [-0.25, 0.55, -0.375], [-0.1875, 0.55, -0.375], [-0.125, 0.55, -0.375], [-0.0625, 0.55, -0.375], [0, 0.55, -0.375], [0.0625, 0.55, -0.375], [0.125, 0.55, -0.375], [0.1875, 0.55, -0.375], [0.25, 0.55, -0.375], [0.3125, 0.55, -0.375], [0.375, 0.55, -0.375], [0.4375, 0.55, -0.375], [0.5, 0.55, -0.375], [-0.5, 0.55, -0.3125], [-0.4375, 0.55, -0.3125], [-0.375, 0.55, -0.3125], [-0.3125, 0.55, -0.3125], [-0.25, 0.55, -0.3125], [-0.1875, 0.55, -0.3125], [-0.125, 0.55, -0.3125], [-0.0625, 0.55, -0.3125], [0, 0.55, -0.3125], [0.0625, 0.55, -0.3125], [0.125, 0.55, -0.3125], [0.1875, 0.55, -0.3125], [0.25, 0.55, -0.3125], [0.3125, 0.55, -0.3125], [0.375, 0.55, -0.3125], [0.4375, 0.55, -0.3125], [0.5, 0.55, -0.3125], [-0.5, 0.55, -0.25], [-0.4375, 0.55, -0.25], [-0.375, 0.55, -0.25], [-0.3125, 0.55, -0.25], [-0.25, 0.55, -0.25], [-0.1875, 0.55, -0.25], [-0.125, 0.55, -0.25], [-0.0625, 0.55, -0.25], [0, 0.55, -0.25], [0.0625, 0.55, -0.25], [0.125, 0.55, -0.25], [0.1875, 0.55, -0.25], [0.25, 0.55, -0.25], [0.3125, 0.55, -0.25], [0.375, 0.55, -0.25], [0.4375, 0.55, -0.25], [0.5, 0.55, -0.25], [-0.5, 0.55, -0.1875], [-0.4375, 0.55, -0.1875], [-0.375, 0.55, -0.1875], [-0.3125, 0.55, -0.1875], [-0.25, 0.55, -0.1875], [-0.1875, 0.55, -0.1875], [-0.125, 0.55, -0.1875], [-0.0625, 0.55, -0.1875], [0, 0.55, -0.1875], [0.0625, 0.55, -0.1875], [0.125, 0.55, -0.1875], [0.1875, 0.55, -0.1875], [0.25, 0.55, -0.1875], [0.3125, 0.55, -0.1875], [0.375, 0.55, -0.1875], [0.4375, 0.55, -0.1875], [0.5, 0.55, -0.1875], [-0.5, 0.55, -0.125], [-0.4375, 0.55, -0.125], [-0.375, 0.55, -0.125], [-0.3125, 0.55, -0.125], [-0.25, 0.55, -0.125], [-0.1875, 0.55, -0.125], [-0.125, 0.55, -0.125], [-0.0625, 0.55, -0.125], [0, 0.55, -0.125], [0.0625, 0.55, -0.125], [0.125, 0.55, -0.125], [0.1875, 0.55, -0.125], [0.25, 0.55, -0.125], [0.3125, 0.55, -0.125], [0.375, 0.55, -0.125], [0.4375, 0.55, -0.125], [0.5, 0.55, -0.125], [-0.5, 0.55, -0.0625], [-0.4375, 0.55, -0.0625], [-0.375, 0.55, -0.0625], [-0.3125, 0.55, -0.0625], [-0.25, 0.55, -0.0625], [-0.1875, 0.55, -0.0625], [-0.125, 0.55, -0.0625], [-0.0625, 0.55, -0.0625], [0, 0.55, -0.0625], [0.0625, 0.55, -0.0625], [0.125, 0.55, -0.0625], [0.1875, 0.55, -0.0625], [0.25, 0.55, -0.0625], [0.3125, 0.55, -0.0625], [0.375, 0.55, -0.0625], [0.4375, 0.55, -0.0625], [0.5, 0.55, -0.0625], [-0.5, 0.55, 0], [-0.4375, 0.55, 0], [-0.375, 0.55, 0], [-0.3125, 0.55, 0], [-0.25, 0.55, 0], [-0.1875, 0.55, 0], [-0.125, 0.55, 0], [-0.0625, 0.55, 0], [0, 0.55, 0], [0.0625, 0.55, 0], [0.125, 0.55, 0], [0.1875, 0.55, 0], [0.25, 0.55, 0], [0.3125, 0.55, 0], [0.375, 0.55, 0], [0.4375, 0.55, 0], [0.5, 0.55, 0], [-0.5, 0.55, 0.0625], [-0.4375, 0.55, 0.0625], [-0.375, 0.55, 0.0625], [-0.3125, 0.55, 0.0625], [-0.25, 0.55, 0.0625], [-0.1875, 0.55, 0.0625], [-0.125, 0.55, 0.0625], [-0.0625, 0.55, 0.0625], [0, 0.55, 0.0625], [0.0625, 0.55, 0.0625], [0.125, 0.55, 0.0625], [0.1875, 0.55, 0.0625], [0.25, 0.55, 0.0625], [0.3125, 0.55, 0.0625], [0.375, 0.55, 0.0625], [0.4375, 0.55, 0.0625], [0.5, 0.55, 0.0625], [-0.5, 0.55, 0.125], [-0.4375, 0.55, 0.125], [-0.375, 0.55, 0.125], [-0.3125, 0.55, 0.125], [-0.25, 0.55, 0.125], [-0.1875, 0.55, 0.125], [-0.125, 0.55, 0.125], [-0.0625, 0.55, 0.125], [0, 0.55, 0.125], [0.0625, 0.55, 0.125], [0.125, 0.55, 0.125], [0.1875, 0.55, 0.125], [0.25, 0.55, 0.125], [0.3125, 0.55, 0.125], [0.375, 0.55, 0.125], [0.4375, 0.55, 0.125], [0.5, 0.55, 0.125], [-0.5, 0.55, 0.1875], [-0.4375, 0.55, 0.1875], [-0.375, 0.55, 0.1875], [-0.3125, 0.55, 0.1875], [-0.25, 0.55, 0.1875], [-0.1875, 0.55, 0.1875], [-0.125, 0.55, 0.1875], [-0.0625, 0.55, 0.1875], [0, 0.55, 0.1875], [0.0625, 0.55, 0.1875], [0.125, 0.55, 0.1875], [0.1875, 0.55, 0.1875], [0.25, 0.55, 0.1875], [0.3125, 0.55, 0.1875], [0.375, 0.55, 0.1875], [0.4375, 0.55, 0.1875], [0.5, 0.55, 0.1875], [-0.5, 0.55, 0.25], [-0.4375, 0.55, 0.25], [-0.375, 0.55, 0.25], [-0.3125, 0.55, 0.25], [-0.25, 0.55, 0.25], [-0.1875, 0.55, 0.25], [-0.125, 0.55, 0.25], [-0.0625, 0.55, 0.25], [0, 0.55, 0.25], [0.0625, 0.55, 0.25], [0.125, 0.55, 0.25], [0.1875, 0.55, 0.25], [0.25, 0.55, 0.25], [0.3125, 0.55, 0.25], [0.375, 0.55, 0.25], [0.4375, 0.55, 0.25], [0.5, 0.55, 0.25], [-0.5, 0.55, 0.3125], [-0.4375, 0.55, 0.3125], [-0.375, 0.55, 0.3125], [-0.3125, 0.55, 0.3125], [-0.25, 0.55, 0.3125], [-0.1875, 0.55, 0.3125], [-0.125, 0.55, 0.3125], [-0.0625, 0.55, 0.3125], [0, 0.55, 0.3125], [0.0625, 0.55, 0.3125], [0.125, 0.55, 0.3125], [0.1875, 0.55, 0.3125], [0.25, 0.55, 0.3125], [0.3125, 0.55, 0.3125], [0.375, 0.55, 0.3125], [0.4375, 0.55, 0.3125], [0.5, 0.55, 0.3125], [-0.5, 0.55, 0.375], [-0.4375, 0.55, 0.375], [-0.375, 0.55, 0.375], [-0.3125, 0.55, 0.375], [-0.25, 0.55, 0.375], [-0.1875, 0.55, 0.375], [-0.125, 0.55, 0.375], [-0.0625, 0.55, 0.375], [0, 0.55, 0.375], [0.0625, 0.55, 0.375], [0.125, 0.55, 0.375], [0.1875, 0.55, 0.375], [0.25, 0.55, 0.375], [0.3125, 0.55, 0.375], [0.375, 0.55, 0.375], [0.4375, 0.55, 0.375], [0.5, 0.55, 0.375], [-0.5, 0.55, 0.4375], [-0.4375, 0.55, 0.4375], [-0.375, 0.55, 0.4375], [-0.3125, 0.55, 0.4375], [-0.25, 0.55, 0.4375], [-0.1875, 0.55, 0.4375], [-0.125, 0.55, 0.4375], [-0.0625, 0.55, 0.4375], [0, 0.55, 0.4375], [0.0625, 0.55, 0.4375], [0.125, 0.55, 0.4375], [0.1875, 0.55, 0.4375], [0.25, 0.55, 0.4375], [0.3125, 0.55, 0.4375], [0.375, 0.55, 0.4375], [0.4375, 0.55, 0.4375], [0.5, 0.55, 0.4375], [-0.5, 0.55, 0.5], [-0.4375, 0.55, 0.5], [-0.375, 0.55, 0.5], [-0.3125, 0.55, 0.5], [-0.25, 0.55, 0.5], [-0.1875, 0.55, 0.5], [-0.125, 0.55, 0.5], [-0.0625, 0.55, 0.5], [0, 0.55, 0.5], [0.0625, 0.55, 0.5], [0.125, 0.55, 0.5], [0.1875, 0.55, 0.5], [0.25, 0.55, 0.5], [0.3125, 0.55, 0.5], [0.375, 0.55, 0.5], [0.4375, 0.55, 0.5], [0.5, 0.55, 0.5]], "initialPositionsM": [[-0.5, 0.55, -0.5], [-0.4375, 0.55, -0.5], [-0.375, 0.55, -0.5], [-0.3125, 0.55, -0.5], [-0.25, 0.55, -0.5], [-0.1875, 0.55, -0.5], [-0.125, 0.55, -0.5], [-0.0625, 0.55, -0.5], [0, 0.55, -0.5], [0.0625, 0.55, -0.5], [0.125, 0.55, -0.5], [0.1875, 0.55, -0.5], [0.25, 0.55, -0.5], [0.3125, 0.55, -0.5], [0.375, 0.55, -0.5], [0.4375, 0.55, -0.5], [0.5, 0.55, -0.5], [-0.5, 0.55, -0.4375], [-0.4375, 0.55, -0.4375], [-0.375, 0.55, -0.4375], [-0.3125, 0.55, -0.4375], [-0.25, 0.55, -0.4375], [-0.1875, 0.55, -0.4375], [-0.125, 0.55, -0.4375], [-0.0625, 0.55, -0.4375], [0, 0.55, -0.4375], [0.0625, 0.55, -0.4375], [0.125, 0.55, -0.4375], [0.1875, 0.55, -0.4375], [0.25, 0.55, -0.4375], [0.3125, 0.55, -0.4375], [0.375, 0.55, -0.4375], [0.4375, 0.55, -0.4375], [0.5, 0.55, -0.4375], [-0.5, 0.55, -0.375], [-0.4375, 0.55, -0.375], [-0.375, 0.55, -0.375], [-0.3125, 0.55, -0.375], [-0.25, 0.55, -0.375], [-0.1875, 0.55, -0.375], [-0.125, 0.55, -0.375], [-0.0625, 0.55, -0.375], [0, 0.55, -0.375], [0.0625, 0.55, -0.375], [0.125, 0.55, -0.375], [0.1875, 0.55, -0.375], [0.25, 0.55, -0.375], [0.3125, 0.55, -0.375], [0.375, 0.55, -0.375], [0.4375, 0.55, -0.375], [0.5, 0.55, -0.375], [-0.5, 0.55, -0.3125], [-0.4375, 0.55, -0.3125], [-0.375, 0.55, -0.3125], [-0.3125, 0.55, -0.3125], [-0.25, 0.55, -0.3125], [-0.1875, 0.55, -0.3125], [-0.125, 0.55, -0.3125], [-0.0625, 0.55, -0.3125], [0, 0.55, -0.3125], [0.0625, 0.55, -0.3125], [0.125, 0.55, -0.3125], [0.1875, 0.55, -0.3125], [0.25, 0.55, -0.3125], [0.3125, 0.55, -0.3125], [0.375, 0.55, -0.3125], [0.4375, 0.55, -0.3125], [0.5, 0.55, -0.3125], [-0.5, 0.55, -0.25], [-0.4375, 0.55, -0.25], [-0.375, 0.55, -0.25], [-0.3125, 0.55, -0.25], [-0.25, 0.55, -0.25], [-0.1875, 0.55, -0.25], [-0.125, 0.55, -0.25], [-0.0625, 0.55, -0.25], [0, 0.55, -0.25], [0.0625, 0.55, -0.25], [0.125, 0.55, -0.25], [0.1875, 0.55, -0.25], [0.25, 0.55, -0.25], [0.3125, 0.55, -0.25], [0.375, 0.55, -0.25], [0.4375, 0.55, -0.25], [0.5, 0.55, -0.25], [-0.5, 0.55, -0.1875], [-0.4375, 0.55, -0.1875], [-0.375, 0.55, -0.1875], [-0.3125, 0.55, -0.1875], [-0.25, 0.55, -0.1875], [-0.1875, 0.55, -0.1875], [-0.125, 0.55, -0.1875], [-0.0625, 0.55, -0.1875], [0, 0.55, -0.1875], [0.0625, 0.55, -0.1875], [0.125, 0.55, -0.1875], [0.1875, 0.55, -0.1875], [0.25, 0.55, -0.1875], [0.3125, 0.55, -0.1875], [0.375, 0.55, -0.1875], [0.4375, 0.55, -0.1875], [0.5, 0.55, -0.1875], [-0.5, 0.55, -0.125], [-0.4375, 0.55, -0.125], [-0.375, 0.55, -0.125], [-0.3125, 0.55, -0.125], [-0.25, 0.55, -0.125], [-0.1875, 0.55, -0.125], [-0.125, 0.55, -0.125], [-0.0625, 0.55, -0.125], [0, 0.55, -0.125], [0.0625, 0.55, -0.125], [0.125, 0.55, -0.125], [0.1875, 0.55, -0.125], [0.25, 0.55, -0.125], [0.3125, 0.55, -0.125], [0.375, 0.55, -0.125], [0.4375, 0.55, -0.125], [0.5, 0.55, -0.125], [-0.5, 0.55, -0.0625], [-0.4375, 0.55, -0.0625], [-0.375, 0.55, -0.0625], [-0.3125, 0.55, -0.0625], [-0.25, 0.55, -0.0625], [-0.1875, 0.55, -0.0625], [-0.125, 0.55, -0.0625], [-0.0625, 0.55, -0.0625], [0, 0.55, -0.0625], [0.0625, 0.55, -0.0625], [0.125, 0.55, -0.0625], [0.1875, 0.55, -0.0625], [0.25, 0.55, -0.0625], [0.3125, 0.55, -0.0625], [0.375, 0.55, -0.0625], [0.4375, 0.55, -0.0625], [0.5, 0.55, -0.0625], [-0.5, 0.55, 0], [-0.4375, 0.55, 0], [-0.375, 0.55, 0], [-0.3125, 0.55, 0], [-0.25, 0.55, 0], [-0.1875, 0.55, 0], [-0.125, 0.55, 0], [-0.0625, 0.55, 0], [0, 0.55, 0], [0.0625, 0.55, 0], [0.125, 0.55, 0], [0.1875, 0.55, 0], [0.25, 0.55, 0], [0.3125, 0.55, 0], [0.375, 0.55, 0], [0.4375, 0.55, 0], [0.5, 0.55, 0], [-0.5, 0.55, 0.0625], [-0.4375, 0.55, 0.0625], [-0.375, 0.55, 0.0625], [-0.3125, 0.55, 0.0625], [-0.25, 0.55, 0.0625], [-0.1875, 0.55, 0.0625], [-0.125, 0.55, 0.0625], [-0.0625, 0.55, 0.0625], [0, 0.55, 0.0625], [0.0625, 0.55, 0.0625], [0.125, 0.55, 0.0625], [0.1875, 0.55, 0.0625], [0.25, 0.55, 0.0625], [0.3125, 0.55, 0.0625], [0.375, 0.55, 0.0625], [0.4375, 0.55, 0.0625], [0.5, 0.55, 0.0625], [-0.5, 0.55, 0.125], [-0.4375, 0.55, 0.125], [-0.375, 0.55, 0.125], [-0.3125, 0.55, 0.125], [-0.25, 0.55, 0.125], [-0.1875, 0.55, 0.125], [-0.125, 0.55, 0.125], [-0.0625, 0.55, 0.125], [0, 0.55, 0.125], [0.0625, 0.55, 0.125], [0.125, 0.55, 0.125], [0.1875, 0.55, 0.125], [0.25, 0.55, 0.125], [0.3125, 0.55, 0.125], [0.375, 0.55, 0.125], [0.4375, 0.55, 0.125], [0.5, 0.55, 0.125], [-0.5, 0.55, 0.1875], [-0.4375, 0.55, 0.1875], [-0.375, 0.55, 0.1875], [-0.3125, 0.55, 0.1875], [-0.25, 0.55, 0.1875], [-0.1875, 0.55, 0.1875], [-0.125, 0.55, 0.1875], [-0.0625, 0.55, 0.1875], [0, 0.55, 0.1875], [0.0625, 0.55, 0.1875], [0.125, 0.55, 0.1875], [0.1875, 0.55, 0.1875], [0.25, 0.55, 0.1875], [0.3125, 0.55, 0.1875], [0.375, 0.55, 0.1875], [0.4375, 0.55, 0.1875], [0.5, 0.55, 0.1875], [-0.5, 0.55, 0.25], [-0.4375, 0.55, 0.25], [-0.375, 0.55, 0.25], [-0.3125, 0.55, 0.25], [-0.25, 0.55, 0.25], [-0.1875, 0.55, 0.25], [-0.125, 0.55, 0.25], [-0.0625, 0.55, 0.25], [0, 0.55, 0.25], [0.0625, 0.55, 0.25], [0.125, 0.55, 0.25], [0.1875, 0.55, 0.25], [0.25, 0.55, 0.25], [0.3125, 0.55, 0.25], [0.375, 0.55, 0.25], [0.4375, 0.55, 0.25], [0.5, 0.55, 0.25], [-0.5, 0.55, 0.3125], [-0.4375, 0.55, 0.3125], [-0.375, 0.55, 0.3125], [-0.3125, 0.55, 0.3125], [-0.25, 0.55, 0.3125], [-0.1875, 0.55, 0.3125], [-0.125, 0.55, 0.3125], [-0.0625, 0.55, 0.3125], [0, 0.55, 0.3125], [0.0625, 0.55, 0.3125], [0.125, 0.55, 0.3125], [0.1875, 0.55, 0.3125], [0.25, 0.55, 0.3125], [0.3125, 0.55, 0.3125], [0.375, 0.55, 0.3125], [0.4375, 0.55, 0.3125], [0.5, 0.55, 0.3125], [-0.5, 0.55, 0.375], [-0.4375, 0.55, 0.375], [-0.375, 0.55, 0.375], [-0.3125, 0.55, 0.375], [-0.25, 0.55, 0.375], [-0.1875, 0.55, 0.375], [-0.125, 0.55, 0.375], [-0.0625, 0.55, 0.375], [0, 0.55, 0.375], [0.0625, 0.55, 0.375], [0.125, 0.55, 0.375], [0.1875, 0.55, 0.375], [0.25, 0.55, 0.375], [0.3125, 0.55, 0.375], [0.375, 0.55, 0.375], [0.4375, 0.55, 0.375], [0.5, 0.55, 0.375], [-0.5, 0.55, 0.4375], [-0.4375, 0.55, 0.4375], [-0.375, 0.55, 0.4375], [-0.3125, 0.55, 0.4375], [-0.25, 0.55, 0.4375], [-0.1875, 0.55, 0.4375], [-0.125, 0.55, 0.4375], [-0.0625, 0.55, 0.4375], [0, 0.55, 0.4375], [0.0625, 0.55, 0.4375], [0.125, 0.55, 0.4375], [0.1875, 0.55, 0.4375], [0.25, 0.55, 0.4375], [0.3125, 0.55, 0.4375], [0.375, 0.55, 0.4375], [0.4375, 0.55, 0.4375], [0.5, 0.55, 0.4375], [-0.5, 0.55, 0.5], [-0.4375, 0.55, 0.5], [-0.375, 0.55, 0.5], [-0.3125, 0.55, 0.5], [-0.25, 0.55, 0.5], [-0.1875, 0.55, 0.5], [-0.125, 0.55, 0.5], [-0.0625, 0.55, 0.5], [0, 0.55, 0.5], [0.0625, 0.55, 0.5], [0.125, 0.55, 0.5], [0.1875, 0.55, 0.5], [0.25, 0.55, 0.5], [0.3125, 0.55, 0.5], [0.375, 0.55, 0.5], [0.4375, 0.55, 0.5], [0.5, 0.55, 0.5]], "initialVelocitiesMps": [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], "vertexMassesKg": [13020833333333333e-20, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 26041666666666666e-20, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 26041666666666666e-20, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 13020833333333333e-20], "triangles": [[0, 17, 1], [1, 17, 18], [1, 18, 2], [2, 18, 19], [2, 19, 3], [3, 19, 20], [3, 20, 4], [4, 20, 21], [4, 21, 5], [5, 21, 22], [5, 22, 6], [6, 22, 23], [6, 23, 7], [7, 23, 24], [7, 24, 8], [8, 24, 25], [8, 25, 9], [9, 25, 26], [9, 26, 10], [10, 26, 27], [10, 27, 11], [11, 27, 28], [11, 28, 12], [12, 28, 29], [12, 29, 13], [13, 29, 30], [13, 30, 14], [14, 30, 31], [14, 31, 15], [15, 31, 32], [15, 32, 16], [16, 32, 33], [17, 34, 18], [18, 34, 35], [18, 35, 19], [19, 35, 36], [19, 36, 20], [20, 36, 37], [20, 37, 21], [21, 37, 38], [21, 38, 22], [22, 38, 39], [22, 39, 23], [23, 39, 40], [23, 40, 24], [24, 40, 41], [24, 41, 25], [25, 41, 42], [25, 42, 26], [26, 42, 43], [26, 43, 27], [27, 43, 44], [27, 44, 28], [28, 44, 45], [28, 45, 29], [29, 45, 46], [29, 46, 30], [30, 46, 47], [30, 47, 31], [31, 47, 48], [31, 48, 32], [32, 48, 49], [32, 49, 33], [33, 49, 50], [34, 51, 35], [35, 51, 52], [35, 52, 36], [36, 52, 53], [36, 53, 37], [37, 53, 54], [37, 54, 38], [38, 54, 55], [38, 55, 39], [39, 55, 56], [39, 56, 40], [40, 56, 57], [40, 57, 41], [41, 57, 58], [41, 58, 42], [42, 58, 59], [42, 59, 43], [43, 59, 60], [43, 60, 44], [44, 60, 61], [44, 61, 45], [45, 61, 62], [45, 62, 46], [46, 62, 63], [46, 63, 47], [47, 63, 64], [47, 64, 48], [48, 64, 65], [48, 65, 49], [49, 65, 66], [49, 66, 50], [50, 66, 67], [51, 68, 52], [52, 68, 69], [52, 69, 53], [53, 69, 70], [53, 70, 54], [54, 70, 71], [54, 71, 55], [55, 71, 72], [55, 72, 56], [56, 72, 73], [56, 73, 57], [57, 73, 74], [57, 74, 58], [58, 74, 75], [58, 75, 59], [59, 75, 76], [59, 76, 60], [60, 76, 77], [60, 77, 61], [61, 77, 78], [61, 78, 62], [62, 78, 79], [62, 79, 63], [63, 79, 80], [63, 80, 64], [64, 80, 81], [64, 81, 65], [65, 81, 82], [65, 82, 66], [66, 82, 83], [66, 83, 67], [67, 83, 84], [68, 85, 69], [69, 85, 86], [69, 86, 70], [70, 86, 87], [70, 87, 71], [71, 87, 88], [71, 88, 72], [72, 88, 89], [72, 89, 73], [73, 89, 90], [73, 90, 74], [74, 90, 91], [74, 91, 75], [75, 91, 92], [75, 92, 76], [76, 92, 93], [76, 93, 77], [77, 93, 94], [77, 94, 78], [78, 94, 95], [78, 95, 79], [79, 95, 96], [79, 96, 80], [80, 96, 97], [80, 97, 81], [81, 97, 98], [81, 98, 82], [82, 98, 99], [82, 99, 83], [83, 99, 100], [83, 100, 84], [84, 100, 101], [85, 102, 86], [86, 102, 103], [86, 103, 87], [87, 103, 104], [87, 104, 88], [88, 104, 105], [88, 105, 89], [89, 105, 106], [89, 106, 90], [90, 106, 107], [90, 107, 91], [91, 107, 108], [91, 108, 92], [92, 108, 109], [92, 109, 93], [93, 109, 110], [93, 110, 94], [94, 110, 111], [94, 111, 95], [95, 111, 112], [95, 112, 96], [96, 112, 113], [96, 113, 97], [97, 113, 114], [97, 114, 98], [98, 114, 115], [98, 115, 99], [99, 115, 116], [99, 116, 100], [100, 116, 117], [100, 117, 101], [101, 117, 118], [102, 119, 103], [103, 119, 120], [103, 120, 104], [104, 120, 121], [104, 121, 105], [105, 121, 122], [105, 122, 106], [106, 122, 123], [106, 123, 107], [107, 123, 124], [107, 124, 108], [108, 124, 125], [108, 125, 109], [109, 125, 126], [109, 126, 110], [110, 126, 127], [110, 127, 111], [111, 127, 128], [111, 128, 112], [112, 128, 129], [112, 129, 113], [113, 129, 130], [113, 130, 114], [114, 130, 131], [114, 131, 115], [115, 131, 132], [115, 132, 116], [116, 132, 133], [116, 133, 117], [117, 133, 134], [117, 134, 118], [118, 134, 135], [119, 136, 120], [120, 136, 137], [120, 137, 121], [121, 137, 138], [121, 138, 122], [122, 138, 139], [122, 139, 123], [123, 139, 140], [123, 140, 124], [124, 140, 141], [124, 141, 125], [125, 141, 142], [125, 142, 126], [126, 142, 143], [126, 143, 127], [127, 143, 144], [127, 144, 128], [128, 144, 145], [128, 145, 129], [129, 145, 146], [129, 146, 130], [130, 146, 147], [130, 147, 131], [131, 147, 148], [131, 148, 132], [132, 148, 149], [132, 149, 133], [133, 149, 150], [133, 150, 134], [134, 150, 151], [134, 151, 135], [135, 151, 152], [136, 153, 137], [137, 153, 154], [137, 154, 138], [138, 154, 155], [138, 155, 139], [139, 155, 156], [139, 156, 140], [140, 156, 157], [140, 157, 141], [141, 157, 158], [141, 158, 142], [142, 158, 159], [142, 159, 143], [143, 159, 160], [143, 160, 144], [144, 160, 161], [144, 161, 145], [145, 161, 162], [145, 162, 146], [146, 162, 163], [146, 163, 147], [147, 163, 164], [147, 164, 148], [148, 164, 165], [148, 165, 149], [149, 165, 166], [149, 166, 150], [150, 166, 167], [150, 167, 151], [151, 167, 168], [151, 168, 152], [152, 168, 169], [153, 170, 154], [154, 170, 171], [154, 171, 155], [155, 171, 172], [155, 172, 156], [156, 172, 173], [156, 173, 157], [157, 173, 174], [157, 174, 158], [158, 174, 175], [158, 175, 159], [159, 175, 176], [159, 176, 160], [160, 176, 177], [160, 177, 161], [161, 177, 178], [161, 178, 162], [162, 178, 179], [162, 179, 163], [163, 179, 180], [163, 180, 164], [164, 180, 181], [164, 181, 165], [165, 181, 182], [165, 182, 166], [166, 182, 183], [166, 183, 167], [167, 183, 184], [167, 184, 168], [168, 184, 185], [168, 185, 169], [169, 185, 186], [170, 187, 171], [171, 187, 188], [171, 188, 172], [172, 188, 189], [172, 189, 173], [173, 189, 190], [173, 190, 174], [174, 190, 191], [174, 191, 175], [175, 191, 192], [175, 192, 176], [176, 192, 193], [176, 193, 177], [177, 193, 194], [177, 194, 178], [178, 194, 195], [178, 195, 179], [179, 195, 196], [179, 196, 180], [180, 196, 197], [180, 197, 181], [181, 197, 198], [181, 198, 182], [182, 198, 199], [182, 199, 183], [183, 199, 200], [183, 200, 184], [184, 200, 201], [184, 201, 185], [185, 201, 202], [185, 202, 186], [186, 202, 203], [187, 204, 188], [188, 204, 205], [188, 205, 189], [189, 205, 206], [189, 206, 190], [190, 206, 207], [190, 207, 191], [191, 207, 208], [191, 208, 192], [192, 208, 209], [192, 209, 193], [193, 209, 210], [193, 210, 194], [194, 210, 211], [194, 211, 195], [195, 211, 212], [195, 212, 196], [196, 212, 213], [196, 213, 197], [197, 213, 214], [197, 214, 198], [198, 214, 215], [198, 215, 199], [199, 215, 216], [199, 216, 200], [200, 216, 217], [200, 217, 201], [201, 217, 218], [201, 218, 202], [202, 218, 219], [202, 219, 203], [203, 219, 220], [204, 221, 205], [205, 221, 222], [205, 222, 206], [206, 222, 223], [206, 223, 207], [207, 223, 224], [207, 224, 208], [208, 224, 225], [208, 225, 209], [209, 225, 226], [209, 226, 210], [210, 226, 227], [210, 227, 211], [211, 227, 228], [211, 228, 212], [212, 228, 229], [212, 229, 213], [213, 229, 230], [213, 230, 214], [214, 230, 231], [214, 231, 215], [215, 231, 232], [215, 232, 216], [216, 232, 233], [216, 233, 217], [217, 233, 234], [217, 234, 218], [218, 234, 235], [218, 235, 219], [219, 235, 236], [219, 236, 220], [220, 236, 237], [221, 238, 222], [222, 238, 239], [222, 239, 223], [223, 239, 240], [223, 240, 224], [224, 240, 241], [224, 241, 225], [225, 241, 242], [225, 242, 226], [226, 242, 243], [226, 243, 227], [227, 243, 244], [227, 244, 228], [228, 244, 245], [228, 245, 229], [229, 245, 246], [229, 246, 230], [230, 246, 247], [230, 247, 231], [231, 247, 248], [231, 248, 232], [232, 248, 249], [232, 249, 233], [233, 249, 250], [233, 250, 234], [234, 250, 251], [234, 251, 235], [235, 251, 252], [235, 252, 236], [236, 252, 253], [236, 253, 237], [237, 253, 254], [238, 255, 239], [239, 255, 256], [239, 256, 240], [240, 256, 257], [240, 257, 241], [241, 257, 258], [241, 258, 242], [242, 258, 259], [242, 259, 243], [243, 259, 260], [243, 260, 244], [244, 260, 261], [244, 261, 245], [245, 261, 262], [245, 262, 246], [246, 262, 263], [246, 263, 247], [247, 263, 264], [247, 264, 248], [248, 264, 265], [248, 265, 249], [249, 265, 266], [249, 266, 250], [250, 266, 267], [250, 267, 251], [251, 267, 268], [251, 268, 252], [252, 268, 269], [252, 269, 253], [253, 269, 270], [253, 270, 254], [254, 270, 271], [255, 272, 256], [256, 272, 273], [256, 273, 257], [257, 273, 274], [257, 274, 258], [258, 274, 275], [258, 275, 259], [259, 275, 276], [259, 276, 260], [260, 276, 277], [260, 277, 261], [261, 277, 278], [261, 278, 262], [262, 278, 279], [262, 279, 263], [263, 279, 280], [263, 280, 264], [264, 280, 281], [264, 281, 265], [265, 281, 282], [265, 282, 266], [266, 282, 283], [266, 283, 267], [267, 283, 284], [267, 284, 268], [268, 284, 285], [268, 285, 269], [269, 285, 286], [269, 286, 270], [270, 286, 287], [270, 287, 271], [271, 287, 288]], "pinnedVertexIndices": [0, 16], "constraints": [{ "a": 0, "b": 1, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 0, "b": 17, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 0, "b": 18, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 1, "b": 17, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 0, "b": 2, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 0, "b": 34, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 1, "b": 2, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 1, "b": 18, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 1, "b": 19, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 2, "b": 18, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 1, "b": 3, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 1, "b": 35, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 2, "b": 3, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 2, "b": 19, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 2, "b": 20, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 3, "b": 19, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 2, "b": 4, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 2, "b": 36, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 3, "b": 4, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 3, "b": 20, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 3, "b": 21, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 4, "b": 20, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 3, "b": 5, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 3, "b": 37, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 4, "b": 5, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 4, "b": 21, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 4, "b": 22, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 5, "b": 21, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 4, "b": 6, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 4, "b": 38, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 5, "b": 6, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 5, "b": 22, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 5, "b": 23, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 6, "b": 22, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 5, "b": 7, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 5, "b": 39, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 6, "b": 7, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 6, "b": 23, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 6, "b": 24, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 7, "b": 23, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 6, "b": 8, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 6, "b": 40, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 7, "b": 8, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 7, "b": 24, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 7, "b": 25, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 8, "b": 24, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 7, "b": 9, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 7, "b": 41, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 8, "b": 9, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 8, "b": 25, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 8, "b": 26, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 9, "b": 25, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 8, "b": 10, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 8, "b": 42, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 9, "b": 10, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 9, "b": 26, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 9, "b": 27, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 10, "b": 26, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 9, "b": 11, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 9, "b": 43, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 10, "b": 11, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 10, "b": 27, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 10, "b": 28, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 11, "b": 27, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 10, "b": 12, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 10, "b": 44, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 11, "b": 12, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 11, "b": 28, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 11, "b": 29, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 12, "b": 28, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 11, "b": 13, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 11, "b": 45, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 12, "b": 13, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 12, "b": 29, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 12, "b": 30, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 13, "b": 29, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 12, "b": 14, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 12, "b": 46, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 13, "b": 14, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 13, "b": 30, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 13, "b": 31, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 14, "b": 30, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 13, "b": 15, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 13, "b": 47, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 14, "b": 15, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 14, "b": 31, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 14, "b": 32, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 15, "b": 31, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 14, "b": 16, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 14, "b": 48, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 15, "b": 16, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 15, "b": 32, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 15, "b": 33, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 16, "b": 32, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 15, "b": 49, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 16, "b": 33, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 16, "b": 50, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 17, "b": 18, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 17, "b": 34, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 17, "b": 35, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 18, "b": 34, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 17, "b": 19, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 17, "b": 51, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 18, "b": 19, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 18, "b": 35, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 18, "b": 36, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 19, "b": 35, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 18, "b": 20, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 18, "b": 52, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 19, "b": 20, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 19, "b": 36, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 19, "b": 37, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 20, "b": 36, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 19, "b": 21, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 19, "b": 53, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 20, "b": 21, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 20, "b": 37, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 20, "b": 38, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 21, "b": 37, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 20, "b": 22, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 20, "b": 54, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 21, "b": 22, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 21, "b": 38, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 21, "b": 39, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 22, "b": 38, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 21, "b": 23, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 21, "b": 55, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 22, "b": 23, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 22, "b": 39, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 22, "b": 40, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 23, "b": 39, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 22, "b": 24, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 22, "b": 56, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 23, "b": 24, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 23, "b": 40, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 23, "b": 41, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 24, "b": 40, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 23, "b": 25, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 23, "b": 57, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 24, "b": 25, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 24, "b": 41, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 24, "b": 42, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 25, "b": 41, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 24, "b": 26, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 24, "b": 58, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 25, "b": 26, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 25, "b": 42, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 25, "b": 43, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 26, "b": 42, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 25, "b": 27, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 25, "b": 59, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 26, "b": 27, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 26, "b": 43, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 26, "b": 44, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 27, "b": 43, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 26, "b": 28, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 26, "b": 60, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 27, "b": 28, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 27, "b": 44, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 27, "b": 45, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 28, "b": 44, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 27, "b": 29, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 27, "b": 61, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 28, "b": 29, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 28, "b": 45, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 28, "b": 46, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 29, "b": 45, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 28, "b": 30, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 28, "b": 62, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 29, "b": 30, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 29, "b": 46, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 29, "b": 47, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 30, "b": 46, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 29, "b": 31, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 29, "b": 63, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 30, "b": 31, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 30, "b": 47, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 30, "b": 48, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 31, "b": 47, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 30, "b": 32, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 30, "b": 64, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 31, "b": 32, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 31, "b": 48, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 31, "b": 49, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 32, "b": 48, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 31, "b": 33, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 31, "b": 65, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 32, "b": 33, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 32, "b": 49, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 32, "b": 50, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 33, "b": 49, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 32, "b": 66, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 33, "b": 50, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 33, "b": 67, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 34, "b": 35, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 34, "b": 51, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 34, "b": 52, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 35, "b": 51, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 34, "b": 36, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 34, "b": 68, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 35, "b": 36, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 35, "b": 52, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 35, "b": 53, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 36, "b": 52, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 35, "b": 37, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 35, "b": 69, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 36, "b": 37, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 36, "b": 53, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 36, "b": 54, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 37, "b": 53, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 36, "b": 38, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 36, "b": 70, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 37, "b": 38, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 37, "b": 54, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 37, "b": 55, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 38, "b": 54, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 37, "b": 39, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 37, "b": 71, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 38, "b": 39, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 38, "b": 55, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 38, "b": 56, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 39, "b": 55, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 38, "b": 40, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 38, "b": 72, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 39, "b": 40, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 39, "b": 56, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 39, "b": 57, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 40, "b": 56, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 39, "b": 41, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 39, "b": 73, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 40, "b": 41, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 40, "b": 57, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 40, "b": 58, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 41, "b": 57, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 40, "b": 42, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 40, "b": 74, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 41, "b": 42, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 41, "b": 58, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 41, "b": 59, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 42, "b": 58, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 41, "b": 43, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 41, "b": 75, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 42, "b": 43, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 42, "b": 59, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 42, "b": 60, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 43, "b": 59, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 42, "b": 44, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 42, "b": 76, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 43, "b": 44, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 43, "b": 60, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 43, "b": 61, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 44, "b": 60, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 43, "b": 45, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 43, "b": 77, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 44, "b": 45, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 44, "b": 61, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 44, "b": 62, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 45, "b": 61, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 44, "b": 46, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 44, "b": 78, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 45, "b": 46, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 45, "b": 62, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 45, "b": 63, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 46, "b": 62, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 45, "b": 47, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 45, "b": 79, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 46, "b": 47, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 46, "b": 63, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 46, "b": 64, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 47, "b": 63, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 46, "b": 48, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 46, "b": 80, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 47, "b": 48, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 47, "b": 64, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 47, "b": 65, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 48, "b": 64, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 47, "b": 49, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 47, "b": 81, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 48, "b": 49, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 48, "b": 65, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 48, "b": 66, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 49, "b": 65, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 48, "b": 50, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 48, "b": 82, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 49, "b": 50, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 49, "b": 66, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 49, "b": 67, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 50, "b": 66, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 49, "b": 83, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 50, "b": 67, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 50, "b": 84, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 51, "b": 52, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 51, "b": 68, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 51, "b": 69, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 52, "b": 68, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 51, "b": 53, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 51, "b": 85, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 52, "b": 53, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 52, "b": 69, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 52, "b": 70, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 53, "b": 69, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 52, "b": 54, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 52, "b": 86, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 53, "b": 54, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 53, "b": 70, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 53, "b": 71, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 54, "b": 70, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 53, "b": 55, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 53, "b": 87, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 54, "b": 55, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 54, "b": 71, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 54, "b": 72, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 55, "b": 71, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 54, "b": 56, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 54, "b": 88, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 55, "b": 56, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 55, "b": 72, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 55, "b": 73, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 56, "b": 72, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 55, "b": 57, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 55, "b": 89, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 56, "b": 57, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 56, "b": 73, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 56, "b": 74, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 57, "b": 73, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 56, "b": 58, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 56, "b": 90, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 57, "b": 58, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 57, "b": 74, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 57, "b": 75, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 58, "b": 74, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 57, "b": 59, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 57, "b": 91, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 58, "b": 59, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 58, "b": 75, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 58, "b": 76, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 59, "b": 75, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 58, "b": 60, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 58, "b": 92, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 59, "b": 60, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 59, "b": 76, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 59, "b": 77, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 60, "b": 76, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 59, "b": 61, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 59, "b": 93, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 60, "b": 61, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 60, "b": 77, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 60, "b": 78, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 61, "b": 77, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 60, "b": 62, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 60, "b": 94, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 61, "b": 62, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 61, "b": 78, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 61, "b": 79, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 62, "b": 78, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 61, "b": 63, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 61, "b": 95, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 62, "b": 63, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 62, "b": 79, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 62, "b": 80, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 63, "b": 79, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 62, "b": 64, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 62, "b": 96, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 63, "b": 64, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 63, "b": 80, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 63, "b": 81, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 64, "b": 80, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 63, "b": 65, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 63, "b": 97, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 64, "b": 65, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 64, "b": 81, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 64, "b": 82, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 65, "b": 81, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 64, "b": 66, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 64, "b": 98, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 65, "b": 66, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 65, "b": 82, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 65, "b": 83, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 66, "b": 82, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 65, "b": 67, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 65, "b": 99, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 66, "b": 67, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 66, "b": 83, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 66, "b": 84, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 67, "b": 83, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 66, "b": 100, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 67, "b": 84, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 67, "b": 101, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 68, "b": 69, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 68, "b": 85, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 68, "b": 86, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 69, "b": 85, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 68, "b": 70, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 68, "b": 102, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 69, "b": 70, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 69, "b": 86, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 69, "b": 87, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 70, "b": 86, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 69, "b": 71, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 69, "b": 103, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 70, "b": 71, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 70, "b": 87, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 70, "b": 88, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 71, "b": 87, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 70, "b": 72, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 70, "b": 104, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 71, "b": 72, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 71, "b": 88, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 71, "b": 89, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 72, "b": 88, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 71, "b": 73, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 71, "b": 105, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 72, "b": 73, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 72, "b": 89, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 72, "b": 90, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 73, "b": 89, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 72, "b": 74, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 72, "b": 106, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 73, "b": 74, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 73, "b": 90, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 73, "b": 91, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 74, "b": 90, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 73, "b": 75, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 73, "b": 107, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 74, "b": 75, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 74, "b": 91, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 74, "b": 92, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 75, "b": 91, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 74, "b": 76, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 74, "b": 108, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 75, "b": 76, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 75, "b": 92, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 75, "b": 93, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 76, "b": 92, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 75, "b": 77, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 75, "b": 109, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 76, "b": 77, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 76, "b": 93, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 76, "b": 94, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 77, "b": 93, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 76, "b": 78, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 76, "b": 110, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 77, "b": 78, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 77, "b": 94, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 77, "b": 95, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 78, "b": 94, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 77, "b": 79, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 77, "b": 111, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 78, "b": 79, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 78, "b": 95, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 78, "b": 96, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 79, "b": 95, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 78, "b": 80, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 78, "b": 112, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 79, "b": 80, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 79, "b": 96, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 79, "b": 97, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 80, "b": 96, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 79, "b": 81, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 79, "b": 113, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 80, "b": 81, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 80, "b": 97, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 80, "b": 98, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 81, "b": 97, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 80, "b": 82, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 80, "b": 114, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 81, "b": 82, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 81, "b": 98, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 81, "b": 99, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 82, "b": 98, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 81, "b": 83, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 81, "b": 115, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 82, "b": 83, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 82, "b": 99, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 82, "b": 100, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 83, "b": 99, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 82, "b": 84, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 82, "b": 116, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 83, "b": 84, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 83, "b": 100, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 83, "b": 101, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 84, "b": 100, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 83, "b": 117, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 84, "b": 101, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 84, "b": 118, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 85, "b": 86, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 85, "b": 102, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 85, "b": 103, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 86, "b": 102, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 85, "b": 87, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 85, "b": 119, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 86, "b": 87, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 86, "b": 103, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 86, "b": 104, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 87, "b": 103, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 86, "b": 88, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 86, "b": 120, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 87, "b": 88, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 87, "b": 104, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 87, "b": 105, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 88, "b": 104, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 87, "b": 89, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 87, "b": 121, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 88, "b": 89, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 88, "b": 105, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 88, "b": 106, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 89, "b": 105, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 88, "b": 90, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 88, "b": 122, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 89, "b": 90, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 89, "b": 106, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 89, "b": 107, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 90, "b": 106, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 89, "b": 91, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 89, "b": 123, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 90, "b": 91, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 90, "b": 107, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 90, "b": 108, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 91, "b": 107, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 90, "b": 92, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 90, "b": 124, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 91, "b": 92, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 91, "b": 108, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 91, "b": 109, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 92, "b": 108, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 91, "b": 93, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 91, "b": 125, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 92, "b": 93, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 92, "b": 109, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 92, "b": 110, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 93, "b": 109, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 92, "b": 94, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 92, "b": 126, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 93, "b": 94, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 93, "b": 110, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 93, "b": 111, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 94, "b": 110, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 93, "b": 95, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 93, "b": 127, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 94, "b": 95, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 94, "b": 111, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 94, "b": 112, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 95, "b": 111, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 94, "b": 96, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 94, "b": 128, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 95, "b": 96, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 95, "b": 112, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 95, "b": 113, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 96, "b": 112, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 95, "b": 97, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 95, "b": 129, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 96, "b": 97, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 96, "b": 113, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 96, "b": 114, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 97, "b": 113, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 96, "b": 98, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 96, "b": 130, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 97, "b": 98, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 97, "b": 114, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 97, "b": 115, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 98, "b": 114, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 97, "b": 99, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 97, "b": 131, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 98, "b": 99, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 98, "b": 115, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 98, "b": 116, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 99, "b": 115, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 98, "b": 100, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 98, "b": 132, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 99, "b": 100, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 99, "b": 116, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 99, "b": 117, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 100, "b": 116, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 99, "b": 101, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 99, "b": 133, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 100, "b": 101, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 100, "b": 117, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 100, "b": 118, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 101, "b": 117, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 100, "b": 134, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 101, "b": 118, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 101, "b": 135, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 102, "b": 103, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 102, "b": 119, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 102, "b": 120, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 103, "b": 119, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 102, "b": 104, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 102, "b": 136, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 103, "b": 104, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 103, "b": 120, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 103, "b": 121, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 104, "b": 120, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 103, "b": 105, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 103, "b": 137, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 104, "b": 105, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 104, "b": 121, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 104, "b": 122, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 105, "b": 121, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 104, "b": 106, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 104, "b": 138, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 105, "b": 106, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 105, "b": 122, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 105, "b": 123, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 106, "b": 122, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 105, "b": 107, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 105, "b": 139, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 106, "b": 107, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 106, "b": 123, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 106, "b": 124, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 107, "b": 123, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 106, "b": 108, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 106, "b": 140, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 107, "b": 108, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 107, "b": 124, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 107, "b": 125, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 108, "b": 124, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 107, "b": 109, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 107, "b": 141, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 108, "b": 109, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 108, "b": 125, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 108, "b": 126, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 109, "b": 125, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 108, "b": 110, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 108, "b": 142, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 109, "b": 110, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 109, "b": 126, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 109, "b": 127, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 110, "b": 126, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 109, "b": 111, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 109, "b": 143, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 110, "b": 111, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 110, "b": 127, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 110, "b": 128, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 111, "b": 127, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 110, "b": 112, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 110, "b": 144, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 111, "b": 112, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 111, "b": 128, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 111, "b": 129, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 112, "b": 128, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 111, "b": 113, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 111, "b": 145, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 112, "b": 113, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 112, "b": 129, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 112, "b": 130, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 113, "b": 129, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 112, "b": 114, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 112, "b": 146, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 113, "b": 114, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 113, "b": 130, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 113, "b": 131, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 114, "b": 130, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 113, "b": 115, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 113, "b": 147, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 114, "b": 115, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 114, "b": 131, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 114, "b": 132, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 115, "b": 131, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 114, "b": 116, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 114, "b": 148, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 115, "b": 116, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 115, "b": 132, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 115, "b": 133, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 116, "b": 132, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 115, "b": 117, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 115, "b": 149, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 116, "b": 117, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 116, "b": 133, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 116, "b": 134, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 117, "b": 133, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 116, "b": 118, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 116, "b": 150, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 117, "b": 118, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 117, "b": 134, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 117, "b": 135, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 118, "b": 134, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 117, "b": 151, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 118, "b": 135, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 118, "b": 152, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 119, "b": 120, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 119, "b": 136, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 119, "b": 137, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 120, "b": 136, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 119, "b": 121, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 119, "b": 153, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 120, "b": 121, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 120, "b": 137, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 120, "b": 138, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 121, "b": 137, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 120, "b": 122, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 120, "b": 154, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 121, "b": 122, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 121, "b": 138, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 121, "b": 139, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 122, "b": 138, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 121, "b": 123, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 121, "b": 155, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 122, "b": 123, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 122, "b": 139, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 122, "b": 140, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 123, "b": 139, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 122, "b": 124, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 122, "b": 156, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 123, "b": 124, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 123, "b": 140, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 123, "b": 141, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 124, "b": 140, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 123, "b": 125, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 123, "b": 157, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 124, "b": 125, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 124, "b": 141, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 124, "b": 142, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 125, "b": 141, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 124, "b": 126, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 124, "b": 158, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 125, "b": 126, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 125, "b": 142, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 125, "b": 143, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 126, "b": 142, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 125, "b": 127, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 125, "b": 159, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 126, "b": 127, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 126, "b": 143, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 126, "b": 144, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 127, "b": 143, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 126, "b": 128, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 126, "b": 160, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 127, "b": 128, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 127, "b": 144, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 127, "b": 145, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 128, "b": 144, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 127, "b": 129, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 127, "b": 161, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 128, "b": 129, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 128, "b": 145, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 128, "b": 146, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 129, "b": 145, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 128, "b": 130, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 128, "b": 162, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 129, "b": 130, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 129, "b": 146, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 129, "b": 147, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 130, "b": 146, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 129, "b": 131, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 129, "b": 163, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 130, "b": 131, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 130, "b": 147, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 130, "b": 148, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 131, "b": 147, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 130, "b": 132, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 130, "b": 164, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 131, "b": 132, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 131, "b": 148, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 131, "b": 149, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 132, "b": 148, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 131, "b": 133, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 131, "b": 165, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 132, "b": 133, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 132, "b": 149, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 132, "b": 150, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 133, "b": 149, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 132, "b": 134, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 132, "b": 166, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 133, "b": 134, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 133, "b": 150, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 133, "b": 151, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 134, "b": 150, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 133, "b": 135, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 133, "b": 167, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 134, "b": 135, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 134, "b": 151, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 134, "b": 152, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 135, "b": 151, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 134, "b": 168, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 135, "b": 152, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 135, "b": 169, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 136, "b": 137, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 136, "b": 153, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 136, "b": 154, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 137, "b": 153, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 136, "b": 138, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 136, "b": 170, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 137, "b": 138, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 137, "b": 154, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 137, "b": 155, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 138, "b": 154, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 137, "b": 139, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 137, "b": 171, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 138, "b": 139, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 138, "b": 155, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 138, "b": 156, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 139, "b": 155, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 138, "b": 140, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 138, "b": 172, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 139, "b": 140, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 139, "b": 156, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 139, "b": 157, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 140, "b": 156, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 139, "b": 141, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 139, "b": 173, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 140, "b": 141, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 140, "b": 157, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 140, "b": 158, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 141, "b": 157, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 140, "b": 142, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 140, "b": 174, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 141, "b": 142, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 141, "b": 158, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 141, "b": 159, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 142, "b": 158, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 141, "b": 143, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 141, "b": 175, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 142, "b": 143, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 142, "b": 159, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 142, "b": 160, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 143, "b": 159, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 142, "b": 144, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 142, "b": 176, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 143, "b": 144, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 143, "b": 160, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 143, "b": 161, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 144, "b": 160, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 143, "b": 145, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 143, "b": 177, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 144, "b": 145, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 144, "b": 161, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 144, "b": 162, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 145, "b": 161, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 144, "b": 146, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 144, "b": 178, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 145, "b": 146, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 145, "b": 162, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 145, "b": 163, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 146, "b": 162, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 145, "b": 147, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 145, "b": 179, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 146, "b": 147, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 146, "b": 163, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 146, "b": 164, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 147, "b": 163, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 146, "b": 148, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 146, "b": 180, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 147, "b": 148, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 147, "b": 164, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 147, "b": 165, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 148, "b": 164, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 147, "b": 149, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 147, "b": 181, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 148, "b": 149, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 148, "b": 165, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 148, "b": 166, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 149, "b": 165, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 148, "b": 150, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 148, "b": 182, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 149, "b": 150, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 149, "b": 166, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 149, "b": 167, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 150, "b": 166, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 149, "b": 151, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 149, "b": 183, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 150, "b": 151, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 150, "b": 167, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 150, "b": 168, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 151, "b": 167, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 150, "b": 152, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 150, "b": 184, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 151, "b": 152, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 151, "b": 168, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 151, "b": 169, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 152, "b": 168, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 151, "b": 185, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 152, "b": 169, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 152, "b": 186, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 153, "b": 154, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 153, "b": 170, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 153, "b": 171, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 154, "b": 170, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 153, "b": 155, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 153, "b": 187, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 154, "b": 155, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 154, "b": 171, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 154, "b": 172, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 155, "b": 171, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 154, "b": 156, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 154, "b": 188, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 155, "b": 156, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 155, "b": 172, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 155, "b": 173, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 156, "b": 172, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 155, "b": 157, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 155, "b": 189, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 156, "b": 157, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 156, "b": 173, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 156, "b": 174, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 157, "b": 173, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 156, "b": 158, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 156, "b": 190, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 157, "b": 158, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 157, "b": 174, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 157, "b": 175, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 158, "b": 174, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 157, "b": 159, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 157, "b": 191, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 158, "b": 159, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 158, "b": 175, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 158, "b": 176, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 159, "b": 175, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 158, "b": 160, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 158, "b": 192, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 159, "b": 160, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 159, "b": 176, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 159, "b": 177, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 160, "b": 176, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 159, "b": 161, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 159, "b": 193, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 160, "b": 161, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 160, "b": 177, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 160, "b": 178, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 161, "b": 177, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 160, "b": 162, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 160, "b": 194, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 161, "b": 162, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 161, "b": 178, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 161, "b": 179, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 162, "b": 178, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 161, "b": 163, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 161, "b": 195, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 162, "b": 163, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 162, "b": 179, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 162, "b": 180, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 163, "b": 179, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 162, "b": 164, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 162, "b": 196, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 163, "b": 164, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 163, "b": 180, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 163, "b": 181, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 164, "b": 180, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 163, "b": 165, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 163, "b": 197, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 164, "b": 165, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 164, "b": 181, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 164, "b": 182, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 165, "b": 181, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 164, "b": 166, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 164, "b": 198, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 165, "b": 166, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 165, "b": 182, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 165, "b": 183, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 166, "b": 182, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 165, "b": 167, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 165, "b": 199, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 166, "b": 167, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 166, "b": 183, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 166, "b": 184, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 167, "b": 183, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 166, "b": 168, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 166, "b": 200, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 167, "b": 168, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 167, "b": 184, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 167, "b": 185, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 168, "b": 184, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 167, "b": 169, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 167, "b": 201, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 168, "b": 169, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 168, "b": 185, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 168, "b": 186, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 169, "b": 185, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 168, "b": 202, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 169, "b": 186, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 169, "b": 203, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 170, "b": 171, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 170, "b": 187, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 170, "b": 188, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 171, "b": 187, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 170, "b": 172, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 170, "b": 204, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 171, "b": 172, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 171, "b": 188, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 171, "b": 189, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 172, "b": 188, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 171, "b": 173, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 171, "b": 205, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 172, "b": 173, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 172, "b": 189, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 172, "b": 190, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 173, "b": 189, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 172, "b": 174, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 172, "b": 206, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 173, "b": 174, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 173, "b": 190, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 173, "b": 191, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 174, "b": 190, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 173, "b": 175, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 173, "b": 207, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 174, "b": 175, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 174, "b": 191, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 174, "b": 192, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 175, "b": 191, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 174, "b": 176, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 174, "b": 208, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 175, "b": 176, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 175, "b": 192, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 175, "b": 193, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 176, "b": 192, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 175, "b": 177, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 175, "b": 209, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 176, "b": 177, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 176, "b": 193, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 176, "b": 194, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 177, "b": 193, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 176, "b": 178, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 176, "b": 210, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 177, "b": 178, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 177, "b": 194, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 177, "b": 195, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 178, "b": 194, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 177, "b": 179, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 177, "b": 211, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 178, "b": 179, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 178, "b": 195, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 178, "b": 196, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 179, "b": 195, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 178, "b": 180, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 178, "b": 212, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 179, "b": 180, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 179, "b": 196, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 179, "b": 197, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 180, "b": 196, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 179, "b": 181, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 179, "b": 213, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 180, "b": 181, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 180, "b": 197, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 180, "b": 198, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 181, "b": 197, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 180, "b": 182, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 180, "b": 214, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 181, "b": 182, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 181, "b": 198, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 181, "b": 199, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 182, "b": 198, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 181, "b": 183, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 181, "b": 215, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 182, "b": 183, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 182, "b": 199, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 182, "b": 200, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 183, "b": 199, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 182, "b": 184, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 182, "b": 216, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 183, "b": 184, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 183, "b": 200, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 183, "b": 201, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 184, "b": 200, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 183, "b": 185, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 183, "b": 217, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 184, "b": 185, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 184, "b": 201, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 184, "b": 202, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 185, "b": 201, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 184, "b": 186, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 184, "b": 218, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 185, "b": 186, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 185, "b": 202, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 185, "b": 203, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 186, "b": 202, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 185, "b": 219, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 186, "b": 203, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 186, "b": 220, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 187, "b": 188, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 187, "b": 204, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 187, "b": 205, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 188, "b": 204, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 187, "b": 189, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 187, "b": 221, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 188, "b": 189, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 188, "b": 205, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 188, "b": 206, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 189, "b": 205, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 188, "b": 190, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 188, "b": 222, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 189, "b": 190, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 189, "b": 206, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 189, "b": 207, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 190, "b": 206, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 189, "b": 191, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 189, "b": 223, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 190, "b": 191, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 190, "b": 207, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 190, "b": 208, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 191, "b": 207, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 190, "b": 192, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 190, "b": 224, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 191, "b": 192, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 191, "b": 208, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 191, "b": 209, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 192, "b": 208, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 191, "b": 193, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 191, "b": 225, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 192, "b": 193, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 192, "b": 209, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 192, "b": 210, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 193, "b": 209, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 192, "b": 194, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 192, "b": 226, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 193, "b": 194, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 193, "b": 210, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 193, "b": 211, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 194, "b": 210, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 193, "b": 195, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 193, "b": 227, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 194, "b": 195, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 194, "b": 211, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 194, "b": 212, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 195, "b": 211, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 194, "b": 196, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 194, "b": 228, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 195, "b": 196, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 195, "b": 212, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 195, "b": 213, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 196, "b": 212, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 195, "b": 197, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 195, "b": 229, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 196, "b": 197, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 196, "b": 213, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 196, "b": 214, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 197, "b": 213, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 196, "b": 198, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 196, "b": 230, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 197, "b": 198, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 197, "b": 214, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 197, "b": 215, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 198, "b": 214, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 197, "b": 199, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 197, "b": 231, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 198, "b": 199, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 198, "b": 215, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 198, "b": 216, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 199, "b": 215, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 198, "b": 200, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 198, "b": 232, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 199, "b": 200, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 199, "b": 216, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 199, "b": 217, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 200, "b": 216, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 199, "b": 201, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 199, "b": 233, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 200, "b": 201, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 200, "b": 217, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 200, "b": 218, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 201, "b": 217, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 200, "b": 202, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 200, "b": 234, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 201, "b": 202, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 201, "b": 218, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 201, "b": 219, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 202, "b": 218, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 201, "b": 203, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 201, "b": 235, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 202, "b": 203, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 202, "b": 219, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 202, "b": 220, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 203, "b": 219, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 202, "b": 236, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 203, "b": 220, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 203, "b": 237, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 204, "b": 205, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 204, "b": 221, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 204, "b": 222, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 205, "b": 221, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 204, "b": 206, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 204, "b": 238, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 205, "b": 206, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 205, "b": 222, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 205, "b": 223, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 206, "b": 222, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 205, "b": 207, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 205, "b": 239, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 206, "b": 207, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 206, "b": 223, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 206, "b": 224, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 207, "b": 223, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 206, "b": 208, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 206, "b": 240, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 207, "b": 208, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 207, "b": 224, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 207, "b": 225, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 208, "b": 224, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 207, "b": 209, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 207, "b": 241, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 208, "b": 209, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 208, "b": 225, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 208, "b": 226, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 209, "b": 225, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 208, "b": 210, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 208, "b": 242, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 209, "b": 210, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 209, "b": 226, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 209, "b": 227, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 210, "b": 226, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 209, "b": 211, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 209, "b": 243, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 210, "b": 211, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 210, "b": 227, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 210, "b": 228, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 211, "b": 227, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 210, "b": 212, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 210, "b": 244, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 211, "b": 212, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 211, "b": 228, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 211, "b": 229, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 212, "b": 228, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 211, "b": 213, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 211, "b": 245, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 212, "b": 213, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 212, "b": 229, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 212, "b": 230, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 213, "b": 229, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 212, "b": 214, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 212, "b": 246, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 213, "b": 214, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 213, "b": 230, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 213, "b": 231, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 214, "b": 230, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 213, "b": 215, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 213, "b": 247, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 214, "b": 215, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 214, "b": 231, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 214, "b": 232, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 215, "b": 231, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 214, "b": 216, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 214, "b": 248, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 215, "b": 216, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 215, "b": 232, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 215, "b": 233, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 216, "b": 232, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 215, "b": 217, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 215, "b": 249, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 216, "b": 217, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 216, "b": 233, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 216, "b": 234, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 217, "b": 233, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 216, "b": 218, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 216, "b": 250, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 217, "b": 218, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 217, "b": 234, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 217, "b": 235, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 218, "b": 234, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 217, "b": 219, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 217, "b": 251, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 218, "b": 219, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 218, "b": 235, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 218, "b": 236, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 219, "b": 235, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 218, "b": 220, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 218, "b": 252, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 219, "b": 220, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 219, "b": 236, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 219, "b": 237, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 220, "b": 236, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 219, "b": 253, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 220, "b": 237, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 220, "b": 254, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 221, "b": 222, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 221, "b": 238, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 221, "b": 239, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 222, "b": 238, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 221, "b": 223, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 221, "b": 255, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 222, "b": 223, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 222, "b": 239, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 222, "b": 240, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 223, "b": 239, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 222, "b": 224, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 222, "b": 256, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 223, "b": 224, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 223, "b": 240, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 223, "b": 241, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 224, "b": 240, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 223, "b": 225, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 223, "b": 257, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 224, "b": 225, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 224, "b": 241, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 224, "b": 242, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 225, "b": 241, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 224, "b": 226, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 224, "b": 258, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 225, "b": 226, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 225, "b": 242, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 225, "b": 243, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 226, "b": 242, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 225, "b": 227, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 225, "b": 259, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 226, "b": 227, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 226, "b": 243, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 226, "b": 244, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 227, "b": 243, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 226, "b": 228, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 226, "b": 260, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 227, "b": 228, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 227, "b": 244, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 227, "b": 245, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 228, "b": 244, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 227, "b": 229, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 227, "b": 261, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 228, "b": 229, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 228, "b": 245, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 228, "b": 246, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 229, "b": 245, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 228, "b": 230, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 228, "b": 262, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 229, "b": 230, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 229, "b": 246, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 229, "b": 247, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 230, "b": 246, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 229, "b": 231, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 229, "b": 263, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 230, "b": 231, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 230, "b": 247, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 230, "b": 248, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 231, "b": 247, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 230, "b": 232, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 230, "b": 264, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 231, "b": 232, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 231, "b": 248, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 231, "b": 249, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 232, "b": 248, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 231, "b": 233, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 231, "b": 265, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 232, "b": 233, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 232, "b": 249, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 232, "b": 250, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 233, "b": 249, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 232, "b": 234, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 232, "b": 266, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 233, "b": 234, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 233, "b": 250, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 233, "b": 251, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 234, "b": 250, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 233, "b": 235, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 233, "b": 267, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 234, "b": 235, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 234, "b": 251, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 234, "b": 252, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 235, "b": 251, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 234, "b": 236, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 234, "b": 268, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 235, "b": 236, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 235, "b": 252, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 235, "b": 253, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 236, "b": 252, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 235, "b": 237, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 235, "b": 269, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 236, "b": 237, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 236, "b": 253, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 236, "b": 254, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 237, "b": 253, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 236, "b": 270, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 237, "b": 254, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 237, "b": 271, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 238, "b": 239, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 238, "b": 255, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 238, "b": 256, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 239, "b": 255, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 238, "b": 240, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 238, "b": 272, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 239, "b": 240, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 239, "b": 256, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 239, "b": 257, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 240, "b": 256, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 239, "b": 241, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 239, "b": 273, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 240, "b": 241, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 240, "b": 257, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 240, "b": 258, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 241, "b": 257, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 240, "b": 242, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 240, "b": 274, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 241, "b": 242, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 241, "b": 258, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 241, "b": 259, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 242, "b": 258, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 241, "b": 243, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 241, "b": 275, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 242, "b": 243, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 242, "b": 259, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 242, "b": 260, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 243, "b": 259, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 242, "b": 244, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 242, "b": 276, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 243, "b": 244, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 243, "b": 260, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 243, "b": 261, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 244, "b": 260, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 243, "b": 245, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 243, "b": 277, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 244, "b": 245, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 244, "b": 261, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 244, "b": 262, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 245, "b": 261, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 244, "b": 246, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 244, "b": 278, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 245, "b": 246, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 245, "b": 262, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 245, "b": 263, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 246, "b": 262, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 245, "b": 247, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 245, "b": 279, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 246, "b": 247, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 246, "b": 263, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 246, "b": 264, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 247, "b": 263, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 246, "b": 248, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 246, "b": 280, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 247, "b": 248, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 247, "b": 264, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 247, "b": 265, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 248, "b": 264, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 247, "b": 249, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 247, "b": 281, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 248, "b": 249, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 248, "b": 265, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 248, "b": 266, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 249, "b": 265, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 248, "b": 250, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 248, "b": 282, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 249, "b": 250, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 249, "b": 266, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 249, "b": 267, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 250, "b": 266, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 249, "b": 251, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 249, "b": 283, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 250, "b": 251, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 250, "b": 267, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 250, "b": 268, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 251, "b": 267, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 250, "b": 252, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 250, "b": 284, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 251, "b": 252, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 251, "b": 268, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 251, "b": 269, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 252, "b": 268, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 251, "b": 253, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 251, "b": 285, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 252, "b": 253, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 252, "b": 269, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 252, "b": 270, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 253, "b": 269, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 252, "b": 254, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 252, "b": 286, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 253, "b": 254, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 253, "b": 270, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 253, "b": 271, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 254, "b": 270, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 253, "b": 287, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 254, "b": 271, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 254, "b": 288, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 255, "b": 256, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 255, "b": 272, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 255, "b": 273, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 256, "b": 272, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 255, "b": 257, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 256, "b": 257, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 256, "b": 273, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 256, "b": 274, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 257, "b": 273, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 256, "b": 258, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 257, "b": 258, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 257, "b": 274, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 257, "b": 275, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 258, "b": 274, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 257, "b": 259, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 258, "b": 259, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 258, "b": 275, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 258, "b": 276, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 259, "b": 275, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 258, "b": 260, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 259, "b": 260, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 259, "b": 276, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 259, "b": 277, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 260, "b": 276, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 259, "b": 261, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 260, "b": 261, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 260, "b": 277, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 260, "b": 278, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 261, "b": 277, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 260, "b": 262, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 261, "b": 262, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 261, "b": 278, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 261, "b": 279, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 262, "b": 278, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 261, "b": 263, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 262, "b": 263, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 262, "b": 279, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 262, "b": 280, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 263, "b": 279, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 262, "b": 264, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 263, "b": 264, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 263, "b": 280, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 263, "b": 281, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 264, "b": 280, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 263, "b": 265, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 264, "b": 265, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 264, "b": 281, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 264, "b": 282, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 265, "b": 281, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 264, "b": 266, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 265, "b": 266, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 265, "b": 282, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 265, "b": 283, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 266, "b": 282, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 265, "b": 267, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 266, "b": 267, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 266, "b": 283, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 266, "b": 284, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 267, "b": 283, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 266, "b": 268, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 267, "b": 268, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 267, "b": 284, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 267, "b": 285, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 268, "b": 284, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 267, "b": 269, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 268, "b": 269, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 268, "b": 285, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 268, "b": 286, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 269, "b": 285, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 268, "b": 270, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 269, "b": 270, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 269, "b": 286, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 269, "b": 287, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 270, "b": 286, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 269, "b": 271, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 270, "b": 271, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 270, "b": 287, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 270, "b": 288, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 271, "b": 287, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 271, "b": 288, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 272, "b": 273, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 272, "b": 274, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 273, "b": 274, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 273, "b": 275, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 274, "b": 275, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 274, "b": 276, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 275, "b": 276, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 275, "b": 277, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 276, "b": 277, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 276, "b": 278, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 277, "b": 278, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 277, "b": 279, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 278, "b": 279, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 278, "b": 280, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 279, "b": 280, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 279, "b": 281, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 280, "b": 281, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 280, "b": 282, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 281, "b": 282, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 281, "b": 283, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 282, "b": 283, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 282, "b": 284, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 283, "b": 284, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 283, "b": 285, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 284, "b": 285, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 284, "b": 286, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 285, "b": 286, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 285, "b": 287, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 286, "b": 287, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 286, "b": 288, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 287, "b": 288, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }], "staticColliderIds": ["p5SphereCollider"] });

// src/domain/admission.ts
var PROFILES = [
  "cloth-pinned-sphere-visual-v1",
  "fluid-basin-visual-v1",
  "fluid-basin-xsph-visual-v1",
  "fluid-static-box-visual-v1"
];
var CLOTH_FIELDS = [
  "id",
  "restPositionsM",
  "initialPositionsM",
  "initialVelocitiesMps",
  "vertexMassesKg",
  "triangles",
  "pinnedVertexIndices",
  "constraints",
  "staticColliderIds"
];
var FLUID_FIELDS = [
  "id",
  "initialPositionsM",
  "initialVelocitiesMps",
  "massModel",
  "particleRadiusM",
  "smoothingRadiusM",
  "staticColliderIds",
  "visualSmoothing"
];
function check(value, message) {
  if (!value) error("INVALID_CONFIG", message);
}
function exact(value, keys, label) {
  check(value !== null && typeof value === "object" && !Array.isArray(value), `${label} requires a record`);
  const input = value;
  check(Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key)), `${label} requires exact fields`);
  return input;
}
function array(value, count, label) {
  check(Array.isArray(value) && value.length === count, `${label} requires exactly ${count} entries`);
  return value;
}
function triple(value, label) {
  const result = array(value, 3, label);
  result.forEach((part, index) => finite(part, -1e4, 1e4, `${label}[${index}]`));
  return result;
}
function same(value, expected, label) {
  if (typeof expected !== "object" || expected === null) {
    check(Object.is(value, expected), `${label} differs from the fixed native profile`);
    return;
  }
  if (Array.isArray(expected)) {
    array(value, expected.length, label).forEach((item, index) => same(item, expected[index], `${label}[${index}]`));
    return;
  }
  const reference = expected, input = exact(value, Object.keys(reference), label);
  for (const key of Object.keys(reference)) same(input[key], reference[key], `${label}.${key}`);
}
function transform(value, label, local = false) {
  const input = exact(value, ["positionM", "orientationXYZW"], label);
  triple(input.positionM, `${label}.positionM`);
  same(input.orientationXYZW, [0, 0, 0, 1], `${label}.orientationXYZW`);
  if (local) same(input.positionM, [0, 0, 0], `${label}.positionM`);
  return input;
}
function admitDomainModel(model, options) {
  if (!PROFILES.includes(options.profile)) return null;
  const profile = options.profile;
  check(options.broadPhase === "domain-fixed" && Object.is(options.fixedStepSeconds, CLOTH_STEP_SECONDS), "Unsupported domain options");
  same(model.gravityMps2, CLOTH_PROFILE.gravityMps2, "gravityMps2");
  const clothProfile = profile === "cloth-pinned-sphere-visual-v1";
  const boxProfile = profile === "fluid-static-box-visual-v1";
  const count = boxProfile ? 2 : 1;
  const bodyInputs = array(model.bodies, count, "bodies");
  const colliderInputs = array(model.colliders, count, "colliders");
  array(model.joints, 0, "joints");
  const clothInputs = array(model.cloths, clothProfile ? 1 : 0, "cloths");
  const fluidInputs = array(model.fluids, clothProfile ? 0 : 1, "fluids");
  check(Array.isArray(model.sourceBindings) && model.sourceBindings.length <= 128, "Unsupported source binding population");
  const ids = /* @__PURE__ */ new Set();
  function id(value) {
    check(typeof value === "string" && ID.test(value) && !ids.has(value), "Invalid or duplicate global entity ID");
    ids.add(value);
    return value;
  }
  const bodies = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const body = exact(value, ["id", "kind", "initial"], "static body");
    const bodyId = id(body.id);
    check(body.kind === "static", "Domain owners must be static");
    transform(body.initial, "static initial");
    bodies.set(bodyId, body);
  }
  const colliders = /* @__PURE__ */ new Map();
  const owners = /* @__PURE__ */ new Set();
  for (const value of colliderInputs) {
    const collider = exact(value, ["id", "bodyId", "geometry", "local", "material", "sensor", "ccd", "filter"], "collider");
    const colliderId = id(collider.id);
    check(typeof collider.bodyId === "string" && bodies.has(collider.bodyId) && !owners.has(collider.bodyId), "Collider requires one declared static owner");
    owners.add(collider.bodyId);
    const geometry = exact(collider.geometry, collider.geometry?.kind === "sphere" ? ["kind", "radiusM"] : ["kind", "halfExtentsM"], "geometry");
    if (geometry.kind === "sphere") finite(geometry.radiusM, 1e-4, 1e3, "radiusM");
    else {
      check(geometry.kind === "box" || geometry.kind === "box-interior", "Unsupported domain geometry");
      array(geometry.halfExtentsM, 3, "halfExtentsM").forEach((value2) => finite(value2, 1e-4, 1e3, "halfExtentsM"));
    }
    transform(collider.local, "collider.local", true);
    const material = exact(collider.material, ["restitution", "friction"], "material");
    same(material.restitution, 0, "restitution");
    same(material.friction, { static: 0, dynamic: 0 }, "friction");
    same(collider.sensor, false, "sensor");
    same(collider.ccd, false, "ccd");
    same(collider.filter, { categoryBits: 1, maskBits: 65535 }, "filter");
    colliders.set(colliderId, collider);
  }
  check(owners.size === bodies.size, "Every static owner requires one collider");
  const data = clothProfile ? exact(clothInputs[0], CLOTH_FIELDS, "cloth") : exact(fluidInputs[0], FLUID_FIELDS, "fluid");
  id(data.id);
  const refs = array(data.staticColliderIds, count, "staticColliderIds");
  check(new Set(refs).size === refs.length && refs.every((ref) => typeof ref === "string" && colliders.has(ref)), "Invalid domain collider references");
  const numericalIds = new Set(ids);
  for (const value of model.sourceBindings) {
    const binding = exact(value, ["id", "sourceRevision", "sourceDigest", "modelId", "occurrenceId", "entityIds", "approximation"], "sourceBinding");
    id(binding.id);
    for (const key of ["sourceRevision", "modelId", "occurrenceId"]) check(typeof binding[key] === "string" && binding[key].length > 0 && binding[key].length <= 4096, `Invalid ${key}`);
    check(typeof binding.sourceDigest === "string" && /^sha256:[0-9a-f]{64}$/.test(binding.sourceDigest), "Invalid source digest");
    check(Array.isArray(binding.entityIds) && binding.entityIds.length > 0 && binding.entityIds.length <= 128 && new Set(binding.entityIds).size === binding.entityIds.length && binding.entityIds.every((ref) => typeof ref === "string" && numericalIds.has(ref)), "Invalid source binding references");
    const approximation = exact(binding.approximation, ["kind", "lossLabel"], "approximation");
    check(approximation.kind === "control-net-box" || approximation.kind === "control-net-sphere", "Unsupported approximation");
    check(typeof approximation.lossLabel === "string" && approximation.lossLabel.length > 0 && approximation.lossLabel.length <= 4096, "Invalid loss label");
  }
  const staticData = { profile, gravityMps2: model.gravityMps2, bodies: model.bodies, colliders: model.colliders };
  if (clothProfile) {
    for (const key of CLOTH_FIELDS) if (key !== "id" && key !== "staticColliderIds") same(data[key], nativeClothReference[key], `cloth.${key}`);
    const collider = colliderInputs[0], body = bodies.get(collider.bodyId);
    same(collider.geometry, { kind: "sphere", radiusM: CLOTH_PROFILE.sphereRadiusM }, "cloth sphere");
    same(body.initial.positionM, CLOTH_PROFILE.sphereCentreM, "cloth sphere position");
    return { kind: "cloth", data: model.cloths[0], staticData };
  }
  same(data.massModel, { kind: "visual-unit-weights" }, "massModel");
  same(data.particleRadiusM, FLUID_PARTICLE_RADIUS_M, "particleRadiusM");
  same(data.smoothingRadiusM, FLUID_SMOOTHING_RADIUS_M, "smoothingRadiusM");
  same(data.visualSmoothing, profile === "fluid-basin-xsph-visual-v1" ? { kind: "xsph", coefficient: 0.15 } : { kind: "none" }, "visualSmoothing");
  const points = array(data.initialPositionsM, 256, "initialPositionsM").map((point, index) => triple(point, `initialPositionsM[${index}]`));
  array(data.initialVelocitiesMps, 256, "initialVelocitiesMps").forEach((velocity, index) => same(velocity, [0, 0, 0], `initialVelocitiesMps[${index}]`));
  for (const point of points) for (let axis = 0; axis < 3; axis++) check(point[axis] >= FLUID_PARTICLE_RADIUS_M && point[axis] <= FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M, "Initial particle is outside the basin");
  const minimumSquared = FLUID_MIN_SPACING_M ** 2;
  for (let first = 0; first < 256; first++) for (let second = first + 1; second < 256; second++) {
    const dx = points[first][0] - points[second][0], dy = points[first][1] - points[second][1], dz = points[first][2] - points[second][2];
    check(!(dx * dx + dy * dy + dz * dz < minimumSquared - 1e-12), "Initial particles must be at least 0.025 m apart");
  }
  const basin = colliderInputs.find((value) => value.geometry.kind === "box-interior");
  check(basin, "Fluid requires one basin");
  const basinHalf = FLUID_BASIN_M.map((value) => value / 2);
  same(basin.geometry.halfExtentsM, basinHalf, "basin half extents");
  same(bodies.get(basin.bodyId).initial.positionM, basinHalf, "basin position");
  if (boxProfile) {
    const box = colliderInputs.find((value) => value.geometry.kind === "box");
    check(box, "Static fluid profile requires one box");
    const body = bodies.get(box.bodyId);
    const bounds = inflatedBoxBounds(
      body.initial.positionM,
      box.geometry.halfExtentsM
    );
    for (let axis = 0; axis < 3; axis++) check(bounds.low[axis] >= FLUID_PARTICLE_RADIUS_M && bounds.high[axis] <= FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M, "Static box exceeds the basin");
    const overlapScratch = Float64Array.from(points.flat());
    check(!insideStaticBox(overlapScratch, bounds), "Static box overlaps initial particles");
  } else check(colliderInputs.length === 1, "Unsupported fluid collider population");
  return { kind: "fluid", data: model.fluids[0], staticData };
}

// src/model-admission.ts
function exact2(value, keys, label) {
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
function transform2(value, label) {
  const t = exact2(value, ["positionM", "orientationXYZW"], label);
  vector(t.positionM, -1e4, 1e4, `${label}.positionM`);
  if (!Array.isArray(t.orientationXYZW) || t.orientationXYZW.length !== 4) error("INVALID_CONFIG", `${label} requires an XYZW quaternion`);
  const q = t.orientationXYZW.map((x) => finite(x, -1, 1, label));
  if (Math.abs(Math.hypot(...q) - 1) > 1e-6) error("INVALID_CONFIG", `${label} quaternion must have unit norm`);
}
function admitModel(rawModel, rawOptions) {
  const model = copyData(rawModel);
  const options = copyData(rawOptions);
  const input = exact2(model, ["format", "version", "revision", "frame", "units", "gravityMps2", "bodies", "colliders", "joints", "cloths", "fluids", "sourceBindings"], "model");
  if (input.format !== "barocss-physics-model" || input.version !== 1) error("INVALID_CONFIG", "unsupported model format or version");
  text(input.revision, "revision");
  const frame = exact2(input.frame, ["id", "basis", "rotation"], "frame");
  text(frame.id, "frame.id");
  if (frame.basis !== "right-handed-xyz" || frame.rotation !== "local-to-world-xyzw") error("INVALID_CONFIG", "unsupported frame convention");
  const units = exact2(input.units, ["length", "mass", "time", "angle"], "units");
  if (units.length !== "m" || units.mass !== "kg" || units.time !== "s" || units.angle !== "rad") error("INVALID_CONFIG", "model units must be m/kg/s/rad");
  vector(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const opt = exact2(options, ["profile", "fixedStepSeconds", "broadPhase"], "options");
  const domain = admitDomainModel(model, options);
  if (domain) return { model, options, bodies: [], joints: [], disjointHinges: null, domain };
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
  const ids = /* @__PURE__ */ new Set();
  function id(value) {
    if (typeof value !== "string" || !ID.test(value) || ids.has(value)) error("INVALID_CONFIG", "invalid or duplicate global entity ID");
    ids.add(value);
    return value;
  }
  const bodiesById = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const raw = value;
    const b = exact2(value, raw?.kind === "dynamic" ? ["id", "kind", "massKg", "inertia", "initial"] : ["id", "kind", "initial"], "body");
    const bodyId = id(b.id);
    if (!["dynamic", "static", "kinematic"].includes(b.kind)) error("INVALID_CONFIG", "unsupported body kind");
    if (b.kind === "dynamic") {
      const initial = exact2(b.initial, ["positionM", "orientationXYZW", "velocityMps", "angularVelocityRadps"], "initial");
      transform2({ positionM: initial.positionM, orientationXYZW: initial.orientationXYZW }, "initial");
      vector(initial.velocityMps, -1e3, 1e3, "velocityMps");
      vector(initial.angularVelocityRadps, -1e3, 1e3, "angularVelocityRadps");
      finite(b.massKg, 1e-6, 1e6, "massKg");
      const i = b.inertia;
      exact2(i, i?.kind === "sphere-isotropic" ? ["kind", "about", "frame", "kgM2"] : ["kind", "about", "frame"], "inertia");
      if (i.about !== "com" || i.frame !== "body-local" || !["primitive-com", "sphere-isotropic"].includes(i.kind)) error("INVALID_CONFIG", "unsupported inertia");
      if (i.kind === "sphere-isotropic") finite(i.kgM2, 1e-12, 1e12, "inertia.kgM2");
    } else transform2(b.initial, "initial");
    bodiesById.set(bodyId, b);
  }
  const colliderByBody = /* @__PURE__ */ new Map();
  for (const value of colliders) {
    const c = exact2(value, ["id", "bodyId", "geometry", "local", "material", "sensor", "ccd", "filter"], "collider");
    id(c.id);
    if (typeof c.bodyId !== "string" || !bodiesById.has(c.bodyId) || colliderByBody.has(c.bodyId)) error("INVALID_CONFIG", "collider requires a unique declared owner");
    transform2(c.local, "collider.local");
    const local = c.local;
    if (local.positionM.some((x) => x !== 0) || local.orientationXYZW.some((x, i) => x !== (i === 3 ? 1 : 0))) error("INVALID_CONFIG", "only identity-local colliders are admitted");
    if (typeof c.sensor !== "boolean" || typeof c.ccd !== "boolean") error("INVALID_CONFIG", "sensor and ccd must be explicit booleans");
    const material = exact2(c.material, ["restitution", "friction"], "material");
    exact2(material.friction, ["static", "dynamic"], "friction");
    const filter = exact2(c.filter, ["categoryBits", "maskBits"], "filter");
    if (!large && (filter.categoryBits !== 1 || filter.maskBits !== 65535)) error("INVALID_CONFIG", "non-large profile requires no-filter values");
    const body = bodiesById.get(c.bodyId);
    if (c.sensor && body.kind === "dynamic" || c.ccd && body.kind !== "dynamic") error("INVALID_CONFIG", "unsupported sensor or CCD body role");
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
    const j = exact2(value, raw?.kind === "hinge" ? ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"] : ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM"], "joint");
    id(j.id);
    if (j.kind !== "fixed" && j.kind !== "hinge") error("INVALID_CONFIG", "unsupported joint kind");
    if (j.kind === "hinge" && j.motor !== null) exact2(j.motor, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
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
  const disjoint = parseDisjointHingeProfile(model, options, numericJoints, bodies);
  const joints = disjoint ? disjoint.joints : parseJoints(numericJoints, bodies);
  const numericalIds = new Set(ids);
  for (const value of bindings) {
    const s = exact2(value, ["id", "sourceRevision", "sourceDigest", "modelId", "occurrenceId", "entityIds", "approximation"], "sourceBinding");
    id(s.id);
    for (const key of ["sourceRevision", "modelId", "occurrenceId"]) text(s[key], key);
    if (typeof s.sourceDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(s.sourceDigest)) error("INVALID_CONFIG", "invalid source digest");
    const refs = list(s.entityIds, 128, "entityIds");
    if (refs.length === 0 || new Set(refs).size !== refs.length || refs.some((ref) => typeof ref !== "string" || !numericalIds.has(ref))) error("INVALID_CONFIG", "invalid source binding references");
    const a = exact2(s.approximation, ["kind", "lossLabel"], "approximation");
    if (a.kind !== "control-net-box" && a.kind !== "control-net-sphere") error("INVALID_CONFIG", "unsupported approximation");
    text(a.lossLabel, "lossLabel");
  }
  return { model, options, bodies, joints, disjointHinges: disjoint?.pairs ?? null, domain: null };
}

// src/world.ts
import { recordingWorlds } from "./recording-owner.js";
import { providerManifest } from "./provider-manifest.generated.js";

// src/joint-motor.ts
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

// src/capsule-contact.ts
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

// src/collision.ts
function capsuleCenter(body, point) {
  const half = body.shape.halfLengthM;
  const local = localPoint(body, point);
  return worldPoint(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
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
  const localDirection = rotate2(inverse(body.orientation), direction);
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

// src/contact-manifold.ts
var basis = (body) => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
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
  const selected2 = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, point) => u * point.u + v * point.v > u * best.u + v * best.v ? point : best, candidates[0]));
  const unique = selected2.filter((point, index) => selected2.findIndex((other) => Math.hypot(...sub(point.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first, second) => first.u - second.u || first.v - second.v);
  return unique.map((point, index) => ({ id: `${reference.body.id}:${reference.axis}:${reference.side}:${index}`, pointM: point.pointM }));
}

// src/persistent-box-contact.ts
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

// src/ccd-slab.ts
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

// src/ccd-box.ts
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

// src/ccd.ts
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

// src/ccd-pair.ts
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

// src/broadphase.ts
function bodyBounds(body) {
  const shape2 = body.shape;
  let half;
  if (shape2.kind === "sphere") {
    half = [shape2.radiusM, shape2.radiusM, shape2.radiusM];
  } else if (shape2.kind === "capsule") {
    const axis = rotate2(body.orientation, [0, 1, 0]);
    half = axis.map((value) => shape2.radiusM + shape2.halfLengthM * Math.abs(value));
  } else {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
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

// src/scene-profile.ts
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

// src/sleep.ts
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

// src/disjoint-hinge/measure.ts
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
  const anchorVelocityAMps = add(a.velocityMps, cross(a.angularVelocityRadps, rotate2(a.orientation, joint.anchorALocalM)));
  const anchorVelocityBMps = add(b.velocityMps, cross(b.angularVelocityRadps, rotate2(b.orientation, joint.anchorBLocalM)));
  const axisDeviationRad = Math.max(...bodies.map((body) => {
    const axis = rotate2(body.orientation, [0, 0, 1]);
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
function measurePose(bodies, joint, origin) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], relativeAngleRad = angle(a, b, joint.axisWorld), anchorAM = worldPoint(a, joint.anchorALocalM), anchorBM = worldPoint(b, joint.anchorBLocalM);
  const axisDeviationRad = Math.max(...bodies.map((body) => {
    const axis = rotate2(body.orientation, [0, 0, 1]);
    return Math.atan2(Math.hypot(axis[0], axis[1]), axis[2]);
  }));
  return { relativeAngleRad, anchorAM, anchorBM, anchorGapM: Math.hypot(...sub(anchorBM, anchorAM)), axisDeviationRad, quaternionNormError: Math.max(...bodies.map((b2) => Math.abs(Math.hypot(...b2.orientation) - 1))), limitExcessRad: Math.max(0, joint.limitRad[0] - relativeAngleRad, relativeAngleRad - joint.limitRad[1]), ...momentum(bodies, origin) };
}

// src/disjoint-hinge/errors.ts
var ERRORS = {
  pose: "hinge pose state is invalid",
  result: "hinge projection result is invalid",
  linear: "hinge velocity problem is invalid",
  system: "hinge velocity system is singular or unsafe",
  certificate: "hinge velocity certificate is invalid"
};
var GATE = 1e-10;
function fail(kind) {
  return error("NUMERIC_LIMIT", ERRORS[kind]);
}
function exactFields(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every((k) => typeof k === "string" && keys.includes(k) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), "value"));
}
function dense(value, size2) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === size2 && Reflect.ownKeys(value).length === size2 + 1 && Array.from({ length: size2 }, (_, i) => i).every((i) => Object.hasOwn(value, i) && typeof value[i] === "number" && Number.isFinite(value[i]));
}
function matrix(value, rows, columns) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === rows && Reflect.ownKeys(value).length === rows + 1 && Array.from({ length: rows }, (_, i) => i).every((i) => Object.hasOwn(value, i) && dense(value[i], columns));
}
function finiteData(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return Object.getPrototypeOf(value) === Array.prototype && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => i).every((i) => Object.hasOwn(value, i) && finiteData(value[i]));
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Reflect.ownKeys(value).every((k) => typeof k === "string" && finiteData(value[k]));
}
function readProblem(value) {
  if (!exactFields(value, ["a", "b", "h", "y0", "stopKind", "stopRow"]) || !matrix(value.a, 11, 12) || !dense(value.b, 11) || !dense(value.h, 12) || value.h.some((x) => x <= 0) || !dense(value.y0, 12)) fail("linear");
  if (value.stopKind !== "none" && value.stopKind !== "upper" && value.stopKind !== "lower") fail("linear");
  if (!dense(value.stopRow, value.stopKind === "none" ? 0 : 12)) fail("linear");
  return structuredClone(value);
}

// src/disjoint-hinge/pose.ts
function finiteData2(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(finiteData2);
  if (value && typeof value === "object") return Object.values(value).every(finiteData2);
  return false;
}
function projectCoupledHinge(input) {
  const before = input.bodies.map(copyBody), bodies = input.bodies.map(copyBody), joint = input.pair.joint;
  const origin = [...input.pair.originM], beforeMetric = measurePose(before, joint, origin);
  const targetAngleRad = Math.max(joint.limitRad[0], Math.min(joint.limitRad[1], beforeMetric.relativeAngleRad)), excess = beforeMetric.relativeAngleRad - targetAngleRad;
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], axis = joint.axisWorld, inverseA = dot(axis, inverseInertia(a, axis)), inverseB = dot(axis, inverseInertia(b, axis)), inverseSum = inverseA + inverseB;
  const angleCorrectionsRad = [excess * inverseA / inverseSum, -excess * inverseB / inverseSum];
  a.orientation = advanceOrientation(a.orientation, scale(axis, angleCorrectionsRad[0]), 1);
  b.orientation = advanceOrientation(b.orientation, scale(axis, angleCorrectionsRad[1]), 1);
  const massA = 1 / a.inverseMass, massB = 1 / b.inverseMass, totalMass = massA + massB;
  const center = scale(add(scale(before[joint.aIndex].positionM, massA), scale(before[joint.bIndex].positionM, massB)), 1 / totalMass);
  const offset = sub(rotate2(b.orientation, joint.anchorBLocalM), rotate2(a.orientation, joint.anchorALocalM));
  a.positionM = add(center, scale(offset, massB / totalMass));
  b.positionM = sub(center, scale(offset, massA / totalMass));
  validateResult(bodies, []);
  const afterMetric = measurePose(bodies, joint, origin), velocityBitsUnchanged = bodies.every((body, i) => body.velocityMps.every((v, k) => Object.is(v, before[i].velocityMps[k]))), angularVelocityBitsUnchanged = bodies.every((body, i) => body.angularVelocityRadps.every((v, k) => Object.is(v, before[i].angularVelocityRadps[k])));
  const poseReport = { jointId: joint.id, finalAngleRad: afterMetric.relativeAngleRad, targetAngleRad };
  const diagnostics = { before: beforeMetric, after: afterMetric, targetAngleRad, angleCorrectionsRad, translationCorrectionsM: bodies.map((body, i) => sub(body.positionM, before[i].positionM)), sourceStepIndex: input.sourceStepIndex, sourceTimeSeconds: input.sourceTimeSeconds, velocityBitsUnchanged, angularVelocityBitsUnchanged, lawEvaluations: 1 };
  if (!finiteData2(poseReport) || !finiteData2(diagnostics) || !velocityBitsUnchanged || !angularVelocityBitsUnchanged) fail("result");
  return { bodies: bodies.map(copyBody), poseReport: structuredClone(poseReport), diagnostics: structuredClone(diagnostics) };
}

// src/disjoint-hinge/rows.ts
var DOF_ORDER = ["vAx", "vAy", "vAz", "wAx", "wAy", "wAz", "vBx", "vBy", "vBz", "wBx", "wBy", "wBz"];
var ROW_IDS = ["P.x", "P.y", "P.z", "L.x", "L.y", "L.z", "anchor.x", "anchor.y", "anchor.z", "transverse.x", "transverse.y"];
var skew = (r) => [[0, -r[2], r[1]], [r[2], 0, -r[0]], [-r[1], r[0], 0]];
var canonical = (value) => value === 0 ? 0 : value;
function makeRows(beforeBodies, finalBodies, joint, before, origin, target) {
  const masses = beforeBodies.map((body) => 1 / body.inverseMass), inertias = beforeBodies.map((body) => body.inertiaKgM2);
  const center = [...before.centerOfMassM], centeredTarget = sub(before.angularMomentumVectorKgM2ps, cross(sub(center, origin), before.linearMomentumVectorKgMps));
  const physicalA = Array.from({ length: 11 }, () => Array(12).fill(0));
  const rA = rotate2(finalBodies[0].orientation, joint.anchorALocalM), rB = rotate2(finalBodies[1].orientation, joint.anchorBLocalM);
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

// src/disjoint-hinge/linear-solver.ts
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
  if (!exactFields(value, ["rowIds", "rowCount", "pivots", "inverse", "normInf", "conditionInf", "lambda", "y", "residuals"]) || value.rowCount !== n || !dense(value.rowIds, n) || value.rowIds.some((id, i) => id !== i) || !dense(value.pivots, n) || !matrix(value.inverse, n, n) || !dense(value.lambda, n) || !dense(value.y, 12) || typeof value.normInf !== "number" || !Number.isFinite(value.normInf) || value.normInf < 0 || typeof value.conditionInf !== "number" || !Number.isFinite(value.conditionInf) || value.conditionInf < 0 || !exactFields(value.residuals, ["linear", "inverse"]) || ![value.residuals.linear, value.residuals.inverse].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)) fail("certificate");
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
  if (!exactFields(resultValue, ["y", "lambda", "activeStop", "identity", "solveAttempts", "phases", "objectiveDimensionless", "certificate"]) || typeof resultValue.activeStop !== "boolean" || typeof resultValue.identity !== "boolean" || !dense(resultValue.y, 12) || !dense(resultValue.lambda, resultValue.activeStop ? 12 : 11) || typeof resultValue.objectiveDimensionless !== "number" || !Number.isFinite(resultValue.objectiveDimensionless) || !Number.isInteger(resultValue.solveAttempts) || !Array.isArray(resultValue.phases) || Object.getPrototypeOf(resultValue.phases) !== Array.prototype || Reflect.ownKeys(resultValue.phases).length !== resultValue.phases.length + 1 || !Array.from({ length: resultValue.phases.length }, (_, i) => i).every((i) => Object.hasOwn(resultValue.phases, i)) || !exactFields(resultValue.certificate, ["primal", "stationarity", "negativeMu", "complementarity", "objective"]) || Object.values(resultValue.certificate).some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) fail("certificate");
  const result = resultValue, identity2 = exactIdentity(problem);
  if (result.identity !== identity2 || result.phases.length !== result.solveAttempts) fail("certificate");
  if (identity2) {
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
  const identity2 = exactIdentity(problem);
  let phases = [], activeStop = false, y, lambda;
  if (identity2) {
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
  const result = { y, lambda, activeStop, identity: identity2, solveAttempts: phases.length, phases, objectiveDimensionless: objective(problem, y), certificate: { primal: 0, stationarity: 0, negativeMu: 0, complementarity: 0, objective: 0 } };
  result.certificate = certificate(problem, result);
  validateVelocityCertificate(problem, result);
  return structuredClone(result);
}

// src/disjoint-hinge/projection.ts
function projectHingePoseVelocity(input) {
  const beforeBodies = input.bodies.map(copyBody);
  const originalOriginM = [...input.pair.originM];
  const before = measureBodies(beforeBodies, input.pair.joint, originalOriginM);
  const pose = projectCoupledHinge(input);
  const bodies = pose.bodies.map(copyBody), rows = makeRows(beforeBodies, bodies, input.pair.joint, before, originalOriginM, pose.poseReport.targetAngleRad);
  const result = solveDimensionlessVelocity(rows.problem);
  if (!result.identity) {
    for (let i = 0; i < 2; i++) {
      bodies[i].velocityMps = result.y.slice(i * 6, i * 6 + 3).map((value, j) => value * rows.columnScales[i * 6 + j]);
      bodies[i].angularVelocityRadps = result.y.slice(i * 6 + 3, i * 6 + 6).map((value, j) => value * rows.columnScales[i * 6 + 3 + j]);
    }
  }
  validateResult(bodies, []);
  const after = measureBodies(bodies, input.pair.joint, originalOriginM);
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
  const diagnostics = { poseStage: pose.diagnostics, before, after, velocityCorrections, projection, changedComponents, identityVelocityBitsPreserved, poseLawEvaluations: 1, sourceStepIndex: input.sourceStepIndex, sourceTimeSeconds: input.sourceTimeSeconds };
  if (!finiteData(diagnostics) || !finiteData(pose.poseReport) || objectiveJ < 0 || result.identity && !identityVelocityBitsPreserved) fail("result");
  return { bodies: bodies.map(copyBody), poseReport: structuredClone(pose.poseReport), diagnostics: structuredClone(diagnostics) };
}

// src/disjoint-hinge/report.ts
var REPORT_KEYS = ["id", "kind", "aId", "bId", "angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms"];
var nonempty = (value) => typeof value === "string" && value.length > 0;
var finite2 = (value) => typeof value === "number" && Number.isFinite(value);
function validateHingeMotorReport(value, identity2) {
  const ids = ownData(identity2, ["id", "aId", "bId"]);
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
  if (norm2 > 0.01) throw new PhysicsError2("NUMERIC_LIMIT", `${jointId} exceeded motor reaction limit`);
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
  const identity2 = { id: joint.id, aId: free[joint.aIndex].id, bId: free[joint.bIndex].id };
  const b = corrections[joint.bIndex];
  const jointReport = validateHingeMotorReport({
    ...identity2,
    kind: "hinge",
    angleRad: targetAngleRad,
    linearImpulseNs: [...b.linearImpulseNs],
    angularImpulseNms: [...b.angularImpulseNms],
    motorImpulseNms
  }, identity2);
  const angularReactionNormNms = Math.hypot(...b.angularImpulseNms);
  if (!Number.isFinite(angularReactionNormNms)) reactionError();
  return {
    jointReport,
    bodyCorrections: copyData2(corrections),
    reportCap: { angularReactionNormNms, maxReactionNms: 0.01, exceedsCap: angularReactionNormNms > 0.01 }
  };
}
function reactionError() {
  throw new PhysicsError2("NUMERIC_LIMIT", "unsafe joint reaction");
}
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

// src/disjoint-hinge/postcontact.ts
function publicBody(body) {
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
function rawHex(bodies) {
  const bytes = new Uint8Array(104 * bodies.length), view = new DataView(bytes.buffer);
  let cursor = 0;
  for (const body of bodies) for (const value of [
    ...body.positionM,
    ...body.velocityMps,
    ...body.orientation,
    ...body.angularVelocityRadps
  ]) {
    view.setFloat64(cursor, value, true);
    cursor += 8;
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function projectDisjointPostContact(input) {
  const next = input.bodies.map(copyBody);
  const jointReports = [];
  const bodyCorrections2 = [];
  const reportCaps = [];
  const calls = { projectionCalls: 0, reportCalls: 0 };
  for (const index of [0, 1]) {
    const pair = input.pairs[index];
    const before = [
      copyBody(input.bodies[pair.bodyIndices[0]]),
      copyBody(input.bodies[pair.bodyIndices[1]])
    ];
    calls.projectionCalls++;
    const projected = projectHingePoseVelocity({
      pair,
      bodies: before,
      sourceStepIndex: input.sourceStepIndex,
      sourceTimeSeconds: input.sourceTimeSeconds
    });
    const returned = [copyBody(projected.bodies[0]), copyBody(projected.bodies[1])];
    next[pair.bodyIndices[0]] = returned[0];
    next[pair.bodyIndices[1]] = returned[1];
    calls.reportCalls++;
    const report = makeReport(
      pair.joint,
      before,
      returned,
      projected.poseReport.targetAngleRad,
      input.motorImpulsesNms[index]
    );
    jointReports[pair.jointInputIndex] = report.jointReport;
    bodyCorrections2.push(report.bodyCorrections);
    reportCaps.push(report.reportCap);
  }
  for (const report of jointReports) enforceHingeMotorReactionCap(report.id, report.angularImpulseNms);
  return {
    projectedBodies: next.map(publicBody),
    projectedRawHex: rawHex(next),
    jointReports,
    bodyCorrections: bodyCorrections2,
    reportCaps,
    calls
  };
}

// src/disjoint-hinge/stage.ts
function admitDisjointHingeCommands(pairs, bodies, actions, commandCount) {
  for (const pair of pairs) {
    admitDynamicHingeCommands(
      pair.joint,
      [bodies[pair.bodyIndices[0]], bodies[pair.bodyIndices[1]]],
      actions
    );
  }
  if (commandCount !== 0) error("INVALID_COMMAND", "disjoint hinge profile supports empty commands only");
}
function driveDisjointHingeMotors(pairs, bodies, reports, impulses) {
  for (const pair of pairs) impulses[pair.jointInputIndex] = driveDynamicHingeMotor(
    pair.joint,
    bodies[pair.bodyIndices[0]],
    bodies[pair.bodyIndices[1]],
    reports[pair.jointInputIndex].angleRad
  );
}
function applyDisjointHingePostContact(pairs, bodies, reports, motorImpulses, sourceStepIndex, sourceTimeSeconds) {
  const canonical2 = [
    { ...pairs[0], jointInputIndex: 0 },
    { ...pairs[1], jointInputIndex: 1 }
  ];
  const result = projectDisjointPostContact({
    bodies,
    pairs: canonical2,
    motorImpulsesNms: [motorImpulses[pairs[0].jointInputIndex], motorImpulses[pairs[1].jointInputIndex]],
    sourceStepIndex,
    sourceTimeSeconds
  });
  for (let index = 0; index < bodies.length; index++) {
    const target = bodies[index], returned = result.projectedBodies[index];
    target.positionM = [...returned.positionM];
    target.velocityMps = [...returned.velocityMps];
    target.orientation = [...returned.orientation];
    target.angularVelocityRadps = [...returned.angularVelocityRadps];
  }
  for (const index of [0, 1]) reports[pairs[index].jointInputIndex] = result.jointReports[index];
}

// src/types.ts
var PhysicsError3 = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
    this.details = { code, reason: message, operation: "create", phase: "admission", domain: "world", entityIds: [], accepted: null, ...details };
  }
  details;
};

// src/cloth/constraints.ts
function projectDistance(sheet2, constraint) {
  const fixture = CLOTH_PROFILE;
  const { positions: p, inverseMasses: w } = sheet2;
  const { a, b, rest, kind } = constraint;
  const ia = 3 * a, ib = 3 * b;
  const x = p[ia] - p[ib], y = p[ia + 1] - p[ib + 1], z = p[ia + 2] - p[ib + 2];
  const length = Math.hypot(x, y, z);
  const weight = w[a] + w[b];
  if (length === 0 || weight === 0) return;
  const bend = kind === "bend-distance";
  const compliance = bend ? fixture.bendComplianceMPerN : fixture.stretchComplianceMPerN;
  const alpha = compliance / fixture.dt ** 2;
  const delta = (-(length - rest) - alpha * constraint.lambda) / (weight + alpha);
  constraint.lambda += delta;
  const scaleA = w[a] * delta / length, scaleB = w[b] * delta / length;
  p[ia] += scaleA * x;
  p[ia + 1] += scaleA * y;
  p[ia + 2] += scaleA * z;
  p[ib] -= scaleB * x;
  p[ib + 1] -= scaleB * y;
  p[ib + 2] -= scaleB * z;
}
function projectSphere(sheet2) {
  const fixture = CLOTH_PROFILE;
  const { positions: p, inverseMasses: w } = sheet2;
  const [cx, cy, cz] = fixture.sphereCentreM;
  const radius = fixture.sphereRadiusM + fixture.collisionOffsetM;
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 0) continue;
    const j = 3 * i, x = p[j] - cx, y = p[j + 1] - cy, z = p[j + 2] - cz;
    const distance = Math.hypot(x, y, z);
    if (distance >= radius) continue;
    if (distance === 0) {
      p[j] = cx;
      p[j + 1] = cy + radius;
      p[j + 2] = cz;
    } else {
      p[j] = cx + radius * x / distance;
      p[j + 1] = cy + radius * y / distance;
      p[j + 2] = cz + radius * z / distance;
    }
  }
}

// src/cloth/solver.ts
var ClothSolver = class {
  before = new Float64Array(289 * 3);
  decay = Math.exp(-CLOTH_PROFILE.velocityDecayPerSecond * CLOTH_PROFILE.dt);
  step(sheet2, positions, velocities) {
    const p = positions, dt = CLOTH_PROFILE.dt;
    for (let substep = 0; substep < CLOTH_SUBSTEPS; substep++) {
      this.before.set(p);
      for (let i = 0; i < sheet2.inverseMasses.length; i++) {
        if (sheet2.inverseMasses[i] === 0) continue;
        for (let axis = 0; axis < 3; axis++) {
          const j = 3 * i + axis;
          velocities[j] = this.decay * velocities[j] + dt * CLOTH_PROFILE.gravityMps2[axis];
          p[j] += dt * velocities[j];
        }
      }
      for (const constraint of sheet2.constraints) constraint.lambda = 0;
      for (let iteration = 0; iteration < CLOTH_ITERATIONS; iteration++) {
        for (const constraint of sheet2.constraints) projectDistance(sheet2, constraint);
        projectSphere(sheet2);
      }
      for (let j = 0; j < p.length; j++) velocities[j] = (p[j] - this.before[j]) / dt;
    }
  }
};

// src/cloth/metrics.ts
function clothDiagnostics(sheet2) {
  const p = sheet2.positions;
  let maxStructuralExtension = 0, maxStructuralCompression = 0;
  let maxVertexPenetrationM = 0, maxPinDriftM = 0;
  for (const edge of sheet2.constraints) {
    if (edge.kind !== "stretch") continue;
    const length = Math.hypot(...[0, 1, 2].map((axis) => p[3 * edge.a + axis] - p[3 * edge.b + axis]));
    const strain = length / edge.rest - 1;
    maxStructuralExtension = Math.max(maxStructuralExtension, strain);
    maxStructuralCompression = Math.max(maxStructuralCompression, -strain);
  }
  for (let i = 0; i < p.length / 3; i++) {
    const distance = Math.hypot(...[0, 1, 2].map((axis) => p[3 * i + axis] - CLOTH_PROFILE.sphereCentreM[axis]));
    maxVertexPenetrationM = Math.max(
      maxVertexPenetrationM,
      CLOTH_PROFILE.sphereRadiusM + CLOTH_PROFILE.collisionOffsetM - distance
    );
  }
  for (const pin of sheet2.pins) maxPinDriftM = Math.max(
    maxPinDriftM,
    Math.hypot(...[0, 1, 2].map((axis) => p[3 * pin + axis] - sheet2.restPositions[3 * pin + axis]))
  );
  return {
    maxStructuralExtension,
    maxStructuralCompression,
    maxVertexPenetrationM,
    maxPinDriftM,
    totalMassKg: sheet2.totalMassKg
  };
}
function withinClothBounds(positions, velocities, diagnostics) {
  return positions.every((value) => Number.isFinite(value) && Math.abs(value) <= 10) && velocities.every((value) => Number.isFinite(value) && Math.abs(value) <= 1e3) && Object.values(diagnostics).every(Number.isFinite) && diagnostics.maxStructuralExtension <= 0.1 && diagnostics.maxVertexPenetrationM <= 1e-6 && diagnostics.maxPinDriftM === 0;
}

// src/domain/cloth.ts
import { flat, immutableCopy, invalid, validateStatic } from "./types.js";
function sheet(definition, positions) {
  const c = definition.cloth;
  return {
    positions,
    restPositions: flat(c.restPositionsM, 289),
    inverseMasses: Float64Array.from(c.vertexMassesKg, (mass, index) => c.pinnedVertexIndices.includes(index) ? 0 : 1 / mass),
    pins: [...c.pinnedVertexIndices],
    triangles: Uint16Array.from(c.triangles.flat()),
    constraints: c.constraints.map((e) => ({ a: e.a, b: e.b, kind: e.kind, rest: e.restLengthM, lambda: 0 })),
    totalMassKg: c.vertexMassesKg.reduce((sum, mass) => sum + mass, 0)
  };
}
function copyClothCandidateOutput(id, candidate) {
  return {
    id,
    positionsM: candidate.positions.slice(),
    velocitiesMps: candidate.velocities.slice(),
    diagnostics: { ...candidate.diagnostics }
  };
}
function initializeCloth(cloth, staticData) {
  const definition = immutableCopy({ cloth, staticData });
  const c = definition.cloth, data = definition.staticData;
  invalid(data.profile === "cloth-pinned-sphere-visual-v1", "Unsupported cloth profile");
  validateStatic(data, c.staticColliderIds);
  invalid(c.staticColliderIds.length === 1, "Cloth requires one fixed sphere");
  const collider = data.colliders[0], body = data.bodies[0];
  invalid(collider.geometry.kind === "sphere" && collider.geometry.radiusM === CLOTH_PROFILE.sphereRadiusM && body.initial.positionM.every((x, i) => x === CLOTH_PROFILE.sphereCentreM[i]), "Unsupported cloth sphere");
  invalid(c.vertexMassesKg.length === 289 && c.vertexMassesKg.every((m) => Number.isFinite(m) && m > 0), "Invalid cloth masses");
  invalid(c.triangles.length === 512 && c.triangles.every((t) => t.length === 3 && t.every((i) => Number.isInteger(i) && i >= 0 && i < 289)), "Invalid cloth triangles");
  invalid(c.pinnedVertexIndices.length === 2 && c.pinnedVertexIndices[0] === 0 && c.pinnedVertexIndices[1] === 16, "Unsupported pins");
  invalid(c.constraints.length === 1566 && c.constraints.every((e) => Number.isInteger(e.a) && e.a >= 0 && e.a < 289 && Number.isInteger(e.b) && e.b >= 0 && e.b < 289 && e.a !== e.b && Number.isFinite(e.restLengthM) && e.restLengthM > 0 && ["stretch", "shear", "bend-distance"].includes(e.kind) && e.complianceMPerN === (e.kind === "bend-distance" ? CLOTH_PROFILE.bendComplianceMPerN : CLOTH_PROFILE.stretchComplianceMPerN)), "Unsupported cloth constraints");
  const positions = flat(c.initialPositionsM, 289), velocities = flat(c.initialVelocitiesMps, 289);
  invalid(velocities.every((x) => x === 0), "Unsupported initial cloth velocities");
  const initialSheet = sheet(definition, positions);
  invalid(positions.every((x, i) => Object.is(x, initialSheet.restPositions[i])), "Initial cloth must match rest data");
  const diagnostics = clothDiagnostics(initialSheet);
  invalid(withinClothBounds(positions, velocities, diagnostics), "Invalid initial cloth state");
  return { definition, initial: { positions, velocities, constraints: initialSheet.constraints, diagnostics } };
}
function prepareCloth(definition, accepted) {
  const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
  const candidateSheet = sheet(definition, positions);
  const solver = new ClothSolver();
  solver.step(candidateSheet, positions, velocities);
  const diagnostics = clothDiagnostics(candidateSheet);
  if (!withinClothBounds(positions, velocities, diagnostics)) throw new PhysicsError3("NUMERIC_LIMIT", "Cloth candidate exceeded the fixed profile bounds");
  const candidate = { positions, velocities, constraints: candidateSheet.constraints, diagnostics };
  const output = copyClothCandidateOutput(definition.cloth.id, candidate);
  return { candidate, output };
}

// src/fluid/boundary.ts
function floorSamples() {
  const points = [];
  const xSteps = Math.round(FLUID_BASIN_M[0] / FLUID_SPACING_M);
  const zSteps = Math.round(FLUID_BASIN_M[2] / FLUID_SPACING_M);
  for (const y of [0, -FLUID_SPACING_M]) {
    for (let z = 0; z <= zSteps; z++) {
      for (let x = 0; x <= xSteps; x++) {
        points.push(x * FLUID_SPACING_M, y, z * FLUID_SPACING_M);
      }
    }
  }
  return new Float64Array(points);
}
function confine(positions, velocities, index) {
  let hits = 0;
  const offset = index * 3;
  for (let axis = 0; axis < 3; axis++) {
    const point = offset + axis;
    const low = FLUID_PARTICLE_RADIUS_M;
    const high = FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M;
    if (positions[point] < low || positions[point] > high) {
      positions[point] = Math.max(low, Math.min(high, positions[point]));
      velocities[point] *= -0.1;
      hits++;
    }
  }
  return hits;
}
function stopOutwardVelocity(positions, velocities, index) {
  const offset = index * 3;
  for (let axis = 0; axis < 3; axis++) {
    const point = offset + axis;
    const low = FLUID_PARTICLE_RADIUS_M;
    const high = FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M;
    if (positions[point] <= low + 1e-9 && velocities[point] < 0 || positions[point] >= high - 1e-9 && velocities[point] > 0) {
      velocities[point] *= -0.1;
    }
  }
}
function insideBasin(positions) {
  for (let index = 0; index < positions.length / 3; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[index * 3 + axis];
      if (!Number.isFinite(value) || value < FLUID_PARTICLE_RADIUS_M - 1e-9 || value > FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M + 1e-9) return false;
    }
  }
  return true;
}

// src/fluid/neighbors.ts
var minimum = [-1, -2, -1];
var size = FLUID_BASIN_M.map((extent, axis) => Math.floor(extent / FLUID_SMOOTHING_RADIUS_M) + 2 - minimum[axis]);
var cellCount = size[0] * size[1] * size[2];
function cellIndex(x, y, z) {
  const gx = x - minimum[0], gy = y - minimum[1], gz = z - minimum[2];
  if (gx < 0 || gx >= size[0] || gy < 0 || gy >= size[1] || gz < 0 || gz >= size[2]) return -1;
  return (gz * size[1] + gy) * size[0] + gx;
}
var NeighborGrid = class {
  head = new Int32Array(cellCount);
  tail = new Int32Array(cellCount);
  next = new Int32Array(0);
  positions = new Float64Array(0);
  radiusSquared = FLUID_SMOOTHING_RADIUS_M ** 2;
  rebuild(positions) {
    this.positions = positions;
    this.head.fill(-1);
    this.tail.fill(-1);
    const count = positions.length / 3;
    if (this.next.length < count) this.next = new Int32Array(count);
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      const x = Math.floor(positions[offset] / FLUID_SMOOTHING_RADIUS_M);
      const y = Math.floor(positions[offset + 1] / FLUID_SMOOTHING_RADIUS_M);
      const z = Math.floor(positions[offset + 2] / FLUID_SMOOTHING_RADIUS_M);
      const cell = cellIndex(x, y, z);
      if (cell < 0) throw new Error("Fluid neighbor cell is outside the admitted basin");
      this.next[index] = -1;
      const last = this.tail[cell];
      if (last < 0) this.head[cell] = index;
      else this.next[last] = index;
      this.tail[cell] = index;
    }
  }
  each(index, visit) {
    const offset = index * 3;
    const cx = Math.floor(this.positions[offset] / FLUID_SMOOTHING_RADIUS_M);
    const cy = Math.floor(this.positions[offset + 1] / FLUID_SMOOTHING_RADIUS_M);
    const cz = Math.floor(this.positions[offset + 2] / FLUID_SMOOTHING_RADIUS_M);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = cellIndex(cx + dx, cy + dy, cz + dz);
          if (cell < 0) continue;
          for (let other = this.head[cell]; other >= 0; other = this.next[other]) {
            const otherOffset = other * 3;
            const rx = this.positions[offset] - this.positions[otherOffset];
            const ry = this.positions[offset + 1] - this.positions[otherOffset + 1];
            const rz = this.positions[offset + 2] - this.positions[otherOffset + 2];
            const distanceSquared = rx * rx + ry * ry + rz * rz;
            if (distanceSquared < this.radiusSquared) visit(other, rx, ry, rz, distanceSquared);
          }
        }
      }
    }
  }
};

// src/fluid/kernel.ts
var radiusSquared = FLUID_SMOOTHING_RADIUS_M ** 2;
function densityKernel(distanceSquared) {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? q * q * q : 0;
}
function gradientScale(distanceSquared) {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? -6 * q * q / radiusSquared : 0;
}
function densities(positions, grid, output) {
  grid.rebuild(positions);
  for (let index = 0; index < output.length; index++) {
    let density = 0;
    grid.each(index, (_other, _x, _y, _z, distanceSquared) => {
      density += densityKernel(distanceSquared);
    });
    output[index] = density;
  }
}
function initialRestDensity(positions) {
  const count = positions.length / 3;
  const result = new Float64Array(count);
  densities(positions, new NeighborGrid(), result);
  return result.reduce((sum, density) => sum + density, 0) / count;
}

// src/fluid/visual-viscosity.ts
function blendVisualViscosity(positions, velocities, grid, output, coefficient) {
  grid.rebuild(positions);
  for (let index = 0; index < FLUID_COUNT; index++) {
    const offset = index * 3;
    let weightSum = 0;
    let vx = 0, vy = 0, vz = 0;
    grid.each(index, (other, _rx, _ry, _rz, distanceSquared) => {
      const weight = densityKernel(distanceSquared);
      const otherOffset = other * 3;
      weightSum += weight;
      vx += weight * velocities[otherOffset];
      vy += weight * velocities[otherOffset + 1];
      vz += weight * velocities[otherOffset + 2];
    });
    const blend = weightSum > 0 ? coefficient / weightSum : 0;
    output[offset] = velocities[offset] + blend * (vx - weightSum * velocities[offset]);
    output[offset + 1] = velocities[offset + 1] + blend * (vy - weightSum * velocities[offset + 1]);
    output[offset + 2] = velocities[offset + 2] + blend * (vz - weightSum * velocities[offset + 2]);
  }
  velocities.set(output);
}

// src/fluid/pbf.ts
var PbfSolver = class {
  constructor(restDensity, visualViscosityCoefficient, staticBox = null) {
    this.restDensity = restDensity;
    this.visualViscosityCoefficient = visualViscosityCoefficient;
    this.staticBox = staticBox;
    this.smoothedVelocities = visualViscosityCoefficient > 0 ? new Float64Array(FLUID_COUNT * 3) : null;
    const floor2 = floorSamples();
    this.combined = new Float64Array(this.predicted.length + floor2.length);
    this.combined.set(floor2, this.predicted.length);
  }
  grid = new NeighborGrid();
  predicted = new Float64Array(FLUID_COUNT * 3);
  combined;
  density = new Float64Array(FLUID_COUNT);
  lambda = new Float64Array(FLUID_COUNT);
  corrections = new Float64Array(FLUID_COUNT * 3);
  smoothedVelocities;
  obstacleHits = 0;
  projectDensity(velocities) {
    this.combined.set(this.predicted);
    densities(this.combined, this.grid, this.density);
    for (let index = 0; index < FLUID_COUNT; index++) {
      const compression = Math.max(0, this.density[index] / this.restDensity - 1);
      if (compression === 0) {
        this.lambda[index] = 0;
        continue;
      }
      let ownX = 0, ownY = 0, ownZ = 0, gradientSum = 0;
      this.grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale3 = gradientScale(distanceSquared) / this.restDensity;
        const gx = scale3 * rx, gy = scale3 * ry, gz = scale3 * rz;
        ownX += gx;
        ownY += gy;
        ownZ += gz;
        gradientSum += gx * gx + gy * gy + gz * gz;
      });
      gradientSum += ownX * ownX + ownY * ownY + ownZ * ownZ;
      this.lambda[index] = -compression / (gradientSum + 0.01);
    }
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      let dx = 0, dy = 0, dz = 0;
      this.grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale3 = (this.lambda[index] + (other < FLUID_COUNT ? this.lambda[other] : 0)) * gradientScale(distanceSquared) / this.restDensity;
        dx += scale3 * rx;
        dy += scale3 * ry;
        dz += scale3 * rz;
      });
      const length = Math.hypot(dx, dy, dz);
      const limit = length > FLUID_SPACING_M * 0.25 ? FLUID_SPACING_M * 0.25 / length : 1;
      this.corrections[offset] = dx * limit;
      this.corrections[offset + 1] = dy * limit;
      this.corrections[offset + 2] = dz * limit;
    }
    let boundaryHits = 0;
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        this.predicted[offset + axis] += this.corrections[offset + axis];
      }
      boundaryHits += confine(this.predicted, velocities, index);
      if (this.staticBox) {
        this.obstacleHits += confineStaticBox(this.predicted, velocities, index, this.staticBox);
      }
    }
    return boundaryHits;
  }
  step(positions, velocities) {
    let boundaryHits = 0;
    this.obstacleHits = 0;
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      velocities[offset + 1] += FLUID_STEP_SECONDS * FLUID_GRAVITY_MPS2[1];
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] *= 0.998;
        this.predicted[offset + axis] = positions[offset + axis] + FLUID_STEP_SECONDS * velocities[offset + axis];
      }
      boundaryHits += confine(this.predicted, velocities, index);
      if (this.staticBox) {
        this.obstacleHits += confineStaticBox(this.predicted, velocities, index, this.staticBox);
      }
    }
    for (let iteration = 0; iteration < 3; iteration++) {
      boundaryHits += this.projectDensity(velocities);
    }
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] = (this.predicted[offset + axis] - positions[offset + axis]) / FLUID_STEP_SECONDS;
        positions[offset + axis] = this.predicted[offset + axis];
      }
    }
    if (this.smoothedVelocities) {
      blendVisualViscosity(
        positions,
        velocities,
        this.grid,
        this.smoothedVelocities,
        this.visualViscosityCoefficient
      );
    }
    for (let index = 0; index < FLUID_COUNT; index++) {
      stopOutwardVelocity(positions, velocities, index);
      if (this.staticBox) stopIntoStaticBox(positions, velocities, index, this.staticBox);
    }
    return { boundaryHits, obstacleHits: this.obstacleHits };
  }
};

// src/fluid/diagnostics.ts
var floor = floorSamples();
function fluidDiagnostics(positions, restDensity, boundaryHits) {
  const combined = new Float64Array(positions.length + floor.length);
  combined.set(positions);
  combined.set(floor, positions.length);
  const density = new Float64Array(FLUID_COUNT);
  densities(combined, new NeighborGrid(), density);
  let absoluteError = 0;
  const compressions = new Array(FLUID_COUNT);
  for (let index = 0; index < FLUID_COUNT; index++) {
    const difference = density[index] / restDensity - 1;
    absoluteError += Math.abs(difference);
    compressions[index] = Math.max(0, difference);
  }
  compressions.sort((a, b) => a - b);
  return {
    meanAbsoluteDensityError: absoluteError / FLUID_COUNT,
    p95Compression: compressions[Math.ceil(0.95 * FLUID_COUNT) - 1],
    boundaryHits
  };
}

// src/domain/fluid.ts
import { flat as flat2, immutableCopy as immutableCopy2, invalid as invalid2, validateStatic as validateStatic2 } from "./types.js";
function copyFluidCandidateOutput(id, candidate) {
  return { id, positionsM: candidate.positions.slice(), velocitiesMps: candidate.velocities.slice(), diagnostics: { ...candidate.diagnostics } };
}
function initializeFluid(fluid, staticData) {
  const copied = immutableCopy2({ fluid, staticData }), f = copied.fluid, data = copied.staticData;
  invalid2(["fluid-basin-visual-v1", "fluid-basin-xsph-visual-v1", "fluid-static-box-visual-v1"].includes(data.profile), "Unsupported fluid profile");
  validateStatic2(data, f.staticColliderIds);
  invalid2(f.massModel.kind === "visual-unit-weights" && f.particleRadiusM === FLUID_PARTICLE_RADIUS_M && f.smoothingRadiusM === FLUID_SMOOTHING_RADIUS_M, "Unsupported fluid mass or radii");
  const xsph = data.profile === "fluid-basin-xsph-visual-v1", boxProfile = data.profile === "fluid-static-box-visual-v1";
  invalid2(xsph ? f.visualSmoothing.kind === "xsph" && f.visualSmoothing.coefficient === 0.15 : f.visualSmoothing.kind === "none", "Unsupported smoothing");
  invalid2(data.colliders.length === (boxProfile ? 2 : 1), "Unsupported static fluid collider population");
  const basin = data.colliders.find((c) => c.geometry.kind === "box-interior");
  invalid2(basin?.geometry.kind === "box-interior", "Fluid requires basin");
  const basinBody = data.bodies.find((b) => b.id === basin.bodyId);
  invalid2(basin.geometry.halfExtentsM.every((x, i) => x === FLUID_BASIN_M[i] / 2) && basinBody.initial.positionM.every((x, i) => x === FLUID_BASIN_M[i] / 2), "Unsupported basin");
  const positions = flat2(f.initialPositionsM, 256), velocities = flat2(f.initialVelocitiesMps, 256);
  invalid2(velocities.every((x) => x === 0) && insideBasin(positions), "Invalid initial fluid state");
  const minimumSquared = FLUID_MIN_SPACING_M ** 2;
  for (let first = 0; first < 256; first++) for (let second = first + 1; second < 256; second++) {
    const dx = positions[first * 3] - positions[second * 3], dy = positions[first * 3 + 1] - positions[second * 3 + 1], dz = positions[first * 3 + 2] - positions[second * 3 + 2];
    invalid2(dx * dx + dy * dy + dz * dz >= minimumSquared - 1e-12, "Initial particles must be at least 0.025 m apart");
  }
  let staticBox = null;
  if (boxProfile) {
    const collider = data.colliders.find((c) => c.geometry.kind === "box");
    invalid2(collider?.geometry.kind === "box", "Static fluid profile requires box");
    const body = data.bodies.find((b) => b.id === collider.bodyId);
    staticBox = inflatedBoxBounds(body.initial.positionM, collider.geometry.halfExtentsM);
    invalid2(staticBox.low.every((x, i) => x >= FLUID_PARTICLE_RADIUS_M && staticBox.high[i] <= FLUID_BASIN_M[i] - FLUID_PARTICLE_RADIUS_M), "Static box exceeds basin");
    invalid2(!insideStaticBox(positions, staticBox), "Static box overlaps initial particles");
  }
  const restDensity = initialRestDensity(positions);
  const definition = immutableCopy2({ ...copied, restDensity, staticBox });
  const diagnostics = { ...fluidDiagnostics(positions, restDensity, 0), obstacleHits: 0 };
  return { definition, initial: { positions, velocities, diagnostics } };
}
function prepareFluid(definition, accepted) {
  const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
  const coefficient = definition.fluid.visualSmoothing.kind === "xsph" ? definition.fluid.visualSmoothing.coefficient : 0;
  const solver = new PbfSolver(definition.restDensity, coefficient, definition.staticBox);
  const { boundaryHits, obstacleHits } = solver.step(positions, velocities);
  if (!insideBasin(positions) || !velocities.every((x) => Number.isFinite(x) && Math.abs(x) <= 1e3)) throw new PhysicsError3("NUMERIC_LIMIT", "Fluid candidate exceeded numeric bounds");
  const measured = fluidDiagnostics(positions, definition.restDensity, boundaryHits);
  if (!Number.isFinite(measured.meanAbsoluteDensityError) || !Number.isFinite(measured.p95Compression)) throw new PhysicsError3("NUMERIC_LIMIT", "Fluid candidate density is not finite");
  const candidate = { positions, velocities, diagnostics: { ...measured, obstacleHits } };
  const output = copyFluidCandidateOutput(definition.fluid.id, candidate);
  return { candidate, output };
}

// src/world.ts
function publicState(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt, identity2, colliderIds) {
  return {
    identity: { ...identity2 },
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies: bodies.map((body) => ({
      id: body.id,
      kind: body.kind,
      positionM: [...body.positionM],
      orientationXYZW: [...body.orientation],
      velocityMps: [...body.velocityMps],
      angularVelocityRadps: [...body.angularVelocityRadps],
      sleeping: body.sleeping ?? false
    })),
    contacts: contacts.map((contact) => ({
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
function publicDomainState(runtime, model, identity2, stepIndex, dt, prepared) {
  const bodies = model.bodies.map((body) => ({
    id: body.id,
    kind: body.kind,
    positionM: [...body.initial.positionM],
    orientationXYZW: [...body.initial.orientationXYZW],
    velocityMps: [0, 0, 0],
    angularVelocityRadps: [0, 0, 0],
    sleeping: false
  }));
  const state = {
    identity: { ...identity2 },
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies,
    joints: [],
    contacts: [],
    events: [],
    ccdHits: [],
    cloths: [],
    fluids: [],
    pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 }
  };
  if (runtime.kind === "cloth") {
    const output2 = prepared ?? {
      id: runtime.definition.cloth.id,
      positionsM: runtime.accepted.positions.slice(),
      velocitiesMps: runtime.accepted.velocities.slice(),
      diagnostics: { ...runtime.accepted.diagnostics }
    };
    return { ...state, cloths: [output2] };
  }
  const output = prepared ?? {
    id: runtime.definition.fluid.id,
    positionsM: runtime.accepted.positions.slice(),
    velocitiesMps: runtime.accepted.velocities.slice(),
    diagnostics: { ...runtime.accepted.diagnostics }
  };
  return { ...state, fluids: [output] };
}
function createPhysicsWorld(model, options) {
  const admitted = admitModel(model, options);
  const dt = admitted.options.fixedStepSeconds;
  const domainKind = admitted.domain?.kind ?? null;
  const domainId = admitted.domain?.data.id ?? null;
  const stepLimit = domainKind === "cloth" ? CLOTH_MAX_STEPS : domainKind === "fluid" ? FLUID_MAX_STEPS : MAX_STEPS;
  let domainState = null;
  if (admitted.domain?.kind === "cloth") {
    const initialized = initializeCloth(admitted.domain.data, admitted.domain.staticData);
    domainState = { kind: "cloth", definition: initialized.definition, accepted: initialized.initial };
  } else if (admitted.domain?.kind === "fluid") {
    const initialized = initializeFluid(admitted.domain.data, admitted.domain.staticData);
    domainState = { kind: "fluid", definition: initialized.definition, accepted: initialized.initial };
  }
  const gravity = [...admitted.model.gravityMps2];
  const useAabb = admitted.options.broadPhase === "aabb";
  const usePersistentBox = admitted.options.profile === "rigid-persistent-box-v1";
  const largeMode = admitted.options.profile === "rigid-large-v1";
  let bodies = admitted.bodies;
  let joints = admitted.joints;
  let disjointHinges = admitted.disjointHinges;
  let modelCopy = admitted.model;
  let optionsCopy = admitted.options;
  const colliderIds = new Map(admitted.model.colliders.map((collider) => [collider.bodyId, collider.id]));
  const identity2 = {
    modelRevision: admitted.model.revision,
    modelDigest: digest(admitted.model),
    configurationDigest: digest(admitted.options),
    providerDigest: digest(providerManifest),
    profile: admitted.options.profile,
    frameId: admitted.model.frame.id,
    fixedStepSeconds: dt
  };
  let dynamicHinge = joints.find((joint) => joint.kind === "hinge" && bodies[joint.aIndex].kind === "dynamic");
  if (dynamicHinge && !disjointHinges) admitDynamicHingeScene(dynamicHinge, bodies, gravity);
  let ccd = domainKind ? { kind: "none" } : admitCcd(bodies, joints.length, gravity);
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
  let owner = null;
  let advancingOwner = null;
  const ensureActive = () => {
    if (disposed) error("DISPOSED", "world is disposed");
  };
  const world = {
    getModel() {
      ensureActive();
      return copyData(modelCopy);
    },
    getState() {
      ensureActive();
      return domainState ? publicDomainState(domainState, modelCopy, identity2, stepIndex, dt) : publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt, identity2, colliderIds);
    },
    step(commands = []) {
      ensureActive();
      if (owner !== advancingOwner) error("WORLD_OWNED", "World has an exclusive recorder");
      if (stepIndex >= stepLimit) error("WORLD_LIMIT", "world step limit reached");
      if (owner && (owner.recording.frames.length >= 512 || Array.isArray(commands) && owner.commandCount + commands.length > 4096)) {
        error("WORLD_LIMIT", "recording frame or command limit reached");
      }
      let admittedCommands;
      try {
        admittedCommands = copyData(commands);
      } catch (failure) {
        if (failure instanceof PhysicsError4 && failure.code === "INVALID_CONFIG") error("INVALID_COMMAND", failure.message);
        throw failure;
      }
      if (owner && Array.isArray(admittedCommands) && owner.commandCount + admittedCommands.length > 4096) {
        error("WORLD_LIMIT", "recording command limit reached");
      }
      const actions = parseCommands(admittedCommands, bodies);
      if (domainState) {
        if (admittedCommands.length !== 0) error("INVALID_COMMAND", "visual domain commands are unsupported");
        const preparedFrames2 = owner ? owner.prepareFrames(admittedCommands, stepIndex + 1) : null;
        let nextDomain;
        let output;
        if (domainState.kind === "cloth") {
          const prepared = prepareCloth(domainState.definition, domainState.accepted);
          nextDomain = { kind: "cloth", definition: domainState.definition, accepted: prepared.candidate };
          output = prepared.output;
        } else {
          const prepared = prepareFluid(domainState.definition, domainState.accepted);
          nextDomain = { kind: "fluid", definition: domainState.definition, accepted: prepared.candidate };
          output = prepared.output;
        }
        const state2 = publicDomainState(nextDomain, modelCopy, identity2, stepIndex + 1, dt, output);
        const preparedRecording2 = owner ? owner.prepare(preparedFrames2, state2) : null;
        const preparedCommandCount2 = owner ? owner.commandCount + admittedCommands.length : 0;
        domainState = nextDomain;
        stepIndex++;
        if (owner) {
          owner.recording = preparedRecording2;
          owner.commandCount = preparedCommandCount2;
        }
        return state2;
      }
      if (disjointHinges) admitDisjointHingeCommands(disjointHinges, bodies, actions, admittedCommands.length);
      else if (dynamicHinge) admitDynamicHingeCommands(dynamicHinge, bodies, actions);
      if (ccd.kind === "box-pair") rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
      const preparedFrames = owner ? owner.prepareFrames(admittedCommands, stepIndex + 1) : null;
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
      if (disjointHinges) driveDisjointHingeMotors(disjointHinges, next, jointStates, motorImpulses);
      else for (let index = 0; index < joints.length; index++) {
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
        if (!disjointHinges) for (let index = 0; index < joints.length; index++) {
          const reaction = projectJoint(joints[index], next, bodies, dt);
          nextJoints[index].linearImpulseNs = add(nextJoints[index].linearImpulseNs, reaction.linearImpulseNs);
          nextJoints[index].angularImpulseNms = add(nextJoints[index].angularImpulseNms, reaction.angularImpulseNms);
          if (reaction.angleRad !== void 0) nextJoints[index].angleRad = reaction.angleRad;
        }
      }
      if (disjointHinges) {
        if (found.size !== 0 || sensed.size !== 0) {
          error("NUMERIC_LIMIT", "disjoint hinge contact profile is unsupported");
        }
        applyDisjointHingePostContact(disjointHinges, next, nextJoints, motorImpulses, stepIndex, stepIndex * dt);
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
      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt, identity2, colliderIds);
      const preparedRecording = owner ? owner.prepare(preparedFrames, state) : null;
      const preparedCommandCount = owner ? owner.commandCount + admittedCommands.length : 0;
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
        if (domainState) error("INVALID_QUERY", "visual domain queries are unsupported");
        return { kind: "overlap-sphere", colliderIds: bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body)).map((body) => body.id).sort().map((id) => colliderIds.get(id)) };
      }
      if (data.kind !== "raycast") error("INVALID_QUERY", "unsupported query kind");
      const query2 = queryRecord(data, ["kind", "originM", "direction", "maxDistanceM", "includeSensors"], []);
      const origin = queryVector(query2.originM, 1e4, "originM");
      const direction = queryVector(query2.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) error("INVALID_QUERY", "direction must be a unit 3-vector");
      const limit = queryNumber(query2.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
      if (domainState) error("INVALID_QUERY", "visual domain queries are unsupported");
      let best = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId) best = { bodyId: body.id, distanceM: distance };
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
      domainState = null;
      advancingOwner = null;
      bodies = [];
      contacts = [];
      events = [];
      ccdHits = [];
      activePairs.clear();
      persistentPoints.clear();
      sleepFrames = [];
      jointStates = [];
      joints = [];
      dynamicHinge = void 0;
      disjointHinges = null;
      ccd = { kind: "none" };
      pairs.length = 0;
      colliderIds.clear();
      modelCopy = null;
    }
  };
  let running = false;
  function guarded(operation, action) {
    if (disposed) throw new PhysicsError4("DISPOSED", "world is disposed", {
      operation,
      phase: "lifecycle",
      domain: "world",
      entityIds: [],
      accepted: { stepIndex, timeSeconds: stepIndex * dt }
    });
    if (running) throw new PhysicsError4("REENTRANT_CALL", "World call is reentrant", {
      operation,
      phase: "lifecycle",
      domain: "world",
      entityIds: [],
      accepted: { stepIndex, timeSeconds: stepIndex * dt }
    });
    running = true;
    try {
      return action();
    } catch (failure) {
      if (!(failure instanceof PhysicsError4)) throw failure;
      const enriched = new PhysicsError4(failure.code, failure.message, {
        operation,
        phase: ["DISPOSED", "WORLD_OWNED", "REENTRANT_CALL"].includes(failure.code) ? "lifecycle" : failure.code === "WORLD_LIMIT" ? "budget" : failure.code === "NUMERIC_LIMIT" ? "validation" : "admission",
        domain: domainKind ?? "rigid",
        entityIds: domainId && failure.details.entityIds.length === 0 ? [domainId] : failure.details.entityIds,
        accepted: { stepIndex, timeSeconds: stepIndex * dt }
      });
      enriched.stack = failure.stack;
      throw enriched;
    } finally {
      running = false;
    }
  }
  const getModel = world.getModel;
  const getState = world.getState;
  const step = world.step;
  const query = world.query;
  const dispose = world.dispose;
  world.getModel = () => guarded("read", getModel);
  world.getState = () => guarded("read", getState);
  world.step = (commands) => guarded("step", () => step(commands));
  world.query = (input) => guarded("query", () => query(input));
  world.dispose = () => {
    if (!disposed) guarded("read", dispose);
  };
  recordingWorlds.set(world, {
    attach: (prepare) => guarded("record", () => {
      if (owner) error("WORLD_OWNED", "World has an exclusive recorder");
      if (stepIndex !== 0) error("INVALID_SNAPSHOT", "recording must attach at step zero");
      const prepared = prepare({ model: copyData(modelCopy), options: copyData(optionsCopy), state: getState() });
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
  return world;
}

// src/capsule-query-error.ts
import { PhysicsError as PhysicsError5 } from "./types.js";

// src/capsule-query/profile.ts
var PROFILE = "upright-capsule-box-v1";
var RADIUS_M = 0.15;
var HALF_LENGTH_M = 0.35;
var TIE_FRACTION = 1e-9;
var BOX_CAPACITY = 32;

// src/capsule-query/admission.ts
function refuse2(code, message) {
  throw new PhysicsError5(code, message);
}
function metadata(code, action) {
  try {
    return action();
  } catch {
    throw new PhysicsError5(code, "Input reflection failed");
  }
}
function record2(value, keys, code) {
  if (!value || typeof value !== "object" || metadata(code, () => Object.getPrototypeOf(value)) !== Object.prototype) {
    refuse2(code, "Expected an ordinary record");
  }
  const own = metadata(code, () => Reflect.ownKeys(value));
  if (own.length !== keys.length || own.some((key) => typeof key !== "string" || !keys.includes(key))) {
    refuse2(code, "Unexpected record fields");
  }
  const copied = {};
  for (const key of keys) {
    const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, key));
    if (!descriptor || !("value" in descriptor)) refuse2(code, "Accessor fields are not admitted");
    copied[key] = descriptor.value;
  }
  return copied;
}
function dense2(value, limit, code, exact3) {
  if (!metadata(code, () => Array.isArray(value)) || metadata(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
    refuse2(code, "Expected an ordinary dense array");
  }
  const lengthDescriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, "length"));
  if (!lengthDescriptor || !("value" in lengthDescriptor)) refuse2(code, "Expected array length");
  const length = lengthDescriptor.value;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > limit || exact3 !== void 0 && length !== exact3 || metadata(code, () => Reflect.ownKeys(value)).length !== length + 1) {
    refuse2(code, "Invalid array length or fields");
  }
  const values = [];
  for (let index = 0; index < length; index++) {
    const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
    if (!descriptor || !("value" in descriptor)) refuse2(code, "Sparse or accessor array");
    values.push(descriptor.value);
  }
  return values;
}
function tuple(value, count, bound, code) {
  return dense2(value, count, code, count).map((component) => {
    if (typeof component !== "number" || !Number.isFinite(component) || Math.abs(component) > bound) {
      refuse2(code, "Invalid tuple component");
    }
    return component;
  });
}
function identity(value, code) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(value)) {
    refuse2(code, "Invalid identity");
  }
  return value;
}
function admitScene(input) {
  const scene = record2(input, ["version", "profile", "revision", "boxes"], "INVALID_CONFIG");
  if (scene.version !== 1 || scene.profile !== PROFILE) refuse2("INVALID_CONFIG", "Unsupported capsule query profile");
  const revision = identity(scene.revision, "INVALID_CONFIG");
  const boxes = dense2(scene.boxes, BOX_CAPACITY, "INVALID_CONFIG").map((value) => {
    const box = record2(value, ["id", "centerM", "halfExtentsM", "orientationXYZW"], "INVALID_CONFIG");
    const id = identity(box.id, "INVALID_CONFIG");
    const centerM = tuple(box.centerM, 3, 10, "INVALID_CONFIG");
    const halfExtentsM = tuple(box.halfExtentsM, 3, 5, "INVALID_CONFIG");
    const orientationXYZW = tuple(box.orientationXYZW, 4, 1, "INVALID_CONFIG");
    if (halfExtentsM.some((value2) => value2 < 1e-4) || Math.abs(Math.hypot(...orientationXYZW) - 1) > 1e-12) {
      refuse2("INVALID_CONFIG", "Invalid box extents or quaternion");
    }
    return { id, centerM, halfExtentsM, orientationXYZW };
  });
  if (new Set(boxes.map((box) => box.id)).size !== boxes.length) refuse2("INVALID_CONFIG", "Duplicate box ID");
  return { version: 1, profile: PROFILE, revision, boxes };
}
function admitSweep(input, scene) {
  const query = record2(input, ["revision", "centerM", "displacementM", "excludeId"], "INVALID_QUERY");
  const revision = identity(query.revision, "INVALID_QUERY");
  const centerM = tuple(query.centerM, 3, 5, "INVALID_QUERY");
  const displacementM = tuple(query.displacementM, 3, 2, "INVALID_QUERY");
  if (Math.hypot(...displacementM) > 2) refuse2("INVALID_QUERY", "Displacement exceeds 2 metres");
  const excludeId = query.excludeId === null ? null : identity(query.excludeId, "INVALID_QUERY");
  if (revision !== scene.revision) throw new PhysicsError5("STALE_SNAPSHOT", "Revision mismatch");
  if (excludeId !== null && !scene.boxes.some((box) => box.id === excludeId)) refuse2("INVALID_QUERY", "Unknown excluded ID");
  return { revision, centerM, displacementM, excludeId };
}

// src/capsule-query/geometry.ts
function matrix2(q) {
  const [x, y, z, w] = q, factor = 2 / (x * x + y * y + z * z + w * w);
  return [
    [1 - factor * (y * y + z * z), factor * (x * y - z * w), factor * (x * z + y * w)],
    [factor * (x * y + z * w), 1 - factor * (x * x + z * z), factor * (y * z - x * w)],
    [factor * (x * z - y * w), factor * (y * z + x * w), 1 - factor * (x * x + y * y)]
  ];
}
var dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function closestCandidate(center, box) {
  const m = matrix2(box.orientationXYZW), h = box.halfExtentsM;
  const toLocal = (p) => [0, 1, 2].map((j) => m[0][j] * (p[0] - box.centerM[0]) + m[1][j] * (p[1] - box.centerM[1]) + m[2][j] * (p[2] - box.centerM[2]));
  const toWorld = (p) => m.map((row, i) => dot3(row, p) + box.centerM[i]);
  const a = toLocal([center[0], center[1] - HALF_LENGTH_M, center[2]]);
  const b = toLocal([center[0], center[1] + HALF_LENGTH_M, center[2]]);
  const d = b.map((value, i) => value - a[i]);
  function squared(t) {
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      const delta = Math.max(0, Math.abs(a[i] + t * d[i]) - h[i]);
      sum += delta * delta;
    }
    return sum;
  }
  let lo = 0, hi = 1;
  for (let pass = 0; pass < 100; pass++) {
    const t1 = (2 * lo + hi) / 3, t2 = (lo + 2 * hi) / 3;
    if (squared(t1) <= squared(t2)) hi = t2;
    else lo = t1;
  }
  let u = 0, best = squared(0);
  for (const t of [1, (lo + hi) / 2]) {
    const value = squared(t);
    if (value < best) {
      best = value;
      u = t;
    }
  }
  const segmentLocal = a.map((value, i) => value + u * d[i]);
  const pointLocal = segmentLocal.map((value, i) => Math.max(-h[i], Math.min(h[i], value)));
  const difference = segmentLocal.map((value, i) => value - pointLocal[i]);
  const distanceM = Math.sqrt(best);
  const normalM = distanceM > 0 ? m.map((row) => dot3(row, difference) / distanceM) : null;
  return { distanceM, normalM, pointM: toWorld(pointLocal), segmentM: toWorld(segmentLocal) };
}

// src/capsule-query/sweep.ts
function sweepBox2(center, displacement, box) {
  let fraction = 0;
  for (let iteration = 0; iteration < 64; iteration++) {
    const at = center.map((value, i) => value + fraction * displacement[i]);
    const closest = closestCandidate(at, box), gap = closest.distanceM - RADIUS_M;
    if (!Number.isFinite(gap)) throw new PhysicsError5("NUMERIC_LIMIT", "Nonfinite distance");
    if (iteration === 0 && gap < -1e-12) throw new PhysicsError5("INITIAL_OVERLAP", "Initial capsule overlaps a box");
    if (!closest.normalM) throw new PhysicsError5("NUMERIC_LIMIT", "No distance normal");
    if (iteration === 0 && Math.abs(gap) <= 1e-12 || gap <= 1e-14) {
      if (gap < -1e-12) throw new PhysicsError5("NUMERIC_LIMIT", "Advancement crossed contact");
      return {
        bodyId: box.id,
        toiFraction: fraction,
        normalFixtureToCapsule: closest.normalM.slice(),
        pointM: closest.pointM.slice(),
        segmentPointM: closest.segmentM.slice(),
        iterations: iteration + 1
      };
    }
    const closing = -dot3(closest.normalM, displacement);
    if (closing <= 0) return null;
    const next = fraction + gap / closing;
    if (!Number.isFinite(next)) throw new PhysicsError5("NUMERIC_LIMIT", "Nonfinite advancement");
    if (next > 1) return null;
    if (next <= fraction) throw new PhysicsError5("ITERATION_LIMIT", "Advancement cannot make progress");
    fraction = next;
  }
  throw new PhysicsError5("ITERATION_LIMIT", "Fixed advancement cap exhausted");
}

// src/capsule-query/snapshot.ts
function copyBox(box) {
  return { id: box.id, centerM: [...box.centerM], halfExtentsM: [...box.halfExtentsM], orientationXYZW: [...box.orientationXYZW] };
}
function geometryKey(box) {
  const values = [...box.centerM, ...box.halfExtentsM, ...box.orientationXYZW];
  const bytes = new Uint8Array(80), view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat64(index * 8, value, true));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function groupBoxes(boxes) {
  const groups = /* @__PURE__ */ new Map();
  for (const box of boxes) {
    const key = geometryKey(box), group = groups.get(key);
    if (group) group.ids.push(box.id);
    else groups.set(key, { representative: copyBox(box), ids: [box.id] });
  }
  return Array.from(groups.values());
}
function createUprightCapsuleQuery(input) {
  const scene = admitScene(input), groups = groupBoxes(scene.boxes);
  let disposed = false;
  function live() {
    if (disposed) throw new PhysicsError5("DISPOSED", "Capsule query is disposed");
  }
  return {
    sweep(input2) {
      live();
      const query = admitSweep(input2, scene), hits = [];
      for (const group of groups) {
        let selectedId = null;
        for (const id of group.ids) if (id !== query.excludeId && (selectedId === null || id < selectedId)) selectedId = id;
        if (selectedId === null) continue;
        const hit = sweepBox2(query.centerM, query.displacementM, group.representative);
        if (hit) hits.push({ ...hit, bodyId: selectedId });
      }
      if (!hits.length) return null;
      const minimum2 = Math.min(...hits.map((hit) => hit.toiFraction));
      return hits.filter((hit) => hit.toiFraction <= minimum2 + TIE_FRACTION).sort((a, b) => a.bodyId < b.bodyId ? -1 : a.bodyId > b.bodyId ? 1 : 0)[0];
    },
    getSnapshot() {
      live();
      return { version: 1, profile: scene.profile, revision: scene.revision, boxes: scene.boxes.map(copyBox) };
    },
    dispose() {
      disposed = true;
    }
  };
}

// src/character/profile.ts
var PROFILE2 = "upright-capsule-controller-v1";
var DT = 1 / 120;
var STEPS = 240;
var GRAVITY = -9.81;
var SKIN = 2e-3;
var SNAP = 0.02;
var STEP_HEIGHT = 0.1;
var PREVIEW = 0.152;
var STEP_DOWN = 0.12;
var ASSIST_CAP = 20;
var SLIDE_CAP = 4;
var QUERY_CAP = 32;
var LOOKAHEAD = 0.02;
var WALKABLE = Math.cos(10 * Math.PI / 180);

// src/character/admission.ts
function refuse3(code, message) {
  throw new PhysicsError5(code, message);
}
function metadata2(code, action) {
  try {
    return action();
  } catch {
    throw new PhysicsError5(code, "Controller input reflection failed");
  }
}
function record3(value, keys, code) {
  if (!value || typeof value !== "object" || metadata2(code, () => Object.getPrototypeOf(value)) !== Object.prototype) {
    refuse3(code, "Expected an ordinary controller record");
  }
  const own = metadata2(code, () => Reflect.ownKeys(value));
  if (own.length !== keys.length || own.some((key) => typeof key !== "string" || !keys.includes(key))) {
    refuse3(code, "Unexpected controller fields");
  }
  const copy = {};
  for (const key of keys) {
    const descriptor = metadata2(code, () => Object.getOwnPropertyDescriptor(value, key));
    if (!descriptor || !("value" in descriptor)) refuse3(code, "Controller accessors are not admitted");
    copy[key] = descriptor.value;
  }
  return copy;
}
function tuple2(value, bound, code) {
  if (!metadata2(code, () => Array.isArray(value)) || metadata2(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
    refuse3(code, "Expected an ordinary controller tuple");
  }
  const length = metadata2(code, () => Object.getOwnPropertyDescriptor(value, "length"));
  if (!length || !("value" in length) || length.value !== 3 || metadata2(code, () => Reflect.ownKeys(value)).length !== 4) {
    refuse3(code, "Invalid controller tuple length or fields");
  }
  const copy = [];
  for (let index = 0; index < 3; index++) {
    const descriptor = metadata2(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value) || Math.abs(descriptor.value) > bound) {
      refuse3(code, "Invalid controller tuple component");
    }
    copy.push(descriptor.value);
  }
  return copy;
}
function admitConfig(input) {
  const config = record3(input, ["version", "profile", "scene", "positionM"], "INVALID_CONFIG");
  if (config.version !== 1 || config.profile !== PROFILE2) refuse3("INVALID_CONFIG", "Unsupported controller profile");
  const positionM = tuple2(config.positionM, 5, "INVALID_CONFIG");
  return { scene: config.scene, positionM };
}
function admitCommand(input) {
  const command = record3(input, ["dtSeconds", "sceneRevision", "desiredVelocityMps"], "INVALID_COMMAND");
  if (typeof command.dtSeconds !== "number" || !Number.isFinite(command.dtSeconds)) refuse3("INVALID_COMMAND", "Invalid controller time");
  if (typeof command.sceneRevision !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(command.sceneRevision)) {
    refuse3("INVALID_COMMAND", "Invalid controller revision");
  }
  const desiredVelocityMps = tuple2(command.desiredVelocityMps, 1, "INVALID_COMMAND");
  if (desiredVelocityMps[1] !== 0 || Math.hypot(desiredVelocityMps[0], desiredVelocityMps[2]) > 1) {
    refuse3("INVALID_COMMAND", "Controller horizontal request exceeds its bound");
  }
  return { dtSeconds: command.dtSeconds, sceneRevision: command.sceneRevision, desiredVelocityMps };
}
function admitCoreCommand(dt, velocity, revision, stateRevision, stepIndex) {
  const command = admitCommand({ dtSeconds: dt, sceneRevision: revision, desiredVelocityMps: velocity });
  if (command.dtSeconds !== DT) throw new PhysicsError5("INVALID_STEP", "Controller requires exactly 1/120 second");
  if (command.sceneRevision !== stateRevision) throw new PhysicsError5("STALE_SNAPSHOT", "Controller revision mismatch");
  if (stepIndex >= STEPS) throw new PhysicsError5("WORLD_LIMIT", "Controller step limit exhausted");
  return command.desiredVelocityMps;
}

// src/character/math.ts
var dot4 = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
var add2 = (a, b) => a.map((value, index) => value + b[index]);
var scale2 = (a, factor) => a.map((value) => value * factor);
var norm = (a) => Math.hypot(...a);
function clone(value) {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) result[key] = clone(value[key]);
    return result;
  }
  return value;
}

// src/character/state.ts
function initialState(positionM, sceneRevision) {
  return {
    stepIndex: 0,
    timeSeconds: 0,
    positionM: [...positionM],
    velocityMps: [0, 0, 0],
    fallVelocityYMps: 0,
    orientationXYZW: [0, 0, 0, 1],
    grounded: false,
    support: null,
    blocked: false,
    assist: null,
    sceneRevision,
    queryCount: 0,
    lastQueries: [],
    lastSegments: [],
    gravityPrediction: null
  };
}
function projectState(state) {
  return {
    version: 1,
    profile: PROFILE2,
    sceneRevision: state.sceneRevision,
    stepIndex: state.stepIndex,
    timeSeconds: state.timeSeconds,
    positionM: [...state.positionM],
    velocityMps: [...state.velocityMps],
    orientationXYZW: [...state.orientationXYZW],
    fallVelocityYMps: state.fallVelocityYMps,
    grounded: state.grounded,
    support: clone(state.support),
    blocked: state.blocked,
    assist: clone(state.assist),
    queryCount: state.queryCount
  };
}
function validateState(position, velocity, request, previous) {
  if (position.some((value) => !Number.isFinite(value) || Math.abs(value) > 5) || velocity.some((value) => !Number.isFinite(value)) || norm(velocity) > 20) {
    throw new PhysicsError5("NUMERIC_LIMIT", "Controller state exceeds its bound");
  }
  const actual = position.map((value, index) => value - previous.positionM[index]);
  const horizontal = Math.hypot(actual[0], actual[2]), allowed = Math.hypot(request[0], request[2]) * DT;
  if (horizontal > allowed + 1e-9 || Math.abs(actual[1]) > 0.1 + 1e-6) {
    throw new PhysicsError5("NUMERIC_LIMIT", "Controller movement exceeds its bound");
  }
}
function errorRecord(error2) {
  const value = error2;
  return { name: value.name ?? "Error", code: value.code, message: value.message ?? String(error2) };
}

// src/character/query.ts
function queryContext(query, candidate, diagnostic, capture) {
  function raw(position, delta, kind, preview, excludeId = null) {
    if (candidate.queryCount >= (diagnostic.queryBudget ?? QUERY_CAP)) {
      throw new PhysicsError5("WORLD_LIMIT", "Controller per-step query limit exhausted");
    }
    const input = {
      revision: candidate.sceneRevision,
      centerM: [...position],
      displacementM: [...delta],
      excludeId
    };
    const index = candidate.queryCount;
    candidate.queryCount++;
    let hit;
    try {
      hit = query.sweep(input);
    } catch (error2) {
      if (capture) candidate.lastQueries.push({ kind, preview, input: clone(input), hit: null, error: errorRecord(error2) });
      throw error2;
    }
    if (capture) candidate.lastQueries.push({ kind, preview, input: clone(input), hit: clone(hit), error: null });
    return { hit, indices: [index] };
  }
  function sweep(position, delta, kind, preview = false) {
    const first = raw(position, delta, kind, preview);
    if (first.hit?.toiFraction === 0 && dot4(first.hit.normalFixtureToCapsule, delta) >= -1e-12) {
      const second = raw(position, delta, kind + "-fresh-touch-departure", preview, first.hit.bodyId);
      if (second.hit?.toiFraction === 0) throw new PhysicsError5("INVALID_COMMAND", "Controller second fresh touch is unresolved");
      return { hit: second.hit, indices: [...first.indices, ...second.indices] };
    }
    return first;
  }
  function commit(position, delta, kind, indices) {
    const target = position.map((value, index) => value + delta[index]);
    if (capture) candidate.lastSegments.push({
      kind,
      fromM: [...position],
      displacementM: [...delta],
      toM: [...target],
      queryIndices: [...indices]
    });
    return target;
  }
  return { sweep, commit };
}

// src/character/step-assist.ts
function tryStep(position, remaining, candidate, context) {
  const horizontal = [remaining[0], 0, remaining[2]], length = norm(horizontal);
  if (length <= 1e-12 || !candidate.grounded) return null;
  const direction = scale2(horizontal, 1 / length);
  const up = context.sweep(position, [0, STEP_HEIGHT, 0], "step-up-probe", true);
  if (up.hit) return null;
  const raised = add2(position, [0, STEP_HEIGHT, 0]);
  const forward = context.sweep(raised, scale2(direction, PREVIEW), "step-ahead-probe", true);
  if (forward.hit) return null;
  const preview = add2(raised, scale2(direction, PREVIEW));
  const down = context.sweep(preview, [0, -STEP_DOWN, 0], "step-down-probe", true);
  if (!down.hit || down.hit.normalFixtureToCapsule[1] < WALKABLE) return null;
  const targetY = raised[1] - STEP_DOWN * down.hit.toiFraction + SKIN / down.hit.normalFixtureToCapsule[1];
  const rise = targetY - position[1];
  if (rise <= 1e-9 || rise > STEP_HEIGHT + 1e-6) return null;
  const actualRaised = add2(position, [0, rise, 0]);
  const actual = context.sweep(actualRaised, horizontal, "step-actual-forward", false);
  if (actual.hit) return null;
  let moved = context.commit(position, [0, rise, 0], "step-up", up.indices);
  moved = context.commit(moved, horizontal, "step-forward", actual.indices);
  candidate.assist = { bodyId: down.hit.bodyId, heightM: targetY, directionXZ: [direction[0], direction[2]], frames: 0 };
  candidate.fallVelocityYMps = 0;
  candidate.grounded = false;
  candidate.support = null;
  return moved;
}
function validateAssist(position, candidate, context, diagnostic) {
  if (!candidate.assist) return;
  const direction = [candidate.assist.directionXZ[0], 0, candidate.assist.directionXZ[1]];
  const ahead = context.sweep(position, scale2(direction, PREVIEW), "assist-ahead", true);
  if (ahead.hit) throw new PhysicsError5("INVALID_COMMAND", "Controller assist forward path is blocked");
  const down = context.sweep(add2(position, scale2(direction, PREVIEW)), [0, -STEP_DOWN, 0], "assist-support", true);
  const hit = down.hit;
  const target = hit ? position[1] - STEP_DOWN * hit.toiFraction + SKIN / hit.normalFixtureToCapsule[1] : NaN;
  if (!hit || hit.normalFixtureToCapsule[1] < WALKABLE || hit.bodyId !== candidate.assist.bodyId || Math.abs(target - candidate.assist.heightM) > 1e-6) {
    throw new PhysicsError5("INVALID_COMMAND", "Controller assist support is unresolved");
  }
  candidate.assist.frames++;
  if (candidate.assist.frames > (diagnostic.assistCap ?? ASSIST_CAP)) {
    throw new PhysicsError5("WORLD_LIMIT", "Controller assist duration limit exhausted");
  }
}

// src/character/slide.ts
function move(position, delta, candidate, context, diagnostic) {
  let p = [...position], remaining = [...delta];
  for (let pass = 0; pass < (diagnostic.slideBudget ?? SLIDE_CAP); pass++) {
    if (norm(remaining) <= 1e-12) return p;
    const length = norm(remaining), direction = scale2(remaining, 1 / length), probeLength = length + LOOKAHEAD;
    const result = context.sweep(p, scale2(direction, probeLength), "slide-lookahead", true), hit = result.hit;
    if (!hit) return context.commit(p, remaining, "travel", result.indices);
    const normal = hit.normalFixtureToCapsule, closingUnit = -dot4(normal, direction);
    if (closingUnit <= 1e-12) throw new PhysicsError5("INVALID_COMMAND", "Controller lookahead closing normal is unresolved");
    const contactDistance = probeLength * hit.toiFraction;
    const safeDistance = Math.max(0, contactDistance - SKIN / closingUnit);
    const fraction = Math.min(1, safeDistance / length);
    const travel = scale2(remaining, fraction);
    if (norm(travel) > 0) p = context.commit(p, travel, "travel", result.indices);
    if (fraction === 1) return p;
    remaining = scale2(remaining, 1 - fraction);
    if (normal[1] < WALKABLE) {
      const stepped = tryStep(p, remaining, candidate, context);
      if (stepped) return stepped;
      candidate.blocked = true;
      const horizontalNormal = [normal[0], 0, normal[2]], size2 = norm(horizontalNormal);
      if (size2 > 1e-12) {
        const unit = scale2(horizontalNormal, 1 / size2), into = dot4(remaining, unit);
        if (into < 0) remaining = add2(remaining, scale2(unit, -into));
      }
      if (normal[1] > 1e-12 && remaining[1] < 0) {
        remaining[1] = 0;
        candidate.fallVelocityYMps = 0;
      } else if (normal[1] < -1e-12 && remaining[1] > 0) remaining[1] = 0;
    } else {
      const into = dot4(remaining, normal);
      if (into < 0) remaining = add2(remaining, scale2(normal, -into));
      candidate.fallVelocityYMps = 0;
    }
  }
  if (norm(remaining) > 1e-12) throw new PhysicsError5("WORLD_LIMIT", "Controller slide limit exhausted");
  return p;
}

// src/character/ground.ts
function snap(position, candidate, context) {
  const down = context.sweep(position, [0, -SNAP, 0], "ground-probe", true), hit = down.hit;
  if (!hit || hit.normalFixtureToCapsule[1] < WALKABLE) {
    candidate.grounded = false;
    candidate.support = null;
    return position;
  }
  const targetY = position[1] - SNAP * hit.toiFraction + SKIN / hit.normalFixtureToCapsule[1];
  const delta = [0, targetY - position[1], 0];
  let proof = down.indices;
  if (delta[1] > 0) {
    const up = context.sweep(position, delta, "positive-snap-validation");
    if (up.hit) throw new PhysicsError5("INVALID_COMMAND", "Controller positive snap is blocked");
    proof = up.indices;
  }
  const p = context.commit(position, delta, "ground-snap", proof);
  candidate.grounded = true;
  candidate.support = { bodyId: hit.bodyId, normal: [...hit.normalFixtureToCapsule] };
  candidate.fallVelocityYMps = 0;
  candidate.assist = null;
  return p;
}

// src/character/core.ts
function createCharacterCore(scene, positionM, diagnostic = {}, options = {}) {
  const admitted = admitConfig({ version: 1, profile: PROFILE2, scene, positionM });
  const query = createUprightCapsuleQuery(admitted.scene);
  let state;
  try {
    const snapshot = query.getSnapshot();
    query.sweep({ revision: snapshot.revision, centerM: [...admitted.positionM], displacementM: [0, 0, 0], excludeId: null });
    state = initialState(admitted.positionM, snapshot.revision);
  } catch (error2) {
    query.dispose();
    throw error2;
  }
  const capture = options.capture ?? true;
  let lastRejected = null, disposed = false;
  function live() {
    if (disposed) throw new PhysicsError5("DISPOSED", "Capsule controller is disposed");
  }
  return {
    getState() {
      live();
      return clone(state);
    },
    getLastRejected() {
      return clone(lastRejected);
    },
    step(dt, velocity, revision = state.sceneRevision) {
      live();
      let attempted = null;
      try {
        const request = admitCoreCommand(dt, velocity, revision, state.sceneRevision, state.stepIndex);
        const next = clone(state);
        attempted = next;
        next.queryCount = 0;
        next.lastQueries = [];
        next.lastSegments = [];
        next.blocked = false;
        const assisted = !!state.assist, speed = Math.hypot(request[0], request[2]);
        if (assisted && (speed === 0 || Math.abs(request[0] / speed - state.assist.directionXZ[0]) > 1e-12 || Math.abs(request[2] / speed - state.assist.directionXZ[1]) > 1e-12)) {
          throw new PhysicsError5("INVALID_COMMAND", "Controller assist request changed");
        }
        const predicted = state.grounded || assisted ? 0 : state.fallVelocityYMps + GRAVITY * DT;
        next.fallVelocityYMps = predicted;
        next.gravityPrediction = capture ? {
          previousFallVelocityYMps: state.fallVelocityYMps,
          previousGrounded: state.grounded,
          previousAssisted: assisted,
          predictedFallVelocityYMps: predicted,
          predictedDeltaYM: predicted * DT
        } : null;
        const context = queryContext(query, next, diagnostic, capture);
        const delta = [request[0] * DT, predicted * DT, request[2] * DT];
        let p = move(state.positionM, delta, next, context, diagnostic);
        p = snap(p, next, context);
        validateAssist(p, next, context, diagnostic);
        if (diagnostic.numericFault) throw new PhysicsError5("NUMERIC_LIMIT", "Internal controller numeric fault");
        const actualVelocity = p.map((value, index) => (value - state.positionM[index]) / DT);
        validateState(p, actualVelocity, request, state);
        next.positionM = p;
        next.velocityMps = actualVelocity;
        next.stepIndex++;
        next.timeSeconds = next.stepIndex * DT;
        state = next;
        lastRejected = null;
        return clone(state);
      } catch (error2) {
        if (capture) lastRejected = { acceptedState: clone(state), attemptedState: clone(attempted), error: errorRecord(error2) };
        throw error2;
      }
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        query.dispose();
      }
    }
  };
}

// src/character-controller.ts
function createUprightCapsuleController(config) {
  const admitted = admitConfig(config);
  const core = createCharacterCore(admitted.scene, admitted.positionM, {}, { capture: false });
  let disposed = false;
  function live() {
    if (disposed) throw new PhysicsError5("DISPOSED", "Capsule controller is disposed");
  }
  return {
    getSnapshot() {
      live();
      return projectState(core.getState());
    },
    step(input) {
      live();
      const command = admitCommand(input);
      return projectState(core.step(command.dtSeconds, command.desiredVelocityMps, command.sceneRevision));
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        core.dispose();
      }
    }
  };
}
export {
  createPhysicsWorld,
  createUprightCapsuleController,
  createUprightCapsuleQuery
};
