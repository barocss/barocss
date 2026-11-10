import assert from 'node:assert/strict';
import test from 'node:test';
import { localTaskCheckpointBytes } from '../src/chat/localTaskRun';
import { MAX_TASK_CHECKPOINT_BYTES } from '../src/files/taskCheckpoint';

test('D622 local checkpoint transport bounds binary bytes and retires an obsolete reader', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { location: { hostname: '127.0.0.1' } }, configurable: true });
  const request = { runKey: 'a'.repeat(64), runId: 'run', taskId: 'base', operationId: 'approve-base', acceptedSHA256: 'b'.repeat(64) };
  let response = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'application/octet-stream', 'content-length': '3' } });
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response();
  });
  try {
    assert.deepEqual(await localTaskCheckpointBytes(request, () => true), new Uint8Array([1, 2, 3]));
    assert.deepEqual(calls[0], { url: '/api/chat/task-runs/checkpoint', init: {
      method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', 'x-barocss-task-run': 'checkpoint' }, body: JSON.stringify(request),
    } });
    const invalidHeaders: HeadersInit[] = [
      { 'content-type': 'text/html', 'content-length': '3' },
      { 'content-type': 'application/octet-stream' },
      { 'content-type': 'application/octet-stream', 'content-length': String(MAX_TASK_CHECKPOINT_BYTES + 1) },
      { 'content-type': 'application/octet-stream', 'content-length': 'NaN' },
    ];
    for (const headers of invalidHeaders) {
      response = () => new Response('abc', { headers });
      await assert.rejects(localTaskCheckpointBytes(request, () => true), /invalid size or type/);
    }
    response = () => new Response('abc', { headers: { 'content-type': 'application/octet-stream', 'content-length': '4' } });
    await assert.rejects(localTaskCheckpointBytes(request, () => true), /incomplete/);
    response = () => new Response('abc', { headers: { 'content-type': 'application/octet-stream', 'content-length': '2' } });
    await assert.rejects(localTaskCheckpointBytes(request, () => true), /exceeds/);
    let cancelled = false;
    response = () => new Response(new ReadableStream({ cancel: () => { cancelled = true; } }),
      { headers: { 'content-type': 'application/octet-stream', 'content-length': '3' } });
    assert.equal(await localTaskCheckpointBytes(request, () => false), undefined);
    assert.equal(cancelled, true);
    response = () => new Response(JSON.stringify({ error: 'The selected approval changed.' }), { status: 409, headers: { 'content-type': 'application/json' } });
    await assert.rejects(localTaskCheckpointBytes(request, () => true), /selected approval changed/);
    Object.defineProperty(globalThis, 'window', { value: { location: { hostname: 'studio.example' } }, configurable: true });
    const count = calls.length;
    await assert.rejects(localTaskCheckpointBytes(request, () => true), /Open Studio on this computer/);
    assert.equal(calls.length, count);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
