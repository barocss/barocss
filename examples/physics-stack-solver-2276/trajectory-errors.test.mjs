import assert from 'node:assert/strict';
import test from 'node:test';
import { requireResolvedReference, retainExecutionFailure } from './trajectory-errors.mjs';

test('an earlier physical failure cannot hide a later execution error', () => {
  const first = { kind: 'independent-contact-geometry', step: 2 };
  const result = retainExecutionFailure(first, new Error('reference pipe lost'), 2);
  assert.equal(result.failure, first);
  assert.deepEqual(result.executionFailure, { kind: 'execution-failure', step: 2, name: 'Error', message: 'reference pipe lost' });
});
test('an execution error without an earlier failure is the primary failure', () => {
  const result = retainExecutionFailure(null, new RangeError('invalid reference'), 1);
  assert.equal(result.failure, result.executionFailure);
  assert.equal(result.executionFailure.name, 'RangeError');
});
test('resolved physical rejection differs from an unresolved reference envelope', () => {
  assert.doesNotThrow(() => requireResolvedReference({ ok: false, resolved: true, executionFailure: false }, 'contact'));
  for (const reply of [null, {}, { resolved: false, executionFailure: true }, { resolved: true, executionFailure: true }]) {
    assert.throws(() => requireResolvedReference(reply, 'contact'), /Independent contact unresolved/);
  }
});
