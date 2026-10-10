// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

// packages/barocss-physics/src/capsule-query/profile.ts
var PROFILE = "upright-capsule-box-v1";
var RADIUS_M = 0.15;
var HALF_LENGTH_M = 0.35;
var TIE_FRACTION = 1e-9;
var BOX_CAPACITY = 32;

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
  const length3 = lengthDescriptor.value;
  if (typeof length3 !== "number" || !Number.isInteger(length3) || length3 < 0 || length3 > limit || exact !== void 0 && length3 !== exact || metadata(code, () => Reflect.ownKeys(value)).length !== length3 + 1) {
    refuse(code, "Invalid array length or fields");
  }
  const values = [];
  for (let index = 0; index < length3; index++) {
    const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
    if (!descriptor || !("value" in descriptor)) refuse(code, "Sparse or accessor array");
    values.push(descriptor.value);
  }
  return values;
}
function tuple(value, count, bound, code) {
  return dense(value, count, code, count).map((component) => {
    if (typeof component !== "number" || !Number.isFinite(component) || Math.abs(component) > bound) {
      refuse(code, "Invalid tuple component");
    }
    return component;
  });
}
function identity(value, code) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(value)) {
    refuse(code, "Invalid identity");
  }
  return value;
}
function admitScene(input) {
  const scene2 = record2(input, ["version", "profile", "revision", "boxes"], "INVALID_CONFIG");
  if (scene2.version !== 1 || scene2.profile !== PROFILE) refuse("INVALID_CONFIG", "Unsupported capsule query profile");
  const revision = identity(scene2.revision, "INVALID_CONFIG");
  const boxes = dense(scene2.boxes, BOX_CAPACITY, "INVALID_CONFIG").map((value) => {
    const box2 = record2(value, ["id", "centerM", "halfExtentsM", "orientationXYZW"], "INVALID_CONFIG");
    const id = identity(box2.id, "INVALID_CONFIG");
    const centerM = tuple(box2.centerM, 3, 10, "INVALID_CONFIG");
    const halfExtentsM = tuple(box2.halfExtentsM, 3, 5, "INVALID_CONFIG");
    const orientationXYZW = tuple(box2.orientationXYZW, 4, 1, "INVALID_CONFIG");
    if (halfExtentsM.some((value2) => value2 < 1e-4) || Math.abs(Math.hypot(...orientationXYZW) - 1) > 1e-12) {
      refuse("INVALID_CONFIG", "Invalid box extents or quaternion");
    }
    return { id, centerM, halfExtentsM, orientationXYZW };
  });
  if (new Set(boxes.map((box2) => box2.id)).size !== boxes.length) refuse("INVALID_CONFIG", "Duplicate box ID");
  return { version: 1, profile: PROFILE, revision, boxes };
}
function admitSweep(input, scene2) {
  const query = record2(input, ["revision", "centerM", "displacementM", "excludeId"], "INVALID_QUERY");
  const revision = identity(query.revision, "INVALID_QUERY");
  const centerM = tuple(query.centerM, 3, 5, "INVALID_QUERY");
  const displacementM = tuple(query.displacementM, 3, 2, "INVALID_QUERY");
  if (Math.hypot(...displacementM) > 2) refuse("INVALID_QUERY", "Displacement exceeds 2 metres");
  const excludeId = query.excludeId === null ? null : identity(query.excludeId, "INVALID_QUERY");
  if (revision !== scene2.revision) throw new PhysicsError("STALE_SNAPSHOT", "Revision mismatch");
  if (excludeId !== null && !scene2.boxes.some((box2) => box2.id === excludeId)) refuse("INVALID_QUERY", "Unknown excluded ID");
  return { revision, centerM, displacementM, excludeId };
}

// packages/barocss-physics/src/capsule-query/geometry.ts
function matrix(q) {
  const [x, y, z, w] = q, factor = 2 / (x * x + y * y + z * z + w * w);
  return [
    [1 - factor * (y * y + z * z), factor * (x * y - z * w), factor * (x * z + y * w)],
    [factor * (x * y + z * w), 1 - factor * (x * x + z * z), factor * (y * z - x * w)],
    [factor * (x * z - y * w), factor * (y * z + x * w), 1 - factor * (x * x + y * y)]
  ];
}
var dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function closestCandidate(center, box2) {
  const m = matrix(box2.orientationXYZW), h = box2.halfExtentsM;
  const toLocal = (p) => [0, 1, 2].map((j) => m[0][j] * (p[0] - box2.centerM[0]) + m[1][j] * (p[1] - box2.centerM[1]) + m[2][j] * (p[2] - box2.centerM[2]));
  const toWorld = (p) => m.map((row, i) => dot2(row, p) + box2.centerM[i]);
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
  const normalM = distanceM > 0 ? m.map((row) => dot2(row, difference2) / distanceM) : null;
  return { distanceM, normalM, pointM: toWorld(pointLocal), segmentM: toWorld(segmentLocal) };
}

