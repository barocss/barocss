/** #1512 software-only timeout regression; does not instantiate a real GPU. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real private helper without exporting a new public GPU API.
const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('webgpu-primitive-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const implementations = file.statements.filter(
  statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'bounded',
);
assert.equal(implementations.length, 1, 'Exactly one private bounded wait implementation');
const snippet = implementations[0].getText(file);
const script = ts.transpileModule(`
class PrimitiveBackendError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const WAIT_MS = 10000;
${snippet}
globalThis.__bounded = bounded;
`, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
  const timers = new Map();
  let nextTimer = 0;
  const context = {
    Promise, Error,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(script, context, { timeout: 2000 });
  return {
    bounded: context.__bounded,
    get pendingTimers() { return timers.size; },
    expire() {
      assert.equal(timers.size, 1, 'Exactly one outstanding timer');
      const [callback] = timers.values(); timers.clear(); callback();
    },
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('normal completion clears timeout without late cleanup', async () => {
  const h = harness(), d = deferred();
  let cleanups = 0;
  const pending = h.bounded(d.promise, 'device', () => { cleanups++; });
  assert.equal(h.pendingTimers, 1);
  d.resolve('ready');
  assert.equal(await pending, 'ready');
  assert.equal(cleanups, 0);
  assert.equal(h.pendingTimers, 0);
});

test('expired wait observes a late result once without a second settlement', async () => {
  const h = harness(), d = deferred();
  let cleanups = 0;
  const pending = h.bounded(d.promise, 'device', () => { cleanups++; });
  h.expire();
  await assert.rejects(pending, error => error.code === 'STATE' && /remount required/.test(error.message));
  d.resolve('late device');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cleanups, 1);
  assert.equal(h.pendingTimers, 0);
});

test('a throwing late cleanup does not create a detached unhandled rejection', async () => {
  const h = harness(), d = deferred();
  const cleanupFailure = new Error('late destroy refused'), unhandled = [];
  let cleanups = 0;
  const onUnhandled = reason => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const pending = h.bounded(d.promise, 'device', () => { cleanups++; throw cleanupFailure; });
    h.expire();
    await assert.rejects(pending, error => error.code === 'STATE');
    d.resolve('late device');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cleanups, 1);
    assert.deepEqual(unhandled, [], 'No orphaned Promise rejection from late cleanup');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
