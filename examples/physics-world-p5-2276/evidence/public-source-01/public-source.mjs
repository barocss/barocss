var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/barocss-physics/src/index.ts
var src_exports = {};
__export(src_exports, {
  PhysicsError: () => PhysicsError,
  createPhysicsWorld: () => createPhysicsWorld,
  createUprightCapsuleController: () => createUprightCapsuleController,
  createUprightCapsuleQuery: () => createUprightCapsuleQuery
});

// packages/barocss-physics/src/types.ts
var types_exports = {};
__export(types_exports, {
  PhysicsError: () => PhysicsError
});
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
  function copy2(value, depth) {
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
      return Array.from({ length: value.length }, (_, i) => copy2(descriptors[i].value, depth + 1));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype || keys.some((key) => typeof key !== "string" || !/^[\x20-\x7e]+$/.test(key) || !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
      throw new PhysicsError("INVALID_CONFIG", "records must have plain ASCII data fields");
    }
    return Object.fromEntries(keys.map((key) => [key, copy2(descriptors[key].value, depth + 1)]));
  }
  return copy2(input, 0);
}
function canonicalEncode(input) {
  globalThis.__p5Public.hit("canonicalEncode");
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
    const record7 = item;
    const keys = Object.keys(record7).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record7[key]);
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
  const view4 = new DataView(padded.buffer);
  const bits = bytes.length * 8;
  view4.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
  view4.setUint32(padded.length - 4, bits >>> 0);
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view4.getUint32(offset + i * 4);
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
  for (const [index, raw2] of input.entries()) {
    if (raw2 === null || typeof raw2 !== "object" || Array.isArray(raw2) || Object.getPrototypeOf(raw2) !== Object.prototype && Object.getPrototypeOf(raw2) !== null) {
      error("INVALID_COMMAND", `command ${index} must be a plain object`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw2);
    const keys = Reflect.ownKeys(raw2);
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
  const scale4 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale4,
    angularVelocity[1] * scale4,
    angularVelocity[2] * scale4,
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
var inverse = (q2) => [-q2[0], -q2[1], -q2[2], q2[3]];
function rotate2(q2, v) {
  const axis = [q2[0], q2[1], q2[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q2[3]), cross(axis, t)));
}
var localPoint = (body, point) => rotate2(inverse(body.orientation), sub(point, body.positionM));
var worldPoint = (body, point) => add(body.positionM, rotate2(body.orientation, point));
function inverseInertia(body, vector3) {
  const local = rotate2(inverse(body.orientation), vector3);
  return rotate2(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}
function inertia(body, vector3) {
  const local = rotate2(inverse(body.orientation), vector3);
  return rotate2(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]));
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
  const armA = rotate2(a.orientation, anchorA);
  const armB = rotate2(b.orientation, anchorB);
  const separation = sub(worldPoint(b, anchorB), worldPoint(a, anchorA));
  if (Math.hypot(...separation) > MAX_STEP_DISPLACEMENT_M) {
    error("NUMERIC_LIMIT", "dynamic pair anchor separation exceeds limit");
  }
  const basis3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const columns = basis3.map((axis) => add(
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

// packages/barocss-physics/src/dynamic-fixed-joint.ts
function orientationError(actual, desired) {
  const relative = multiplyQuaternion(actual, inverse(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector3 = scale([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector3);
  if (sine < 1e-12) return scale(vector3, 2);
  return scale(vector3, 2 * Math.atan2(sine, sign * relative[3]) / sine);
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
  const basis3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const angularColumns = basis3.map((axis) => add(inverseInertia(a, axis), inverseInertia(b, axis)));
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

// packages/barocss-physics/src/dynamic-hinge-joint.ts
var magnitude = (vector3) => Math.hypot(...vector3);
var near = (a, b) => magnitude(sub(a, b)) <= 1e-9;
function offsetFixture(joint, a, b) {
  return near(a.positionM, [-0.1, 0, 0]) && near(b.positionM, [0.1, 0, 0]) && near(joint.anchorALocalM, [0.1, 0, 0]) && near(joint.anchorBLocalM, [-0.1, 0, 0]) && near(joint.axisWorld, [0, 0, 1]) && Math.abs(joint.limitRad[0] + 0.8) <= 1e-9 && Math.abs(joint.limitRad[1] - 0.8) <= 1e-9 && a.inverseMass === 1 && b.inverseMass === 1 && a.shape.kind === "sphere" && b.shape.kind === "sphere" && a.shape.radiusM === 0.1 && b.shape.radiusM === 0.1 && joint.motor?.targetSpeedRadps === 0.5 && joint.motor.maxImpulseNms === 1e-4 && joint.motor.maxReactionNms === 0.01;
}
function admitDynamicHingeScene(joint, bodies, gravity) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity4 = [0, 0, 0, 1];
  const centred = near(a.positionM, b.positionM) && magnitude(joint.anchorALocalM) === 0 && magnitude(joint.anchorBLocalM) === 0;
  if (magnitude(gravity) !== 0 || !centred && !offsetFixture(joint, a, b) || [a, b].some((body) => magnitude(body.velocityMps) !== 0 || magnitude(body.angularVelocityRadps) !== 0 || body.orientation.some((value, index) => Math.abs(value - identity4[index]) > 1e-12))) {
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
  const raw2 = 2 * Math.atan2(signed, relative[3]);
  const wrapped = raw2 > Math.PI ? raw2 - 2 * Math.PI : raw2 < -Math.PI ? raw2 + 2 * Math.PI : raw2;
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
  const joints = value.map((raw2) => {
    const input = record(raw2, "joint");
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
      const limits3 = input.limitRad;
      if (!Array.isArray(limits3) || limits3.length !== 2 || Reflect.ownKeys(limits3).length !== 3 || ![0, 1].every((index) => Object.hasOwn(limits3, index))) {
        error("INVALID_CONFIG", "hinge limits must be a dense pair");
      }
      const low = finite(limits3[0], -Math.PI / 2, 0, "limitRad[0]");
      const high = finite(limits3[1], 0, Math.PI / 2, "limitRad[1]");
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
    const raw2 = 2 * Math.atan2(signed, delta[3]);
    const wrapped = raw2 > Math.PI ? raw2 - 2 * Math.PI : raw2 < -Math.PI ? raw2 + 2 * Math.PI : raw2;
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

// packages/barocss-physics/src/disjoint-hinge/admission.ts
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

// packages/barocss-physics/src/cloth/profile.ts
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

// packages/barocss-physics/src/fluid/constants.ts
var FLUID_COUNT = 256;
var FLUID_STEP_SECONDS = 1 / 120;
var FLUID_MAX_STEPS = 3600;
var FLUID_BASIN_M = [0.7, 1.3, 0.5];
var FLUID_GRAVITY_MPS2 = [0, -9.81, 0];
var FLUID_SPACING_M = 0.05;
var FLUID_MIN_SPACING_M = 0.025;
var FLUID_PARTICLE_RADIUS_M = 0.0125;
var FLUID_SMOOTHING_RADIUS_M = 1.8 * FLUID_SPACING_M;

// packages/barocss-physics/src/fluid/static-box.ts
function inflatedBoxBounds(centerM, halfExtentsM) {
  globalThis.__p5Public.hit("inflatedBoxBounds");
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

// packages/barocss-physics/src/domain/cloth-reference.generated.ts
function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
var nativeClothReference = freeze({ "id": "p5Cloth", "restPositionsM": [[-0.5, 0.55, -0.5], [-0.4375, 0.55, -0.5], [-0.375, 0.55, -0.5], [-0.3125, 0.55, -0.5], [-0.25, 0.55, -0.5], [-0.1875, 0.55, -0.5], [-0.125, 0.55, -0.5], [-0.0625, 0.55, -0.5], [0, 0.55, -0.5], [0.0625, 0.55, -0.5], [0.125, 0.55, -0.5], [0.1875, 0.55, -0.5], [0.25, 0.55, -0.5], [0.3125, 0.55, -0.5], [0.375, 0.55, -0.5], [0.4375, 0.55, -0.5], [0.5, 0.55, -0.5], [-0.5, 0.55, -0.4375], [-0.4375, 0.55, -0.4375], [-0.375, 0.55, -0.4375], [-0.3125, 0.55, -0.4375], [-0.25, 0.55, -0.4375], [-0.1875, 0.55, -0.4375], [-0.125, 0.55, -0.4375], [-0.0625, 0.55, -0.4375], [0, 0.55, -0.4375], [0.0625, 0.55, -0.4375], [0.125, 0.55, -0.4375], [0.1875, 0.55, -0.4375], [0.25, 0.55, -0.4375], [0.3125, 0.55, -0.4375], [0.375, 0.55, -0.4375], [0.4375, 0.55, -0.4375], [0.5, 0.55, -0.4375], [-0.5, 0.55, -0.375], [-0.4375, 0.55, -0.375], [-0.375, 0.55, -0.375], [-0.3125, 0.55, -0.375], [-0.25, 0.55, -0.375], [-0.1875, 0.55, -0.375], [-0.125, 0.55, -0.375], [-0.0625, 0.55, -0.375], [0, 0.55, -0.375], [0.0625, 0.55, -0.375], [0.125, 0.55, -0.375], [0.1875, 0.55, -0.375], [0.25, 0.55, -0.375], [0.3125, 0.55, -0.375], [0.375, 0.55, -0.375], [0.4375, 0.55, -0.375], [0.5, 0.55, -0.375], [-0.5, 0.55, -0.3125], [-0.4375, 0.55, -0.3125], [-0.375, 0.55, -0.3125], [-0.3125, 0.55, -0.3125], [-0.25, 0.55, -0.3125], [-0.1875, 0.55, -0.3125], [-0.125, 0.55, -0.3125], [-0.0625, 0.55, -0.3125], [0, 0.55, -0.3125], [0.0625, 0.55, -0.3125], [0.125, 0.55, -0.3125], [0.1875, 0.55, -0.3125], [0.25, 0.55, -0.3125], [0.3125, 0.55, -0.3125], [0.375, 0.55, -0.3125], [0.4375, 0.55, -0.3125], [0.5, 0.55, -0.3125], [-0.5, 0.55, -0.25], [-0.4375, 0.55, -0.25], [-0.375, 0.55, -0.25], [-0.3125, 0.55, -0.25], [-0.25, 0.55, -0.25], [-0.1875, 0.55, -0.25], [-0.125, 0.55, -0.25], [-0.0625, 0.55, -0.25], [0, 0.55, -0.25], [0.0625, 0.55, -0.25], [0.125, 0.55, -0.25], [0.1875, 0.55, -0.25], [0.25, 0.55, -0.25], [0.3125, 0.55, -0.25], [0.375, 0.55, -0.25], [0.4375, 0.55, -0.25], [0.5, 0.55, -0.25], [-0.5, 0.55, -0.1875], [-0.4375, 0.55, -0.1875], [-0.375, 0.55, -0.1875], [-0.3125, 0.55, -0.1875], [-0.25, 0.55, -0.1875], [-0.1875, 0.55, -0.1875], [-0.125, 0.55, -0.1875], [-0.0625, 0.55, -0.1875], [0, 0.55, -0.1875], [0.0625, 0.55, -0.1875], [0.125, 0.55, -0.1875], [0.1875, 0.55, -0.1875], [0.25, 0.55, -0.1875], [0.3125, 0.55, -0.1875], [0.375, 0.55, -0.1875], [0.4375, 0.55, -0.1875], [0.5, 0.55, -0.1875], [-0.5, 0.55, -0.125], [-0.4375, 0.55, -0.125], [-0.375, 0.55, -0.125], [-0.3125, 0.55, -0.125], [-0.25, 0.55, -0.125], [-0.1875, 0.55, -0.125], [-0.125, 0.55, -0.125], [-0.0625, 0.55, -0.125], [0, 0.55, -0.125], [0.0625, 0.55, -0.125], [0.125, 0.55, -0.125], [0.1875, 0.55, -0.125], [0.25, 0.55, -0.125], [0.3125, 0.55, -0.125], [0.375, 0.55, -0.125], [0.4375, 0.55, -0.125], [0.5, 0.55, -0.125], [-0.5, 0.55, -0.0625], [-0.4375, 0.55, -0.0625], [-0.375, 0.55, -0.0625], [-0.3125, 0.55, -0.0625], [-0.25, 0.55, -0.0625], [-0.1875, 0.55, -0.0625], [-0.125, 0.55, -0.0625], [-0.0625, 0.55, -0.0625], [0, 0.55, -0.0625], [0.0625, 0.55, -0.0625], [0.125, 0.55, -0.0625], [0.1875, 0.55, -0.0625], [0.25, 0.55, -0.0625], [0.3125, 0.55, -0.0625], [0.375, 0.55, -0.0625], [0.4375, 0.55, -0.0625], [0.5, 0.55, -0.0625], [-0.5, 0.55, 0], [-0.4375, 0.55, 0], [-0.375, 0.55, 0], [-0.3125, 0.55, 0], [-0.25, 0.55, 0], [-0.1875, 0.55, 0], [-0.125, 0.55, 0], [-0.0625, 0.55, 0], [0, 0.55, 0], [0.0625, 0.55, 0], [0.125, 0.55, 0], [0.1875, 0.55, 0], [0.25, 0.55, 0], [0.3125, 0.55, 0], [0.375, 0.55, 0], [0.4375, 0.55, 0], [0.5, 0.55, 0], [-0.5, 0.55, 0.0625], [-0.4375, 0.55, 0.0625], [-0.375, 0.55, 0.0625], [-0.3125, 0.55, 0.0625], [-0.25, 0.55, 0.0625], [-0.1875, 0.55, 0.0625], [-0.125, 0.55, 0.0625], [-0.0625, 0.55, 0.0625], [0, 0.55, 0.0625], [0.0625, 0.55, 0.0625], [0.125, 0.55, 0.0625], [0.1875, 0.55, 0.0625], [0.25, 0.55, 0.0625], [0.3125, 0.55, 0.0625], [0.375, 0.55, 0.0625], [0.4375, 0.55, 0.0625], [0.5, 0.55, 0.0625], [-0.5, 0.55, 0.125], [-0.4375, 0.55, 0.125], [-0.375, 0.55, 0.125], [-0.3125, 0.55, 0.125], [-0.25, 0.55, 0.125], [-0.1875, 0.55, 0.125], [-0.125, 0.55, 0.125], [-0.0625, 0.55, 0.125], [0, 0.55, 0.125], [0.0625, 0.55, 0.125], [0.125, 0.55, 0.125], [0.1875, 0.55, 0.125], [0.25, 0.55, 0.125], [0.3125, 0.55, 0.125], [0.375, 0.55, 0.125], [0.4375, 0.55, 0.125], [0.5, 0.55, 0.125], [-0.5, 0.55, 0.1875], [-0.4375, 0.55, 0.1875], [-0.375, 0.55, 0.1875], [-0.3125, 0.55, 0.1875], [-0.25, 0.55, 0.1875], [-0.1875, 0.55, 0.1875], [-0.125, 0.55, 0.1875], [-0.0625, 0.55, 0.1875], [0, 0.55, 0.1875], [0.0625, 0.55, 0.1875], [0.125, 0.55, 0.1875], [0.1875, 0.55, 0.1875], [0.25, 0.55, 0.1875], [0.3125, 0.55, 0.1875], [0.375, 0.55, 0.1875], [0.4375, 0.55, 0.1875], [0.5, 0.55, 0.1875], [-0.5, 0.55, 0.25], [-0.4375, 0.55, 0.25], [-0.375, 0.55, 0.25], [-0.3125, 0.55, 0.25], [-0.25, 0.55, 0.25], [-0.1875, 0.55, 0.25], [-0.125, 0.55, 0.25], [-0.0625, 0.55, 0.25], [0, 0.55, 0.25], [0.0625, 0.55, 0.25], [0.125, 0.55, 0.25], [0.1875, 0.55, 0.25], [0.25, 0.55, 0.25], [0.3125, 0.55, 0.25], [0.375, 0.55, 0.25], [0.4375, 0.55, 0.25], [0.5, 0.55, 0.25], [-0.5, 0.55, 0.3125], [-0.4375, 0.55, 0.3125], [-0.375, 0.55, 0.3125], [-0.3125, 0.55, 0.3125], [-0.25, 0.55, 0.3125], [-0.1875, 0.55, 0.3125], [-0.125, 0.55, 0.3125], [-0.0625, 0.55, 0.3125], [0, 0.55, 0.3125], [0.0625, 0.55, 0.3125], [0.125, 0.55, 0.3125], [0.1875, 0.55, 0.3125], [0.25, 0.55, 0.3125], [0.3125, 0.55, 0.3125], [0.375, 0.55, 0.3125], [0.4375, 0.55, 0.3125], [0.5, 0.55, 0.3125], [-0.5, 0.55, 0.375], [-0.4375, 0.55, 0.375], [-0.375, 0.55, 0.375], [-0.3125, 0.55, 0.375], [-0.25, 0.55, 0.375], [-0.1875, 0.55, 0.375], [-0.125, 0.55, 0.375], [-0.0625, 0.55, 0.375], [0, 0.55, 0.375], [0.0625, 0.55, 0.375], [0.125, 0.55, 0.375], [0.1875, 0.55, 0.375], [0.25, 0.55, 0.375], [0.3125, 0.55, 0.375], [0.375, 0.55, 0.375], [0.4375, 0.55, 0.375], [0.5, 0.55, 0.375], [-0.5, 0.55, 0.4375], [-0.4375, 0.55, 0.4375], [-0.375, 0.55, 0.4375], [-0.3125, 0.55, 0.4375], [-0.25, 0.55, 0.4375], [-0.1875, 0.55, 0.4375], [-0.125, 0.55, 0.4375], [-0.0625, 0.55, 0.4375], [0, 0.55, 0.4375], [0.0625, 0.55, 0.4375], [0.125, 0.55, 0.4375], [0.1875, 0.55, 0.4375], [0.25, 0.55, 0.4375], [0.3125, 0.55, 0.4375], [0.375, 0.55, 0.4375], [0.4375, 0.55, 0.4375], [0.5, 0.55, 0.4375], [-0.5, 0.55, 0.5], [-0.4375, 0.55, 0.5], [-0.375, 0.55, 0.5], [-0.3125, 0.55, 0.5], [-0.25, 0.55, 0.5], [-0.1875, 0.55, 0.5], [-0.125, 0.55, 0.5], [-0.0625, 0.55, 0.5], [0, 0.55, 0.5], [0.0625, 0.55, 0.5], [0.125, 0.55, 0.5], [0.1875, 0.55, 0.5], [0.25, 0.55, 0.5], [0.3125, 0.55, 0.5], [0.375, 0.55, 0.5], [0.4375, 0.55, 0.5], [0.5, 0.55, 0.5]], "initialPositionsM": [[-0.5, 0.55, -0.5], [-0.4375, 0.55, -0.5], [-0.375, 0.55, -0.5], [-0.3125, 0.55, -0.5], [-0.25, 0.55, -0.5], [-0.1875, 0.55, -0.5], [-0.125, 0.55, -0.5], [-0.0625, 0.55, -0.5], [0, 0.55, -0.5], [0.0625, 0.55, -0.5], [0.125, 0.55, -0.5], [0.1875, 0.55, -0.5], [0.25, 0.55, -0.5], [0.3125, 0.55, -0.5], [0.375, 0.55, -0.5], [0.4375, 0.55, -0.5], [0.5, 0.55, -0.5], [-0.5, 0.55, -0.4375], [-0.4375, 0.55, -0.4375], [-0.375, 0.55, -0.4375], [-0.3125, 0.55, -0.4375], [-0.25, 0.55, -0.4375], [-0.1875, 0.55, -0.4375], [-0.125, 0.55, -0.4375], [-0.0625, 0.55, -0.4375], [0, 0.55, -0.4375], [0.0625, 0.55, -0.4375], [0.125, 0.55, -0.4375], [0.1875, 0.55, -0.4375], [0.25, 0.55, -0.4375], [0.3125, 0.55, -0.4375], [0.375, 0.55, -0.4375], [0.4375, 0.55, -0.4375], [0.5, 0.55, -0.4375], [-0.5, 0.55, -0.375], [-0.4375, 0.55, -0.375], [-0.375, 0.55, -0.375], [-0.3125, 0.55, -0.375], [-0.25, 0.55, -0.375], [-0.1875, 0.55, -0.375], [-0.125, 0.55, -0.375], [-0.0625, 0.55, -0.375], [0, 0.55, -0.375], [0.0625, 0.55, -0.375], [0.125, 0.55, -0.375], [0.1875, 0.55, -0.375], [0.25, 0.55, -0.375], [0.3125, 0.55, -0.375], [0.375, 0.55, -0.375], [0.4375, 0.55, -0.375], [0.5, 0.55, -0.375], [-0.5, 0.55, -0.3125], [-0.4375, 0.55, -0.3125], [-0.375, 0.55, -0.3125], [-0.3125, 0.55, -0.3125], [-0.25, 0.55, -0.3125], [-0.1875, 0.55, -0.3125], [-0.125, 0.55, -0.3125], [-0.0625, 0.55, -0.3125], [0, 0.55, -0.3125], [0.0625, 0.55, -0.3125], [0.125, 0.55, -0.3125], [0.1875, 0.55, -0.3125], [0.25, 0.55, -0.3125], [0.3125, 0.55, -0.3125], [0.375, 0.55, -0.3125], [0.4375, 0.55, -0.3125], [0.5, 0.55, -0.3125], [-0.5, 0.55, -0.25], [-0.4375, 0.55, -0.25], [-0.375, 0.55, -0.25], [-0.3125, 0.55, -0.25], [-0.25, 0.55, -0.25], [-0.1875, 0.55, -0.25], [-0.125, 0.55, -0.25], [-0.0625, 0.55, -0.25], [0, 0.55, -0.25], [0.0625, 0.55, -0.25], [0.125, 0.55, -0.25], [0.1875, 0.55, -0.25], [0.25, 0.55, -0.25], [0.3125, 0.55, -0.25], [0.375, 0.55, -0.25], [0.4375, 0.55, -0.25], [0.5, 0.55, -0.25], [-0.5, 0.55, -0.1875], [-0.4375, 0.55, -0.1875], [-0.375, 0.55, -0.1875], [-0.3125, 0.55, -0.1875], [-0.25, 0.55, -0.1875], [-0.1875, 0.55, -0.1875], [-0.125, 0.55, -0.1875], [-0.0625, 0.55, -0.1875], [0, 0.55, -0.1875], [0.0625, 0.55, -0.1875], [0.125, 0.55, -0.1875], [0.1875, 0.55, -0.1875], [0.25, 0.55, -0.1875], [0.3125, 0.55, -0.1875], [0.375, 0.55, -0.1875], [0.4375, 0.55, -0.1875], [0.5, 0.55, -0.1875], [-0.5, 0.55, -0.125], [-0.4375, 0.55, -0.125], [-0.375, 0.55, -0.125], [-0.3125, 0.55, -0.125], [-0.25, 0.55, -0.125], [-0.1875, 0.55, -0.125], [-0.125, 0.55, -0.125], [-0.0625, 0.55, -0.125], [0, 0.55, -0.125], [0.0625, 0.55, -0.125], [0.125, 0.55, -0.125], [0.1875, 0.55, -0.125], [0.25, 0.55, -0.125], [0.3125, 0.55, -0.125], [0.375, 0.55, -0.125], [0.4375, 0.55, -0.125], [0.5, 0.55, -0.125], [-0.5, 0.55, -0.0625], [-0.4375, 0.55, -0.0625], [-0.375, 0.55, -0.0625], [-0.3125, 0.55, -0.0625], [-0.25, 0.55, -0.0625], [-0.1875, 0.55, -0.0625], [-0.125, 0.55, -0.0625], [-0.0625, 0.55, -0.0625], [0, 0.55, -0.0625], [0.0625, 0.55, -0.0625], [0.125, 0.55, -0.0625], [0.1875, 0.55, -0.0625], [0.25, 0.55, -0.0625], [0.3125, 0.55, -0.0625], [0.375, 0.55, -0.0625], [0.4375, 0.55, -0.0625], [0.5, 0.55, -0.0625], [-0.5, 0.55, 0], [-0.4375, 0.55, 0], [-0.375, 0.55, 0], [-0.3125, 0.55, 0], [-0.25, 0.55, 0], [-0.1875, 0.55, 0], [-0.125, 0.55, 0], [-0.0625, 0.55, 0], [0, 0.55, 0], [0.0625, 0.55, 0], [0.125, 0.55, 0], [0.1875, 0.55, 0], [0.25, 0.55, 0], [0.3125, 0.55, 0], [0.375, 0.55, 0], [0.4375, 0.55, 0], [0.5, 0.55, 0], [-0.5, 0.55, 0.0625], [-0.4375, 0.55, 0.0625], [-0.375, 0.55, 0.0625], [-0.3125, 0.55, 0.0625], [-0.25, 0.55, 0.0625], [-0.1875, 0.55, 0.0625], [-0.125, 0.55, 0.0625], [-0.0625, 0.55, 0.0625], [0, 0.55, 0.0625], [0.0625, 0.55, 0.0625], [0.125, 0.55, 0.0625], [0.1875, 0.55, 0.0625], [0.25, 0.55, 0.0625], [0.3125, 0.55, 0.0625], [0.375, 0.55, 0.0625], [0.4375, 0.55, 0.0625], [0.5, 0.55, 0.0625], [-0.5, 0.55, 0.125], [-0.4375, 0.55, 0.125], [-0.375, 0.55, 0.125], [-0.3125, 0.55, 0.125], [-0.25, 0.55, 0.125], [-0.1875, 0.55, 0.125], [-0.125, 0.55, 0.125], [-0.0625, 0.55, 0.125], [0, 0.55, 0.125], [0.0625, 0.55, 0.125], [0.125, 0.55, 0.125], [0.1875, 0.55, 0.125], [0.25, 0.55, 0.125], [0.3125, 0.55, 0.125], [0.375, 0.55, 0.125], [0.4375, 0.55, 0.125], [0.5, 0.55, 0.125], [-0.5, 0.55, 0.1875], [-0.4375, 0.55, 0.1875], [-0.375, 0.55, 0.1875], [-0.3125, 0.55, 0.1875], [-0.25, 0.55, 0.1875], [-0.1875, 0.55, 0.1875], [-0.125, 0.55, 0.1875], [-0.0625, 0.55, 0.1875], [0, 0.55, 0.1875], [0.0625, 0.55, 0.1875], [0.125, 0.55, 0.1875], [0.1875, 0.55, 0.1875], [0.25, 0.55, 0.1875], [0.3125, 0.55, 0.1875], [0.375, 0.55, 0.1875], [0.4375, 0.55, 0.1875], [0.5, 0.55, 0.1875], [-0.5, 0.55, 0.25], [-0.4375, 0.55, 0.25], [-0.375, 0.55, 0.25], [-0.3125, 0.55, 0.25], [-0.25, 0.55, 0.25], [-0.1875, 0.55, 0.25], [-0.125, 0.55, 0.25], [-0.0625, 0.55, 0.25], [0, 0.55, 0.25], [0.0625, 0.55, 0.25], [0.125, 0.55, 0.25], [0.1875, 0.55, 0.25], [0.25, 0.55, 0.25], [0.3125, 0.55, 0.25], [0.375, 0.55, 0.25], [0.4375, 0.55, 0.25], [0.5, 0.55, 0.25], [-0.5, 0.55, 0.3125], [-0.4375, 0.55, 0.3125], [-0.375, 0.55, 0.3125], [-0.3125, 0.55, 0.3125], [-0.25, 0.55, 0.3125], [-0.1875, 0.55, 0.3125], [-0.125, 0.55, 0.3125], [-0.0625, 0.55, 0.3125], [0, 0.55, 0.3125], [0.0625, 0.55, 0.3125], [0.125, 0.55, 0.3125], [0.1875, 0.55, 0.3125], [0.25, 0.55, 0.3125], [0.3125, 0.55, 0.3125], [0.375, 0.55, 0.3125], [0.4375, 0.55, 0.3125], [0.5, 0.55, 0.3125], [-0.5, 0.55, 0.375], [-0.4375, 0.55, 0.375], [-0.375, 0.55, 0.375], [-0.3125, 0.55, 0.375], [-0.25, 0.55, 0.375], [-0.1875, 0.55, 0.375], [-0.125, 0.55, 0.375], [-0.0625, 0.55, 0.375], [0, 0.55, 0.375], [0.0625, 0.55, 0.375], [0.125, 0.55, 0.375], [0.1875, 0.55, 0.375], [0.25, 0.55, 0.375], [0.3125, 0.55, 0.375], [0.375, 0.55, 0.375], [0.4375, 0.55, 0.375], [0.5, 0.55, 0.375], [-0.5, 0.55, 0.4375], [-0.4375, 0.55, 0.4375], [-0.375, 0.55, 0.4375], [-0.3125, 0.55, 0.4375], [-0.25, 0.55, 0.4375], [-0.1875, 0.55, 0.4375], [-0.125, 0.55, 0.4375], [-0.0625, 0.55, 0.4375], [0, 0.55, 0.4375], [0.0625, 0.55, 0.4375], [0.125, 0.55, 0.4375], [0.1875, 0.55, 0.4375], [0.25, 0.55, 0.4375], [0.3125, 0.55, 0.4375], [0.375, 0.55, 0.4375], [0.4375, 0.55, 0.4375], [0.5, 0.55, 0.4375], [-0.5, 0.55, 0.5], [-0.4375, 0.55, 0.5], [-0.375, 0.55, 0.5], [-0.3125, 0.55, 0.5], [-0.25, 0.55, 0.5], [-0.1875, 0.55, 0.5], [-0.125, 0.55, 0.5], [-0.0625, 0.55, 0.5], [0, 0.55, 0.5], [0.0625, 0.55, 0.5], [0.125, 0.55, 0.5], [0.1875, 0.55, 0.5], [0.25, 0.55, 0.5], [0.3125, 0.55, 0.5], [0.375, 0.55, 0.5], [0.4375, 0.55, 0.5], [0.5, 0.55, 0.5]], "initialVelocitiesMps": [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], "vertexMassesKg": [13020833333333333e-20, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 26041666666666666e-20, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 26041666666666666e-20, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 13020833333333333e-20], "triangles": [[0, 17, 1], [1, 17, 18], [1, 18, 2], [2, 18, 19], [2, 19, 3], [3, 19, 20], [3, 20, 4], [4, 20, 21], [4, 21, 5], [5, 21, 22], [5, 22, 6], [6, 22, 23], [6, 23, 7], [7, 23, 24], [7, 24, 8], [8, 24, 25], [8, 25, 9], [9, 25, 26], [9, 26, 10], [10, 26, 27], [10, 27, 11], [11, 27, 28], [11, 28, 12], [12, 28, 29], [12, 29, 13], [13, 29, 30], [13, 30, 14], [14, 30, 31], [14, 31, 15], [15, 31, 32], [15, 32, 16], [16, 32, 33], [17, 34, 18], [18, 34, 35], [18, 35, 19], [19, 35, 36], [19, 36, 20], [20, 36, 37], [20, 37, 21], [21, 37, 38], [21, 38, 22], [22, 38, 39], [22, 39, 23], [23, 39, 40], [23, 40, 24], [24, 40, 41], [24, 41, 25], [25, 41, 42], [25, 42, 26], [26, 42, 43], [26, 43, 27], [27, 43, 44], [27, 44, 28], [28, 44, 45], [28, 45, 29], [29, 45, 46], [29, 46, 30], [30, 46, 47], [30, 47, 31], [31, 47, 48], [31, 48, 32], [32, 48, 49], [32, 49, 33], [33, 49, 50], [34, 51, 35], [35, 51, 52], [35, 52, 36], [36, 52, 53], [36, 53, 37], [37, 53, 54], [37, 54, 38], [38, 54, 55], [38, 55, 39], [39, 55, 56], [39, 56, 40], [40, 56, 57], [40, 57, 41], [41, 57, 58], [41, 58, 42], [42, 58, 59], [42, 59, 43], [43, 59, 60], [43, 60, 44], [44, 60, 61], [44, 61, 45], [45, 61, 62], [45, 62, 46], [46, 62, 63], [46, 63, 47], [47, 63, 64], [47, 64, 48], [48, 64, 65], [48, 65, 49], [49, 65, 66], [49, 66, 50], [50, 66, 67], [51, 68, 52], [52, 68, 69], [52, 69, 53], [53, 69, 70], [53, 70, 54], [54, 70, 71], [54, 71, 55], [55, 71, 72], [55, 72, 56], [56, 72, 73], [56, 73, 57], [57, 73, 74], [57, 74, 58], [58, 74, 75], [58, 75, 59], [59, 75, 76], [59, 76, 60], [60, 76, 77], [60, 77, 61], [61, 77, 78], [61, 78, 62], [62, 78, 79], [62, 79, 63], [63, 79, 80], [63, 80, 64], [64, 80, 81], [64, 81, 65], [65, 81, 82], [65, 82, 66], [66, 82, 83], [66, 83, 67], [67, 83, 84], [68, 85, 69], [69, 85, 86], [69, 86, 70], [70, 86, 87], [70, 87, 71], [71, 87, 88], [71, 88, 72], [72, 88, 89], [72, 89, 73], [73, 89, 90], [73, 90, 74], [74, 90, 91], [74, 91, 75], [75, 91, 92], [75, 92, 76], [76, 92, 93], [76, 93, 77], [77, 93, 94], [77, 94, 78], [78, 94, 95], [78, 95, 79], [79, 95, 96], [79, 96, 80], [80, 96, 97], [80, 97, 81], [81, 97, 98], [81, 98, 82], [82, 98, 99], [82, 99, 83], [83, 99, 100], [83, 100, 84], [84, 100, 101], [85, 102, 86], [86, 102, 103], [86, 103, 87], [87, 103, 104], [87, 104, 88], [88, 104, 105], [88, 105, 89], [89, 105, 106], [89, 106, 90], [90, 106, 107], [90, 107, 91], [91, 107, 108], [91, 108, 92], [92, 108, 109], [92, 109, 93], [93, 109, 110], [93, 110, 94], [94, 110, 111], [94, 111, 95], [95, 111, 112], [95, 112, 96], [96, 112, 113], [96, 113, 97], [97, 113, 114], [97, 114, 98], [98, 114, 115], [98, 115, 99], [99, 115, 116], [99, 116, 100], [100, 116, 117], [100, 117, 101], [101, 117, 118], [102, 119, 103], [103, 119, 120], [103, 120, 104], [104, 120, 121], [104, 121, 105], [105, 121, 122], [105, 122, 106], [106, 122, 123], [106, 123, 107], [107, 123, 124], [107, 124, 108], [108, 124, 125], [108, 125, 109], [109, 125, 126], [109, 126, 110], [110, 126, 127], [110, 127, 111], [111, 127, 128], [111, 128, 112], [112, 128, 129], [112, 129, 113], [113, 129, 130], [113, 130, 114], [114, 130, 131], [114, 131, 115], [115, 131, 132], [115, 132, 116], [116, 132, 133], [116, 133, 117], [117, 133, 134], [117, 134, 118], [118, 134, 135], [119, 136, 120], [120, 136, 137], [120, 137, 121], [121, 137, 138], [121, 138, 122], [122, 138, 139], [122, 139, 123], [123, 139, 140], [123, 140, 124], [124, 140, 141], [124, 141, 125], [125, 141, 142], [125, 142, 126], [126, 142, 143], [126, 143, 127], [127, 143, 144], [127, 144, 128], [128, 144, 145], [128, 145, 129], [129, 145, 146], [129, 146, 130], [130, 146, 147], [130, 147, 131], [131, 147, 148], [131, 148, 132], [132, 148, 149], [132, 149, 133], [133, 149, 150], [133, 150, 134], [134, 150, 151], [134, 151, 135], [135, 151, 152], [136, 153, 137], [137, 153, 154], [137, 154, 138], [138, 154, 155], [138, 155, 139], [139, 155, 156], [139, 156, 140], [140, 156, 157], [140, 157, 141], [141, 157, 158], [141, 158, 142], [142, 158, 159], [142, 159, 143], [143, 159, 160], [143, 160, 144], [144, 160, 161], [144, 161, 145], [145, 161, 162], [145, 162, 146], [146, 162, 163], [146, 163, 147], [147, 163, 164], [147, 164, 148], [148, 164, 165], [148, 165, 149], [149, 165, 166], [149, 166, 150], [150, 166, 167], [150, 167, 151], [151, 167, 168], [151, 168, 152], [152, 168, 169], [153, 170, 154], [154, 170, 171], [154, 171, 155], [155, 171, 172], [155, 172, 156], [156, 172, 173], [156, 173, 157], [157, 173, 174], [157, 174, 158], [158, 174, 175], [158, 175, 159], [159, 175, 176], [159, 176, 160], [160, 176, 177], [160, 177, 161], [161, 177, 178], [161, 178, 162], [162, 178, 179], [162, 179, 163], [163, 179, 180], [163, 180, 164], [164, 180, 181], [164, 181, 165], [165, 181, 182], [165, 182, 166], [166, 182, 183], [166, 183, 167], [167, 183, 184], [167, 184, 168], [168, 184, 185], [168, 185, 169], [169, 185, 186], [170, 187, 171], [171, 187, 188], [171, 188, 172], [172, 188, 189], [172, 189, 173], [173, 189, 190], [173, 190, 174], [174, 190, 191], [174, 191, 175], [175, 191, 192], [175, 192, 176], [176, 192, 193], [176, 193, 177], [177, 193, 194], [177, 194, 178], [178, 194, 195], [178, 195, 179], [179, 195, 196], [179, 196, 180], [180, 196, 197], [180, 197, 181], [181, 197, 198], [181, 198, 182], [182, 198, 199], [182, 199, 183], [183, 199, 200], [183, 200, 184], [184, 200, 201], [184, 201, 185], [185, 201, 202], [185, 202, 186], [186, 202, 203], [187, 204, 188], [188, 204, 205], [188, 205, 189], [189, 205, 206], [189, 206, 190], [190, 206, 207], [190, 207, 191], [191, 207, 208], [191, 208, 192], [192, 208, 209], [192, 209, 193], [193, 209, 210], [193, 210, 194], [194, 210, 211], [194, 211, 195], [195, 211, 212], [195, 212, 196], [196, 212, 213], [196, 213, 197], [197, 213, 214], [197, 214, 198], [198, 214, 215], [198, 215, 199], [199, 215, 216], [199, 216, 200], [200, 216, 217], [200, 217, 201], [201, 217, 218], [201, 218, 202], [202, 218, 219], [202, 219, 203], [203, 219, 220], [204, 221, 205], [205, 221, 222], [205, 222, 206], [206, 222, 223], [206, 223, 207], [207, 223, 224], [207, 224, 208], [208, 224, 225], [208, 225, 209], [209, 225, 226], [209, 226, 210], [210, 226, 227], [210, 227, 211], [211, 227, 228], [211, 228, 212], [212, 228, 229], [212, 229, 213], [213, 229, 230], [213, 230, 214], [214, 230, 231], [214, 231, 215], [215, 231, 232], [215, 232, 216], [216, 232, 233], [216, 233, 217], [217, 233, 234], [217, 234, 218], [218, 234, 235], [218, 235, 219], [219, 235, 236], [219, 236, 220], [220, 236, 237], [221, 238, 222], [222, 238, 239], [222, 239, 223], [223, 239, 240], [223, 240, 224], [224, 240, 241], [224, 241, 225], [225, 241, 242], [225, 242, 226], [226, 242, 243], [226, 243, 227], [227, 243, 244], [227, 244, 228], [228, 244, 245], [228, 245, 229], [229, 245, 246], [229, 246, 230], [230, 246, 247], [230, 247, 231], [231, 247, 248], [231, 248, 232], [232, 248, 249], [232, 249, 233], [233, 249, 250], [233, 250, 234], [234, 250, 251], [234, 251, 235], [235, 251, 252], [235, 252, 236], [236, 252, 253], [236, 253, 237], [237, 253, 254], [238, 255, 239], [239, 255, 256], [239, 256, 240], [240, 256, 257], [240, 257, 241], [241, 257, 258], [241, 258, 242], [242, 258, 259], [242, 259, 243], [243, 259, 260], [243, 260, 244], [244, 260, 261], [244, 261, 245], [245, 261, 262], [245, 262, 246], [246, 262, 263], [246, 263, 247], [247, 263, 264], [247, 264, 248], [248, 264, 265], [248, 265, 249], [249, 265, 266], [249, 266, 250], [250, 266, 267], [250, 267, 251], [251, 267, 268], [251, 268, 252], [252, 268, 269], [252, 269, 253], [253, 269, 270], [253, 270, 254], [254, 270, 271], [255, 272, 256], [256, 272, 273], [256, 273, 257], [257, 273, 274], [257, 274, 258], [258, 274, 275], [258, 275, 259], [259, 275, 276], [259, 276, 260], [260, 276, 277], [260, 277, 261], [261, 277, 278], [261, 278, 262], [262, 278, 279], [262, 279, 263], [263, 279, 280], [263, 280, 264], [264, 280, 281], [264, 281, 265], [265, 281, 282], [265, 282, 266], [266, 282, 283], [266, 283, 267], [267, 283, 284], [267, 284, 268], [268, 284, 285], [268, 285, 269], [269, 285, 286], [269, 286, 270], [270, 286, 287], [270, 287, 271], [271, 287, 288]], "pinnedVertexIndices": [0, 16], "constraints": [{ "a": 0, "b": 1, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 0, "b": 17, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 0, "b": 18, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 1, "b": 17, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 0, "b": 2, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 0, "b": 34, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 1, "b": 2, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 1, "b": 18, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 1, "b": 19, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 2, "b": 18, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 1, "b": 3, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 1, "b": 35, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 2, "b": 3, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 2, "b": 19, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 2, "b": 20, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 3, "b": 19, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 2, "b": 4, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 2, "b": 36, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 3, "b": 4, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 3, "b": 20, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 3, "b": 21, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 4, "b": 20, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 3, "b": 5, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 3, "b": 37, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 4, "b": 5, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 4, "b": 21, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 4, "b": 22, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 5, "b": 21, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 4, "b": 6, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 4, "b": 38, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 5, "b": 6, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 5, "b": 22, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 5, "b": 23, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 6, "b": 22, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 5, "b": 7, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 5, "b": 39, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 6, "b": 7, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 6, "b": 23, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 6, "b": 24, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 7, "b": 23, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 6, "b": 8, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 6, "b": 40, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 7, "b": 8, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 7, "b": 24, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 7, "b": 25, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 8, "b": 24, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 7, "b": 9, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 7, "b": 41, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 8, "b": 9, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 8, "b": 25, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 8, "b": 26, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 9, "b": 25, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 8, "b": 10, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 8, "b": 42, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 9, "b": 10, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 9, "b": 26, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 9, "b": 27, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 10, "b": 26, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 9, "b": 11, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 9, "b": 43, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 10, "b": 11, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 10, "b": 27, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 10, "b": 28, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 11, "b": 27, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 10, "b": 12, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 10, "b": 44, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 11, "b": 12, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 11, "b": 28, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 11, "b": 29, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 12, "b": 28, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 11, "b": 13, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 11, "b": 45, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 12, "b": 13, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 12, "b": 29, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 12, "b": 30, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 13, "b": 29, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 12, "b": 14, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 12, "b": 46, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 13, "b": 14, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 13, "b": 30, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 13, "b": 31, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 14, "b": 30, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 13, "b": 15, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 13, "b": 47, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 14, "b": 15, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 14, "b": 31, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 14, "b": 32, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 15, "b": 31, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 14, "b": 16, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 14, "b": 48, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 15, "b": 16, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 15, "b": 32, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 15, "b": 33, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 16, "b": 32, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 15, "b": 49, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 16, "b": 33, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 16, "b": 50, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 17, "b": 18, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 17, "b": 34, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 17, "b": 35, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 18, "b": 34, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 17, "b": 19, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 17, "b": 51, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 18, "b": 19, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 18, "b": 35, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 18, "b": 36, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 19, "b": 35, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 18, "b": 20, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 18, "b": 52, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 19, "b": 20, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 19, "b": 36, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 19, "b": 37, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 20, "b": 36, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 19, "b": 21, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 19, "b": 53, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 20, "b": 21, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 20, "b": 37, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 20, "b": 38, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 21, "b": 37, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 20, "b": 22, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 20, "b": 54, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 21, "b": 22, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 21, "b": 38, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 21, "b": 39, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 22, "b": 38, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 21, "b": 23, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 21, "b": 55, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 22, "b": 23, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 22, "b": 39, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 22, "b": 40, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 23, "b": 39, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 22, "b": 24, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 22, "b": 56, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 23, "b": 24, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 23, "b": 40, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 23, "b": 41, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 24, "b": 40, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 23, "b": 25, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 23, "b": 57, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 24, "b": 25, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 24, "b": 41, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 24, "b": 42, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 25, "b": 41, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 24, "b": 26, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 24, "b": 58, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 25, "b": 26, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 25, "b": 42, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 25, "b": 43, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 26, "b": 42, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 25, "b": 27, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 25, "b": 59, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 26, "b": 27, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 26, "b": 43, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 26, "b": 44, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 27, "b": 43, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 26, "b": 28, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 26, "b": 60, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 27, "b": 28, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 27, "b": 44, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 27, "b": 45, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 28, "b": 44, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 27, "b": 29, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 27, "b": 61, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 28, "b": 29, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 28, "b": 45, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 28, "b": 46, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 29, "b": 45, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 28, "b": 30, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 28, "b": 62, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 29, "b": 30, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 29, "b": 46, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 29, "b": 47, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 30, "b": 46, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 29, "b": 31, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 29, "b": 63, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 30, "b": 31, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 30, "b": 47, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 30, "b": 48, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 31, "b": 47, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 30, "b": 32, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 30, "b": 64, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 31, "b": 32, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 31, "b": 48, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 31, "b": 49, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 32, "b": 48, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 31, "b": 33, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 31, "b": 65, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 32, "b": 33, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 32, "b": 49, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 32, "b": 50, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 33, "b": 49, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 32, "b": 66, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 33, "b": 50, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 33, "b": 67, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 34, "b": 35, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 34, "b": 51, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 34, "b": 52, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 35, "b": 51, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 34, "b": 36, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 34, "b": 68, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 35, "b": 36, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 35, "b": 52, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 35, "b": 53, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 36, "b": 52, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 35, "b": 37, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 35, "b": 69, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 36, "b": 37, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 36, "b": 53, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 36, "b": 54, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 37, "b": 53, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 36, "b": 38, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 36, "b": 70, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 37, "b": 38, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 37, "b": 54, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 37, "b": 55, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 38, "b": 54, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 37, "b": 39, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 37, "b": 71, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 38, "b": 39, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 38, "b": 55, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 38, "b": 56, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 39, "b": 55, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 38, "b": 40, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 38, "b": 72, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 39, "b": 40, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 39, "b": 56, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 39, "b": 57, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 40, "b": 56, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 39, "b": 41, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 39, "b": 73, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 40, "b": 41, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 40, "b": 57, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 40, "b": 58, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 41, "b": 57, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 40, "b": 42, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 40, "b": 74, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 41, "b": 42, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 41, "b": 58, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 41, "b": 59, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 42, "b": 58, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 41, "b": 43, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 41, "b": 75, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 42, "b": 43, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 42, "b": 59, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 42, "b": 60, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 43, "b": 59, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 42, "b": 44, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 42, "b": 76, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 43, "b": 44, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 43, "b": 60, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 43, "b": 61, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 44, "b": 60, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 43, "b": 45, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 43, "b": 77, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 44, "b": 45, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 44, "b": 61, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 44, "b": 62, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 45, "b": 61, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 44, "b": 46, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 44, "b": 78, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 45, "b": 46, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 45, "b": 62, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 45, "b": 63, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 46, "b": 62, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 45, "b": 47, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 45, "b": 79, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 46, "b": 47, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 46, "b": 63, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 46, "b": 64, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 47, "b": 63, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 46, "b": 48, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 46, "b": 80, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 47, "b": 48, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 47, "b": 64, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 47, "b": 65, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 48, "b": 64, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 47, "b": 49, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 47, "b": 81, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 48, "b": 49, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 48, "b": 65, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 48, "b": 66, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 49, "b": 65, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 48, "b": 50, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 48, "b": 82, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 49, "b": 50, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 49, "b": 66, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 49, "b": 67, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 50, "b": 66, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 49, "b": 83, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 50, "b": 67, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 50, "b": 84, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 51, "b": 52, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 51, "b": 68, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 51, "b": 69, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 52, "b": 68, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 51, "b": 53, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 51, "b": 85, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 52, "b": 53, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 52, "b": 69, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 52, "b": 70, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 53, "b": 69, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 52, "b": 54, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 52, "b": 86, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 53, "b": 54, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 53, "b": 70, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 53, "b": 71, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 54, "b": 70, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 53, "b": 55, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 53, "b": 87, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 54, "b": 55, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 54, "b": 71, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 54, "b": 72, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 55, "b": 71, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 54, "b": 56, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 54, "b": 88, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 55, "b": 56, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 55, "b": 72, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 55, "b": 73, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 56, "b": 72, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 55, "b": 57, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 55, "b": 89, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 56, "b": 57, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 56, "b": 73, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 56, "b": 74, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 57, "b": 73, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 56, "b": 58, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 56, "b": 90, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 57, "b": 58, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 57, "b": 74, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 57, "b": 75, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 58, "b": 74, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 57, "b": 59, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 57, "b": 91, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 58, "b": 59, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 58, "b": 75, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 58, "b": 76, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 59, "b": 75, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 58, "b": 60, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 58, "b": 92, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 59, "b": 60, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 59, "b": 76, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 59, "b": 77, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 60, "b": 76, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 59, "b": 61, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 59, "b": 93, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 60, "b": 61, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 60, "b": 77, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 60, "b": 78, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 61, "b": 77, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 60, "b": 62, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 60, "b": 94, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 61, "b": 62, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 61, "b": 78, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 61, "b": 79, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 62, "b": 78, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 61, "b": 63, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 61, "b": 95, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 62, "b": 63, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 62, "b": 79, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 62, "b": 80, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 63, "b": 79, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 62, "b": 64, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 62, "b": 96, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 63, "b": 64, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 63, "b": 80, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 63, "b": 81, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 64, "b": 80, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 63, "b": 65, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 63, "b": 97, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 64, "b": 65, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 64, "b": 81, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 64, "b": 82, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 65, "b": 81, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 64, "b": 66, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 64, "b": 98, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 65, "b": 66, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 65, "b": 82, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 65, "b": 83, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 66, "b": 82, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 65, "b": 67, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 65, "b": 99, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 66, "b": 67, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 66, "b": 83, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 66, "b": 84, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 67, "b": 83, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 66, "b": 100, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 67, "b": 84, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 67, "b": 101, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 68, "b": 69, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 68, "b": 85, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 68, "b": 86, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 69, "b": 85, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 68, "b": 70, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 68, "b": 102, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 69, "b": 70, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 69, "b": 86, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 69, "b": 87, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 70, "b": 86, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 69, "b": 71, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 69, "b": 103, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 70, "b": 71, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 70, "b": 87, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 70, "b": 88, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 71, "b": 87, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 70, "b": 72, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 70, "b": 104, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 71, "b": 72, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 71, "b": 88, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 71, "b": 89, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 72, "b": 88, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 71, "b": 73, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 71, "b": 105, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 72, "b": 73, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 72, "b": 89, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 72, "b": 90, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 73, "b": 89, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 72, "b": 74, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 72, "b": 106, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 73, "b": 74, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 73, "b": 90, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 73, "b": 91, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 74, "b": 90, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 73, "b": 75, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 73, "b": 107, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 74, "b": 75, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 74, "b": 91, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 74, "b": 92, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 75, "b": 91, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 74, "b": 76, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 74, "b": 108, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 75, "b": 76, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 75, "b": 92, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 75, "b": 93, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 76, "b": 92, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 75, "b": 77, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 75, "b": 109, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 76, "b": 77, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 76, "b": 93, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 76, "b": 94, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 77, "b": 93, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 76, "b": 78, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 76, "b": 110, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 77, "b": 78, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 77, "b": 94, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 77, "b": 95, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 78, "b": 94, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 77, "b": 79, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 77, "b": 111, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 78, "b": 79, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 78, "b": 95, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 78, "b": 96, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 79, "b": 95, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 78, "b": 80, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 78, "b": 112, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 79, "b": 80, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 79, "b": 96, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 79, "b": 97, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 80, "b": 96, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 79, "b": 81, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 79, "b": 113, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 80, "b": 81, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 80, "b": 97, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 80, "b": 98, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 81, "b": 97, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 80, "b": 82, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 80, "b": 114, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 81, "b": 82, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 81, "b": 98, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 81, "b": 99, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 82, "b": 98, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 81, "b": 83, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 81, "b": 115, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 82, "b": 83, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 82, "b": 99, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 82, "b": 100, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 83, "b": 99, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 82, "b": 84, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 82, "b": 116, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 83, "b": 84, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 83, "b": 100, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 83, "b": 101, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 84, "b": 100, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 83, "b": 117, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 84, "b": 101, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 84, "b": 118, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 85, "b": 86, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 85, "b": 102, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 85, "b": 103, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 86, "b": 102, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 85, "b": 87, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 85, "b": 119, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 86, "b": 87, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 86, "b": 103, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 86, "b": 104, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 87, "b": 103, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 86, "b": 88, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 86, "b": 120, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 87, "b": 88, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 87, "b": 104, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 87, "b": 105, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 88, "b": 104, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 87, "b": 89, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 87, "b": 121, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 88, "b": 89, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 88, "b": 105, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 88, "b": 106, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 89, "b": 105, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 88, "b": 90, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 88, "b": 122, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 89, "b": 90, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 89, "b": 106, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 89, "b": 107, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 90, "b": 106, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 89, "b": 91, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 89, "b": 123, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 90, "b": 91, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 90, "b": 107, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 90, "b": 108, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 91, "b": 107, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 90, "b": 92, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 90, "b": 124, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 91, "b": 92, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 91, "b": 108, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 91, "b": 109, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 92, "b": 108, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 91, "b": 93, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 91, "b": 125, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 92, "b": 93, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 92, "b": 109, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 92, "b": 110, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 93, "b": 109, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 92, "b": 94, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 92, "b": 126, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 93, "b": 94, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 93, "b": 110, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 93, "b": 111, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 94, "b": 110, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 93, "b": 95, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 93, "b": 127, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 94, "b": 95, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 94, "b": 111, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 94, "b": 112, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 95, "b": 111, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 94, "b": 96, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 94, "b": 128, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 95, "b": 96, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 95, "b": 112, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 95, "b": 113, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 96, "b": 112, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 95, "b": 97, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 95, "b": 129, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 96, "b": 97, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 96, "b": 113, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 96, "b": 114, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 97, "b": 113, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 96, "b": 98, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 96, "b": 130, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 97, "b": 98, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 97, "b": 114, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 97, "b": 115, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 98, "b": 114, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 97, "b": 99, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 97, "b": 131, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 98, "b": 99, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 98, "b": 115, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 98, "b": 116, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 99, "b": 115, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 98, "b": 100, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 98, "b": 132, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 99, "b": 100, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 99, "b": 116, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 99, "b": 117, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 100, "b": 116, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 99, "b": 101, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 99, "b": 133, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 100, "b": 101, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 100, "b": 117, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 100, "b": 118, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 101, "b": 117, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 100, "b": 134, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 101, "b": 118, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 101, "b": 135, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 102, "b": 103, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 102, "b": 119, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 102, "b": 120, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 103, "b": 119, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 102, "b": 104, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 102, "b": 136, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 103, "b": 104, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 103, "b": 120, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 103, "b": 121, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 104, "b": 120, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 103, "b": 105, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 103, "b": 137, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 104, "b": 105, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 104, "b": 121, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 104, "b": 122, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 105, "b": 121, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 104, "b": 106, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 104, "b": 138, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 105, "b": 106, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 105, "b": 122, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 105, "b": 123, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 106, "b": 122, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 105, "b": 107, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 105, "b": 139, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 106, "b": 107, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 106, "b": 123, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 106, "b": 124, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 107, "b": 123, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 106, "b": 108, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 106, "b": 140, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 107, "b": 108, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 107, "b": 124, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 107, "b": 125, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 108, "b": 124, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 107, "b": 109, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 107, "b": 141, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 108, "b": 109, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 108, "b": 125, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 108, "b": 126, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 109, "b": 125, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 108, "b": 110, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 108, "b": 142, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 109, "b": 110, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 109, "b": 126, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 109, "b": 127, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 110, "b": 126, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 109, "b": 111, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 109, "b": 143, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 110, "b": 111, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 110, "b": 127, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 110, "b": 128, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 111, "b": 127, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 110, "b": 112, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 110, "b": 144, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 111, "b": 112, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 111, "b": 128, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 111, "b": 129, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 112, "b": 128, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 111, "b": 113, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 111, "b": 145, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 112, "b": 113, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 112, "b": 129, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 112, "b": 130, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 113, "b": 129, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 112, "b": 114, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 112, "b": 146, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 113, "b": 114, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 113, "b": 130, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 113, "b": 131, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 114, "b": 130, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 113, "b": 115, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 113, "b": 147, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 114, "b": 115, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 114, "b": 131, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 114, "b": 132, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 115, "b": 131, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 114, "b": 116, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 114, "b": 148, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 115, "b": 116, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 115, "b": 132, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 115, "b": 133, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 116, "b": 132, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 115, "b": 117, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 115, "b": 149, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 116, "b": 117, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 116, "b": 133, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 116, "b": 134, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 117, "b": 133, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 116, "b": 118, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 116, "b": 150, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 117, "b": 118, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 117, "b": 134, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 117, "b": 135, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 118, "b": 134, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 117, "b": 151, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 118, "b": 135, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 118, "b": 152, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 119, "b": 120, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 119, "b": 136, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 119, "b": 137, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 120, "b": 136, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 119, "b": 121, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 119, "b": 153, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 120, "b": 121, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 120, "b": 137, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 120, "b": 138, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 121, "b": 137, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 120, "b": 122, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 120, "b": 154, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 121, "b": 122, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 121, "b": 138, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 121, "b": 139, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 122, "b": 138, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 121, "b": 123, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 121, "b": 155, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 122, "b": 123, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 122, "b": 139, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 122, "b": 140, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 123, "b": 139, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 122, "b": 124, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 122, "b": 156, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 123, "b": 124, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 123, "b": 140, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 123, "b": 141, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 124, "b": 140, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 123, "b": 125, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 123, "b": 157, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 124, "b": 125, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 124, "b": 141, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 124, "b": 142, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 125, "b": 141, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 124, "b": 126, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 124, "b": 158, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 125, "b": 126, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 125, "b": 142, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 125, "b": 143, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 126, "b": 142, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 125, "b": 127, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 125, "b": 159, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 126, "b": 127, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 126, "b": 143, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 126, "b": 144, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 127, "b": 143, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 126, "b": 128, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 126, "b": 160, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 127, "b": 128, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 127, "b": 144, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 127, "b": 145, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 128, "b": 144, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 127, "b": 129, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 127, "b": 161, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 128, "b": 129, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 128, "b": 145, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 128, "b": 146, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 129, "b": 145, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 128, "b": 130, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 128, "b": 162, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 129, "b": 130, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 129, "b": 146, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 129, "b": 147, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 130, "b": 146, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 129, "b": 131, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 129, "b": 163, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 130, "b": 131, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 130, "b": 147, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 130, "b": 148, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 131, "b": 147, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 130, "b": 132, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 130, "b": 164, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 131, "b": 132, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 131, "b": 148, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 131, "b": 149, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 132, "b": 148, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 131, "b": 133, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 131, "b": 165, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 132, "b": 133, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 132, "b": 149, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 132, "b": 150, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 133, "b": 149, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 132, "b": 134, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 132, "b": 166, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 133, "b": 134, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 133, "b": 150, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 133, "b": 151, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 134, "b": 150, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 133, "b": 135, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 133, "b": 167, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 134, "b": 135, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 134, "b": 151, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 134, "b": 152, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 135, "b": 151, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 134, "b": 168, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 135, "b": 152, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 135, "b": 169, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 136, "b": 137, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 136, "b": 153, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 136, "b": 154, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 137, "b": 153, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 136, "b": 138, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 136, "b": 170, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 137, "b": 138, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 137, "b": 154, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 137, "b": 155, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 138, "b": 154, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 137, "b": 139, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 137, "b": 171, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 138, "b": 139, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 138, "b": 155, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 138, "b": 156, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 139, "b": 155, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 138, "b": 140, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 138, "b": 172, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 139, "b": 140, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 139, "b": 156, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 139, "b": 157, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 140, "b": 156, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 139, "b": 141, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 139, "b": 173, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 140, "b": 141, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 140, "b": 157, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 140, "b": 158, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 141, "b": 157, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 140, "b": 142, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 140, "b": 174, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 141, "b": 142, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 141, "b": 158, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 141, "b": 159, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 142, "b": 158, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 141, "b": 143, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 141, "b": 175, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 142, "b": 143, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 142, "b": 159, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 142, "b": 160, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 143, "b": 159, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 142, "b": 144, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 142, "b": 176, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 143, "b": 144, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 143, "b": 160, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 143, "b": 161, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 144, "b": 160, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 143, "b": 145, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 143, "b": 177, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 144, "b": 145, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 144, "b": 161, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 144, "b": 162, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 145, "b": 161, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 144, "b": 146, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 144, "b": 178, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 145, "b": 146, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 145, "b": 162, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 145, "b": 163, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 146, "b": 162, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 145, "b": 147, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 145, "b": 179, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 146, "b": 147, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 146, "b": 163, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 146, "b": 164, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 147, "b": 163, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 146, "b": 148, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 146, "b": 180, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 147, "b": 148, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 147, "b": 164, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 147, "b": 165, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 148, "b": 164, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 147, "b": 149, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 147, "b": 181, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 148, "b": 149, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 148, "b": 165, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 148, "b": 166, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 149, "b": 165, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 148, "b": 150, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 148, "b": 182, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 149, "b": 150, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 149, "b": 166, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 149, "b": 167, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 150, "b": 166, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 149, "b": 151, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 149, "b": 183, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 150, "b": 151, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 150, "b": 167, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 150, "b": 168, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 151, "b": 167, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 150, "b": 152, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 150, "b": 184, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 151, "b": 152, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 151, "b": 168, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 151, "b": 169, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 152, "b": 168, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 151, "b": 185, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 152, "b": 169, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 152, "b": 186, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 153, "b": 154, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 153, "b": 170, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 153, "b": 171, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 154, "b": 170, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 153, "b": 155, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 153, "b": 187, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 154, "b": 155, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 154, "b": 171, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 154, "b": 172, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 155, "b": 171, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 154, "b": 156, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 154, "b": 188, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 155, "b": 156, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 155, "b": 172, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 155, "b": 173, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 156, "b": 172, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 155, "b": 157, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 155, "b": 189, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 156, "b": 157, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 156, "b": 173, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 156, "b": 174, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 157, "b": 173, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 156, "b": 158, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 156, "b": 190, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 157, "b": 158, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 157, "b": 174, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 157, "b": 175, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 158, "b": 174, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 157, "b": 159, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 157, "b": 191, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 158, "b": 159, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 158, "b": 175, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 158, "b": 176, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 159, "b": 175, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 158, "b": 160, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 158, "b": 192, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 159, "b": 160, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 159, "b": 176, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 159, "b": 177, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 160, "b": 176, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 159, "b": 161, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 159, "b": 193, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 160, "b": 161, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 160, "b": 177, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 160, "b": 178, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 161, "b": 177, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 160, "b": 162, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 160, "b": 194, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 161, "b": 162, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 161, "b": 178, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 161, "b": 179, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 162, "b": 178, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 161, "b": 163, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 161, "b": 195, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 162, "b": 163, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 162, "b": 179, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 162, "b": 180, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 163, "b": 179, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 162, "b": 164, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 162, "b": 196, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 163, "b": 164, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 163, "b": 180, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 163, "b": 181, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 164, "b": 180, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 163, "b": 165, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 163, "b": 197, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 164, "b": 165, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 164, "b": 181, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 164, "b": 182, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 165, "b": 181, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 164, "b": 166, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 164, "b": 198, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 165, "b": 166, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 165, "b": 182, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 165, "b": 183, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 166, "b": 182, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 165, "b": 167, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 165, "b": 199, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 166, "b": 167, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 166, "b": 183, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 166, "b": 184, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 167, "b": 183, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 166, "b": 168, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 166, "b": 200, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 167, "b": 168, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 167, "b": 184, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 167, "b": 185, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 168, "b": 184, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 167, "b": 169, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 167, "b": 201, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 168, "b": 169, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 168, "b": 185, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 168, "b": 186, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 169, "b": 185, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 168, "b": 202, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 169, "b": 186, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 169, "b": 203, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 170, "b": 171, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 170, "b": 187, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 170, "b": 188, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 171, "b": 187, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 170, "b": 172, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 170, "b": 204, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 171, "b": 172, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 171, "b": 188, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 171, "b": 189, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 172, "b": 188, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 171, "b": 173, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 171, "b": 205, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 172, "b": 173, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 172, "b": 189, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 172, "b": 190, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 173, "b": 189, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 172, "b": 174, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 172, "b": 206, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 173, "b": 174, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 173, "b": 190, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 173, "b": 191, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 174, "b": 190, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 173, "b": 175, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 173, "b": 207, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 174, "b": 175, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 174, "b": 191, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 174, "b": 192, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 175, "b": 191, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 174, "b": 176, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 174, "b": 208, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 175, "b": 176, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 175, "b": 192, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 175, "b": 193, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 176, "b": 192, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 175, "b": 177, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 175, "b": 209, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 176, "b": 177, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 176, "b": 193, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 176, "b": 194, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 177, "b": 193, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 176, "b": 178, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 176, "b": 210, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 177, "b": 178, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 177, "b": 194, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 177, "b": 195, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 178, "b": 194, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 177, "b": 179, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 177, "b": 211, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 178, "b": 179, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 178, "b": 195, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 178, "b": 196, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 179, "b": 195, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 178, "b": 180, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 178, "b": 212, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 179, "b": 180, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 179, "b": 196, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 179, "b": 197, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 180, "b": 196, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 179, "b": 181, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 179, "b": 213, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 180, "b": 181, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 180, "b": 197, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 180, "b": 198, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 181, "b": 197, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 180, "b": 182, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 180, "b": 214, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 181, "b": 182, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 181, "b": 198, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 181, "b": 199, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 182, "b": 198, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 181, "b": 183, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 181, "b": 215, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 182, "b": 183, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 182, "b": 199, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 182, "b": 200, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 183, "b": 199, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 182, "b": 184, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 182, "b": 216, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 183, "b": 184, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 183, "b": 200, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 183, "b": 201, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 184, "b": 200, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 183, "b": 185, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 183, "b": 217, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 184, "b": 185, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 184, "b": 201, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 184, "b": 202, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 185, "b": 201, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 184, "b": 186, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 184, "b": 218, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 185, "b": 186, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 185, "b": 202, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 185, "b": 203, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 186, "b": 202, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 185, "b": 219, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 186, "b": 203, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 186, "b": 220, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 187, "b": 188, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 187, "b": 204, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 187, "b": 205, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 188, "b": 204, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 187, "b": 189, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 187, "b": 221, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 188, "b": 189, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 188, "b": 205, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 188, "b": 206, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 189, "b": 205, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 188, "b": 190, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 188, "b": 222, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 189, "b": 190, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 189, "b": 206, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 189, "b": 207, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 190, "b": 206, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 189, "b": 191, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 189, "b": 223, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 190, "b": 191, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 190, "b": 207, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 190, "b": 208, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 191, "b": 207, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 190, "b": 192, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 190, "b": 224, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 191, "b": 192, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 191, "b": 208, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 191, "b": 209, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 192, "b": 208, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 191, "b": 193, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 191, "b": 225, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 192, "b": 193, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 192, "b": 209, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 192, "b": 210, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 193, "b": 209, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 192, "b": 194, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 192, "b": 226, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 193, "b": 194, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 193, "b": 210, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 193, "b": 211, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 194, "b": 210, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 193, "b": 195, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 193, "b": 227, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 194, "b": 195, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 194, "b": 211, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 194, "b": 212, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 195, "b": 211, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 194, "b": 196, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 194, "b": 228, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 195, "b": 196, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 195, "b": 212, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 195, "b": 213, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 196, "b": 212, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 195, "b": 197, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 195, "b": 229, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 196, "b": 197, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 196, "b": 213, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 196, "b": 214, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 197, "b": 213, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 196, "b": 198, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 196, "b": 230, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 197, "b": 198, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 197, "b": 214, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 197, "b": 215, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 198, "b": 214, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 197, "b": 199, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 197, "b": 231, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 198, "b": 199, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 198, "b": 215, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 198, "b": 216, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 199, "b": 215, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 198, "b": 200, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 198, "b": 232, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 199, "b": 200, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 199, "b": 216, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 199, "b": 217, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 200, "b": 216, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 199, "b": 201, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 199, "b": 233, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 200, "b": 201, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 200, "b": 217, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 200, "b": 218, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 201, "b": 217, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 200, "b": 202, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 200, "b": 234, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 201, "b": 202, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 201, "b": 218, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 201, "b": 219, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 202, "b": 218, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 201, "b": 203, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 201, "b": 235, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 202, "b": 203, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 202, "b": 219, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 202, "b": 220, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 203, "b": 219, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 202, "b": 236, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 203, "b": 220, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 203, "b": 237, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 204, "b": 205, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 204, "b": 221, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 204, "b": 222, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 205, "b": 221, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 204, "b": 206, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 204, "b": 238, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 205, "b": 206, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 205, "b": 222, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 205, "b": 223, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 206, "b": 222, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 205, "b": 207, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 205, "b": 239, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 206, "b": 207, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 206, "b": 223, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 206, "b": 224, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 207, "b": 223, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 206, "b": 208, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 206, "b": 240, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 207, "b": 208, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 207, "b": 224, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 207, "b": 225, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 208, "b": 224, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 207, "b": 209, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 207, "b": 241, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 208, "b": 209, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 208, "b": 225, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 208, "b": 226, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 209, "b": 225, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 208, "b": 210, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 208, "b": 242, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 209, "b": 210, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 209, "b": 226, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 209, "b": 227, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 210, "b": 226, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 209, "b": 211, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 209, "b": 243, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 210, "b": 211, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 210, "b": 227, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 210, "b": 228, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 211, "b": 227, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 210, "b": 212, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 210, "b": 244, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 211, "b": 212, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 211, "b": 228, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 211, "b": 229, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 212, "b": 228, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 211, "b": 213, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 211, "b": 245, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 212, "b": 213, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 212, "b": 229, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 212, "b": 230, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 213, "b": 229, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 212, "b": 214, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 212, "b": 246, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 213, "b": 214, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 213, "b": 230, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 213, "b": 231, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 214, "b": 230, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 213, "b": 215, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 213, "b": 247, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 214, "b": 215, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 214, "b": 231, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 214, "b": 232, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 215, "b": 231, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 214, "b": 216, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 214, "b": 248, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 215, "b": 216, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 215, "b": 232, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 215, "b": 233, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 216, "b": 232, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 215, "b": 217, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 215, "b": 249, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 216, "b": 217, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 216, "b": 233, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 216, "b": 234, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 217, "b": 233, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 216, "b": 218, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 216, "b": 250, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 217, "b": 218, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 217, "b": 234, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 217, "b": 235, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 218, "b": 234, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 217, "b": 219, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 217, "b": 251, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 218, "b": 219, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 218, "b": 235, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 218, "b": 236, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 219, "b": 235, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 218, "b": 220, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 218, "b": 252, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 219, "b": 220, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 219, "b": 236, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 219, "b": 237, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 220, "b": 236, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 219, "b": 253, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 220, "b": 237, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 220, "b": 254, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 221, "b": 222, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 221, "b": 238, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 221, "b": 239, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 222, "b": 238, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 221, "b": 223, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 221, "b": 255, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 222, "b": 223, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 222, "b": 239, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 222, "b": 240, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 223, "b": 239, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 222, "b": 224, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 222, "b": 256, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 223, "b": 224, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 223, "b": 240, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 223, "b": 241, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 224, "b": 240, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 223, "b": 225, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 223, "b": 257, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 224, "b": 225, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 224, "b": 241, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 224, "b": 242, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 225, "b": 241, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 224, "b": 226, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 224, "b": 258, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 225, "b": 226, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 225, "b": 242, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 225, "b": 243, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 226, "b": 242, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 225, "b": 227, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 225, "b": 259, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 226, "b": 227, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 226, "b": 243, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 226, "b": 244, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 227, "b": 243, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 226, "b": 228, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 226, "b": 260, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 227, "b": 228, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 227, "b": 244, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 227, "b": 245, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 228, "b": 244, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 227, "b": 229, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 227, "b": 261, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 228, "b": 229, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 228, "b": 245, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 228, "b": 246, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 229, "b": 245, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 228, "b": 230, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 228, "b": 262, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 229, "b": 230, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 229, "b": 246, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 229, "b": 247, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 230, "b": 246, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 229, "b": 231, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 229, "b": 263, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 230, "b": 231, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 230, "b": 247, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 230, "b": 248, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 231, "b": 247, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 230, "b": 232, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 230, "b": 264, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 231, "b": 232, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 231, "b": 248, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 231, "b": 249, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 232, "b": 248, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 231, "b": 233, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 231, "b": 265, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 232, "b": 233, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 232, "b": 249, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 232, "b": 250, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 233, "b": 249, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 232, "b": 234, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 232, "b": 266, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 233, "b": 234, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 233, "b": 250, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 233, "b": 251, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 234, "b": 250, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 233, "b": 235, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 233, "b": 267, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 234, "b": 235, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 234, "b": 251, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 234, "b": 252, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 235, "b": 251, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 234, "b": 236, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 234, "b": 268, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 235, "b": 236, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 235, "b": 252, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 235, "b": 253, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 236, "b": 252, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 235, "b": 237, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 235, "b": 269, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 236, "b": 237, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 236, "b": 253, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 236, "b": 254, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 237, "b": 253, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 236, "b": 270, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 237, "b": 254, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 237, "b": 271, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 238, "b": 239, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 238, "b": 255, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 238, "b": 256, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 239, "b": 255, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 238, "b": 240, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 238, "b": 272, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 239, "b": 240, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 239, "b": 256, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 239, "b": 257, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 240, "b": 256, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 239, "b": 241, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 239, "b": 273, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 240, "b": 241, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 240, "b": 257, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 240, "b": 258, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 241, "b": 257, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 240, "b": 242, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 240, "b": 274, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 241, "b": 242, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 241, "b": 258, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 241, "b": 259, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 242, "b": 258, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 241, "b": 243, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 241, "b": 275, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 242, "b": 243, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 242, "b": 259, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 242, "b": 260, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 243, "b": 259, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 242, "b": 244, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 242, "b": 276, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 243, "b": 244, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 243, "b": 260, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 243, "b": 261, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 244, "b": 260, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 243, "b": 245, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 243, "b": 277, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 244, "b": 245, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 244, "b": 261, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 244, "b": 262, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 245, "b": 261, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 244, "b": 246, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 244, "b": 278, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 245, "b": 246, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 245, "b": 262, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 245, "b": 263, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 246, "b": 262, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 245, "b": 247, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 245, "b": 279, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 246, "b": 247, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 246, "b": 263, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 246, "b": 264, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 247, "b": 263, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 246, "b": 248, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 246, "b": 280, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 247, "b": 248, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 247, "b": 264, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 247, "b": 265, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 248, "b": 264, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 247, "b": 249, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 247, "b": 281, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 248, "b": 249, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 248, "b": 265, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 248, "b": 266, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 249, "b": 265, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 248, "b": 250, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 248, "b": 282, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 249, "b": 250, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 249, "b": 266, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 249, "b": 267, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 250, "b": 266, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 249, "b": 251, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 249, "b": 283, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 250, "b": 251, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 250, "b": 267, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 250, "b": 268, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 251, "b": 267, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 250, "b": 252, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 250, "b": 284, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 251, "b": 252, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 251, "b": 268, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 251, "b": 269, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 252, "b": 268, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 251, "b": 253, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 251, "b": 285, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 252, "b": 253, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 252, "b": 269, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 252, "b": 270, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 253, "b": 269, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 252, "b": 254, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 252, "b": 286, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 253, "b": 254, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 253, "b": 270, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 253, "b": 271, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 254, "b": 270, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 253, "b": 287, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 254, "b": 271, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 254, "b": 288, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 255, "b": 256, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 255, "b": 272, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 255, "b": 273, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 256, "b": 272, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 255, "b": 257, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 256, "b": 257, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 256, "b": 273, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 256, "b": 274, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 257, "b": 273, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 256, "b": 258, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 257, "b": 258, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 257, "b": 274, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 257, "b": 275, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 258, "b": 274, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 257, "b": 259, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 258, "b": 259, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 258, "b": 275, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 258, "b": 276, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 259, "b": 275, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 258, "b": 260, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 259, "b": 260, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 259, "b": 276, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 259, "b": 277, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 260, "b": 276, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 259, "b": 261, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 260, "b": 261, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 260, "b": 277, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 260, "b": 278, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 261, "b": 277, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 260, "b": 262, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 261, "b": 262, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 261, "b": 278, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 261, "b": 279, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 262, "b": 278, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 261, "b": 263, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 262, "b": 263, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 262, "b": 279, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 262, "b": 280, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 263, "b": 279, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 262, "b": 264, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 263, "b": 264, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 263, "b": 280, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 263, "b": 281, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 264, "b": 280, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 263, "b": 265, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 264, "b": 265, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 264, "b": 281, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 264, "b": 282, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 265, "b": 281, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 264, "b": 266, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 265, "b": 266, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 265, "b": 282, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 265, "b": 283, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 266, "b": 282, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 265, "b": 267, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 266, "b": 267, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 266, "b": 283, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 266, "b": 284, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 267, "b": 283, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 266, "b": 268, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 267, "b": 268, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 267, "b": 284, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 267, "b": 285, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 268, "b": 284, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 267, "b": 269, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 268, "b": 269, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 268, "b": 285, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 268, "b": 286, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 269, "b": 285, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 268, "b": 270, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 269, "b": 270, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 269, "b": 286, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 269, "b": 287, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 270, "b": 286, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 269, "b": 271, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 270, "b": 271, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 270, "b": 287, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 270, "b": 288, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 271, "b": 287, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 271, "b": 288, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 272, "b": 273, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 272, "b": 274, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 273, "b": 274, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 273, "b": 275, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 274, "b": 275, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 274, "b": 276, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 275, "b": 276, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 275, "b": 277, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 276, "b": 277, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 276, "b": 278, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 277, "b": 278, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 277, "b": 279, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 278, "b": 279, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 278, "b": 280, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 279, "b": 280, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 279, "b": 281, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 280, "b": 281, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 280, "b": 282, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 281, "b": 282, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 281, "b": 283, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 282, "b": 283, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 282, "b": 284, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 283, "b": 284, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 283, "b": 285, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 284, "b": 285, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 284, "b": 286, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 285, "b": 286, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 285, "b": 287, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 286, "b": 287, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 286, "b": 288, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 287, "b": 288, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }], "staticColliderIds": ["p5SphereCollider"] });

// packages/barocss-physics/src/domain/admission.ts
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
  const ids2 = /* @__PURE__ */ new Set();
  function id2(value) {
    check(typeof value === "string" && ID.test(value) && !ids2.has(value), "Invalid or duplicate global entity ID");
    ids2.add(value);
    return value;
  }
  const bodies = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const body = exact(value, ["id", "kind", "initial"], "static body");
    const bodyId = id2(body.id);
    check(body.kind === "static", "Domain owners must be static");
    transform(body.initial, "static initial");
    bodies.set(bodyId, body);
  }
  const colliders = /* @__PURE__ */ new Map();
  const owners = /* @__PURE__ */ new Set();
  for (const value of colliderInputs) {
    const collider = exact(value, ["id", "bodyId", "geometry", "local", "material", "sensor", "ccd", "filter"], "collider");
    const colliderId = id2(collider.id);
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
  id2(data.id);
  const refs = array(data.staticColliderIds, count, "staticColliderIds");
  check(new Set(refs).size === refs.length && refs.every((ref) => typeof ref === "string" && colliders.has(ref)), "Invalid domain collider references");
  const numericalIds = new Set(ids2);
  for (const value of model.sourceBindings) {
    const binding = exact(value, ["id", "sourceRevision", "sourceDigest", "modelId", "occurrenceId", "entityIds", "approximation"], "sourceBinding");
    id2(binding.id);
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

// packages/barocss-physics/src/model-admission.ts
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
  const q2 = t.orientationXYZW.map((x) => finite(x, -1, 1, label));
  if (Math.abs(Math.hypot(...q2) - 1) > 1e-6) error("INVALID_CONFIG", `${label} quaternion must have unit norm`);
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
  const ids2 = /* @__PURE__ */ new Set();
  function id2(value) {
    if (typeof value !== "string" || !ID.test(value) || ids2.has(value)) error("INVALID_CONFIG", "invalid or duplicate global entity ID");
    ids2.add(value);
    return value;
  }
  const bodiesById = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const raw2 = value;
    const b = exact2(value, raw2?.kind === "dynamic" ? ["id", "kind", "massKg", "inertia", "initial"] : ["id", "kind", "initial"], "body");
    const bodyId = id2(b.id);
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
    id2(c.id);
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
    const raw2 = value;
    const j = exact2(value, raw2?.kind === "hinge" ? ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"] : ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM"], "joint");
    id2(j.id);
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
  const numericalIds = new Set(ids2);
  for (const value of bindings) {
    const s = exact2(value, ["id", "sourceRevision", "sourceDigest", "modelId", "occurrenceId", "entityIds", "approximation"], "sourceBinding");
    id2(s.id);
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
    "cloth/constraints.ts": "a7a3985db7a7fb8d4a57a23762213372bf603903146deacfc44fb3c9315c30be",
    "cloth/metrics.ts": "eed36beccf69ce65426890570055e2e65b7f76fb0de69a5af2cda429fb511cdd",
    "cloth/profile.ts": "11ba66ccf169ca69883f331f1fcbd38b423fa98e30ee4eb6515489d1b212f33f",
    "cloth/solver.ts": "3aeb46169cf8f587f3e79196f3cdd21d28785cf2f7aa0a1be2fe7b5e5a466c1d",
    "cloth/types.ts": "bad411f3fa02e4ba7039b5d447de395074342aa207f2eeed251705b15facb6d1",
    "collision.ts": "baa1492ee990bb156d4ba10deb45e0ddc31d31ab6555318c5f652043aa1ea501",
    "contact-manifold.ts": "bd5ded2eb5b22422eb020f44129ef1f5687fc84831b123d9a6dadbf7f0d69428",
    "disjoint-hinge/admission.ts": "2088e36fc689f114d31a208263d1b1273e0e49874deee90e38b290a14df0ec3d",
    "disjoint-hinge/errors.ts": "5e51e5662fbce80bee3ccd3aa3694ee986b1492ed816d171774e261ab982bf4f",
    "disjoint-hinge/linear-solver.ts": "4009d4d7f171be3a5d79ca309a14b039da54f9201b438a410a6e29ed0f90bfdf",
    "disjoint-hinge/measure.ts": "97cbaf697dc8ef5caba0bf2c702699b025bcc6f906f553b623466618bbd77178",
    "disjoint-hinge/pose.ts": "ab950c1f9f1a79f9f00cb26e4b3cef0e3dcaea7b16d74e345e711159706b39e4",
    "disjoint-hinge/postcontact.ts": "8d07190383a64cb592165772109a4f462099743492f8373794ef7981b1431e38",
    "disjoint-hinge/projection.ts": "9d0def632c07f8085e860a2dbf21f26d8073f3265eb57590607d23ea6d333b87",
    "disjoint-hinge/report.ts": "d46b3e289c58b289b059928580ff2b89d9bd3ecfb11cb688d8b7a4735143973d",
    "disjoint-hinge/rows.ts": "6556f07d1d7d22edb67af1b214c689c5b5c2b30628334abaec67280d7302903f",
    "disjoint-hinge/stage.ts": "a66e09b816259c2bb1305fed8f90696585b9fd4b750406b0ce006cbe2c2f33ab",
    "disjoint-hinge/types.ts": "89b2708fd9209932084eaa765f93ff6ea00a2d775911e8c9e607a7eb824c8cc1",
    "domain/admission.ts": "1182fb21ec319132ac2f16ddec8494e3d1c4c5ac750bbe1ebab4c29817b4423e",
    "domain/cloth-reference.generated.ts": "c9ee88af8e25b533c2694433502b28f51dffdeae5cce656b53eb36a187be60bc",
    "domain/cloth.ts": "2454474a24928a9f3d92d635a9391c537ef74de77112fdc2f2872536cb447883",
    "domain/fluid.ts": "bfcafa7cc2f2bbb4ec6e2c20797f5dc5410d995cd28305272a2c3665d827179a",
    "domain/types.ts": "35fcadf07a848d919806955f6c3d934d01217ff1c26ca7d4eb4eb2807eb4ee6f",
    "dynamic-anchor-pair.ts": "8ff622a6ce007e5e7fcb43f0b7c08521615ddacbc8195cde1ac4f574304b579d",
    "dynamic-fixed-joint.ts": "f5a0fa82c062c7406f6edfeb2aeb169c927ddd8d0965957f630f87e118c52dfa",
    "dynamic-hinge-joint.ts": "69c816393446b6e06d66849840ecf88a7d28baf72bd30c792180616f55e455f2",
    "fluid/boundary.ts": "ba35dd2c09d811bf632ab35f8403c3632a8f8612605873b6edd7f4ad355dd58c",
    "fluid/constants.ts": "1eb1222c808e34501b19c226cba9c75a472bfb4897d31435f8588578b582c8ec",
    "fluid/diagnostics.ts": "e983d0c68fba92c3ccf81011d26b2f0a22fe27aa2627ec0db87148a1c1037215",
    "fluid/kernel.ts": "e4ff7c5679f13483d372cc9752cc658f6e36dff751edbaca1767c6c868ef08da",
    "fluid/neighbors.ts": "2aa8f0e112cd45121052c9a0861e8320eca42280385a8a812ebc4ca1255817f3",
    "fluid/pbf.ts": "21f11547aa3c4954f6709ee0207c98616f76235d2e38e831699a927547a30e50",
    "fluid/static-box.ts": "899351a48081261902684f6b0f67c6ac3e7cd3d0eba217bbdd8a331c2ff875a9",
    "fluid/types.ts": "c75f020afeb760ec596c3043fc6d2a7166995ce0c3cedbc7e5424a6a83e56a62",
    "fluid/visual-viscosity.ts": "0b26713f05556367d8266c0010e12a521d4adefa536e6c422eac7691309bbfc3",
    "identity.ts": "ebabb654375eb0c213dca4db06769011248ed58f844b9c3f9038dfb676caf4be",
    "index.ts": "dc4085b1a0b4e2af15198e35c43125d907c4b0991fc1c57a24ee421bb7011d30",
    "internal-types.ts": "29f39921c4a9806e2ade9126a5748b1a17cafb40a8ade1d67fc303cafe2916a8",
    "joint-motor.ts": "9a50b0d006ca2386cd2d79b8ba162f6850a5d08d3eb1c7d03460d606559b56ea",
    "joints.ts": "b6d0ec667a96fc26ec43d9d812c5ffd0a3b7446d135bd9b18713059327c59181",
    "limits.ts": "748bad886bb7acf5fedc21b8251243b018858b7e5de2478c99fb86a9276c54c3",
    "math.ts": "d782fc9eab8f699e906cde0df580c625f054905f12999edf50fd60bf54e7a3c2",
    "model-admission.ts": "7e77f184fed57d51ee1b0599e60c80d83b96045b139d236a37f76a4207689397",
    "persistent-box-contact.ts": "2c117202db9bcb0b988b59f9add9cae57e09d175927122a313e7166720a63d9b",
    "recording-owner.ts": "378ef215a8d3c644e665492875b1993a19f5e8e514480d931cd75abacf2e74a1",
    "replay-compare.ts": "918c89b8d8e84cdab25a951a44f8aa9368a904aa6a13804dafbef8ca81b421ec",
    "replay-json.ts": "1ab8cf962443edd3be387e5095a9cce3f2071c8b44e47cc165ce82d5c00ac617",
    "replay-validation.ts": "ab9a7b5097515ddd3d6aa9a434d14f2ae2e04fd15c4059b473d0d708a507c82a",
    "replay.ts": "07bafc635620c56c479ed44b0f458cbbb470bf20b3ce2ead7248ceb0973ca408",
    "scene-profile.ts": "e927339931ce9ebbf2f13808017bd1106e4ed4dbfa4f63fdf2f2ed0376d94ff7",
    "sleep.ts": "f02ac9d68560fc8ce8f529c68a6d8657155e3f6b36beb4907534871e375569f2",
    "types.ts": "37fdf1abcc20fd379304213b8c0686f8e0468d285f008aa8ebdb316882efade5",
    "validation.ts": "651d12754b77f86493f399baf3c02d60d9ad1fe54e0ece664a05a4430e8a0f01",
    "world.ts": "28022bb98fc8cd33d7dc912f8fb562b1ba375c089ebe8618783d95320929a599"
  }
};

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
    const difference2 = sub(add(a0, scale(u, candidate[0])), add(b0, scale(v, candidate[1])));
    const distance = dot(difference2, difference2);
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
    const length2 = Math.hypot(...candidate);
    if (length2 < 1e-12) continue;
    const axis = scale(candidate, 1 / length2);
    const radiusA = axesA.reduce((sum, basis3, index) => sum + extentA[index] * Math.abs(dot(basis3, axis)), 0);
    const radiusB = axesB.reduce((sum, basis3, index) => sum + extentB[index] * Math.abs(dot(basis3, axis)), 0);
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
    const results2 = [];
    for (const y of [-half, half]) {
      const hit = raySphere(localOrigin, localDirection, [0, y, 0], radius);
      if (hit !== null) results2.push(hit);
    }
    const a = localDirection[0] ** 2 + localDirection[2] ** 2;
    if (a > 1e-12) {
      const b = 2 * (localOrigin[0] * localDirection[0] + localOrigin[2] * localDirection[2]);
      const c = localOrigin[0] ** 2 + localOrigin[2] ** 2 - radius ** 2;
      const discriminant = b ** 2 - 4 * a * c;
      if (discriminant >= 0) for (const sign of [-1, 1]) {
        const hit = (-b + sign * Math.sqrt(discriminant)) / (2 * a);
        const y = localOrigin[1] + localDirection[1] * hit;
        if (hit >= 0 && y >= -half && y <= half) results2.push(hit);
      }
    }
    return results2.length ? Math.min(...results2) : null;
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

// packages/barocss-physics/src/contact-manifold.ts
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
  const length2 = Math.hypot(...separation);
  if (!(length2 > 0) || !Number.isFinite(length2)) error("NUMERIC_LIMIT", "unsafe sphere-pair normal");
  const normalFixtureToBody = scale(separation, 1 / length2);
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
    const axis = rotate2(body.orientation, [0, 1, 0]);
    half = axis.map((value) => shape2.radiusM + shape2.halfLengthM * Math.abs(value));
  } else {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate2(body.orientation, axis));
    half = [0, 1, 2].map((axis) => axes.reduce((extent, basis3, localAxis) => extent + Math.abs(basis3[axis]) * shape2.halfExtentsM[localAxis], 0));
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

// packages/barocss-physics/src/disjoint-hinge/measure.ts
function measureBodies(bodies, joint, origin) {
  const masses = bodies.map((b2) => 1 / b2.inverseMass), total = masses[0] + masses[1];
  const centerOfMassM = scale(add(scale(bodies[0].positionM, masses[0]), scale(bodies[1].positionM, masses[1])), 1 / total);
  const linearMomentumVectorKgMps = bodies.reduce((sum, b2, i) => add(sum, scale(b2.velocityMps, masses[i])), [0, 0, 0]);
  const orbitalAngularMomentumVectorKgM2ps = bodies.reduce((sum, b2, i) => add(sum, scale(cross(sub(b2.positionM, origin), b2.velocityMps), masses[i])), [0, 0, 0]);
  const spinAngularMomentumVectorKgM2ps = bodies.reduce((sum, b2) => add(sum, scale(b2.angularVelocityRadps, b2.inertiaKgM2)), [0, 0, 0]);
  const angularMomentumVectorKgM2ps = add(orbitalAngularMomentumVectorKgM2ps, spinAngularMomentumVectorKgM2ps);
  const energyJ = bodies.reduce((sum, b2, i) => sum + 0.5 * masses[i] * dot(b2.velocityMps, b2.velocityMps) + 0.5 * b2.inertiaKgM2 * dot(b2.angularVelocityRadps, b2.angularVelocityRadps), 0);
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], relative = multiplyQuaternion(b.orientation, inverse(a.orientation));
  const raw2 = 2 * Math.atan2(dot([relative[0], relative[1], relative[2]], joint.axisWorld), relative[3]);
  const relativeAngleRad = raw2 > Math.PI ? raw2 - 2 * Math.PI : raw2 < -Math.PI ? raw2 + 2 * Math.PI : raw2;
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
  const q2 = multiplyQuaternion(b.orientation, inverse(a.orientation));
  const raw2 = 2 * Math.atan2(dot([q2[0], q2[1], q2[2]], axis), q2[3]);
  return raw2 > Math.PI ? raw2 - 2 * Math.PI : raw2 < -Math.PI ? raw2 + 2 * Math.PI : raw2;
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

// packages/barocss-physics/src/disjoint-hinge/errors.ts
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

// packages/barocss-physics/src/disjoint-hinge/pose.ts
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

// packages/barocss-physics/src/disjoint-hinge/rows.ts
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

// packages/barocss-physics/src/disjoint-hinge/linear-solver.ts
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
    const difference2 = checked(y[j] - problem.y0[j], "certificate");
    const square = checked(difference2 * difference2, "certificate");
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
  if (!exactFields(value, ["rowIds", "rowCount", "pivots", "inverse", "normInf", "conditionInf", "lambda", "y", "residuals"]) || value.rowCount !== n || !dense(value.rowIds, n) || value.rowIds.some((id2, i) => id2 !== i) || !dense(value.pivots, n) || !matrix(value.inverse, n, n) || !dense(value.lambda, n) || !dense(value.y, 12) || typeof value.normInf !== "number" || !Number.isFinite(value.normInf) || value.normInf < 0 || typeof value.conditionInf !== "number" || !Number.isFinite(value.conditionInf) || value.conditionInf < 0 || !exactFields(value.residuals, ["linear", "inverse"]) || ![value.residuals.linear, value.residuals.inverse].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)) fail("certificate");
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
  const result = resultValue, identity4 = exactIdentity(problem);
  if (result.identity !== identity4 || result.phases.length !== result.solveAttempts) fail("certificate");
  if (identity4) {
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
  const identity4 = exactIdentity(problem);
  let phases = [], activeStop = false, y, lambda;
  if (identity4) {
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
  const result = { y, lambda, activeStop, identity: identity4, solveAttempts: phases.length, phases, objectiveDimensionless: objective(problem, y), certificate: { primal: 0, stationarity: 0, negativeMu: 0, complementarity: 0, objective: 0 } };
  result.certificate = certificate(problem, result);
  validateVelocityCertificate(problem, result);
  return structuredClone(result);
}

// packages/barocss-physics/src/disjoint-hinge/projection.ts
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

// packages/barocss-physics/src/disjoint-hinge/report.ts
var REPORT_KEYS = ["id", "kind", "aId", "bId", "angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms"];
var nonempty = (value) => typeof value === "string" && value.length > 0;
var finite2 = (value) => typeof value === "number" && Number.isFinite(value);
function validateHingeMotorReport(value, identity4) {
  const ids2 = ownData(identity4, ["id", "aId", "bId"]);
  const report = ownData(value, REPORT_KEYS);
  if (!ids2 || !nonempty(ids2.id) || !nonempty(ids2.aId) || !nonempty(ids2.bId) || !report || report.id !== ids2.id || report.aId !== ids2.aId || report.bId !== ids2.bId || report.kind !== "hinge" || !finite2(report.angleRad) || !finite2(report.motorImpulseNms)) reactionError();
  const linear = denseNumbers(report.linearImpulseNs, 3), angular = denseNumbers(report.angularImpulseNms, 3);
  if (!linear || !angular) reactionError();
  return {
    id: ids2.id,
    kind: "hinge",
    aId: ids2.aId,
    bId: ids2.bId,
    angleRad: report.angleRad,
    linearImpulseNs: linear,
    angularImpulseNms: angular,
    motorImpulseNms: report.motorImpulseNms
  };
}
function enforceHingeMotorReactionCap(jointId, angularImpulseNms) {
  const vector3 = denseNumbers(angularImpulseNms, 3);
  if (!nonempty(jointId) || !vector3) reactionError();
  const norm2 = Math.hypot(...vector3);
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
  const identity4 = { id: joint.id, aId: free[joint.aIndex].id, bId: free[joint.bIndex].id };
  const b = corrections[joint.bIndex];
  const jointReport = validateHingeMotorReport({
    ...identity4,
    kind: "hinge",
    angleRad: targetAngleRad,
    linearImpulseNs: [...b.linearImpulseNs],
    angularImpulseNms: [...b.angularImpulseNms],
    motorImpulseNms
  }, identity4);
  const angularReactionNormNms = Math.hypot(...b.angularImpulseNms);
  if (!Number.isFinite(angularReactionNormNms)) reactionError();
  return {
    jointReport,
    bodyCorrections: copyData2(corrections),
    reportCap: { angularReactionNormNms, maxReactionNms: 0.01, exceedsCap: angularReactionNormNms > 0.01 }
  };
}
function reactionError() {
  throw new PhysicsError("NUMERIC_LIMIT", "unsafe joint reaction");
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
function denseNumbers(value, length2) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length2 || Reflect.ownKeys(value).length !== length2 + 1) return null;
  const result = [];
  for (let i = 0; i < length2; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value)) return null;
    result.push(descriptor.value);
  }
  return result;
}

// packages/barocss-physics/src/disjoint-hinge/postcontact.ts
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
  const bytes = new Uint8Array(104 * bodies.length), view4 = new DataView(bytes.buffer);
  let cursor = 0;
  for (const body of bodies) for (const value of [
    ...body.positionM,
    ...body.velocityMps,
    ...body.orientation,
    ...body.angularVelocityRadps
  ]) {
    view4.setFloat64(cursor, value, true);
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
    const pair2 = input.pairs[index];
    const before = [
      copyBody(input.bodies[pair2.bodyIndices[0]]),
      copyBody(input.bodies[pair2.bodyIndices[1]])
    ];
    calls.projectionCalls++;
    const projected = projectHingePoseVelocity({
      pair: pair2,
      bodies: before,
      sourceStepIndex: input.sourceStepIndex,
      sourceTimeSeconds: input.sourceTimeSeconds
    });
    const returned = [copyBody(projected.bodies[0]), copyBody(projected.bodies[1])];
    next[pair2.bodyIndices[0]] = returned[0];
    next[pair2.bodyIndices[1]] = returned[1];
    calls.reportCalls++;
    const report = makeReport(
      pair2.joint,
      before,
      returned,
      projected.poseReport.targetAngleRad,
      input.motorImpulsesNms[index]
    );
    jointReports[pair2.jointInputIndex] = report.jointReport;
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

// packages/barocss-physics/src/disjoint-hinge/stage.ts
function admitDisjointHingeCommands(pairs, bodies, actions, commandCount) {
  for (const pair2 of pairs) {
    admitDynamicHingeCommands(
      pair2.joint,
      [bodies[pair2.bodyIndices[0]], bodies[pair2.bodyIndices[1]]],
      actions
    );
  }
  if (commandCount !== 0) error("INVALID_COMMAND", "disjoint hinge profile supports empty commands only");
}
function driveDisjointHingeMotors(pairs, bodies, reports, impulses) {
  for (const pair2 of pairs) impulses[pair2.jointInputIndex] = driveDynamicHingeMotor(
    pair2.joint,
    bodies[pair2.bodyIndices[0]],
    bodies[pair2.bodyIndices[1]],
    reports[pair2.jointInputIndex].angleRad
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

// packages/barocss-physics/src/cloth/constraints.ts
function projectDistance(sheet2, constraint) {
  globalThis.__p5Public.hit("projectDistance");
  const fixture = CLOTH_PROFILE;
  const { positions: p, inverseMasses: w } = sheet2;
  const { a, b, rest, kind } = constraint;
  const ia = 3 * a, ib = 3 * b;
  const x = p[ia] - p[ib], y = p[ia + 1] - p[ib + 1], z = p[ia + 2] - p[ib + 2];
  const length2 = Math.hypot(x, y, z);
  const weight = w[a] + w[b];
  if (length2 === 0 || weight === 0) return;
  const bend = kind === "bend-distance";
  const compliance = bend ? fixture.bendComplianceMPerN : fixture.stretchComplianceMPerN;
  const alpha = compliance / fixture.dt ** 2;
  const delta = (-(length2 - rest) - alpha * constraint.lambda) / (weight + alpha);
  constraint.lambda += delta;
  const scaleA = w[a] * delta / length2, scaleB = w[b] * delta / length2;
  p[ia] += scaleA * x;
  p[ia + 1] += scaleA * y;
  p[ia + 2] += scaleA * z;
  p[ib] -= scaleB * x;
  p[ib + 1] -= scaleB * y;
  p[ib + 2] -= scaleB * z;
}
function projectSphere(sheet2) {
  globalThis.__p5Public.hit("projectSphere");
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

// packages/barocss-physics/src/cloth/solver.ts
var ClothSolver = class {
  before = new Float64Array(289 * 3);
  decay = Math.exp(-CLOTH_PROFILE.velocityDecayPerSecond * CLOTH_PROFILE.dt);
  step(sheet2, positions, velocities) {
    globalThis.__p5Public.hit("ClothSolverSteps");
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
        for (const constraint of sheet2.constraints) {
          projectDistance(sheet2, constraint);
          globalThis.__p5Public.fault("mid-kernel");
        }
        projectSphere(sheet2);
      }
      for (let j = 0; j < p.length; j++) velocities[j] = (p[j] - this.before[j]) / dt;
    }
  }
};

// packages/barocss-physics/src/cloth/metrics.ts
function clothDiagnostics(sheet2) {
  globalThis.__p5Public.hit("clothDiagnostics");
  const p = sheet2.positions;
  let maxStructuralExtension = 0, maxStructuralCompression = 0;
  let maxVertexPenetrationM = 0, maxPinDriftM = 0;
  for (const edge of sheet2.constraints) {
    if (edge.kind !== "stretch") continue;
    const length2 = Math.hypot(...[0, 1, 2].map((axis) => p[3 * edge.a + axis] - p[3 * edge.b + axis]));
    const strain = length2 / edge.rest - 1;
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

// packages/barocss-physics/src/domain/types.ts
function invalid(condition, message) {
  if (!condition) throw new PhysicsError("INVALID_CONFIG", message);
}
function immutableCopy(input) {
  const result = copyData(input);
  function freeze3(value) {
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) freeze3(child);
      Object.freeze(value);
    }
  }
  freeze3(result);
  return result;
}
function flat(points, count) {
  invalid(points.length === count, "Unexpected domain point count");
  invalid(points.every((p) => p.length === 3 && p.every(Number.isFinite)), "Expected finite domain triples");
  return new Float64Array(points.flat());
}
function validateStatic(data, colliderIds) {
  invalid(data.gravityMps2.length === 3 && data.gravityMps2.every((x, i) => x === [0, -9.81, 0][i]), "Unsupported domain gravity");
  invalid(new Set(colliderIds).size === colliderIds.length && data.colliders.length === colliderIds.length, "Static collider population mismatch");
  invalid(data.bodies.length === data.colliders.length, "Static owner population mismatch");
  const ids2 = /* @__PURE__ */ new Set();
  const owners = /* @__PURE__ */ new Set();
  for (const c of data.colliders) {
    invalid(colliderIds.includes(c.id) && !ids2.has(c.id), "Invalid static collider identity");
    ids2.add(c.id);
    invalid(!owners.has(c.bodyId), "Duplicate static collider owner");
    owners.add(c.bodyId);
    const b = data.bodies.find((b2) => b2.id === c.bodyId);
    invalid(b?.kind === "static", "Domain colliders require static bodies");
    invalid(b.initial.orientationXYZW.every((x, i) => x === (i === 3 ? 1 : 0)), "Unsupported static rotation");
    invalid(c.local.positionM.every((x) => x === 0) && c.local.orientationXYZW.every((x, i) => x === (i === 3 ? 1 : 0)), "Unsupported collider transform");
    invalid(!c.sensor && !c.ccd, "Unsupported domain sensor or CCD");
  }
}

// packages/barocss-physics/src/domain/cloth.ts
function sheet(definition2, positions) {
  const c = definition2.cloth;
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
function copyClothCandidateOutput(id2, candidate) {
  globalThis.__p5Public.hit("outputCopies");
  return {
    id: id2,
    positionsM: candidate.positions.slice(),
    velocitiesMps: candidate.velocities.slice(),
    diagnostics: { ...candidate.diagnostics }
  };
}
function initializeCloth(cloth, staticData) {
  globalThis.__p5Public.hit("initializeCloth");
  const definition2 = immutableCopy({ cloth, staticData });
  const c = definition2.cloth, data = definition2.staticData;
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
  const initialSheet = sheet(definition2, positions);
  invalid(positions.every((x, i) => Object.is(x, initialSheet.restPositions[i])), "Initial cloth must match rest data");
  const diagnostics = clothDiagnostics(initialSheet);
  invalid(withinClothBounds(positions, velocities, diagnostics), "Invalid initial cloth state");
  return { definition: definition2, initial: { positions, velocities, constraints: initialSheet.constraints, diagnostics } };
}
function prepareCloth(definition2, accepted) {
  globalThis.__p5Public.hit("prepareCloth");
  const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
  const candidateSheet = sheet(definition2, positions);
  const solver = (globalThis.__p5Public.hit("ClothSolverConstructions"), new ClothSolver());
  solver.step(candidateSheet, positions, velocities);
  globalThis.__p5Public.hit("solverReturns");
  globalThis.__p5Public.numeric(positions);
  const diagnostics = clothDiagnostics(candidateSheet);
  globalThis.__p5Public.fault("post-diagnostic");
  if (!withinClothBounds(positions, velocities, diagnostics)) throw new PhysicsError("NUMERIC_LIMIT", "Cloth candidate exceeded the fixed profile bounds");
  const candidate = { positions, velocities, constraints: candidateSheet.constraints, diagnostics };
  const output = copyClothCandidateOutput(definition2.cloth.id, candidate);
  return { candidate, output };
}

// packages/barocss-physics/src/fluid/boundary.ts
function floorSamples() {
  globalThis.__p5Public.hit("floorSamples");
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

// packages/barocss-physics/src/fluid/neighbors.ts
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

// packages/barocss-physics/src/fluid/kernel.ts
var radiusSquared = FLUID_SMOOTHING_RADIUS_M ** 2;
function densityKernel(distanceSquared) {
  const q2 = 1 - distanceSquared / radiusSquared;
  return q2 > 0 ? q2 * q2 * q2 : 0;
}
function gradientScale(distanceSquared) {
  const q2 = 1 - distanceSquared / radiusSquared;
  return q2 > 0 ? -6 * q2 * q2 / radiusSquared : 0;
}
function densities(positions, grid, output) {
  globalThis.__p5Public.hit("densities");
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
  globalThis.__p5Public.hit("initialRestDensity");
  const count = positions.length / 3;
  const result = new Float64Array(count);
  densities(positions, new NeighborGrid(), result);
  return result.reduce((sum, density) => sum + density, 0) / count;
}

// packages/barocss-physics/src/fluid/visual-viscosity.ts
function blendVisualViscosity(positions, velocities, grid, output, coefficient) {
  globalThis.__p5Public.hit("blendVisualViscosity");
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

// packages/barocss-physics/src/fluid/pbf.ts
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
        const scale4 = gradientScale(distanceSquared) / this.restDensity;
        const gx = scale4 * rx, gy = scale4 * ry, gz = scale4 * rz;
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
        const scale4 = (this.lambda[index] + (other < FLUID_COUNT ? this.lambda[other] : 0)) * gradientScale(distanceSquared) / this.restDensity;
        dx += scale4 * rx;
        dy += scale4 * ry;
        dz += scale4 * rz;
      });
      const length2 = Math.hypot(dx, dy, dz);
      const limit = length2 > FLUID_SPACING_M * 0.25 ? FLUID_SPACING_M * 0.25 / length2 : 1;
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
    globalThis.__p5Public.hit("PbfSolverSteps");
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
      globalThis.__p5Public.fault("mid-kernel");
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

// packages/barocss-physics/src/fluid/diagnostics.ts
var floor = floorSamples();
function fluidDiagnostics(positions, restDensity, boundaryHits) {
  globalThis.__p5Public.hit("fluidDiagnostics");
  const combined = new Float64Array(positions.length + floor.length);
  combined.set(positions);
  combined.set(floor, positions.length);
  const density = new Float64Array(FLUID_COUNT);
  densities(combined, new NeighborGrid(), density);
  let absoluteError = 0;
  const compressions = new Array(FLUID_COUNT);
  for (let index = 0; index < FLUID_COUNT; index++) {
    const difference2 = density[index] / restDensity - 1;
    absoluteError += Math.abs(difference2);
    compressions[index] = Math.max(0, difference2);
  }
  compressions.sort((a, b) => a - b);
  return {
    meanAbsoluteDensityError: absoluteError / FLUID_COUNT,
    p95Compression: compressions[Math.ceil(0.95 * FLUID_COUNT) - 1],
    boundaryHits
  };
}

// packages/barocss-physics/src/domain/fluid.ts
function copyFluidCandidateOutput(id2, candidate) {
  globalThis.__p5Public.hit("outputCopies");
  return { id: id2, positionsM: candidate.positions.slice(), velocitiesMps: candidate.velocities.slice(), diagnostics: { ...candidate.diagnostics } };
}
function initializeFluid(fluid, staticData) {
  globalThis.__p5Public.hit("initializeFluid");
  const copied = immutableCopy({ fluid, staticData }), f = copied.fluid, data = copied.staticData;
  invalid(["fluid-basin-visual-v1", "fluid-basin-xsph-visual-v1", "fluid-static-box-visual-v1"].includes(data.profile), "Unsupported fluid profile");
  validateStatic(data, f.staticColliderIds);
  invalid(f.massModel.kind === "visual-unit-weights" && f.particleRadiusM === FLUID_PARTICLE_RADIUS_M && f.smoothingRadiusM === FLUID_SMOOTHING_RADIUS_M, "Unsupported fluid mass or radii");
  const xsph = data.profile === "fluid-basin-xsph-visual-v1", boxProfile = data.profile === "fluid-static-box-visual-v1";
  invalid(xsph ? f.visualSmoothing.kind === "xsph" && f.visualSmoothing.coefficient === 0.15 : f.visualSmoothing.kind === "none", "Unsupported smoothing");
  invalid(data.colliders.length === (boxProfile ? 2 : 1), "Unsupported static fluid collider population");
  const basin = data.colliders.find((c) => c.geometry.kind === "box-interior");
  invalid(basin?.geometry.kind === "box-interior", "Fluid requires basin");
  const basinBody = data.bodies.find((b) => b.id === basin.bodyId);
  invalid(basin.geometry.halfExtentsM.every((x, i) => x === FLUID_BASIN_M[i] / 2) && basinBody.initial.positionM.every((x, i) => x === FLUID_BASIN_M[i] / 2), "Unsupported basin");
  const positions = flat(f.initialPositionsM, 256), velocities = flat(f.initialVelocitiesMps, 256);
  invalid(velocities.every((x) => x === 0) && insideBasin(positions), "Invalid initial fluid state");
  const minimumSquared = FLUID_MIN_SPACING_M ** 2;
  for (let first = 0; first < 256; first++) for (let second = first + 1; second < 256; second++) {
    const dx = positions[first * 3] - positions[second * 3], dy = positions[first * 3 + 1] - positions[second * 3 + 1], dz = positions[first * 3 + 2] - positions[second * 3 + 2];
    invalid(dx * dx + dy * dy + dz * dz >= minimumSquared - 1e-12, "Initial particles must be at least 0.025 m apart");
  }
  let staticBox = null;
  if (boxProfile) {
    const collider = data.colliders.find((c) => c.geometry.kind === "box");
    invalid(collider?.geometry.kind === "box", "Static fluid profile requires box");
    const body = data.bodies.find((b) => b.id === collider.bodyId);
    staticBox = inflatedBoxBounds(body.initial.positionM, collider.geometry.halfExtentsM);
    invalid(staticBox.low.every((x, i) => x >= FLUID_PARTICLE_RADIUS_M && staticBox.high[i] <= FLUID_BASIN_M[i] - FLUID_PARTICLE_RADIUS_M), "Static box exceeds basin");
    invalid(!insideStaticBox(positions, staticBox), "Static box overlaps initial particles");
  }
  const restDensity = initialRestDensity(positions);
  const definition2 = immutableCopy({ ...copied, restDensity, staticBox });
  const diagnostics = { ...fluidDiagnostics(positions, restDensity, 0), obstacleHits: 0 };
  return { definition: definition2, initial: { positions, velocities, diagnostics } };
}
function prepareFluid(definition2, accepted) {
  globalThis.__p5Public.hit("prepareFluid");
  const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
  const coefficient = definition2.fluid.visualSmoothing.kind === "xsph" ? definition2.fluid.visualSmoothing.coefficient : 0;
  const solver = (globalThis.__p5Public.hit("PbfSolverConstructions"), new PbfSolver(definition2.restDensity, coefficient, definition2.staticBox));
  const { boundaryHits, obstacleHits } = solver.step(positions, velocities);
  globalThis.__p5Public.hit("solverReturns");
  globalThis.__p5Public.numeric(positions);
  if (!insideBasin(positions) || !velocities.every((x) => Number.isFinite(x) && Math.abs(x) <= 1e3)) throw new PhysicsError("NUMERIC_LIMIT", "Fluid candidate exceeded numeric bounds");
  const measured = fluidDiagnostics(positions, definition2.restDensity, boundaryHits);
  globalThis.__p5Public.fault("post-diagnostic");
  if (!Number.isFinite(measured.meanAbsoluteDensityError) || !Number.isFinite(measured.p95Compression)) throw new PhysicsError("NUMERIC_LIMIT", "Fluid candidate density is not finite");
  const candidate = { positions, velocities, diagnostics: { ...measured, obstacleHits } };
  const output = copyFluidCandidateOutput(definition2.fluid.id, candidate);
  return { candidate, output };
}

// packages/barocss-physics/src/world.ts
function publicState(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt, identity4, colliderIds) {
  return {
    identity: { ...identity4 },
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
function publicDomainState(runtime, model, identity4, stepIndex, dt, prepared) {
  if (prepared) globalThis.__p5Public.fault("public-copy");
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
    identity: { ...identity4 },
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
  globalThis.__p5Public.factory();
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
  const identity4 = {
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
      globalThis.__p5Public.hit("reads");
      ensureActive();
      return copyData(modelCopy);
    },
    getState() {
      globalThis.__p5Public.hit("reads");
      ensureActive();
      return domainState ? publicDomainState(domainState, modelCopy, identity4, stepIndex, dt) : publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt, identity4, colliderIds);
    },
    step(commands = []) {
      globalThis.__p5Public.step();
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
        if (failure instanceof PhysicsError && failure.code === "INVALID_CONFIG") error("INVALID_COMMAND", failure.message);
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
        const state2 = publicDomainState(nextDomain, modelCopy, identity4, stepIndex + 1, dt, output);
        const preparedRecording2 = owner ? owner.prepare(preparedFrames2, state2) : null;
        const preparedCommandCount2 = owner ? owner.commandCount + admittedCommands.length : 0;
        domainState = nextDomain;
        stepIndex++;
        globalThis.__p5Public.accepted(stepIndex);
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
              const pointKey2 = `${key}\0${point.id}`;
              let impulse = nextPersistentPoints.get(pointKey2);
              if (!impulse) {
                const prior = persistentPoints.get(pointKey2);
                impulse = prior ? { normalNs: prior.normalNs, tangentNs: [...prior.tangentNs] } : { normalNs: 0, tangentNs: [0, 0, 0] };
                nextPersistentPoints.set(pointKey2, impulse);
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
      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt, identity4, colliderIds);
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
      globalThis.__p5Public.accepted(stepIndex);
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
        return { kind: "overlap-sphere", colliderIds: bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body)).map((body) => body.id).sort().map((id2) => colliderIds.get(id2)) };
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
    if (disposed) throw new PhysicsError("DISPOSED", "world is disposed", {
      operation,
      phase: "lifecycle",
      domain: "world",
      entityIds: [],
      accepted: { stepIndex, timeSeconds: stepIndex * dt }
    });
    if (running) throw new PhysicsError("REENTRANT_CALL", "World call is reentrant", {
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
      if (!(failure instanceof PhysicsError)) throw failure;
      const enriched = new PhysicsError(failure.code, failure.message, {
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
    globalThis.__p5Public.hit("disposes");
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
  globalThis.__p5Public.returned(world, () => ({ domainState, modelCopy, optionsCopy, bodies, joints, stepIndex, owner, disposed }));
  return world;
}

// packages/barocss-physics/src/capsule-query/profile.ts
var PROFILE = "upright-capsule-box-v1";
var RADIUS_M = 0.15;
var HALF_LENGTH_M = 0.35;
var TIE_FRACTION = 1e-9;
var BOX_CAPACITY = 32;

// packages/barocss-physics/src/capsule-query/admission.ts
function refuse2(code, message) {
  throw new PhysicsError(code, message);
}
function metadata(code, action) {
  try {
    return action();
  } catch {
    throw new PhysicsError(code, "Input reflection failed");
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
function dense2(value, limit, code, exact5) {
  if (!metadata(code, () => Array.isArray(value)) || metadata(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
    refuse2(code, "Expected an ordinary dense array");
  }
  const lengthDescriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, "length"));
  if (!lengthDescriptor || !("value" in lengthDescriptor)) refuse2(code, "Expected array length");
  const length2 = lengthDescriptor.value;
  if (typeof length2 !== "number" || !Number.isInteger(length2) || length2 < 0 || length2 > limit || exact5 !== void 0 && length2 !== exact5 || metadata(code, () => Reflect.ownKeys(value)).length !== length2 + 1) {
    refuse2(code, "Invalid array length or fields");
  }
  const values = [];
  for (let index = 0; index < length2; index++) {
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
    const id2 = identity(box.id, "INVALID_CONFIG");
    const centerM = tuple(box.centerM, 3, 10, "INVALID_CONFIG");
    const halfExtentsM = tuple(box.halfExtentsM, 3, 5, "INVALID_CONFIG");
    const orientationXYZW = tuple(box.orientationXYZW, 4, 1, "INVALID_CONFIG");
    if (halfExtentsM.some((value2) => value2 < 1e-4) || Math.abs(Math.hypot(...orientationXYZW) - 1) > 1e-12) {
      refuse2("INVALID_CONFIG", "Invalid box extents or quaternion");
    }
    return { id: id2, centerM, halfExtentsM, orientationXYZW };
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
  if (revision !== scene.revision) throw new PhysicsError("STALE_SNAPSHOT", "Revision mismatch");
  if (excludeId !== null && !scene.boxes.some((box) => box.id === excludeId)) refuse2("INVALID_QUERY", "Unknown excluded ID");
  return { revision, centerM, displacementM, excludeId };
}

// packages/barocss-physics/src/capsule-query/geometry.ts
function matrix2(q2) {
  const [x, y, z, w] = q2, factor = 2 / (x * x + y * y + z * z + w * w);
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
  const difference2 = segmentLocal.map((value, i) => value - pointLocal[i]);
  const distanceM = Math.sqrt(best);
  const normalM = distanceM > 0 ? m.map((row) => dot3(row, difference2) / distanceM) : null;
  return { distanceM, normalM, pointM: toWorld(pointLocal), segmentM: toWorld(segmentLocal) };
}

// packages/barocss-physics/src/capsule-query/sweep.ts
function sweepBox2(center, displacement, box) {
  let fraction = 0;
  for (let iteration = 0; iteration < 64; iteration++) {
    const at2 = center.map((value, i) => value + fraction * displacement[i]);
    const closest = closestCandidate(at2, box), gap = closest.distanceM - RADIUS_M;
    if (!Number.isFinite(gap)) throw new PhysicsError("NUMERIC_LIMIT", "Nonfinite distance");
    if (iteration === 0 && gap < -1e-12) throw new PhysicsError("INITIAL_OVERLAP", "Initial capsule overlaps a box");
    if (!closest.normalM) throw new PhysicsError("NUMERIC_LIMIT", "No distance normal");
    if (iteration === 0 && Math.abs(gap) <= 1e-12 || gap <= 1e-14) {
      if (gap < -1e-12) throw new PhysicsError("NUMERIC_LIMIT", "Advancement crossed contact");
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
    if (!Number.isFinite(next)) throw new PhysicsError("NUMERIC_LIMIT", "Nonfinite advancement");
    if (next > 1) return null;
    if (next <= fraction) throw new PhysicsError("ITERATION_LIMIT", "Advancement cannot make progress");
    fraction = next;
  }
  throw new PhysicsError("ITERATION_LIMIT", "Fixed advancement cap exhausted");
}

// packages/barocss-physics/src/capsule-query/snapshot.ts
function copyBox(box) {
  return { id: box.id, centerM: [...box.centerM], halfExtentsM: [...box.halfExtentsM], orientationXYZW: [...box.orientationXYZW] };
}
function geometryKey(box) {
  const values = [...box.centerM, ...box.halfExtentsM, ...box.orientationXYZW];
  const bytes = new Uint8Array(80), view4 = new DataView(bytes.buffer);
  values.forEach((value, index) => view4.setFloat64(index * 8, value, true));
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
    if (disposed) throw new PhysicsError("DISPOSED", "Capsule query is disposed");
  }
  return {
    sweep(input2) {
      live();
      const query = admitSweep(input2, scene), hits = [];
      for (const group of groups) {
        let selectedId = null;
        for (const id2 of group.ids) if (id2 !== query.excludeId && (selectedId === null || id2 < selectedId)) selectedId = id2;
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

// packages/barocss-physics/src/character/profile.ts
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

// packages/barocss-physics/src/character/admission.ts
function refuse3(code, message) {
  throw new PhysicsError(code, message);
}
function metadata2(code, action) {
  try {
    return action();
  } catch {
    throw new PhysicsError(code, "Controller input reflection failed");
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
  const copy2 = {};
  for (const key of keys) {
    const descriptor = metadata2(code, () => Object.getOwnPropertyDescriptor(value, key));
    if (!descriptor || !("value" in descriptor)) refuse3(code, "Controller accessors are not admitted");
    copy2[key] = descriptor.value;
  }
  return copy2;
}
function tuple2(value, bound, code) {
  if (!metadata2(code, () => Array.isArray(value)) || metadata2(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
    refuse3(code, "Expected an ordinary controller tuple");
  }
  const length2 = metadata2(code, () => Object.getOwnPropertyDescriptor(value, "length"));
  if (!length2 || !("value" in length2) || length2.value !== 3 || metadata2(code, () => Reflect.ownKeys(value)).length !== 4) {
    refuse3(code, "Invalid controller tuple length or fields");
  }
  const copy2 = [];
  for (let index = 0; index < 3; index++) {
    const descriptor = metadata2(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value) || Math.abs(descriptor.value) > bound) {
      refuse3(code, "Invalid controller tuple component");
    }
    copy2.push(descriptor.value);
  }
  return copy2;
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
  if (command.dtSeconds !== DT) throw new PhysicsError("INVALID_STEP", "Controller requires exactly 1/120 second");
  if (command.sceneRevision !== stateRevision) throw new PhysicsError("STALE_SNAPSHOT", "Controller revision mismatch");
  if (stepIndex >= STEPS) throw new PhysicsError("WORLD_LIMIT", "Controller step limit exhausted");
  return command.desiredVelocityMps;
}

// packages/barocss-physics/src/character/math.ts
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

// packages/barocss-physics/src/character/state.ts
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
    throw new PhysicsError("NUMERIC_LIMIT", "Controller state exceeds its bound");
  }
  const actual = position.map((value, index) => value - previous.positionM[index]);
  const horizontal = Math.hypot(actual[0], actual[2]), allowed = Math.hypot(request[0], request[2]) * DT;
  if (horizontal > allowed + 1e-9 || Math.abs(actual[1]) > 0.1 + 1e-6) {
    throw new PhysicsError("NUMERIC_LIMIT", "Controller movement exceeds its bound");
  }
}
function errorRecord(error2) {
  const value = error2;
  return { name: value.name ?? "Error", code: value.code, message: value.message ?? String(error2) };
}

// packages/barocss-physics/src/character/query.ts
function queryContext(query, candidate, diagnostic, capture) {
  function raw2(position, delta, kind, preview, excludeId = null) {
    if (candidate.queryCount >= (diagnostic.queryBudget ?? QUERY_CAP)) {
      throw new PhysicsError("WORLD_LIMIT", "Controller per-step query limit exhausted");
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
    const first = raw2(position, delta, kind, preview);
    if (first.hit?.toiFraction === 0 && dot4(first.hit.normalFixtureToCapsule, delta) >= -1e-12) {
      const second = raw2(position, delta, kind + "-fresh-touch-departure", preview, first.hit.bodyId);
      if (second.hit?.toiFraction === 0) throw new PhysicsError("INVALID_COMMAND", "Controller second fresh touch is unresolved");
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

// packages/barocss-physics/src/character/step-assist.ts
function tryStep(position, remaining, candidate, context) {
  const horizontal = [remaining[0], 0, remaining[2]], length2 = norm(horizontal);
  if (length2 <= 1e-12 || !candidate.grounded) return null;
  const direction = scale2(horizontal, 1 / length2);
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
  if (ahead.hit) throw new PhysicsError("INVALID_COMMAND", "Controller assist forward path is blocked");
  const down = context.sweep(add2(position, scale2(direction, PREVIEW)), [0, -STEP_DOWN, 0], "assist-support", true);
  const hit = down.hit;
  const target = hit ? position[1] - STEP_DOWN * hit.toiFraction + SKIN / hit.normalFixtureToCapsule[1] : NaN;
  if (!hit || hit.normalFixtureToCapsule[1] < WALKABLE || hit.bodyId !== candidate.assist.bodyId || Math.abs(target - candidate.assist.heightM) > 1e-6) {
    throw new PhysicsError("INVALID_COMMAND", "Controller assist support is unresolved");
  }
  candidate.assist.frames++;
  if (candidate.assist.frames > (diagnostic.assistCap ?? ASSIST_CAP)) {
    throw new PhysicsError("WORLD_LIMIT", "Controller assist duration limit exhausted");
  }
}

// packages/barocss-physics/src/character/slide.ts
function move(position, delta, candidate, context, diagnostic) {
  let p = [...position], remaining = [...delta];
  for (let pass = 0; pass < (diagnostic.slideBudget ?? SLIDE_CAP); pass++) {
    if (norm(remaining) <= 1e-12) return p;
    const length2 = norm(remaining), direction = scale2(remaining, 1 / length2), probeLength = length2 + LOOKAHEAD;
    const result = context.sweep(p, scale2(direction, probeLength), "slide-lookahead", true), hit = result.hit;
    if (!hit) return context.commit(p, remaining, "travel", result.indices);
    const normal = hit.normalFixtureToCapsule, closingUnit = -dot4(normal, direction);
    if (closingUnit <= 1e-12) throw new PhysicsError("INVALID_COMMAND", "Controller lookahead closing normal is unresolved");
    const contactDistance = probeLength * hit.toiFraction;
    const safeDistance = Math.max(0, contactDistance - SKIN / closingUnit);
    const fraction = Math.min(1, safeDistance / length2);
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
        const unit2 = scale2(horizontalNormal, 1 / size2), into = dot4(remaining, unit2);
        if (into < 0) remaining = add2(remaining, scale2(unit2, -into));
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
  if (norm(remaining) > 1e-12) throw new PhysicsError("WORLD_LIMIT", "Controller slide limit exhausted");
  return p;
}

// packages/barocss-physics/src/character/ground.ts
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
    if (up.hit) throw new PhysicsError("INVALID_COMMAND", "Controller positive snap is blocked");
    proof = up.indices;
  }
  const p = context.commit(position, delta, "ground-snap", proof);
  candidate.grounded = true;
  candidate.support = { bodyId: hit.bodyId, normal: [...hit.normalFixtureToCapsule] };
  candidate.fallVelocityYMps = 0;
  candidate.assist = null;
  return p;
}

// packages/barocss-physics/src/character/core.ts
function createCharacterCore(scene, positionM, diagnostic = {}, options = {}) {
  const admitted = admitConfig({ version: 1, profile: PROFILE2, scene, positionM });
  const query = createUprightCapsuleQuery(admitted.scene);
  let state;
  try {
    const snapshot5 = query.getSnapshot();
    query.sweep({ revision: snapshot5.revision, centerM: [...admitted.positionM], displacementM: [0, 0, 0], excludeId: null });
    state = initialState(admitted.positionM, snapshot5.revision);
  } catch (error2) {
    query.dispose();
    throw error2;
  }
  const capture = options.capture ?? true;
  let lastRejected = null, disposed = false;
  function live() {
    if (disposed) throw new PhysicsError("DISPOSED", "Capsule controller is disposed");
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
          throw new PhysicsError("INVALID_COMMAND", "Controller assist request changed");
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
        if (diagnostic.numericFault) throw new PhysicsError("NUMERIC_LIMIT", "Internal controller numeric fault");
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

// packages/barocss-physics/src/character-controller.ts
function createUprightCapsuleController(config) {
  const admitted = admitConfig(config);
  const core = createCharacterCore(admitted.scene, admitted.positionM, {}, { capture: false });
  let disposed = false;
  function live() {
    if (disposed) throw new PhysicsError("DISPOSED", "Capsule controller is disposed");
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

// packages/barocss-physics/src/replay.ts
var replay_exports = {};
__export(replay_exports, {
  createPhysicsRecorder: () => createPhysicsRecorder,
  deserializePhysicsRecording: () => deserializePhysicsRecording,
  restorePhysicsRecording: () => restorePhysicsRecording,
  serializePhysicsRecording: () => serializePhysicsRecording
});

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
function exactFields2(value, fields3, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).length !== fields3.length || Reflect.ownKeys(value).some((key) => typeof key !== "string" || !fields3.includes(key))) {
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
  const view4 = new DataView(bytes.buffer);
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let offset = RECORDING_MAGIC.length, nodes = 0;
  function take(length2) {
    if (length2 > bytes.length - offset) replayError("INVALID_SNAPSHOT", "truncated recording");
    const start = offset;
    offset += length2;
    return start;
  }
  function uint32() {
    return view4.getUint32(take(4), true);
  }
  function read(depth) {
    if (++nodes > 5e4 || depth > 32) replayError("INVALID_SNAPSHOT", "recording exceeds node or depth limit");
    const tag = bytes[take(1)];
    if (tag === 0) return null;
    if (tag === 1 || tag === 2) return tag === 2;
    if (tag === 3) {
      const length2 = uint32(), start = take(length2);
      return decoder.decode(bytes.subarray(start, start + length2));
    }
    if (tag === 4) {
      const value = view4.getFloat64(take(8), true);
      if (!Number.isFinite(value)) replayError("INVALID_SNAPSHOT", "recording contains nonfinite number");
      return value;
    }
    if (tag === 5) {
      const length2 = uint32();
      if (length2 > 4096) replayError("INVALID_SNAPSHOT", "recording array exceeds limit");
      return Array.from({ length: length2 }, () => read(depth + 1));
    }
    if (tag === 6) {
      const length2 = uint32();
      if (length2 > 64) replayError("INVALID_SNAPSHOT", "recording record exceeds limit");
      const result = {};
      let previous;
      for (let i = 0; i < length2; i++) {
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
function record4(value, keys, label) {
  exactFields2(value, keys, label);
  return value;
}
function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) replayError("INVALID_SNAPSHOT", "state number is invalid");
}
function vector2(value, length2 = 3) {
  if (!Array.isArray(value) || value.length !== length2) replayError("INVALID_SNAPSHOT", "state vector is invalid");
  value.forEach(number);
}
function ids(values, expected, fields3, validate) {
  if (!Array.isArray(values) || values.length !== expected.length) replayError("INVALID_SNAPSHOT", "state entity list differs from model");
  values.forEach((value, index) => {
    const data = record4(value, fields3, "state entity");
    if (data.id !== expected[index]) replayError("INVALID_SNAPSHOT", "state entity ID differs from model");
    validate(data);
  });
}
function identity2(value) {
  const data = record4(value, ["modelRevision", "modelDigest", "configurationDigest", "providerDigest", "profile", "frameId", "fixedStepSeconds"], "identity");
  for (const name of ["modelDigest", "configurationDigest", "providerDigest"]) {
    if (typeof data[name] !== "string" || !/^sha256:[a-f0-9]{64}$/.test(data[name])) replayError("INVALID_SNAPSHOT", "identity digest is invalid");
  }
  if (typeof data.modelRevision !== "string" || typeof data.frameId !== "string" || typeof data.profile !== "string") replayError("INVALID_SNAPSHOT", "identity fields are invalid");
  number(data.fixedStepSeconds);
}
function admitRecording(input) {
  const copied = copyReplayJson(input, "recording");
  const data = record4(copied, ["format", "version", "model", "options", "identity", "frames", "finalState"], "recording");
  if (data.format !== "barocss-physics-recording" || data.version !== 1) replayError("INVALID_SNAPSHOT", "unsupported recording");
  encodeRecordingData(copied);
  if (canonicalEncode(data.model).length > 128 * 1024) replayError("INVALID_SNAPSHOT", "recording model exceeds byte limit");
  let admitted;
  try {
    admitted = admitModel(data.model, data.options);
  } catch {
    replayError("INVALID_SNAPSHOT", "recording model or options are invalid");
  }
  if (admitted.domain) replayError("INVALID_SNAPSHOT", "visual domain recording is unsupported");
  const model = admitted.model, options = admitted.options;
  identity2(data.identity);
  if (!Array.isArray(data.frames) || data.frames.length > 512) replayError("INVALID_SNAPSHOT", "recording frame limit exceeded");
  let commandCount = 0;
  for (const [index, frame] of data.frames.entries()) {
    const f = record4(frame, ["stepIndex", "commands"], "frame");
    if (f.stepIndex !== index + 1 || !Array.isArray(f.commands) || f.commands.length > 64) replayError("INVALID_SNAPSHOT", "frame cursor or commands are invalid");
    commandCount += f.commands.length;
    try {
      parseCommands(f.commands, admitted.bodies);
    } catch {
      replayError("INVALID_SNAPSHOT", "frame commands are invalid");
    }
  }
  if (commandCount > 4096) replayError("INVALID_SNAPSHOT", "recording command limit exceeded");
  const state = record4(data.finalState, ["identity", "stepIndex", "timeSeconds", "bodies", "joints", "contacts", "events", "ccdHits", "cloths", "fluids", "pairStats"], "final state");
  identity2(state.identity);
  if (state.stepIndex !== data.frames.length || state.timeSeconds !== data.frames.length * options.fixedStepSeconds) replayError("INVALID_SNAPSHOT", "final cursor differs from log");
  if (!equivalentReplayIdentity(data.identity, state.identity)) replayError("INVALID_SNAPSHOT", "final identity differs from recording");
  const ident = data.identity;
  if (ident.modelRevision !== model.revision || ident.modelDigest !== digest(model) || ident.configurationDigest !== digest(options) || ident.profile !== options.profile || ident.frameId !== model.frame.id || !Object.is(ident.fixedStepSeconds, options.fixedStepSeconds)) replayError("INVALID_SNAPSHOT", "recording identity differs from inputs");
  ids(state.bodies, model.bodies.map((b) => b.id), ["id", "kind", "positionM", "orientationXYZW", "velocityMps", "angularVelocityRadps", "sleeping"], (b) => {
    const source = model.bodies.find((item) => item.id === b.id);
    if (b.kind !== source.kind || typeof b.sleeping !== "boolean") replayError("INVALID_SNAPSHOT", "body state kind or sleep flag is invalid");
    vector2(b.positionM);
    vector2(b.orientationXYZW, 4);
    vector2(b.velocityMps);
    vector2(b.angularVelocityRadps);
  });
  const bodyIds = new Set(model.bodies.map((b) => b.id)), colliders = new Map(model.colliders.map((c) => [c.id, c.bodyId]));
  const body = (value) => {
    if (typeof value !== "string" || !bodyIds.has(value)) replayError("INVALID_SNAPSHOT", "unknown body ID");
  };
  const collider = (value) => {
    if (typeof value !== "string" || !colliders.has(value)) replayError("INVALID_SNAPSHOT", "unknown collider ID");
  };
  ids(state.joints, model.joints.map((j) => j.id), ["id", "bodyAId", "bodyBId", "linearImpulseOnBNs", "angularImpulseOnBNms", "angleRad", "motorImpulseNms"], (j) => {
    const source = model.joints.find((item) => item.id === j.id);
    if (j.bodyAId !== source.bodyAId || j.bodyBId !== source.bodyBId) replayError("INVALID_SNAPSHOT", "joint owners differ");
    vector2(j.linearImpulseOnBNs);
    vector2(j.angularImpulseOnBNms);
    if (source.kind === "fixed" ? j.angleRad !== null : typeof j.angleRad !== "number") replayError("INVALID_SNAPSHOT", "joint angle is invalid");
    if (source.kind === "hinge" && source.motor ? typeof j.motorImpulseNms !== "number" : j.motorImpulseNms !== null) replayError("INVALID_SNAPSHOT", "joint motor state is invalid");
  });
  function entries(value, keys, check7) {
    if (!Array.isArray(value)) replayError("INVALID_SNAPSHOT", "state list is invalid");
    value.forEach((item) => check7(record4(item, keys, "state observation")));
  }
  entries(state.contacts, ["colliderAId", "colliderBId", "bodyAId", "bodyBId", "normalAtoB", "pointM", "penetrationM", "normalImpulseNs", "tangentImpulseOnBNs"], (c) => {
    body(c.bodyAId);
    body(c.bodyBId);
    collider(c.colliderAId);
    collider(c.colliderBId);
    if (colliders.get(c.colliderAId) !== c.bodyAId || colliders.get(c.colliderBId) !== c.bodyBId) replayError("INVALID_SNAPSHOT", "contact owner differs");
    vector2(c.normalAtoB);
    vector2(c.pointM);
    vector2(c.tangentImpulseOnBNs);
    number(c.penetrationM);
    number(c.normalImpulseNs);
  });
  entries(state.events, ["colliderAId", "colliderBId", "kind", "phase"], (e) => {
    collider(e.colliderAId);
    collider(e.colliderBId);
    if (!["contact", "sensor"].includes(e.kind) || !["begin", "stay", "end"].includes(e.phase)) replayError("INVALID_SNAPSHOT", "event is invalid");
  });
  entries(state.ccdHits, ["bodyId", "colliderId", "toiFraction", "normalFixtureToBody"], (h) => {
    body(h.bodyId);
    collider(h.colliderId);
    number(h.toiFraction);
    vector2(h.normalFixtureToBody);
  });
  if (!Array.isArray(state.cloths) || state.cloths.length || !Array.isArray(state.fluids) || state.fluids.length) replayError("INVALID_SNAPSHOT", "domain recording is unsupported");
  const stats = record4(state.pairStats, ["eligiblePairs", "candidatePairs", "aabbTests"], "pair stats");
  for (const value of Object.values(stats)) if (!Number.isSafeInteger(value) || value < 0) replayError("INVALID_SNAPSHOT", "pair stats are invalid");
  return copied;
}

// packages/barocss-physics/src/replay.ts
function recordedState(state) {
  if (state.cloths.length || state.fluids.length) replayError("INVALID_SNAPSHOT", "domain recording is unsupported");
  return copyReplayJson({ ...state, cloths: [], fluids: [] }, "state");
}
function recordingBudget(prepare) {
  try {
    return prepare();
  } catch (error2) {
    if (error2 instanceof PhysicsError && error2.code === "INVALID_SNAPSHOT") {
      replayError("WORLD_LIMIT", "recording data exceeds resource bounds");
    }
    throw error2;
  }
}
function attachRecorder(world) {
  const access = recordingWorlds.get(world);
  if (!access) replayError("INVALID_SNAPSHOT", "recorder requires a genuine World");
  let recorder;
  access.attach(({ model, options, state }) => {
    if (canonicalEncode(model).length > 128 * 1024) replayError("WORLD_LIMIT", "recording model exceeds byte limit");
    if (state.fluids.length) replayError("INVALID_SNAPSHOT", "visual fluid profile recording is unsupported");
    const initial = {
      format: "barocss-physics-recording",
      version: 1,
      model,
      options,
      identity: state.identity,
      frames: [],
      finalState: recordedState(state)
    };
    encodeRecordingData(initial);
    const preparedOwner = {
      recording: initial,
      commandCount: 0,
      prepareFrames(commands, stepIndex) {
        return recordingBudget(() => {
          const frames = [
            ...preparedOwner.recording.frames,
            { stepIndex, commands: copyReplayJson(commands, "commands") }
          ];
          encodeRecordingData({ ...preparedOwner.recording, frames });
          return frames;
        });
      },
      prepare(frames, next) {
        return recordingBudget(() => {
          const recording = {
            ...preparedOwner.recording,
            frames,
            finalState: recordedState(next)
          };
          encodeRecordingData(recording);
          globalThis.__p5Public.fault("log-prepare");
          return recording;
        });
      }
    };
    let detached = false;
    recorder = {
      getState: () => access.read(preparedOwner),
      step: (commands = []) => access.step(preparedOwner, commands),
      saveRecording() {
        access.read(preparedOwner);
        return copyReplayJson(preparedOwner.recording, "recording");
      },
      dispose() {
        if (!detached) {
          access.detach(preparedOwner);
          detached = true;
        }
      }
    };
    return preparedOwner;
  });
  return recorder;
}
function restoreRecording(input, expectedInput) {
  const recording = admitRecording(input);
  const expected = copyReplayJson(expectedInput, "expected identity");
  exactFields2(expected, ["model", "options", "providerDigest"], "expected identity");
  if (!equivalentReplayIdentity(recording.model, expected.model) || !equivalentReplayIdentity(recording.options, expected.options) || recording.identity.providerDigest !== expected.providerDigest) replayError("STALE_SNAPSHOT", "recording identity differs from expected inputs");
  let world;
  try {
    world = createPhysicsWorld(recording.model, recording.options);
    if (!equivalentReplayIdentity(world.getState().identity, recording.identity)) replayError("STALE_SNAPSHOT", "recording provider differs from current provider");
    const recorder = createPhysicsRecorder(world);
    for (const frame of recording.frames) recorder.step(frame.commands);
    if (!equivalentReplayValue(recorder.getState(), recording.finalState)) replayError("INVALID_SNAPSHOT", "final state differs from reconstructed state");
    return { world, recorder };
  } catch (error2) {
    world?.dispose();
    if (error2 instanceof PhysicsError && error2.code === "STALE_SNAPSHOT") throw error2;
    replayError("INVALID_SNAPSHOT", "recording reconstruction failed");
  }
}
function serializeRecording(input) {
  const recording = admitRecording(input);
  const candidate = restorePhysicsRecording(recording, { model: recording.model, options: recording.options, providerDigest: recording.identity.providerDigest });
  try {
    return encodeRecordingData(recording);
  } finally {
    candidate.world.dispose();
  }
}
function deserializeRecording(bytes) {
  const recording = admitRecording(decodeRecordingData(bytes));
  const candidate = restorePhysicsRecording(recording, { model: recording.model, options: recording.options, providerDigest: recording.identity.providerDigest });
  try {
    return copyReplayJson(recording, "recording");
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
function createPhysicsRecorder(world) {
  return recordingOperation("record", () => attachRecorder(world));
}
function restorePhysicsRecording(recording, expected) {
  return recordingOperation("restore", () => restoreRecording(recording, expected));
}
function serializePhysicsRecording(recording) {
  return recordingOperation("record", () => serializeRecording(recording));
}
function deserializePhysicsRecording(bytes) {
  return recordingOperation("record", () => deserializeRecording(bytes));
}

// packages/barocss-physics/src/cad-proxy.ts
var cad_proxy_exports = {};
__export(cad_proxy_exports, {
  admitCadFluidStaticData: () => admitCadFluidStaticData,
  admitCadSurfaceProxy: () => admitCadSurfaceProxy,
  assertCadProxyCurrent: () => assertCadProxyCurrent,
  cadProxyPose: () => cadProxyPose
});

// packages/barocss-cad/src/core/math.ts
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function validatePoint(point) {
  requireValue(Array.isArray(point) && point.length === 3, "A control point must have three coordinates");
  for (let axis = 0; axis < 3; axis++) {
    requireValue(Number.isFinite(point[axis]) && Math.abs(point[axis]) <= 1e6, "Coordinates must be finite and within 1e6 mm");
  }
}
function validateWeight(weight) {
  requireValue(Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6, "Weights must be in [1e-6, 1e6]");
}
function validateKnots(knots, degree, count) {
  requireValue(Number.isInteger(degree) && degree >= 1 && degree <= 5 && degree < count, "Degree must be in 1..5 and smaller than the control point count");
  requireValue(Array.isArray(knots) && knots.length === count + degree + 1, "Knot count must equal control point count + degree + 1");
  for (let i = 0; i < knots.length; i++) {
    requireValue(Number.isFinite(knots[i]), "Knots must be finite");
    if (i > 0) requireValue(knots[i] >= knots[i - 1], "Knots must be nondecreasing");
  }
  const left = knots[degree];
  const right = knots[count];
  requireValue(left < right, "The knot domain must have positive length");
  for (let i = 0; i <= degree; i++) {
    requireValue(knots[i] === left && knots[count + i] === right, "Knots must be open and clamped");
  }
  let repeated = 0;
  let previous = left;
  for (let i = degree + 1; i < count; i++) {
    const value = knots[i];
    requireValue(value > left && value < right, "Endpoint multiplicity must equal degree + 1");
    repeated = value === previous ? repeated + 1 : 1;
    requireValue(repeated <= degree, "Interior knot multiplicity must not exceed degree");
    previous = value;
  }
}
function validateId(id2) {
  requireValue(typeof id2 === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id2), "Object ID must be a supported identifier");
}
function validateCurve(curve) {
  requireValue(curve !== null && typeof curve === "object" && curve.kind === "curve", "Expected a curve");
  validateId(curve.id);
  requireValue(Array.isArray(curve.controlPoints) && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 64, "Curve control point count must be in 2..64");
  validateKnots(curve.knots, curve.degree, curve.controlPoints.length);
  requireValue(Array.isArray(curve.weights) && curve.weights.length === curve.controlPoints.length, "Curve weights must match control points");
  for (let index = 0; index < curve.controlPoints.length; index++) {
    validatePoint(curve.controlPoints[index]);
    validateWeight(curve.weights[index]);
  }
}
function validateSurface(surface) {
  requireValue(surface !== null && typeof surface === "object" && surface.kind === "surface", "Expected a surface");
  validateId(surface.id);
  requireValue(Array.isArray(surface.controlPoints) && surface.controlPoints.length >= 2 && surface.controlPoints.length <= 16, "Surface U control point count must be in 2..16");
  const countU = surface.controlPoints.length;
  const firstRow = surface.controlPoints[0];
  requireValue(Array.isArray(firstRow) && firstRow.length >= 2 && firstRow.length <= 16, "Surface V control point count must be in 2..16");
  const countV = firstRow.length;
  requireValue(countU * countV <= 256, "Surface must have at most 256 control points");
  validateKnots(surface.knotsU, surface.degreeU, countU);
  validateKnots(surface.knotsV, surface.degreeV, countV);
  requireValue(Array.isArray(surface.weights) && surface.weights.length === countU, "Surface weight rows must match control points");
  for (let u = 0; u < countU; u++) {
    const points = surface.controlPoints[u];
    const weights = surface.weights[u];
    requireValue(Array.isArray(points) && points.length === countV, "Surface control point grid must be rectangular");
    requireValue(Array.isArray(weights) && weights.length === countV, "Surface weights must match control points");
    for (let v = 0; v < countV; v++) {
      validatePoint(points[v]);
      validateWeight(weights[v]);
    }
  }
}

// packages/barocss-cad/src/core/vec3.ts
var sub2 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
var dot5 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var len = (a) => Math.hypot(a[0], a[1], a[2]);
var unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// packages/barocss-cad/src/features/extrusion-validation.ts
function dyadic(value) {
  const view4 = new DataView(new ArrayBuffer(8));
  view4.setFloat64(0, value);
  const bits = view4.getBigUint64(0);
  const exponentBits = Number(bits >> 52n & 2047n);
  const fraction = bits & (1n << 52n) - 1n;
  const integer = exponentBits === 0 ? fraction : 1n << 52n | fraction;
  return {
    integer: bits >> 63n === 0n ? integer : -integer,
    exponent: exponentBits === 0 ? -1074 : exponentBits - 1023 - 52
  };
}
function difference(a, b) {
  const exponent = Math.min(a.exponent, b.exponent);
  return {
    integer: (a.integer << BigInt(a.exponent - exponent)) - (b.integer << BigInt(b.exponent - exponent)),
    exponent
  };
}
function product(a, b) {
  return { integer: a.integer * b.integer, exponent: a.exponent + b.exponent };
}
function equal2(a, b) {
  return difference(a, b).integer === 0n;
}
function whollyCollinear(curve, vector3) {
  const direction = vector3.map(dyadic);
  const origin = curve.controlPoints[0].map(dyadic);
  for (let index = 1; index < curve.controlPoints.length; index++) {
    const offset = curve.controlPoints[index].map((value, axis) => difference(dyadic(value), origin[axis]));
    for (let axis = 0; axis < 3; axis++) {
      const next = (axis + 1) % 3;
      if (!equal2(product(offset[axis], direction[next]), product(offset[next], direction[axis]))) return false;
    }
  }
  return true;
}
function preflightExtrusion(curve, options) {
  validateCurve(curve);
  if (curve.controlPoints.length > 16) throw new Error("Extrusion supports at most 16 curve control points");
  if (!options || typeof options !== "object") throw new Error("Extrusion options are required");
  const { id: id2, vector: vector3 } = options;
  if (typeof id2 !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id2) || id2 === curve.id) {
    throw new Error("Extrusion output ID must be a supported ASCII identifier distinct from the curve ID");
  }
  if (!Array.isArray(vector3) || vector3.length !== 3) throw new Error("Extrusion vector must have three coordinates");
  let nonzero2 = false;
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(vector3[axis])) throw new Error("Extrusion vector must be finite");
    nonzero2 ||= vector3[axis] !== 0;
  }
  if (!nonzero2) throw new Error("Extrusion vector must be nonzero");
  let translated = false;
  for (const point of curve.controlPoints) {
    for (let axis = 0; axis < 3; axis++) {
      const value = point[axis] + vector3[axis];
      if (!Number.isFinite(value) || Math.abs(value) > 1e6) throw new Error("Extruded coordinates must be finite and within 1e6 mm");
      translated ||= value !== point[axis];
    }
  }
  if (!translated) throw new Error("Extrusion vector produces no representable pole displacement");
  if (whollyCollinear(curve, vector3)) throw new Error("Extrusion is wholly collapsed: all pole displacements are collinear with the vector");
  return { id: id2, vector: vector3 };
}

// packages/barocss-cad/src/core/extrusion.ts
function extrudeCurve(curve, options) {
  const { id: id2, vector: vector3 } = preflightExtrusion(curve, options);
  return {
    kind: "surface",
    id: id2,
    degreeU: curve.degree,
    degreeV: 1,
    knotsU: [...curve.knots],
    knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((point) => [
      [point[0], point[1], point[2]],
      [point[0] + vector3[0], point[1] + vector3[1], point[2] + vector3[2]]
    ]),
    weights: curve.weights.map((weight) => [weight, weight])
  };
}

// packages/barocss-cad/src/language/expression-parser.ts
var CAD_EXPRESSION_LIMITS = Object.freeze({ nodes: 256, depth: 32, aggregateNodes: 32768, literalMagnitude: 1e12 });
function parseCadExpression(cursor) {
  let nodes = 0;
  const depth = (tree, ancestors) => {
    if (tree + ancestors > CAD_EXPRESSION_LIMITS.depth) cursor.fail("LIMIT", "Expression exceeds AST depth 32");
  };
  const reserve = () => {
    if (nodes >= CAD_EXPRESSION_LIMITS.nodes) cursor.fail("LIMIT", "Expression exceeds 256 nodes");
    cursor.reserveNode();
    nodes++;
  };
  const consume = (text2) => {
    cursor.skip();
    if (!cursor.source.startsWith(text2, cursor.offset())) cursor.fail("SYNTAX", "Expected " + text2);
    cursor.token();
    cursor.advance(text2.length);
  };
  const primary = (ancestors) => {
    cursor.skip();
    const start = cursor.offset();
    depth(1, ancestors);
    if (cursor.source[start] === "(") {
      depth(2, ancestors);
      reserve();
      consume("(");
      const inner = sum(ancestors + 1);
      consume(")");
      depth(inner.depth + 1, ancestors);
      return { expression: { kind: "group", expression: inner.expression, range: cursor.range(start, cursor.offset()) }, depth: inner.depth + 1 };
    }
    if (cursor.source[start] === "$") {
      reserve();
      consume("$");
      const match2 = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(cursor.offset()));
      if (!match2) cursor.fail("SYNTAX", "Expected parameter identifier");
      cursor.token();
      cursor.advance(match2[0].length);
      return { expression: { kind: "parameter-reference", id: match2[0], range: cursor.range(start, cursor.offset()) }, depth: 1 };
    }
    if (cursor.allowCalls) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(start));
      if (name) {
        if (name[0].length > 48) cursor.fail("LIMIT", "Function names exceed 48 characters", start, start + name[0].length);
        reserve();
        cursor.token();
        cursor.advance(name[0].length);
        const functionRange = cursor.range(start, cursor.offset());
        consume("(");
        cursor.skip();
        const arguments_ = [], names = /* @__PURE__ */ new Set();
        let treeDepth = 1;
        if (cursor.source[cursor.offset()] !== ")") while (true) {
          cursor.skip();
          const argumentStart = cursor.offset();
          if (arguments_.length >= 4) cursor.fail("LIMIT", "A call has at most four named arguments", argumentStart);
          const argumentName = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(argumentStart));
          if (!argumentName) cursor.fail("FUNCTION_ARGUMENT", "A named function argument is required", argumentStart);
          if (argumentName[0].length > 48) cursor.fail("LIMIT", "Argument names exceed 48 characters", argumentStart, argumentStart + argumentName[0].length);
          cursor.token();
          cursor.advance(argumentName[0].length);
          const nameRange = cursor.range(argumentStart, cursor.offset());
          cursor.skip();
          if (cursor.source[cursor.offset()] !== ":") cursor.fail("FUNCTION_ARGUMENT", "Only named function arguments are supported", argumentStart, cursor.offset());
          if (names.has(argumentName[0])) cursor.fail("FUNCTION_ARGUMENT", "Duplicate function argument " + argumentName[0], argumentStart, cursor.offset());
          names.add(argumentName[0]);
          consume(":");
          cursor.reserveRecord?.();
          const parsed = sum(ancestors + 1);
          treeDepth = Math.max(treeDepth, parsed.depth + 1);
          depth(treeDepth, ancestors);
          arguments_.push({
            kind: "named-argument",
            name: argumentName[0],
            nameRange,
            value: parsed.expression,
            range: cursor.range(argumentStart, parsed.expression.range.end)
          });
          cursor.skip();
          if (cursor.source[cursor.offset()] !== ",") break;
          consume(",");
          cursor.skip();
          if (cursor.source[cursor.offset()] === ")") cursor.fail("FUNCTION_ARGUMENT", "Trailing function argument comma is unsupported");
        }
        consume(")");
        return { expression: {
          kind: "call",
          functionId: name[0],
          functionRange,
          arguments: arguments_,
          range: cursor.range(start, cursor.offset())
        }, depth: treeDepth };
      }
    }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(cursor.source.slice(start));
    if (!match) cursor.fail("SYNTAX", "Expected number, $parameter or parenthesized expression");
    const value = Number(match[0]);
    if (!Number.isFinite(value) || value > CAD_EXPRESSION_LIMITS.literalMagnitude) cursor.fail("VALUE", "Number magnitude must be finite and at most 1e12", start, start + match[0].length);
    reserve();
    cursor.token();
    cursor.advance(match[0].length);
    const numberEnd = cursor.offset();
    cursor.skip();
    let unit2;
    const unitStart = cursor.offset();
    let unitEnd = unitStart;
    const suffix = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(unitStart));
    if (suffix) {
      if (suffix[0] !== "mm" && suffix[0] !== "cm" && suffix[0] !== "m") cursor.fail("UNIT", "Unsupported length unit " + suffix[0], unitStart, unitStart + suffix[0].length);
      unit2 = suffix[0];
      cursor.token();
      cursor.advance(suffix[0].length);
      unitEnd = cursor.offset();
    }
    const expression3 = { kind: "number", value, range: cursor.range(start, unit2 ? unitEnd : numberEnd) };
    if (unit2) {
      expression3.unit = unit2;
      expression3.unitRange = cursor.range(unitStart, unitEnd);
    }
    return { expression: expression3, depth: 1 };
  };
  const unary = (ancestors) => {
    cursor.skip();
    const start = cursor.offset(), operator = cursor.source[start];
    if (operator !== "+" && operator !== "-") return primary(ancestors);
    depth(2, ancestors);
    reserve();
    consume(operator);
    const operatorRange = cursor.range(start, start + 1);
    const inner = unary(ancestors + 1);
    depth(inner.depth + 1, ancestors);
    return { expression: { kind: "unary", operator, operand: inner.expression, operatorRange, range: cursor.range(start, inner.expression.range.end) }, depth: inner.depth + 1 };
  };
  const binary = (level, ancestors) => {
    const next = level === "product" ? unary : product2;
    let left = next(ancestors);
    while (true) {
      cursor.skip();
      const position = cursor.offset(), operator = cursor.source[position];
      if (!(level === "product" ? operator === "*" || operator === "/" : operator === "+" || operator === "-")) return left;
      depth(left.depth + 1, ancestors);
      reserve();
      consume(operator);
      const operatorRange = cursor.range(position, position + 1), right = next(ancestors + 1);
      const treeDepth = Math.max(left.depth, right.depth) + 1;
      depth(treeDepth, ancestors);
      left = { expression: { kind: "binary", operator, left: left.expression, right: right.expression, operatorRange, range: cursor.range(left.expression.range.start, right.expression.range.end) }, depth: treeDepth };
    }
  };
  const product2 = (ancestors) => binary("product", ancestors);
  const sum = (ancestors) => binary("sum", ancestors);
  return sum(0).expression;
}

// packages/barocss-cad/src/core/barocss-error.ts
var BarocssError = class extends Error {
  code;
  where;
  /** What else the refusal carries: the core's own words, the feature it named. */
  details;
  constructor(code, message, where, details) {
    super(`[${code}] ${message.replace(`[${code}] `, "")}`);
    this.name = "BarocssError";
    this.code = code;
    if (where) this.where = where;
    if (details) this.details = details;
  }
};
var KernelError = class extends BarocssError {
  constructor(message, options) {
    super(options?.code ?? "", "", void 0, options?.details);
    this.name = "Error";
    this.message = message ?? "";
    Reflect.deleteProperty(this, "where");
    if (!options?.details) Reflect.deleteProperty(this, "details");
    if (options && "cause" in options) Object.defineProperty(this, "cause", { value: options.cause, writable: true, configurable: true, enumerable: false });
  }
};
function kernelRefusal(source, code, message, cause) {
  const e = new KernelError(message, cause === void 0 ? { code, details: { source } } : { code, details: { source }, cause });
  e.name = "BarocssError";
  return e;
}

// packages/barocss-cad/src/language/source-ast.ts
var CadAstError = class extends KernelError {
  code;
  detail;
  range;
  objectId;
  constructor(code, detail, range, objectId) {
    super(detail);
    this.name = "CadAstError";
    this.code = code;
    this.detail = detail;
    this.range = range;
    this.objectId = objectId;
  }
};
var CAD_AST_LIMITS = Object.freeze({ sourceBytes: 262144, values: 65536, nodes: 65536, tokens: 131072, arrayDepth: 3, declarations: 16 });
var curveFields = ["type", "degree", "knots", "control-points", "weights"];
var surfaceFields = ["type", "degree-u", "degree-v", "knots-u", "knots-v", "control-points", "weights"];
var fieldBounds = { knots: [70], "knots-u": [22], "knots-v": [22], "control-points": [64, 3], weights: [64] };
function parseCadAst(source, sourceVersion) {
  if (typeof source !== "string") throw new TypeError("Source must be a string");
  if (sourceVersion !== 0 && sourceVersion !== 1 && sourceVersion !== 2 && sourceVersion !== 3) throw new TypeError("Source version must be 0, 1, 2 or 3");
  const emptyRange = { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
  const utf8BytesWithinLimit = () => {
    let bytes = 0;
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i), next = source.charCodeAt(i + 1);
      if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (code >= 55296 && code <= 56319 && next >= 56320 && next <= 57343) {
        bytes += 4;
        i++;
      } else bytes += 3;
      if (bytes > CAD_AST_LIMITS.sourceBytes) return false;
    }
    return true;
  };
  if (source.length > CAD_AST_LIMITS.sourceBytes || !utf8BytesWithinLimit()) {
    throw new CadAstError("LIMIT", "Source exceeds 256 KiB", emptyRange);
  }
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const location = (offset) => {
    let low = 0, high = lineStarts.length;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= offset) low = mid;
      else high = mid;
    }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  };
  const range = (start, end) => {
    const first = location(start), last = location(end);
    return { start, end, ...first, endLine: last.line, endColumn: last.column };
  };
  let at2 = 0, tokens = 0, values = 0, nodes = 0, expressionNodes = 0, geometryCount = 0, parameterCount = 0, functionCount = 0, objectId;
  const declarations = [], modelFields = [];
  const fail3 = (code, detail, start = at2, end = Math.min(source.length, start + 1)) => {
    throw new CadAstError(code, detail, range(start, end), objectId);
  };
  const chargeToken = () => {
    if (tokens >= CAD_AST_LIMITS.tokens) fail3("LIMIT", "Source exceeds AST token limit");
    tokens++;
  };
  const chargeNode = (isValue = false) => {
    if (nodes >= CAD_AST_LIMITS.nodes || isValue && values >= CAD_AST_LIMITS.values) fail3("LIMIT", "Source exceeds AST value/node limit");
    nodes++;
    if (isValue) values++;
  };
  const skip = () => {
    while (at2 < source.length) {
      if (/\s/.test(source[at2])) {
        at2++;
        continue;
      }
      if (source.startsWith("/*", at2)) {
        const end = source.indexOf("*/", at2 + 2);
        if (end < 0) fail3("SYNTAX", "Unterminated comment");
        at2 = end + 2;
        continue;
      }
      break;
    }
  };
  const take = (token) => {
    skip();
    if (!source.startsWith(token, at2)) fail3("SYNTAX", "Expected " + token);
    chargeToken();
    at2 += token.length;
  };
  const ident = (parameter = false) => {
    skip();
    const start = at2, match = (parameter ? /^[A-Za-z_][A-Za-z0-9_]*/ : /^[A-Za-z_][A-Za-z0-9_-]*/).exec(source.slice(at2));
    if (!match) return fail3("SYNTAX", "Expected identifier");
    chargeToken();
    at2 += match[0].length;
    return { value: match[0], range: range(start, at2) };
  };
  const numeric = (required) => {
    skip();
    const start = at2, match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(at2));
    if (!match) {
      if (required) fail3("VALUE", "Expected finite decimal literal");
      return void 0;
    }
    chargeToken();
    at2 += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail3("VALUE", "Number must be finite", required ? start : at2, required ? at2 : Math.min(source.length, at2 + 1));
    chargeNode(true);
    return { kind: "number", value, range: range(start, at2) };
  };
  const expression3 = () => parseCadExpression({
    source,
    offset: () => at2,
    advance: (count) => {
      at2 += count;
    },
    skip,
    allowCalls: sourceVersion === 3,
    reserveRecord: () => chargeNode(),
    token: chargeToken,
    range,
    fail: fail3,
    reserveNode: () => {
      if (expressionNodes >= CAD_EXPRESSION_LIMITS.aggregateNodes) fail3("LIMIT", "Model exceeds 32768 aggregate expression nodes");
      chargeNode(true);
      expressionNodes++;
    }
  });
  const astValue = (bounds, depth = 0, expressions = false) => {
    skip();
    const start = at2;
    if (source[at2] === "[") {
      if (depth >= bounds.length || depth >= CAD_AST_LIMITS.arrayDepth) fail3("DIMENSION", "Array nesting exceeds field dimension");
      chargeNode(true);
      take("[");
      const items = [];
      skip();
      if (source[at2] !== "]") while (true) {
        if (items.length >= bounds[depth]) fail3("LIMIT", "Array exceeds field limit");
        items.push(astValue(bounds, depth + 1, expressions));
        skip();
        if (source[at2] !== ",") break;
        take(",");
        skip();
        if (source[at2] === "]") fail3("SYNTAX", "Trailing comma is unsupported");
      }
      take("]");
      return { kind: "array", items, range: range(start, at2) };
    }
    if (expressions) return expression3();
    const number2 = numeric(false);
    if (number2) return number2;
    const identifier2 = ident();
    chargeNode(true);
    return { kind: "identifier", value: identifier2.value, range: identifier2.range };
  };
  const field = (allowed, surface, seen, mode) => {
    skip();
    const start = at2, key = ident();
    if (!allowed.includes(key.value)) fail3("FIELD", "Unsupported " + (sourceVersion === 1 && mode !== "literal" ? mode === "model" ? "model " : "extrusion " : "") + "field " + key.value, start, sourceVersion === 1 && mode !== "literal" ? at2 : Math.min(source.length, start + 1));
    if (sourceVersion === 1 && mode !== "literal" && seen.has(key.value)) fail3("DUPLICATE", "Duplicate field " + key.value, start, at2);
    take(":");
    let value;
    if (sourceVersion >= 1 && mode === "model") {
      if (key.value === "version") value = numeric(true);
      else {
        const identifier2 = ident();
        chargeNode(true);
        value = { kind: "identifier", value: identifier2.value, range: identifier2.range };
      }
    } else if (sourceVersion >= 2 && mode === "parameter" && key.value === "value" || mode === "function") {
      value = expression3();
    } else if (mode === "extrude") {
      if (key.value === "curve") {
        skip();
        const refStart = at2;
        take("#");
        const ref = ident();
        chargeNode(true);
        value = { kind: "reference", id: ref.value, range: range(refStart, at2) };
      } else {
        skip();
        const vectorStart = at2;
        chargeNode(true);
        take("[");
        const x = sourceVersion >= 2 ? expression3() : numeric(true);
        take(",");
        const y = sourceVersion >= 2 ? expression3() : numeric(true);
        take(",");
        const z = sourceVersion >= 2 ? expression3() : numeric(true);
        take("]");
        value = { kind: "array", items: [x, y, z], range: range(vectorStart, at2) };
      }
    } else {
      const bounds = surface && key.value === "control-points" ? [16, 16, 3] : surface && key.value === "weights" ? [16, 16] : fieldBounds[key.value] ?? [];
      value = astValue(bounds, 0, sourceVersion >= 2 && mode === "literal" && key.value !== "type");
    }
    take(";");
    if (seen.has(key.value)) fail3("DUPLICATE", "Duplicate field " + key.value, start, Math.min(source.length, start + 1));
    seen.add(key.value);
    chargeNode();
    return { name: key.value, value, range: range(start, at2), nameRange: key.range };
  };
  skip();
  const modelStart = at2;
  chargeNode();
  take("@");
  if (ident().value !== "model") fail3("SYNTAX", "Expected @model", sourceVersion === 1 ? 0 : at2);
  const modelIdentifier = ident();
  take("{");
  const headerNames = /* @__PURE__ */ new Set(), ids2 = /* @__PURE__ */ new Set();
  while (true) {
    skip();
    if (source[at2] === "}") {
      take("}");
      break;
    }
    objectId = void 0;
    if (source[at2] !== "@") {
      modelFields.push(field(["version", "length-unit"], false, headerNames, "model"));
      continue;
    }
    const start = at2;
    take("@");
    const kind = ident().value;
    if (!(sourceVersion === 0 ? kind === "curve" || kind === "surface" : sourceVersion === 1 ? kind === "curve" || kind === "extrude" : kind === "curve" || kind === "surface" || kind === "extrude" || kind === "parameter" || sourceVersion === 3 && kind === "function")) fail3("KIND", (sourceVersion === 0 ? "Unsupported object " : "Unsupported declaration ") + kind, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at2);
    if (kind === "function" ? functionCount >= 8 : kind === "parameter" ? parameterCount >= 64 : geometryCount >= CAD_AST_LIMITS.declarations)
      fail3("LIMIT", kind === "function" ? "Model exceeds 8 functions" : kind === "parameter" ? "Model exceeds 64 parameters" : "Model exceeds 16 geometry declarations", start);
    skip();
    const idStart = at2;
    take("#");
    const identifier2 = ident(kind === "parameter" || kind === "function");
    objectId = identifier2.value;
    if (ids2.has(objectId)) fail3("DUPLICATE", "Duplicate ID " + objectId, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at2);
    ids2.add(objectId);
    if (kind === "function") {
      if (identifier2.value.length > 48) fail3("LIMIT", "Function names exceed 48 characters", identifier2.range.start, identifier2.range.end);
      functionCount++;
      take("(");
      skip();
      const arguments_ = [], formalNames = /* @__PURE__ */ new Set();
      if (source[at2] !== ")") while (true) {
        skip();
        const formalStart = at2;
        if (arguments_.length >= 4) fail3("LIMIT", "A function has at most four formal arguments", formalStart);
        const name = ident(true);
        if (name.value.length > 48) fail3("LIMIT", "Formal names exceed 48 characters", name.range.start, name.range.end);
        if (formalNames.has(name.value)) fail3("FUNCTION_ARGUMENT", "Duplicate formal argument " + name.value, name.range.start, name.range.end);
        formalNames.add(name.value);
        take(":");
        const type = ident();
        if (type.value !== "length" && type.value !== "scalar") fail3("FUNCTION_TYPE", "Formal type must be length or scalar", type.range.start, type.range.end);
        const quantityKind = type.value === "length" ? "length" : "scalar";
        chargeNode();
        skip();
        let defaultExpression = null;
        if (source[at2] === "=") {
          take("=");
          defaultExpression = expression3();
        }
        arguments_.push({
          kind: "formal-argument",
          name: name.value,
          nameRange: name.range,
          quantityKind,
          typeRange: type.range,
          defaultExpression,
          range: range(formalStart, defaultExpression?.range.end ?? type.range.end)
        });
        skip();
        if (source[at2] !== ",") break;
        take(",");
        skip();
        if (source[at2] === ")") fail3("FUNCTION_ARGUMENT", "Trailing formal comma is unsupported");
      }
      take(")");
      take(":");
      const returnType = ident();
      if (returnType.value !== "length" && returnType.value !== "scalar") fail3("FUNCTION_TYPE", "Function return type must be length or scalar", returnType.range.start, returnType.range.end);
      const returnKind = returnType.value === "length" ? "length" : "scalar";
      take("{");
      const fields4 = [], seen2 = /* @__PURE__ */ new Set();
      while (true) {
        skip();
        if (source[at2] === "}") {
          take("}");
          break;
        }
        fields4.push(field(["return"], false, seen2, "function"));
      }
      if (fields4.length !== 1) fail3("FIELD", "A function requires exactly one return expression", start, at2);
      chargeNode();
      declarations.push({
        kind: "function",
        id: objectId,
        range: range(start, at2),
        idRange: range(idStart, identifier2.range.end),
        arguments: arguments_,
        returnKind,
        returnTypeRange: returnType.range,
        fields: fields4
      });
      continue;
    }
    if (kind === "parameter") parameterCount++;
    else geometryCount++;
    take("{");
    const fields3 = [], seen = /* @__PURE__ */ new Set();
    while (true) {
      skip();
      if (source[at2] === "}") {
        take("}");
        break;
      }
      fields3.push(field(kind === "curve" ? curveFields : kind === "surface" ? surfaceFields : kind === "parameter" ? ["type", "value"] : ["curve", "vector"], kind === "surface", seen, kind === "extrude" ? "extrude" : kind === "parameter" ? "parameter" : "literal"));
    }
    chargeNode();
    declarations.push({ kind, id: objectId, range: range(start, at2), idRange: range(idStart, identifier2.range.end), fields: fields3 });
  }
  const modelEnd = at2;
  objectId = void 0;
  skip();
  if (at2 !== source.length) fail3("SYNTAX", "Unexpected content after model");
  return { kind: "model", name: modelIdentifier.value, range: range(modelStart, modelEnd), nameRange: modelIdentifier.range, fields: modelFields, declarations };
}

// packages/barocss-cad/src/data-copy.ts
function copyCadData(value) {
  if (Array.isArray(value)) return value.map((item) => copyCadData(item));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyCadData(item)]));
  return value;
}

// packages/barocss-cad/src/document/parameter-semantics.ts
var numericFields = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function expression(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group") return value;
  throw new CadAstError("TYPE", "A numeric expression is required", value.range, owner);
}
function references(value) {
  if (value.kind === "call") throw new CadAstError("TYPE", "Source2 does not support quantity function calls", value.range);
  if (value.kind === "parameter-reference") return [{ id: value.id, range: value.range }];
  if (value.kind === "unary") return references(value.operand);
  if (value.kind === "group") return references(value.expression);
  if (value.kind === "binary") return [...references(value.left), ...references(value.right)];
  return [];
}
function literalMillimetres(value) {
  if (value.kind === "number") return value.unit === void 0;
  if (value.kind === "group") return literalMillimetres(value.expression);
  if (value.kind === "unary") return literalMillimetres(value.operand);
  return false;
}
function resolveCadParameters(ast) {
  const byId = new Map(ast.declarations.map((d) => [d.id, d]));
  const inputs = /* @__PURE__ */ new Map();
  const dependencies = [];
  const edges = /* @__PURE__ */ new Map();
  const leaves = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function") throw new CadAstError("TYPE", "Source2 does not support quantity functions", declaration.range, declaration.id);
    if (declaration.kind !== "parameter") continue;
    const type = declaration.fields.find((f) => f.name === "type"), value = declaration.fields.find((f) => f.name === "value");
    if (!type || !value) throw new CadAstError("FIELD", "Parameter requires type and value", declaration.range, declaration.id);
    if (type.value.kind !== "identifier" || type.value.value !== "length" && type.value.value !== "scalar") throw new CadAstError("TYPE", "Parameter type must be length or scalar", type.value.range, declaration.id);
    inputs.set(declaration.id, { declaration, kind: type.value.value, expression: expression(value.value, declaration.id) });
  }
  if (inputs.size > 64) throw new CadAstError("LIMIT", "At most 64 parameters are supported", ast.range);
  const addReferences = (owner, value) => {
    const found = references(value);
    for (const ref of found) {
      const target = byId.get(ref.id);
      if (!target) throw new CadAstError("REFERENCE", "Undefined parameter " + ref.id, ref.range, owner);
      if (target.kind !== "parameter") throw new CadAstError("REFERENCE", ref.id + " is geometry, not a parameter", ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: "parameter-input", span: { ...ref.range } });
    }
    return found;
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "parameter") {
      edges.set(declaration.id, addReferences(declaration.id, inputs.get(declaration.id).expression));
      continue;
    }
    if (declaration.kind === "extrude") {
      const curve = declaration.fields.find((f) => f.name === "curve");
      if (!curve) throw new CadAstError("FIELD", "Extrusion requires a curve field", declaration.range, declaration.id);
      if (curve.value.kind !== "reference") throw new CadAstError("TYPE", "Extrusion curve requires a geometry reference", curve.value.range, declaration.id);
      const target = byId.get(curve.value.id);
      if (!target || target.kind !== "curve") throw new CadAstError("REFERENCE", "Reference " + curve.value.id + " must name a curve declaration", curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields.has(field.name)) continue;
      const required = field.name === "control-points" || field.name === "vector" ? "length" : "scalar";
      const walk = (value, indices) => {
        if (value.kind === "array") {
          value.items.forEach((item, index) => walk(item, [...indices, index]));
          return;
        }
        const expr = expression(value, declaration.id), refs = addReferences(declaration.id, expr);
        leaves.push({ objectId: declaration.id, field: field.name, indices, expression: expr, required, references: refs.map((r) => r.id) });
      };
      walk(field.value, []);
    }
  }
  const states = /* @__PURE__ */ new Map(), order = [];
  const visit = (id2) => {
    if (states.get(id2) === "done") return;
    states.set(id2, "visiting");
    for (const ref of edges.get(id2) ?? []) {
      if (states.get(ref.id) === "visiting") throw new CadAstError("CYCLE", "Cyclic parameter dependency through " + ref.id, ref.range, id2);
      visit(ref.id);
    }
    states.set(id2, "done");
    order.push(id2);
  };
  for (const id2 of inputs.keys()) visit(id2);
  const quantities = /* @__PURE__ */ new Map(), evaluated = /* @__PURE__ */ new WeakMap();
  const checked2 = (kind, value, range, owner) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new CadAstError("VALUE", "Quantity must be finite and within 1e12", range, owner);
    return { kind, value };
  };
  const evaluate2 = (node, owner) => {
    if (node.kind === "call") throw new CadAstError("TYPE", "Source2 does not support quantity function calls", node.range, owner);
    const cached = evaluated.get(node);
    if (cached) return cached;
    let result;
    if (node.kind === "number") {
      checked2("scalar", node.value, node.range, owner);
      const scale4 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = checked2(node.unit ? "length" : "scalar", node.value * scale4, node.unitRange ?? node.range, owner);
    } else if (node.kind === "parameter-reference") {
      const quantity2 = quantities.get(node.id);
      if (!quantity2) throw new CadAstError("REFERENCE", "Parameter dependency is unresolved", node.range, owner);
      result = { ...quantity2 };
    } else if (node.kind === "group") result = { ...evaluate2(node.expression, owner) };
    else if (node.kind === "unary") {
      const operand = evaluate2(node.operand, owner);
      result = checked2(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner);
    } else {
      const left = evaluate2(node.left, owner), right = evaluate2(node.right, owner);
      if (node.operator === "/" && right.value === 0) throw new CadAstError("DIVISION_ZERO", "Division by zero is unsupported", node.operatorRange, owner);
      let kind, value;
      if (node.operator === "+" || node.operator === "-") {
        if (left.kind !== right.kind) throw new CadAstError("UNIT", "Addition and subtraction require matching quantities", node.operatorRange, owner);
        kind = left.kind;
        value = node.operator === "+" ? left.value + right.value : left.value - right.value;
      } else if (node.operator === "*") {
        if (left.kind === "length" && right.kind === "length") throw new CadAstError("UNIT", "Length multiplied by length is unsupported", node.operatorRange, owner);
        kind = left.kind === "length" || right.kind === "length" ? "length" : "scalar";
        value = left.value * right.value;
      } else {
        if (left.kind === "scalar" && right.kind === "length") throw new CadAstError("UNIT", "Scalar divided by length is unsupported", node.operatorRange, owner);
        kind = left.kind === right.kind ? "scalar" : "length";
        value = left.value / right.value;
      }
      result = checked2(kind, value, node.operatorRange, owner);
    }
    evaluated.set(node, result);
    return result;
  };
  for (const id2 of order) {
    const input = inputs.get(id2), quantity2 = evaluate2(input.expression, id2);
    if (quantity2.kind !== input.kind) throw new CadAstError("UNIT", "Parameter value does not match its declared " + input.kind + " type", input.expression.range, id2);
    quantities.set(id2, quantity2);
  }
  const parameters = [...inputs].map(([id2, input]) => {
    const q2 = quantities.get(id2);
    return { id: id2, quantityKind: q2.kind, value: q2.value, unit: q2.kind === "length" ? "mm" : "1", expression: copyCadData(input.expression), span: { ...input.declaration.range } };
  });
  const bindings = [], leafValues = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    let quantity2 = evaluate2(leaf.expression, leaf.objectId);
    if (leaf.required === "length" && quantity2.kind === "scalar" && literalMillimetres(leaf.expression)) quantity2 = { kind: "length", value: quantity2.value };
    if (quantity2.kind !== leaf.required) throw new CadAstError("UNIT", "Field " + leaf.field + " requires " + leaf.required, leaf.expression.range, leaf.objectId);
    if (leaf.field.startsWith("degree") && !Number.isInteger(quantity2.value)) throw new CadAstError("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.objectId);
    leafValues.set(leaf.expression, quantity2.value);
    bindings.push({ objectId: leaf.objectId, field: leaf.field, indices: [...leaf.indices], expression: copyCadData(leaf.expression), value: quantity2.value, quantityKind: quantity2.kind, span: { ...leaf.expression.range }, references: [...leaf.references] });
  }
  const resolvedValue = (value) => {
    if (value.kind === "array") return { kind: "array", items: value.items.map(resolvedValue), range: { ...value.range } };
    const mapped = leafValues.get(value);
    if (mapped !== void 0 || leafValues.has(value)) return { kind: "number", value: mapped, range: { ...value.range } };
    return copyCadData(value);
  };
  const resolvedAst = {
    kind: "model",
    name: ast.name,
    range: { ...ast.range },
    nameRange: { ...ast.nameRange },
    fields: copyCadData(ast.fields),
    declarations: ast.declarations.filter((d) => d.kind !== "parameter" && d.kind !== "function").map((d) => ({
      kind: d.kind,
      id: d.id,
      range: { ...d.range },
      idRange: { ...d.idRange },
      fields: d.fields.map((f) => ({ name: f.name, range: { ...f.range }, nameRange: { ...f.nameRange }, value: resolvedValue(f.value) }))
    }))
  };
  return { ast: resolvedAst, parameters, bindings, dependencies };
}

// packages/barocss-cad/src/document/function-quantity-semantics.ts
var numericFields2 = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function fail2(code, detail, range, owner) {
  throw new CadAstError(code, detail, range, owner);
}
function expression2(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group" || value.kind === "call") return value;
  return fail2("TYPE", "A numeric quantity expression is required", value.range, owner);
}
function quantity(kind, value, range, owner) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) fail2("VALUE", "Quantity must be finite and within 1e12", range, owner);
  return { kind, unit: kind === "length" ? "mm" : "1", value };
}
function binaryKind(operator, left, right, range, owner) {
  if (operator === "+" || operator === "-") {
    if (left !== right) fail2("UNIT", "Addition and subtraction require matching quantities", range, owner);
    return left;
  }
  if (operator === "*") {
    if (left === "length" && right === "length") fail2("UNIT", "Length multiplied by length is unsupported", range, owner);
    return left === "length" || right === "length" ? "length" : "scalar";
  }
  if (left === "scalar" && right === "length") fail2("UNIT", "Scalar divided by length is unsupported", range, owner);
  return left === right ? "scalar" : "length";
}
function literalMillimetres2(node) {
  if (node.kind === "number") return node.unit === void 0;
  if (node.kind === "unary") return literalMillimetres2(node.operand);
  if (node.kind === "group") return literalMillimetres2(node.expression);
  return false;
}
function globalReferences(node) {
  if (node.kind === "parameter-reference") return [{ id: node.id, range: node.range }];
  if (node.kind === "unary") return globalReferences(node.operand);
  if (node.kind === "group") return globalReferences(node.expression);
  if (node.kind === "binary") return [...globalReferences(node.left), ...globalReferences(node.right)];
  if (node.kind === "call") return node.arguments.flatMap((argument) => globalReferences(argument.value));
  return [];
}
function resolveCadFunctionParameters(ast) {
  const byId = new Map(ast.declarations.map((declaration) => [declaration.id, declaration]));
  const definitions = /* @__PURE__ */ new Map();
  const inputs = /* @__PURE__ */ new Map(), globalKinds = /* @__PURE__ */ new Map();
  const leaves = [], dependencies = [];
  const work = {
    limits: {
      maximumFunctions: 8,
      maximumArguments: 4,
      maximumCallDepth: 8,
      maximumCallEntries: 256,
      maximumExpressionEvaluations: 65536,
      maximumDefaultAdmissionEvaluations: 32,
      maximumSuccessUTF16: 16777216,
      maximumSuccessUTF8: 16777216,
      maximumOwnValues: 4194304,
      maximumOwnDepth: 128,
      maximumOwnArray: 65536,
      maximumOwnRecord: 64
    },
    preflight: { callEntries: 0, expressionEvaluations: 0, maximumCallDepth: 0 },
    actual: {
      callEntries: 0,
      defaultAdmissionEvaluations: 0,
      defaultRuntimeEvaluations: 0,
      expressionEvaluations: 0,
      maximumCallDepth: 0
    },
    fileSizes: { success: { utf16: 0, utf8: 0 } },
    ownValues: 0
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function") {
      if (definitions.size >= 8) fail2("LIMIT", "At most eight quantity functions are supported", declaration.range, declaration.id);
      if (declaration.arguments.length > 4) fail2("LIMIT", "At most four formal arguments are supported", declaration.range, declaration.id);
      definitions.set(declaration.id, declaration);
    } else if (declaration.kind === "parameter") {
      const type = declaration.fields.find((field) => field.name === "type"), value = declaration.fields.find((field) => field.name === "value");
      if (!type || !value) fail2("FIELD", "Parameter requires type and value", declaration.range, declaration.id);
      if (type.value.kind !== "identifier" || type.value.value !== "length" && type.value.value !== "scalar")
        fail2("TYPE", "Parameter type must be length or scalar", type.value.range, declaration.id);
      inputs.set(declaration.id, { kind: type.value.value, expression: expression2(value.value, declaration.id), span: declaration.range });
      globalKinds.set(declaration.id, type.value.value);
    }
  }
  if (inputs.size > 64) fail2("LIMIT", "At most 64 global parameters are supported", ast.range, ast.name);
  const body = (definition2) => {
    if (definition2.fields.length !== 1 || definition2.fields[0].name !== "return")
      fail2("FUNCTION_TYPE", "A function requires exactly one return expression", definition2.range, definition2.id);
    return expression2(definition2.fields[0].value, definition2.id);
  };
  const infer = (node, environment, owner, scope, callsTo) => {
    if (node.kind === "number") return node.unit === void 0 ? "scalar" : "length";
    if (node.kind === "parameter-reference") {
      if (scope === "closed") fail2("FUNCTION_CAPTURE", "Defaults must be closed expressions without references", node.range, owner);
      const kind = environment.get(node.id);
      if (kind === void 0) fail2(
        scope === "formal" ? "FUNCTION_CAPTURE" : "REFERENCE",
        scope === "formal" ? "A function may reference only its own formal arguments" : "Reference must name a global parameter",
        node.range,
        owner
      );
      return kind;
    }
    if (node.kind === "group") return infer(node.expression, environment, owner, scope, callsTo);
    if (node.kind === "unary") return infer(node.operand, environment, owner, scope, callsTo);
    if (node.kind === "binary") return binaryKind(
      node.operator,
      infer(node.left, environment, owner, scope, callsTo),
      infer(node.right, environment, owner, scope, callsTo),
      node.operatorRange,
      owner
    );
    if (scope === "closed") fail2("FUNCTION_CAPTURE", "Defaults cannot invoke functions", node.range, owner);
    const definition2 = definitions.get(node.functionId);
    if (!definition2) fail2("FUNCTION_REFERENCE", "Call must name a declared quantity function", node.functionRange, owner);
    if (node.arguments.length > 4) fail2("FUNCTION_ARGUMENT", "At most four named arguments are supported", node.range, owner);
    const names = /* @__PURE__ */ new Set();
    for (const argument of node.arguments) {
      if (names.has(argument.name)) fail2("FUNCTION_ARGUMENT", "Duplicate named argument", argument.nameRange, owner);
      names.add(argument.name);
      const formal = definition2.arguments.find((value) => value.name === argument.name);
      if (!formal) fail2("FUNCTION_ARGUMENT", "Unknown named argument", argument.nameRange, owner);
      const kind = infer(argument.value, environment, owner, scope, callsTo);
      if (kind !== formal.quantityKind) fail2("FUNCTION_TYPE", "Named argument does not match its formal quantity kind", argument.value.range, owner);
    }
    for (const formal of definition2.arguments) if (!names.has(formal.name) && formal.defaultExpression === null)
      fail2("FUNCTION_ARGUMENT", "Required named argument is missing", node.range, owner);
    if (callsTo) callsTo.push({ id: definition2.id, range: node.functionRange });
    return definition2.returnKind;
  };
  const functionEdges = /* @__PURE__ */ new Map();
  for (const definition2 of definitions.values()) {
    const environment = /* @__PURE__ */ new Map();
    for (const formal of definition2.arguments) {
      if (environment.has(formal.name)) fail2("FUNCTION_ARGUMENT", "Duplicate formal argument", formal.nameRange, definition2.id);
      environment.set(formal.name, formal.quantityKind);
      if (formal.defaultExpression !== null && infer(formal.defaultExpression, /* @__PURE__ */ new Map(), definition2.id, "closed") !== formal.quantityKind)
        fail2("FUNCTION_TYPE", "Default quantity does not match its formal kind", formal.defaultExpression.range, definition2.id);
    }
    const edges = [];
    if (infer(body(definition2), environment, definition2.id, "formal", edges) !== definition2.returnKind)
      fail2("FUNCTION_TYPE", "Return expression does not match the declared quantity kind", definition2.returnTypeRange, definition2.id);
    functionEdges.set(definition2.id, edges);
  }
  const functionStates = /* @__PURE__ */ new Map();
  const visitFunction = (id2) => {
    if (functionStates.get(id2) === "done") return;
    functionStates.set(id2, "visiting");
    for (const edge of functionEdges.get(id2) ?? []) {
      if (functionStates.get(edge.id) === "visiting") fail2("FUNCTION_RECURSION", "Recursive function calls are unsupported", edge.range, id2);
      visitFunction(edge.id);
    }
    functionStates.set(id2, "done");
  };
  for (const id2 of definitions.keys()) visitFunction(id2);
  const parameterEdges = /* @__PURE__ */ new Map();
  const references2 = (owner, node) => {
    const refs = globalReferences(node);
    for (const ref of refs) {
      if (byId.get(ref.id)?.kind !== "parameter") fail2("REFERENCE", "Reference must name a global parameter", ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: "parameter-input", span: { ...ref.range } });
    }
    return refs;
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function") continue;
    if (declaration.kind === "parameter") {
      const input = inputs.get(declaration.id);
      if (infer(input.expression, globalKinds, declaration.id, "global") !== input.kind)
        fail2("UNIT", "Parameter value does not match its declared quantity kind", input.expression.range, declaration.id);
      parameterEdges.set(declaration.id, references2(declaration.id, input.expression));
      continue;
    }
    if (declaration.kind === "extrude") {
      const curve = declaration.fields.find((field) => field.name === "curve");
      if (!curve) fail2("FIELD", "Extrusion requires a curve field", declaration.range, declaration.id);
      if (curve.value.kind !== "reference" || byId.get(curve.value.id)?.kind !== "curve")
        fail2("REFERENCE", "Extrusion input must name a curve", curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields2.has(field.name)) continue;
      const required = field.name === "control-points" || field.name === "vector" ? "length" : "scalar";
      const walk = (value, indices) => {
        if (value.kind === "array") {
          value.items.forEach((item, index) => walk(item, [...indices, index]));
          return;
        }
        const node = expression2(value, declaration.id), kind = infer(node, globalKinds, declaration.id, "global");
        if (kind !== required && !(required === "length" && kind === "scalar" && literalMillimetres2(node)))
          fail2("UNIT", "Geometry field requires " + required, node.range, declaration.id);
        leaves.push({
          owner: { objectId: declaration.id, field: field.name, indices },
          expression: node,
          required,
          references: references2(declaration.id, node).map((ref) => ref.id)
        });
      };
      walk(field.value, []);
    }
  }
  const parameterStates = /* @__PURE__ */ new Map(), order = [];
  const visitParameter = (id2) => {
    if (parameterStates.get(id2) === "done") return;
    parameterStates.set(id2, "visiting");
    for (const edge of parameterEdges.get(id2) ?? []) {
      if (parameterStates.get(edge.id) === "visiting") fail2("CYCLE", "Cyclic global parameter dependency", edge.range, id2);
      visitParameter(edge.id);
    }
    parameterStates.set(id2, "done");
    order.push(id2);
  };
  for (const id2 of inputs.keys()) visitParameter(id2);
  const add4 = (a, b) => ({
    callEntries: Math.min(257, a.callEntries + b.callEntries),
    expressionEvaluations: Math.min(65537, a.expressionEvaluations + b.expressionEvaluations),
    maximumCallDepth: Math.min(9, Math.max(a.maximumCallDepth, b.maximumCallDepth))
  });
  const bodyCosts = /* @__PURE__ */ new Map();
  const cost = (node) => {
    let value = { callEntries: 0, expressionEvaluations: 1, maximumCallDepth: 0 };
    if (node.kind === "unary") return add4(value, cost(node.operand));
    if (node.kind === "group") return add4(value, cost(node.expression));
    if (node.kind === "binary") return add4(add4(value, cost(node.left)), cost(node.right));
    if (node.kind !== "call") return value;
    for (const argument of node.arguments) value = add4(value, cost(argument.value));
    const definition2 = definitions.get(node.functionId);
    let inner = bodyCosts.get(definition2.id);
    if (!inner) {
      inner = cost(body(definition2));
      bodyCosts.set(definition2.id, inner);
    }
    for (const formal of definition2.arguments) if (formal.defaultExpression !== null && !node.arguments.some((argument) => argument.name === formal.name))
      inner = add4(inner, cost(formal.defaultExpression));
    return add4(value, {
      callEntries: Math.min(257, inner.callEntries + 1),
      expressionEvaluations: inner.expressionEvaluations,
      maximumCallDepth: Math.min(9, inner.maximumCallDepth + 1)
    });
  };
  const preflight = (node, owner) => {
    work.preflight = add4(work.preflight, cost(node));
    if (work.preflight.callEntries > 256 || work.preflight.expressionEvaluations > 65536 || work.preflight.maximumCallDepth > 8)
      fail2("LIMIT", "Function expansion exceeds call, expression or active-frame limits before numerical evaluation", node.range, owner);
  };
  for (const [id2, input] of inputs) preflight(input.expression, id2);
  for (const leaf of leaves) preflight(leaf.expression, leaf.owner.objectId);
  const quantities = /* @__PURE__ */ new Map(), globalMemo = /* @__PURE__ */ new WeakMap();
  const calls = [];
  const evaluate2 = (node, owner, environment, memo, frameId, depth, admission = false) => {
    if (!admission) {
      if (work.actual.expressionEvaluations >= 65536) fail2("LIMIT", "Runtime expression evaluation budget exhausted", node.range, owner.objectId);
      work.actual.expressionEvaluations++;
    }
    const cached = memo.get(node);
    if (cached) return { ...cached };
    let result;
    if (node.kind === "number") {
      quantity("scalar", node.value, node.range, owner.objectId);
      const scale4 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = quantity(node.unit ? "length" : "scalar", node.value * scale4, node.unitRange ?? node.range, owner.objectId);
    } else if (node.kind === "parameter-reference") {
      const found = environment.get(node.id);
      if (!found) fail2("REFERENCE", "Quantity reference is unresolved in this lexical frame", node.range, owner.objectId);
      result = { ...found };
    } else if (node.kind === "group") result = evaluate2(node.expression, owner, environment, memo, frameId, depth, admission);
    else if (node.kind === "unary") {
      const operand = evaluate2(node.operand, owner, environment, memo, frameId, depth, admission);
      result = quantity(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner.objectId);
    } else if (node.kind === "binary") {
      const left = evaluate2(node.left, owner, environment, memo, frameId, depth, admission);
      const right = evaluate2(node.right, owner, environment, memo, frameId, depth, admission);
      if (node.operator === "/" && right.value === 0) fail2("DIVISION_ZERO", "Division by zero is unsupported", node.operatorRange, owner.objectId);
      const kind = binaryKind(node.operator, left.kind, right.kind, node.operatorRange, owner.objectId);
      const value = node.operator === "+" ? left.value + right.value : node.operator === "-" ? left.value - right.value : node.operator === "*" ? left.value * right.value : left.value / right.value;
      result = quantity(kind, value, node.operatorRange, owner.objectId);
    } else {
      const definition2 = definitions.get(node.functionId);
      const explicit = /* @__PURE__ */ new Map();
      for (const argument of node.arguments) explicit.set(argument.name, {
        quantity: evaluate2(argument.value, owner, environment, memo, frameId, depth),
        span: argument.range
      });
      if (work.actual.callEntries >= 256 || depth >= 8) fail2("LIMIT", "Actual function call or frame budget exhausted", node.range, owner.objectId);
      const nextId = work.actual.callEntries++;
      work.actual.maximumCallDepth = Math.max(work.actual.maximumCallDepth, depth + 1);
      const frame = /* @__PURE__ */ new Map(), localMemo = /* @__PURE__ */ new WeakMap();
      const receipt = {
        frameId: nextId,
        parentFrameId: frameId,
        functionId: definition2.id,
        depth: depth + 1,
        callSpan: { ...node.range },
        definitionSpan: { ...definition2.range },
        owner: copyCadData(owner),
        bindings: [],
        result: { kind: definition2.returnKind, unit: definition2.returnKind === "length" ? "mm" : "1", value: 0 }
      };
      calls.push(receipt);
      for (const formal of definition2.arguments) {
        const supplied = explicit.get(formal.name);
        let bound;
        if (supplied) bound = { ...supplied.quantity };
        else {
          work.actual.defaultRuntimeEvaluations++;
          bound = evaluate2(formal.defaultExpression, owner, frame, localMemo, nextId, depth + 1);
        }
        if (bound.kind !== formal.quantityKind) fail2("FUNCTION_TYPE", "Bound quantity differs from formal type", formal.typeRange, owner.objectId);
        frame.set(formal.name, { ...bound });
        receipt.bindings.push({
          formalName: formal.name,
          quantity: { ...bound },
          origin: supplied ? "explicit" : "default",
          argumentSpan: supplied ? { ...supplied.span } : null,
          formalSpan: { ...formal.range },
          defaultSpan: supplied ? null : { ...formal.defaultExpression.range }
        });
      }
      result = evaluate2(body(definition2), owner, frame, localMemo, nextId, depth + 1);
      if (result.kind !== definition2.returnKind) fail2("FUNCTION_TYPE", "Actual return quantity differs from signature", definition2.returnTypeRange, owner.objectId);
      receipt.result = { ...result };
    }
    memo.set(node, { ...result });
    return { ...result };
  };
  const functions = [];
  for (const definition2 of definitions.values()) {
    const arguments_ = [];
    for (const formal of definition2.arguments) {
      let defaultQuantity = null;
      if (formal.defaultExpression !== null) {
        if (work.actual.defaultAdmissionEvaluations >= 32) fail2("LIMIT", "Default admission budget exhausted", formal.range, definition2.id);
        work.actual.defaultAdmissionEvaluations++;
        defaultQuantity = evaluate2(
          formal.defaultExpression,
          { objectId: definition2.id, field: "default", indices: [] },
          /* @__PURE__ */ new Map(),
          /* @__PURE__ */ new WeakMap(),
          null,
          0,
          true
        );
      }
      arguments_.push({ name: formal.name, quantityKind: formal.quantityKind, defaultQuantity });
    }
    functions.push({ id: definition2.id, declaration: copyCadData(definition2), returnKind: definition2.returnKind, arguments: arguments_ });
  }
  for (const id2 of order) {
    const input = inputs.get(id2);
    const value = evaluate2(input.expression, { objectId: id2, field: "value", indices: [] }, quantities, globalMemo, null, 0);
    if (value.kind !== input.kind) fail2("UNIT", "Parameter quantity does not match its declared type", input.expression.range, id2);
    quantities.set(id2, value);
  }
  const parameters = [...inputs].map(([id2, input]) => {
    const value = quantities.get(id2);
    return { id: id2, quantityKind: value.kind, value: value.value, unit: value.unit, expression: copyCadData(input.expression), span: { ...input.span } };
  });
  const bindings = [], leafValues = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    let value = evaluate2(leaf.expression, leaf.owner, quantities, globalMemo, null, 0);
    if (leaf.required === "length" && value.kind === "scalar" && literalMillimetres2(leaf.expression))
      value = { kind: "length", unit: "mm", value: value.value };
    if (value.kind !== leaf.required) fail2("UNIT", "Field requires " + leaf.required, leaf.expression.range, leaf.owner.objectId);
    if (leaf.owner.field.startsWith("degree") && !Number.isInteger(value.value))
      fail2("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.owner.objectId);
    leafValues.set(leaf.expression, value.value);
    bindings.push({
      ...copyCadData(leaf.owner),
      expression: copyCadData(leaf.expression),
      value: value.value,
      quantityKind: value.kind,
      span: { ...leaf.expression.range },
      references: [...leaf.references]
    });
  }
  const resolvedValue = (value) => {
    if (value.kind === "array") return { kind: "array", items: value.items.map(resolvedValue), range: { ...value.range } };
    if (leafValues.has(value)) return { kind: "number", value: leafValues.get(value), range: { ...value.range } };
    return copyCadData(value);
  };
  const resolvedAst = {
    kind: "model",
    name: ast.name,
    range: { ...ast.range },
    nameRange: { ...ast.nameRange },
    fields: copyCadData(ast.fields),
    declarations: ast.declarations.filter((declaration) => declaration.kind !== "function" && declaration.kind !== "parameter").map((declaration) => ({
      kind: declaration.kind,
      id: declaration.id,
      range: { ...declaration.range },
      idRange: { ...declaration.idRange },
      fields: declaration.fields.map((field) => ({ name: field.name, range: { ...field.range }, nameRange: { ...field.nameRange }, value: resolvedValue(field.value) }))
    }))
  };
  return { ast: resolvedAst, parameters, bindings, dependencies, functions, calls, work };
}

// packages/barocss-cad/src/language/semantic-model.ts
function raw(value) {
  if (value.kind === "array") return value.items.map(raw);
  if (value.kind === "reference") return value.id;
  if (value.kind === "number" || value.kind === "identifier") return value.value;
  throw new CadAstError("TYPE", "Resolved numeric values are required", value.range);
}
var zeroRange = () => ({ start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 });
function nativeCode(message) {
  if (/^Degree /i.test(message)) return "DEGREE";
  if (/knot|domain|multiplicity/i.test(message)) return "KNOTS";
  if (/weight/i.test(message)) return "WEIGHTS";
  if (/at most|exceed|1e6/i.test(message)) return "LIMIT";
  if (/three|dimension|point/i.test(message)) return "DIMENSION";
  return "GEOMETRY";
}
function geometryRange(d, message) {
  if (d.kind === "surface" && (nativeCode(message) === "DEGREE" || nativeCode(message) === "KNOTS")) return d.range;
  const keys = nativeCode(message) === "DEGREE" ? ["degree"] : nativeCode(message) === "KNOTS" ? ["knots"] : /weight/i.test(message) ? ["weights"] : ["control-points"];
  return d.fields.find((f) => keys.includes(f.name))?.value.range ?? d.range;
}
function analyzeGeometry(ast, sourceVersion) {
  const nodes = [];
  const literals = /* @__PURE__ */ new Map();
  const byId = new Map(ast.declarations.map((d) => [d.id, d]));
  for (const declaration of ast.declarations) {
    if (declaration.kind === "parameter") throw new CadAstError("TYPE", "Unresolved parameter cannot enter geometry validation", declaration.range, declaration.id);
    if (declaration.kind === "function") throw new CadAstError("TYPE", "Unresolved function cannot enter geometry validation", declaration.range, declaration.id);
    if (declaration.kind === "extrude") {
      if (!declaration.fields.some((f) => f.name === "curve") || !declaration.fields.some((f) => f.name === "vector")) throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
      continue;
    }
    const props = new Map(declaration.fields.map((f) => [f.name, f]));
    const keys = declaration.kind === "curve" ? ["type", "degree", "knots", "control-points", "weights"] : ["type", "degree-u", "degree-v", "knots-u", "knots-v", "control-points", "weights"];
    for (const key of keys) if (!props.has(key)) throw new CadAstError("FIELD", "Missing field " + key, declaration.range, declaration.id);
    if (raw(props.get("type").value) !== "nurbs") throw new CadAstError("VALUE", "Only nurbs is supported", props.get("type").value.range, declaration.id);
    const get = (name) => raw(props.get(name).value);
    const geometry = declaration.kind === "curve" ? {
      kind: "curve",
      id: declaration.id,
      degree: get("degree"),
      knots: get("knots"),
      controlPoints: get("control-points"),
      weights: get("weights")
    } : {
      kind: "surface",
      id: declaration.id,
      degreeU: get("degree-u"),
      degreeV: get("degree-v"),
      knotsU: get("knots-u"),
      knotsV: get("knots-v"),
      controlPoints: get("control-points"),
      weights: get("weights")
    };
    try {
      if (geometry.kind === "curve") validateCurve(geometry);
      else validateSurface(geometry);
    } catch (error2) {
      const message = error2.message;
      throw new CadAstError(nativeCode(message), message, geometryRange(declaration, message), declaration.id);
    }
    const suffix = declaration.kind === "surface" ? "[][]" : "[]";
    const fieldTypes = Object.fromEntries(keys.map((key) => [key, key === "type" ? "geometry-kind" : key.startsWith("degree") ? "integer" : key.startsWith("knots") ? "dimensionless[]" : key === "control-points" ? "mm-point3" + suffix : "dimensionless" + suffix]));
    const fields3 = { id: declaration.id, span: { ...declaration.range }, fieldTypes };
    literals.set(declaration.id, geometry.kind === "curve" ? { ...fields3, kind: "curve", geometry } : { ...fields3, kind: "surface", geometry });
  }
  const version = ast.fields.find((f) => f.name === "version"), unit2 = ast.fields.find((f) => f.name === "length-unit");
  if (!version || raw(version.value) !== sourceVersion) throw new CadAstError("VERSION", "Declared source version must match sourceVersion: " + sourceVersion, version?.value.range ?? zeroRange());
  if (!unit2 || raw(unit2.value) !== "mm") throw new CadAstError("UNIT", "length-unit: mm is required", unit2?.value.range ?? zeroRange());
  if (!ast.declarations.length) throw new CadAstError("GEOMETRY", "Model must contain geometry", zeroRange(), void 0);
  const dependencies = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind !== "extrude") {
      nodes.push(literals.get(declaration.id));
      continue;
    }
    const reference = declaration.fields.find((f) => f.name === "curve"), vectorField = declaration.fields.find((f) => f.name === "vector");
    if (!reference || !vectorField) throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
    const inputId = raw(reference.value), input = byId.get(inputId), vector3 = raw(vectorField.value);
    if (!input || input.kind !== "curve") {
      const detail = !input ? "Undefined curve reference " + inputId : "Reference " + inputId + " has kind " + input.kind + "; a curve is required";
      throw new CadAstError("REFERENCE", detail, reference.value.range, declaration.id);
    }
    const curve = literals.get(inputId).geometry;
    try {
      preflightExtrusion(curve, { id: declaration.id, vector: vector3 });
    } catch (error2) {
      const message = error2.message;
      throw new CadAstError(nativeCode(message), message, vectorField.value.range, declaration.id);
    }
    nodes.push({ kind: "extrude", id: declaration.id, inputId, vector: copyCadData(vector3), span: { ...declaration.range }, referenceSpan: { ...reference.value.range }, fieldTypes: { curve: "curve-reference", vector: "mm-vector3" } });
    dependencies.push({ fromId: declaration.id, toId: inputId, kind: "curve-input", span: { ...reference.value.range } });
  }
  return { name: ast.name, lengthUnit: "mm", nodes, dependencies };
}
function analyzeCadAst(ast, sourceVersion, _source) {
  if (sourceVersion === 3) {
    const resolved2 = resolveCadFunctionParameters(ast);
    const geometry2 = analyzeGeometry(resolved2.ast, 3);
    const dependencies2 = [...geometry2.dependencies, ...resolved2.dependencies].sort((a, b) => a.span.start - b.span.start);
    return {
      schema: "barocss-cad-ir",
      schemaVersion: 3,
      sourceVersion: 3,
      ...geometry2,
      dependencies: dependencies2,
      parameters: resolved2.parameters,
      bindings: resolved2.bindings,
      functions: resolved2.functions,
      calls: resolved2.calls,
      work: resolved2.work
    };
  }
  if (sourceVersion !== 2) {
    const geometry2 = analyzeGeometry(ast, sourceVersion);
    return { schema: "barocss-cad-ir", schemaVersion: 1, sourceVersion, ...geometry2 };
  }
  const resolved = resolveCadParameters(ast);
  const geometry = analyzeGeometry(resolved.ast, 2);
  const dependencies = [...geometry.dependencies, ...resolved.dependencies].sort((a, b) => a.span.start - b.span.start);
  return {
    schema: "barocss-cad-ir",
    schemaVersion: 2,
    sourceVersion: 2,
    ...geometry,
    dependencies,
    parameters: resolved.parameters,
    bindings: resolved.bindings
  };
}

// packages/barocss-cad/src/language/lower-model.ts
function lowerCadIR(ir) {
  const literals = new Map(ir.nodes.filter((n) => n.kind !== "extrude").map((n) => [n.id, n]));
  const constructions = [];
  const objects = ir.nodes.map((node) => {
    if (node.kind !== "extrude") return copyCadData(node.geometry);
    const input = literals.get(node.inputId);
    const surface = extrudeCurve(input.geometry, { id: node.id, vector: copyCadData(node.vector) });
    const span = ({ start, end, line, column }) => ({ start, end, line, column });
    constructions.push({ outputId: node.id, inputId: node.inputId, operation: "extrude", vector: copyCadData(node.vector), span: span(node.span), referenceSpan: span(node.referenceSpan) });
    return surface;
  });
  return { model: { name: ir.name, version: 0, lengthUnit: "mm", objects }, constructions };
}

// packages/barocss-cad/src/model-compiler.ts
function compileCadStages(source, sourceVersion) {
  try {
    const ast = parseCadAst(source, sourceVersion);
    const ir = analyzeCadAst(ast, sourceVersion, source);
    const lowered = lowerCadIR(ir);
    return { ok: true, ast, ir, ...lowered };
  } catch (error2) {
    if (error2 instanceof CadAstError) return { ok: false, error: error2 };
    throw error2;
  }
}
function programmingFailure(code, message) {
  return { ok: false, diagnostics: [{ code, severity: "error", message, range: { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 } }] };
}
function diagnosticFailure(error2) {
  const diagnostic = { code: error2.code, severity: "error", message: error2.detail, range: { ...error2.range } };
  if (error2.objectId !== void 0) diagnostic.objectId = error2.objectId;
  return { ok: false, diagnostics: [diagnostic] };
}
function settleSource3Success(success) {
  if (success.ir.schemaVersion !== 3) return;
  const work = success.ir.work, limits3 = work.limits;
  const fail3 = (message) => {
    throw new CadAstError("LIMIT", message, success.ast.range, success.ast.name);
  };
  const measure = () => {
    let utf16 = 0, utf8 = 0, ownValues = 0;
    const token = (text2) => {
      utf16 += text2.length;
      for (let i = 0; i < text2.length; i++) {
        const code = text2.charCodeAt(i);
        if (code < 128) utf8++;
        else if (code < 2048) utf8 += 2;
        else if (code >= 55296 && code <= 56319 && text2.charCodeAt(i + 1) >= 56320 && text2.charCodeAt(i + 1) <= 57343) {
          utf8 += 4;
          i++;
        } else utf8 += 3;
      }
      if (utf16 > limits3.maximumSuccessUTF16 || utf8 > limits3.maximumSuccessUTF8) fail3("Complete Source3 success exceeds its file envelope");
    };
    const visit = (value, depth) => {
      if (++ownValues > limits3.maximumOwnValues || depth > limits3.maximumOwnDepth) fail3("Complete Source3 success exceeds its owned-data envelope");
      if (value === null) {
        token("null");
        return;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value)) fail3("Source3 success must retain finite numbers");
        token(Object.is(value, -0) ? "-0" : JSON.stringify(value));
        return;
      }
      if (typeof value === "string" || typeof value === "boolean") {
        token(JSON.stringify(value));
        return;
      }
      if (Array.isArray(value)) {
        if (value.length > limits3.maximumOwnArray) fail3("Source3 success array exceeds its owned-data limit");
        token("[");
        value.forEach((item, index) => {
          if (index) token(",");
          visit(item, depth + 1);
        });
        token("]");
        return;
      }
      if (typeof value !== "object") fail3("Source3 success must contain only plain compiler data");
      const record7 = value, keys = Object.keys(record7);
      if (keys.length > limits3.maximumOwnRecord) fail3("Source3 success record exceeds its owned-data limit");
      token("{");
      keys.forEach((key, index) => {
        if (index) token(",");
        token(JSON.stringify(key));
        token(":");
        visit(record7[key], depth + 1);
      });
      token("}");
    };
    visit(success, 0);
    token("\n");
    return { utf16, utf8, ownValues };
  };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const size2 = measure();
    if (size2.utf16 === work.fileSizes.success.utf16 && size2.utf8 === work.fileSizes.success.utf8 && size2.ownValues === work.ownValues) {
      settled = true;
      break;
    }
    work.fileSizes.success = { utf16: size2.utf16, utf8: size2.utf8 };
    work.ownValues = size2.ownValues;
  }
  const final = measure();
  if (!settled || final.utf16 !== work.fileSizes.success.utf16 || final.utf8 !== work.fileSizes.success.utf8 || final.ownValues !== work.ownValues) fail3("Source3 success sizes must settle within eight passes");
}
function compileCadModel(source, options) {
  globalThis.__p5Public.hit("compileCadModel");
  if (typeof source !== "string") return programmingFailure("TYPE", "Source must be a string");
  if (!options || typeof options !== "object" || Array.isArray(options)) return programmingFailure("OPTIONS", "An explicit sourceVersion option is required");
  const prototype = Object.getPrototypeOf(options), descriptors = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(options);
  if (prototype !== Object.prototype && prototype !== null || keys.length !== 1 || keys[0] !== "sourceVersion" || !descriptors.sourceVersion || !("value" in descriptors.sourceVersion) || !descriptors.sourceVersion.enumerable || descriptors.sourceVersion.value !== 0 && descriptors.sourceVersion.value !== 1 && descriptors.sourceVersion.value !== 2 && descriptors.sourceVersion.value !== 3) return programmingFailure("OPTIONS", "Only own sourceVersion: 0, 1, 2 or 3 data is supported");
  const result = compileCadStages(source, descriptors.sourceVersion.value);
  if (!result.ok) {
    return diagnosticFailure(result.error);
  }
  if (descriptors.sourceVersion.value === 3) {
    const success = { ...result, diagnostics: [] };
    try {
      settleSource3Success(success);
    } catch (error2) {
      if (error2 instanceof CadAstError) return diagnosticFailure(error2);
      throw error2;
    }
    return copyCadData(success);
  }
  return { ok: true, ast: copyCadData(result.ast), ir: copyCadData(result.ir), model: copyCadData(result.model), constructions: copyCadData(result.constructions), diagnostics: [] };
}

// packages/barocss-cad/src/numeric-policy.ts
var CadNumericPolicy = Object.freeze({
  version: 1,
  /** Modeling coordinate range for authored and stored geometry. */
  coordinateAbs: 1e4,
  /** Geometry / interchange coordinate range accepted by math validation (validateCurve, IGES import). */
  geometryCoordinateAbs: 1e6,
  /** Absolute linear comparison floor for native geometry bindings. */
  linearTolerance: 1e-7,
  /**
   * Scale-relative part of the linear tolerance: a 1e-12 parameter bracket on geometry of size S moves
   * points by ~1e-12·S, so comparisons use max(linearToleranceMM, relativeLinearTolerance·S). Equal to the
   * floor for S ≤ 10000 mm (the modeling range), so modeling results are unchanged.
   */
  relativeLinearTolerance: 1e-11,
  /** Comparison for dimensionless chart (UV) bindings; numerically the same as the mm floor, kept apart by meaning. */
  uvBindingTolerance: 1e-7,
  /** Dimensionless relative comparison (derivatives, chains: value · max(1, scale)). */
  relativeComparison: 1e-7,
  /** Normalized parameter bracket width for root refinement. */
  parameterWidth: 1e-12,
  /**
   * A stored binary64 parameter derived from exact geometry is computed exactly and rounded once to
   * nearest. Proofs accept it when it is exact, or when its 3D deviation is within the bound that one
   * such rounding can cause; anything larger is still refused.
   */
  chartParameters: "exact-or-one-rounding-certified-v1"
});
var HALF_ULP = 2 ** -53;
function linearToleranceMM(scaleMM) {
  return Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * Math.abs(scaleMM));
}

// packages/barocss-cad/src/nurbs/surfaces/z-axis-revolved-surface.ts
var OBSERVATION_MM = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/core/dyadic.ts
var view = new DataView(new ArrayBuffer(8));
function binary64Dyadic(v) {
  if (!Number.isFinite(v)) throw new RangeError("finite coordinates required");
  if (v === 0) return { m: 0n, k: 0 };
  view.setFloat64(0, v);
  const bits = view.getBigUint64(0), exp = Number(bits >> 52n & 2047n), frac = bits & 0xfffffffffffffn;
  let m = exp === 0 ? frac : frac | 1n << 52n, e = (exp === 0 ? 1 : exp) - 1075;
  while (m && !(m & 1n) && e < 0) {
    m >>= 1n;
    e++;
  }
  if (bits >> 63n) m = -m;
  return e >= 0 ? { m: m << BigInt(e), k: 0 } : { m, k: -e };
}

// packages/barocss-cad/src/intersect/own-plate-circular-hole-preview.ts
var TOL = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/intersect/own-plane-cylinder-clipped.ts
var TOL2 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/core/own-data.ts
var FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED = "Finite represented own numbers are required";
var DENSE_BOUNDED_ARRAYS_REQUIRED = "Dense bounded arrays are required";
var SPARSE_OWN_ARRAY_FIELDS_REFUSED = "Sparse/extra own array fields are refused";

// packages/barocss-cad/src/intersect/own-multispan-curve-plane.ts
var TOL3 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/nurbs/curves/curve-adaptive-sampling.ts
var EPS = 64 * Number.EPSILON;

// packages/barocss-cad/src/nurbs/source-wide/curve-wide-adaptive-sampling.ts
var WideAdaptiveCurveSamplingDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS2 = 64 * Number.EPSILON;
var POINT_TOLERANCE = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/curves/curve-bezier-spans.ts
var CurveBezierSpanExtractionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS3 = 64 * Number.EPSILON;
var POINT_TOLERANCE2 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE2 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/source-wide/curve-wide-plane-intersection.ts
var WideCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/intersect/own-coincident-plane-clip.ts
var TOL4 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/intersect/own-convex-loop-clip.ts
var TOL5 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/own-convex-planar-face.ts
var TOL6 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/intersect/own-convex-planar-face-holes.ts
var TOL7 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/intersect/own-convex-planar-face-holes-preview.ts
var TOL8 = CadNumericPolicy.linearTolerance;
var EPS4 = 64 * Number.EPSILON;

// packages/barocss-cad/src/nurbs/curves/curve-join.ts
var EPS5 = 64 * Number.EPSILON;
var POINT_TOLERANCE3 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE3 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/curves/curve-reversal.ts
var CurveReversalDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", DOMAIN: "DOMAIN", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", BINDING: "BINDING", OWNED: "OWNED" });
var EPS6 = 64 * Number.EPSILON;
var POINT_TOLERANCE4 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE4 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/curves/curve-interval-extraction.ts
var CurveIntervalExtractionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  INTERVAL: "INTERVAL",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE_CAPACITY: "NATIVE_CAPACITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE5 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE5 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/surfaces/surface-region.ts
var SurfaceRegionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  INTERVAL: "INTERVAL",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE_CAPACITY: "NATIVE_CAPACITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE6 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE6 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/source-wide/curve-wide-refinement.ts
var WideCurveRefinementDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REQUEST: "REQUEST",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE_CAPACITY: "NATIVE_CAPACITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE7 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE7 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/surfaces/surface-axis-reversal.ts
var SurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  AXIS: "AXIS",
  IDENTITY: "IDENTITY",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE8 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE8 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-axis-reversal.ts
var TrimmedSurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  TOPOLOGY: "TOPOLOGY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  BINDING: "BINDING"
});

// packages/barocss-cad/src/cad-document.ts
var CadDocumentDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  PROFILE: "PROFILE",
  IDENTITY: "IDENTITY",
  REFERENCE: "REFERENCE",
  SOURCE: "SOURCE",
  FRAME: "FRAME",
  BUDGET: "BUDGET",
  JSON: "JSON",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/document/cad-document-reference.ts
var CadReferenceDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  QUERY: "QUERY",
  FRAME: "FRAME",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/intersect/own-cubic-curve-plane-intersection.ts
var CubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/source-wide/curve-wide-cubic-plane-intersection.ts
var WideCubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/source-wide/curve-wide-control-polygon.ts
var WideCurveControlPolygonEditDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/source-wide/curve-wide-reversal.ts
var WideCurveReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/features/three-section-loft.ts
var ThreeSectionLoftDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS7 = 64 * Number.EPSILON;

// packages/barocss-cad/src/document/cad-document-bounds.ts
var CadDocumentBoundsDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/curves/cad-curve-arc-length.ts
var CadCurveArcLengthDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  INTERVAL: "INTERVAL",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS8 = 64 * Number.EPSILON;

// packages/barocss-cad/src/nurbs/surfaces/cad-surface-area.ts
var CadSurfaceAreaDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  REGION: "REGION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS9 = 64 * Number.EPSILON;

// packages/barocss-cad/src/document/cad-assembly.ts
var CadAssemblyDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  HIERARCHY: "HIERARCHY",
  REVISION: "REVISION",
  PLACEMENT: "PLACEMENT",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  JSON: "JSON",
  OWNED: "OWNED",
  QUERY: "QUERY",
  NATIVE: "NATIVE"
});

// packages/barocss-cad/src/planar-solids/coplanar-face-boolean.ts
var CoplanarFaceBooleanDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SUPPORT: "SUPPORT",
  CONTACT: "CONTACT",
  UNCERTAINTY: "UNCERTAINTY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  INCIDENCE: "INCIDENCE",
  NESTING: "NESTING",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE9 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE9 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/src/planar-solids/coplanar-face-boolean-mesh.ts
var CoplanarFaceBooleanMeshDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  UNCERTAINTY: "UNCERTAINTY",
  TRIANGULATION: "TRIANGULATION",
  INCIDENCE: "INCIDENCE",
  COVERAGE: "COVERAGE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/planar-solids/coplanar-face-boolean-extrusion.ts
var CoplanarFaceBooleanExtrusionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  INCIDENCE: "INCIDENCE",
  OWNED: "OWNED"
});
var TOLERANCE2 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/planar-solids/coplanar-face-boolean-extrusion-mesh.ts
var CoplanarFaceBooleanExtrusionMeshDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  INCIDENCE: "INCIDENCE",
  COVERAGE: "COVERAGE",
  OWNED: "OWNED"
});
var TOLERANCE3 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/features/boolean-extrusion-feature-graph.ts
var BooleanExtrusionFeatureGraphDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARAMETER: "PARAMETER",
  DEPENDENCY: "DEPENDENCY",
  REVISION: "REVISION",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  JSON: "JSON",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/planar-solids/coplanar-face-boolean-extrusion-properties.ts
var CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  OWNED: "OWNED"
});
var AREA_EPSILON = 128 * Number.EPSILON;

// packages/barocss-cad/src/nurbs/surfaces/translational-sweep-surface.ts
var TranslationalSweepDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE4 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/nurbs/curves/curve-interpolation-kernel-internal.ts
var CODE = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var PIVOT_EPSILON = 128 * Number.EPSILON;
var TOLERANCE5 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/nurbs/curves/curve-interpolation.ts
var CurveInterpolationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/surfaces/surface-interpolation.ts
var SurfaceInterpolationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE6 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/nurbs/curves/curve-parameterization.ts
var CurveParameterizationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/curves/weighted-curve-interpolation.ts
var WeightedCurveInterpolationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/features/multi-section-loft.ts
var MultiSectionLoftDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE7 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/features/affine-geometry-transform.ts
var AffineGeometryTransformDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  MATRIX: "MATRIX",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE8 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/features/linear-geometry-pattern.ts
var LinearGeometryPatternDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/features/circular-geometry-pattern.ts
var CircularGeometryPatternDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var ROTATION_TOLERANCE = 512 * Number.EPSILON;

// packages/barocss-cad/src/core/second-derivatives.ts
var NativeSecondDerivativeDiagnosticCode = Object.freeze({ INPUT: "INPUT", CONTINUITY: "CONTINUITY", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE" });

// packages/barocss-cad/src/nurbs/surfaces/local-curvature.ts
var NativeCurvatureDiagnosticCode = Object.freeze({
  DERIVATIVE: "DERIVATIVE",
  REGULARITY: "REGULARITY",
  ARITHMETIC: "ARITHMETIC"
});
var ROUNDING = 512 * Number.EPSILON;

// packages/barocss-cad/src/nurbs/curves/curve-planar-face-material.ts
var CurvePlanarFaceMaterialDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  UNSUPPORTED: "UNSUPPORTED",
  NATIVE: "NATIVE",
  UNCERTAINTY: "UNCERTAINTY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var HULL_EPS = 512 * Number.EPSILON;
var SIDE_EPS = 64 * Number.EPSILON;

// packages/barocss-cad/src/features/section-knot-alignment.ts
var SectionKnotAlignmentDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/intersect/vlinear-plane-section.ts
var VLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/nurbs/source-wide/source-surface-control-net.ts
var SourceSurfaceControlNetDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/nurbs/source-wide/source-surface-control-net-wide.ts
var SourceSurfaceControlNetWideDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });
var SourceSurfaceControlNetWideError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Source Surface control-net wide: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SourceSurfaceControlNetWideError";
    this.code = code;
  }
};
var CODE2 = SourceSurfaceControlNetWideDiagnosticCode;
var OWN = { input: CODE2.INPUT, owned: CODE2.OWNED, budget: CODE2.BUDGET, fail: (code, detail) => {
  throw new SourceSurfaceControlNetWideError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new SourceSurfaceControlNetWideError(code, detail, cause);
}, isRefusal: (e) => e instanceof SourceSurfaceControlNetWideError };

// packages/barocss-cad/src/nurbs/source-wide/source-curve-control-polygon.ts
var SourceCurveControlPolygonDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });
var SourceCurveControlPolygonError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Source Curve control-polygon: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SourceCurveControlPolygonError";
    this.code = code;
  }
};
var CODE3 = SourceCurveControlPolygonDiagnosticCode;
var OWN2 = { input: CODE3.INPUT, owned: CODE3.OWNED, budget: CODE3.BUDGET, fail: (code, detail) => {
  throw new SourceCurveControlPolygonError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new SourceCurveControlPolygonError(code, detail, cause);
}, isRefusal: (e) => e instanceof SourceCurveControlPolygonError };

// packages/barocss-cad/src/features/piecewise-rational-loft.ts
var PiecewiseRationalLoftDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", SOURCE: "SOURCE", OWNED: "OWNED" });
var PiecewiseRationalLoftError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Piecewise rational loft: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "PiecewiseRationalLoftError";
    this.code = code;
  }
};
var CODE4 = PiecewiseRationalLoftDiagnosticCode;
var OWN3 = { input: CODE4.INPUT, owned: CODE4.OWNED, budget: CODE4.BUDGET, fail: (code, detail) => {
  throw new PiecewiseRationalLoftError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new PiecewiseRationalLoftError(code, detail, cause);
}, isRefusal: (e) => e instanceof PiecewiseRationalLoftError, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/src/intersect/vlinear-plane-trim.ts
var VLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/intersect/vlinear-plane-trim-classification.ts
var VLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });
var VLinearSurfacePlaneTrimUVError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("V-linear trim UV classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "VLinearSurfacePlaneTrimUVError";
    this.code = code;
  }
};
var CODE5 = VLinearSurfacePlaneTrimUVDiagnosticCode;
var OWN4 = { input: CODE5.INPUT, owned: CODE5.OWNED, budget: CODE5.BUDGET, fail: (code, detail) => {
  throw new VLinearSurfacePlaneTrimUVError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new VLinearSurfacePlaneTrimUVError(code, detail, cause);
}, isRefusal: (e) => e instanceof VLinearSurfacePlaneTrimUVError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/axis-box-boolean.ts
var AxisBoxSolidBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", BINDING: "BINDING", CONTACT: "CONTACT", TOPOLOGY: "TOPOLOGY", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/planar-solids/axis-box-point-classification.ts
var AxisBoxSolidBooleanPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", OWNED: "OWNED" });
var AxisBoxSolidBooleanPointError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Axis-box Solid point classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidBooleanPointError";
    this.code = code;
  }
};
var CODE6 = AxisBoxSolidBooleanPointDiagnosticCode;
var OWN5 = { input: CODE6.INPUT, owned: CODE6.OWNED, budget: CODE6.BUDGET, fail: (code, detail) => {
  throw new AxisBoxSolidBooleanPointError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new AxisBoxSolidBooleanPointError(code, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidBooleanPointError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/src/axis-box-solid-mass.ts
var AxisBoxSolidMassDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var AxisBoxSolidMassError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Axis-box Solid mass: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidMassError";
    this.code = code;
  }
};
var CODE7 = AxisBoxSolidMassDiagnosticCode;
var OWN6 = { input: CODE7.INPUT, owned: CODE7.OWNED, budget: CODE7.BUDGET, fail: (code, detail) => {
  throw new AxisBoxSolidMassError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new AxisBoxSolidMassError(code, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidMassError };

// packages/barocss-cad/src/planar-solids/axis-box-principal-inertia.ts
var AxisBoxSolidPrincipalInertiaDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", MASS: "MASS", SELECTION: "SELECTION", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var AxisBoxSolidPrincipalInertiaError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Axis-box Solid principal inertia: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidPrincipalInertiaError";
    this.code = code;
  }
};
var CODE8 = AxisBoxSolidPrincipalInertiaDiagnosticCode;
var ROUNDING2 = 512 * Number.EPSILON;
var OWN7 = { input: CODE8.INPUT, owned: CODE8.OWNED, budget: CODE8.BUDGET, fail: (code, detail) => {
  throw new AxisBoxSolidPrincipalInertiaError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new AxisBoxSolidPrincipalInertiaError(code, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidPrincipalInertiaError, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/src/sketch/xy-angle-arc.ts
var XYAngleArcDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", UNIT: "UNIT", RANGE: "RANGE", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE", SOURCE: "SOURCE", BUDGET: "BUDGET", OWNED: "OWNED" });
var TURN = 2 * Math.PI;
var QUARTER = Math.PI / 2;

// packages/barocss-cad/src/sketch/xy-angle-arc-artifact.ts
var XYAngleArcArtifactDiagnosticCode = Object.freeze({ INPUT: "INPUT", REQUEST: "REQUEST", SOURCE: "SOURCE", BINDING: "BINDING", STRUCTURE: "STRUCTURE", ASSOCIATION: "ASSOCIATION", OBSERVATION: "OBSERVATION", BUDGET: "BUDGET", OWNED: "OWNED", CODEC: "CODEC", VERSION: "VERSION" });

// packages/barocss-cad/src/intersect/multispan-vlinear-plane-section.ts
var MultiSpanVLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/intersect/multispan-vlinear-plane-trim.ts
var MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/intersect/multispan-vlinear-plane-trim-classification.ts
var MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });
var MultiSpanVLinearSurfacePlaneTrimUVError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Multi-span V-linear trim UV classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "MultiSpanVLinearSurfacePlaneTrimUVError";
    this.code = code;
  }
};
var CODE9 = MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode;
var OWN8 = { input: CODE9.INPUT, owned: CODE9.OWNED, budget: CODE9.BUDGET, fail: (code, detail) => {
  throw new MultiSpanVLinearSurfacePlaneTrimUVError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new MultiSpanVLinearSurfacePlaneTrimUVError(code, detail, cause);
}, isRefusal: (e) => e instanceof MultiSpanVLinearSurfacePlaneTrimUVError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/paired/paired-section-plane-cap.ts
var PairedSectionPlaneCapDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", BASIS: "BASIS", GRAPH: "GRAPH", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var PairedSectionPlaneCapError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Paired section Plane cap: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "PairedSectionPlaneCapError";
    this.code = code;
  }
};
var CODE10 = PairedSectionPlaneCapDiagnosticCode;
var OWN9 = { input: CODE10.INPUT, owned: CODE10.OWNED, budget: CODE10.BUDGET, fail: (code, detail) => {
  throw new PairedSectionPlaneCapError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new PairedSectionPlaneCapError(code, detail, cause);
}, isRefusal: (e) => e instanceof PairedSectionPlaneCapError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/features/section-exact-surface-binding.ts
var SectionExactSurfaceBindingDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", SUPPORT: "SUPPORT", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var SectionExactSurfaceBindingError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Exact section Surface binding: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SectionExactSurfaceBindingError";
    this.code = code;
  }
};
var CODE11 = SectionExactSurfaceBindingDiagnosticCode;
var OWN10 = { input: CODE11.INPUT, owned: CODE11.OWNED, budget: CODE11.BUDGET, fail: (code, detail) => {
  throw new SectionExactSurfaceBindingError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new SectionExactSurfaceBindingError(code, detail, cause);
}, isRefusal: (e) => e instanceof SectionExactSurfaceBindingError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/exact-proof/exact-surface-lower-trim.ts
var ExactSurfaceLowerTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BINDING: "BINDING", PARENT: "PARENT", SUPPORT: "SUPPORT", EMBEDDING: "EMBEDDING", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", OWNED: "OWNED" });
var ExactSurfaceLowerTrimError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Exact original Surface lower trim: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "ExactSurfaceLowerTrimError";
    this.code = code;
  }
};
var CODE12 = ExactSurfaceLowerTrimDiagnosticCode;
var OWN11 = { input: CODE12.INPUT, owned: CODE12.OWNED, budget: CODE12.BUDGET, fail: (code, detail) => {
  throw new ExactSurfaceLowerTrimError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new ExactSurfaceLowerTrimError(code, detail, cause);
}, isRefusal: (e) => e instanceof ExactSurfaceLowerTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/translated-strip/translated-surface-base-face.ts
var TranslatedSurfaceBaseFaceDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/translated-strip/translated-surface-strip-volume.ts
var TranslatedSurfaceStripVolumeDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/translated-strip/translated-surface-end-faces.ts
var TranslatedSurfaceEndFacesDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var TranslatedSurfaceEndFacesError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Translated Surface end Faces: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "TranslatedSurfaceEndFacesError";
    this.code = code;
  }
};
var CODE13 = TranslatedSurfaceEndFacesDiagnosticCode;
var OWN12 = { input: CODE13.INPUT, owned: CODE13.OWNED, budget: CODE13.BUDGET, fail: (code, detail) => {
  throw new TranslatedSurfaceEndFacesError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new TranslatedSurfaceEndFacesError(code, detail, cause);
}, isRefusal: (e) => e instanceof TranslatedSurfaceEndFacesError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/translated-strip/qualified-translated-strip-body.ts
var QualifiedTranslatedStripBodyDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SOURCE: "SOURCE", TOPOLOGY: "TOPOLOGY", MATERIAL: "MATERIAL", ORIENTATION: "ORIENTATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/translated-strip/translated-surface-strip-world-points.ts
var TranslatedSurfaceStripWorldPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", SUPPORT: "SUPPORT", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", OWNED: "OWNED" });

// packages/barocss-cad/src/features/nurbs-source-loft-feature-graph.ts
var NurbsSourceLoftFeatureGraphDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", REVISION: "REVISION", BUDGET: "BUDGET", SOURCE: "SOURCE", REFERENCE: "REFERENCE", DEPENDENCY: "DEPENDENCY", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", CODEC: "CODEC", OWNED: "OWNED" });

// packages/barocss-cad/src/exact-proof/exact-surface-band-trim.ts
var ExactSurfaceBandTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", BAND: "BAND", EMBEDDING: "EMBEDDING", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var ExactSurfaceBandTrimError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Exact original Surface band trim: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "ExactSurfaceBandTrimError";
    this.code = code;
  }
};
var CODE14 = ExactSurfaceBandTrimDiagnosticCode;
var OWN13 = { input: CODE14.INPUT, owned: CODE14.OWNED, budget: CODE14.BUDGET, fail: (code, detail) => {
  throw new ExactSurfaceBandTrimError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new ExactSurfaceBandTrimError(code, detail, cause);
}, isRefusal: (e) => e instanceof ExactSurfaceBandTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/src/translated-strip/translated-strip-interval-boolean.ts
var TranslatedStripIntervalBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", SUPPORT: "SUPPORT", PAIR: "PAIR", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", CONSTRUCTION: "CONSTRUCTION", OWNED: "OWNED" });

// packages/barocss-cad/src/translated-strip/qualified-translated-strip-body-mesh.ts
var QualifiedTranslatedStripBodyMeshDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BODY: "BODY", SOURCE: "SOURCE", TOPOLOGY: "TOPOLOGY", UV: "UV", NATIVE: "NATIVE", ORIENTATION: "ORIENTATION", REPRESENTABILITY: "REPRESENTABILITY", FILE: "FILE", OWNED: "OWNED" });

// packages/barocss-cad/src/nurbs/source-wide/source-curve-knot-insertion.ts
var SourceCurveKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  REQUEST: "REQUEST",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/nurbs/source-wide/source-surface-knot-insertion.ts
var SourceSurfaceKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  REQUEST: "REQUEST",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/nurbs/source-wide/source-curve-interval-extraction.ts
var SourceCurveIntervalExtractionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  INTERVAL: "INTERVAL",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/nurbs/source-wide/source-knot-aligned-loft.ts
var SourceKnotAlignedLoftDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  BASIS: "BASIS",
  STATIONS: "STATIONS",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  INSERTION: "INSERTION",
  LOFT: "LOFT",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/nurbs/source-wide/source-curve-degree-elevation.ts
var SourceCurveDegreeElevationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  DEGREE: "DEGREE",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/nurbs/source-wide/source-surface-degree-elevation.ts
var SourceSurfaceDegreeElevationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/io/iges-import.ts
var IGESImportDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  FILE: "FILE",
  RECORD: "RECORD",
  GLOBAL: "GLOBAL",
  DIRECTORY: "DIRECTORY",
  PARAMETER: "PARAMETER",
  UNSUPPORTED: "UNSUPPORTED",
  BUDGET: "BUDGET",
  NUMBER: "NUMBER",
  NATIVE: "NATIVE",
  SOURCE: "SOURCE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/source-wide/source-line-width-face.ts
var SourceLineWidthFaceDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  PROFILE: "PROFILE",
  WIDTH: "WIDTH",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  RULED: "RULED",
  BOUNDARY: "BOUNDARY",
  FACE: "FACE",
  BINDING: "BINDING",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/src/paired/paired-surface-intersection-branch.ts
var PairedSurfaceIntersectionBranchDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  CONTINUITY: "CONTINUITY",
  REGULARITY: "REGULARITY",
  TANGENCY: "TANGENCY",
  CHART: "CHART",
  CONDITION: "CONDITION",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  STAGNATION: "STAGNATION",
  WORK: "WORK",
  BUDGET: "BUDGET",
  BINDING: "BINDING",
  FILE: "FILE",
  OWNED: "OWNED"
});
var TOLERANCE9 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/src/translated-strip/translated-strip-plane-split.ts
var TranslatedStripPlaneSplitDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  PARENT: "PARENT",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  SUPPORT: "SUPPORT",
  CUT: "CUT",
  PARTITION: "PARTITION",
  ORIENTATION: "ORIENTATION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  CONSTRUCTION: "CONSTRUCTION",
  VOLUME: "VOLUME",
  FILE: "FILE",
  CODEC: "CODEC",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/nurbs/source-wide/source-curve-adaptive-sampling.ts
var SourceCurveAdaptiveSamplingDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  FILE: "FILE",
  OWNED: "OWNED"
});
var EPS10 = 64 * Number.EPSILON;

// packages/barocss-cad/src/exact-proof/exact-paired-vlinear-surface-intersection.ts
var ExactPairedVLinearSurfaceIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/paired/paired-surface-uv-split-faces.ts
var PairedSurfaceUVSplitFacesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  ISO: "ISO",
  INTERVAL: "INTERVAL",
  REGION: "REGION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/paired/paired-surface-b-uv-split-faces.ts
var PairedSurfaceBUVSplitFacesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  ISO: "ISO",
  INTERVAL: "INTERVAL",
  REGION: "REGION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/paired/paired-surface-uv-face-classification.ts
var PairedSurfaceUVFaceClassificationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  BINDING: "BINDING",
  DOMAIN: "DOMAIN",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/paired/paired-surface-material-body.ts
var PairedSurfaceMaterialBodyDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  PROFILE: "PROFILE",
  SOURCE: "SOURCE",
  NATIVE: "NATIVE",
  CLOSURE: "CLOSURE",
  TOPOLOGY: "TOPOLOGY",
  MATERIAL: "MATERIAL",
  ORIENTATION: "ORIENTATION",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/paired/paired-surface-material-body-world-points.ts
var PairedSurfaceMaterialBodyWorldPointDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  BINDING: "BINDING",
  DOMAIN: "DOMAIN",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/sketch/xy-numerical-sketch-admission-internal.ts
var XYNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: "INVALID_DOCUMENT", UNSUPPORTED: "UNSUPPORTED", LIMIT: "LIMIT", REFERENCE: "REFERENCE", NONCONVERGENCE: "NONCONVERGENCE", NUMERICAL: "NUMERICAL", BUDGET: "BUDGET", BRANCH: "BRANCH", DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY", COMPILATION: "COMPILATION", OWNED: "OWNED" });

// packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts
var limits = Object.freeze({
  points: 16,
  segments: 16,
  constraints: 32,
  scalarResiduals: 64,
  unknowns: 32,
  branchGuards: 16,
  coordinateAbs: 1e4,
  minimumSegment: 1e-3,
  iterations: 100,
  evaluations: 1200
});
var limitsV1 = Object.freeze({ ...limits, points: 64, segments: 64, constraints: 128, scalarResiduals: 256, unknowns: 128, branchGuards: 32 });
var tolerances = Object.freeze({ linear: 1e-7, angular: 1e-9, rankRelative: 1e-10 });

// packages/barocss-cad/src/convex-planar-solid-proof-internal.ts
var ConvexPlanarSolidDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED", COVERAGE: "COVERAGE", BINDING: "BINDING", INCIDENCE: "INCIDENCE", CONVEXITY: "CONVEXITY", DEGENERATE: "DEGENERATE", REPRESENTABILITY: "REPRESENTABILITY" });

// packages/barocss-cad/src/sketch/xy-circular-numerical-sketch-admission-internal.ts
var XYCircularNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: "INVALID_DOCUMENT", UNSUPPORTED: "UNSUPPORTED", LIMIT: "LIMIT", REFERENCE: "REFERENCE", NONCONVERGENCE: "NONCONVERGENCE", NUMERICAL: "NUMERICAL", BUDGET: "BUDGET", BRANCH: "BRANCH", DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY", COMPILATION: "COMPILATION", OWNED: "OWNED" });

// packages/barocss-cad/src/sketch/xy-circular-numerical-sketch-solver-internal.ts
var limits2 = Object.freeze({
  points: 16,
  segments: 8,
  circles: 4,
  constraints: 32,
  scalarResiduals: 64,
  unknowns: 32,
  branchGuards: 16,
  coordinateAbs: 1e4,
  minimumSegment: 1e-3,
  minimumRadiusMM: 1e-3,
  maximumRadiusMM: 1e4,
  iterations: 100,
  evaluations: 1200,
  sourceCharacters: 262144,
  sourceBytes: 262144
});

// packages/barocss-cad/src/planar-solids/convex-planar-slab-subtraction-internal.ts
var SLAB_LIMITS = Object.freeze({ inputBytes: 33554432, resultBytes: 67108864, cumulativeSnapshotBytes: 201326592, retainedSnapshotBytes: 134217728, inputValues: 2097152, resultValues: 4194304, inputDepth: 48, resultDepth: 56, inputStringCharacters: 16777216, resultStringCharacters: 33554432, arrayElements: 4096, recordFields: 64, keyCharacters: 128, stringCharacters: 262144, facesPerChild: 12, edgesPerFace: 8, usesPerChild: 64, verticesPerChild: 32, facetPlanePasses: 48, temporaryPolygonVertices: 20, classifications: 960, crossings: 96, candidateRecords: 256, coveragePredicates: 320, faceCompilations: 72, sourceCompilations: 72, bindingObservations: 1152, totalD1: 3456, rationalContexts: 5, rationalOperationsPerContext: 2e5, aggregateRationalOperations: 1e6, aggregateGcdSteps: 1e6, integerBits: 8192 });

// packages/barocss-cad/src/features/extruded-profile-solid.ts
var ExtrudedProfileDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  GEOMETRY: "GEOMETRY",
  TOPOLOGY: "TOPOLOGY",
  SELF_INTERSECTION: "SELF_INTERSECTION"
});
var ExtrudedProfileLimits = Object.freeze({ segments: 64, coordinateMM: 1e4, minimumRadiusMM: 0.01, minimumLengthMM: 1e-4, tolerance: 1e-7 });
var TAU = Math.PI * 2;
function segmentCurve(s, z, id2) {
  if (s.kind === "line") return { kind: "curve", id: id2, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[s.start[0], s.start[1], z], [s.end[0], s.end[1], z]], weights: [1, 1] };
  const spans = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 2) - 1e-12));
  const dt = s.sweep / spans, w = Math.cos(Math.abs(dt) / 2);
  const cp = [], wt = [], knots = [0, 0, 0];
  for (let k = 0; k < spans; k++) {
    const t0 = s.startAngle + dt * k, tm = t0 + dt / 2;
    const p0 = k === 0 ? [s.start[0], s.start[1], z] : [s.center[0] + s.radius * Math.cos(t0), s.center[1] + s.radius * Math.sin(t0), z];
    const rm = s.radius / w;
    if (k === 0) {
      cp.push(p0);
      wt.push(1);
    }
    cp.push([s.center[0] + rm * Math.cos(tm), s.center[1] + rm * Math.sin(tm), z]);
    wt.push(w);
    const t1 = t0 + dt;
    cp.push(k === spans - 1 ? [s.end[0], s.end[1], z] : [s.center[0] + s.radius * Math.cos(t1), s.center[1] + s.radius * Math.sin(t1), z]);
    wt.push(1);
    if (k < spans - 1) knots.push((k + 1) / spans, (k + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { kind: "curve", id: id2, degree: 2, knots, controlPoints: cp, weights: wt };
}
function extrudedSurface(curve, z0, z1, id2) {
  return {
    kind: "surface",
    id: id2,
    degreeU: curve.degree,
    degreeV: 1,
    knotsU: [...curve.knots],
    knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((p) => [[p[0], p[1], z0], [p[0], p[1], z1]]),
    weights: curve.weights.map((w) => [w, w])
  };
}
function capSurface(bounds, z, id2, up) {
  const [x0, y0] = bounds.min, [x1, y1] = bounds.max;
  const grid = up ? [[[x0, y0, z], [x0, y1, z]], [[x1, y0, z], [x1, y1, z]]] : [[[x0, y0, z], [x1, y0, z]], [[x0, y1, z], [x1, y1, z]]];
  return { kind: "surface", id: id2, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: grid, weights: [[1, 1], [1, 1]] };
}

// packages/barocss-cad/src/mesh/facet-patch.ts
function boundsOf(positions) {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const x = positions[i + k];
    if (x < b[k]) b[k] = x;
    if (x > b[k + 3]) b[k + 3] = x;
  }
  return b;
}
function transformFacetPatch(f, m, t) {
  const P = f.positions, out = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    out[i] = m[0] * x + m[1] * y + m[2] * z + t[0];
    out[i + 1] = m[3] * x + m[4] * y + m[5] * z + t[1];
    out[i + 2] = m[6] * x + m[7] * y + m[8] * z + t[2];
  }
  return { ...f, positions: out, bounds: boundsOf(out) };
}

// packages/barocss-cad/src/brep/brep-core.ts
var BrepError = class extends KernelError {
  constructor(code, detail, report, reason) {
    super(("B-rep: " + detail).slice(0, 1024));
    this.code = code;
    this.report = report;
    this.reason = reason;
    this.name = "BrepError";
  }
};
var isFacetFace = (face) => face.surface.kind === "facets";
function buildBrep(input) {
  let scale4 = 0;
  for (const v of input.vertices) for (const x of v.point) scale4 = Math.max(scale4, Math.abs(x));
  for (const b of input.bodies) for (const s of b.shells) for (const f of s.faces) if (f.surface.kind === "facets") for (const x of f.surface.bounds) scale4 = Math.max(scale4, Math.abs(x));
  const tol = input.tolerance ?? Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * scale4);
  const bodies = [], shells = [], faces = [], loops = [], coedges = [];
  const mutable = [];
  for (const b of input.bodies) {
    const shellIds = [];
    for (const s of b.shells) {
      const shellId = `${b.id}/${s.id}`;
      shellIds.push(shellId);
      const faceIds = [];
      for (const f of s.faces) {
        const faceId = `${shellId}/${f.id}`;
        faceIds.push(faceId);
        const loopIds = [];
        f.loops.forEach((l, li) => {
          const loopId = `${faceId}/l${li}`;
          loopIds.push(loopId);
          const ids2 = l.uses.map((_, ci) => `${loopId}/c${ci}`);
          l.uses.forEach((u, ci) => mutable.push({ id: ids2[ci], edge: u.edge, sense: u.sense, loop: loopId, next: ids2[(ci + 1) % ids2.length], prev: ids2[(ci - 1 + ids2.length) % ids2.length], twin: null, pcurve: u.pcurve ?? null }));
          loops.push({ id: loopId, face: faceId, kind: l.kind, coedges: ids2 });
        });
        faces.push({ id: faceId, shell: shellId, surface: f.surface, sense: f.sense, loops: loopIds, ...f.name === void 0 ? {} : { name: f.name } });
      }
      shells.push({ id: shellId, body: b.id, faces: faceIds, closed: s.closed });
    }
    bodies.push({ id: b.id, kind: b.kind, shells: shellIds });
  }
  const byEdge = /* @__PURE__ */ new Map();
  for (const c of mutable) {
    const list2 = byEdge.get(c.edge);
    if (list2) list2.push(c);
    else byEdge.set(c.edge, [c]);
  }
  for (const uses of byEdge.values()) if (uses.length === 2 && uses[0].sense !== uses[1].sense) {
    uses[0].twin = uses[1].id;
    uses[1].twin = uses[0].id;
  }
  for (const c of mutable) coedges.push(c);
  return {
    format: "barocss-brep",
    version: 0,
    lengthUnit: "mm",
    source: input.source,
    bodies,
    shells,
    faces,
    loops,
    coedges,
    edges: input.edges.map((e) => ({ id: e.id, curve: e.curve, vertices: [e.vertices[0], e.vertices[1]], tolerance: Math.max(tol, e.tolerance ?? 0), ...e.name === void 0 ? {} : { name: e.name } })),
    vertices: input.vertices.map((v) => ({ id: v.id, point: [v.point[0], v.point[1], v.point[2]], tolerance: Math.max(tol, v.tolerance ?? 0) }))
  };
}
var lineCurve = (id2, a, b) => ({ kind: "curve", id: id2, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[...a], [...b]], weights: [1, 1] });

// packages/barocss-cad/src/mesh/facet-brep.ts
function weldVertices(positions, n, weld) {
  let cap = 16;
  while (cap < 2 * n) cap *= 2;
  const table = new Int32Array(cap).fill(-1), cells = new Float64Array(3 * n), out = new Float64Array(3 * n), remap = new Uint32Array(n);
  let m = 0;
  for (let v = 0; v < n; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const fx = x / weld, fy = y / weld, fz = z / weld, cx = Math.round(fx), cy = Math.round(fy), cz = Math.round(fz);
    let k = cellHolder(table, cells, cap, cx, cy, cz);
    if (k < 0) {
      const sx = fx < cx ? -1 : 1, sy = fy < cy ? -1 : 1, sz = fz < cz ? -1 : 1;
      for (let c = 1; c < 8 && k < 0; c++) {
        const h = cellHolder(table, cells, cap, cx + (c & 1 ? sx : 0), cy + (c & 2 ? sy : 0), cz + (c & 4 ? sz : 0));
        if (h >= 0 && Math.hypot(out[3 * h] - x, out[3 * h + 1] - y, out[3 * h + 2] - z) <= weld) k = h;
      }
      if (k < 0) {
        let h = cellHash(cx, cy, cz, cap);
        while (table[h] >= 0) h = h + 1 & cap - 1;
        table[h] = m;
        cells[3 * m] = cx;
        cells[3 * m + 1] = cy;
        cells[3 * m + 2] = cz;
        out[3 * m] = x;
        out[3 * m + 1] = y;
        out[3 * m + 2] = z;
        k = m++;
      }
    }
    remap[v] = k;
  }
  return { P: out.slice(0, 3 * m), remap };
}
var cellHash = (cx, cy, cz, cap) => (Math.imul(cx | 0, 73856093) ^ Math.imul(cy | 0, 19349663) ^ Math.imul(cz | 0, 83492791) ^ Math.imul(cx / 4294967296 | 0, 2654435761)) & cap - 1;
function cellHolder(table, cells, cap, cx, cy, cz) {
  for (let h = cellHash(cx, cy, cz, cap); ; h = h + 1 & cap - 1) {
    const k = table[h];
    if (k < 0) return -1;
    if (cells[3 * k] === cx && cells[3 * k + 1] === cy && cells[3 * k + 2] === cz) return k;
  }
}

// packages/barocss-cad/src/mesh/triangle-bvh.ts
var stack = new Int32Array(256);

// packages/barocss-cad/src/mesh/facet-bvh.ts
var DIRECTIONS = [[0.5773, 0.6007, 0.5531], [-0.4352, 0.7934, 0.4256], [0.6913, -0.3418, 0.6366], [-0.2672, -0.5389, 0.7988], [0.8123, 0.4977, -0.3042], [-0.7311, 0.1873, -0.656], [0.1391, -0.9134, -0.3826], [0.3529, 0.2214, -0.9091]].map((d) => {
  const l = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / l, d[1] / l, d[2] / l];
});
var stack2 = new Int32Array(256);

// packages/barocss-cad/src/mesh/mesh-decimate.ts
var n1 = new Float64Array(3);
var n2 = new Float64Array(3);
var pair = new Int32Array(4);
var place = new Float64Array(3);
var two = new Int32Array(3);

// packages/barocss-cad/src/mesh/mesh-clearance.ts
var TA = new Float64Array(9);
var TB = new Float64Array(9);
var CP = new Float64Array(6);
var BEST = new Float64Array(6);
var stack3 = new Int32Array(512);
var Q = new Float64Array(3);
var S = new Float64Array(6);

// packages/barocss-cad/src/mesh/voxel-field.ts
var IDS = new Int32Array(4);
var PIN = new Int32Array(4);
var POUT = new Int32Array(4);

// packages/barocss-cad/src/features/subd-sd2.ts
var GP = new Float64Array(3);
var GU = new Float64Array(3);
var GV = new Float64Array(3);
var BU = new Float64Array(4);
var BV = new Float64Array(4);
var DU = new Float64Array(4);
var DV = new Float64Array(4);

// packages/barocss-cad/src/nurbs/surfaces/surface-revolution.ts
var TAU2 = 2 * Math.PI;

// packages/barocss-cad/src/core/extent.ts
function minAt(ps, k) {
  let r = Infinity;
  for (let i = 0; i < ps.length; i++) {
    const x = ps[i][k];
    if (x !== x) return NaN;
    if (x < r || x === 0 && r === 0 && Object.is(x, -0)) r = x;
  }
  return r;
}
function maxAt(ps, k) {
  let r = -Infinity;
  for (let i = 0; i < ps.length; i++) {
    const x = ps[i][k];
    if (x !== x) return NaN;
    if (x > r || x === 0 && r === 0 && Object.is(r, -0)) r = x;
  }
  return r;
}

// packages/barocss-cad/src/brep/curved-arrangement.ts
var curvedArrangementError = (detail) => kernelRefusal("curved-arrangement", "CURVED_ARRANGEMENT", "Curved arrangement: " + detail);
var TWO_PI = 2 * Math.PI;
var curveT = (s, u) => s.t0 + (s.t1 - s.t0) * u;
var segStart = (s) => s.kind === "line" ? s.a : s.kind === "curve" ? s.f(s.t0) : [s.c[0] + s.r * Math.cos(s.t0), s.c[1] + s.r * Math.sin(s.t0)];
var segEnd = (s) => s.kind === "line" ? s.b : s.kind === "curve" ? s.f(s.t1) : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep), s.c[1] + s.r * Math.sin(s.t0 + s.sweep)];
var segAt = (s, u) => s.kind === "line" ? [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u] : s.kind === "curve" ? s.f(curveT(s, u)) : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep * u), s.c[1] + s.r * Math.sin(s.t0 + s.sweep * u)];
var segReverse = (s) => s.kind === "line" ? { ...s, a: s.b, b: s.a } : s.kind === "curve" ? { ...s, t0: s.t1, t1: s.t0 } : { ...s, t0: s.t0 + s.sweep, sweep: -s.sweep };
function segPart(s, u0, u1, a, b) {
  return s.kind === "line" ? { ...s, a, b } : s.kind === "curve" ? { ...s, t0: curveT(s, u0), t1: curveT(s, u1) } : { ...s, t0: s.t0 + s.sweep * u0, sweep: s.sweep * (u1 - u0) };
}
var GL8 = (() => {
  const x = [0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363], w = [0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
  return [...x.map((v, i) => [(1 - v) / 2, w[i] / 2]), ...x.map((v, i) => [(1 + v) / 2, w[i] / 2])];
})();
function integrate(s, g) {
  let acc = 0;
  const pieces = 16, h = 1e-6;
  for (let k = 0; k < pieces; k++) for (const [x, w] of GL8) {
    const u = (k + x) / pieces, p = segAt(s, u), a = segAt(s, Math.max(0, u - h)), b = segAt(s, Math.min(1, u + h)), du = Math.min(1, u + h) - Math.max(0, u - h);
    acc += g(p, [(b[0] - a[0]) / du, (b[1] - a[1]) / du]) * w / pieces;
  }
  return acc;
}
var areas = /* @__PURE__ */ new WeakMap();
var polyline = (s, n) => s.kind === "curve" && n === CURVE_SAMPLES ? samplesOf(s) : Array.from({ length: n + 1 }, (_, k) => segAt(s, k / n));
var sampled = /* @__PURE__ */ new WeakMap();
function samples(s) {
  let r = sampled.get(s);
  if (!r) {
    const ps = Array.from({ length: CURVE_SAMPLES + 1 }, (_, k) => segAt(s, k / CURVE_SAMPLES)), lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    let pad = 0;
    for (let k = 0; k <= CURVE_SAMPLES; k++) {
      for (const a of [0, 1]) {
        lo[a] = Math.min(lo[a], ps[k][a]);
        hi[a] = Math.max(hi[a], ps[k][a]);
      }
      if (k) pad = Math.max(pad, Math.hypot(ps[k][0] - ps[k - 1][0], ps[k][1] - ps[k - 1][1]));
    }
    r = { ps, lo: [lo[0] - pad, lo[1] - pad], hi: [hi[0] + pad, hi[1] + pad] };
    sampled.set(s, r);
  }
  return r;
}
var samplesOf = (s) => samples(s).ps;
var denseSampled = /* @__PURE__ */ new WeakMap();
function denseSamples(s) {
  let r = denseSampled.get(s);
  if (!r) {
    r = Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => segAt(s, k / (CURVE_SAMPLES * 2)));
    denseSampled.set(s, r);
  }
  return r;
}
var surelyOff = (s, p, eps) => {
  if (s.kind !== "curve") return false;
  const { lo, hi } = samples(s);
  return p[0] < lo[0] - eps || p[1] < lo[1] - eps || p[0] > hi[0] + eps || p[1] > hi[1] + eps;
};
var CURVE_SAMPLES = 64;
var LIES_ALONG_FIRST = [0.5, 0, 1];
var LINE_US = [0, 1];
var DENSE_US = Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => k / (CURVE_SAMPLES * 2));
function segArea(s) {
  if (s.kind === "line") return (s.a[0] * s.b[1] - s.b[0] * s.a[1]) / 2;
  if (s.kind === "curve") {
    let a = areas.get(s);
    if (a === void 0) {
      a = integrate(s, (p, d) => (p[0] * d[1] - p[1] * d[0]) / 2);
      areas.set(s, a);
    }
    return a;
  }
  const t1 = s.t0 + s.sweep;
  return (s.r * s.r * s.sweep + s.c[0] * s.r * (Math.sin(t1) - Math.sin(s.t0)) - s.c[1] * s.r * (Math.cos(t1) - Math.cos(s.t0))) / 2;
}
var ringArea = (ring) => ring.reduce((a, s) => a + segArea(s), 0);
var regionArea = (r) => ringArea(r.outer) + r.holes.reduce((a, h) => a + ringArea(h), 0);
function sampleRing(ring, step = Math.PI / 36) {
  return ring.flatMap((s) => {
    const n = s.kind === "line" ? 1 : s.kind === "curve" ? CURVE_SAMPLES : Math.max(2, Math.ceil(Math.abs(s.sweep) / step));
    return Array.from({ length: n }, (_, k) => segAt(s, k / n));
  });
}
var pointInPolygon = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
function liesAlong(a, b, eps) {
  for (const u of LIES_ALONG_FIRST) {
    const p = segAt(a, u);
    if (surelyOff(b, p, eps) || segDistance(b, p) > eps) return false;
  }
  const ps = a.kind === "curve" ? samplesOf(a) : polyline(a, CURVE_SAMPLES);
  for (const p of ps) if (surelyOff(b, p, eps) || segDistance(b, p) > eps) return false;
  return true;
}
function segD2(s, p, u) {
  const q2 = segAt(s, u);
  return (q2[0] - p[0]) ** 2 + (q2[1] - p[1]) ** 2;
}
function goldenNearest(s, p, lo, hi) {
  for (let i = 0; i < 60; i++) {
    const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887;
    if (segD2(s, p, m1) < segD2(s, p, m2)) hi = m2;
    else lo = m1;
  }
  return (lo + hi) / 2;
}
function paramOf(s, p) {
  if (s.kind === "curve") {
    const ps = samplesOf(s);
    let best = 0, bd = Infinity;
    for (let k = 0; k <= CURVE_SAMPLES; k++) {
      const q2 = ps[k], v = (q2[0] - p[0]) ** 2 + (q2[1] - p[1]) ** 2;
      if (v < bd) {
        bd = v;
        best = k;
      }
    }
    const lo = Math.max(0, (best - 1) / CURVE_SAMPLES), hi = Math.min(1, (best + 1) / CURVE_SAMPLES);
    const u0 = goldenNearest(s, p, lo, hi), d0 = segD2(s, p, u0), on = 1e-6 * (1 + Math.abs(p[0]) + Math.abs(p[1])), N = CURVE_SAMPLES;
    const closed = Math.hypot(ps[0][0] - ps[N][0], ps[0][1] - ps[N][1]) <= on;
    if (d0 > on * on) for (const k of nearerChords(ps, p, d0)) {
      if (closed && (best === N && k === 0 || best === 0 && k === N - 1)) continue;
      const u = goldenNearest(s, p, Math.max(0, (k - 0.5) / CURVE_SAMPLES), Math.min(1, (k + 1.5) / CURVE_SAMPLES));
      if (segD2(s, p, u) <= on * on) return u;
    }
    return u0;
  }
  if (s.kind === "line") {
    const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l2 = d[0] * d[0] + d[1] * d[1];
    return ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / l2;
  }
  const dir = Math.sign(s.sweep), w = Math.abs(s.sweep);
  let dt = (Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.t0) * dir;
  dt = (dt % TWO_PI + TWO_PI) % TWO_PI;
  if (dt > w && TWO_PI - dt < dt - w) dt -= TWO_PI;
  return dt / w;
}
function nearerChords(ps, p, d2) {
  const out = [];
  for (let k = 0; k + 1 < ps.length; k++) {
    const a = ps[k], b = ps[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0, ex = a[0] + t * dx - p[0], ey = a[1] + t * dy - p[1], d = ex * ex + ey * ey;
    if (d < d2) out.push({ k, d });
  }
  return out.sort((x, y) => x.d - y.d).map((x) => x.k);
}
function segDistance(s, p) {
  const q2 = segAt(s, Math.min(1, Math.max(0, paramOf(s, p))));
  return Math.hypot(q2[0] - p[0], q2[1] - p[1]);
}
function touchOfEnd(s, t, u, m, eps) {
  if ([segStart(s), segEnd(s), segStart(t), segEnd(t)].some((q2) => Math.hypot(q2[0] - m[0], q2[1] - m[1]) <= eps)) return false;
  for (const [e, ue] of [[segStart(s), 0], [segEnd(s), 1]]) {
    if (Math.abs(u - ue) > 0.25 || segDistance(t, e) > eps) continue;
    let hug = true;
    for (let k = 1; k < 8 && hug; k++) hug = segDistance(t, segAt(s, ue + (u - ue) * k / 8)) <= eps;
    if (hug && leavesAwayFromEnds(s, t, e, ue, Math.abs(u - ue), eps)) return true;
  }
  return false;
}
function leavesAwayFromEnds(s, t, e, ue, from, eps) {
  const dir = ue === 0 ? 1 : -1;
  let prev = segAt(s, ue + dir * from);
  for (let k = 1; k <= 64; k++) {
    const x = from + (1 - from) * k / 64, q2 = segAt(s, ue + dir * x);
    if (segDistance(t, q2) > eps) {
      const step = Math.hypot(q2[0] - prev[0], q2[1] - prev[1]) + eps;
      const last = prev;
      return ![segStart(t), segEnd(t)].some((w) => Math.hypot(w[0] - e[0], w[1] - e[1]) > eps && Math.hypot(w[0] - last[0], w[1] - last[1]) <= step);
    }
    prev = q2;
  }
  return false;
}
function overlapEnds(s, t, points, eps) {
  if (points.length < 3) return points;
  const at2 = points.map((p) => ({ p, u: paramOf(s, p) })).sort((a, b) => a.u - b.u);
  const along = at2.slice(0, -1).map((a, i) => {
    const q2 = segAt(s, (a.u + at2[i + 1].u) / 2);
    return segDistance(t, q2) <= eps;
  });
  return at2.filter((_, i) => !(i > 0 && i < at2.length - 1 && along[i - 1] && along[i])).map((a) => a.p);
}
function grazePolyline(seg, P, n, line) {
  const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], l = Math.hypot(dx, dy), points = [P[0]], us = [0];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > 0 && L > 0) {
      const sa = (dx * (a[1] - line.a[1]) - dy * (a[0] - line.a[0])) / l, sb = (dx * (b[1] - line.a[1]) - dy * (b[0] - line.a[0])) / l;
      const f = ((a[0] + b[0]) / 2 - line.a[0]) * dx / (l * l) + ((a[1] + b[1]) / 2 - line.a[1]) * dy / (l * l);
      if (Math.min(Math.abs(sa), Math.abs(sb)) <= L && f >= 0 && f <= 1) for (let k = 1; k < 8; k++) {
        const u = (i + k / 8) / n;
        points.push(segAt(seg, u));
        us.push(u);
      }
    }
    points.push(b);
    us.push((i + 1) / n);
  }
  return { points, us };
}
function grazeCrossings(curve, line, R, eps) {
  const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], l = Math.hypot(dx, dy), out = [];
  if (!(l > 0)) return out;
  let lastU = R.us[0], lastD = (dx * (R.points[0][1] - line.a[1]) - dy * (R.points[0][0] - line.a[0])) / l;
  for (let i = 1; i < R.points.length; i++) {
    const p = R.points[i], d = (dx * (p[1] - line.a[1]) - dy * (p[0] - line.a[0])) / l, u = R.us[i];
    if (Math.abs(d) <= eps && Math.abs(lastD) <= eps) {
      lastU = u;
      lastD = d;
      continue;
    }
    if (d === 0) out.push(p);
    else if (lastD !== 0 && d > 0 !== lastD > 0) {
      let lo = lastU, hi = u, dl = lastD;
      for (let it = 0; it < 60; it++) {
        const m = (lo + hi) / 2, q2 = segAt(curve, m), dm = (dx * (q2[1] - line.a[1]) - dy * (q2[0] - line.a[0])) / l;
        if (dm === 0) {
          lo = hi = m;
          break;
        }
        if (dm > 0 === dl > 0) {
          lo = m;
          dl = dm;
        } else hi = m;
      }
      out.push(segAt(curve, (lo + hi) / 2));
    }
    lastU = u;
    lastD = d;
  }
  return out;
}
function crossesAt(s, t, u, v, eps) {
  const Q2 = segAt(t, v), Q1 = segAt(t, Math.min(1, v + 1e-6)), Q0 = segAt(t, Math.max(0, v - 1e-6)), tx = Q1[0] - Q0[0], ty = Q1[1] - Q0[1], l = Math.hypot(tx, ty);
  if (!(l > 0)) return false;
  const a = segAt(s, Math.max(0, u - 1e-3)), b = segAt(s, Math.min(1, u + 1e-3));
  const da = (tx * (a[1] - Q2[1]) - ty * (a[0] - Q2[0])) / l, db = (tx * (b[1] - Q2[1]) - ty * (b[0] - Q2[0])) / l;
  return Math.abs(da) > eps && Math.abs(db) > eps && da > 0 !== db > 0;
}
function intersectSegments(s, t, eps, graze = false) {
  const out = [], on = (x, p) => !surelyOff(x, p, eps) && segDistance(x, p) <= eps;
  const push = (p) => {
    if (on(s, p) && on(t, p)) out.push(p);
  };
  const ends = () => {
    for (const p of [segStart(s), segEnd(s)]) if (on(t, p) && on(s, p)) out.push(p);
    for (const p of [segStart(t), segEnd(t)]) push(p);
  };
  if (s.kind === "curve" || t.kind === "curve") {
    if (liesAlong(s, t, eps) || liesAlong(t, s, eps)) {
      ends();
      return overlapEnds(s, t, out, eps);
    }
    const n = (x) => x.kind === "line" ? 1 : x.kind === "curve" ? CURVE_SAMPLES : Math.max(4, Math.ceil(Math.abs(x.sweep) / (Math.PI / 32)));
    const ns = n(s), nt = n(t), A0 = polyline(s, ns), B0 = polyline(t, nt);
    if (graze && s.kind === "line" !== (t.kind === "line")) {
      const curve = s.kind === "line" ? t : s, line2 = s.kind === "line" ? s : t;
      const R = grazePolyline(curve, curve === s ? A0 : B0, curve === s ? ns : nt, line2);
      for (const p of grazeCrossings(curve, line2, R, eps)) push(p);
      ends();
      return overlapEnds(s, t, out, eps);
    }
    const A = A0, B = B0;
    for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) {
      const p = A[i], q2 = A[i + 1], r = B[j], w = B[j + 1], d1 = [q2[0] - p[0], q2[1] - p[1]], d2 = [w[0] - r[0], w[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-300) continue;
      const e = [r[0] - p[0], r[1] - p[1]], a = (e[0] * d2[1] - e[1] * d2[0]) / den, b = (e[0] * d1[1] - e[1] * d1[0]) / den;
      if (a < -0.25 || a > 1.25 || b < -0.25 || b > 1.25) continue;
      let u = (i + Math.min(1, Math.max(0, a))) / ns, v = (j + Math.min(1, Math.max(0, b))) / nt;
      const fromEnd = u === 1 || v === 1;
      for (let it = 0; it < 30; it++) {
        const P2 = segAt(s, u), Q3 = segAt(t, v), F = [P2[0] - Q3[0], P2[1] - Q3[1]], h = 1e-7;
        if (it === 0 && (u === 1 || v === 1) && Math.hypot(F[0], F[1]) <= eps) break;
        const hu = Math.min(1, u + h) - u || -h, hv = Math.min(1, v + h) - v || -h, Pu = segAt(s, u + hu), Qv = segAt(t, v + hv);
        const J = [(Pu[0] - P2[0]) / hu, -(Qv[0] - Q3[0]) / hv, (Pu[1] - P2[1]) / hu, -(Qv[1] - Q3[1]) / hv], det = J[0] * J[3] - J[1] * J[2];
        if (Math.abs(det) < 1e-300) break;
        const du = (F[0] * J[3] - F[1] * J[1]) / det, dv = (J[0] * F[1] - J[2] * F[0]) / det;
        const nu = Math.min(1, Math.max(0, u - du)), nv = Math.min(1, Math.max(0, v - dv)), held = nu === u && nv === v;
        u = nu;
        v = nv;
        if (held || Math.abs(du) < 1e-15 && Math.abs(dv) < 1e-15) break;
      }
      const P = segAt(s, u), Q2 = segAt(t, v);
      if (fromEnd && u !== 1 && v !== 1 && !crossesAt(s, t, u, v, eps)) continue;
      if (Math.hypot(P[0] - Q2[0], P[1] - Q2[1]) <= eps) {
        const m = [(P[0] + Q2[0]) / 2, (P[1] + Q2[1]) / 2];
        if (!out.some((o) => Math.hypot(o[0] - m[0], o[1] - m[1]) <= eps) && !touchOfEnd(s, t, u, m, eps) && !touchOfEnd(t, s, v, m, eps)) push(m);
      }
    }
    ends();
    return overlapEnds(s, t, out, eps);
  }
  if (s.kind === "line" && t.kind === "line") {
    const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    const len2 = Math.hypot(...d1) * Math.hypot(...d2);
    if (Math.abs(den) <= 1e-12 * len2) {
      ends();
      return out;
    }
    const w = [t.a[0] - s.a[0], t.a[1] - s.a[1]], u = (w[0] * d2[1] - w[1] * d2[0]) / den;
    push([s.a[0] + d1[0] * u, s.a[1] + d1[1] * u]);
    ends();
    return out;
  }
  if (s.kind === "arc" && t.kind === "arc") {
    const dx = t.c[0] - s.c[0], dy = t.c[1] - s.c[1], d2 = Math.hypot(dx, dy);
    if (d2 <= eps) {
      ends();
      return out;
    }
    const a = (s.r * s.r - t.r * t.r + d2 * d2) / (2 * d2), h22 = s.r * s.r - a * a, band2 = 2 * eps * Math.min(s.r, t.r);
    if (h22 < -band2) {
      ends();
      return out;
    }
    const h = h22 > band2 ? Math.sqrt(h22) : 0, mx = s.c[0] + a * dx / d2, my = s.c[1] + a * dy / d2;
    push([mx + h * dy / d2, my - h * dx / d2]);
    if (h > 0) push([mx - h * dy / d2, my + h * dx / d2]);
    ends();
    return out;
  }
  const line = s.kind === "line" ? s : t, arc = s.kind === "arc" ? s : t;
  const d = [line.b[0] - line.a[0], line.b[1] - line.a[1]], l = Math.hypot(...d), ux = d[0] / l, uy = d[1] / l;
  const f = [line.a[0] - arc.c[0], line.a[1] - arc.c[1]], proj = f[0] * ux + f[1] * uy, dist2 = f[0] * f[0] + f[1] * f[1] - proj * proj, h2 = arc.r * arc.r - dist2;
  const band = 2 * eps * arc.r;
  if (h2 >= -band) {
    const h = h2 > band ? Math.sqrt(h2) : 0;
    for (const sgn of h > 0 ? [-1, 1] : [0]) {
      const k = -proj + sgn * h;
      push([line.a[0] + ux * k, line.a[1] + uy * k]);
    }
  }
  ends();
  return out;
}
var boxS = new Float64Array(4);
var boxT = new Float64Array(4);
var halves = (s) => {
  if (s.kind === "arc" && Math.abs(s.sweep) > Math.PI + 1e-12) return [{ ...s, sweep: s.sweep / 2 }, { ...s, t0: s.t0 + s.sweep / 2, sweep: s.sweep / 2 }];
  if (s.kind === "curve") {
    const a = segStart(s), b = segEnd(s);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9 * (1 + Math.abs(a[0]) + Math.abs(a[1]))) {
      const m = (s.t0 + s.t1) / 2;
      return [{ ...s, t1: m }, { ...s, t0: m }];
    }
  }
  return [s];
};
function curveTolerance(rings) {
  let scale4 = 0;
  for (const ring of rings) for (const s of ring) for (const q2 of s.kind === "line" ? [s.a, s.b] : s.kind === "curve" ? polyline(s, 8) : [[Math.abs(s.c[0]) + s.r, Math.abs(s.c[1]) + s.r]]) scale4 = Math.max(scale4, Math.abs(q2[0]), Math.abs(q2[1]));
  return linearToleranceMM(scale4);
}
var traced = (x) => x.kind === "curve" && !x.exact;
function joinLooseEnds(points, edges, eps) {
  const degree = new Int32Array(points.length);
  for (const e of edges) {
    degree[e.u]++;
    degree[e.v]++;
  }
  for (let v = 0; v < points.length; v++) {
    if (degree[v] !== 1) continue;
    let e = 0;
    while (edges[e].u !== v && edges[e].v !== v) e++;
    const other = edges[e].u === v ? edges[e].v : edges[e].u;
    if (Math.hypot(points[other][0] - points[v][0], points[other][1] - points[v][1]) <= 10 * eps) continue;
    let best = -1, bd = 10 * eps;
    for (let w = 0; w < points.length; w++) {
      if (w === v || w === other || degree[w] === 0) continue;
      const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
      if (d <= bd) {
        bd = d;
        best = w;
      }
    }
    if (best < 0) for (let w = 0, d0 = 100 * eps; w < points.length; w++) {
      if (w === v || w === other || degree[w] !== 1) continue;
      const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
      if (d <= d0) {
        d0 = d;
        best = w;
      }
    }
    if (best >= 0) {
      if (edges[e].u === v) edges[e].u = best;
      else edges[e].v = best;
      degree[v] = 0;
      degree[best]++;
      continue;
    }
    const p = points[v];
    const short = Math.hypot(points[other][0] - p[0], points[other][1] - p[1]) <= 100 * eps;
    const tracedEnd = traced(edges[e].seg);
    let split = -1, at2 = 0, sd = 10 * eps;
    for (let f = 0; f < edges.length; f++) {
      const g2 = edges[f], tracedSeg = traced(g2.seg), reach = (tracedEnd ? tracedSeg ? 10 : 20 : tracedSeg ? 100 : 10) * eps;
      if (f === e || g2.u === v || g2.v === v || short && (g2.u === other || g2.v === other) || surelyOff(g2.seg, p, Math.max(sd, reach))) continue;
      const d = segDistance(g2.seg, p);
      if (d > reach || split >= 0 && d > sd) continue;
      const u = paramOf(g2.seg, p);
      if (u > 0 && u < 1) {
        sd = d;
        split = f;
        at2 = u;
      }
    }
    if (split < 0) continue;
    const g = edges[split];
    edges.push({ u: v, v: g.v, seg: segPart(g.seg, at2, 1, p, points[g.v]), count: new Map(g.count) });
    g.seg = segPart(g.seg, 0, at2, points[g.u], p);
    g.v = v;
    degree[v] += 2;
  }
}
function arrange(rings, tolerance, joinEnds = false) {
  const pieces = [];
  for (const { polygon, ring } of rings) for (const seg of ring) for (const h of halves(seg)) pieces.push({ seg: h, polygon });
  const eps = tolerance ?? curveTolerance(rings.map((r) => r.ring));
  const points = [], grid = /* @__PURE__ */ new Map(), cell = eps * 64;
  const vid = (p) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), r = 2 * eps;
    const x0 = p[0] - gx * cell <= r ? -1 : 0, x1 = (gx + 1) * cell - p[0] <= r ? 1 : 0, y0 = p[1] - gy * cell <= r ? -1 : 0, y1 = (gy + 1) * cell - p[1] <= r ? 1 : 0;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      const g2 = grid.get(gx + i + "," + (gy + j));
      if (g2) {
        for (const v2 of g2) if (Math.hypot(points[v2][0] - p[0], points[v2][1] - p[1]) <= eps) return v2;
      }
    }
    const v = points.length;
    points.push(p);
    const k = gx + "," + gy, g = grid.get(k);
    if (g) g.push(v);
    else grid.set(k, [v]);
    return v;
  };
  const cuts = pieces.map((p) => [segStart(p.seg), segEnd(p.seg)]);
  const box = (s) => {
    if (s.kind === "curve") {
      const { lo, hi } = samples(s);
      return [lo[0] - eps, lo[1] - eps, hi[0] + eps, hi[1] + eps];
    }
    const pts = s.kind === "line" ? [s.a, s.b] : [segStart(s), segEnd(s), [s.c[0] - s.r, s.c[1] - s.r], [s.c[0] + s.r, s.c[1] + s.r]];
    return [minAt(pts, 0) - eps, minAt(pts, 1) - eps, maxAt(pts, 0) + eps, maxAt(pts, 1) + eps];
  };
  const boxes = pieces.map((p) => box(p.seg));
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) continue;
    for (const p of intersectSegments(pieces[i].seg, pieces[j].seg, eps)) {
      cuts[i].push(p);
      cuts[j].push(p);
    }
  }
  const edges = [], edgesBetween = /* @__PURE__ */ new Map();
  pieces.forEach((pc, i) => {
    const params = cuts[i].map((p) => ({ u: Math.min(1, Math.max(0, paramOf(pc.seg, p))), v: vid(p) })).sort((x, y) => x.u - y.u);
    const stops = [];
    for (const st of params) if (!stops.length || stops[stops.length - 1].v !== st.v) stops.push(st);
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1];
      if (s1.u - s0.u <= 0) continue;
      const seg = segPart(pc.seg, s0.u, s1.u, points[s0.v], points[s1.v]), mid = segAt(seg, 0.5);
      const forward = s0.v < s1.v, lo = forward ? s0.v : s1.v, hi = forward ? s1.v : s0.v;
      const key = lo + ":" + hi, list2 = edgesBetween.get(key) ?? [];
      let e = list2.find((k2) => segDistance(edges[k2].seg, mid) <= 4 * eps);
      if (e === void 0) {
        e = edges.length;
        edges.push({ u: lo, v: hi, seg: forward ? seg : segReverse(seg), count: /* @__PURE__ */ new Map() });
        list2.push(e);
        edgesBetween.set(key, list2);
      }
      if (pc.polygon >= 0) {
        const c = edges[e].count;
        c.set(pc.polygon, (c.get(pc.polygon) ?? 0) + (forward ? 1 : -1));
      }
    }
  });
  if (joinEnds) joinLooseEnds(points, edges, eps);
  const half = [];
  edges.forEach((_, i) => {
    half.push({ from: edges[i].u, to: edges[i].v, edge: i, twin: 2 * i + 1, next: -1, face: -1 }, { from: edges[i].v, to: edges[i].u, edge: i, twin: 2 * i, next: -1, face: -1 });
  });
  const leaving = (h) => {
    const s = h.from === edges[h.edge].u ? edges[h.edge].seg : segReverse(edges[h.edge].seg);
    const norm2 = (a) => a <= -Math.PI + 1e-12 ? a + TWO_PI : a;
    if (s.kind === "line") return { angle: norm2(Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])), curvature: 0 };
    if (s.kind === "curve") {
      const d = 1e-4, p0 = segAt(s, 0), p1 = segAt(s, d), p2 = segAt(s, 2 * d), v = [(p1[0] - p0[0]) / d, (p1[1] - p0[1]) / d], a = [(p2[0] - 2 * p1[0] + p0[0]) / (d * d), (p2[1] - 2 * p1[1] + p0[1]) / (d * d)];
      return { angle: norm2(Math.atan2(v[1], v[0])), curvature: (v[0] * a[1] - v[1] * a[0]) / Math.hypot(v[0], v[1]) ** 3 };
    }
    const t = s.t0, dir = Math.sign(s.sweep);
    return { angle: norm2(Math.atan2(Math.cos(t) * dir, -Math.sin(t) * dir)), curvature: dir / s.r };
  };
  const outgoing = points.map(() => []);
  half.forEach((h, i) => outgoing[h.from].push(i));
  const keyed = half.map(leaving);
  const delta = 1e3 * eps, rel = new Float64Array(half.length), segLeaving = (h) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  for (const list2 of outgoing) {
    const a = list2.map((h) => keyed[h].angle).sort((x, y) => x - y);
    let from = -Math.PI, gap = -1;
    for (let i = 0; i < a.length; i++) {
      const g = (i + 1 < a.length ? a[i + 1] : a[0] + TWO_PI) - a[i];
      if (g > gap) {
        gap = g;
        from = a[i] + g / 2;
      }
    }
    for (const h of list2) rel[h] = ((keyed[h].angle - from) % TWO_PI + TWO_PI) % TWO_PI;
    list2.sort((x, y) => {
      const d = rel[x] - rel[y];
      return Math.abs(d) > 1e-4 ? d : tangentOrder(segLeaving(x), segLeaving(y), rel[x], rel[y], from, d, keyed[x].curvature, keyed[y].curvature, delta);
    });
  }
  const pos = /* @__PURE__ */ new Map();
  outgoing.forEach((list2) => list2.forEach((h, k) => pos.set(h, k)));
  for (const h of half) {
    const list2 = outgoing[h.to], k = pos.get(h.twin);
    h.next = list2[(k - 1 + list2.length) % list2.length];
  }
  const cycles = [];
  half.forEach((h, i) => {
    if (h.face >= 0) return;
    const c = [];
    let g = i;
    do {
      half[g].face = cycles.length;
      c.push(g);
      g = half[g].next;
    } while (g !== i && c.length <= half.length);
    cycles.push(c);
  });
  const segOfHalf = (h) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  return { points, edges, half, cycles, segOfHalf, eps };
}
function tangentOrder(a, b, relA, relB, from, d, ka, kb, delta) {
  const L = 0.25 * Math.min(segLength(a), segLength(b)), p0 = segAt(a, 0), pa = pointAlong(a, L), pb = pointAlong(b, L);
  const ang = (q2) => ((Math.atan2(q2[1] - p0[1], q2[0] - p0[0]) - from) % TWO_PI + TWO_PI) % TWO_PI;
  const fix = (x, ref) => x - ref > Math.PI ? x - TWO_PI : ref - x > Math.PI ? x + TWO_PI : x;
  const c = fix(ang(pa), relA) - fix(ang(pb), relB);
  if (Math.abs(c) > 1e-12) return c;
  const k = d + (ka - kb) * delta / 2;
  return Math.abs(k) > 1e-15 ? k : ka - kb;
}
function segLength(g) {
  let l = 0, p = segAt(g, 0);
  for (let i = 1; i <= 64; i++) {
    const q2 = segAt(g, i / 64);
    l += Math.hypot(q2[0] - p[0], q2[1] - p[1]);
    p = q2;
  }
  return l;
}
function pointAlong(g, L) {
  let acc = 0, p = segAt(g, 0);
  for (let i = 1; i <= 64; i++) {
    const q2 = segAt(g, i / 64), d = Math.hypot(q2[0] - p[0], q2[1] - p[1]);
    if (acc + d >= L && d > 0) {
      const t = (L - acc) / d;
      return [p[0] + (q2[0] - p[0]) * t, p[1] + (q2[1] - p[1]) * t];
    }
    acc += d;
    p = q2;
  }
  return p;
}
function curveArrangementVertices(rings, tolerance) {
  return rings.length ? arrange(rings.map((ring) => ({ polygon: 0, ring })), tolerance).points : [];
}
function regions(arr, polygonCount) {
  const { points, edges, half, cycles, segOfHalf } = arr;
  const areaOf = (c) => c.reduce((a, h) => a + segArea(segOfHalf(h)), 0);
  const areas2 = cycles.map(areaOf), root = points.map((_, i) => i), find = (v) => {
    while (root[v] !== v) v = root[v] = root[root[v]];
    return v;
  };
  for (const e of edges) root[find(e.u)] = find(e.v);
  const comp = (c) => find(half[c[0]].from), sampled2 = cycles.map((c) => sampleRing(c.map(segOfHalf)));
  const faceOfCycle = cycles.map((c, i) => {
    if (areas2[i] > 0) return i;
    const p = points[half[c[0]].from], mine = comp(c);
    let best = -1, bestArea = Infinity;
    cycles.forEach((o, k) => {
      if (areas2[k] > 0 && comp(o) !== mine && areas2[k] < bestArea && pointInPolygon(p, sampled2[k])) {
        bestArea = areas2[k];
        best = k;
      }
    });
    return best;
  });
  const faceOfHalf = half.map((h) => faceOfCycle[h.face]), winding = /* @__PURE__ */ new Map([[-1, Array(polygonCount).fill(0)]]), queue = [-1];
  const halvesOf = /* @__PURE__ */ new Map();
  faceOfHalf.forEach((f, h) => halvesOf.set(f, [...halvesOf.get(f) ?? [], h]));
  while (queue.length) {
    const f = queue.shift(), w = winding.get(f);
    for (const h of halvesOf.get(f) ?? []) {
      const other = faceOfHalf[half[h].twin];
      if (winding.has(other)) continue;
      const e = edges[half[h].edge], fwd = half[h].from === e.u;
      winding.set(other, w.map((x, p) => x - (e.count.get(p) ?? 0) * (fwd ? 1 : -1)));
      queue.push(other);
    }
  }
  return { faceOfHalf, winding, faceOfCycle, areas: areas2 };
}
function simplify(ring, eps) {
  const sameCarrier = (s, t) => {
    if (s.tag !== t.tag) return false;
    if (s.kind === "line" && t.kind === "line") {
      const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]];
      return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) <= 1e-12 * Math.hypot(...d1) * Math.hypot(...d2) && d1[0] * d2[0] + d1[1] * d2[1] > 0;
    }
    if (s.kind === "arc" && t.kind === "arc") return Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1]) <= eps && Math.abs(s.r - t.r) <= eps && Math.sign(s.sweep) === Math.sign(t.sweep);
    if (s.kind === "curve" && t.kind === "curve") return s.f === t.f && s.t1 === t.t0 && Math.sign(s.t1 - s.t0) === Math.sign(t.t1 - t.t0);
    return false;
  };
  const out = [...ring];
  for (let changed = true; changed && out.length > 1; ) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const s = out[i], t = out[(i + 1) % out.length];
      if (!sameCarrier(s, t)) continue;
      const merged = s.kind === "line" ? { ...s, b: t.b } : s.kind === "curve" ? { ...s, t1: t.t1 } : { ...s, sweep: s.sweep + t.sweep };
      if (merged.kind === "arc" && Math.abs(merged.sweep) > Math.PI + 1e-12) continue;
      if (merged.kind === "curve" && halves(merged).length > 1) continue;
      out.splice(i, 1, merged);
      out.splice((i + 1) % out.length, 1);
      changed = true;
      break;
    }
  }
  return out;
}
function booleanCurveRegions(a, b, operation, tolerance, joinEnds = false) {
  const rings = [...a.map((ring) => ({ polygon: 0, ring })), ...b.map((ring) => ({ polygon: 1, ring }))];
  if (!rings.length) return [];
  const arr = arrange(rings, tolerance, joinEnds), { faceOfHalf, winding } = regions(arr, 2), { half, segOfHalf, eps } = arr;
  const pick = (w) => {
    const x = w[0] !== 0, y = w[1] !== 0;
    return operation === "union" ? x || y : operation === "intersection" ? x && y : operation === "difference" ? x && !y : x !== y;
  };
  const selected2 = /* @__PURE__ */ new Map();
  for (const [f, w] of winding) selected2.set(f, f !== -1 && pick(w));
  const boundary = (h) => !!selected2.get(faceOfHalf[h]) && !selected2.get(faceOfHalf[half[h].twin]);
  const used = /* @__PURE__ */ new Set(), traced2 = [];
  half.forEach((_, h) => {
    if (!boundary(h) || used.has(h)) return;
    const ring = [];
    let g = h;
    do {
      used.add(g);
      ring.push(segOfHalf(g));
      let n = half[g].next;
      while (!boundary(n)) n = half[half[n].twin].next;
      g = n;
    } while (g !== h && ring.length <= half.length);
    traced2.push(simplify(ring, eps));
  });
  const outers = traced2.filter((r) => ringArea(r) > 0).map((outer) => ({ outer, holes: [], sample: sampleRing(outer) }));
  for (const hole of traced2.filter((r) => ringArea(r) <= 0)) {
    const probe = sampleRing(hole);
    let best = -1, bestArea = Infinity;
    outers.forEach((o, k) => {
      const ar = ringArea(o.outer);
      if (ar < bestArea && probe.some((p) => pointInPolygon(p, o.sample)) && pointInPolygon(segAt(hole[0], 0.5), o.sample)) {
        bestArea = ar;
        best = k;
      }
    });
    if (best < 0) throw curvedArrangementError("a result hole has no enclosing ring");
    outers[best].holes.push(hole);
  }
  return outers.map((o) => ({ outer: o.outer, holes: o.holes }));
}
function regionMoments(region) {
  const m = [0, 0, 0, 0, 0, 0];
  const add4 = (x, y, dx, dy, w) => {
    m[0] += w * (x * dy - y * dx) / 2;
    m[1] += w * x * x * dy / 2;
    m[2] -= w * y * y * dx / 2;
    m[3] += w * x * x * x * dy / 3;
    m[4] -= w * y * y * y * dx / 3;
    m[5] += w * x * x * y * dy / 2;
  };
  for (const ring of [region.outer, ...region.holes]) for (const s of ring) {
    if (s.kind === "line") {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      for (const [u, w] of GL8) add4(s.a[0] + dx * u, s.a[1] + dy * u, dx, dy, w);
      continue;
    }
    if (s.kind === "curve") {
      for (let k = 0; k < 16; k++) for (const [u, w] of GL8) {
        const x = (k + u) / 16, p = segAt(s, x), a = segAt(s, Math.max(0, x - 1e-6)), b = segAt(s, Math.min(1, x + 1e-6)), du = Math.min(1, x + 1e-6) - Math.max(0, x - 1e-6);
        add4(p[0], p[1], (b[0] - a[0]) / du / 16, (b[1] - a[1]) / du / 16, w);
      }
      continue;
    }
    const pieces = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 8)));
    for (let k = 0; k < pieces; k++) for (const [u, w] of GL8) {
      const t = s.t0 + s.sweep * (k + u) / pieces, dt = s.sweep / pieces;
      add4(s.c[0] + s.r * Math.cos(t), s.c[1] + s.r * Math.sin(t), -s.r * Math.sin(t) * dt, s.r * Math.cos(t) * dt, w);
    }
  }
  return m;
}
function crossingsAt(rings, y) {
  const xs = [];
  const yAbove = y + 1e-12 * (1 + Math.abs(y));
  for (const ring of rings) for (let si = 0; si < ring.length; si++) {
    const g = ring[si], start = segEnd(ring[(si - 1 + ring.length) % ring.length]);
    const us = g.kind === "line" ? LINE_US : g.kind === "curve" ? DENSE_US : arcCuts(g);
    const dense3 = g.kind === "curve" ? denseSamples(g) : null;
    for (let k = 0; k + 1 < us.length; k++) {
      let lo = us[k], hi = us[k + 1];
      const a = lo === 0 ? start : dense3 ? dense3[k] : segAt(g, lo), b = hi === 0 ? start : dense3 ? dense3[k + 1] : segAt(g, hi);
      const aAbove = a[1] > yAbove;
      if (aAbove === b[1] > yAbove) continue;
      if (g.kind === "line") {
        xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
        continue;
      }
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        if (segAt(g, m)[1] > yAbove === aAbove) lo = m;
        else hi = m;
      }
      xs.push(segAt(g, (lo + hi) / 2)[0]);
    }
  }
  return xs;
}
function arcCuts(g) {
  const cuts = [0, 1];
  for (const t of [Math.PI / 2, -Math.PI / 2]) {
    const u = paramOf(g, [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]);
    if (u > 0 && u < 1) cuts.push(u);
  }
  return cuts.sort((a, b) => a - b);
}
function regionInteriorPoint(region) {
  const rings = [region.outer, ...region.holes];
  let y0 = Infinity, y1 = -Infinity;
  const extent = (g) => g.kind === "line" ? [g.a, g.b] : g.kind === "curve" ? polyline(g, CURVE_SAMPLES) : [segStart(g), segEnd(g), ...[[g.c[0], g.c[1] - g.r], [g.c[0], g.c[1] + g.r]].filter((p) => {
    const u = paramOf(g, p);
    return u >= 0 && u <= 1;
  })];
  for (const ring of rings) for (const g of ring) for (const p of extent(g)) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  let best = null, clearance = -1;
  for (const f of [0.5, 0.3819660112501051, 0.6180339887498949, 0.2360679774997897, 0.7639320225002103, 0.1458980337503155, 0.8541019662496845, 0.0901699437494742, 0.9098300562505258]) {
    const y = y0 + (y1 - y0) * f, xs = crossingsAt(rings, y).sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const p = [(xs[k] + xs[k + 1]) / 2, y];
      let d = Infinity;
      scan: for (const ring of rings) for (const g of ring) {
        if (g.kind === "curve") {
          const { lo, hi } = samples(g);
          if (Math.hypot(Math.max(lo[0] - p[0], 0, p[0] - hi[0]), Math.max(lo[1] - p[1], 0, p[1] - hi[1])) >= d) continue;
        }
        d = Math.min(d, segDistance(g, p));
        if (d <= clearance) break scan;
      }
      if (d > clearance) {
        clearance = d;
        best = p;
      }
    }
  }
  return best;
}

// packages/barocss-cad/src/features/prismatic-solid.ts
var prismaticSolidError = (detail) => kernelRefusal("prismatic-solid", "PRISMATIC_SOLID", "Prismatic solid: " + detail);
var ringsOf = (regions2) => regions2.flatMap((r) => [r.outer, ...r.holes]);
var allRings = (slabs) => slabs.flatMap((s) => ringsOf(s.regions));
function normalize(slabs, tolerance, caps = [], merged = false) {
  const sorted = slabs.filter((s) => s.regions.length).sort((a, b) => a.z0 - b.z0), out = [];
  for (const s of sorted) {
    if (!(Number.isFinite(s.z0) && Number.isFinite(s.z1) && s.z1 > s.z0)) throw prismaticSolidError("every slab needs finite z0 < z1");
    const prev = out[out.length - 1];
    if (prev && s.z0 < prev.z1) throw prismaticSolidError("slabs overlap in Z");
    if (!merged && prev && prev.z1 === s.z0 && !booleanCurveRegions(ringsOf(prev.regions), ringsOf(s.regions), "xor", tolerance).length) {
      out[out.length - 1] = { ...prev, z1: s.z1 };
      continue;
    }
    out.push(s);
  }
  const levels = new Set(out.flatMap((x) => [x.z0, x.z1])), kept = caps.filter((c) => levels.has(c.z));
  return { kind: "prismatic-solid", slabs: out, ...kept.length ? { caps: kept } : {} };
}
var reverseRing = (ring) => [...ring].reverse().map(segReverse);
function transformPrismatic(solid, transform3) {
  const [a, b, c, d] = transform3.matrix, [tx, ty] = transform3.offset ?? [0, 0], zs = transform3.zScale ?? 1, zo = transform3.zOffset ?? 0, det = a * d - b * c;
  const scale4 = Math.sqrt(Math.abs(det));
  if (!(scale4 > 0) || Math.abs(a * a + c * c - scale4 * scale4) > 1e-12 * scale4 * scale4 || Math.abs(b * b + d * d - scale4 * scale4) > 1e-12 * scale4 * scale4 || Math.abs(a * b + c * d) > 1e-12 * scale4 * scale4 || !(zs !== 0 && Number.isFinite(zs)))
    throw prismaticSolidError("the transform must be a similarity in XY with a nonzero Z scale");
  const map = (p) => [a * p[0] + b * p[1] + tx, c * p[0] + d * p[1] + ty];
  const retag = (x) => transform3.retag && x.tag !== void 0 ? { ...x, tag: typeof transform3.retag === "string" ? x.tag + transform3.retag : transform3.retag(x.tag) } : x;
  const seg = (s) => s.kind === "curve" ? noCurves() : retag(s.kind === "line" ? { ...s, a: map(s.a), b: map(s.b) } : { ...s, c: map(s.c), r: s.r * scale4, t0: Math.atan2(c * Math.cos(s.t0) + d * Math.sin(s.t0), a * Math.cos(s.t0) + b * Math.sin(s.t0)), sweep: s.sweep * Math.sign(det) });
  const ring = (r) => det > 0 ? r.map(seg) : reverseRing(r.map(seg));
  const region = (r) => ({ outer: ring(r.outer), holes: r.holes.map(ring) });
  const z = (v) => zs * v + zo;
  const slabs = solid.slabs.map((s) => ({ z0: Math.min(z(s.z0), z(s.z1)), z1: Math.max(z(s.z0), z(s.z1)), regions: s.regions.map(region) }));
  const caps = (solid.caps ?? []).map((cp) => ({ z: z(cp.z), regions: cp.regions.map(region), tag: typeof transform3.retag === "string" ? cp.tag + transform3.retag : transform3.retag ? transform3.retag(cp.tag) : cp.tag }));
  return normalize(slabs, 0, caps, true);
}
var inRegion = (p, r) => pointInPolygon(p, sampleRing(r.outer, Math.PI / 720)) && !r.holes.some((h) => pointInPolygon(p, sampleRing(h, Math.PI / 720)));
var PointSet = class {
  constructor(eps) {
    this.eps = eps;
    this.cell = eps * 64;
  }
  points = [];
  grid = /* @__PURE__ */ new Map();
  cell;
  find(p) {
    const gx = Math.floor(p[0] / this.cell), gy = Math.floor(p[1] / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const v of this.grid.get(gx + i + "," + (gy + j)) ?? []) if (Math.hypot(this.points[v][0] - p[0], this.points[v][1] - p[1]) <= this.eps) return v;
    return -1;
  }
  add(p) {
    const f = this.find(p);
    if (f >= 0) return f;
    const v = this.points.length, k = Math.floor(p[0] / this.cell) + "," + Math.floor(p[1] / this.cell);
    this.points.push([p[0], p[1]]);
    this.grid.set(k, [...this.grid.get(k) ?? [], v]);
    return v;
  }
};
var noCurves = () => {
  throw prismaticSolidError("prismatic sections are made of lines and arcs");
};
var profileSegment = (s, start, end) => s.kind === "curve" ? noCurves() : s.kind === "line" ? { kind: "line", start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) } : { kind: "arc", start, end, center: s.c, radius: s.r, startAngle: s.t0, sweep: s.sweep, length: Math.abs(s.sweep) * s.r };
function brepFromPrismatic(solid, options = {}) {
  const id2 = options.id ?? "prismatic", slabs = solid.slabs;
  if (!slabs.length) throw new BrepError("INPUT", "a prismatic solid without slabs has no B-rep");
  const tol = curveTolerance(allRings(slabs));
  const levels = [...new Set(slabs.flatMap((s) => [s.z0, s.z1]))].sort((x, y) => x - y);
  const ringsAt = (z, side) => ringsOf(slabs.find((s) => (side === "below" ? s.z1 : s.z0) === z)?.regions ?? []);
  const set = new PointSet(tol);
  const caps = levels.map((z) => {
    const below = ringsAt(z, "below"), above = ringsAt(z, "above");
    for (const p of curveArrangementVertices([...below, ...above], tol)) set.add(p);
    return { up: below.length ? booleanCurveRegions(below, above, "difference", tol) : [], down: above.length ? booleanCurveRegions(above, below, "difference", tol) : [] };
  });
  for (const c of caps) for (const ring of ringsOf([...c.up, ...c.down])) for (const s of ring) {
    set.add(segStart(s));
    set.add(segEnd(s));
  }
  const P = set.points;
  const pieces = [], between = /* @__PURE__ */ new Map();
  const piece = (seg, a, b) => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo + ":" + hi, list2 = between.get(key) ?? [], mid = segAt(seg, 0.5);
    let k = list2.find((i) => segDistance(pieces[i].seg, mid) <= 4 * tol);
    if (k === void 0) {
      k = pieces.length;
      pieces.push({ seg: a === lo ? seg : segReverse(seg), lo, hi });
      list2.push(k);
      between.set(key, list2);
    }
    return { piece: k, forward: a === lo };
  };
  const split = (ring) => ring.flatMap((s) => {
    const a = set.find(segStart(s)), b = set.find(segEnd(s));
    if (a < 0 || b < 0) throw new BrepError("GEOMETRY", "a ring vertex is missing from the arrangement");
    const stops = [{ u: 0, v: a }];
    P.forEach((p, v) => {
      if (v === a || v === b || segDistance(s, p) > tol) return;
      const u = paramOf(s, p);
      if (u > 0 && u < 1) stops.push({ u, v });
    });
    stops.sort((x, y) => x.u - y.u);
    stops.push({ u: 1, v: b });
    const out = [];
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1];
      if (s0.v === s1.v) continue;
      const sub3 = s.kind === "line" ? { ...s, a: P[s0.v], b: P[s1.v] } : s.kind === "arc" ? { ...s, t0: s.t0 + s.sweep * s0.u, sweep: s.sweep * (s1.u - s0.u) } : noCurves();
      out.push({ ...piece(sub3, s0.v, s1.v), tag: s.tag });
    }
    return out;
  });
  const curveOf = (k, z, cid) => {
    const pc2 = pieces[k];
    return segmentCurve(profileSegment(pc2.seg, P[pc2.lo], P[pc2.hi]), z, cid);
  };
  const faces = [], pc = (a, b) => lineCurve("pcurve", a, b);
  const hKey = (k, level) => `h${k}_${level}`, vtx = (p, level) => `${p}_${level}`;
  const hUse = (k, forward, level, face, tag, pcurve) => {
    const s = vtx(pieces[k].lo, level), e = vtx(pieces[k].hi, level);
    return { key: hKey(k, level), sense: forward ? "forward" : "reversed", pcurve, face, tag, start: forward ? s : e, end: forward ? e : s };
  };
  const struts = /* @__PURE__ */ new Map();
  const cells = /* @__PURE__ */ new Map();
  slabs.forEach((slab, si) => {
    const iLo = levels.indexOf(slab.z0), iHi = levels.indexOf(slab.z1);
    slab.regions.forEach((region, ri) => [region.outer, ...region.holes].forEach((ring, gi) => {
      const parts = split(ring), n = parts.length;
      const startOf = (j) => parts[j % n].forward ? pieces[parts[j % n].piece].lo : pieces[parts[j % n].piece].hi;
      const strut = (j) => {
        const key = `s${si}_${ri}_${gi}_${j % n}`;
        struts.set(key, { p: startOf(j), lo: iLo, hi: iHi });
        return key;
      };
      parts.forEach(({ piece: k, forward, tag }, j) => {
        const list2 = cells.get(k + ":" + forward) ?? [];
        list2.push({ si, k, forward, sStart: strut(j), sEnd: strut(j + 1), pStart: startOf(j), pEnd: startOf(j + 1), cell: `${si}_${ri}_${gi}_${j}`, tag });
        cells.set(k + ":" + forward, list2);
      });
    }));
  });
  for (const list2 of cells.values()) {
    list2.sort((a, b) => a.si - b.si);
    const runs = [];
    for (const c of list2) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1].si === c.si - 1 && slabs[c.si - 1].z1 === slabs[c.si].z0) last.push(c);
      else runs.push([c]);
    }
    for (const run of runs) {
      const { k, forward } = run[0], za = slabs[run[0].si].z0, zb = slabs[run[run.length - 1].si].z1, iLo = levels.indexOf(za), iHi = levels.indexOf(zb);
      const f = faces.length, uEnd = forward ? 1 : 0, uStart = 1 - uEnd, fid = `${id2}_w${run[0].cell}`, mid = segAt(pieces[k].seg, 0.5);
      const strutUse = (key, up, u) => {
        const st = struts.get(key), lo = vtx(st.p, st.lo), hi = vtx(st.p, st.hi);
        return { key, sense: up ? "forward" : "reversed", pcurve: null, u, face: f, tag: "strut", start: up ? lo : hi, end: up ? hi : lo };
      };
      const loop = [
        hUse(k, forward, iLo, f, "upperWall", pc([0, 0, 0], [1, 0, 0])),
        ...run.map((c) => strutUse(c.sEnd, true, uEnd)),
        hUse(k, !forward, iHi, f, "lowerWall", pc([0, 1, 0], [1, 1, 0])),
        ...[...run].reverse().map((c) => strutUse(c.sStart, false, uStart))
      ];
      faces.push({
        id: fid,
        surface: extrudedSurface(curveOf(k, za, fid), za, zb, fid),
        sense: forward ? "forward" : "reversed",
        loops: [{ kind: "outer", uses: loop }],
        volume: 0,
        wall: { za, zb },
        base: run[0].tag ?? `${id2}.wall`,
        key: [mid[0], mid[1], (za + zb) / 2]
      });
    }
  }
  caps.forEach((c, level) => {
    const z = levels[level];
    for (const [up, regions2] of [[true, c.up], [false, c.down]]) regions2.forEach((region, n) => {
      const f = faces.length, fid = `${id2}_${up ? "u" : "d"}${level}_${n}`;
      const rings = [region.outer, ...region.holes].map((r) => {
        const parts = split(r);
        return up ? parts : [...parts].reverse().map((x) => ({ piece: x.piece, forward: !x.forward }));
      });
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const ring of rings) for (const { piece: k } of ring) for (const q3 of curveOf(k, z, "b").controlPoints) {
        x0 = Math.min(x0, q3[0]);
        y0 = Math.min(y0, q3[1]);
        x1 = Math.max(x1, q3[0]);
        y1 = Math.max(y1, q3[1]);
      }
      const uv = (q3) => up ? [(q3[0] - x0) / (x1 - x0), (q3[1] - y0) / (y1 - y0), 0] : [(q3[1] - y0) / (y1 - y0), (q3[0] - x0) / (x1 - x0), 0];
      const loops = rings.map((ring, g) => ({ kind: g === 0 ? "outer" : "inner", uses: ring.map(({ piece: k, forward }) => {
        const e = curveOf(k, z, "p");
        return hUse(k, forward, level, f, up ? "upFace" : "downFace", { ...e, id: "pcurve", controlPoints: e.controlPoints.map(uv) });
      }) }));
      const q2 = interiorPoint(region), source = (solid.caps ?? []).find((cp) => cp.z === z && cp.regions.some((r) => inRegion(q2, r)));
      faces.push({
        id: fid,
        surface: capSurface({ min: [x0, y0], max: [x1, y1] }, z, fid, up),
        sense: "forward",
        loops,
        volume: (up ? 1 : -1) * regionArea(region) * z,
        cap: { region, z },
        base: source?.tag ?? `${id2}.${up ? "top" : "bottom"}`,
        key: [q2[0], q2[1], z]
      });
    });
  });
  const uses = faces.flatMap((f) => f.loops.flatMap((l) => l.uses)), byKey = /* @__PURE__ */ new Map();
  for (const u of uses) byKey.set(u.key, [...byKey.get(u.key) ?? [], u]);
  for (const [key, list2] of byKey) {
    if (list2.length === 4) {
      const tags = new Set(list2.map((u) => u.tag));
      if (tags.size !== 4) throw new BrepError("TOPOLOGY", `edge ${key} has four uses that are not two wedges`);
      for (const u of list2) u.key = key + (u.tag === "lowerWall" || u.tag === "upFace" ? "a" : "b");
    } else if (list2.length !== 2) throw new BrepError("TOPOLOGY", `edge ${key} has ${list2.length} uses`);
  }
  const edgeUses = /* @__PURE__ */ new Map();
  for (const u of uses) edgeUses.set(u.key, [...edgeUses.get(u.key) ?? [], u]);
  for (const [key, list2] of edgeUses) if (list2.length !== 2 || list2[0].sense === list2[1].sense) throw new BrepError("TOPOLOGY", `edge ${key} is not used once in each direction`);
  const parent = /* @__PURE__ */ new Map(), find = (x) => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r);
    parent.set(x, r);
    return r;
  };
  const at2 = (v, e) => v + "|" + e, unite = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const f of faces) for (const l of f.loops) l.uses.forEach((u, k) => {
    const n = l.uses[(k + 1) % l.uses.length];
    unite(at2(u.end, u.key), at2(n.start, n.key));
  });
  const discEdges = /* @__PURE__ */ new Map();
  for (const u of uses) {
    u.startRoot = find(at2(u.start, u.key));
    u.endRoot = find(at2(u.end, u.key));
    for (const r of [u.startRoot, u.endRoot]) discEdges.set(r, (discEdges.get(r) ?? /* @__PURE__ */ new Set()).add(u.key));
  }
  const sroot = /* @__PURE__ */ new Map(), sfind = (x) => {
    let r = x;
    while (sroot.has(r) && sroot.get(r) !== r) r = sroot.get(r);
    return r;
  };
  for (const keys of discEdges.values()) {
    const [a, b] = [...keys];
    if (keys.size !== 2 || !a.startsWith("s") || !b.startsWith("s")) continue;
    const ra = sfind(a), rb = sfind(b);
    if (ra === rb) continue;
    sroot.set(ra, rb);
    const A = struts.get(ra), B = struts.get(rb);
    struts.set(rb, { p: B.p, lo: Math.min(A.lo, B.lo), hi: Math.max(A.hi, B.hi) });
  }
  for (const f of faces) for (const l of f.loops) {
    const out = [];
    for (const u of l.uses) {
      const key = u.key.startsWith("s") ? sfind(u.key) : u.key, prev = out[out.length - 1];
      if (prev && prev.key === key && key.startsWith("s")) {
        prev.end = u.end;
        prev.endRoot = u.endRoot;
        continue;
      }
      out.push({ ...u, key });
    }
    l.uses = out;
  }
  for (const f of faces) for (const l of f.loops) for (const u of l.uses) if (u.tag === "strut") {
    const st = struts.get(u.key), w = f.wall, v = (level) => (levels[level] - w.za) / (w.zb - w.za);
    u.pcurve = pc([u.u, v(st.lo), 0], [u.u, v(st.hi), 0]);
  }
  const finalUses = /* @__PURE__ */ new Map();
  for (const f of faces) for (const l of f.loops) for (const u of l.uses) finalUses.set(u.key, [...finalUses.get(u.key) ?? [], u]);
  const vertexIds = /* @__PURE__ */ new Map(), vertices = [];
  const vertexOf = (v, root) => {
    let vid = vertexIds.get(root);
    if (!vid) {
      vid = `${id2}_v${vertices.length}`;
      vertexIds.set(root, vid);
      const [p, level] = v.split("_").map(Number);
      vertices.push({ id: vid, point: [P[p][0], P[p][1], levels[level]] });
    }
    return vid;
  };
  nameFaces(faces);
  const edgeIds = /* @__PURE__ */ new Map(), edges = [];
  const edgeBase = (list2) => [...new Set(list2.map((u) => faces[u.face].name))].sort().join("|");
  for (const [key, list2] of finalUses) {
    const fwd = list2.find((u) => u.sense === "forward"), eid = `${id2}_e${edges.length}`;
    edgeIds.set(key, eid);
    let curve;
    if (key.startsWith("s")) {
      const s = struts.get(key);
      curve = lineCurve(eid, [P[s.p][0], P[s.p][1], levels[s.lo]], [P[s.p][0], P[s.p][1], levels[s.hi]]);
    } else {
      const [k, level] = key.slice(1).replace(/[ab]$/, "").split("_").map(Number);
      curve = curveOf(k, levels[level], eid);
    }
    edges.push({ id: eid, curve, vertices: [vertexOf(fwd.start, fwd.startRoot), vertexOf(fwd.end, fwd.endRoot)], name: edgeBase(list2) });
  }
  nameEdges(edges);
  const extent = P.reduce((m, q2) => Math.max(m, Math.abs(q2[0]), Math.abs(q2[1])), 1), rho = Math.max(1e-4 * extent, 1e3 * tol);
  for (const f of faces) {
    if (!f.cap) continue;
    const at3 = /* @__PURE__ */ new Map();
    for (const l of f.loops) for (const u of l.uses) {
      const p = Number(u.start.split("_")[0]), ids2 = at3.get(p) ?? /* @__PURE__ */ new Set();
      ids2.add(vertexOf(u.start, u.startRoot));
      at3.set(p, ids2);
    }
    for (const [p, ids2] of at3) if (ids2.size > 1 && materialAround(f.cap.region, P[p], rho) > 0.5)
      throw new BrepError("GEOMETRY", `the solid touches itself along the vertical line at (${P[p].map((x) => +x.toFixed(4))}): two of its walls meet there from outside each other`);
  }
  const froot = faces.map((_, i) => i), ff = (i) => {
    while (froot[i] !== i) i = froot[i] = froot[froot[i]];
    return i;
  };
  for (const list2 of finalUses.values()) froot[ff(list2[0].face)] = ff(list2[1].face);
  const shells = /* @__PURE__ */ new Map();
  faces.forEach((_, i) => shells.set(ff(i), [...shells.get(ff(i)) ?? [], i]));
  const groups = [...shells.values()].map((fs) => ({ faces: fs, volume: fs.reduce((v, i) => v + faces[i].volume, 0) }));
  const outers = groups.filter((g) => g.volume > 0), bodies = outers.map((g) => ({ outer: g, cavities: [] }));
  for (const cavity of groups.filter((g) => g.volume <= 0)) {
    const cap = faces[cavity.faces.find((i) => faces[i].cap)].cap, q2 = interiorPoint(cap.region);
    let best = -1;
    bodies.forEach((b, k) => {
      const crossings = b.outer.faces.filter((i) => {
        const c = faces[i].cap;
        return c && c.z > cap.z && inRegion(q2, c.region);
      }).length;
      if (crossings % 2 === 1 && (best < 0 || b.outer.volume < bodies[best].outer.volume)) best = k;
    });
    if (best < 0) throw new BrepError("TOPOLOGY", "a cavity shell lies in no body");
    bodies[best].cavities.push(cavity);
  }
  const faceInput = (i) => ({
    id: faces[i].id,
    name: faces[i].name,
    surface: faces[i].surface,
    sense: faces[i].sense,
    loops: faces[i].loops.map((l) => ({ kind: l.kind, uses: l.uses.map((u) => ({ edge: edgeIds.get(u.key), sense: u.sense, pcurve: u.pcurve })) }))
  });
  return buildBrep({
    source: { family: "prismatic-solid", id: id2 },
    vertices,
    edges,
    bodies: bodies.map((b, k) => ({ id: `${id2}_b${k}`, kind: "solid", shells: [b.outer, ...b.cavities].map((g, s) => ({ id: `${id2}_b${k}_s${s}`, faces: g.faces.map(faceInput), closed: true })) })),
    tolerance: Math.max(tol, 1e-9)
  });
}
var byPosition = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function nameFaces(faces) {
  const groups = /* @__PURE__ */ new Map();
  for (const f of faces) groups.set(f.base, [...groups.get(f.base) ?? [], f]);
  for (const [base, list2] of groups) {
    if (list2.length === 1) {
      list2[0].name = base;
      continue;
    }
    [...list2].sort((a, b) => byPosition(a.key, b.key)).forEach((f, k) => {
      f.name = `${base}#${k + 1}`;
    });
  }
}
function nameEdges(edges) {
  const groups = /* @__PURE__ */ new Map();
  for (const e of edges) groups.set(e.name, [...groups.get(e.name) ?? [], e]);
  const mid = (c) => {
    const p = c.controlPoints, a = p[0], b = p[p.length - 1], m = p[Math.floor(p.length / 2)];
    return [(a[0] + b[0] + m[0]) / 3, (a[1] + b[1] + m[1]) / 3, (a[2] + b[2] + m[2]) / 3];
  };
  for (const [base, list2] of groups) if (list2.length > 1) [...list2].sort((a, b) => byPosition(mid(a.curve), mid(b.curve))).forEach((e, k) => {
    e.name = `${base}#${k + 1}`;
  });
}
function materialAround(region, p, rho) {
  let n = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k + 0.5) * Math.PI / 8;
    if (inRegion([p[0] + rho * Math.cos(a), p[1] + rho * Math.sin(a)], region)) n++;
  }
  return n / 16;
}
function interiorPoint(region) {
  const p = regionInteriorPoint(region);
  if (!p) throw new BrepError("GEOMETRY", "a region has no interior");
  return p;
}

// packages/barocss-cad/src/brep/polyhedral-boolean.ts
var babs = (a) => a < 0n ? -a : a;
var bgcd = (a, b) => {
  a = babs(a);
  b = babs(b);
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
};
var q = (n, d = 1n) => {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
function qf(v) {
  if (!Number.isFinite(v)) throw new BrepError("INPUT", "finite coordinates required");
  const { m, k } = binary64Dyadic(v);
  return q(m, 1n << BigInt(k));
}
var num = (a) => Number(a.n) / Number(a.d);
var vnum = (a) => [num(a[0]), num(a[1]), num(a[2])];
var RAYS = [[0.5773, 0.3419, 0.7413], [-0.2183, 0.8817, 0.4127], [0.6631, -0.5279, 0.3011], [-0.4421, -0.3137, 0.8401], [0.1931, 0.7349, -0.6503]].map((r) => r.map(qf));
var RAYS_F = RAYS.map(vnum);

// packages/barocss-cad/src/brep/analytic-boolean.ts
var TWO_PI2 = 2 * Math.PI;
var CACHE_BITS = 16;
var cacheX = new Float64Array(1 << CACHE_BITS);
var cacheId = new Int32Array(1 << CACHE_BITS);
var cacheP = new Array(1 << CACHE_BITS);
var bitsF = new Float64Array(1);
var bitsU = new Uint32Array(bitsF.buffer);
var RAYS2 = [[0.5377, 0.3138, 0.7832], [-0.2961, 0.8573, 0.4213], [0.6993, -0.5126, 0.4982], [-0.4436, -0.3714, 0.8155], [0.1172, 0.9563, -0.2677], [0.8811, 0.2219, -0.4175]].map((v) => unit(v));

// packages/barocss-cad/src/machine/gear-bevel.ts
var ALPHA = 20 * Math.PI / 180;
var PRODUCT = [];
for (let k = 0; k <= 4; k++) {
  const row = [];
  for (let i = 0; i <= 2; i++) {
    const j = k - i;
    row.push(j < 0 || j > 2 ? 0 : [1, 2, 1][i] * [1, 2, 1][j] / [1, 4, 6, 4, 1][k]);
  }
  PRODUCT.push(row);
}

// packages/barocss-cad/src/machine/gear-worm.ts
var ALPHA_N = 20 * Math.PI / 180;

// packages/barocss-cad/src/internal/native-si-mass-state.ts
var bases = /* @__PURE__ */ new WeakMap();
var results = /* @__PURE__ */ new WeakMap();
function recordIntegralMass(props, density, central) {
  bases.set(props, { kind: "integrals", density, central: Object.freeze([...central]) });
}
function transferNativeMassBasis(from, to) {
  const basis3 = bases.get(from);
  if (basis3) bases.set(to, basis3);
}
function unsupportedNativeMass(props, reason) {
  bases.set(props, { kind: "unsupported", reason });
  return props;
}
function readNativeSIInertia(props) {
  const cached = results.get(props);
  if (cached) return cached;
  const basis3 = bases.get(props);
  if (!basis3 || basis3.kind === "unsupported") return { ok: false, code: "NATIVE_SI_PROVENANCE_UNAVAILABLE", reason: basis3?.reason ?? "untracked" };
  const [xx, yy, zz, xy, xz, yz] = basis3.central;
  const k = basis3.density * 1e3 * 1e-15;
  const inertia2 = Object.freeze([
    Object.freeze([k * (yy + zz), -k * xy, -k * xz]),
    Object.freeze([-k * xy, k * (xx + zz), -k * yz]),
    Object.freeze([-k * xz, -k * yz, k * (xx + yy)])
  ]);
  const result = Object.freeze({ ok: true, inertia: inertia2, density: basis3.density });
  results.set(props, result);
  return result;
}

// packages/barocss-cad/src/core/quadrature.ts
function gauss(n) {
  const x = [], w = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      d = n * (t * p1 - p0) / (t * t - 1);
      const dx = p1 / d;
      t -= dx;
      if (Math.abs(dx) < 1e-16) break;
    }
    x.push((1 - t) / 2);
    w.push(1 / ((1 - t * t) * d * d));
  }
  return { x, w };
}

// packages/barocss-cad/src/brep/brep-mass-quadrature.ts
var RULE = (() => {
  const out = [[1 / 3, 1 / 3, 1 / 3, 0.144315607677787]];
  const orbit = (a, w) => {
    const b = (1 - a) / 2;
    out.push([a, b, b, w], [b, a, b, w], [b, b, a, w]);
  };
  orbit(0.081414823414554, 0.095091634267285);
  orbit(0.65886138449648, 0.103217370534718);
  orbit(0.898905543365938, 0.032458497623198);
  const six = (a, b, w) => {
    const c = 1 - a - b;
    out.push([a, b, c, w], [a, c, b, w], [b, a, c, w], [b, c, a, w], [c, a, b, w], [c, b, a, w]);
  };
  six(0.008394777409958, 0.263112829634638, 0.027230314174435);
  return out;
})();
var G4 = gauss(4);
var G12 = gauss(12);
var ST = gauss(8);
var SS = gauss(4);
var stripC = new Float64Array(16);
var stripD = new Float64Array(16);
var stripI = Array(10).fill(0);
var stripE = new Float64Array(24);
var stripT = new Float64Array(24);

// packages/barocss-cad/src/brep/solid-mass.ts
var solidMassError = (detail) => kernelRefusal("solid-mass", "SOLID_MASS", "Mass properties: " + detail);
function solidMassFromIntegrals(I, density, method) {
  if (!(typeof density === "number" && Number.isFinite(density) && density > 0)) throw solidMassError("a positive finite density is required");
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I;
  if (!(V > 0)) throw solidMassError("the solid has no positive volume");
  const c = [X / V, Y / V, Z / V], k = density * 1e-3;
  const xx = XX - V * c[0] * c[0], yy = YY - V * c[1] * c[1], zz = ZZ - V * c[2] * c[2];
  const xy = XY - V * c[0] * c[1], xz = XZ - V * c[0] * c[2], yz = YZ - V * c[1] * c[2];
  const props = {
    volume: V,
    mass: density * V * 1e-3,
    centroid: c,
    method,
    inertia: [[k * (yy + zz), -k * xy, -k * xz], [-k * xy, k * (xx + zz), -k * yz], [-k * xz, -k * yz, k * (xx + yy)]]
  };
  recordIntegralMass(props, density, [xx, yy, zz, xy, xz, yz]);
  return props;
}
function prismaticMassProperties(solid, density) {
  const I = Array(10).fill(0);
  for (const s of solid.slabs) {
    const h = s.z1 - s.z0;
    const h2 = h * (s.z0 / 2 + s.z1 / 2), h3 = h * (s.z0 * s.z0 + s.z0 * s.z1 + s.z1 * s.z1) / 3;
    for (const r of s.regions) {
      const [A, Sx, Sy, Sxx, Syy, Sxy] = regionMoments(r);
      I[0] += A * h;
      I[1] += Sx * h;
      I[2] += Sy * h;
      I[3] += A * h2;
      I[4] += Sxx * h;
      I[5] += Syy * h;
      I[6] += A * h3;
      I[7] += Sxy * h;
      I[8] += Sx * h2;
      I[9] += Sy * h2;
    }
  }
  return solidMassFromIntegrals(I, density, "closed-form");
}
var faceScratch = new Float64Array(10);

// packages/barocss-cad/src/brep/brep-transform.ts
function transformBrep(brep, map, rename) {
  const m = map.matrix, t = map.offset ?? [0, 0, 0];
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (!(Number.isFinite(det) && det !== 0)) throw new BrepError("INPUT", "an invertible finite affine map is required");
  const at2 = (p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]];
  const curve = (c) => ({ ...c, controlPoints: c.controlPoints.map(at2) });
  const identity4 = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 1 && m[5] === 0 && m[6] === 0 && m[7] === 0 && m[8] === 1 && t[0] === 0 && t[1] === 0 && t[2] === 0;
  const surface = (s) => s.kind === "facets" ? identity4 ? s : transformFacetPatch(s, m, t) : { ...s, controlPoints: s.controlPoints.map((row) => row.map(at2)) };
  const flip = det < 0, nameOf = (x) => rename && x.name !== void 0 ? { name: typeof rename === "string" ? x.name + rename : rename(x.name) } : {};
  const loops = brep.loops.map((l) => flip ? { ...l, coedges: [...l.coedges].reverse() } : l);
  const coedges = brep.coedges.map((c) => flip ? { ...c, sense: c.sense === "forward" ? "reversed" : "forward", next: c.prev, prev: c.next } : c);
  const faces = brep.faces.map((f) => ({ ...f, surface: surface(f.surface), ...flip ? { sense: f.sense === "forward" ? "reversed" : "forward" } : {}, ...nameOf(f) }));
  return {
    ...brep,
    faces,
    loops,
    coedges,
    edges: brep.edges.map((e) => ({ ...e, curve: curve(e.curve), ...nameOf(e) })),
    vertices: brep.vertices.map((v) => ({ ...v, point: at2(v.point) }))
  };
}

// packages/barocss-cad/src/features/profile-relief.ts
var ROUND = 64 * Number.EPSILON;

// packages/barocss-cad/src/features/cylindrical-wrap-map.ts
var SCALE = 1n << 128n;
var LIMITS = Object.freeze({ intervals: 256, depth: 8, taylorTerms: 24, intervalBits: 128, work: 1048576, rationalOperations: 2e5, rationalGcdSteps: 2e5, rationalIntegerBits: 8192, fractionCharacters: 5e3, floatSearchStepsPerConversion: 64 });
var CARRIER_LIMITS = Object.freeze({ work: LIMITS.work, rationalOperations: LIMITS.rationalOperations, rationalGcdSteps: LIMITS.rationalGcdSteps, rationalIntegerBits: LIMITS.rationalIntegerBits, fractionCharacters: LIMITS.fractionCharacters, floatSearchStepsPerConversion: LIMITS.floatSearchStepsPerConversion });

// packages/barocss-cad/src/core/native-d0-bound.ts
var SCALE2 = 1n << 128n;
var FAMILY_FLOAT = new DataView(new ArrayBuffer(8));
var FAMILY_MINIMUM = 2 ** -128;

// packages/barocss-cad/src/features/cylindrical-wrap-chart.ts
var CHART_LIMITS = Object.freeze({ operations: 2e5, integerBits: 8192, work: 1048576, curves: 2, nodes: 256, depth: 8 });
var LOOP_CHART_LIMITS = Object.freeze({ ...CHART_LIMITS, curves: 32 });

// packages/barocss-cad/src/features/cylindrical-wrap-chart-component.ts
var MEANING = Object.freeze({
  projection: "Y-over-X-and-world-Z",
  guarantee: "exact-stored-projected-component-boundary",
  projectedLoopEmbeddingCertified: true,
  projectedComponentContainmentCertified: true,
  representativeRule: "one-owned-vertex-after-complete-boundary-separation",
  hintMeaning: "individual-ring-interior-and-orientation-only",
  sourceCarrierCertified: false,
  originalNativeUVBindingCertified: false,
  topologyCertified: false,
  solidQualified: false,
  representedVolumeCertified: false,
  globalNativeEvaluatorErrorCertified: false,
  generalTextSupported: false,
  combinedConstructionBudgetCertified: false
});

// packages/barocss-cad/src/features/cylindrical-wrap-side-family.ts
var MEANING2 = Object.freeze({
  guarantee: "exact-stored-factor2-radial-side-family-embedding",
  projection: "Y-over-X-and-world-Z",
  exactCoefficientBinding: true,
  sideFamilyEmbeddingCertified: true,
  regularSidesCertified: true,
  nonadjacentSidesDisjoint: true,
  adjacentSidesShareOnlyPrescribedRadialEdge: true,
  sourceCarrierCertified: false,
  originalNativeUVBindingCertified: false,
  retainedFaceClosureCertified: false,
  topologyCertified: false,
  physicalBrepCertified: false,
  solidQualified: false,
  representedVolumeCertified: false,
  globalNativeEvaluatorErrorCertified: false,
  generalTextSupported: false,
  combinedConstructionBudgetCertified: false
});

// packages/barocss-cad/src/features/cylindrical-wrap-formal-mass.ts
var SCALE3 = 1n << 128n;
var MIDPOINT_DENOMINATOR = Number(SCALE3 << 1n);
var MIDPOINT_MINIMUM = 1 / MIDPOINT_DENOMINATOR;
var MIDPOINT_MAXIMUM = Number(1n << 127n);
var ORDER = Object.freeze(["V", "X", "Y", "Z", "XX", "YY", "ZZ", "XY", "XZ", "YZ"]);
var LIMITS2 = Object.freeze({ operations: 2e5, integerBits: 8192, work: 1048576, fractionBits: 128, atanTerms: 24, ratioReductions: 3 });

// packages/barocss-cad/src/features/cylindrical-wrap-bound-reference.ts
var MEANING3 = Object.freeze({
  sourceIdentity: "same-owned-frozen-part-two-synchronous-fresh-checks",
  sourceChecks: 2,
  sourceCosts: "both-complete-child-costs-counted",
  nativePositionBindingCertified: true,
  formalReferenceMassOnly: true,
  closedReferenceCertified: false,
  physicalBrepCertified: false,
  retainedFaceClosureCertified: false,
  representedVolumeCertified: false,
  partMassProvider: false,
  productFeature: false
});
var SHARED_MEANING = Object.freeze({
  ...MEANING3,
  sourceIdentity: "one-owned-frozen-native-source-live-continuation",
  sourceChecks: 1,
  sourceCosts: "one-actual-execution-counted-in-native-parent"
});

// packages/barocss-cad/src/features/cylindrical-wrap-source-walls.ts
var MEANING4 = Object.freeze({
  source: "actual-fresh-formal-source-with-complete-reference-cost",
  originalWallCycleCertified: true,
  originalWallEmbeddingCertified: true,
  originalWallOutwardOrientationCertified: true,
  originalHorizontalBoundaryOwnershipCertified: true,
  coefficientRadialBoundCoversAllSourceWalls: true,
  capTrimEmbeddingCertified: false,
  sourceShellCertified: false,
  closedReferenceCertified: false,
  retainedFaceClosureCertified: false,
  physicalBrepCertified: false,
  representedVolumeCertified: false,
  radialErrorIncludedInMass: false,
  partMassProvider: false,
  productFeature: false
});

// packages/barocss-cad/src/features/cylindrical-wrap-reference-mass.ts
var SCALE4 = 1n << 128n;
var NEGATIVE_SCALE = -SCALE4;

// packages/barocss-cad/src/features/cylindrical-wrap-feature.ts
var BUDGETS = Object.freeze({
  volume: 1e-8,
  mass: 1e-10,
  centroid: Object.freeze([1e-10, 1e-10, 1e-10]),
  inertia: Object.freeze([1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7])
});

// packages/barocss-cad/src/exact-proof/exact-binary64-orientation-v1.ts
var view2 = new DataView(new ArrayBuffer(8));

// packages/barocss-cad/src/exact-proof/native-planar-loop-qualification-v1.ts
var view3 = new DataView(new ArrayBuffer(8));

// packages/barocss-cad/src/features/quadratic-cut-arithmetic.ts
var FRACTION = (1n << 52n) - 1n;
var HIDDEN = 1n << 52n;

// packages/barocss-cad/src/io/step-import.ts
var TAU3 = 2 * Math.PI;
var TESSELLATED_RECORDS = ["COORDINATES_LIST(", "TRIANGULATED_FACE("];
function stepTessellatedChars(source) {
  let total = 0;
  for (const word of TESSELLATED_RECORDS) {
    for (let at2 = source.indexOf(word); at2 >= 0; at2 = source.indexOf(word, at2)) {
      const end = source.indexOf(";", at2);
      if (end < 0) {
        total += source.length - at2;
        break;
      }
      total += end - at2;
      at2 = end;
    }
  }
  return total;
}

// packages/barocss-cad/src/features/loft.ts
var G3 = gauss(3);
var G42 = gauss(4);
var G6 = gauss(6);
var G24 = gauss(24);

// packages/barocss-cad/src/machine/cam.ts
var MT_A = 8 * Math.PI / (Math.PI + 2);
var W4 = 4 * Math.PI;

// packages/barocss-cad/src/machine/drive.ts
var TAU4 = 2 * Math.PI;

// packages/barocss-cad/src/machine/spring.ts
var GL = (() => {
  const n = 24, x = [], w = [];
  for (let i = 0; i < n; i++) {
    let t = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = n * (t * p1 - p0) / (t * t - 1);
      const step = p1 / dp;
      t -= step;
      if (Math.abs(step) < 1e-16) break;
    }
    x.push(t);
    w.push(2 / ((1 - t * t) * dp * dp));
  }
  return { x, w };
})();

// packages/barocss-cad/src/machine/thread-helical.ts
var HANDLE = 4 / 3 * Math.tan(Math.PI / 8);

// packages/barocss-cad/src/blend/edge-finish.ts
var TAU5 = 2 * Math.PI;

// packages/barocss-cad/src/features/section-offset.ts
var TAU6 = 2 * Math.PI;

// packages/barocss-cad/src/blend/general-shell.ts
var TAU7 = 2 * Math.PI;

// packages/barocss-cad/src/part/part-shell.ts
function brepBodies(b) {
  return b.bodies.map((body) => {
    const shells = new Set(body.shells), faces = b.faces.filter((x) => shells.has(x.shell)), faceIds = new Set(faces.map((x) => x.id));
    const loops = b.loops.filter((l) => faceIds.has(l.face)), loopIds = new Set(loops.map((l) => l.id));
    const coedges = b.coedges.filter((c) => loopIds.has(c.loop)), edgeIds = new Set(coedges.map((c) => c.edge));
    const edges = b.edges.filter((e) => edgeIds.has(e.id)), vertexIds = new Set(edges.flatMap((e) => e.vertices));
    return { ...b, bodies: [body], shells: b.shells.filter((x) => shells.has(x.id)), faces, loops, coedges, edges, vertices: b.vertices.filter((v) => vertexIds.has(v.id)) };
  });
}

// packages/barocss-cad/src/part/part-expect.ts
var SAME_DIRECTION = Math.cos(Math.PI / 180);

// packages/barocss-cad/src/frame-sheet/frame-section.ts
var SPANDREL = 1 - Math.PI / 4;

// packages/barocss-cad/src/core/error-codes.ts
var CAD_REFUSAL_CODES = [
  "APPROX_TOLERANCE_NOT_MET",
  "ARC_MEMBER",
  "BAND_CHAIN",
  "BAND_DEGENERATE",
  "BAND_EDGE_LOST",
  "BAND_OBLIQUE",
  "BAND_PROFILE",
  "BAND_TOUCH",
  "BEAD_ANGLE",
  "BEAD_KIND",
  "BEAD_SEAM_NOT_PLANAR",
  "BEAD_SHARED_UNSUPPORTED",
  "BEAD_SIZE",
  "BEND_ANGLE",
  "BEND_DOES_NOT_FIT",
  "BEND_RADIUS",
  "BEND_TABLE",
  "BEND_TABLE_MISS",
  "BUTT_NOT_ON_A_FACE",
  "BUTT_ON_CURVED_MEMBER",
  "BUTT_ON_OPEN_SIDE",
  "CAP_END",
  "CONE_TOP_CHAMFER_SCOPE",
  "CONE_TOP_CHAMFER_SIZE",
  "CONTACT_LEAVES_FACE",
  "CORNER_ANGLE",
  "CORNER_NOT_A_JOINT",
  "CORNER_NOT_CLEAR",
  "CORNER_NOT_SQUARE",
  "DENSITY",
  "EDGE_NOT_SHEET",
  "FACE_FILLET_FACE",
  "FACE_FILLET_FACES",
  "FACE_FILLET_NOT_CLEAR",
  "FACE_FILLET_PARALLEL",
  "FACE_FILLET_RADIUS",
  "FACE_THREAD_FACE",
  "FACE_THREAD_NOT_CLEAR",
  "FACE_THREAD_RELIEF",
  "FACE_THREAD_SIZE",
  "FINISH_EDGES_LIMIT",
  "FLANGES_COLLIDE",
  "FULL_ROUND_FACE",
  "FULL_ROUND_NOT_CLEAR",
  "GAP_SIZE",
  "GUSSET_FIT",
  "INVALID_INPUT",
  "MATE_INCOMPATIBLE",
  "MEMBERS_CLASH",
  "MEMBER_DUPLICATE",
  "MESH_WALL_THIN",
  "MITRE_SECTIONS_DIFFER",
  "NOTCH_CUTTER",
  "NOT_ANALYTIC_PAIR",
  "NOT_A_MEMBER",
  "NOT_A_SHEET",
  "OBSTRUCTED_ABOVE",
  "OFFSET_FOLDS",
  "OPENING_AT_A_VERTEX",
  "RADIUS_EXCEEDS_CURVATURE",
  "RADIUS_EXCEEDS_FACE",
  "REFERENCE_MOVED",
  "RELIEF_REQUIRED",
  "SECTION_DIMENSIONS",
  "SECTION_TABLE",
  "SECTION_TABLE_MISS",
  "SEGMENT_ZERO_LENGTH",
  "SHEET_CROSSES_ITSELF",
  "SHEET_IN_PIECES",
  "SHELL_FACE_KIND",
  "SHELL_MESH_NOT_CLOSED",
  "SHELL_NOT_CLOSED",
  "SHELL_OPENING_NOT_PLANAR",
  "SHELL_PLANE_NOT_BOUNDING",
  "SHELL_REGIONS_SHARP",
  "SHELL_VARIABLE_RADIUS",
  "SHELL_WALL_UNION",
  "SKELETON_OVERLAP",
  "TANGENT_FACES",
  "TRIM_EMPTY",
  "TRIM_LEAVES_PIECES",
  "TRIM_MISSES",
  "TRIM_PARALLEL",
  "VERTEX_BLEND_UNSUPPORTED",
  "WALL_NEAR_RADIUS",
  "WALL_TOO_THIN"
];
var REFUSALS = new Set(CAD_REFUSAL_CODES);

// packages/barocss-cad/src/part/part-model.ts
var CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, stepBytes: 32 << 20, stepTessellatedBytes: 128 << 20, length: 1e4, meshTriangles: 2e6, planarMeshTriangles: 1e5, subdVertices: 1e5 });
function stepSizeProblem(text2) {
  const MiB = (n) => `${n / 2 ** 20} MiB`;
  if (text2.length > CadPartLimits.stepTessellatedBytes) return `the STEP file is larger than ${MiB(CadPartLimits.stepTessellatedBytes)}; a mesh that large opens from a .bcad file (its arrays kept as binary)`;
  if (text2.length <= CadPartLimits.stepBytes) return null;
  const other = text2.length - stepTessellatedChars(text2);
  return other > CadPartLimits.stepBytes ? `the STEP file is larger than ${MiB(CadPartLimits.stepBytes)} outside its meshes (${(other / 2 ** 20).toFixed(1)} MiB); only tessellated meshes may take it up to ${MiB(CadPartLimits.stepTessellatedBytes)}` : null;
}
function splitBodies(b) {
  if (b.bodies.length <= 1) return [b];
  return b.bodies.map((body) => {
    const shells = b.shells.filter((x) => x.body === body.id), faceIds = new Set(shells.flatMap((x) => x.faces)), faces = b.faces.filter((f) => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap((f) => f.loops)), loops = b.loops.filter((l) => loopIds.has(l.id)), coIds = new Set(loops.flatMap((l) => l.coedges));
    const coedges = b.coedges.filter((c) => coIds.has(c.id)), edgeIds = new Set(coedges.map((c) => c.edge)), edges = b.edges.filter((e) => edgeIds.has(e.id)), vIds = new Set(edges.flatMap((e) => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter((v) => vIds.has(v.id)) };
  });
}
var brepOf = (part, id2) => part.brep ??= part.solid.kind === "upright" ? brepFromPrismatic(part.solid.solid, { id: id2 }) : part.solid.brep;
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isMeshArray = (v) => v instanceof Float64Array || v instanceof Float32Array || v instanceof Uint32Array || v instanceof Int32Array;
var checkedArrays = /* @__PURE__ */ new WeakMap();
function meshArrayOk(v, what, nv = 0) {
  if (!Array.isArray(v) && !isMeshArray(v)) return false;
  const a = v, key = `${what}:${nv}`;
  if (checkedArrays.get(a) === key) return true;
  if (a.length % 3) return false;
  if (what === "positions") {
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length) return false;
    }
  } else {
    if (a.length / 3 > CadPartLimits.meshTriangles) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (!Number.isInteger(x) || x < 0 || x >= nv) return false;
    }
  }
  checkedArrays.set(a, key);
  return true;
}
var LONG_TEXT = 1 << 16;
function frameOf(plane, xyz, fail3) {
  if (!isRecord(plane)) fail3("INPUT", "plane must be { origin, normal, xAxis }");
  const direction = (v, what) => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every((c) => typeof c === "number" && Number.isFinite(c))) fail3("INPUT", `plane ${what} must be [x, y, z]`);
    const l = Math.hypot(...v);
    if (!(l > 1e-12)) fail3("INPUT", `plane ${what} must not be zero`);
    return v.map((c) => c / l);
  };
  const snap2 = (v) => v.map((c) => Math.abs(c) < 1e-12 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-12 ? Math.sign(c) : c);
  const n = snap2(direction(plane.normal, "normal")), x0 = direction(plane.xAxis, "xAxis");
  if (Math.abs(dot5(x0, n)) > 1e-9) fail3("INPUT", "plane xAxis must be perpendicular to its normal");
  const x = snap2(unit(sub2(x0, scale3(n, dot5(x0, n))))), y = snap2(cross2(n, x));
  return { m: [x[0], y[0], n[0], x[1], y[1], n[1], x[2], y[2], n[2]], o: xyz(plane.origin, "plane origin") };
}
var framed = (frame, p) => !frame ? p : [frame.m[0] * p[0] + frame.m[1] * p[1] + frame.m[2] * p[2] + frame.o[0], frame.m[3] * p[0] + frame.m[4] * p[1] + frame.m[5] * p[2] + frame.o[1], frame.m[6] * p[0] + frame.m[7] * p[1] + frame.m[8] * p[2] + frame.o[2]];
var placed = (frame, compute) => !frame ? compute : () => {
  const r = compute();
  return r.kind === "solid" ? moveAll(r.parts, frame.m, frame.o) : r;
};
var facetBody = (s) => s.kind === "brep" && s.brep.faces.length > 0 && s.brep.faces.some(isFacetFace);
function facetTriangles(brep) {
  let nv = 0, nt = 0;
  for (const f of brep.faces) {
    const p = f.surface;
    nv += p.positions.length / 3;
    nt += p.indices.length / 3;
  }
  const P = new Float64Array(3 * nv), I = new Uint32Array(3 * nt), G = new Int32Array(nt), names = [];
  let ov = 0, ot = 0;
  brep.faces.forEach((f, g) => {
    const p = f.surface, fw = f.sense === "forward", X = p.indices;
    P.set(p.positions, 3 * ov);
    for (let k = 0; k < X.length; k += 3) {
      I[3 * ot + k] = X[k] + ov;
      I[3 * ot + k + 1] = (fw ? X[k + 1] : X[k + 2]) + ov;
      I[3 * ot + k + 2] = (fw ? X[k + 2] : X[k + 1]) + ov;
    }
    G.fill(g, ot, ot + p.indices.length / 3);
    names.push((f.name ?? f.id).replace(/#\d+$/, ""));
    ov += p.positions.length / 3;
    ot += p.indices.length / 3;
  });
  let size2 = 1;
  for (let k = 0; k < P.length; k++) size2 = Math.max(size2, Math.abs(P[k]));
  const { P: welded, remap } = weldVertices(P, nv, 1e-9 * size2);
  for (let k = 0; k < I.length; k++) I[k] = remap[I[k]];
  return { positions: welded, indices: I, groups: G, names };
}
function affine(s, m, o, rename) {
  if (s.kind === "upright" && m[2] === 0 && m[5] === 0 && m[6] === 0 && m[7] === 0)
    return { kind: "upright", solid: transformPrismatic(s.solid, { matrix: [m[0], m[1], m[3], m[4]], offset: [o[0], o[1]], zScale: m[8], zOffset: o[2], ...rename ? { retag: rename } : {} }) };
  const brep = s.kind === "upright" ? brepFromPrismatic(s.solid) : s.brep;
  return { kind: "brep", brep: transformBrep(brep, { matrix: m, offset: [o[0], o[1], o[2]] }, rename) };
}
function moveAll(parts, m, o, preserveNativeSI = false) {
  return { kind: "solid", parts: parts.map((p) => {
    const exact5 = p.mass ?? (p.solid.kind === "upright" ? /* @__PURE__ */ ((s) => (d) => prismaticMassProperties(s, d))(p.solid.solid) : void 0);
    return { solid: affine(p.solid, m, o), moved: { from: p, m, o }, ...exact5 ? { mass: (d) => movedMass(exact5(d), m, o, preserveNativeSI) } : {} };
  }) };
}
function movedMass(p, m, o, preserveNativeSI = false) {
  const k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]))), R = m.map((x) => x / k);
  const c = p.centroid, I = p.inertia, k5 = k ** 5;
  const RIRt = [0, 1, 2].map((i) => [0, 1, 2].map((j) => {
    let sum = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum += R[3 * i + a] * I[a][b] * R[3 * j + b];
    return sum * k5;
  }));
  const moved = unsupportedNativeMass({
    volume: p.volume * k ** 3,
    mass: p.mass * k ** 3,
    method: p.method,
    inertia: RIRt,
    centroid: [0, 1, 2].map((i) => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i])
  }, "transformed");
  if (preserveNativeSI && m.every((x, i) => x === (i === 0 || i === 4 || i === 8 ? 1 : 0)) && readNativeSIInertia(p).ok) transferNativeMassBasis(p, moved);
  return moved;
}
var HELPERS = Object.freeze({ isRecord, brepOf, CadPartLimits, stepSizeProblem, splitBodies, meshArrayOk, facetBody, facetTriangles, brepBodies, frameOf, framed, placed });

// packages/barocss-cad/src/features/library.ts
var DEG = Math.PI / 180;

// packages/barocss-physics/src/cad-proxy-validation.ts
function proxyError(code, message) {
  throw new PhysicsError(code, message);
}
function proxyRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    proxyError("INVALID_CONFIG", "CAD proxy request must be a plain object");
  }
  return value;
}
function proxyFields(value, allowed) {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.includes(key))) {
    proxyError("INVALID_CONFIG", "CAD proxy request has an unsupported field");
  }
}
function proxyFinite(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    proxyError("INVALID_CONFIG", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function proxyVector(value, min, max, label) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    proxyError("INVALID_CONFIG", `${label} must be a dense 3-vector`);
  }
  return [0, 1, 2].map((index) => proxyFinite(value[index], min, max, `${label}[${index}]`));
}

// packages/barocss-physics/src/cad-proxy-admission.ts
var CAD_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/;
function requestValues(value) {
  const input = proxyRecord(value);
  proxyFields(input, [
    "sourceVersion",
    "sourceRevision",
    "modelId",
    "surfaceId",
    "kind",
    "proxy",
    "massKg",
    "initialOffsetM",
    "minimumHalfExtentM"
  ]);
  if (input.sourceVersion !== 0) proxyError("INVALID_CONFIG", "CAD proxy requires sourceVersion 0");
  if (typeof input.sourceRevision !== "string" || !ID.test(input.sourceRevision)) {
    proxyError("INVALID_CONFIG", "invalid source revision");
  }
  if (typeof input.modelId !== "string" || !CAD_ID.test(input.modelId) || typeof input.surfaceId !== "string" || !CAD_ID.test(input.surfaceId)) {
    proxyError("INVALID_CONFIG", "invalid native model or Surface ID");
  }
  if (input.kind !== "dynamic" && input.kind !== "static") proxyError("INVALID_CONFIG", "invalid proxy body kind");
  if (input.proxy !== "sphere" && input.proxy !== "box") proxyError("INVALID_CONFIG", "invalid proxy shape");
  if (input.kind === "static" && (Object.hasOwn(input, "massKg") || Object.hasOwn(input, "initialOffsetM"))) {
    proxyError("INVALID_CONFIG", "static proxy cannot declare mass or offset");
  }
  if (input.kind === "dynamic") proxyFinite(input.massKg, 1e-6, 1e6, "massKg");
  if (input.proxy === "sphere" && Object.hasOwn(input, "minimumHalfExtentM")) {
    proxyError("INVALID_CONFIG", "sphere proxy cannot declare minimumHalfExtentM");
  }
  if (Object.hasOwn(input, "minimumHalfExtentM")) {
    proxyFinite(input.minimumHalfExtentM, 1e-4, 1e3, "minimumHalfExtentM");
  }
  if (Object.hasOwn(input, "initialOffsetM")) proxyVector(input.initialOffsetM, -1e3, 1e3, "initialOffsetM");
  return input;
}
function controlBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const row of points) for (const point of row) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], point[axis]);
    max[axis] = Math.max(max[axis], point[axis]);
  }
  if ([...min, ...max].some((value) => !Number.isFinite(value))) {
    proxyError("INVALID_CONFIG", "native Surface has invalid control bounds");
  }
  return { min, max };
}
function admitCadSurfaceProxy(source, request) {
  globalThis.__p5Public.hit("admitCadSurfaceProxy");
  if (typeof source !== "string" || source.length < 1 || source.length > 65536) {
    proxyError("INVALID_CONFIG", "CAD source length must be 1..65536 characters");
  }
  const input = requestValues(request);
  const bodyId = `${input.kind === "dynamic" ? "part" : "fixture"}:${input.modelId}.${input.surfaceId}`;
  if (!ID.test(bodyId)) proxyError("INVALID_CONFIG", "qualified Physics body ID exceeds bounds");
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) proxyError("INVALID_CONFIG", `CAD source refused: ${compiled.diagnostics[0]?.code ?? "unknown"}`);
  if (compiled.model.name !== input.modelId) proxyError("INVALID_CONFIG", "native model ID differs from selection");
  const native2 = compiled.model.objects.find((object) => object.id === input.surfaceId);
  if (!native2 || native2.kind !== "surface") proxyError("INVALID_CONFIG", "selected native object is not a Surface");
  const sourceBoundsMM = controlBounds(native2.controlPoints);
  const sourceCenterMM = sourceBoundsMM.min.map((low, axis) => (low + sourceBoundsMM.max[axis]) / 2);
  const halfSpanM = sourceBoundsMM.min.map((low, axis) => (sourceBoundsMM.max[axis] - low) / 2e3);
  const centerM = sourceCenterMM.map((value) => value / 1e3);
  const positionM = add(centerM, input.initialOffsetM ?? [0, 0, 0]);
  proxyVector(positionM, -1e4, 1e4, "proxy positionM");
  const shape2 = input.proxy === "sphere" ? { kind: "sphere", radiusM: Math.max(1e-4, Math.hypot(...halfSpanM)) } : { kind: "box", halfExtentsM: halfSpanM.map((value) => Math.max(value, input.minimumHalfExtentM ?? 1e-4)) };
  if (shape2.kind === "sphere") proxyFinite(shape2.radiusM, 1e-4, 1e3, "proxy radiusM");
  else shape2.halfExtentsM.forEach((value, axis) => proxyFinite(value, 1e-4, 1e3, `proxy halfExtentsM[${axis}]`));
  const initial = { positionM, orientationXYZW: [0, 0, 0, 1] };
  const body = input.kind === "dynamic" ? {
    id: bodyId,
    kind: "dynamic",
    initial: {
      ...initial,
      velocityMps: [0, 0, 0],
      angularVelocityRadps: [0, 0, 0]
    },
    massKg: input.massKg,
    inertia: { kind: "primitive-com", about: "com", frame: "body-local" }
  } : { id: bodyId, kind: "static", initial };
  const collider = {
    id: `collider:${digest(bodyId).slice(7, 55)}`,
    bodyId,
    geometry: shape2,
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false,
    ccd: false,
    filter: { categoryBits: 1, maskBits: 65535 }
  };
  const lossLabel = input.proxy === "sphere" ? "Control-net enclosing sphere; native Surface geometry is not the collision shape." : "Control-net axis-aligned box with minimum thickness; native Surface geometry is not the collision shape.";
  const binding = {
    id: `source:${digest(bodyId).slice(7, 55)}`,
    sourceRevision: input.sourceRevision,
    sourceDigest: digest(source),
    modelId: input.modelId,
    occurrenceId: input.surfaceId,
    entityIds: [bodyId, collider.id],
    approximation: { kind: input.proxy === "sphere" ? "control-net-sphere" : "control-net-box", lossLabel }
  };
  const admitted = {
    sourceSnapshot: source,
    sourceRevision: input.sourceRevision,
    modelId: input.modelId,
    surfaceId: input.surfaceId,
    bodyId,
    sourceCenterMM: [...sourceCenterMM],
    sourceBoundsMM: { min: [...sourceBoundsMM.min], max: [...sourceBoundsMM.max] },
    lossLabel,
    body,
    collider,
    binding
  };
  Object.freeze(admitted.sourceCenterMM);
  Object.freeze(admitted.sourceBoundsMM.min);
  Object.freeze(admitted.sourceBoundsMM.max);
  Object.freeze(admitted.sourceBoundsMM);
  Object.freeze(body.initial.positionM);
  Object.freeze(body.initial.orientationXYZW);
  if (body.kind === "dynamic") {
    Object.freeze(body.initial.velocityMps);
    Object.freeze(body.initial.angularVelocityRadps);
    Object.freeze(body.inertia);
  }
  Object.freeze(body.initial);
  if (collider.geometry.kind === "box") Object.freeze(collider.geometry.halfExtentsM);
  Object.freeze(collider.geometry);
  Object.freeze(collider.local.positionM);
  Object.freeze(collider.local.orientationXYZW);
  Object.freeze(collider.local);
  Object.freeze(collider.material.friction);
  Object.freeze(collider.material);
  Object.freeze(collider.filter);
  Object.freeze(collider);
  Object.freeze(binding.entityIds);
  Object.freeze(binding.approximation);
  Object.freeze(binding);
  Object.freeze(body);
  return Object.freeze(admitted);
}
function assertCadProxyCurrent(proxy, currentSource, currentRevision) {
  globalThis.__p5Public.hit("assertCadProxyCurrent");
  if (currentSource !== proxy.sourceSnapshot || currentRevision !== proxy.sourceRevision) {
    proxyError("STALE_SOURCE", "CAD proxy source changed; explicit re-admission is required");
  }
}

// packages/barocss-physics/src/cad-proxy-pose.ts
function cadProxyPose(proxy, body, currentSource, currentRevision) {
  assertCadProxyCurrent(proxy, currentSource, currentRevision);
  if (!body || body.id !== proxy.bodyId || !Array.isArray(body.positionM) || body.positionM.length !== 3 || body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e4) || !Array.isArray(body.orientationXYZW) || body.orientationXYZW.length !== 4 || body.orientationXYZW.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body.orientationXYZW) - 1) > 1e-9) {
    proxyError("INVALID_CONFIG", "Physics body pose differs from CAD proxy binding");
  }
  const positionMM = body.positionM.map((value) => value * 1e3);
  const translation = sub(positionMM, rotate2([body.orientationXYZW[0], body.orientationXYZW[1], body.orientationXYZW[2], body.orientationXYZW[3]], proxy.sourceCenterMM));
  if (translation.some((value) => !Number.isFinite(value))) proxyError("NUMERIC_LIMIT", "unsafe CAD proxy pose");
  return { targetId: proxy.bodyId, translation, rotation: [...body.orientationXYZW] };
}

// packages/barocss-physics/src/cad-fluid-data.ts
function admitCadFluidStaticData(basinModel, targetOptions, sourceText, request) {
  globalThis.__p5Public.hit("admitCadFluidStaticData");
  const options = copyData(targetOptions);
  if (!options || typeof options !== "object" || Array.isArray(options)) error("INVALID_CONFIG", "CAD fluid target options require a record");
  if (options.profile !== "fluid-static-box-visual-v1") error("INVALID_CONFIG", "CAD fluid data requires the static-box target profile");
  const base = admitModel(basinModel, { ...options, profile: "fluid-basin-visual-v1" });
  if (base.domain?.kind !== "fluid") error("INVALID_CONFIG", "CAD fluid data requires one admitted basin fluid");
  const selection = copyData(request);
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) error("INVALID_CONFIG", "CAD fluid selection requires a record");
  if (selection.kind !== "static" || selection.proxy !== "box") error("INVALID_CONFIG", "CAD fluid obstacle requires one static box proxy");
  const proxy = admitCadSurfaceProxy(sourceText, selection);
  if (proxy.body.kind !== "static" || proxy.collider.geometry.kind !== "box") error("INVALID_CONFIG", "CAD fluid obstacle must be a static box");
  const completed = {
    ...base.model,
    bodies: [...base.model.bodies, copyData(proxy.body)],
    colliders: [...base.model.colliders, copyData(proxy.collider)],
    fluids: base.model.fluids.map((fluid) => ({ ...fluid, staticColliderIds: [...fluid.staticColliderIds, proxy.collider.id] })),
    sourceBindings: [...base.model.sourceBindings, copyData(proxy.binding)]
  };
  return { model: admitModel(completed, options).model, proxy };
}

// examples/physics-model-data-2276/model-data.mjs
function freeze2(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze2(child);
    Object.freeze(value);
  }
  return value;
}
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  return value;
}
var physicsModelPresets = freeze2({ "cloth-pinned-sphere-visual-v1": { "model": { "format": "barocss-physics-model", "version": 1, "revision": "p5KernelFixture1", "frame": { "id": "world", "basis": "right-handed-xyz", "rotation": "local-to-world-xyzw" }, "units": { "length": "m", "mass": "kg", "time": "s", "angle": "rad" }, "gravityMps2": [0, -9.81, 0], "bodies": [{ "id": "p5SphereBody", "kind": "static", "initial": { "positionM": [0, 0.1, 0], "orientationXYZW": [0, 0, 0, 1] } }], "colliders": [{ "id": "p5SphereCollider", "bodyId": "p5SphereBody", "geometry": { "kind": "sphere", "radiusM": 0.3 }, "local": { "positionM": [0, 0, 0], "orientationXYZW": [0, 0, 0, 1] }, "material": { "restitution": 0, "friction": { "static": 0, "dynamic": 0 } }, "sensor": false, "ccd": false, "filter": { "categoryBits": 1, "maskBits": 65535 } }], "joints": [], "cloths": [{ "id": "p5Cloth", "restPositionsM": [[-0.5, 0.55, -0.5], [-0.4375, 0.55, -0.5], [-0.375, 0.55, -0.5], [-0.3125, 0.55, -0.5], [-0.25, 0.55, -0.5], [-0.1875, 0.55, -0.5], [-0.125, 0.55, -0.5], [-0.0625, 0.55, -0.5], [0, 0.55, -0.5], [0.0625, 0.55, -0.5], [0.125, 0.55, -0.5], [0.1875, 0.55, -0.5], [0.25, 0.55, -0.5], [0.3125, 0.55, -0.5], [0.375, 0.55, -0.5], [0.4375, 0.55, -0.5], [0.5, 0.55, -0.5], [-0.5, 0.55, -0.4375], [-0.4375, 0.55, -0.4375], [-0.375, 0.55, -0.4375], [-0.3125, 0.55, -0.4375], [-0.25, 0.55, -0.4375], [-0.1875, 0.55, -0.4375], [-0.125, 0.55, -0.4375], [-0.0625, 0.55, -0.4375], [0, 0.55, -0.4375], [0.0625, 0.55, -0.4375], [0.125, 0.55, -0.4375], [0.1875, 0.55, -0.4375], [0.25, 0.55, -0.4375], [0.3125, 0.55, -0.4375], [0.375, 0.55, -0.4375], [0.4375, 0.55, -0.4375], [0.5, 0.55, -0.4375], [-0.5, 0.55, -0.375], [-0.4375, 0.55, -0.375], [-0.375, 0.55, -0.375], [-0.3125, 0.55, -0.375], [-0.25, 0.55, -0.375], [-0.1875, 0.55, -0.375], [-0.125, 0.55, -0.375], [-0.0625, 0.55, -0.375], [0, 0.55, -0.375], [0.0625, 0.55, -0.375], [0.125, 0.55, -0.375], [0.1875, 0.55, -0.375], [0.25, 0.55, -0.375], [0.3125, 0.55, -0.375], [0.375, 0.55, -0.375], [0.4375, 0.55, -0.375], [0.5, 0.55, -0.375], [-0.5, 0.55, -0.3125], [-0.4375, 0.55, -0.3125], [-0.375, 0.55, -0.3125], [-0.3125, 0.55, -0.3125], [-0.25, 0.55, -0.3125], [-0.1875, 0.55, -0.3125], [-0.125, 0.55, -0.3125], [-0.0625, 0.55, -0.3125], [0, 0.55, -0.3125], [0.0625, 0.55, -0.3125], [0.125, 0.55, -0.3125], [0.1875, 0.55, -0.3125], [0.25, 0.55, -0.3125], [0.3125, 0.55, -0.3125], [0.375, 0.55, -0.3125], [0.4375, 0.55, -0.3125], [0.5, 0.55, -0.3125], [-0.5, 0.55, -0.25], [-0.4375, 0.55, -0.25], [-0.375, 0.55, -0.25], [-0.3125, 0.55, -0.25], [-0.25, 0.55, -0.25], [-0.1875, 0.55, -0.25], [-0.125, 0.55, -0.25], [-0.0625, 0.55, -0.25], [0, 0.55, -0.25], [0.0625, 0.55, -0.25], [0.125, 0.55, -0.25], [0.1875, 0.55, -0.25], [0.25, 0.55, -0.25], [0.3125, 0.55, -0.25], [0.375, 0.55, -0.25], [0.4375, 0.55, -0.25], [0.5, 0.55, -0.25], [-0.5, 0.55, -0.1875], [-0.4375, 0.55, -0.1875], [-0.375, 0.55, -0.1875], [-0.3125, 0.55, -0.1875], [-0.25, 0.55, -0.1875], [-0.1875, 0.55, -0.1875], [-0.125, 0.55, -0.1875], [-0.0625, 0.55, -0.1875], [0, 0.55, -0.1875], [0.0625, 0.55, -0.1875], [0.125, 0.55, -0.1875], [0.1875, 0.55, -0.1875], [0.25, 0.55, -0.1875], [0.3125, 0.55, -0.1875], [0.375, 0.55, -0.1875], [0.4375, 0.55, -0.1875], [0.5, 0.55, -0.1875], [-0.5, 0.55, -0.125], [-0.4375, 0.55, -0.125], [-0.375, 0.55, -0.125], [-0.3125, 0.55, -0.125], [-0.25, 0.55, -0.125], [-0.1875, 0.55, -0.125], [-0.125, 0.55, -0.125], [-0.0625, 0.55, -0.125], [0, 0.55, -0.125], [0.0625, 0.55, -0.125], [0.125, 0.55, -0.125], [0.1875, 0.55, -0.125], [0.25, 0.55, -0.125], [0.3125, 0.55, -0.125], [0.375, 0.55, -0.125], [0.4375, 0.55, -0.125], [0.5, 0.55, -0.125], [-0.5, 0.55, -0.0625], [-0.4375, 0.55, -0.0625], [-0.375, 0.55, -0.0625], [-0.3125, 0.55, -0.0625], [-0.25, 0.55, -0.0625], [-0.1875, 0.55, -0.0625], [-0.125, 0.55, -0.0625], [-0.0625, 0.55, -0.0625], [0, 0.55, -0.0625], [0.0625, 0.55, -0.0625], [0.125, 0.55, -0.0625], [0.1875, 0.55, -0.0625], [0.25, 0.55, -0.0625], [0.3125, 0.55, -0.0625], [0.375, 0.55, -0.0625], [0.4375, 0.55, -0.0625], [0.5, 0.55, -0.0625], [-0.5, 0.55, 0], [-0.4375, 0.55, 0], [-0.375, 0.55, 0], [-0.3125, 0.55, 0], [-0.25, 0.55, 0], [-0.1875, 0.55, 0], [-0.125, 0.55, 0], [-0.0625, 0.55, 0], [0, 0.55, 0], [0.0625, 0.55, 0], [0.125, 0.55, 0], [0.1875, 0.55, 0], [0.25, 0.55, 0], [0.3125, 0.55, 0], [0.375, 0.55, 0], [0.4375, 0.55, 0], [0.5, 0.55, 0], [-0.5, 0.55, 0.0625], [-0.4375, 0.55, 0.0625], [-0.375, 0.55, 0.0625], [-0.3125, 0.55, 0.0625], [-0.25, 0.55, 0.0625], [-0.1875, 0.55, 0.0625], [-0.125, 0.55, 0.0625], [-0.0625, 0.55, 0.0625], [0, 0.55, 0.0625], [0.0625, 0.55, 0.0625], [0.125, 0.55, 0.0625], [0.1875, 0.55, 0.0625], [0.25, 0.55, 0.0625], [0.3125, 0.55, 0.0625], [0.375, 0.55, 0.0625], [0.4375, 0.55, 0.0625], [0.5, 0.55, 0.0625], [-0.5, 0.55, 0.125], [-0.4375, 0.55, 0.125], [-0.375, 0.55, 0.125], [-0.3125, 0.55, 0.125], [-0.25, 0.55, 0.125], [-0.1875, 0.55, 0.125], [-0.125, 0.55, 0.125], [-0.0625, 0.55, 0.125], [0, 0.55, 0.125], [0.0625, 0.55, 0.125], [0.125, 0.55, 0.125], [0.1875, 0.55, 0.125], [0.25, 0.55, 0.125], [0.3125, 0.55, 0.125], [0.375, 0.55, 0.125], [0.4375, 0.55, 0.125], [0.5, 0.55, 0.125], [-0.5, 0.55, 0.1875], [-0.4375, 0.55, 0.1875], [-0.375, 0.55, 0.1875], [-0.3125, 0.55, 0.1875], [-0.25, 0.55, 0.1875], [-0.1875, 0.55, 0.1875], [-0.125, 0.55, 0.1875], [-0.0625, 0.55, 0.1875], [0, 0.55, 0.1875], [0.0625, 0.55, 0.1875], [0.125, 0.55, 0.1875], [0.1875, 0.55, 0.1875], [0.25, 0.55, 0.1875], [0.3125, 0.55, 0.1875], [0.375, 0.55, 0.1875], [0.4375, 0.55, 0.1875], [0.5, 0.55, 0.1875], [-0.5, 0.55, 0.25], [-0.4375, 0.55, 0.25], [-0.375, 0.55, 0.25], [-0.3125, 0.55, 0.25], [-0.25, 0.55, 0.25], [-0.1875, 0.55, 0.25], [-0.125, 0.55, 0.25], [-0.0625, 0.55, 0.25], [0, 0.55, 0.25], [0.0625, 0.55, 0.25], [0.125, 0.55, 0.25], [0.1875, 0.55, 0.25], [0.25, 0.55, 0.25], [0.3125, 0.55, 0.25], [0.375, 0.55, 0.25], [0.4375, 0.55, 0.25], [0.5, 0.55, 0.25], [-0.5, 0.55, 0.3125], [-0.4375, 0.55, 0.3125], [-0.375, 0.55, 0.3125], [-0.3125, 0.55, 0.3125], [-0.25, 0.55, 0.3125], [-0.1875, 0.55, 0.3125], [-0.125, 0.55, 0.3125], [-0.0625, 0.55, 0.3125], [0, 0.55, 0.3125], [0.0625, 0.55, 0.3125], [0.125, 0.55, 0.3125], [0.1875, 0.55, 0.3125], [0.25, 0.55, 0.3125], [0.3125, 0.55, 0.3125], [0.375, 0.55, 0.3125], [0.4375, 0.55, 0.3125], [0.5, 0.55, 0.3125], [-0.5, 0.55, 0.375], [-0.4375, 0.55, 0.375], [-0.375, 0.55, 0.375], [-0.3125, 0.55, 0.375], [-0.25, 0.55, 0.375], [-0.1875, 0.55, 0.375], [-0.125, 0.55, 0.375], [-0.0625, 0.55, 0.375], [0, 0.55, 0.375], [0.0625, 0.55, 0.375], [0.125, 0.55, 0.375], [0.1875, 0.55, 0.375], [0.25, 0.55, 0.375], [0.3125, 0.55, 0.375], [0.375, 0.55, 0.375], [0.4375, 0.55, 0.375], [0.5, 0.55, 0.375], [-0.5, 0.55, 0.4375], [-0.4375, 0.55, 0.4375], [-0.375, 0.55, 0.4375], [-0.3125, 0.55, 0.4375], [-0.25, 0.55, 0.4375], [-0.1875, 0.55, 0.4375], [-0.125, 0.55, 0.4375], [-0.0625, 0.55, 0.4375], [0, 0.55, 0.4375], [0.0625, 0.55, 0.4375], [0.125, 0.55, 0.4375], [0.1875, 0.55, 0.4375], [0.25, 0.55, 0.4375], [0.3125, 0.55, 0.4375], [0.375, 0.55, 0.4375], [0.4375, 0.55, 0.4375], [0.5, 0.55, 0.4375], [-0.5, 0.55, 0.5], [-0.4375, 0.55, 0.5], [-0.375, 0.55, 0.5], [-0.3125, 0.55, 0.5], [-0.25, 0.55, 0.5], [-0.1875, 0.55, 0.5], [-0.125, 0.55, 0.5], [-0.0625, 0.55, 0.5], [0, 0.55, 0.5], [0.0625, 0.55, 0.5], [0.125, 0.55, 0.5], [0.1875, 0.55, 0.5], [0.25, 0.55, 0.5], [0.3125, 0.55, 0.5], [0.375, 0.55, 0.5], [0.4375, 0.55, 0.5], [0.5, 0.55, 0.5]], "initialPositionsM": [[-0.5, 0.55, -0.5], [-0.4375, 0.55, -0.5], [-0.375, 0.55, -0.5], [-0.3125, 0.55, -0.5], [-0.25, 0.55, -0.5], [-0.1875, 0.55, -0.5], [-0.125, 0.55, -0.5], [-0.0625, 0.55, -0.5], [0, 0.55, -0.5], [0.0625, 0.55, -0.5], [0.125, 0.55, -0.5], [0.1875, 0.55, -0.5], [0.25, 0.55, -0.5], [0.3125, 0.55, -0.5], [0.375, 0.55, -0.5], [0.4375, 0.55, -0.5], [0.5, 0.55, -0.5], [-0.5, 0.55, -0.4375], [-0.4375, 0.55, -0.4375], [-0.375, 0.55, -0.4375], [-0.3125, 0.55, -0.4375], [-0.25, 0.55, -0.4375], [-0.1875, 0.55, -0.4375], [-0.125, 0.55, -0.4375], [-0.0625, 0.55, -0.4375], [0, 0.55, -0.4375], [0.0625, 0.55, -0.4375], [0.125, 0.55, -0.4375], [0.1875, 0.55, -0.4375], [0.25, 0.55, -0.4375], [0.3125, 0.55, -0.4375], [0.375, 0.55, -0.4375], [0.4375, 0.55, -0.4375], [0.5, 0.55, -0.4375], [-0.5, 0.55, -0.375], [-0.4375, 0.55, -0.375], [-0.375, 0.55, -0.375], [-0.3125, 0.55, -0.375], [-0.25, 0.55, -0.375], [-0.1875, 0.55, -0.375], [-0.125, 0.55, -0.375], [-0.0625, 0.55, -0.375], [0, 0.55, -0.375], [0.0625, 0.55, -0.375], [0.125, 0.55, -0.375], [0.1875, 0.55, -0.375], [0.25, 0.55, -0.375], [0.3125, 0.55, -0.375], [0.375, 0.55, -0.375], [0.4375, 0.55, -0.375], [0.5, 0.55, -0.375], [-0.5, 0.55, -0.3125], [-0.4375, 0.55, -0.3125], [-0.375, 0.55, -0.3125], [-0.3125, 0.55, -0.3125], [-0.25, 0.55, -0.3125], [-0.1875, 0.55, -0.3125], [-0.125, 0.55, -0.3125], [-0.0625, 0.55, -0.3125], [0, 0.55, -0.3125], [0.0625, 0.55, -0.3125], [0.125, 0.55, -0.3125], [0.1875, 0.55, -0.3125], [0.25, 0.55, -0.3125], [0.3125, 0.55, -0.3125], [0.375, 0.55, -0.3125], [0.4375, 0.55, -0.3125], [0.5, 0.55, -0.3125], [-0.5, 0.55, -0.25], [-0.4375, 0.55, -0.25], [-0.375, 0.55, -0.25], [-0.3125, 0.55, -0.25], [-0.25, 0.55, -0.25], [-0.1875, 0.55, -0.25], [-0.125, 0.55, -0.25], [-0.0625, 0.55, -0.25], [0, 0.55, -0.25], [0.0625, 0.55, -0.25], [0.125, 0.55, -0.25], [0.1875, 0.55, -0.25], [0.25, 0.55, -0.25], [0.3125, 0.55, -0.25], [0.375, 0.55, -0.25], [0.4375, 0.55, -0.25], [0.5, 0.55, -0.25], [-0.5, 0.55, -0.1875], [-0.4375, 0.55, -0.1875], [-0.375, 0.55, -0.1875], [-0.3125, 0.55, -0.1875], [-0.25, 0.55, -0.1875], [-0.1875, 0.55, -0.1875], [-0.125, 0.55, -0.1875], [-0.0625, 0.55, -0.1875], [0, 0.55, -0.1875], [0.0625, 0.55, -0.1875], [0.125, 0.55, -0.1875], [0.1875, 0.55, -0.1875], [0.25, 0.55, -0.1875], [0.3125, 0.55, -0.1875], [0.375, 0.55, -0.1875], [0.4375, 0.55, -0.1875], [0.5, 0.55, -0.1875], [-0.5, 0.55, -0.125], [-0.4375, 0.55, -0.125], [-0.375, 0.55, -0.125], [-0.3125, 0.55, -0.125], [-0.25, 0.55, -0.125], [-0.1875, 0.55, -0.125], [-0.125, 0.55, -0.125], [-0.0625, 0.55, -0.125], [0, 0.55, -0.125], [0.0625, 0.55, -0.125], [0.125, 0.55, -0.125], [0.1875, 0.55, -0.125], [0.25, 0.55, -0.125], [0.3125, 0.55, -0.125], [0.375, 0.55, -0.125], [0.4375, 0.55, -0.125], [0.5, 0.55, -0.125], [-0.5, 0.55, -0.0625], [-0.4375, 0.55, -0.0625], [-0.375, 0.55, -0.0625], [-0.3125, 0.55, -0.0625], [-0.25, 0.55, -0.0625], [-0.1875, 0.55, -0.0625], [-0.125, 0.55, -0.0625], [-0.0625, 0.55, -0.0625], [0, 0.55, -0.0625], [0.0625, 0.55, -0.0625], [0.125, 0.55, -0.0625], [0.1875, 0.55, -0.0625], [0.25, 0.55, -0.0625], [0.3125, 0.55, -0.0625], [0.375, 0.55, -0.0625], [0.4375, 0.55, -0.0625], [0.5, 0.55, -0.0625], [-0.5, 0.55, 0], [-0.4375, 0.55, 0], [-0.375, 0.55, 0], [-0.3125, 0.55, 0], [-0.25, 0.55, 0], [-0.1875, 0.55, 0], [-0.125, 0.55, 0], [-0.0625, 0.55, 0], [0, 0.55, 0], [0.0625, 0.55, 0], [0.125, 0.55, 0], [0.1875, 0.55, 0], [0.25, 0.55, 0], [0.3125, 0.55, 0], [0.375, 0.55, 0], [0.4375, 0.55, 0], [0.5, 0.55, 0], [-0.5, 0.55, 0.0625], [-0.4375, 0.55, 0.0625], [-0.375, 0.55, 0.0625], [-0.3125, 0.55, 0.0625], [-0.25, 0.55, 0.0625], [-0.1875, 0.55, 0.0625], [-0.125, 0.55, 0.0625], [-0.0625, 0.55, 0.0625], [0, 0.55, 0.0625], [0.0625, 0.55, 0.0625], [0.125, 0.55, 0.0625], [0.1875, 0.55, 0.0625], [0.25, 0.55, 0.0625], [0.3125, 0.55, 0.0625], [0.375, 0.55, 0.0625], [0.4375, 0.55, 0.0625], [0.5, 0.55, 0.0625], [-0.5, 0.55, 0.125], [-0.4375, 0.55, 0.125], [-0.375, 0.55, 0.125], [-0.3125, 0.55, 0.125], [-0.25, 0.55, 0.125], [-0.1875, 0.55, 0.125], [-0.125, 0.55, 0.125], [-0.0625, 0.55, 0.125], [0, 0.55, 0.125], [0.0625, 0.55, 0.125], [0.125, 0.55, 0.125], [0.1875, 0.55, 0.125], [0.25, 0.55, 0.125], [0.3125, 0.55, 0.125], [0.375, 0.55, 0.125], [0.4375, 0.55, 0.125], [0.5, 0.55, 0.125], [-0.5, 0.55, 0.1875], [-0.4375, 0.55, 0.1875], [-0.375, 0.55, 0.1875], [-0.3125, 0.55, 0.1875], [-0.25, 0.55, 0.1875], [-0.1875, 0.55, 0.1875], [-0.125, 0.55, 0.1875], [-0.0625, 0.55, 0.1875], [0, 0.55, 0.1875], [0.0625, 0.55, 0.1875], [0.125, 0.55, 0.1875], [0.1875, 0.55, 0.1875], [0.25, 0.55, 0.1875], [0.3125, 0.55, 0.1875], [0.375, 0.55, 0.1875], [0.4375, 0.55, 0.1875], [0.5, 0.55, 0.1875], [-0.5, 0.55, 0.25], [-0.4375, 0.55, 0.25], [-0.375, 0.55, 0.25], [-0.3125, 0.55, 0.25], [-0.25, 0.55, 0.25], [-0.1875, 0.55, 0.25], [-0.125, 0.55, 0.25], [-0.0625, 0.55, 0.25], [0, 0.55, 0.25], [0.0625, 0.55, 0.25], [0.125, 0.55, 0.25], [0.1875, 0.55, 0.25], [0.25, 0.55, 0.25], [0.3125, 0.55, 0.25], [0.375, 0.55, 0.25], [0.4375, 0.55, 0.25], [0.5, 0.55, 0.25], [-0.5, 0.55, 0.3125], [-0.4375, 0.55, 0.3125], [-0.375, 0.55, 0.3125], [-0.3125, 0.55, 0.3125], [-0.25, 0.55, 0.3125], [-0.1875, 0.55, 0.3125], [-0.125, 0.55, 0.3125], [-0.0625, 0.55, 0.3125], [0, 0.55, 0.3125], [0.0625, 0.55, 0.3125], [0.125, 0.55, 0.3125], [0.1875, 0.55, 0.3125], [0.25, 0.55, 0.3125], [0.3125, 0.55, 0.3125], [0.375, 0.55, 0.3125], [0.4375, 0.55, 0.3125], [0.5, 0.55, 0.3125], [-0.5, 0.55, 0.375], [-0.4375, 0.55, 0.375], [-0.375, 0.55, 0.375], [-0.3125, 0.55, 0.375], [-0.25, 0.55, 0.375], [-0.1875, 0.55, 0.375], [-0.125, 0.55, 0.375], [-0.0625, 0.55, 0.375], [0, 0.55, 0.375], [0.0625, 0.55, 0.375], [0.125, 0.55, 0.375], [0.1875, 0.55, 0.375], [0.25, 0.55, 0.375], [0.3125, 0.55, 0.375], [0.375, 0.55, 0.375], [0.4375, 0.55, 0.375], [0.5, 0.55, 0.375], [-0.5, 0.55, 0.4375], [-0.4375, 0.55, 0.4375], [-0.375, 0.55, 0.4375], [-0.3125, 0.55, 0.4375], [-0.25, 0.55, 0.4375], [-0.1875, 0.55, 0.4375], [-0.125, 0.55, 0.4375], [-0.0625, 0.55, 0.4375], [0, 0.55, 0.4375], [0.0625, 0.55, 0.4375], [0.125, 0.55, 0.4375], [0.1875, 0.55, 0.4375], [0.25, 0.55, 0.4375], [0.3125, 0.55, 0.4375], [0.375, 0.55, 0.4375], [0.4375, 0.55, 0.4375], [0.5, 0.55, 0.4375], [-0.5, 0.55, 0.5], [-0.4375, 0.55, 0.5], [-0.375, 0.55, 0.5], [-0.3125, 0.55, 0.5], [-0.25, 0.55, 0.5], [-0.1875, 0.55, 0.5], [-0.125, 0.55, 0.5], [-0.0625, 0.55, 0.5], [0, 0.55, 0.5], [0.0625, 0.55, 0.5], [0.125, 0.55, 0.5], [0.1875, 0.55, 0.5], [0.25, 0.55, 0.5], [0.3125, 0.55, 0.5], [0.375, 0.55, 0.5], [0.4375, 0.55, 0.5], [0.5, 0.55, 0.5]], "initialVelocitiesMps": [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], "vertexMassesKg": [13020833333333333e-20, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 26041666666666666e-20, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 390625e-9, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 7812499999999999e-19, 390625e-9, 26041666666666666e-20, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 390625e-9, 13020833333333333e-20], "triangles": [[0, 17, 1], [1, 17, 18], [1, 18, 2], [2, 18, 19], [2, 19, 3], [3, 19, 20], [3, 20, 4], [4, 20, 21], [4, 21, 5], [5, 21, 22], [5, 22, 6], [6, 22, 23], [6, 23, 7], [7, 23, 24], [7, 24, 8], [8, 24, 25], [8, 25, 9], [9, 25, 26], [9, 26, 10], [10, 26, 27], [10, 27, 11], [11, 27, 28], [11, 28, 12], [12, 28, 29], [12, 29, 13], [13, 29, 30], [13, 30, 14], [14, 30, 31], [14, 31, 15], [15, 31, 32], [15, 32, 16], [16, 32, 33], [17, 34, 18], [18, 34, 35], [18, 35, 19], [19, 35, 36], [19, 36, 20], [20, 36, 37], [20, 37, 21], [21, 37, 38], [21, 38, 22], [22, 38, 39], [22, 39, 23], [23, 39, 40], [23, 40, 24], [24, 40, 41], [24, 41, 25], [25, 41, 42], [25, 42, 26], [26, 42, 43], [26, 43, 27], [27, 43, 44], [27, 44, 28], [28, 44, 45], [28, 45, 29], [29, 45, 46], [29, 46, 30], [30, 46, 47], [30, 47, 31], [31, 47, 48], [31, 48, 32], [32, 48, 49], [32, 49, 33], [33, 49, 50], [34, 51, 35], [35, 51, 52], [35, 52, 36], [36, 52, 53], [36, 53, 37], [37, 53, 54], [37, 54, 38], [38, 54, 55], [38, 55, 39], [39, 55, 56], [39, 56, 40], [40, 56, 57], [40, 57, 41], [41, 57, 58], [41, 58, 42], [42, 58, 59], [42, 59, 43], [43, 59, 60], [43, 60, 44], [44, 60, 61], [44, 61, 45], [45, 61, 62], [45, 62, 46], [46, 62, 63], [46, 63, 47], [47, 63, 64], [47, 64, 48], [48, 64, 65], [48, 65, 49], [49, 65, 66], [49, 66, 50], [50, 66, 67], [51, 68, 52], [52, 68, 69], [52, 69, 53], [53, 69, 70], [53, 70, 54], [54, 70, 71], [54, 71, 55], [55, 71, 72], [55, 72, 56], [56, 72, 73], [56, 73, 57], [57, 73, 74], [57, 74, 58], [58, 74, 75], [58, 75, 59], [59, 75, 76], [59, 76, 60], [60, 76, 77], [60, 77, 61], [61, 77, 78], [61, 78, 62], [62, 78, 79], [62, 79, 63], [63, 79, 80], [63, 80, 64], [64, 80, 81], [64, 81, 65], [65, 81, 82], [65, 82, 66], [66, 82, 83], [66, 83, 67], [67, 83, 84], [68, 85, 69], [69, 85, 86], [69, 86, 70], [70, 86, 87], [70, 87, 71], [71, 87, 88], [71, 88, 72], [72, 88, 89], [72, 89, 73], [73, 89, 90], [73, 90, 74], [74, 90, 91], [74, 91, 75], [75, 91, 92], [75, 92, 76], [76, 92, 93], [76, 93, 77], [77, 93, 94], [77, 94, 78], [78, 94, 95], [78, 95, 79], [79, 95, 96], [79, 96, 80], [80, 96, 97], [80, 97, 81], [81, 97, 98], [81, 98, 82], [82, 98, 99], [82, 99, 83], [83, 99, 100], [83, 100, 84], [84, 100, 101], [85, 102, 86], [86, 102, 103], [86, 103, 87], [87, 103, 104], [87, 104, 88], [88, 104, 105], [88, 105, 89], [89, 105, 106], [89, 106, 90], [90, 106, 107], [90, 107, 91], [91, 107, 108], [91, 108, 92], [92, 108, 109], [92, 109, 93], [93, 109, 110], [93, 110, 94], [94, 110, 111], [94, 111, 95], [95, 111, 112], [95, 112, 96], [96, 112, 113], [96, 113, 97], [97, 113, 114], [97, 114, 98], [98, 114, 115], [98, 115, 99], [99, 115, 116], [99, 116, 100], [100, 116, 117], [100, 117, 101], [101, 117, 118], [102, 119, 103], [103, 119, 120], [103, 120, 104], [104, 120, 121], [104, 121, 105], [105, 121, 122], [105, 122, 106], [106, 122, 123], [106, 123, 107], [107, 123, 124], [107, 124, 108], [108, 124, 125], [108, 125, 109], [109, 125, 126], [109, 126, 110], [110, 126, 127], [110, 127, 111], [111, 127, 128], [111, 128, 112], [112, 128, 129], [112, 129, 113], [113, 129, 130], [113, 130, 114], [114, 130, 131], [114, 131, 115], [115, 131, 132], [115, 132, 116], [116, 132, 133], [116, 133, 117], [117, 133, 134], [117, 134, 118], [118, 134, 135], [119, 136, 120], [120, 136, 137], [120, 137, 121], [121, 137, 138], [121, 138, 122], [122, 138, 139], [122, 139, 123], [123, 139, 140], [123, 140, 124], [124, 140, 141], [124, 141, 125], [125, 141, 142], [125, 142, 126], [126, 142, 143], [126, 143, 127], [127, 143, 144], [127, 144, 128], [128, 144, 145], [128, 145, 129], [129, 145, 146], [129, 146, 130], [130, 146, 147], [130, 147, 131], [131, 147, 148], [131, 148, 132], [132, 148, 149], [132, 149, 133], [133, 149, 150], [133, 150, 134], [134, 150, 151], [134, 151, 135], [135, 151, 152], [136, 153, 137], [137, 153, 154], [137, 154, 138], [138, 154, 155], [138, 155, 139], [139, 155, 156], [139, 156, 140], [140, 156, 157], [140, 157, 141], [141, 157, 158], [141, 158, 142], [142, 158, 159], [142, 159, 143], [143, 159, 160], [143, 160, 144], [144, 160, 161], [144, 161, 145], [145, 161, 162], [145, 162, 146], [146, 162, 163], [146, 163, 147], [147, 163, 164], [147, 164, 148], [148, 164, 165], [148, 165, 149], [149, 165, 166], [149, 166, 150], [150, 166, 167], [150, 167, 151], [151, 167, 168], [151, 168, 152], [152, 168, 169], [153, 170, 154], [154, 170, 171], [154, 171, 155], [155, 171, 172], [155, 172, 156], [156, 172, 173], [156, 173, 157], [157, 173, 174], [157, 174, 158], [158, 174, 175], [158, 175, 159], [159, 175, 176], [159, 176, 160], [160, 176, 177], [160, 177, 161], [161, 177, 178], [161, 178, 162], [162, 178, 179], [162, 179, 163], [163, 179, 180], [163, 180, 164], [164, 180, 181], [164, 181, 165], [165, 181, 182], [165, 182, 166], [166, 182, 183], [166, 183, 167], [167, 183, 184], [167, 184, 168], [168, 184, 185], [168, 185, 169], [169, 185, 186], [170, 187, 171], [171, 187, 188], [171, 188, 172], [172, 188, 189], [172, 189, 173], [173, 189, 190], [173, 190, 174], [174, 190, 191], [174, 191, 175], [175, 191, 192], [175, 192, 176], [176, 192, 193], [176, 193, 177], [177, 193, 194], [177, 194, 178], [178, 194, 195], [178, 195, 179], [179, 195, 196], [179, 196, 180], [180, 196, 197], [180, 197, 181], [181, 197, 198], [181, 198, 182], [182, 198, 199], [182, 199, 183], [183, 199, 200], [183, 200, 184], [184, 200, 201], [184, 201, 185], [185, 201, 202], [185, 202, 186], [186, 202, 203], [187, 204, 188], [188, 204, 205], [188, 205, 189], [189, 205, 206], [189, 206, 190], [190, 206, 207], [190, 207, 191], [191, 207, 208], [191, 208, 192], [192, 208, 209], [192, 209, 193], [193, 209, 210], [193, 210, 194], [194, 210, 211], [194, 211, 195], [195, 211, 212], [195, 212, 196], [196, 212, 213], [196, 213, 197], [197, 213, 214], [197, 214, 198], [198, 214, 215], [198, 215, 199], [199, 215, 216], [199, 216, 200], [200, 216, 217], [200, 217, 201], [201, 217, 218], [201, 218, 202], [202, 218, 219], [202, 219, 203], [203, 219, 220], [204, 221, 205], [205, 221, 222], [205, 222, 206], [206, 222, 223], [206, 223, 207], [207, 223, 224], [207, 224, 208], [208, 224, 225], [208, 225, 209], [209, 225, 226], [209, 226, 210], [210, 226, 227], [210, 227, 211], [211, 227, 228], [211, 228, 212], [212, 228, 229], [212, 229, 213], [213, 229, 230], [213, 230, 214], [214, 230, 231], [214, 231, 215], [215, 231, 232], [215, 232, 216], [216, 232, 233], [216, 233, 217], [217, 233, 234], [217, 234, 218], [218, 234, 235], [218, 235, 219], [219, 235, 236], [219, 236, 220], [220, 236, 237], [221, 238, 222], [222, 238, 239], [222, 239, 223], [223, 239, 240], [223, 240, 224], [224, 240, 241], [224, 241, 225], [225, 241, 242], [225, 242, 226], [226, 242, 243], [226, 243, 227], [227, 243, 244], [227, 244, 228], [228, 244, 245], [228, 245, 229], [229, 245, 246], [229, 246, 230], [230, 246, 247], [230, 247, 231], [231, 247, 248], [231, 248, 232], [232, 248, 249], [232, 249, 233], [233, 249, 250], [233, 250, 234], [234, 250, 251], [234, 251, 235], [235, 251, 252], [235, 252, 236], [236, 252, 253], [236, 253, 237], [237, 253, 254], [238, 255, 239], [239, 255, 256], [239, 256, 240], [240, 256, 257], [240, 257, 241], [241, 257, 258], [241, 258, 242], [242, 258, 259], [242, 259, 243], [243, 259, 260], [243, 260, 244], [244, 260, 261], [244, 261, 245], [245, 261, 262], [245, 262, 246], [246, 262, 263], [246, 263, 247], [247, 263, 264], [247, 264, 248], [248, 264, 265], [248, 265, 249], [249, 265, 266], [249, 266, 250], [250, 266, 267], [250, 267, 251], [251, 267, 268], [251, 268, 252], [252, 268, 269], [252, 269, 253], [253, 269, 270], [253, 270, 254], [254, 270, 271], [255, 272, 256], [256, 272, 273], [256, 273, 257], [257, 273, 274], [257, 274, 258], [258, 274, 275], [258, 275, 259], [259, 275, 276], [259, 276, 260], [260, 276, 277], [260, 277, 261], [261, 277, 278], [261, 278, 262], [262, 278, 279], [262, 279, 263], [263, 279, 280], [263, 280, 264], [264, 280, 281], [264, 281, 265], [265, 281, 282], [265, 282, 266], [266, 282, 283], [266, 283, 267], [267, 283, 284], [267, 284, 268], [268, 284, 285], [268, 285, 269], [269, 285, 286], [269, 286, 270], [270, 286, 287], [270, 287, 271], [271, 287, 288]], "pinnedVertexIndices": [0, 16], "constraints": [{ "a": 0, "b": 1, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 0, "b": 17, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 0, "b": 18, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 1, "b": 17, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 0, "b": 2, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 0, "b": 34, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 1, "b": 2, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 1, "b": 18, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 1, "b": 19, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 2, "b": 18, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 1, "b": 3, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 1, "b": 35, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 2, "b": 3, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 2, "b": 19, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 2, "b": 20, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 3, "b": 19, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 2, "b": 4, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 2, "b": 36, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 3, "b": 4, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 3, "b": 20, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 3, "b": 21, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 4, "b": 20, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 3, "b": 5, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 3, "b": 37, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 4, "b": 5, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 4, "b": 21, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 4, "b": 22, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 5, "b": 21, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 4, "b": 6, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 4, "b": 38, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 5, "b": 6, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 5, "b": 22, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 5, "b": 23, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 6, "b": 22, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 5, "b": 7, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 5, "b": 39, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 6, "b": 7, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 6, "b": 23, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 6, "b": 24, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 7, "b": 23, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 6, "b": 8, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 6, "b": 40, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 7, "b": 8, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 7, "b": 24, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 7, "b": 25, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 8, "b": 24, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 7, "b": 9, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 7, "b": 41, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 8, "b": 9, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 8, "b": 25, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 8, "b": 26, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 9, "b": 25, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 8, "b": 10, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 8, "b": 42, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 9, "b": 10, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 9, "b": 26, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 9, "b": 27, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 10, "b": 26, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 9, "b": 11, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 9, "b": 43, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 10, "b": 11, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 10, "b": 27, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 10, "b": 28, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 11, "b": 27, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 10, "b": 12, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 10, "b": 44, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 11, "b": 12, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 11, "b": 28, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 11, "b": 29, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 12, "b": 28, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 11, "b": 13, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 11, "b": 45, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 12, "b": 13, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 12, "b": 29, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 12, "b": 30, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 13, "b": 29, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 12, "b": 14, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 12, "b": 46, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 13, "b": 14, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 13, "b": 30, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 13, "b": 31, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 14, "b": 30, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 13, "b": 15, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 13, "b": 47, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 14, "b": 15, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 14, "b": 31, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 14, "b": 32, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 15, "b": 31, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 14, "b": 16, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 14, "b": 48, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 15, "b": 16, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 15, "b": 32, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 15, "b": 33, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 16, "b": 32, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 15, "b": 49, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 16, "b": 33, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 16, "b": 50, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 17, "b": 18, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 17, "b": 34, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 17, "b": 35, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 18, "b": 34, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 17, "b": 19, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 17, "b": 51, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 18, "b": 19, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 18, "b": 35, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 18, "b": 36, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 19, "b": 35, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 18, "b": 20, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 18, "b": 52, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 19, "b": 20, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 19, "b": 36, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 19, "b": 37, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 20, "b": 36, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 19, "b": 21, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 19, "b": 53, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 20, "b": 21, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 20, "b": 37, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 20, "b": 38, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 21, "b": 37, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 20, "b": 22, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 20, "b": 54, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 21, "b": 22, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 21, "b": 38, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 21, "b": 39, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 22, "b": 38, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 21, "b": 23, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 21, "b": 55, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 22, "b": 23, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 22, "b": 39, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 22, "b": 40, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 23, "b": 39, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 22, "b": 24, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 22, "b": 56, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 23, "b": 24, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 23, "b": 40, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 23, "b": 41, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 24, "b": 40, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 23, "b": 25, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 23, "b": 57, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 24, "b": 25, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 24, "b": 41, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 24, "b": 42, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 25, "b": 41, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 24, "b": 26, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 24, "b": 58, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 25, "b": 26, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 25, "b": 42, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 25, "b": 43, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 26, "b": 42, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 25, "b": 27, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 25, "b": 59, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 26, "b": 27, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 26, "b": 43, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 26, "b": 44, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 27, "b": 43, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 26, "b": 28, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 26, "b": 60, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 27, "b": 28, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 27, "b": 44, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 27, "b": 45, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 28, "b": 44, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 27, "b": 29, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 27, "b": 61, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 28, "b": 29, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 28, "b": 45, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 28, "b": 46, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 29, "b": 45, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 28, "b": 30, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 28, "b": 62, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 29, "b": 30, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 29, "b": 46, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 29, "b": 47, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 30, "b": 46, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 29, "b": 31, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 29, "b": 63, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 30, "b": 31, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 30, "b": 47, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 30, "b": 48, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 31, "b": 47, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 30, "b": 32, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 30, "b": 64, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 31, "b": 32, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 31, "b": 48, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 31, "b": 49, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 32, "b": 48, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 31, "b": 33, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 31, "b": 65, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 32, "b": 33, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 32, "b": 49, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 32, "b": 50, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 33, "b": 49, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 32, "b": 66, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 33, "b": 50, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 33, "b": 67, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 34, "b": 35, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 34, "b": 51, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 34, "b": 52, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 35, "b": 51, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 34, "b": 36, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 34, "b": 68, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 35, "b": 36, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 35, "b": 52, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 35, "b": 53, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 36, "b": 52, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 35, "b": 37, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 35, "b": 69, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 36, "b": 37, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 36, "b": 53, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 36, "b": 54, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 37, "b": 53, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 36, "b": 38, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 36, "b": 70, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 37, "b": 38, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 37, "b": 54, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 37, "b": 55, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 38, "b": 54, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 37, "b": 39, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 37, "b": 71, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 38, "b": 39, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 38, "b": 55, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 38, "b": 56, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 39, "b": 55, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 38, "b": 40, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 38, "b": 72, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 39, "b": 40, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 39, "b": 56, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 39, "b": 57, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 40, "b": 56, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 39, "b": 41, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 39, "b": 73, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 40, "b": 41, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 40, "b": 57, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 40, "b": 58, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 41, "b": 57, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 40, "b": 42, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 40, "b": 74, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 41, "b": 42, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 41, "b": 58, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 41, "b": 59, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 42, "b": 58, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 41, "b": 43, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 41, "b": 75, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 42, "b": 43, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 42, "b": 59, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 42, "b": 60, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 43, "b": 59, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 42, "b": 44, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 42, "b": 76, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 43, "b": 44, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 43, "b": 60, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 43, "b": 61, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 44, "b": 60, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 43, "b": 45, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 43, "b": 77, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 44, "b": 45, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 44, "b": 61, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 44, "b": 62, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 45, "b": 61, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 44, "b": 46, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 44, "b": 78, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 45, "b": 46, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 45, "b": 62, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 45, "b": 63, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 46, "b": 62, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 45, "b": 47, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 45, "b": 79, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 46, "b": 47, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 46, "b": 63, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 46, "b": 64, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 47, "b": 63, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 46, "b": 48, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 46, "b": 80, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 47, "b": 48, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 47, "b": 64, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 47, "b": 65, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 48, "b": 64, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 47, "b": 49, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 47, "b": 81, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 48, "b": 49, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 48, "b": 65, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 48, "b": 66, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 49, "b": 65, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 48, "b": 50, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 48, "b": 82, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 49, "b": 50, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 49, "b": 66, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 49, "b": 67, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 50, "b": 66, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 49, "b": 83, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 50, "b": 67, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 50, "b": 84, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 51, "b": 52, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 51, "b": 68, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 51, "b": 69, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 52, "b": 68, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 51, "b": 53, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 51, "b": 85, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 52, "b": 53, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 52, "b": 69, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 52, "b": 70, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 53, "b": 69, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 52, "b": 54, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 52, "b": 86, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 53, "b": 54, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 53, "b": 70, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 53, "b": 71, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 54, "b": 70, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 53, "b": 55, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 53, "b": 87, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 54, "b": 55, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 54, "b": 71, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 54, "b": 72, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 55, "b": 71, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 54, "b": 56, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 54, "b": 88, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 55, "b": 56, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 55, "b": 72, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 55, "b": 73, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 56, "b": 72, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 55, "b": 57, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 55, "b": 89, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 56, "b": 57, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 56, "b": 73, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 56, "b": 74, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 57, "b": 73, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 56, "b": 58, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 56, "b": 90, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 57, "b": 58, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 57, "b": 74, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 57, "b": 75, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 58, "b": 74, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 57, "b": 59, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 57, "b": 91, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 58, "b": 59, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 58, "b": 75, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 58, "b": 76, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 59, "b": 75, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 58, "b": 60, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 58, "b": 92, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 59, "b": 60, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 59, "b": 76, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 59, "b": 77, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 60, "b": 76, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 59, "b": 61, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 59, "b": 93, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 60, "b": 61, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 60, "b": 77, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 60, "b": 78, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 61, "b": 77, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 60, "b": 62, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 60, "b": 94, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 61, "b": 62, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 61, "b": 78, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 61, "b": 79, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 62, "b": 78, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 61, "b": 63, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 61, "b": 95, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 62, "b": 63, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 62, "b": 79, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 62, "b": 80, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 63, "b": 79, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 62, "b": 64, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 62, "b": 96, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 63, "b": 64, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 63, "b": 80, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 63, "b": 81, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 64, "b": 80, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 63, "b": 65, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 63, "b": 97, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 64, "b": 65, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 64, "b": 81, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 64, "b": 82, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 65, "b": 81, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 64, "b": 66, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 64, "b": 98, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 65, "b": 66, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 65, "b": 82, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 65, "b": 83, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 66, "b": 82, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 65, "b": 67, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 65, "b": 99, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 66, "b": 67, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 66, "b": 83, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 66, "b": 84, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 67, "b": 83, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 66, "b": 100, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 67, "b": 84, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 67, "b": 101, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 68, "b": 69, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 68, "b": 85, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 68, "b": 86, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 69, "b": 85, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 68, "b": 70, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 68, "b": 102, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 69, "b": 70, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 69, "b": 86, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 69, "b": 87, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 70, "b": 86, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 69, "b": 71, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 69, "b": 103, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 70, "b": 71, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 70, "b": 87, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 70, "b": 88, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 71, "b": 87, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 70, "b": 72, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 70, "b": 104, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 71, "b": 72, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 71, "b": 88, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 71, "b": 89, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 72, "b": 88, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 71, "b": 73, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 71, "b": 105, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 72, "b": 73, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 72, "b": 89, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 72, "b": 90, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 73, "b": 89, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 72, "b": 74, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 72, "b": 106, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 73, "b": 74, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 73, "b": 90, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 73, "b": 91, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 74, "b": 90, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 73, "b": 75, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 73, "b": 107, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 74, "b": 75, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 74, "b": 91, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 74, "b": 92, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 75, "b": 91, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 74, "b": 76, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 74, "b": 108, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 75, "b": 76, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 75, "b": 92, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 75, "b": 93, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 76, "b": 92, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 75, "b": 77, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 75, "b": 109, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 76, "b": 77, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 76, "b": 93, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 76, "b": 94, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 77, "b": 93, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 76, "b": 78, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 76, "b": 110, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 77, "b": 78, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 77, "b": 94, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 77, "b": 95, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 78, "b": 94, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 77, "b": 79, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 77, "b": 111, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 78, "b": 79, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 78, "b": 95, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 78, "b": 96, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 79, "b": 95, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 78, "b": 80, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 78, "b": 112, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 79, "b": 80, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 79, "b": 96, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 79, "b": 97, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 80, "b": 96, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 79, "b": 81, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 79, "b": 113, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 80, "b": 81, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 80, "b": 97, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 80, "b": 98, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 81, "b": 97, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 80, "b": 82, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 80, "b": 114, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 81, "b": 82, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 81, "b": 98, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 81, "b": 99, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 82, "b": 98, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 81, "b": 83, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 81, "b": 115, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 82, "b": 83, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 82, "b": 99, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 82, "b": 100, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 83, "b": 99, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 82, "b": 84, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 82, "b": 116, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 83, "b": 84, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 83, "b": 100, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 83, "b": 101, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 84, "b": 100, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 83, "b": 117, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 84, "b": 101, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 84, "b": 118, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 85, "b": 86, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 85, "b": 102, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 85, "b": 103, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 86, "b": 102, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 85, "b": 87, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 85, "b": 119, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 86, "b": 87, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 86, "b": 103, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 86, "b": 104, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 87, "b": 103, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 86, "b": 88, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 86, "b": 120, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 87, "b": 88, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 87, "b": 104, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 87, "b": 105, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 88, "b": 104, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 87, "b": 89, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 87, "b": 121, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 88, "b": 89, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 88, "b": 105, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 88, "b": 106, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 89, "b": 105, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 88, "b": 90, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 88, "b": 122, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 89, "b": 90, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 89, "b": 106, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 89, "b": 107, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 90, "b": 106, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 89, "b": 91, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 89, "b": 123, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 90, "b": 91, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 90, "b": 107, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 90, "b": 108, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 91, "b": 107, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 90, "b": 92, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 90, "b": 124, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 91, "b": 92, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 91, "b": 108, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 91, "b": 109, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 92, "b": 108, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 91, "b": 93, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 91, "b": 125, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 92, "b": 93, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 92, "b": 109, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 92, "b": 110, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 93, "b": 109, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 92, "b": 94, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 92, "b": 126, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 93, "b": 94, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 93, "b": 110, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 93, "b": 111, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 94, "b": 110, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 93, "b": 95, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 93, "b": 127, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 94, "b": 95, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 94, "b": 111, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 94, "b": 112, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 95, "b": 111, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 94, "b": 96, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 94, "b": 128, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 95, "b": 96, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 95, "b": 112, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 95, "b": 113, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 96, "b": 112, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 95, "b": 97, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 95, "b": 129, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 96, "b": 97, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 96, "b": 113, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 96, "b": 114, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 97, "b": 113, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 96, "b": 98, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 96, "b": 130, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 97, "b": 98, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 97, "b": 114, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 97, "b": 115, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 98, "b": 114, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 97, "b": 99, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 97, "b": 131, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 98, "b": 99, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 98, "b": 115, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 98, "b": 116, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 99, "b": 115, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 98, "b": 100, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 98, "b": 132, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 99, "b": 100, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 99, "b": 116, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 99, "b": 117, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 100, "b": 116, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 99, "b": 101, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 99, "b": 133, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 100, "b": 101, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 100, "b": 117, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 100, "b": 118, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 101, "b": 117, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 100, "b": 134, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 101, "b": 118, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 101, "b": 135, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 102, "b": 103, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 102, "b": 119, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 102, "b": 120, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 103, "b": 119, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 102, "b": 104, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 102, "b": 136, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 103, "b": 104, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 103, "b": 120, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 103, "b": 121, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 104, "b": 120, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 103, "b": 105, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 103, "b": 137, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 104, "b": 105, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 104, "b": 121, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 104, "b": 122, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 105, "b": 121, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 104, "b": 106, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 104, "b": 138, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 105, "b": 106, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 105, "b": 122, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 105, "b": 123, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 106, "b": 122, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 105, "b": 107, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 105, "b": 139, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 106, "b": 107, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 106, "b": 123, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 106, "b": 124, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 107, "b": 123, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 106, "b": 108, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 106, "b": 140, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 107, "b": 108, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 107, "b": 124, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 107, "b": 125, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 108, "b": 124, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 107, "b": 109, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 107, "b": 141, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 108, "b": 109, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 108, "b": 125, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 108, "b": 126, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 109, "b": 125, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 108, "b": 110, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 108, "b": 142, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 109, "b": 110, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 109, "b": 126, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 109, "b": 127, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 110, "b": 126, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 109, "b": 111, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 109, "b": 143, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 110, "b": 111, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 110, "b": 127, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 110, "b": 128, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 111, "b": 127, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 110, "b": 112, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 110, "b": 144, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 111, "b": 112, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 111, "b": 128, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 111, "b": 129, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 112, "b": 128, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 111, "b": 113, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 111, "b": 145, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 112, "b": 113, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 112, "b": 129, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 112, "b": 130, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 113, "b": 129, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 112, "b": 114, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 112, "b": 146, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 113, "b": 114, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 113, "b": 130, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 113, "b": 131, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 114, "b": 130, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 113, "b": 115, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 113, "b": 147, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 114, "b": 115, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 114, "b": 131, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 114, "b": 132, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 115, "b": 131, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 114, "b": 116, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 114, "b": 148, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 115, "b": 116, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 115, "b": 132, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 115, "b": 133, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 116, "b": 132, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 115, "b": 117, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 115, "b": 149, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 116, "b": 117, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 116, "b": 133, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 116, "b": 134, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 117, "b": 133, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 116, "b": 118, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 116, "b": 150, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 117, "b": 118, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 117, "b": 134, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 117, "b": 135, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 118, "b": 134, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 117, "b": 151, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 118, "b": 135, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 118, "b": 152, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 119, "b": 120, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 119, "b": 136, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 119, "b": 137, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 120, "b": 136, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 119, "b": 121, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 119, "b": 153, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 120, "b": 121, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 120, "b": 137, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 120, "b": 138, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 121, "b": 137, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 120, "b": 122, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 120, "b": 154, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 121, "b": 122, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 121, "b": 138, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 121, "b": 139, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 122, "b": 138, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 121, "b": 123, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 121, "b": 155, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 122, "b": 123, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 122, "b": 139, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 122, "b": 140, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 123, "b": 139, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 122, "b": 124, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 122, "b": 156, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 123, "b": 124, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 123, "b": 140, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 123, "b": 141, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 124, "b": 140, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 123, "b": 125, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 123, "b": 157, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 124, "b": 125, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 124, "b": 141, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 124, "b": 142, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 125, "b": 141, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 124, "b": 126, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 124, "b": 158, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 125, "b": 126, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 125, "b": 142, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 125, "b": 143, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 126, "b": 142, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 125, "b": 127, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 125, "b": 159, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 126, "b": 127, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 126, "b": 143, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 126, "b": 144, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 127, "b": 143, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 126, "b": 128, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 126, "b": 160, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 127, "b": 128, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 127, "b": 144, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 127, "b": 145, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 128, "b": 144, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 127, "b": 129, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 127, "b": 161, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 128, "b": 129, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 128, "b": 145, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 128, "b": 146, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 129, "b": 145, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 128, "b": 130, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 128, "b": 162, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 129, "b": 130, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 129, "b": 146, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 129, "b": 147, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 130, "b": 146, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 129, "b": 131, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 129, "b": 163, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 130, "b": 131, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 130, "b": 147, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 130, "b": 148, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 131, "b": 147, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 130, "b": 132, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 130, "b": 164, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 131, "b": 132, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 131, "b": 148, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 131, "b": 149, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 132, "b": 148, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 131, "b": 133, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 131, "b": 165, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 132, "b": 133, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 132, "b": 149, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 132, "b": 150, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 133, "b": 149, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 132, "b": 134, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 132, "b": 166, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 133, "b": 134, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 133, "b": 150, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 133, "b": 151, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 134, "b": 150, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 133, "b": 135, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 133, "b": 167, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 134, "b": 135, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 134, "b": 151, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 134, "b": 152, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 135, "b": 151, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 134, "b": 168, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 135, "b": 152, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 135, "b": 169, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 136, "b": 137, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 136, "b": 153, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 136, "b": 154, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 137, "b": 153, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 136, "b": 138, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 136, "b": 170, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 137, "b": 138, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 137, "b": 154, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 137, "b": 155, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 138, "b": 154, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 137, "b": 139, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 137, "b": 171, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 138, "b": 139, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 138, "b": 155, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 138, "b": 156, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 139, "b": 155, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 138, "b": 140, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 138, "b": 172, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 139, "b": 140, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 139, "b": 156, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 139, "b": 157, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 140, "b": 156, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 139, "b": 141, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 139, "b": 173, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 140, "b": 141, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 140, "b": 157, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 140, "b": 158, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 141, "b": 157, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 140, "b": 142, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 140, "b": 174, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 141, "b": 142, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 141, "b": 158, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 141, "b": 159, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 142, "b": 158, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 141, "b": 143, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 141, "b": 175, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 142, "b": 143, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 142, "b": 159, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 142, "b": 160, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 143, "b": 159, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 142, "b": 144, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 142, "b": 176, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 143, "b": 144, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 143, "b": 160, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 143, "b": 161, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 144, "b": 160, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 143, "b": 145, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 143, "b": 177, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 144, "b": 145, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 144, "b": 161, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 144, "b": 162, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 145, "b": 161, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 144, "b": 146, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 144, "b": 178, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 145, "b": 146, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 145, "b": 162, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 145, "b": 163, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 146, "b": 162, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 145, "b": 147, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 145, "b": 179, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 146, "b": 147, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 146, "b": 163, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 146, "b": 164, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 147, "b": 163, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 146, "b": 148, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 146, "b": 180, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 147, "b": 148, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 147, "b": 164, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 147, "b": 165, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 148, "b": 164, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 147, "b": 149, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 147, "b": 181, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 148, "b": 149, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 148, "b": 165, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 148, "b": 166, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 149, "b": 165, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 148, "b": 150, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 148, "b": 182, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 149, "b": 150, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 149, "b": 166, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 149, "b": 167, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 150, "b": 166, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 149, "b": 151, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 149, "b": 183, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 150, "b": 151, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 150, "b": 167, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 150, "b": 168, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 151, "b": 167, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 150, "b": 152, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 150, "b": 184, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 151, "b": 152, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 151, "b": 168, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 151, "b": 169, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 152, "b": 168, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 151, "b": 185, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 152, "b": 169, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 152, "b": 186, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 153, "b": 154, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 153, "b": 170, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 153, "b": 171, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 154, "b": 170, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 153, "b": 155, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 153, "b": 187, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 154, "b": 155, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 154, "b": 171, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 154, "b": 172, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 155, "b": 171, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 154, "b": 156, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 154, "b": 188, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 155, "b": 156, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 155, "b": 172, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 155, "b": 173, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 156, "b": 172, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 155, "b": 157, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 155, "b": 189, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 156, "b": 157, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 156, "b": 173, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 156, "b": 174, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 157, "b": 173, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 156, "b": 158, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 156, "b": 190, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 157, "b": 158, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 157, "b": 174, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 157, "b": 175, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 158, "b": 174, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 157, "b": 159, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 157, "b": 191, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 158, "b": 159, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 158, "b": 175, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 158, "b": 176, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 159, "b": 175, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 158, "b": 160, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 158, "b": 192, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 159, "b": 160, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 159, "b": 176, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 159, "b": 177, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 160, "b": 176, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 159, "b": 161, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 159, "b": 193, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 160, "b": 161, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 160, "b": 177, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 160, "b": 178, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 161, "b": 177, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 160, "b": 162, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 160, "b": 194, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 161, "b": 162, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 161, "b": 178, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 161, "b": 179, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 162, "b": 178, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 161, "b": 163, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 161, "b": 195, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 162, "b": 163, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 162, "b": 179, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 162, "b": 180, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 163, "b": 179, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 162, "b": 164, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 162, "b": 196, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 163, "b": 164, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 163, "b": 180, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 163, "b": 181, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 164, "b": 180, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 163, "b": 165, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 163, "b": 197, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 164, "b": 165, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 164, "b": 181, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 164, "b": 182, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 165, "b": 181, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 164, "b": 166, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 164, "b": 198, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 165, "b": 166, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 165, "b": 182, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 165, "b": 183, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 166, "b": 182, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 165, "b": 167, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 165, "b": 199, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 166, "b": 167, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 166, "b": 183, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 166, "b": 184, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 167, "b": 183, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 166, "b": 168, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 166, "b": 200, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 167, "b": 168, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 167, "b": 184, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 167, "b": 185, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 168, "b": 184, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 167, "b": 169, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 167, "b": 201, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 168, "b": 169, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 168, "b": 185, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 168, "b": 186, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 169, "b": 185, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 168, "b": 202, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 169, "b": 186, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 169, "b": 203, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 170, "b": 171, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 170, "b": 187, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 170, "b": 188, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 171, "b": 187, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 170, "b": 172, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 170, "b": 204, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 171, "b": 172, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 171, "b": 188, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 171, "b": 189, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 172, "b": 188, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 171, "b": 173, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 171, "b": 205, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 172, "b": 173, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 172, "b": 189, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 172, "b": 190, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 173, "b": 189, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 172, "b": 174, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 172, "b": 206, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 173, "b": 174, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 173, "b": 190, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 173, "b": 191, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 174, "b": 190, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 173, "b": 175, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 173, "b": 207, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 174, "b": 175, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 174, "b": 191, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 174, "b": 192, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 175, "b": 191, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 174, "b": 176, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 174, "b": 208, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 175, "b": 176, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 175, "b": 192, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 175, "b": 193, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 176, "b": 192, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 175, "b": 177, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 175, "b": 209, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 176, "b": 177, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 176, "b": 193, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 176, "b": 194, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 177, "b": 193, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 176, "b": 178, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 176, "b": 210, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 177, "b": 178, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 177, "b": 194, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 177, "b": 195, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 178, "b": 194, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 177, "b": 179, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 177, "b": 211, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 178, "b": 179, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 178, "b": 195, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 178, "b": 196, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 179, "b": 195, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 178, "b": 180, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 178, "b": 212, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 179, "b": 180, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 179, "b": 196, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 179, "b": 197, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 180, "b": 196, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 179, "b": 181, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 179, "b": 213, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 180, "b": 181, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 180, "b": 197, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 180, "b": 198, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 181, "b": 197, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 180, "b": 182, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 180, "b": 214, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 181, "b": 182, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 181, "b": 198, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 181, "b": 199, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 182, "b": 198, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 181, "b": 183, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 181, "b": 215, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 182, "b": 183, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 182, "b": 199, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 182, "b": 200, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 183, "b": 199, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 182, "b": 184, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 182, "b": 216, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 183, "b": 184, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 183, "b": 200, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 183, "b": 201, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 184, "b": 200, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 183, "b": 185, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 183, "b": 217, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 184, "b": 185, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 184, "b": 201, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 184, "b": 202, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 185, "b": 201, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 184, "b": 186, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 184, "b": 218, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 185, "b": 186, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 185, "b": 202, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 185, "b": 203, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 186, "b": 202, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 185, "b": 219, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 186, "b": 203, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 186, "b": 220, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 187, "b": 188, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 187, "b": 204, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 187, "b": 205, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 188, "b": 204, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 187, "b": 189, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 187, "b": 221, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 188, "b": 189, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 188, "b": 205, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 188, "b": 206, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 189, "b": 205, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 188, "b": 190, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 188, "b": 222, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 189, "b": 190, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 189, "b": 206, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 189, "b": 207, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 190, "b": 206, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 189, "b": 191, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 189, "b": 223, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 190, "b": 191, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 190, "b": 207, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 190, "b": 208, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 191, "b": 207, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 190, "b": 192, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 190, "b": 224, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 191, "b": 192, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 191, "b": 208, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 191, "b": 209, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 192, "b": 208, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 191, "b": 193, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 191, "b": 225, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 192, "b": 193, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 192, "b": 209, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 192, "b": 210, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 193, "b": 209, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 192, "b": 194, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 192, "b": 226, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 193, "b": 194, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 193, "b": 210, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 193, "b": 211, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 194, "b": 210, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 193, "b": 195, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 193, "b": 227, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 194, "b": 195, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 194, "b": 211, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 194, "b": 212, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 195, "b": 211, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 194, "b": 196, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 194, "b": 228, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 195, "b": 196, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 195, "b": 212, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 195, "b": 213, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 196, "b": 212, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 195, "b": 197, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 195, "b": 229, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 196, "b": 197, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 196, "b": 213, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 196, "b": 214, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 197, "b": 213, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 196, "b": 198, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 196, "b": 230, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 197, "b": 198, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 197, "b": 214, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 197, "b": 215, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 198, "b": 214, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 197, "b": 199, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 197, "b": 231, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 198, "b": 199, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 198, "b": 215, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 198, "b": 216, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 199, "b": 215, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 198, "b": 200, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 198, "b": 232, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 199, "b": 200, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 199, "b": 216, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 199, "b": 217, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 200, "b": 216, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 199, "b": 201, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 199, "b": 233, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 200, "b": 201, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 200, "b": 217, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 200, "b": 218, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 201, "b": 217, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 200, "b": 202, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 200, "b": 234, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 201, "b": 202, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 201, "b": 218, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 201, "b": 219, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 202, "b": 218, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 201, "b": 203, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 201, "b": 235, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 202, "b": 203, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 202, "b": 219, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 202, "b": 220, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 203, "b": 219, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 202, "b": 236, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 203, "b": 220, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 203, "b": 237, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 204, "b": 205, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 204, "b": 221, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 204, "b": 222, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 205, "b": 221, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 204, "b": 206, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 204, "b": 238, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 205, "b": 206, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 205, "b": 222, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 205, "b": 223, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 206, "b": 222, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 205, "b": 207, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 205, "b": 239, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 206, "b": 207, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 206, "b": 223, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 206, "b": 224, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 207, "b": 223, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 206, "b": 208, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 206, "b": 240, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 207, "b": 208, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 207, "b": 224, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 207, "b": 225, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 208, "b": 224, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 207, "b": 209, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 207, "b": 241, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 208, "b": 209, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 208, "b": 225, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 208, "b": 226, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 209, "b": 225, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 208, "b": 210, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 208, "b": 242, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 209, "b": 210, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 209, "b": 226, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 209, "b": 227, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 210, "b": 226, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 209, "b": 211, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 209, "b": 243, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 210, "b": 211, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 210, "b": 227, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 210, "b": 228, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 211, "b": 227, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 210, "b": 212, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 210, "b": 244, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 211, "b": 212, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 211, "b": 228, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 211, "b": 229, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 212, "b": 228, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 211, "b": 213, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 211, "b": 245, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 212, "b": 213, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 212, "b": 229, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 212, "b": 230, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 213, "b": 229, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 212, "b": 214, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 212, "b": 246, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 213, "b": 214, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 213, "b": 230, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 213, "b": 231, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 214, "b": 230, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 213, "b": 215, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 213, "b": 247, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 214, "b": 215, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 214, "b": 231, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 214, "b": 232, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 215, "b": 231, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 214, "b": 216, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 214, "b": 248, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 215, "b": 216, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 215, "b": 232, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 215, "b": 233, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 216, "b": 232, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 215, "b": 217, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 215, "b": 249, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 216, "b": 217, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 216, "b": 233, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 216, "b": 234, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 217, "b": 233, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 216, "b": 218, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 216, "b": 250, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 217, "b": 218, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 217, "b": 234, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 217, "b": 235, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 218, "b": 234, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 217, "b": 219, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 217, "b": 251, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 218, "b": 219, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 218, "b": 235, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 218, "b": 236, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 219, "b": 235, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 218, "b": 220, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 218, "b": 252, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 219, "b": 220, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 219, "b": 236, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 219, "b": 237, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 220, "b": 236, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 219, "b": 253, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 220, "b": 237, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 220, "b": 254, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 221, "b": 222, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 221, "b": 238, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 221, "b": 239, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 222, "b": 238, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 221, "b": 223, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 221, "b": 255, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 222, "b": 223, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 222, "b": 239, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 222, "b": 240, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 223, "b": 239, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 222, "b": 224, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 222, "b": 256, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 223, "b": 224, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 223, "b": 240, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 223, "b": 241, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 224, "b": 240, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 223, "b": 225, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 223, "b": 257, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 224, "b": 225, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 224, "b": 241, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 224, "b": 242, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 225, "b": 241, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 224, "b": 226, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 224, "b": 258, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 225, "b": 226, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 225, "b": 242, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 225, "b": 243, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 226, "b": 242, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 225, "b": 227, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 225, "b": 259, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 226, "b": 227, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 226, "b": 243, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 226, "b": 244, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 227, "b": 243, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 226, "b": 228, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 226, "b": 260, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 227, "b": 228, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 227, "b": 244, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 227, "b": 245, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 228, "b": 244, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 227, "b": 229, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 227, "b": 261, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 228, "b": 229, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 228, "b": 245, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 228, "b": 246, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 229, "b": 245, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 228, "b": 230, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 228, "b": 262, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 229, "b": 230, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 229, "b": 246, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 229, "b": 247, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 230, "b": 246, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 229, "b": 231, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 229, "b": 263, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 230, "b": 231, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 230, "b": 247, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 230, "b": 248, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 231, "b": 247, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 230, "b": 232, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 230, "b": 264, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 231, "b": 232, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 231, "b": 248, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 231, "b": 249, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 232, "b": 248, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 231, "b": 233, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 231, "b": 265, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 232, "b": 233, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 232, "b": 249, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 232, "b": 250, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 233, "b": 249, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 232, "b": 234, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 232, "b": 266, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 233, "b": 234, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 233, "b": 250, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 233, "b": 251, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 234, "b": 250, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 233, "b": 235, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 233, "b": 267, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 234, "b": 235, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 234, "b": 251, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 234, "b": 252, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 235, "b": 251, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 234, "b": 236, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 234, "b": 268, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 235, "b": 236, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 235, "b": 252, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 235, "b": 253, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 236, "b": 252, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 235, "b": 237, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 235, "b": 269, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 236, "b": 237, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 236, "b": 253, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 236, "b": 254, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 237, "b": 253, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 236, "b": 270, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 237, "b": 254, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 237, "b": 271, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 238, "b": 239, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 238, "b": 255, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 238, "b": 256, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 239, "b": 255, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 238, "b": 240, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 238, "b": 272, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 239, "b": 240, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 239, "b": 256, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 239, "b": 257, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 240, "b": 256, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 239, "b": 241, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 239, "b": 273, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 240, "b": 241, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 240, "b": 257, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 240, "b": 258, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 241, "b": 257, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 240, "b": 242, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 240, "b": 274, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 241, "b": 242, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 241, "b": 258, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 241, "b": 259, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 242, "b": 258, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 241, "b": 243, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 241, "b": 275, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 242, "b": 243, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 242, "b": 259, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 242, "b": 260, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 243, "b": 259, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 242, "b": 244, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 242, "b": 276, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 243, "b": 244, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 243, "b": 260, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 243, "b": 261, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 244, "b": 260, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 243, "b": 245, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 243, "b": 277, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 244, "b": 245, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 244, "b": 261, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 244, "b": 262, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 245, "b": 261, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 244, "b": 246, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 244, "b": 278, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 245, "b": 246, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 245, "b": 262, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 245, "b": 263, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 246, "b": 262, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 245, "b": 247, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 245, "b": 279, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 246, "b": 247, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 246, "b": 263, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 246, "b": 264, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 247, "b": 263, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 246, "b": 248, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 246, "b": 280, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 247, "b": 248, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 247, "b": 264, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 247, "b": 265, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 248, "b": 264, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 247, "b": 249, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 247, "b": 281, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 248, "b": 249, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 248, "b": 265, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 248, "b": 266, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 249, "b": 265, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 248, "b": 250, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 248, "b": 282, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 249, "b": 250, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 249, "b": 266, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 249, "b": 267, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 250, "b": 266, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 249, "b": 251, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 249, "b": 283, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 250, "b": 251, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 250, "b": 267, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 250, "b": 268, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 251, "b": 267, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 250, "b": 252, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 250, "b": 284, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 251, "b": 252, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 251, "b": 268, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 251, "b": 269, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 252, "b": 268, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 251, "b": 253, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 251, "b": 285, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 252, "b": 253, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 252, "b": 269, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 252, "b": 270, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 253, "b": 269, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 252, "b": 254, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 252, "b": 286, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 253, "b": 254, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 253, "b": 270, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 253, "b": 271, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 254, "b": 270, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 253, "b": 287, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 254, "b": 271, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 254, "b": 288, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 255, "b": 256, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 255, "b": 272, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 255, "b": 273, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 256, "b": 272, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 255, "b": 257, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 256, "b": 257, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 256, "b": 273, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 256, "b": 274, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 257, "b": 273, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 256, "b": 258, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 257, "b": 258, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 257, "b": 274, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 257, "b": 275, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 258, "b": 274, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 257, "b": 259, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 258, "b": 259, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 258, "b": 275, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 258, "b": 276, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 259, "b": 275, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 258, "b": 260, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 259, "b": 260, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 259, "b": 276, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 259, "b": 277, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 260, "b": 276, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 259, "b": 261, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 260, "b": 261, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 260, "b": 277, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 260, "b": 278, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 261, "b": 277, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 260, "b": 262, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 261, "b": 262, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 261, "b": 278, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 261, "b": 279, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 262, "b": 278, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 261, "b": 263, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 262, "b": 263, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 262, "b": 279, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 262, "b": 280, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 263, "b": 279, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 262, "b": 264, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 263, "b": 264, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 263, "b": 280, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 263, "b": 281, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 264, "b": 280, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 263, "b": 265, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 264, "b": 265, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 264, "b": 281, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 264, "b": 282, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 265, "b": 281, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 264, "b": 266, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 265, "b": 266, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 265, "b": 282, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 265, "b": 283, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 266, "b": 282, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 265, "b": 267, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 266, "b": 267, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 266, "b": 283, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 266, "b": 284, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 267, "b": 283, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 266, "b": 268, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 267, "b": 268, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 267, "b": 284, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 267, "b": 285, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 268, "b": 284, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 267, "b": 269, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 268, "b": 269, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 268, "b": 285, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 268, "b": 286, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 269, "b": 285, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 268, "b": 270, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 269, "b": 270, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 269, "b": 286, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 269, "b": 287, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 270, "b": 286, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 269, "b": 271, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 270, "b": 271, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 270, "b": 287, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 270, "b": 288, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 271, "b": 287, "kind": "shear", "restLengthM": 0.08838834764831845, "complianceMPerN": 1e-3 }, { "a": 271, "b": 288, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 272, "b": 273, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 272, "b": 274, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 273, "b": 274, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 273, "b": 275, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 274, "b": 275, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 274, "b": 276, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 275, "b": 276, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 275, "b": 277, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 276, "b": 277, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 276, "b": 278, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 277, "b": 278, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 277, "b": 279, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 278, "b": 279, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 278, "b": 280, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 279, "b": 280, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 279, "b": 281, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 280, "b": 281, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 280, "b": 282, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 281, "b": 282, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 281, "b": 283, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 282, "b": 283, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 282, "b": 284, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 283, "b": 284, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 283, "b": 285, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 284, "b": 285, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 284, "b": 286, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 285, "b": 286, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 285, "b": 287, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 286, "b": 287, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }, { "a": 286, "b": 288, "kind": "bend-distance", "restLengthM": 0.125, "complianceMPerN": 0.1 }, { "a": 287, "b": 288, "kind": "stretch", "restLengthM": 0.0625, "complianceMPerN": 1e-3 }], "staticColliderIds": ["p5SphereCollider"] }], "fluids": [], "sourceBindings": [] }, "options": { "profile": "cloth-pinned-sphere-visual-v1", "fixedStepSeconds": 0.008333333333333333, "broadPhase": "domain-fixed" } }, "fluid-basin-visual-v1": { "model": { "format": "barocss-physics-model", "version": 1, "revision": "p5KernelFixture1", "frame": { "id": "world", "basis": "right-handed-xyz", "rotation": "local-to-world-xyzw" }, "units": { "length": "m", "mass": "kg", "time": "s", "angle": "rad" }, "gravityMps2": [0, -9.81, 0], "bodies": [{ "id": "p5BasinBody", "kind": "static", "initial": { "positionM": [0.35, 0.65, 0.25], "orientationXYZW": [0, 0, 0, 1] } }], "colliders": [{ "id": "p5BasinCollider", "bodyId": "p5BasinBody", "geometry": { "kind": "box-interior", "halfExtentsM": [0.35, 0.65, 0.25] }, "local": { "positionM": [0, 0, 0], "orientationXYZW": [0, 0, 0, 1] }, "material": { "restitution": 0, "friction": { "static": 0, "dynamic": 0 } }, "sensor": false, "ccd": false, "filter": { "categoryBits": 1, "maskBits": 65535 } }], "joints": [], "cloths": [], "fluids": [{ "id": "p5Fluid", "initialPositionsM": [[0.2, 0.45, 0.3], [0.25, 0.45, 0.3], [0.30000000000000004, 0.45, 0.3], [0.35000000000000003, 0.45, 0.3], [0.4, 0.45, 0.3], [0.45, 0.45, 0.3], [0.5, 0.45, 0.3], [0.55, 0.45, 0.3], [0.2, 0.5, 0.3], [0.25, 0.5, 0.3], [0.30000000000000004, 0.5, 0.3], [0.35000000000000003, 0.5, 0.3], [0.4, 0.5, 0.3], [0.45, 0.5, 0.3], [0.5, 0.5, 0.3], [0.55, 0.5, 0.3], [0.2, 0.55, 0.3], [0.25, 0.55, 0.3], [0.30000000000000004, 0.55, 0.3], [0.35000000000000003, 0.55, 0.3], [0.4, 0.55, 0.3], [0.45, 0.55, 0.3], [0.5, 0.55, 0.3], [0.55, 0.55, 0.3], [0.2, 0.6000000000000001, 0.3], [0.25, 0.6000000000000001, 0.3], [0.30000000000000004, 0.6000000000000001, 0.3], [0.35000000000000003, 0.6000000000000001, 0.3], [0.4, 0.6000000000000001, 0.3], [0.45, 0.6000000000000001, 0.3], [0.5, 0.6000000000000001, 0.3], [0.55, 0.6000000000000001, 0.3], [0.2, 0.65, 0.3], [0.25, 0.65, 0.3], [0.30000000000000004, 0.65, 0.3], [0.35000000000000003, 0.65, 0.3], [0.4, 0.65, 0.3], [0.45, 0.65, 0.3], [0.5, 0.65, 0.3], [0.55, 0.65, 0.3], [0.2, 0.7, 0.3], [0.25, 0.7, 0.3], [0.30000000000000004, 0.7, 0.3], [0.35000000000000003, 0.7, 0.3], [0.4, 0.7, 0.3], [0.45, 0.7, 0.3], [0.5, 0.7, 0.3], [0.55, 0.7, 0.3], [0.2, 0.75, 0.3], [0.25, 0.75, 0.3], [0.30000000000000004, 0.75, 0.3], [0.35000000000000003, 0.75, 0.3], [0.4, 0.75, 0.3], [0.45, 0.75, 0.3], [0.5, 0.75, 0.3], [0.55, 0.75, 0.3], [0.2, 0.8, 0.3], [0.25, 0.8, 0.3], [0.30000000000000004, 0.8, 0.3], [0.35000000000000003, 0.8, 0.3], [0.4, 0.8, 0.3], [0.45, 0.8, 0.3], [0.5, 0.8, 0.3], [0.55, 0.8, 0.3], [0.2, 0.45, 0.35], [0.25, 0.45, 0.35], [0.30000000000000004, 0.45, 0.35], [0.35000000000000003, 0.45, 0.35], [0.4, 0.45, 0.35], [0.45, 0.45, 0.35], [0.5, 0.45, 0.35], [0.55, 0.45, 0.35], [0.2, 0.5, 0.35], [0.25, 0.5, 0.35], [0.30000000000000004, 0.5, 0.35], [0.35000000000000003, 0.5, 0.35], [0.4, 0.5, 0.35], [0.45, 0.5, 0.35], [0.5, 0.5, 0.35], [0.55, 0.5, 0.35], [0.2, 0.55, 0.35], [0.25, 0.55, 0.35], [0.30000000000000004, 0.55, 0.35], [0.35000000000000003, 0.55, 0.35], [0.4, 0.55, 0.35], [0.45, 0.55, 0.35], [0.5, 0.55, 0.35], [0.55, 0.55, 0.35], [0.2, 0.6000000000000001, 0.35], [0.25, 0.6000000000000001, 0.35], [0.30000000000000004, 0.6000000000000001, 0.35], [0.35000000000000003, 0.6000000000000001, 0.35], [0.4, 0.6000000000000001, 0.35], [0.45, 0.6000000000000001, 0.35], [0.5, 0.6000000000000001, 0.35], [0.55, 0.6000000000000001, 0.35], [0.2, 0.65, 0.35], [0.25, 0.65, 0.35], [0.30000000000000004, 0.65, 0.35], [0.35000000000000003, 0.65, 0.35], [0.4, 0.65, 0.35], [0.45, 0.65, 0.35], [0.5, 0.65, 0.35], [0.55, 0.65, 0.35], [0.2, 0.7, 0.35], [0.25, 0.7, 0.35], [0.30000000000000004, 0.7, 0.35], [0.35000000000000003, 0.7, 0.35], [0.4, 0.7, 0.35], [0.45, 0.7, 0.35], [0.5, 0.7, 0.35], [0.55, 0.7, 0.35], [0.2, 0.75, 0.35], [0.25, 0.75, 0.35], [0.30000000000000004, 0.75, 0.35], [0.35000000000000003, 0.75, 0.35], [0.4, 0.75, 0.35], [0.45, 0.75, 0.35], [0.5, 0.75, 0.35], [0.55, 0.75, 0.35], [0.2, 0.8, 0.35], [0.25, 0.8, 0.35], [0.30000000000000004, 0.8, 0.35], [0.35000000000000003, 0.8, 0.35], [0.4, 0.8, 0.35], [0.45, 0.8, 0.35], [0.5, 0.8, 0.35], [0.55, 0.8, 0.35], [0.2, 0.45, 0.4], [0.25, 0.45, 0.4], [0.30000000000000004, 0.45, 0.4], [0.35000000000000003, 0.45, 0.4], [0.4, 0.45, 0.4], [0.45, 0.45, 0.4], [0.5, 0.45, 0.4], [0.55, 0.45, 0.4], [0.2, 0.5, 0.4], [0.25, 0.5, 0.4], [0.30000000000000004, 0.5, 0.4], [0.35000000000000003, 0.5, 0.4], [0.4, 0.5, 0.4], [0.45, 0.5, 0.4], [0.5, 0.5, 0.4], [0.55, 0.5, 0.4], [0.2, 0.55, 0.4], [0.25, 0.55, 0.4], [0.30000000000000004, 0.55, 0.4], [0.35000000000000003, 0.55, 0.4], [0.4, 0.55, 0.4], [0.45, 0.55, 0.4], [0.5, 0.55, 0.4], [0.55, 0.55, 0.4], [0.2, 0.6000000000000001, 0.4], [0.25, 0.6000000000000001, 0.4], [0.30000000000000004, 0.6000000000000001, 0.4], [0.35000000000000003, 0.6000000000000001, 0.4], [0.4, 0.6000000000000001, 0.4], [0.45, 0.6000000000000001, 0.4], [0.5, 0.6000000000000001, 0.4], [0.55, 0.6000000000000001, 0.4], [0.2, 0.65, 0.4], [0.25, 0.65, 0.4], [0.30000000000000004, 0.65, 0.4], [0.35000000000000003, 0.65, 0.4], [0.4, 0.65, 0.4], [0.45, 0.65, 0.4], [0.5, 0.65, 0.4], [0.55, 0.65, 0.4], [0.2, 0.7, 0.4], [0.25, 0.7, 0.4], [0.30000000000000004, 0.7, 0.4], [0.35000000000000003, 0.7, 0.4], [0.4, 0.7, 0.4], [0.45, 0.7, 0.4], [0.5, 0.7, 0.4], [0.55, 0.7, 0.4], [0.2, 0.75, 0.4], [0.25, 0.75, 0.4], [0.30000000000000004, 0.75, 0.4], [0.35000000000000003, 0.75, 0.4], [0.4, 0.75, 0.4], [0.45, 0.75, 0.4], [0.5, 0.75, 0.4], [0.55, 0.75, 0.4], [0.2, 0.8, 0.4], [0.25, 0.8, 0.4], [0.30000000000000004, 0.8, 0.4], [0.35000000000000003, 0.8, 0.4], [0.4, 0.8, 0.4], [0.45, 0.8, 0.4], [0.5, 0.8, 0.4], [0.55, 0.8, 0.4], [0.2, 0.45, 0.45], [0.25, 0.45, 0.45], [0.30000000000000004, 0.45, 0.45], [0.35000000000000003, 0.45, 0.45], [0.4, 0.45, 0.45], [0.45, 0.45, 0.45], [0.5, 0.45, 0.45], [0.55, 0.45, 0.45], [0.2, 0.5, 0.45], [0.25, 0.5, 0.45], [0.30000000000000004, 0.5, 0.45], [0.35000000000000003, 0.5, 0.45], [0.4, 0.5, 0.45], [0.45, 0.5, 0.45], [0.5, 0.5, 0.45], [0.55, 0.5, 0.45], [0.2, 0.55, 0.45], [0.25, 0.55, 0.45], [0.30000000000000004, 0.55, 0.45], [0.35000000000000003, 0.55, 0.45], [0.4, 0.55, 0.45], [0.45, 0.55, 0.45], [0.5, 0.55, 0.45], [0.55, 0.55, 0.45], [0.2, 0.6000000000000001, 0.45], [0.25, 0.6000000000000001, 0.45], [0.30000000000000004, 0.6000000000000001, 0.45], [0.35000000000000003, 0.6000000000000001, 0.45], [0.4, 0.6000000000000001, 0.45], [0.45, 0.6000000000000001, 0.45], [0.5, 0.6000000000000001, 0.45], [0.55, 0.6000000000000001, 0.45], [0.2, 0.65, 0.45], [0.25, 0.65, 0.45], [0.30000000000000004, 0.65, 0.45], [0.35000000000000003, 0.65, 0.45], [0.4, 0.65, 0.45], [0.45, 0.65, 0.45], [0.5, 0.65, 0.45], [0.55, 0.65, 0.45], [0.2, 0.7, 0.45], [0.25, 0.7, 0.45], [0.30000000000000004, 0.7, 0.45], [0.35000000000000003, 0.7, 0.45], [0.4, 0.7, 0.45], [0.45, 0.7, 0.45], [0.5, 0.7, 0.45], [0.55, 0.7, 0.45], [0.2, 0.75, 0.45], [0.25, 0.75, 0.45], [0.30000000000000004, 0.75, 0.45], [0.35000000000000003, 0.75, 0.45], [0.4, 0.75, 0.45], [0.45, 0.75, 0.45], [0.5, 0.75, 0.45], [0.55, 0.75, 0.45], [0.2, 0.8, 0.45], [0.25, 0.8, 0.45], [0.30000000000000004, 0.8, 0.45], [0.35000000000000003, 0.8, 0.45], [0.4, 0.8, 0.45], [0.45, 0.8, 0.45], [0.5, 0.8, 0.45], [0.55, 0.8, 0.45]], "initialVelocitiesMps": [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], "massModel": { "kind": "visual-unit-weights" }, "particleRadiusM": 0.0125, "smoothingRadiusM": 0.09000000000000001, "visualSmoothing": { "kind": "none" }, "staticColliderIds": ["p5BasinCollider"] }], "sourceBindings": [] }, "options": { "profile": "fluid-basin-visual-v1", "fixedStepSeconds": 0.008333333333333333, "broadPhase": "domain-fixed" } }, "fluid-basin-xsph-visual-v1": { "model": { "format": "barocss-physics-model", "version": 1, "revision": "p5KernelFixture1", "frame": { "id": "world", "basis": "right-handed-xyz", "rotation": "local-to-world-xyzw" }, "units": { "length": "m", "mass": "kg", "time": "s", "angle": "rad" }, "gravityMps2": [0, -9.81, 0], "bodies": [{ "id": "p5BasinBody", "kind": "static", "initial": { "positionM": [0.35, 0.65, 0.25], "orientationXYZW": [0, 0, 0, 1] } }], "colliders": [{ "id": "p5BasinCollider", "bodyId": "p5BasinBody", "geometry": { "kind": "box-interior", "halfExtentsM": [0.35, 0.65, 0.25] }, "local": { "positionM": [0, 0, 0], "orientationXYZW": [0, 0, 0, 1] }, "material": { "restitution": 0, "friction": { "static": 0, "dynamic": 0 } }, "sensor": false, "ccd": false, "filter": { "categoryBits": 1, "maskBits": 65535 } }], "joints": [], "cloths": [], "fluids": [{ "id": "p5Fluid", "initialPositionsM": [[0.2, 0.45, 0.3], [0.25, 0.45, 0.3], [0.30000000000000004, 0.45, 0.3], [0.35000000000000003, 0.45, 0.3], [0.4, 0.45, 0.3], [0.45, 0.45, 0.3], [0.5, 0.45, 0.3], [0.55, 0.45, 0.3], [0.2, 0.5, 0.3], [0.25, 0.5, 0.3], [0.30000000000000004, 0.5, 0.3], [0.35000000000000003, 0.5, 0.3], [0.4, 0.5, 0.3], [0.45, 0.5, 0.3], [0.5, 0.5, 0.3], [0.55, 0.5, 0.3], [0.2, 0.55, 0.3], [0.25, 0.55, 0.3], [0.30000000000000004, 0.55, 0.3], [0.35000000000000003, 0.55, 0.3], [0.4, 0.55, 0.3], [0.45, 0.55, 0.3], [0.5, 0.55, 0.3], [0.55, 0.55, 0.3], [0.2, 0.6000000000000001, 0.3], [0.25, 0.6000000000000001, 0.3], [0.30000000000000004, 0.6000000000000001, 0.3], [0.35000000000000003, 0.6000000000000001, 0.3], [0.4, 0.6000000000000001, 0.3], [0.45, 0.6000000000000001, 0.3], [0.5, 0.6000000000000001, 0.3], [0.55, 0.6000000000000001, 0.3], [0.2, 0.65, 0.3], [0.25, 0.65, 0.3], [0.30000000000000004, 0.65, 0.3], [0.35000000000000003, 0.65, 0.3], [0.4, 0.65, 0.3], [0.45, 0.65, 0.3], [0.5, 0.65, 0.3], [0.55, 0.65, 0.3], [0.2, 0.7, 0.3], [0.25, 0.7, 0.3], [0.30000000000000004, 0.7, 0.3], [0.35000000000000003, 0.7, 0.3], [0.4, 0.7, 0.3], [0.45, 0.7, 0.3], [0.5, 0.7, 0.3], [0.55, 0.7, 0.3], [0.2, 0.75, 0.3], [0.25, 0.75, 0.3], [0.30000000000000004, 0.75, 0.3], [0.35000000000000003, 0.75, 0.3], [0.4, 0.75, 0.3], [0.45, 0.75, 0.3], [0.5, 0.75, 0.3], [0.55, 0.75, 0.3], [0.2, 0.8, 0.3], [0.25, 0.8, 0.3], [0.30000000000000004, 0.8, 0.3], [0.35000000000000003, 0.8, 0.3], [0.4, 0.8, 0.3], [0.45, 0.8, 0.3], [0.5, 0.8, 0.3], [0.55, 0.8, 0.3], [0.2, 0.45, 0.35], [0.25, 0.45, 0.35], [0.30000000000000004, 0.45, 0.35], [0.35000000000000003, 0.45, 0.35], [0.4, 0.45, 0.35], [0.45, 0.45, 0.35], [0.5, 0.45, 0.35], [0.55, 0.45, 0.35], [0.2, 0.5, 0.35], [0.25, 0.5, 0.35], [0.30000000000000004, 0.5, 0.35], [0.35000000000000003, 0.5, 0.35], [0.4, 0.5, 0.35], [0.45, 0.5, 0.35], [0.5, 0.5, 0.35], [0.55, 0.5, 0.35], [0.2, 0.55, 0.35], [0.25, 0.55, 0.35], [0.30000000000000004, 0.55, 0.35], [0.35000000000000003, 0.55, 0.35], [0.4, 0.55, 0.35], [0.45, 0.55, 0.35], [0.5, 0.55, 0.35], [0.55, 0.55, 0.35], [0.2, 0.6000000000000001, 0.35], [0.25, 0.6000000000000001, 0.35], [0.30000000000000004, 0.6000000000000001, 0.35], [0.35000000000000003, 0.6000000000000001, 0.35], [0.4, 0.6000000000000001, 0.35], [0.45, 0.6000000000000001, 0.35], [0.5, 0.6000000000000001, 0.35], [0.55, 0.6000000000000001, 0.35], [0.2, 0.65, 0.35], [0.25, 0.65, 0.35], [0.30000000000000004, 0.65, 0.35], [0.35000000000000003, 0.65, 0.35], [0.4, 0.65, 0.35], [0.45, 0.65, 0.35], [0.5, 0.65, 0.35], [0.55, 0.65, 0.35], [0.2, 0.7, 0.35], [0.25, 0.7, 0.35], [0.30000000000000004, 0.7, 0.35], [0.35000000000000003, 0.7, 0.35], [0.4, 0.7, 0.35], [0.45, 0.7, 0.35], [0.5, 0.7, 0.35], [0.55, 0.7, 0.35], [0.2, 0.75, 0.35], [0.25, 0.75, 0.35], [0.30000000000000004, 0.75, 0.35], [0.35000000000000003, 0.75, 0.35], [0.4, 0.75, 0.35], [0.45, 0.75, 0.35], [0.5, 0.75, 0.35], [0.55, 0.75, 0.35], [0.2, 0.8, 0.35], [0.25, 0.8, 0.35], [0.30000000000000004, 0.8, 0.35], [0.35000000000000003, 0.8, 0.35], [0.4, 0.8, 0.35], [0.45, 0.8, 0.35], [0.5, 0.8, 0.35], [0.55, 0.8, 0.35], [0.2, 0.45, 0.4], [0.25, 0.45, 0.4], [0.30000000000000004, 0.45, 0.4], [0.35000000000000003, 0.45, 0.4], [0.4, 0.45, 0.4], [0.45, 0.45, 0.4], [0.5, 0.45, 0.4], [0.55, 0.45, 0.4], [0.2, 0.5, 0.4], [0.25, 0.5, 0.4], [0.30000000000000004, 0.5, 0.4], [0.35000000000000003, 0.5, 0.4], [0.4, 0.5, 0.4], [0.45, 0.5, 0.4], [0.5, 0.5, 0.4], [0.55, 0.5, 0.4], [0.2, 0.55, 0.4], [0.25, 0.55, 0.4], [0.30000000000000004, 0.55, 0.4], [0.35000000000000003, 0.55, 0.4], [0.4, 0.55, 0.4], [0.45, 0.55, 0.4], [0.5, 0.55, 0.4], [0.55, 0.55, 0.4], [0.2, 0.6000000000000001, 0.4], [0.25, 0.6000000000000001, 0.4], [0.30000000000000004, 0.6000000000000001, 0.4], [0.35000000000000003, 0.6000000000000001, 0.4], [0.4, 0.6000000000000001, 0.4], [0.45, 0.6000000000000001, 0.4], [0.5, 0.6000000000000001, 0.4], [0.55, 0.6000000000000001, 0.4], [0.2, 0.65, 0.4], [0.25, 0.65, 0.4], [0.30000000000000004, 0.65, 0.4], [0.35000000000000003, 0.65, 0.4], [0.4, 0.65, 0.4], [0.45, 0.65, 0.4], [0.5, 0.65, 0.4], [0.55, 0.65, 0.4], [0.2, 0.7, 0.4], [0.25, 0.7, 0.4], [0.30000000000000004, 0.7, 0.4], [0.35000000000000003, 0.7, 0.4], [0.4, 0.7, 0.4], [0.45, 0.7, 0.4], [0.5, 0.7, 0.4], [0.55, 0.7, 0.4], [0.2, 0.75, 0.4], [0.25, 0.75, 0.4], [0.30000000000000004, 0.75, 0.4], [0.35000000000000003, 0.75, 0.4], [0.4, 0.75, 0.4], [0.45, 0.75, 0.4], [0.5, 0.75, 0.4], [0.55, 0.75, 0.4], [0.2, 0.8, 0.4], [0.25, 0.8, 0.4], [0.30000000000000004, 0.8, 0.4], [0.35000000000000003, 0.8, 0.4], [0.4, 0.8, 0.4], [0.45, 0.8, 0.4], [0.5, 0.8, 0.4], [0.55, 0.8, 0.4], [0.2, 0.45, 0.45], [0.25, 0.45, 0.45], [0.30000000000000004, 0.45, 0.45], [0.35000000000000003, 0.45, 0.45], [0.4, 0.45, 0.45], [0.45, 0.45, 0.45], [0.5, 0.45, 0.45], [0.55, 0.45, 0.45], [0.2, 0.5, 0.45], [0.25, 0.5, 0.45], [0.30000000000000004, 0.5, 0.45], [0.35000000000000003, 0.5, 0.45], [0.4, 0.5, 0.45], [0.45, 0.5, 0.45], [0.5, 0.5, 0.45], [0.55, 0.5, 0.45], [0.2, 0.55, 0.45], [0.25, 0.55, 0.45], [0.30000000000000004, 0.55, 0.45], [0.35000000000000003, 0.55, 0.45], [0.4, 0.55, 0.45], [0.45, 0.55, 0.45], [0.5, 0.55, 0.45], [0.55, 0.55, 0.45], [0.2, 0.6000000000000001, 0.45], [0.25, 0.6000000000000001, 0.45], [0.30000000000000004, 0.6000000000000001, 0.45], [0.35000000000000003, 0.6000000000000001, 0.45], [0.4, 0.6000000000000001, 0.45], [0.45, 0.6000000000000001, 0.45], [0.5, 0.6000000000000001, 0.45], [0.55, 0.6000000000000001, 0.45], [0.2, 0.65, 0.45], [0.25, 0.65, 0.45], [0.30000000000000004, 0.65, 0.45], [0.35000000000000003, 0.65, 0.45], [0.4, 0.65, 0.45], [0.45, 0.65, 0.45], [0.5, 0.65, 0.45], [0.55, 0.65, 0.45], [0.2, 0.7, 0.45], [0.25, 0.7, 0.45], [0.30000000000000004, 0.7, 0.45], [0.35000000000000003, 0.7, 0.45], [0.4, 0.7, 0.45], [0.45, 0.7, 0.45], [0.5, 0.7, 0.45], [0.55, 0.7, 0.45], [0.2, 0.75, 0.45], [0.25, 0.75, 0.45], [0.30000000000000004, 0.75, 0.45], [0.35000000000000003, 0.75, 0.45], [0.4, 0.75, 0.45], [0.45, 0.75, 0.45], [0.5, 0.75, 0.45], [0.55, 0.75, 0.45], [0.2, 0.8, 0.45], [0.25, 0.8, 0.45], [0.30000000000000004, 0.8, 0.45], [0.35000000000000003, 0.8, 0.45], [0.4, 0.8, 0.45], [0.45, 0.8, 0.45], [0.5, 0.8, 0.45], [0.55, 0.8, 0.45]], "initialVelocitiesMps": [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], "massModel": { "kind": "visual-unit-weights" }, "particleRadiusM": 0.0125, "smoothingRadiusM": 0.09000000000000001, "visualSmoothing": { "kind": "xsph", "coefficient": 0.15 }, "staticColliderIds": ["p5BasinCollider"] }], "sourceBindings": [] }, "options": { "profile": "fluid-basin-xsph-visual-v1", "fixedStepSeconds": 0.008333333333333333, "broadPhase": "domain-fixed" } }, "fluid-static-box-visual-v1": { "model": { "format": "barocss-physics-model", "version": 1, "revision": "p5KernelFixture1", "frame": { "id": "world", "basis": "right-handed-xyz", "rotation": "local-to-world-xyzw" }, "units": { "length": "m", "mass": "kg", "time": "s", "angle": "rad" }, "gravityMps2": [0, -9.81, 0], "bodies": [{ "id": "p5BasinBody", "kind": "static", "initial": { "positionM": [0.35, 0.65, 0.25], "orientationXYZW": [0, 0, 0, 1] } }, { "id": "p5ShelfBody", "kind": "static", "initial": { "positionM": [0.35, 0.2, 0.25], "orientationXYZW": [0, 0, 0, 1] } }], "colliders": [{ "id": "p5BasinCollider", "bodyId": "p5BasinBody", "geometry": { "kind": "box-interior", "halfExtentsM": [0.35, 0.65, 0.25] }, "local": { "positionM": [0, 0, 0], "orientationXYZW": [0, 0, 0, 1] }, "material": { "restitution": 0, "friction": { "static": 0, "dynamic": 0 } }, "sensor": false, "ccd": false, "filter": { "categoryBits": 1, "maskBits": 65535 } }, { "id": "p5ShelfCollider", "bodyId": "p5ShelfBody", "geometry": { "kind": "box", "halfExtentsM": [0.15, 0.01, 0.15] }, "local": { "positionM": [0, 0, 0], "orientationXYZW": [0, 0, 0, 1] }, "material": { "restitution": 0, "friction": { "static": 0, "dynamic": 0 } }, "sensor": false, "ccd": false, "filter": { "categoryBits": 1, "maskBits": 65535 } }], "joints": [], "cloths": [], "fluids": [{ "id": "p5Fluid", "initialPositionsM": [[0.2, 0.45, 0.3], [0.25, 0.45, 0.3], [0.30000000000000004, 0.45, 0.3], [0.35000000000000003, 0.45, 0.3], [0.4, 0.45, 0.3], [0.45, 0.45, 0.3], [0.5, 0.45, 0.3], [0.55, 0.45, 0.3], [0.2, 0.5, 0.3], [0.25, 0.5, 0.3], [0.30000000000000004, 0.5, 0.3], [0.35000000000000003, 0.5, 0.3], [0.4, 0.5, 0.3], [0.45, 0.5, 0.3], [0.5, 0.5, 0.3], [0.55, 0.5, 0.3], [0.2, 0.55, 0.3], [0.25, 0.55, 0.3], [0.30000000000000004, 0.55, 0.3], [0.35000000000000003, 0.55, 0.3], [0.4, 0.55, 0.3], [0.45, 0.55, 0.3], [0.5, 0.55, 0.3], [0.55, 0.55, 0.3], [0.2, 0.6000000000000001, 0.3], [0.25, 0.6000000000000001, 0.3], [0.30000000000000004, 0.6000000000000001, 0.3], [0.35000000000000003, 0.6000000000000001, 0.3], [0.4, 0.6000000000000001, 0.3], [0.45, 0.6000000000000001, 0.3], [0.5, 0.6000000000000001, 0.3], [0.55, 0.6000000000000001, 0.3], [0.2, 0.65, 0.3], [0.25, 0.65, 0.3], [0.30000000000000004, 0.65, 0.3], [0.35000000000000003, 0.65, 0.3], [0.4, 0.65, 0.3], [0.45, 0.65, 0.3], [0.5, 0.65, 0.3], [0.55, 0.65, 0.3], [0.2, 0.7, 0.3], [0.25, 0.7, 0.3], [0.30000000000000004, 0.7, 0.3], [0.35000000000000003, 0.7, 0.3], [0.4, 0.7, 0.3], [0.45, 0.7, 0.3], [0.5, 0.7, 0.3], [0.55, 0.7, 0.3], [0.2, 0.75, 0.3], [0.25, 0.75, 0.3], [0.30000000000000004, 0.75, 0.3], [0.35000000000000003, 0.75, 0.3], [0.4, 0.75, 0.3], [0.45, 0.75, 0.3], [0.5, 0.75, 0.3], [0.55, 0.75, 0.3], [0.2, 0.8, 0.3], [0.25, 0.8, 0.3], [0.30000000000000004, 0.8, 0.3], [0.35000000000000003, 0.8, 0.3], [0.4, 0.8, 0.3], [0.45, 0.8, 0.3], [0.5, 0.8, 0.3], [0.55, 0.8, 0.3], [0.2, 0.45, 0.35], [0.25, 0.45, 0.35], [0.30000000000000004, 0.45, 0.35], [0.35000000000000003, 0.45, 0.35], [0.4, 0.45, 0.35], [0.45, 0.45, 0.35], [0.5, 0.45, 0.35], [0.55, 0.45, 0.35], [0.2, 0.5, 0.35], [0.25, 0.5, 0.35], [0.30000000000000004, 0.5, 0.35], [0.35000000000000003, 0.5, 0.35], [0.4, 0.5, 0.35], [0.45, 0.5, 0.35], [0.5, 0.5, 0.35], [0.55, 0.5, 0.35], [0.2, 0.55, 0.35], [0.25, 0.55, 0.35], [0.30000000000000004, 0.55, 0.35], [0.35000000000000003, 0.55, 0.35], [0.4, 0.55, 0.35], [0.45, 0.55, 0.35], [0.5, 0.55, 0.35], [0.55, 0.55, 0.35], [0.2, 0.6000000000000001, 0.35], [0.25, 0.6000000000000001, 0.35], [0.30000000000000004, 0.6000000000000001, 0.35], [0.35000000000000003, 0.6000000000000001, 0.35], [0.4, 0.6000000000000001, 0.35], [0.45, 0.6000000000000001, 0.35], [0.5, 0.6000000000000001, 0.35], [0.55, 0.6000000000000001, 0.35], [0.2, 0.65, 0.35], [0.25, 0.65, 0.35], [0.30000000000000004, 0.65, 0.35], [0.35000000000000003, 0.65, 0.35], [0.4, 0.65, 0.35], [0.45, 0.65, 0.35], [0.5, 0.65, 0.35], [0.55, 0.65, 0.35], [0.2, 0.7, 0.35], [0.25, 0.7, 0.35], [0.30000000000000004, 0.7, 0.35], [0.35000000000000003, 0.7, 0.35], [0.4, 0.7, 0.35], [0.45, 0.7, 0.35], [0.5, 0.7, 0.35], [0.55, 0.7, 0.35], [0.2, 0.75, 0.35], [0.25, 0.75, 0.35], [0.30000000000000004, 0.75, 0.35], [0.35000000000000003, 0.75, 0.35], [0.4, 0.75, 0.35], [0.45, 0.75, 0.35], [0.5, 0.75, 0.35], [0.55, 0.75, 0.35], [0.2, 0.8, 0.35], [0.25, 0.8, 0.35], [0.30000000000000004, 0.8, 0.35], [0.35000000000000003, 0.8, 0.35], [0.4, 0.8, 0.35], [0.45, 0.8, 0.35], [0.5, 0.8, 0.35], [0.55, 0.8, 0.35], [0.2, 0.45, 0.4], [0.25, 0.45, 0.4], [0.30000000000000004, 0.45, 0.4], [0.35000000000000003, 0.45, 0.4], [0.4, 0.45, 0.4], [0.45, 0.45, 0.4], [0.5, 0.45, 0.4], [0.55, 0.45, 0.4], [0.2, 0.5, 0.4], [0.25, 0.5, 0.4], [0.30000000000000004, 0.5, 0.4], [0.35000000000000003, 0.5, 0.4], [0.4, 0.5, 0.4], [0.45, 0.5, 0.4], [0.5, 0.5, 0.4], [0.55, 0.5, 0.4], [0.2, 0.55, 0.4], [0.25, 0.55, 0.4], [0.30000000000000004, 0.55, 0.4], [0.35000000000000003, 0.55, 0.4], [0.4, 0.55, 0.4], [0.45, 0.55, 0.4], [0.5, 0.55, 0.4], [0.55, 0.55, 0.4], [0.2, 0.6000000000000001, 0.4], [0.25, 0.6000000000000001, 0.4], [0.30000000000000004, 0.6000000000000001, 0.4], [0.35000000000000003, 0.6000000000000001, 0.4], [0.4, 0.6000000000000001, 0.4], [0.45, 0.6000000000000001, 0.4], [0.5, 0.6000000000000001, 0.4], [0.55, 0.6000000000000001, 0.4], [0.2, 0.65, 0.4], [0.25, 0.65, 0.4], [0.30000000000000004, 0.65, 0.4], [0.35000000000000003, 0.65, 0.4], [0.4, 0.65, 0.4], [0.45, 0.65, 0.4], [0.5, 0.65, 0.4], [0.55, 0.65, 0.4], [0.2, 0.7, 0.4], [0.25, 0.7, 0.4], [0.30000000000000004, 0.7, 0.4], [0.35000000000000003, 0.7, 0.4], [0.4, 0.7, 0.4], [0.45, 0.7, 0.4], [0.5, 0.7, 0.4], [0.55, 0.7, 0.4], [0.2, 0.75, 0.4], [0.25, 0.75, 0.4], [0.30000000000000004, 0.75, 0.4], [0.35000000000000003, 0.75, 0.4], [0.4, 0.75, 0.4], [0.45, 0.75, 0.4], [0.5, 0.75, 0.4], [0.55, 0.75, 0.4], [0.2, 0.8, 0.4], [0.25, 0.8, 0.4], [0.30000000000000004, 0.8, 0.4], [0.35000000000000003, 0.8, 0.4], [0.4, 0.8, 0.4], [0.45, 0.8, 0.4], [0.5, 0.8, 0.4], [0.55, 0.8, 0.4], [0.2, 0.45, 0.45], [0.25, 0.45, 0.45], [0.30000000000000004, 0.45, 0.45], [0.35000000000000003, 0.45, 0.45], [0.4, 0.45, 0.45], [0.45, 0.45, 0.45], [0.5, 0.45, 0.45], [0.55, 0.45, 0.45], [0.2, 0.5, 0.45], [0.25, 0.5, 0.45], [0.30000000000000004, 0.5, 0.45], [0.35000000000000003, 0.5, 0.45], [0.4, 0.5, 0.45], [0.45, 0.5, 0.45], [0.5, 0.5, 0.45], [0.55, 0.5, 0.45], [0.2, 0.55, 0.45], [0.25, 0.55, 0.45], [0.30000000000000004, 0.55, 0.45], [0.35000000000000003, 0.55, 0.45], [0.4, 0.55, 0.45], [0.45, 0.55, 0.45], [0.5, 0.55, 0.45], [0.55, 0.55, 0.45], [0.2, 0.6000000000000001, 0.45], [0.25, 0.6000000000000001, 0.45], [0.30000000000000004, 0.6000000000000001, 0.45], [0.35000000000000003, 0.6000000000000001, 0.45], [0.4, 0.6000000000000001, 0.45], [0.45, 0.6000000000000001, 0.45], [0.5, 0.6000000000000001, 0.45], [0.55, 0.6000000000000001, 0.45], [0.2, 0.65, 0.45], [0.25, 0.65, 0.45], [0.30000000000000004, 0.65, 0.45], [0.35000000000000003, 0.65, 0.45], [0.4, 0.65, 0.45], [0.45, 0.65, 0.45], [0.5, 0.65, 0.45], [0.55, 0.65, 0.45], [0.2, 0.7, 0.45], [0.25, 0.7, 0.45], [0.30000000000000004, 0.7, 0.45], [0.35000000000000003, 0.7, 0.45], [0.4, 0.7, 0.45], [0.45, 0.7, 0.45], [0.5, 0.7, 0.45], [0.55, 0.7, 0.45], [0.2, 0.75, 0.45], [0.25, 0.75, 0.45], [0.30000000000000004, 0.75, 0.45], [0.35000000000000003, 0.75, 0.45], [0.4, 0.75, 0.45], [0.45, 0.75, 0.45], [0.5, 0.75, 0.45], [0.55, 0.75, 0.45], [0.2, 0.8, 0.45], [0.25, 0.8, 0.45], [0.30000000000000004, 0.8, 0.45], [0.35000000000000003, 0.8, 0.45], [0.4, 0.8, 0.45], [0.45, 0.8, 0.45], [0.5, 0.8, 0.45], [0.55, 0.8, 0.45]], "initialVelocitiesMps": [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], "massModel": { "kind": "visual-unit-weights" }, "particleRadiusM": 0.0125, "smoothingRadiusM": 0.09000000000000001, "visualSmoothing": { "kind": "none" }, "staticColliderIds": ["p5BasinCollider", "p5ShelfCollider"] }], "sourceBindings": [] }, "options": { "profile": "fluid-static-box-visual-v1", "fixedStepSeconds": 0.008333333333333333, "broadPhase": "domain-fixed" } } });
function copyPhysicsModelPreset(profile) {
  if (!Object.hasOwn(physicsModelPresets, profile)) throw new RangeError("Unsupported Physics model preset");
  return copy(physicsModelPresets[profile]);
}

// examples/physics-cloth-viewer/frame.mjs
var DT2 = 1 / 120;
var STEPS2 = 240;
function clothModelData() {
  const input = copyPhysicsModelPreset("cloth-pinned-sphere-visual-v1");
  input.model.revision = "clothRev981";
  return input;
}
function frameFromState(state, generation, model) {
  return {
    version: 0,
    layerId: "cloth_sheet_981",
    contextId: `cloth_host_gen_${generation}`,
    sceneRevision: state.identity.modelRevision,
    stepIndex: state.stepIndex,
    vertexCount: state.cloths[0].positionsM.length / 3,
    triangleCount: model.cloths[0].triangles.length,
    positionsM: state.cloths[0].positionsM.slice(),
    triangles: Uint16Array.from(model.cloths[0].triangles.flat())
  };
}
function copyData3(value) {
  if (value instanceof Float64Array || value instanceof Uint16Array) return value.slice();
  if (Array.isArray(value)) return value.map(copyData3);
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) result[key] = copyData3(value[key]);
    return result;
  }
  return value;
}
function sameState(left, right) {
  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right) || left.constructor !== right.constructor || left.byteLength !== right.byteLength) return false;
    const a2 = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
    const b2 = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
    for (let index = 0; index < a2.length; index++) if (a2[index] !== b2[index]) return false;
    return true;
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return Object.is(left, right);
  const a = Object.keys(left), b = Object.keys(right);
  return a.length === b.length && a.every((key) => Object.hasOwn(right, key) && sameState(left[key], right[key]));
}

// examples/physics-cloth-viewer/host-controller.mjs
var ClothHostError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ClothHostError";
    this.code = code;
  }
};
function freshPair() {
  let first = null, second = null;
  try {
    const input = clothModelData();
    first = createPhysicsWorld(input.model, input.options);
    second = createPhysicsWorld(input.model, input.options);
    const state = first.getState(), spareState = second.getState();
    if (!sameState(state, spareState)) throw new ClothHostError("TWIN_MISMATCH", "Fresh cloth worlds disagree");
    return { active: first, shadow: second, state, model: first.getModel() };
  } catch (error2) {
    first?.dispose();
    second?.dispose();
    throw error2;
  }
}
function createHostController(viewer, { generation = 1 } = {}) {
  if (!Number.isSafeInteger(generation) || generation < 1) throw new ClothHostError("INVALID_GENERATION", "Positive generation required");
  let pair2 = freshPair(), acceptedState = pair2.state, frame;
  try {
    frame = frameFromState(acceptedState, generation, pair2.model);
    viewer.setClothFrame(frame);
  } catch (error2) {
    pair2.active.dispose();
    pair2.shadow.dispose();
    throw error2;
  }
  let displayStep = 0, phase = "paused", needsReset = false, disposed = false, lastWork = null;
  function live() {
    if (disposed) throw new ClothHostError("DISPOSED", "Cloth host is disposed");
  }
  function snapshot5() {
    return { state: copyData3(acceptedState), model: copyData3(pair2.model), frame: copyData3(frame), displayStep, phase, needsReset, generation, lastWork: copyData3(lastWork) };
  }
  return {
    getSnapshot() {
      live();
      return snapshot5();
    },
    step() {
      live();
      if (needsReset) throw new ClothHostError("RESET_REQUIRED", "Reset is required before stepping");
      if (acceptedState.stepIndex >= STEPS2) throw new ClothHostError("WORLD_LIMIT", "Cloth host reached step240");
      const started = performance.now();
      let solverMs = 0, submitMs = 0, twinSteps = 0, stage = "shadow-step", promoted = false;
      try {
        let marked = performance.now();
        twinSteps++;
        const candidate = pair2.shadow.step([]);
        const candidateFrame = frameFromState(candidate, generation, pair2.model);
        solverMs += performance.now() - marked;
        stage = "viewer-submit";
        marked = performance.now();
        try {
          viewer.setClothFrame(candidateFrame);
        } finally {
          submitMs += performance.now() - marked;
        }
        const previousActive = pair2.active;
        pair2.active = pair2.shadow;
        pair2.shadow = previousActive;
        acceptedState = candidate;
        frame = candidateFrame;
        displayStep = candidate.stepIndex;
        promoted = true;
        stage = "spare-step";
        marked = performance.now();
        twinSteps++;
        const spare = pair2.shadow.step([]);
        if (!sameState(candidate, spare)) throw new ClothHostError("TWIN_MISMATCH", "Accepted and spare cloth worlds disagree");
        const returnedState = copyData3(acceptedState), returnedFrame = copyData3(frame);
        solverMs += performance.now() - marked;
        phase = acceptedState.stepIndex === STEPS2 ? "complete" : "paused";
        lastWork = {
          stepIndex: acceptedState.stepIndex,
          solverMs,
          submitMs,
          hostMs: performance.now() - started,
          twinSteps,
          stage: "accepted",
          accepted: true
        };
        return {
          state: returnedState,
          frame: returnedFrame,
          stepIndex: acceptedState.stepIndex,
          solverMs,
          submitMs,
          hostMs: lastWork.hostMs,
          twinSteps
        };
      } catch (error2) {
        needsReset = true;
        phase = promoted ? "spare-unsynchronized" : stage === "viewer-submit" ? "submit-failed" : "solver-failed";
        const hostMs = performance.now() - started;
        solverMs = Math.max(solverMs, hostMs - submitMs);
        lastWork = {
          stepIndex: acceptedState.stepIndex,
          solverMs,
          submitMs,
          hostMs,
          twinSteps,
          stage,
          accepted: promoted,
          error: { name: error2.name, code: error2.code, message: error2.message }
        };
        throw error2;
      }
    },
    reset() {
      live();
      const nextGeneration = generation + 1;
      if (!Number.isSafeInteger(nextGeneration)) throw new ClothHostError("WORLD_LIMIT", "Host generation limit exhausted");
      const candidates = freshPair();
      let nextFrame;
      let cleared = false;
      try {
        nextFrame = frameFromState(candidates.state, nextGeneration, candidates.model);
        viewer.setClothFrame(null);
        cleared = true;
        frame = null;
        displayStep = null;
        viewer.setClothFrame(nextFrame);
      } catch (error2) {
        candidates.active.dispose();
        candidates.shadow.dispose();
        needsReset = true;
        phase = cleared ? "reset-display-empty" : "reset-clear-failed";
        lastWork = { stage: phase, accepted: false, error: { name: error2.name, code: error2.code, message: error2.message } };
        throw error2;
      }
      const old = pair2;
      pair2 = candidates;
      acceptedState = candidates.state;
      frame = nextFrame;
      displayStep = 0;
      generation = nextGeneration;
      phase = "paused";
      needsReset = false;
      lastWork = null;
      old.active.dispose();
      old.shadow.dispose();
      return snapshot5();
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        pair2.active.dispose();
        pair2.shadow.dispose();
      }
    }
  };
}
export {
  cad_proxy_exports as cad,
  types_exports as canonical,
  createHostController,
  replay_exports as replay,
  src_exports as root
};