// packages/barocss-physics/src/capsule-query/sweep.ts
function sweepBox2(center, displacement, box2) {
  let fraction = 0;
  for (let iteration = 0; iteration < 64; iteration++) {
    const at2 = center.map((value, i) => value + fraction * displacement[i]);
    const closest = closestCandidate(at2, box2), gap = closest.distanceM - RADIUS_M;
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
    const closing = -dot2(closest.normalM, displacement);
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
function copyBox(box2) {
  return { id: box2.id, centerM: [...box2.centerM], halfExtentsM: [...box2.halfExtentsM], orientationXYZW: [...box2.orientationXYZW] };
}
function geometryKey(box2) {
  const values = [...box2.centerM, ...box2.halfExtentsM, ...box2.orientationXYZW];
  const bytes = new Uint8Array(80), view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat64(index * 8, value, true));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function groupBoxes(boxes) {
  const groups = /* @__PURE__ */ new Map();
  for (const box2 of boxes) {
    const key = geometryKey(box2), group = groups.get(key);
    if (group) group.ids.push(box2.id);
    else groups.set(key, { representative: copyBox(box2), ids: [box2.id] });
  }
  return Array.from(groups.values());
}
function createUprightCapsuleQuery(input) {
  const scene2 = admitScene(input), groups = groupBoxes(scene2.boxes);
  let disposed = false;
  function live() {
    if (disposed) throw new PhysicsError("DISPOSED", "Capsule query is disposed");
  }
  return {
    sweep(input2) {
      live();
      const query = admitSweep(input2, scene2), hits = [];
      for (const group of groups) {
        let selectedId = null;
        for (const id of group.ids) if (id !== query.excludeId && (selectedId === null || id < selectedId)) selectedId = id;
        if (selectedId === null) continue;
        const hit = sweepBox2(query.centerM, query.displacementM, group.representative);
        if (hit) hits.push({ ...hit, bodyId: selectedId });
      }
      if (!hits.length) return null;
      const minimum = Math.min(...hits.map((hit) => hit.toiFraction));
      return hits.filter((hit) => hit.toiFraction <= minimum + TIE_FRACTION).sort((a, b) => a.bodyId < b.bodyId ? -1 : a.bodyId > b.bodyId ? 1 : 0)[0];
    },
    getSnapshot() {
      live();
      return { version: 1, profile: scene2.profile, revision: scene2.revision, boxes: scene2.boxes.map(copyBox) };
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
function refuse2(code, message) {
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
    refuse2(code, "Expected an ordinary controller record");
  }
  const own = metadata2(code, () => Reflect.ownKeys(value));
  if (own.length !== keys.length || own.some((key) => typeof key !== "string" || !keys.includes(key))) {
    refuse2(code, "Unexpected controller fields");
  }
  const copy = {};
  for (const key of keys) {
    const descriptor = metadata2(code, () => Object.getOwnPropertyDescriptor(value, key));
    if (!descriptor || !("value" in descriptor)) refuse2(code, "Controller accessors are not admitted");
    copy[key] = descriptor.value;
  }
  return copy;
}
function tuple2(value, bound, code) {
  if (!metadata2(code, () => Array.isArray(value)) || metadata2(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
    refuse2(code, "Expected an ordinary controller tuple");
  }
  const length3 = metadata2(code, () => Object.getOwnPropertyDescriptor(value, "length"));
  if (!length3 || !("value" in length3) || length3.value !== 3 || metadata2(code, () => Reflect.ownKeys(value)).length !== 4) {
    refuse2(code, "Invalid controller tuple length or fields");
  }
  const copy = [];
  for (let index = 0; index < 3; index++) {
    const descriptor = metadata2(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value) || Math.abs(descriptor.value) > bound) {
      refuse2(code, "Invalid controller tuple component");
    }
    copy.push(descriptor.value);
  }
  return copy;
}
function admitConfig(input) {
  const config2 = record3(input, ["version", "profile", "scene", "positionM"], "INVALID_CONFIG");
  if (config2.version !== 1 || config2.profile !== PROFILE2) refuse2("INVALID_CONFIG", "Unsupported controller profile");
  const positionM = tuple2(config2.positionM, 5, "INVALID_CONFIG");
  return { scene: config2.scene, positionM };
}
function admitCommand(input) {
  const command2 = record3(input, ["dtSeconds", "sceneRevision", "desiredVelocityMps"], "INVALID_COMMAND");
  if (typeof command2.dtSeconds !== "number" || !Number.isFinite(command2.dtSeconds)) refuse2("INVALID_COMMAND", "Invalid controller time");
  if (typeof command2.sceneRevision !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(command2.sceneRevision)) {
    refuse2("INVALID_COMMAND", "Invalid controller revision");
  }
  const desiredVelocityMps = tuple2(command2.desiredVelocityMps, 1, "INVALID_COMMAND");
  if (desiredVelocityMps[1] !== 0 || Math.hypot(desiredVelocityMps[0], desiredVelocityMps[2]) > 1) {
    refuse2("INVALID_COMMAND", "Controller horizontal request exceeds its bound");
  }
  return { dtSeconds: command2.dtSeconds, sceneRevision: command2.sceneRevision, desiredVelocityMps };
}
function admitCoreCommand(dt, velocity, revision, stateRevision, stepIndex) {
  const command2 = admitCommand({ dtSeconds: dt, sceneRevision: revision, desiredVelocityMps: velocity });
  if (command2.dtSeconds !== DT) throw new PhysicsError("INVALID_STEP", "Controller requires exactly 1/120 second");
  if (command2.sceneRevision !== stateRevision) throw new PhysicsError("STALE_SNAPSHOT", "Controller revision mismatch");
  if (stepIndex >= STEPS) throw new PhysicsError("WORLD_LIMIT", "Controller step limit exhausted");
  return command2.desiredVelocityMps;
}

// packages/barocss-physics/src/character/math.ts
var dot3 = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
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
    if (first.hit?.toiFraction === 0 && dot3(first.hit.normalFixtureToCapsule, delta) >= -1e-12) {
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
  const horizontal = [remaining[0], 0, remaining[2]], length3 = norm(horizontal);
  if (length3 <= 1e-12 || !candidate.grounded) return null;
  const direction = scale2(horizontal, 1 / length3);
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
    const length3 = norm(remaining), direction = scale2(remaining, 1 / length3), probeLength = length3 + LOOKAHEAD;
    const result = context.sweep(p, scale2(direction, probeLength), "slide-lookahead", true), hit = result.hit;
    if (!hit) return context.commit(p, remaining, "travel", result.indices);
    const normal = hit.normalFixtureToCapsule, closingUnit = -dot3(normal, direction);
    if (closingUnit <= 1e-12) throw new PhysicsError("INVALID_COMMAND", "Controller lookahead closing normal is unresolved");
    const contactDistance = probeLength * hit.toiFraction;
    const safeDistance = Math.max(0, contactDistance - SKIN / closingUnit);
    const fraction = Math.min(1, safeDistance / length3);
    const travel = scale2(remaining, fraction);
    if (norm(travel) > 0) p = context.commit(p, travel, "travel", result.indices);
    if (fraction === 1) return p;
    remaining = scale2(remaining, 1 - fraction);
    if (normal[1] < WALKABLE) {
      const stepped = tryStep(p, remaining, candidate, context);
      if (stepped) return stepped;
      candidate.blocked = true;
      const horizontalNormal = [normal[0], 0, normal[2]], size = norm(horizontalNormal);
      if (size > 1e-12) {
        const unit = scale2(horizontalNormal, 1 / size), into = dot3(remaining, unit);
        if (into < 0) remaining = add2(remaining, scale2(unit, -into));
      }
      if (normal[1] > 1e-12 && remaining[1] < 0) {
        remaining[1] = 0;
        candidate.fallVelocityYMps = 0;
      } else if (normal[1] < -1e-12 && remaining[1] > 0) remaining[1] = 0;
    } else {
      const into = dot3(remaining, normal);
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
function createCharacterCore(scene2, positionM, diagnostic = {}, options = {}) {
  const admitted = admitConfig({ version: 1, profile: PROFILE2, scene: scene2, positionM });
  const query = createUprightCapsuleQuery(admitted.scene);
  let state;
  try {
    const snapshot3 = query.getSnapshot();
    query.sweep({ revision: snapshot3.revision, centerM: [...admitted.positionM], displacementM: [0, 0, 0], excludeId: null });
    state = initialState(admitted.positionM, snapshot3.revision);
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
function createUprightCapsuleController(config2) {
  const admitted = admitConfig(config2);
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
      const command2 = admitCommand(input);
      return projectState(core.step(command2.dtSeconds, command2.desiredVelocityMps, command2.sceneRevision));
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        core.dispose();
      }
    }
  };
}

// examples/physics-character-viewer/fixture.mjs
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
var identity2 = () => [0, 0, 0, 1];
var box = (id, centerM, halfExtentsM, orientationXYZW = identity2()) => ({ id, centerM, halfExtentsM, orientationXYZW });
var floor = () => box("floor", [0, -0.05, 0], [3, 0.05, 1]);
var step = () => box("step10", [0.5, 0.05, 0], [0.25, 0.05, 0.75]);
var angle = 15 * Math.PI / 180;
var slope = () => box(
  "slope15",
  [0.05 * Math.sin(angle), -0.05 * Math.cos(angle), 0],
  [3, 0.05, 1],
  [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]
);
var scene = (boxes) => ({ version: 1, profile: "upright-capsule-box-v1", revision: "movementRef1", boxes });
var make = (name, boxes, positionM, requestMps, expectedError = null) => ({
  name,
  scene: scene(boxes),
  positionM,
  requestMps,
  expectedError
});
var CASES = freeze([
  make("REST", [floor()], [0, 0.505, 0], [0, 0, 0]),
  make("FLAT", [floor()], [-1, 0.505, 0], [1, 0, 0]),
  make("STEP10", [floor(), step()], [-1, 0.505, 0], [1, 0, 0]),
  make("SLOPE15", [slope()], [-0.75, Math.tan(angle) * -0.75 + 0.35 + (0.15 + 5e-3) / Math.cos(angle), 0], [1, 0, 0]),
  make("HEADROOM", [floor(), step(), box("headroom", [0, 1.105, 0], [3, 0.05, 1])], [-1, 0.505, 0], [1, 0, 0]),
  make("TOO_HIGH15", [floor(), box("step15", [0.5, 0.075, 0], [0.25, 0.075, 0.75])], [-1, 0.505, 0], [1, 0, 0]),
  make("WALL_SLIDE", [floor(), box("wall", [0.5, 0.6, 0], [0.05, 1, 1])], [-1, 0.505, 0], [Math.sqrt(0.75), 0, 0.5]),
  make("SPAWN_OVERLAP", [floor()], [0, 0.495, 0], [0, 0, 0], "INITIAL_OVERLAP")
]);

// examples/physics-character-viewer/frame.mjs
var DT2 = 1 / 120;
var copyData = (x) => structuredClone(x);
var config = (f) => ({ version: 1, profile: "upright-capsule-controller-v1", scene: copyData(f.scene), positionM: [...f.positionM] });
var command = (f) => ({ dtSeconds: DT2, sceneRevision: f.scene.revision, desiredVelocityMps: [...f.requestMps] });

// examples/physics-character-viewer/binary.mjs
function numbers(value, out = []) {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) for (const item of value) numbers(item, out);
  else if (value && typeof value === "object") for (const key of Object.keys(value).sort()) numbers(value[key], out);
  return out;
}
function encode(values) {
  const bytes = new Uint8Array(values.length * 8), view = new DataView(bytes.buffer);
  values.forEach((v, i) => view.setFloat64(i * 8, v, true));
  return bytes;
}
var hex = (bytes) => Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");

// packages/barocss-cad/src/math.ts
var MAX_SAMPLES = 4096;
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
function validateId(id) {
  requireValue(typeof id === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id), "Object ID must be a supported identifier");
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
function surfaceDomain(surface) {
  validateSurface(surface);
  return {
    u: [surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]],
    v: [surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]]
  };
}
function basis(knots, degree, count, parameter) {
  const left = knots[degree];
  const right = knots[count];
  requireValue(Number.isFinite(parameter) && parameter >= left && parameter <= right, "Parameter is outside the knot domain");
  let span = count - 1;
  if (parameter !== right) {
    let low = degree;
    let high = count;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (knots[mid] <= parameter) low = mid;
      else high = mid;
    }
    span = low;
  }
  const values = Array(degree + 1).fill(0);
  const distancesLeft = Array(degree + 1).fill(0);
  const distancesRight = Array(degree + 1).fill(0);
  values[0] = 1;
  const scale3 = Math.max(1, Math.abs(left), Math.abs(right));
  const distance2 = (a, b) => {
    const difference2 = a - b;
    return Number.isFinite(difference2) ? difference2 / scale3 : a / scale3 - b / scale3;
  };
  for (let level = 1; level <= degree; level++) {
    distancesLeft[level] = distance2(parameter, knots[span + 1 - level]);
    distancesRight[level] = distance2(knots[span + level], parameter);
    let saved = 0;
    for (let index = 0; index < level; index++) {
      const denominator = distancesRight[index + 1] + distancesLeft[level - index];
      const previousValue = values[index];
      const rightFraction = denominator === 0 ? 0 : distancesRight[index + 1] / denominator;
      const leftFraction = denominator === 0 ? 0 : distancesLeft[level - index] / denominator;
      values[index] = saved + rightFraction * previousValue;
      saved = leftFraction * previousValue;
    }
    values[level] = saved;
  }
  requireValue(values.every(Number.isFinite), "Knot arithmetic exceeded the finite range");
  return { start: span - degree, values };
}
function project(sum, weight) {
  requireValue(Number.isFinite(weight) && weight > 0, "Rational denominator must be positive and finite");
  const point = [sum[0] / weight, sum[1] / weight, sum[2] / weight];
  requireValue(point.every(Number.isFinite), "Evaluated coordinates must be finite");
  return point;
}
function surfacePoint(surface, u, v) {
  const basisU = basis(surface.knotsU, surface.degreeU, surface.controlPoints.length, u);
  const basisV = basis(surface.knotsV, surface.degreeV, surface.controlPoints[0].length, v);
  const sum = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < basisU.values.length; i++) {
    for (let j = 0; j < basisV.values.length; j++) {
      const row = basisU.start + i;
      const column = basisV.start + j;
      const factor = basisU.values[i] * basisV.values[j] * surface.weights[row][column];
      weight += factor;
      for (let axis = 0; axis < 3; axis++) sum[axis] += factor * surface.controlPoints[row][column][axis];
    }
  }
  return project(sum, weight);
}
function evaluateSurface(surface, u, v) {
  validateSurface(surface);
  return surfacePoint(surface, u, v);
}
function sampleCount(count) {
  requireValue(Number.isInteger(count) && count >= 2 && count <= MAX_SAMPLES, "Sample count must be an integer in 2..4096");
}
function parameterAt(left, right, index, count) {
  if (index === 0) return left;
  if (index === count - 1) return right;
  const fraction = index / (count - 1);
  return (1 - fraction) * left + fraction * right;
}
function sampleSurface(surface, countU, countV) {
  sampleCount(countU);
  sampleCount(countV);
  requireValue(countU * countV <= MAX_SAMPLES, "Surface sample count must not exceed 4096");
  const domain = surfaceDomain(surface);
  return Array.from({ length: countU }, (_, i) => {
    const u = parameterAt(domain.u[0], domain.u[1], i, countU);
    return Array.from({ length: countV }, (_2, j) => {
      const v = parameterAt(domain.v[0], domain.v[1], j, countV);
      return { u, v, point: surfacePoint(surface, u, v) };
    });
  });
}

