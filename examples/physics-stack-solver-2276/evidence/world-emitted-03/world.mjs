// packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
  }
};

// examples/physics-stack-solver-2276/evidence/world-emitted-03/modules/examples/physics-stack-solver-2276/candidate.js
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
  for (const point2 of value.points) {
    need(point2 && typeof point2.id === "string" && point2.id.length > 0 && point2.id.length <= 4096 && !pointIds.has(point2.id), "point id");
    pointIds.add(point2.id);
    need(ids.has(point2.aId) && ids.has(point2.bId) && point2.aId !== point2.bId, "point endpoints");
    need(validVector(point2.pointM, 1e4) && validVector(point2.normalAtoB, 1 + 1e-12), "point vectors");
    need(Math.abs(Math.hypot(...point2.normalAtoB) - 1) <= 1e-12, "unit normal");
  }
  return { bodies: value.bodies.map(copyBody), points: value.points.map((p) => ({
    ...p,
    pointM: [...p.pointM],
    normalAtoB: [...p.normalAtoB]
  })) };
}
function cholesky(matrix, s) {
  const scale2 = Math.max(1, ...matrix.flat().map(Math.abs));
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
        need(entry > 1e-12 * scale2, "positive definite well-scaled inertia required");
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
  const a = input.points.map((point2) => {
    const row = Array(free.length).fill(0);
    let dynamicEndpoint = false;
    for (const [id, sign] of [[point2.aId, -1], [point2.bId, 1]]) {
      const index = ids.get(id), body = input.bodies[index], block = blocks[index];
      const arm = subtract(point2.pointM, body.positionM);
      need(arm.every((x) => Math.abs(x) <= 10), "contact arm bound");
      if (block.offset === null)
        continue;
      dynamicEndpoint = true;
      const torque = cross(arm, point2.normalAtoB);
      for (let k = 0; k < 3; k++) {
        row[block.offset + k] = finite(sign * point2.normalAtoB[k] * block.rootMass);
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
  const scale2 = Math.max(1, ...candidates.map((i) => Math.sqrt(dot(a[i], a[i], s))));
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
    if (Math.sqrt(Math.max(0, square)) <= NORMAL_CANDIDATE_GATES.rank * scale2)
      break;
    const direction2 = [...a[pivot]];
    for (let pass = 0; pass < 2; pass++)
      for (const basis3 of q)
        axpy(direction2, basis3, -dot(direction2, basis3, s), s);
    const length = Math.sqrt(dot(direction2, direction2, s));
    need(length > NORMAL_CANDIDATE_GATES.rank * scale2, "inconsistent rank decision");
    const basis2 = direction2.map((value) => finite(value / length));
    for (const prior of q)
      need(Math.abs(dot(basis2, prior, s)) <= 1e-12, "orthogonality");
    q.push(basis2);
    rows.push(pivot);
    remaining.splice(remaining.indexOf(pivot), 1);
    for (const index of remaining)
      for (let pass = 0; pass < 2; pass++) {
        const target = residual.get(index);
        axpy(target, basis2, -dot(target, basis2, s), s);
      }
  }
  const lower = rows.map((index, i) => q.slice(0, i + 1).map((basis2) => dot(a[index], basis2, s)));
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
  const rowResiduals = m.input.points.map((point2, i) => {
    take(s, "constraintTests");
    const velocities = [point2.aId, point2.bId].map((id) => {
      const body = bodies[ids.get(id)], spin = cross(body.angularVelocityRadps, subtract(point2.pointM, body.positionM));
      return body.velocityMps.map((v, k) => finite(v + spin[k]));
    });
    const relative = subtract(velocities[1], velocities[0]), vn = dot(relative, point2.normalAtoB, s);
    const tangent = relative.map((value, k) => finite(value - point2.normalAtoB[k] * vn));
    return {
      id: point2.id,
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
      const solved = equality(m, qr, s), direction2 = solved.target.map((value, i) => finite(value - current[i]));
      const directionNorm = Math.sqrt(dot(direction2, direction2, s));
      let alpha = 1, blocker = null;
      if (directionNorm > 1e-12 * Math.max(1, Math.sqrt(dot(m.free, m.free, s)))) {
        for (let i = 0; i < m.a.length; i++) {
          take(s, "constraintTests");
          if (active.includes(i))
            continue;
          const margin = dot(m.a[i], current, s), slope = dot(m.a[i], direction2, s);
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
        axpy(current, direction2, alpha, s);
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
  } catch (error2) {
    if (!(error2 instanceof Stop))
      throw error2;
    return {
      ok: false,
      status: error2.status,
      bodies: input?.bodies.map(copyBody) ?? [],
      normalImpulsesNs: null,
      rowResiduals: null,
      certificate: null,
      stats: { ...s },
      reason: error2.message
    };
  }
}

// examples/physics-stack-solver-2276/evidence/world-emitted-03/modules/examples/physics-stack-solver-2276/world-adapter.js
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
function pointVelocity(body, point2) {
  const r = point2.map((value, i) => value - body.positionM[i]), w = body.angularVelocityRadps;
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
    const point2 = problem.points[i], lambda = result.normalImpulsesNs[i];
    requireProfile(Number.isFinite(lambda) && lambda >= 0, "invalid normal impulse");
    if (lambda === 0)
      continue;
    const a = ids.get(point2.aId), b = ids.get(point2.bId);
    requireProfile(a && b, "candidate endpoint mismatch");
    const va = pointVelocity(a, point2.pointM), vb = pointVelocity(b, point2.pointM);
    const relative = vb.map((value, k) => value - va[k]);
    const vn = relative.reduce((sum2, value, k) => sum2 + value * point2.normalAtoB[k], 0);
    const tangent = relative.map((value, k) => value - vn * point2.normalAtoB[k]);
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
      for (const point2 of patch.points) {
        const candidateId = JSON.stringify([patch.pairKey, point2.id]);
        pointMapping.push({
          index: points.length,
          candidateId,
          pairKey: patch.pairKey,
          pointId: point2.id,
          aId: patch.aId,
          bId: patch.bId,
          family: patch.family
        });
        points.push({ id: candidateId, aId: patch.aId, bId: patch.bId, pointM: [...point2.pointM], normalAtoB: [...patch.normal] });
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
      const mapping = pointMapping[i], point2 = points[i], normalNs = candidate.normalImpulsesNs[i];
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
        pointM: [...point2.pointM],
        normal: [...point2.normalAtoB],
        aPositionM: [...bodies[aIndex].positionM],
        bPositionM: [...bodies[bIndex].positionM],
        warm: { normalNs: 0, tangentNs: [0, 0, 0] },
        final
      });
    }
    requireProfile(pointsMap.size === points.length && pointLedger.length === points.length, "source point keys collided");
  } catch (error2) {
    notify({
      attemptOrdinal: ordinal,
      assembledPointCount,
      assembledPatchCount,
      problem,
      candidate,
      pointMapping,
      velocitySolveAccepted: false,
      refusal: error2 instanceof PhysicsError ? { code: error2.code, message: error2.message } : { code: "UNKNOWN", message: "unexpected adapter error" }
    });
    throw error2;
  }
  notify({ attemptOrdinal: ordinal, assembledPointCount, assembledPatchCount, problem, candidate, pointMapping, velocitySolveAccepted: true, refusal: null });
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].velocityMps = [...candidate.bodies[i].velocityMps];
    bodies[i].angularVelocityRadps = [...candidate.bodies[i].angularVelocityRadps];
  }
  return { pointsMap, pointLedger };
}

// packages/barocss-physics/src/limits.ts
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
var MAX_BODIES = 32;
var MAX_LARGE_BODIES = 64;
var MAX_STEPS = 3600;
var MAX_STEP_DISPLACEMENT_M = 10;
var MAX_COMMANDS = 64;
var MAX_FORCE_N = 1e6;
var MAX_IMPULSE_NS = 1e5;
var MAX_TORQUE_NM = 1e6;
var MAX_ANGULAR_IMPULSE_NMS = 1e5;

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
function finite2(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    error("INVALID_CONFIG", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function vector(value, min, max, label) {
  if (!Array.isArray(value) || value.length !== 3) error("INVALID_CONFIG", `${label} must be a 3-vector`);
  return [0, 1, 2].map((index) => finite2(value[index], min, max, `${label}[${index}]`));
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
  const values = value.map((component) => finite2(component, -1, 1, "orientation"));
  const magnitude2 = Math.hypot(...values);
  if (Math.abs(magnitude2 - 1) > 1e-6) error("INVALID_CONFIG", "orientation must have unit norm");
  return values.map((component) => component / magnitude2);
}
function shape(value) {
  const input = record(value, "shape");
  if (input.kind === "sphere") {
    fields(input, ["kind", "radiusM"], "sphere");
    return { kind: "sphere", radiusM: finite2(input.radiusM, 1e-4, 1e3, "radiusM") };
  }
  if (input.kind === "box") {
    fields(input, ["kind", "halfExtentsM"], "box");
    return { kind: "box", halfExtentsM: vector(input.halfExtentsM, 1e-4, 1e3, "halfExtentsM") };
  }
  if (input.kind === "capsule") {
    fields(input, ["kind", "radiusM", "halfLengthM"], "capsule");
    return {
      kind: "capsule",
      radiusM: finite2(input.radiusM, 1e-4, 1e3, "radiusM"),
      halfLengthM: finite2(input.halfLengthM, 1e-4, 1e3, "halfLengthM")
    };
  }
  return error("INVALID_CONFIG", "unsupported collider shape");
}
function friction(value) {
  const input = record(value, "friction");
  fields(input, ["static", "dynamic"], "friction");
  const staticCoefficient = finite2(input.static, 0, 2, "friction.static");
  const dynamicCoefficient = finite2(input.dynamic, 0, staticCoefficient, "friction.dynamic");
  return { static: staticCoefficient, dynamic: dynamicCoefficient };
}
function collisionFilter(value) {
  const input = record(value, "collisionFilter");
  fields(input, ["categoryBits", "maskBits"], "collisionFilter");
  if (!Number.isInteger(input.categoryBits) || !Number.isInteger(input.maskBits)) {
    error("INVALID_CONFIG", "collision filter bits must be integers");
  }
  return {
    categoryBits: finite2(input.categoryBits, 1, 65535, "categoryBits"),
    maskBits: finite2(input.maskBits, 0, 65535, "maskBits")
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
  const restitution = finite2(input.restitution, 0, 1, "restitution");
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
  const massKg = finite2(input.massKg, 1e-6, 1e6, "massKg");
  if (parsedShape.kind !== "sphere" && Object.hasOwn(input, "inertiaKgM2")) {
    error("INVALID_CONFIG", "inertiaKgM2 override is supported for spheres only");
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
    velocityMps: vector(input.velocityMps, -1e3, 1e3, "velocityMps"),
    orientation,
    angularVelocityRadps: Object.hasOwn(input, "angularVelocityRadps") ? angularVector(input.angularVelocityRadps) : [0, 0, 0],
    ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
    ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2 },
    inverseInertiaLocal: inertia3.map((value2) => 1 / value2),
    inverseMass: 1 / massKg,
    restitution,
    frictionStatic: material.static,
    frictionDynamic: material.dynamic
  };
}
function copyShape(value) {
  return value.kind === "sphere" ? { kind: "sphere", radiusM: value.radiusM } : value.kind === "box" ? { kind: "box", halfExtentsM: [...value.halfExtentsM] } : { kind: "capsule", radiusM: value.radiusM, halfLengthM: value.halfLengthM };
}
function copyBody2(body) {
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
  const admitted2 = /* @__PURE__ */ new Map();
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
    const previous = admitted2.get(body.id) ?? {};
    if (Object.hasOwn(previous, valueKey)) error("INVALID_COMMAND", `duplicate ${kind} command for ${body.id}`);
    const bound = kind === "force" ? MAX_FORCE_N : kind === "impulse" ? MAX_IMPULSE_NS : kind === "torque" ? MAX_TORQUE_NM : kind === "angularImpulse" ? MAX_ANGULAR_IMPULSE_NMS : 1e4;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted2.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted2;
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
  const scale2 = Math.sin(halfAngle) / speed;
  const delta = [
    angularVelocity[0] * scale2,
    angularVelocity[1] * scale2,
    angularVelocity[2] * scale2,
    Math.cos(halfAngle)
  ];
  const next = multiplyQuaternion(delta, orientation);
  const norm = Math.hypot(...next);
  return next.map((component) => component / norm);
}
var add = (a, b) => a.map((value, index) => value + b[index]);
var sub = (a, b) => a.map((value, index) => value - b[index]);
var scale = (a, value) => a.map((component) => component * value);
var dot2 = (a, b) => a.reduce((sum2, value, index) => sum2 + value * b[index], 0);
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
function rotate(q, v) {
  const axis = [q[0], q[1], q[2]];
  const t = scale(cross2(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross2(axis, t)));
}
var localPoint = (body, point2) => rotate(inverse(body.orientation), sub(point2, body.positionM));
var worldPoint = (body, point2) => add(body.positionM, rotate(body.orientation, point2));
function inverseInertia(body, vector4) {
  const local = rotate(inverse(body.orientation), vector4);
  return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]));
}

// packages/barocss-physics/src/capsule-contact.ts
var clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function capsuleEnds(body) {
  const half = body.shape.halfLengthM;
  return [worldPoint(body, [0, -half, 0]), worldPoint(body, [0, half, 0])];
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
function segmentBox(segmentStart, segmentEnd, extents2) {
  const direction2 = sub(segmentEnd, segmentStart);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction2[axis]) < 1e-15) continue;
    for (const face of [-extents2[axis], extents2[axis]]) {
      const t = (face - segmentStart[axis]) / direction2[axis];
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
      const value = segmentStart[axis] + midpoint * direction2[axis];
      const face = value < -extents2[axis] ? -extents2[axis] : value > extents2[axis] ? extents2[axis] : null;
      if (face === null) continue;
      numerator += direction2[axis] * (segmentStart[axis] - face);
      denominator += direction2[axis] ** 2;
    }
    const t = clamp(denominator ? -numerator / denominator : 0.5, low, high);
    const point3 = add(segmentStart, scale(direction2, t));
    const nearest = point3.map((value, axis) => clamp(value, -extents2[axis], extents2[axis]));
    const delta = sub(point3, nearest), distance = dot2(delta, delta);
    if (distance < bestDistance - 1e-12 || Math.abs(distance - bestDistance) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(bestT - 0.5)) {
      bestT = t;
      bestDistance = distance;
    }
  }
  const point2 = add(segmentStart, scale(direction2, bestT));
  return [point2, point2.map((value, axis) => clamp(value, -extents2[axis], extents2[axis]))];
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
  const [start, end] = capsuleEnds(capsule).map((point2) => localPoint(box, point2));
  const extents2 = box.shape.halfExtentsM;
  const [axisPoint, boxPoint] = segmentBox(start, end, extents2);
  const delta = sub(boxPoint, axisPoint), distance = Math.hypot(...delta);
  const radius = capsule.shape.radiusM;
  if (distance > radius) return null;
  if (distance > 1e-12) return {
    normal: rotate(box.orientation, scale(delta, 1 / distance)),
    penetration: radius - distance,
    pointM: worldPoint(box, boxPoint)
  };
  let bestAxis = 0, bestSide = -1, bestGap = Infinity;
  for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
    const gap = extents2[axis] - side * axisPoint[axis];
    if (gap < bestGap) {
      bestGap = gap;
      bestAxis = axis;
      bestSide = side;
    }
  }
  const normalLocal = [0, 0, 0];
  normalLocal[bestAxis] = -bestSide;
  boxPoint[bestAxis] = bestSide * extents2[bestAxis];
  return {
    normal: rotate(box.orientation, normalLocal),
    penetration: radius + bestGap,
    pointM: worldPoint(box, boxPoint)
  };
}

