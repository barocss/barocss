import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController } from './controller.mjs';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';

const threadId = '11111111-2222-4333-8444-555555555555';
const first = { threadId, specJson: JSON.stringify(INITIAL) };
const next = { threadId, specJson: JSON.stringify({
  root: 'layout', elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'fractional' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'spacious', tone: 'light' }, children: ['heading'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Name: Bea' }, children: [] },
  },
}) };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function until(controller, phase) {
  for (let count = 0; count < 20; count++) {
    if (controller.snapshot().phase === phase) return controller.snapshot();
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`Expected ${phase}; got ${controller.snapshot().phase}`);
}

test('validated initial screen and one action use one session and ordered revisions', async () => {
  const calls = [];
  const pending = deferred();
  const controller = createSessionController({ generate: (request) => {
    calls.push(request);
    return request.kind === 'initial' ? first : pending.promise;
  } });
  assert.deepEqual(controller.start({ prompt: 'Make a profile form' }), { ok: true, status: 202 });
  const ready = await until(controller, 'ready');
  assert.equal(ready.revision, 1);
  assert.equal(ready.turn, 1);
  assert.deepEqual(ready.spec, INITIAL);
  assert.equal(calls.length, 1);
  assert.equal(controller.action({ action: 'save', revision: 0, input: { name: 'Bea' } }).status, 409);
  assert.equal(controller.action({ action: 'save', revision: 1, input: { name: 'Bea' } }).status, 202);
  assert.equal(controller.snapshot().phase, 'action-pending');
  assert.equal(controller.snapshot().name, 'Bea');
  assert.equal(controller.action({ action: 'save', revision: 1, input: { name: 'Bea' } }).status, 409);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].threadId, threadId);
  assert.deepEqual(calls[1].input, { name: 'Bea' });
  pending.resolve(next);
  const done = await until(controller, 'ready');
  assert.equal(done.revision, 2);
  assert.equal(done.turn, 2);
  assert.equal(done.spec.elements.heading.props.text, 'Name: Bea');
  assert.equal(controller.action({ action: 'save', revision: 2, input: { name: 'Bea' } }).status, 409);
  assert.equal(calls.length, 2);
});

test('a similar name is not accepted as the entered name on the next screen', async () => {
  const similar = structuredClone(JSON.parse(next.specJson));
  similar.elements.heading.props.text = 'Name: Beatrice';
  const controller = createSessionController({ generate: ({ kind }) => kind === 'initial'
    ? first : { threadId, specJson: JSON.stringify(similar) } });
  controller.start({ prompt: 'Make a profile form' });
  await until(controller, 'ready');
  assert.equal(controller.action({ action: 'save', revision: 1, input: { name: 'Bea' } }).status, 202);
  const failed = await until(controller, 'failed');
  assert.equal(failed.error, 'Next screen must show the exact entered name');
  assert.equal(failed.revision, 1);
  assert.deepEqual(failed.spec, INITIAL);
  assert.equal(failed.name, 'Bea');
});

test('invalid requests start zero generations', async () => {
  let calls = 0;
  const controller = createSessionController({ generate: () => { calls++; return first; } });
  assert.equal(controller.start({ prompt: 'X', argv: ['--unsafe'] }).status, 400);
  assert.equal(controller.start({ prompt: '' }).status, 400);
  assert.equal(controller.action({ action: 'save', revision: 0, input: { name: 'Ada' } }).status, 409);
  assert.equal(controller.action({ action: 'fetch', revision: 0, input: { name: 'Ada' } }).status, 400);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 0);
});

test('malformed output and a changed CLI session retain the last valid screen', async () => {
  const controller = createSessionController({ generate: ({ kind }) => kind === 'initial' ? first
    : { ...next, threadId: '99999999-2222-4333-8444-555555555555' } });
  controller.start({ prompt: 'Make a profile form' });
  await until(controller, 'ready');
  controller.action({ action: 'save', revision: 1, input: { name: 'Bea' } });
  const failed = await until(controller, 'failed');
  assert.equal(failed.error, 'Session changed');
  assert.equal(failed.revision, 1);
  assert.deepEqual(failed.spec, INITIAL);
  assert.equal(failed.name, 'Bea');
  controller.restart();
  const bad = createSessionController({ generate: () => ({ threadId, specJson: '{"root":' }) });
  bad.start({ prompt: 'Make a profile form' });
  assert.equal((await until(bad, 'failed')).error, 'Generated screen is not JSON');
  const sensitive = createSessionController({ generate: () => { throw new Error('secret path /private/key'); } });
  sensitive.start({ prompt: 'Make a profile form' });
  assert.equal((await until(sensitive, 'failed')).error, 'Generation failed');
});

test('cancel and restart discard delayed results without repeating actions', async () => {
  const late = deferred();
  const calls = [];
  const controller = createSessionController({ generate: (request) => {
    calls.push(request);
    return request.kind === 'initial' ? first : late.promise;
  } });
  controller.start({ prompt: 'Make a profile form' });
  await until(controller, 'ready');
  controller.action({ action: 'save', revision: 1, input: { name: 'Bea' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(controller.cancel().status, 200);
  assert.equal(calls[1].signal.aborted, true);
  late.resolve(next);
  await new Promise((resolve) => setImmediate(resolve));
  const cancelled = controller.snapshot();
  assert.equal(cancelled.phase, 'cancelled');
  assert.equal(cancelled.revision, 1);
  assert.equal(cancelled.name, 'Bea');
  assert.deepEqual(cancelled.spec, INITIAL);
  controller.restart();
  controller.start({ prompt: 'Make a new profile form' });
  const ready = await until(controller, 'ready');
  assert.equal(ready.revision, 2);
  assert.equal(controller.action({ action: 'save', revision: 1, input: { name: 'Bea' } }).status, 409);
  assert.equal(calls.length, 3);
});