// packages/barocss-cad/src/packet.ts
function requireValue2(condition, message) {
  if (!condition) throw new RangeError(`Invalid preview packet: ${message}`);
}
function field(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  requireValue2(
    descriptor !== void 0 && "value" in descriptor && descriptor.enumerable === true,
    `${key} must be an own enumerable data property`
  );
  return descriptor.value;
}
function plainObject(value, keys, name) {
  requireValue2(typeof value === "object" && value !== null && !Array.isArray(value), `${name} must be a plain object`);
  const prototype = Object.getPrototypeOf(value);
  requireValue2(prototype === Object.prototype || prototype === null, `${name} must be a plain object`);
  const actual = Reflect.ownKeys(value);
  requireValue2(
    actual.length === keys.length && actual.every((key) => typeof key === "string" && keys.includes(key)),
    `${name} has missing or unsupported fields`
  );
  for (const key of keys) field(value, key);
}
function arraySize(value, minimum, maximum, multiple, name) {
  requireValue2(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype, `${name} must be a plain array`);
  const length3 = Object.getOwnPropertyDescriptor(value, "length")?.value;
  requireValue2(typeof length3 === "number" && Number.isInteger(length3) && length3 >= minimum && length3 <= maximum && length3 % multiple === 0, `${name} has an invalid length`);
}
function finiteArray(array, name) {
  const length3 = Object.getOwnPropertyDescriptor(array, "length").value;
  requireValue2(Reflect.ownKeys(array).length === length3 + 1, `${name} must be dense without extra fields`);
  for (let index = 0; index < length3; index++) {
    const value = field(array, String(index));
    requireValue2(typeof value === "number" && Number.isFinite(value), `${name} must contain finite numbers`);
  }
}
function at(array, index) {
  return field(array, String(index));
}
function validatePreviewPacket(packet) {
  plainObject(packet, [
    "version",
    "surfaceId",
    "revision",
    "lengthUnit",
    "coordinateSystem",
    "winding",
    "positions",
    "normals",
    "indices",
    "parameters",
    "bounds"
  ], "packet");
  requireValue2(field(packet, "version") === 0, "unsupported version");
  const id = field(packet, "surfaceId");
  requireValue2(typeof id === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id), "surfaceId must be a supported ASCII identifier");
  const revision = field(packet, "revision");
  requireValue2(
    typeof revision === "number" && Number.isInteger(revision) && revision >= 0 && revision <= 2147483647,
    "revision must be an integer in 0..2147483647"
  );
  requireValue2(field(packet, "lengthUnit") === "mm", "lengthUnit must be mm");
  requireValue2(field(packet, "coordinateSystem") === "right-handed-y-up", "unsupported coordinate system");
  requireValue2(field(packet, "winding") === "ccw", "winding must be ccw");
  const positions = field(packet, "positions");
  const normals = field(packet, "normals");
  const indices = field(packet, "indices");
  const parameters = field(packet, "parameters");
  const bounds = field(packet, "bounds");
  arraySize(positions, 12, 12288, 3, "positions");
  arraySize(normals, 12, 12288, 3, "normals");
  arraySize(indices, 6, 23814, 3, "indices");
  arraySize(parameters, 8, 8192, 2, "parameters");
  const vertices = positions.length / 3;
  requireValue2(normals.length === positions.length && parameters.length === vertices * 2, "vertex arrays do not match");
  plainObject(bounds, ["min", "max"], "bounds");
  const minimum = field(bounds, "min");
  const maximum = field(bounds, "max");
  arraySize(minimum, 3, 3, 3, "bounds.min");
  arraySize(maximum, 3, 3, 3, "bounds.max");
  finiteArray(positions, "positions");
  finiteArray(normals, "normals");
  finiteArray(indices, "indices");
  finiteArray(parameters, "parameters");
  finiteArray(minimum, "bounds.min");
  finiteArray(maximum, "bounds.max");
  for (let vertex = 0; vertex < vertices; vertex++) {
    for (let component = 0; component < 3; component++) {
      requireValue2(Math.abs(at(positions, vertex * 3 + component)) <= 1e6, "position exceeds the coordinate bound");
    }
    const length3 = Math.hypot(at(normals, vertex * 3), at(normals, vertex * 3 + 1), at(normals, vertex * 3 + 2));
    requireValue2(Number.isFinite(length3) && Math.abs(length3 - 1) <= 1e-5, "normal must have unit length within 1e-5");
  }
  for (let component = 0; component < 3; component++) {
    let low = Infinity;
    let high = -Infinity;
    for (let vertex = 0; vertex < vertices; vertex++) {
      const value = at(positions, vertex * 3 + component);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    requireValue2(at(minimum, component) === low && at(maximum, component) === high, "bounds must exactly match positions");
  }
  for (let index = 0; index < indices.length; index += 3) {
    const a = at(indices, index);
    const b = at(indices, index + 1);
    const c = at(indices, index + 2);
    requireValue2(Number.isInteger(a) && a >= 0 && a < vertices && Number.isInteger(b) && b >= 0 && b < vertices && Number.isInteger(c) && c >= 0 && c < vertices, "triangle index is outside the vertex range");
    requireValue2(a !== b && b !== c && a !== c, "triangle repeats a vertex index");
    const ux = at(positions, b * 3) - at(positions, a * 3);
    const uy = at(positions, b * 3 + 1) - at(positions, a * 3 + 1);
    const uz = at(positions, b * 3 + 2) - at(positions, a * 3 + 2);
    const vx = at(positions, c * 3) - at(positions, a * 3);
    const vy = at(positions, c * 3 + 1) - at(positions, a * 3 + 1);
    const vz = at(positions, c * 3 + 2) - at(positions, a * 3 + 2);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const area = Math.hypot(nx, ny, nz);
    requireValue2(Number.isFinite(area) && area > 0, "triangle must have finite nonzero area");
    for (let corner = 0; corner < 3; corner++) {
      const vertex = at(indices, index + corner);
      const dot6 = nx * at(normals, vertex * 3) + ny * at(normals, vertex * 3 + 1) + nz * at(normals, vertex * 3 + 2);
      requireValue2(Number.isFinite(dot6) && dot6 > 0, "triangle winding must agree with each vertex normal");
    }
  }
}

// packages/barocss-cad/src/preview.ts
function requireValue3(condition, message) {
  if (!condition) throw new RangeError(message);
}
var subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var scaled = (a, scale3) => [a[0] / scale3, a[1] / scale3, a[2] / scale3];
var positionAt = (positions, index) => [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
function triangleDistance(p, a, b, c) {
  const abRaw = subtract(b, a), acRaw = subtract(c, a), apRaw = subtract(p, a);
  const scale3 = Math.max(...abRaw.map(Math.abs), ...acRaw.map(Math.abs), ...apRaw.map(Math.abs));
  requireValue3(Number.isFinite(scale3) && scale3 > 0, "Invalid triangle distance scale");
  const ab = scaled(abRaw, scale3), ac = scaled(acRaw, scale3), ap = scaled(apRaw, scale3);
  const d1 = dot4(ab, ap), d2 = dot4(ac, ap);
  let closest;
  if (d1 <= 0 && d2 <= 0) closest = [0, 0, 0];
  else {
    const bp = subtract(ap, ab), d3 = dot4(ab, bp), d4 = dot4(ac, bp);
    if (d3 >= 0 && d4 <= d3) closest = ab;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const t = d1 / (d1 - d3);
        closest = ab.map((value) => value * t);
      } else {
        const cp = subtract(ap, ac), d5 = dot4(ab, cp), d6 = dot4(ac, cp);
        if (d6 >= 0 && d5 <= d6) closest = ac;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const t = d2 / (d2 - d6);
            closest = ac.map((value) => value * t);
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
              closest = ab.map((value, axis) => value + t * (ac[axis] - value));
            } else {
              const denominator = va + vb + vc;
              requireValue3(Number.isFinite(denominator) && denominator > 0, "Nonfinite triangle projection");
              closest = ab.map((value, axis) => value * (vb / denominator) + ac[axis] * (vc / denominator));
            }
          }
        }
      }
    }
  }
  const result = Math.hypot(...subtract(ap, closest)) * scale3;
  requireValue3(Number.isFinite(result), "Nonfinite triangle distance");
  return result;
}
function tessellateSurface(surface, options) {
  requireValue3(options !== null && typeof options === "object", "Tessellation options are required");
  const { countU, countV, revision } = options;
  requireValue3(Number.isInteger(countU) && countU >= 2 && countU <= 64 && Number.isInteger(countV) && countV >= 2 && countV <= 64, "Grid counts must be integers in 2..64");
  requireValue3(Number.isInteger(revision) && revision >= 0 && revision <= 2147483647, "Revision must be an integer in 0..2147483647");
  const vertexCount = countU * countV, cellCount = (countU - 1) * (countV - 1);
  requireValue3(vertexCount <= 4096 && cellCount <= 3969 && cellCount * 5 <= 19845, "Preview workload exceeds bounds");
  validateSurface(surface);
  const samples = sampleSurface(surface, countU, countV);
  const positions = [], parameters = [], indices = [];
  const normals = Array(vertexCount * 3).fill(0);
  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  for (const row of samples) for (const { u, v, point } of row) {
    requireValue3(point.every((value) => Number.isFinite(value) && Math.abs(value) <= 1e6), "Preview positions exceed finite coordinate bounds");
    positions.push(...point);
    parameters.push(u, v);
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(maximum[axis], point[axis]);
    }
  }
  const triangle = (a, b, c) => {
    const normal = cross2(subtract(positionAt(positions, b), positionAt(positions, a)), subtract(positionAt(positions, c), positionAt(positions, a)));
    const area = Math.hypot(...normal);
    requireValue3(Number.isFinite(area) && area > 0, "Collapsed or nonfinite preview triangle");
    indices.push(a, b, c);
    for (const vertex of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[vertex * 3 + axis] += normal[axis];
  };
  for (let i = 0; i < countU - 1; i++) for (let j = 0; j < countV - 1; j++) {
    const a = i * countV + j, b = (i + 1) * countV + j, c = a + 1, d = b + 1;
    triangle(a, b, c);
    triangle(b, d, c);
  }
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const length3 = Math.hypot(...positionAt(normals, vertex));
    requireValue3(Number.isFinite(length3) && length3 > 0, "Cancelling or zero incident preview normals");
    for (let axis = 0; axis < 3; axis++) normals[vertex * 3 + axis] /= length3;
  }
  const packet = { version: 0, surfaceId: surface.id, revision, lengthUnit: "mm", coordinateSystem: "right-handed-y-up", winding: "ccw", positions, normals, indices, parameters, bounds: { min: minimum, max: maximum } };
  validatePreviewPacket(packet);
  let maxSampledDeviationMM = 0;
  const probes = [[0.5, 0.5], [0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]];
  for (let i = 0; i < countU - 1; i++) for (let j = 0; j < countV - 1; j++) {
    const a = samples[i][j].point, b = samples[i + 1][j].point, c = samples[i][j + 1].point, d = samples[i + 1][j + 1].point;
    for (const [fractionU, fractionV] of probes) {
      const u = (1 - fractionU) * samples[i][j].u + fractionU * samples[i + 1][j].u;
      const v = (1 - fractionV) * samples[i][j].v + fractionV * samples[i][j + 1].v;
      const point = evaluateSurface(surface, u, v);
      const distance2 = Math.min(triangleDistance(point, a, b, c), triangleDistance(point, b, d, c));
      maxSampledDeviationMM = Math.max(maxSampledDeviationMM, distance2);
    }
  }
  return { packet, report: {
    grid: { countU, countV },
    vertexCount,
    triangleCount: cellCount * 2,
    cellCount,
    probeCount: cellCount * 5,
    domain: { u: [samples[0][0].u, samples[countU - 1][0].u], v: [samples[0][0].v, samples[0][countV - 1].v] },
    normalMethod: "area-weighted-incident-triangle",
    maxSampledDeviationMM,
    certified: false
  } };
}

