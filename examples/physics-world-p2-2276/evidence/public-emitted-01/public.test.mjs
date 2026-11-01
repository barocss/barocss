var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// examples/physics-world-p2-2276/public.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// packages/barocss-physics/dist/types.js
var PhysicsError = class extends Error {
  code;
  details;
  constructor(code2, message, details) {
    super(message);
    this.code = code2;
    this.name = "PhysicsError";
    this.details = { code: code2, reason: message, operation: "create", phase: "admission", domain: "world", entityIds: [], accepted: null, ...details };
  }
};

// packages/barocss-physics/dist/recording-owner.js
var recordingWorlds = /* @__PURE__ */ new WeakMap();

// packages/barocss-physics/dist/provider-manifest.generated.js
var providerManifest = {
  "format": "barocss-physics-provider",
  "version": 1,
  "graph": "emitted",
  "entries": [
    "index.js",
    "replay.js"
  ],
  "files": {
    "dynamic-anchor-pair.js": "8e20e96a9a3c803f65d78dfa21aaf530744b2c37e4f3507fd87e828190c800be",
    "dynamic-fixed-joint.js": "c637c4b13cdf432103202f895e50fae7e05c88920cf0889a67f2c16e565bfb5a",
    "dynamic-hinge-joint.js": "8780a6887f0c7cbec6ec2f059b2ada64d0e28d0224279d7ada42e4b79e84baac",
    "identity.js": "7f7243fcc617a32f77d517d029cb90bd99584f518ece49a7d7a4e35ae54d7791",
    "index.js": "94af753ea530941a3abcc3c4efa857b340c1c9592839c1f92ce0c41a6d26f4e3",
    "internal-types.js": "b105d9550d9a3a0dccc02de4bf06d3191f7ce2a0b9241ee9031c14a54dff9b6e",
    "joints.js": "f2893b2f8684f338a8d4832b9fa91c356fd360bf70ebf423062e21911d433ce0",
    "limits.js": "15e4c3baf2645fa8aa040fcd4de7c5d14685e7a6ce1b6c45cffda01c47e08219",
    "math.js": "d82024b2458cf6ffdacef3ce57e0e1b802888bc39168ee032202536d4bdaa028",
    "model-admission.js": "0fbd3522138871a4f844fbb1e803b5f3e288368c62db7f764195d10b76d3b310",
    "recording-owner.js": "cfdebb45a5a4ba3af0926770605b0e57035c361cd717837dbf3506d93e5dd521",
    "replay-compare.js": "46e92b237a3b74725e1f973bc195f3fb3c7d182ea4978f5092608706d1400875",
    "replay-json.js": "02f25563d19011ae80ff0a30127f5af1cd586c7824999ecd3d54cbb1ded25541",
    "replay-validation.js": "cbf265559a7c480a2b9aa4f64cb945b3fd046959d653e7d54fba16281898c980",
    "replay.js": "aaf772b1baae5794777508de80c05f4a8c8aaf559dce626c88a08c0ff04bc71f",
    "types.js": "65a4905c6bda0d4e7a5fc7ea105a1362c8cae1345070b5d17fd524a8790e1f8b",
    "validation.js": "dd5873f30ed65451e5b3abe72ab140e1b4aa2de0b5c75db6b86722a5145b5ec6"
  }
};