// packages/barocss-physics/src/collision.ts
function capsuleCenter(body, point2) {
  const half = body.shape.halfLengthM;
  const local = localPoint(body, point2);
  return worldPoint(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport(body, direction2) {
  const axes = boxAxes(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot2(axis, direction2);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
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
  const extents2 = box.shape.halfExtentsM;
  const relative = localPoint(box, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents2[index], Math.min(extents2[index], value)));
  const towardBox = sub(nearest, relative);
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return {
    normal: rotate(box.orientation, scale(towardBox, 1 / distance)),
    penetration: Math.max(0, radius - distance),
    pointM: worldPoint(box, nearest)
  };
  let axis = 0, side = -1, faceDistance = Infinity;
  for (let index = 0; index < 3; index++) for (const candidate of [-1, 1]) {
    const gap = extents2[index] - candidate * relative[index];
    if (gap < faceDistance) {
      faceDistance = gap;
      axis = index;
      side = candidate;
    }
  }
  const localNormal = [0, 0, 0];
  localNormal[axis] = -side;
  nearest[axis] = side * extents2[axis];
  return {
    normal: rotate(box.orientation, localNormal),
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
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross2(axisA, axisB)))];
  for (const candidate of candidates) {
    const length = Math.hypot(...candidate);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum2, basis2, index) => sum2 + extentA[index] * Math.abs(dot2(basis2, axis)), 0);
    const radiusB = axesB.reduce((sum2, basis2, index) => sum2 + extentB[index] * Math.abs(dot2(basis2, axis)), 0);
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
function sphereOverlaps(center, radius, body) {
  if (body.shape.kind === "sphere") {
    return Math.hypot(...sub(center, body.positionM)) <= radius + body.shape.radiusM;
  }
  if (body.shape.kind === "capsule") {
    return Math.hypot(...sub(center, capsuleCenter(body, center))) <= radius + body.shape.radiusM;
  }
  const extents2 = body.shape.halfExtentsM;
  const local = localPoint(body, center);
  const delta = local.map((value, index) => Math.max(0, Math.abs(value) - extents2[index]));
  return Math.hypot(...delta) <= radius;
}
function raySphere(origin, direction2, center, radius) {
  const relative = sub(origin, center);
  const c = dot2(relative, relative) - radius ** 2;
  if (c <= 0) return 0;
  const projection = dot2(relative, direction2);
  const discriminant = projection ** 2 - c;
  return projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
}
function rayDistance(origin, direction2, body) {
  if (body.shape.kind === "sphere") return raySphere(origin, direction2, body.positionM, body.shape.radiusM);
  const localOrigin = localPoint(body, origin);
  const localDirection = rotate(inverse(body.orientation), direction2);
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

// examples/physics-rigid-feature-contact-reference/warm-cache.ts
function emptyWarmCacheStats() {
  return { testedPatches: 0, compatiblePatches: 0, incompatiblePatches: 0, reusedPoints: 0, coldPoints: 0 };
}

// examples/physics-rigid-feature-geometry/sat-feature.ts
var FEATURE_INPUT_MESSAGE = "private feature geometry requires two admitted boxes";
var DIAGNOSTIC_TIE_TOLERANCE_M = 1e-12;
function boxAxes2(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport2(body, direction2) {
  const axes = boxAxes2(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot2(axis, direction2);
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
  const axesA = boxAxes2(a), axesB = boxAxes2(b);
  const extentA = a.shape.halfExtentsM, extentB = b.shape.halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis = [1, 0, 0], bestOverlap = Infinity;
  let bestCandidateIndex = 0, bestRawLength = 0;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross2(axisA, axisB)))];
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
    const radiusA = axesA.reduce((sum2, basis2, index) => sum2 + extentA[index] * Math.abs(dot2(basis2, axis)), 0);
    const radiusB = axesB.reduce((sum2, basis2, index) => sum2 + extentB[index] * Math.abs(dot2(basis2, axis)), 0);
    const signedDistance = dot2(delta, axis);
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
  const aPoint = boxSupport2(a, bestAxis);
  const bPoint = boxSupport2(b, scale(bestAxis, -1));
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
  const gap = dot2(sub(b, a), n);
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

// examples/physics-rigid-feature-geometry/face-contact.ts
function clipFace(polygon, centre, axis, limit) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = dot2(sub(p, centre), axis) - limit, dq = dot2(sub(q, centre), axis) - limit;
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
  const side = dot2(ra[axis], outward) < 0 ? -1 : 1, n = unit(scale(ra[axis], side));
  const centre = add(ref.positionM, scale(ra[axis], side * re[axis]));
  let incidentAxis = 0, greatest = -Infinity;
  for (let i = 0; i < 3; i++) {
    const v = Math.abs(dot2(ia[i], n));
    if (v > greatest) {
      greatest = v;
      incidentAxis = i;
    }
  }
  const incidentSide = dot2(ia[incidentAxis], n) > 0 ? -1 : 1;
  const incidentCentre = add(inc.positionM, scale(ia[incidentAxis], incidentSide * ie[incidentAxis]));
  const it = [0, 1, 2].filter((i) => i !== incidentAxis), rt = [0, 1, 2].filter((i) => i !== axis);
  let poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => add(add(incidentCentre, scale(ia[it[0]], u * ie[it[0]])), scale(ia[it[1]], v * ie[it[1]])));
  for (const i of rt) {
    poly = clipFace(poly, centre, ra[i], re[i]);
    poly = clipFace(poly, centre, scale(ra[i], -1), re[i]);
  }
  const planeNormalAtoB = isA ? n : scale(n, -1);
  const candidates = poly.map((p) => {
    const separation = dot2(sub(p, centre), n), r = sub(p, scale(n, separation));
    return { p, r, separation, u: dot2(sub(r, centre), ra[rt[0]]), v: dot2(sub(r, centre), ra[rt[1]]) };
  }).filter((p) => p.separation <= WITNESS_TOLERANCE_M);
  if (!candidates.length) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const selected = candidates.length <= 4 ? candidates : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => candidates.reduce((best, p) => u * p.u + v * p.v > u * best.u + v * best.v ? p : best, candidates[0]));
  const unique = selected.filter((p, i) => selected.findIndex((q) => Math.hypot(...sub(p.r, q.r)) <= DUPLICATE_TOLERANCE_M) === i);
  unique.sort((p, q) => p.u - q.u || p.v - q.v);
  const prefix = `face:${ref.id}:${axis}:${side}:${inc.id}:${incidentAxis}:${incidentSide}`;
  const points = unique.map((p, i) => point(`${prefix}:${i}`, isA ? p.r : p.p, isA ? p.p : p.r, planeNormalAtoB));
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
      uniquePhysicalFeatureClaimed: false
    }
  };
}

// examples/physics-rigid-feature-geometry/edge-contact.ts
var clamp2 = (v) => Math.max(0, Math.min(1, v));
function closestSegments(p, p1, q, q1) {
  const u = sub(p1, p), v = sub(q1, q), r = sub(q, p), uu = dot2(u, u), vv = dot2(v, v), uv = dot2(u, v), c = cross2(u, v), den = dot2(c, c);
  if (![...p, ...p1, ...q, ...q1, uu, vv, den].every(Number.isFinite) || uu <= 0 || vv <= 0) error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const pairs = [
    { s: 0, t: clamp2(-dot2(r, v) / vv) },
    { s: 1, t: clamp2((uv - dot2(r, v)) / vv) },
    { s: clamp2(dot2(r, u) / uu), t: 0 },
    { s: clamp2((dot2(r, u) + uv) / uu), t: 1 }
  ];
  if (den > 0) {
    const s = dot2(cross2(r, v), c) / den, t = dot2(cross2(r, u), c) / den;
    if (Number.isFinite(s) && Number.isFinite(t) && s >= 0 && s <= 1 && t >= 0 && t <= 1) pairs.push({ s, t });
  }
  let best = pairs[0], bestDistance = Infinity;
  for (const pair of pairs) {
    const d = sub(add(p, scale(u, pair.s)), add(q, scale(v, pair.t))), ds = dot2(d, d);
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
function supportEdge(body, axis, direction2) {
  const axes = basis(body), e = extents(body), sides = [0, 0, 0];
  let centre = [...body.positionM];
  for (let i = 0; i < 3; i++) if (i !== axis) {
    sides[i] = dot2(axes[i], direction2) < 0 ? -1 : 1;
    centre = add(centre, scale(axes[i], sides[i] * e[i]));
  }
  return { lo: sub(centre, scale(axes[axis], e[axis])), hi: add(centre, scale(axes[axis], e[axis])), sides };
}
function edgeContact(a, b, selection) {
  const f = selection.feature;
  if (f.kind !== "edge-cross") error("NUMERIC_LIMIT", WITNESS_MESSAGE);
  const n = [...selection.hit.normal], ea = supportEdge(a, f.axisA, n), eb = supportEdge(b, f.axisB, scale(n, -1));
  const nearest = closestSegments(ea.lo, ea.hi, eb.lo, eb.hi);
  const difference = sub(nearest.b, nearest.a), gap = dot2(difference, n), tangent = sub(difference, scale(n, gap));
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
  const local = basis(body).map((axis) => dot2(sub(w, body.positionM), axis)), e = extents(body);
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

// examples/physics-rigid-feature-contact-reference/geometry-adapter.ts
var FEATURE_WITNESS_MESSAGE = "private feature contact requires valid box witnesses";
function adaptContactGeometry(a, b) {
  let geometry;
  try {
    geometry = featureContact(a, b);
  } catch (caught) {
    if (caught instanceof PhysicsError && (caught.code === "INVALID_CONFIG" || caught.code === "NUMERIC_LIMIT")) {
      error("NUMERIC_LIMIT", FEATURE_WITNESS_MESSAGE);
    }
    throw caught;
  }
  if (!geometry) return null;
  const points = geometry.points.map((point2) => ({
    id: point2.key,
    pointM: [...point2.midpointM],
    witnessAM: [...point2.witnessAM],
    witnessBM: [...point2.witnessBM],
    normalGapM: point2.normalGapM,
    pointPenetrationM: point2.pointPenetrationM
  }));
  const sum2 = points.reduce((value, point2) => add(value, point2.pointM), [0, 0, 0]);
  return {
    family: geometry.family,
    normal: [...geometry.planeNormalAtoB],
    satNormalAtoB: [...geometry.selection.hit.normal],
    satPenetrationM: geometry.selection.hit.penetration,
    points,
    meanPointM: sum2.map((value) => value / points.length)
  };
}

// examples/physics-rigid-full-pair-position-world/full-pair-input.mjs
var MESSAGES = Object.freeze({
  input: "full-pair position reference input is invalid",
  limit: "full-pair position reference admits at most nine bodies and thirty-six rows",
  empty: "full-pair position reference requires at least one body",
  ids: "full-pair position reference body IDs must be nonempty and unique",
  mass: "full-pair position reference inverse mass is invalid",
  endpoints: "full-pair position reference row endpoints are invalid",
  normal: "full-pair position reference normal must be finite and unit length",
  bound: "full-pair position reference bound must be finite and between minus ten and ten metres",
  result: "full-pair position reference result is invalid",
  workLimits: "full-pair position reference work limits are invalid"
});
var FullPairPositionReferenceError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FullPairPositionReferenceError";
    this.code = code;
  }
};
var DEFAULT_LIMITS = Object.freeze({
  iterations: 1024,
  activeChanges: 1024,
  rankChecks: 2048,
  linearSolves: 2048,
  constraintTests: 262144,
  exactIntegerOperations: 1e6,
  reducedRationalBits: 8192,
  intermediateIntegerBits: 16385
});
var COUNTER_KEYS = Object.freeze(["iterations", "activeChanges", "rankChecks", "linearSolves", "constraintTests", "factorizations", "blockRightHandSides", "exactIntegerOperations", "exactPeakBits"]);
function zeroFullPairCounters() {
  return Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0]));
}
function requireFull(condition, key = "input", code = "INVALID_INPUT") {
  if (!condition) throw new FullPairPositionReferenceError(code, MESSAGES[key]);
}
function dataRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some((k) => typeof k !== "string" || !keys.includes(k))) return null;
  const copy = {};
  for (const k of keys) {
    const d = Object.getOwnPropertyDescriptor(value, k);
    if (!d || !Object.hasOwn(d, "value")) return null;
    Object.defineProperty(copy, k, { value: d.value, enumerable: true, writable: true, configurable: true });
  }
  return copy;
}
function dataArray(value, size) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) || length.value < 0) return null;
  const n = length.value;
  if (size !== void 0 && n !== size) return null;
  const own = Reflect.ownKeys(value);
  if (own.length !== n + 1) return null;
  const copy = [];
  for (let i = 0; i < n; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, "value")) return null;
    copy.push(d.value);
  }
  return copy;
}
function dataFiniteVector(value, size) {
  const a = dataArray(value, size);
  return a && a.every((v) => typeof v === "number" && Number.isFinite(v)) ? a : null;
}
function validateFullPairProblem(value) {
  const p = dataRecord(value, ["bodies", "rows"]);
  requireFull(p !== null);
  const bodies = dataArray(p.bodies), rows = dataArray(p.rows);
  requireFull(bodies !== null && rows !== null);
  requireFull(bodies.length <= 9 && rows.length <= 36, "limit", "PROFILE_LIMIT");
  requireFull(bodies.length > 0, "empty");
  const checkedBodies = [], ids = /* @__PURE__ */ new Set();
  for (const raw of bodies) {
    const b = dataRecord(raw, ["id", "inverseMass"]);
    requireFull(b !== null);
    requireFull(typeof b.id === "string" && b.id.length > 0 && !ids.has(b.id), "ids");
    ids.add(b.id);
    requireFull(typeof b.inverseMass === "number" && Number.isFinite(b.inverseMass) && (b.inverseMass === 0 || b.inverseMass >= 1e-6 && b.inverseMass <= 1e6), "mass");
    checkedBodies.push({ id: b.id, inverseMass: b.inverseMass });
  }
  const checkedRows = [];
  for (const raw of rows) {
    const row = dataRecord(raw, ["aId", "bId", "normal", "boundM"]);
    requireFull(row !== null);
    requireFull(ids.has(row.aId) && ids.has(row.bId) && row.aId !== row.bId, "endpoints");
    const normal = dataFiniteVector(row.normal, 3);
    requireFull(normal !== null && Math.abs(Math.hypot(...normal) - 1) <= 1e-12, "normal");
    requireFull(typeof row.boundM === "number" && Number.isFinite(row.boundM) && row.boundM >= -10 && row.boundM <= 10, "bound");
    checkedRows.push({ aId: row.aId, bId: row.bId, normal: [...normal], boundM: row.boundM });
  }
  return { bodies: checkedBodies, rows: checkedRows };
}
function validateWorkLimits(value) {
  const limits = dataRecord(value, Object.keys(DEFAULT_LIMITS));
  requireFull(limits !== null, "workLimits");
  for (const k of Object.keys(DEFAULT_LIMITS)) requireFull(Number.isSafeInteger(limits[k]) && limits[k] >= 0 && limits[k] <= DEFAULT_LIMITS[k], "workLimits");
  return { ...limits };
}
var CoreStop = class extends Error {
  constructor(status, reason) {
    super(reason);
    this.name = "FullPairCoreStop";
    this.status = status;
    this.reason = reason;
  }
};
function unsafe(reason) {
  throw new CoreStop("NUMERIC_UNSAFE", reason);
}
function finite3(value) {
  if (!Number.isFinite(value)) unsafe("nonfinite");
  return value;
}
function createMeter(limits = DEFAULT_LIMITS) {
  const selected = validateWorkLimits(limits), counters = zeroFullPairCounters();
  return {
    limits: selected,
    counters,
    take(key, amount = 1) {
      const next = counters[key] + amount;
      if (!Number.isSafeInteger(next) || next > selected[key]) throw new CoreStop("WORK_LIMIT", "budget:" + key);
      counters[key] = next;
    },
    bits(value, reduced = false) {
      const size = value === 0n ? 0 : (value < 0n ? -value : value).toString(2).length;
      const key = reduced ? "reducedRationalBits" : "intermediateIntegerBits";
      if (size > selected[key]) throw new CoreStop("WORK_LIMIT", "budget:" + key);
      counters.exactPeakBits = Math.max(counters.exactPeakBits, size);
      return size;
    },
    plannedBits(size) {
      if (size > selected.intermediateIntegerBits) throw new CoreStop("WORK_LIMIT", "budget:intermediateIntegerBits");
    }
  };
}

