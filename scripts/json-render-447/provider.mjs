// Prepared direct API adapter. No CLI, SDK retries, alternate host, tools or cache.
import { LIMITS } from './plan.mjs';
export function directProvider(apiKey, fetchImpl = globalThis.fetch) {
  const request = async (route, body) => {
    const response = await fetchImpl(`https://api.anthropic.com/v1/${route}`, { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': apiKey },
      body: JSON.stringify(body), signal: AbortSignal.timeout(LIMITS.timeoutMs) });
    const raw = await response.text();
    if (!response.ok) { const error = new Error(`Provider HTTP ${response.status}`); error.raw = raw; throw error; }
    try { return { raw, data: JSON.parse(raw) }; } catch { const error = new Error('Provider response is not JSON'); error.raw = raw; throw error; }
  };
  return {
    count: async body => { const { data } = await request('messages/count_tokens', { model: body.model, system: body.system, messages: body.messages }); if (!Number.isSafeInteger(data.input_tokens) || data.input_tokens < 0) throw new Error('Unknown token estimate'); return data.input_tokens; },
    generate: async body => {
      const { raw, data } = await request('messages', body);
      const u = data.usage;
      // Unknown/additional billable categories fail accounting closed. Preserve raw first.
      const normal = u && (u.cache_creation_input_tokens ?? 0) === 0 && (u.cache_read_input_tokens ?? 0) === 0 && !u.server_tool_use && (u.service_tier ?? 'standard') === 'standard';
      return { raw, text: Array.isArray(data.content) && data.content.every(x => x.type === 'text') ? data.content.map(x => x.text).join('') : null,
        stopReason: data.stop_reason, responseModel: data.model,
        usage: normal ? { inputTokens: u.input_tokens, outputTokens: u.output_tokens } : null };
    },
  };
}