// packages/barocss-physics/dist/index.js
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
  const encodeUtf8 = (text22) => {
    const result = [];
    for (const character of text22) {
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
    const record42 = item;
    const keys = Object.keys(record42).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record42[key]);
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
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_STEPS = 3600;
var MAX_STEP_DISPLACEMENT_M = 10;
var MAX_COMMANDS = 64;
var MAX_FORCE_N = 1e6;
var MAX_IMPULSE_NS = 1e5;
var MAX_TORQUE_NM = 1e6;
var MAX_ANGULAR_IMPULSE_NMS = 1e5;
var SOLVER_PASSES = 8;
function error(code2, message) {
  throw new PhysicsError(code2, message);
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
  const material2 = Object.hasOwn(input, "friction") ? friction(input.friction) : { static: 0, dynamic: 0 };
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
      frictionStatic: material2.static,
      frictionDynamic: material2.dynamic,
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
  const inertia22 = inertiaDiagonalKgM2 ?? [inertiaKgM2, inertiaKgM2, inertiaKgM2];
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
    inverseInertiaLocal: inertia22.map((value2) => 1 / value2),
    inverseMass: 1 / massKg,
    restitution,
    frictionStatic: material2.static,
    frictionDynamic: material2.dynamic
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
  const scale32 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale32,
    angularVelocity[1] * scale32,
    angularVelocity[2] * scale32,
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
function inverseInertia(body, vector22) {
  const local = rotate2(inverse(body.orientation), vector22);
  return rotate2(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}
function inertia(body, vector22) {
  const local = rotate2(inverse(body.orientation), vector22);
  return rotate2(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]));
}
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
function applyPairAngle(body, angle, dt2) {
  if (Math.hypot(...angle) > 1) error("NUMERIC_LIMIT", "dynamic pair angular correction exceeds limit");
  body.orientation = advanceOrientation(body.orientation, angle, 1);
  body.angularVelocityRadps = add(body.angularVelocityRadps, scale(angle, 1 / dt2));
}
function projectDynamicPairAnchors(a, b, anchorA, anchorB, dt2) {
  const armA = rotate2(a.orientation, anchorA);
  const armB = rotate2(b.orientation, anchorB);
  const separation = sub(worldPoint(b, anchorB), worldPoint(a, anchorA));
  if (Math.hypot(...separation) > MAX_STEP_DISPLACEMENT_M) {
    error("NUMERIC_LIMIT", "dynamic pair anchor separation exceeds limit");
  }
  const basis22 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const columns = basis22.map((axis) => add(
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
function orientationError(actual, desired) {
  const relative = multiplyQuaternion(actual, inverse(desired));
  const sign = relative[3] < 0 ? -1 : 1;
  const vector22 = scale([relative[0], relative[1], relative[2]], sign);
  const sine = Math.hypot(...vector22);
  if (sine < 1e-12) return scale(vector22, 2);
  return scale(vector22, 2 * Math.atan2(sine, sign * relative[3]) / sine);
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
  const basis22 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const angularColumns = basis22.map((axis) => add(inverseInertia(a, axis), inverseInertia(b, axis)));
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
var magnitude = (vector22) => Math.hypot(...vector22);
var near = (a, b) => magnitude(sub(a, b)) <= 1e-9;
function offsetFixture(joint, a, b) {
  return near(a.positionM, [-0.1, 0, 0]) && near(b.positionM, [0.1, 0, 0]) && near(joint.anchorALocalM, [0.1, 0, 0]) && near(joint.anchorBLocalM, [-0.1, 0, 0]) && near(joint.axisWorld, [0, 0, 1]) && Math.abs(joint.limitRad[0] + 0.8) <= 1e-9 && Math.abs(joint.limitRad[1] - 0.8) <= 1e-9 && a.inverseMass === 1 && b.inverseMass === 1 && a.shape.kind === "sphere" && b.shape.kind === "sphere" && a.shape.radiusM === 0.1 && b.shape.radiusM === 0.1 && joint.motor?.targetSpeedRadps === 0.5 && joint.motor.maxImpulseNms === 1e-4 && joint.motor.maxReactionNms === 0.01;
}
function admitDynamicHingeScene(joint, bodies, gravity) {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
  const identity22 = [0, 0, 0, 1];
  const centred = near(a.positionM, b.positionM) && magnitude(joint.anchorALocalM) === 0 && magnitude(joint.anchorBLocalM) === 0;
  if (magnitude(gravity) !== 0 || !centred && !offsetFixture(joint, a, b) || [a, b].some((body) => magnitude(body.velocityMps) !== 0 || magnitude(body.angularVelocityRadps) !== 0 || body.orientation.some((value, index) => Math.abs(value - identity22[index]) > 1e-12))) {
    error("INVALID_CONFIG", "dynamic hinge needs an admitted resting pair and zero gravity");
  }
}
function admitDynamicHingeCommands(joint, bodies, actions) {
  const axis = joint.axisWorld;
  for (const bodyIndex of [joint.aIndex, joint.bIndex]) {
    const action = actions.get(bodies[bodyIndex].id);
    if (!action) continue;
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector22) => vector22 !== void 0).some((vector22) => magnitude(sub(vector22, scale(axis, dot(vector22, axis)))) > 1e-12)) {
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
  const q2 = t.orientationXYZW.map((x) => finite(x, -1, 1, label));
  if (Math.abs(Math.hypot(...q2) - 1) > 1e-6) error("INVALID_CONFIG", `${label} quaternion must have unit norm`);
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
  function id2(value) {
    if (typeof value !== "string" || !ID.test(value) || ids2.has(value)) error("INVALID_CONFIG", "invalid or duplicate global entity ID");
    ids2.add(value);
    return value;
  }
  const bodiesById = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const raw2 = value;
    const b = exact(value, raw2?.kind === "dynamic" ? ["id", "kind", "massKg", "inertia", "initial"] : ["id", "kind", "initial"], "body");
    const bodyId = id2(b.id);
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
    id2(c.id);
    if (typeof c.bodyId !== "string" || !bodiesById.has(c.bodyId) || colliderByBody.has(c.bodyId)) error("INVALID_CONFIG", "collider requires a unique declared owner");
    transform(c.local, "collider.local");
    const local = c.local;
    if (local.positionM.some((x) => x !== 0) || local.orientationXYZW.some((x, i) => x !== (i === 3 ? 1 : 0))) error("INVALID_CONFIG", "only identity-local colliders are admitted");
    if (typeof c.sensor !== "boolean" || typeof c.ccd !== "boolean") error("INVALID_CONFIG", "sensor and ccd must be explicit booleans");
    const material2 = exact(c.material, ["restitution", "friction"], "material");
    exact(material2.friction, ["static", "dynamic"], "friction");
    const filter = exact(c.filter, ["categoryBits", "maskBits"], "filter");
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
    const material2 = c.material;
    const inertia22 = b.inertia;
    return parseBody({
      id: b.id,
      kind: b.kind,
      shape: c.geometry,
      positionM: initial.positionM,
      orientation: initial.orientationXYZW,
      restitution: material2.restitution,
      friction: material2.friction,
      ...large ? { collisionFilter: c.filter } : {},
      ...c.sensor ? { sensor: true } : {},
      ...c.ccd ? { ccd: true } : {},
      ...b.kind === "dynamic" ? {
        massKg: b.massKg,
        velocityMps: initial.velocityMps,
        angularVelocityRadps: initial.angularVelocityRadps,
        ...inertia22?.kind === "sphere-isotropic" ? { inertiaKgM2: inertia22.kgM2 } : {}
      } : {}
    }, large);
  });
  if (!bodies.some((b) => b.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (large && bodies.some((b) => b.ccd)) error("INVALID_CONFIG", "large profile excludes CCD");
  const numericJoints = jointInputs.map((value) => {
    const raw2 = value;
    const j = exact(value, raw2?.kind === "hinge" ? ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"] : ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM"], "joint");
    id2(j.id);
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
    id2(s.id);
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
    const radiusA = axesA.reduce((sum, basis22, index) => sum + extentA[index] * Math.abs(dot(basis22, axis)), 0);
    const radiusB = axesB.reduce((sum, basis22, index) => sum + extentB[index] * Math.abs(dot(basis22, axis)), 0);
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
  const selected = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, point) => u * point.u + v * point.v > u * best.u + v * best.v ? point : best, candidates[0]));
  const unique = selected.filter((point, index) => selected.findIndex((other) => Math.hypot(...sub(point.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first, second) => first.u - second.u || first.v - second.v);
  return unique.map((point, index) => ({ id: `${reference.body.id}:${reference.axis}:${reference.side}:${index}`, pointM: point.pointM }));
}
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
function admitCcd(bodies, jointCount, gravity) {
  const selected = bodies.filter((body) => body.ccd);
  if (selected.length === 0) return { kind: "none" };
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
  if ([...min, ...max].some((value) => !Number.isFinite(value))) error("NUMERIC_LIMIT", "nonfinite broad-phase bounds");
  return { min, max };
}
function boundsOverlap(a, b) {
  for (let axis = 0; axis < 3; axis++) {
    if (a.max[axis] + 1e-9 < b.min[axis] || b.max[axis] + 1e-9 < a.min[axis]) return false;
  }
  return true;
}
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
function publicState(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt2, identity22, colliderIds) {
  return {
    identity: { ...identity22 },
    stepIndex,
    timeSeconds: stepIndex * dt2,
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
function createPhysicsWorld(model2, options2) {
  const admitted = admitModel(model2, options2);
  const dt2 = admitted.options.fixedStepSeconds;
  const gravity = [...admitted.model.gravityMps2];
  const useAabb = admitted.options.broadPhase === "aabb";
  const usePersistentBox = admitted.options.profile === "rigid-persistent-box-v1";
  const largeMode = admitted.options.profile === "rigid-large-v1";
  let bodies = admitted.bodies;
  let joints = admitted.joints;
  let modelCopy = admitted.model;
  const colliderIds = new Map(admitted.model.colliders.map((collider2) => [collider2.bodyId, collider2.id]));
  const identity22 = {
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
      return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt2, identity22, colliderIds);
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
      if (largeMode) wakeForActions(next, contacts, actions, nextSleepFrames);
      for (const body of next) {
        if (body.kind !== "dynamic" || largeMode && body.sleeping) continue;
        const action = actions.get(body.id);
        body.angularVelocityRadps = add(
          body.angularVelocityRadps,
          inverseInertia(body, add(
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
        const body = next[bodyIndex];
        const action = actions.get(body.id);
        if (body.kind === "kinematic") {
          const target = action?.positionM ?? body.positionM;
          const delta = target.map((value, index) => value - body.positionM[index]);
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M || delta.some((value) => Math.abs(value / dt2) > 1e3)) {
            error("NUMERIC_LIMIT", `${body.id} exceeded kinematic movement limit`);
          }
          body.velocityMps = delta.map((value) => value / dt2);
          body.positionM = [...target];
        } else if (body.kind === "dynamic") {
          if (largeMode && body.sleeping) continue;
          if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e3) || Math.hypot(...body.angularVelocityRadps) * dt2 > 10) {
            error("NUMERIC_LIMIT", `${body.id} exceeded angular movement limit`);
          }
          body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, dt2);
          for (let i = 0; i < 3; i++) {
            body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
            body.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * dt2;
          }
          if (Math.hypot(...body.velocityMps) * dt2 > MAX_STEP_DISPLACEMENT_M) {
            error("NUMERIC_LIMIT", `${body.id} exceeded step displacement limit`);
          }
          for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt2;
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
      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt2, identity22, colliderIds);
      const preparedRecording = owner ? owner.prepare(recordedCommands, state) : null;
      const preparedCommandCount = owner ? owner.commandCount + recordedCommands.length : 0;
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
        return { kind: "overlap-sphere", colliderIds: bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body)).map((body) => body.id).sort().map((id2) => colliderIds.get(id2)) };
      }
      if (data.kind !== "raycast") error("INVALID_QUERY", "unsupported query kind");
      const query2 = queryRecord(data, ["kind", "originM", "direction", "maxDistanceM", "includeSensors"], []);
      const origin = queryVector(query2.originM, 1e4, "originM");
      const direction = queryVector(query2.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) error("INVALID_QUERY", "direction must be a unit 3-vector");
      const limit = queryNumber(query2.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
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
      owner = null;
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
      const prepared = prepare({ model: copyData(modelCopy), options: copyData(admitted.options), state: getState() });
      owner = prepared;
      return prepared;
    }),
    detach: (current) => {
      if (!disposed) guarded("record", () => {
        if (owner === current) owner = null;
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
var DT = 1 / 120;
var WALKABLE = Math.cos(10 * Math.PI / 180);

// packages/barocss-physics/dist/replay.js
var replay_exports = {};
__export(replay_exports, {
  createPhysicsRecorder: () => createPhysicsRecorder,
  deserializePhysicsRecording: () => deserializePhysicsRecording,
  restorePhysicsRecording: () => restorePhysicsRecording,
  serializePhysicsRecording: () => serializePhysicsRecording
});

// packages/barocss-physics/dist/identity.js
function copyData2(input) {
  let count = 0;
  function copy(value, depth) {
    if (++count > 1e6 || depth > 32)
      throw new PhysicsError("INVALID_CONFIG", "data exceeds bounded depth or size");
    if (value === null || typeof value === "boolean")
      return value;
    if (typeof value === "string") {
      for (const character of value) {
        const point = character.codePointAt(0);
        if (point >= 55296 && point <= 57343)
          throw new PhysicsError("INVALID_CONFIG", "strings must be well-formed Unicode");
      }
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value))
      return value;
    if (typeof value !== "object" || value === null)
      throw new PhysicsError("INVALID_CONFIG", "only finite plain data is supported");
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
function canonicalEncode2(input) {
  const value = copyData2(input);
  const bytes = [];
  const encodeUtf8 = (text3) => {
    const result = [];
    for (const character of text3) {
      let point = character.codePointAt(0);
      if (point >= 55296 && point <= 57343)
        point = 65533;
      if (point < 128)
        result.push(point);
      else if (point < 2048)
        result.push(192 | point >> 6, 128 | point & 63);
      else if (point < 65536)
        result.push(224 | point >> 12, 128 | point >> 6 & 63, 128 | point & 63);
      else
        result.push(240 | point >> 18, 128 | point >> 12 & 63, 128 | point >> 6 & 63, 128 | point & 63);
    }
    return result;
  };
  const uint32 = (number2) => {
    for (let i = 0; i < 4; i++)
      bytes.push(number2 >>> i * 8 & 255);
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
      for (const byte of encoded)
        bytes.push(byte);
      return;
    }
    if (typeof item === "number") {
      bytes.push(4);
      const data = new DataView(new ArrayBuffer(8));
      data.setFloat64(0, item, true);
      for (let i = 0; i < 8; i++)
        bytes.push(data.getUint8(i));
      return;
    }
    if (Array.isArray(item)) {
      bytes.push(5);
      uint32(item.length);
      for (const entry of item)
        write(entry);
      return;
    }
    const record6 = item;
    const keys = Object.keys(record6).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record6[key]);
    }
  }
  write(value);
  return Uint8Array.from(bytes);
}
var K2 = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
var rotate3 = (x, n) => x >>> n | x << 32 - n;
function sha2562(bytes) {
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
    for (let i = 0; i < 16; i++)
      w[i] = view4.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a2 = w[i - 15], b2 = w[i - 2];
      w[i] = w[i - 16] + (rotate3(a2, 7) ^ rotate3(a2, 18) ^ a2 >>> 3) + w[i - 7] + (rotate3(b2, 17) ^ rotate3(b2, 19) ^ b2 >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = j + (rotate3(e, 6) ^ rotate3(e, 11) ^ rotate3(e, 25)) + (e & f ^ ~e & g) + K2[i] + w[i] >>> 0;
      const t2 = (rotate3(a, 2) ^ rotate3(a, 13) ^ rotate3(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      j = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    for (const [i, v] of [a, b, c, d, e, f, g, j].entries())
      h[i] = h[i] + v >>> 0;
  }
  return `sha256:${h.map((word) => word.toString(16).padStart(8, "0")).join("")}`;
}
function digest2(value) {
  return sha2562(canonicalEncode2(value));
}

// packages/barocss-physics/dist/replay-json.js
function replayError(code2, message) {
  throw new PhysicsError(code2, message);
}
function copyValue(input, label, depth, budget) {
  if (++budget.nodes > 5e4 || depth > 32)
    replayError("INVALID_SNAPSHOT", `${label} exceeds JSON depth or size`);
  budget.bytes += input === null || typeof input === "boolean" ? 1 : typeof input === "number" ? 9 : 5;
  if (budget.bytes + 8 > MAX_RECORDING_BYTES)
    replayError("INVALID_SNAPSHOT", `${label} exceeds byte limit`);
  if (input === null || typeof input === "boolean")
    return input;
  if (typeof input === "string") {
    for (const character of input) {
      const point = character.codePointAt(0);
      budget.bytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
      if (point >= 55296 && point <= 57343)
        replayError("INVALID_SNAPSHOT", `${label} contains malformed Unicode`);
    }
    if (budget.bytes + 8 > MAX_RECORDING_BYTES)
      replayError("INVALID_SNAPSHOT", `${label} string exceeds byte limit`);
    return input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input))
      replayError("INVALID_SNAPSHOT", `${label} contains a nonfinite number`);
    return input;
  }
  if (typeof input !== "object" || Object.getPrototypeOf(input) !== (Array.isArray(input) ? Array.prototype : Object.prototype)) {
    replayError("INVALID_SNAPSHOT", `${label} must be plain JSON-compatible data`);
  }
  if (budget.seen.has(input))
    replayError("INVALID_SNAPSHOT", `${label} has a cycle`);
  budget.seen.add(input);
  let output;
  if (Array.isArray(input)) {
    if (input.length > 4096 || Reflect.ownKeys(input).length !== input.length + 1) {
      replayError("INVALID_SNAPSHOT", `${label} must be a bounded dense array`);
    }
    const copied = [];
    for (let index = 0; index < input.length; index++) {
      const field = Object.getOwnPropertyDescriptor(input, String(index));
      if (!field?.enumerable || !("value" in field))
        replayError("INVALID_SNAPSHOT", `${label}[${index}] must be data`);
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
    if (budget.nodes > 5e4 || budget.bytes + 8 > MAX_RECORDING_BYTES)
      replayError("INVALID_SNAPSHOT", `${label} exceeds size limit`);
    const copied = {};
    for (const key of keys) {
      const field = Object.getOwnPropertyDescriptor(input, key);
      if (!field?.enumerable || !("value" in field))
        replayError("INVALID_SNAPSHOT", `${label}.${key} must be data`);
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
function exactFields(value, fields4, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).length !== fields4.length || Reflect.ownKeys(value).some((key) => typeof key !== "string" || !fields4.includes(key))) {
    replayError("INVALID_SNAPSHOT", `${label} has missing or unsupported fields`);
  }
}
function equivalentReplayIdentity(left, right) {
  const a = canonicalEncode2(left), b = canonicalEncode2(right);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
var RECORDING_MAGIC = Uint8Array.of(66, 67, 80, 72, 82, 69, 67, 49);
var MAX_RECORDING_BYTES = 1024 * 1024;
function encodeRecordingData(input) {
  const data = canonicalEncode2(copyReplayJson(input, "recording"));
  if (data.length + RECORDING_MAGIC.length > MAX_RECORDING_BYTES)
    replayError("INVALID_SNAPSHOT", "recording exceeds byte limit");
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
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let offset = RECORDING_MAGIC.length, nodes = 0;
  function take(length2) {
    if (length2 > bytes.length - offset)
      replayError("INVALID_SNAPSHOT", "truncated recording");
    const start = offset;
    offset += length2;
    return start;
  }
  function uint32() {
    return view4.getUint32(take(4), true);
  }
  function read(depth) {
    if (++nodes > 5e4 || depth > 32)
      replayError("INVALID_SNAPSHOT", "recording exceeds node or depth limit");
    const tag = bytes[take(1)];
    if (tag === 0)
      return null;
    if (tag === 1 || tag === 2)
      return tag === 2;
    if (tag === 3) {
      const length2 = uint32(), start = take(length2);
      return decoder.decode(bytes.subarray(start, start + length2));
    }
    if (tag === 4) {
      const value = view4.getFloat64(take(8), true);
      if (!Number.isFinite(value))
        replayError("INVALID_SNAPSHOT", "recording contains nonfinite number");
      return value;
    }
    if (tag === 5) {
      const length2 = uint32();
      if (length2 > 4096)
        replayError("INVALID_SNAPSHOT", "recording array exceeds limit");
      return Array.from({ length: length2 }, () => read(depth + 1));
    }
    if (tag === 6) {
      const length2 = uint32();
      if (length2 > 64)
        replayError("INVALID_SNAPSHOT", "recording record exceeds limit");
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
    if (offset !== bytes.length)
      replayError("INVALID_SNAPSHOT", "recording has trailing bytes");
    return result;
  } catch (error3) {
    if (error3 instanceof PhysicsError)
      throw error3;
    replayError("INVALID_SNAPSHOT", "invalid recording encoding");
  }
}

// packages/barocss-physics/dist/replay-compare.js
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
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equivalentReplayValue(left[key], right[key]));
}

// packages/barocss-physics/dist/limits.js
var ID2 = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_COMMANDS2 = 64;
var MAX_FORCE_N2 = 1e6;
var MAX_IMPULSE_NS2 = 1e5;
var MAX_TORQUE_NM2 = 1e6;
var MAX_ANGULAR_IMPULSE_NMS2 = 1e5;

// packages/barocss-physics/dist/validation.js
function error2(code2, message) {
  throw new PhysicsError(code2, message);
}
function record2(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    error2("INVALID_CONFIG", `${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    error2("INVALID_CONFIG", `${label} must be a plain object`);
  return value;
}
function fields2(value, allowed, label) {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.includes(key))) {
    error2("INVALID_CONFIG", `${label} has an unsupported field`);
  }
}
function finite2(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    error2("INVALID_CONFIG", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function vector2(value, min, max, label) {
  if (!Array.isArray(value) || value.length !== 3)
    error2("INVALID_CONFIG", `${label} must be a 3-vector`);
  return [0, 1, 2].map((index) => finite2(value[index], min, max, `${label}[${index}]`));
}
function angularVector2(value) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error2("INVALID_CONFIG", "angularVelocityRadps must be a dense 3-vector");
  }
  return vector2(value, -1e3, 1e3, "angularVelocityRadps");
}
function quaternion2(value) {
  if (!Array.isArray(value) || value.length !== 4 || Reflect.ownKeys(value).length !== 5 || ![0, 1, 2, 3].every((index) => Object.hasOwn(value, index))) {
    error2("INVALID_CONFIG", "orientation must be a dense [x,y,z,w] quaternion");
  }
  const values = value.map((component) => finite2(component, -1, 1, "orientation"));
  const magnitude2 = Math.hypot(...values);
  if (Math.abs(magnitude2 - 1) > 1e-6)
    error2("INVALID_CONFIG", "orientation must have unit norm");
  return values.map((component) => component / magnitude2);
}
function shape2(value) {
  const input = record2(value, "shape");
  if (input.kind === "sphere") {
    fields2(input, ["kind", "radiusM"], "sphere");
    return { kind: "sphere", radiusM: finite2(input.radiusM, 1e-4, 1e3, "radiusM") };
  }
  if (input.kind === "box") {
    fields2(input, ["kind", "halfExtentsM"], "box");
    return { kind: "box", halfExtentsM: vector2(input.halfExtentsM, 1e-4, 1e3, "halfExtentsM") };
  }
  if (input.kind === "capsule") {
    fields2(input, ["kind", "radiusM", "halfLengthM"], "capsule");
    return {
      kind: "capsule",
      radiusM: finite2(input.radiusM, 1e-4, 1e3, "radiusM"),
      halfLengthM: finite2(input.halfLengthM, 1e-4, 1e3, "halfLengthM")
    };
  }
  return error2("INVALID_CONFIG", "unsupported collider shape");
}
function friction2(value) {
  const input = record2(value, "friction");
  fields2(input, ["static", "dynamic"], "friction");
  const staticCoefficient = finite2(input.static, 0, 2, "friction.static");
  const dynamicCoefficient = finite2(input.dynamic, 0, staticCoefficient, "friction.dynamic");
  return { static: staticCoefficient, dynamic: dynamicCoefficient };
}
function collisionFilter2(value) {
  const input = record2(value, "collisionFilter");
  fields2(input, ["categoryBits", "maskBits"], "collisionFilter");
  if (!Number.isInteger(input.categoryBits) || !Number.isInteger(input.maskBits)) {
    error2("INVALID_CONFIG", "collision filter bits must be integers");
  }
  return {
    categoryBits: finite2(input.categoryBits, 1, 65535, "categoryBits"),
    maskBits: finite2(input.maskBits, 0, 65535, "maskBits")
  };
}
function parseBody2(value, largeMode = false) {
  const input = record2(value, "body");
  if (typeof input.id !== "string" || !ID2.test(input.id))
    error2("INVALID_CONFIG", "invalid body ID");
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
  if (Object.hasOwn(input, "sensor") && input.sensor !== true)
    error2("INVALID_CONFIG", "sensor must be true");
  const sensor = input.sensor === true;
  const parsedShape = shape2(input.shape);
  if (Object.hasOwn(input, "ccd") && (input.ccd !== true || parsedShape.kind !== "sphere" && parsedShape.kind !== "box")) {
    error2("INVALID_CONFIG", "ccd is supported for dynamic spheres or boxes only and must be true");
  }
  const positionM = vector2(input.positionM, -1e4, 1e4, "positionM");
  const restitution = finite2(input.restitution, 0, 1, "restitution");
  const material2 = Object.hasOwn(input, "friction") ? friction2(input.friction) : { static: 0, dynamic: 0 };
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
      frictionStatic: material2.static,
      frictionDynamic: material2.dynamic,
      ...filter ? { collisionFilter: filter } : {}
    };
  }
  const massKg = finite2(input.massKg, 1e-6, 1e6, "massKg");
  if (parsedShape.kind !== "sphere" && Object.hasOwn(input, "inertiaKgM2")) {
    error2("INVALID_CONFIG", "inertiaKgM2 override is supported for spheres only");
  }
  const inertiaKgM2 = parsedShape.kind === "sphere" ? Object.hasOwn(input, "inertiaKgM2") ? finite2(input.inertiaKgM2, 1e-12, 1e12, "inertiaKgM2") : 0.4 * massKg * parsedShape.radiusM ** 2 : void 0;
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
    velocityMps: vector2(input.velocityMps, -1e3, 1e3, "velocityMps"),
    orientation,
    angularVelocityRadps: Object.hasOwn(input, "angularVelocityRadps") ? angularVector2(input.angularVelocityRadps) : [0, 0, 0],
    ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
    ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2 },
    inverseInertiaLocal: inertia3.map((value2) => 1 / value2),
    inverseMass: 1 / massKg,
    restitution,
    frictionStatic: material2.static,
    frictionDynamic: material2.dynamic
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
  const admitted = /* @__PURE__ */ new Map();
  for (const [index, raw2] of input.entries()) {
    if (raw2 === null || typeof raw2 !== "object" || Array.isArray(raw2) || Object.getPrototypeOf(raw2) !== Object.prototype && Object.getPrototypeOf(raw2) !== null) {
      error2("INVALID_COMMAND", `command ${index} must be a plain object`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw2);
    const keys = Reflect.ownKeys(raw2);
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
    const previous = admitted.get(body.id) ?? {};
    if (Object.hasOwn(previous, valueKey))
      error2("INVALID_COMMAND", `duplicate ${kind} command for ${body.id}`);
    const bound = kind === "force" ? MAX_FORCE_N2 : kind === "impulse" ? MAX_IMPULSE_NS2 : kind === "torque" ? MAX_TORQUE_NM2 : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS2 : 1e4;
    const value = commandVector2(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted;
}

// packages/barocss-physics/dist/math.js
function multiplyQuaternion2(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}
var add2 = (a, b) => a.map((value, index) => value + b[index]);
var sub2 = (a, b) => a.map((value, index) => value - b[index]);
var scale2 = (a, value) => a.map((component) => component * value);
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var inverse2 = (q2) => [-q2[0], -q2[1], -q2[2], q2[3]];
function rotate4(q2, v) {
  const axis = [q2[0], q2[1], q2[2]];
  const t = scale2(cross2(axis, v), 2);
  return add2(v, add2(scale2(t, q2[3]), cross2(axis, t)));
}
var worldPoint2 = (body, point) => add2(body.positionM, rotate4(body.orientation, point));

// packages/barocss-physics/dist/joints.js
function denseJointVector2(value, bound, label) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error2("INVALID_CONFIG", `${label} must be a dense 3-vector`);
  }
  return vector2(value, -bound, bound, label);
}
function parseJoints2(value, bodies) {
  if (!Array.isArray(value) || value.length > 8 || Reflect.ownKeys(value).length !== value.length + 1 || !Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(Boolean)) {
    error2("INVALID_CONFIG", "joints must be a dense array of at most 8");
  }
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seenIds = /* @__PURE__ */ new Set(), seenDynamic = /* @__PURE__ */ new Set();
  const joints = value.map((raw2) => {
    const input = record2(raw2, "joint");
    if (input.kind !== "fixed" && input.kind !== "hinge")
      error2("INVALID_CONFIG", "unsupported joint kind");
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
      if (Math.abs(Math.hypot(...axisWorld) - 1) > 1e-9)
        error2("INVALID_CONFIG", "hinge axis must be unit length");
      const limits3 = input.limitRad;
      if (!Array.isArray(limits3) || limits3.length !== 2 || Reflect.ownKeys(limits3).length !== 3 || ![0, 1].every((index) => Object.hasOwn(limits3, index))) {
        error2("INVALID_CONFIG", "hinge limits must be a dense pair");
      }
      const low = finite2(limits3[0], -Math.PI / 2, 0, "limitRad[0]");
      const high = finite2(limits3[1], 0, Math.PI / 2, "limitRad[1]");
      limitRad = [low, high];
      if (Object.hasOwn(input, "motor")) {
        const motorInput = record2(input.motor, "motor");
        fields2(motorInput, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
        const targetSpeedRadps = finite2(motorInput.targetSpeedRadps, -2, 2, "motor.targetSpeedRadps");
        const maxImpulseNms = finite2(motorInput.maxImpulseNms, 0, 0.05, "motor.maxImpulseNms");
        const maxReactionNms = finite2(motorInput.maxReactionNms, 0, 1, "motor.maxReactionNms");
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

// packages/barocss-physics/dist/model-admission.js
function exact2(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    error2("INVALID_CONFIG", `${label} must be a record`);
  const input = value;
  if (Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key)))
    error2("INVALID_CONFIG", `${label} requires exact fields: ${keys.join(",")}`);
  return input;
}
function text2(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096)
    error2("INVALID_CONFIG", `${label} must be a bounded nonempty string`);
  return value;
}
function list2(value, maximum, label) {
  if (!Array.isArray(value) || value.length > maximum)
    error2("INVALID_CONFIG", `${label} exceeds the profile bound`);
  return value;
}
function transform2(value, label) {
  const t = exact2(value, ["positionM", "orientationXYZW"], label);
  vector2(t.positionM, -1e4, 1e4, `${label}.positionM`);
  if (!Array.isArray(t.orientationXYZW) || t.orientationXYZW.length !== 4)
    error2("INVALID_CONFIG", `${label} requires an XYZW quaternion`);
  const q2 = t.orientationXYZW.map((x) => finite2(x, -1, 1, label));
  if (Math.abs(Math.hypot(...q2) - 1) > 1e-6)
    error2("INVALID_CONFIG", `${label} quaternion must have unit norm`);
}
function admitModel2(rawModel, rawOptions) {
  const model2 = copyData2(rawModel);
  const options2 = copyData2(rawOptions);
  const input = exact2(model2, ["format", "version", "revision", "frame", "units", "gravityMps2", "bodies", "colliders", "joints", "cloths", "fluids", "sourceBindings"], "model");
  if (input.format !== "barocss-physics-model" || input.version !== 1)
    error2("INVALID_CONFIG", "unsupported model format or version");
  text2(input.revision, "revision");
  const frame = exact2(input.frame, ["id", "basis", "rotation"], "frame");
  text2(frame.id, "frame.id");
  if (frame.basis !== "right-handed-xyz" || frame.rotation !== "local-to-world-xyzw")
    error2("INVALID_CONFIG", "unsupported frame convention");
  const units = exact2(input.units, ["length", "mass", "time", "angle"], "units");
  if (units.length !== "m" || units.mass !== "kg" || units.time !== "s" || units.angle !== "rad")
    error2("INVALID_CONFIG", "model units must be m/kg/s/rad");
  vector2(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const opt = exact2(options2, ["profile", "fixedStepSeconds", "broadPhase"], "options");
  if (!["rigid-discrete-v1", "rigid-persistent-box-v1", "rigid-large-v1"].includes(opt.profile))
    error2("INVALID_CONFIG", "profile is not implemented");
  finite2(opt.fixedStepSeconds, 1 / 240, 1 / 30, "fixedStepSeconds");
  const large = opt.profile === "rigid-large-v1";
  if (opt.broadPhase !== "aabb" && (large || opt.broadPhase !== "direct"))
    error2("INVALID_CONFIG", "unsupported broadPhase for profile");
  const bodyInputs = list2(input.bodies, large ? 64 : opt.profile === "rigid-persistent-box-v1" ? 4 : 32, "bodies");
  if (bodyInputs.length === 0)
    error2("INVALID_CONFIG", "at least one body is required");
  const colliders = list2(input.colliders, bodyInputs.length, "colliders");
  const jointInputs = list2(input.joints, large ? 0 : 8, "joints");
  list2(input.cloths, 0, "cloths");
  list2(input.fluids, 0, "fluids");
  const bindings = list2(input.sourceBindings, 128, "sourceBindings");
  const ids2 = /* @__PURE__ */ new Set();
  function id2(value) {
    if (typeof value !== "string" || !ID2.test(value) || ids2.has(value))
      error2("INVALID_CONFIG", "invalid or duplicate global entity ID");
    ids2.add(value);
    return value;
  }
  const bodiesById = /* @__PURE__ */ new Map();
  for (const value of bodyInputs) {
    const raw2 = value;
    const b = exact2(value, raw2?.kind === "dynamic" ? ["id", "kind", "massKg", "inertia", "initial"] : ["id", "kind", "initial"], "body");
    const bodyId = id2(b.id);
    if (!["dynamic", "static", "kinematic"].includes(b.kind))
      error2("INVALID_CONFIG", "unsupported body kind");
    if (b.kind === "dynamic") {
      const initial = exact2(b.initial, ["positionM", "orientationXYZW", "velocityMps", "angularVelocityRadps"], "initial");
      transform2({ positionM: initial.positionM, orientationXYZW: initial.orientationXYZW }, "initial");
      vector2(initial.velocityMps, -1e3, 1e3, "velocityMps");
      vector2(initial.angularVelocityRadps, -1e3, 1e3, "angularVelocityRadps");
      finite2(b.massKg, 1e-6, 1e6, "massKg");
      const i = b.inertia;
      exact2(i, i?.kind === "sphere-isotropic" ? ["kind", "about", "frame", "kgM2"] : ["kind", "about", "frame"], "inertia");
      if (i.about !== "com" || i.frame !== "body-local" || !["primitive-com", "sphere-isotropic"].includes(i.kind))
        error2("INVALID_CONFIG", "unsupported inertia");
      if (i.kind === "sphere-isotropic")
        finite2(i.kgM2, 1e-12, 1e12, "inertia.kgM2");
    } else
      transform2(b.initial, "initial");
    bodiesById.set(bodyId, b);
  }
  const colliderByBody = /* @__PURE__ */ new Map();
  for (const value of colliders) {
    const c = exact2(value, ["id", "bodyId", "geometry", "local", "material", "sensor", "ccd", "filter"], "collider");
    id2(c.id);
    if (typeof c.bodyId !== "string" || !bodiesById.has(c.bodyId) || colliderByBody.has(c.bodyId))
      error2("INVALID_CONFIG", "collider requires a unique declared owner");
    transform2(c.local, "collider.local");
    const local = c.local;
    if (local.positionM.some((x) => x !== 0) || local.orientationXYZW.some((x, i) => x !== (i === 3 ? 1 : 0)))
      error2("INVALID_CONFIG", "only identity-local colliders are admitted");
    if (typeof c.sensor !== "boolean" || typeof c.ccd !== "boolean")
      error2("INVALID_CONFIG", "sensor and ccd must be explicit booleans");
    const material2 = exact2(c.material, ["restitution", "friction"], "material");
    exact2(material2.friction, ["static", "dynamic"], "friction");
    const filter = exact2(c.filter, ["categoryBits", "maskBits"], "filter");
    if (!large && (filter.categoryBits !== 1 || filter.maskBits !== 65535))
      error2("INVALID_CONFIG", "non-large profile requires no-filter values");
    const body = bodiesById.get(c.bodyId);
    if (c.sensor && body.kind === "dynamic" || c.ccd && body.kind !== "dynamic")
      error2("INVALID_CONFIG", "unsupported sensor or CCD body role");
    colliderByBody.set(c.bodyId, c);
  }
  if (colliderByBody.size !== bodyInputs.length)
    error2("INVALID_CONFIG", "each rigid body requires exactly one collider");
  const bodies = bodyInputs.map((value) => {
    const b = value;
    const c = colliderByBody.get(b.id);
    const initial = b.initial;
    const material2 = c.material;
    const inertia3 = b.inertia;
    return parseBody2({
      id: b.id,
      kind: b.kind,
      shape: c.geometry,
      positionM: initial.positionM,
      orientation: initial.orientationXYZW,
      restitution: material2.restitution,
      friction: material2.friction,
      ...large ? { collisionFilter: c.filter } : {},
      ...c.sensor ? { sensor: true } : {},
      ...c.ccd ? { ccd: true } : {},
      ...b.kind === "dynamic" ? {
        massKg: b.massKg,
        velocityMps: initial.velocityMps,
        angularVelocityRadps: initial.angularVelocityRadps,
        ...inertia3?.kind === "sphere-isotropic" ? { inertiaKgM2: inertia3.kgM2 } : {}
      } : {}
    }, large);
  });
  if (!bodies.some((b) => b.kind === "dynamic"))
    error2("INVALID_CONFIG", "at least one dynamic body is required");
  if (large && bodies.some((b) => b.ccd))
    error2("INVALID_CONFIG", "large profile excludes CCD");
  const numericJoints = jointInputs.map((value) => {
    const raw2 = value;
    const j = exact2(value, raw2?.kind === "hinge" ? ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM", "axisWorld", "limitRad", "motor"] : ["id", "kind", "bodyAId", "bodyBId", "anchorALocalM", "anchorBLocalM"], "joint");
    id2(j.id);
    if (j.kind !== "fixed" && j.kind !== "hinge")
      error2("INVALID_CONFIG", "unsupported joint kind");
    if (j.kind === "hinge" && j.motor !== null)
      exact2(j.motor, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
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
  const joints = parseJoints2(numericJoints, bodies);
  const numericalIds = new Set(ids2);
  for (const value of bindings) {
    const s = exact2(value, ["id", "sourceRevision", "sourceDigest", "modelId", "occurrenceId", "entityIds", "approximation"], "sourceBinding");
    id2(s.id);
    for (const key of ["sourceRevision", "modelId", "occurrenceId"])
      text2(s[key], key);
    if (typeof s.sourceDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(s.sourceDigest))
      error2("INVALID_CONFIG", "invalid source digest");
    const refs = list2(s.entityIds, 128, "entityIds");
    if (refs.length === 0 || new Set(refs).size !== refs.length || refs.some((ref) => typeof ref !== "string" || !numericalIds.has(ref)))
      error2("INVALID_CONFIG", "invalid source binding references");
    const a = exact2(s.approximation, ["kind", "lossLabel"], "approximation");
    if (a.kind !== "control-net-box" && a.kind !== "control-net-sphere")
      error2("INVALID_CONFIG", "unsupported approximation");
    text2(a.lossLabel, "lossLabel");
  }
  return { model: model2, options: options2, bodies, joints };
}

// packages/barocss-physics/dist/replay-validation.js
function record3(value, keys, label) {
  exactFields(value, keys, label);
  return value;
}
function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value))
    replayError("INVALID_SNAPSHOT", "state number is invalid");
}
function vector3(value, length2 = 3) {
  if (!Array.isArray(value) || value.length !== length2)
    replayError("INVALID_SNAPSHOT", "state vector is invalid");
  value.forEach(number);
}
function ids(values, expected2, fields4, validate) {
  if (!Array.isArray(values) || values.length !== expected2.length)
    replayError("INVALID_SNAPSHOT", "state entity list differs from model");
  values.forEach((value, index) => {
    const data = record3(value, fields4, "state entity");
    if (data.id !== expected2[index])
      replayError("INVALID_SNAPSHOT", "state entity ID differs from model");
    validate(data);
  });
}
function identity(value) {
  const data = record3(value, ["modelRevision", "modelDigest", "configurationDigest", "providerDigest", "profile", "frameId", "fixedStepSeconds"], "identity");
  for (const name of ["modelDigest", "configurationDigest", "providerDigest"]) {
    if (typeof data[name] !== "string" || !/^sha256:[a-f0-9]{64}$/.test(data[name]))
      replayError("INVALID_SNAPSHOT", "identity digest is invalid");
  }
  if (typeof data.modelRevision !== "string" || typeof data.frameId !== "string" || typeof data.profile !== "string")
    replayError("INVALID_SNAPSHOT", "identity fields are invalid");
  number(data.fixedStepSeconds);
}
function admitRecording(input) {
  const copied = copyReplayJson(input, "recording");
  const data = record3(copied, ["format", "version", "model", "options", "identity", "frames", "finalState"], "recording");
  if (data.format !== "barocss-physics-recording" || data.version !== 1)
    replayError("INVALID_SNAPSHOT", "unsupported recording");
  encodeRecordingData(copied);
  if (canonicalEncode2(data.model).length > 128 * 1024)
    replayError("INVALID_SNAPSHOT", "recording model exceeds byte limit");
  let admitted;
  try {
    admitted = admitModel2(data.model, data.options);
  } catch {
    replayError("INVALID_SNAPSHOT", "recording model or options are invalid");
  }
  const model2 = admitted.model, options2 = admitted.options;
  identity(data.identity);
  if (!Array.isArray(data.frames) || data.frames.length > 512)
    replayError("INVALID_SNAPSHOT", "recording frame limit exceeded");
  let commandCount = 0;
  for (const [index, frame] of data.frames.entries()) {
    const f = record3(frame, ["stepIndex", "commands"], "frame");
    if (f.stepIndex !== index + 1 || !Array.isArray(f.commands) || f.commands.length > 64)
      replayError("INVALID_SNAPSHOT", "frame cursor or commands are invalid");
    commandCount += f.commands.length;
    try {
      parseCommands2(f.commands, admitted.bodies);
    } catch {
      replayError("INVALID_SNAPSHOT", "frame commands are invalid");
    }
  }
  if (commandCount > 4096)
    replayError("INVALID_SNAPSHOT", "recording command limit exceeded");
  const state = record3(data.finalState, ["identity", "stepIndex", "timeSeconds", "bodies", "joints", "contacts", "events", "ccdHits", "cloths", "fluids", "pairStats"], "final state");
  identity(state.identity);
  if (state.stepIndex !== data.frames.length || state.timeSeconds !== data.frames.length * options2.fixedStepSeconds)
    replayError("INVALID_SNAPSHOT", "final cursor differs from log");
  if (!equivalentReplayIdentity(data.identity, state.identity))
    replayError("INVALID_SNAPSHOT", "final identity differs from recording");
  const ident = data.identity;
  if (ident.modelRevision !== model2.revision || ident.modelDigest !== digest2(model2) || ident.configurationDigest !== digest2(options2) || ident.profile !== options2.profile || ident.frameId !== model2.frame.id || !Object.is(ident.fixedStepSeconds, options2.fixedStepSeconds))
    replayError("INVALID_SNAPSHOT", "recording identity differs from inputs");
  ids(state.bodies, model2.bodies.map((b) => b.id), ["id", "kind", "positionM", "orientationXYZW", "velocityMps", "angularVelocityRadps", "sleeping"], (b) => {
    const source = model2.bodies.find((item) => item.id === b.id);
    if (b.kind !== source.kind || typeof b.sleeping !== "boolean")
      replayError("INVALID_SNAPSHOT", "body state kind or sleep flag is invalid");
    vector3(b.positionM);
    vector3(b.orientationXYZW, 4);
    vector3(b.velocityMps);
    vector3(b.angularVelocityRadps);
  });
  const bodyIds = new Set(model2.bodies.map((b) => b.id)), colliders = new Map(model2.colliders.map((c) => [c.id, c.bodyId]));
  const body = (value) => {
    if (typeof value !== "string" || !bodyIds.has(value))
      replayError("INVALID_SNAPSHOT", "unknown body ID");
  };
  const collider2 = (value) => {
    if (typeof value !== "string" || !colliders.has(value))
      replayError("INVALID_SNAPSHOT", "unknown collider ID");
  };
  ids(state.joints, model2.joints.map((j) => j.id), ["id", "bodyAId", "bodyBId", "linearImpulseOnBNs", "angularImpulseOnBNms", "angleRad", "motorImpulseNms"], (j) => {
    const source = model2.joints.find((item) => item.id === j.id);
    if (j.bodyAId !== source.bodyAId || j.bodyBId !== source.bodyBId)
      replayError("INVALID_SNAPSHOT", "joint owners differ");
    vector3(j.linearImpulseOnBNs);
    vector3(j.angularImpulseOnBNms);
    if (source.kind === "fixed" ? j.angleRad !== null : typeof j.angleRad !== "number")
      replayError("INVALID_SNAPSHOT", "joint angle is invalid");
    if (source.kind === "hinge" && source.motor ? typeof j.motorImpulseNms !== "number" : j.motorImpulseNms !== null)
      replayError("INVALID_SNAPSHOT", "joint motor state is invalid");
  });
  function entries(value, keys, check6) {
    if (!Array.isArray(value))
      replayError("INVALID_SNAPSHOT", "state list is invalid");
    value.forEach((item) => check6(record3(item, keys, "state observation")));
  }
  entries(state.contacts, ["colliderAId", "colliderBId", "bodyAId", "bodyBId", "normalAtoB", "pointM", "penetrationM", "normalImpulseNs", "tangentImpulseOnBNs"], (c) => {
    body(c.bodyAId);
    body(c.bodyBId);
    collider2(c.colliderAId);
    collider2(c.colliderBId);
    if (colliders.get(c.colliderAId) !== c.bodyAId || colliders.get(c.colliderBId) !== c.bodyBId)
      replayError("INVALID_SNAPSHOT", "contact owner differs");
    vector3(c.normalAtoB);
    vector3(c.pointM);
    vector3(c.tangentImpulseOnBNs);
    number(c.penetrationM);
    number(c.normalImpulseNs);
  });
  entries(state.events, ["colliderAId", "colliderBId", "kind", "phase"], (e) => {
    collider2(e.colliderAId);
    collider2(e.colliderBId);
    if (!["contact", "sensor"].includes(e.kind) || !["begin", "stay", "end"].includes(e.phase))
      replayError("INVALID_SNAPSHOT", "event is invalid");
  });
  entries(state.ccdHits, ["bodyId", "colliderId", "toiFraction", "normalFixtureToBody"], (h) => {
    body(h.bodyId);
    collider2(h.colliderId);
    number(h.toiFraction);
    vector3(h.normalFixtureToBody);
  });
  if (!Array.isArray(state.cloths) || state.cloths.length || !Array.isArray(state.fluids) || state.fluids.length)
    replayError("INVALID_SNAPSHOT", "domain recording is unsupported");
  const stats = record3(state.pairStats, ["eligiblePairs", "candidatePairs", "aabbTests"], "pair stats");
  for (const value of Object.values(stats))
    if (!Number.isSafeInteger(value) || value < 0)
      replayError("INVALID_SNAPSHOT", "pair stats are invalid");
  return copied;
}

// packages/barocss-physics/dist/replay.js
function recordedState(state) {
  if (state.cloths.length || state.fluids.length)
    replayError("INVALID_SNAPSHOT", "domain recording is unsupported");
  return copyReplayJson({ ...state, cloths: [], fluids: [] }, "state");
}
function createPhysicsRecorder(world) {
  const access = recordingWorlds.get(world);
  if (!access)
    replayError("INVALID_SNAPSHOT", "recorder requires a genuine World");
  const owner = access.attach(({ model: model2, options: options2, state }) => {
    if (canonicalEncode2(model2).length > 128 * 1024)
      replayError("WORLD_LIMIT", "recording model exceeds byte limit");
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
        const recording = {
          ...preparedOwner.recording,
          frames: [...preparedOwner.recording.frames, { stepIndex: next.stepIndex, commands: copyReplayJson(commands, "commands") }],
          finalState: recordedState(next)
        };
        try {
          encodeRecordingData(recording);
        } catch (error3) {
          if (error3 instanceof PhysicsError && error3.code === "INVALID_SNAPSHOT")
            replayError("WORLD_LIMIT", "recording data exceeds resource bounds");
          throw error3;
        }
        return recording;
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
function restorePhysicsRecording(input, expectedInput) {
  const recording = admitRecording(input);
  const expected2 = copyReplayJson(expectedInput, "expected identity");
  exactFields(expected2, ["model", "options", "providerDigest"], "expected identity");
  if (!equivalentReplayIdentity(recording.model, expected2.model) || !equivalentReplayIdentity(recording.options, expected2.options) || recording.identity.providerDigest !== expected2.providerDigest)
    replayError("STALE_SNAPSHOT", "recording identity differs from expected inputs");
  let world;
  try {
    world = createPhysicsWorld(recording.model, recording.options);
    if (!equivalentReplayIdentity(world.getState().identity, recording.identity))
      replayError("STALE_SNAPSHOT", "recording provider differs from current provider");
    const recorder = createPhysicsRecorder(world);
    for (const frame of recording.frames)
      recorder.step(frame.commands);
    if (!equivalentReplayValue(recorder.getState(), recording.finalState))
      replayError("INVALID_SNAPSHOT", "final state differs from reconstructed state");
    return { world, recorder };
  } catch (error3) {
    world?.dispose();
    if (error3 instanceof PhysicsError && error3.code === "STALE_SNAPSHOT")
      throw error3;
    replayError("INVALID_SNAPSHOT", "recording reconstruction failed");
  }
}
function serializePhysicsRecording(input) {
  const recording = admitRecording(input);
  const candidate = restorePhysicsRecording(recording, { model: recording.model, options: recording.options, providerDigest: recording.identity.providerDigest });
  try {
    return encodeRecordingData(recording);
  } finally {
    candidate.world.dispose();
  }
}
function deserializePhysicsRecording(bytes) {
  const recording = admitRecording(decodeRecordingData(bytes));
  const candidate = restorePhysicsRecording(recording, { model: recording.model, options: recording.options, providerDigest: recording.identity.providerDigest });
  try {
    return copyReplayJson(recording, "recording");
  } finally {
    candidate.world.dispose();
  }
}

// packages/barocss-cad/dist/core/math.js
function requireValue(condition, message) {
  if (!condition)
    throw new Error(message);
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
    if (i > 0)
      requireValue(knots[i] >= knots[i - 1], "Knots must be nondecreasing");
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

// packages/barocss-cad/dist/core/vec3.js
var sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
var dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var len = (a) => Math.hypot(a[0], a[1], a[2]);
var unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// packages/barocss-cad/dist/features/extrusion-validation.js
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
function equal(a, b) {
  return difference(a, b).integer === 0n;
}
function whollyCollinear(curve, vector4) {
  const direction = vector4.map(dyadic);
  const origin = curve.controlPoints[0].map(dyadic);
  for (let index = 1; index < curve.controlPoints.length; index++) {
    const offset = curve.controlPoints[index].map((value, axis) => difference(dyadic(value), origin[axis]));
    for (let axis = 0; axis < 3; axis++) {
      const next = (axis + 1) % 3;
      if (!equal(product(offset[axis], direction[next]), product(offset[next], direction[axis])))
        return false;
    }
  }
  return true;
}
function preflightExtrusion(curve, options2) {
  validateCurve(curve);
  if (curve.controlPoints.length > 16)
    throw new Error("Extrusion supports at most 16 curve control points");
  if (!options2 || typeof options2 !== "object")
    throw new Error("Extrusion options are required");
  const { id: id2, vector: vector4 } = options2;
  if (typeof id2 !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id2) || id2 === curve.id) {
    throw new Error("Extrusion output ID must be a supported ASCII identifier distinct from the curve ID");
  }
  if (!Array.isArray(vector4) || vector4.length !== 3)
    throw new Error("Extrusion vector must have three coordinates");
  let nonzero2 = false;
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(vector4[axis]))
      throw new Error("Extrusion vector must be finite");
    nonzero2 ||= vector4[axis] !== 0;
  }
  if (!nonzero2)
    throw new Error("Extrusion vector must be nonzero");
  let translated = false;
  for (const point of curve.controlPoints) {
    for (let axis = 0; axis < 3; axis++) {
      const value = point[axis] + vector4[axis];
      if (!Number.isFinite(value) || Math.abs(value) > 1e6)
        throw new Error("Extruded coordinates must be finite and within 1e6 mm");
      translated ||= value !== point[axis];
    }
  }
  if (!translated)
    throw new Error("Extrusion vector produces no representable pole displacement");
  if (whollyCollinear(curve, vector4))
    throw new Error("Extrusion is wholly collapsed: all pole displacements are collinear with the vector");
  return { id: id2, vector: vector4 };
}

// packages/barocss-cad/dist/core/extrusion.js
function extrudeCurve(curve, options2) {
  const { id: id2, vector: vector4 } = preflightExtrusion(curve, options2);
  return {
    kind: "surface",
    id: id2,
    degreeU: curve.degree,
    degreeV: 1,
    knotsU: [...curve.knots],
    knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((point) => [
      [point[0], point[1], point[2]],
      [point[0] + vector4[0], point[1] + vector4[1], point[2] + vector4[2]]
    ]),
    weights: curve.weights.map((weight) => [weight, weight])
  };
}

// packages/barocss-cad/dist/language/expression-parser.js
var CAD_EXPRESSION_LIMITS = Object.freeze({ nodes: 256, depth: 32, aggregateNodes: 32768, literalMagnitude: 1e12 });
function parseCadExpression(cursor) {
  let nodes = 0;
  const depth = (tree, ancestors) => {
    if (tree + ancestors > CAD_EXPRESSION_LIMITS.depth)
      cursor.fail("LIMIT", "Expression exceeds AST depth 32");
  };
  const reserve = () => {
    if (nodes >= CAD_EXPRESSION_LIMITS.nodes)
      cursor.fail("LIMIT", "Expression exceeds 256 nodes");
    cursor.reserveNode();
    nodes++;
  };
  const consume = (text3) => {
    cursor.skip();
    if (!cursor.source.startsWith(text3, cursor.offset()))
      cursor.fail("SYNTAX", "Expected " + text3);
    cursor.token();
    cursor.advance(text3.length);
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
      if (!match2)
        cursor.fail("SYNTAX", "Expected parameter identifier");
      cursor.token();
      cursor.advance(match2[0].length);
      return { expression: { kind: "parameter-reference", id: match2[0], range: cursor.range(start, cursor.offset()) }, depth: 1 };
    }
    if (cursor.allowCalls) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(start));
      if (name) {
        if (name[0].length > 48)
          cursor.fail("LIMIT", "Function names exceed 48 characters", start, start + name[0].length);
        reserve();
        cursor.token();
        cursor.advance(name[0].length);
        const functionRange = cursor.range(start, cursor.offset());
        consume("(");
        cursor.skip();
        const arguments_ = [], names = /* @__PURE__ */ new Set();
        let treeDepth = 1;
        if (cursor.source[cursor.offset()] !== ")")
          while (true) {
            cursor.skip();
            const argumentStart = cursor.offset();
            if (arguments_.length >= 4)
              cursor.fail("LIMIT", "A call has at most four named arguments", argumentStart);
            const argumentName = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(argumentStart));
            if (!argumentName)
              cursor.fail("FUNCTION_ARGUMENT", "A named function argument is required", argumentStart);
            if (argumentName[0].length > 48)
              cursor.fail("LIMIT", "Argument names exceed 48 characters", argumentStart, argumentStart + argumentName[0].length);
            cursor.token();
            cursor.advance(argumentName[0].length);
            const nameRange = cursor.range(argumentStart, cursor.offset());
            cursor.skip();
            if (cursor.source[cursor.offset()] !== ":")
              cursor.fail("FUNCTION_ARGUMENT", "Only named function arguments are supported", argumentStart, cursor.offset());
            if (names.has(argumentName[0]))
              cursor.fail("FUNCTION_ARGUMENT", "Duplicate function argument " + argumentName[0], argumentStart, cursor.offset());
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
            if (cursor.source[cursor.offset()] !== ",")
              break;
            consume(",");
            cursor.skip();
            if (cursor.source[cursor.offset()] === ")")
              cursor.fail("FUNCTION_ARGUMENT", "Trailing function argument comma is unsupported");
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
    if (!match)
      cursor.fail("SYNTAX", "Expected number, $parameter or parenthesized expression");
    const value = Number(match[0]);
    if (!Number.isFinite(value) || value > CAD_EXPRESSION_LIMITS.literalMagnitude)
      cursor.fail("VALUE", "Number magnitude must be finite and at most 1e12", start, start + match[0].length);
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
      if (suffix[0] !== "mm" && suffix[0] !== "cm" && suffix[0] !== "m")
        cursor.fail("UNIT", "Unsupported length unit " + suffix[0], unitStart, unitStart + suffix[0].length);
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
    if (operator !== "+" && operator !== "-")
      return primary(ancestors);
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
      if (!(level === "product" ? operator === "*" || operator === "/" : operator === "+" || operator === "-"))
        return left;
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

// packages/barocss-cad/dist/core/barocss-error.js
var BarocssError = class extends Error {
  code;
  where;
  /** What else the refusal carries: the core's own words, the feature it named. */
  details;
  constructor(code2, message, where, details) {
    super(`[${code2}] ${message.replace(`[${code2}] `, "")}`);
    this.name = "BarocssError";
    this.code = code2;
    if (where)
      this.where = where;
    if (details)
      this.details = details;
  }
};
var KernelError = class extends BarocssError {
  constructor(message, options2) {
    super(options2?.code ?? "", "", void 0, options2?.details);
    this.name = "Error";
    this.message = message ?? "";
    Reflect.deleteProperty(this, "where");
    if (!options2?.details)
      Reflect.deleteProperty(this, "details");
    if (options2 && "cause" in options2)
      Object.defineProperty(this, "cause", { value: options2.cause, writable: true, configurable: true, enumerable: false });
  }
};
function kernelRefusal(source, code2, message, cause) {
  const e = new KernelError(message, cause === void 0 ? { code: code2, details: { source } } : { code: code2, details: { source }, cause });
  e.name = "BarocssError";
  return e;
}

// packages/barocss-cad/dist/language/source-ast.js
var CadAstError = class extends KernelError {
  code;
  detail;
  range;
  objectId;
  constructor(code2, detail, range, objectId) {
    super(detail);
    this.name = "CadAstError";
    this.code = code2;
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
  if (typeof source !== "string")
    throw new TypeError("Source must be a string");
  if (sourceVersion !== 0 && sourceVersion !== 1 && sourceVersion !== 2 && sourceVersion !== 3)
    throw new TypeError("Source version must be 0, 1, 2 or 3");
  const emptyRange = { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
  const utf8BytesWithinLimit = () => {
    let bytes = 0;
    for (let i = 0; i < source.length; i++) {
      const code2 = source.charCodeAt(i), next = source.charCodeAt(i + 1);
      if (code2 < 128)
        bytes++;
      else if (code2 < 2048)
        bytes += 2;
      else if (code2 >= 55296 && code2 <= 56319 && next >= 56320 && next <= 57343) {
        bytes += 4;
        i++;
      } else
        bytes += 3;
      if (bytes > CAD_AST_LIMITS.sourceBytes)
        return false;
    }
    return true;
  };
  if (source.length > CAD_AST_LIMITS.sourceBytes || !utf8BytesWithinLimit()) {
    throw new CadAstError("LIMIT", "Source exceeds 256 KiB", emptyRange);
  }
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++)
    if (source[i] === "\n")
      lineStarts.push(i + 1);
  const location = (offset) => {
    let low = 0, high = lineStarts.length;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= offset)
        low = mid;
      else
        high = mid;
    }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  };
  const range = (start, end) => {
    const first = location(start), last = location(end);
    return { start, end, ...first, endLine: last.line, endColumn: last.column };
  };
  let at2 = 0, tokens = 0, values = 0, nodes = 0, expressionNodes = 0, geometryCount = 0, parameterCount = 0, functionCount = 0, objectId;
  const declarations = [], modelFields = [];
  const fail2 = (code2, detail, start = at2, end = Math.min(source.length, start + 1)) => {
    throw new CadAstError(code2, detail, range(start, end), objectId);
  };
  const chargeToken = () => {
    if (tokens >= CAD_AST_LIMITS.tokens)
      fail2("LIMIT", "Source exceeds AST token limit");
    tokens++;
  };
  const chargeNode = (isValue = false) => {
    if (nodes >= CAD_AST_LIMITS.nodes || isValue && values >= CAD_AST_LIMITS.values)
      fail2("LIMIT", "Source exceeds AST value/node limit");
    nodes++;
    if (isValue)
      values++;
  };
  const skip = () => {
    while (at2 < source.length) {
      if (/\s/.test(source[at2])) {
        at2++;
        continue;
      }
      if (source.startsWith("/*", at2)) {
        const end = source.indexOf("*/", at2 + 2);
        if (end < 0)
          fail2("SYNTAX", "Unterminated comment");
        at2 = end + 2;
        continue;
      }
      break;
    }
  };
  const take = (token) => {
    skip();
    if (!source.startsWith(token, at2))
      fail2("SYNTAX", "Expected " + token);
    chargeToken();
    at2 += token.length;
  };
  const ident = (parameter = false) => {
    skip();
    const start = at2, match = (parameter ? /^[A-Za-z_][A-Za-z0-9_]*/ : /^[A-Za-z_][A-Za-z0-9_-]*/).exec(source.slice(at2));
    if (!match)
      return fail2("SYNTAX", "Expected identifier");
    chargeToken();
    at2 += match[0].length;
    return { value: match[0], range: range(start, at2) };
  };
  const numeric = (required) => {
    skip();
    const start = at2, match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(at2));
    if (!match) {
      if (required)
        fail2("VALUE", "Expected finite decimal literal");
      return void 0;
    }
    chargeToken();
    at2 += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value))
      fail2("VALUE", "Number must be finite", required ? start : at2, required ? at2 : Math.min(source.length, at2 + 1));
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
    fail: fail2,
    reserveNode: () => {
      if (expressionNodes >= CAD_EXPRESSION_LIMITS.aggregateNodes)
        fail2("LIMIT", "Model exceeds 32768 aggregate expression nodes");
      chargeNode(true);
      expressionNodes++;
    }
  });
  const astValue = (bounds, depth = 0, expressions = false) => {
    skip();
    const start = at2;
    if (source[at2] === "[") {
      if (depth >= bounds.length || depth >= CAD_AST_LIMITS.arrayDepth)
        fail2("DIMENSION", "Array nesting exceeds field dimension");
      chargeNode(true);
      take("[");
      const items = [];
      skip();
      if (source[at2] !== "]")
        while (true) {
          if (items.length >= bounds[depth])
            fail2("LIMIT", "Array exceeds field limit");
          items.push(astValue(bounds, depth + 1, expressions));
          skip();
          if (source[at2] !== ",")
            break;
          take(",");
          skip();
          if (source[at2] === "]")
            fail2("SYNTAX", "Trailing comma is unsupported");
        }
      take("]");
      return { kind: "array", items, range: range(start, at2) };
    }
    if (expressions)
      return expression3();
    const number2 = numeric(false);
    if (number2)
      return number2;
    const identifier2 = ident();
    chargeNode(true);
    return { kind: "identifier", value: identifier2.value, range: identifier2.range };
  };
  const field = (allowed, surface, seen, mode) => {
    skip();
    const start = at2, key = ident();
    if (!allowed.includes(key.value))
      fail2("FIELD", "Unsupported " + (sourceVersion === 1 && mode !== "literal" ? mode === "model" ? "model " : "extrusion " : "") + "field " + key.value, start, sourceVersion === 1 && mode !== "literal" ? at2 : Math.min(source.length, start + 1));
    if (sourceVersion === 1 && mode !== "literal" && seen.has(key.value))
      fail2("DUPLICATE", "Duplicate field " + key.value, start, at2);
    take(":");
    let value;
    if (sourceVersion >= 1 && mode === "model") {
      if (key.value === "version")
        value = numeric(true);
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
    if (seen.has(key.value))
      fail2("DUPLICATE", "Duplicate field " + key.value, start, Math.min(source.length, start + 1));
    seen.add(key.value);
    chargeNode();
    return { name: key.value, value, range: range(start, at2), nameRange: key.range };
  };
  skip();
  const modelStart = at2;
  chargeNode();
  take("@");
  if (ident().value !== "model")
    fail2("SYNTAX", "Expected @model", sourceVersion === 1 ? 0 : at2);
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
    if (!(sourceVersion === 0 ? kind === "curve" || kind === "surface" : sourceVersion === 1 ? kind === "curve" || kind === "extrude" : kind === "curve" || kind === "surface" || kind === "extrude" || kind === "parameter" || sourceVersion === 3 && kind === "function"))
      fail2("KIND", (sourceVersion === 0 ? "Unsupported object " : "Unsupported declaration ") + kind, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at2);
    if (kind === "function" ? functionCount >= 8 : kind === "parameter" ? parameterCount >= 64 : geometryCount >= CAD_AST_LIMITS.declarations)
      fail2("LIMIT", kind === "function" ? "Model exceeds 8 functions" : kind === "parameter" ? "Model exceeds 64 parameters" : "Model exceeds 16 geometry declarations", start);
    skip();
    const idStart = at2;
    take("#");
    const identifier2 = ident(kind === "parameter" || kind === "function");
    objectId = identifier2.value;
    if (ids2.has(objectId))
      fail2("DUPLICATE", "Duplicate ID " + objectId, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at2);
    ids2.add(objectId);
    if (kind === "function") {
      if (identifier2.value.length > 48)
        fail2("LIMIT", "Function names exceed 48 characters", identifier2.range.start, identifier2.range.end);
      functionCount++;
      take("(");
      skip();
      const arguments_ = [], formalNames = /* @__PURE__ */ new Set();
      if (source[at2] !== ")")
        while (true) {
          skip();
          const formalStart = at2;
          if (arguments_.length >= 4)
            fail2("LIMIT", "A function has at most four formal arguments", formalStart);
          const name = ident(true);
          if (name.value.length > 48)
            fail2("LIMIT", "Formal names exceed 48 characters", name.range.start, name.range.end);
          if (formalNames.has(name.value))
            fail2("FUNCTION_ARGUMENT", "Duplicate formal argument " + name.value, name.range.start, name.range.end);
          formalNames.add(name.value);
          take(":");
          const type = ident();
          if (type.value !== "length" && type.value !== "scalar")
            fail2("FUNCTION_TYPE", "Formal type must be length or scalar", type.range.start, type.range.end);
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
          if (source[at2] !== ",")
            break;
          take(",");
          skip();
          if (source[at2] === ")")
            fail2("FUNCTION_ARGUMENT", "Trailing formal comma is unsupported");
        }
      take(")");
      take(":");
      const returnType = ident();
      if (returnType.value !== "length" && returnType.value !== "scalar")
        fail2("FUNCTION_TYPE", "Function return type must be length or scalar", returnType.range.start, returnType.range.end);
      const returnKind = returnType.value === "length" ? "length" : "scalar";
      take("{");
      const fields5 = [], seen2 = /* @__PURE__ */ new Set();
      while (true) {
        skip();
        if (source[at2] === "}") {
          take("}");
          break;
        }
        fields5.push(field(["return"], false, seen2, "function"));
      }
      if (fields5.length !== 1)
        fail2("FIELD", "A function requires exactly one return expression", start, at2);
      chargeNode();
      declarations.push({
        kind: "function",
        id: objectId,
        range: range(start, at2),
        idRange: range(idStart, identifier2.range.end),
        arguments: arguments_,
        returnKind,
        returnTypeRange: returnType.range,
        fields: fields5
      });
      continue;
    }
    if (kind === "parameter")
      parameterCount++;
    else
      geometryCount++;
    take("{");
    const fields4 = [], seen = /* @__PURE__ */ new Set();
    while (true) {
      skip();
      if (source[at2] === "}") {
        take("}");
        break;
      }
      fields4.push(field(kind === "curve" ? curveFields : kind === "surface" ? surfaceFields : kind === "parameter" ? ["type", "value"] : ["curve", "vector"], kind === "surface", seen, kind === "extrude" ? "extrude" : kind === "parameter" ? "parameter" : "literal"));
    }
    chargeNode();
    declarations.push({ kind, id: objectId, range: range(start, at2), idRange: range(idStart, identifier2.range.end), fields: fields4 });
  }
  const modelEnd = at2;
  objectId = void 0;
  skip();
  if (at2 !== source.length)
    fail2("SYNTAX", "Unexpected content after model");
  return { kind: "model", name: modelIdentifier.value, range: range(modelStart, modelEnd), nameRange: modelIdentifier.range, fields: modelFields, declarations };
}

// packages/barocss-cad/dist/data-copy.js
function copyCadData(value) {
  if (Array.isArray(value))
    return value.map((item) => copyCadData(item));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyCadData(item)]));
  return value;
}

// packages/barocss-cad/dist/document/parameter-semantics.js
var numericFields = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function expression(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group")
    return value;
  throw new CadAstError("TYPE", "A numeric expression is required", value.range, owner);
}
function references(value) {
  if (value.kind === "call")
    throw new CadAstError("TYPE", "Source2 does not support quantity function calls", value.range);
  if (value.kind === "parameter-reference")
    return [{ id: value.id, range: value.range }];
  if (value.kind === "unary")
    return references(value.operand);
  if (value.kind === "group")
    return references(value.expression);
  if (value.kind === "binary")
    return [...references(value.left), ...references(value.right)];
  return [];
}
function literalMillimetres(value) {
  if (value.kind === "number")
    return value.unit === void 0;
  if (value.kind === "group")
    return literalMillimetres(value.expression);
  if (value.kind === "unary")
    return literalMillimetres(value.operand);
  return false;
}
function resolveCadParameters(ast) {
  const byId = new Map(ast.declarations.map((d) => [d.id, d]));
  const inputs = /* @__PURE__ */ new Map();
  const dependencies = [];
  const edges = /* @__PURE__ */ new Map();
  const leaves = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function")
      throw new CadAstError("TYPE", "Source2 does not support quantity functions", declaration.range, declaration.id);
    if (declaration.kind !== "parameter")
      continue;
    const type = declaration.fields.find((f) => f.name === "type"), value = declaration.fields.find((f) => f.name === "value");
    if (!type || !value)
      throw new CadAstError("FIELD", "Parameter requires type and value", declaration.range, declaration.id);
    if (type.value.kind !== "identifier" || type.value.value !== "length" && type.value.value !== "scalar")
      throw new CadAstError("TYPE", "Parameter type must be length or scalar", type.value.range, declaration.id);
    inputs.set(declaration.id, { declaration, kind: type.value.value, expression: expression(value.value, declaration.id) });
  }
  if (inputs.size > 64)
    throw new CadAstError("LIMIT", "At most 64 parameters are supported", ast.range);
  const addReferences = (owner, value) => {
    const found = references(value);
    for (const ref of found) {
      const target = byId.get(ref.id);
      if (!target)
        throw new CadAstError("REFERENCE", "Undefined parameter " + ref.id, ref.range, owner);
      if (target.kind !== "parameter")
        throw new CadAstError("REFERENCE", ref.id + " is geometry, not a parameter", ref.range, owner);
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
      if (!curve)
        throw new CadAstError("FIELD", "Extrusion requires a curve field", declaration.range, declaration.id);
      if (curve.value.kind !== "reference")
        throw new CadAstError("TYPE", "Extrusion curve requires a geometry reference", curve.value.range, declaration.id);
      const target = byId.get(curve.value.id);
      if (!target || target.kind !== "curve")
        throw new CadAstError("REFERENCE", "Reference " + curve.value.id + " must name a curve declaration", curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields.has(field.name))
        continue;
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
    if (states.get(id2) === "done")
      return;
    states.set(id2, "visiting");
    for (const ref of edges.get(id2) ?? []) {
      if (states.get(ref.id) === "visiting")
        throw new CadAstError("CYCLE", "Cyclic parameter dependency through " + ref.id, ref.range, id2);
      visit(ref.id);
    }
    states.set(id2, "done");
    order.push(id2);
  };
  for (const id2 of inputs.keys())
    visit(id2);
  const quantities = /* @__PURE__ */ new Map(), evaluated = /* @__PURE__ */ new WeakMap();
  const checked = (kind, value, range, owner) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12)
      throw new CadAstError("VALUE", "Quantity must be finite and within 1e12", range, owner);
    return { kind, value };
  };
  const evaluate2 = (node, owner) => {
    if (node.kind === "call")
      throw new CadAstError("TYPE", "Source2 does not support quantity function calls", node.range, owner);
    const cached = evaluated.get(node);
    if (cached)
      return cached;
    let result;
    if (node.kind === "number") {
      checked("scalar", node.value, node.range, owner);
      const scale4 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = checked(node.unit ? "length" : "scalar", node.value * scale4, node.unitRange ?? node.range, owner);
    } else if (node.kind === "parameter-reference") {
      const quantity2 = quantities.get(node.id);
      if (!quantity2)
        throw new CadAstError("REFERENCE", "Parameter dependency is unresolved", node.range, owner);
      result = { ...quantity2 };
    } else if (node.kind === "group")
      result = { ...evaluate2(node.expression, owner) };
    else if (node.kind === "unary") {
      const operand = evaluate2(node.operand, owner);
      result = checked(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner);
    } else {
      const left = evaluate2(node.left, owner), right = evaluate2(node.right, owner);
      if (node.operator === "/" && right.value === 0)
        throw new CadAstError("DIVISION_ZERO", "Division by zero is unsupported", node.operatorRange, owner);
      let kind, value;
      if (node.operator === "+" || node.operator === "-") {
        if (left.kind !== right.kind)
          throw new CadAstError("UNIT", "Addition and subtraction require matching quantities", node.operatorRange, owner);
        kind = left.kind;
        value = node.operator === "+" ? left.value + right.value : left.value - right.value;
      } else if (node.operator === "*") {
        if (left.kind === "length" && right.kind === "length")
          throw new CadAstError("UNIT", "Length multiplied by length is unsupported", node.operatorRange, owner);
        kind = left.kind === "length" || right.kind === "length" ? "length" : "scalar";
        value = left.value * right.value;
      } else {
        if (left.kind === "scalar" && right.kind === "length")
          throw new CadAstError("UNIT", "Scalar divided by length is unsupported", node.operatorRange, owner);
        kind = left.kind === right.kind ? "scalar" : "length";
        value = left.value / right.value;
      }
      result = checked(kind, value, node.operatorRange, owner);
    }
    evaluated.set(node, result);
    return result;
  };
  for (const id2 of order) {
    const input = inputs.get(id2), quantity2 = evaluate2(input.expression, id2);
    if (quantity2.kind !== input.kind)
      throw new CadAstError("UNIT", "Parameter value does not match its declared " + input.kind + " type", input.expression.range, id2);
    quantities.set(id2, quantity2);
  }
  const parameters = [...inputs].map(([id2, input]) => {
    const q2 = quantities.get(id2);
    return { id: id2, quantityKind: q2.kind, value: q2.value, unit: q2.kind === "length" ? "mm" : "1", expression: copyCadData(input.expression), span: { ...input.declaration.range } };
  });
  const bindings = [], leafValues = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    let quantity2 = evaluate2(leaf.expression, leaf.objectId);
    if (leaf.required === "length" && quantity2.kind === "scalar" && literalMillimetres(leaf.expression))
      quantity2 = { kind: "length", value: quantity2.value };
    if (quantity2.kind !== leaf.required)
      throw new CadAstError("UNIT", "Field " + leaf.field + " requires " + leaf.required, leaf.expression.range, leaf.objectId);
    if (leaf.field.startsWith("degree") && !Number.isInteger(quantity2.value))
      throw new CadAstError("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.objectId);
    leafValues.set(leaf.expression, quantity2.value);
    bindings.push({ objectId: leaf.objectId, field: leaf.field, indices: [...leaf.indices], expression: copyCadData(leaf.expression), value: quantity2.value, quantityKind: quantity2.kind, span: { ...leaf.expression.range }, references: [...leaf.references] });
  }
  const resolvedValue = (value) => {
    if (value.kind === "array")
      return { kind: "array", items: value.items.map(resolvedValue), range: { ...value.range } };
    const mapped = leafValues.get(value);
    if (mapped !== void 0 || leafValues.has(value))
      return { kind: "number", value: mapped, range: { ...value.range } };
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

// packages/barocss-cad/dist/document/function-quantity-semantics.js
var numericFields2 = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function fail(code2, detail, range, owner) {
  throw new CadAstError(code2, detail, range, owner);
}
function expression2(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group" || value.kind === "call")
    return value;
  return fail("TYPE", "A numeric quantity expression is required", value.range, owner);
}
function quantity(kind, value, range, owner) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12)
    fail("VALUE", "Quantity must be finite and within 1e12", range, owner);
  return { kind, unit: kind === "length" ? "mm" : "1", value };
}
function binaryKind(operator, left, right, range, owner) {
  if (operator === "+" || operator === "-") {
    if (left !== right)
      fail("UNIT", "Addition and subtraction require matching quantities", range, owner);
    return left;
  }
  if (operator === "*") {
    if (left === "length" && right === "length")
      fail("UNIT", "Length multiplied by length is unsupported", range, owner);
    return left === "length" || right === "length" ? "length" : "scalar";
  }
  if (left === "scalar" && right === "length")
    fail("UNIT", "Scalar divided by length is unsupported", range, owner);
  return left === right ? "scalar" : "length";
}
function literalMillimetres2(node) {
  if (node.kind === "number")
    return node.unit === void 0;
  if (node.kind === "unary")
    return literalMillimetres2(node.operand);
  if (node.kind === "group")
    return literalMillimetres2(node.expression);
  return false;
}
function globalReferences(node) {
  if (node.kind === "parameter-reference")
    return [{ id: node.id, range: node.range }];
  if (node.kind === "unary")
    return globalReferences(node.operand);
  if (node.kind === "group")
    return globalReferences(node.expression);
  if (node.kind === "binary")
    return [...globalReferences(node.left), ...globalReferences(node.right)];
  if (node.kind === "call")
    return node.arguments.flatMap((argument) => globalReferences(argument.value));
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
      if (definitions.size >= 8)
        fail("LIMIT", "At most eight quantity functions are supported", declaration.range, declaration.id);
      if (declaration.arguments.length > 4)
        fail("LIMIT", "At most four formal arguments are supported", declaration.range, declaration.id);
      definitions.set(declaration.id, declaration);
    } else if (declaration.kind === "parameter") {
      const type = declaration.fields.find((field) => field.name === "type"), value = declaration.fields.find((field) => field.name === "value");
      if (!type || !value)
        fail("FIELD", "Parameter requires type and value", declaration.range, declaration.id);
      if (type.value.kind !== "identifier" || type.value.value !== "length" && type.value.value !== "scalar")
        fail("TYPE", "Parameter type must be length or scalar", type.value.range, declaration.id);
      inputs.set(declaration.id, { kind: type.value.value, expression: expression2(value.value, declaration.id), span: declaration.range });
      globalKinds.set(declaration.id, type.value.value);
    }
  }
  if (inputs.size > 64)
    fail("LIMIT", "At most 64 global parameters are supported", ast.range, ast.name);
  const body = (definition2) => {
    if (definition2.fields.length !== 1 || definition2.fields[0].name !== "return")
      fail("FUNCTION_TYPE", "A function requires exactly one return expression", definition2.range, definition2.id);
    return expression2(definition2.fields[0].value, definition2.id);
  };
  const infer = (node, environment, owner, scope, callsTo) => {
    if (node.kind === "number")
      return node.unit === void 0 ? "scalar" : "length";
    if (node.kind === "parameter-reference") {
      if (scope === "closed")
        fail("FUNCTION_CAPTURE", "Defaults must be closed expressions without references", node.range, owner);
      const kind = environment.get(node.id);
      if (kind === void 0)
        fail(scope === "formal" ? "FUNCTION_CAPTURE" : "REFERENCE", scope === "formal" ? "A function may reference only its own formal arguments" : "Reference must name a global parameter", node.range, owner);
      return kind;
    }
    if (node.kind === "group")
      return infer(node.expression, environment, owner, scope, callsTo);
    if (node.kind === "unary")
      return infer(node.operand, environment, owner, scope, callsTo);
    if (node.kind === "binary")
      return binaryKind(node.operator, infer(node.left, environment, owner, scope, callsTo), infer(node.right, environment, owner, scope, callsTo), node.operatorRange, owner);
    if (scope === "closed")
      fail("FUNCTION_CAPTURE", "Defaults cannot invoke functions", node.range, owner);
    const definition2 = definitions.get(node.functionId);
    if (!definition2)
      fail("FUNCTION_REFERENCE", "Call must name a declared quantity function", node.functionRange, owner);
    if (node.arguments.length > 4)
      fail("FUNCTION_ARGUMENT", "At most four named arguments are supported", node.range, owner);
    const names = /* @__PURE__ */ new Set();
    for (const argument of node.arguments) {
      if (names.has(argument.name))
        fail("FUNCTION_ARGUMENT", "Duplicate named argument", argument.nameRange, owner);
      names.add(argument.name);
      const formal = definition2.arguments.find((value) => value.name === argument.name);
      if (!formal)
        fail("FUNCTION_ARGUMENT", "Unknown named argument", argument.nameRange, owner);
      const kind = infer(argument.value, environment, owner, scope, callsTo);
      if (kind !== formal.quantityKind)
        fail("FUNCTION_TYPE", "Named argument does not match its formal quantity kind", argument.value.range, owner);
    }
    for (const formal of definition2.arguments)
      if (!names.has(formal.name) && formal.defaultExpression === null)
        fail("FUNCTION_ARGUMENT", "Required named argument is missing", node.range, owner);
    if (callsTo)
      callsTo.push({ id: definition2.id, range: node.functionRange });
    return definition2.returnKind;
  };
  const functionEdges = /* @__PURE__ */ new Map();
  for (const definition2 of definitions.values()) {
    const environment = /* @__PURE__ */ new Map();
    for (const formal of definition2.arguments) {
      if (environment.has(formal.name))
        fail("FUNCTION_ARGUMENT", "Duplicate formal argument", formal.nameRange, definition2.id);
      environment.set(formal.name, formal.quantityKind);
      if (formal.defaultExpression !== null && infer(formal.defaultExpression, /* @__PURE__ */ new Map(), definition2.id, "closed") !== formal.quantityKind)
        fail("FUNCTION_TYPE", "Default quantity does not match its formal kind", formal.defaultExpression.range, definition2.id);
    }
    const edges = [];
    if (infer(body(definition2), environment, definition2.id, "formal", edges) !== definition2.returnKind)
      fail("FUNCTION_TYPE", "Return expression does not match the declared quantity kind", definition2.returnTypeRange, definition2.id);
    functionEdges.set(definition2.id, edges);
  }
  const functionStates = /* @__PURE__ */ new Map();
  const visitFunction = (id2) => {
    if (functionStates.get(id2) === "done")
      return;
    functionStates.set(id2, "visiting");
    for (const edge of functionEdges.get(id2) ?? []) {
      if (functionStates.get(edge.id) === "visiting")
        fail("FUNCTION_RECURSION", "Recursive function calls are unsupported", edge.range, id2);
      visitFunction(edge.id);
    }
    functionStates.set(id2, "done");
  };
  for (const id2 of definitions.keys())
    visitFunction(id2);
  const parameterEdges = /* @__PURE__ */ new Map();
  const references2 = (owner, node) => {
    const refs = globalReferences(node);
    for (const ref of refs) {
      if (byId.get(ref.id)?.kind !== "parameter")
        fail("REFERENCE", "Reference must name a global parameter", ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: "parameter-input", span: { ...ref.range } });
    }
    return refs;
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function")
      continue;
    if (declaration.kind === "parameter") {
      const input = inputs.get(declaration.id);
      if (infer(input.expression, globalKinds, declaration.id, "global") !== input.kind)
        fail("UNIT", "Parameter value does not match its declared quantity kind", input.expression.range, declaration.id);
      parameterEdges.set(declaration.id, references2(declaration.id, input.expression));
      continue;
    }
    if (declaration.kind === "extrude") {
      const curve = declaration.fields.find((field) => field.name === "curve");
      if (!curve)
        fail("FIELD", "Extrusion requires a curve field", declaration.range, declaration.id);
      if (curve.value.kind !== "reference" || byId.get(curve.value.id)?.kind !== "curve")
        fail("REFERENCE", "Extrusion input must name a curve", curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields2.has(field.name))
        continue;
      const required = field.name === "control-points" || field.name === "vector" ? "length" : "scalar";
      const walk = (value, indices) => {
        if (value.kind === "array") {
          value.items.forEach((item, index) => walk(item, [...indices, index]));
          return;
        }
        const node = expression2(value, declaration.id), kind = infer(node, globalKinds, declaration.id, "global");
        if (kind !== required && !(required === "length" && kind === "scalar" && literalMillimetres2(node)))
          fail("UNIT", "Geometry field requires " + required, node.range, declaration.id);
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
    if (parameterStates.get(id2) === "done")
      return;
    parameterStates.set(id2, "visiting");
    for (const edge of parameterEdges.get(id2) ?? []) {
      if (parameterStates.get(edge.id) === "visiting")
        fail("CYCLE", "Cyclic global parameter dependency", edge.range, id2);
      visitParameter(edge.id);
    }
    parameterStates.set(id2, "done");
    order.push(id2);
  };
  for (const id2 of inputs.keys())
    visitParameter(id2);
  const add4 = (a, b) => ({
    callEntries: Math.min(257, a.callEntries + b.callEntries),
    expressionEvaluations: Math.min(65537, a.expressionEvaluations + b.expressionEvaluations),
    maximumCallDepth: Math.min(9, Math.max(a.maximumCallDepth, b.maximumCallDepth))
  });
  const bodyCosts = /* @__PURE__ */ new Map();
  const cost = (node) => {
    let value = { callEntries: 0, expressionEvaluations: 1, maximumCallDepth: 0 };
    if (node.kind === "unary")
      return add4(value, cost(node.operand));
    if (node.kind === "group")
      return add4(value, cost(node.expression));
    if (node.kind === "binary")
      return add4(add4(value, cost(node.left)), cost(node.right));
    if (node.kind !== "call")
      return value;
    for (const argument of node.arguments)
      value = add4(value, cost(argument.value));
    const definition2 = definitions.get(node.functionId);
    let inner = bodyCosts.get(definition2.id);
    if (!inner) {
      inner = cost(body(definition2));
      bodyCosts.set(definition2.id, inner);
    }
    for (const formal of definition2.arguments)
      if (formal.defaultExpression !== null && !node.arguments.some((argument) => argument.name === formal.name))
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
      fail("LIMIT", "Function expansion exceeds call, expression or active-frame limits before numerical evaluation", node.range, owner);
  };
  for (const [id2, input] of inputs)
    preflight(input.expression, id2);
  for (const leaf of leaves)
    preflight(leaf.expression, leaf.owner.objectId);
  const quantities = /* @__PURE__ */ new Map(), globalMemo = /* @__PURE__ */ new WeakMap();
  const calls = [];
  const evaluate2 = (node, owner, environment, memo, frameId, depth, admission = false) => {
    if (!admission) {
      if (work.actual.expressionEvaluations >= 65536)
        fail("LIMIT", "Runtime expression evaluation budget exhausted", node.range, owner.objectId);
      work.actual.expressionEvaluations++;
    }
    const cached = memo.get(node);
    if (cached)
      return { ...cached };
    let result;
    if (node.kind === "number") {
      quantity("scalar", node.value, node.range, owner.objectId);
      const scale4 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = quantity(node.unit ? "length" : "scalar", node.value * scale4, node.unitRange ?? node.range, owner.objectId);
    } else if (node.kind === "parameter-reference") {
      const found = environment.get(node.id);
      if (!found)
        fail("REFERENCE", "Quantity reference is unresolved in this lexical frame", node.range, owner.objectId);
      result = { ...found };
    } else if (node.kind === "group")
      result = evaluate2(node.expression, owner, environment, memo, frameId, depth, admission);
    else if (node.kind === "unary") {
      const operand = evaluate2(node.operand, owner, environment, memo, frameId, depth, admission);
      result = quantity(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner.objectId);
    } else if (node.kind === "binary") {
      const left = evaluate2(node.left, owner, environment, memo, frameId, depth, admission);
      const right = evaluate2(node.right, owner, environment, memo, frameId, depth, admission);
      if (node.operator === "/" && right.value === 0)
        fail("DIVISION_ZERO", "Division by zero is unsupported", node.operatorRange, owner.objectId);
      const kind = binaryKind(node.operator, left.kind, right.kind, node.operatorRange, owner.objectId);
      const value = node.operator === "+" ? left.value + right.value : node.operator === "-" ? left.value - right.value : node.operator === "*" ? left.value * right.value : left.value / right.value;
      result = quantity(kind, value, node.operatorRange, owner.objectId);
    } else {
      const definition2 = definitions.get(node.functionId);
      const explicit = /* @__PURE__ */ new Map();
      for (const argument of node.arguments)
        explicit.set(argument.name, {
          quantity: evaluate2(argument.value, owner, environment, memo, frameId, depth),
          span: argument.range
        });
      if (work.actual.callEntries >= 256 || depth >= 8)
        fail("LIMIT", "Actual function call or frame budget exhausted", node.range, owner.objectId);
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
        if (supplied)
          bound = { ...supplied.quantity };
        else {
          work.actual.defaultRuntimeEvaluations++;
          bound = evaluate2(formal.defaultExpression, owner, frame, localMemo, nextId, depth + 1);
        }
        if (bound.kind !== formal.quantityKind)
          fail("FUNCTION_TYPE", "Bound quantity differs from formal type", formal.typeRange, owner.objectId);
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
      if (result.kind !== definition2.returnKind)
        fail("FUNCTION_TYPE", "Actual return quantity differs from signature", definition2.returnTypeRange, owner.objectId);
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
        if (work.actual.defaultAdmissionEvaluations >= 32)
          fail("LIMIT", "Default admission budget exhausted", formal.range, definition2.id);
        work.actual.defaultAdmissionEvaluations++;
        defaultQuantity = evaluate2(formal.defaultExpression, { objectId: definition2.id, field: "default", indices: [] }, /* @__PURE__ */ new Map(), /* @__PURE__ */ new WeakMap(), null, 0, true);
      }
      arguments_.push({ name: formal.name, quantityKind: formal.quantityKind, defaultQuantity });
    }
    functions.push({ id: definition2.id, declaration: copyCadData(definition2), returnKind: definition2.returnKind, arguments: arguments_ });
  }
  for (const id2 of order) {
    const input = inputs.get(id2);
    const value = evaluate2(input.expression, { objectId: id2, field: "value", indices: [] }, quantities, globalMemo, null, 0);
    if (value.kind !== input.kind)
      fail("UNIT", "Parameter quantity does not match its declared type", input.expression.range, id2);
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
    if (value.kind !== leaf.required)
      fail("UNIT", "Field requires " + leaf.required, leaf.expression.range, leaf.owner.objectId);
    if (leaf.owner.field.startsWith("degree") && !Number.isInteger(value.value))
      fail("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.owner.objectId);
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
    if (value.kind === "array")
      return { kind: "array", items: value.items.map(resolvedValue), range: { ...value.range } };
    if (leafValues.has(value))
      return { kind: "number", value: leafValues.get(value), range: { ...value.range } };
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

// packages/barocss-cad/dist/language/semantic-model.js
function raw(value) {
  if (value.kind === "array")
    return value.items.map(raw);
  if (value.kind === "reference")
    return value.id;
  if (value.kind === "number" || value.kind === "identifier")
    return value.value;
  throw new CadAstError("TYPE", "Resolved numeric values are required", value.range);
}
var zeroRange = () => ({ start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 });
function nativeCode(message) {
  if (/^Degree /i.test(message))
    return "DEGREE";
  if (/knot|domain|multiplicity/i.test(message))
    return "KNOTS";
  if (/weight/i.test(message))
    return "WEIGHTS";
  if (/at most|exceed|1e6/i.test(message))
    return "LIMIT";
  if (/three|dimension|point/i.test(message))
    return "DIMENSION";
  return "GEOMETRY";
}
function geometryRange(d, message) {
  if (d.kind === "surface" && (nativeCode(message) === "DEGREE" || nativeCode(message) === "KNOTS"))
    return d.range;
  const keys = nativeCode(message) === "DEGREE" ? ["degree"] : nativeCode(message) === "KNOTS" ? ["knots"] : /weight/i.test(message) ? ["weights"] : ["control-points"];
  return d.fields.find((f) => keys.includes(f.name))?.value.range ?? d.range;
}
function analyzeGeometry(ast, sourceVersion) {
  const nodes = [];
  const literals = /* @__PURE__ */ new Map();
  const byId = new Map(ast.declarations.map((d) => [d.id, d]));
  for (const declaration of ast.declarations) {
    if (declaration.kind === "parameter")
      throw new CadAstError("TYPE", "Unresolved parameter cannot enter geometry validation", declaration.range, declaration.id);
    if (declaration.kind === "function")
      throw new CadAstError("TYPE", "Unresolved function cannot enter geometry validation", declaration.range, declaration.id);
    if (declaration.kind === "extrude") {
      if (!declaration.fields.some((f) => f.name === "curve") || !declaration.fields.some((f) => f.name === "vector"))
        throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
      continue;
    }
    const props = new Map(declaration.fields.map((f) => [f.name, f]));
    const keys = declaration.kind === "curve" ? ["type", "degree", "knots", "control-points", "weights"] : ["type", "degree-u", "degree-v", "knots-u", "knots-v", "control-points", "weights"];
    for (const key of keys)
      if (!props.has(key))
        throw new CadAstError("FIELD", "Missing field " + key, declaration.range, declaration.id);
    if (raw(props.get("type").value) !== "nurbs")
      throw new CadAstError("VALUE", "Only nurbs is supported", props.get("type").value.range, declaration.id);
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
      if (geometry.kind === "curve")
        validateCurve(geometry);
      else
        validateSurface(geometry);
    } catch (error3) {
      const message = error3.message;
      throw new CadAstError(nativeCode(message), message, geometryRange(declaration, message), declaration.id);
    }
    const suffix = declaration.kind === "surface" ? "[][]" : "[]";
    const fieldTypes = Object.fromEntries(keys.map((key) => [key, key === "type" ? "geometry-kind" : key.startsWith("degree") ? "integer" : key.startsWith("knots") ? "dimensionless[]" : key === "control-points" ? "mm-point3" + suffix : "dimensionless" + suffix]));
    const fields4 = { id: declaration.id, span: { ...declaration.range }, fieldTypes };
    literals.set(declaration.id, geometry.kind === "curve" ? { ...fields4, kind: "curve", geometry } : { ...fields4, kind: "surface", geometry });
  }
  const version = ast.fields.find((f) => f.name === "version"), unit2 = ast.fields.find((f) => f.name === "length-unit");
  if (!version || raw(version.value) !== sourceVersion)
    throw new CadAstError("VERSION", "Declared source version must match sourceVersion: " + sourceVersion, version?.value.range ?? zeroRange());
  if (!unit2 || raw(unit2.value) !== "mm")
    throw new CadAstError("UNIT", "length-unit: mm is required", unit2?.value.range ?? zeroRange());
  if (!ast.declarations.length)
    throw new CadAstError("GEOMETRY", "Model must contain geometry", zeroRange(), void 0);
  const dependencies = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind !== "extrude") {
      nodes.push(literals.get(declaration.id));
      continue;
    }
    const reference = declaration.fields.find((f) => f.name === "curve"), vectorField = declaration.fields.find((f) => f.name === "vector");
    if (!reference || !vectorField)
      throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
    const inputId = raw(reference.value), input = byId.get(inputId), vector4 = raw(vectorField.value);
    if (!input || input.kind !== "curve") {
      const detail = !input ? "Undefined curve reference " + inputId : "Reference " + inputId + " has kind " + input.kind + "; a curve is required";
      throw new CadAstError("REFERENCE", detail, reference.value.range, declaration.id);
    }
    const curve = literals.get(inputId).geometry;
    try {
      preflightExtrusion(curve, { id: declaration.id, vector: vector4 });
    } catch (error3) {
      const message = error3.message;
      throw new CadAstError(nativeCode(message), message, vectorField.value.range, declaration.id);
    }
    nodes.push({ kind: "extrude", id: declaration.id, inputId, vector: copyCadData(vector4), span: { ...declaration.range }, referenceSpan: { ...reference.value.range }, fieldTypes: { curve: "curve-reference", vector: "mm-vector3" } });
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

// packages/barocss-cad/dist/language/lower-model.js
function lowerCadIR(ir) {
  const literals = new Map(ir.nodes.filter((n) => n.kind !== "extrude").map((n) => [n.id, n]));
  const constructions = [];
  const objects = ir.nodes.map((node) => {
    if (node.kind !== "extrude")
      return copyCadData(node.geometry);
    const input = literals.get(node.inputId);
    const surface = extrudeCurve(input.geometry, { id: node.id, vector: copyCadData(node.vector) });
    const span = ({ start, end, line, column }) => ({ start, end, line, column });
    constructions.push({ outputId: node.id, inputId: node.inputId, operation: "extrude", vector: copyCadData(node.vector), span: span(node.span), referenceSpan: span(node.referenceSpan) });
    return surface;
  });
  return { model: { name: ir.name, version: 0, lengthUnit: "mm", objects }, constructions };
}

// packages/barocss-cad/dist/model-compiler.js
function compileCadStages(source, sourceVersion) {
  try {
    const ast = parseCadAst(source, sourceVersion);
    const ir = analyzeCadAst(ast, sourceVersion, source);
    const lowered = lowerCadIR(ir);
    return { ok: true, ast, ir, ...lowered };
  } catch (error3) {
    if (error3 instanceof CadAstError)
      return { ok: false, error: error3 };
    throw error3;
  }
}
function programmingFailure(code2, message) {
  return { ok: false, diagnostics: [{ code: code2, severity: "error", message, range: { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 } }] };
}
function diagnosticFailure(error3) {
  const diagnostic = { code: error3.code, severity: "error", message: error3.detail, range: { ...error3.range } };
  if (error3.objectId !== void 0)
    diagnostic.objectId = error3.objectId;
  return { ok: false, diagnostics: [diagnostic] };
}
function settleSource3Success(success) {
  if (success.ir.schemaVersion !== 3)
    return;
  const work = success.ir.work, limits3 = work.limits;
  const fail2 = (message) => {
    throw new CadAstError("LIMIT", message, success.ast.range, success.ast.name);
  };
  const measure = () => {
    let utf16 = 0, utf8 = 0, ownValues = 0;
    const token = (text3) => {
      utf16 += text3.length;
      for (let i = 0; i < text3.length; i++) {
        const code2 = text3.charCodeAt(i);
        if (code2 < 128)
          utf8++;
        else if (code2 < 2048)
          utf8 += 2;
        else if (code2 >= 55296 && code2 <= 56319 && text3.charCodeAt(i + 1) >= 56320 && text3.charCodeAt(i + 1) <= 57343) {
          utf8 += 4;
          i++;
        } else
          utf8 += 3;
      }
      if (utf16 > limits3.maximumSuccessUTF16 || utf8 > limits3.maximumSuccessUTF8)
        fail2("Complete Source3 success exceeds its file envelope");
    };
    const visit = (value, depth) => {
      if (++ownValues > limits3.maximumOwnValues || depth > limits3.maximumOwnDepth)
        fail2("Complete Source3 success exceeds its owned-data envelope");
      if (value === null) {
        token("null");
        return;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value))
          fail2("Source3 success must retain finite numbers");
        token(Object.is(value, -0) ? "-0" : JSON.stringify(value));
        return;
      }
      if (typeof value === "string" || typeof value === "boolean") {
        token(JSON.stringify(value));
        return;
      }
      if (Array.isArray(value)) {
        if (value.length > limits3.maximumOwnArray)
          fail2("Source3 success array exceeds its owned-data limit");
        token("[");
        value.forEach((item, index) => {
          if (index)
            token(",");
          visit(item, depth + 1);
        });
        token("]");
        return;
      }
      if (typeof value !== "object")
        fail2("Source3 success must contain only plain compiler data");
      const record6 = value, keys = Object.keys(record6);
      if (keys.length > limits3.maximumOwnRecord)
        fail2("Source3 success record exceeds its owned-data limit");
      token("{");
      keys.forEach((key, index) => {
        if (index)
          token(",");
        token(JSON.stringify(key));
        token(":");
        visit(record6[key], depth + 1);
      });
      token("}");
    };
    visit(success, 0);
    token("\n");
    return { utf16, utf8, ownValues };
  };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = measure();
    if (size.utf16 === work.fileSizes.success.utf16 && size.utf8 === work.fileSizes.success.utf8 && size.ownValues === work.ownValues) {
      settled = true;
      break;
    }
    work.fileSizes.success = { utf16: size.utf16, utf8: size.utf8 };
    work.ownValues = size.ownValues;
  }
  const final = measure();
  if (!settled || final.utf16 !== work.fileSizes.success.utf16 || final.utf8 !== work.fileSizes.success.utf8 || final.ownValues !== work.ownValues)
    fail2("Source3 success sizes must settle within eight passes");
}
function compileCadModel(source, options2) {
  if (typeof source !== "string")
    return programmingFailure("TYPE", "Source must be a string");
  if (!options2 || typeof options2 !== "object" || Array.isArray(options2))
    return programmingFailure("OPTIONS", "An explicit sourceVersion option is required");
  const prototype = Object.getPrototypeOf(options2), descriptors = Object.getOwnPropertyDescriptors(options2), keys = Reflect.ownKeys(options2);
  if (prototype !== Object.prototype && prototype !== null || keys.length !== 1 || keys[0] !== "sourceVersion" || !descriptors.sourceVersion || !("value" in descriptors.sourceVersion) || !descriptors.sourceVersion.enumerable || descriptors.sourceVersion.value !== 0 && descriptors.sourceVersion.value !== 1 && descriptors.sourceVersion.value !== 2 && descriptors.sourceVersion.value !== 3)
    return programmingFailure("OPTIONS", "Only own sourceVersion: 0, 1, 2 or 3 data is supported");
  const result = compileCadStages(source, descriptors.sourceVersion.value);
  if (!result.ok) {
    return diagnosticFailure(result.error);
  }
  if (descriptors.sourceVersion.value === 3) {
    const success = { ...result, diagnostics: [] };
    try {
      settleSource3Success(success);
    } catch (error3) {
      if (error3 instanceof CadAstError)
        return diagnosticFailure(error3);
      throw error3;
    }
    return copyCadData(success);
  }
  return { ok: true, ast: copyCadData(result.ast), ir: copyCadData(result.ir), model: copyCadData(result.model), constructions: copyCadData(result.constructions), diagnostics: [] };
}

// packages/barocss-cad/dist/numeric-policy.js
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

// packages/barocss-cad/dist/nurbs/surfaces/z-axis-revolved-surface.js
var OBSERVATION_MM = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/core/dyadic.js
var view = new DataView(new ArrayBuffer(8));
function binary64Dyadic(v) {
  if (!Number.isFinite(v))
    throw new RangeError("finite coordinates required");
  if (v === 0)
    return { m: 0n, k: 0 };
  view.setFloat64(0, v);
  const bits = view.getBigUint64(0), exp = Number(bits >> 52n & 2047n), frac = bits & 0xfffffffffffffn;
  let m = exp === 0 ? frac : frac | 1n << 52n, e = (exp === 0 ? 1 : exp) - 1075;
  while (m && !(m & 1n) && e < 0) {
    m >>= 1n;
    e++;
  }
  if (bits >> 63n)
    m = -m;
  return e >= 0 ? { m: m << BigInt(e), k: 0 } : { m, k: -e };
}

// packages/barocss-cad/dist/intersect/own-plate-circular-hole-preview.js
var TOL = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-plane-cylinder-clipped.js
var TOL2 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/core/own-data.js
var FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED = "Finite represented own numbers are required";
var DENSE_BOUNDED_ARRAYS_REQUIRED = "Dense bounded arrays are required";
var SPARSE_OWN_ARRAY_FIELDS_REFUSED = "Sparse/extra own array fields are refused";

// packages/barocss-cad/dist/intersect/own-multispan-curve-plane.js
var TOL3 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/nurbs/curves/curve-adaptive-sampling.js
var EPS = 64 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-adaptive-sampling.js
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

// packages/barocss-cad/dist/nurbs/curves/curve-bezier-spans.js
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

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-plane-intersection.js
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

// packages/barocss-cad/dist/intersect/own-coincident-plane-clip.js
var TOL4 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-convex-loop-clip.js
var TOL5 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/own-convex-planar-face.js
var TOL6 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-convex-planar-face-holes.js
var TOL7 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-convex-planar-face-holes-preview.js
var TOL8 = CadNumericPolicy.linearTolerance;
var EPS4 = 64 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/curves/curve-join.js
var EPS5 = 64 * Number.EPSILON;
var POINT_TOLERANCE3 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE3 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/curves/curve-reversal.js
var CurveReversalDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", DOMAIN: "DOMAIN", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", BINDING: "BINDING", OWNED: "OWNED" });
var EPS6 = 64 * Number.EPSILON;
var POINT_TOLERANCE4 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE4 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/curves/curve-interval-extraction.js
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

// packages/barocss-cad/dist/nurbs/surfaces/surface-region.js
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

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-refinement.js
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

// packages/barocss-cad/dist/nurbs/surfaces/surface-axis-reversal.js
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

// packages/barocss-cad/dist/nurbs/surfaces/trimmed-surface-axis-reversal.js
var TrimmedSurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  TOPOLOGY: "TOPOLOGY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  BINDING: "BINDING"
});

// packages/barocss-cad/dist/cad-document.js
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

// packages/barocss-cad/dist/document/cad-document-reference.js
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

// packages/barocss-cad/dist/intersect/own-cubic-curve-plane-intersection.js
var CubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-cubic-plane-intersection.js
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

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-control-polygon.js
var WideCurveControlPolygonEditDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-reversal.js
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

// packages/barocss-cad/dist/features/three-section-loft.js
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

// packages/barocss-cad/dist/document/cad-document-bounds.js
var CadDocumentBoundsDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/curves/cad-curve-arc-length.js
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

// packages/barocss-cad/dist/nurbs/surfaces/cad-surface-area.js
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

// packages/barocss-cad/dist/document/cad-assembly.js
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

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean.js
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

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-mesh.js
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

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-extrusion.js
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

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-extrusion-mesh.js
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

// packages/barocss-cad/dist/features/boolean-extrusion-feature-graph.js
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

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-extrusion-properties.js
var CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  OWNED: "OWNED"
});
var AREA_EPSILON = 128 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/surfaces/translational-sweep-surface.js
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

// packages/barocss-cad/dist/nurbs/curves/curve-interpolation-kernel-internal.js
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

// packages/barocss-cad/dist/nurbs/curves/curve-interpolation.js
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

// packages/barocss-cad/dist/nurbs/surfaces/surface-interpolation.js
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

// packages/barocss-cad/dist/nurbs/curves/curve-parameterization.js
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

// packages/barocss-cad/dist/nurbs/curves/weighted-curve-interpolation.js
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

// packages/barocss-cad/dist/features/multi-section-loft.js
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

// packages/barocss-cad/dist/features/affine-geometry-transform.js
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

// packages/barocss-cad/dist/features/linear-geometry-pattern.js
var LinearGeometryPatternDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/features/circular-geometry-pattern.js
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

// packages/barocss-cad/dist/core/second-derivatives.js
var NativeSecondDerivativeDiagnosticCode = Object.freeze({ INPUT: "INPUT", CONTINUITY: "CONTINUITY", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE" });

// packages/barocss-cad/dist/nurbs/surfaces/local-curvature.js
var NativeCurvatureDiagnosticCode = Object.freeze({
  DERIVATIVE: "DERIVATIVE",
  REGULARITY: "REGULARITY",
  ARITHMETIC: "ARITHMETIC"
});
var ROUNDING = 512 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/curves/curve-planar-face-material.js
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

// packages/barocss-cad/dist/features/section-knot-alignment.js
var SectionKnotAlignmentDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/intersect/vlinear-plane-section.js
var VLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-control-net.js
var SourceSurfaceControlNetDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-control-net-wide.js
var SourceSurfaceControlNetWideDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });
var SourceSurfaceControlNetWideError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Source Surface control-net wide: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SourceSurfaceControlNetWideError";
    this.code = code2;
  }
};
var CODE2 = SourceSurfaceControlNetWideDiagnosticCode;
var OWN = { input: CODE2.INPUT, owned: CODE2.OWNED, budget: CODE2.BUDGET, fail: (code2, detail) => {
  throw new SourceSurfaceControlNetWideError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new SourceSurfaceControlNetWideError(code2, detail, cause);
}, isRefusal: (e) => e instanceof SourceSurfaceControlNetWideError };

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-control-polygon.js
var SourceCurveControlPolygonDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });
var SourceCurveControlPolygonError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Source Curve control-polygon: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SourceCurveControlPolygonError";
    this.code = code2;
  }
};
var CODE3 = SourceCurveControlPolygonDiagnosticCode;
var OWN2 = { input: CODE3.INPUT, owned: CODE3.OWNED, budget: CODE3.BUDGET, fail: (code2, detail) => {
  throw new SourceCurveControlPolygonError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new SourceCurveControlPolygonError(code2, detail, cause);
}, isRefusal: (e) => e instanceof SourceCurveControlPolygonError };

// packages/barocss-cad/dist/features/piecewise-rational-loft.js
var PiecewiseRationalLoftDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", SOURCE: "SOURCE", OWNED: "OWNED" });
var PiecewiseRationalLoftError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Piecewise rational loft: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "PiecewiseRationalLoftError";
    this.code = code2;
  }
};
var CODE4 = PiecewiseRationalLoftDiagnosticCode;
var OWN3 = { input: CODE4.INPUT, owned: CODE4.OWNED, budget: CODE4.BUDGET, fail: (code2, detail) => {
  throw new PiecewiseRationalLoftError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new PiecewiseRationalLoftError(code2, detail, cause);
}, isRefusal: (e) => e instanceof PiecewiseRationalLoftError, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/dist/intersect/vlinear-plane-trim.js
var VLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/intersect/vlinear-plane-trim-classification.js
var VLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });
var VLinearSurfacePlaneTrimUVError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("V-linear trim UV classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "VLinearSurfacePlaneTrimUVError";
    this.code = code2;
  }
};
var CODE5 = VLinearSurfacePlaneTrimUVDiagnosticCode;
var OWN4 = { input: CODE5.INPUT, owned: CODE5.OWNED, budget: CODE5.BUDGET, fail: (code2, detail) => {
  throw new VLinearSurfacePlaneTrimUVError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new VLinearSurfacePlaneTrimUVError(code2, detail, cause);
}, isRefusal: (e) => e instanceof VLinearSurfacePlaneTrimUVError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/axis-box-boolean.js
var AxisBoxSolidBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", BINDING: "BINDING", CONTACT: "CONTACT", TOPOLOGY: "TOPOLOGY", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/planar-solids/axis-box-point-classification.js
var AxisBoxSolidBooleanPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", OWNED: "OWNED" });
var AxisBoxSolidBooleanPointError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Axis-box Solid point classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidBooleanPointError";
    this.code = code2;
  }
};
var CODE6 = AxisBoxSolidBooleanPointDiagnosticCode;
var OWN5 = { input: CODE6.INPUT, owned: CODE6.OWNED, budget: CODE6.BUDGET, fail: (code2, detail) => {
  throw new AxisBoxSolidBooleanPointError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new AxisBoxSolidBooleanPointError(code2, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidBooleanPointError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/dist/axis-box-solid-mass.js
var AxisBoxSolidMassDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var AxisBoxSolidMassError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Axis-box Solid mass: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidMassError";
    this.code = code2;
  }
};
var CODE7 = AxisBoxSolidMassDiagnosticCode;
var OWN6 = { input: CODE7.INPUT, owned: CODE7.OWNED, budget: CODE7.BUDGET, fail: (code2, detail) => {
  throw new AxisBoxSolidMassError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new AxisBoxSolidMassError(code2, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidMassError };

// packages/barocss-cad/dist/planar-solids/axis-box-principal-inertia.js
var AxisBoxSolidPrincipalInertiaDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", MASS: "MASS", SELECTION: "SELECTION", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var AxisBoxSolidPrincipalInertiaError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Axis-box Solid principal inertia: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidPrincipalInertiaError";
    this.code = code2;
  }
};
var CODE8 = AxisBoxSolidPrincipalInertiaDiagnosticCode;
var ROUNDING2 = 512 * Number.EPSILON;
var OWN7 = { input: CODE8.INPUT, owned: CODE8.OWNED, budget: CODE8.BUDGET, fail: (code2, detail) => {
  throw new AxisBoxSolidPrincipalInertiaError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new AxisBoxSolidPrincipalInertiaError(code2, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidPrincipalInertiaError, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/dist/sketch/xy-angle-arc.js
var XYAngleArcDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", UNIT: "UNIT", RANGE: "RANGE", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE", SOURCE: "SOURCE", BUDGET: "BUDGET", OWNED: "OWNED" });
var TURN = 2 * Math.PI;
var QUARTER = Math.PI / 2;

// packages/barocss-cad/dist/sketch/xy-angle-arc-artifact.js
var XYAngleArcArtifactDiagnosticCode = Object.freeze({ INPUT: "INPUT", REQUEST: "REQUEST", SOURCE: "SOURCE", BINDING: "BINDING", STRUCTURE: "STRUCTURE", ASSOCIATION: "ASSOCIATION", OBSERVATION: "OBSERVATION", BUDGET: "BUDGET", OWNED: "OWNED", CODEC: "CODEC", VERSION: "VERSION" });

// packages/barocss-cad/dist/intersect/multispan-vlinear-plane-section.js
var MultiSpanVLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/intersect/multispan-vlinear-plane-trim.js
var MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/intersect/multispan-vlinear-plane-trim-classification.js
var MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });
var MultiSpanVLinearSurfacePlaneTrimUVError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Multi-span V-linear trim UV classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "MultiSpanVLinearSurfacePlaneTrimUVError";
    this.code = code2;
  }
};
var CODE9 = MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode;
var OWN8 = { input: CODE9.INPUT, owned: CODE9.OWNED, budget: CODE9.BUDGET, fail: (code2, detail) => {
  throw new MultiSpanVLinearSurfacePlaneTrimUVError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new MultiSpanVLinearSurfacePlaneTrimUVError(code2, detail, cause);
}, isRefusal: (e) => e instanceof MultiSpanVLinearSurfacePlaneTrimUVError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/paired/paired-section-plane-cap.js
var PairedSectionPlaneCapDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", BASIS: "BASIS", GRAPH: "GRAPH", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var PairedSectionPlaneCapError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Paired section Plane cap: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "PairedSectionPlaneCapError";
    this.code = code2;
  }
};
var CODE10 = PairedSectionPlaneCapDiagnosticCode;
var OWN9 = { input: CODE10.INPUT, owned: CODE10.OWNED, budget: CODE10.BUDGET, fail: (code2, detail) => {
  throw new PairedSectionPlaneCapError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new PairedSectionPlaneCapError(code2, detail, cause);
}, isRefusal: (e) => e instanceof PairedSectionPlaneCapError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/features/section-exact-surface-binding.js
var SectionExactSurfaceBindingDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", SUPPORT: "SUPPORT", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var SectionExactSurfaceBindingError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Exact section Surface binding: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SectionExactSurfaceBindingError";
    this.code = code2;
  }
};
var CODE11 = SectionExactSurfaceBindingDiagnosticCode;
var OWN10 = { input: CODE11.INPUT, owned: CODE11.OWNED, budget: CODE11.BUDGET, fail: (code2, detail) => {
  throw new SectionExactSurfaceBindingError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new SectionExactSurfaceBindingError(code2, detail, cause);
}, isRefusal: (e) => e instanceof SectionExactSurfaceBindingError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/exact-proof/exact-surface-lower-trim.js
var ExactSurfaceLowerTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BINDING: "BINDING", PARENT: "PARENT", SUPPORT: "SUPPORT", EMBEDDING: "EMBEDDING", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", OWNED: "OWNED" });
var ExactSurfaceLowerTrimError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Exact original Surface lower trim: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "ExactSurfaceLowerTrimError";
    this.code = code2;
  }
};
var CODE12 = ExactSurfaceLowerTrimDiagnosticCode;
var OWN11 = { input: CODE12.INPUT, owned: CODE12.OWNED, budget: CODE12.BUDGET, fail: (code2, detail) => {
  throw new ExactSurfaceLowerTrimError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new ExactSurfaceLowerTrimError(code2, detail, cause);
}, isRefusal: (e) => e instanceof ExactSurfaceLowerTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/translated-strip/translated-surface-base-face.js
var TranslatedSurfaceBaseFaceDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/translated-surface-strip-volume.js
var TranslatedSurfaceStripVolumeDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/translated-surface-end-faces.js
var TranslatedSurfaceEndFacesDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var TranslatedSurfaceEndFacesError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Translated Surface end Faces: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "TranslatedSurfaceEndFacesError";
    this.code = code2;
  }
};
var CODE13 = TranslatedSurfaceEndFacesDiagnosticCode;
var OWN12 = { input: CODE13.INPUT, owned: CODE13.OWNED, budget: CODE13.BUDGET, fail: (code2, detail) => {
  throw new TranslatedSurfaceEndFacesError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new TranslatedSurfaceEndFacesError(code2, detail, cause);
}, isRefusal: (e) => e instanceof TranslatedSurfaceEndFacesError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/translated-strip/qualified-translated-strip-body.js
var QualifiedTranslatedStripBodyDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SOURCE: "SOURCE", TOPOLOGY: "TOPOLOGY", MATERIAL: "MATERIAL", ORIENTATION: "ORIENTATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/translated-surface-strip-world-points.js
var TranslatedSurfaceStripWorldPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", SUPPORT: "SUPPORT", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", OWNED: "OWNED" });

// packages/barocss-cad/dist/features/nurbs-source-loft-feature-graph.js
var NurbsSourceLoftFeatureGraphDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", REVISION: "REVISION", BUDGET: "BUDGET", SOURCE: "SOURCE", REFERENCE: "REFERENCE", DEPENDENCY: "DEPENDENCY", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", CODEC: "CODEC", OWNED: "OWNED" });

// packages/barocss-cad/dist/exact-proof/exact-surface-band-trim.js
var ExactSurfaceBandTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", BAND: "BAND", EMBEDDING: "EMBEDDING", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var ExactSurfaceBandTrimError = class extends KernelError {
  code;
  constructor(code2, detail, cause) {
    super(("Exact original Surface band trim: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "ExactSurfaceBandTrimError";
    this.code = code2;
  }
};
var CODE14 = ExactSurfaceBandTrimDiagnosticCode;
var OWN13 = { input: CODE14.INPUT, owned: CODE14.OWNED, budget: CODE14.BUDGET, fail: (code2, detail) => {
  throw new ExactSurfaceBandTrimError(code2, detail);
}, wrap: (code2, detail, cause) => {
  throw new ExactSurfaceBandTrimError(code2, detail, cause);
}, isRefusal: (e) => e instanceof ExactSurfaceBandTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/translated-strip/translated-strip-interval-boolean.js
var TranslatedStripIntervalBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", SUPPORT: "SUPPORT", PAIR: "PAIR", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", CONSTRUCTION: "CONSTRUCTION", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/qualified-translated-strip-body-mesh.js
var QualifiedTranslatedStripBodyMeshDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BODY: "BODY", SOURCE: "SOURCE", TOPOLOGY: "TOPOLOGY", UV: "UV", NATIVE: "NATIVE", ORIENTATION: "ORIENTATION", REPRESENTABILITY: "REPRESENTABILITY", FILE: "FILE", OWNED: "OWNED" });

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-knot-insertion.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-knot-insertion.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-interval-extraction.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-knot-aligned-loft.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-degree-elevation.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-degree-elevation.js
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

// packages/barocss-cad/dist/io/iges-import.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-line-width-face.js
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

// packages/barocss-cad/dist/paired/paired-surface-intersection-branch.js
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

// packages/barocss-cad/dist/translated-strip/translated-strip-plane-split.js
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

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-adaptive-sampling.js
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

// packages/barocss-cad/dist/exact-proof/exact-paired-vlinear-surface-intersection.js
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

// packages/barocss-cad/dist/paired/paired-surface-uv-split-faces.js
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

// packages/barocss-cad/dist/paired/paired-surface-b-uv-split-faces.js
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

// packages/barocss-cad/dist/paired/paired-surface-uv-face-classification.js
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

// packages/barocss-cad/dist/paired/paired-surface-material-body.js
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

// packages/barocss-cad/dist/paired/paired-surface-material-body-world-points.js
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

// packages/barocss-cad/dist/sketch/xy-numerical-sketch-admission-internal.js
var XYNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: "INVALID_DOCUMENT", UNSUPPORTED: "UNSUPPORTED", LIMIT: "LIMIT", REFERENCE: "REFERENCE", NONCONVERGENCE: "NONCONVERGENCE", NUMERICAL: "NUMERICAL", BUDGET: "BUDGET", BRANCH: "BRANCH", DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY", COMPILATION: "COMPILATION", OWNED: "OWNED" });

// packages/barocss-cad/dist/sketch/xy-numerical-sketch-solver-internal.js
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

// packages/barocss-cad/dist/convex-planar-solid-proof-internal.js
var ConvexPlanarSolidDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED", COVERAGE: "COVERAGE", BINDING: "BINDING", INCIDENCE: "INCIDENCE", CONVEXITY: "CONVEXITY", DEGENERATE: "DEGENERATE", REPRESENTABILITY: "REPRESENTABILITY" });

// packages/barocss-cad/dist/sketch/xy-circular-numerical-sketch-admission-internal.js
var XYCircularNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: "INVALID_DOCUMENT", UNSUPPORTED: "UNSUPPORTED", LIMIT: "LIMIT", REFERENCE: "REFERENCE", NONCONVERGENCE: "NONCONVERGENCE", NUMERICAL: "NUMERICAL", BUDGET: "BUDGET", BRANCH: "BRANCH", DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY", COMPILATION: "COMPILATION", OWNED: "OWNED" });

// packages/barocss-cad/dist/sketch/xy-circular-numerical-sketch-solver-internal.js
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

// packages/barocss-cad/dist/planar-solids/convex-planar-slab-subtraction-internal.js
var SLAB_LIMITS = Object.freeze({ inputBytes: 33554432, resultBytes: 67108864, cumulativeSnapshotBytes: 201326592, retainedSnapshotBytes: 134217728, inputValues: 2097152, resultValues: 4194304, inputDepth: 48, resultDepth: 56, inputStringCharacters: 16777216, resultStringCharacters: 33554432, arrayElements: 4096, recordFields: 64, keyCharacters: 128, stringCharacters: 262144, facesPerChild: 12, edgesPerFace: 8, usesPerChild: 64, verticesPerChild: 32, facetPlanePasses: 48, temporaryPolygonVertices: 20, classifications: 960, crossings: 96, candidateRecords: 256, coveragePredicates: 320, faceCompilations: 72, sourceCompilations: 72, bindingObservations: 1152, totalD1: 3456, rationalContexts: 5, rationalOperationsPerContext: 2e5, aggregateRationalOperations: 1e6, aggregateGcdSteps: 1e6, integerBits: 8192 });

// packages/barocss-cad/dist/features/extruded-profile-solid.js
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
  if (s.kind === "line")
    return { kind: "curve", id: id2, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[s.start[0], s.start[1], z], [s.end[0], s.end[1], z]], weights: [1, 1] };
  const spans = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 2) - 1e-12));
  const dt2 = s.sweep / spans, w = Math.cos(Math.abs(dt2) / 2);
  const cp = [], wt = [], knots = [0, 0, 0];
  for (let k = 0; k < spans; k++) {
    const t0 = s.startAngle + dt2 * k, tm = t0 + dt2 / 2;
    const p0 = k === 0 ? [s.start[0], s.start[1], z] : [s.center[0] + s.radius * Math.cos(t0), s.center[1] + s.radius * Math.sin(t0), z];
    const rm = s.radius / w;
    if (k === 0) {
      cp.push(p0);
      wt.push(1);
    }
    cp.push([s.center[0] + rm * Math.cos(tm), s.center[1] + rm * Math.sin(tm), z]);
    wt.push(w);
    const t1 = t0 + dt2;
    cp.push(k === spans - 1 ? [s.end[0], s.end[1], z] : [s.center[0] + s.radius * Math.cos(t1), s.center[1] + s.radius * Math.sin(t1), z]);
    wt.push(1);
    if (k < spans - 1)
      knots.push((k + 1) / spans, (k + 1) / spans);
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

// packages/barocss-cad/dist/mesh/facet-patch.js
function boundsOf(positions) {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const x = positions[i + k];
      if (x < b[k])
        b[k] = x;
      if (x > b[k + 3])
        b[k + 3] = x;
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

// packages/barocss-cad/dist/brep/brep-core.js
var BrepError = class extends KernelError {
  code;
  report;
  reason;
  constructor(code2, detail, report, reason) {
    super(("B-rep: " + detail).slice(0, 1024));
    this.code = code2;
    this.report = report;
    this.reason = reason;
    this.name = "BrepError";
  }
};
var isFacetFace = (face) => face.surface.kind === "facets";
function buildBrep(input) {
  let scale4 = 0;
  for (const v of input.vertices)
    for (const x of v.point)
      scale4 = Math.max(scale4, Math.abs(x));
  for (const b of input.bodies)
    for (const s of b.shells)
      for (const f of s.faces)
        if (f.surface.kind === "facets")
          for (const x of f.surface.bounds)
            scale4 = Math.max(scale4, Math.abs(x));
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
    const list3 = byEdge.get(c.edge);
    if (list3)
      list3.push(c);
    else
      byEdge.set(c.edge, [c]);
  }
  for (const uses of byEdge.values())
    if (uses.length === 2 && uses[0].sense !== uses[1].sense) {
      uses[0].twin = uses[1].id;
      uses[1].twin = uses[0].id;
    }
  for (const c of mutable)
    coedges.push(c);
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

// packages/barocss-cad/dist/mesh/facet-brep.js
function weldVertices(positions, n, weld) {
  let cap = 16;
  while (cap < 2 * n)
    cap *= 2;
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
        if (h >= 0 && Math.hypot(out[3 * h] - x, out[3 * h + 1] - y, out[3 * h + 2] - z) <= weld)
          k = h;
      }
      if (k < 0) {
        let h = cellHash(cx, cy, cz, cap);
        while (table[h] >= 0)
          h = h + 1 & cap - 1;
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
    if (k < 0)
      return -1;
    if (cells[3 * k] === cx && cells[3 * k + 1] === cy && cells[3 * k + 2] === cz)
      return k;
  }
}

// packages/barocss-cad/dist/mesh/triangle-bvh.js
var stack = new Int32Array(256);

// packages/barocss-cad/dist/mesh/facet-bvh.js
var DIRECTIONS = [[0.5773, 0.6007, 0.5531], [-0.4352, 0.7934, 0.4256], [0.6913, -0.3418, 0.6366], [-0.2672, -0.5389, 0.7988], [0.8123, 0.4977, -0.3042], [-0.7311, 0.1873, -0.656], [0.1391, -0.9134, -0.3826], [0.3529, 0.2214, -0.9091]].map((d) => {
  const l = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / l, d[1] / l, d[2] / l];
});
var stack2 = new Int32Array(256);

// packages/barocss-cad/dist/mesh/mesh-decimate.js
var n1 = new Float64Array(3);
var n2 = new Float64Array(3);
var pair = new Int32Array(4);
var place = new Float64Array(3);
var two = new Int32Array(3);

// packages/barocss-cad/dist/mesh/mesh-clearance.js
var TA = new Float64Array(9);
var TB = new Float64Array(9);
var CP = new Float64Array(6);
var BEST = new Float64Array(6);
var stack3 = new Int32Array(512);
var Q = new Float64Array(3);
var S = new Float64Array(6);

// packages/barocss-cad/dist/mesh/voxel-field.js
var IDS = new Int32Array(4);
var PIN = new Int32Array(4);
var POUT = new Int32Array(4);

// packages/barocss-cad/dist/features/subd-sd2.js
var GP = new Float64Array(3);
var GU = new Float64Array(3);
var GV = new Float64Array(3);
var BU = new Float64Array(4);
var BV = new Float64Array(4);
var DU = new Float64Array(4);
var DV = new Float64Array(4);

// packages/barocss-cad/dist/nurbs/surfaces/surface-revolution.js
var TAU2 = 2 * Math.PI;

// packages/barocss-cad/dist/core/extent.js
function minAt(ps, k) {
  let r = Infinity;
  for (let i = 0; i < ps.length; i++) {
    const x = ps[i][k];
    if (x !== x)
      return NaN;
    if (x < r || x === 0 && r === 0 && Object.is(x, -0))
      r = x;
  }
  return r;
}
function maxAt(ps, k) {
  let r = -Infinity;
  for (let i = 0; i < ps.length; i++) {
    const x = ps[i][k];
    if (x !== x)
      return NaN;
    if (x > r || x === 0 && r === 0 && Object.is(r, -0))
      r = x;
  }
  return r;
}

// packages/barocss-cad/dist/brep/curved-arrangement.js
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
  for (let k = 0; k < pieces; k++)
    for (const [x, w] of GL8) {
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
      if (k)
        pad = Math.max(pad, Math.hypot(ps[k][0] - ps[k - 1][0], ps[k][1] - ps[k - 1][1]));
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
  if (s.kind !== "curve")
    return false;
  const { lo, hi } = samples(s);
  return p[0] < lo[0] - eps || p[1] < lo[1] - eps || p[0] > hi[0] + eps || p[1] > hi[1] + eps;
};
var CURVE_SAMPLES = 64;
var LIES_ALONG_FIRST = [0.5, 0, 1];
var LINE_US = [0, 1];
var DENSE_US = Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => k / (CURVE_SAMPLES * 2));
function segArea(s) {
  if (s.kind === "line")
    return (s.a[0] * s.b[1] - s.b[0] * s.a[1]) / 2;
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
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
      c = !c;
  }
  return c;
};
function liesAlong(a, b, eps) {
  for (const u of LIES_ALONG_FIRST) {
    const p = segAt(a, u);
    if (surelyOff(b, p, eps) || segDistance(b, p) > eps)
      return false;
  }
  const ps = a.kind === "curve" ? samplesOf(a) : polyline(a, CURVE_SAMPLES);
  for (const p of ps)
    if (surelyOff(b, p, eps) || segDistance(b, p) > eps)
      return false;
  return true;
}
function segD2(s, p, u) {
  const q2 = segAt(s, u);
  return (q2[0] - p[0]) ** 2 + (q2[1] - p[1]) ** 2;
}
function goldenNearest(s, p, lo, hi) {
  for (let i = 0; i < 60; i++) {
    const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887;
    if (segD2(s, p, m1) < segD2(s, p, m2))
      hi = m2;
    else
      lo = m1;
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
    if (d0 > on * on)
      for (const k of nearerChords(ps, p, d0)) {
        if (closed && (best === N && k === 0 || best === 0 && k === N - 1))
          continue;
        const u = goldenNearest(s, p, Math.max(0, (k - 0.5) / CURVE_SAMPLES), Math.min(1, (k + 1.5) / CURVE_SAMPLES));
        if (segD2(s, p, u) <= on * on)
          return u;
      }
    return u0;
  }
  if (s.kind === "line") {
    const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l2 = d[0] * d[0] + d[1] * d[1];
    return ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / l2;
  }
  const dir = Math.sign(s.sweep), w = Math.abs(s.sweep);
  let dt2 = (Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.t0) * dir;
  dt2 = (dt2 % TWO_PI + TWO_PI) % TWO_PI;
  if (dt2 > w && TWO_PI - dt2 < dt2 - w)
    dt2 -= TWO_PI;
  return dt2 / w;
}
function nearerChords(ps, p, d2) {
  const out = [];
  for (let k = 0; k + 1 < ps.length; k++) {
    const a = ps[k], b = ps[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0, ex = a[0] + t * dx - p[0], ey = a[1] + t * dy - p[1], d = ex * ex + ey * ey;
    if (d < d2)
      out.push({ k, d });
  }
  return out.sort((x, y) => x.d - y.d).map((x) => x.k);
}
function segDistance(s, p) {
  const q2 = segAt(s, Math.min(1, Math.max(0, paramOf(s, p))));
  return Math.hypot(q2[0] - p[0], q2[1] - p[1]);
}
function touchOfEnd(s, t, u, m, eps) {
  if ([segStart(s), segEnd(s), segStart(t), segEnd(t)].some((q2) => Math.hypot(q2[0] - m[0], q2[1] - m[1]) <= eps))
    return false;
  for (const [e, ue] of [[segStart(s), 0], [segEnd(s), 1]]) {
    if (Math.abs(u - ue) > 0.25 || segDistance(t, e) > eps)
      continue;
    let hug = true;
    for (let k = 1; k < 8 && hug; k++)
      hug = segDistance(t, segAt(s, ue + (u - ue) * k / 8)) <= eps;
    if (hug && leavesAwayFromEnds(s, t, e, ue, Math.abs(u - ue), eps))
      return true;
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
  if (points.length < 3)
    return points;
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
      if (Math.min(Math.abs(sa), Math.abs(sb)) <= L && f >= 0 && f <= 1)
        for (let k = 1; k < 8; k++) {
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
  if (!(l > 0))
    return out;
  let lastU = R.us[0], lastD = (dx * (R.points[0][1] - line.a[1]) - dy * (R.points[0][0] - line.a[0])) / l;
  for (let i = 1; i < R.points.length; i++) {
    const p = R.points[i], d = (dx * (p[1] - line.a[1]) - dy * (p[0] - line.a[0])) / l, u = R.us[i];
    if (Math.abs(d) <= eps && Math.abs(lastD) <= eps) {
      lastU = u;
      lastD = d;
      continue;
    }
    if (d === 0)
      out.push(p);
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
        } else
          hi = m;
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
  if (!(l > 0))
    return false;
  const a = segAt(s, Math.max(0, u - 1e-3)), b = segAt(s, Math.min(1, u + 1e-3));
  const da = (tx * (a[1] - Q2[1]) - ty * (a[0] - Q2[0])) / l, db = (tx * (b[1] - Q2[1]) - ty * (b[0] - Q2[0])) / l;
  return Math.abs(da) > eps && Math.abs(db) > eps && da > 0 !== db > 0;
}
function intersectSegments(s, t, eps, graze = false) {
  const out = [], on = (x, p) => !surelyOff(x, p, eps) && segDistance(x, p) <= eps;
  const push = (p) => {
    if (on(s, p) && on(t, p))
      out.push(p);
  };
  const ends = () => {
    for (const p of [segStart(s), segEnd(s)])
      if (on(t, p) && on(s, p))
        out.push(p);
    for (const p of [segStart(t), segEnd(t)])
      push(p);
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
      for (const p of grazeCrossings(curve, line2, R, eps))
        push(p);
      ends();
      return overlapEnds(s, t, out, eps);
    }
    const A = A0, B = B0;
    for (let i = 0; i < ns; i++)
      for (let j = 0; j < nt; j++) {
        const p = A[i], q2 = A[i + 1], r = B[j], w = B[j + 1], d1 = [q2[0] - p[0], q2[1] - p[1]], d2 = [w[0] - r[0], w[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
        if (Math.abs(den) < 1e-300)
          continue;
        const e = [r[0] - p[0], r[1] - p[1]], a = (e[0] * d2[1] - e[1] * d2[0]) / den, b = (e[0] * d1[1] - e[1] * d1[0]) / den;
        if (a < -0.25 || a > 1.25 || b < -0.25 || b > 1.25)
          continue;
        let u = (i + Math.min(1, Math.max(0, a))) / ns, v = (j + Math.min(1, Math.max(0, b))) / nt;
        const fromEnd = u === 1 || v === 1;
        for (let it = 0; it < 30; it++) {
          const P2 = segAt(s, u), Q3 = segAt(t, v), F = [P2[0] - Q3[0], P2[1] - Q3[1]], h = 1e-7;
          if (it === 0 && (u === 1 || v === 1) && Math.hypot(F[0], F[1]) <= eps)
            break;
          const hu = Math.min(1, u + h) - u || -h, hv = Math.min(1, v + h) - v || -h, Pu = segAt(s, u + hu), Qv = segAt(t, v + hv);
          const J = [(Pu[0] - P2[0]) / hu, -(Qv[0] - Q3[0]) / hv, (Pu[1] - P2[1]) / hu, -(Qv[1] - Q3[1]) / hv], det = J[0] * J[3] - J[1] * J[2];
          if (Math.abs(det) < 1e-300)
            break;
          const du = (F[0] * J[3] - F[1] * J[1]) / det, dv = (J[0] * F[1] - J[2] * F[0]) / det;
          const nu = Math.min(1, Math.max(0, u - du)), nv = Math.min(1, Math.max(0, v - dv)), held = nu === u && nv === v;
          u = nu;
          v = nv;
          if (held || Math.abs(du) < 1e-15 && Math.abs(dv) < 1e-15)
            break;
        }
        const P = segAt(s, u), Q2 = segAt(t, v);
        if (fromEnd && u !== 1 && v !== 1 && !crossesAt(s, t, u, v, eps))
          continue;
        if (Math.hypot(P[0] - Q2[0], P[1] - Q2[1]) <= eps) {
          const m = [(P[0] + Q2[0]) / 2, (P[1] + Q2[1]) / 2];
          if (!out.some((o) => Math.hypot(o[0] - m[0], o[1] - m[1]) <= eps) && !touchOfEnd(s, t, u, m, eps) && !touchOfEnd(t, s, v, m, eps))
            push(m);
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
    if (h > 0)
      push([mx - h * dy / d2, my + h * dx / d2]);
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
  if (s.kind === "arc" && Math.abs(s.sweep) > Math.PI + 1e-12)
    return [{ ...s, sweep: s.sweep / 2 }, { ...s, t0: s.t0 + s.sweep / 2, sweep: s.sweep / 2 }];
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
  for (const ring of rings)
    for (const s of ring)
      for (const q2 of s.kind === "line" ? [s.a, s.b] : s.kind === "curve" ? polyline(s, 8) : [[Math.abs(s.c[0]) + s.r, Math.abs(s.c[1]) + s.r]])
        scale4 = Math.max(scale4, Math.abs(q2[0]), Math.abs(q2[1]));
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
    if (degree[v] !== 1)
      continue;
    let e = 0;
    while (edges[e].u !== v && edges[e].v !== v)
      e++;
    const other = edges[e].u === v ? edges[e].v : edges[e].u;
    if (Math.hypot(points[other][0] - points[v][0], points[other][1] - points[v][1]) <= 10 * eps)
      continue;
    let best = -1, bd = 10 * eps;
    for (let w = 0; w < points.length; w++) {
      if (w === v || w === other || degree[w] === 0)
        continue;
      const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
      if (d <= bd) {
        bd = d;
        best = w;
      }
    }
    if (best < 0)
      for (let w = 0, d0 = 100 * eps; w < points.length; w++) {
        if (w === v || w === other || degree[w] !== 1)
          continue;
        const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
        if (d <= d0) {
          d0 = d;
          best = w;
        }
      }
    if (best >= 0) {
      if (edges[e].u === v)
        edges[e].u = best;
      else
        edges[e].v = best;
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
      if (f === e || g2.u === v || g2.v === v || short && (g2.u === other || g2.v === other) || surelyOff(g2.seg, p, Math.max(sd, reach)))
        continue;
      const d = segDistance(g2.seg, p);
      if (d > reach || split >= 0 && d > sd)
        continue;
      const u = paramOf(g2.seg, p);
      if (u > 0 && u < 1) {
        sd = d;
        split = f;
        at2 = u;
      }
    }
    if (split < 0)
      continue;
    const g = edges[split];
    edges.push({ u: v, v: g.v, seg: segPart(g.seg, at2, 1, p, points[g.v]), count: new Map(g.count) });
    g.seg = segPart(g.seg, 0, at2, points[g.u], p);
    g.v = v;
    degree[v] += 2;
  }
}
function arrange(rings, tolerance, joinEnds = false) {
  const pieces = [];
  for (const { polygon, ring } of rings)
    for (const seg of ring)
      for (const h of halves(seg))
        pieces.push({ seg: h, polygon });
  const eps = tolerance ?? curveTolerance(rings.map((r) => r.ring));
  const points = [], grid = /* @__PURE__ */ new Map(), cell = eps * 64;
  const vid = (p) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), r = 2 * eps;
    const x0 = p[0] - gx * cell <= r ? -1 : 0, x1 = (gx + 1) * cell - p[0] <= r ? 1 : 0, y0 = p[1] - gy * cell <= r ? -1 : 0, y1 = (gy + 1) * cell - p[1] <= r ? 1 : 0;
    for (let i = x0; i <= x1; i++)
      for (let j = y0; j <= y1; j++) {
        const g2 = grid.get(gx + i + "," + (gy + j));
        if (g2) {
          for (const v2 of g2)
            if (Math.hypot(points[v2][0] - p[0], points[v2][1] - p[1]) <= eps)
              return v2;
        }
      }
    const v = points.length;
    points.push(p);
    const k = gx + "," + gy, g = grid.get(k);
    if (g)
      g.push(v);
    else
      grid.set(k, [v]);
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
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
        continue;
      for (const p of intersectSegments(pieces[i].seg, pieces[j].seg, eps)) {
        cuts[i].push(p);
        cuts[j].push(p);
      }
    }
  const edges = [], edgesBetween = /* @__PURE__ */ new Map();
  pieces.forEach((pc, i) => {
    const params = cuts[i].map((p) => ({ u: Math.min(1, Math.max(0, paramOf(pc.seg, p))), v: vid(p) })).sort((x, y) => x.u - y.u);
    const stops = [];
    for (const st of params)
      if (!stops.length || stops[stops.length - 1].v !== st.v)
        stops.push(st);
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1];
      if (s1.u - s0.u <= 0)
        continue;
      const seg = segPart(pc.seg, s0.u, s1.u, points[s0.v], points[s1.v]), mid = segAt(seg, 0.5);
      const forward = s0.v < s1.v, lo = forward ? s0.v : s1.v, hi = forward ? s1.v : s0.v;
      const key = lo + ":" + hi, list3 = edgesBetween.get(key) ?? [];
      let e = list3.find((k2) => segDistance(edges[k2].seg, mid) <= 4 * eps);
      if (e === void 0) {
        e = edges.length;
        edges.push({ u: lo, v: hi, seg: forward ? seg : segReverse(seg), count: /* @__PURE__ */ new Map() });
        list3.push(e);
        edgesBetween.set(key, list3);
      }
      if (pc.polygon >= 0) {
        const c = edges[e].count;
        c.set(pc.polygon, (c.get(pc.polygon) ?? 0) + (forward ? 1 : -1));
      }
    }
  });
  if (joinEnds)
    joinLooseEnds(points, edges, eps);
  const half = [];
  edges.forEach((_, i) => {
    half.push({ from: edges[i].u, to: edges[i].v, edge: i, twin: 2 * i + 1, next: -1, face: -1 }, { from: edges[i].v, to: edges[i].u, edge: i, twin: 2 * i, next: -1, face: -1 });
  });
  const leaving = (h) => {
    const s = h.from === edges[h.edge].u ? edges[h.edge].seg : segReverse(edges[h.edge].seg);
    const norm = (a) => a <= -Math.PI + 1e-12 ? a + TWO_PI : a;
    if (s.kind === "line")
      return { angle: norm(Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])), curvature: 0 };
    if (s.kind === "curve") {
      const d = 1e-4, p0 = segAt(s, 0), p1 = segAt(s, d), p2 = segAt(s, 2 * d), v = [(p1[0] - p0[0]) / d, (p1[1] - p0[1]) / d], a = [(p2[0] - 2 * p1[0] + p0[0]) / (d * d), (p2[1] - 2 * p1[1] + p0[1]) / (d * d)];
      return { angle: norm(Math.atan2(v[1], v[0])), curvature: (v[0] * a[1] - v[1] * a[0]) / Math.hypot(v[0], v[1]) ** 3 };
    }
    const t = s.t0, dir = Math.sign(s.sweep);
    return { angle: norm(Math.atan2(Math.cos(t) * dir, -Math.sin(t) * dir)), curvature: dir / s.r };
  };
  const outgoing = points.map(() => []);
  half.forEach((h, i) => outgoing[h.from].push(i));
  const keyed = half.map(leaving);
  const delta = 1e3 * eps, rel = new Float64Array(half.length), segLeaving = (h) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  for (const list3 of outgoing) {
    const a = list3.map((h) => keyed[h].angle).sort((x, y) => x - y);
    let from = -Math.PI, gap = -1;
    for (let i = 0; i < a.length; i++) {
      const g = (i + 1 < a.length ? a[i + 1] : a[0] + TWO_PI) - a[i];
      if (g > gap) {
        gap = g;
        from = a[i] + g / 2;
      }
    }
    for (const h of list3)
      rel[h] = ((keyed[h].angle - from) % TWO_PI + TWO_PI) % TWO_PI;
    list3.sort((x, y) => {
      const d = rel[x] - rel[y];
      return Math.abs(d) > 1e-4 ? d : tangentOrder(segLeaving(x), segLeaving(y), rel[x], rel[y], from, d, keyed[x].curvature, keyed[y].curvature, delta);
    });
  }
  const pos = /* @__PURE__ */ new Map();
  outgoing.forEach((list3) => list3.forEach((h, k) => pos.set(h, k)));
  for (const h of half) {
    const list3 = outgoing[h.to], k = pos.get(h.twin);
    h.next = list3[(k - 1 + list3.length) % list3.length];
  }
  const cycles = [];
  half.forEach((h, i) => {
    if (h.face >= 0)
      return;
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
  if (Math.abs(c) > 1e-12)
    return c;
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
    while (root[v] !== v)
      v = root[v] = root[root[v]];
    return v;
  };
  for (const e of edges)
    root[find(e.u)] = find(e.v);
  const comp = (c) => find(half[c[0]].from), sampled2 = cycles.map((c) => sampleRing(c.map(segOfHalf)));
  const faceOfCycle = cycles.map((c, i) => {
    if (areas2[i] > 0)
      return i;
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
      if (winding.has(other))
        continue;
      const e = edges[half[h].edge], fwd = half[h].from === e.u;
      winding.set(other, w.map((x, p) => x - (e.count.get(p) ?? 0) * (fwd ? 1 : -1)));
      queue.push(other);
    }
  }
  return { faceOfHalf, winding, faceOfCycle, areas: areas2 };
}
function simplify(ring, eps) {
  const sameCarrier = (s, t) => {
    if (s.tag !== t.tag)
      return false;
    if (s.kind === "line" && t.kind === "line") {
      const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]];
      return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) <= 1e-12 * Math.hypot(...d1) * Math.hypot(...d2) && d1[0] * d2[0] + d1[1] * d2[1] > 0;
    }
    if (s.kind === "arc" && t.kind === "arc")
      return Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1]) <= eps && Math.abs(s.r - t.r) <= eps && Math.sign(s.sweep) === Math.sign(t.sweep);
    if (s.kind === "curve" && t.kind === "curve")
      return s.f === t.f && s.t1 === t.t0 && Math.sign(s.t1 - s.t0) === Math.sign(t.t1 - t.t0);
    return false;
  };
  const out = [...ring];
  for (let changed = true; changed && out.length > 1; ) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const s = out[i], t = out[(i + 1) % out.length];
      if (!sameCarrier(s, t))
        continue;
      const merged = s.kind === "line" ? { ...s, b: t.b } : s.kind === "curve" ? { ...s, t1: t.t1 } : { ...s, sweep: s.sweep + t.sweep };
      if (merged.kind === "arc" && Math.abs(merged.sweep) > Math.PI + 1e-12)
        continue;
      if (merged.kind === "curve" && halves(merged).length > 1)
        continue;
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
  if (!rings.length)
    return [];
  const arr = arrange(rings, tolerance, joinEnds), { faceOfHalf, winding } = regions(arr, 2), { half, segOfHalf, eps } = arr;
  const pick = (w) => {
    const x = w[0] !== 0, y = w[1] !== 0;
    return operation === "union" ? x || y : operation === "intersection" ? x && y : operation === "difference" ? x && !y : x !== y;
  };
  const selected = /* @__PURE__ */ new Map();
  for (const [f, w] of winding)
    selected.set(f, f !== -1 && pick(w));
  const boundary = (h) => !!selected.get(faceOfHalf[h]) && !selected.get(faceOfHalf[half[h].twin]);
  const used = /* @__PURE__ */ new Set(), traced2 = [];
  half.forEach((_, h) => {
    if (!boundary(h) || used.has(h))
      return;
    const ring = [];
    let g = h;
    do {
      used.add(g);
      ring.push(segOfHalf(g));
      let n = half[g].next;
      while (!boundary(n))
        n = half[half[n].twin].next;
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
    if (best < 0)
      throw curvedArrangementError("a result hole has no enclosing ring");
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
  for (const ring of [region.outer, ...region.holes])
    for (const s of ring) {
      if (s.kind === "line") {
        const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
        for (const [u, w] of GL8)
          add4(s.a[0] + dx * u, s.a[1] + dy * u, dx, dy, w);
        continue;
      }
      if (s.kind === "curve") {
        for (let k = 0; k < 16; k++)
          for (const [u, w] of GL8) {
            const x = (k + u) / 16, p = segAt(s, x), a = segAt(s, Math.max(0, x - 1e-6)), b = segAt(s, Math.min(1, x + 1e-6)), du = Math.min(1, x + 1e-6) - Math.max(0, x - 1e-6);
            add4(p[0], p[1], (b[0] - a[0]) / du / 16, (b[1] - a[1]) / du / 16, w);
          }
        continue;
      }
      const pieces = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 8)));
      for (let k = 0; k < pieces; k++)
        for (const [u, w] of GL8) {
          const t = s.t0 + s.sweep * (k + u) / pieces, dt2 = s.sweep / pieces;
          add4(s.c[0] + s.r * Math.cos(t), s.c[1] + s.r * Math.sin(t), -s.r * Math.sin(t) * dt2, s.r * Math.cos(t) * dt2, w);
        }
    }
  return m;
}
function crossingsAt(rings, y) {
  const xs = [];
  const yAbove = y + 1e-12 * (1 + Math.abs(y));
  for (const ring of rings)
    for (let si = 0; si < ring.length; si++) {
      const g = ring[si], start = segEnd(ring[(si - 1 + ring.length) % ring.length]);
      const us = g.kind === "line" ? LINE_US : g.kind === "curve" ? DENSE_US : arcCuts(g);
      const dense = g.kind === "curve" ? denseSamples(g) : null;
      for (let k = 0; k + 1 < us.length; k++) {
        let lo = us[k], hi = us[k + 1];
        const a = lo === 0 ? start : dense ? dense[k] : segAt(g, lo), b = hi === 0 ? start : dense ? dense[k + 1] : segAt(g, hi);
        const aAbove = a[1] > yAbove;
        if (aAbove === b[1] > yAbove)
          continue;
        if (g.kind === "line") {
          xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
          continue;
        }
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;
          if (segAt(g, m)[1] > yAbove === aAbove)
            lo = m;
          else
            hi = m;
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
    if (u > 0 && u < 1)
      cuts.push(u);
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
  for (const ring of rings)
    for (const g of ring)
      for (const p of extent(g)) {
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
  let best = null, clearance = -1;
  for (const f of [0.5, 0.3819660112501051, 0.6180339887498949, 0.2360679774997897, 0.7639320225002103, 0.1458980337503155, 0.8541019662496845, 0.0901699437494742, 0.9098300562505258]) {
    const y = y0 + (y1 - y0) * f, xs = crossingsAt(rings, y).sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const p = [(xs[k] + xs[k + 1]) / 2, y];
      let d = Infinity;
      scan: for (const ring of rings)
        for (const g of ring) {
          if (g.kind === "curve") {
            const { lo, hi } = samples(g);
            if (Math.hypot(Math.max(lo[0] - p[0], 0, p[0] - hi[0]), Math.max(lo[1] - p[1], 0, p[1] - hi[1])) >= d)
              continue;
          }
          d = Math.min(d, segDistance(g, p));
          if (d <= clearance)
            break scan;
        }
      if (d > clearance) {
        clearance = d;
        best = p;
      }
    }
  }
  return best;
}

// packages/barocss-cad/dist/features/prismatic-solid.js
var prismaticSolidError = (detail) => kernelRefusal("prismatic-solid", "PRISMATIC_SOLID", "Prismatic solid: " + detail);
var ringsOf = (regions2) => regions2.flatMap((r) => [r.outer, ...r.holes]);
var allRings = (slabs) => slabs.flatMap((s) => ringsOf(s.regions));
function normalize(slabs, tolerance, caps = [], merged = false) {
  const sorted = slabs.filter((s) => s.regions.length).sort((a, b) => a.z0 - b.z0), out = [];
  for (const s of sorted) {
    if (!(Number.isFinite(s.z0) && Number.isFinite(s.z1) && s.z1 > s.z0))
      throw prismaticSolidError("every slab needs finite z0 < z1");
    const prev = out[out.length - 1];
    if (prev && s.z0 < prev.z1)
      throw prismaticSolidError("slabs overlap in Z");
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
  eps;
  points = [];
  grid = /* @__PURE__ */ new Map();
  cell;
  constructor(eps) {
    this.eps = eps;
    this.cell = eps * 64;
  }
  find(p) {
    const gx = Math.floor(p[0] / this.cell), gy = Math.floor(p[1] / this.cell);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const v of this.grid.get(gx + i + "," + (gy + j)) ?? [])
          if (Math.hypot(this.points[v][0] - p[0], this.points[v][1] - p[1]) <= this.eps)
            return v;
    return -1;
  }
  add(p) {
    const f = this.find(p);
    if (f >= 0)
      return f;
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
function brepFromPrismatic(solid, options2 = {}) {
  const id2 = options2.id ?? "prismatic", slabs = solid.slabs;
  if (!slabs.length)
    throw new BrepError("INPUT", "a prismatic solid without slabs has no B-rep");
  const tol = curveTolerance(allRings(slabs));
  const levels = [...new Set(slabs.flatMap((s) => [s.z0, s.z1]))].sort((x, y) => x - y);
  const ringsAt = (z, side) => ringsOf(slabs.find((s) => (side === "below" ? s.z1 : s.z0) === z)?.regions ?? []);
  const set = new PointSet(tol);
  const caps = levels.map((z) => {
    const below = ringsAt(z, "below"), above = ringsAt(z, "above");
    for (const p of curveArrangementVertices([...below, ...above], tol))
      set.add(p);
    return { up: below.length ? booleanCurveRegions(below, above, "difference", tol) : [], down: above.length ? booleanCurveRegions(above, below, "difference", tol) : [] };
  });
  for (const c of caps)
    for (const ring of ringsOf([...c.up, ...c.down]))
      for (const s of ring) {
        set.add(segStart(s));
        set.add(segEnd(s));
      }
  const P = set.points;
  const pieces = [], between = /* @__PURE__ */ new Map();
  const piece = (seg, a, b) => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo + ":" + hi, list3 = between.get(key) ?? [], mid = segAt(seg, 0.5);
    let k = list3.find((i) => segDistance(pieces[i].seg, mid) <= 4 * tol);
    if (k === void 0) {
      k = pieces.length;
      pieces.push({ seg: a === lo ? seg : segReverse(seg), lo, hi });
      list3.push(k);
      between.set(key, list3);
    }
    return { piece: k, forward: a === lo };
  };
  const split = (ring) => ring.flatMap((s) => {
    const a = set.find(segStart(s)), b = set.find(segEnd(s));
    if (a < 0 || b < 0)
      throw new BrepError("GEOMETRY", "a ring vertex is missing from the arrangement");
    const stops = [{ u: 0, v: a }];
    P.forEach((p, v) => {
      if (v === a || v === b || segDistance(s, p) > tol)
        return;
      const u = paramOf(s, p);
      if (u > 0 && u < 1)
        stops.push({ u, v });
    });
    stops.sort((x, y) => x.u - y.u);
    stops.push({ u: 1, v: b });
    const out = [];
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1];
      if (s0.v === s1.v)
        continue;
      const sub4 = s.kind === "line" ? { ...s, a: P[s0.v], b: P[s1.v] } : s.kind === "arc" ? { ...s, t0: s.t0 + s.sweep * s0.u, sweep: s.sweep * (s1.u - s0.u) } : noCurves();
      out.push({ ...piece(sub4, s0.v, s1.v), tag: s.tag });
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
        const list3 = cells.get(k + ":" + forward) ?? [];
        list3.push({ si, k, forward, sStart: strut(j), sEnd: strut(j + 1), pStart: startOf(j), pEnd: startOf(j + 1), cell: `${si}_${ri}_${gi}_${j}`, tag });
        cells.set(k + ":" + forward, list3);
      });
    }));
  });
  for (const list3 of cells.values()) {
    list3.sort((a, b) => a.si - b.si);
    const runs = [];
    for (const c of list3) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1].si === c.si - 1 && slabs[c.si - 1].z1 === slabs[c.si].z0)
        last.push(c);
      else
        runs.push([c]);
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
    for (const [up, regions2] of [[true, c.up], [false, c.down]])
      regions2.forEach((region, n) => {
        const f = faces.length, fid = `${id2}_${up ? "u" : "d"}${level}_${n}`;
        const rings = [region.outer, ...region.holes].map((r) => {
          const parts = split(r);
          return up ? parts : [...parts].reverse().map((x) => ({ piece: x.piece, forward: !x.forward }));
        });
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const ring of rings)
          for (const { piece: k } of ring)
            for (const q3 of curveOf(k, z, "b").controlPoints) {
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
  for (const u of uses)
    byKey.set(u.key, [...byKey.get(u.key) ?? [], u]);
  for (const [key, list3] of byKey) {
    if (list3.length === 4) {
      const tags = new Set(list3.map((u) => u.tag));
      if (tags.size !== 4)
        throw new BrepError("TOPOLOGY", `edge ${key} has four uses that are not two wedges`);
      for (const u of list3)
        u.key = key + (u.tag === "lowerWall" || u.tag === "upFace" ? "a" : "b");
    } else if (list3.length !== 2)
      throw new BrepError("TOPOLOGY", `edge ${key} has ${list3.length} uses`);
  }
  const edgeUses = /* @__PURE__ */ new Map();
  for (const u of uses)
    edgeUses.set(u.key, [...edgeUses.get(u.key) ?? [], u]);
  for (const [key, list3] of edgeUses)
    if (list3.length !== 2 || list3[0].sense === list3[1].sense)
      throw new BrepError("TOPOLOGY", `edge ${key} is not used once in each direction`);
  const parent = /* @__PURE__ */ new Map(), find = (x) => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r)
      r = parent.get(r);
    parent.set(x, r);
    return r;
  };
  const at2 = (v, e) => v + "|" + e, unite = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb)
      parent.set(ra, rb);
  };
  for (const f of faces)
    for (const l of f.loops)
      l.uses.forEach((u, k) => {
        const n = l.uses[(k + 1) % l.uses.length];
        unite(at2(u.end, u.key), at2(n.start, n.key));
      });
  const discEdges = /* @__PURE__ */ new Map();
  for (const u of uses) {
    u.startRoot = find(at2(u.start, u.key));
    u.endRoot = find(at2(u.end, u.key));
    for (const r of [u.startRoot, u.endRoot])
      discEdges.set(r, (discEdges.get(r) ?? /* @__PURE__ */ new Set()).add(u.key));
  }
  const sroot = /* @__PURE__ */ new Map(), sfind = (x) => {
    let r = x;
    while (sroot.has(r) && sroot.get(r) !== r)
      r = sroot.get(r);
    return r;
  };
  for (const keys of discEdges.values()) {
    const [a, b] = [...keys];
    if (keys.size !== 2 || !a.startsWith("s") || !b.startsWith("s"))
      continue;
    const ra = sfind(a), rb = sfind(b);
    if (ra === rb)
      continue;
    sroot.set(ra, rb);
    const A = struts.get(ra), B = struts.get(rb);
    struts.set(rb, { p: B.p, lo: Math.min(A.lo, B.lo), hi: Math.max(A.hi, B.hi) });
  }
  for (const f of faces)
    for (const l of f.loops) {
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
  for (const f of faces)
    for (const l of f.loops)
      for (const u of l.uses)
        if (u.tag === "strut") {
          const st = struts.get(u.key), w = f.wall, v = (level) => (levels[level] - w.za) / (w.zb - w.za);
          u.pcurve = pc([u.u, v(st.lo), 0], [u.u, v(st.hi), 0]);
        }
  const finalUses = /* @__PURE__ */ new Map();
  for (const f of faces)
    for (const l of f.loops)
      for (const u of l.uses)
        finalUses.set(u.key, [...finalUses.get(u.key) ?? [], u]);
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
  const edgeBase = (list3) => [...new Set(list3.map((u) => faces[u.face].name))].sort().join("|");
  for (const [key, list3] of finalUses) {
    const fwd = list3.find((u) => u.sense === "forward"), eid = `${id2}_e${edges.length}`;
    edgeIds.set(key, eid);
    let curve;
    if (key.startsWith("s")) {
      const s = struts.get(key);
      curve = lineCurve(eid, [P[s.p][0], P[s.p][1], levels[s.lo]], [P[s.p][0], P[s.p][1], levels[s.hi]]);
    } else {
      const [k, level] = key.slice(1).replace(/[ab]$/, "").split("_").map(Number);
      curve = curveOf(k, levels[level], eid);
    }
    edges.push({ id: eid, curve, vertices: [vertexOf(fwd.start, fwd.startRoot), vertexOf(fwd.end, fwd.endRoot)], name: edgeBase(list3) });
  }
  nameEdges(edges);
  const extent = P.reduce((m, q2) => Math.max(m, Math.abs(q2[0]), Math.abs(q2[1])), 1), rho = Math.max(1e-4 * extent, 1e3 * tol);
  for (const f of faces) {
    if (!f.cap)
      continue;
    const at3 = /* @__PURE__ */ new Map();
    for (const l of f.loops)
      for (const u of l.uses) {
        const p = Number(u.start.split("_")[0]), ids2 = at3.get(p) ?? /* @__PURE__ */ new Set();
        ids2.add(vertexOf(u.start, u.startRoot));
        at3.set(p, ids2);
      }
    for (const [p, ids2] of at3)
      if (ids2.size > 1 && materialAround(f.cap.region, P[p], rho) > 0.5)
        throw new BrepError("GEOMETRY", `the solid touches itself along the vertical line at (${P[p].map((x) => +x.toFixed(4))}): two of its walls meet there from outside each other`);
  }
  const froot = faces.map((_, i) => i), ff = (i) => {
    while (froot[i] !== i)
      i = froot[i] = froot[froot[i]];
    return i;
  };
  for (const list3 of finalUses.values())
    froot[ff(list3[0].face)] = ff(list3[1].face);
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
      if (crossings % 2 === 1 && (best < 0 || b.outer.volume < bodies[best].outer.volume))
        best = k;
    });
    if (best < 0)
      throw new BrepError("TOPOLOGY", "a cavity shell lies in no body");
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
  for (const f of faces)
    groups.set(f.base, [...groups.get(f.base) ?? [], f]);
  for (const [base, list3] of groups) {
    if (list3.length === 1) {
      list3[0].name = base;
      continue;
    }
    [...list3].sort((a, b) => byPosition(a.key, b.key)).forEach((f, k) => {
      f.name = `${base}#${k + 1}`;
    });
  }
}
function nameEdges(edges) {
  const groups = /* @__PURE__ */ new Map();
  for (const e of edges)
    groups.set(e.name, [...groups.get(e.name) ?? [], e]);
  const mid = (c) => {
    const p = c.controlPoints, a = p[0], b = p[p.length - 1], m = p[Math.floor(p.length / 2)];
    return [(a[0] + b[0] + m[0]) / 3, (a[1] + b[1] + m[1]) / 3, (a[2] + b[2] + m[2]) / 3];
  };
  for (const [base, list3] of groups)
    if (list3.length > 1)
      [...list3].sort((a, b) => byPosition(mid(a.curve), mid(b.curve))).forEach((e, k) => {
        e.name = `${base}#${k + 1}`;
      });
}
function materialAround(region, p, rho) {
  let n = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k + 0.5) * Math.PI / 8;
    if (inRegion([p[0] + rho * Math.cos(a), p[1] + rho * Math.sin(a)], region))
      n++;
  }
  return n / 16;
}
function interiorPoint(region) {
  const p = regionInteriorPoint(region);
  if (!p)
    throw new BrepError("GEOMETRY", "a region has no interior");
  return p;
}

// packages/barocss-cad/dist/brep/polyhedral-boolean.js
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
  if (!Number.isFinite(v))
    throw new BrepError("INPUT", "finite coordinates required");
  const { m, k } = binary64Dyadic(v);
  return q(m, 1n << BigInt(k));
}
var num = (a) => Number(a.n) / Number(a.d);
var vnum = (a) => [num(a[0]), num(a[1]), num(a[2])];
var RAYS = [[0.5773, 0.3419, 0.7413], [-0.2183, 0.8817, 0.4127], [0.6631, -0.5279, 0.3011], [-0.4421, -0.3137, 0.8401], [0.1931, 0.7349, -0.6503]].map((r) => r.map(qf));
var RAYS_F = RAYS.map(vnum);

// packages/barocss-cad/dist/brep/analytic-boolean.js
var TWO_PI2 = 2 * Math.PI;
var CACHE_BITS = 16;
var cacheX = new Float64Array(1 << CACHE_BITS);
var cacheId = new Int32Array(1 << CACHE_BITS);
var cacheP = new Array(1 << CACHE_BITS);
var bitsF = new Float64Array(1);
var bitsU = new Uint32Array(bitsF.buffer);
var RAYS2 = [[0.5377, 0.3138, 0.7832], [-0.2961, 0.8573, 0.4213], [0.6993, -0.5126, 0.4982], [-0.4436, -0.3714, 0.8155], [0.1172, 0.9563, -0.2677], [0.8811, 0.2219, -0.4175]].map((v) => unit(v));

// packages/barocss-cad/dist/machine/gear-bevel.js
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

// packages/barocss-cad/dist/machine/gear-worm.js
var ALPHA_N = 20 * Math.PI / 180;

// packages/barocss-cad/dist/internal/native-si-mass-state.js
var bases = /* @__PURE__ */ new WeakMap();
var results = /* @__PURE__ */ new WeakMap();
function recordIntegralMass(props, density, central) {
  bases.set(props, { kind: "integrals", density, central: Object.freeze([...central]) });
}
function transferNativeMassBasis(from, to) {
  const basis3 = bases.get(from);
  if (basis3)
    bases.set(to, basis3);
}
function unsupportedNativeMass(props, reason) {
  bases.set(props, { kind: "unsupported", reason });
  return props;
}
function readNativeSIInertia(props) {
  const cached = results.get(props);
  if (cached)
    return cached;
  const basis3 = bases.get(props);
  if (!basis3 || basis3.kind === "unsupported")
    return { ok: false, code: "NATIVE_SI_PROVENANCE_UNAVAILABLE", reason: basis3?.reason ?? "untracked" };
  const [xx, yy, zz, xy, xz, yz] = basis3.central;
  const k = basis3.density * 1e3 * 1e-15;
  const inertia3 = Object.freeze([
    Object.freeze([k * (yy + zz), -k * xy, -k * xz]),
    Object.freeze([-k * xy, k * (xx + zz), -k * yz]),
    Object.freeze([-k * xz, -k * yz, k * (xx + yy)])
  ]);
  const result = Object.freeze({ ok: true, inertia: inertia3, density: basis3.density });
  results.set(props, result);
  return result;
}

// packages/barocss-cad/dist/core/quadrature.js
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
      if (Math.abs(dx) < 1e-16)
        break;
    }
    x.push((1 - t) / 2);
    w.push(1 / ((1 - t * t) * d * d));
  }
  return { x, w };
}

