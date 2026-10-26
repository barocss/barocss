import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError } from '../src/api';

// Model refusal only; this does not assert support for a Kernel feature pattern.
test('public linear feature pattern: a studio part refuses without changing its document or accepted result', () => {
  const accepted = part('Model feature pattern refusal').box({ w: 10, d: 10, h: 10 });
  const documentBefore = accepted.doc, bodiesBefore = accepted.bodies(), featuresBefore = accepted.features();
  const massBefore = accepted.mass({ density: 1 });
  const options = Object.freeze({ axis: 'x' as const, spacing: 16, count: 3 });
  const optionsBefore = structuredClone(options);
  assert.throws(() => accepted.linearFeaturePattern(options), error =>
    error instanceof BarocssError && error.code === 'UNAVAILABLE' &&
    error.message === '[UNAVAILABLE] linear-feature-pattern is not available in a studio part');
  assert.deepEqual(accepted.doc, documentBefore);
  assert.deepEqual(accepted.bodies(), bodiesBefore);
  assert.deepEqual(accepted.features(), featuresBefore);
  assert.deepEqual(accepted.mass({ density: 1 }), massBefore);
  assert.deepEqual(options, optionsBefore);
});
