// examples/physics-stack-solver-2276/verification.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// examples/physics-stack-solver-2276/verification.ts
var VERIFICATION_GATE = 1e-10;
var zero = () => [0, 0, 0];
var sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
var minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var times = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
var componentError = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
function requireData(condition, label) {
  if (!condition) throw new RangeError(`Invalid verification data: ${label}`);
}
function finite(value, label) {
  requireData(typeof value === "number" && Number.isFinite(value), label);
}
function vector(value, label) {
  requireData(Array.isArray(value) && value.length === 3 && [0, 1, 2].every((i) => Object.hasOwn(value, i)), label);
  for (const component of value) finite(component, label);
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
  const c0 = cross(a[1], a[2]), c1 = cross(a[2], a[0]), c2 = cross(a[0], a[1]);
  const determinant = dot(a[0], c0);
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
  finite(body.inverseMass, "inverse mass");
  requireData(body.inverseMass >= 0, "nonnegative inverse mass");
}
function pointVelocity(v, w, arm) {
  return sum(v, cross(w, arm));
}
function kinetic(body, moment, v, w) {
  return body.inverseMass === 0 ? 0 : dot(v, v) / (2 * body.inverseMass) + dot(w, mv(moment, w)) / 2;
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
    finite(lambda, "normal impulse");
    for (const [id, sign] of [[point.aId, -1], [point.bId, 1]]) {
      const impulse = times(point.normalAtoB, sign * lambda), arm = minus(point.pointM, input.get(id).positionM);
      impulses.set(id, sum(impulses.get(id), impulse));
      torques.set(id, sum(torques.get(id), cross(arm, impulse)));
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
    const normalSpeedMps = dot(point.normalAtoB, relative);
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
      finite(claimed[field], "candidate residual");
      m2.reportedResidualError = Math.max(m2.reportedResidualError, Math.abs(row[field] - claimed[field]));
    }
    const freeRelative = minus(
      pointVelocity(b.velocityMps, b.angularVelocityRadps, armB),
      pointVelocity(a.velocityMps, a.angularVelocityRadps, armA)
    );
    report.energy.normalImpulseWorkJ += lambda * (dot(point.normalAtoB, freeRelative) + normalSpeedMps) / 2;
  }
  const c = candidate.certificate, m = report.maxima;
  for (const [field, actual] of [
    ["maxClosingNormalSpeedMps", m.closingNormalSpeedMps],
    ["maxNegativeNormalImpulseNs", m.negativeNormalImpulseNs],
    ["maxComplementarityJ", m.complementarityJ],
    ["maxLoadedTangentSpeedMps", m.loadedTangentSpeedMps]
  ]) {
    finite(c[field], "candidate certificate");
    m.reportedResidualError = Math.max(m.reportedResidualError, Math.abs(c[field] - actual));
  }
  finite(c.maxStationaritySqrtJ, "candidate stationarity");
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