// packages/barocss-cad/dist/brep/brep-mass-quadrature.js
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

// packages/barocss-cad/dist/brep/solid-mass.js
var solidMassError = (detail) => kernelRefusal("solid-mass", "SOLID_MASS", "Mass properties: " + detail);
function solidMassFromIntegrals(I, density, method) {
  if (!(typeof density === "number" && Number.isFinite(density) && density > 0))
    throw solidMassError("a positive finite density is required");
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I;
  if (!(V > 0))
    throw solidMassError("the solid has no positive volume");
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

// packages/barocss-cad/dist/brep/brep-transform.js
function transformBrep(brep, map, rename) {
  const m = map.matrix, t = map.offset ?? [0, 0, 0];
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (!(Number.isFinite(det) && det !== 0))
    throw new BrepError("INPUT", "an invertible finite affine map is required");
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

// packages/barocss-cad/dist/features/profile-relief.js
var ROUND = 64 * Number.EPSILON;

// packages/barocss-cad/dist/features/cylindrical-wrap-map.js
var SCALE = 1n << 128n;
var LIMITS = Object.freeze({ intervals: 256, depth: 8, taylorTerms: 24, intervalBits: 128, work: 1048576, rationalOperations: 2e5, rationalGcdSteps: 2e5, rationalIntegerBits: 8192, fractionCharacters: 5e3, floatSearchStepsPerConversion: 64 });
var CARRIER_LIMITS = Object.freeze({ work: LIMITS.work, rationalOperations: LIMITS.rationalOperations, rationalGcdSteps: LIMITS.rationalGcdSteps, rationalIntegerBits: LIMITS.rationalIntegerBits, fractionCharacters: LIMITS.fractionCharacters, floatSearchStepsPerConversion: LIMITS.floatSearchStepsPerConversion });

// packages/barocss-cad/dist/core/native-d0-bound.js
var SCALE2 = 1n << 128n;
var FAMILY_FLOAT = new DataView(new ArrayBuffer(8));
var FAMILY_MINIMUM = 2 ** -128;

// packages/barocss-cad/dist/features/cylindrical-wrap-chart.js
var CHART_LIMITS = Object.freeze({ operations: 2e5, integerBits: 8192, work: 1048576, curves: 2, nodes: 256, depth: 8 });
var LOOP_CHART_LIMITS = Object.freeze({ ...CHART_LIMITS, curves: 32 });

// packages/barocss-cad/dist/features/cylindrical-wrap-chart-component.js
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

// packages/barocss-cad/dist/features/cylindrical-wrap-side-family.js
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

// packages/barocss-cad/dist/features/cylindrical-wrap-formal-mass.js
var SCALE3 = 1n << 128n;
var MIDPOINT_DENOMINATOR = Number(SCALE3 << 1n);
var MIDPOINT_MINIMUM = 1 / MIDPOINT_DENOMINATOR;
var MIDPOINT_MAXIMUM = Number(1n << 127n);
var ORDER = Object.freeze(["V", "X", "Y", "Z", "XX", "YY", "ZZ", "XY", "XZ", "YZ"]);
var LIMITS2 = Object.freeze({ operations: 2e5, integerBits: 8192, work: 1048576, fractionBits: 128, atanTerms: 24, ratioReductions: 3 });

// packages/barocss-cad/dist/features/cylindrical-wrap-bound-reference.js
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

// packages/barocss-cad/dist/features/cylindrical-wrap-source-walls.js
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

// packages/barocss-cad/dist/features/cylindrical-wrap-reference-mass.js
var SCALE4 = 1n << 128n;
var NEGATIVE_SCALE = -SCALE4;

// packages/barocss-cad/dist/features/cylindrical-wrap-feature.js
var BUDGETS = Object.freeze({
  volume: 1e-8,
  mass: 1e-10,
  centroid: Object.freeze([1e-10, 1e-10, 1e-10]),
  inertia: Object.freeze([1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7])
});

// packages/barocss-cad/dist/exact-proof/exact-binary64-orientation-v1.js
var view2 = new DataView(new ArrayBuffer(8));

// packages/barocss-cad/dist/exact-proof/native-planar-loop-qualification-v1.js
var view3 = new DataView(new ArrayBuffer(8));

// packages/barocss-cad/dist/features/quadratic-cut-arithmetic.js
var FRACTION = (1n << 52n) - 1n;
var HIDDEN = 1n << 52n;

// packages/barocss-cad/dist/io/step-import.js
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

// packages/barocss-cad/dist/features/loft.js
var G3 = gauss(3);
var G42 = gauss(4);
var G6 = gauss(6);
var G24 = gauss(24);

// packages/barocss-cad/dist/machine/cam.js
var MT_A = 8 * Math.PI / (Math.PI + 2);
var W4 = 4 * Math.PI;

// packages/barocss-cad/dist/machine/drive.js
var TAU4 = 2 * Math.PI;

// packages/barocss-cad/dist/machine/spring.js
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
      if (Math.abs(step) < 1e-16)
        break;
    }
    x.push(t);
    w.push(2 / ((1 - t * t) * dp * dp));
  }
  return { x, w };
})();

