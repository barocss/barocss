/** Private cold island candidate. No integration, World, cache, fixture or expected-state imports. */
import { PhysicsError, type Body, type Hit, type PhysicsContact, type PhysicsPairStats, type Vec3 } from '../internal-types.js';
import { copyBody } from '../validation.js';
import { detect, validateResult } from '../collision.js';
import { add, cross, dot, inertia, inverseInertia, rotate, scale, sub } from '../math.js';
import { contactApplication, ContactPairAccumulator } from '../contact-contribution.js';
import type { CompletedContactPair, ContactContribution } from '../contact-contribution.js';
import { featureContact } from './geometry.js';
import type { ContactGeometry } from './contact-types.js';
import { solveNormalContacts } from './normal-solver.js';
import type { Mat3, NormalBody, NormalProblem, NormalSolverResult } from './normal-solver.js';
import { checkedFullPairInputs } from './full-pair-rows.js';
import { runFullPairPositionPhase, PositionPhaseFailure } from './full-pair-phase.js';
import type { FullPairPositionAttempt, FullPairPositionStats, PositionPair } from './world-types.js';
import { StrictLineContext, StrictLineFailure } from './strict-line.js';
import type { FacePlane } from './strict-line.js';

export interface IslandGeometry {
  aIndex: number; bIndex: number; pairKey: string; aId: string; bId: string;
  hit: Hit | null; geometry: ContactGeometry;
}
export interface IslandApplication {
  id: string; aIndex: number; bIndex: number; pairKey: string; pointKey: string;
  pointM: Vec3; normalAtoB: Vec3; normalImpulseNs: number;
  contribution: ContactContribution;
}
export interface AppliedNormalCertificate {
  maxClosingNormalSpeedMps: number; maxComplementarityJ: number;
  maxStationaritySqrtJ: number; maxSolverVelocityDifference: number;
  maxLinearMomentumResidualNs: number; maxAngularMomentumResidualNms: number;
  postValidationCholeskyFactorizations: number;
}
export interface FrictionlessIslandDiagnostics {
  integratedFreeBodies: Body[]; positionCandidateBodies: Body[] | null; normalInputBodies: Body[] | null; normalGeometry: IslandGeometry[]; pairs: PositionPair[];
  normalProblem: NormalProblem | null; normalResult: NormalSolverResult | null;
  applications: IslandApplication[]; impulseAppliedBodies: Body[] | null;
  appliedNormalCertificate: AppliedNormalCertificate | null;
  positionAttempt: FullPairPositionAttempt | null; positionStats: FullPairPositionStats | null;
  postGeometry: IslandGeometry[]; pairContributions: readonly CompletedContactPair[];
  normalSolverCalls: number; positionPhaseCalls: number; positionSolverCalls: number | null;
}
export interface PreparedFrictionlessIsland {
  candidateBodies: Body[]; contacts: PhysicsContact[]; pairStats: PhysicsPairStats;
  pairContributions: readonly CompletedContactPair[]; diagnostics: FrictionlessIslandDiagnostics;
}
export class FrictionlessIslandFailure extends PhysicsError {
  readonly diagnostics: FrictionlessIslandDiagnostics;
  constructor(reason: PhysicsError, diagnostics: FrictionlessIslandDiagnostics) {
    super(reason.code, reason.message);
    this.diagnostics = structuredClone(diagnostics);
  }
}

