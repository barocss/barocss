import type { Body, Vec3 } from '../internal-types.js';
import { PhysicsError } from '../internal-types.js';
import { copyBody } from '../validation.js';
import { add, advanceOrientation, inverseInertia, scale } from '../math.js';
import { detect, validateResult } from '../collision.js';
import { ID, MAX_STEP_DISPLACEMENT_M } from '../limits.js';
import { adaptContactGeometry } from './geometry-adapter.js';
import { NormalPhaseFailure, solveStackNormal } from './normal-bridge.js';
import type { FrozenStackPatch } from './normal-bridge.js';
import type { NormalProblem, NormalSolverResult } from './normal-solver.js';
import { PositionPhaseFailure, runFullPairPositionPhase } from './full-pair-phase.js';
import type { FullPairPositionAttempt, FullPairPositionStats, PointLedger, PositionPair } from './world-types.js';

export interface StackStepDiagnostics {
  beforeBodies: Body[];
  freeBodies: Body[] | null;
  velocityBodies: Body[] | null;
  geometryPatches: FrozenStackPatch[];
  pointLedger: PointLedger[];
  normalProblem: NormalProblem | null;
  normalResult: NormalSolverResult | null;
  positionAttempt: FullPairPositionAttempt | null;
  positionStats: FullPairPositionStats | null;
}
export interface PreparedStackStep {
  candidateBodies: Body[];
  diagnostics: StackStepDiagnostics;
}
export class StackStepFailure extends PhysicsError {
  readonly diagnostics: StackStepDiagnostics;
  constructor(reason: PhysicsError, diagnostics: StackStepDiagnostics) {
    super(reason.code, reason.message);
    this.diagnostics = structuredClone(diagnostics);
  }
}