// packages/barocss-cad/dist/machine/thread-helical.js
var HANDLE = 4 / 3 * Math.tan(Math.PI / 8);

// packages/barocss-cad/dist/blend/edge-finish.js
var TAU5 = 2 * Math.PI;

// packages/barocss-cad/dist/features/section-offset.js
var TAU6 = 2 * Math.PI;

// packages/barocss-cad/dist/blend/general-shell.js
var TAU7 = 2 * Math.PI;

// packages/barocss-cad/dist/part/part-shell.js
function brepBodies(b) {
  return b.bodies.map((body) => {
    const shells = new Set(body.shells), faces = b.faces.filter((x) => shells.has(x.shell)), faceIds = new Set(faces.map((x) => x.id));
    const loops = b.loops.filter((l) => faceIds.has(l.face)), loopIds = new Set(loops.map((l) => l.id));
    const coedges = b.coedges.filter((c) => loopIds.has(c.loop)), edgeIds = new Set(coedges.map((c) => c.edge));
    const edges = b.edges.filter((e) => edgeIds.has(e.id)), vertexIds = new Set(edges.flatMap((e) => e.vertices));
    return { ...b, bodies: [body], shells: b.shells.filter((x) => shells.has(x.id)), faces, loops, coedges, edges, vertices: b.vertices.filter((v) => vertexIds.has(v.id)) };
  });
}

