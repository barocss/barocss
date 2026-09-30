import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';
import { createDelivery } from './delivery.mjs';
import { consumeStdio } from './stdio.mjs';

const ids = { processId: 'process-1', threadId: 'thread-1', turnId: 'turn-1' };
const envelope = (spec = INITIAL) => JSON.stringify({ specJson: JSON.stringify(spec) });
const event = (method, params) => `${JSON.stringify({ method, params })}\n`;
const startEvent = () => event('turn/started', { threadId: ids.threadId,
  turn: { id: ids.turnId, status: 'inProgress' } });
const itemStart = () => event('item/started', { threadId: ids.threadId, turnId: ids.turnId,
  startedAtMs: 0, item: { id: 'message-1', type: 'agentMessage' } });
const delta = (text) => event('item/agentMessage/delta', { threadId: ids.threadId,
  turnId: ids.turnId, itemId: 'message-1', delta: text });
const itemEnd = (text) => event('item/completed', { threadId: ids.threadId,
  turnId: ids.turnId, completedAtMs: 1,
  item: { id: 'message-1', type: 'agentMessage', phase: 'final_answer', text } });
const turnEnd = (status = 'completed', text = envelope()) => event('turn/completed', { threadId: ids.threadId,
  turn: { id: ids.turnId, status, items: [
    { id: 'message-1', type: 'agentMessage', phase: 'final_answer', text },
  ] } });

test('split UTF-8 and JSON produce preview, action-ready, then committed screen', () => {
  const actions = [];
  let elapsed = 0;
  const delivery = createDelivery({ clock: () => elapsed, onAction: (value) => actions.push(value) });
  assert.equal(delivery.start(ids).ok, true);
  assert.equal(delivery.push(startEvent() + itemStart(), ids.processId).ok, true);
  const spec = structuredClone(INITIAL);
  spec.elements.heading.props.text = '안녕하세요';
  const raw = envelope(spec);
  elapsed = 12;
  const first = Math.floor(raw.length / 3);
  assert.equal(delivery.push(delta(raw.slice(0, first)), ids.processId).ok, true);
  assert.equal(delivery.snapshot().phase, 'generating');
  elapsed = 30;
  const bytes = new TextEncoder().encode(delta(raw.slice(first)));
  const split = bytes.indexOf(0xec) + 1;
  assert.equal(delivery.push(bytes.subarray(0, split), ids.processId).ok, true);
  assert.equal(delivery.snapshot().phase, 'generating');
  assert.equal(delivery.push(bytes.subarray(split), ids.processId).ok, true);
  assert.equal(delivery.snapshot().phase, 'preview');
  assert.equal(delivery.snapshot().previewMs, 30);
  assert.equal(delivery.action({ revision: 1, name: 'Bea' }).ok, false);
  elapsed = 35;
  assert.equal(delivery.push(itemEnd(raw), ids.processId).ok, true);
  assert.equal(delivery.snapshot().phase, 'action-ready');
  assert.equal(delivery.snapshot().actionReadyMs, 35);
  assert.deepEqual(delivery.action({ revision: 1, name: 'Bea' }), { ok: true, queued: true });
  assert.deepEqual(actions, []);
  elapsed = 44;
  assert.equal(delivery.push(turnEnd('completed', raw), ids.processId).ok, true);
  assert.equal(delivery.finish(ids.processId).ok, true);
  const state = delivery.snapshot();
  assert.equal(state.phase, 'committed');
  assert.equal(state.completedMs, 44);
  assert.equal(state.inputName, 'Bea');
  assert.deepEqual(state.visibleSpec, spec);
  assert.deepEqual(actions, [{ action: 'save', revision: 1, name: 'Bea', ...ids }]);
  assert.equal(delivery.action({ revision: 1, name: 'Bea' }).ok, false);
});

test('invalid completed screen never replaces the last committed screen', () => {
  const delivery = createDelivery();
  delivery.start(ids);
  const valid = envelope();
  delivery.push(startEvent() + itemStart() + delta(valid) + itemEnd(valid) + turnEnd(), ids.processId);
  assert.equal(delivery.snapshot().phase, 'committed');
  const second = { processId: 'process-2', threadId: ids.threadId, turnId: 'turn-2' };
  delivery.start(second);
  const bad = structuredClone(INITIAL);
  bad.elements.card.props.className = 'fixed';
  const badText = envelope(bad);
  const base = { threadId: second.threadId, turnId: second.turnId };
  delivery.push(event('item/started', { ...base, startedAtMs: 0,
    item: { id: 'message-2', type: 'agentMessage' } }), second.processId);
  delivery.push(event('item/agentMessage/delta', { ...base, itemId: 'message-2', delta: badText }), second.processId);
  const result = delivery.push(event('item/completed', { ...base, completedAtMs: 1,
    item: { id: 'message-2', type: 'agentMessage', text: badText } }), second.processId);
  assert.equal(result.reason, 'invalid-screen');
  assert.equal(delivery.snapshot().phase, 'failed');
  assert.deepEqual(delivery.snapshot().visibleSpec, INITIAL);
  assert.equal(delivery.action({ revision: 2, name: 'Bea' }).ok, false);
});

