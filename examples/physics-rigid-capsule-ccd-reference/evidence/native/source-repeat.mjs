var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// examples/physics-rigid-capsule-ccd-reference/entry.ts
var entry_exports = {};
__export(entry_exports, {
  ERRORS: () => ERRORS,
  PROFILE: () => PROFILE,
  PhysicsError: () => PhysicsError,
  advanceHeadOnFaceStep: () => advanceHeadOnFaceStep,
  createRigidCapsuleFaceReference: () => createRigidCapsuleFaceReference,
  createUprightCapsuleQuery: () => createUprightCapsuleQuery,
  detect: () => detect,
  parseBody: () => parseBody
});

// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

// examples/physics-rigid-capsule-ccd-reference/profile.ts
var PROFILE = "rigid-capsule-linear-face-v1";
var RADIUS_M = 0.1;
var HALF_LENGTH_M = 0.2;
var TOLERANCE_M = 1e-12;
var YAW_QUATERNION = [0, 0.09983341664682815, 0, 0.9950041652780257];
var ERRORS = {
  profile: "Private capsule face profile is unsupported",
  movement: "Private capsule face movement is unsupported",
  numeric: "Private capsule face result is invalid",
  overlap: "Initial capsule overlaps a box",
  stale: "Revision mismatch",
  disposed: "Private capsule face reference is disposed"
};

// examples/physics-rigid-capsule-ccd-reference/admission.ts
function fail(code) {
  throw new PhysicsError(code, code === "INVALID_CONFIG" ? ERRORS.profile : ERRORS.movement);
}
function record(input, keys, code) {
  if (!input || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype) fail(code);
  const own = Reflect.ownKeys(input);
  if (own.length !== keys.length || own.some((k) => typeof k !== "string" || !keys.includes(k))) fail(code);
  const copy = {};
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d || !("value" in d)) fail(code);
    copy[key] = d.value;
  }
  return copy;
}
function tuple(input, count, code) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length !== count || Reflect.ownKeys(input).length !== count + 1) fail(code);
  const values = [];
  for (let i = 0; i < count; i++) {
    const d = Object.getOwnPropertyDescriptor(input, String(i));
    if (!d || !("value" in d) || typeof d.value !== "number" || !Number.isFinite(d.value)) fail(code);
    values.push(d.value);
  }
  return values;
}
var identity = (input, code) => {
  if (typeof input !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(input)) fail(code);
  return input;
};
var zero = (v) => v.every((x) => x === 0);
function copyBox(b) {
  return { id: b.id, centerM: [...b.centerM], halfExtentsM: [...b.halfExtentsM], orientationXYZW: [...b.orientationXYZW], velocityMps: [...b.velocityMps], angularVelocityRadps: [...b.angularVelocityRadps] };
}
function copySnapshot(s) {
  return { version: 1, profile: s.profile, selectedFace: "negative-x", revision: s.revision, capsule: { ...s.capsule, orientationXYZW: [...s.capsule.orientationXYZW], angularVelocityRadps: [...s.capsule.angularVelocityRadps] }, box: copyBox(s.box) };
}
function admitSnapshot(input) {
  const s = record(input, ["version", "profile", "selectedFace", "revision", "capsule", "box"], "INVALID_CONFIG");
  if (s.version !== 1 || s.profile !== PROFILE || s.selectedFace !== "negative-x") fail("INVALID_CONFIG");
  const c = record(s.capsule, ["radiusM", "halfLengthM", "orientationXYZW", "angularVelocityRadps"], "INVALID_CONFIG");
  const cq = tuple(c.orientationXYZW, 4, "INVALID_CONFIG"), ca = tuple(c.angularVelocityRadps, 3, "INVALID_CONFIG");
  if (c.radiusM !== RADIUS_M || c.halfLengthM !== HALF_LENGTH_M || !cq.every((x, i) => x === [0, 0, 0, 1][i]) || !zero(ca)) fail("INVALID_CONFIG");
  const b = record(s.box, ["id", "centerM", "halfExtentsM", "orientationXYZW", "velocityMps", "angularVelocityRadps"], "INVALID_CONFIG");
  const centerM = tuple(b.centerM, 3, "INVALID_CONFIG"), halfExtentsM = tuple(b.halfExtentsM, 3, "INVALID_CONFIG");
  const orientationXYZW = tuple(b.orientationXYZW, 4, "INVALID_CONFIG"), velocityMps = tuple(b.velocityMps, 3, "INVALID_CONFIG"), angularVelocityRadps = tuple(b.angularVelocityRadps, 3, "INVALID_CONFIG");
  if (centerM.some((x) => Math.abs(x) > 1e4) || halfExtentsM.some((x) => x < 1e-4 || x > 5) || !zero(velocityMps) || !zero(angularVelocityRadps) || !(orientationXYZW.every((x, i) => x === [0, 0, 0, 1][i]) || orientationXYZW.every((x, i) => x === YAW_QUATERNION[i]))) fail("INVALID_CONFIG");
  return { version: 1, profile: PROFILE, selectedFace: "negative-x", revision: identity(s.revision, "INVALID_CONFIG"), capsule: { radiusM: RADIUS_M, halfLengthM: HALF_LENGTH_M, orientationXYZW: cq, angularVelocityRadps: ca }, box: { id: identity(b.id, "INVALID_CONFIG"), centerM, halfExtentsM, orientationXYZW, velocityMps, angularVelocityRadps } };
}
function admitMovement(input, snapshot2) {
  const q = record(input, ["revision", "centerM", "velocityMps", "stepSeconds"], "INVALID_QUERY");
  const revision = identity(q.revision, "INVALID_QUERY");
  const centerM = tuple(q.centerM, 3, "INVALID_QUERY"), velocityMps = tuple(q.velocityMps, 3, "INVALID_QUERY");
  if (centerM.some((x) => Math.abs(x) > 1e4) || velocityMps.some((x) => Math.abs(x) > 1e3) || typeof q.stepSeconds !== "number" || !Number.isFinite(q.stepSeconds) || q.stepSeconds <= 0 || q.stepSeconds > 1) fail("INVALID_QUERY");
  if (revision !== snapshot2.revision) throw new PhysicsError("STALE_SNAPSHOT", ERRORS.stale);
  return { revision, centerM, velocityMps, stepSeconds: q.stepSeconds };
}

