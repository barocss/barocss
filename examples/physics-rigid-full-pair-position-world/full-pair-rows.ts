import { PhysicsError, type Body, type Vec3 } from '../../packages/barocss-physics/src/types.js';
import { detect, validateResult } from '../../packages/barocss-physics/src/collision.js';
import { ID } from '../../packages/barocss-physics/src/limits.js';
import { inspectSignedBoxSAT, FEATURE_INPUT_MESSAGE, AXIS_MESSAGE, type SignedSATSelection } from '../physics-rigid-signed-separation-reference/signed-sat.js';
import { FullPairPositionReferenceError, MESSAGES } from './full-pair-solver.mjs';
import type { CompactSelection, FullPairProblemBuild, PairObservation, PositionPair } from './world-types.js';

export const FULL_PAIR_ERRORS = {
  INPUT: 'private full-pair position input is invalid',
  PROFILE: 'private full-pair position profile is unsupported',
  RANGE: 'private full-pair position signed bound exceeds the admitted range',
  GEOMETRY: 'private full-pair position requires fresh matching box geometry',
  INFEASIBLE: 'private full-pair position constraints are infeasible',
  NUMERIC_UNSAFE: 'private full-pair position solve is numerically unsafe',
  WORK_LIMIT: 'private full-pair position solve exceeded its work limit',
  RESULT: 'private full-pair position result is invalid',
  NONPENETRATION: 'private full-pair position result left an overlapping pair',
} as const;

export function refuse(key: keyof typeof FULL_PAIR_ERRORS): never {
  throw new PhysicsError('NUMERIC_LIMIT', FULL_PAIR_ERRORS[key]);
}

/** Only the original class, code and exact message permit a bridge. */
export function mapFullPairError(error: unknown): unknown {
  try {
    if (error instanceof FullPairPositionReferenceError) {
      if (error.code === 'PROFILE_LIMIT' && error.message === MESSAGES.limit) {
        return new PhysicsError('NUMERIC_LIMIT', FULL_PAIR_ERRORS.PROFILE);
      }
      if (error.code === 'INVALID_INPUT' && ([MESSAGES.input, MESSAGES.empty, MESSAGES.ids,
        MESSAGES.mass, MESSAGES.endpoints, MESSAGES.normal, MESSAGES.bound,
        MESSAGES.workLimits] as readonly string[]).includes(error.message)) {
        return new PhysicsError('NUMERIC_LIMIT', FULL_PAIR_ERRORS.INPUT);
      }
      if (error.code === 'NUMERIC_LIMIT' && error.message === MESSAGES.result) {
        return new PhysicsError('NUMERIC_LIMIT', FULL_PAIR_ERRORS.RESULT);
      }
    }
    if (error instanceof PhysicsError &&
      ((error.code === 'INVALID_CONFIG' && error.message === FEATURE_INPUT_MESSAGE) ||
        (error.code === 'NUMERIC_LIMIT' && error.message === AXIS_MESSAGE))) {
      return new PhysicsError('NUMERIC_LIMIT', FULL_PAIR_ERRORS.GEOMETRY);
    }
  } catch { /* Diagnostic reflection cannot replace the original thrown value. */ }
  return error;
}

export function ordinaryDense(value: unknown, size?: number): value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype &&
    (size === undefined || value.length === size) &&
    Reflect.ownKeys(value).length === value.length + 1 &&
    Array.from({ length: value.length }, (_, i) => i).every(i => {
      const descriptor = Object.getOwnPropertyDescriptor(value, i);
      return descriptor !== undefined && 'value' in descriptor;
    });
}

