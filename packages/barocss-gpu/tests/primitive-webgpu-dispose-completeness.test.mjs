/** #1512 software-only primitive dispose regression; no real GPU device or pixels. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { PrimitiveBackendError } from '../dist/index.js';

const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('webgpu-primitive-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const klass = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'BackendViewport');
assert.ok(klass, 'Original primitive BackendViewport class must exist');
const members = klass.members.filter(node => ts.isMethodDeclaration(node) && node.name?.getText(parsed) === 'dispose');
assert.equal(members.length, 1, 'Test exactly the original private viewport disposal path');
const snippet = `class DisposeHarness { ${members[0].getText(parsed)} }
globalThis.DisposeHarness = DisposeHarness;`;
const emitted = ts.transpileModule(snippet, {
  compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = {
  AggregateError, PrimitiveBackendError,
  wrap(code, label, cause) {
    const error = new PrimitiveBackendError(code, label);
    Object.defineProperty(error, 'cause', { value: cause, configurable: true });
    return error;
  },
};
vm.runInNewContext(emitted, context, { timeout: 2000 });
const DisposeHarness = context.DisposeHarness;

function harness({ releaseErrors = [], errors = {} } = {}) {
  const calls = [], subject = new DisposeHarness();
  subject.current = { state: 'ready' };
  subject.currentSelection = { modelId: 'original', geometryId: 'surface' };
  subject.loss = () => {};
  const step = name => {
    calls.push(name);
    if (errors[name]) throw errors[name];
  };
  subject.releaseOwned = () => { step('release'); return releaseErrors; };
  subject.canvas = { removeEventListener() { step('listener'); } };
  subject.gl = { dispose() { step('gl'); } };
  subject.context = { unconfigure() { step('context'); } };
  subject.device = { destroy() { step('device'); } };
  return { subject, calls };
}
const expected = ['release', 'listener', 'gl', 'context', 'device'];

test('successful dispose cleans every resource in order and is idempotent', () => {
  const { subject, calls } = harness();
  assert.equal(subject.dispose(), undefined);
  assert.deepEqual(calls, expected);
  assert.equal(subject.current.state, 'disposed');
  assert.equal(subject.currentSelection, null);
  assert.equal(subject.gl, null);
  assert.equal(subject.dispose(), undefined);
  assert.deepEqual(calls, expected);
});

test('cleanup errors from resources, listener, GL, context, and device do not stop peers', () => {
  const refused = [
    new Error('buffer refused'), new Error('listener refused'),
    new Error('GL refused'), new Error('context refused'), new Error('device refused'),
  ];
  const { subject, calls } = harness({
    releaseErrors: [refused[0]],
    errors: { listener: refused[1], gl: refused[2], context: refused[3], device: refused[4] },
  });
  let error;
  try { subject.dispose(); } catch (cause) { error = cause; }
  assert.ok(error instanceof PrimitiveBackendError);
  assert.equal(error.code, 'RENDER');
  assert.ok(error.cause instanceof AggregateError);
  assert.deepEqual(error.cause.errors, refused);
  assert.deepEqual(calls, expected, 'Every cleanup stage runs despite earlier failures');
  assert.equal(subject.current.state, 'disposed');
  assert.equal(subject.gl, null);
  assert.doesNotThrow(() => subject.dispose(), 'Repeated cleanup is an idempotent no-op');
  assert.deepEqual(calls, expected);
});

test('unexpected releaseOwned throw still permits context and device teardown', () => {
  const errorFromRelease = new Error('resource release exploded');
  const { subject, calls } = harness({ errors: { release: errorFromRelease } });
  assert.throws(() => subject.dispose(), error =>
    error instanceof PrimitiveBackendError &&
    error.cause instanceof AggregateError &&
    error.cause.errors.length === 1 &&
    error.cause.errors[0] === errorFromRelease);
  assert.deepEqual(calls, expected);
  assert.equal(subject.current.state, 'disposed');
});

test('pre-disposed viewport avoids any new cleanup calls', () => {
  const { subject, calls } = harness();
  subject.current.state = 'disposed';
  assert.equal(subject.dispose(), undefined);
  assert.deepEqual(calls, []);
});