// packages/barocss-cad/src/extrusion-validation.ts
function dyadic(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
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
function whollyCollinear(curve, vector2) {
  const direction = vector2.map(dyadic);
  const origin = curve.controlPoints[0].map(dyadic);
  for (let index = 1; index < curve.controlPoints.length; index++) {
    const offset = curve.controlPoints[index].map((value, axis) => difference(dyadic(value), origin[axis]));
    for (let axis = 0; axis < 3; axis++) {
      const next = (axis + 1) % 3;
      if (!equal(product(offset[axis], direction[next]), product(offset[next], direction[axis]))) return false;
    }
  }
  return true;
}
function preflightExtrusion(curve, options) {
  validateCurve(curve);
  if (curve.controlPoints.length > 16) throw new Error("Extrusion supports at most 16 curve control points");
  if (!options || typeof options !== "object") throw new Error("Extrusion options are required");
  const { id, vector: vector2 } = options;
  if (typeof id !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id) || id === curve.id) {
    throw new Error("Extrusion output ID must be a supported ASCII identifier distinct from the curve ID");
  }
  if (!Array.isArray(vector2) || vector2.length !== 3) throw new Error("Extrusion vector must have three coordinates");
  let nonzero = false;
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(vector2[axis])) throw new Error("Extrusion vector must be finite");
    nonzero ||= vector2[axis] !== 0;
  }
  if (!nonzero) throw new Error("Extrusion vector must be nonzero");
  let translated = false;
  for (const point of curve.controlPoints) {
    for (let axis = 0; axis < 3; axis++) {
      const value = point[axis] + vector2[axis];
      if (!Number.isFinite(value) || Math.abs(value) > 1e6) throw new Error("Extruded coordinates must be finite and within 1e6 mm");
      translated ||= value !== point[axis];
    }
  }
  if (!translated) throw new Error("Extrusion vector produces no representable pole displacement");
  if (whollyCollinear(curve, vector2)) throw new Error("Extrusion is wholly collapsed: all pole displacements are collinear with the vector");
  return { id, vector: vector2 };
}

// packages/barocss-cad/src/extrusion.ts
function extrudeCurve(curve, options) {
  const { id, vector: vector2 } = preflightExtrusion(curve, options);
  return {
    kind: "surface",
    id,
    degreeU: curve.degree,
    degreeV: 1,
    knotsU: [...curve.knots],
    knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((point) => [
      [point[0], point[1], point[2]],
      [point[0] + vector2[0], point[1] + vector2[1], point[2] + vector2[2]]
    ]),
    weights: curve.weights.map((weight) => [weight, weight])
  };
}

// packages/barocss-cad/src/expression-parser.ts
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
  const consume = (text) => {
    cursor.skip();
    if (!cursor.source.startsWith(text, cursor.offset())) cursor.fail("SYNTAX", "Expected " + text);
    cursor.token();
    cursor.advance(text.length);
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
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(cursor.source.slice(start));
    if (!match) cursor.fail("SYNTAX", "Expected number, $parameter or parenthesized expression");
    const value = Number(match[0]);
    if (!Number.isFinite(value) || value > CAD_EXPRESSION_LIMITS.literalMagnitude) cursor.fail("VALUE", "Number magnitude must be finite and at most 1e12", start, start + match[0].length);
    reserve();
    cursor.token();
    cursor.advance(match[0].length);
    const numberEnd = cursor.offset();
    cursor.skip();
    let unit;
    const unitStart = cursor.offset();
    let unitEnd = unitStart;
    const suffix = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(unitStart));
    if (suffix) {
      if (suffix[0] !== "mm" && suffix[0] !== "cm" && suffix[0] !== "m") cursor.fail("UNIT", "Unsupported length unit " + suffix[0], unitStart, unitStart + suffix[0].length);
      unit = suffix[0];
      cursor.token();
      cursor.advance(suffix[0].length);
      unitEnd = cursor.offset();
    }
    const expression2 = { kind: "number", value, range: cursor.range(start, unit ? unitEnd : numberEnd) };
    if (unit) {
      expression2.unit = unit;
      expression2.unitRange = cursor.range(unitStart, unitEnd);
    }
    return { expression: expression2, depth: 1 };
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

// packages/barocss-cad/src/source-ast.ts
var CadAstError = class extends Error {
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
  if (sourceVersion !== 0 && sourceVersion !== 1 && sourceVersion !== 2) throw new TypeError("Source version must be 0, 1 or 2");
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
  let at2 = 0, tokens = 0, values = 0, nodes = 0, expressionNodes = 0, geometryCount = 0, parameterCount = 0, objectId;
  const declarations = [], modelFields = [];
  const fail = (code, detail, start = at2, end = Math.min(source.length, start + 1)) => {
    throw new CadAstError(code, detail, range(start, end), objectId);
  };
  const chargeToken = () => {
    if (tokens >= CAD_AST_LIMITS.tokens) fail("LIMIT", "Source exceeds AST token limit");
    tokens++;
  };
  const chargeNode = (isValue = false) => {
    if (nodes >= CAD_AST_LIMITS.nodes || isValue && values >= CAD_AST_LIMITS.values) fail("LIMIT", "Source exceeds AST value/node limit");
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
        if (end < 0) fail("SYNTAX", "Unterminated comment");
        at2 = end + 2;
        continue;
      }
      break;
    }
  };
  const take = (token) => {
    skip();
    if (!source.startsWith(token, at2)) fail("SYNTAX", "Expected " + token);
    chargeToken();
    at2 += token.length;
  };
  const ident = (parameter = false) => {
    skip();
    const start = at2, match = (parameter ? /^[A-Za-z_][A-Za-z0-9_]*/ : /^[A-Za-z_][A-Za-z0-9_-]*/).exec(source.slice(at2));
    if (!match) return fail("SYNTAX", "Expected identifier");
    chargeToken();
    at2 += match[0].length;
    return { value: match[0], range: range(start, at2) };
  };
  const numeric = (required) => {
    skip();
    const start = at2, match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(at2));
    if (!match) {
      if (required) fail("VALUE", "Expected finite decimal literal");
      return void 0;
    }
    chargeToken();
    at2 += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail("VALUE", "Number must be finite", required ? start : at2, required ? at2 : Math.min(source.length, at2 + 1));
    chargeNode(true);
    return { kind: "number", value, range: range(start, at2) };
  };
  const expression2 = () => parseCadExpression({
    source,
    offset: () => at2,
    advance: (count) => {
      at2 += count;
    },
    skip,
    token: chargeToken,
    range,
    fail,
    reserveNode: () => {
      if (expressionNodes >= CAD_EXPRESSION_LIMITS.aggregateNodes) fail("LIMIT", "Model exceeds 32768 aggregate expression nodes");
      chargeNode(true);
      expressionNodes++;
    }
  });
  const astValue = (bounds, depth = 0, expressions = false) => {
    skip();
    const start = at2;
    if (source[at2] === "[") {
      if (depth >= bounds.length || depth >= CAD_AST_LIMITS.arrayDepth) fail("DIMENSION", "Array nesting exceeds field dimension");
      chargeNode(true);
      take("[");
      const items = [];
      skip();
      if (source[at2] !== "]") while (true) {
        if (items.length >= bounds[depth]) fail("LIMIT", "Array exceeds field limit");
        items.push(astValue(bounds, depth + 1, expressions));
        skip();
        if (source[at2] !== ",") break;
        take(",");
        skip();
        if (source[at2] === "]") fail("SYNTAX", "Trailing comma is unsupported");
      }
      take("]");
      return { kind: "array", items, range: range(start, at2) };
    }
    if (expressions) return expression2();
    const number = numeric(false);
    if (number) return number;
    const identifier2 = ident();
    chargeNode(true);
    return { kind: "identifier", value: identifier2.value, range: identifier2.range };
  };
  const field2 = (allowed, surface, seen, mode) => {
    skip();
    const start = at2, key = ident();
    if (!allowed.includes(key.value)) fail("FIELD", "Unsupported " + (sourceVersion === 1 && mode !== "literal" ? mode === "model" ? "model " : "extrusion " : "") + "field " + key.value, start, sourceVersion === 1 && mode !== "literal" ? at2 : Math.min(source.length, start + 1));
    if (sourceVersion === 1 && mode !== "literal" && seen.has(key.value)) fail("DUPLICATE", "Duplicate field " + key.value, start, at2);
    take(":");
    let value;
    if (sourceVersion >= 1 && mode === "model") {
      if (key.value === "version") value = numeric(true);
      else {
        const identifier2 = ident();
        chargeNode(true);
        value = { kind: "identifier", value: identifier2.value, range: identifier2.range };
      }
    } else if (sourceVersion === 2 && mode === "parameter" && key.value === "value") {
      value = expression2();
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
        const x = sourceVersion === 2 ? expression2() : numeric(true);
        take(",");
        const y = sourceVersion === 2 ? expression2() : numeric(true);
        take(",");
        const z = sourceVersion === 2 ? expression2() : numeric(true);
        take("]");
        value = { kind: "array", items: [x, y, z], range: range(vectorStart, at2) };
      }
    } else {
      const bounds = surface && key.value === "control-points" ? [16, 16, 3] : surface && key.value === "weights" ? [16, 16] : fieldBounds[key.value] ?? [];
      value = astValue(bounds, 0, sourceVersion === 2 && mode === "literal" && key.value !== "type");
    }
    take(";");
    if (seen.has(key.value)) fail("DUPLICATE", "Duplicate field " + key.value, start, Math.min(source.length, start + 1));
    seen.add(key.value);
    chargeNode();
    return { name: key.value, value, range: range(start, at2), nameRange: key.range };
  };
  skip();
  const modelStart = at2;
  chargeNode();
  take("@");
  if (ident().value !== "model") fail("SYNTAX", "Expected @model", sourceVersion === 1 ? 0 : at2);
  const modelIdentifier = ident();
  take("{");
  const headerNames = /* @__PURE__ */ new Set(), ids = /* @__PURE__ */ new Set();
  while (true) {
    skip();
    if (source[at2] === "}") {
      take("}");
      break;
    }
    objectId = void 0;
    if (source[at2] !== "@") {
      modelFields.push(field2(["version", "length-unit"], false, headerNames, "model"));
      continue;
    }
    const start = at2;
    take("@");
    const kind = ident().value;
    if (!(sourceVersion === 0 ? kind === "curve" || kind === "surface" : sourceVersion === 1 ? kind === "curve" || kind === "extrude" : kind === "curve" || kind === "surface" || kind === "extrude" || kind === "parameter")) fail("KIND", (sourceVersion === 0 ? "Unsupported object " : "Unsupported declaration ") + kind, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at2);
    if (kind === "parameter" ? parameterCount >= 64 : geometryCount >= CAD_AST_LIMITS.declarations) fail("LIMIT", kind === "parameter" ? "Model exceeds 64 parameters" : "Model exceeds 16 geometry declarations", start);
    skip();
    const idStart = at2;
    take("#");
    const identifier2 = ident(kind === "parameter");
    objectId = identifier2.value;
    if (ids.has(objectId)) fail("DUPLICATE", "Duplicate ID " + objectId, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at2);
    ids.add(objectId);
    if (kind === "parameter") parameterCount++;
    else geometryCount++;
    take("{");
    const fields2 = [], seen = /* @__PURE__ */ new Set();
    while (true) {
      skip();
      if (source[at2] === "}") {
        take("}");
        break;
      }
      fields2.push(field2(kind === "curve" ? curveFields : kind === "surface" ? surfaceFields : kind === "parameter" ? ["type", "value"] : ["curve", "vector"], kind === "surface", seen, kind === "extrude" ? "extrude" : kind === "parameter" ? "parameter" : "literal"));
    }
    chargeNode();
    declarations.push({ kind, id: objectId, range: range(start, at2), idRange: range(idStart, identifier2.range.end), fields: fields2 });
  }
  const modelEnd = at2;
  objectId = void 0;
  skip();
  if (at2 !== source.length) fail("SYNTAX", "Unexpected content after model");
  return { kind: "model", name: modelIdentifier.value, range: range(modelStart, modelEnd), nameRange: modelIdentifier.range, fields: modelFields, declarations };
}