// examples/physics-rigid-full-pair-position-world/full-pair-linear.mjs
var EPS = 1e-12;
var PIVOT = 1e-14;
var normInfVector = (v) => Math.max(0, ...v.map(Math.abs));
var normInfMatrix = (m) => Math.max(0, ...m.map((row) => row.reduce((s, v) => finite3(s + Math.abs(v)), 0)));
function dot3(a, b) {
  let sum2 = 0;
  for (let i = 0; i < a.length; i++) sum2 = finite3(sum2 + finite3(a[i] * b[i]));
  return sum2;
}
function prepareModel(problem) {
  const offsets = [], D = [];
  for (const body of problem.bodies) {
    if (body.inverseMass === 0) offsets.push(null);
    else {
      offsets.push(D.length);
      D.push(body.inverseMass, body.inverseMass, body.inverseMass);
    }
  }
  const locations = new Map(problem.bodies.map((b2, i) => [b2.id, i]));
  const A = problem.rows.map((row) => {
    const a = Array(D.length).fill(0), ia = offsets[locations.get(row.aId)], ib = offsets[locations.get(row.bId)];
    for (let k = 0; k < 3; k++) {
      if (ia !== null) a[ia + k] = -row.normal[k];
      if (ib !== null) a[ib + k] = row.normal[k];
    }
    return a;
  });
  const b = problem.rows.map((row) => row.boundM), G = A.map((left) => A.map((right) => {
    let sum2 = 0;
    for (let k = 0; k < D.length; k++) sum2 = finite3(sum2 + finite3(finite3(left[k] * D[k]) * right[k]));
    return sum2;
  }));
  return { problem, A, b, D, G, offsets, dynamicDof: D.length };
}
function reconstruct(model2, lambda) {
  return model2.D.map((inverseMass, k) => {
    let sum2 = 0;
    for (let i = 0; i < model2.A.length; i++) sum2 = finite3(sum2 + finite3(model2.A[i][k] * lambda[i]));
    return finite3(inverseMass * sum2);
  });
}
function margins(model2, u, meter) {
  return model2.A.map((row, i) => {
    meter?.take("constraintTests");
    return finite3(dot3(row, u) - model2.b[i]);
  });
}
function translations(model2, u) {
  return model2.problem.bodies.map((body, i) => ({ id: body.id, u: model2.offsets[i] === null ? [0, 0, 0] : u.slice(model2.offsets[i], model2.offsets[i] + 3) }));
}
function fullCertificate(model2, u, lambda, meter) {
  const primalMarginsM = margins(model2, u, meter);
  let stationarityKgM = 0;
  for (let k = 0; k < u.length; k++) {
    let sum2 = 0;
    for (let i = 0; i < lambda.length; i++) sum2 = finite3(sum2 + finite3(model2.A[i][k] * lambda[i]));
    stationarityKgM = Math.max(stationarityKgM, Math.abs(finite3(u[k] / model2.D[k] - sum2)));
  }
  const certificate = {
    primalViolationM: Math.max(0, ...primalMarginsM.map((v) => -v)),
    negativeMultiplierKgM: Math.max(0, ...lambda.map((v) => -v)),
    complementarityKgM2: Math.max(0, ...lambda.map((v, i) => Math.abs(finite3(v * primalMarginsM[i])))),
    stationarityKgM
  };
  let objectiveKgM2 = 0;
  for (let i = 0; i < model2.problem.bodies.length; i++) {
    const start = model2.offsets[i];
    if (start === null) continue;
    let square = 0;
    for (let k = 0; k < 3; k++) square = finite3(square + finite3(u[start + k] * u[start + k]));
    objectiveKgM2 = finite3(objectiveKgM2 + finite3(square / model2.problem.bodies[i].inverseMass / 2));
  }
  return { primalMarginsM, certificate, objectiveKgM2 };
}
function checkIterate(model2, u, lambda, W, pending, meter) {
  if (u.some((v) => !Number.isFinite(v)) || lambda.some((v) => !Number.isFinite(v))) unsafe("nonfinite");
  if (lambda.some((v) => v < 0)) unsafe("negative-multiplier");
  const allowed = new Set(W);
  if (pending !== null) allowed.add(pending);
  if (lambda.some((v, i) => v !== 0 && !allowed.has(i))) unsafe("iterate-certificate");
  for (const i of W) {
    meter.take("constraintTests");
    if (Math.abs(finite3(dot3(model2.A[i], u) - model2.b[i])) > EPS) unsafe("iterate-certificate");
  }
  for (let k = 0; k < u.length; k++) {
    let sum2 = 0;
    for (let i = 0; i < lambda.length; i++) sum2 = finite3(sum2 + finite3(model2.A[i][k] * lambda[i]));
    if (Math.abs(finite3(u[k] / model2.D[k] - sum2)) > EPS) unsafe("iterate-certificate");
  }
}
function solveBasis(matrix, rhs, meter) {
  const n = rhs.length;
  if (n === 0) return { r: [], inverse: [], condition: null };
  meter.take("linearSolves");
  meter.counters.factorizations++;
  meter.counters.blockRightHandSides += 1 + n;
  const scale2 = Math.max(1, ...matrix.flat().map(Math.abs)), aug = matrix.map((row, i) => [...row, rhs[i], ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    if (!Number.isFinite(aug[pivot][col])) unsafe("nonfinite");
    if (Math.abs(aug[pivot][col]) <= PIVOT * scale2) unsafe("pivot");
    [aug[pivot], aug[col]] = [aug[col], aug[pivot]];
    for (let row = col + 1; row < n; row++) {
      const ratio = finite3(aug[row][col] / aug[col][col]);
      for (let k = col; k < 2 * n + 1; k++) aug[row][k] = finite3(aug[row][k] - finite3(ratio * aug[col][k]));
    }
  }
  const solved = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let row = n - 1; row >= 0; row--) for (let k = 0; k < n + 1; k++) {
    let value = aug[row][n + k];
    for (let col = row + 1; col < n; col++) value = finite3(value - finite3(aug[row][col] * solved[col][k]));
    solved[row][k] = finite3(value / aug[row][row]);
  }
  const r = solved.map((row) => row[0]), inverse2 = solved.map((row) => row.slice(1));
  const normG = normInfMatrix(matrix), condition = finite3(normG * normInfMatrix(inverse2));
  if (condition > 1e12) unsafe("condition");
  const residual = normInfVector(matrix.map((row, i) => finite3(dot3(row, r) - rhs[i]))), denominator = finite3(Math.max(1, finite3(normG * normInfVector(r)) + normInfVector(rhs)));
  if (finite3(residual / denominator) > EPS) unsafe("factor-residual");
  const product = matrix.map((row, i) => Array.from({ length: n }, (_, j) => finite3(dot3(row, inverse2.map((x) => x[j])) - (i === j ? 1 : 0))));
  if (normInfMatrix(product) > EPS) unsafe("factor-residual");
  return { r, inverse: inverse2, condition };
}
function direction(model2, W, p, r, meter) {
  const z = model2.D.map((inv, k) => {
    let projection = 0;
    for (let j = 0; j < W.length; j++) projection = finite3(projection + finite3(model2.A[W[j]][k] * r[j]));
    return finite3(inv * finite3(model2.A[p][k] - projection));
  });
  meter.take("rankChecks");
  const delta = dot3(model2.A[p], z), scale2 = Math.max(1, model2.G[p][p]);
  let zMz = 0;
  for (let k = 0; k < z.length; k++) zMz = finite3(zMz + finite3(finite3(z[k] * z[k]) / model2.D[k]));
  const orthogonal = normInfVector(W.map((i) => dot3(model2.A[i], z))), orthScale = Math.max(1, ...W.map((i) => Math.abs(model2.G[i][p])), ...W.map((i) => {
    let sum2 = 0;
    for (let j = 0; j < W.length; j++) sum2 = finite3(sum2 + Math.abs(finite3(model2.G[i][W[j]] * r[j])));
    return sum2;
  }));
  if (finite3(orthogonal / orthScale) > EPS || finite3(Math.abs(finite3(delta - zMz)) / Math.max(1, Math.abs(delta), Math.abs(zMz), Math.abs(model2.G[p][p]))) > EPS) unsafe("direction-residual");
  if (delta < -PIVOT * scale2) unsafe("direction-residual");
  return { z, delta, near: Math.abs(delta) <= PIVOT * scale2 || W.length + 1 > model2.dynamicDof };
}

// examples/physics-rigid-full-pair-position-world/full-pair-exact.mjs
var ZERO = Object.freeze({ n: 0n, d: 1n });
var ONE = Object.freeze({ n: 1n, d: 1n });
var bits = (x) => x === 0n ? 0 : (x < 0n ? -x : x).toString(2).length;
function operation(meter, estimate, fn) {
  meter.plannedBits(estimate);
  meter.take("exactIntegerOperations");
  const x = fn();
  meter.bits(x);
  return x;
}
var addI = (a, b, m) => operation(m, Math.max(bits(a), bits(b)) + 1, () => a + b);
var subI = (a, b, m) => operation(m, Math.max(bits(a), bits(b)) + 1, () => a - b);
var mulI = (a, b, m) => operation(m, bits(a) + bits(b), () => a * b);
var divI = (a, b, m) => operation(m, bits(a), () => a / b);
var remI = (a, b, m) => operation(m, bits(a), () => a % b);
var shiftI = (a, k, m) => operation(m, bits(a) + k, () => a << BigInt(k));
function absI(a, m) {
  return a < 0n ? subI(0n, a, m) : a;
}
function gcd(a, b, m) {
  a = absI(a, m);
  b = absI(b, m);
  while (b !== 0n) {
    const next = remI(a, b, m);
    a = b;
    b = next;
  }
  return a;
}
function checked(q, m) {
  m.bits(q.n, true);
  m.bits(q.d, true);
  return q;
}
function rational(n, d, m) {
  if (d === 0n) unsafe("uncertified-infeasibility");
  if (d < 0n) {
    n = subI(0n, n, m);
    d = subI(0n, d, m);
  }
  if (n === 0n) return checked(ZERO, m);
  const g = gcd(n, d, m);
  return checked({ n: divI(n, g, m), d: divI(d, g, m) }, m);
}
function addQ(a, b, m) {
  if (a.n === 0n) return checked(b, m);
  if (b.n === 0n) return checked(a, m);
  return rational(addI(mulI(a.n, b.d, m), mulI(b.n, a.d, m), m), mulI(a.d, b.d, m), m);
}
function negQ(a, m) {
  return a.n === 0n ? checked(ZERO, m) : checked({ n: subI(0n, a.n, m), d: a.d }, m);
}
function subQ(a, b, m) {
  return addQ(a, negQ(b, m), m);
}
function mulQ(a, b, m) {
  if (a.n === 0n || b.n === 0n) return checked(ZERO, m);
  return rational(mulI(a.n, b.n, m), mulI(a.d, b.d, m), m);
}
function divQ(a, b, m) {
  if (b.n === 0n) unsafe("uncertified-infeasibility");
  if (a.n === 0n) return checked(ZERO, m);
  return rational(mulI(a.n, b.d, m), mulI(a.d, b.n, m), m);
}
var text = (q) => `${q.n}/${q.d}`;
function fromNumber(value, m) {
  if (!Number.isFinite(value)) unsafe("nonfinite");
  if (value === 0) return checked(ZERO, m);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  const raw = view.getBigUint64(0, false);
  const sign = raw >> 63n, exponent = Number(raw >> 52n & 2047n), fraction = raw & (1n << 52n) - 1n;
  let n = exponent === 0 ? fraction : addI(1n << 52n, fraction, m), d = 1n;
  const shift = exponent === 0 ? -1074 : exponent - 1023 - 52;
  if (shift >= 0) n = shiftI(n, shift, m);
  else d = shiftI(d, -shift, m);
  if (sign) n = subI(0n, n, m);
  return rational(n, d, m);
}
function toNumber(q, m) {
  if (q.n === 0n) return 0;
  const negative = q.n < 0n, n = absI(q.n, m), d = q.d;
  let exponent = bits(n) - bits(d);
  if (exponent >= 0) {
    if (n < shiftI(d, exponent, m)) exponent--;
  } else if (shiftI(n, -exponent, m) < d) exponent--;
  if (exponent > 1023) unsafe("dependency-conversion");
  const quantum = Math.max(exponent - 52, -1074), numerator = quantum < 0 ? shiftI(n, -quantum, m) : n, denominator = quantum > 0 ? shiftI(d, quantum, m) : d;
  let significand = divI(numerator, denominator, m);
  const remainder = remI(numerator, denominator, m), twice = mulI(remainder, 2n, m);
  if (twice > denominator || twice === denominator && remI(significand, 2n, m) !== 0n) significand = addI(significand, 1n, m);
  const result = (negative ? -1 : 1) * Number(significand) * 2 ** quantum;
  if (!Number.isFinite(result) || result === 0 || result < 0 !== negative) unsafe("dependency-conversion");
  return result;
}
function makeExactSystem(model2, meter) {
  const A = model2.A.map((row) => row.map((x) => fromNumber(x, meter))), D = model2.D.map((x) => fromNumber(x, meter)), b = model2.b.map((x) => fromNumber(x, meter)), cache = /* @__PURE__ */ new Map();
  return { A, D, b, gram(i, j) {
    const key = i + ":" + j;
    if (cache.has(key)) return cache.get(key);
    let sum2 = checked(ZERO, meter);
    for (let k = 0; k < D.length; k++) if (A[i][k].n !== 0n && A[j][k].n !== 0n) sum2 = addQ(sum2, mulQ(mulQ(A[i][k], D[k], meter), A[j][k], meter), meter);
    cache.set(key, sum2);
    return sum2;
  } };
}
function solveExact(matrix, rhs, m) {
  const n = rhs.length;
  if (n === 0) return [];
  m.take("linearSolves");
  m.counters.factorizations++;
  m.counters.blockRightHandSides++;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (pivot < n && a[pivot][col].n === 0n) pivot++;
    if (pivot === n) unsafe("dependent-basis");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < n; row++) {
      if (a[row][col].n === 0n) continue;
      const ratio = divQ(a[row][col], a[col][col], m);
      for (let k = col; k <= n; k++) a[row][k] = subQ(a[row][k], mulQ(ratio, a[col][k], m), m);
    }
  }
  const x = Array(n).fill(ZERO);
  for (let row = n - 1; row >= 0; row--) {
    let value = a[row][n];
    for (let col = row + 1; col < n; col++) value = subQ(value, mulQ(a[row][col], x[col], m), m);
    x[row] = divQ(value, a[row][row], m);
  }
  return x;
}
function exactDependency(system, W, p, meter) {
  const rExact = solveExact(W.map((i) => W.map((j) => system.gram(i, j))), W.map((i) => system.gram(i, p)), meter);
  for (let k = 0; k < system.D.length; k++) {
    let projection = checked(ZERO, meter);
    for (let j = 0; j < W.length; j++) projection = addQ(projection, mulQ(system.A[W[j]][k], rExact[j], meter), meter);
    if (subQ(system.A[p][k], projection, meter).n !== 0n) return { dependent: false, rExact: [], r: [] };
  }
  return { dependent: true, rExact };
}
function dependencyNumbers(rExact, meter) {
  return rExact.map((x) => toNumber(x, meter));
}
function verifyWeights(system, weights, meter) {
  if (weights.length !== system.b.length || weights.some((w) => w.n < 0n)) return null;
  let sum2 = checked(ZERO, meter);
  for (const w of weights) sum2 = addQ(sum2, w, meter);
  if (sum2.n !== sum2.d) return null;
  const dynamicDot = [];
  for (let k = 0; k < system.D.length; k++) {
    let dot5 = checked(ZERO, meter);
    for (let i = 0; i < weights.length; i++) dot5 = addQ(dot5, mulQ(system.A[i][k], weights[i], meter), meter);
    if (dot5.n !== 0n) return null;
    dynamicDot.push(text(dot5));
  }
  let boundDot = checked(ZERO, meter);
  for (let i = 0; i < weights.length; i++) boundDot = addQ(boundDot, mulQ(system.b[i], weights[i], meter), meter);
  if (boundDot.n <= 0n) return null;
  return { weights: weights.map(text), sumWeights: "1/1", dynamicDot, boundDotM: text(boundDot) };
}
function makeInfeasibilityCertificate(system, W, p, rExact, meter) {
  const weights = Array(system.b.length).fill(ZERO);
  weights[p] = checked(ONE, meter);
  for (let j = 0; j < W.length; j++) weights[W[j]] = negQ(rExact[j], meter);
  if (weights.some((w) => w.n < 0n)) unsafe("uncertified-infeasibility");
  let sum2 = checked(ZERO, meter);
  for (const w of weights) sum2 = addQ(sum2, w, meter);
  if (sum2.n <= 0n) unsafe("uncertified-infeasibility");
  const normalized = weights.map((w) => divQ(w, sum2, meter)), proof = verifyWeights(system, normalized, meter);
  if (proof === null) unsafe("uncertified-infeasibility");
  return proof;
}
function parseCanonical(value, meter) {
  if (typeof value !== "string" || value.length > 4937 || !/^(?:0|-?[1-9][0-9]*)\/[1-9][0-9]*$/.test(value)) return null;
  const [ns, ds] = value.split("/");
  if (ns.replace("-", "").length > 2467 || ds.length > 2467) return null;
  meter.take("exactIntegerOperations");
  const n = BigInt(ns);
  meter.bits(n, true);
  meter.take("exactIntegerOperations");
  const d = BigInt(ds);
  meter.bits(d, true);
  const q = rational(n, d, meter);
  return text(q) === value ? q : null;
}
function verifyInfeasibilityCertificate(problem, certificate, meter = createMeter()) {
  const model2 = prepareModel(problem), system = makeExactSystem(model2, meter), weights = [];
  for (const value of certificate.weights) {
    const q = parseCanonical(value, meter);
    if (q === null) return false;
    weights.push(q);
  }
  const checkedProof = verifyWeights(system, weights, meter);
  if (checkedProof === null) return false;
  return certificate.sumWeights === "1/1" && certificate.boundDotM === checkedProof.boundDotM && certificate.dynamicDot.length === checkedProof.dynamicDot.length && certificate.dynamicDot.every((x, i) => x === checkedProof.dynamicDot[i]);
}