test('changed IDs, malformed events, and incomplete transport fail closed', () => {
  for (const bad of [
    event('item/agentMessage/delta', { threadId: 'other', turnId: ids.turnId, itemId: 'message-1', delta: 'x' }),
    event('item/agentMessage/delta', { threadId: ids.threadId, turnId: 'other', itemId: 'message-1', delta: 'x' }),
    event('item/agentMessage/delta', { turnId: ids.turnId, itemId: 'message-1', delta: 'x' }),
    event('item/agentMessage/delta', { threadId: ids.threadId, itemId: 'message-1', delta: 'x' }),
    event('turn/completed', { turn: { id: ids.turnId, status: 'completed' } }),
    '{bad}\n',
  ]) {
    const delivery = createDelivery();
    delivery.start(ids);
    delivery.push(itemStart(), ids.processId);
    assert.equal(delivery.push(bad, ids.processId).ok, false);
    assert.equal(delivery.snapshot().phase, 'failed');
  }
  const delivery = createDelivery();
  delivery.start(ids);
  delivery.push(itemStart() + delta(envelope().slice(0, 5)), ids.processId);
  assert.equal(delivery.finish(ids.processId).reason, 'transport-incomplete');
});

test('cancel and restart ignore stale chunks and preserve input and committed screen', () => {
  const delivery = createDelivery();
  delivery.start(ids);
  const raw = envelope();
  delivery.push(itemStart() + delta(raw) + itemEnd(raw) + turnEnd(), ids.processId);
  delivery.action({ revision: 1, name: 'Zoë' });
  const next = { processId: 'process-2', threadId: ids.threadId, turnId: 'turn-2' };
  delivery.start(next);
  assert.equal(delivery.cancel().ok, true);
  assert.equal(delivery.snapshot().inputName, 'Zoë');
  assert.deepEqual(delivery.snapshot().visibleSpec, INITIAL);
  const restarted = { processId: 'process-3', threadId: 'thread-3', turnId: 'turn-3' };
  assert.equal(delivery.start(restarted).ok, true);
  assert.equal(delivery.push(delta(raw), next.processId).reason, 'stale-process');
  assert.equal(delivery.snapshot().phase, 'generating');
  assert.equal(delivery.snapshot().inputName, 'Zoë');
});

test('a queued action is dropped if final completion fails', () => {
  const actions = [];
  const delivery = createDelivery({ onAction: (action) => actions.push(action) });
  const raw = envelope();
  delivery.start(ids);
  delivery.push(itemStart() + delta(raw) + itemEnd(raw), ids.processId);
  assert.equal(delivery.action({ revision: 1, name: 'Bea' }).queued, true);
  assert.equal(delivery.push(turnEnd('failed'), ids.processId).reason, 'turn-incomplete');
  assert.deepEqual(actions, []);
  assert.equal(delivery.snapshot().phase, 'failed');
});

test('duplicate completion in one or later chunks cannot commit twice', () => {
  for (const coalesced of [true, false]) {
    const actions = [];
    const delivery = createDelivery({ onAction: (action) => actions.push(action) });
    const raw = envelope();
    delivery.start(ids);
    delivery.push(itemStart() + delta(raw) + itemEnd(raw), ids.processId);
    delivery.action({ revision: 1, name: 'Bea' });
    const first = turnEnd('completed', raw);
    if (coalesced) {
      assert.equal(delivery.push(first + first, ids.processId).reason, 'event-after-terminal');
    } else {
      assert.equal(delivery.push(first, ids.processId).ok, true);
      assert.equal(delivery.push(first, ids.processId).reason, 'event-after-terminal');
    }
    assert.equal(delivery.snapshot().phase, 'failed');
    assert.equal(delivery.snapshot().revision, 1);
    assert.equal(actions.length, 1);
  }
});

test('authoritative turn item mismatch drops queued action and retains committed screen', () => {
  const actions = [];
  const delivery = createDelivery({ onAction: (action) => actions.push(action) });
  const raw = envelope();
  delivery.start(ids);
  delivery.push(itemStart() + delta(raw) + itemEnd(raw), ids.processId);
  delivery.action({ revision: 1, name: 'Bea' });
  const changedSpec = structuredClone(INITIAL);
  changedSpec.elements.heading.props.text = 'Changed final';
  const changed = envelope(changedSpec);
  assert.equal(delivery.push(turnEnd('completed', changed), ids.processId).reason, 'final-item-mismatch');
  assert.equal(delivery.snapshot().phase, 'failed');
  assert.equal(delivery.snapshot().revision, 0);
  assert.equal(delivery.snapshot().visibleSpec, null);
  assert.deepEqual(actions, []);
});

test('local stdio chunks reach the same validator without a model', async () => {
  const stream = new PassThrough();
  const delivery = createDelivery();
  delivery.start(ids);
  const text = envelope();
  const run = consumeStdio(stream, delivery, ids.processId);
  const bytes = new TextEncoder().encode(startEvent() + itemStart() + delta(text)
    + itemEnd(text) + turnEnd());
  for (let offset = 0; offset < bytes.length; offset += 7) {
    stream.write(bytes.subarray(offset, offset + 7));
  }
  stream.end();
  assert.equal((await run).ok, true);
  assert.equal(delivery.snapshot().phase, 'committed');
});
