// examples/physics-stack-solver-2276/candidate.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// examples/physics-stack-solver-2276/evidence/first-emitted-03/modules/candidate.js
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
function copyBody(body2) {
  return {
    id: body2.id,
    positionM: [...body2.positionM],
    velocityMps: [...body2.velocityMps],
    angularVelocityRadps: [...body2.angularVelocityRadps],
    inverseMass: body2.inverseMass,
    inverseInertiaWorld: body2.inverseInertiaWorld.map((row) => [...row])
  };
}
function read(value) {
  need(value && Array.isArray(value.bodies) && value.bodies.length >= 1 && value.bodies.length <= 9 && Array.isArray(value.points) && value.points.length <= 32, "body/point bound");
  const ids = /* @__PURE__ */ new Set();
  let dynamic = 0;
  for (const body2 of value.bodies) {
    need(body2 && typeof body2.id === "string" && body2.id.length > 0 && body2.id.length <= 1024 && !ids.has(body2.id), "body id");
    ids.add(body2.id);
    need(validVector(body2.positionM, 1e4) && validVector(body2.velocityMps, 1e3) && validVector(body2.angularVelocityRadps, 1e3), "body vectors");
    need(typeof body2.inverseMass === "number" && Number.isFinite(body2.inverseMass) && (body2.inverseMass === 0 || body2.inverseMass >= 1e-6 && body2.inverseMass <= 1e6), "inverse mass");
    need(Array.isArray(body2.inverseInertiaWorld) && body2.inverseInertiaWorld.length === 3 && body2.inverseInertiaWorld.every((row) => validVector(row, 1e6)), "inverse inertia");
    if (body2.inverseMass === 0) {
      need([...body2.velocityMps, ...body2.angularVelocityRadps, ...body2.inverseInertiaWorld.flat()].every((x) => x === 0), "static input must have zero motion and inertia");
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
  for (const body2 of input.bodies) {
    if (body2.inverseMass === 0) {
      blocks.push({ offset: null, rootMass: 0, angular: [] });
      continue;
    }
    const angular = cholesky(body2.inverseInertiaWorld, s), rootMass = Math.sqrt(body2.inverseMass), offset = free.length;
    for (const value of body2.velocityMps)
      free.push(finite(value / rootMass));
    const local = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let value = body2.angularVelocityRadps[i];
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
  const ids = new Map(input.bodies.map((body2, i) => [body2.id, i]));
  const a = input.points.map((point2) => {
    const row = Array(free.length).fill(0);
    let dynamicEndpoint = false;
    for (const [id, sign] of [[point2.aId, -1], [point2.bId, 1]]) {
      const index = ids.get(id), body2 = input.bodies[index], block = blocks[index];
      const arm = subtract(point2.pointM, body2.positionM);
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
  return m.input.bodies.map((body2, index) => {
    const result = copyBody(body2), block = m.blocks[index];
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
  const bodies = outputBodies(m, x, s), ids = new Map(bodies.map((body2, i) => [body2.id, i]));
  const rowResiduals = m.input.points.map((point2, i) => {
    take(s, "constraintTests");
    const velocities = [point2.aId, point2.bId].map((id) => {
      const body2 = bodies[ids.get(id)], spin = cross(body2.angularVelocityRadps, subtract(point2.pointM, body2.positionM));
      return body2.velocityMps.map((v, k) => finite(v + spin[k]));
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
function solveNormalContacts(problem2) {
  const s = stats();
  let input = null;
  try {
    input = read(problem2);
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
      const solved2 = equality(m, qr, s), direction = solved2.target.map((value, i) => finite(value - current[i]));
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
      current = solved2.target;
      let leaving = null;
      for (let i = 0; i < active.length; i++)
        if (solved2.lambda[i] < -1e-10 && (leaving === null || active[i] < active[leaving]))
          leaving = i;
      if (leaving !== null) {
        take(s, "activeChanges");
        active.splice(leaving, 1);
        continue;
      }
      return finish(m, current, active, solved2.lambda, s);
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

// examples/physics-stack-solver-2276/candidate.test.ts
function body(id, velocityMps = [0, -1, 0], inverseMass = 1) {
  return {
    id,
    positionM: [0, 0, 0],
    velocityMps,
    angularVelocityRadps: [0, 0, 0],
    inverseMass,
    inverseInertiaWorld: inverseMass === 0 ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  };
}
function point(id = "contact", normalAtoB = [0, -1, 0]) {
  return { id, aId: "moving", bId: "fixed", pointM: [0, 0, 0], normalAtoB };
}
function problem(velocity = [0, -1, 0], points = [point()]) {
  return { bodies: [body("moving", velocity), body("fixed", [0, 0, 0], 0)], points };
}
function solved(result) {
  assert.equal(result.status, "SOLVED_NORMAL_ONLY", result.reason ?? "missing result");
  assert.equal(result.ok, true);
  assert.ok(result.certificate);
  assert.ok(result.certificate.maxClosingNormalSpeedMps <= 1e-10);
  assert.ok(result.certificate.maxComplementarityJ <= 1e-10);
  assert.ok(result.certificate.maxStationaritySqrtJ <= 1e-10);
  for (const key of Object.keys(NORMAL_CANDIDATE_BUDGET)) {
    assert.ok(result.stats[key] <= NORMAL_CANDIDATE_BUDGET[key], key);
  }
  assert.equal(result.stats.outerIterations, result.stats.blockQrFactorizations);
}
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= 1e-10, `${actual} versus ${expected}`);
}
test("one normal constraint cancels a closing translational velocity", () => {
  const result = solveNormalContacts(problem());
  solved(result);
  near(result.bodies[0].velocityMps[1], 0);
  near(result.normalImpulsesNs[0], 1);
  assert.equal(result.stats.blockQrFactorizations, 1);
});
test("separating inactive contact keeps its free velocity and zero impulse", () => {
  const result = solveNormalContacts(problem([0, 1, 0]));
  solved(result);
  near(result.bodies[0].velocityMps[1], 1);
  near(result.normalImpulsesNs[0], 0);
  assert.ok(result.stats.activeChanges >= 1);
});
test("duplicate rows retain every row while using an independent basis", () => {
  const result = solveNormalContacts(problem([0, -1, 0], [point("a"), point("b"), point("c")]));
  solved(result);
  assert.equal(result.stats.qrRank, 1);
  assert.equal(result.rowResiduals.length, 3);
  near(result.normalImpulsesNs.reduce((a, b) => a + b, 0), 1);
});
test("opposed homogeneous constraints are feasible with a rank-deficient row set", () => {
  const result = solveNormalContacts(problem([0, 1, 0], [point("down"), point("up", [0, 1, 0])]));
  solved(result);
  near(result.bodies[0].velocityMps[1], 0);
  assert.equal(result.stats.qrRank, 1);
});
test("off-centre contact changes both translation and rotation by its impulse", () => {
  const p = point();
  p.pointM = [1, 0, 0];
  const result = solveNormalContacts(problem([0, -1, 0], [p]));
  solved(result);
  near(result.normalImpulsesNs[0], 0.5);
  near(result.bodies[0].velocityMps[1], -0.5);
  near(result.bodies[0].angularVelocityRadps[2], 0.5);
});
test("unequal masses split a dynamic pair reaction without a static root", () => {
  const a = body("a", [0, -1, 0], 1), b = body("b", [0, 0, 0], 0.5);
  const input = { bodies: [a, b], points: [{ id: "ab", aId: "a", bId: "b", pointM: [0, 0, 0], normalAtoB: [0, -1, 0] }] };
  const result = solveNormalContacts(input);
  solved(result);
  near(result.normalImpulsesNs[0], 2 / 3);
  near(result.bodies[0].velocityMps[1], -1 / 3);
  near(result.bodies[1].velocityMps[1], -1 / 3);
});
test("normal solve records loaded tangential slip without claiming a friction solve", () => {
  const result = solveNormalContacts(problem([1, -1, 0]));
  solved(result);
  near(result.bodies[0].velocityMps[0], 1);
  near(result.rowResiduals[0].tangentSpeedMps, 1);
  assert.equal(result.certificate.zeroTangentFeasible, false);
});
test("zero-point problem returns free body motion without a contact oracle", () => {
  const result = solveNormalContacts(problem([1, 2, 3], []));
  solved(result);
  result.bodies[0].velocityMps.forEach((value, i) => near(value, [1, 2, 3][i]));
  assert.deepEqual(result.normalImpulsesNs, []);
  assert.equal(result.stats.qrRank, 0);
});
test("non-diagonal world inverse inertia uses its full physical tensor", () => {
  const input = problem();
  input.bodies[0].inverseInertiaWorld = [[2, 0.5, 0], [0.5, 1, 0], [0, 0, 3]];
  input.points[0].pointM = [0, 0, 1];
  const result = solveNormalContacts(input);
  solved(result);
  near(result.normalImpulsesNs[0], 1 / 3);
  near(result.bodies[0].angularVelocityRadps[0], -2 / 3);
  near(result.bodies[0].angularVelocityRadps[1], -1 / 6);
});
test("nonzero static input motion refuses without returning a solved impulse", () => {
  const input = problem();
  input.bodies[1].velocityMps = [0, 1, 0];
  const result = solveNormalContacts(input);
  assert.equal(result.status, "NUMERIC");
  assert.equal(result.ok, false);
  assert.equal(result.normalImpulsesNs, null);
  assert.equal(result.certificate, null);
});
test("singular inertia refusal retains copied admitted input motion", () => {
  const input = problem();
  input.bodies[0].inverseInertiaWorld = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];
  const result = solveNormalContacts(input);
  assert.equal(result.status, "NUMERIC");
  assert.deepEqual(result.bodies, input.bodies);
  assert.notEqual(result.bodies[0].velocityMps, input.bodies[0].velocityMps);
  assert.equal(result.rowResiduals, null);
});
test("returned copies cannot mutate input or a later solve", () => {
  const input = problem(), preserved = structuredClone(input);
  const result = solveNormalContacts(input);
  solved(result);
  result.bodies[0].positionM[0] = 99;
  result.bodies[0].inverseInertiaWorld[0][0] = 99;
  assert.deepEqual(input, preserved);
  const next = solveNormalContacts(input);
  solved(next);
  assert.equal(next.bodies[0].positionM[0], 0);
  assert.equal(next.bodies[0].inverseInertiaWorld[0][0], 1);
});
test("opaque identifier renaming cannot select a different mathematical path", () => {
  const original = problem(), renamed = structuredClone(original);
  renamed.bodies[0].id = "unrelated-17";
  renamed.bodies[1].id = "another";
  renamed.points[0].id = "opaque";
  renamed.points[0].aId = "unrelated-17";
  renamed.points[0].bId = "another";
  const a = solveNormalContacts(original), b = solveNormalContacts(renamed);
  solved(a);
  solved(b);
  assert.deepEqual(a.normalImpulsesNs, b.normalImpulsesNs);
  assert.deepEqual(a.bodies.map((x) => x.velocityMps), b.bodies.map((x) => x.velocityMps));
  assert.deepEqual(a.stats, b.stats);
});