// examples/physics-rigid-full-pair-position-world/full-pair-core.mjs
var copySafe = (s) => ({ uDynamic: [...s.u], lambdaKgM: [...s.lambda], pendingRow: s.pending, pendingLambdaKgM: s.pending === null ? 0 : s.lambda[s.pending], basisRows: [...s.W] });
function ieeeState(s) {
  const view = new DataView(new ArrayBuffer(8));
  const encode = (x) => {
    view.setFloat64(0, x, false);
    return view.getBigUint64(0, false).toString(16);
  };
  return s.W.join(",") + "|" + String(s.pending) + "|" + s.u.map(encode).join(",") + "|" + s.lambda.map(encode).join(",");
}
function context(state, meter) {
  return { iteration: meter.counters.iterations, enteringRow: state.pending, basisBefore: [...state.W], basisAfter: [...state.W], blocker: null, stepKgM: null, schurInverseKg: null, condition: null, exactDependent: null };
}
function traceEntry(ctx, action, state) {
  return { ...ctx, basisBefore: [...ctx.basisBefore], basisAfter: [...state.W], action };
}
function runFullPairCore(rawProblem, limits = DEFAULT_LIMITS) {
  const problem = validateFullPairProblem(rawProblem), meter = createMeter(limits), model2 = prepareModel(problem), n = problem.rows.length;
  let state = { u: Array(model2.dynamicDof).fill(0), lambda: Array(n).fill(0), W: [], pending: null }, ctx = context(state, meter), exact = null;
  const trace = [], seen = /* @__PURE__ */ new Set();
  const getExact = () => exact ?? (exact = makeExactSystem(model2, meter));
  const common = () => ({ basisRows: [...state.W], basisRank: state.W.length, dynamicDof: model2.dynamicDof, counters: { ...meter.counters }, trace: trace.map((x) => ({ ...x, basisBefore: [...x.basisBefore], basisAfter: [...x.basisAfter] })), lastSafeIterate: copySafe(state), worldStepped: false });
  const refused = (status, reason, proof = null) => ({ ok: false, status, ...common(), translations: null, lambdaKgM: null, primalMarginsM: null, objectiveKgM2: null, certificate: null, infeasibilityCertificate: proof, reason });
  try {
    for (let i = 0; i < n; i++) {
      meter.take("constraintTests");
      if (model2.A[i].every((x) => x === 0) && model2.b[i] > 0) {
        const proof = makeInfeasibilityCertificate(getExact(), [], i, [], meter);
        ctx.exactDependent = true;
        trace.push(traceEntry(ctx, "infeasible", state));
        return refused("INFEASIBLE", null, proof);
      }
    }
    while (true) {
      if (state.pending === null) {
        ctx = context(state, meter);
        const allMargins = margins(model2, state.u, meter);
        if (state.W.some((i) => Math.abs(allMargins[i]) > EPS)) unsafe("iterate-certificate");
        const p2 = allMargins.findIndex((v, i) => v < -EPS && !state.W.includes(i));
        if (p2 < 0) {
          const u2 = reconstruct(model2, state.lambda), checked2 = fullCertificate(model2, u2, state.lambda, meter), bodyTranslations = translations(model2, u2);
          if (Object.values(checked2.certificate).some((v) => !Number.isFinite(v) || v > EPS) || checked2.objectiveKgM2 < 0) unsafe("result-certificate");
          if (bodyTranslations.some((t) => Math.hypot(...t.u) > 10)) unsafe("translation-bound");
          state = { ...state, u: u2 };
          return { ok: true, status: "SOLVED", ...common(), translations: bodyTranslations, lambdaKgM: [...state.lambda], primalMarginsM: [...checked2.primalMarginsM], objectiveKgM2: checked2.objectiveKgM2, certificate: { ...checked2.certificate }, infeasibilityCertificate: null, reason: null };
        }
        state = { ...state, pending: p2 };
      }
      ctx = context(state, meter);
      meter.take("iterations");
      ctx.iteration = meter.counters.iterations;
      const key = ieeeState(state);
      if (seen.has(key)) throw new CoreStop("WORK_LIMIT", "cycle");
      seen.add(key);
      const p = state.pending, W = state.W, solved = solveBasis(W.map((i) => W.map((j) => model2.G[i][j])), W.map((i) => model2.G[i][p]), meter);
      ctx.condition = solved.condition;
      let r = solved.r;
      const projected = direction(model2, W, p, r, meter);
      ctx.schurInverseKg = projected.delta;
      let dependent = false;
      if (projected.near) {
        meter.take("rankChecks");
        const relation = exactDependency(getExact(), W, p, meter);
        ctx.exactDependent = relation.dependent;
        if (!relation.dependent) unsafe("near-dependent-independent");
        dependent = true;
        if (!relation.rExact.some((x) => x.n > 0n)) {
          const proof = makeInfeasibilityCertificate(getExact(), W, p, relation.rExact, meter);
          trace.push(traceEntry(ctx, "infeasible", state));
          return refused("INFEASIBLE", null, proof);
        }
        r = dependencyNumbers(relation.rExact, meter);
      }
      let dualStep = Infinity, blocker = null;
      for (let j = 0; j < W.length; j++) if (r[j] > 0) {
        const step2 = finite3(state.lambda[W[j]] / r[j]);
        if (step2 < 0) unsafe("negative-step");
        if (step2 < dualStep || step2 === dualStep && (blocker === null || W[j] < blocker)) {
          dualStep = step2;
          blocker = W[j];
        }
      }
      let primalStep = Infinity;
      if (!dependent) {
        meter.take("constraintTests");
        const deficit = finite3(model2.b[p] - dot3(model2.A[p], state.u));
        primalStep = finite3(deficit / projected.delta);
        if (primalStep < 0) unsafe("negative-step");
      }
      const drop = dualStep <= primalStep, step = drop ? dualStep : primalStep;
      if (!Number.isFinite(step)) unsafe("uncertified-infeasibility");
      ctx.stepKgM = step;
      ctx.blocker = drop ? blocker : null;
      if (drop && blocker === null) unsafe("uncertified-infeasibility");
      const lambda = [...state.lambda];
      for (let j = 0; j < W.length; j++) lambda[W[j]] = finite3(lambda[W[j]] - finite3(step * r[j]));
      lambda[p] = finite3(lambda[p] + step);
      if (drop) lambda[blocker] = 0;
      const nextW = drop ? W.filter((i) => i !== blocker) : [...W, p].sort((a, b) => a - b), pending = drop ? p : null, u = reconstruct(model2, lambda);
      checkIterate(model2, u, lambda, nextW, pending, meter);
      meter.take("activeChanges");
      state = { u, lambda, W: nextW, pending };
      trace.push(traceEntry(ctx, drop ? dependent ? "dependent-drop" : "drop" : "add", state));
    }
  } catch (error2) {
    if (!(error2 instanceof CoreStop)) throw error2;
    ctx.iteration = meter.counters.iterations;
    trace.push(traceEntry(ctx, error2.status === "WORK_LIMIT" ? "work-limit" : "unsafe", state));
    return refused(error2.status, error2.reason);
  }
}

