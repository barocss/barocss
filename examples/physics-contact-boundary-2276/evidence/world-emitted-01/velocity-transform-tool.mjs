// examples/physics-contact-boundary-2276/evidence/world-emitted-01/modules/examples/physics-stack-solver-2276/world-adapter.js
import { createHash } from "node:crypto";

// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

// examples/physics-contact-boundary-2276/evidence/world-emitted-01/modules/examples/physics-stack-solver-2276/candidate.js
var NORMAL_CANDIDATE_GATES = Object.freeze({
  normal: 1e-10,
  complementarity: 1e-10,
  stationarity: 1e-10,
  tangent: 1e-10,
  rank: 1e-12
});
var NORMAL_CANDIDATE_BUDGET = Object.freeze({
  outerIterations: 64,
  blockQrFactorizations: 64,
  activeChanges: 64,
  rankTests: 2048,
  dotProducts: 4e5,
  dotScalarProducts: 32e6,
  vectorUpdates: 1e7,
  triangularTerms: 4e4,
  constraintTests: 4096
});
var Stop = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function numeric(message) {
  throw new Stop("NUMERIC", message);
}
function need(value, message) {
  if (!value)
    numeric(message);
}
function finite(x) {
  if (!Number.isFinite(x))
    numeric("nonfinite arithmetic");
  return x;
}
function stats() {
  return {
    outerIterations: 0,
    blockQrFactorizations: 0,
    activeChanges: 0,
    qrRank: 0,
    finalActiveRows: 0,
    dynamicDof: 0,
    rankTests: 0,
    dotProducts: 0,
    dotScalarProducts: 0,
    vectorUpdates: 0,
    triangularTerms: 0,
    constraintTests: 0
  };
}
function take(s, key, amount = 1) {
  if (s[key] + amount > NORMAL_CANDIDATE_BUDGET[key])
    throw new Stop("ITERATION_LIMIT", "budget:" + key);
  s[key] += amount;
}
function dot(a, b, s) {
  take(s, "dotProducts");
  take(s, "dotScalarProducts", a.length);
  let value = 0;
  for (let i = 0; i < a.length; i++)
    value = finite(value + finite(a[i] * b[i]));
  return value;
}
function axpy(target, source, amount, s) {
  take(s, "vectorUpdates", target.length);
  for (let i = 0; i < target.length; i++)
    target[i] = finite(target[i] + finite(amount * source[i]));
}
function cross(a, b) {
  return [finite(a[1] * b[2] - a[2] * b[1]), finite(a[2] * b[0] - a[0] * b[2]), finite(a[0] * b[1] - a[1] * b[0])];
}
function subtract(a, b) {
  return [finite(a[0] - b[0]), finite(a[1] - b[1]), finite(a[2] - b[2])];
}
function validVector(v, limit) {
  return Array.isArray(v) && v.length === 3 && Array.from({ length: 3 }, (_, i) => i).every((i) => Object.hasOwn(v, i) && typeof v[i] === "number" && Number.isFinite(v[i]) && Math.abs(v[i]) <= limit);
}
function copyBody(body) {
  return {
    id: body.id,
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    angularVelocityRadps: [...body.angularVelocityRadps],
    inverseMass: body.inverseMass,
    inverseInertiaWorld: body.inverseInertiaWorld.map((row) => [...row])
  };
}
function read(value) {
  need(value && Array.isArray(value.bodies) && value.bodies.length >= 1 && value.bodies.length <= 9 && Array.isArray(value.points) && value.points.length <= 32, "body/point bound");
  const ids = /* @__PURE__ */ new Set();
  let dynamic = 0;
  for (const body of value.bodies) {
    need(body && typeof body.id === "string" && body.id.length > 0 && body.id.length <= 1024 && !ids.has(body.id), "body id");
    ids.add(body.id);
    need(validVector(body.positionM, 1e4) && validVector(body.velocityMps, 1e3) && validVector(body.angularVelocityRadps, 1e3), "body vectors");
    need(typeof body.inverseMass === "number" && Number.isFinite(body.inverseMass) && (body.inverseMass === 0 || body.inverseMass >= 1e-6 && body.inverseMass <= 1e6), "inverse mass");
    need(Array.isArray(body.inverseInertiaWorld) && body.inverseInertiaWorld.length === 3 && body.inverseInertiaWorld.every((row) => validVector(row, 1e6)), "inverse inertia");
    if (body.inverseMass === 0) {
      need([...body.velocityMps, ...body.angularVelocityRadps, ...body.inverseInertiaWorld.flat()].every((x) => x === 0), "static input must have zero motion and inertia");
    } else
      dynamic++;
  }
  need(dynamic >= 1 && dynamic <= 8, "dynamic body bound");
  const pointIds = /* @__PURE__ */ new Set();
  for (const point of value.points) {
    need(point && typeof point.id === "string" && point.id.length > 0 && point.id.length <= 4096 && !pointIds.has(point.id), "point id");
    pointIds.add(point.id);
    need(ids.has(point.aId) && ids.has(point.bId) && point.aId !== point.bId, "point endpoints");
    need(validVector(point.pointM, 1e4) && validVector(point.normalAtoB, 1 + 1e-12), "point vectors");
    need(Math.abs(Math.hypot(...point.normalAtoB) - 1) <= 1e-12, "unit normal");
  }
  return { bodies: value.bodies.map(copyBody), points: value.points.map((p) => ({
    ...p,
    pointM: [...p.pointM],
    normalAtoB: [...p.normalAtoB]
  })) };
}
function cholesky(matrix, s) {
  const scale = Math.max(1, ...matrix.flat().map(Math.abs));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      need(matrix[i][j] === matrix[j][i], "symmetric inertia required");
  const lower = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j <= i; j++) {
      let entry = matrix[i][j];
      for (let k = 0; k < j; k++) {
        take(s, "triangularTerms");
        entry = finite(entry - finite(lower[i][k] * lower[j][k]));
      }
      if (i === j) {
        need(entry > 1e-12 * scale, "positive definite well-scaled inertia required");
        lower[i][j] = Math.sqrt(entry);
      } else
        lower[i][j] = finite(entry / lower[j][j]);
    }
  return lower;
}
function model(input, s) {
  const blocks = [], free = [];
  for (const body of input.bodies) {
    if (body.inverseMass === 0) {
      blocks.push({ offset: null, rootMass: 0, angular: [] });
      continue;
    }
    const angular = cholesky(body.inverseInertiaWorld, s), rootMass = Math.sqrt(body.inverseMass), offset = free.length;
    for (const value of body.velocityMps)
      free.push(finite(value / rootMass));
    const local = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let value = body.angularVelocityRadps[i];
      for (let j = 0; j < i; j++) {
        take(s, "triangularTerms");
        value = finite(value - finite(angular[i][j] * local[j]));
      }
      local[i] = finite(value / angular[i][i]);
    }
    free.push(...local);
    blocks.push({ offset, rootMass, angular });
  }
  s.dynamicDof = free.length;
  const ids = new Map(input.bodies.map((body, i) => [body.id, i]));
  const a = input.points.map((point) => {
    const row = Array(free.length).fill(0);
    let dynamicEndpoint = false;
    for (const [id, sign] of [[point.aId, -1], [point.bId, 1]]) {
      const index = ids.get(id), body = input.bodies[index], block = blocks[index];
      const arm = subtract(point.pointM, body.positionM);
      need(arm.every((x) => Math.abs(x) <= 10), "contact arm bound");
      if (block.offset === null)
        continue;
      dynamicEndpoint = true;
      const torque = cross(arm, point.normalAtoB);
      for (let k = 0; k < 3; k++) {
        row[block.offset + k] = finite(sign * point.normalAtoB[k] * block.rootMass);
        row[block.offset + 3 + k] = finite(sign * dot(torque, block.angular.map((r) => r[k]), s));
      }
    }
    need(dynamicEndpoint, "static/static contact unsupported");
    return row;
  });
  return { input, blocks, a, free };
}
function factor(a, candidates, s) {
  take(s, "blockQrFactorizations");
  const residual = new Map(candidates.map((i) => [i, [...a[i]]]));
  const remaining = [...candidates], rows = [], q = [];
  const scale = Math.max(1, ...candidates.map((i) => Math.sqrt(dot(a[i], a[i], s))));
  while (remaining.length) {
    let pivot = remaining[0], square = -1;
    for (const index of remaining) {
      const value = dot(residual.get(index), residual.get(index), s);
      if (value > square || value === square && index < pivot) {
        pivot = index;
        square = value;
      }
    }
    take(s, "rankTests");
    if (Math.sqrt(Math.max(0, square)) <= NORMAL_CANDIDATE_GATES.rank * scale)
      break;
    const direction = [...a[pivot]];
    for (let pass = 0; pass < 2; pass++)
      for (const basis2 of q)
        axpy(direction, basis2, -dot(direction, basis2, s), s);
    const length = Math.sqrt(dot(direction, direction, s));
    need(length > NORMAL_CANDIDATE_GATES.rank * scale, "inconsistent rank decision");
    const basis = direction.map((value) => finite(value / length));
    for (const prior of q)
      need(Math.abs(dot(basis, prior, s)) <= 1e-12, "orthogonality");
    q.push(basis);
    rows.push(pivot);
    remaining.splice(remaining.indexOf(pivot), 1);
    for (const index of remaining)
      for (let pass = 0; pass < 2; pass++) {
        const target = residual.get(index);
        axpy(target, basis, -dot(target, basis, s), s);
      }
  }
  const lower = rows.map((index, i) => q.slice(0, i + 1).map((basis) => dot(a[index], basis, s)));
  return { rows, q, lower };
}
function equality(m, qr, s) {
  const c = qr.q.map((row) => dot(row, m.free, s)), target = [...m.free];
  for (let i = 0; i < qr.q.length; i++)
    axpy(target, qr.q[i], -c[i], s);
  const lambda = Array(qr.rows.length).fill(0);
  for (let i = lambda.length - 1; i >= 0; i--) {
    let value = -c[i];
    for (let j = i + 1; j < lambda.length; j++) {
      take(s, "triangularTerms");
      value = finite(value - finite(qr.lower[j][i] * lambda[j]));
    }
    lambda[i] = finite(value / qr.lower[i][i]);
  }
  return { target, lambda };
}
function outputBodies(m, x, s) {
  return m.input.bodies.map((body, index) => {
    const result = copyBody(body), block = m.blocks[index];
    if (block.offset !== null) {
      result.velocityMps = [0, 1, 2].map((k) => finite(block.rootMass * x[block.offset + k]));
      result.angularVelocityRadps = block.angular.map((row) => dot(row, x.slice(block.offset + 3, block.offset + 6), s));
    }
    return result;
  });
}
function finish(m, x, active, multipliers, s) {
  const lambda = Array(m.a.length).fill(0);
  active.forEach((index, i) => {
    need(multipliers[i] >= -1e-10, "negative active multiplier");
    lambda[index] = Math.max(0, multipliers[i]);
  });
  const bodies = outputBodies(m, x, s), ids = new Map(bodies.map((body, i) => [body.id, i]));
  const rowResiduals = m.input.points.map((point, i) => {
    take(s, "constraintTests");
    const velocities = [point.aId, point.bId].map((id) => {
      const body = bodies[ids.get(id)], spin = cross(body.angularVelocityRadps, subtract(point.pointM, body.positionM));
      return body.velocityMps.map((v, k) => finite(v + spin[k]));
    });
    const relative = subtract(velocities[1], velocities[0]), vn = dot(relative, point.normalAtoB, s);
    const tangent = relative.map((value, k) => finite(value - point.normalAtoB[k] * vn));
    return {
      id: point.id,
      normalSpeedMps: vn,
      negativeNormalImpulseNs: Math.max(0, -lambda[i]),
      complementarityJ: Math.abs(finite(lambda[i] * vn)),
      tangentSpeedMps: Math.hypot(...tangent)
    };
  });
  let stationarity = 0;
  for (let k = 0; k < x.length; k++) {
    const reaction = dot(m.a.map((row) => row[k]), lambda, s);
    stationarity = Math.max(stationarity, Math.abs(finite(x[k] - m.free[k] - reaction)));
  }
  const certificate = {
    maxClosingNormalSpeedMps: Math.max(0, ...rowResiduals.map((row) => -row.normalSpeedMps)),
    maxNegativeNormalImpulseNs: Math.max(0, ...rowResiduals.map((row) => row.negativeNormalImpulseNs)),
    maxComplementarityJ: Math.max(0, ...rowResiduals.map((row) => row.complementarityJ)),
    maxStationaritySqrtJ: stationarity,
    maxLoadedTangentSpeedMps: Math.max(0, ...rowResiduals.filter((_, i) => lambda[i] > 0).map((row) => row.tangentSpeedMps)),
    zeroTangentFeasible: false
  };
  certificate.zeroTangentFeasible = certificate.maxLoadedTangentSpeedMps <= 1e-10;
  need(certificate.maxClosingNormalSpeedMps <= 1e-10 && certificate.maxNegativeNormalImpulseNs <= 1e-10 && certificate.maxComplementarityJ <= 1e-10 && certificate.maxStationaritySqrtJ <= 1e-10, "final certificate");
  s.finalActiveRows = active.length;
  return {
    ok: true,
    status: "SOLVED_NORMAL_ONLY",
    bodies,
    normalImpulsesNs: [...lambda],
    rowResiduals,
    certificate,
    stats: { ...s },
    reason: null
  };
}
function solveNormalContacts(problem) {
  const s = stats();
  let input = null;
  try {
    input = read(problem);
    const m = model(input, s);
    let current = Array(m.free.length).fill(0), active = null;
    for (; ; ) {
      take(s, "outerIterations");
      const qr = factor(m.a, active ?? m.a.map((_, i) => i), s);
      if (active === null)
        s.qrRank = qr.rows.length;
      else
        need(qr.rows.length === active.length, "dependent working basis");
      active = [...qr.rows];
      const solved = equality(m, qr, s), direction = solved.target.map((value, i) => finite(value - current[i]));
      const directionNorm = Math.sqrt(dot(direction, direction, s));
      let alpha = 1, blocker = null;
      if (directionNorm > 1e-12 * Math.max(1, Math.sqrt(dot(m.free, m.free, s)))) {
        for (let i = 0; i < m.a.length; i++) {
          take(s, "constraintTests");
          if (active.includes(i))
            continue;
          const margin = dot(m.a[i], current, s), slope = dot(m.a[i], direction, s);
          need(margin >= -1e-10, "lost feasible iterate");
          if (slope < -1e-12) {
            const step = finite(Math.max(0, margin) / -slope);
            if (step < alpha || step === alpha && step < 1 && (blocker === null || i < blocker)) {
              alpha = step;
              blocker = i;
            }
          }
        }
      }
      if (blocker !== null && alpha < 1) {
        axpy(current, direction, alpha, s);
        take(s, "activeChanges");
        active.push(blocker);
        continue;
      }
      current = solved.target;
      let leaving = null;
      for (let i = 0; i < active.length; i++)
        if (solved.lambda[i] < -1e-10 && (leaving === null || active[i] < active[leaving]))
          leaving = i;
      if (leaving !== null) {
        take(s, "activeChanges");
        active.splice(leaving, 1);
        continue;
      }
      return finish(m, current, active, solved.lambda, s);
    }
  } catch (error) {
    if (!(error instanceof Stop))
      throw error;
    return {
      ok: false,
      status: error.status,
      bodies: input?.bodies.map(copyBody) ?? [],
      normalImpulsesNs: null,
      rowResiduals: null,
      certificate: null,
      stats: { ...s },
      reason: error.message
    };
  }
}

