import { requireResolvedReference, retainExecutionFailure } from '../physics-stack-solver-2276/trajectory-errors.mjs';
export { requireResolvedReference };

export async function inspectAttempt(step, inspect) {
  let failure = null, executionFailure = null;
  try { await inspect(value => { failure ??= value; }); }
  catch (error) { ({ failure, executionFailure } = retainExecutionFailure(failure, error, step)); }
  return { failure, executionFailure };
}
export function throwIfExecutionFailed(outcome) {
  if (outcome.executionFailure) throw new Error('contact trajectory execution failure; both failure records retained');
}
export function executionBudgetOutcome(step, elapsedMs, limitMs) {
  if (elapsedMs <= limitMs) return null;
  const record = { kind: 'execution-wall-guard', step, limitMs };
  return { failure: record, executionFailure: record };
}