// packages/barocss-cad/src/data-copy.ts
function copyCadData(value) {
  if (Array.isArray(value)) return value.map((item) => copyCadData(item));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyCadData(item)]));
  return value;
}

// packages/barocss-cad/src/parameter-semantics.ts
var numericFields = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function expression(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group") return value;
  throw new CadAstError("TYPE", "A numeric expression is required", value.range, owner);
}
function references(value) {
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
    for (const field2 of declaration.fields) {
      if (!numericFields.has(field2.name)) continue;
      const required = field2.name === "control-points" || field2.name === "vector" ? "length" : "scalar";
      const walk = (value, indices) => {
        if (value.kind === "array") {
          value.items.forEach((item, index) => walk(item, [...indices, index]));
          return;
        }
        const expr = expression(value, declaration.id), refs = addReferences(declaration.id, expr);
        leaves.push({ objectId: declaration.id, field: field2.name, indices, expression: expr, required, references: refs.map((r) => r.id) });
      };
      walk(field2.value, []);
    }
  }
  const states = /* @__PURE__ */ new Map(), order = [];
  const visit = (id) => {
    if (states.get(id) === "done") return;
    states.set(id, "visiting");
    for (const ref of edges.get(id) ?? []) {
      if (states.get(ref.id) === "visiting") throw new CadAstError("CYCLE", "Cyclic parameter dependency through " + ref.id, ref.range, id);
      visit(ref.id);
    }
    states.set(id, "done");
    order.push(id);
  };
  for (const id of inputs.keys()) visit(id);
  const quantities = /* @__PURE__ */ new Map(), evaluated = /* @__PURE__ */ new WeakMap();
  const checked = (kind, value, range, owner) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new CadAstError("VALUE", "Quantity must be finite and within 1e12", range, owner);
    return { kind, value };
  };
  const evaluate = (node, owner) => {
    const cached = evaluated.get(node);
    if (cached) return cached;
    let result;
    if (node.kind === "number") {
      checked("scalar", node.value, node.range, owner);
      const scale3 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = checked(node.unit ? "length" : "scalar", node.value * scale3, node.unitRange ?? node.range, owner);
    } else if (node.kind === "parameter-reference") {
      const quantity = quantities.get(node.id);
      if (!quantity) throw new CadAstError("REFERENCE", "Parameter dependency is unresolved", node.range, owner);
      result = { ...quantity };
    } else if (node.kind === "group") result = { ...evaluate(node.expression, owner) };
    else if (node.kind === "unary") {
      const operand = evaluate(node.operand, owner);
      result = checked(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner);
    } else {
      const left = evaluate(node.left, owner), right = evaluate(node.right, owner);
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
      result = checked(kind, value, node.operatorRange, owner);
    }
    evaluated.set(node, result);
    return result;
  };
  for (const id of order) {
    const input = inputs.get(id), quantity = evaluate(input.expression, id);
    if (quantity.kind !== input.kind) throw new CadAstError("UNIT", "Parameter value does not match its declared " + input.kind + " type", input.expression.range, id);
    quantities.set(id, quantity);
  }
  const parameters = [...inputs].map(([id, input]) => {
    const q = quantities.get(id);
    return { id, quantityKind: q.kind, value: q.value, unit: q.kind === "length" ? "mm" : "1", expression: copyCadData(input.expression), span: { ...input.declaration.range } };
  });
  const bindings = [], leafValues = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    let quantity = evaluate(leaf.expression, leaf.objectId);
    if (leaf.required === "length" && quantity.kind === "scalar" && literalMillimetres(leaf.expression)) quantity = { kind: "length", value: quantity.value };
    if (quantity.kind !== leaf.required) throw new CadAstError("UNIT", "Field " + leaf.field + " requires " + leaf.required, leaf.expression.range, leaf.objectId);
    if (leaf.field.startsWith("degree") && !Number.isInteger(quantity.value)) throw new CadAstError("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.objectId);
    leafValues.set(leaf.expression, quantity.value);
    bindings.push({ objectId: leaf.objectId, field: leaf.field, indices: [...leaf.indices], expression: copyCadData(leaf.expression), value: quantity.value, quantityKind: quantity.kind, span: { ...leaf.expression.range }, references: [...leaf.references] });
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
    declarations: ast.declarations.filter((d) => d.kind !== "parameter").map((d) => ({
      kind: d.kind,
      id: d.id,
      range: { ...d.range },
      idRange: { ...d.idRange },
      fields: d.fields.map((f) => ({ name: f.name, range: { ...f.range }, nameRange: { ...f.nameRange }, value: resolvedValue(f.value) }))
    }))
  };
  return { ast: resolvedAst, parameters, bindings, dependencies };
}

// packages/barocss-cad/src/semantic-model.ts
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
    const fields2 = { id: declaration.id, span: { ...declaration.range }, fieldTypes };
    literals.set(declaration.id, geometry.kind === "curve" ? { ...fields2, kind: "curve", geometry } : { ...fields2, kind: "surface", geometry });
  }
  const version = ast.fields.find((f) => f.name === "version"), unit = ast.fields.find((f) => f.name === "length-unit");
  if (!version || raw(version.value) !== sourceVersion) throw new CadAstError("VERSION", "Declared source version must match sourceVersion: " + sourceVersion, version?.value.range ?? zeroRange());
  if (!unit || raw(unit.value) !== "mm") throw new CadAstError("UNIT", "length-unit: mm is required", unit?.value.range ?? zeroRange());
  if (!ast.declarations.length) throw new CadAstError("GEOMETRY", "Model must contain geometry", zeroRange(), void 0);
  const dependencies = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind !== "extrude") {
      nodes.push(literals.get(declaration.id));
      continue;
    }
    const reference = declaration.fields.find((f) => f.name === "curve"), vectorField = declaration.fields.find((f) => f.name === "vector");
    if (!reference || !vectorField) throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
    const inputId = raw(reference.value), input = byId.get(inputId), vector2 = raw(vectorField.value);
    if (!input || input.kind !== "curve") {
      const detail = !input ? "Undefined curve reference " + inputId : "Reference " + inputId + " has kind " + input.kind + "; a curve is required";
      throw new CadAstError("REFERENCE", detail, reference.value.range, declaration.id);
    }
    const curve = literals.get(inputId).geometry;
    try {
      preflightExtrusion(curve, { id: declaration.id, vector: vector2 });
    } catch (error2) {
      const message = error2.message;
      throw new CadAstError(nativeCode(message), message, vectorField.value.range, declaration.id);
    }
    nodes.push({ kind: "extrude", id: declaration.id, inputId, vector: copyCadData(vector2), span: { ...declaration.range }, referenceSpan: { ...reference.value.range }, fieldTypes: { curve: "curve-reference", vector: "mm-vector3" } });
    dependencies.push({ fromId: declaration.id, toId: inputId, kind: "curve-input", span: { ...reference.value.range } });
  }
  return { name: ast.name, lengthUnit: "mm", nodes, dependencies };
}
function analyzeCadAst(ast, sourceVersion, _source) {
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

// packages/barocss-cad/src/lower-model.ts
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
function compileCadModel(source, options) {
  if (typeof source !== "string") return programmingFailure("TYPE", "Source must be a string");
  if (!options || typeof options !== "object" || Array.isArray(options)) return programmingFailure("OPTIONS", "An explicit sourceVersion option is required");
  const prototype = Object.getPrototypeOf(options), descriptors = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(options);
  if (prototype !== Object.prototype && prototype !== null || keys.length !== 1 || keys[0] !== "sourceVersion" || !descriptors.sourceVersion || !("value" in descriptors.sourceVersion) || !descriptors.sourceVersion.enumerable || descriptors.sourceVersion.value !== 0 && descriptors.sourceVersion.value !== 1 && descriptors.sourceVersion.value !== 2) return programmingFailure("OPTIONS", "Only own sourceVersion: 0, 1 or 2 data is supported");
  const result = compileCadStages(source, descriptors.sourceVersion.value);
  if (!result.ok) {
    const error2 = result.error;
    const diagnostic = { code: error2.code, severity: "error", message: error2.detail, range: { ...error2.range } };
    if (error2.objectId !== void 0) diagnostic.objectId = error2.objectId;
    return { ok: false, diagnostics: [diagnostic] };
  }
  return { ok: true, ast: copyCadData(result.ast), ir: copyCadData(result.ir), model: copyCadData(result.model), constructions: copyCadData(result.constructions), diagnostics: [] };
}

// packages/barocss-cad/src/affine-geometry-transform.ts
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

// packages/barocss-cad/src/workplane-sketch-document.ts
var WorkplaneSketchDocumentDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", FRAME: "FRAME", BINDING: "BINDING", BUDGET: "BUDGET", LOCAL: "LOCAL", AFFINE: "AFFINE", CODEC: "CODEC", OWNED: "OWNED" });

// packages/barocss-cad/src/curve-adaptive-sampling.ts
var EPS = 64 * Number.EPSILON;

// packages/barocss-cad/src/curve-wide-adaptive-sampling.ts
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

// packages/barocss-cad/src/curve-bezier-spans.ts
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

// packages/barocss-cad/src/curve-wide-plane-intersection.ts
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

// packages/barocss-cad/src/own-convex-planar-face-intersection.ts
var EPS4 = 64 * Number.EPSILON;

// packages/barocss-cad/src/own-convex-planar-face-holes-intersection.ts
var EPS5 = 64 * Number.EPSILON;

// packages/barocss-cad/src/own-convex-planar-face-holes-preview.ts
var EPS6 = 64 * Number.EPSILON;

// packages/barocss-cad/src/curve-join.ts
var EPS7 = 64 * Number.EPSILON;

// packages/barocss-cad/src/curve-reversal.ts
var CurveReversalDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", DOMAIN: "DOMAIN", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", BINDING: "BINDING", OWNED: "OWNED" });
var EPS8 = 64 * Number.EPSILON;