const SI = 1e-10;
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw new PhysicsError('NUMERIC_LIMIT', 'frictionless island: ' + message);
}
function finite(value: number): number {
  need(Number.isFinite(value), 'finite validation arithmetic');
  return value;
}
function maximum(values: readonly number[]): number {
  return values.reduce((value, next) => Math.max(value, Math.abs(finite(next))), 0);
}
function pairKey(a: Body, b: Body): string { return a.id + '\0' + b.id; }
function velocityAt(body: Body, point: Vec3): Vec3 {
  return add(body.velocityMps, cross(body.angularVelocityRadps, sub(point, body.positionM)));
}
function worldInverse(body: Body): Mat3 {
  if (body.inverseMass === 0) return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const local = body.inverseInertiaLocal;
  if (local[0] === local[1] && local[1] === local[2]) {
    const c = local[0];
    // R(cI)R^T = cI for every physical rotation. Exact equality, no tensor repair.
    return [[c, 0, 0], [0, c, 0], [0, 0, c]];
  }
  const axes = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[])
    .map(axis => rotate(body.orientation, axis));
  const tensor: [[number, number, number], [number, number, number], [number, number, number]] =
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  // Construct the symmetric bilinear form directly. No separately rounded
  // operator columns are averaged or repaired; actual impulse application and
  // its independent applied-normal checks still use inverseInertia unchanged.
  for (let row = 0; row < 3; row++) for (let column = row; column < 3; column++) {
    let value = 0;
    for (let axis = 0; axis < 3; axis++) {
      const weighted = finite(axes[axis][row] * local[axis]);
      value = finite(value + finite(weighted * axes[axis][column]));
    }
    tensor[row][column] = value;
    tensor[column][row] = value;
  }
  return tensor;
}
function normalBody(body: Body): NormalBody {
  return { id: body.id, positionM: [...body.positionM], velocityMps: [...body.velocityMps],
    angularVelocityRadps: [...body.angularVelocityRadps], inverseMass: body.inverseMass,
    inverseInertiaWorld: worldInverse(body) };
}
/** Fixed 3x3 validation factor only; not another normal solve or solver stats. */
function validationFactor(matrix: Mat3): number[][] {
  const lower = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const magnitude = Math.max(1, ...matrix.flat().map(Math.abs));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    need(matrix[i][j] === matrix[j][i], 'actual inverse inertia symmetry');
  for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) {
    let value = matrix[i][j];
    for (let k = 0; k < j; k++) value = finite(value - finite(lower[i][k] * lower[j][k]));
    if (i === j) {
      need(value > 1e-12 * magnitude, 'actual inverse inertia positive definite');
      lower[i][j] = Math.sqrt(value);
    } else lower[i][j] = finite(value / lower[j][j]);
  }
  return lower;
}
function whiten(factor: number[][], angularVelocity: Vec3): number[] {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    let value = angularVelocity[i];
    for (let j = 0; j < i; j++) value = finite(value - finite(factor[i][j] * out[j]));
    out.push(finite(value / factor[i][i]));
  }
  return out;
}
function validateApplied(free: readonly Body[], applied: readonly Body[], problem: NormalProblem,
  solved: NormalSolverResult, applications: readonly IslandApplication[]): AppliedNormalCertificate {
  need(solved.ok && solved.normalImpulsesNs && solved.bodies.length === free.length, 'complete normal solve');
  const result: AppliedNormalCertificate = { maxClosingNormalSpeedMps: 0, maxComplementarityJ: 0,
    maxStationaritySqrtJ: 0, maxSolverVelocityDifference: 0, maxLinearMomentumResidualNs: 0,
    maxAngularMomentumResidualNms: 0, postValidationCholeskyFactorizations: 0 };
  const linear = free.map(() => [0, 0, 0] as Vec3), angular = free.map(() => [0, 0, 0] as Vec3);
  for (const entry of applications) {
    const application = entry.contribution.applications[0];
    need(application && entry.contribution.applications.length === 1, 'one actual point application');
    for (const [index, side] of [[entry.aIndex, application.onA], [entry.bIndex, application.onB]] as const) {
      linear[index] = add(linear[index], side.linearImpulseNs);
      angular[index] = add(angular[index], side.armTorqueNms);
    }
  }
  const ids = new Map(free.map((body, index) => [body.id, index]));
  for (let i = 0; i < free.length; i++) {
    need(applied[i].id === free[i].id && solved.bodies[i].id === free[i].id, 'body order retained');
    if (free[i].inverseMass === 0) continue;
    const factor = validationFactor(problem.bodies[i].inverseInertiaWorld);
    result.postValidationCholeskyFactorizations++;
    const rootMass = Math.sqrt(free[i].inverseMass);
    const oldAngular = whiten(factor, free[i].angularVelocityRadps);
    const newAngular = whiten(factor, applied[i].angularVelocityRadps);
    const reaction = [0, 0, 0, 0, 0, 0];
    for (let p = 0; p < problem.points.length; p++) {
      const point = problem.points[p], lambda = solved.normalImpulsesNs[p];
      const sign = point.aId === free[i].id ? -1 : point.bId === free[i].id ? 1 : 0;
      if (!sign) continue;
      const n = [...point.normalAtoB] as Vec3;
      const torque = cross(sub([...point.pointM] as Vec3, free[i].positionM), n);
      for (let k = 0; k < 3; k++) {
        reaction[k] = finite(reaction[k] + finite(finite(sign * n[k] * rootMass) * lambda));
        let coefficient = 0;
        for (let j = 0; j < 3; j++) coefficient = finite(coefficient + finite(torque[j] * factor[j][k]));
        reaction[k + 3] = finite(reaction[k + 3] + finite(finite(sign * coefficient) * lambda));
      }
    }
    const residual = [0, 1, 2].map(k => finite(applied[i].velocityMps[k] / rootMass -
      free[i].velocityMps[k] / rootMass - reaction[k]));
    for (let k = 0; k < 3; k++) residual.push(finite(newAngular[k] - oldAngular[k] - reaction[k + 3]));
    result.maxStationaritySqrtJ = Math.max(result.maxStationaritySqrtJ, maximum(residual));
    result.maxSolverVelocityDifference = Math.max(result.maxSolverVelocityDifference,
      maximum(sub(applied[i].velocityMps, [...solved.bodies[i].velocityMps] as Vec3)),
      maximum(sub(applied[i].angularVelocityRadps, [...solved.bodies[i].angularVelocityRadps] as Vec3)));
    result.maxLinearMomentumResidualNs = Math.max(result.maxLinearMomentumResidualNs,
      maximum(sub(scale(sub(applied[i].velocityMps, free[i].velocityMps), 1 / free[i].inverseMass), linear[i])));
    result.maxAngularMomentumResidualNms = Math.max(result.maxAngularMomentumResidualNms,
      maximum(sub(inertia(free[i], sub(applied[i].angularVelocityRadps, free[i].angularVelocityRadps)), angular[i])));
  }
  for (let p = 0; p < problem.points.length; p++) {
    const point = problem.points[p], a = ids.get(point.aId), b = ids.get(point.bId);
    need(a !== undefined && b !== undefined, 'normal endpoints retained');
    const relative = sub(velocityAt(applied[b], [...point.pointM] as Vec3), velocityAt(applied[a], [...point.pointM] as Vec3));
    const speed = finite(dot(relative, [...point.normalAtoB] as Vec3));
    result.maxClosingNormalSpeedMps = Math.max(result.maxClosingNormalSpeedMps, -speed);
    result.maxComplementarityJ = Math.max(result.maxComplementarityJ, Math.abs(finite(speed * solved.normalImpulsesNs[p])));
  }
  for (const key of ['maxClosingNormalSpeedMps', 'maxComplementarityJ', 'maxStationaritySqrtJ',
    'maxSolverVelocityDifference', 'maxLinearMomentumResidualNs', 'maxAngularMomentumResidualNms'] as const)
    need(Number.isFinite(result[key]) && result[key] <= SI, 'actual applied normal certificate: ' + key);
  return result;
}
function representative(a: Body, b: Body, geometry: ContactGeometry): Vec3 {
  const mean = scale(geometry.points.reduce((sum, point) => add(sum, point.midpointM), [0, 0, 0] as Vec3), 1 / geometry.points.length);
  const exact = new StrictLineContext(a, b, geometry.planeNormalAtoB);
  need(exact.check(mean), 'post representative strict line');
  if (geometry.family === 'face') {
    const reference = geometry.reference;
    need(reference, 'post face selectors');
    const ref: FacePlane = { axis: reference.axis, side: reference.side };
    const inc: FacePlane = { axis: reference.incidentAxis, side: reference.incidentSide };
    const faceA = reference.body === 'a' ? ref : inc, faceB = reference.body === 'a' ? inc : ref;
    need(exact.selectedFaceBounds(mean, faceA, faceB) && exact.onFace(0, faceA, mean) && exact.onFace(1, faceB, mean),
      'post representative finite boundary faces');
  }
  return mean;
}

