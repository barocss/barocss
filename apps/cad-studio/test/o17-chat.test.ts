import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chat } from '@ai-sdk/react';
import type { ChatTransport } from 'ai';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { StudioTransport, type StudioMessage, type TurnDone } from '../src/chat/transport';

// O17: the recorded turns (test/fixtures/o17) through the AI SDK's own Chat, as useChat holds them: the messages they
// leave — the user's, then one assistant message of text runs and dynamic tool parts with their outputs or errors —
// the turn's notices kept in its message after an error and a stop, the states and the end only as data (onData), and
// sendMessage settling in every case.

const root = process.cwd();
const recording = (name: string) => readFileSync(join(root, 'test/fixtures/o17', name));
function serve(bytes: Uint8Array, hold = false) {
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const signal = init.signal;
    return new Response(new ReadableStream<Uint8Array>({
      async start(c) {
        c.enqueue(bytes);
        if (!hold) { c.close(); return; }
        await new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true }));
        c.error(new DOMException('The operation was aborted.', 'AbortError'));
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
}
function chatOf(notices: (done: TurnDone) => string[]) {
  const data: string[] = [];
  const transport = new StudioTransport({ inputs: () => ({ doc: emptyDoc(), autonomy: 2, turns: ['make it'] }), after: async done => notices(done) }) as unknown as ChatTransport<StudioMessage>;
  const chat = new Chat<StudioMessage>({ transport, onData: p => data.push(p.type) });
  return { chat, data };
}
const shape = (m: StudioMessage) => m.parts.map(p => p.type === 'text' ? `text:${p.text.length}` : p.type === 'dynamic-tool' ? `tool:${p.toolName}:${p.state}` : p.type === 'data-notice' ? `notice:${p.data.text}` : p.type);

test('O17: a turn through the AI SDK\'s Chat — text runs and tool parts in one assistant message; states and the end as data only', async () => {
  serve(recording('ok.sse'));
  const { chat, data } = chatOf(() => []);
  await chat.sendMessage({ role: 'user', parts: [{ type: 'text', text: 'make it' }] });
  assert.equal(chat.status, 'ready');
  assert.deepEqual(chat.messages.map(m => m.role), ['user', 'assistant']);
  const parts = shape(chat.messages[1]);
  assert.deepEqual(parts.filter(p => p.startsWith('tool:')), ['tool:features:output-available', 'tool:features:output-available', 'tool:features:output-error']);
  assert.ok(parts.some(p => p.startsWith('text:')), parts.join(' '));
  assert.ok(!parts.some(p => p === 'data-state' || p === 'data-done'), 'transient: not in the message');
  assert.ok(data.includes('data-state') && data.includes('data-done'), data.join(' '));
});

test('O17: an error and a stop — an error\'s notice stays in the turn\'s message; stopped, the stream is read no further; sendMessage settles', async () => {
  serve(recording('error.sse'));
  const e = chatOf(done => [done.error ?? 'The chat request failed.']);
  await e.chat.sendMessage({ role: 'user', parts: [{ type: 'text', text: 'make it' }] });
  const last = e.chat.messages[e.chat.messages.length - 1];
  assert.equal(last.role, 'assistant'); assert.ok(shape(last).some(p => p.startsWith('notice:')), shape(last).join(' '));
  serve(recording('aborted.sse'), true);
  const a = chatOf(done => [done.end === 'aborted' ? 'Stopped.' : `not stopped: ${done.end}`]);
  const sending = a.chat.sendMessage({ role: 'user', parts: [{ type: 'text', text: 'make it' }] });
  await new Promise(r => setTimeout(r, 50)); await a.chat.stop(); await sending;
  const stopped = a.chat.messages[a.chat.messages.length - 1];
  assert.equal(stopped.role, 'assistant'); assert.ok(shape(stopped).some(p => p.startsWith('tool:')), 'the call made before the stop is kept');
  // (Stopped, the Chat reads the stream no further: the hook adds a stopped turn's notices itself, chat/useStudioChat.)
  assert.ok(!shape(stopped).some(p => p.startsWith('notice:')), shape(stopped).join(' '));
});
