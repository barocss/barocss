// packages/barocss-physics/src/cloth/profile.ts
var CLOTH_STEP_SECONDS = 1 / 120;
var CLOTH_SUBSTEPS = 8;
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

// packages/barocss-physics/src/cloth/topology.ts
function createSheet() {
  const fixture = CLOTH_PROFILE;
  const { size, sideM, heightM, densityKgM2 } = fixture;
  const positions = new Float64Array(size * size * 3);
  const triangles = [];
  const constraints = [];
  const spacing = sideM / (size - 1);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    positions.set(
      [-sideM / 2 + x * spacing, heightM, -sideM / 2 + z * spacing],
      3 * (z * size + x)
    );
    if (x < size - 1 && z < size - 1) {
      const a = z * size + x;
      triangles.push(a, a + size, a + 1, a + 1, a + size, a + size + 1);
    }
  }
  const masses = new Float64Array(size * size);
  const triangleVertexMass = densityKgM2 * spacing ** 2 / 6;
  for (const index of triangles) masses[index] += triangleVertexMass;
  const pins = [0, size - 1];
  const inverseMasses = Float64Array.from(masses, (mass, index) => pins.includes(index) ? 0 : 1 / mass);
  const edge = (a, b, kind) => {
    const rest = Math.hypot(...[0, 1, 2].map((axis) => positions[3 * a + axis] - positions[3 * b + axis]));
    constraints.push({ a, b, rest, kind, lambda: 0 });
  };
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const a = z * size + x;
    if (x + 1 < size) edge(a, a + 1, "stretch");
    if (z + 1 < size) edge(a, a + size, "stretch");
    if (x + 1 < size && z + 1 < size) {
      edge(a, a + size + 1, "shear");
      edge(a + 1, a + size, "shear");
    }
    if (x + 2 < size) edge(a, a + 2, "bend-distance");
    if (z + 2 < size) edge(a, a + 2 * size, "bend-distance");
  }
  return {
    positions,
    restPositions: positions.slice(),
    inverseMasses,
    pins,
    triangles: Uint16Array.from(triangles),
    constraints,
    totalMassKg: masses.reduce((a, b) => a + b, 0)
  };
}

// packages/barocss-physics/src/fluid/constants.ts
var FLUID_STEP_SECONDS = 1 / 120;
var FLUID_SPACING_M = 0.05;
var FLUID_PARTICLE_RADIUS_M = 0.0125;
var FLUID_SMOOTHING_RADIUS_M = 1.8 * FLUID_SPACING_M;

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
  const encodeUtf8 = (text) => {
    const result = [];
    for (const character of text) {
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
    const record = item;
    const keys = Object.keys(record).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record[key]);
    }
  }
  write(value);
  return Uint8Array.from(bytes);
}
export {
  CLOTH_PROFILE,
  CLOTH_STEP_SECONDS,
  FLUID_PARTICLE_RADIUS_M,
  FLUID_SMOOTHING_RADIUS_M,
  FLUID_STEP_SECONDS,
  canonicalEncode,
  createSheet
};