// examples/physics-rigid-full-pair-position-world/full-pair-solver.mjs
var RESULT_KEYS = ["ok", "status", "basisRows", "basisRank", "dynamicDof", "counters", "trace", "lastSafeIterate", "translations", "lambdaKgM", "primalMarginsM", "objectiveKgM2", "certificate", "infeasibilityCertificate", "reason", "worldStepped"];
var CERT_KEYS = ["primalViolationM", "negativeMultiplierKgM", "complementarityKgM2", "stationarityKgM"];
var TRACE_KEYS = ["iteration", "enteringRow", "basisBefore", "basisAfter", "action", "blocker", "stepKgM", "schurInverseKg", "condition", "exactDependent"];
var UNSAFE_REASONS = ["nonfinite", "negative-step", "negative-multiplier", "pivot", "condition", "factor-residual", "direction-residual", "near-dependent-independent", "dependent-basis", "dependency-conversion", "uncertified-infeasibility", "iterate-certificate", "result-certificate", "translation-bound"];
var WORK_REASONS = [...Object.keys(DEFAULT_LIMITS).map((k) => "budget:" + k), "cycle"];
var fail = (condition) => requireFull(condition, "result", "NUMERIC_LIMIT");
var finiteNumber = (x) => typeof x === "number" && Number.isFinite(x);
var integer = (x) => Number.isSafeInteger(x) && x >= 0;
var sameVector = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
function checkedArithmetic(fn) {
  try {
    return fn();
  } catch (error2) {
    if (error2 instanceof CoreStop) requireFull(false, "result", "NUMERIC_LIMIT");
    throw error2;
  }
}
function indices(raw, n, d) {
  const a = dataArray(raw);
  fail(a !== null && a.length <= d && a.every((v, i) => integer(v) && v < n && (i === 0 || v > a[i - 1])));
  return a;
}
function numberVector(raw, size) {
  const a = dataFiniteVector(raw, size);
  fail(a !== null);
  return a;
}
function indexOrNull(value, n) {
  fail(value === null || integer(value) && value < n);
  return value;
}
function checkedCounters(raw, d, n) {
  const c = dataRecord(raw, COUNTER_KEYS);
  fail(c !== null && COUNTER_KEYS.every((k) => integer(c[k])));
  for (const k of ["iterations", "activeChanges", "rankChecks", "linearSolves", "constraintTests", "exactIntegerOperations"]) fail(c[k] <= DEFAULT_LIMITS[k]);
  fail(c.exactPeakBits <= DEFAULT_LIMITS.intermediateIntegerBits && c.activeChanges <= c.iterations && c.rankChecks <= 2 * c.iterations && c.linearSolves <= 2 * c.iterations);
  fail(c.factorizations <= c.linearSolves && c.blockRightHandSides >= c.factorizations && c.blockRightHandSides <= (Math.min(d, n) + 1) * c.factorizations);
  if (n === 0) fail(["iterations", "activeChanges", "rankChecks", "linearSolves", "constraintTests", "factorizations", "blockRightHandSides", "exactIntegerOperations", "exactPeakBits"].every((k) => c[k] === 0));
  return { ...c };
}
function checkedTrace(raw, n, d, counters, basisRows) {
  const entries = dataArray(raw);
  fail(entries !== null && entries.length <= counters.iterations + 1);
  const trace = [];
  let previous = [], iteration = 0, changes = 0;
  for (const rawEntry of entries) {
    const e = dataRecord(rawEntry, TRACE_KEYS);
    fail(e !== null && integer(e.iteration) && e.iteration >= iteration && e.iteration <= counters.iterations);
    const before = indices(e.basisBefore, n, d), after = indices(e.basisAfter, n, d);
    fail(sameVector(before, previous));
    const enteringRow = indexOrNull(e.enteringRow, n), blocker = indexOrNull(e.blocker, n);
    fail(["add", "drop", "dependent-drop", "infeasible", "unsafe", "work-limit"].includes(e.action) && (e.exactDependent === null || typeof e.exactDependent === "boolean"));
    fail(e.stepKgM === null || finiteNumber(e.stepKgM) && e.stepKgM >= 0);
    fail(e.schurInverseKg === null || finiteNumber(e.schurInverseKg));
    fail(e.condition === null || finiteNumber(e.condition) && e.condition >= 0);
    if (e.action === "add") {
      fail(e.iteration > 0 && enteringRow !== null && !before.includes(enteringRow) && blocker === null && e.stepKgM !== null && e.exactDependent !== true);
      fail(sameVector(after, [...before, enteringRow].sort((a, b) => a - b)));
      changes++;
    } else if (e.action === "drop" || e.action === "dependent-drop") {
      fail(e.iteration > 0 && enteringRow !== null && !before.includes(enteringRow) && blocker !== null && before.includes(blocker) && e.stepKgM !== null);
      fail((e.action === "dependent-drop" ? e.exactDependent === true : e.exactDependent !== true) && sameVector(after, before.filter((i) => i !== blocker)));
      changes++;
    } else fail(sameVector(before, after));
    trace.push({ ...e, basisBefore: [...before], basisAfter: [...after] });
    previous = after;
    iteration = e.iteration;
  }
  fail(changes === counters.activeChanges && sameVector(previous, basisRows));
  return trace;
}
function checkedSafe(raw, model2, basisRows) {
  const s = dataRecord(raw, ["uDynamic", "lambdaKgM", "pendingRow", "pendingLambdaKgM", "basisRows"]);
  fail(s !== null);
  const u = numberVector(s.uDynamic, model2.dynamicDof), lambda = numberVector(s.lambdaKgM, model2.A.length), basis2 = indices(s.basisRows, model2.A.length, model2.dynamicDof), pending = indexOrNull(s.pendingRow, model2.A.length);
  fail(sameVector(basis2, basisRows) && finiteNumber(s.pendingLambdaKgM) && s.pendingLambdaKgM >= 0 && lambda.every((v) => v >= 0));
  fail(pending === null ? s.pendingLambdaKgM === 0 : !basis2.includes(pending) && Object.is(s.pendingLambdaKgM, lambda[pending]));
  const expected = checkedArithmetic(() => reconstruct(model2, lambda));
  fail(u.every((v, k) => Math.abs(v - expected[k]) <= EPS));
  checkedArithmetic(() => checkIterate(model2, u, lambda, basis2, pending, createMeter()));
  return { uDynamic: [...u], lambdaKgM: [...lambda], pendingRow: pending, pendingLambdaKgM: s.pendingLambdaKgM, basisRows: [...basis2] };
}
function checkedInfeasibility(problem, model2, raw) {
  const proof = dataRecord(raw, ["weights", "sumWeights", "dynamicDot", "boundDotM"]);
  fail(proof !== null);
  const weights = dataArray(proof.weights, problem.rows.length), dynamicDot = dataArray(proof.dynamicDot, model2.dynamicDof);
  fail(weights !== null && weights.every((v) => typeof v === "string") && dynamicDot !== null && dynamicDot.every((v) => v === "0/1") && proof.sumWeights === "1/1" && typeof proof.boundDotM === "string");
  const copied = { weights: [...weights], sumWeights: "1/1", dynamicDot: [...dynamicDot], boundDotM: proof.boundDotM };
  fail(checkedArithmetic(() => verifyInfeasibilityCertificate(problem, copied, createMeter())));
  return copied;
}
function validateFullPairResult(rawProblem, rawResult) {
  const problem = validateFullPairProblem(rawProblem);
  try {
    const model2 = checkedArithmetic(() => prepareModel(problem)), r = dataRecord(rawResult, RESULT_KEYS);
    fail(r !== null);
    fail(typeof r.ok === "boolean" && ["SOLVED", "INFEASIBLE", "NUMERIC_UNSAFE", "WORK_LIMIT"].includes(r.status) && r.worldStepped === false);
    const basisRows = indices(r.basisRows, problem.rows.length, model2.dynamicDof);
    fail(integer(r.basisRank) && r.basisRank === basisRows.length && r.dynamicDof === model2.dynamicDof);
    const counters = checkedCounters(r.counters, model2.dynamicDof, problem.rows.length), trace = checkedTrace(r.trace, problem.rows.length, model2.dynamicDof, counters, basisRows), lastSafeIterate = checkedSafe(r.lastSafeIterate, model2, basisRows);
    const common = { basisRows: [...basisRows], basisRank: basisRows.length, dynamicDof: model2.dynamicDof, counters, trace, lastSafeIterate, worldStepped: false };
    if (r.status === "SOLVED") {
      fail(r.ok === true && r.reason === null && r.infeasibilityCertificate === null && lastSafeIterate.pendingRow === null);
      const ts = dataArray(r.translations, problem.bodies.length);
      fail(ts !== null);
      const translations2 = [];
      for (let i = 0; i < ts.length; i++) {
        const t = dataRecord(ts[i], ["id", "u"]);
        fail(t !== null && t.id === problem.bodies[i].id);
        const u2 = numberVector(t.u, 3);
        fail(Math.hypot(...u2) <= 10);
        if (problem.bodies[i].inverseMass === 0) fail(u2.every((v) => Object.is(v, 0)));
        translations2.push({ id: t.id, u: [...u2] });
      }
      const lambdaKgM = numberVector(r.lambdaKgM, problem.rows.length), primalMarginsM = numberVector(r.primalMarginsM, problem.rows.length), certificate = dataRecord(r.certificate, CERT_KEYS);
      fail(certificate !== null && CERT_KEYS.every((k) => finiteNumber(certificate[k]) && certificate[k] >= 0 && certificate[k] <= EPS) && finiteNumber(r.objectiveKgM2) && r.objectiveKgM2 >= 0);
      fail(sameVector(lambdaKgM, lastSafeIterate.lambdaKgM));
      const u = translations2.flatMap((t, i) => model2.offsets[i] === null ? [] : t.u);
      fail(sameVector(u, lastSafeIterate.uDynamic));
      const actual = checkedArithmetic(() => fullCertificate(model2, u, lambdaKgM, createMeter()));
      fail(actual.primalMarginsM.every((v, i) => v >= -EPS && Math.abs(v - primalMarginsM[i]) <= EPS) && Math.abs(actual.objectiveKgM2 - r.objectiveKgM2) <= EPS);
      fail(CERT_KEYS.every((k) => actual.certificate[k] <= EPS && Math.abs(actual.certificate[k] - certificate[k]) <= EPS));
      return { ok: true, status: "SOLVED", ...common, translations: translations2, lambdaKgM: [...lambdaKgM], primalMarginsM: [...primalMarginsM], objectiveKgM2: r.objectiveKgM2, certificate: { ...certificate }, infeasibilityCertificate: null, reason: null };
    }
    fail(r.ok === false && ["translations", "lambdaKgM", "primalMarginsM", "objectiveKgM2", "certificate"].every((k) => r[k] === null));
    let infeasibilityCertificate = null;
    if (r.status === "INFEASIBLE") {
      fail(r.reason === null);
      infeasibilityCertificate = checkedInfeasibility(problem, model2, r.infeasibilityCertificate);
    } else {
      fail(r.infeasibilityCertificate === null);
      fail((r.status === "NUMERIC_UNSAFE" ? UNSAFE_REASONS : WORK_REASONS).includes(r.reason));
    }
    return { ok: false, status: r.status, ...common, translations: null, lambdaKgM: null, primalMarginsM: null, objectiveKgM2: null, certificate: null, infeasibilityCertificate, reason: r.reason };
  } catch (error2) {
    throw error2;
  }
}
function solveFullPairPosition(problem) {
  return validateFullPairResult(problem, runFullPairCore(problem, DEFAULT_LIMITS));
}

// examples/physics-rigid-signed-separation-reference/signed-sat.ts
var FEATURE_INPUT_MESSAGE2 = "signed position reference requires admitted raw boxes";
var AXIS_MESSAGE = "signed position reference requires a fresh supported pre-SAT axis";
var DIAGNOSTIC_TIE_TOLERANCE_M2 = 1e-12;
function denseFinite(value, size, bound) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === size && Reflect.ownKeys(value).length === size + 1 && Array.from({ length: size }, (_, i) => i).every((i) => Object.hasOwn(value, i) && typeof value[i] === "number" && Number.isFinite(value[i]) && Math.abs(value[i]) <= bound);
}
function admittedRawBox(body) {
  return body !== null && typeof body === "object" && typeof body.id === "string" && ID.test(body.id) && (body.kind === "dynamic" || body.kind === "static") && body.shape?.kind === "box" && denseFinite(body.shape.halfExtentsM, 3, 1e3) && body.shape.halfExtentsM.every((v) => v >= 1e-4) && denseFinite(body.positionM, 3, 1e4) && denseFinite(body.velocityMps, 3, 1e3) && denseFinite(body.angularVelocityRadps, 3, 1e3) && denseFinite(body.orientation, 4, 1) && Math.abs(Math.hypot(...body.orientation) - 1) <= 1e-9 && typeof body.inverseMass === "number" && Number.isFinite(body.inverseMass) && (body.kind === "static" ? body.inverseMass === 0 : body.inverseMass >= 1e-6 && body.inverseMass <= 1e6);
}
function boxAxes3(body) {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis));
}
function boxSupport3(body, direction2) {
  const axes = boxAxes3(body);
  const extents2 = body.shape.halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot2(axis, direction2);
    const offset = Math.abs(projection) <= 1e-12 ? 0 : projection > 0 ? extents2[index] : -extents2[index];
    return add(result, scale(axis, offset));
  }, [0, 0, 0]));
}
function featureAt2(candidateIndex) {
  if (candidateIndex < 3) return { kind: "face-a", axisA: candidateIndex };
  if (candidateIndex < 6) return { kind: "face-b", axisB: candidateIndex - 3 };
  const crossIndex = candidateIndex - 6;
  return { kind: "edge-cross", axisA: Math.floor(crossIndex / 3), axisB: crossIndex % 3 };
}
function featureLabel2(feature) {
  if (feature.kind === "face-a") return `A.face.${feature.axisA}`;
  if (feature.kind === "face-b") return `B.face.${feature.axisB}`;
  return `A.edge.${feature.axisA}xB.edge.${feature.axisB}`;
}
function inspectSignedBoxSAT(a, b) {
  if (!admittedRawBox(a) || !admittedRawBox(b)) {
    error("INVALID_CONFIG", FEATURE_INPUT_MESSAGE2);
  }
  const axesA = boxAxes3(a), axesB = boxAxes3(b);
  const extentA = a.shape.halfExtentsM, extentB = b.shape.halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis = [1, 0, 0], bestOverlap = Infinity;
  let bestCandidateIndex = 0, bestRawLength = 0;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross2(axisA, axisB)))];
  const diagnostics = [];
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const length = Math.hypot(...candidate);
    const feature2 = featureAt2(candidateIndex);
    const diagnostic = {
      candidateIndex,
      label: featureLabel2(feature2),
      feature: feature2,
      rawAxisLength: length,
      skippedByOriginalCutoff: length < 1e-12,
      signedDistanceM: null,
      overlapM: null,
      axis: null,
      orientedNormal: null,
      radiusAM: null,
      radiusBM: null
    };
    diagnostics.push(diagnostic);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum2, basis2, index) => sum2 + extentA[index] * Math.abs(dot2(basis2, axis)), 0);
    const radiusB = axesB.reduce((sum2, basis2, index) => sum2 + extentB[index] * Math.abs(dot2(basis2, axis)), 0);
    const signedDistance = dot2(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    diagnostic.signedDistanceM = signedDistance;
    diagnostic.overlapM = overlap;
    diagnostic.axis = [...axis];
    diagnostic.orientedNormal = scale(axis, signedDistance < 0 ? -1 : 1);
    diagnostic.radiusAM = radiusA;
    diagnostic.radiusBM = radiusB;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale(axis, signedDistance < 0 ? -1 : 1);
      bestCandidateIndex = candidateIndex;
      bestRawLength = length;
    }
  }
  if (!Number.isFinite(bestOverlap) || !Number.isFinite(bestRawLength) || bestRawLength < 1e-12) error("NUMERIC_LIMIT", AXIS_MESSAGE);
  const aPoint = boxSupport3(a, bestAxis);
  const bPoint = boxSupport3(b, scale(bestAxis, -1));
  const pointM = scale(add(aPoint, bPoint), 0.5);
  const feature = featureAt2(bestCandidateIndex);
  return {
    normal: [...bestAxis],
    boundM: bestOverlap,
    pointM: [...pointM],
    feature,
    label: featureLabel2(feature),
    candidateIndex: bestCandidateIndex,
    rawAxisLength: bestRawLength,
    candidates: diagnostics,
    ambiguity: {
      exactMinimumCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null && candidate.overlapM === bestOverlap).map((candidate) => candidate.candidateIndex),
      withinDiagnosticTieToleranceCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null && Math.abs(candidate.overlapM - bestOverlap) <= DIAGNOSTIC_TIE_TOLERANCE_M2).map((candidate) => candidate.candidateIndex),
      skippedCandidateIndices: diagnostics.filter((candidate) => candidate.skippedByOriginalCutoff).map((candidate) => candidate.candidateIndex),
      diagnosticTieToleranceM: DIAGNOSTIC_TIE_TOLERANCE_M2,
      uniquePhysicalFeatureClaimed: false
    }
  };
}

