// O17: scripted chat turns (shadcn's createChat) for the flow's steps that check what the chat shows, not what the tools
// build: each turn the chat server's own events — text, tool, state, reasoning, done — streamed in the browser as the
// UI message stream, with no server. The studio's end of a turn (its merge and commit, chat/useStudioChat) runs on the
// scripted turn's `done` as on a real one; what each turn would have sent is kept for the step to read. DEV only.
import { createChat } from '@shadcn/helpers/ai-sdk';
import type { ChatTransport, UIMessageChunk } from 'ai';
import type { TurnEvent } from './client';
import type { StudioMessage, TurnDone, TurnInputs } from './transport';

/** The scripted conversation: its turns' events, in order (one turn a user message), and what each turn sent. */
/** A scripted event: one of the server's, or a pause (`sleep`, ms) — a slow turn, to stop. */
export type ScriptedEvent = TurnEvent | { type: 'sleep'; ms: number };
interface Scripted { turns: readonly (readonly ScriptedEvent[])[]; sent: TurnInputs[] }
let scripted: Scripted | null = null;
export const scriptedChat = () => scripted;

/** createChat's writer, the calls used here. */
interface Writer {
  text(t: string, o?: { mode?: 'instant' }): void; reasoning(t: string, o?: { mode?: 'instant' }): void; data(p: { type: string; data: unknown; transient?: boolean }): void;
  tool(name: string, o: { dynamic: true; input: unknown; output?: unknown; errorText?: string }): void; sleep(ms: number): void;
}
/** A turn's events as the scripted chat writes them. */
function write(w: Writer, events: readonly ScriptedEvent[]) {
  for (const e of events) {
    if (e.type === 'sleep') w.sleep(e.ms);
    else if (e.type === 'text') w.text(e.delta, { mode: 'instant' });
    else if (e.type === 'reasoning') w.reasoning(e.delta, { mode: 'instant' });
    else if (e.type === 'tool') w.tool(e.name, { dynamic: true, input: e.input, ...(e.isError ? { errorText: e.summary } : { output: { summary: e.summary } }) });
    else if (e.type === 'state') w.data({ type: 'data-state', data: e, transient: true });
    else w.data({ type: 'data-done', data: e, transient: true });
  }
}

/** The scripted turns as a transport: the n-th user message answered by the n-th turn. */
export function scriptedTransport(s: Scripted): ChatTransport<StudioMessage> {
  const chat = createChat();
  return chat.transport({ delayMs: undefined, fallback: ({ writer, messages }) => {
    const n = messages.filter(m => m.role === 'user').length - 1;
    write(writer as unknown as Writer, s.turns[n] ?? [{ type: 'done', end: 'error', error: `no scripted turn ${n + 1}` }]);
  } }) as unknown as ChatTransport<StudioMessage>;
}

/**
 * A turn's chunks with the studio's end run on its `done`: its notices written before the `done`, as StudioTransport does.
 * Stopped before its `done`, the turn ends as an aborted one (the server's turn would say so).
 */
export function withTurnEnd(stream: ReadableStream<UIMessageChunk>, after: (done: TurnDone) => Promise<readonly string[]>, signal?: AbortSignal): ReadableStream<UIMessageChunk> {
  let ended = false;
  const end = (done: TurnDone) => { ended = true; return after(done); };
  signal?.addEventListener('abort', () => { if (!ended) void end({ type: 'done', end: 'aborted' }); }, { once: true });
  return stream.pipeThrough(new TransformStream<UIMessageChunk, UIMessageChunk>({
    async transform(chunk, out) {
      if (chunk.type === 'data-done' && !ended) for (const text of await end((chunk as { data: TurnDone }).data)) out.enqueue({ type: 'data-notice', data: { text } } as UIMessageChunk);
      out.enqueue(chunk);
    },
  }));
}

declare global { interface Window { __studioScriptChat?(turns: readonly (readonly ScriptedEvent[])[]): void; __studioChatSent?(): TurnInputs[]; __studioUnscriptChat?(): void } }
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__studioScriptChat = turns => { scripted = { turns, sent: [] }; };
  window.__studioChatSent = () => scripted?.sent ?? [];
  window.__studioUnscriptChat = () => { scripted = null; };
}