// packages/barocss-cad/dist/part/part-expect.js
var SAME_DIRECTION = Math.cos(Math.PI / 180);

// packages/barocss-cad/dist/frame-sheet/frame-section.js
var SPANDREL = 1 - Math.PI / 4;

// packages/barocss-cad/dist/core/error-codes.js
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

// packages/barocss-cad/dist/part/part-model.js
var CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, stepBytes: 32 << 20, stepTessellatedBytes: 128 << 20, length: 1e4, meshTriangles: 2e6, planarMeshTriangles: 1e5, subdVertices: 1e5 });
function stepSizeProblem(text3) {
  const MiB = (n) => `${n / 2 ** 20} MiB`;
  if (text3.length > CadPartLimits.stepTessellatedBytes)
    return `the STEP file is larger than ${MiB(CadPartLimits.stepTessellatedBytes)}; a mesh that large opens from a .bcad file (its arrays kept as binary)`;
  if (text3.length <= CadPartLimits.stepBytes)
    return null;
  const other = text3.length - stepTessellatedChars(text3);
  return other > CadPartLimits.stepBytes ? `the STEP file is larger than ${MiB(CadPartLimits.stepBytes)} outside its meshes (${(other / 2 ** 20).toFixed(1)} MiB); only tessellated meshes may take it up to ${MiB(CadPartLimits.stepTessellatedBytes)}` : null;
}
function splitBodies(b) {
  if (b.bodies.length <= 1)
    return [b];
  return b.bodies.map((body) => {
    const shells = b.shells.filter((x) => x.body === body.id), faceIds = new Set(shells.flatMap((x) => x.faces)), faces = b.faces.filter((f) => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap((f) => f.loops)), loops = b.loops.filter((l) => loopIds.has(l.id)), coIds = new Set(loops.flatMap((l) => l.coedges));
    const coedges = b.coedges.filter((c) => coIds.has(c.id)), edgeIds = new Set(coedges.map((c) => c.edge)), edges = b.edges.filter((e) => edgeIds.has(e.id)), vIds = new Set(edges.flatMap((e) => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter((v) => vIds.has(v.id)) };
  });
}
var brepOf = (part2, id2) => part2.brep ??= part2.solid.kind === "upright" ? brepFromPrismatic(part2.solid.solid, { id: id2 }) : part2.solid.brep;
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isMeshArray = (v) => v instanceof Float64Array || v instanceof Float32Array || v instanceof Uint32Array || v instanceof Int32Array;
var checkedArrays = /* @__PURE__ */ new WeakMap();
function meshArrayOk(v, what, nv = 0) {
  if (!Array.isArray(v) && !isMeshArray(v))
    return false;
  const a = v, key = `${what}:${nv}`;
  if (checkedArrays.get(a) === key)
    return true;
  if (a.length % 3)
    return false;
  if (what === "positions") {
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length)
        return false;
    }
  } else {
    if (a.length / 3 > CadPartLimits.meshTriangles)
      return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (!Number.isInteger(x) || x < 0 || x >= nv)
        return false;
    }
  }
  checkedArrays.set(a, key);
  return true;
}
var LONG_TEXT = 1 << 16;
function frameOf(plane, xyz, fail2) {
  if (!isRecord(plane))
    fail2("INPUT", "plane must be { origin, normal, xAxis }");
  const direction = (v, what) => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every((c) => typeof c === "number" && Number.isFinite(c)))
      fail2("INPUT", `plane ${what} must be [x, y, z]`);
    const l = Math.hypot(...v);
    if (!(l > 1e-12))
      fail2("INPUT", `plane ${what} must not be zero`);
    return v.map((c) => c / l);
  };
  const snap = (v) => v.map((c) => Math.abs(c) < 1e-12 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-12 ? Math.sign(c) : c);
  const n = snap(direction(plane.normal, "normal")), x0 = direction(plane.xAxis, "xAxis");
  if (Math.abs(dot3(x0, n)) > 1e-9)
    fail2("INPUT", "plane xAxis must be perpendicular to its normal");
  const x = snap(unit(sub3(x0, scale3(n, dot3(x0, n))))), y = snap(cross3(n, x));
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
  let size = 1;
  for (let k = 0; k < P.length; k++)
    size = Math.max(size, Math.abs(P[k]));
  const { P: welded, remap } = weldVertices(P, nv, 1e-9 * size);
  for (let k = 0; k < I.length; k++)
    I[k] = remap[I[k]];
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
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        sum += R[3 * i + a] * I[a][b] * R[3 * j + b];
    return sum * k5;
  }));
  const moved = unsupportedNativeMass({
    volume: p.volume * k ** 3,
    mass: p.mass * k ** 3,
    method: p.method,
    inertia: RIRt,
    centroid: [0, 1, 2].map((i) => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i])
  }, "transformed");
  if (preserveNativeSI && m.every((x, i) => x === (i === 0 || i === 4 || i === 8 ? 1 : 0)) && readNativeSIInertia(p).ok)
    transferNativeMassBasis(p, moved);
  return moved;
}
var HELPERS = Object.freeze({ isRecord, brepOf, CadPartLimits, stepSizeProblem, splitBodies, meshArrayOk, facetBody, facetTriangles, brepBodies, frameOf, framed, placed });