// packages/barocss-physics/src/capsule-query/profile.ts
var PROFILE2 = "upright-capsule-box-v1";
var RADIUS_M2 = 0.15;
var HALF_LENGTH_M2 = 0.35;
var TIE_FRACTION = 1e-9;
var BOX_CAPACITY = 32;

// packages/barocss-physics/src/capsule-query/geometry.ts
function matrix(q) {
  const [x, y, z, w] = q, factor = 2 / (x * x + y * y + z * z + w * w);
  return [
    [1 - factor * (y * y + z * z), factor * (x * y - z * w), factor * (x * z + y * w)],
    [factor * (x * y + z * w), 1 - factor * (x * x + z * z), factor * (y * z - x * w)],
    [factor * (x * z - y * w), factor * (y * z + x * w), 1 - factor * (x * x + y * y)]
  ];
}
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function closestCandidate(center, box2) {
  const m = matrix(box2.orientationXYZW), h = box2.halfExtentsM;
  const toLocal = (p) => [0, 1, 2].map((j) => m[0][j] * (p[0] - box2.centerM[0]) + m[1][j] * (p[1] - box2.centerM[1]) + m[2][j] * (p[2] - box2.centerM[2]));
  const toWorld = (p) => m.map((row, i) => dot(row, p) + box2.centerM[i]);
  const a = toLocal([center[0], center[1] - HALF_LENGTH_M2, center[2]]);
  const b = toLocal([center[0], center[1] + HALF_LENGTH_M2, center[2]]);
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
  const normalM = distanceM > 0 ? m.map((row) => dot(row, difference) / distanceM) : null;
  return { distanceM, normalM, pointM: toWorld(pointLocal), segmentM: toWorld(segmentLocal) };
}

// packages/barocss-physics/src/math.ts
var add = (a, b) => a.map((value, index) => value + b[index]);
var sub = (a, b) => a.map((value, index) => value - b[index]);
var scale = (a, value) => a.map((component) => component * value);
var dot2 = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
function rotate(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}
var localPoint = (body2, point) => rotate(inverse(body2.orientation), sub(point, body2.positionM));
var worldPoint = (body2, point) => add(body2.positionM, rotate(body2.orientation, point));

// examples/physics-rigid-capsule-ccd-reference/face-sweep.ts
function faceCoordinates(s, center) {
  const m = matrix(s.box.orientationXYZW), delta = sub(center, s.box.centerM);
  const local = [0, 1, 2].map((j) => m[0][j] * delta[0] + m[1][j] * delta[1] + m[2][j] * delta[2]);
  const normal = m.map((row) => -row[0]);
  return { m, local, normal, gapM: -local[0] - s.box.halfExtentsM[0] - RADIUS_M };
}
function numeric(condition) {
  if (!condition) throw new PhysicsError("NUMERIC_LIMIT", ERRORS.numeric);
}
function sweepFace(s, q) {
  const { m, local, normal, gapM } = faceCoordinates(s, q.centerM);
  const localVelocity = [0, 1, 2].map((j) => m[0][j] * q.velocityMps[0] + m[1][j] * q.velocityMps[1] + m[2][j] * q.velocityMps[2]);
  if (local[0] > s.box.halfExtentsM[0] || Math.abs(localVelocity[1]) > 1e-12 || Math.abs(localVelocity[2]) > 1e-12 || Math.abs(local[1]) + HALF_LENGTH_M + RADIUS_M > s.box.halfExtentsM[1] || Math.abs(local[2]) + RADIUS_M > s.box.halfExtentsM[2]) throw new PhysicsError("INVALID_QUERY", ERRORS.movement);
  numeric(Number.isFinite(gapM) && Number.isFinite(localVelocity[0]));
  if (gapM < -TOLERANCE_M) throw new PhysicsError("INITIAL_OVERLAP", ERRORS.overlap);
  let toiFraction;
  if (Math.abs(gapM) <= TOLERANCE_M) toiFraction = 0;
  else {
    if (localVelocity[0] <= 0) return null;
    toiFraction = gapM / localVelocity[0] / q.stepSeconds;
    if (toiFraction > 1) return null;
  }
  numeric(Number.isFinite(toiFraction) && toiFraction >= 0 && toiFraction <= 1);
  const segmentPointM = add(q.centerM, scale(q.velocityMps, q.stepSeconds * toiFraction));
  const hitLocal = faceCoordinates(s, segmentPointM).local;
  numeric(Math.abs(hitLocal[1]) + HALF_LENGTH_M + RADIUS_M <= s.box.halfExtentsM[1] && Math.abs(hitLocal[2]) + RADIUS_M <= s.box.halfExtentsM[2] && Math.abs(faceCoordinates(s, segmentPointM).gapM) <= TOLERANCE_M && Math.abs(dot(normal, normal) - 1) <= 1e-12);
  const pointLocal = [-s.box.halfExtentsM[0], hitLocal[1], hitLocal[2]];
  const pointM = m.map((row, i) => dot(row, pointLocal) + s.box.centerM[i]);
  return { bodyId: s.box.id, toiFraction, normalFixtureToCapsule: normal, pointM, segmentPointM };
}

