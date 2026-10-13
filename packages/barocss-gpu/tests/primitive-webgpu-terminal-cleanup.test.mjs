/** #1512 software-only private terminal handler regression; NOT physical device loss. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { PrimitiveBackendError } from '../dist/index.js';
// Also exercise the original dispose implementation without changing the workspace manifest.
import './primitive-webgpu-dispose-completeness.test.mjs';

const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('webgpu-primitive-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const classes = file.statements.filter(node => ts.isClassDeclaration(node) && node.name?.text === 'BackendViewport');
assert.equal(classes.length, 1);
const methods = classes[0].members.filter(node => ts.isMethodDeclaration(node) && node.name?.getText(file) === 'terminal');
assert.equal(methods.length, 1, 'Use exactly the production terminal handler');
const emitted = ts.transpileModule(
  'class TerminalHarness {\n' + methods[0].getText(file) + '\n}\nglobalThis.TerminalHarness = TerminalHarness;',
  { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } },
).outputText;
const context = { PrimitiveBackendError, AggregateError, Object };
vm.runInNewContext(emitted, context, { timeout: 2000 });
const TerminalHarness = context.TerminalHarness;

function harness({ failures = [], releaseThrows = null, destroyThrows = null, state = 'ready' } = {}) {
  const calls = [], subject = new TerminalHarness();
  subject.current = { state };
  subject.releaseOwned = () => {
    calls.push('releaseOwned');
    if (releaseThrows) throw releaseThrows;
    return failures;
  };
  subject.device = { destroy() { calls.push('device.destroy'); if (destroyThrows) throw destroyThrows; } };
  return { subject, calls };
}

test('STATE terminal completes all teardown and leaves original exception intact', () => {
  const { subject, calls } = harness();
  const error = new PrimitiveBackendError('STATE', 'GPU readback timed out');
  subject.terminal(error);
  assert.equal(subject.current.state, 'failed');
  assert.deepEqual(calls, ['releaseOwned', 'device.destroy']);
  assert.equal(error.code, 'STATE');
  assert.equal(error.message, 'GPU readback timed out');
  assert.equal(error.cause, undefined);
  subject.terminal(error);
  assert.deepEqual(calls, ['releaseOwned', 'device.destroy'], 'Already-terminal viewport must not destroy twice');
});

test('returned cleanup errors and thrown destroy are attached without masking STATE', () => {
  const bufferError = new Error('buffer refused');
  const textureError = new Error('texture refused');
  const destroyError = new Error('device refused');
  const { subject, calls } = harness({ failures: [bufferError, textureError], destroyThrows: destroyError });
  const error = new PrimitiveBackendError('STATE', 'GPU submission timed out');
  subject.terminal(error);
  assert.equal(subject.current.state, 'failed');
  assert.deepEqual(calls, ['releaseOwned', 'device.destroy']);
  assert.equal(error.code, 'STATE');
  assert.equal(error.message, 'GPU submission timed out');
  assert.ok(error.cause instanceof AggregateError);
  assert.deepEqual(error.cause.errors, [bufferError, textureError, destroyError]);
});

test('prior diagnostic cause and unexpected release refusal both survive', () => {
  const originalCause = new Error('scope timeout');
  const cleanupError = new Error('release owned threw');
  const { subject, calls } = harness({ releaseThrows: cleanupError });
  const error = new PrimitiveBackendError('STATE', 'scope failed');
  Object.defineProperty(error, 'cause', { value: originalCause, configurable: true });
  subject.terminal(error);
  assert.equal(subject.current.state, 'failed');
  assert.deepEqual(calls, ['releaseOwned', 'device.destroy']);
  assert.equal(error.message, 'scope failed');
  assert.deepEqual(error.cause.errors, [originalCause, cleanupError]);
});

test('INPUT errors and already-lost viewports do not trigger terminal cleanup', () => {
  for (const [code, state] of [['INPUT', 'ready'], ['STATE', 'lost']]) {
    const { subject, calls } = harness({ state });
    subject.terminal(new PrimitiveBackendError(code, 'not a terminal timeout'));
    assert.equal(subject.current.state, state);
    assert.deepEqual(calls, []);
  }
});
