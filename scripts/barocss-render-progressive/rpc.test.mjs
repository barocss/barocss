import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createRpc } from './rpc.mjs';

function fakeChild({ exitOnSignal = true } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.signals = [];
  child.kill = (signal) => {
    child.signals.push(signal);
    if (exitOnSignal) queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };
  return child;
}

function outgoing(child) {
  const lines = [];
  let buffer = '';
  child.stdin.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      lines.push(JSON.parse(buffer.slice(0, newline)));
      buffer = buffer.slice(newline + 1);
    }
  });
  return lines;
}

function emit(child, value) {
  child.stdout.write(Buffer.from(JSON.stringify(value) + '\n'));
}

test('correlates responses while asynchronous notifications are still processing', async () => {
  const child = fakeChild();
  const sent = outgoing(child);
  const chunks = [];
  const requests = [];
  const events = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const rpc = createRpc({ child, clock: () => 42,
    onChunk: (chunk) => chunks.push(chunk), onRequest: (request) => requests.push(request),
    onEvent: async (event) => { await gate; events.push(event); } });
  const first = rpc.request('initialize', { clientInfo: { name: 'test', version: '1' } });
  const second = rpc.request('thread/start', { model: 'fixed' });
  rpc.notify('initialized', {});
  assert.deepEqual(sent.map((value) => [value.id, value.method]),
    [[1, 'initialize'], [2, 'thread/start'], [undefined, 'initialized']]);
  assert.deepEqual(requests, [{ id: 1, method: 'initialize', sentMs: 42 },
    { id: 2, method: 'thread/start', sentMs: 42 }]);
  const notification = { method: 'thread/tokenUsage/updated', params: { threadId: 't' } };
  const wire = Buffer.from(JSON.stringify(notification) + '\n');
  child.stdout.write(wire.subarray(0, 4));
  child.stdout.write(wire.subarray(4));
  emit(child, { id: 2, result: { thread: 't' } });
  emit(child, { id: 1, result: { ready: true } });
  child.stderr.write(Buffer.from([0xff, 0x00]));
  assert.deepEqual(await second, { thread: 't' });
  assert.deepEqual(await first, { ready: true });
  assert.equal(events.length, 0);
  release();
  await rpc.drain();
  assert.equal(events.length, 1);
  assert.equal(events[0].line, JSON.stringify(notification));
  assert.equal(events[0].receivedMs, 42);
  assert.deepEqual(Buffer.concat(chunks.filter((chunk) => chunk.stream === 'stdout')
    .map((chunk) => chunk.bytes)), Buffer.concat([wire,
    Buffer.from('{"id":2,"result":{"thread":"t"}}\n'),
    Buffer.from('{"id":1,"result":{"ready":true}}\n')]));
  assert.deepEqual(chunks.at(-1), { stream: 'stderr', bytes: Buffer.from([0xff, 0x00]), receivedMs: 42 });
  child.emit('exit', 0, null);
  assert.deepEqual(await rpc.finished, { ok: false, code: 0, signal: null });
});

test('rejects unknown responses, server requests, malformed JSON and invalid UTF-8', async (t) => {
  const cases = [
    ['unknown response', Buffer.from('{"id":99,"result":{}}\n'), /Unknown RPC response/],
    ['server request', Buffer.from('{"id":2,"method":"tool/call","params":{}}\n'), /server request/],
    ['malformed JSON', Buffer.from('{bad}\n'), /Malformed RPC JSON/],
    ['invalid UTF-8', Buffer.from([0xff, 0x0a]), /Invalid UTF-8/],
  ];
  for (const [name, wire, pattern] of cases) await t.test(name, async () => {
    const child = fakeChild();
    const failures = [];
    const rpc = createRpc({ child, onFailure: (error) => failures.push(error) });
    const pending = rpc.request('initialize', {});
    child.stdout.write(wire);
    await assert.rejects(pending, pattern);
    await assert.rejects(rpc.request('turn/start', {}), pattern);
    assert.equal(failures.length, 1);
    assert.equal((await rpc.finished).ok, false);
    await rpc.close();
  });
});

test('enforces byte, line and event limits', async (t) => {
  const cases = [
    ['byte', { maxBytes: 8 }, Buffer.from('123456789'), /byte limit/],
    ['line', { maxLineBytes: 8 }, Buffer.from('123456789'), /line limit/],
    ['event', { maxEvents: 1 }, Buffer.from('{"method":"x","params":{}}\n{"method":"y","params":{}}\n'), /event limit/],
  ];
  for (const [name, limits, wire, pattern] of cases) await t.test(name, async () => {
    const child = fakeChild();
    const rpc = createRpc({ child, ...limits });
    child.stdout.write(wire);
    assert.match((await rpc.finished).error.message, pattern);
    await rpc.close();
  });
});

test('rejects pending requests on timeout, stdout EOF, and child exit', async (t) => {
  await t.test('timeout', async () => {
    const child = fakeChild();
    const rpc = createRpc({ child, requestTimeoutMs: 10 });
    await assert.rejects(rpc.request('slow', {}), /request timeout/);
    await rpc.close();
  });
  await t.test('EOF', async () => {
    const child = fakeChild();
    const rpc = createRpc({ child });
    const pending = rpc.request('slow', {});
    child.stdout.end();
    await assert.rejects(pending, /stdout ended/);
    await rpc.close();
  });
  await t.test('exit with partial line', async () => {
    const child = fakeChild();
    const rpc = createRpc({ child });
    const pending = rpc.request('slow', {});
    child.stdout.write('{"id":1');
    child.emit('exit', 1, null);
    await assert.rejects(pending, /Incomplete RPC line/);
  });
});

test('close ends stdin and terminates only its caller-owned child', async () => {
  const child = fakeChild();
  const rpc = createRpc({ child });
  const result = await rpc.close();
  assert.equal(child.stdin.writableEnded, true);
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(result.ok, true);
});
