import type { Body, Vec3 } from '../internal-types.js';
import { PhysicsError } from '../internal-types.js';
import type { Mat3, NormalBody, NormalProblem, NormalSolverResult } from './normal-solver.js';
import { solveStationaryNormal } from './stationary-normal.js';
import type { StationaryResult, StationaryStats } from './stationary-normal.js';
import type { PointLedger } from './world-types.js';

export type StackNormalResult = Omit<NormalSolverResult, 'stats'> & {
  solver: 'EXACT_STATIONARY_FLOAT_J_V1'; stats: StationaryStats;
};

export interface FrozenStackPatch {
  aIndex: number; bIndex: number; aId: string; bId: string; pairKey: string;
  family: 'face' | 'edge'; normal: Vec3;
  points: readonly { id: string; pointM: Vec3; witnessAM: Vec3; witnessBM: Vec3;
    normalGapM: number; pointPenetrationM: number }[];
}

export class NormalPhaseFailure extends PhysicsError {
  readonly problem: NormalProblem;
  readonly result: StackNormalResult | null;
  readonly stationaryWitness: StationaryResult | null;
  constructor(reason: PhysicsError, problem: NormalProblem, result: StackNormalResult | null,
    stationaryWitness: StationaryResult | null) {
    super(reason.code, reason.message);
    this.problem = structuredClone(problem);
    this.result = structuredClone(result);
    this.stationaryWitness = structuredClone(stationaryWitness);
  }
}

/** Rounded diagnostics are separate from the exact APPLIED-ratio certificate. */
export function diagnoseStationaryNormal(problem: NormalProblem, witness: StationaryResult): StackNormalResult {
  requireNormal(witness.ok && witness.status === 'SOLVED_STATIONARY_WITNESS' &&
    witness.exactApplied && witness.normalImpulsesNs && witness.roundedReconstruction,
    'exact stationary witness required');
  requireNormal(witness.bodies.length === problem.bodies.length &&
    witness.normalImpulsesNs.length === problem.points.length, 'stationary result population');
  requireNormal(witness.roundedReconstruction.maxVelocityErrorMps <= 1e-10 &&
    witness.roundedReconstruction.maxAngularVelocityErrorRadps <= 1e-10,
    'rounded impulse reconstruction exceeds1e-10');
  const ids = new Map(problem.bodies.map((body, i) => [body.id, i]));
  const reaction = problem.bodies.map(() => [0, 0, 0, 0, 0, 0]);
  const root = Math.sqrt(24);
  for (let i = 0; i < problem.points.length; i++) {
    const point = problem.points[i], lambda = witness.normalImpulsesNs[i];
    requireNormal(Number.isFinite(lambda) && lambda >= 0, 'rounded nonnegative impulse');
    for (const [id, sign] of [[point.aId, -1], [point.bId, 1]] as const) {
      const index = ids.get(id);
      requireNormal(index !== undefined, 'stationary endpoint');
      const body = problem.bodies[index];
      if (body.inverseMass === 0) continue;
      const arm = point.pointM.map((value, k) => value - body.positionM[k]);
      const n = point.normalAtoB;
      const torque = [arm[1] * n[2] - arm[2] * n[1], arm[2] * n[0] - arm[0] * n[2],
        arm[0] * n[1] - arm[1] * n[0]];
      for (let k = 0; k < 3; k++) {
        reaction[index][k] += sign * n[k] * lambda;
        let coefficient = 0;
        for (let j = 0; j < 3; j++) coefficient += torque[j] * (j === k ? root : 0);
        reaction[index][k + 3] += sign * coefficient * lambda;
      }
    }
  }
  let stationarity = 0;
  for (const [i, body] of problem.bodies.entries()) if (body.inverseMass !== 0) {
    for (let k = 0; k < 6; k++) {
      stationarity = Math.max(stationarity, Math.abs(-(k < 3 ? body.velocityMps[k] : 0) - reaction[i][k]));
    }
  }
  requireNormal(Number.isFinite(stationarity) && stationarity <= 1e-10,
    'rounded scaled stationarity exceeds1e-10');
  const bodies = witness.bodies.map(body => structuredClone(body));
  const byId = new Map(bodies.map(body => [body.id, body]));
  const rowResiduals = problem.points.map((point, i) => {
    const a = byId.get(point.aId), b = byId.get(point.bId);
    requireNormal(a && b, 'stationary result endpoints');
    const va = pointVelocity(a, point.pointM), vb = pointVelocity(b, point.pointM);
    const relative = vb.map((value, k) => value - va[k]);
    const vn = relative.reduce((sum, value, k) => sum + value * point.normalAtoB[k], 0);
    const tangent = relative.map((value, k) => value - vn * point.normalAtoB[k]);
    return { id: point.id, normalSpeedMps: vn,
      negativeNormalImpulseNs: Math.max(0, -witness.normalImpulsesNs![i]),
      complementarityJ: Math.abs(witness.normalImpulsesNs![i] * vn), tangentSpeedMps: Math.hypot(...tangent) };
  });
  const certificate = {
    maxClosingNormalSpeedMps: Math.max(0, ...rowResiduals.map(row => -row.normalSpeedMps)),
    maxNegativeNormalImpulseNs: Math.max(0, ...rowResiduals.map(row => row.negativeNormalImpulseNs)),
    maxComplementarityJ: Math.max(0, ...rowResiduals.map(row => row.complementarityJ)),
    maxStationaritySqrtJ: stationarity,
    maxLoadedTangentSpeedMps: Math.max(0, ...rowResiduals.filter((_, i) => witness.normalImpulsesNs![i] > 0)
      .map(row => row.tangentSpeedMps)), zeroTangentFeasible: false,
  };
  certificate.zeroTangentFeasible = certificate.maxLoadedTangentSpeedMps <= 1e-10;
  requireNormal(Object.values(certificate).every(value => typeof value !== 'number' ||
    Number.isFinite(value) && value <= 1e-10), 'finite rounded normal certificate');
  return { ok: true, status: 'SOLVED_NORMAL_ONLY', bodies, normalImpulsesNs: [...witness.normalImpulsesNs],
    rowResiduals, certificate, stats: { ...witness.stats }, solver: 'EXACT_STATIONARY_FLOAT_J_V1', reason: null };
}

