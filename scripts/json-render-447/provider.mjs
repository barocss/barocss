// Prepared direct API adapter. No CLI, SDK retries, alternate host, tools or cache.
import { LIMITS } from './plan.mjs';
// Usage schema: https://platform.claude.com/docs/en/api/messages/create
// Only the preregistered standard/global, uncached, tool-free, no-thinking
// accounting route can settle a reservation. New accounting fields need review.
const usageKeys = new Set(['input_tokens', 'output_tokens', 'cache_creation_input_tokens',
  'cache_read_input_tokens', 'cache_creation', 'inference_geo', 'output_tokens_details',
  'server_tool_use', 'service_tier']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const tokenCount = value => Number.isSafeInteger(value) && value >= 0;
function optionalZeroRecord(value, keys) {
  return value === undefined || value === null || (record(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key) && value[key] === 0));
}
function normalUsage(u) {
  return record(u) && Object.keys(u).every(key => usageKeys.has(key)) &&
    tokenCount(u.input_tokens) && tokenCount(u.output_tokens) &&
    u.service_tier === 'standard' && u.inference_geo === 'global' &&
    u.cache_creation_input_tokens === 0 && u.cache_read_input_tokens === 0 &&
    optionalZeroRecord(u.cache_creation, ['ephemeral_1h_input_tokens', 'ephemeral_5m_input_tokens']) &&
    optionalZeroRecord(u.server_tool_use, ['web_fetch_requests', 'web_search_requests']) &&
    optionalZeroRecord(u.output_tokens_details, ['thinking_tokens']);
}
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
      const normal = normalUsage(u);
      return { raw, text: Array.isArray(data.content) && data.content.every(x => x.type === 'text') ? data.content.map(x => x.text).join('') : null,
        stopReason: data.stop_reason, responseModel: data.model,
        usage: normal ? { inputTokens: u.input_tokens, outputTokens: u.output_tokens } : null };
    },
  };
}