function requireStack(ok: unknown, message: string): asserts ok {
  if (!ok) throw new PhysicsError('NUMERIC_LIMIT', 'bounded stack profile: ' + message);
}
function equal(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function finiteVector(value: unknown, size: number, bound: number): value is number[] {
  return Array.isArray(value) && value.length === size &&
    Array.from({ length: size }, (_, i) => i).every(i => Object.hasOwn(value, i) &&
      typeof value[i] === 'number' && Number.isFinite(value[i]) && Math.abs(value[i]) <= bound);
}

/** Internal profile validation. This does not change public model admission. */
function admitted(bodies: readonly Body[], dt: number, gravity: Vec3): void {
  requireStack(dt === 1 / 120 && finiteVector(gravity, 3, 1000), 'dt or gravity');
  requireStack(Array.isArray(bodies) && bodies.length === 9 &&
    bodies.every(body => body !== null && typeof body === 'object') &&
    bodies.filter(body => body.kind === 'dynamic').length === 8 &&
    bodies.filter(body => body.kind === 'static').length === 1, 'eight cubes and one floor');
  const ids = new Set<string>();
  for (const body of bodies) {
    requireStack(finiteVector(body.positionM, 3, 10000) && finiteVector(body.velocityMps, 3, 1000) &&
      finiteVector(body.angularVelocityRadps, 3, 1000) && finiteVector(body.orientation, 4, 1) &&
      finiteVector(body.inverseInertiaLocal, 3, 1000000) && Number.isFinite(body.inverseMass),
      'finite represented body state');
    requireStack(typeof body.id === 'string' && ID.test(body.id) && !ids.has(body.id), 'unique opaque IDs');
    ids.add(body.id);
    requireStack(body.shape && body.shape.kind === 'box' && finiteVector(body.shape.halfExtentsM, 3, 1000) && !body.sensor && !body.ccd && !body.collisionFilter &&
      !body.sleeping && body.restitution === 0 && body.frictionStatic === 1 && body.frictionDynamic === .7,
      'unfiltered unsensed unforced original box material');
    if (body.kind === 'dynamic') {
      requireStack(body.inverseMass === 1 && equal(body.shape.halfExtentsM, [.25, .25, .25]) &&
        equal(body.inverseInertiaLocal, [24, 24, 24]), 'unit-mass half-quarter isotropic cube');
    } else {
      requireStack(body.kind === 'static' && body.inverseMass === 0 &&
        equal(body.inverseInertiaLocal, [0, 0, 0]) && equal(body.velocityMps, [0, 0, 0]) &&
        equal(body.angularVelocityRadps, [0, 0, 0]) && equal(body.shape.halfExtentsM, [2, .1, 2]) &&
        equal(body.positionM, [0, -.1, 0]) && equal(body.orientation, [0, 0, 0, 1]), 'fixed original floor');
    }
  }
  validateResult(bodies as Body[], []);
}

function sortedPairs(bodies: readonly Body[]): PositionPair[] {
  const pairs: PositionPair[] = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 :
    bodies[left[0]].id > bodies[right[0]].id ? 1 :
      bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  requireStack(pairs.length === 36, 'complete all-pair population');
  return pairs;
}

/** Prepare one detached unforced step; never mutate accepted caller state. */
export function prepareStackStep(bodies: readonly Body[], dt: number, gravity: Vec3): PreparedStackStep {
  admitted(bodies, dt, gravity);
  const next = bodies.map(copyBody);
  const diagnostics: StackStepDiagnostics = {
    beforeBodies: bodies.map(copyBody), freeBodies: null, velocityBodies: null,
    geometryPatches: [], pointLedger: [], normalProblem: null, normalResult: null,
    positionAttempt: null, positionStats: null,
  };
  try {
    // Preserve the original unforced arithmetic, including explicit zero
    // action terms. There is no command, cache or pose-restart input here.
    for (const body of next) if (body.kind === 'dynamic') {
      body.angularVelocityRadps = add(body.angularVelocityRadps,
        inverseInertia(body, add([0, 0, 0], scale([0, 0, 0], dt))));
    }
    for (const body of next) if (body.kind === 'dynamic') {
      requireStack(body.angularVelocityRadps.every(v => Number.isFinite(v) && Math.abs(v) <= 1000) &&
        Math.hypot(...body.angularVelocityRadps) * dt <= 10, 'angular movement bound');
      body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, dt);
      for (let i = 0; i < 3; i++) {
        body.velocityMps[i] += 0 * body.inverseMass;
        body.velocityMps[i] += (gravity[i] + 0 * body.inverseMass) * dt;
      }
      requireStack(Math.hypot(...body.velocityMps) * dt <= MAX_STEP_DISPLACEMENT_M, 'step displacement');
      for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;
    }
    validateResult(next, []);
    diagnostics.freeBodies = next.map(copyBody);
    const pairs = sortedPairs(next);
    for (const [aIndex, bIndex] of pairs) {
      const a = next[aIndex], b = next[bIndex], hit = detect(a, b);
      if (!hit) continue;
      requireStack(hit.penetration <= MAX_STEP_DISPLACEMENT_M, 'contact penetration');
      const geometry = adaptContactGeometry(a, b);
      requireStack(geometry, 'strict native contact geometry');
      diagnostics.geometryPatches.push({ aIndex, bIndex, aId: a.id, bId: b.id,
        pairKey: a.id + '\0' + b.id, family: geometry.family,
        normal: [...geometry.normal], points: geometry.points });
    }
    const normal = solveStackNormal(next, diagnostics.geometryPatches);
    diagnostics.normalProblem = normal.problem;
    diagnostics.normalResult = normal.result;
    diagnostics.pointLedger = normal.pointLedger;
    diagnostics.velocityBodies = next.map(copyBody);
    const position = runFullPairPositionPhase(next, pairs);
    diagnostics.positionAttempt = position.attempt;
    diagnostics.positionStats = position.stats;
    validateResult(next, []);
    return { candidateBodies: next.map(copyBody), diagnostics: structuredClone(diagnostics) };
  } catch (caught) {
    if (caught instanceof NormalPhaseFailure) {
      diagnostics.normalProblem = caught.problem;
      diagnostics.normalResult = caught.result;
    }
    if (caught instanceof PositionPhaseFailure) {
      diagnostics.positionAttempt = caught.attempt;
      diagnostics.positionStats = caught.stats;
    }
    if (caught instanceof PhysicsError) throw new StackStepFailure(caught, diagnostics);
    throw caught;
  }
}