// examples/physics-rigid-capsule-ccd-reference/response.ts
function advanceHeadOnFaceStep(initial, hit, stepSeconds) {
  const raw = record(initial, ["snapshot", "revision", "centerM", "velocityMps", "stepSeconds"], "INVALID_QUERY");
  const s = admitSnapshot(raw.snapshot), q = admitMovement({ revision: raw.revision, centerM: raw.centerM, velocityMps: raw.velocityMps, stepSeconds: raw.stepSeconds }, s);
  if (stepSeconds !== q.stepSeconds) throw new PhysicsError("INVALID_QUERY", ERRORS.movement);
  const qualified = sweepFace(s, q);
  numeric(hit === null === (qualified === null));
  let hitTimeSeconds = 0, remainingTimeSeconds = stepSeconds, centerM = [...q.centerM], velocityMps = [...q.velocityMps];
  if (hit !== null) {
    const h = record(hit, ["bodyId", "toiFraction", "normalFixtureToCapsule", "pointM", "segmentPointM"], "INVALID_QUERY");
    const normal = tuple(h.normalFixtureToCapsule, 3, "INVALID_QUERY");
    const point = tuple(h.pointM, 3, "INVALID_QUERY"), segment = tuple(h.segmentPointM, 3, "INVALID_QUERY");
    numeric(qualified !== null && point.every((x, i) => Math.abs(x - qualified.pointM[i]) <= 1e-12) && segment.every((x, i) => Math.abs(x - qualified.segmentPointM[i]) <= 1e-12));
    numeric(qualified !== null && h.toiFraction === qualified.toiFraction);
    numeric(h.bodyId === s.box.id && typeof h.toiFraction === "number" && Number.isFinite(h.toiFraction) && h.toiFraction >= 0 && h.toiFraction <= 1);
    numeric(Math.abs(dot2(normal, normal) - 1) <= 1e-12 && normal.every((x, i) => Math.abs(x - faceCoordinates(s, q.centerM).normal[i]) <= 1e-12));
    hitTimeSeconds = stepSeconds * h.toiFraction;
    remainingTimeSeconds = stepSeconds - hitTimeSeconds;
    centerM = add(centerM, scale(velocityMps, hitTimeSeconds));
    numeric(Math.abs(faceCoordinates(s, centerM).gapM) <= TOLERANCE_M);
    const closing = dot2(velocityMps, normal);
    if (closing < 0) velocityMps = add(velocityMps, scale(normal, -closing));
  }
  centerM = add(centerM, scale(velocityMps, remainingTimeSeconds));
  numeric([...centerM, ...velocityMps, remainingTimeSeconds].every(Number.isFinite) && remainingTimeSeconds >= 0 && remainingTimeSeconds <= stepSeconds && faceCoordinates(s, centerM).gapM >= -TOLERANCE_M);
  return { centerM, velocityMps, hitTimeSeconds, remainingTimeSeconds, orientationXYZW: [...s.capsule.orientationXYZW], box: copyBox(s.box) };
}

// packages/barocss-physics/src/capsule-query/admission.ts
function refuse(code, message) {
  throw new PhysicsError(code, message);
}
function metadata(code, action) {
  try {
    return action();
  } catch (error2) {
    throw new PhysicsError(code, "Input reflection failed");
  }
}
function record2(value, keys, code) {
  if (!value || typeof value !== "object" || metadata(code, () => Object.getPrototypeOf(value)) !== Object.prototype) {
    refuse(code, "Expected an ordinary record");
  }
  const own = metadata(code, () => Reflect.ownKeys(value));
  if (own.length !== keys.length || own.some((key) => typeof key !== "string" || !keys.includes(key))) {
    refuse(code, "Unexpected record fields");
  }
  const copied = {};
  for (const key of keys) {
    const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, key));
    if (!descriptor || !("value" in descriptor)) refuse(code, "Accessor fields are not admitted");
    copied[key] = descriptor.value;
  }
  return copied;
}
function dense(value, limit, code, exact) {
  if (!metadata(code, () => Array.isArray(value)) || metadata(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
    refuse(code, "Expected an ordinary dense array");
  }
  const lengthDescriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, "length"));
  if (!lengthDescriptor || !("value" in lengthDescriptor)) refuse(code, "Expected array length");
  const length = lengthDescriptor.value;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > limit || exact !== void 0 && length !== exact || metadata(code, () => Reflect.ownKeys(value)).length !== length + 1) {
    refuse(code, "Invalid array length or fields");
  }
  const values = [];
  for (let index = 0; index < length; index++) {
    const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
    if (!descriptor || !("value" in descriptor)) refuse(code, "Sparse or accessor array");
    values.push(descriptor.value);
  }
  return values;
}
function tuple2(value, count, bound, code) {
  return dense(value, count, code, count).map((component) => {
    if (typeof component !== "number" || !Number.isFinite(component) || Math.abs(component) > bound) {
      refuse(code, "Invalid tuple component");
    }
    return component;
  });
}
function identity2(value, code) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(value)) {
    refuse(code, "Invalid identity");
  }
  return value;
}
function admitScene(input) {
  const scene = record2(input, ["version", "profile", "revision", "boxes"], "INVALID_CONFIG");
  if (scene.version !== 1 || scene.profile !== PROFILE2) refuse("INVALID_CONFIG", "Unsupported capsule query profile");
  const revision = identity2(scene.revision, "INVALID_CONFIG");
  const boxes = dense(scene.boxes, BOX_CAPACITY, "INVALID_CONFIG").map((value) => {
    const box2 = record2(value, ["id", "centerM", "halfExtentsM", "orientationXYZW"], "INVALID_CONFIG");
    const id = identity2(box2.id, "INVALID_CONFIG");
    const centerM = tuple2(box2.centerM, 3, 10, "INVALID_CONFIG");
    const halfExtentsM = tuple2(box2.halfExtentsM, 3, 5, "INVALID_CONFIG");
    const orientationXYZW = tuple2(box2.orientationXYZW, 4, 1, "INVALID_CONFIG");
    if (halfExtentsM.some((value2) => value2 < 1e-4) || Math.abs(Math.hypot(...orientationXYZW) - 1) > 1e-12) {
      refuse("INVALID_CONFIG", "Invalid box extents or quaternion");
    }
    return { id, centerM, halfExtentsM, orientationXYZW };
  });
  if (new Set(boxes.map((box2) => box2.id)).size !== boxes.length) refuse("INVALID_CONFIG", "Duplicate box ID");
  return { version: 1, profile: PROFILE2, revision, boxes };
}
function admitSweep(input, scene) {
  const query = record2(input, ["revision", "centerM", "displacementM", "excludeId"], "INVALID_QUERY");
  const revision = identity2(query.revision, "INVALID_QUERY");
  const centerM = tuple2(query.centerM, 3, 5, "INVALID_QUERY");
  const displacementM = tuple2(query.displacementM, 3, 2, "INVALID_QUERY");
  if (Math.hypot(...displacementM) > 2) refuse("INVALID_QUERY", "Displacement exceeds 2 metres");
  const excludeId = query.excludeId === null ? null : identity2(query.excludeId, "INVALID_QUERY");
  if (revision !== scene.revision) throw new PhysicsError("STALE_SNAPSHOT", "Revision mismatch");
  if (excludeId !== null && !scene.boxes.some((box2) => box2.id === excludeId)) refuse("INVALID_QUERY", "Unknown excluded ID");
  return { revision, centerM, displacementM, excludeId };
}

