import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { createChatServer } from '../server/chatServer';
import { turnEventsOf } from '../server/turnEvents';
import { TurnChunker } from '../src/chat/transport';
import type { TurnEvent } from '../src/chat/client';

// O17c: the model's thinking as the chat server's `reasoning` event (additive), from a synthetic CLI recording
// (test/fixtures/thinking-claude.mjs: the CLI's stream-json thinking_delta lines) — unverified against the live CLI.
// The event's other readers, the A/B harness and the robot L3 run, take events by type: with a reasoning event among
// them, their tools and done are what they were. The transport writes it as one reasoning part before the text.

const root = process.cwd(), ORIGIN = 'http://o17c.localhost';
async function turn(claude: string): Promise<string> {
  const handler = createChatServer({ claude, mcpScript: '/nonexistent/cadMcp.mjs', workDir: mkdtempSync(join(tmpdir(), 'o17c-')), origins: [ORIGIN] });
  const server: Server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
  try {
    const r = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/turn`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ text: 'a plate', doc: emptyDoc(), autonomy: 2 }) });
    return await r.text();
  } finally { await new Promise<void>(res => server.close(() => res())); }
}

test('O17c: the CLI\'s thinking deltas stream as reasoning events, before the text; nothing else becomes one', async () => {
  const events = turnEventsOf(await turn(join(root, 'test/fixtures/thinking-claude.mjs')));
  assert.deepEqual(events.map(e => e.type), ['reasoning', 'reasoning', 'text', 'done']);
  assert.deepEqual(events.slice(0, 3).map(e => e.delta), ['The part is a plate; ', 'a box will do.', 'A box, then.']);
  assert.equal(events[3].end, 'done');
});

test('O17c: the A/B harness and the robot L3 run read the same tools and done with reasoning events among them', () => {
  // (Their reading, as each does it: tools = the tool events, done = the done event; on the ok recording with a
  // reasoning event put before every event.)
  const raw = readFileSync(join(root, 'test/fixtures/o17/ok.sse'), 'utf8');
  const withReasoning = raw.split('\n\n').filter(Boolean).map(b => `event: reasoning\ndata: ${JSON.stringify({ type: 'reasoning', delta: 'thinking…' })}\n\n${b}`).join('\n\n') + '\n\n';
  const read = (text: string) => { const ev = turnEventsOf(text); return { tools: ev.filter(e => e.type === 'tool').map(e => ({ name: String(e.name), isError: !!e.isError })), done: ev.find(e => e.type === 'done') }; };
  assert.equal(turnEventsOf(withReasoning).filter(e => e.type === 'reasoning').length, 7);
  assert.deepEqual(read(withReasoning), read(raw));
  assert.equal(read(raw).tools.length, 3);
});

test('O17c: the transport writes a reasoning run as one reasoning part, closed before the text starts', () => {
  const k = new TurnChunker(), ev: Exclude<TurnEvent, { type: 'done' }>[] = [{ type: 'reasoning', delta: 'a ' }, { type: 'reasoning', delta: 'b' }, { type: 'text', delta: 'c' }];
  const chunks = [...ev.flatMap(e => k.chunks(e)), ...k.end({ type: 'done', end: 'done' })];
  assert.deepEqual(chunks.map(c => c.type), ['reasoning-start', 'reasoning-delta', 'reasoning-delta', 'reasoning-end', 'text-start', 'text-delta', 'text-end', 'data-done', 'finish']);
  assert.deepEqual(chunks.filter(c => c.type === 'reasoning-delta').map(c => (c as { delta: string }).delta), ['a ', 'b']);
});
