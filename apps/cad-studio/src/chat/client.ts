// The browser side of the chat server (server/chatServer.ts, reached through the dev server's
// /api/chat proxy): whether chat is available, and one turn streamed as server-sent events.
import type { RowFileInput } from '@barocss/cad-model/engine/rowFiles';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { VersionLog } from '@barocss/cad-model/versions/log';
import type { TurnOp } from '@barocss/cad-model/chat/merge';
import { blobRefs, blobsAsBase64 } from '@barocss/cad-model/engine/blobs';
import type { NameSelection } from '@barocss/cad-model/chat/tools';

export interface ChatStatus { enabled: boolean; model?: string; via?: string; reason?: string }
export type TurnEvent =
  | { type: 'text'; delta: string }
  /** O17c: the model's thinking, when the CLI streams it. */
  | { type: 'reasoning'; delta: string }
  | { type: 'tool'; name: string; input: unknown; summary: string; isError: boolean }
  | { type: 'state'; doc: StudioDoc; /** The turn's calls that changed the part since the last state (O133). */ ops?: TurnOp[] }
  | { type: 'done'; doc?: StudioDoc; selection?: NameSelection; session?: string; end: 'done' | 'aborted' | 'error'; error?: string; /** CG6: the turn's version log, when a call moved it. */ versions?: VersionLog; versionsWanted?: string[]; ops?: TurnOp[] };

const OFF = 'The chat server is not running. Start it beside the studio with `pnpm --filter @barocss/cad-studio-app chat` (it uses the claude CLI and its sign-in).';

export async function chatStatus(base = '/api/chat'): Promise<ChatStatus> {
  try {
    const res = await fetch(`${base}/status`);
    if (!res.ok) return { enabled: false, reason: OFF };
    const status = await res.json() as ChatStatus;
    return status.enabled ? status : { ...status, reason: status.reason ?? OFF };
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
/**
 * The mesh blobs of a conversation (D45): sent to the chat server once — later turns name them only. `sent`: the
 * hashes the server has; a server that lost some (restarted) answers 409 with them, and they are sent again once.
 */
export interface ChatBlobs { session: string; sent: Set<string> }
export const newChatBlobs = (): ChatBlobs => ({ session: Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''), sent: new Set() });

/** One turn; resolves with its `done` event (an aborted or broken stream ends as one too). */
export async function runServerTurn(o: { text: string; doc: StudioDoc; /** The user's own messages this conversation, this one last (A6.2). */ turns?: readonly string[]; rowFiles?: readonly RowFileInput[]; rowConversation?: string; session?: string; autonomy?: number; images?: { media_type: string; data: string }[]; traces?: unknown[]; signal?: AbortSignal; onEvent(e: TurnEvent): void; base?: string; blobs?: ChatBlobs; /** CG6: the project's version log as the turn carries it (versions/log.ts turnLog). */ versions?: VersionLog }): Promise<Extract<TurnEvent, { type: 'done' }>> {
  let done: Extract<TurnEvent, { type: 'done' }> | null = null;
  const refs = [...blobRefs(o.doc)], blobs = o.blobs ?? newChatBlobs();
  const body = (send: readonly string[]) => JSON.stringify({ text: o.text, doc: o.doc, ...(o.rowFiles?.length ? { rowFiles: o.rowFiles, rowConversation: o.rowConversation } : {}), ...(o.turns ? { turns: o.turns } : {}), ...(refs.length ? { blobSession: blobs.session, blobRefs: refs, ...(send.length ? { blobs: blobsAsBase64(o.doc, send) } : {}) } : {}), ...(o.autonomy ? { autonomy: o.autonomy } : {}), ...(o.session ? { session: o.session } : {}), ...(o.images?.length ? { images: o.images.map(i => ({ media_type: i.media_type, data: i.data })) } : {}), ...(o.traces?.length ? { traces: o.traces } : {}), ...(o.versions ? { versions: o.versions } : {}) });
  try {
    const post = (send: readonly string[]) => fetch(`${o.base ?? '/api/chat'}/turn`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(send), signal: o.signal });
    let res = await post(refs.filter(h => !blobs.sent.has(h)));
    // (The server lost blobs it had: they again, once.)
    if (res.status === 409) { const missing = ((await res.json().catch(() => ({}))) as { missing?: string[] }).missing ?? refs; for (const h of missing) blobs.sent.delete(h); res = await post(missing); }
    if (res.ok) for (const h of refs) blobs.sent.add(h);
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
