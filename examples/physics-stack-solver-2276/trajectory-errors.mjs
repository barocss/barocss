import { describeThrown } from '../physics-rigid-full-pair-position-world/archive.mjs';

export function requireResolvedReference(reply, label) {
  if (reply?.resolved !== true || reply?.executionFailure !== false) {
    throw new Error('Independent ' + label + ' unresolved: ' + JSON.stringify(reply));
  }
}
export function retainExecutionFailure(firstFailure, error, step) {
  const executionFailure = { kind: 'execution-failure', step, ...describeThrown(error) };
  return { failure: firstFailure ?? executionFailure, executionFailure };
}
