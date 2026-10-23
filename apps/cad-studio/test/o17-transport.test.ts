import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { eventParser, type TurnEvent } from '../src/chat/client';
import { StudioTransport, type StudioChunk } from '../src/chat/transport';

// O17: the chat transport against turns the real chat server streamed (recorded from scripts/chat-server.mjs with the
// scripted CLI and the real tool server, 2026-10-24; test/fixtures/o17): ok (a box, a hole, an unknown command, the
// text), error (the CLI exiting at once) and aborted (a slow turn stopped after its first call). Each recording, cut
// into pieces of any size, gives the same chunks: the events in order, each tool call one dynamic tool part with its
// output or error, the states transient, the end finish / error / abort.

const root = process.cwd();
const recording = (name: string) => readFileSync(join(root, 'test/fixtures/o17', name));
const events = (bytes: Uint8Array): TurnEvent[] => { const out: TurnEvent[] = [], parse = eventParser(e => out.push(e)); parse(new TextDecoder().decode(bytes)); parse('\n\n'); return out; };
const inputs = () => ({ doc: emptyDoc(), autonomy: 2, turns: ['make it'] });
const sent: { url: string; body: Record<string, unknown> }[] = [];

/** fetch answered with the recording's bytes in pieces of `size`; `hold`: then wait for the abort, as a slow turn. */
function serve(bytes: Uint8Array, size: number, hold = false) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init.body)) });
    const signal = init.signal;
    const body = new ReadableStream<Uint8Array>({
      async start(c) {
        for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
        if (!hold) { c.close(); return; }
        await new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true }));
        c.error(new DOMException('The operation was aborted.', 'AbortError'));
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
}
async function chunksOf(stream: ReadableStream<StudioChunk>, onChunk?: (c: StudioChunk) => void): Promise<StudioChunk[]> {
  const out: StudioChunk[] = [], reader = stream.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) return out; out.push(value); onChunk?.(value); }
}
const userMessage = (text: string) => [{ role: 'user', parts: [{ type: 'text', text }] }];

test('O17: the ok turn — three calls (one refused), the states, the text — as the same chunks in pieces of any size', async () => {
  const bytes = recording('ok.sse'), ev = events(bytes);
  assert.deepEqual(ev.map(e => e.type), ['tool', 'state', 'tool', 'state', 'tool', 'text', 'done']);
  const [box, s1, hole, s2, bad, text, done] = ev as [Extract<TurnEvent, { type: 'tool' }>, Extract<TurnEvent, { type: 'state' }>, Extract<TurnEvent, { type: 'tool' }>, Extract<TurnEvent, { type: 'state' }>, Extract<TurnEvent, { type: 'tool' }>, Extract<TurnEvent, { type: 'text' }>, Extract<TurnEvent, { type: 'done' }>];
  const want: StudioChunk[] = [
    { type: 'start' },
    { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'features', input: box.input, dynamic: true },
    { type: 'tool-output-available', toolCallId: 'call-1', output: { summary: box.summary }, dynamic: true },
    { type: 'data-state', data: s1, transient: true },
    { type: 'tool-input-available', toolCallId: 'call-2', toolName: 'features', input: hole.input, dynamic: true },
    { type: 'tool-output-available', toolCallId: 'call-2', output: { summary: hole.summary }, dynamic: true },
    { type: 'data-state', data: s2, transient: true },
    { type: 'tool-input-available', toolCallId: 'call-3', toolName: 'features', input: bad.input, dynamic: true },
    { type: 'tool-output-error', toolCallId: 'call-3', errorText: bad.summary, dynamic: true },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text.delta },
    { type: 'text-end', id: 'text-1' },
    { type: 'data-done', data: done, transient: true },
    { type: 'finish' },
  ];
  assert.ok(bad.isError && !box.isError && !hole.isError);
  for (const size of [1, 7, 64, bytes.length]) {
    serve(bytes, size);
    const got = await chunksOf(await new StudioTransport({ inputs }).sendMessages({ messages: userMessage('make it') }));
    assert.equal(JSON.stringify(got), JSON.stringify(want), `pieces of ${size}`);
  }
  // (The request as runServerTurn has always sent it: the last user message's text with the panel's inputs.)
  const last = sent[sent.length - 1];
  assert.equal(last.url, '/api/chat/turn');
  assert.deepEqual([last.body.text, last.body.autonomy, last.body.turns], ['make it', 2, ['make it']]);
});

test('O17: the error turn ends as an error chunk with the server\'s reason, its done kept as data', async () => {
  serve(recording('error.sse'), 5);
  const got = await chunksOf(await new StudioTransport({ inputs }).sendMessages({ messages: userMessage('x') }));
  assert.deepEqual(got.map(c => c.type), ['start', 'data-done', 'error']);
  assert.deepEqual(got[2], { type: 'error', errorText: 'claude exited with 1' });
});

test('O17: a turn stopped after its first call ends as abort, what it had streamed kept', async () => {
  serve(recording('aborted.sse'), 13, true);
  const stop = new AbortController();
  const got = await chunksOf(await new StudioTransport({ inputs }).sendMessages({ messages: userMessage('slow'), abortSignal: stop.signal }), c => { if (c.type === 'data-state') stop.abort(); });
  assert.deepEqual(got.map(c => c.type), ['start', 'tool-input-available', 'tool-output-available', 'data-state', 'data-done', 'abort']);
  assert.deepEqual((got[4] as Extract<StudioChunk, { type: 'data-done' }>).data, { type: 'done', end: 'aborted' });
});
