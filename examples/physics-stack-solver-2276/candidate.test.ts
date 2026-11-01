import assert from 'node:assert/strict';
import test from 'node:test';
import { solveNormalContacts, NORMAL_CANDIDATE_BUDGET } from './candidate.js';
import type { NormalBody, NormalPoint, NormalProblem, NormalSolverResult, Vec3 } from './candidate.js';

function body(id: string, velocityMps: Vec3 = [0, -1, 0], inverseMass = 1): NormalBody {
  return { id, positionM: [0, 0, 0], velocityMps, angularVelocityRadps: [0, 0, 0], inverseMass,
    inverseInertiaWorld: inverseMass === 0 ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
}
function point(id = 'contact', normalAtoB: Vec3 = [0, -1, 0]): NormalPoint {
  return { id, aId: 'moving', bId: 'fixed', pointM: [0, 0, 0], normalAtoB };
}
function problem(velocity: Vec3 = [0, -1, 0], points: NormalPoint[] = [point()]): NormalProblem {
  return { bodies: [body('moving', velocity), body('fixed', [0, 0, 0], 0)], points };
}
function solved(result: NormalSolverResult): void {
  assert.equal(result.status, 'SOLVED_NORMAL_ONLY', result.reason ?? 'missing result');
  assert.equal(result.ok, true);
  assert.ok(result.certificate);
  assert.ok(result.certificate.maxClosingNormalSpeedMps <= 1e-10);
  assert.ok(result.certificate.maxComplementarityJ <= 1e-10);
  assert.ok(result.certificate.maxStationaritySqrtJ <= 1e-10);
  for (const key of Object.keys(NORMAL_CANDIDATE_BUDGET) as (keyof typeof NORMAL_CANDIDATE_BUDGET)[]) {
    assert.ok(result.stats[key] <= NORMAL_CANDIDATE_BUDGET[key], key);
  }
  assert.equal(result.stats.outerIterations, result.stats.blockQrFactorizations);
}
function near(actual: number, expected: number): void { assert.ok(Math.abs(actual-expected) <= 1e-10, `${actual} versus ${expected}`); }

test('one normal constraint cancels a closing translational velocity', () => {
  const result = solveNormalContacts(problem()); solved(result);
  near(result.bodies[0].velocityMps[1], 0);
  near(result.normalImpulsesNs![0], 1);
  assert.equal(result.stats.blockQrFactorizations, 1);
});

test('separating inactive contact keeps its free velocity and zero impulse', () => {
  const result = solveNormalContacts(problem([0, 1, 0])); solved(result);
  near(result.bodies[0].velocityMps[1], 1);
  near(result.normalImpulsesNs![0], 0);
  assert.ok(result.stats.activeChanges >= 1);
});

test('duplicate rows retain every row while using an independent basis', () => {
  const result = solveNormalContacts(problem([0, -1, 0], [point('a'), point('b'), point('c')])); solved(result);
  assert.equal(result.stats.qrRank, 1);
  assert.equal(result.rowResiduals!.length, 3);
  near(result.normalImpulsesNs!.reduce((a, b) => a+b, 0), 1);
});

test('opposed homogeneous constraints are feasible with a rank-deficient row set', () => {
  const result = solveNormalContacts(problem([0, 1, 0], [point('down'), point('up', [0, 1, 0])])); solved(result);
  near(result.bodies[0].velocityMps[1], 0);
  assert.equal(result.stats.qrRank, 1);
});

test('off-centre contact changes both translation and rotation by its impulse', () => {
  const p = point(); p.pointM = [1, 0, 0];
  const result = solveNormalContacts(problem([0, -1, 0], [p])); solved(result);
  near(result.normalImpulsesNs![0], .5);
  near(result.bodies[0].velocityMps[1], -.5);
  near(result.bodies[0].angularVelocityRadps[2], .5);
});

test('unequal masses split a dynamic pair reaction without a static root', () => {
  const a = body('a', [0, -1, 0], 1), b = body('b', [0, 0, 0], .5);
  const input: NormalProblem = { bodies: [a, b], points: [{ id: 'ab', aId: 'a', bId: 'b', pointM: [0, 0, 0], normalAtoB: [0, -1, 0] }] };
  const result = solveNormalContacts(input); solved(result);
  near(result.normalImpulsesNs![0], 2/3);
  near(result.bodies[0].velocityMps[1], -1/3);
  near(result.bodies[1].velocityMps[1], -1/3);
});

test('normal solve records loaded tangential slip without claiming a friction solve', () => {
  const result = solveNormalContacts(problem([1, -1, 0])); solved(result);
  near(result.bodies[0].velocityMps[0], 1);
  near(result.rowResiduals![0].tangentSpeedMps, 1);
  assert.equal(result.certificate!.zeroTangentFeasible, false);
});

test('zero-point problem returns free body motion without a contact oracle', () => {
  const result = solveNormalContacts(problem([1, 2, 3], [])); solved(result);
  result.bodies[0].velocityMps.forEach((value, i) => near(value, [1, 2, 3][i]));
  assert.deepEqual(result.normalImpulsesNs, []);
  assert.equal(result.stats.qrRank, 0);
});

test('non-diagonal world inverse inertia uses its full physical tensor', () => {
  const input = problem();
  input.bodies[0].inverseInertiaWorld = [[2, .5, 0], [.5, 1, 0], [0, 0, 3]];
  input.points[0].pointM = [0, 0, 1];
  const result = solveNormalContacts(input); solved(result);
  near(result.normalImpulsesNs![0], 1/3);
  near(result.bodies[0].angularVelocityRadps[0], -2/3);
  near(result.bodies[0].angularVelocityRadps[1], -1/6);
});

test('nonzero static input motion refuses without returning a solved impulse', () => {
  const input = problem(); input.bodies[1].velocityMps = [0, 1, 0];
  const result = solveNormalContacts(input);
  assert.equal(result.status, 'NUMERIC'); assert.equal(result.ok, false);
  assert.equal(result.normalImpulsesNs, null); assert.equal(result.certificate, null);
});

test('singular inertia refusal retains copied admitted input motion', () => {
  const input = problem(); input.bodies[0].inverseInertiaWorld = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];
  const result = solveNormalContacts(input);
  assert.equal(result.status, 'NUMERIC');
  assert.deepEqual(result.bodies, input.bodies);
  assert.notEqual(result.bodies[0].velocityMps, input.bodies[0].velocityMps);
  assert.equal(result.rowResiduals, null);
});