// examples/physics-rigid-full-pair-position-world/full-pair-rows.ts
var FULL_PAIR_ERRORS = {
  INPUT: "private full-pair position input is invalid",
  PROFILE: "private full-pair position profile is unsupported",
  RANGE: "private full-pair position signed bound exceeds the admitted range",
  GEOMETRY: "private full-pair position requires fresh matching box geometry",
  INFEASIBLE: "private full-pair position constraints are infeasible",
  NUMERIC_UNSAFE: "private full-pair position solve is numerically unsafe",
  WORK_LIMIT: "private full-pair position solve exceeded its work limit",
  RESULT: "private full-pair position result is invalid",
  NONPENETRATION: "private full-pair position result left an overlapping pair"
};
function refuse(key) {
  throw new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS[key]);
}
function mapFullPairError(error2) {
  try {
    if (error2 instanceof FullPairPositionReferenceError) {
      if (error2.code === "PROFILE_LIMIT" && error2.message === MESSAGES.limit) {
        return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.PROFILE);
      }
      if (error2.code === "INVALID_INPUT" && [
        MESSAGES.input,
        MESSAGES.empty,
        MESSAGES.ids,
        MESSAGES.mass,
        MESSAGES.endpoints,
        MESSAGES.normal,
        MESSAGES.bound,
        MESSAGES.workLimits
      ].includes(error2.message)) {
        return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.INPUT);
      }
      if (error2.code === "NUMERIC_LIMIT" && error2.message === MESSAGES.result) {
        return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.RESULT);
      }
    }
    if (error2 instanceof PhysicsError && (error2.code === "INVALID_CONFIG" && error2.message === FEATURE_INPUT_MESSAGE2 || error2.code === "NUMERIC_LIMIT" && error2.message === AXIS_MESSAGE)) {
      return new PhysicsError("NUMERIC_LIMIT", FULL_PAIR_ERRORS.GEOMETRY);
    }
  } catch {
  }
  return error2;
}
function ordinaryDense(value, size) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && (size === void 0 || value.length === size) && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => i).every((i) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, i);
    return descriptor !== void 0 && "value" in descriptor;
  });
}
function finiteVector(value, size, bound = Infinity) {
  return ordinaryDense(value, size) && value.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= bound);
}
function record2(value) {
  return value !== null && typeof value === "object";
}
function checkedFullPairInputs(bodies, pairs) {
  if (!ordinaryDense(bodies) || !ordinaryDense(pairs) || bodies.length === 0) refuse("INPUT");
  if (bodies.length > 9 || pairs.length > 36) refuse("PROFILE");
  const ids = /* @__PURE__ */ new Set();
  for (const body of bodies) {
    if (!record2(body) || typeof body.id !== "string" || !ID.test(body.id) || ids.has(body.id) || !finiteVector(body.positionM, 3) || !finiteVector(body.velocityMps, 3) || !finiteVector(body.orientation, 4) || !finiteVector(body.angularVelocityRadps, 3) || typeof body.inverseMass !== "number" || !Number.isFinite(body.inverseMass)) refuse("INPUT");
    ids.add(body.id);
    if (body.kind !== "dynamic" && body.kind !== "static" || body.shape?.kind !== "box" || body.sensor || body.ccd || body.collisionFilter || !finiteVector(body.shape.halfExtentsM, 3, 1e3) || body.shape.halfExtentsM.some((v) => v < 1e-4) || body.restitution !== 0 || !finiteVector(body.inverseInertiaLocal, 3) || body.inverseInertiaLocal.some((v) => v < 0) || (body.kind === "static" ? body.inverseMass !== 0 : body.inverseMass < 1e-6 || body.inverseMass > 1e6)) {
      refuse("PROFILE");
    }
  }
  validateResult(bodies, []);
  const expected = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      expected.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  expected.sort((l, r) => bodies[l[0]].id < bodies[r[0]].id ? -1 : bodies[l[0]].id > bodies[r[0]].id ? 1 : bodies[l[1]].id < bodies[r[1]].id ? -1 : 1);
  if (pairs.length !== expected.length || pairs.some((p, i) => !ordinaryDense(p, 2) || p[0] !== expected[i][0] || p[1] !== expected[i][1])) refuse("INPUT");
}
function pairKey(bodies, a, b) {
  return `${bodies[a].id}\0${bodies[b].id}`;
}
function compactSelection(full) {
  return {
    normal: [...full.normal],
    boundM: full.boundM,
    candidateIndex: full.candidateIndex,
    pointM: [...full.pointM],
    rawAxisLength: full.rawAxisLength,
    label: full.label,
    feature: { ...full.feature }
  };
}
function freshSelection(a, b) {
  return compactSelection(inspectSignedBoxSAT(a, b));
}
function buildFullPairProblem(bodies, pairs, capture) {
  checkedFullPairInputs(bodies, pairs);
  const result = capture ?? {
    problem: { bodies: bodies.map((b) => ({ id: b.id, inverseMass: b.inverseMass })), rows: [] },
    rowSources: [],
    initialDetections: [],
    pairObservations: [],
    tests: 0,
    hits: 0,
    signedPreQueries: 0
  };
  for (const [aIndex, bIndex] of pairs) {
    const a = bodies[aIndex], b = bodies[bIndex], key = pairKey(bodies, aIndex, bIndex);
    result.tests++;
    const hit = detect(a, b);
    result.initialDetections.push({ pairKey: key, aIndex, bIndex, hit: hit ? structuredClone(hit) : null });
    if (hit !== null) result.hits++;
    result.signedPreQueries++;
    const selection = freshSelection(a, b);
    result.pairObservations.push({ pairKey: key, aIndex, bIndex, selection });
    if (hit !== null && (!hit.normal.every((v, d) => v === selection.normal[d]) || Math.max(0, selection.boundM) !== hit.penetration)) refuse("GEOMETRY");
    result.rowSources.push({
      rowIndex: result.problem.rows.length,
      pairKey: key,
      aIndex,
      bIndex,
      selection: structuredClone(selection)
    });
    result.problem.rows.push({
      aId: a.id,
      bId: b.id,
      normal: [...selection.normal],
      boundM: selection.boundM
    });
  }
  if (result.pairObservations.some((p) => p.selection.boundM < -10 || p.selection.boundM > 10)) refuse("RANGE");
  return result;
}
function inspectFullPairHypothesis(bodies, pairs, capture = [], progress) {
  for (const [aIndex, bIndex] of pairs) {
    if (progress) progress.postPairTests++;
    capture.push({
      pairKey: pairKey(bodies, aIndex, bIndex),
      aIndex,
      bIndex,
      selection: freshSelection(bodies[aIndex], bodies[bIndex])
    });
  }
  return capture;
}

// examples/physics-rigid-full-pair-position-world/full-pair-apply.ts
function same2(a, b) {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return Object.is(a, b);
  const ka = Reflect.ownKeys(a), kb = Reflect.ownKeys(b);
  return ka.length === kb.length && ka.every((k) => kb.includes(k) && same2(Reflect.get(a, k), Reflect.get(b, k)));
}
function vector2(value, size) {
  return ordinaryDense(value, size) && value.every((x) => typeof x === "number" && Number.isFinite(x));
}
function applyFullPairTranslationsOnce(preBodies, problem, result) {
  try {
    const checked2 = validateFullPairResult(problem, result);
    if (checked2.status !== "SOLVED" || checked2.ok !== true || !ordinaryDense(preBodies) || preBodies.length < 1 || preBodies.length > 9 || problem.bodies.length !== preBodies.length) refuse("RESULT");
    for (let i = 0; i < preBodies.length; i++) {
      const body = preBodies[i];
      if (!body || body.id !== problem.bodies[i].id || body.inverseMass !== problem.bodies[i].inverseMass || !vector2(body.positionM, 3) || !vector2(body.velocityMps, 3) || !vector2(body.orientation, 4) || !vector2(body.angularVelocityRadps, 3)) refuse("RESULT");
    }
    validateResult(preBodies, []);
    const bodies = preBodies.map(copyBody2), rounding = [];
    for (let i = 0; i < preBodies.length; i++) {
      const before = preBodies[i], body = bodies[i], u = checked2.translations[i].u;
      if (Math.hypot(...u) > 10 || before.inverseMass === 0 && !u.every((v) => v === 0)) refuse("RESULT");
      const roundedFinalM = before.inverseMass === 0 ? [...before.positionM] : before.positionM.map((v, j) => v + u[j]);
      if (!roundedFinalM.every(Number.isFinite)) refuse("RESULT");
      body.positionM = roundedFinalM;
      const actualDeltaM = body.positionM.map((v, j) => v - before.positionM[j]);
      if (before.inverseMass === 0 && (!u.every((v) => v === 0) || !same2(body, before))) refuse("RESULT");
      if (!same2({ ...body, positionM: before.positionM }, before)) refuse("RESULT");
      rounding.push({
        id: body.id,
        nominalTranslationM: [...u],
        roundedFinalM: [...roundedFinalM],
        actualDeltaM,
        nominalActualDeltaDifferenceM: actualDeltaM.map((v, j) => v - u[j]),
        exactRoundedFinalMatch: true,
        staticPositionAdditionPerformed: false,
        dynamicPositionAdditionPerformed: before.inverseMass > 0
      });
    }
    validateResult(bodies, []);
    return {
      bodies: bodies.map(copyBody2),
      rounding: structuredClone(rounding),
      applications: 1,
      worldCreated: false,
      worldStepped: false
    };
  } catch (error2) {
    throw mapFullPairError(error2);
  }
}

// examples/physics-rigid-full-pair-position-world/full-pair-phase.ts
function zeroFullPairPositionStats() {
  return {
    tests: 0,
    hits: 0,
    rows: 0,
    signedPreQueries: 0,
    solverCalls: 0,
    postPairTests: 0,
    maxTranslationM: 0,
    workingApplicationCount: 0,
    solverCounters: {
      iterations: 0,
      activeChanges: 0,
      rankChecks: 0,
      linearSolves: 0,
      constraintTests: 0,
      factorizations: 0,
      blockRightHandSides: 0,
      exactIntegerOperations: 0,
      exactPeakBits: 0
    },
    certificate: null
  };
}
function errorRecord(error2) {
  let result = {
    kind: "unexpected-error",
    name: "ThrownValue",
    message: "Unexpected non-Error exception"
  };
  try {
    if (error2 instanceof Error) result = { kind: "unexpected-error", name: error2.name, message: error2.message };
    if (error2 instanceof PhysicsError) {
      result = { kind: "typed-refusal", name: error2.name, code: error2.code, message: error2.message };
    }
  } catch {
  }
  return result;
}
function runFullPairPositionPhase(workingBodies, sortedPairs, options = {}) {
  const stats2 = zeroFullPairPositionStats();
  const attempt = {
    preBodies: [],
    pairs: [],
    initialDetections: [],
    pairObservations: [],
    problem: null,
    rowSources: [],
    result: null,
    hypotheticalBodies: null,
    rounding: null,
    finalPairObservations: [],
    failurePair: null,
    workingApplicationCount: 0,
    error: null
  };
  const capture = {
    problem: { bodies: [], rows: [] },
    rowSources: attempt.rowSources,
    initialDetections: attempt.initialDetections,
    pairObservations: attempt.pairObservations,
    tests: 0,
    hits: 0,
    signedPreQueries: 0
  };
  const updatePreStats = () => {
    stats2.tests = capture.tests;
    stats2.hits = capture.hits;
    stats2.rows = capture.problem.rows.length;
    stats2.signedPreQueries = capture.signedPreQueries;
  };
  try {
    checkedFullPairInputs(workingBodies, sortedPairs);
    attempt.preBodies = workingBodies.map(copyBody2);
    attempt.pairs = sortedPairs.map(([a, b]) => [a, b]);
    capture.problem.bodies = attempt.preBodies.map((b) => ({ id: b.id, inverseMass: b.inverseMass }));
    attempt.problem = capture.problem;
    buildFullPairProblem(attempt.preBodies, attempt.pairs, capture);
    updatePreStats();
    const problem = validateFullPairProblem(capture.problem);
    stats2.solverCalls++;
    const raw = (options.solve ?? solveFullPairPosition)(structuredClone(problem));
    const checked2 = validateFullPairResult(problem, raw);
    attempt.result = checked2;
    stats2.solverCounters = structuredClone(checked2.counters);
    if (checked2.status === "INFEASIBLE") refuse("INFEASIBLE");
    if (checked2.status === "NUMERIC_UNSAFE") refuse("NUMERIC_UNSAFE");
    if (checked2.status === "WORK_LIMIT") refuse("WORK_LIMIT");
    if (checked2.status !== "SOLVED" || checked2.ok !== true) refuse("RESULT");
    stats2.maxTranslationM = Math.max(0, ...checked2.translations.map((t) => Math.hypot(...t.u)));
    stats2.certificate = structuredClone(checked2.certificate);
    const applied = applyFullPairTranslationsOnce(attempt.preBodies, problem, checked2);
    attempt.hypotheticalBodies = applied.bodies;
    attempt.rounding = applied.rounding;
    inspectFullPairHypothesis(applied.bodies, attempt.pairs, attempt.finalPairObservations, stats2);
    attempt.failurePair = attempt.finalPairObservations.find((p) => p.selection.boundM > 1e-12)?.pairKey ?? null;
    if (attempt.failurePair !== null) refuse("NONPENETRATION");
  } catch (caught) {
    updatePreStats();
    const error2 = mapFullPairError(caught);
    const record3 = errorRecord(error2);
    if (attempt.failurePair === null && record3.kind === "typed-refusal" && record3.code === "NUMERIC_LIMIT" && record3.message === FULL_PAIR_ERRORS.RANGE) {
      attempt.failurePair = attempt.pairObservations.find((p) => p.selection.boundM < -10 || p.selection.boundM > 10)?.pairKey ?? null;
    }
    attempt.error = record3;
    options.observeAttempt?.(structuredClone(attempt));
    throw error2;
  }
  options.observeAttempt?.(structuredClone(attempt));
  for (let i = 0; i < workingBodies.length; i++) if (workingBodies[i].inverseMass > 0) {
    workingBodies[i].positionM = [...attempt.hypotheticalBodies[i].positionM];
  }
  attempt.workingApplicationCount = 1;
  stats2.workingApplicationCount = 1;
  return { stats: structuredClone(stats2), attempt: structuredClone(attempt) };
}

