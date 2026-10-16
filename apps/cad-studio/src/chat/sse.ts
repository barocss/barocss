// Assembles a streamed Messages API response (server-sent events) into the final assistant message:
// text and thinking deltas, tool inputs streamed as partial JSON, signatures, and the stop reason.
import type { AssistantMessage, ContentBlock } from './api';

type Partial = ContentBlock & { _json?: string };

export class StreamError extends Error {}

export function createAccumulator(onText?: (delta: string) => void) {
  const content: Partial[] = [];
  const message: AssistantMessage = { content: [], stop_reason: null };
  let buffer = '', event = '', data: string[] = [];

  const dispatch = () => {
    const raw = data.join('\n'); const name = event; event = ''; data = [];
    if (!raw) return;
    const payload = JSON.parse(raw) as Record<string, any>;
    switch (payload.type ?? name) {
      case 'message_start': message.model = payload.message?.model; break;
      case 'content_block_start': content[payload.index] = { ...payload.content_block }; if (payload.content_block?.type === 'tool_use') content[payload.index]._json = ''; break;
      case 'content_block_delta': {
        const block = content[payload.index] as any, d = payload.delta;
        if (!block || !d) break;
        if (d.type === 'text_delta') { block.text = (block.text ?? '') + d.text; onText?.(d.text); }
        else if (d.type === 'input_json_delta') block._json = (block._json ?? '') + d.partial_json;
        else if (d.type === 'thinking_delta') block.thinking = (block.thinking ?? '') + d.thinking;
        else if (d.type === 'signature_delta') block.signature = (block.signature ?? '') + d.signature;
        break;
      }
      case 'content_block_stop': {
        const block = content[payload.index] as any;
        if (block && block._json !== undefined) {
          // (An empty input streams no JSON at all.)
          try { block.input = block._json ? JSON.parse(block._json) : {}; } catch { block.input = { __invalid_json: block._json }; }
          delete block._json;
        }
        break;
      }
      case 'message_delta':
        if (payload.delta?.stop_reason !== undefined) message.stop_reason = payload.delta.stop_reason;
        if (payload.delta?.stop_details !== undefined) message.stop_details = payload.delta.stop_details;
        break;
      case 'error': throw new StreamError(payload.error?.message ?? 'The model stream failed.');
    }
  };

  return {
    /** Feeds raw stream text (any chunking). */
    push(chunk: string) {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, ''); buffer = buffer.slice(nl + 1);
        if (line === '') dispatch();
        else if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
    },
    finish(): AssistantMessage {
      if (buffer.trim()) this.push('\n');
      if (data.length) dispatch();
      message.content = content.filter(Boolean).map(b => { const { _json, ...rest } = b as any; return _json !== undefined ? { ...rest, input: {} } : rest; });
      return message;
    },
  };
}