// packages/barocss-cad/src/curve-interval-extraction.ts
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

// packages/barocss-cad/src/surface-region.ts
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

// packages/barocss-cad/src/curve-wide-refinement.ts
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

// packages/barocss-cad/src/surface-axis-reversal.ts
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

// packages/barocss-cad/src/cad-document-reference.ts
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

// packages/barocss-cad/src/cad-document-compatibility.ts
var CadDocumentCompatibilityDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  FORMAT: "FORMAT",
  VERSION: "VERSION",
  PROFILE: "PROFILE",
  IDENTITY: "IDENTITY",
  REFERENCE: "REFERENCE",
  FRAME: "FRAME",
  SOURCE: "SOURCE",
  BUDGET: "BUDGET",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/cad-document-export.ts
var CadDocumentExportDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  TARGET: "TARGET",
  REFERENCE: "REFERENCE",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/own-cubic-curve-plane-intersection.ts
var CubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/curve-wide-cubic-plane-intersection.ts
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

// packages/barocss-cad/src/curve-wide-control-polygon.ts
var WideCurveControlPolygonEditDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/curve-wide-reversal.ts
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

// packages/barocss-cad/src/three-section-loft.ts
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
var EPS9 = 64 * Number.EPSILON;

// packages/barocss-cad/src/cad-document-bounds.ts
var CadDocumentBoundsDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/cad-curve-arc-length.ts
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
var EPS10 = 64 * Number.EPSILON;

// packages/barocss-cad/src/cad-surface-area.ts
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
var EPS11 = 64 * Number.EPSILON;

// packages/barocss-cad/src/cad-assembly.ts
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

// packages/barocss-cad/src/coplanar-face-boolean.ts
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

// packages/barocss-cad/src/coplanar-face-boolean-mesh.ts
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

// packages/barocss-cad/src/coplanar-face-boolean-extrusion.ts
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

// packages/barocss-cad/src/coplanar-face-boolean-extrusion-mesh.ts
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

// packages/barocss-cad/src/boolean-extrusion-feature-graph.ts
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

// packages/barocss-cad/src/coplanar-face-boolean-extrusion-properties.ts
var CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  OWNED: "OWNED"
});
var AREA_EPSILON = 128 * Number.EPSILON;

// packages/barocss-cad/src/translational-sweep-surface.ts
var TranslationalSweepDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/curve-interpolation-kernel-internal.ts
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

// packages/barocss-cad/src/curve-interpolation.ts
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

// packages/barocss-cad/src/surface-interpolation.ts
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

// packages/barocss-cad/src/curve-parameterization.ts
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

// packages/barocss-cad/src/weighted-curve-interpolation.ts
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

// packages/barocss-cad/src/multi-section-loft.ts
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

// packages/barocss-cad/src/linear-geometry-pattern.ts
var LinearGeometryPatternDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/circular-geometry-pattern.ts
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

// packages/barocss-cad/src/second-derivatives.ts
var NativeSecondDerivativeDiagnosticCode = Object.freeze({ INPUT: "INPUT", CONTINUITY: "CONTINUITY", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE" });

// packages/barocss-cad/src/local-curvature.ts
var NativeCurvatureDiagnosticCode = Object.freeze({
  DERIVATIVE: "DERIVATIVE",
  REGULARITY: "REGULARITY",
  ARITHMETIC: "ARITHMETIC"
});
var ROUNDING = 512 * Number.EPSILON;

// packages/barocss-cad/src/curve-planar-face-material.ts
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

// packages/barocss-cad/src/coplanar-face-boolean-extrusion-mass.ts
var CoplanarFaceBooleanExtrusionMassDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  OWNED: "OWNED"
});
var EPS12 = 128 * Number.EPSILON;

// packages/barocss-cad/src/extrusion-principal-inertia.ts
var ExtrusionPrincipalInertiaDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  OWNED: "OWNED"
});
var ROUNDING2 = 512 * Number.EPSILON;

// packages/barocss-cad/src/section-knot-alignment.ts
var SectionKnotAlignmentDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/exact-boundary-face-adjacency.ts
var ExactBoundaryFaceAdjacencyDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  ORIENTATION: "ORIENTATION",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/quintic-hermite-curve.ts
var QuinticHermiteDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/curve-endpoint-continuity.ts
var CurveEndpointContinuityDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  SOURCE: "SOURCE",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  REGULARITY: "REGULARITY",
  ARITHMETIC: "ARITHMETIC",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/closed-exact-patch-shell.ts
var ClosedExactPatchShellDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  COVERAGE: "COVERAGE",
  CONNECTED: "CONNECTED",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  INCIDENCE: "INCIDENCE",
  OWNED: "OWNED"
});

// packages/barocss-cad/src/vlinear-plane-section.ts
var VLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/source-surface-control-net.ts
var SourceSurfaceControlNetDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/source-surface-control-net-wide.ts
var SourceSurfaceControlNetWideDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/source-curve-control-polygon.ts
var SourceCurveControlPolygonDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/piecewise-rational-loft.ts
var PiecewiseRationalLoftDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", SOURCE: "SOURCE", OWNED: "OWNED" });

// packages/barocss-cad/src/vlinear-plane-trim.ts
var VLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/vlinear-plane-trim-classification.ts
var VLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });

// packages/barocss-cad/src/axis-box-boolean.ts
var AxisBoxSolidBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", BINDING: "BINDING", CONTACT: "CONTACT", TOPOLOGY: "TOPOLOGY", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/src/axis-box-point-classification.ts
var AxisBoxSolidBooleanPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", OWNED: "OWNED" });

// packages/barocss-cad/src/axis-box-solid-mass.ts
var AxisBoxSolidMassDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });

// packages/barocss-cad/src/axis-box-principal-inertia.ts
var AxisBoxSolidPrincipalInertiaDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", MASS: "MASS", SELECTION: "SELECTION", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var ROUNDING3 = 512 * Number.EPSILON;

// packages/barocss-cad/src/axis-box-mass-frame.ts
var AxisBoxSolidMassFrameDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", MASS: "MASS", SELECTION: "SELECTION", POSE: "POSE", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });

// packages/barocss-cad/src/axis-box-solid-feature-document.ts
var AxisBoxSolidFeatureDocumentDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", REVISION: "REVISION", BUDGET: "BUDGET", SOURCE: "SOURCE", BINDING: "BINDING", NATIVE: "NATIVE", BOOLEAN: "BOOLEAN", CODEC: "CODEC", OWNED: "OWNED" });

// packages/barocss-cad/src/xy-angle-arc.ts
var XYAngleArcDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", UNIT: "UNIT", RANGE: "RANGE", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE", SOURCE: "SOURCE", BUDGET: "BUDGET", OWNED: "OWNED" });
var TURN = 2 * Math.PI;
var QUARTER = Math.PI / 2;

// packages/barocss-cad/src/mixed-workplane-sketch-document.ts
var MixedWorkplaneSketchDocumentDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", FRAME: "FRAME", BINDING: "BINDING", BUDGET: "BUDGET", LOCAL: "LOCAL", ARC: "ARC", AFFINE: "AFFINE", CODEC: "CODEC", OWNED: "OWNED" });

// examples/physics-character-viewer/capsule-mesh.mjs
var RADIUS_MM = 150;
var HALF_LINE_MM = 350;
var SECTORS = 24;
var END_SEGMENTS = 8;
function createCapsulePacket() {
  const positions = [0, -HALF_LINE_MM - RADIUS_MM, 0], normals = [0, -1, 0], parameters = [0, 0];
  const indices = [];
  const ring = (latitude, centreY, v) => {
    const radial = Math.cos(latitude), vertical = Math.sin(latitude);
    for (let sector = 0; sector < SECTORS; sector++) {
      const angle2 = sector * 2 * Math.PI / SECTORS, x = radial * Math.cos(angle2), z = radial * Math.sin(angle2);
      positions.push(RADIUS_MM * x, centreY + RADIUS_MM * vertical, RADIUS_MM * z);
      normals.push(x, vertical, z);
      parameters.push(sector / SECTORS, v);
    }
  };
  for (let segment = 1; segment <= END_SEGMENTS; segment++) {
    ring(-Math.PI / 2 + segment * Math.PI / (2 * END_SEGMENTS), -HALF_LINE_MM, segment / 17);
  }
  for (let segment = 0; segment < END_SEGMENTS; segment++) {
    ring(segment * Math.PI / (2 * END_SEGMENTS), HALF_LINE_MM, (9 + segment) / 17);
  }
  const top = positions.length / 3;
  positions.push(0, HALF_LINE_MM + RADIUS_MM, 0);
  normals.push(0, 1, 0);
  parameters.push(0, 1);
  for (let sector = 0; sector < SECTORS; sector++) {
    const next = (sector + 1) % SECTORS;
    indices.push(0, 1 + sector, 1 + next);
    for (let row = 0; row < 15; row++) {
      const a = 1 + row * SECTORS + sector, b = a + SECTORS;
      const c = 1 + row * SECTORS + next, d = c + SECTORS;
      indices.push(a, b, c, b, d, c);
    }
    indices.push(1 + 15 * SECTORS + sector, top, 1 + 15 * SECTORS + next);
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < positions.length / 3; vertex++) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], positions[vertex * 3 + axis]);
    max[axis] = Math.max(max[axis], positions[vertex * 3 + axis]);
  }
  const packet = {
    version: 0,
    surfaceId: "capsule-derived",
    revision: 0,
    lengthUnit: "mm",
    coordinateSystem: "right-handed-y-up",
    winding: "ccw",
    positions,
    normals,
    indices,
    parameters,
    bounds: { min, max }
  };
  validatePreviewPacket(packet);
  return { modelId: "physics-character", packet };
}

