// The browser side of the dev proxy: whether chat is available, and one streamed model call.
import type { AssistantMessage, ChatRequest, Transport } from './api';
import { createAccumulator } from './sse';

export interface ChatStatus { enabled: boolean; model?: string; reason?: string }

export async function chatStatus(base = '/api/chat'): Promise<ChatStatus> {
  try {
    const res = await fetch(`${base}/status`);
    if (!res.ok) return { enabled: false, reason: 'The chat proxy is not running (start the studio with its Vite dev server).' };
    return await res.json() as ChatStatus;
  } catch { return { enabled: false, reason: 'The chat proxy is not reachable.' }; }
}

export function proxyTransport(base = '/api/chat'): Transport {
  return {
    async send(request: ChatRequest, { signal, onText }): Promise<AssistantMessage> {
      const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal });
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        let message = body;
        try { const j = JSON.parse(body); message = j.error?.message ?? j.error ?? body; } catch { /* plain text */ }
        throw new Error(`Chat request failed (${res.status})${message ? `: ${message}` : ''}`);
      }
      const acc = createAccumulator(onText), reader = res.body.getReader(), decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc.push(decoder.decode(value, { stream: true }));
      }
      return acc.finish();
    },
  };
}
