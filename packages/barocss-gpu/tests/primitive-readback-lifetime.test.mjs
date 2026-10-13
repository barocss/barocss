/** #1512 software-only lifetime regression. No GPU device or rasterization is claimed. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/primitive-readback-lifetime.ts', import.meta.url), 'utf8');
const emitted = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { releasePrimitiveReadback } = await import('data:text/javascript;base64,' + Buffer.from(emitted).toString('base64'));

function lease(unmap = () => {}, destroy = () => {}) {
  return { buffer: { unmap, destroy }, unmapped: false, destroyed: false, failures: [] };
}

test('normal cleanup is attempted exactly once even after a late callback', () => {
  const calls = [];
  const ref = lease(() => calls.push('unmap'), () => calls.push('destroy'));
  assert.deepEqual(releasePrimitiveReadback(ref), []);
  assert.deepEqual(releasePrimitiveReadback(ref), []);
  assert.deepEqual(calls, ['unmap', 'destroy']);
  assert.equal(ref.unmapped, true);
  assert.equal(ref.destroyed, true);
  assert.deepEqual(releasePrimitiveReadback(null), []);
});

test('both cleanup failures are retained, each operation still attempted once', () => {
  const calls = [], first = new Error('unmap refused'), second = new Error('destroy refused');
  const ref = lease(
    () => { calls.push('unmap'); throw first; },
    () => { calls.push('destroy'); throw second; },
  );
  assert.deepEqual(releasePrimitiveReadback(ref), [first, second]);
  // A later finally must still observe failures from an earlier device-loss cleanup.
  assert.deepEqual(releasePrimitiveReadback(ref), [first, second]);
  assert.deepEqual(calls, ['unmap', 'destroy']);
});

test('late map completion after owner teardown cannot release buffer again', async () => {
  const calls = [];
  const ref = lease(() => calls.push('unmap'), () => calls.push('destroy'));
  let complete;
  const pendingMap = new Promise(resolve => { complete = resolve; });
  const late = pendingMap.then(() => releasePrimitiveReadback(ref));
  assert.deepEqual(releasePrimitiveReadback(ref), []);
  complete();
  assert.deepEqual(await late, []);
  assert.deepEqual(calls, ['unmap', 'destroy']);
});

test('cleanup failure receipt is independent of caller mutation', () => {
  const refused = new Error('early cleanup refused');
  const ref = lease(() => { throw refused; });
  const observed = releasePrimitiveReadback(ref);
  assert.deepEqual(observed, [refused]);
  observed.length = 0;
  assert.deepEqual(releasePrimitiveReadback(ref), [refused]);
});
