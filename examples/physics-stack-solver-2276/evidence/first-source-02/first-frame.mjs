// examples/physics-stack-solver-2276/first-frame.ts
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// examples/physics-stack-solver-2276/candidate.ts
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
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function numeric(message) {
  throw new Stop("NUMERIC", message);
}
function need(value, message) {
  if (!value) numeric(message);
}
function finite(x) {
  if (!Number.isFinite(x)) numeric("nonfinite arithmetic");
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
  if (s[key] + amount > NORMAL_CANDIDATE_BUDGET[key]) throw new Stop("ITERATION_LIMIT", "budget:" + key);
  s[key] += amount;
}
function dot(a, b, s) {
  take(s, "dotProducts");
  take(s, "dotScalarProducts", a.length);
  let value = 0;
  for (let i = 0; i < a.length; i++) value = finite(value + finite(a[i] * b[i]));
  return value;
}
function axpy(target, source, amount, s) {
  take(s, "vectorUpdates", target.length);
  for (let i = 0; i < target.length; i++) target[i] = finite(target[i] + finite(amount * source[i]));
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
      need(
        [...body.velocityMps, ...body.angularVelocityRadps, ...body.inverseInertiaWorld.flat()].every((x) => x === 0),
        "static input must have zero motion and inertia"
      );
    } else dynamic++;
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
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) need(matrix[i][j] === matrix[j][i], "symmetric inertia required");
  const lower = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) {
    let entry = matrix[i][j];
    for (let k = 0; k < j; k++) {
      take(s, "triangularTerms");
      entry = finite(entry - finite(lower[i][k] * lower[j][k]));
    }
    if (i === j) {
      need(entry > 1e-12 * scale, "positive definite well-scaled inertia required");
      lower[i][j] = Math.sqrt(entry);
    } else lower[i][j] = finite(entry / lower[j][j]);
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
    for (const value of body.velocityMps) free.push(finite(value / rootMass));
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
      if (block.offset === null) continue;
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
    if (Math.sqrt(Math.max(0, square)) <= NORMAL_CANDIDATE_GATES.rank * scale) break;
    const direction = [...a[pivot]];
    for (let pass = 0; pass < 2; pass++) for (const basis2 of q) axpy(direction, basis2, -dot(direction, basis2, s), s);
    const length = Math.sqrt(dot(direction, direction, s));
    need(length > NORMAL_CANDIDATE_GATES.rank * scale, "inconsistent rank decision");
    const basis = direction.map((value) => finite(value / length));
    for (const prior of q) need(Math.abs(dot(basis, prior, s)) <= 1e-12, "orthogonality");
    q.push(basis);
    rows.push(pivot);
    remaining.splice(remaining.indexOf(pivot), 1);
    for (const index of remaining) for (let pass = 0; pass < 2; pass++) {
      const target = residual.get(index);
      axpy(target, basis, -dot(target, basis, s), s);
    }
  }
  const lower = rows.map((index, i) => q.slice(0, i + 1).map((basis) => dot(a[index], basis, s)));
  return { rows, q, lower };
}
function equality(m, qr, s) {
  const c = qr.q.map((row) => dot(row, m.free, s)), target = [...m.free];
  for (let i = 0; i < qr.q.length; i++) axpy(target, qr.q[i], -c[i], s);
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
      if (active === null) s.qrRank = qr.rows.length;
      else need(qr.rows.length === active.length, "dependent working basis");
      active = [...qr.rows];
      const solved = equality(m, qr, s), direction = solved.target.map((value, i) => finite(value - current[i]));
      const directionNorm = Math.sqrt(dot(direction, direction, s));
      let alpha = 1, blocker = null;
      if (directionNorm > 1e-12 * Math.max(1, Math.sqrt(dot(m.free, m.free, s)))) {
        for (let i = 0; i < m.a.length; i++) {
          take(s, "constraintTests");
          if (active.includes(i)) continue;
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
      for (let i = 0; i < active.length; i++) if (solved.lambda[i] < -1e-10 && (leaving === null || active[i] < active[leaving])) leaving = i;
      if (leaving !== null) {
        take(s, "activeChanges");
        active.splice(leaving, 1);
        continue;
      }
      return finish(m, current, active, solved.lambda, s);
    }
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
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

// examples/physics-stack-solver-2276/verification.ts
var VERIFICATION_GATE = 1e-10;
var zero = () => [0, 0, 0];
var sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
var minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var times = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
var dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var mv = (m, v) => [dot2(m[0], v), dot2(m[1], v), dot2(m[2], v)];
var componentError = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
function requireData(condition, label) {
  if (!condition) throw new RangeError(`Invalid verification data: ${label}`);
}
function finite2(value, label) {
  requireData(typeof value === "number" && Number.isFinite(value), label);
}
function vector(value, label) {
  requireData(Array.isArray(value) && value.length === 3 && [0, 1, 2].every((i) => Object.hasOwn(value, i)), label);
  for (const component of value) finite2(component, label);
}
function identity(value, label) {
  requireData(typeof value === "string" && value.length > 0, label);
}
function inertia(body) {
  const a = body.inverseInertiaWorld;
  requireData(Array.isArray(a) && a.length === 3, "inertia matrix");
  for (const row of a) vector(row, "inertia row");
  requireData(Math.abs(a[0][1] - a[1][0]) <= VERIFICATION_GATE && Math.abs(a[0][2] - a[2][0]) <= VERIFICATION_GATE && Math.abs(a[1][2] - a[2][1]) <= VERIFICATION_GATE, "symmetric inertia");
  if (body.inverseMass === 0) {
    requireData(a.every((row) => row.every((value) => value === 0)), "static inverse inertia");
    return null;
  }
  const c0 = cross2(a[1], a[2]), c1 = cross2(a[2], a[0]), c2 = cross2(a[0], a[1]);
  const determinant = dot2(a[0], c0);
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
  vector(body.positionM, "body position");
  vector(body.velocityMps, "body velocity");
  vector(body.angularVelocityRadps, "body angular velocity");
  finite2(body.inverseMass, "inverse mass");
  requireData(body.inverseMass >= 0, "nonnegative inverse mass");
}
function pointVelocity(v, w, arm) {
  return sum(v, cross2(w, arm));
}
function kinetic(body, moment, v, w) {
  return body.inverseMass === 0 ? 0 : dot2(v, v) / (2 * body.inverseMass) + dot2(w, mv(moment, w)) / 2;
}
function verifyWithOptionalOracle(problem, candidate, oracle) {
  requireData(Array.isArray(problem.bodies) && problem.bodies.length >= 1 && problem.bodies.length <= 9, "1..9 bodies");
  requireData(Array.isArray(problem.points) && problem.points.length >= 1 && problem.points.length <= 32, "1..32 points");
  if (oracle !== void 0) {
    requireData(Array.isArray(oracle.bodies) && oracle.bodies.length === problem.bodies.length, "oracle body count");
    if (oracle.sourceReceiptSha256 !== void 0) requireData(/^[0-9a-f]{64}$/.test(oracle.sourceReceiptSha256), "oracle source hash");
  }
  const input = /* @__PURE__ */ new Map(), moments = /* @__PURE__ */ new Map();
  const impulses = /* @__PURE__ */ new Map(), torques = /* @__PURE__ */ new Map();
  for (const body of problem.bodies) {
    bodyData(body);
    requireData(!input.has(body.id), "unique body ids");
    input.set(body.id, body);
    moments.set(body.id, inertia(body));
    impulses.set(body.id, zero());
    torques.set(body.id, zero());
  }
  const pointIds = /* @__PURE__ */ new Set();
  for (const point of problem.points) {
    identity(point.id, "point id");
    requireData(!pointIds.has(point.id), "unique point ids");
    pointIds.add(point.id);
    requireData(input.has(point.aId) && input.has(point.bId) && point.aId !== point.bId, "directed point endpoints");
    vector(point.pointM, "point position");
    vector(point.normalAtoB, "point normal");
    requireData(Math.abs(Math.hypot(...point.normalAtoB) - 1) <= VERIFICATION_GATE, "unit normal");
  }
  const expected = /* @__PURE__ */ new Map();
  for (const body of oracle?.bodies ?? []) {
    identity(body.id, "oracle id");
    requireData(input.has(body.id) && !expected.has(body.id), "oracle identity");
    vector(body.velocityMps, "oracle velocity");
    vector(body.angularVelocityRadps, "oracle angular velocity");
    vector(body.netImpulseNs, "oracle net impulse");
    vector(body.netTorqueNms, "oracle net torque");
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
    inertia(body);
    returned.set(body.id, body);
    const original = input.get(body.id);
    if (componentError(body.positionM, original.positionM) !== 0 || body.inverseMass !== original.inverseMass || body.inverseInertiaWorld.some((row, i) => componentError(row, original.inverseInertiaWorld[i]) !== 0)) {
      report.violations.push(`candidate changed fixed model data: ${body.id}`);
    }
  }
  for (let i = 0; i < problem.points.length; i++) {
    const point = problem.points[i], lambda = candidate.normalImpulsesNs[i];
    finite2(lambda, "normal impulse");
    for (const [id, sign] of [[point.aId, -1], [point.bId, 1]]) {
      const impulse = times(point.normalAtoB, sign * lambda), arm = minus(point.pointM, input.get(id).positionM);
      impulses.set(id, sum(impulses.get(id), impulse));
      torques.set(id, sum(torques.get(id), cross2(arm, impulse)));
    }
  }
  const reconstructed = /* @__PURE__ */ new Map();
  for (const body of problem.bodies) {
    const netImpulseNs = impulses.get(body.id), netTorqueNms = torques.get(body.id);
    const velocityMps = sum(body.velocityMps, times(netImpulseNs, body.inverseMass));
    const angularVelocityRadps = sum(body.angularVelocityRadps, mv(body.inverseInertiaWorld, netTorqueNms));
    vector(velocityMps, "reconstructed finite velocity");
    vector(angularVelocityRadps, "reconstructed finite angular velocity");
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
    const point = problem.points[i], lambda = candidate.normalImpulsesNs[i];
    const a = input.get(point.aId), b = input.get(point.bId);
    const finalA = reconstructed.get(point.aId), finalB = reconstructed.get(point.bId);
    const armA = minus(point.pointM, a.positionM), armB = minus(point.pointM, b.positionM);
    const relative = minus(
      pointVelocity(finalB.velocityMps, finalB.angularVelocityRadps, armB),
      pointVelocity(finalA.velocityMps, finalA.angularVelocityRadps, armA)
    );
    const normalSpeedMps = dot2(point.normalAtoB, relative);
    const tangentSpeedMps = Math.hypot(...minus(relative, times(point.normalAtoB, normalSpeedMps)));
    const row = {
      id: point.id,
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
    if (lambda > 0) m2.loadedTangentSpeedMps = Math.max(m2.loadedTangentSpeedMps, tangentSpeedMps);
    const claimed = candidate.rowResiduals[i];
    requireData(claimed.id === point.id, "candidate residual row identity/order");
    for (const field of ["normalSpeedMps", "negativeNormalImpulseNs", "complementarityJ", "tangentSpeedMps"]) {
      finite2(claimed[field], "candidate residual");
      m2.reportedResidualError = Math.max(m2.reportedResidualError, Math.abs(row[field] - claimed[field]));
    }
    const freeRelative = minus(
      pointVelocity(b.velocityMps, b.angularVelocityRadps, armB),
      pointVelocity(a.velocityMps, a.angularVelocityRadps, armA)
    );
    report.energy.normalImpulseWorkJ += lambda * (dot2(point.normalAtoB, freeRelative) + normalSpeedMps) / 2;
  }
  const c = candidate.certificate, m = report.maxima;
  for (const [field, actual] of [
    ["maxClosingNormalSpeedMps", m.closingNormalSpeedMps],
    ["maxNegativeNormalImpulseNs", m.negativeNormalImpulseNs],
    ["maxComplementarityJ", m.complementarityJ],
    ["maxLoadedTangentSpeedMps", m.loadedTangentSpeedMps]
  ]) {
    finite2(c[field], "candidate certificate");
    m.reportedResidualError = Math.max(m.reportedResidualError, Math.abs(c[field] - actual));
  }
  finite2(c.maxStationaritySqrtJ, "candidate stationarity");
  requireData(typeof c.zeroTangentFeasible === "boolean", "candidate friction flag");
  m.impulseWorkErrorJ = Math.abs(report.energy.finalKineticJ - report.energy.freeKineticJ - report.energy.normalImpulseWorkJ);
  const gate = VERIFICATION_GATE;
  report.normalKktPassed = m.closingNormalSpeedMps <= gate && m.negativeNormalImpulseNs <= gate && m.complementarityJ <= gate;
  report.zeroTangentFrictionFeasible = report.normalKktPassed && m.loadedTangentSpeedMps <= gate;
  report.oracleMatched = oracle !== void 0 && m.oracleVelocityErrorMps <= gate && m.oracleAngularVelocityErrorRadps <= gate && m.oracleNetImpulseErrorNs <= gate && m.oracleNetTorqueErrorNms <= gate;
  report.candidateReportsMatched = m.reportedVelocityErrorMps <= gate && m.reportedAngularVelocityErrorRadps <= gate && m.reportedResidualError <= gate && c.maxStationaritySqrtJ >= 0 && c.maxStationaritySqrtJ <= gate && c.zeroTangentFeasible === m.loadedTangentSpeedMps <= gate;
  if (!report.normalKktPassed) report.violations.push("independent normal complementarity failed");
  if (!report.zeroTangentFrictionFeasible) report.violations.push("zero tangent impulse is not friction-qualified on loaded rows");
  if (oracle !== void 0 && !report.oracleMatched) report.violations.push("independent Fraction body/load oracle differs");
  if (!report.candidateReportsMatched) report.violations.push("candidate state or residual report differs from signed-impulse reconstruction");
  if (!(m.impulseWorkErrorJ <= gate)) report.violations.push("independent normal impulse work balance failed");
  report.passed = report.violations.length === 0;
  return report;
}
function verifyNormalSolution(problem, candidate, oracle) {
  requireData(oracle !== void 0 && oracle !== null, "oracle required");
  return verifyWithOptionalOracle(problem, candidate, oracle);
}

// examples/physics-stack-solver-2276/first-frame.ts
var [fixturePath, outputPath, countText] = process.argv.slice(2);
var count = Number(countText);
assert.ok(fixturePath && outputPath && (count === 1 || count === 2));
var bytes = readFileSync(fixturePath);
var fixture = JSON.parse(bytes.toString("utf8"));
assert.equal(fixture.problem.bodies.length, 9);
assert.equal(fixture.problem.points.length, 32);
var before = JSON.stringify(fixture.problem);
var results = [];
var passed = true;
for (let attempt = 0; attempt < count; attempt++) {
  const candidate = solveNormalContacts(fixture.problem);
  assert.equal(JSON.stringify(fixture.problem), before, "candidate mutated input");
  const verification = candidate.ok ? verifyNormalSolution(fixture.problem, candidate, fixture.oracle) : null;
  results.push({ candidate, verification });
  if (!candidate.ok || !verification?.passed) {
    passed = false;
    break;
  }
  assert.equal(candidate.stats.qrRank, 24, "measured first-patch numerical rank");
  assert.ok(candidate.stats.outerIterations <= 64 && candidate.stats.blockQrFactorizations <= 64);
  if (attempt > 0) assert.deepEqual(results[attempt], results[0], "same-runtime repeat differs");
}
var receipt = {
  status: passed ? "FIRST_PATCH_SOLVER_AND_INDEPENDENT_ORACLE_PASS" : "FIRST_PATCH_NO_GO",
  fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
  requestedSolves: count,
  actualSolves: results.length,
  inputRetained: true,
  results,
  baseline: fixture.baseline,
  publicActivation: "NO_GO",
  originalWorldRuns: 0
};
writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({
  status: receipt.status,
  actualSolves: results.length,
  stats: results[0]?.candidate.stats,
  verification: results[0]?.verification?.maxima
}) + "\n");
if (!passed) process.exitCode = 1;