// packages/barocss-cad/dist/features/library.js
var DEG = Math.PI / 180;

// packages/barocss-physics/dist/cad-proxy-validation.js
function proxyError(code2, message) {
  throw new PhysicsError(code2, message);
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

// packages/barocss-physics/dist/cad-proxy-admission.js
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
  if (input.sourceVersion !== 0)
    proxyError("INVALID_CONFIG", "CAD proxy requires sourceVersion 0");
  if (typeof input.sourceRevision !== "string" || !ID2.test(input.sourceRevision)) {
    proxyError("INVALID_CONFIG", "invalid source revision");
  }
  if (typeof input.modelId !== "string" || !CAD_ID.test(input.modelId) || typeof input.surfaceId !== "string" || !CAD_ID.test(input.surfaceId)) {
    proxyError("INVALID_CONFIG", "invalid native model or Surface ID");
  }
  if (input.kind !== "dynamic" && input.kind !== "static")
    proxyError("INVALID_CONFIG", "invalid proxy body kind");
  if (input.proxy !== "sphere" && input.proxy !== "box")
    proxyError("INVALID_CONFIG", "invalid proxy shape");
  if (input.kind === "static" && (Object.hasOwn(input, "massKg") || Object.hasOwn(input, "initialOffsetM"))) {
    proxyError("INVALID_CONFIG", "static proxy cannot declare mass or offset");
  }
  if (input.kind === "dynamic")
    proxyFinite(input.massKg, 1e-6, 1e6, "massKg");
  if (input.proxy === "sphere" && Object.hasOwn(input, "minimumHalfExtentM")) {
    proxyError("INVALID_CONFIG", "sphere proxy cannot declare minimumHalfExtentM");
  }
  if (Object.hasOwn(input, "minimumHalfExtentM")) {
    proxyFinite(input.minimumHalfExtentM, 1e-4, 1e3, "minimumHalfExtentM");
  }
  if (Object.hasOwn(input, "initialOffsetM"))
    proxyVector(input.initialOffsetM, -1e3, 1e3, "initialOffsetM");
  return input;
}
function controlBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const row of points)
    for (const point of row)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
  if ([...min, ...max].some((value) => !Number.isFinite(value))) {
    proxyError("INVALID_CONFIG", "native Surface has invalid control bounds");
  }
  return { min, max };
}
function admitCadSurfaceProxy(source, request) {
  if (typeof source !== "string" || source.length < 1 || source.length > 65536) {
    proxyError("INVALID_CONFIG", "CAD source length must be 1..65536 characters");
  }
  const input = requestValues(request);
  const bodyId = `${input.kind === "dynamic" ? "part" : "fixture"}:${input.modelId}.${input.surfaceId}`;
  if (!ID2.test(bodyId))
    proxyError("INVALID_CONFIG", "qualified Physics body ID exceeds bounds");
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok)
    proxyError("INVALID_CONFIG", `CAD source refused: ${compiled.diagnostics[0]?.code ?? "unknown"}`);
  if (compiled.model.name !== input.modelId)
    proxyError("INVALID_CONFIG", "native model ID differs from selection");
  const native2 = compiled.model.objects.find((object) => object.id === input.surfaceId);
  if (!native2 || native2.kind !== "surface")
    proxyError("INVALID_CONFIG", "selected native object is not a Surface");
  const sourceBoundsMM = controlBounds(native2.controlPoints);
  const sourceCenterMM = sourceBoundsMM.min.map((low, axis) => (low + sourceBoundsMM.max[axis]) / 2);
  const halfSpanM = sourceBoundsMM.min.map((low, axis) => (sourceBoundsMM.max[axis] - low) / 2e3);
  const centerM = sourceCenterMM.map((value) => value / 1e3);
  const positionM = add2(centerM, input.initialOffsetM ?? [0, 0, 0]);
  proxyVector(positionM, -1e4, 1e4, "proxy positionM");
  const shape3 = input.proxy === "sphere" ? { kind: "sphere", radiusM: Math.max(1e-4, Math.hypot(...halfSpanM)) } : { kind: "box", halfExtentsM: halfSpanM.map((value) => Math.max(value, input.minimumHalfExtentM ?? 1e-4)) };
  if (shape3.kind === "sphere")
    proxyFinite(shape3.radiusM, 1e-4, 1e3, "proxy radiusM");
  else
    shape3.halfExtentsM.forEach((value, axis) => proxyFinite(value, 1e-4, 1e3, `proxy halfExtentsM[${axis}]`));
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
  const collider2 = {
    id: `collider:${digest2(bodyId).slice(7, 55)}`,
    bodyId,
    geometry: shape3,
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false,
    ccd: false,
    filter: { categoryBits: 1, maskBits: 65535 }
  };
  const lossLabel = input.proxy === "sphere" ? "Control-net enclosing sphere; native Surface geometry is not the collision shape." : "Control-net axis-aligned box with minimum thickness; native Surface geometry is not the collision shape.";
  const binding = {
    id: `source:${digest2(bodyId).slice(7, 55)}`,
    sourceRevision: input.sourceRevision,
    sourceDigest: digest2(source),
    modelId: input.modelId,
    occurrenceId: input.surfaceId,
    entityIds: [bodyId, collider2.id],
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
    collider: collider2,
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
  if (collider2.geometry.kind === "box")
    Object.freeze(collider2.geometry.halfExtentsM);
  Object.freeze(collider2.geometry);
  Object.freeze(collider2.local.positionM);
  Object.freeze(collider2.local.orientationXYZW);
  Object.freeze(collider2.local);
  Object.freeze(collider2.material.friction);
  Object.freeze(collider2.material);
  Object.freeze(collider2.filter);
  Object.freeze(collider2);
  Object.freeze(binding.entityIds);
  Object.freeze(binding.approximation);
  Object.freeze(binding);
  Object.freeze(body);
  return Object.freeze(admitted);
}
function assertCadProxyCurrent(proxy, currentSource, currentRevision) {
  if (currentSource !== proxy.sourceSnapshot || currentRevision !== proxy.sourceRevision) {
    proxyError("STALE_SOURCE", "CAD proxy source changed; explicit re-admission is required");
  }
}

