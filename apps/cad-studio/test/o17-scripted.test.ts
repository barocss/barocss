import test from 'node:test';
import assert from 'node:assert/strict';
import { Chat } from '@ai-sdk/react';
import type { ChatTransport } from 'ai';
import { scriptedTransport, withTurnEnd, type ScriptedEvent } from '../src/chat/scripted';
import type { StudioMessage, TurnDone } from '../src/chat/transport';

// O17: the flow's scripted turns (shadcn's createChat) through the AI SDK's Chat — the n-th user message answered by the
// n-th turn; the server's events as the same parts the server's turn gives; the studio's turn end run on its `done`, its
// notices in the turn's message; a turn stopped before its `done` ending as an aborted one.

function chatOf(turns: ScriptedEvent[][], notices: (d: TurnDone) => string[]) {
  const ends: TurnDone[] = [], s = { turns, sent: [] };
  const transport: ChatTransport<StudioMessage> = {
    sendMessages: async o => withTurnEnd(await scriptedTransport(s).sendMessages(o), async d => { ends.push(d); return notices(d); }, o.abortSignal),
    reconnectToStream: async () => null,
  };
  return { chat: new Chat<StudioMessage>({ transport }), ends };
}
const shape = (m: StudioMessage) => m.parts.map(p => p.type === 'text' ? `text:${p.text}` : p.type === 'dynamic-tool' ? `tool:${p.toolName}:${p.state}` : p.type === 'data-notice' ? `notice:${p.data.text}` : p.type).filter(t => t !== 'step-start');
const say = (chat: Chat<StudioMessage>, text: string) => chat.sendMessage({ role: 'user', parts: [{ type: 'text', text }] });

test('O17 scripted: turns in order, text and tool parts as the server\'s, the end run on done with its notices', async () => {
  const { chat, ends } = chatOf([
    [{ type: 'text', delta: 'Plate first.' }, { type: 'tool', name: 'features', input: { action: 'command' }, summary: 'Box', isError: false },
      { type: 'tool', name: 'features', input: { action: 'command' }, summary: 'Unknown command', isError: true }, { type: 'text', delta: 'Done.' }, { type: 'done', end: 'done', session: 's1' }],
    [{ type: 'done', end: 'error', error: 'claude exited with 1' }],
  ], d => d.end === 'error' ? [d.error!] : []);
  await say(chat, 'a plate');
  assert.deepEqual(shape(chat.messages[1]), ['text:Plate first.', 'tool:features:output-available', 'tool:features:output-error', 'text:Done.']);
  await say(chat, 'again');
  assert.deepEqual(shape(chat.messages[3]), ['notice:claude exited with 1']);
  assert.deepEqual(ends.map(d => [d.end, d.session]), [['done', 's1'], ['error', undefined]]);
});

test('O17 scripted: a slow turn stopped ends as aborted, sendMessage settles', async () => {
  const { chat, ends } = chatOf([[{ type: 'tool', name: 'features', input: {}, summary: 'Box', isError: false }, { type: 'sleep', ms: 5000 }, { type: 'done', end: 'done' }]], () => []);
  const sending = say(chat, 'slow');
  await new Promise(r => setTimeout(r, 100)); await chat.stop(); await sending;
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(ends.map(d => d.end), ['aborted']);
  assert.ok(shape(chat.messages[1]).includes('tool:features:output-available'));
});