// examples/physics-character-viewer/terrain.mjs
function decimal(value) {
  if (!Number.isFinite(value)) throw new RangeError("Terrain source coordinate must be finite");
  if (Object.is(value, -0)) return "-0";
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [coefficient, exponentText] = text.toLowerCase().split("e"), exponent = Number(exponentText);
  const negative = coefficient.startsWith("-"), unsigned = negative ? coefficient.slice(1) : coefficient;
  const [whole, fractional = ""] = unsigned.split("."), digits = whole + fractional, split = whole.length + exponent;
  const expanded = split <= 0 ? "0." + "0".repeat(-split) + digits : split >= digits.length ? digits + "0".repeat(split - digits.length) : digits.slice(0, split) + "." + digits.slice(split);
  return (negative ? "-" : "") + expanded;
}
var list = (values) => "[" + values.map(decimal).join(",") + "]";
var poles = (points) => "[" + points.map(list).join(",") + "]";
function rotation(q) {
  const [x, y, z, w] = q, factor = 2 / (x * x + y * y + z * z + w * w);
  return [
    [1 - factor * (y * y + z * z), factor * (x * y - z * w), factor * (x * z + y * w)],
    [factor * (x * y + z * w), 1 - factor * (x * x + z * z), factor * (y * z - x * w)],
    [factor * (x * z - y * w), factor * (y * z + x * w), 1 - factor * (x * x + y * y)]
  ];
}
var FACE_CORNERS = [
  { role: "positive-x", corners: [[[1, -1, -1], [1, -1, 1]], [[1, 1, -1], [1, 1, 1]]] },
  { role: "negative-x", corners: [[[-1, -1, -1], [-1, 1, -1]], [[-1, -1, 1], [-1, 1, 1]]] },
  { role: "positive-y", corners: [[[-1, 1, -1], [1, 1, -1]], [[-1, 1, 1], [1, 1, 1]]] },
  { role: "negative-y", corners: [[[-1, -1, -1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]]] },
  { role: "positive-z", corners: [[[-1, -1, 1], [-1, 1, 1]], [[1, -1, 1], [1, 1, 1]]] },
  { role: "negative-z", corners: [[[-1, -1, -1], [1, -1, -1]], [[-1, 1, -1], [1, 1, -1]]] }
];
function sameData(a, b) {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return Object.is(a, b);
  const keys = Object.keys(a), other = Object.keys(b);
  return keys.length === other.length && keys.every((key) => Object.hasOwn(b, key) && sameData(a[key], b[key]));
}
function authoredBox(box2, boxIndex) {
  const modelId = `terrain_box_${boxIndex}`, matrix2 = rotation(box2.orientationXYZW);
  const worldMM = (signs) => {
    const local = signs.map((sign, axis) => sign * box2.halfExtentsM[axis]);
    return matrix2.map((row, axis) => (row[0] * local[0] + row[1] * local[1] + row[2] * local[2] + box2.centerM[axis]) * 1e3);
  };
  const faces = FACE_CORNERS.map((face, faceIndex) => ({
    role: face.role,
    surface: {
      kind: "surface",
      id: `box_${boxIndex}_face_${faceIndex}`,
      degreeU: 1,
      degreeV: 1,
      knotsU: [0, 0, 1, 1],
      knotsV: [0, 0, 1, 1],
      controlPoints: face.corners.map((row) => row.map(worldMM)),
      weights: [[1, 1], [1, 1]]
    }
  }));
  const declarations = faces.map(({ surface }) => `  @surface #${surface.id} { type:nurbs; degree-u:1; degree-v:1; knots-u:${list(surface.knotsU)}; knots-v:${list(surface.knotsV)}; control-points:[${surface.controlPoints.map(poles).join(",")}]; weights:[[1,1],[1,1]]; }`);
  const source = `@model ${modelId} {
  version:0; length-unit:mm;
${declarations.join("\n")}
}
`;
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) {
    const error2 = new Error("Actual six-face terrain Source0 compilation refused");
    error2.diagnostics = structuredClone(compiled.diagnostics);
    throw error2;
  }
  const expected = { name: modelId, version: 0, lengthUnit: "mm", objects: faces.map((face) => face.surface) };
  if (!sameData(compiled.model, expected)) throw new Error("Terrain native source did not retain every original coefficient and signed zero");
  return { modelId, source, faces, compiled };
}
function createTerrain(fixture) {
  const packets = [], sources = [], ledger = [];
  fixture.scene.boxes.forEach((box2, boxIndex) => {
    const authored = authoredBox(box2, boxIndex), positions = [], normals = [], indices = [], parameters = [], faceLedger = [];
    for (let faceIndex = 0; faceIndex < authored.faces.length; faceIndex++) {
      const nativeSurface = authored.compiled.model.objects[faceIndex];
      const sampled = tessellateSurface(nativeSurface, { countU: 2, countV: 2, revision: 0 });
      const vertexStart = positions.length / 3, indexStart = indices.length;
      positions.push(...sampled.packet.positions);
      normals.push(...sampled.packet.normals);
      parameters.push(...sampled.packet.parameters);
      indices.push(...sampled.packet.indices.map((index) => index + vertexStart));
      const declaration = authored.compiled.ast.declarations.find((value) => value.id === nativeSurface.id);
      faceLedger.push({
        faceIndex,
        role: authored.faces[faceIndex].role,
        sourceFaceId: nativeSurface.id,
        sourceRange: structuredClone(declaration.range),
        nativeSurface: structuredClone(nativeSurface),
        vertexRange: { start: vertexStart, count: sampled.packet.positions.length / 3 },
        indexRange: { start: indexStart, count: sampled.packet.indices.length },
        triangleRange: { start: indexStart / 3, count: sampled.packet.indices.length / 3 },
        tessellationReport: structuredClone(sampled.report)
      });
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < positions.length / 3; vertex++) for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[vertex * 3 + axis]);
      max[axis] = Math.max(max[axis], positions[vertex * 3 + axis]);
    }
    const packet = {
      version: 0,
      surfaceId: `terrain_${boxIndex}_derived`,
      revision: 0,
      lengthUnit: "mm",
      coordinateSystem: "right-handed-y-up",
      winding: "ccw",
      positions,
      normals,
      indices,
      parameters,
      bounds: { min, max }
    };
    validatePreviewPacket(packet);
    const sourceFile = `terrain-box-${boxIndex}.cad`;
    packets.push({ modelId: authored.modelId, packet });
    sources.push({
      sourceFile,
      sourceVersion: 0,
      source: authored.source,
      modelId: authored.modelId,
      nativeModel: structuredClone(authored.compiled.model),
      originalQueryBox: structuredClone(box2),
      faces: structuredClone(faceLedger)
    });
    ledger.push({
      boxIndex,
      boxId: box2.id,
      targetId: `terrain:${box2.id}`,
      sourceFile,
      modelId: authored.modelId,
      surfaceId: packet.surfaceId,
      originalQueryBox: structuredClone(box2),
      faces: structuredClone(faceLedger),
      vertexCount: positions.length / 3,
      triangleCount: indices.length / 3
    });
  });
  return { packets, sources, ledger };
}

