/** #1512 software-only observer qualification; no actual GPU or driver. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('webgpu-primitive-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const implementations = parsed.statements.filter(
  statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'observeDeviceLoss',
);
assert.equal(implementations.length, 1, 'Exercise exactly one private device-loss observer');
const snippet = implementations[0].getText(parsed);
const emitted = ts.transpileModule(
  snippet + '\nexport { observeDeviceLoss };\n',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const { observeDeviceLoss } = await import('data:text/javascript;base64,' + Buffer.from(emitted).toString('base64'));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('resolved device loss is observed exactly once', async () => {
  const d = deferred(), calls = [];
  observeDeviceLoss(d.promise, () => calls.push('lost'));
  d.resolve({ reason: 'destroyed', message: '' });
  await flush();
  assert.deepEqual(calls, ['lost']);
});

test('unexpected rejected loss promise is handled without an orphaned rejection', async () => {
  const d = deferred(), calls = [];
  observeDeviceLoss(d.promise, () => calls.push('rejected'));
  d.reject(new Error('device lost promise refused'));
  await flush();
  assert.deepEqual(calls, ['rejected']);
});

test('a throwing device-loss cleanup does not reject a detached observer promise', async () => {
  const d = deferred(), failure = new Error('GPU resource destruction failed');
  let attempts = 0;
  const unhandled = [];
  const onUnhandled = error => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    observeDeviceLoss(d.promise, () => { attempts++; throw failure; });
    d.resolve({ reason: 'unknown', message: '' });
    await flush();
    assert.equal(attempts, 1);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
