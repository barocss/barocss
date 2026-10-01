import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestSession } from './session.mjs';
import { REQUEST_CONTRACT, requestScreen } from './scenario.mjs';

const id = '11111111-2222-4333-8444-555555555555';
const input = (name = '민지', topic = '커피') => ({ draft: { name, topic } });
const response = (request, spec = requestScreen(request.target, request.input)) => ({
  sessionId: request.sessionId, revision: request.revision, requestId: request.requestId, specJson: JSON.stringify(spec),
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const create = (generate, extra = {}) => createRequestSession({ generate, createId: () => id, ...extra });
const action = (session, name, overrides = {}) => {
  const { sessionId, revision } = session.snapshot();
  return session.action({ sessionId, revision, action: name, ...overrides });
};
const update = (session, value) => {
  const { sessionId, revision } = session.snapshot();
  return session.updateInput({ sessionId, revision, input: value });
};
async function start(session) {
  assert.equal(session.start({ input: input() }).status, 202);
  await session.settled();
  assert.equal(session.snapshot().phase, 'ready');
}

test('authored five-display flow retains revised Korean fields in one correlated session', async () => {
  const calls = [];
  const session = create((request) => { calls.push(structuredClone({ ...request, signal: undefined })); return response(request); });
  await start(session);
  assert.equal(action(session, 'review').status, 202); await session.settled();
  assert.equal(action(session, 'edit').status, 202); await session.settled();
  const changed = input('민지', '차 두 잔');
  assert.equal(update(session, changed).status, 200);
  changed.draft.topic = 'Caller mutation';
  assert.equal(action(session, 'review').status, 202); await session.settled();
  assert.equal(action(session, 'confirm').status, 202); await session.settled();
  const final = session.snapshot();
  assert.equal(final.stage, 'confirmed');
  assert.equal(final.displays, 5);
  assert.equal(final.revision, 5);
  assert.deepEqual(final.input, input('민지', '차 두 잔'));
  assert.equal(final.spec.elements['topic-summary'].props.text, 'topic: 차 두 잔');
  assert.equal(final.spec.elements['name-summary'].props.text, 'name: 민지');
  assert.deepEqual(calls.map((call) => call.action), [null, 'review', 'edit', 'review', 'confirm']);
  assert.deepEqual(calls.map((call) => call.revision), [0, 1, 2, 3, 4]);
  assert(calls.every((call) => call.sessionId === id));
  assert.equal(new Set(calls.map((call) => call.requestId)).size, 5);
  assert.deepEqual(calls[3].input, input('민지', '차 두 잔'));
  assert.deepEqual(calls[4].input, input('민지', '차 두 잔'));
  assert.equal(action(session, 'review').status, 409);
  assert.equal(calls.length, 5);
});

test('simultaneous submissions dispatch once; active exposure and host transitions restrict actions', async () => {
  const late = deferred(), calls = [];
  const session = create((request) => { calls.push(request); return request.kind === 'initial' ? response(request) : late.promise; });
  await start(session);
  assert.equal(action(session, 'confirm').status, 409); // Declared, but absent from the form.
  assert.equal(action(session, 'pay').status, 400);
  assert.equal(action(session, 'review', { revision: 0 }).status, 409);
  assert.equal(action(session, 'review', { sessionId: 'unexpected' }).status, 409);
  assert.equal(action(session, 'review').status, 202);
  assert.equal(action(session, 'review').status, 409);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(update(session, input('other')).status, 409);
  const wait = session.settled(); late.resolve(response(calls[1])); await wait;
  assert.equal(action(session, 'review').status, 409);
  assert.equal(update(session, input('other')).status, 409);
  assert.equal(calls.length, 2);
});

test('malformed host declarations and bounded input reject before dispatch', async () => {
  let calls = 0;
  const generate = (request) => { calls++; return response(request); };
  for (const contract of [null, {}, { ...REQUEST_CONTRACT, actions: ['review'] },
    { ...REQUEST_CONTRACT, textBindings: ['/draft/name', '/draft/__proto__'] },
    { ...REQUEST_CONTRACT, actions: ['review', 'review'] }])
    assert.throws(() => create(generate, { contract }), /Invalid host contract/);
  const session = create(generate);
  for (const value of [{}, { draft: { name: '', topic: 'Coffee' } }, input('x'.repeat(81)),
    input('Ada', 'x'.repeat(81)), { draft: { name: 'Ada', topic: 'Coffee', price: 100 } }])
    assert.equal(session.start({ input: value }).status, 400);
  assert.equal(calls, 0);
  await start(session);
  const before = session.snapshot();
  assert.equal(update(session, input('Ada', 'x'.repeat(81))).status, 400);
  assert.deepEqual(session.snapshot(), before);
  assert.equal(action(session, 'review', { parameters: { input: 'untrusted' } }).status, 400);
  assert.equal(calls, 1);
});

for (const [label, mutate, expected] of [
  ['wrong session', (result) => { result.sessionId = 'other'; }, 'Generation correlation changed'],
  ['obsolete revision', (result) => { result.revision--; }, 'Generation correlation changed'],
  ['wrong request', (result) => { result.requestId = 'other'; }, 'Generation correlation changed'],
  ['malformed JSON', (result) => { result.specJson = '{'; }, 'Generated screen is not JSON'],
  ['oversized response', (result) => { result.specJson = 'x'.repeat(32_769); }, 'Invalid generation envelope'],
  ['extra envelope field', (result) => { result.command = 'ignored'; }, 'Invalid generation envelope'],
  ['undeclared action', (result) => { const spec = JSON.parse(result.specJson); spec.elements.confirm.on.press.action = 'pay'; result.specJson = JSON.stringify(spec); }, 'Invalid generated screen'],
  ['wrong exposed transition', (result) => { const spec = JSON.parse(result.specJson); spec.elements.confirm.on.press.action = 'review'; result.specJson = JSON.stringify(spec); }, 'Screen actions do not match the host transition'],
  ['wrong authoritative summary', (result) => { const spec = JSON.parse(result.specJson); spec.elements['topic-summary'].props.text = 'topic: 커피 두 잔'; result.specJson = JSON.stringify(spec); }, 'Screen summary does not match host input'],
]) test(`${label} retains previous usable screen and data without automatic retry`, async () => {
  let calls = 0;
  const session = create((request) => { calls++; const result = response(request); if (request.kind === 'next') mutate(result); return result; });
  await start(session);
  const before = session.snapshot();
  action(session, 'review'); await session.settled();
  const failed = session.snapshot();
  assert.equal(failed.phase, 'failed'); assert.equal(failed.error, expected);
  assert.deepEqual(failed.spec, before.spec); assert.deepEqual(failed.input, before.input);
  assert.equal(failed.stage, 'form'); assert.equal(failed.revision, before.revision + 1);
  assert.equal(update(session, input('민지', '차')).status, 200);
  assert.equal(calls, 2);
  assert.equal(action(session, 'review', { revision: before.revision }).status, 409);
});

test('cancelled late result cannot replace a newer retry screen', async () => {
  const late = deferred(), calls = [];
  const session = create((request) => { calls.push(request); return calls.length === 2 ? late.promise : response(request); });
  await start(session); action(session, 'review');
  const oldWait = session.settled(); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(session.cancel().status, 200); assert.equal(calls[1].signal.aborted, true);
  assert.equal(session.snapshot().phase, 'cancelled'); assert.equal(session.snapshot().stage, 'form');
  assert.equal(update(session, input('민지', '차')).status, 200);
  action(session, 'review'); await session.settled();
  const newest = session.snapshot();
  late.resolve(response(calls[1])); await oldWait;
  assert.deepEqual(session.snapshot(), newest);
  assert.equal(newest.spec.elements['topic-summary'].props.text, 'topic: 차');
  assert.equal(calls.length, 3);
});

test('restart invalidates delayed work, old revisions and old session actions', async () => {
  const late = deferred(), calls = [];
  let identity = 0;
  const session = create((request) => { calls.push(request); return calls.length === 2 ? late.promise : response(request); },
    { createId: () => identity++ ? 'aaaaaaaa-2222-4333-8444-555555555555' : id });
  await start(session); const old = session.snapshot(); action(session, 'review');
  const oldWait = session.settled(); await new Promise((resolve) => setImmediate(resolve));
  session.restart(); assert.equal(calls[1].signal.aborted, true); await start(session);
  const newest = session.snapshot();
  late.resolve(response(calls[1])); await oldWait;
  assert.deepEqual(session.snapshot(), newest);
  assert.equal(action(session, 'review', { sessionId: old.sessionId, revision: old.revision }).status, 409);
  assert.equal(calls.length, 3);
});

test('transport mutation, thrown secret details and caller snapshots cannot change host authority', async () => {
  const session = create((request) => {
    const result = response(request);
    request.input.draft.topic = 'transport mutation';
    if (request.kind === 'next') throw new Error('private credential details');
    return result;
  });
  await start(session);
  const forged = session.snapshot(); forged.input.draft.topic = 'caller mutation';
  forged.spec.elements.review.on.press.action = 'confirm';
  action(session, 'review'); await session.settled();
  assert.equal(session.snapshot().error, 'Generation failed');
  assert.deepEqual(session.snapshot().input, input());
  assert.equal(update(session, input('민지', '차')).status, 200);
});

test('cancellation before dispatch starts no generation and requires explicit restart', async () => {
  let calls = 0;
  const session = create((request) => { calls++; return response(request); });
  assert.equal(session.start({ input: input() }).status, 202);
  const wait = session.settled(); session.cancel(); await wait;
  assert.equal(calls, 0); assert.equal(session.snapshot().spec, null);
  assert.equal(session.start({ input: input() }).status, 409);
  session.restart(); await start(session); assert.equal(calls, 1);
});