// examples/physics-character-viewer/geometry-checks.mjs
var F32_TOLERANCE_MM = 5e-5;
var GEOMETRY_TOLERANCE_MM = 1e-9;
function equalData(a, b) {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return Object.is(a, b);
  const keys = Object.keys(a), other = Object.keys(b);
  return Array.isArray(a) === Array.isArray(b) && keys.length === other.length && keys.every((key) => Object.hasOwn(b, key) && equalData(a[key], b[key]));
}
var pointAt = (values, index) => values.slice(index * 3, index * 3 + 3);
var subtract2 = (a, b) => a.map((value, axis) => value - b[axis]);
var dot5 = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var distance = (a, b) => Math.hypot(...subtract2(a, b));
function multiplyQuat(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}
function rotate2(point, quaternion) {
  const norm2 = Math.hypot(...quaternion), q = quaternion.map((value) => value / norm2);
  return multiplyQuat(multiplyQuat(q, [...point, 0]), [-q[0], -q[1], -q[2], q[3]]).slice(0, 3);
}
function expectedCorner(box2, signs) {
  const local = signs.map((sign, axis) => sign * box2.halfExtentsM[axis]);
  return rotate2(local, box2.orientationXYZW).map((value, axis) => (value + box2.centerM[axis]) * 1e3);
}
function faceCorners(box2, role) {
  const [direction, axisName] = role.split("-"), axis = ["x", "y", "z"].indexOf(axisName);
  if (axis < 0 || !["positive", "negative"].includes(direction)) throw new Error("Unknown face role");
  const sign = direction === "positive" ? 1 : -1, free = [0, 1, 2].filter((value) => value !== axis);
  const corners = [];
  for (const first of [-1, 1]) for (const second of [-1, 1]) {
    const signs = [0, 0, 0];
    signs[axis] = sign;
    signs[free[0]] = first;
    signs[free[1]] = second;
    corners.push(expectedCorner(box2, signs));
  }
  const localNormal = [0, 0, 0];
  localNormal[axis] = sign;
  return { corners, normal: rotate2(localNormal, box2.orientationXYZW) };
}
function setError(actual, expected) {
  if (actual.length !== expected.length) return Infinity;
  const remaining = [...expected];
  let maximum = 0;
  for (const point of actual) {
    const nearest = remaining.map((value) => distance(point, value));
    const minimum = Math.min(...nearest), index = nearest.indexOf(minimum);
    maximum = Math.max(maximum, minimum);
    remaining.splice(index, 1);
  }
  return maximum;
}
function inspectPacket(packet) {
  const { positions, normals, indices, parameters } = packet;
  const dense2 = (values) => Array.isArray(values) && Object.getPrototypeOf(values) === Array.prototype && Reflect.ownKeys(values).length === values.length + 1 && Array.from({ length: values.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
    return descriptor && descriptor.enumerable && "value" in descriptor && Number.isFinite(descriptor.value);
  }).every(Boolean);
  const count = positions.length / 3;
  let normalError = 0, minimumArea = Infinity, minimumOutwardDot = Infinity, f32Error = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < count; vertex++) {
    normalError = Math.max(normalError, Math.abs(Math.hypot(...pointAt(normals, vertex)) - 1));
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[vertex * 3 + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
      f32Error = Math.max(f32Error, Math.abs(Math.fround(value) - value));
    }
  }
  const validIndices = indices.every((index) => Number.isInteger(index) && index >= 0 && index < count);
  if (validIndices) for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = indices.slice(offset, offset + 3);
    const [a, b, c] = triangle.map((index) => pointAt(positions, index));
    const normal = cross3(subtract2(b, a), subtract2(c, a));
    minimumArea = Math.min(minimumArea, Math.hypot(...normal));
    for (const index of triangle) minimumOutwardDot = Math.min(minimumOutwardDot, dot5(normal, pointAt(normals, index)));
  }
  return {
    count,
    triangles: indices.length / 3,
    normalError,
    minimumArea,
    minimumOutwardDot,
    f32Error,
    schema: packet.version === 0 && packet.revision === 0 && packet.lengthUnit === "mm" && packet.coordinateSystem === "right-handed-y-up" && packet.winding === "ccw" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(packet.surfaceId),
    arrays: [positions, normals, indices, parameters].every(dense2) && Number.isInteger(count) && normals.length === positions.length && parameters.length === count * 2 && indices.length % 3 === 0,
    indices: validIndices,
    bounds: min.every((value, axis) => Object.is(value, packet.bounds.min[axis])) && max.every((value, axis) => Object.is(value, packet.bounds.max[axis]))
  };
}
function geometryChecks(fixture, capsule, terrain) {
  const checks = [], metrics = {
    maxF32ComponentErrorMM: 0,
    maxCapsuleF32ComponentErrorMM: 0,
    maxNormalLengthError: 0,
    maxCapsuleRadiusErrorMM: 0,
    maxCapsuleAnalyticNormalError: 0,
    maxTerrainCornerErrorMM: 0,
    maxTerrainNormalError: 0,
    capsuleEdgeCount: 0,
    totalVertices: 0,
    totalIndices: 0
  };
  const check3 = (name, passed, detail = null) => checks.push({ name, passed: passed === true, detail });
  try {
    const packets = [capsule, ...terrain.packets];
    check3("object-cap", packets.length >= 1 && packets.length <= 4);
    check3("unique-refs", new Set(packets.map((entry) => `${entry.modelId}\0${entry.packet.surfaceId}`)).size === packets.length);
    check3("unique-surface-ids", new Set(packets.map((entry) => entry.packet.surfaceId)).size === packets.length);
    packets.forEach((entry, index) => {
      const proof = inspectPacket(entry.packet);
      metrics.maxF32ComponentErrorMM = Math.max(metrics.maxF32ComponentErrorMM, proof.f32Error);
      if (index === 0) metrics.maxCapsuleF32ComponentErrorMM = proof.f32Error;
      metrics.maxNormalLengthError = Math.max(metrics.maxNormalLengthError, proof.normalError);
      metrics.totalVertices += proof.count;
      metrics.totalIndices += entry.packet.indices.length;
      check3(`packet-${index}-schema`, proof.schema && /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(entry.modelId));
      check3(`packet-${index}-arrays`, proof.arrays);
      check3(`packet-${index}-indices`, proof.indices);
      check3(`packet-${index}-bounds`, proof.bounds);
      check3(`packet-${index}-unit-normals`, proof.normalError <= 1e-5, proof.normalError);
      check3(`packet-${index}-outward-nondegenerate`, proof.minimumArea > 0 && proof.minimumOutwardDot > 0);
    });
    check3("aggregate-gpu-cap", metrics.totalVertices <= 4096 && metrics.totalIndices <= 24576);
    check3("capsule-F32-mm-error", metrics.maxCapsuleF32ComponentErrorMM <= F32_TOLERANCE_MM, metrics.maxCapsuleF32ComponentErrorMM);
    const actor = capsule.packet, vertices = actor.positions.length / 3;
    check3("capsule-identity-counts", capsule.modelId === "physics-character" && actor.surfaceId === "capsule-derived" && vertices === 386 && actor.indices.length === 768 * 3);
    check3("capsule-exact-extents", equalData(actor.bounds, { min: [-150, -500, -150], max: [150, 500, 150] }));
    const levels = /* @__PURE__ */ new Map(), edges = /* @__PURE__ */ new Map();
    for (let index = 0; index < vertices; index++) {
      const point = pointAt(actor.positions, index), closestY = Math.min(350, Math.max(-350, point[1]));
      const outward = [point[0], point[1] - closestY, point[2]];
      metrics.maxCapsuleRadiusErrorMM = Math.max(metrics.maxCapsuleRadiusErrorMM, Math.abs(Math.hypot(...outward) - 150));
      metrics.maxCapsuleAnalyticNormalError = Math.max(
        metrics.maxCapsuleAnalyticNormalError,
        distance(outward.map((value) => value / 150), pointAt(actor.normals, index))
      );
      if (index !== 0 && index !== vertices - 1) {
        const row = Math.floor((index - 1) / 24);
        if (!levels.has(row)) levels.set(row, []);
        levels.get(row).push(point);
      }
    }
    check3("capsule-analytic-surface", metrics.maxCapsuleRadiusErrorMM <= GEOMETRY_TOLERANCE_MM && metrics.maxCapsuleAnalyticNormalError <= 1e-12);
    check3("capsule-poles", equalData(pointAt(actor.positions, 0), [0, -500, 0]) && equalData(pointAt(actor.positions, vertices - 1), [0, 500, 0]));
    let ringStructure = levels.size === 16;
    for (const [row, points] of levels) {
      ringStructure &&= points.length === 24 && points.every((point) => point[1] === points[0][1]);
      const latitude = (row < 8 ? row - 7 : row - 8) * Math.PI / 16;
      const expectedY = (row < 8 ? -350 : 350) + 150 * Math.sin(latitude);
      ringStructure &&= Math.abs(points[0][1] - expectedY) <= GEOMETRY_TOLERANCE_MM;
      for (let sector = 0; sector < points.length; sector++) {
        const a = points[sector], b = points[(sector + 1) % points.length];
        const radialSquared = a[0] ** 2 + a[2] ** 2;
        ringStructure &&= Math.abs((a[0] * b[0] + a[2] * b[2]) / radialSquared - Math.cos(Math.PI / 12)) <= 1e-12 && a[0] * b[2] - a[2] * b[0] > 0;
      }
    }
    check3("capsule-16-by-24-rings-closed-seam", ringStructure);
    for (let offset = 0; offset < actor.indices.length; offset += 3) {
      const triangle = actor.indices.slice(offset, offset + 3);
      for (let side = 0; side < 3; side++) {
        const from = triangle[side], to = triangle[(side + 1) % 3];
        const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
        const edge = edges.get(key) ?? { count: 0, balance: 0 };
        edge.count++;
        edge.balance += from < to ? 1 : -1;
        edges.set(key, edge);
      }
    }
    metrics.capsuleEdgeCount = edges.size;
    check3("capsule-closed-oriented-topology", edges.size === 1152 && [...edges.values()].every((edge) => edge.count === 2 && edge.balance === 0) && vertices - edges.size + actor.indices.length / 3 === 2);
    const boxes = fixture.scene.boxes;
    check3("terrain-complete-ledger", terrain.packets.length === boxes.length && terrain.sources.length === boxes.length && terrain.ledger.length === boxes.length);
    boxes.forEach((box2, boxIndex) => {
      const entry = terrain.packets[boxIndex], source = terrain.sources[boxIndex], ledger = terrain.ledger[boxIndex];
      const packet = entry.packet;
      check3(`terrain-${boxIndex}-identity`, ledger.boxIndex === boxIndex && ledger.boxId === box2.id && ledger.targetId === `terrain:${box2.id}` && entry.modelId === ledger.modelId && packet.surfaceId === ledger.surfaceId && source.modelId === entry.modelId && source.sourceFile === ledger.sourceFile && source.sourceVersion === 0 && equalData(ledger.originalQueryBox, box2) && equalData(source.originalQueryBox, box2));
      check3(`terrain-${boxIndex}-counts`, packet.positions.length === 24 * 3 && packet.indices.length === 12 * 3 && ledger.vertexCount === 24 && ledger.triangleCount === 12 && ledger.faces.length === 6 && source.faces.length === 6 && source.nativeModel.objects.length === 6);
      check3(`terrain-${boxIndex}-native-model`, source.nativeModel.name === source.modelId && source.nativeModel.version === 0 && source.nativeModel.lengthUnit === "mm");
      check3(`terrain-${boxIndex}-six-roles`, new Set(ledger.faces.map((face) => face.role)).size === 6 && ["positive-x", "negative-x", "positive-y", "negative-y", "positive-z", "negative-z"].every((role) => ledger.faces.some((face) => face.role === role)));
      ledger.faces.forEach((face, faceIndex) => {
        const surface = face.nativeSurface, expected = faceCorners(box2, face.role);
        const corners = surface.controlPoints.flat();
        const displayed = Array.from({ length: 4 }, (_, vertex) => pointAt(packet.positions, faceIndex * 4 + vertex));
        const cornerError = Math.max(setError(corners, expected.corners), setError(displayed, expected.corners));
        metrics.maxTerrainCornerErrorMM = Math.max(metrics.maxTerrainCornerErrorMM, cornerError);
        check3(`terrain-${boxIndex}-face-${faceIndex}-native`, surface.kind === "surface" && surface.id === face.sourceFaceId && surface.degreeU === 1 && surface.degreeV === 1 && equalData(surface.knotsU, [0, 0, 1, 1]) && equalData(surface.knotsV, [0, 0, 1, 1]) && equalData(surface.weights, [[1, 1], [1, 1]]) && equalData(surface, source.nativeModel.objects[faceIndex]) && equalData(face, source.faces[faceIndex]));
        check3(`terrain-${boxIndex}-face-${faceIndex}-corners`, cornerError <= GEOMETRY_TOLERANCE_MM, cornerError);
        const range = face.sourceRange;
        const declaration = source.source.slice(range.start, range.end);
        check3(`terrain-${boxIndex}-face-${faceIndex}-source-range`, Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.end > range.start && range.end <= source.source.length && new RegExp(`^@surface\\s+#${face.sourceFaceId}\\s*\\{`).test(declaration) && /\}\s*$/.test(declaration));
        check3(`terrain-${boxIndex}-face-${faceIndex}-ranges`, face.faceIndex === faceIndex && equalData(face.vertexRange, { start: faceIndex * 4, count: 4 }) && equalData(face.indexRange, { start: faceIndex * 6, count: 6 }) && equalData(face.triangleRange, { start: faceIndex * 2, count: 2 }) && packet.indices.slice(faceIndex * 6, faceIndex * 6 + 6).every((index) => index >= faceIndex * 4 && index < faceIndex * 4 + 4));
        for (let vertex = 0; vertex < 4; vertex++) {
          metrics.maxTerrainNormalError = Math.max(
            metrics.maxTerrainNormalError,
            distance(pointAt(packet.normals, faceIndex * 4 + vertex), expected.normal)
          );
        }
        const [a, b, c] = [corners[0], corners[2], corners[1]];
        check3(`terrain-${boxIndex}-face-${faceIndex}-native-outward`, dot5(cross3(subtract2(b, a), subtract2(c, a)), expected.normal) > 0);
      });
    });
    check3("terrain-analytic-normals", metrics.maxTerrainNormalError <= 1e-12, metrics.maxTerrainNormalError);
  } catch (error2) {
    check3("geometry-inspection-error", false, { name: error2.name, message: error2.message });
  }
  return { passed: checks.length > 0 && checks.every((value) => value.passed), checks, metrics };
}

// examples/physics-character-viewer/numeric-entry.mjs
var output = CASES.map((f) => {
  const terrain = createTerrain(f), capsule = createCapsulePacket(), geometry = geometryChecks(f, capsule, terrain);
  const runs = [];
  for (let r = 0; r < 2; r++) {
    let c, states = [], error2 = null;
    try {
      c = createUprightCapsuleController(config(f));
      states.push(c.getSnapshot());
      for (let i = 0; i < 240; i++) states.push(c.step(command(f)));
    } catch (e) {
      error2 = { name: e.name, code: e.code, message: e.message };
    } finally {
      c?.dispose();
    }
    runs.push({ states, rawHex: hex(encode(numbers(states))), error: error2 });
  }
  return { name: f.name, runs, geometry, terrain, capsule };
});
console.log(JSON.stringify(output));
