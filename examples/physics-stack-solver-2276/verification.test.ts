import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyNormalKkt, verifyNormalSolution } from './verification.js';
import type { VerificationCandidate, VerificationMat3, VerificationOracle, VerificationProblem,
  VerificationVec3 } from './verification.js';

/** Synthetic closed-form witness. This does not call or import the candidate. */
function fixture() {
  const still: VerificationVec3 = [0, 0, 0];
  const inverseMoment: VerificationMat3 = [[24, 0, 0], [0, 24, 0], [0, 0, 24]];
  const problem: VerificationProblem = {
    bodies: [{ id: 'root', positionM: [0, -0.1, 0], velocityMps: still,
      angularVelocityRadps: still, inverseMass: 0, inverseInertiaWorld: [still, still, still] },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `body${i}`, positionM: [0, 0.25 + 0.5 * i, 0] as VerificationVec3,
      velocityMps: [0, -0.08, 0] as VerificationVec3, angularVelocityRadps: still,
      inverseMass: 1, inverseInertiaWorld: inverseMoment }))],
    points: Array.from({ length: 8 }, (_, level) =>
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], corner) => ({
        id: `contact${level}.${corner}`, aId: level === 0 ? 'root' : `body${level - 1}`,
        bId: `body${level}`, pointM: [x / 4, level / 2, z / 4] as VerificationVec3,
        normalAtoB: [0, 1, 0] as VerificationVec3 }))).flat(),
  };
  const oracle: VerificationOracle = { bodies: problem.bodies.map((body, i) => ({
    id: body.id, velocityMps: still, angularVelocityRadps: still,
    netImpulseNs: [0, i === 0 ? -8 * 0.08 : 0.08, 0] as VerificationVec3,
    netTorqueNms: still,
  })) };
  const candidate: VerificationCandidate = {
    ok: true, status: 'SOLVED_NORMAL_ONLY',
    bodies: problem.bodies.map(body => ({ ...body, velocityMps: still, angularVelocityRadps: still })),
    normalImpulsesNs: Array.from({ length: 32 }, (_, row) => (8 - Math.floor(row / 4)) * 0.08 / 4),
    rowResiduals: problem.points.map(point => ({ id: point.id, normalSpeedMps: 0,
      negativeNormalImpulseNs: 0, complementarityJ: 0, tangentSpeedMps: 0 })),
    certificate: { maxClosingNormalSpeedMps: 0, maxNegativeNormalImpulseNs: 0,
      maxComplementarityJ: 0, maxStationaritySqrtJ: 0, maxLoadedTangentSpeedMps: 0, zeroTangentFeasible: true },
  };
  return { problem, candidate, oracle };
}

test('independent 9-body/32-point witness matches zero states, exact loads and impulse work', () => {
  const { problem, candidate, oracle } = fixture();
  const before = structuredClone({ problem, candidate, oracle });
  const result = verifyNormalSolution(problem, candidate, oracle);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.bodies.length, 9); assert.equal(result.rows.length, 32);
  assert.ok(result.maxima.oracleVelocityErrorMps <= 1e-10);
  assert.ok(result.maxima.oracleAngularVelocityErrorRadps <= 1e-10);
  assert.ok(result.maxima.impulseWorkErrorJ <= 1e-10);
  assert.deepEqual({ problem, candidate, oracle }, before);
});

test('a distinct valid checkerboard impulse distribution passes without per-point lambda equality', () => {
  const { problem, candidate, oracle } = fixture();
  const original = [...candidate.normalImpulsesNs!];
  candidate.normalImpulsesNs = original.map((value, i) => value + [1, -1, -1, 1][i % 4] / 1024);
  const result = verifyNormalSolution(problem, candidate, oracle);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.ok(candidate.normalImpulsesNs.every((value, i) => value !== original[i]));
});

test('bad impulse values cannot hide behind reported zero body state and residuals', () => {
  const { problem, candidate, oracle } = fixture();
  candidate.normalImpulsesNs = candidate.normalImpulsesNs!.map((value, i) => i === 0 ? value + 0.01 : value);
  const result = verifyNormalSolution(problem, candidate, oracle);
  assert.equal(result.passed, false);
  assert.equal(result.oracleMatched, false);
  assert.equal(result.candidateReportsMatched, false);
});

test('forged linear and angular body outputs are independently detected', () => {
  for (const field of ['velocityMps', 'angularVelocityRadps'] as const) {
    const { problem, candidate, oracle } = fixture();
    candidate.bodies = candidate.bodies.map((body, i) => i === 1 ? { ...body, [field]: [0.001, 0, 0] as VerificationVec3 } : body);
    const result = verifyNormalSolution(problem, candidate, oracle);
    assert.equal(result.passed, false);
    assert.equal(result.normalKktPassed, true);
    assert.equal(result.oracleMatched, true);
    assert.equal(result.candidateReportsMatched, false);
  }
});

