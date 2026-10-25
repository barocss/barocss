// Source regressions only. Execution waits for the complete API improvement group.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError } from '../src/api';
import { withProcess } from '../src/api/outputs';
import { emptyDoc } from '../src/engine/doc';
import type { Vec3 } from '@barocss/cad/api';

const value = (error: unknown) => error instanceof BarocssError && error.code === 'VALUE';

test('process pull rejects malformed tuples through the facade and helper without changing the source', () => {
  const doc = emptyDoc(), before = structuredClone(doc), p = part('fixture'), partBefore = p.doc;
  const invalid: unknown[] = [null, [], [0, 0], [0, 0, 1, 99], '001', { 0: 0, 1: 0, 2: 1, length: 3 },
    new Float64Array([0, 0, 1]), new Array(3), [0, NaN, 1], [0, Infinity, 1], [0, 0, '1'], [0, 0, Symbol('z')], [0, 0, 1n], [1, 1, 0], [0, 0, 0]];
  for (const pull of invalid) {
    assert.throws(() => withProcess(doc, 'die-casting', { pull: pull as Vec3 }), value);
    assert.throws(() => p.process('die-casting', { pull: pull as Vec3 }), value);
    assert.deepEqual(doc, before);
    assert.deepEqual(p.doc, partBefore);
  }
});

test('all six exact pull axes remain accepted and detached from caller input', () => {
  const axes: Vec3[] = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  for (const axis of axes) {
    const pull = [...axis] as [number, number, number], doc = emptyDoc(), p = part('fixture');
    const next = withProcess(doc, 'die-casting', { pull }), applied = p.process('die-casting', { pull });
    pull[0] = 99;
    assert.deepEqual(next.mould!.pull, axis);
    assert.deepEqual(applied.doc.mould!.pull, axis);
    assert.equal(doc.process, undefined);
    assert.equal(p.doc.process, undefined);
  }
  assert.equal(withProcess(emptyDoc(), 'die-casting', { pull: undefined }).mould, undefined);
});

test('invalid Symbol process and finish keep typed VALUE refusals', () => {
  const bad = Symbol('invalid') as unknown as string, doc = emptyDoc(), p = part('fixture');
  for (const call of [() => withProcess(doc, bad), () => p.process(bad),
    () => withProcess(doc, 'injection', { finish: bad }), () => p.process('injection', { finish: bad })]) assert.throws(call, value);
  assert.equal(doc.process, undefined);
  assert.equal(p.doc.process, undefined);
});
