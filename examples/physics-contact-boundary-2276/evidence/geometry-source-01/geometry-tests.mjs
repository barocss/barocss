// examples/physics-contact-boundary-2276/geometry.test.ts
import assert from "node:assert/strict";
import test from "node:test";

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
var add = (a, b) => a.map((value, index) => value + b[index]);
var sub = (a, b) => a.map((value, index) => value - b[index]);
var scale = (a, value) => a.map((component) => component * value);
var dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rotate(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}

// examples/physics-rigid-feature-geometry/sat-feature.ts
var FEATURE_INPUT_MESSAGE = "private feature geometry requires two admitted boxes";
var DIAGNOSTIC_TIE_TOLERANCE_M = 1e-12;
function boxAxes(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport(body, direction) {
  const axes = boxAxes(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
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
  const axesA = boxAxes(a), axesB = boxAxes(b);
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
  const aPoint = boxSupport(a, bestAxis);
  const bPoint = boxSupport(b, scale(bestAxis, -1));
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
  box(body) {
    if (body.shape.kind !== "box") throw new StrictLineFailure("box required");
    const m = this.m, [x, y, z, w] = m.vec(body.orientation, 4), norm2 = m.dot([x, y, z, w], [x, y, z, w]);
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
    const extent = m.vec(body.shape.halfExtentsM);
    if (extent.some((value) => value.n <= 0n)) throw new StrictLineFailure("positive extents required");
    return { centre: m.vec(body.positionM), extent, rotation };
  }
  local(box2, world, direction = false) {
    const relative = direction ? world : world.map((value, i) => this.m.sub(value, box2.centre[i]));
    return [0, 1, 2].map((axis) => this.m.dot(box2.rotation.map((row) => row[axis]), relative));
  }
  interval(box2, p) {
    const m = this.m, u = this.local(box2, p), d = this.local(box2, this.normal, true);
    let low = null, high = null;
    for (let i = 0; i < 3; i++) {
      if (d[i].n === 0n) {
        if (m.compare(m.abs(u[i]), box2.extent[i]) > 0) return false;
        continue;
      }
      const first = m.div(m.sub(m.neg(box2.extent[i]), u[i]), d[i]), second = m.div(m.sub(box2.extent[i], u[i]), d[i]);
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
    const m = this.m, box2 = this.boxes[which], local = this.local(box2, m.vec(witness));
    if (!Number.isInteger(plane.axis) || plane.axis < 0 || plane.axis > 2 || Math.abs(plane.side) !== 1) throw new StrictLineFailure("face selector");
    if (local.some((value, i) => m.compare(m.sub(m.abs(value), box2.extent[i]), this.tolerance) > 0)) return false;
    return m.compare(m.abs(m.sub(local[plane.axis], m.mul(m.from(plane.side), box2.extent[plane.axis]))), this.tolerance) <= 0;
  }
  movementWithin(original, moved) {
    const m = this.m, a = m.vec(original), b = m.vec(moved), delta = a.map((value, i) => m.sub(b[i], value));
    return m.compare(m.dot(delta, delta), m.mul(this.tolerance, this.tolerance)) <= 0;
  }
  projectedPair(seed, faceA, faceB) {
    const m = this.m, p = m.vec(seed);
    return [faceA, faceB].map((face, which) => {
      if (!Number.isInteger(face.axis) || face.axis < 0 || face.axis > 2 || Math.abs(face.side) !== 1) throw new StrictLineFailure("face selector");
      const box2 = this.boxes[which], u = this.local(box2, p), d = this.local(box2, this.normal, true), axis = face.axis;
      if (d[axis].n === 0n) throw new StrictLineFailure("line parallel to selected face");
      const t = m.div(m.sub(m.mul(m.from(face.side), box2.extent[axis]), u[axis]), d[axis]);
      return p.map((value, i) => m.number(m.add(value, m.mul(this.normal[i], t))));
    });
  }
};

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
var clamp = (v) => Math.max(0, Math.min(1, v));
function closestSegments(p, p1, q, q1) {
  const u = sub(p1, p), v = sub(q1, q), r = sub(q, p), uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), c = cross(u, v), den = dot(c, c);
  if (![...p, ...p1, ...q, ...q1, uu, vv, den].every(Number.isFinite) || uu <= 0 || vv <= 0) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const pairs = [
    { s: 0, t: clamp(-dot(r, v) / vv) },
    { s: 1, t: clamp((uv - dot(r, v)) / vv) },
    { s: clamp(dot(r, u) / uu), t: 0 },
    { s: clamp((dot(r, u) + uv) / uu), t: 1 }
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
function supportEdge(body, axis, direction) {
  const axes = basis(body), e = extents(body), sides = [0, 0, 0];
  let centre = [...body.positionM];
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

// examples/physics-contact-boundary-2276/geometry.test.ts
function box(id, positionM = [0, 0, 0], orientation = [0, 0, 0, 1], halfExtentsM = [1, 1, 1]) {
  return parseBody({
    id,
    kind: "dynamic",
    shape: { kind: "box", halfExtentsM },
    positionM,
    orientation,
    velocityMps: [0, 0, 0],
    massKg: 1,
    restitution: 0
  });
}
test("strict closed slabs admit an exact edge and reject one representable step outside", () => {
  const a = box("a"), b = box("b", [0, 1.8, 0]), context = new StrictLineContext(a, b, [0, 1, 0]);
  assert.equal(context.check([1, 0.9, 1]), true);
  assert.equal(context.check([nextAfterToward(1, 2), 0.9, 1]), false);
  assert.equal(context.check([nextAfterToward(1, 0), 0.9, nextAfterToward(1, 0)]), true);
});
test("line intersection does not inflate a parallel slab by witness tolerance", () => {
  const context = new StrictLineContext(box("a"), box("b"), [0, 1, 0]);
  assert.equal(context.check([1 + Number.EPSILON, 0, 0]), false);
  assert.equal(context.onFace(0, { axis: 1, side: 1 }, [1 + Number.EPSILON, 1, 0]), true);
});
test("nextafter moves exactly one representable value for either sign", () => {
  assert.equal(nextAfterToward(1, 2), 1 + Number.EPSILON);
  assert.equal(nextAfterToward(-1, 0), -1 + Number.EPSILON / 2);
  assert.equal(nextAfterToward(0, 1), Number.MIN_VALUE);
  assert.equal(nextAfterToward(0, -1), -Number.MIN_VALUE);
  assert.ok(Object.is(nextAfterToward(-0, 0), -0));
  assert.throws(() => nextAfterToward(Infinity, 0), StrictLineFailure);
});
test("named face projection correctly rounds an exact non-dyadic ratio", () => {
  const context = new StrictLineContext(box("a"), box("b"), [1, 3, 0]);
  const [a, b] = context.projectedPair([0, 0, 0], { axis: 1, side: 1 }, { axis: 1, side: 1 });
  assert.equal(a[0], 1 / 3);
  assert.equal(a[1], 1);
  assert.deepEqual(a, b);
});
test("named face projection rounds a half-ULP tie to the even significand", () => {
  const context = new StrictLineContext(box("a", [0, 0, 0], [0, 0, 0, 1], [2, 2, 2]), box("b"), [1, 2 ** 53, 0]);
  const [even] = context.projectedPair([1, 0, 0], { axis: 1, side: 1 }, { axis: 1, side: 1 });
  assert.equal(even[0], 1 + Number.EPSILON);
  const [, tie] = context.projectedPair([1, 0, 0], { axis: 1, side: 1 }, { axis: 1, side: 1 });
  assert.equal(tie[0], 1);
});
test("exact movement gate is Euclidean rather than a per-coordinate box", () => {
  const context = new StrictLineContext(box("a"), box("b"), [0, 1, 0]);
  assert.equal(context.movementWithin([0, 0, 0], [1e-12, 0, 0]), true);
  assert.equal(context.movementWithin([0, 0, 0], [8e-13, 8e-13, 0]), false);
});
test("normalized rational quaternion geometry is invariant to its sign", () => {
  const q = [0, Math.sin(0.1), 0, Math.cos(0.1)], neg = q.map((value) => -value);
  const a = box("a", [0, 0, 0], q), b = box("b", [0, 1.8, 0], q);
  const c = new StrictLineContext(a, b, [0, 1, 0]);
  const d = new StrictLineContext(box("a", [0, 0, 0], neg), box("b", [0, 1.8, 0], neg), [0, 1, 0]);
  assert.equal(c.check([0, 0.9, 0]), true);
  assert.equal(d.check([0, 0.9, 0]), true);
  assert.deepEqual(
    c.projectedPair([0, 0.9, 0], { axis: 1, side: 1 }, { axis: 1, side: -1 }),
    d.projectedPair([0, 0.9, 0], { axis: 1, side: 1 }, { axis: 1, side: -1 })
  );
});
test("already valid aligned face retains exact witnesses, IDs and input data", () => {
  const a = box("a"), b = box("b", [0, 1.8, 0]), before = structuredClone([a, b]), g = featureContact(a, b);
  assert.equal(g.points.length, 4);
  assert.equal(g.conditioning.boundaryRoundingMovedPoints, 0);
  assert.deepEqual(g.points.map((p) => p.key), [
    "face:a:1:1:b:1:-1:0",
    "face:a:1:1:b:1:-1:1",
    "face:a:1:1:b:1:-1:2",
    "face:a:1:1:b:1:-1:3"
  ]);
  for (const p of g.points) {
    assert.equal(p.witnessAM[1], 1);
    assert.equal(p.witnessBM[1], 0.8);
  }
  assert.deepEqual([a, b], before);
  assert.deepEqual(featureContact(a, b), g);
});
test("zero-width edge contact retains both selected face rows", () => {
  const g = featureContact(box("a"), box("b", [2, 2, 0]));
  assert.equal(g.points.length, 2);
  assert.equal(g.conditioning.boundaryRoundingMovedPoints, 0);
  assert.equal(new Set(g.points.map((point2) => point2.key)).size, 2);
  for (const p of g.points) assert.equal(p.normalGapM, 0);
});
test("rotated face outputs certify the actual returned float midpoint", () => {
  const a = box("a"), b = box("b", [0, 1.7, 0], [0, Math.sin(0.1), 0, Math.cos(0.1)]), g = featureContact(a, b);
  const exact = new StrictLineContext(a, b, g.planeNormalAtoB);
  assert.equal(g.points.length, 4);
  for (const p of g.points) {
    assert.equal(exact.check(p.midpointM), true);
    assert.deepEqual(p.midpointM, p.witnessAM.map((value, i) => (value + p.witnessBM[i]) * 0.5));
  }
  assert.ok(Number(g.conditioning.boundaryRoundingMaximumSteps) <= STRICT_LINE_LIMITS.roundingSteps);
});
test("invalid exact operands and parallel named-face projection refuse", () => {
  const a = box("a"), b = box("b");
  assert.throws(() => new StrictLineContext(a, b, [0, 0, 0]), StrictLineFailure);
  assert.throws(() => new StrictLineContext(a, b, [NaN, 1, 0]), StrictLineFailure);
  assert.throws(() => new StrictLineContext(a, b, [1, 0, 0]).projectedPair([0, 0, 0], { axis: 1, side: 1 }, { axis: 1, side: -1 }), StrictLineFailure);
});