// packages/barocss-physics/src/capsule-query/sweep.ts
function sweepBox(center, displacement, box2) {
  let fraction = 0;
  for (let iteration = 0; iteration < 64; iteration++) {
    const at = center.map((value, i) => value + fraction * displacement[i]);
    const closest = closestCandidate(at, box2), gap = closest.distanceM - RADIUS_M2;
    if (!Number.isFinite(gap)) throw new PhysicsError("NUMERIC_LIMIT", "Nonfinite distance");
    if (iteration === 0 && gap < -1e-12) throw new PhysicsError("INITIAL_OVERLAP", "Initial capsule overlaps a box");
    if (!closest.normalM) throw new PhysicsError("NUMERIC_LIMIT", "No distance normal");
    if (iteration === 0 && Math.abs(gap) <= 1e-12 || gap <= 1e-14) {
      if (gap < -1e-12) throw new PhysicsError("NUMERIC_LIMIT", "Advancement crossed contact");
      return {
        bodyId: box2.id,
        toiFraction: fraction,
        normalFixtureToCapsule: closest.normalM.slice(),
        pointM: closest.pointM.slice(),
        segmentPointM: closest.segmentM.slice(),
        iterations: iteration + 1
      };
    }
    const closing = -dot(closest.normalM, displacement);
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
function copyBox2(box2) {
  return { id: box2.id, centerM: [...box2.centerM], halfExtentsM: [...box2.halfExtentsM], orientationXYZW: [...box2.orientationXYZW] };
}
function geometryKey(box2) {
  const values = [...box2.centerM, ...box2.halfExtentsM, ...box2.orientationXYZW];
  const bytes2 = new Uint8Array(80), view = new DataView(bytes2.buffer);
  values.forEach((value, index) => view.setFloat64(index * 8, value, true));
  return Array.from(bytes2, (value) => value.toString(16).padStart(2, "0")).join("");
}
function groupBoxes(boxes) {
  const groups = /* @__PURE__ */ new Map();
  for (const box2 of boxes) {
    const key = geometryKey(box2), group = groups.get(key);
    if (group) group.ids.push(box2.id);
    else groups.set(key, { representative: copyBox2(box2), ids: [box2.id] });
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
        for (const id of group.ids) if (id !== query.excludeId && (selectedId === null || id < selectedId)) selectedId = id;
        if (selectedId === null) continue;
        const hit = sweepBox(query.centerM, query.displacementM, group.representative);
        if (hit) hits.push({ ...hit, bodyId: selectedId });
      }
      if (!hits.length) return null;
      const minimum = Math.min(...hits.map((hit) => hit.toiFraction));
      return hits.filter((hit) => hit.toiFraction <= minimum + TIE_FRACTION).sort((a, b) => a.bodyId < b.bodyId ? -1 : a.bodyId > b.bodyId ? 1 : 0)[0];
    },
    getSnapshot() {
      live();
      return { version: 1, profile: scene.profile, revision: scene.revision, boxes: scene.boxes.map(copyBox2) };
    },
    dispose() {
      disposed = true;
    }
  };
}

// packages/barocss-physics/src/limits.ts
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;

// packages/barocss-physics/src/validation.ts
function error(code, message) {
  throw new PhysicsError(code, message);
}
function record3(value, label) {
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
  const input = record3(value, "shape");
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
  const input = record3(value, "friction");
  fields(input, ["static", "dynamic"], "friction");
  const staticCoefficient = finite(input.static, 0, 2, "friction.static");
  const dynamicCoefficient = finite(input.dynamic, 0, staticCoefficient, "friction.dynamic");
  return { static: staticCoefficient, dynamic: dynamicCoefficient };
}
function collisionFilter(value) {
  const input = record3(value, "collisionFilter");
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
  const input = record3(value, "body");
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
    frictionStatic: material2.static,
    frictionDynamic: material2.dynamic
  };
}

