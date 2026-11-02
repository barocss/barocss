import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectAttempt, throwIfExecutionFailed, requireResolvedReference, executionBudgetOutcome } from './step-observation.mjs';

test('actual step observer retains a physical failure followed by an unresolved reference and aborts', async () => {
  const physical = { kind: 'independent-contact-geometry', step: 2 };
  const outcome = await inspectAttempt(2, async reject => {
    reject(physical); requireResolvedReference({ resolved: false, executionFailure: true }, 'position');
  });
  assert.equal(outcome.failure, physical);
  assert.equal(outcome.executionFailure.kind, 'execution-failure');
  assert.match(outcome.executionFailure.message, /position unresolved/);
  assert.throws(() => throwIfExecutionFailed(outcome), /both failure records retained/);
});
test('first execution error becomes the primary failure and aborts', async () => {
  const outcome = await inspectAttempt(1, async () => { throw new RangeError('bad archive'); });
  assert.equal(outcome.failure, outcome.executionFailure);
  assert.equal(outcome.executionFailure.name, 'RangeError');
  assert.throws(() => throwIfExecutionFailed(outcome));
});
test('resolved physical rejection stays a numerical NO_GO without an execution exception', async () => {
  const physical = { kind: 'independent-contact-geometry', step: 1 };
  const outcome = await inspectAttempt(1, async reject => {
    requireResolvedReference({ ok: false, resolved: true, executionFailure: false }, 'contact'); reject(physical);
  });
  assert.equal(outcome.failure, physical); assert.equal(outcome.executionFailure, null);
  assert.doesNotThrow(() => throwIfExecutionFailed(outcome));
});
test('execution deadline retains its explicit record and aborts rather than advancing another case', () => {
  assert.equal(executionBudgetOutcome(1, 180000, 180000), null);
  const outcome = executionBudgetOutcome(309, 180001, 180000);
  assert.equal(outcome.failure, outcome.executionFailure);
  assert.deepEqual(outcome.failure, { kind: 'execution-wall-guard', step: 309, limitMs: 180000 });
  assert.throws(() => throwIfExecutionFailed(outcome));
});
