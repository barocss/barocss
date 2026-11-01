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

// packages/barocss-physics/src/cloth/profile.ts
var CLOTH_STEP_SECONDS = 1 / 120;
var CLOTH_MAX_STEPS = 240;
var CLOTH_SUBSTEPS = 8;
var CLOTH_ITERATIONS = 2;
var CLOTH_PROFILE_NAME = "pinned-sheet-sphere-v1";
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

// packages/barocss-physics/src/cloth/constraints.ts
function projectDistance(sheet2, constraint) {
  globalThis.__p5Kernel.hit("clothProjectDistance");
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
  globalThis.__p5Kernel.hit("clothProjectSphere");
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
  __p5Construction = globalThis.__p5Kernel.hit("clothSolverConstructions");
  before = new Float64Array(289 * 3);
  decay = Math.exp(-CLOTH_PROFILE.velocityDecayPerSecond * CLOTH_PROFILE.dt);
  step(sheet2, positions, velocities) {
    globalThis.__p5Kernel.hit("clothSolverCalls");
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
          globalThis.__p5Kernel.fault("mid-kernel");
        }
        projectSphere(sheet2);
      }
      for (let j = 0; j < p.length; j++) velocities[j] = (p[j] - this.before[j]) / dt;
    }
  }
};

// packages/barocss-physics/src/cloth/metrics.ts
function clothDiagnostics(sheet2) {
  globalThis.__p5Kernel.hit("clothDiagnostics");
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
  globalThis.__p5Kernel.hit("canonicalEncode");
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

// packages/barocss-physics/src/domain/types.ts
function invalid(condition, message) {
  if (!condition) throw new PhysicsError("INVALID_CONFIG", message);
}
function immutableCopy(input) {
  const result = copyData(input);
  function freeze(value) {
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  }
  freeze(result);
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
  const ids = /* @__PURE__ */ new Set();
  const owners = /* @__PURE__ */ new Set();
  for (const c of data.colliders) {
    invalid(colliderIds.includes(c.id) && !ids.has(c.id), "Invalid static collider identity");
    ids.add(c.id);
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
  globalThis.__p5Kernel.fault("prepare-position-copy");
  globalThis.__p5Kernel.hit("outputCopies");
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
  globalThis.__p5Kernel.hit("completeKernelReturns");
  const diagnostics = clothDiagnostics(candidateSheet);
  globalThis.__p5Kernel.fault("post-diagnostic");
  if (!withinClothBounds(positions, velocities, diagnostics)) throw new PhysicsError("NUMERIC_LIMIT", "Cloth candidate exceeded the fixed profile bounds");
  const candidate = { positions, velocities, constraints: candidateSheet.constraints, diagnostics };
  const output = copyClothCandidateOutput(definition.cloth.id, candidate);
  return { candidate, output };
}

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

// packages/barocss-physics/src/fluid/boundary.ts
function floorSamples() {
  globalThis.__p5Kernel.hit("floorSamples");
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
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? q * q * q : 0;
}
function gradientScale(distanceSquared) {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? -6 * q * q / radiusSquared : 0;
}
function densities(positions, grid, output) {
  globalThis.__p5Kernel.hit("densities");
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
  globalThis.__p5Kernel.hit("initialRestDensity");
  const count = positions.length / 3;
  const result = new Float64Array(count);
  densities(positions, new NeighborGrid(), result);
  return result.reduce((sum, density) => sum + density, 0) / count;
}

// packages/barocss-physics/src/fluid/static-box.ts
function inflatedBoxBounds(centerM, halfExtentsM) {
  globalThis.__p5Kernel.hit("inflatedBoxBounds");
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

// packages/barocss-physics/src/fluid/visual-viscosity.ts
function blendVisualViscosity(positions, velocities, grid, output, coefficient) {
  globalThis.__p5Kernel.hit("xsphBlend");
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
  __p5Construction = globalThis.__p5Kernel.hit("pbfSolverConstructions");
  grid = new NeighborGrid();
  predicted = new Float64Array(FLUID_COUNT * 3);
  combined;
  density = new Float64Array(FLUID_COUNT);
  lambda = new Float64Array(FLUID_COUNT);
  corrections = new Float64Array(FLUID_COUNT * 3);
  smoothedVelocities;
  obstacleHits = 0;
  projectDensity(velocities) {
    globalThis.__p5Kernel.hit("pbfProjectDensity");
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
        const scale = gradientScale(distanceSquared) / this.restDensity;
        const gx = scale * rx, gy = scale * ry, gz = scale * rz;
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
        const scale = (this.lambda[index] + (other < FLUID_COUNT ? this.lambda[other] : 0)) * gradientScale(distanceSquared) / this.restDensity;
        dx += scale * rx;
        dy += scale * ry;
        dz += scale * rz;
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
    globalThis.__p5Kernel.hit("pbfSolverCalls");
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
      globalThis.__p5Kernel.fault("mid-kernel");
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
  globalThis.__p5Kernel.hit("fluidDiagnostics");
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

// packages/barocss-physics/src/domain/fluid.ts
function copyFluidCandidateOutput(id, candidate) {
  globalThis.__p5Kernel.fault("prepare-position-copy");
  globalThis.__p5Kernel.hit("outputCopies");
  return { id, positionsM: candidate.positions.slice(), velocitiesMps: candidate.velocities.slice(), diagnostics: { ...candidate.diagnostics } };
}
function initializeFluid(fluid, staticData) {
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
  const definition = immutableCopy({ ...copied, restDensity, staticBox });
  const diagnostics = { ...fluidDiagnostics(positions, restDensity, 0), obstacleHits: 0 };
  return { definition, initial: { positions, velocities, diagnostics } };
}
function prepareFluid(definition, accepted) {
  const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
  const coefficient = definition.fluid.visualSmoothing.kind === "xsph" ? definition.fluid.visualSmoothing.coefficient : 0;
  const solver = new PbfSolver(definition.restDensity, coefficient, definition.staticBox);
  const { boundaryHits, obstacleHits } = solver.step(positions, velocities);
  globalThis.__p5Kernel.hit("completeKernelReturns");
  if (!insideBasin(positions) || !velocities.every((x) => Number.isFinite(x) && Math.abs(x) <= 1e3)) throw new PhysicsError("NUMERIC_LIMIT", "Fluid candidate exceeded numeric bounds");
  const measured = fluidDiagnostics(positions, definition.restDensity, boundaryHits);
  globalThis.__p5Kernel.fault("post-diagnostic");
  if (!Number.isFinite(measured.meanAbsoluteDensityError) || !Number.isFinite(measured.p95Compression)) throw new PhysicsError("NUMERIC_LIMIT", "Fluid candidate density is not finite");
  const candidate = { positions, velocities, diagnostics: { ...measured, obstacleHits } };
  const output = copyFluidCandidateOutput(definition.fluid.id, candidate);
  return { candidate, output };
}

// packages/barocss-physics/src/cloth/topology.ts
function createSheet() {
  globalThis.__p5Kernel.hit("createSheet");
  const fixture = CLOTH_PROFILE;
  const { size: size2, sideM, heightM, densityKgM2 } = fixture;
  const positions = new Float64Array(size2 * size2 * 3);
  const triangles = [];
  const constraints = [];
  const spacing = sideM / (size2 - 1);
  for (let z = 0; z < size2; z++) for (let x = 0; x < size2; x++) {
    positions.set(
      [-sideM / 2 + x * spacing, heightM, -sideM / 2 + z * spacing],
      3 * (z * size2 + x)
    );
    if (x < size2 - 1 && z < size2 - 1) {
      const a = z * size2 + x;
      triangles.push(a, a + size2, a + 1, a + 1, a + size2, a + size2 + 1);
    }
  }
  const masses = new Float64Array(size2 * size2);
  const triangleVertexMass = densityKgM2 * spacing ** 2 / 6;
  for (const index of triangles) masses[index] += triangleVertexMass;
  const pins = [0, size2 - 1];
  const inverseMasses = Float64Array.from(masses, (mass, index) => pins.includes(index) ? 0 : 1 / mass);
  const edge = (a, b, kind) => {
    const rest = Math.hypot(...[0, 1, 2].map((axis) => positions[3 * a + axis] - positions[3 * b + axis]));
    constraints.push({ a, b, rest, kind, lambda: 0 });
  };
  for (let z = 0; z < size2; z++) for (let x = 0; x < size2; x++) {
    const a = z * size2 + x;
    if (x + 1 < size2) edge(a, a + 1, "stretch");
    if (z + 1 < size2) edge(a, a + size2, "stretch");
    if (x + 1 < size2 && z + 1 < size2) {
      edge(a, a + size2 + 1, "shear");
      edge(a + 1, a + size2, "shear");
    }
    if (x + 2 < size2) edge(a, a + 2, "bend-distance");
    if (z + 2 < size2) edge(a, a + 2 * size2, "bend-distance");
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
export {
  CLOTH_ITERATIONS,
  CLOTH_MAX_STEPS,
  CLOTH_PROFILE,
  CLOTH_PROFILE_NAME,
  CLOTH_STEP_SECONDS,
  CLOTH_SUBSTEPS,
  FLUID_BASIN_M,
  FLUID_COUNT,
  FLUID_GRAVITY_MPS2,
  FLUID_MAX_STEPS,
  FLUID_MIN_SPACING_M,
  FLUID_PARTICLE_RADIUS_M,
  FLUID_SMOOTHING_RADIUS_M,
  FLUID_SPACING_M,
  FLUID_STEP_SECONDS,
  canonicalEncode,
  copyData,
  createSheet,
  digest,
  initializeCloth,
  initializeFluid,
  prepareCloth,
  prepareFluid,
  sha256
};
