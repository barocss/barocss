/** #1512 software-only GPU resource release tests; no actual driver is involved. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/webgpu-primitive-viewport.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('webgpu-primitive-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const methods = parsed.statements.filter(
  node => ts.isFunctionDeclaration(node) && node.name?.text === 'release',
);
assert.equal(methods.length, 1, 'Use the production primitive GPU release implementation');
const script = ts.transpileModule(methods[0].getText(parsed) + '\nexport { release };',
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { release } = await import('data:text/javascript;base64,' + Buffer.from(script).toString('base64'));

function resource(buffers, textures) {
  return { buffers, textures, pipeline: { object: true }, group: { object: true } };
}
function mock(label, events, failure) {
  return { destroy() { events.push(label); if (failure) throw failure; } };
}

test('all buffers and textures are disposed in original order once', () => {
  const calls = [];
  const r = resource([mock('b1', calls), mock('b2', calls)], [mock('t1', calls), mock('t2', calls)]);
  assert.deepEqual(release(r), []);
  assert.deepEqual(calls, ['b1', 'b2', 't1', 't2']);
  assert.deepEqual(r.buffers, []);
  assert.deepEqual(r.textures, []);
  assert.equal(r.pipeline, null);
  assert.equal(r.group, null);
  assert.deepEqual(release(r), []);
  assert.deepEqual(release(null), []);
  assert.deepEqual(calls, ['b1', 'b2', 't1', 't2']);
});

test('a throwing buffer does not skip remaining buffers or textures', () => {
  const calls = [], bad = new Error('buffer refused');
  const r = resource([mock('b1', calls, bad), mock('b2', calls)], [mock('t1', calls)]);
  assert.deepEqual(release(r), [bad]);
  assert.deepEqual(calls, ['b1', 'b2', 't1']);
  assert.deepEqual(r.buffers, []);
  assert.deepEqual(r.textures, []);
  assert.deepEqual(release(r), []);
});

test('simultaneous buffer and texture errors retain original identity and order', () => {
  const calls = [], first = new Error('buffer refused'), second = new Error('texture refused');
  const r = resource([mock('b1', calls, first), mock('b2', calls)],
    [mock('t1', calls, second), mock('t2', calls)]);
  const failures = release(r);
  assert.deepEqual(failures, [first, second]);
  assert.deepEqual(calls, ['b1', 'b2', 't1', 't2']);
  assert.deepEqual(r.buffers, []);
  assert.deepEqual(r.textures, []);
});
