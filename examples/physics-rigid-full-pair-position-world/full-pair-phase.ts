import { PhysicsError, type Body } from '../../packages/barocss-physics/src/types.js';
import { copyBody } from '../../packages/barocss-physics/src/validation.js';
import { solveFullPairPosition, validateFullPairProblem, validateFullPairResult } from './full-pair-solver.mjs';
import type { FullPairProblem, FullPairResult } from './full-pair-types.js';
import type { ErrorRecord, FullPairPositionAttempt, FullPairPositionOptions, FullPairPositionStats,
  FullPairProblemBuild, PositionPair } from './world-types.js';
import { FULL_PAIR_ERRORS, buildFullPairProblem, checkedFullPairInputs, inspectFullPairHypothesis,
  mapFullPairError, refuse } from './full-pair-rows.js';
import { applyFullPairTranslationsOnce } from './full-pair-apply.js';

export { FULL_PAIR_ERRORS } from './full-pair-rows.js';

export function zeroFullPairPositionStats(): FullPairPositionStats {
  return {
    tests: 0, hits: 0, rows: 0, signedPreQueries: 0, solverCalls: 0, postPairTests: 0,
    maxTranslationM: 0, workingApplicationCount: 0,
    solverCounters: { iterations: 0, activeChanges: 0, rankChecks: 0, linearSolves: 0,
      constraintTests: 0, factorizations: 0, blockRightHandSides: 0,
      exactIntegerOperations: 0, exactPeakBits: 0 },
    certificate: null,
  };
}

function errorRecord(error: unknown): ErrorRecord {
  let result: ErrorRecord = {
    kind: 'unexpected-error', name: 'ThrownValue', message: 'Unexpected non-Error exception',
  };
  try {
    if (error instanceof Error) result = { kind: 'unexpected-error', name: error.name, message: error.message };
    if (error instanceof PhysicsError) {
      result = { kind: 'typed-refusal', name: error.name, code: error.code, message: error.message };
    }
  } catch { /* A diagnostic getter or proxy cannot replace the primary thrown value. */ }
  return result;
}

/** One full PRE problem and solve. Only private working positions can commit here. */
export function runFullPairPositionPhase(workingBodies: Body[], sortedPairs: readonly PositionPair[],
  options: FullPairPositionOptions = {}): { stats: FullPairPositionStats; attempt: FullPairPositionAttempt } {
  const stats = zeroFullPairPositionStats();
  const attempt: FullPairPositionAttempt = {
    preBodies: [], pairs: [], initialDetections: [], pairObservations: [], problem: null,
    rowSources: [], result: null, hypotheticalBodies: null, rounding: null,
    finalPairObservations: [], failurePair: null, workingApplicationCount: 0, error: null,
  };
  const capture: FullPairProblemBuild = {
    problem: { bodies: [], rows: [] }, rowSources: attempt.rowSources,
    initialDetections: attempt.initialDetections, pairObservations: attempt.pairObservations,
    tests: 0, hits: 0, signedPreQueries: 0,
  };
  const updatePreStats = (): void => {
    stats.tests = capture.tests;
    stats.hits = capture.hits;
    stats.rows = capture.problem.rows.length;
    stats.signedPreQueries = capture.signedPreQueries;
  };
  try {
    checkedFullPairInputs(workingBodies, sortedPairs);
    attempt.preBodies = workingBodies.map(copyBody);
    attempt.pairs = sortedPairs.map(([a, b]) => [a, b] as PositionPair);
    capture.problem.bodies = attempt.preBodies.map(b => ({ id: b.id, inverseMass: b.inverseMass }));
    attempt.problem = capture.problem;
    buildFullPairProblem(attempt.preBodies, attempt.pairs, capture);
    updatePreStats();
    const problem = validateFullPairProblem(capture.problem) as FullPairProblem;
    stats.solverCalls++;
    const raw = (options.solve ?? solveFullPairPosition)(structuredClone(problem)) as FullPairResult;
    // Malformed results never become a usable answer or a typed solve-status claim.
    const checked = validateFullPairResult(problem, raw) as FullPairResult;
    attempt.result = checked;
    stats.solverCounters = structuredClone(checked.counters);
    if (checked.status === 'INFEASIBLE') refuse('INFEASIBLE');
    if (checked.status === 'NUMERIC_UNSAFE') refuse('NUMERIC_UNSAFE');
    if (checked.status === 'WORK_LIMIT') refuse('WORK_LIMIT');
    if (checked.status !== 'SOLVED' || checked.ok !== true) refuse('RESULT');
    stats.maxTranslationM = Math.max(0, ...checked.translations.map(t => Math.hypot(...t.u)));
    stats.certificate = structuredClone(checked.certificate);
    const applied = applyFullPairTranslationsOnce(attempt.preBodies, problem, checked);
    attempt.hypotheticalBodies = applied.bodies;
    attempt.rounding = applied.rounding;
    inspectFullPairHypothesis(applied.bodies, attempt.pairs, attempt.finalPairObservations, stats);
    attempt.failurePair = attempt.finalPairObservations.find(p => p.selection.boundM > 1e-12)?.pairKey ?? null;
    if (attempt.failurePair !== null) refuse('NONPENETRATION');
  } catch (caught) {
    updatePreStats();
    const error = mapFullPairError(caught);
    const record = errorRecord(error);
    if (attempt.failurePair === null && record.kind === 'typed-refusal' &&
      record.code === 'NUMERIC_LIMIT' && record.message === FULL_PAIR_ERRORS.RANGE) {
      attempt.failurePair = attempt.pairObservations.find(p =>
        p.selection.boundM < -10 || p.selection.boundM > 10)?.pairKey ?? null;
    }
    attempt.error = record;
    options.observeAttempt?.(structuredClone(attempt));
    throw error;
  }
  // Success callback is outside the catch. Its throw aborts without a second callback.
  options.observeAttempt?.(structuredClone(attempt));
  for (let i = 0; i < workingBodies.length; i++) if (workingBodies[i].inverseMass > 0) {
    workingBodies[i].positionM = [...attempt.hypotheticalBodies![i].positionM];
  }
  attempt.workingApplicationCount = 1;
  stats.workingApplicationCount = 1;
  return { stats: structuredClone(stats), attempt: structuredClone(attempt) };
}
