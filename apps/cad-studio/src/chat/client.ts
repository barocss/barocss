// The browser side of the chat server (server/chatServer.ts, reached through the dev server's
// /api/chat proxy): whether chat is available, and one turn streamed as server-sent events.
import type { StudioDoc } from '../engine/doc';
import type { NameSelection } from './tools';

export interface ChatStatus { enabled: boolean; model?: string; via?: string; reason?: string }
export type TurnEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; input: unknown; summary: string; isError: boolean }
  | { type: 'state'; doc: StudioDoc }
  | { type: 'done'; doc?: StudioDoc; selection?: NameSelection; session?: string; end: 'done' | 'aborted' | 'error'; error?: string };

const OFF = 'The chat server is not running. Start it beside the studio with `pnpm --filter @barocss/cad-studio-app chat` (it uses the claude CLI and its sign-in).';

export async function chatStatus(base = '/api/chat'): Promise<ChatStatus> {
  try {
    const res = await fetch(`${base}/status`);
    if (!res.ok) return { enabled: false, reason: OFF };
    return await res.json() as ChatStatus;
  } catch { return { enabled: false, reason: OFF }; }
}

/** Splits a server-sent event stream into its JSON payloads (any chunking). */
export function eventParser(onEvent: (e: TurnEvent) => void) {
  let buffer = '', data: string[] = [];
  return (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, ''); buffer = buffer.slice(nl + 1);
      if (line === '') { if (data.length) onEvent(JSON.parse(data.join('\n'))); data = []; }
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
  };
}

/** One turn; resolves with its `done` event (an aborted or broken stream ends as one too). */
export async function runServerTurn(o: { text: string; doc: StudioDoc; session?: string; images?: { media_type: string; data: string }[]; traces?: unknown[]; signal?: AbortSignal; onEvent(e: TurnEvent): void; base?: string }): Promise<Extract<TurnEvent, { type: 'done' }>> {
  let done: Extract<TurnEvent, { type: 'done' }> | null = null;
  try {
    const res = await fetch(`${o.base ?? '/api/chat'}/turn`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: o.text, doc: o.doc, ...(o.session ? { session: o.session } : {}), ...(o.images?.length ? { images: o.images.map(i => ({ media_type: i.media_type, data: i.data })) } : {}), ...(o.traces?.length ? { traces: o.traces } : {}) }), signal: o.signal });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => '');
      let msg = t; try { msg = JSON.parse(t).error ?? t; } catch { /* plain text */ }
      return { type: 'done', end: 'error', error: res.status >= 500 && !t ? OFF : `Chat request failed (${res.status})${msg ? `: ${msg}` : ''}` };
    }
    const parse = eventParser(e => { if (e.type === 'done') done = e; else o.onEvent(e); });
    const reader = res.body.getReader(), decoder = new TextDecoder();
    for (;;) { const { done: end, value } = await reader.read(); if (end) break; parse(decoder.decode(value, { stream: true })); }
    parse('\n\n');
  } catch (e) {
    if (o.signal?.aborted) return done ?? { type: 'done', end: 'aborted' };
    return { type: 'done', end: 'error', error: e instanceof Error ? e.message : String(e) };
  }
  return done ?? { type: 'done', end: o.signal?.aborted ? 'aborted' : 'error', error: 'The chat stream ended early.' };
}
