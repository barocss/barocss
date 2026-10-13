/** #1184 software-only device-loss cleanup receipt, not a physical WebGPU witness. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { EngineUVWebGPUError } from '../dist/index.js';

const source = await readFile(new URL('../src/engine-uv-webgpu-viewport.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine-uv-webgpu-viewport.ts', source, ts.ScriptTarget.ES2022, true);
const calls = [];
function collect(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'then' && node.expression.expression.getText(ast) === 'device.lost')
    calls.push(node.getText(ast));
  ts.forEachChild(node, collect);
}
collect(ast);
assert.equal(calls.length, 1, 'Find the exact original device-loss handler');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function observe(failuresOwned = [], failuresDevice = []) {
  const loss = deferred(), events = [];
  const viewport = {
    state: 'ready', terminalError: null,
    invalidate() { events.push('invalidate'); },
    releaseOwned() { events.push('owned'); return failuresOwned; },
    releaseDevice() { events.push('device'); return failuresDevice; },
    failTerminal(error) { events.push('failTerminal'); this.state = 'failed'; this.terminalError = error; },
  };
  const context = { device: { lost: loss.promise }, EngineUVWebGPUError, AggregateError };
  const attach = vm.runInNewContext('(function attach(){ ' + calls[0] + '; })', context);
  attach.call(viewport);
  return { loss, viewport, events };
}
const drain = () => new Promise(resolve => setImmediate(resolve));

test('device loss retains diagnostic and calls both cleanup stages', async () => {
  const { loss, viewport, events } = observe();
  const witness = { reason: 'destroyed' };
  loss.resolve(witness);
  await drain();
  assert.equal(viewport.state, 'lost');
  assert.equal(viewport.terminalError.code, 'DEVICE_LOST');
  assert.equal(viewport.terminalError.cause, witness);
  assert.deepEqual(events, ['invalidate', 'owned', 'device']);
});

test('device loss aggregates both cleanup refusals with original error', async () => {
  const first = new Error('buffer refused'), second = new Error('device refused');
  const { loss, viewport, events } = observe([first], [second]);
  loss.resolve({ reason: 'unknown' });
  await drain();
  assert.equal(viewport.state, 'lost');
  assert.equal(viewport.terminalError.code, 'DEVICE_LOST');
  assert.ok(viewport.terminalError.cause instanceof AggregateError);
  assert.equal(viewport.terminalError.cause.errors.length, 3);
  assert.equal(viewport.terminalError.cause.errors[0].code, 'DEVICE_LOST');
  assert.equal(viewport.terminalError.cause.errors[1], first);
  assert.equal(viewport.terminalError.cause.errors[2], second);
  assert.deepEqual(events, ['invalidate', 'owned', 'device']);
});

test('rejected device-loss observation stays on failTerminal path', async () => {
  const { loss, viewport, events } = observe();
  loss.reject(new Error('loss observation rejected'));
  await drain();
  assert.equal(viewport.state, 'failed');
  assert.equal(viewport.terminalError.code, 'DEVICE_LOST');
  assert.deepEqual(events, ['failTerminal']);
});