function requireNormal(ok: unknown, message: string): asserts ok {
  if (!ok) throw new PhysicsError('NUMERIC_LIMIT', 'bounded stack normal: ' + message);
}

function pointVelocity(body: NormalBody, point: readonly number[]): Vec3 {
  const r = point.map((value, i) => value - body.positionM[i]);
  const w = body.angularVelocityRadps;
  return [body.velocityMps[0] + w[1] * r[2] - w[2] * r[1],
    body.velocityMps[1] + w[2] * r[0] - w[0] * r[2],
    body.velocityMps[2] + w[0] * r[1] - w[1] * r[0]];
}

/** One cold solve over frozen actual points. Caller owns unaccepted bodies. */
export function solveStackNormal(bodies: Body[], patches: readonly FrozenStackPatch[]): {
  problem: NormalProblem; result: StackNormalResult; pointLedger: PointLedger[]; stationaryWitness: StationaryResult;
} {
  const inputBodies: NormalBody[] = bodies.map(body => {
    const inverseInertiaWorld: Mat3 = body.kind === 'dynamic'
      ? [[24, 0, 0], [0, 24, 0], [0, 0, 24]] : [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    return { id: body.id, positionM: [...body.positionM], velocityMps: [...body.velocityMps],
      angularVelocityRadps: [...body.angularVelocityRadps], inverseMass: body.inverseMass,
      inverseInertiaWorld };
  });
  const points: NormalProblem['points'][number][] = [];
  for (const patch of patches) {
    requireNormal(bodies[patch.aIndex]?.id === patch.aId && bodies[patch.bIndex]?.id === patch.bId &&
      patch.pairKey === patch.aId + '\0' + patch.bId, 'frozen patch identity');
    for (const point of patch.points) {
      points.push({ id: JSON.stringify([patch.pairKey, point.id]), aId: patch.aId,
        bId: patch.bId, pointM: [...point.pointM], normalAtoB: [...patch.normal] });
    }
  }
  requireNormal(points.length <= 32, 'more than32 actual points');
  const problem: NormalProblem = { bodies: inputBodies, points };
  let result: StackNormalResult | null = null;
  let stationaryWitness: StationaryResult | null = null;
  try {
    stationaryWitness = solveStationaryNormal(problem);
    if (!stationaryWitness.ok) throw new PhysicsError(
      stationaryWitness.status === 'RESOURCE_LIMIT' ? 'ITERATION_LIMIT' : 'NUMERIC_LIMIT',
      'bounded stack stationary normal: ' + stationaryWitness.status + ': ' + stationaryWitness.reason);
    result = diagnoseStationaryNormal(problem, stationaryWitness);
    requireNormal(result.status === 'SOLVED_NORMAL_ONLY' && result.normalImpulsesNs &&
      result.rowResiduals && result.certificate && result.bodies.length === bodies.length &&
      result.normalImpulsesNs.length === points.length && result.rowResiduals.length === points.length,
      'complete normal solution required');
    requireNormal(result.certificate.zeroTangentFeasible &&
      result.certificate.maxLoadedTangentSpeedMps <= 1e-10, 'loaded tangent speed exceeds1e-10');
    const resultById = new Map(result.bodies.map(body => [body.id, body]));
    for (let i = 0; i < points.length; i++) {
      const lambda = result.normalImpulsesNs[i], point = points[i];
      requireNormal(Number.isFinite(lambda) && lambda >= 0, 'invalid normal impulse');
      if (lambda === 0) continue;
      const a = resultById.get(point.aId), b = resultById.get(point.bId);
      requireNormal(a && b, 'result endpoint missing');
      const va = pointVelocity(a, point.pointM), vb = pointVelocity(b, point.pointM);
      const relative = vb.map((value, k) => value - va[k]);
      const vn = relative.reduce((sum, value, k) => sum + value * point.normalAtoB[k], 0);
      const tangent = relative.map((value, k) => value - vn * point.normalAtoB[k]);
      requireNormal(Math.hypot(...tangent) <= 1e-10 && result.rowResiduals[i].tangentSpeedMps <= 1e-10,
        'independent loaded tangent speed exceeds1e-10');
    }
    for (let i = 0; i < bodies.length; i++) {
      requireNormal(result.bodies[i].id === bodies[i].id &&
        result.bodies[i].positionM.every((v, j) => v === bodies[i].positionM[j]), 'body order or pose changed');
    }
    const pointLedger: PointLedger[] = [];
    const seen = new Set<string>();
    let index = 0;
    for (const patch of patches) for (const point of patch.points) {
      const key = patch.pairKey + '\0' + point.id;
      requireNormal(!seen.has(key), 'duplicate actual point key');
      seen.add(key);
      pointLedger.push({ aId: patch.aId, bId: patch.bId, aIndex: patch.aIndex, bIndex: patch.bIndex,
        pairKey: patch.pairKey, pointId: point.id, family: patch.family,
        pointM: [...point.pointM], normal: [...patch.normal],
        aPositionM: [...bodies[patch.aIndex].positionM], bPositionM: [...bodies[patch.bIndex].positionM],
        warm: { normalNs: 0, tangentNs: [0, 0, 0] },
        final: { normalNs: result.normalImpulsesNs[index++], tangentNs: [0, 0, 0] } });
    }
    requireNormal(pointLedger.length === points.length, 'complete point ledger');
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].velocityMps = [...result.bodies[i].velocityMps];
      bodies[i].angularVelocityRadps = [...result.bodies[i].angularVelocityRadps];
    }
    return { problem, result, pointLedger, stationaryWitness };
  } catch (caught) {
    if (caught instanceof PhysicsError) throw new NormalPhaseFailure(caught, problem, result, stationaryWitness);
    throw caught;
  }
}