test('negative normal impulse and incorrect row report are refused separately', () => {
  const negative = fixture();
  negative.candidate.normalImpulsesNs = negative.candidate.normalImpulsesNs!.map((value, i) => i === 0 ? -0.1 : value);
  const first = verifyNormalSolution(negative.problem, negative.candidate, negative.oracle);
  assert.equal(first.normalKktPassed, false);
  assert.ok(first.maxima.negativeNormalImpulseNs >= 0.1);
  const report = fixture();
  report.candidate.rowResiduals = report.candidate.rowResiduals!.map((row, i) => i === 0 ? { ...row, normalSpeedMps: 0.01 } : row);
  const second = verifyNormalSolution(report.problem, report.candidate, report.oracle);
  assert.equal(second.normalKktPassed, true);
  assert.equal(second.candidateReportsMatched, false);
});

test('normal complementarity alone cannot qualify zero tangent impulse under loaded slip', () => {
  const { problem, candidate, oracle } = fixture();
  const sliding: VerificationProblem = { ...problem, bodies: problem.bodies.map(body => body.inverseMass === 0 ? body
    : { ...body, velocityMps: [0.1, -0.08, 0] as VerificationVec3 }) };
  candidate.bodies = candidate.bodies.map(body => body.inverseMass === 0 ? body : { ...body, velocityMps: [0.1, 0, 0] as VerificationVec3 });
  candidate.rowResiduals = candidate.rowResiduals!.map((row, i) => ({ ...row, tangentSpeedMps: i < 4 ? 0.1 : 0 }));
  candidate.certificate = { ...candidate.certificate!, maxLoadedTangentSpeedMps: 0.1, zeroTangentFeasible: false };
  const slidingOracle: VerificationOracle = { bodies: oracle.bodies.map((body, i) => i === 0 ? body
    : { ...body, velocityMps: [0.1, 0, 0] as VerificationVec3 }) };
  const result = verifyNormalSolution(sliding, candidate, slidingOracle);
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.oracleMatched, true);
  assert.equal(result.candidateReportsMatched, true);
  assert.equal(result.zeroTangentFrictionFeasible, false);
  assert.equal(result.passed, false);
});

test('independent torque checks detect wrong geometry or a reversed normal', () => {
  for (const alter of ['point', 'normal']) {
    const { problem, candidate, oracle } = fixture();
    const changed: VerificationProblem = { ...problem, points: problem.points.map((point, i) => i === 0
      ? alter === 'point' ? { ...point, pointM: [0, 0, -0.25] as VerificationVec3 }
        : { ...point, normalAtoB: [0, -1, 0] as VerificationVec3 } : point) };
    assert.equal(verifyNormalSolution(changed, candidate, oracle).passed, false);
  }
});

test('consistent body/row permutation and opaque ID renaming preserve verification', () => {
  const { problem, candidate, oracle } = fixture();
  const rename = (id: string) => `opaque:${[...id].reverse().join('')}`;
  const changed: VerificationProblem = {
    bodies: [...problem.bodies].reverse().map(body => ({ ...body, id: rename(body.id) })),
    points: [...problem.points].reverse().map(point => ({ ...point, id: rename(point.id), aId: rename(point.aId), bId: rename(point.bId) })),
  };
  const changedCandidate: VerificationCandidate = { ...candidate,
    bodies: [...candidate.bodies].reverse().map(body => ({ ...body, id: rename(body.id) })),
    normalImpulsesNs: [...candidate.normalImpulsesNs!].reverse(),
    rowResiduals: [...candidate.rowResiduals!].reverse().map(row => ({ ...row, id: rename(row.id) })),
  };
  const changedOracle: VerificationOracle = { bodies: oracle.bodies.map(body => ({ ...body, id: rename(body.id) })) };
  assert.equal(verifyNormalSolution(changed, changedCandidate, changedOracle).passed, true);
  assert.throws(() => verifyNormalSolution(changed, candidate, changedOracle), /Invalid verification data/);
});

test('changed fixed model data, failed solve and bad schema cannot yield a pass', () => {
  const changed = fixture();
  changed.candidate.bodies = changed.candidate.bodies.map((body, i) => i === 1 ? { ...body, positionM: [1, 1, 1] as VerificationVec3 } : body);
  assert.equal(verifyNormalSolution(changed.problem, changed.candidate, changed.oracle).passed, false);
  const failed = fixture();
  failed.candidate.ok = false; failed.candidate.status = 'ITERATION_LIMIT';
  failed.candidate.normalImpulsesNs = null;
  assert.equal(verifyNormalSolution(failed.problem, failed.candidate, failed.oracle).passed, false);
  const invalid = fixture();
  invalid.candidate.normalImpulsesNs = invalid.candidate.normalImpulsesNs!.map((value, i) => i === 0 ? NaN : value);
  assert.throws(() => verifyNormalSolution(invalid.problem, invalid.candidate, invalid.oracle), /Invalid verification data/);
  assert.throws(() => verifyNormalSolution({ ...invalid.problem, points: [] }, invalid.candidate, invalid.oracle), /Invalid verification data/);
});