// packages/barocss-physics/dist/cad-proxy-pose.js
function cadProxyPose(proxy, body, currentSource, currentRevision) {
  assertCadProxyCurrent(proxy, currentSource, currentRevision);
  if (!body || body.id !== proxy.bodyId || !Array.isArray(body.positionM) || body.positionM.length !== 3 || body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e4) || !Array.isArray(body.orientationXYZW) || body.orientationXYZW.length !== 4 || body.orientationXYZW.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body.orientationXYZW) - 1) > 1e-9) {
    proxyError("INVALID_CONFIG", "Physics body pose differs from CAD proxy binding");
  }
  const positionMM = body.positionM.map((value) => value * 1e3);
  const translation = sub2(positionMM, rotate4([body.orientationXYZW[0], body.orientationXYZW[1], body.orientationXYZW[2], body.orientationXYZW[3]], proxy.sourceCenterMM));
  if (translation.some((value) => !Number.isFinite(value)))
    proxyError("NUMERIC_LIMIT", "unsafe CAD proxy pose");
  return { targetId: proxy.bodyId, translation, rotation: [...body.orientationXYZW] };
}

// examples/physics-model-input/model.mjs
var identity3 = () => ({ positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] });
var material = (value = {}) => ({
  restitution: value.restitution ?? 0,
  friction: value.friction ?? { static: 0, dynamic: 0 }
});
function collider(id2, geometry, options2) {
  return {
    id: options2.colliderId ?? `${id2}.shape`,
    bodyId: id2,
    geometry,
    local: identity3(),
    material: material(options2),
    sensor: options2.sensor ?? false,
    ccd: options2.ccd ?? false,
    filter: options2.filter ?? { categoryBits: 1, maskBits: 65535 }
  };
}
function dynamicPart(id2, geometry, initial, massKg = 1, options2 = {}) {
  return {
    body: {
      id: id2,
      kind: "dynamic",
      massKg,
      inertia: options2.inertia ?? { kind: "primitive-com", about: "com", frame: "body-local" },
      initial: {
        positionM: initial.positionM,
        orientationXYZW: initial.orientationXYZW ?? [0, 0, 0, 1],
        velocityMps: initial.velocityMps ?? [0, 0, 0],
        angularVelocityRadps: initial.angularVelocityRadps ?? [0, 0, 0]
      }
    },
    collider: collider(id2, geometry, options2)
  };
}
function staticPart(id2, geometry, initial, options2 = {}) {
  return { body: { id: id2, kind: "static", initial: {
    positionM: initial.positionM,
    orientationXYZW: initial.orientationXYZW ?? [0, 0, 0, 1]
  } }, collider: collider(id2, geometry, options2) };
}
function makeModel({ revision = "example1", gravityMps2 = [0, -9.81, 0], parts = [], joints = [], sourceBindings = [] }) {
  return {
    format: "barocss-physics-model",
    version: 1,
    revision,
    frame: { id: "world", basis: "right-handed-xyz", rotation: "local-to-world-xyzw" },
    units: { length: "m", mass: "kg", time: "s", angle: "rad" },
    gravityMps2,
    bodies: parts.map((part2) => part2.body),
    colliders: parts.map((part2) => part2.collider),
    joints,
    cloths: [],
    fluids: [],
    sourceBindings
  };
}