// examples/physics-contact-boundary-2276/evidence/world-emitted-01/modules/examples/physics-stack-solver-2276/world-adapter.js
var ORIGINAL_GLOBAL_ISLAND_SHA256 = "670f5226576cb0a2c1963705b99704be71d4ebd3ad38c312adf9c16d43781d8d";
var START = "  /** Initialize every point, warm every eligible patch, then solve globally. */";
var END = "  /** Fresh geometry for position-only correction; no new velocity/cache rows. */";
var hash = (value) => createHash("sha256").update(value).digest("hex");
function transformGlobalIslandSource(source, adapterModulePath) {
  if (hash(source) !== ORIGINAL_GLOBAL_ISLAND_SHA256)
    throw new Error("NORMAL_ADAPTER_ORIGINAL_SOURCE_HASH");
  const startCount = source.split(START).length - 1, endCount = source.split(END).length - 1;
  if (startCount !== 1 || endCount !== 1)
    throw new Error("NORMAL_ADAPTER_SOURCE_ANCHOR_COUNT");
  if (!adapterModulePath.startsWith("/") || !adapterModulePath.endsWith("/world-adapter.ts")) {
    throw new Error("NORMAL_ADAPTER_ABSOLUTE_MODULE_REQUIRED");
  }
  const start = source.indexOf(START), end = source.indexOf(END);
  if (end <= start)
    throw new Error("NORMAL_ADAPTER_SOURCE_ANCHOR_ORDER");
  const replaced = source.slice(start, end);
  const replacement = `  /** Experimental cold coupled normal solve; no old warm starts or sweeps. */
  solve(): void {
    this.#requirePhase('assembled');
    const cold = solveFrozenNormalIsland(this.#bodies, this.#patches);
    for (const [key, impulse] of cold.pointsMap) this.#pointsMap.set(key, impulse);
    this.#pointLedger.push(...cold.pointLedger);
    this.#warmStats.coldPoints = cold.pointLedger.length;
    this.#phase = 'solved';
  }

`;
  const helperImport = `import { solveFrozenNormalIsland } from ${JSON.stringify(adapterModulePath)};
`;
  const contents = helperImport + source.slice(0, start) + replacement + source.slice(end);
  return { contents, receipt: {
    inputSha256: hash(source),
    outputSha256: hash(contents),
    replacedBlockSha256: hash(replaced),
    inputBytes: Buffer.byteLength(source),
    outputBytes: Buffer.byteLength(contents),
    replacedBlockBytes: Buffer.byteLength(replaced),
    startAnchorCount: startCount,
    endAnchorCount: endCount,
    helperImport,
    changedRegion: "entire velocity solve including warm start"
  } };
}
var observer = null;
var attemptOrdinal = 0;
function setNormalIslandObserver(callback) {
  observer = callback;
  attemptOrdinal = 0;
}
function notify(event) {
  observer?.(structuredClone(event));
}
function requireProfile(condition, message) {
  if (!condition)
    throw new PhysicsError("NUMERIC_LIMIT", "private cold normal adapter: " + message);
}
function same(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
function admittedBody(body) {
  requireProfile(body.frictionStatic === 1 && body.frictionDynamic === 0.7 && body.restitution === 0, "original material required");
  requireProfile(body.shape.kind === "box" && !body.sensor && !body.ccd, "original unsensed boxes required");
  let inverseInertiaWorld;
  if (body.kind === "dynamic") {
    requireProfile(body.inverseMass === 1 && same(body.shape.halfExtentsM, [0.25, 0.25, 0.25]) && same(body.inverseInertiaLocal, [24, 24, 24]), "one-kilogram isotropic24I cubes required");
    inverseInertiaWorld = [[24, 0, 0], [0, 24, 0], [0, 0, 24]];
  } else {
    requireProfile(body.kind === "static" && body.inverseMass === 0 && same(body.inverseInertiaLocal, [0, 0, 0]) && same(body.velocityMps, [0, 0, 0]) && same(body.angularVelocityRadps, [0, 0, 0]) && same(body.shape.halfExtentsM, [2, 0.1, 2]) && same(body.positionM, [0, -0.1, 0]) && same(body.orientation, [0, 0, 0, 1]), "original static floor required");
    inverseInertiaWorld = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  }
  return {
    id: body.id,
    positionM: [...body.positionM],
    velocityMps: [...body.velocityMps],
    angularVelocityRadps: [...body.angularVelocityRadps],
    inverseMass: body.inverseMass,
    inverseInertiaWorld
  };
}
function pointVelocity(body, point) {
  const r = point.map((value, i) => value - body.positionM[i]), w = body.angularVelocityRadps;
  return [
    body.velocityMps[0] + w[1] * r[2] - w[2] * r[1],
    body.velocityMps[1] + w[2] * r[0] - w[0] * r[2],
    body.velocityMps[2] + w[0] * r[1] - w[1] * r[0]
  ];
}
function enforceTangentFeasibility(problem, result) {
  requireProfile(result.ok && result.status === "SOLVED_NORMAL_ONLY" && result.normalImpulsesNs && result.rowResiduals && result.certificate, "candidate did not return solved normal rows");
  requireProfile(result.normalImpulsesNs.length === problem.points.length && result.rowResiduals.length === problem.points.length && result.bodies.length === problem.bodies.length, "candidate count mismatch");
  requireProfile(result.certificate.zeroTangentFeasible && result.certificate.maxLoadedTangentSpeedMps <= 1e-10, "loaded tangent speed exceeds1e-10m/s");
  const ids = new Map(result.bodies.map((body) => [body.id, body]));
  for (let i = 0; i < problem.points.length; i++) {
    const point = problem.points[i], lambda = result.normalImpulsesNs[i];
    requireProfile(Number.isFinite(lambda) && lambda >= 0, "invalid normal impulse");
    if (lambda === 0)
      continue;
    const a = ids.get(point.aId), b = ids.get(point.bId);
    requireProfile(a && b, "candidate endpoint mismatch");
    const va = pointVelocity(a, point.pointM), vb = pointVelocity(b, point.pointM);
    const relative = vb.map((value, k) => value - va[k]);
    const vn = relative.reduce((sum, value, k) => sum + value * point.normalAtoB[k], 0);
    const tangent = relative.map((value, k) => value - vn * point.normalAtoB[k]);
    requireProfile(Math.hypot(...tangent) <= 1e-10 && result.rowResiduals[i].tangentSpeedMps <= 1e-10, "independent loaded tangent speed exceeds1e-10m/s");
  }
}
function solveFrozenNormalIsland(bodies, patches) {
  const ordinal = ++attemptOrdinal;
  const assembledPointCount = patches.reduce((count, patch) => count + patch.points.length, 0);
  const assembledPatchCount = patches.length;
  let problem = null, candidate = null;
  const pointMapping = [];
  let pointsMap, pointLedger;
  try {
    requireProfile(bodies.length === 9 && bodies.filter((body) => body.kind === "dynamic").length === 8 && bodies.filter((body) => body.kind === "static").length === 1, "original eight-box body profile required");
    requireProfile(assembledPointCount <= 32, "more than32actual points");
    const inputBodies = bodies.map(admittedBody);
    const points = [];
    for (const patch of patches) {
      requireProfile(bodies[patch.aIndex]?.id === patch.aId && bodies[patch.bIndex]?.id === patch.bId && patch.aIndex !== patch.bIndex && patch.pairKey === patch.aId + "\0" + patch.bId, "source patch identity");
      for (const point of patch.points) {
        const candidateId = JSON.stringify([patch.pairKey, point.id]);
        pointMapping.push({
          index: points.length,
          candidateId,
          pairKey: patch.pairKey,
          pointId: point.id,
          aId: patch.aId,
          bId: patch.bId,
          family: patch.family
        });
        points.push({ id: candidateId, aId: patch.aId, bId: patch.bId, pointM: [...point.pointM], normalAtoB: [...patch.normal] });
      }
    }
    problem = { bodies: inputBodies, points };
    candidate = solveNormalContacts(problem);
    if (!candidate.ok)
      throw new PhysicsError(candidate.status === "ITERATION_LIMIT" ? "ITERATION_LIMIT" : "NUMERIC_LIMIT", "private cold normal candidate: " + candidate.reason);
    enforceTangentFeasibility(problem, candidate);
    candidate.bodies.forEach((body, i) => requireProfile(body.id === bodies[i].id && same(body.positionM, bodies[i].positionM), "candidate body order or pose changed"));
    pointsMap = /* @__PURE__ */ new Map();
    pointLedger = [];
    for (let i = 0; i < pointMapping.length; i++) {
      const mapping = pointMapping[i], point = points[i], normalNs = candidate.normalImpulsesNs[i];
      const aIndex = bodies.findIndex((body) => body.id === mapping.aId), bIndex = bodies.findIndex((body) => body.id === mapping.bId);
      const final = { normalNs, tangentNs: [0, 0, 0] };
      pointsMap.set(mapping.pairKey + "\0" + mapping.pointId, { normalNs, tangentNs: [0, 0, 0] });
      pointLedger.push({
        aId: mapping.aId,
        bId: mapping.bId,
        aIndex,
        bIndex,
        pairKey: mapping.pairKey,
        pointId: mapping.pointId,
        family: mapping.family,
        pointM: [...point.pointM],
        normal: [...point.normalAtoB],
        aPositionM: [...bodies[aIndex].positionM],
        bPositionM: [...bodies[bIndex].positionM],
        warm: { normalNs: 0, tangentNs: [0, 0, 0] },
        final
      });
    }
    requireProfile(pointsMap.size === points.length && pointLedger.length === points.length, "source point keys collided");
  } catch (error) {
    notify({
      attemptOrdinal: ordinal,
      assembledPointCount,
      assembledPatchCount,
      problem,
      candidate,
      pointMapping,
      velocitySolveAccepted: false,
      refusal: error instanceof PhysicsError ? { code: error.code, message: error.message } : { code: "UNKNOWN", message: "unexpected adapter error" }
    });
    throw error;
  }
  notify({ attemptOrdinal: ordinal, assembledPointCount, assembledPatchCount, problem, candidate, pointMapping, velocitySolveAccepted: true, refusal: null });
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].velocityMps = [...candidate.bodies[i].velocityMps];
    bodies[i].angularVelocityRadps = [...candidate.bodies[i].angularVelocityRadps];
  }
  return { pointsMap, pointLedger };
}
export {
  ORIGINAL_GLOBAL_ISLAND_SHA256,
  setNormalIslandObserver,
  solveFrozenNormalIsland,
  transformGlobalIslandSource
};
