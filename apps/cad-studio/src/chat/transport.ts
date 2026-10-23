// O17: the studio's chat turn as an AI SDK chat transport (useChat's `transport`). Each turn POSTs /api/chat/turn as
// runServerTurn always has — the server's protocol unchanged but for O17c's one added event, which server/ab and
// robotL3 (its other readers) skip, taking events by type — and its
// server-sent events are written as the UI message stream's chunks: a run of text one text part, each tool call a
// dynamic tool part (its input and output at once: the server reports a call when its result is back), the model's
// thinking a reasoning part when the CLI streams it (O17c), the part's
// states as transient data (the previews and the turn's ops), and the turn's end as finish, error or abort.
// The chunk types are the AI SDK's own (UIMessageChunk), the kinds used here.
import type { UIMessage } from 'ai';
import { runServerTurn, type TurnEvent } from './client';

type Done = Extract<TurnEvent, { type: 'done' }>;
export type TurnDone = Done;
/** The chat's messages (O17): the AI SDK's, with the studio's data parts — a turn's states and end (transient), its
 *  notices, and a user message's row files (its name; the text travels in the transport). */
export type StudioMessage = UIMessage<unknown, { state: Extract<TurnEvent, { type: 'state' }>; done: Done; notice: { text: string }; rowfile: { name: string } }>;
/** The chunks this transport writes (the AI SDK's UIMessageChunk, those kinds). */
export type StudioChunk =
  | { type: 'start' }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown; dynamic: true }
  | { type: 'tool-output-available'; toolCallId: string; output: { summary: string }; dynamic: true }
  | { type: 'tool-output-error'; toolCallId: string; errorText: string; dynamic: true }
  | { type: 'data-state'; data: Extract<TurnEvent, { type: 'state' }>; transient: true }
  | { type: 'data-done'; data: Done; transient: true }
  /** What the turn's end says besides its text (stopped, not merged, failed): kept in the turn's message. */
  | { type: 'data-notice'; data: { text: string } }
  | { type: 'finish' }
  | { type: 'error'; errorText: string }
  | { type: 'abort' };

/**
 * One turn's events as chunks, in order. A text run stays open (one part) until a tool call, the end or `done`; tool
 * calls are numbered in the turn (the server's events carry no id).
 */
export class TurnChunker {
  private texts = 0;
  private thoughts = 0;
  private calls = 0;
  private open: string | null = null;
  private thinking: string | null = null;
  /** The chunks of one event (a `done` is `end`'s). */
  chunks(e: Exclude<TurnEvent, Done>): StudioChunk[] {
    if (e.type === 'text') {
      if (this.open) return [{ type: 'text-delta', id: this.open, delta: e.delta }];
      const before = this.closeThinking();
      this.open = `text-${++this.texts}`;
      return [...before, { type: 'text-start', id: this.open }, { type: 'text-delta', id: this.open, delta: e.delta }];
    }
    if (e.type === 'reasoning') {
      if (this.thinking) return [{ type: 'reasoning-delta', id: this.thinking, delta: e.delta }];
      const before = this.closeText();
      this.thinking = `reasoning-${++this.thoughts}`;
      return [...before, { type: 'reasoning-start', id: this.thinking }, { type: 'reasoning-delta', id: this.thinking, delta: e.delta }];
    }
    if (e.type === 'tool') {
      const id = `call-${++this.calls}`, out: StudioChunk[] = [...this.close(), { type: 'tool-input-available', toolCallId: id, toolName: e.name, input: e.input, dynamic: true }];
      out.push(e.isError ? { type: 'tool-output-error', toolCallId: id, errorText: e.summary, dynamic: true } : { type: 'tool-output-available', toolCallId: id, output: { summary: e.summary }, dynamic: true });
      return out;
    }
    return [{ type: 'data-state', data: e, transient: true }];
  }
  /** The turn's end: its open text closed, its notices, its `done` as data, then finish, error or abort. */
  end(done: Done, notices: readonly string[] = []): StudioChunk[] {
    const last: StudioChunk = done.end === 'done' ? { type: 'finish' } : done.end === 'aborted' ? { type: 'abort' } : { type: 'error', errorText: done.error ?? 'The chat request failed.' };
    return [...this.close(), ...notices.map((text): StudioChunk => ({ type: 'data-notice', data: { text } })), { type: 'data-done', data: done, transient: true }, last];
  }
  private close(): StudioChunk[] { return [...this.closeThinking(), ...this.closeText()]; }
  private closeText(): StudioChunk[] {
    if (!this.open) return [];
    const id = this.open; this.open = null;
    return [{ type: 'text-end', id }];
  }
  private closeThinking(): StudioChunk[] {
    if (!this.thinking) return [];
    const id = this.thinking; this.thinking = null;
    return [{ type: 'reasoning-end', id }];
  }
}

/** What a turn sends besides its text (runServerTurn's options): the part, the conversation, the attachments; `text`, the
 *  message as sent when it is more than the one shown (the selection and the attachments named in it). */
export type TurnInputs = Omit<Parameters<typeof runServerTurn>[0], 'text' | 'onEvent' | 'signal'> & { text?: string };
/** The messages useChat hands the transport (the fields read here). */
interface SentMessage { role: string; parts: readonly { type: string; text?: string }[] }

/**
 * The transport: the last user message's text, with `inputs(text)` (the part as it is now, the session, rows and
 * images — what the chat panel holds), sent as one turn; `after(done)`, the turn's end in the studio (its merge and
 * commit), whose notices end the turn's message. `reconnectToStream` has nothing to resume: a turn is one request.
 */
export class StudioTransport {
  constructor(private readonly o: { inputs(text: string): TurnInputs; after?(done: Done): Promise<readonly string[]> }) {}
  async sendMessages(options: { messages: readonly SentMessage[]; abortSignal?: AbortSignal }): Promise<ReadableStream<StudioChunk>> {
    const last = [...options.messages].reverse().find(m => m.role === 'user');
    const text = (last?.parts ?? []).filter(p => p.type === 'text').map(p => p.text ?? '').join('\n');
    const { text: sent, ...inputs } = this.o.inputs(text), chunker = new TurnChunker();
    return new ReadableStream<StudioChunk>({
      start: async controller => {
        // (Stopped, the reader cancels the stream and reads no further: the turn still ends here, written to nothing.)
        let reading = true;
        const put = (c: StudioChunk) => { if (reading) try { controller.enqueue(c); } catch { reading = false; } };
        put({ type: 'start' });
        const done = await runServerTurn({ ...inputs, text: sent ?? text, signal: options.abortSignal, onEvent: e => { for (const c of chunker.chunks(e as Exclude<TurnEvent, Done>)) put(c); } });
        const notices = this.o.after ? await this.o.after(done) : [];
        for (const c of chunker.end(done, notices)) put(c);
        if (reading) try { controller.close(); } catch { /* cancelled */ }
      },
      cancel: () => { /* the reader stopped: the turn's fetch is aborted by its signal */ },
    });
  }
  async reconnectToStream(): Promise<null> { return null; }
}