test('the parent oracle must cover exactly the same bodies with finite independent loads', () => {
  const { problem, candidate, oracle } = fixture();
  assert.throws(() => verifyNormalSolution(problem, candidate, { bodies: oracle.bodies.slice(1) }), /Invalid verification data/);
  const changed: VerificationOracle = { bodies: oracle.bodies.map((body, i) => i === 1
    ? { ...body, netImpulseNs: [0, 0.09, 0] as VerificationVec3 } : body) };
  const result = verifyNormalSolution(problem, candidate, changed);
  assert.equal(result.oracleMatched, false);
  assert.equal(result.normalKktPassed, true);
});

test('KKT-only verification explicitly omits unevaluated oracle qualification and zero error placeholders', () => {
  const { problem, candidate } = fixture();
  const result = verifyNormalKkt(problem, candidate);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.oracleQualification, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(result, 'oracleMatched'), false);
  assert.equal(Object.hasOwn(result, 'sourceReceiptSha256'), false);
  for (const field of ['oracleVelocityErrorMps', 'oracleAngularVelocityErrorRadps',
    'oracleNetImpulseErrorNs', 'oracleNetTorqueErrorNms']) assert.equal(Object.hasOwn(result.maxima, field), false);
  assert.throws(() => verifyNormalSolution(problem, candidate, undefined as unknown as VerificationOracle), /oracle required/);
});

test('a valid separating state passes KKT checks without being compared to a fake equilibrium oracle', () => {
  const { problem, candidate, oracle } = fixture();
  const moving: VerificationProblem = { ...problem, bodies: problem.bodies.map(body => body.inverseMass === 0 ? body
    : { ...body, velocityMps: [0, 0.25, 0] as VerificationVec3 }) };
  candidate.bodies = moving.bodies.map(body => ({ ...body }));
  candidate.normalImpulsesNs = problem.points.map(() => 0);
  candidate.rowResiduals = candidate.rowResiduals!.map((row, i) => ({ ...row, normalSpeedMps: i < 4 ? 0.25 : 0 }));
  const result = verifyNormalKkt(moving, candidate);
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.oracleQualification, 'NOT_EVALUATED');
  assert.equal(result.bodies.find(body => body.id === 'body0')!.velocityMps[1], 0.25);
  assert.equal(verifyNormalSolution(moving, candidate, oracle).oracleMatched, false);
  candidate.bodies = candidate.bodies.map(body => ({ ...body, velocityMps: [0, 0, 0] as VerificationVec3 }));
  const forged = verifyNormalKkt(moving, candidate);
  assert.equal(forged.normalKktPassed, true);
  assert.equal(forged.candidateReportsMatched, false);
  assert.equal(forged.passed, false);
});

test('KKT-only verification keeps impulse, body, and residual consistency gates', () => {
  const badImpulse = fixture();
  badImpulse.candidate.normalImpulsesNs = badImpulse.candidate.normalImpulsesNs!.map((value, i) => i === 0 ? value + 0.01 : value);
  assert.equal(verifyNormalKkt(badImpulse.problem, badImpulse.candidate).passed, false);
  const badReport = fixture();
  badReport.candidate.rowResiduals = badReport.candidate.rowResiduals!.map((row, i) => i === 0 ? { ...row, normalSpeedMps: 0.01 } : row);
  const result = verifyNormalKkt(badReport.problem, badReport.candidate);
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.candidateReportsMatched, false);
  assert.equal(result.passed, false);
});

test('KKT-only normal success does not qualify loaded sliding friction', () => {
  const { problem, candidate } = fixture();
  const sliding: VerificationProblem = { ...problem, bodies: problem.bodies.map(body => body.inverseMass === 0 ? body
    : { ...body, velocityMps: [0.1, -0.08, 0] as VerificationVec3 }) };
  candidate.bodies = candidate.bodies.map(body => body.inverseMass === 0 ? body
    : { ...body, velocityMps: [0.1, 0, 0] as VerificationVec3 });
  candidate.rowResiduals = candidate.rowResiduals!.map((row, i) => ({ ...row, tangentSpeedMps: i < 4 ? 0.1 : 0 }));
  candidate.certificate = { ...candidate.certificate!, maxLoadedTangentSpeedMps: 0.1, zeroTangentFeasible: false };
  const result = verifyNormalKkt(sliding, candidate);
  assert.equal(result.normalKktPassed, true);
  assert.equal(result.candidateReportsMatched, true);
  assert.equal(result.zeroTangentFrictionFeasible, false);
  assert.equal(result.passed, false);
  assert.equal(result.oracleQualification, 'NOT_EVALUATED');
});