test('returned copies cannot mutate input or a later solve', () => {
  const input = problem(), preserved = structuredClone(input);
  const result = solveNormalContacts(input); solved(result);
  (result.bodies[0].positionM as unknown as number[])[0] = 99;
  (result.bodies[0].inverseInertiaWorld[0] as unknown as number[])[0] = 99;
  assert.deepEqual(input, preserved);
  const next = solveNormalContacts(input); solved(next);
  assert.equal(next.bodies[0].positionM[0], 0);
  assert.equal(next.bodies[0].inverseInertiaWorld[0][0], 1);
});

test('opaque identifier renaming cannot select a different mathematical path', () => {
  const original = problem(), renamed = structuredClone(original);
  renamed.bodies[0].id = 'unrelated-17'; renamed.bodies[1].id = 'another';
  renamed.points[0].id = 'opaque'; renamed.points[0].aId = 'unrelated-17'; renamed.points[0].bId = 'another';
  const a = solveNormalContacts(original), b = solveNormalContacts(renamed); solved(a); solved(b);
  assert.deepEqual(a.normalImpulsesNs, b.normalImpulsesNs);
  assert.deepEqual(a.bodies.map(x => x.velocityMps), b.bodies.map(x => x.velocityMps));
  assert.deepEqual(a.stats, b.stats);
});