// examples/physics-stack-solver-2276/verification.test.ts
function fixture() {
  const still = [0, 0, 0];
  const inverseMoment = [[24, 0, 0], [0, 24, 0], [0, 0, 24]];
  const problem = {
    bodies: [
      {
        id: "root",
        positionM: [0, -0.1, 0],
        velocityMps: still,
        angularVelocityRadps: still,
        inverseMass: 0,
        inverseInertiaWorld: [still, still, still]
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `body${i}`,
        positionM: [0, 0.25 + 0.5 * i, 0],
        velocityMps: [0, -0.08, 0],
        angularVelocityRadps: still,
        inverseMass: 1,
        inverseInertiaWorld: inverseMoment
      }))
    ],
    points: Array.from({ length: 8 }, (_, level) => [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], corner) => ({
      id: `contact${level}.${corner}`,
      aId: level === 0 ? "root" : `body${level - 1}`,
      bId: `body${level}`,
      pointM: [x / 4, level / 2, z / 4],
      normalAtoB: [0, 1, 0]
    }))).flat()
  };
  const oracle = { bodies: problem.bodies.map((body, i) => ({
    id: body.id,
    velocityMps: still,
    angularVelocityRadps: still,
    netImpulseNs: [0, i === 0 ? -8 * 0.08 : 0.08, 0],
    netTorqueNms: still
  })) };
  const candidate = {
    ok: true,
    status: "SOLVED_NORMAL_ONLY",
    bodies: problem.bodies.map((body) => ({ ...body, velocityMps: still, angularVelocityRadps: still })),
    normalImpulsesNs: Array.from({ length: 32 }, (_, row) => (8 - Math.floor(row / 4)) * 0.08 / 4),
    rowResiduals: problem.points.map((point) => ({
      id: point.id,
      normalSpeedMps: 0,
      negativeNormalImpulseNs: 0,
      complementarityJ: 0,
      tangentSpeedMps: 0
    })),
    certificate: {
      maxClosingNormalSpeedMps: 0,
      maxNegativeNormalImpulseNs: 0,
      maxComplementarityJ: 0,
      maxStationaritySqrtJ: 0,
      maxLoadedTangentSpeedMps: 0,
      zeroTangentFeasible: true
    }
  };
  return { problem, candidate, oracle };
}
test("independent 9-body/32-point witness matches zero states, exact loads and impulse work", () => {
  const { problem, candidate, oracle } = fixture();
  const before = structuredClone({ problem, candidate, oracle });
  const result = verifyNormalSolution(problem, candidate, oracle);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.bodies.length, 9);
  assert.equal(result.rows.length, 32);
  assert.ok(result.maxima.oracleVelocityErrorMps <= 1e-10);
  assert.ok(result.maxima.oracleAngularVelocityErrorRadps <= 1e-10);
  assert.ok(result.maxima.impulseWorkErrorJ <= 1e-10);
  assert.deepEqual({ problem, candidate, oracle }, before);
});
test("a distinct valid checkerboard impulse distribution passes without per-point lambda equality", () => {
  const { problem, candidate, oracle } = fixture();
  const original = [...candidate.normalImpulsesNs];
  candidate.normalImpulsesNs = original.map((value, i) => value + [1, -1, -1, 1][i % 4] / 1024);
  const result = verifyNormalSolution(problem, candidate, oracle);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.ok(candidate.normalImpulsesNs.every((value, i) => value !== original[i]));
});
test("bad impulse values cannot hide behind reported zero body state and residuals", () => {
  const { problem, candidate, oracle } = fixture();
  candidate.normalImpulsesNs = candidate.normalImpulsesNs.map((value, i) => i === 0 ? value + 0.01 : value);
  const result = verifyNormalSolution(problem, candidate, oracle);
  assert.equal(result.passed, false);
  assert.equal(result.oracleMatched, false);
  assert.equal(result.candidateReportsMatched, false);
});
test("forged linear and angular body outputs are independently detected", () => {
  for (const field of ["velocityMps", "angularVelocityRadps"]) {
    const { problem, candidate, oracle } = fixture();
    candidate.bodies = candidate.bodies.map((body, i) => i === 1 ? { ...body, [field]: [1e-3, 0, 0] } : body);
    const result = verifyNormalSolution(problem, candidate, oracle);
    assert.equal(result.passed, false);
    assert.equal(result.normalKktPassed, true);
    assert.equal(result.oracleMatched, true);
    assert.equal(result.candidateReportsMatched, false);
  }
});
test("negative normal impulse and incorrect row report are refused separately", () => {
  const negative = fixture();
  negative.candidate.normalImpulsesNs = negative.candidate.normalImpulsesNs.map((value, i) => i === 0 ? -0.1 : value);
  const first = verifyNormalSolution(negative.problem, negative.candidate, negative.oracle);
  assert.equal(first.normalKktPassed, false);
  assert.ok(first.maxima.negativeNormalImpulseNs >= 0.1);
  const report = fixture();
  report.candidate.rowResiduals = report.candidate.rowResiduals.map((row, i) => i === 0 ? { ...row, normalSpeedMps: 0.01 } : row);
  const second = verifyNormalSolution(report.problem, report.candidate, report.oracle);
  assert.equal(second.normalKktPassed, true);
  assert.equal(second.candidateReportsMatched, false);
});
test("normal complementarity alone cannot qualify zero tangent impulse under loaded slip", () => {
  const { problem, candidate, oracle } = fixture();
  const sliding = { ...problem, bodies: problem.bodies.map((body) => body.inverseMass === 0 ? body : { ...body, velocityMps: [0.1, -0.08, 0] }) };
  candidate.bodies = candidate.bodies.map((body) => body.inverseMass === 0 ? body : { ...body, velocityMps: [0.1, 0, 0] });
  candidate.rowResiduals = candidate.rowResiduals.map((row, i) => ({ ...row, tangentSpeedMps: i < 4 ? 0.1 : 0 }));
  candidate.certificate = { ...candidate.certificate, maxLoadedTangentSpeedMps: 0.1, zeroTangentFeasible: false };
  const slidingOracle = { bodies: oracle.bodies.map((body, i) => i === 0 ? body : { ...body, velocityMps: [0.1, 0, 0] }) };
  const result = verifyNormalSolution(sliding, candidate, slidingOracle);
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.oracleMatched, true);
  assert.equal(result.candidateReportsMatched, true);
  assert.equal(result.zeroTangentFrictionFeasible, false);
  assert.equal(result.passed, false);
});
test("independent torque checks detect wrong geometry or a reversed normal", () => {
  for (const alter of ["point", "normal"]) {
    const { problem, candidate, oracle } = fixture();
    const changed = { ...problem, points: problem.points.map((point, i) => i === 0 ? alter === "point" ? { ...point, pointM: [0, 0, -0.25] } : { ...point, normalAtoB: [0, -1, 0] } : point) };
    assert.equal(verifyNormalSolution(changed, candidate, oracle).passed, false);
  }
});
test("consistent body/row permutation and opaque ID renaming preserve verification", () => {
  const { problem, candidate, oracle } = fixture();
  const rename = (id) => `opaque:${[...id].reverse().join("")}`;
  const changed = {
    bodies: [...problem.bodies].reverse().map((body) => ({ ...body, id: rename(body.id) })),
    points: [...problem.points].reverse().map((point) => ({ ...point, id: rename(point.id), aId: rename(point.aId), bId: rename(point.bId) }))
  };
  const changedCandidate = {
    ...candidate,
    bodies: [...candidate.bodies].reverse().map((body) => ({ ...body, id: rename(body.id) })),
    normalImpulsesNs: [...candidate.normalImpulsesNs].reverse(),
    rowResiduals: [...candidate.rowResiduals].reverse().map((row) => ({ ...row, id: rename(row.id) }))
  };
  const changedOracle = { bodies: oracle.bodies.map((body) => ({ ...body, id: rename(body.id) })) };
  assert.equal(verifyNormalSolution(changed, changedCandidate, changedOracle).passed, true);
  assert.throws(() => verifyNormalSolution(changed, candidate, changedOracle), /Invalid verification data/);
});
test("changed fixed model data, failed solve and bad schema cannot yield a pass", () => {
  const changed = fixture();
  changed.candidate.bodies = changed.candidate.bodies.map((body, i) => i === 1 ? { ...body, positionM: [1, 1, 1] } : body);
  assert.equal(verifyNormalSolution(changed.problem, changed.candidate, changed.oracle).passed, false);
  const failed = fixture();
  failed.candidate.ok = false;
  failed.candidate.status = "ITERATION_LIMIT";
  failed.candidate.normalImpulsesNs = null;
  assert.equal(verifyNormalSolution(failed.problem, failed.candidate, failed.oracle).passed, false);
  const invalid = fixture();
  invalid.candidate.normalImpulsesNs = invalid.candidate.normalImpulsesNs.map((value, i) => i === 0 ? NaN : value);
  assert.throws(() => verifyNormalSolution(invalid.problem, invalid.candidate, invalid.oracle), /Invalid verification data/);
  assert.throws(() => verifyNormalSolution({ ...invalid.problem, points: [] }, invalid.candidate, invalid.oracle), /Invalid verification data/);
});
test("the parent oracle must cover exactly the same bodies with finite independent loads", () => {
  const { problem, candidate, oracle } = fixture();
  assert.throws(() => verifyNormalSolution(problem, candidate, { bodies: oracle.bodies.slice(1) }), /Invalid verification data/);
  const changed = { bodies: oracle.bodies.map((body, i) => i === 1 ? { ...body, netImpulseNs: [0, 0.09, 0] } : body) };
  const result = verifyNormalSolution(problem, candidate, changed);
  assert.equal(result.oracleMatched, false);
  assert.equal(result.normalKktPassed, true);
});
test("KKT-only verification explicitly omits unevaluated oracle qualification and zero error placeholders", () => {
  const { problem, candidate } = fixture();
  const result = verifyNormalKkt(problem, candidate);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.oracleQualification, "NOT_EVALUATED");
  assert.equal(Object.hasOwn(result, "oracleMatched"), false);
  assert.equal(Object.hasOwn(result, "sourceReceiptSha256"), false);
  for (const field of [
    "oracleVelocityErrorMps",
    "oracleAngularVelocityErrorRadps",
    "oracleNetImpulseErrorNs",
    "oracleNetTorqueErrorNms"
  ]) assert.equal(Object.hasOwn(result.maxima, field), false);
  assert.throws(() => verifyNormalSolution(problem, candidate, void 0), /oracle required/);
});
test("a valid separating state passes KKT checks without being compared to a fake equilibrium oracle", () => {
  const { problem, candidate, oracle } = fixture();
  const moving = { ...problem, bodies: problem.bodies.map((body) => body.inverseMass === 0 ? body : { ...body, velocityMps: [0, 0.25, 0] }) };
  candidate.bodies = moving.bodies.map((body) => ({ ...body }));
  candidate.normalImpulsesNs = problem.points.map(() => 0);
  candidate.rowResiduals = candidate.rowResiduals.map((row, i) => ({ ...row, normalSpeedMps: i < 4 ? 0.25 : 0 }));
  const result = verifyNormalKkt(moving, candidate);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.oracleQualification, "NOT_EVALUATED");
  assert.equal(result.bodies.find((body) => body.id === "body0").velocityMps[1], 0.25);
  assert.equal(verifyNormalSolution(moving, candidate, oracle).oracleMatched, false);
  candidate.bodies = candidate.bodies.map((body) => ({ ...body, velocityMps: [0, 0, 0] }));
  const forged = verifyNormalKkt(moving, candidate);
  assert.equal(forged.normalKktPassed, true);
  assert.equal(forged.candidateReportsMatched, false);
  assert.equal(forged.passed, false);
});
test("KKT-only verification keeps impulse, body, and residual consistency gates", () => {
  const badImpulse = fixture();
  badImpulse.candidate.normalImpulsesNs = badImpulse.candidate.normalImpulsesNs.map((value, i) => i === 0 ? value + 0.01 : value);
  assert.equal(verifyNormalKkt(badImpulse.problem, badImpulse.candidate).passed, false);
  const badReport = fixture();
  badReport.candidate.rowResiduals = badReport.candidate.rowResiduals.map((row, i) => i === 0 ? { ...row, normalSpeedMps: 0.01 } : row);
  const result = verifyNormalKkt(badReport.problem, badReport.candidate);
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.candidateReportsMatched, false);
  assert.equal(result.passed, false);
});
test("KKT-only normal success does not qualify loaded sliding friction", () => {
  const { problem, candidate } = fixture();
  const sliding = { ...problem, bodies: problem.bodies.map((body) => body.inverseMass === 0 ? body : { ...body, velocityMps: [0.1, -0.08, 0] }) };
  candidate.bodies = candidate.bodies.map((body) => body.inverseMass === 0 ? body : { ...body, velocityMps: [0.1, 0, 0] });
  candidate.rowResiduals = candidate.rowResiduals.map((row, i) => ({ ...row, tangentSpeedMps: i < 4 ? 0.1 : 0 }));
  candidate.certificate = { ...candidate.certificate, maxLoadedTangentSpeedMps: 0.1, zeroTangentFeasible: false };
  const result = verifyNormalKkt(sliding, candidate);
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.candidateReportsMatched, true);
  assert.equal(result.zeroTangentFrictionFeasible, false);
  assert.equal(result.passed, false);
  assert.equal(result.oracleQualification, "NOT_EVALUATED");
});