// packages/barocss-physics/src/capsule-contact.ts
var clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function capsuleEnds(body2) {
  const half = body2.shape.halfLengthM;
  return [worldPoint(body2, [0, -half, 0]), worldPoint(body2, [0, half, 0])];
}
function segmentPair(a0, a1, b0, b1) {
  const u = sub(a1, a0), v = sub(b1, b0), w = sub(a0, b0);
  const aa = dot2(u, u), bb = dot2(u, v), cc = dot2(v, v);
  const dd = dot2(u, w), ee = dot2(v, w), determinant = aa * cc - bb * bb;
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
    const distance = dot2(difference, difference);
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
    const delta = sub(point2, nearest), distance = dot2(delta, delta);
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
function capsuleBox(capsule, box2) {
  const [start, end] = capsuleEnds(capsule).map((point) => localPoint(box2, point));
  const extents = box2.shape.halfExtentsM;
  const [axisPoint, boxPoint] = segmentBox(start, end, extents);
  const delta = sub(boxPoint, axisPoint), distance = Math.hypot(...delta);
  const radius = capsule.shape.radiusM;
  if (distance > radius) return null;
  if (distance > 1e-12) return {
    normal: rotate(box2.orientation, scale(delta, 1 / distance)),
    penetration: radius - distance,
    pointM: worldPoint(box2, boxPoint)
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
    normal: rotate(box2.orientation, normalLocal),
    penetration: radius + bestGap,
    pointM: worldPoint(box2, boxPoint)
  };
}

// packages/barocss-physics/src/collision.ts
function capsuleCenter(body2, point) {
  const half = body2.shape.halfLengthM;
  const local = localPoint(body2, point);
  return worldPoint(body2, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body2) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body2.orientation, axis));
}
function boxSupport(body2, direction) {
  const axes = boxAxes(body2);
  const extents = body2.shape.halfExtentsM;
  return add(body2.positionM, axes.reduce((result, axis, index) => {
    const projection = dot2(axis, direction);
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
function sphereBox(sphere, box2) {
  const radius = sphere.shape.radiusM;
  const extents = box2.shape.halfExtentsM;
  const relative = localPoint(box2, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents[index], Math.min(extents[index], value)));
  const towardBox = sub(nearest, relative);
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return {
    normal: rotate(box2.orientation, scale(towardBox, 1 / distance)),
    penetration: Math.max(0, radius - distance),
    pointM: worldPoint(box2, nearest)
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
    normal: rotate(box2.orientation, localNormal),
    penetration: radius + faceDistance,
    pointM: worldPoint(box2, nearest)
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
    const radiusA = axesA.reduce((sum, basis, index) => sum + extentA[index] * Math.abs(dot2(basis, axis)), 0);
    const radiusB = axesB.reduce((sum, basis, index) => sum + extentB[index] * Math.abs(dot2(basis, axis)), 0);
    const signedDistance = dot2(delta, axis);
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

// examples/physics-rigid-capsule-ccd-reference/entry.ts
function createRigidCapsuleFaceReference(input) {
  const snapshot2 = admitSnapshot(input);
  let disposed = false;
  const live = () => {
    if (disposed) throw new PhysicsError("DISPOSED", ERRORS.disposed);
  };
  return { sweep(input2) {
    live();
    return sweepFace(snapshot2, admitMovement(input2, snapshot2));
  }, getSnapshot() {
    live();
    return copySnapshot(snapshot2);
  }, dispose() {
    disposed = true;
  } };
}

// examples/physics-rigid-capsule-ccd-reference/controls.mjs
import assert from "node:assert/strict";

// examples/physics-rigid-engine-reference/fixtures.mjs
var dt = 1 / 120;
var material = { static: 1, dynamic: 0.7 };
var floor = () => ({ id: "floor", kind: "static", shape: { kind: "box", halfExtentsM: [2, 0.1, 2] }, positionM: [0, -0.1, 0], restitution: 0, friction: { ...material } });
var body = (id, shape2, positionM, options = {}) => ({ id, kind: "dynamic", shape: shape2, positionM, velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { ...material }, ...options });
var box = (id, positionM, options) => body(id, { kind: "box", halfExtentsM: [0.25, 0.25, 0.25] }, positionM, options);
var config = (bodies, options = {}) => ({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], bodies, ...options });
var stack = (rotated = false) => Array.from({ length: 8 }, (_, i) => {
  const yaw = (-1) ** i * 0.05;
  return box(`b${i}`, [rotated ? i % 2 * 0.05 : 0, 0.25 + 0.5 * i, 0], rotated ? { orientation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] } : {});
});
function hingePair(i) {
  return {
    bodies: [body(`pairA${i}`, { kind: "sphere", radiusM: 0.1 }, [-0.1, 0, i]), body(`pairB${i}`, { kind: "sphere", radiusM: 0.1 }, [0.1, 0, i])],
    joint: { id: `hinge${i}`, kind: "hinge", aId: `pairA${i}`, bId: `pairB${i}`, anchorALocalM: [0.1, 0, 0], anchorBLocalM: [-0.1, 0, 0], axisWorld: [0, 0, 1], limitRad: [-0.8, 0.8], motor: { targetSpeedRadps: 0.5, maxImpulseNms: 1e-4, maxReactionNms: 0.01 } }
  };
}
function fixtures() {
  const a = hingePair(0), b = hingePair(1);
  const thin = { id: "floor", kind: "static", shape: { kind: "box", halfExtentsM: [1e-3, 1, 1] }, positionM: [0, 0, 0], restitution: 0, friction: { ...material } };
  return [
    { id: "DROP16", input: config([...Array.from({ length: 16 }, (_, i) => box(`b${i}`, [(i % 4 - 1.5) * 0.75, 1.5, (Math.floor(i / 4) - 1.5) * 0.75])), floor()]) },
    { id: "STACK2_CONTROL", input: config([box("b0", [0, 0.25, 0]), box("b1", [0.05, 0.75, 0]), floor()], { contactMode: "persistent-box-v1" }) },
    { id: "STACK8_ALIGNED", input: config([...stack(), floor()], { contactMode: "persistent-box-v1" }) },
    { id: "STACK8_ROTATED", input: config([...stack(true), floor()], { contactMode: "persistent-box-v1" }) },
    { id: "STACK8_BASIC", input: config([...stack(), floor()]) },
    { id: "LARGE_STACK8_PERSISTENT", input: config([...stack(), floor()], { sceneMode: "large-v1", broadPhase: "aabb", contactMode: "persistent-box-v1" }) },
    { id: "HINGE1_CONTROL", input: config(a.bodies, { gravityMps2: [0, 0, 0], joints: [a.joint] }) },
    { id: "HINGE2", input: config([...a.bodies, ...b.bodies], { gravityMps2: [0, 0, 0], joints: [a.joint, b.joint] }) },
    { id: "CAPSULE_THIN_CCD", input: config([body("b0", { kind: "capsule", radiusM: 0.1, halfLengthM: 0.2 }, [-0.4, 0, 0], { velocityMps: [100, 0, 0], ccd: true }), thin], { gravityMps2: [0, 0, 0] }) }
  ];
}

// examples/physics-rigid-capsule-ccd-reference/reference-controls.mjs
var freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
var referenceGates = freeze({
  decimalPrecisionDifference: "1e-25",
  distanceM: 1e-12,
  timeSeconds: 1e-12,
  fraction: 1e-12,
  centerM: 1e-12,
  witnessM: 1e-12,
  membershipM: 1e-12,
  normal: 1e-12,
  signedGapM: 1e-12,
  closingSpeedMps: 1e-12,
  fixedOrientation: "exact",
  staticBox: "exact"
});
var referenceErrorLiterals = freeze({
  initialOverlap: { code: "INITIAL_OVERLAP", message: "Initial capsule overlaps a box" },
  profile: { code: "INVALID_CONFIG", message: "Private capsule face profile is unsupported" },
  movement: { code: "INVALID_QUERY", message: "Private capsule face movement is unsupported" },
  numeric: { code: "NUMERIC_LIMIT", message: "Private capsule face result is invalid" },
  referenceFinite: { code: "REF_INPUT", message: "Reference input must contain finite binary numbers" },
  referenceTime: { code: "REF_INPUT", message: "Reference stepSeconds must be positive" },
  referenceQuaternion: { code: "REF_INPUT", message: "Reference quaternion has zero norm" },
  referenceProfile: { code: "REF_PROFILE", message: "Reference capsule dimensions are unsupported" },
  referenceMovement: { code: "REF_MOVEMENT", message: "Reference face movement is unsupported" },
  referenceFootprint: { code: "REF_PROFILE", message: "Reference face footprint is unsupported" },
  referenceAngular: { code: "REF_PROFILE", message: "Reference angular motion is unsupported" },
  referenceMovingBox: { code: "REF_PROFILE", message: "Reference moving box is unsupported" },
  referenceHit: { code: "REF_INPUT", message: "Reference hit must be an object or null" },
  referenceResult: { code: "REF_INPUT", message: "Reference result must be an object" },
  referenceNumeric: { code: "REF_NUMERIC", message: "Reference result is outside finite binary range" }
});
var originalReferenceInput = freeze({
  capsule: { radiusM: 0.1, halfLengthM: 0.2 },
  box: { id: "floor", centerM: [0, 0, 0], halfExtentsM: [1e-3, 1, 1], orientationXYZW: [0, 0, 0, 1] },
  centerM: [-0.4, 0, 0],
  velocityMps: [100, 0, 0],
  stepSeconds: 0.008333333333333333,
  evaluateCandidate: false
});
var yawReferenceInput = freeze({
  capsule: { radiusM: 0.1, halfLengthM: 0.2 },
  box: {
    id: "floor",
    centerM: [0, 0, 0],
    halfExtentsM: [1e-3, 1, 1],
    orientationXYZW: [0, 0.09983341664682815, 0, 0.9950041652780257]
  },
  centerM: [-0.39202663113649666, 0, 0.0794677323180245],
  velocityMps: [98.00665778412416, 0, -19.866933079506122],
  stepSeconds: 0.008333333333333333,
  evaluateCandidate: false
});
var request = (change) => ({ ...structuredClone(originalReferenceInput), ...change });
var literalReferenceControls = freeze([
  {
    name: "original-head-on",
    input: structuredClone(originalReferenceInput),
    expected: {
      status: "hit",
      distanceM: 0.399,
      signedGapM: 0.299,
      timeSeconds: 299e-5,
      fraction: 0.3588,
      remainingSeconds: 0.005343333333333333,
      centerHit: [-0.101, 0, 0],
      centerFinal: [-0.101, 0, 0],
      velocityFinal: [0, 0, 0],
      normal: [-1, 0, 0],
      ambiguity: "flat-interval"
    }
  },
  {
    name: "yaw-0.2-head-on",
    input: structuredClone(yawReferenceInput),
    expected: {
      status: "hit",
      distanceM: 0.399,
      signedGapM: 0.299,
      timeSeconds: 299e-5,
      fraction: 0.3588,
      remainingSeconds: 0.005343333333333333,
      normal: [-0.9800665778412416, 0, 0.19866933079506122],
      ambiguity: "flat-interval"
    }
  },
  {
    name: "resting-with-clearance",
    input: request({ velocityMps: [0, 0, 0] }),
    expected: {
      status: "clear",
      distanceM: 0.399,
      signedGapM: 0.299,
      centerFinal: [-0.4, 0, 0],
      velocityFinal: [0, 0, 0],
      ambiguity: "flat-interval"
    }
  },
  {
    name: "initial-touch",
    input: request({ centerM: [-0.101, 0, 0] }),
    expected: {
      status: "hit",
      distanceM: 0.1,
      signedGapM: 0,
      timeSeconds: 0,
      fraction: 0,
      remainingSeconds: 0.008333333333333333,
      centerFinal: [-0.101, 0, 0],
      velocityFinal: [0, 0, 0],
      ambiguity: "flat-interval"
    }
  },
  {
    name: "resting-at-touch",
    input: request({ centerM: [-0.101, 0, 0], velocityMps: [0, 0, 0] }),
    expected: {
      status: "hit",
      timeSeconds: 0,
      fraction: 0,
      centerFinal: [-0.101, 0, 0],
      velocityFinal: [0, 0, 0],
      ambiguity: "flat-interval"
    }
  },
  {
    name: "initial-overlap",
    input: request({
      centerM: [-0.1009, 0, 0],
      expectedError: referenceErrorLiterals.initialOverlap
    }),
    expected: {
      status: "initial-overlap",
      signedGapM: -1e-4,
      error: referenceErrorLiterals.initialOverlap
    }
  },
  {
    name: "contact-beyond-step",
    input: request({ velocityMps: [10, 0, 0] }),
    expected: {
      status: "clear",
      distanceM: 0.399,
      signedGapM: 0.299,
      centerFinal: [-0.3166666666666667, 0, 0],
      velocityFinal: [10, 0, 0]
    }
  },
  {
    name: "departing-with-clearance",
    input: request({ velocityMps: [-100, 0, 0] }),
    expected: {
      status: "clear",
      distanceM: 0.399,
      signedGapM: 0.299,
      centerFinal: [-1.2333333333333334, 0, 0],
      velocityFinal: [-100, 0, 0]
    }
  },
  {
    name: "departing-at-touch",
    input: request({ centerM: [-0.101, 0, 0], velocityMps: [-100, 0, 0] }),
    expected: {
      status: "hit",
      timeSeconds: 0,
      fraction: 0,
      centerFinal: [-0.9343333333333333, 0, 0],
      velocityFinal: [-100, 0, 0]
    }
  },
  {
    name: "nonfinite-center-null-codec",
    input: request({
      centerM: [null, 0, 0],
      expectedError: referenceErrorLiterals.referenceFinite
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceFinite }
  },
  {
    name: "zero-step",
    input: request({
      stepSeconds: 0,
      expectedError: referenceErrorLiterals.referenceTime
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceTime }
  },
  {
    name: "negative-step",
    input: request({
      stepSeconds: -0.008333333333333333,
      expectedError: referenceErrorLiterals.referenceTime
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceTime }
  },
  {
    name: "zero-quaternion",
    input: request({
      box: { id: "floor", centerM: [0, 0, 0], halfExtentsM: [1e-3, 1, 1], orientationXYZW: [0, 0, 0, 0] },
      expectedError: referenceErrorLiterals.referenceQuaternion
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceQuaternion }
  },
  {
    name: "wrong-original-radius",
    input: request({
      capsule: { radiusM: 0.15, halfLengthM: 0.2 },
      expectedError: referenceErrorLiterals.referenceProfile
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceProfile }
  },
  {
    name: "tangent-movement",
    input: request({
      velocityMps: [100, 1, 0],
      expectedError: referenceErrorLiterals.referenceMovement
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceMovement }
  },
  {
    name: "edge-corner-footprint",
    input: request({
      centerM: [-0.4, 0.8, 0],
      expectedError: referenceErrorLiterals.referenceFootprint
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceFootprint }
  },
  {
    name: "angular-motion",
    input: request({
      capsule: { radiusM: 0.1, halfLengthM: 0.2, angularVelocityRadps: [0, 1, 0] },
      expectedError: referenceErrorLiterals.referenceAngular
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceAngular }
  },
  {
    name: "moving-box",
    input: request({
      box: {
        id: "floor",
        centerM: [0, 0, 0],
        halfExtentsM: [1e-3, 1, 1],
        orientationXYZW: [0, 0, 0, 1],
        velocityMps: [1, 0, 0]
      },
      expectedError: referenceErrorLiterals.referenceMovingBox
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceMovingBox }
  },
  {
    name: "malformed-hit",
    input: request({
      evaluateCandidate: true,
      hit: [],
      expectedError: referenceErrorLiterals.referenceHit
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceHit }
  },
  {
    name: "malformed-result",
    input: request({
      result: null,
      expectedError: referenceErrorLiterals.referenceResult
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceResult }
  },
  {
    name: "nonfinite-result-null-codec",
    input: request({
      result: {
        centerM: [null, 0, 0],
        velocityMps: [0, 0, 0],
        hitTimeSeconds: 299e-5,
        remainingTimeSeconds: 0.005343333333333333
      },
      expectedError: referenceErrorLiterals.referenceFinite
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceFinite }
  },
  {
    name: "finite-input-overflowing-binary-output",
    input: request({
      velocityMps: [-1e308, 0, 0],
      stepSeconds: 1e308,
      expectedError: referenceErrorLiterals.referenceNumeric
    }),
    expected: { status: "input-error", error: referenceErrorLiterals.referenceNumeric }
  }
]);

// examples/physics-rigid-capsule-ccd-reference/controls.mjs
var fixture = fixtures().find((f) => f.id === "CAPSULE_THIN_CCD").input;
function snapshot(input = originalReferenceInput) {
  return {
    version: 1,
    profile: "rigid-capsule-linear-face-v1",
    selectedFace: "negative-x",
    revision: "fixture-1280",
    capsule: { ...structuredClone(input.capsule), orientationXYZW: [0, 0, 0, 1], angularVelocityRadps: [0, 0, 0] },
    box: { ...structuredClone(input.box), velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] }
  };
}
var movement = (input) => ({ revision: "fixture-1280", centerM: [...input.centerM], velocityMps: [...input.velocityMps], stepSeconds: input.stepSeconds });
function runControls(api) {
  const receipts = [], candidates = [];
  function refusal(name, action, code, message) {
    let caught;
    try {
      action();
    } catch (error2) {
      if (!(error2 instanceof api.PhysicsError)) throw error2;
      caught = error2;
    }
    assert.ok(caught, name);
    assert.equal(caught.code, code, name);
    assert.equal(caught.message, message, name);
    receipts.push({ name, code: caught.code, message: caught.message, originalPhysicsError: true });
  }
  assert.deepEqual(fixture.bodies[0].shape, { kind: "capsule", radiusM: 0.1, halfLengthM: 0.2 });
  assert.deepEqual(fixture.bodies[0].positionM, originalReferenceInput.centerM);
  assert.deepEqual(fixture.bodies[0].velocityMps, originalReferenceInput.velocityMps);
  assert.equal(fixture.fixedStepSeconds, originalReferenceInput.stepSeconds);
  refusal("original-ccd-admission", () => api.parseBody(structuredClone(fixture.bodies[0])), "INVALID_CONFIG", "ccd is supported for dynamic spheres or boxes only and must be true");
  function measure(name, input) {
    const s = snapshot(input), q2 = movement(input), ref2 = api.createRigidCapsuleFaceReference(s);
    const beforeS = structuredClone(s), beforeQ = structuredClone(q2), hit = ref2.sweep(q2);
    const hitCopy = structuredClone(hit), result = api.advanceHeadOnFaceStep({ snapshot: s, ...q2 }, hit, q2.stepSeconds), resultCopy = structuredClone(result);
    assert.deepEqual(s, beforeS);
    assert.deepEqual(q2, beforeQ);
    s.box.centerM[0] = 42;
    ref2.getSnapshot().box.centerM[0] = 99;
    assert.deepEqual(ref2.getSnapshot(), beforeS);
    if (hit) hit.pointM[0] = 42;
    result.centerM[0] = 42;
    assert.deepEqual(ref2.sweep(q2), hitCopy);
    const snap = ref2.getSnapshot();
    refusal(name + "-stale", () => ref2.sweep({ ...q2, revision: "stale" }), "STALE_SNAPSHOT", "Revision mismatch");
    assert.deepEqual(ref2.getSnapshot(), snap);
    assert.deepEqual(resultCopy.orientationXYZW, snap.capsule.orientationXYZW);
    assert.deepEqual(resultCopy.box, snap.box);
    ref2.dispose();
    ref2.dispose();
    refusal(name + "-disposed-query", () => ref2.sweep(q2), "DISPOSED", api.ERRORS.disposed);
    refusal(name + "-disposed-snapshot", () => ref2.getSnapshot(), "DISPOSED", api.ERRORS.disposed);
    const row = { name, input: structuredClone(input), hit: hitCopy, result: resultCopy };
    candidates.push(row);
    return row;
  }
  for (const [name, change] of [["original-head-on", {}], ["initial-touch", { centerM: [-0.101, 0, 0] }], ["resting-at-touch", { centerM: [-0.101, 0, 0], velocityMps: [0, 0, 0] }], ["contact-beyond-step", { velocityMps: [10, 0, 0] }], ["zero-motion", { velocityMps: [0, 0, 0] }], ["departing", { velocityMps: [-100, 0, 0] }], ["departing-at-touch", { centerM: [-0.101, 0, 0], velocityMps: [-100, 0, 0] }]]) measure(name, { ...structuredClone(originalReferenceInput), ...change });
  measure("yaw-head-on", structuredClone(yawReferenceInput));
  const first = measure("first-half", { ...structuredClone(originalReferenceInput), stepSeconds: 1 / 240 });
  const second = measure("second-half", { ...structuredClone(originalReferenceInput), centerM: first.result.centerM, velocityMps: first.result.velocityMps, stepSeconds: 1 / 240 });
  const full = candidates[0];
  assert.deepEqual(second.result.centerM, full.result.centerM);
  assert.deepEqual(second.result.velocityMps, full.result.velocityMps);
  assert.ok(Math.abs(first.result.hitTimeSeconds - full.result.hitTimeSeconds) <= 1e-12);
  const ref = api.createRigidCapsuleFaceReference(snapshot()), q = movement(originalReferenceInput), before = ref.getSnapshot(), accepted = ref.sweep(q);
  for (const [name, change, code, message] of [
    ["overlap", { centerM: [-0.1009, 0, 0] }, "INITIAL_OVERLAP", "Initial capsule overlaps a box"],
    ["tangent", { velocityMps: [100, 1, 0] }, "INVALID_QUERY", api.ERRORS.movement],
    ["opposite-side", { centerM: [0.4, 0, 0] }, "INVALID_QUERY", api.ERRORS.movement],
    ["edge-corner", { centerM: [-0.4, 0.8, 0] }, "INVALID_QUERY", api.ERRORS.movement],
    ["nonfinite", { centerM: [NaN, 0, 0] }, "INVALID_QUERY", api.ERRORS.movement],
    ["zero-time", { stepSeconds: 0 }, "INVALID_QUERY", api.ERRORS.movement],
    ["negative-time", { stepSeconds: -1 / 120 }, "INVALID_QUERY", api.ERRORS.movement],
    ["nonfinite-time", { stepSeconds: Infinity }, "INVALID_QUERY", api.ERRORS.movement],
    ["extra-field", { angularVelocityRadps: [0, 1, 0] }, "INVALID_QUERY", api.ERRORS.movement]
  ]) {
    refusal(name, () => ref.sweep({ ...q, ...change }), code, message);
    assert.deepEqual(ref.getSnapshot(), before);
    assert.deepEqual(ref.sweep(q), accepted);
  }
  for (const [name, edit] of [["angular", (s) => s.capsule.angularVelocityRadps[1] = 1], ["orientation", (s) => s.capsule.orientationXYZW[1] = 0.1], ["moving-box", (s) => s.box.velocityMps[0] = 1], ["box-spin", (s) => s.box.angularVelocityRadps[1] = 1], ["wrong-radius", (s) => s.capsule.radiusM = 0.15], ["unknown-profile", (s) => s.profile = "unknown"]]) {
    const s = snapshot();
    edit(s);
    refusal(name, () => api.createRigidCapsuleFaceReference(s), "INVALID_CONFIG", api.ERRORS.profile);
  }
  refusal("numeric-fraction", () => api.advanceHeadOnFaceStep({ snapshot: snapshot(), ...q }, { ...accepted, toiFraction: 2 }, q.stepSeconds), "NUMERIC_LIMIT", api.ERRORS.numeric);
  for (const [name, change, hit, code, message] of [
    ["response-null-hit", {}, null, "NUMERIC_LIMIT", api.ERRORS.numeric],
    ["response-wrong-witness", {}, { ...accepted, pointM: [1, 0, 0] }, "NUMERIC_LIMIT", api.ERRORS.numeric],
    ["response-wrong-normal", {}, { ...accepted, normalFixtureToCapsule: [1, 0, 0] }, "NUMERIC_LIMIT", api.ERRORS.numeric],
    ["response-tangent", { velocityMps: [100, 1, 0] }, null, "INVALID_QUERY", api.ERRORS.movement],
    ["response-footprint", { centerM: [-0.4, 0.8, 0] }, null, "INVALID_QUERY", api.ERRORS.movement],
    ["response-overlap", { centerM: [-0.1009, 0, 0] }, null, "INITIAL_OVERLAP", "Initial capsule overlaps a box"],
    ["response-opposite", { centerM: [0.4, 0, 0] }, null, "INVALID_QUERY", api.ERRORS.movement]
  ]) {
    refusal(name, () => api.advanceHeadOnFaceStep({ snapshot: snapshot(), ...q, ...change }, hit, q.stepSeconds), code, message);
    assert.deepEqual(ref.getSnapshot(), before);
    assert.deepEqual(ref.sweep(q), accepted);
  }
  const marker = new Error("Unexpected reflection failure");
  const proxy = new Proxy({}, { getPrototypeOf() {
    throw marker;
  } });
  assert.throws(() => api.createRigidCapsuleFaceReference(proxy), (e) => e === marker);
  receipts.push({ name: "unexpected-error-propagates", ok: true });
  const publicScene = { version: 1, profile: "upright-capsule-box-v1", revision: "fixture-1280", boxes: [structuredClone(originalReferenceInput.box)] };
  refusal("public-refuses-private-profile", () => api.createUprightCapsuleQuery({ ...publicScene, profile: api.PROFILE }), "INVALID_CONFIG", "Unsupported capsule query profile");
  const pub = api.createUprightCapsuleQuery(publicScene), publicHit = pub.sweep({ revision: publicScene.revision, centerM: [-0.4, 0, 0], displacementM: [100 / 120, 0, 0], excludeId: null });
  assert.ok(publicHit);
  assert.ok(Math.abs(publicHit.toiFraction - 0.2988) <= 1e-12);
  const publicStored = pub.getSnapshot();
  publicScene.boxes[0].centerM[0] = 42;
  publicStored.boxes[0].centerM[0] = 42;
  assert.equal(pub.getSnapshot().boxes[0].centerM[0], 0);
  pub.dispose();
  pub.dispose();
  refusal("public-disposed", () => pub.getSnapshot(), "DISPOSED", "Capsule query is disposed");
  const geometryOnly = structuredClone(fixture.bodies[0]);
  delete geometryOnly.ccd;
  const cap = api.parseBody(geometryOnly), box2 = api.parseBody(structuredClone(fixture.bodies[1]));
  const startContact = api.detect(cap, box2);
  assert.equal(startContact, null);
  cap.positionM = [...full.result.centerM];
  const contact = api.detect(cap, box2);
  if (contact) {
    assert.ok(contact.penetration <= 1e-12);
    assert.ok(Math.abs(contact.normal[0] - 1) <= 1e-12);
  }
  receipts.push({ name: "original-discrete-detect", startContact, contact, discreteOnly: true, ccdRemovedOnlyFromDetachedGeometryCopy: true });
  return { candidates, receipts, fixture, publicHit, fullWorldCCDGO: false, rigidAngularResponseMeasured: false, contactFrictionMeasured: false, physicsWorldCreated: false, physicsWorldStepped: false };
}

// examples/physics-rigid-capsule-ccd-reference/consumer-entry.mjs
var flow = runControls(entry_exports);
var numbers = [];
function collect(value) {
  if (typeof value === "number") numbers.push(value);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
}
collect(flow);
var bytes = Buffer.alloc(numbers.length * 8);
numbers.forEach((v, i) => bytes.writeDoubleLE(v, i * 8));
console.log(JSON.stringify({ flow, rawHex: bytes.toString("hex") }));