function sameGeometryRows(a: ContactGeometry, b: ContactGeometry): boolean {
  return a.planeNormalAtoB.every((value, i) => Object.is(value, b.planeNormalAtoB[i])) &&
    a.points.length === b.points.length && a.points.every((point, i) =>
      point.key === b.points[i].key && point.midpointM.every((value, j) => Object.is(value, b.points[i].midpointM[j])));
}

/** Caller supplies actual post-integration FREE bodies and every sorted eligible pair. */
export function prepareFrictionlessIsland(freeBodies: readonly Body[], pairs: readonly PositionPair[],
  context: { jointCount: number }): PreparedFrictionlessIsland {
  const diagnostics: FrictionlessIslandDiagnostics = { integratedFreeBodies: [], positionCandidateBodies: null, normalInputBodies: null, normalGeometry: [], pairs: [],
    normalProblem: null, normalResult: null, applications: [], impulseAppliedBodies: null,
    appliedNormalCertificate: null, positionAttempt: null, positionStats: null, postGeometry: [],
    pairContributions: [], normalSolverCalls: 0, positionPhaseCalls: 0, positionSolverCalls: 0 };
  try {
    need(context && context.jointCount === 0, 'no joints');
    need(Array.isArray(freeBodies) && freeBodies.length >= 1 && freeBodies.length <= 4 &&
      freeBodies.every(body => body !== null && typeof body === 'object') &&
      freeBodies.some(body => body.kind === 'dynamic'), 'existing persistent body bound');
    checkedFullPairInputs(freeBodies, pairs);
    for (const body of freeBodies) need(body.frictionStatic === 0 && body.frictionDynamic === 0 &&
      body.restitution === 0 && !body.sleeping && !body.sensor && !body.ccd && !body.collisionFilter,
      'zero-friction zero-restitution unfiltered awake boxes');
    for (const body of freeBodies) if (body.kind === 'static')
      need(body.inverseInertiaLocal.every((value: number) => value === 0), 'prescribed static inverse inertia');
    const working = freeBodies.map(copyBody);
    diagnostics.integratedFreeBodies = working.map(copyBody);
    diagnostics.pairs = pairs.map(([a, b]): PositionPair => [a, b]);
    diagnostics.positionPhaseCalls++;
    diagnostics.positionSolverCalls = null;
    try {
      const position = runFullPairPositionPhase(working, pairs);
      diagnostics.positionAttempt = position.attempt;
      diagnostics.positionStats = position.stats;
      diagnostics.positionSolverCalls = position.stats.solverCalls;
    } catch (error) {
      if (error instanceof PositionPhaseFailure) {
        diagnostics.positionAttempt = error.attempt;
        diagnostics.positionStats = error.stats;
        diagnostics.positionSolverCalls = error.stats.solverCalls;
      }
      throw error;
    }
    diagnostics.positionCandidateBodies = working.map(copyBody);
    diagnostics.normalInputBodies = working.map(copyBody);
    const points: NormalProblem['points'][number][] = [];
    for (const [aIndex, bIndex] of pairs) {
      const a = working[aIndex], b = working[bIndex], hit = detect(a, b);
      const geometry = featureContact(a, b);
      if (!geometry) {
        need(!hit, 'actual projected hit requires contact geometry');
        continue;
      }
      need(geometry.points.length > 0, 'actual projected-pose contact geometry');
      const key = pairKey(a, b);
      diagnostics.normalGeometry.push({ aIndex, bIndex, aId: a.id, bId: b.id, pairKey: key,
        hit: structuredClone(hit), geometry });
      for (const point of geometry.points) points.push({ id: JSON.stringify([key, point.key]),
        aId: a.id, bId: b.id, pointM: [...point.midpointM], normalAtoB: [...geometry.planeNormalAtoB] });
    }
    need(points.length <= 32, 'existing normal point bound');
    const problem: NormalProblem = { bodies: working.map(normalBody), points };
    diagnostics.normalProblem = problem;
    diagnostics.normalSolverCalls++;
    const solved = solveNormalContacts(problem);
    diagnostics.normalResult = solved;
    if (!solved.ok) throw new PhysicsError(solved.status === 'ITERATION_LIMIT' ? 'ITERATION_LIMIT' : 'NUMERIC_LIMIT',
      'frictionless island normal: ' + solved.reason);
    need(solved.status === 'SOLVED_NORMAL_ONLY' && solved.normalImpulsesNs && solved.normalImpulsesNs.length === points.length,
      'complete global normal solve');
    const totals = new ContactPairAccumulator(), byId = new Map(working.map((body, index) => [body.id, index]));
    let pointIndex = 0;
    for (const patch of diagnostics.normalGeometry) for (const point of patch.geometry.points) {
      const a = working[patch.aIndex], b = working[patch.bIndex], lambda = solved.normalImpulsesNs[pointIndex];
      need(Number.isFinite(lambda) && lambda >= 0 && problem.points[pointIndex].id === JSON.stringify([patch.pairKey, point.key]),
        'nonnegative actual point impulse/link');
      const n = [...patch.geometry.planeNormalAtoB] as Vec3;
      const pointM = [...point.midpointM] as Vec3, onB = scale(n, lambda);
      const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);
      const contribution = contactApplication(a.positionM, b.positionM, armA, armB, onB);
      const actual = contribution.applications[0];
      diagnostics.applications.push({ id: problem.points[pointIndex].id, aIndex: patch.aIndex, bIndex: patch.bIndex,
        pairKey: patch.pairKey, pointKey: point.key, pointM, normalAtoB: n, normalImpulseNs: lambda, contribution });
      totals.add(a.id, b.id, contribution);
      if (lambda !== 0) for (const [body, side] of [[a, actual.onA], [b, actual.onB]] as const) if (body.inverseMass !== 0) {
        body.velocityMps = add(body.velocityMps, scale(side.linearImpulseNs, body.inverseMass));
        body.angularVelocityRadps = add(body.angularVelocityRadps, inverseInertia(body, side.armTorqueNms));
      }
      pointIndex++;
    }
    need(pointIndex === points.length, 'every normal point applied exactly once');
    diagnostics.pairContributions = totals.finish();
    diagnostics.impulseAppliedBodies = working.map(copyBody);
    validateResult(working, []);
    diagnostics.appliedNormalCertificate = validateApplied(diagnostics.normalInputBodies!, working, problem, solved, diagnostics.applications);
    const impulseTotals = new Map<string, number>();
    for (const application of diagnostics.applications)
      impulseTotals.set(application.pairKey, finite((impulseTotals.get(application.pairKey) ?? 0) + application.normalImpulseNs));
    const freePenetrations = new Map(diagnostics.positionAttempt!.initialDetections.map(entry => [entry.pairKey, entry.hit?.penetration ?? 0]));
    const contacts: PhysicsContact[] = [], retained = new Set<string>();
    for (const [aIndex, bIndex] of pairs) {
      const a = working[aIndex], b = working[bIndex], key = pairKey(a, b);
      const geometry = featureContact(a, b);
      if (!geometry) {
        need((impulseTotals.get(key) ?? 0) === 0, 'applied pair needs fresh post witness');
        continue;
      }
      const normalPatch = diagnostics.normalGeometry.find(patch => patch.aIndex === aIndex && patch.bIndex === bIndex);
      need(normalPatch && sameGeometryRows(normalPatch.geometry, geometry), 'normal and final contact rows retain exact words');
      diagnostics.postGeometry.push({ aIndex, bIndex, aId: a.id, bId: b.id, pairKey: key,
        hit: detect(a, b), geometry });
      for (const point of geometry.points) {
        const speed = finite(dot(sub(velocityAt(b, point.midpointM), velocityAt(a, point.midpointM)), geometry.planeNormalAtoB));
        need(speed >= -SI, 'fresh post contact normal feasibility');
      }
      const mean = representative(a, b, geometry);
      contacts.push({ aId: a.id, bId: b.id, normalAtoB: [...geometry.planeNormalAtoB], pointM: mean,
        penetrationM: freePenetrations.get(key) ?? 0, impulseNs: impulseTotals.get(key) ?? 0, tangentImpulseNs: [0, 0, 0] });
      retained.add(key);
    }
    need(diagnostics.postGeometry.length === diagnostics.normalGeometry.length, 'complete final normal patch set');
    for (const [key, impulse] of impulseTotals) need(impulse === 0 || retained.has(key), 'all applied pair summaries retained');
    need(byId.size === working.length, 'body identity retained');
    validateResult(working, contacts);
    return { candidateBodies: working.map(copyBody), contacts, pairStats: {
      eligiblePairs: pairs.length, candidatePairs: pairs.length, aabbTests: 0 },
      pairContributions: structuredClone(diagnostics.pairContributions), diagnostics: structuredClone(diagnostics) };
  } catch (caught) {
    if (caught instanceof StrictLineFailure) throw new FrictionlessIslandFailure(
      new PhysicsError('NUMERIC_LIMIT', 'frictionless island post representative strict-line refusal'), diagnostics);
    if (caught instanceof PhysicsError) throw new FrictionlessIslandFailure(caught, diagnostics);
    throw caught;
  }
}