// examples/physics-world-p2-2276/public.test.mjs
var { createPhysicsRecorder: createPhysicsRecorder2, restorePhysicsRecording: restorePhysicsRecording2, serializePhysicsRecording: serializePhysicsRecording2, deserializePhysicsRecording: deserializePhysicsRecording2 } = replay_exports;
var dt = 1 / 120;
var options = { profile: "rigid-discrete-v1", fixedStepSeconds: dt, broadPhase: "direct" };
var part = (id2 = "ball", positionM = [0, 2, 0]) => dynamicPart(id2, { kind: "sphere", radiusM: 0.1 }, { positionM });
var model = (parts = [part()], gravityMps2 = [0, 0, 0]) => makeModel({ parts, gravityMps2 });
var code = (c) => (e) => e instanceof PhysicsError && e.code === c;
var expected = (w, m, o = options) => ({ model: m, options: o, providerDigest: w.getState().identity.providerDigest });
var near2 = (a, b, t) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= t, `${a} vs ${b} at ${t}`);
var clone = structuredClone;
function open(m = model(), o = options) {
  const world = createPhysicsWorld(m, o);
  return { world, recorder: createPhysicsRecorder2(world) };
}
function close(pair2) {
  pair2.recorder.dispose();
  pair2.world.dispose();
}
test("one attached owner; cached direct step cannot bypass; read/query and detached lifecycle", () => {
  for (const name of ["createPhysicsScene", "createPhysicsReplaySession", "restorePhysicsReplaySession", "serializePhysicsSnapshot", "deserializePhysicsSnapshot"]) assert.equal(replay_exports[name], void 0);
  const m = model(), w = createPhysicsWorld(m, options), cached = w.step, r = createPhysicsRecorder2(w);
  let inspected = 0;
  const malicious = new Proxy([], { get() {
    inspected++;
    throw Error("must not inspect");
  } });
  assert.throws(() => cached(malicious), code("WORLD_OWNED"));
  assert.equal(inspected, 0);
  assert.throws(() => createPhysicsRecorder2(w), code("WORLD_OWNED"));
  assert.equal(w.getModel().revision, m.revision);
  assert.equal(w.getState().stepIndex, 0);
  assert.deepEqual(w.query({ kind: "overlap-sphere", centerM: [0, 2, 0], radiusM: 0.2, includeSensors: true }).colliderIds, ["ball.shape"]);
  assert.deepEqual(r.step([{ kind: "impulse", bodyId: "ball", impulseNs: [1, 0, 0] }]), w.getState());
  r.dispose();
  r.dispose();
  assert.equal(w.step().stepIndex, 2);
  for (const action of [() => r.step(), () => r.getState(), () => r.saveRecording()]) assert.throws(action, code("DISPOSED"));
  assert.throws(() => createPhysicsRecorder2(w), code("INVALID_SNAPSHOT"));
  w.dispose();
  w.dispose();
  const fresh = createPhysicsWorld(m, options), r0 = createPhysicsRecorder2(fresh);
  r0.dispose();
  const r1 = createPhysicsRecorder2(fresh);
  fresh.dispose();
  assert.throws(() => r1.step(), code("DISPOSED"));
  r1.dispose();
  r1.dispose();
  assert.throws(() => createPhysicsRecorder2({}), code("INVALID_SNAPSHOT"));
});
test("accepted log/state are copied; invalid and numerical failures preserve continuation", () => {
  const m = model(), a = open(m), b = open(m);
  try {
    const commands = [{ kind: "force", bodyId: "ball", forceN: [2, 0, 0] }];
    const returned = a.recorder.step(commands);
    b.recorder.step(clone(commands));
    commands[0].forceN[0] = 999;
    returned.bodies[0].positionM[0] = 123;
    const before = a.recorder.saveRecording();
    const edited = a.recorder.saveRecording();
    edited.frames[0].commands[0].forceN[0] = -999;
    edited.model.gravityMps2[0] = 99;
    for (const bad of [[{ kind: "impulse", bodyId: "missing", impulseNs: [1, 0, 0] }], dt, [{ kind: "impulse", bodyId: "ball", impulseNs: [1e5, 0, 0] }]]) {
      assert.throws(() => a.recorder.step(bad), (e) => e instanceof PhysicsError && ["INVALID_COMMAND", "NUMERIC_LIMIT"].includes(e.code));
      assert.deepEqual(a.recorder.saveRecording(), before);
      assert.deepEqual(a.world.getState(), b.world.getState());
    }
    for (let i = 0; i < 20; i++) assert.deepEqual(a.recorder.step(), b.recorder.step());
  } finally {
    close(a);
    close(b);
  }
});
test("command reflection cannot reenter any lifecycle operation or diverge applied and recorded values", () => {
  const m = model(), a = open(m);
  let nested = [];
  const command = { kind: "impulse", bodyId: "ball", impulseNs: [2, 0, 0] };
  let inspections = 0;
  const proxy = new Proxy(command, { getOwnPropertyDescriptor(target, key) {
    inspections++;
    if (key === "impulseNs") return { value: [2 + inspections, 0, 0], enumerable: true, configurable: true, writable: true };
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  try {
    const state = a.recorder.step([proxy]);
    const log = a.recorder.saveRecording();
    near2(state.bodies[0].velocityMps[0], log.frames[0].commands[0].impulseNs[0], 1e-12);
    const restored = restorePhysicsRecording2(log, expected(a.world, m));
    try {
      assert.deepEqual(restored.world.getState(), state);
    } finally {
      close(restored);
    }
    const guarded = new Proxy({ kind: "force", bodyId: "ball", forceN: [0, 0, 0] }, { getPrototypeOf(target) {
      for (const action of [() => a.world.step(), () => a.world.getState(), () => a.world.query(null), () => a.world.dispose(), () => a.recorder.dispose(), () => a.recorder.saveRecording(), () => a.recorder.step(), () => createPhysicsRecorder2(a.world)]) {
        try {
          action();
          nested.push("MISSED");
        } catch (e) {
          nested.push(e.code);
        }
      }
      return Reflect.getPrototypeOf(target);
    } });
    a.recorder.step([guarded]);
    assert.ok(nested.length >= 8);
    assert.ok(nested.every((c) => c === "REENTRANT_CALL"), JSON.stringify(nested));
  } finally {
    close(a);
  }
});
test("frame and aggregate command budgets refuse without advancing or changing log", () => {
  const a = open();
  try {
    for (let i = 0; i < 512; i++) a.recorder.step();
    const before = a.recorder.saveRecording();
    assert.throws(() => a.recorder.step(), code("WORLD_LIMIT"));
    assert.deepEqual(a.recorder.saveRecording(), before);
  } finally {
    close(a);
  }
  const parts = Array.from({ length: 16 }, (_, i) => part("b" + i, [i * 0.5, 2, 0])), b = open(model(parts));
  const commands = parts.flatMap((p) => [{ kind: "force", bodyId: p.body.id, forceN: [0, 0, 0] }, { kind: "impulse", bodyId: p.body.id, impulseNs: [0, 0, 0] }, { kind: "torque", bodyId: p.body.id, torqueNm: [0, 0, 0] }, { kind: "angularImpulse", bodyId: p.body.id, angularImpulseNms: [0, 0, 0] }]);
  try {
    for (let i = 0; i < 64; i++) b.recorder.step(commands);
    const before = b.recorder.saveRecording();
    assert.equal(before.frames.reduce((n, f) => n + f.commands.length, 0), 4096);
    assert.throws(() => b.recorder.step([commands[0]]), code("WORLD_LIMIT"));
    assert.deepEqual(b.recorder.saveRecording(), before);
  } finally {
    close(b);
  }
});
test("recording byte/model budgets fail before ownership or accepted physical commit", () => {
  const m = model();
  m.sourceBindings = Array.from({ length: 32 }, (_, i) => ({ id: "s" + i, sourceRevision: "r", sourceDigest: "sha256:" + "1".repeat(64), modelId: "m", occurrenceId: "o", entityIds: ["ball"], approximation: { kind: "control-net-box", lossLabel: "x".repeat(4096) } }));
  const w = createPhysicsWorld(m, options);
  try {
    assert.throws(() => createPhysicsRecorder2(w), code("WORLD_LIMIT"));
    assert.equal(w.step().stepIndex, 1);
  } finally {
    w.dispose();
  }
});
for (const profile of ["rigid-persistent-box-v1", "rigid-large-v1"]) test(profile + " restores contact/cache/events/sleep continuation at unchanged gates", () => {
  const persistent = profile === "rigid-persistent-box-v1";
  const parts = persistent ? [dynamicPart("box", { kind: "box", halfExtentsM: [0.25, 0.25, 0.25] }, { positionM: [0, 0.25, 0] }, 1, { friction: { static: 0.5, dynamic: 0.3 } })] : Array.from({ length: 6 }, (_, i) => part("b" + i, [i * 0.4, 0.1, 0]));
  parts.push(staticPart("floor", { kind: "box", halfExtentsM: [5, 0.25, 5] }, { positionM: [0, -0.25, 0] }, { friction: { static: 0.5, dynamic: 0.3 } }));
  const m = model(parts, [0, -9.81, 0]), o = { profile, fixedStepSeconds: dt, broadPhase: persistent ? "direct" : "aabb" }, a = open(m, o);
  try {
    for (let i = 0; i < (persistent ? 24 : 180); i++) a.recorder.step();
    const saved = a.recorder.saveRecording();
    const b = restorePhysicsRecording2(saved, expected(a.world, m, o));
    try {
      assert.deepEqual(b.world.getState(), a.world.getState());
      for (let i = 0; i < 20; i++) {
        const commands = i === 0 ? [{ kind: "impulse", bodyId: persistent ? "box" : "b0", impulseNs: [0.01, 0, 0] }] : [];
        assert.deepEqual(b.recorder.step(commands), a.recorder.step(commands));
      }
      assert.throws(() => b.world.step(), code("WORLD_OWNED"));
    } finally {
      close(b);
    }
    console.log(JSON.stringify({ profile, frames: saved.frames.length, continued: 20, sleeping: saved.finalState.bodies.filter((b2) => b2.sleeping).length, contacts: saved.finalState.contacts.length, scope: "exact continuation; no stable-stack qualification" }));
  } finally {
    close(a);
  }
});
test("wire signed zero and frozen canonical bytes match independent SHA; old wire and malformed bytes refuse", () => {
  const m = model([part("ball", [-0, 2, 0])], [-0, 0, 0]), a = open(m);
  try {
    const initial = deserializePhysicsRecording2(serializePhysicsRecording2(a.recorder.saveRecording()));
    assert.ok(Object.is(initial.finalState.bodies[0].positionM[0], -0));
    a.recorder.step([{ kind: "force", bodyId: "ball", forceN: [-0, 0, 0] }]);
    const saved = a.recorder.saveRecording(), bytes = serializePhysicsRecording2(saved), decoded = deserializePhysicsRecording2(bytes);
    assert.equal(new TextDecoder().decode(bytes.subarray(0, 8)), "BCPHREC1");
    assert.ok(Object.is(decoded.model.gravityMps2[0], -0));
    assert.ok(Object.is(decoded.model.bodies[0].initial.positionM[0], -0));
    assert.ok(Object.is(decoded.frames[0].commands[0].forceN[0], -0));
    assert.deepEqual(decoded, saved);
    for (const bad of [bytes.subarray(0, 12), new Uint8Array([...bytes, 0]), new TextEncoder().encode(JSON.stringify(saved)), new Uint8Array([...new TextEncoder().encode("BCPHSNP1"), ...bytes.subarray(8)]), new Uint8Array(1024 * 1024 + 1), new Uint8Array([...bytes.subarray(0, 8), 255])]) assert.throws(() => deserializePhysicsRecording2(bad), code("INVALID_SNAPSHOT"));
    const vectors = JSON.parse(readFileSync(new URL("../../packages/barocss-physics/design/p0/encoding-vectors.json", "file:///Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-world-p2-2276/public.test.mjs")));
    const values = [0, -0, 1, "\xB5", [0, -0], [-0, 0], { b: 1, a: 0 }];
    for (let i = 0; i < values.length; i++) {
      const encoded2 = canonicalEncode2(values[i]);
      assert.equal(Buffer.from(encoded2).toString("hex"), vectors.vectors[i].encodedHex);
      assert.equal(sha2562(encoded2), vectors.vectors[i].expectedSha256);
    }
    const encoded = canonicalEncode2(saved);
    assert.equal(sha2562(encoded), "sha256:" + createHash("sha256").update(encoded).digest("hex"));
  } finally {
    close(a);
  }
});
test("complete shape refusal precedes stale identity; damage never mutates the source World/log", () => {
  const m = model(), a = open(m);
  try {
    for (let i = 0; i < 12; i++) a.recorder.step();
    const saved = a.recorder.saveRecording(), exp = expected(a.world, m), before = a.world.getState();
    for (const mutate of [(r) => r.frames[0].stepIndex = 2, (r) => r.frames[0].commands = [{ kind: "force", bodyId: "unknown", forceN: [0, 0, 0] }], (r) => r.finalState.contacts = [{ bodyAId: "ball" }], (r) => r.finalState.bodies[0].positionM[0] = NaN, (r) => r.finalState.stepIndex = 99, (r) => r.extra = true]) {
      const damaged2 = clone(saved);
      mutate(damaged2);
      assert.throws(() => restorePhysicsRecording2(damaged2, { ...exp, providerDigest: "sha256:" + "f".repeat(64) }), code("INVALID_SNAPSHOT"));
      assert.deepEqual(a.world.getState(), before);
      assert.deepEqual(a.recorder.saveRecording(), saved);
    }
    const damaged = clone(saved);
    damaged.finalState.bodies[0].positionM[0] += 1e-4;
    assert.throws(() => restorePhysicsRecording2(damaged, exp), code("INVALID_SNAPSHOT"));
    for (const wrong of [{ ...exp, model: { ...m, revision: "changed" } }, { ...exp, options: { ...options, fixedStepSeconds: 1 / 60 } }, { ...exp, providerDigest: "sha256:" + "f".repeat(64) }]) assert.throws(() => restorePhysicsRecording2(saved, wrong), code("STALE_SNAPSHOT"));
    const stale = clone(saved);
    stale.identity.providerDigest = "sha256:" + "f".repeat(64);
    stale.finalState.identity.providerDigest = stale.identity.providerDigest;
    assert.throws(() => restorePhysicsRecording2(stale, { ...exp, providerDigest: stale.identity.providerDigest }), code("STALE_SNAPSHOT"));
  } finally {
    close(a);
  }
});
test("ballistic independent truth and CAD off-origin/stale source gates remain unchanged", () => {
  const errors = [];
  for (const h of [1 / 60, 1 / 120, 1 / 240]) {
    const a2 = open(model([part()], [0, -9.81, 0]), { ...options, fixedStepSeconds: h });
    try {
      for (let i = 0; i < Math.round(1 / h); i++) a2.recorder.step();
      const b = a2.world.getState().bodies[0];
      errors.push(Math.abs(b.positionM[1] - (2 - 9.81 / 2)));
      near2(b.velocityMps[1], -9.81, 1e-11);
    } finally {
      close(a2);
    }
  }
  assert.ok(errors[0] < 0.083);
  for (let i = 1; i < 3; i++) {
    const r = errors[i - 1] / errors[i];
    assert.ok(r >= 1.99 && r <= 2.01);
  }
  console.log(JSON.stringify({ metric: "ballistic", errorsM: errors, ratios: [errors[0] / errors[1], errors[1] / errors[2]] }));
  const source = `@model units_fixture { version:0; length-unit:mm; @surface #panel {type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-30,40],[20,-30,100]],[[120,10,40],[120,10,100]]]; weights:[[1,1],[1,1]];} }`;
  const proxy = admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision: "cadRev1", modelId: "units_fixture", surfaceId: "panel", kind: "dynamic", proxy: "box", massKg: 1, initialOffsetM: [0.1, 0, 0] });
  proxy.collider.geometry.halfExtentsM.forEach((x, i) => near2(x, [0.05, 0.02, 0.03][i], 1e-9));
  const m = makeModel({ parts: [{ body: proxy.body, collider: proxy.collider }], sourceBindings: [proxy.binding], gravityMps2: [0, 0, 0] }), a = open(m);
  try {
    const body = clone(a.world.getState().bodies[0]);
    body.orientationXYZW = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const pose = cadProxyPose(proxy, body, source, "cadRev1");
    pose.translation.forEach((x, i) => near2(x, [160, -80, 0][i], 1e-6));
    for (const [text3, revision] of [[source + "\n", "cadRev1"], [source, "changed"]]) assert.throws(() => cadProxyPose(proxy, body, text3, revision), code("STALE_SOURCE"));
    const changed = clone(m);
    changed.sourceBindings[0].sourceRevision = "changed";
    assert.throws(() => restorePhysicsRecording2(a.recorder.saveRecording(), { ...expected(a.world, m), model: changed }), code("STALE_SNAPSHOT"));
    console.log(JSON.stringify({ metric: "cad-off-origin", translationMm: pose.translation, gateMm: 1e-6, sourceAndRevisionStaleRefused: true }));
  } finally {
    close(a);
  }
});