function finiteVector(value: unknown, size: number, bound = Infinity): value is number[] {
  return ordinaryDense(value, size) && value.every(v =>
    typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= bound);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** Preserve the original private raw-body and pair profile. No parser or repair. */
export function checkedFullPairInputs(bodies: readonly Body[], pairs: readonly PositionPair[]): void {
  if (!ordinaryDense(bodies) || !ordinaryDense(pairs) || bodies.length === 0) refuse('INPUT');
  if (bodies.length > 9 || pairs.length > 36) refuse('PROFILE');
  const ids = new Set<string>();
  for (const body of bodies) {
    if (!record(body) || typeof body.id !== 'string' || !ID.test(body.id) || ids.has(body.id) ||
      !finiteVector(body.positionM, 3) || !finiteVector(body.velocityMps, 3) ||
      !finiteVector(body.orientation, 4) || !finiteVector(body.angularVelocityRadps, 3) ||
      typeof body.inverseMass !== 'number' || !Number.isFinite(body.inverseMass)) refuse('INPUT');
    ids.add(body.id);
    if ((body.kind !== 'dynamic' && body.kind !== 'static') || body.shape?.kind !== 'box' ||
      body.sensor || body.ccd || body.collisionFilter ||
      !finiteVector(body.shape.halfExtentsM, 3, 1000) || body.shape.halfExtentsM.some(v => v < .0001) ||
      body.restitution !== 0 || !finiteVector(body.inverseInertiaLocal, 3) ||
      body.inverseInertiaLocal.some(v => v < 0) ||
      (body.kind === 'static' ? body.inverseMass !== 0 : body.inverseMass < 1e-6 || body.inverseMass > 1e6)) {
      refuse('PROFILE');
    }
  }
  validateResult(bodies as Body[], []);
  const expected: PositionPair[] = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      expected.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  expected.sort((l, r) => bodies[l[0]].id < bodies[r[0]].id ? -1 :
    bodies[l[0]].id > bodies[r[0]].id ? 1 : bodies[l[1]].id < bodies[r[1]].id ? -1 : 1);
  if (pairs.length !== expected.length || pairs.some((p, i) =>
    !ordinaryDense(p, 2) || p[0] !== expected[i][0] || p[1] !== expected[i][1])) refuse('INPUT');
}

export function pairKey(bodies: readonly Body[], a: number, b: number): string {
  return `${bodies[a].id}\u0000${bodies[b].id}`;
}

export function compactSelection(full: SignedSATSelection): CompactSelection {
  return {
    normal: [...full.normal] as Vec3, boundM: full.boundM,
    candidateIndex: full.candidateIndex, pointM: [...full.pointM] as Vec3,
    rawAxisLength: full.rawAxisLength, label: full.label, feature: { ...full.feature },
  };
}

export function freshSelection(a: Body, b: Body): CompactSelection {
  return compactSelection(inspectSignedBoxSAT(a, b));
}

/** Every eligible PRE pair supplies one unclamped signed row, even when detect is null. */
export function buildFullPairProblem(bodies: readonly Body[], pairs: readonly PositionPair[],
  capture?: FullPairProblemBuild): FullPairProblemBuild {
  checkedFullPairInputs(bodies, pairs);
  const result: FullPairProblemBuild = capture ?? {
    problem: { bodies: bodies.map(b => ({ id: b.id, inverseMass: b.inverseMass })), rows: [] },
    rowSources: [], initialDetections: [], pairObservations: [], tests: 0, hits: 0, signedPreQueries: 0,
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
    if (hit !== null && (!hit.normal.every((v, d) => v === selection.normal[d]) ||
      Math.max(0, selection.boundM) !== hit.penetration)) refuse('GEOMETRY');
    result.rowSources.push({ rowIndex: result.problem.rows.length, pairKey: key, aIndex, bIndex,
      selection: structuredClone(selection) });
    result.problem.rows.push({ aId: a.id, bId: b.id, normal: [...selection.normal] as Vec3,
      boundM: selection.boundM });
  }
  // Complete the scan first. No row is dropped, clipped or passed to a solver out of range.
  if (result.pairObservations.some(p => p.selection.boundM < -10 || p.selection.boundM > 10)) refuse('RANGE');
  return result;
}

/** Complete fresh hypothetical scan. It creates no manifold or velocity/cache row. */
export function inspectFullPairHypothesis(bodies: readonly Body[], pairs: readonly PositionPair[],
  capture: PairObservation[] = [], progress?: { postPairTests: number }): PairObservation[] {
  for (const [aIndex, bIndex] of pairs) {
    if (progress) progress.postPairTests++;
    capture.push({ pairKey: pairKey(bodies, aIndex, bIndex), aIndex, bIndex,
      selection: freshSelection(bodies[aIndex], bodies[bIndex]) });
  }
  return capture;
}
