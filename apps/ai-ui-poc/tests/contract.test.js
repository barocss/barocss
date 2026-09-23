import test from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_FIXTURES } from '../fixtures/benchmark.js';
import { FORBIDDEN_FIXTURES } from '../fixtures/forbidden.js';
import { ALLOWED_CLASSES, validateUi } from '../src/contract.js';

const fakeResolver = (cls) => ({ css: `.${cls.replace(':', '\\:')} { display: block; }`, rootCss: '' });

test('20 fixed mock trees pass structural and class validation', () => {
  assert.equal(BENCHMARK_FIXTURES.length, 20);
  for (const fixture of BENCHMARK_FIXTURES) {
    const result = validateUi(fixture.mockTree, fakeResolver);
    assert.ok(result.tree, fixture.id);
    assert.deepEqual(result.errors, [], fixture.id);
    assert.ok(result.cssByClass.has('text-center'), fixture.id);
  }
});

test('10 forbidden inputs are rejected and attributed', () => {
  assert.equal(FORBIDDEN_FIXTURES.length, 10);
  for (const fixture of FORBIDDEN_FIXTURES) {
    const result = validateUi(fixture.mockTree, fakeResolver);
    assert.ok(result.errors.some((error) => error.code === fixture.code && error.nodeId && error.detail), fixture.id);
    if (fixture.code === 'REJECTED_CLASS') {
      assert.ok(result.tree, fixture.id);
      assert.equal(result.cssByClass.size <= ALLOWED_CLASSES.length, true);
      assert.ok(result.tree.classes.every((cls) => ALLOWED_CLASSES.includes(cls)), fixture.id);
    } else {
      assert.equal(result.tree, null, fixture.id);
      assert.equal(result.cssByClass.size, 0, fixture.id);
    }
  }
});

test('unsupported allowed class is removed and reported', () => {
  const result = validateUi(BENCHMARK_FIXTURES[0].mockTree, (cls) => cls === 'block' ? null : fakeResolver(cls));
  assert.ok(result.tree);
  assert.ok(result.errors.some((error) => error.code === 'UNSUPPORTED_CLASS' && error.detail === 'block'));
  assert.equal(result.cssByClass.has('block'), false);
});

test('unknown keys and duplicate IDs reject the complete tree', () => {
  const unknown = structuredClone(BENCHMARK_FIXTURES[0].mockTree);
  unknown.props.style = 'color:red';
  assert.equal(validateUi(unknown, fakeResolver).tree, null);
  const duplicate = structuredClone(BENCHMARK_FIXTURES[0].mockTree);
  duplicate.children[0].id = duplicate.id;
  assert.equal(validateUi(duplicate, fakeResolver).tree, null);
});