// examples/physics-rigid-full-pair-position-world/global-island.ts
var GLOBAL_PHASE_MESSAGE = "private global contact island phase order is invalid";
function copyImpulse(impulse) {
  return { normalNs: impulse.normalNs, tangentNs: [...impulse.tangentNs] };
}
var FrozenContactIsland = class _FrozenContactIsland {
  #bodies;
  #pairs;
  #prior;
  #patches = [];
  #pointsMap = /* @__PURE__ */ new Map();
  #pairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
  #globalStats = _FrozenContactIsland.zeroStats();
  #warmStats = emptyWarmCacheStats();
  #positionStats = zeroFullPairPositionStats();
  #attempt = null;
  #pointLedger = [];
  #options;
  #phase = "assembled";
  static zeroStats() {
    return {
      assemblyTests: 0,
      patches: 0,
      facePatches: 0,
      edgePatches: 0,
      points: 0,
      globalSweeps: 0,
      pointUpdates: 0,
      positionSweeps: 0,
      positionTests: 0,
      positionHits: 0
    };
  }
  constructor(nextBodies, sortedPairs, prior, options = {}) {
    this.#options = { ...options };
    this.#bodies = nextBodies.slice();
    this.#pairs = sortedPairs.map(([a, b]) => [a, b]);
    this.#prior = new Map([...prior].map(([key, impulse]) => [key, copyImpulse(impulse)]));
    for (const [aIndex, bIndex] of this.#pairs) {
      this.#globalStats.assemblyTests++;
      this.#pairStats.eligiblePairs++;
      this.#pairStats.candidatePairs++;
      const a = this.#bodies[aIndex], b = this.#bodies[bIndex];
      const hit = detect(a, b);
      if (!hit) continue;
      if (hit.penetration > MAX_STEP_DISPLACEMENT_M) {
        error("NUMERIC_LIMIT", "contact penetration exceeded limit");
      }
      const actual = adaptContactGeometry(a, b);
      if (!actual) error("NUMERIC_LIMIT", FEATURE_WITNESS_MESSAGE);
      const patch = {
        aIndex,
        bIndex,
        aId: a.id,
        bId: b.id,
        pairKey: `${a.id}\0${b.id}`,
        family: actual.family,
        normal: actual.normal,
        satNormalAtoB: actual.satNormalAtoB,
        penetrationM: hit.penetration,
        points: actual.points,
        meanPointM: actual.meanPointM
      };
      this.#patches.push(patch);
      this.#globalStats.patches++;
      if (patch.family === "face") this.#globalStats.facePatches++;
      else this.#globalStats.edgePatches++;
      this.#globalStats.points += patch.points.length;
    }
  }
  /** Experimental cold coupled normal solve; no old warm starts or sweeps. */
  solve() {
    this.#requirePhase("assembled");
    const cold = solveFrozenNormalIsland(this.#bodies, this.#patches);
    for (const [key, impulse] of cold.pointsMap) this.#pointsMap.set(key, impulse);
    this.#pointLedger.push(...cold.pointLedger);
    this.#warmStats.coldPoints = cold.pointLedger.length;
    this.#phase = "solved";
  }
  /** Fresh geometry for position-only correction; no new velocity/cache rows. */
  projectPositions() {
    this.#requirePhase("solved");
    const result = runFullPairPositionPhase(this.#bodies, this.#pairs, this.#options);
    this.#positionStats = result.stats;
    this.#attempt = result.attempt;
    this.#globalStats.positionSweeps = 1;
    this.#globalStats.positionTests = result.stats.tests;
    this.#globalStats.positionHits = result.stats.hits;
    this.#phase = "projected";
  }
  getFullPairPositionStats() {
    return structuredClone(this.#positionStats);
  }
  getFullPairPositionAttempt() {
    return structuredClone(this.#attempt);
  }
  /** Net step J uses final accumulators, including the warm impulse applied once. */
  getPointLedger() {
    this.#requirePhase("solved");
    return structuredClone(this.#pointLedger);
  }
  getGlobalStats() {
    return { ...this.#globalStats };
  }
  getWarmCacheStats() {
    return { ...this.#warmStats };
  }
  /** Assembly geometry and final accumulated impulses, not final force data. */
  result() {
    this.#requirePhase("projected");
    const contacts = this.#patches.map((patch) => {
      let impulseNs = 0;
      let tangentImpulseNs = [0, 0, 0];
      for (const point2 of patch.points) {
        const impulse = this.#pointsMap.get(`${patch.pairKey}\0${point2.id}`);
        impulseNs += impulse.normalNs;
        tangentImpulseNs = add(tangentImpulseNs, impulse.tangentNs);
      }
      return {
        aId: patch.aId,
        bId: patch.bId,
        normalAtoB: [...patch.normal],
        pointM: [...patch.meanPointM],
        penetrationM: patch.penetrationM,
        impulseNs,
        tangentImpulseNs
      };
    });
    return {
      contacts,
      pointsMap: new Map([...this.#pointsMap].map(([key, impulse]) => [key, copyImpulse(impulse)])),
      pairStats: { ...this.#pairStats },
      globalStats: this.getGlobalStats(),
      warmCacheStats: this.getWarmCacheStats()
    };
  }
  #requirePhase(expected) {
    if (this.#phase !== expected) error("NUMERIC_LIMIT", GLOBAL_PHASE_MESSAGE);
  }
};

// packages/barocss-physics/src/dynamic-hinge-joint.ts
var magnitude = (vector4) => Math.hypot(...vector4);
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
    if (action.forceN || action.impulseNs || [action.torqueNm, action.angularImpulseNms].filter((vector4) => vector4 !== void 0).some((vector4) => magnitude(sub(vector4, scale(axis, dot2(vector4, axis)))) > 1e-12)) {
      error("INVALID_COMMAND", "dynamic hinge admits axis-aligned angular commands only");
    }
  }
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
      const low = finite2(limits[0], -Math.PI / 2, 0, "limitRad[0]");
      const high = finite2(limits[1], 0, Math.PI / 2, "limitRad[1]");
      limitRad = [low, high];
      if (Object.hasOwn(input, "motor")) {
        const motorInput = record(input.motor, "motor");
        fields(motorInput, ["targetSpeedRadps", "maxImpulseNms", "maxReactionNms"], "motor");
        const targetSpeedRadps = finite2(motorInput.targetSpeedRadps, -2, 2, "motor.targetSpeedRadps");
        const maxImpulseNms = finite2(motorInput.maxImpulseNms, 0, 0.05, "motor.maxImpulseNms");
        const maxReactionNms = finite2(motorInput.maxReactionNms, 0, 1, "motor.maxReactionNms");
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

// packages/barocss-physics/src/joint-motor.ts
function driveHingeMotor(joint, body, angleRad) {
  const motor = joint.motor;
  const axis = joint.axisWorld;
  const [low, high] = joint.limitRad;
  if (angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0) return 0;
  const inverseAxisInertia = dot2(axis, inverseInertia(body, axis));
  const speed = dot2(body.angularVelocityRadps, axis);
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
  const inverseSum = dot2(axis, inverseInertia(a, axis)) + dot2(axis, inverseInertia(b, axis));
  const speed = dot2(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
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
      normalFixtureToBody: rotate(fixture.orientation, hit.normalLocal)
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
  const distanceSquared = dot2(relativeStart, relativeStart);
  if (distanceSquared <= radius * radius) return null;
  const markedTravel = sub(markedEnd.positionM, markedStart.positionM);
  const otherTravel = sub(otherEnd.positionM, otherStart.positionM);
  const relativeTravel = sub(markedTravel, otherTravel);
  const a = dot2(relativeTravel, relativeTravel);
  if (a === 0) return null;
  const b = 2 * dot2(relativeStart, relativeTravel);
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

// packages/barocss-physics/src/scene-profile.ts
function filterAllowsPair(a, b) {
  const left = a.collisionFilter;
  const right = b.collisionFilter;
  if (!left || !right) return true;
  return (left.maskBits & right.categoryBits) !== 0 && (right.maskBits & left.categoryBits) !== 0;
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

// examples/physics-rigid-full-pair-position-world/reference-world.ts
function publicState(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt) {
  return {
    stepIndex,
    timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor, ccd, collisionFilter: collisionFilter2, sleeping }) => ({
      id,
      kind,
      shape: copyShape(collider),
      positionM: [...positionM],
      velocityMps: [...velocityMps],
      orientation: [...orientation],
      angularVelocityRadps: [...angularVelocityRadps],
      ...inertiaKgM2 === void 0 ? {} : { inertiaKgM2 },
      ...inertiaDiagonalKgM2 === void 0 ? {} : { inertiaDiagonalKgM2: [...inertiaDiagonalKgM2] },
      ...sensor ? { sensor: true } : {},
      ...ccd ? { ccd: true } : {},
      ...collisionFilter2 ? { collisionFilter: { ...collisionFilter2 } } : {},
      ...sleeping !== void 0 ? { sleeping } : {}
    })),
    contacts: contacts.map(({ aId, bId, normalAtoB, pointM, penetrationM, impulseNs, tangentImpulseNs }) => ({
      aId,
      bId,
      normalAtoB: [...normalAtoB],
      pointM: [...pointM],
      penetrationM,
      impulseNs,
      tangentImpulseNs: [...tangentImpulseNs]
    })),
    events: events.map((event) => ({ ...event })),
    joints: joints.map((joint) => ({
      ...joint,
      linearImpulseNs: [...joint.linearImpulseNs],
      angularImpulseNms: [...joint.angularImpulseNms]
    })),
    ccdHits: ccdHits.map((hit) => ({ ...hit, normalFixtureToBody: [...hit.normalFixtureToBody] })),
    pairStats: { ...pairStats }
  };
}
function createPhysicsWorld(config, privateOptions = {}) {
  const options = { ...privateOptions };
  const input = record(config, "world");
  fields(input, ["fixedStepSeconds", "gravityMps2", "bodies", "joints", "broadPhase", "contactMode", "sceneMode"], "world");
  if (Object.hasOwn(input, "sceneMode") && input.sceneMode !== "large-v1") {
    error("INVALID_CONFIG", "sceneMode must be large-v1 when present");
  }
  if (Object.hasOwn(input, "broadPhase") && input.broadPhase !== "aabb") {
    error("INVALID_CONFIG", "broadPhase must be aabb when present");
  }
  if (Object.hasOwn(input, "contactMode") && input.contactMode !== "persistent-box-v1") {
    error("INVALID_CONFIG", "contactMode must be persistent-box-v1 when present");
  }
  const useAabb = input.broadPhase === "aabb";
  const usePersistentBox = input.contactMode === "persistent-box-v1";
  const largeMode = input.sceneMode === "large-v1";
  if (largeMode && (!useAabb || usePersistentBox || Object.hasOwn(input, "joints"))) {
    error("INVALID_CONFIG", "large-v1 requires aabb and excludes joints and persistent-box-v1");
  }
  const dt = finite2(input.fixedStepSeconds, 1 / 240, 1 / 30, "fixedStepSeconds");
  const gravity = vector(input.gravityMps2, -1e3, 1e3, "gravityMps2");
  const bodyLimit = largeMode ? MAX_LARGE_BODIES : MAX_BODIES;
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > bodyLimit) {
    error("INVALID_CONFIG", `bodies must contain 1..${bodyLimit} entries`);
  }
  if (usePersistentBox && input.bodies.length > 9) {
    error("INVALID_CONFIG", "private feature contact reference admits at most nine bodies");
  }
  let bodies = input.bodies.map((value) => parseBody(value, largeMode));
  if (largeMode && bodies.some((body) => body.ccd)) {
    error("INVALID_CONFIG", "large-v1 excludes CCD");
  }
  if (!bodies.some((body) => body.kind === "dynamic")) error("INVALID_CONFIG", "at least one dynamic body is required");
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error("INVALID_CONFIG", "duplicate body ID");
  if (!usePersistentBox || Object.hasOwn(input, "joints") || Object.hasOwn(input, "sceneMode") || Object.hasOwn(input, "broadPhase") || bodies.some((body) => body.shape.kind !== "box" || body.kind === "kinematic" || body.sensor || body.ccd || body.collisionFilter)) {
    error("INVALID_CONFIG", "private feature contact reference requires persistent boxes and excludes joints, sceneMode, broadPhase, kinematic, sensor, CCD and filters");
  }
  if (bodies.some((body) => body.restitution !== 0)) {
    error("INVALID_CONFIG", "private global contact reference requires zero restitution");
  }
  const joints = parseJoints(Object.hasOwn(input, "joints") ? input.joints : [], bodies);
  const dynamicHinge = joints.find((joint) => joint.kind === "hinge" && bodies[joint.aIndex].kind === "dynamic");
  if (dynamicHinge) admitDynamicHingeScene(dynamicHinge, bodies, gravity);
  const ccd = admitCcd(bodies, joints.length, gravity);
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
  let globalStats = FrozenContactIsland.zeroStats();
  let warmCacheStats = emptyWarmCacheStats();
  let positionStats = zeroFullPairPositionStats();
  let positionAttempt = null;
  let stepLedger = null;
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => {
    if (disposed) error("DISPOSED", "world is disposed");
  };
  return {
    getGlobalContactStats() {
      ensureActive();
      return { ...globalStats };
    },
    getWarmCacheStats() {
      ensureActive();
      return { ...warmCacheStats };
    },
    getFullPairPositionStats() {
      ensureActive();
      return structuredClone(positionStats);
    },
    getFullPairPositionAttempt() {
      ensureActive();
      return structuredClone(positionAttempt);
    },
    getStepLedger() {
      ensureActive();
      return structuredClone(stepLedger);
    },
    getWarmCacheSnapshot() {
      ensureActive();
      return [...persistentPoints].map(([key, p]) => [key, { normalNs: p.normalNs, tangentNs: [...p.tangentNs] }]);
    },
    getState() {
      ensureActive();
      return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error("INVALID_STEP", "step must equal configured fixedStepSeconds");
      if (stepIndex >= MAX_STEPS) error("WORLD_LIMIT", "world step limit reached");
      const actions = parseCommands(commands, bodies);
      if (dynamicHinge) admitDynamicHingeCommands(dynamicHinge, bodies, actions);
      if (ccd.kind === "box-pair") rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
      const beforeBodies = bodies.map(copyBody2);
      const next = bodies.map(copyBody2);
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
      const freeBodies = next.map(copyBody2);
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
      const ledgerBase = {
        beforeBodies,
        freeBodies,
        fixedStepSeconds: dt,
        gravityMps2: [...gravity],
        actions: structuredClone([...actions])
      };
      const observeStep = (stage, velocity, final, points) => {
        if (!options.observeStepAttempt) return;
        const attempt = {
          stage,
          ledger: { ...ledgerBase, velocityBodies: velocity, finalBodies: final, points }
        };
        options.observeStepAttempt(structuredClone(attempt));
      };
      observeStep("free-ready", null, null, null);
      const island = new FrozenContactIsland(next, pairs, persistentPoints, options);
      island.solve();
      const velocityBodies = next.map(copyBody2);
      const pointLedger = island.getPointLedger();
      observeStep("velocity-ready", velocityBodies, null, pointLedger);
      island.projectPositions();
      const {
        contacts: nextContacts,
        pointsMap: nextPersistentPoints,
        pairStats: nextPairStats,
        globalStats: nextGlobalStats,
        warmCacheStats: nextWarmCacheStats
      } = island.result();
      const nextPositionStats = island.getFullPairPositionStats();
      const nextPositionAttempt = island.getFullPairPositionAttempt();
      const sensed = /* @__PURE__ */ new Map();
      const nextJoints = jointStates.map((joint) => ({
        ...joint,
        linearImpulseNs: [0, 0, 0],
        angularImpulseNms: [0, 0, 0]
      }));
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
      const finalBodies = next.map(copyBody2);
      observeStep("closure-ready", velocityBodies, finalBodies, pointLedger);
      for (let index = 0; index < next.length; index++) {
        if (next[index].kind !== "dynamic") continue;
        const movement = Math.hypot(...next[index].positionM.map((x, axis) => x - bodies[index].positionM[axis]));
        if (!Number.isFinite(movement) || movement > MAX_STEP_DISPLACEMENT_M) error("NUMERIC_LIMIT", FULL_PAIR_ERRORS.RESULT);
      }
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
      const nextStepLedger = {
        ...ledgerBase,
        velocityBodies,
        finalBodies,
        points: pointLedger
      };
      globalStats = nextGlobalStats;
      warmCacheStats = nextWarmCacheStats;
      positionStats = nextPositionStats;
      positionAttempt = nextPositionAttempt;
      stepLedger = nextStepLedger;
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
      return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    overlapSphere(input2) {
      ensureActive();
      const query = queryRecord(input2, ["centerM", "radiusM"], ["includeSensors"]);
      const center = queryVector(query.centerM, 1e4, "centerM");
      const radius = queryNumber(query.radiusM, 1e-4, 1e3, "radiusM");
      const sensors = includeSensors(query);
      return bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body)).map((body) => body.id).sort();
    },
    raycast(input2) {
      ensureActive();
      const query = queryRecord(input2, ["originM", "direction", "maxDistanceM"], ["includeSensors"]);
      const origin = queryVector(query.originM, 1e4, "originM");
      const direction2 = queryVector(query.direction, 1 + 1e-9, "direction");
      if (Math.abs(Math.hypot(...direction2) - 1) > 1e-9) {
        error("INVALID_QUERY", "direction must be a unit 3-vector");
      }
      const limit = queryNumber(query.maxDistanceM, 1e-4, 1e4, "maxDistanceM");
      const sensors = includeSensors(query);
      let best = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction2, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId) {
          best = { bodyId: body.id, distanceM: distance };
        }
      }
      return best;
    },
    dispose() {
      disposed = true;
      bodies = [];
      contacts = [];
      events = [];
      ccdHits = [];
      activePairs.clear();
      persistentPoints.clear();
      sleepFrames = [];
      positionAttempt = null;
      stepLedger = null;
    }
  };
}

// examples/physics-stack-solver-2276/evidence/world-emitted-03/modules/examples/physics-stack-solver-2276/verification.js
var VERIFICATION_GATE = 1e-10;
var zero = () => [0, 0, 0];
var sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
var minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var times = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
var dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var mv = (m, v) => [dot4(m[0], v), dot4(m[1], v), dot4(m[2], v)];
var componentError = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
function requireData(condition, label) {
  if (!condition)
    throw new RangeError(`Invalid verification data: ${label}`);
}
function finite4(value, label) {
  requireData(typeof value === "number" && Number.isFinite(value), label);
}
function vector3(value, label) {
  requireData(Array.isArray(value) && value.length === 3 && [0, 1, 2].every((i) => Object.hasOwn(value, i)), label);
  for (const component of value)
    finite4(component, label);
}
function identity(value, label) {
  requireData(typeof value === "string" && value.length > 0, label);
}
function inertia2(body) {
  const a = body.inverseInertiaWorld;
  requireData(Array.isArray(a) && a.length === 3, "inertia matrix");
  for (const row of a)
    vector3(row, "inertia row");
  requireData(Math.abs(a[0][1] - a[1][0]) <= VERIFICATION_GATE && Math.abs(a[0][2] - a[2][0]) <= VERIFICATION_GATE && Math.abs(a[1][2] - a[2][1]) <= VERIFICATION_GATE, "symmetric inertia");
  if (body.inverseMass === 0) {
    requireData(a.every((row) => row.every((value) => value === 0)), "static inverse inertia");
    return null;
  }
  const c0 = cross3(a[1], a[2]), c1 = cross3(a[2], a[0]), c2 = cross3(a[0], a[1]);
  const determinant = dot4(a[0], c0);
  requireData(a[0][0] > 0 && a[0][0] * a[1][1] - a[0][1] * a[1][0] > 0 && Number.isFinite(determinant) && determinant > 0, "positive definite inverse inertia");
  return [
    [c0[0] / determinant, c1[0] / determinant, c2[0] / determinant],
    [c0[1] / determinant, c1[1] / determinant, c2[1] / determinant],
    [c0[2] / determinant, c1[2] / determinant, c2[2] / determinant]
  ];
}
function bodyData(body) {
  requireData(body !== null && typeof body === "object", "body");
  identity(body.id, "body id");
  vector3(body.positionM, "body position");
  vector3(body.velocityMps, "body velocity");
  vector3(body.angularVelocityRadps, "body angular velocity");
  finite4(body.inverseMass, "inverse mass");
  requireData(body.inverseMass >= 0, "nonnegative inverse mass");
}
function pointVelocity2(v, w, arm) {
  return sum(v, cross3(w, arm));
}
function kinetic(body, moment, v, w) {
  return body.inverseMass === 0 ? 0 : dot4(v, v) / (2 * body.inverseMass) + dot4(w, mv(moment, w)) / 2;
}
function verifyWithOptionalOracle(problem, candidate, oracle) {
  requireData(Array.isArray(problem.bodies) && problem.bodies.length >= 1 && problem.bodies.length <= 9, "1..9 bodies");
  requireData(Array.isArray(problem.points) && problem.points.length >= 1 && problem.points.length <= 32, "1..32 points");
  if (oracle !== void 0) {
    requireData(Array.isArray(oracle.bodies) && oracle.bodies.length === problem.bodies.length, "oracle body count");
    if (oracle.sourceReceiptSha256 !== void 0)
      requireData(/^[0-9a-f]{64}$/.test(oracle.sourceReceiptSha256), "oracle source hash");
  }
  const input = /* @__PURE__ */ new Map(), moments = /* @__PURE__ */ new Map();
  const impulses = /* @__PURE__ */ new Map(), torques = /* @__PURE__ */ new Map();
  for (const body of problem.bodies) {
    bodyData(body);
    requireData(!input.has(body.id), "unique body ids");
    input.set(body.id, body);
    moments.set(body.id, inertia2(body));
    impulses.set(body.id, zero());
    torques.set(body.id, zero());
  }
  const pointIds = /* @__PURE__ */ new Set();
  for (const point2 of problem.points) {
    identity(point2.id, "point id");
    requireData(!pointIds.has(point2.id), "unique point ids");
    pointIds.add(point2.id);
    requireData(input.has(point2.aId) && input.has(point2.bId) && point2.aId !== point2.bId, "directed point endpoints");
    vector3(point2.pointM, "point position");
    vector3(point2.normalAtoB, "point normal");
    requireData(Math.abs(Math.hypot(...point2.normalAtoB) - 1) <= VERIFICATION_GATE, "unit normal");
  }
  const expected = /* @__PURE__ */ new Map();
  for (const body of oracle?.bodies ?? []) {
    identity(body.id, "oracle id");
    requireData(input.has(body.id) && !expected.has(body.id), "oracle identity");
    vector3(body.velocityMps, "oracle velocity");
    vector3(body.angularVelocityRadps, "oracle angular velocity");
    vector3(body.netImpulseNs, "oracle net impulse");
    vector3(body.netTorqueNms, "oracle net torque");
    expected.set(body.id, body);
  }
  const report = {
    passed: false,
    normalKktPassed: false,
    zeroTangentFrictionFeasible: false,
    oracleMatched: false,
    candidateReportsMatched: false,
    sourceReceiptSha256: oracle?.sourceReceiptSha256 ?? null,
    bodies: [],
    rows: [],
    maxima: {
      closingNormalSpeedMps: 0,
      negativeNormalImpulseNs: 0,
      complementarityJ: 0,
      loadedTangentSpeedMps: 0,
      reportedVelocityErrorMps: 0,
      reportedAngularVelocityErrorRadps: 0,
      oracleVelocityErrorMps: 0,
      oracleAngularVelocityErrorRadps: 0,
      oracleNetImpulseErrorNs: 0,
      oracleNetTorqueErrorNms: 0,
      reportedResidualError: 0,
      impulseWorkErrorJ: 0
    },
    energy: { freeKineticJ: 0, finalKineticJ: 0, normalImpulseWorkJ: 0 },
    violations: []
  };
  if (candidate.ok !== true || candidate.status !== "SOLVED_NORMAL_ONLY" || candidate.normalImpulsesNs === null || candidate.rowResiduals === null || candidate.certificate === null) {
    report.violations.push("candidate did not return a solved normal problem");
    return report;
  }
  requireData(Array.isArray(candidate.bodies) && candidate.bodies.length === input.size, "candidate body count");
  requireData(Array.isArray(candidate.normalImpulsesNs) && candidate.normalImpulsesNs.length === problem.points.length, "candidate impulse count");
  requireData(Array.isArray(candidate.rowResiduals) && candidate.rowResiduals.length === problem.points.length, "candidate row count");
  const returned = /* @__PURE__ */ new Map();
  for (const body of candidate.bodies) {
    bodyData(body);
    requireData(input.has(body.id) && !returned.has(body.id), "candidate body identity");
    inertia2(body);
    returned.set(body.id, body);
    const original = input.get(body.id);
    if (componentError(body.positionM, original.positionM) !== 0 || body.inverseMass !== original.inverseMass || body.inverseInertiaWorld.some((row, i) => componentError(row, original.inverseInertiaWorld[i]) !== 0)) {
      report.violations.push(`candidate changed fixed model data: ${body.id}`);
    }
  }
  for (let i = 0; i < problem.points.length; i++) {
    const point2 = problem.points[i], lambda = candidate.normalImpulsesNs[i];
    finite4(lambda, "normal impulse");
    for (const [id, sign] of [[point2.aId, -1], [point2.bId, 1]]) {
      const impulse = times(point2.normalAtoB, sign * lambda), arm = minus(point2.pointM, input.get(id).positionM);
      impulses.set(id, sum(impulses.get(id), impulse));
      torques.set(id, sum(torques.get(id), cross3(arm, impulse)));
    }
  }
  const reconstructed = /* @__PURE__ */ new Map();
  for (const body of problem.bodies) {
    const netImpulseNs = impulses.get(body.id), netTorqueNms = torques.get(body.id);
    const velocityMps = sum(body.velocityMps, times(netImpulseNs, body.inverseMass));
    const angularVelocityRadps = sum(body.angularVelocityRadps, mv(body.inverseInertiaWorld, netTorqueNms));
    vector3(velocityMps, "reconstructed finite velocity");
    vector3(angularVelocityRadps, "reconstructed finite angular velocity");
    const actual = returned.get(body.id), wanted = expected.get(body.id);
    const m2 = report.maxima;
    m2.reportedVelocityErrorMps = Math.max(m2.reportedVelocityErrorMps, componentError(actual.velocityMps, velocityMps));
    m2.reportedAngularVelocityErrorRadps = Math.max(m2.reportedAngularVelocityErrorRadps, componentError(actual.angularVelocityRadps, angularVelocityRadps));
    if (wanted !== void 0) {
      m2.oracleVelocityErrorMps = Math.max(m2.oracleVelocityErrorMps, componentError(velocityMps, wanted.velocityMps));
      m2.oracleAngularVelocityErrorRadps = Math.max(m2.oracleAngularVelocityErrorRadps, componentError(angularVelocityRadps, wanted.angularVelocityRadps));
      m2.oracleNetImpulseErrorNs = Math.max(m2.oracleNetImpulseErrorNs, componentError(netImpulseNs, wanted.netImpulseNs));
      m2.oracleNetTorqueErrorNms = Math.max(m2.oracleNetTorqueErrorNms, componentError(netTorqueNms, wanted.netTorqueNms));
    }
    const independent = { id: body.id, velocityMps, angularVelocityRadps, netImpulseNs, netTorqueNms };
    reconstructed.set(body.id, independent);
    report.bodies.push(independent);
    report.energy.freeKineticJ += kinetic(body, moments.get(body.id), body.velocityMps, body.angularVelocityRadps);
    report.energy.finalKineticJ += kinetic(body, moments.get(body.id), velocityMps, angularVelocityRadps);
  }
  for (let i = 0; i < problem.points.length; i++) {
    const point2 = problem.points[i], lambda = candidate.normalImpulsesNs[i];
    const a = input.get(point2.aId), b = input.get(point2.bId);
    const finalA = reconstructed.get(point2.aId), finalB = reconstructed.get(point2.bId);
    const armA = minus(point2.pointM, a.positionM), armB = minus(point2.pointM, b.positionM);
    const relative = minus(pointVelocity2(finalB.velocityMps, finalB.angularVelocityRadps, armB), pointVelocity2(finalA.velocityMps, finalA.angularVelocityRadps, armA));
    const normalSpeedMps = dot4(point2.normalAtoB, relative);
    const tangentSpeedMps = Math.hypot(...minus(relative, times(point2.normalAtoB, normalSpeedMps)));
    const row = {
      id: point2.id,
      normalImpulseNs: lambda,
      normalSpeedMps,
      negativeNormalImpulseNs: Math.max(0, -lambda),
      complementarityJ: Math.abs(lambda * normalSpeedMps),
      tangentSpeedMps
    };
    report.rows.push(row);
    const m2 = report.maxima;
    m2.closingNormalSpeedMps = Math.max(m2.closingNormalSpeedMps, -normalSpeedMps);
    m2.negativeNormalImpulseNs = Math.max(m2.negativeNormalImpulseNs, row.negativeNormalImpulseNs);
    m2.complementarityJ = Math.max(m2.complementarityJ, row.complementarityJ);
    if (lambda > 0)
      m2.loadedTangentSpeedMps = Math.max(m2.loadedTangentSpeedMps, tangentSpeedMps);
    const claimed = candidate.rowResiduals[i];
    requireData(claimed.id === point2.id, "candidate residual row identity/order");
    for (const field of ["normalSpeedMps", "negativeNormalImpulseNs", "complementarityJ", "tangentSpeedMps"]) {
      finite4(claimed[field], "candidate residual");
      m2.reportedResidualError = Math.max(m2.reportedResidualError, Math.abs(row[field] - claimed[field]));
    }
    const freeRelative = minus(pointVelocity2(b.velocityMps, b.angularVelocityRadps, armB), pointVelocity2(a.velocityMps, a.angularVelocityRadps, armA));
    report.energy.normalImpulseWorkJ += lambda * (dot4(point2.normalAtoB, freeRelative) + normalSpeedMps) / 2;
  }
  const c = candidate.certificate, m = report.maxima;
  for (const [field, actual] of [
    ["maxClosingNormalSpeedMps", m.closingNormalSpeedMps],
    ["maxNegativeNormalImpulseNs", m.negativeNormalImpulseNs],
    ["maxComplementarityJ", m.complementarityJ],
    ["maxLoadedTangentSpeedMps", m.loadedTangentSpeedMps]
  ]) {
    finite4(c[field], "candidate certificate");
    m.reportedResidualError = Math.max(m.reportedResidualError, Math.abs(c[field] - actual));
  }
  finite4(c.maxStationaritySqrtJ, "candidate stationarity");
  requireData(typeof c.zeroTangentFeasible === "boolean", "candidate friction flag");
  m.impulseWorkErrorJ = Math.abs(report.energy.finalKineticJ - report.energy.freeKineticJ - report.energy.normalImpulseWorkJ);
  const gate = VERIFICATION_GATE;
  report.normalKktPassed = m.closingNormalSpeedMps <= gate && m.negativeNormalImpulseNs <= gate && m.complementarityJ <= gate;
  report.zeroTangentFrictionFeasible = report.normalKktPassed && m.loadedTangentSpeedMps <= gate;
  report.oracleMatched = oracle !== void 0 && m.oracleVelocityErrorMps <= gate && m.oracleAngularVelocityErrorRadps <= gate && m.oracleNetImpulseErrorNs <= gate && m.oracleNetTorqueErrorNms <= gate;
  report.candidateReportsMatched = m.reportedVelocityErrorMps <= gate && m.reportedAngularVelocityErrorRadps <= gate && m.reportedResidualError <= gate && c.maxStationaritySqrtJ >= 0 && c.maxStationaritySqrtJ <= gate && c.zeroTangentFeasible === m.loadedTangentSpeedMps <= gate;
  if (!report.normalKktPassed)
    report.violations.push("independent normal complementarity failed");
  if (!report.zeroTangentFrictionFeasible)
    report.violations.push("zero tangent impulse is not friction-qualified on loaded rows");
  if (oracle !== void 0 && !report.oracleMatched)
    report.violations.push("independent Fraction body/load oracle differs");
  if (!report.candidateReportsMatched)
    report.violations.push("candidate state or residual report differs from signed-impulse reconstruction");
  if (!(m.impulseWorkErrorJ <= gate))
    report.violations.push("independent normal impulse work balance failed");
  report.passed = report.violations.length === 0;
  return report;
}
function verifyNormalKkt(problem, candidate) {
  const report = verifyWithOptionalOracle(problem, candidate);
  const m = report.maxima;
  return {
    passed: report.passed,
    normalKktPassed: report.normalKktPassed,
    zeroTangentFrictionFeasible: report.zeroTangentFrictionFeasible,
    candidateReportsMatched: report.candidateReportsMatched,
    bodies: report.bodies,
    rows: report.rows,
    energy: report.energy,
    violations: report.violations,
    maxima: {
      closingNormalSpeedMps: m.closingNormalSpeedMps,
      negativeNormalImpulseNs: m.negativeNormalImpulseNs,
      complementarityJ: m.complementarityJ,
      loadedTangentSpeedMps: m.loadedTangentSpeedMps,
      reportedVelocityErrorMps: m.reportedVelocityErrorMps,
      reportedAngularVelocityErrorRadps: m.reportedAngularVelocityErrorRadps,
      reportedResidualError: m.reportedResidualError,
      impulseWorkErrorJ: m.impulseWorkErrorJ
    },
    oracleQualification: "NOT_EVALUATED"
  };
}
export {
  PhysicsError,
  createPhysicsWorld,
  setNormalIslandObserver,
  verifyNormalKkt
};
