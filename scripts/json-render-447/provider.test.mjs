import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { directProvider } from './provider.mjs';
import { readLedger, reserveAndRun } from './budget.mjs';
const valid = () => ({ input_tokens: 2, output_tokens: 3, cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0, service_tier: 'standard', inference_geo: 'global',
  cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
  server_tool_use: { web_fetch_requests: 0, web_search_requests: 0 },
  output_tokens_details: { thinking_tokens: 0 } });
function mock(usage) {
  let calls = 0;
  const raw = JSON.stringify({ usage, model: 'stub', stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] });
  const provider = directProvider('dummy-test-key', async () => { calls++; return { ok: true, text: async () => raw }; });
  return { provider, raw, calls: () => calls };
}
test('documented standard/global usage settles; optional detail objects can be absent or null', async () => {
  for (const variant of ['full', 'absent', 'null']) {
    const usage = valid();
    for (const key of ['cache_creation', 'server_tool_use', 'output_tokens_details']) {
      if (variant === 'absent') delete usage[key];
      if (variant === 'null') usage[key] = null;
    }
    const result = await mock(usage).provider.generate({});
    assert.deepEqual(result.usage, { inputTokens: 2, outputTokens: 3 });
  }
});
const mutations = {
  'unknown top-level charge': u => { u.new_billable_tokens = 1; },
  'unknown zero-valued category': u => { u.future_category = 0; },
  'missing tier': u => { delete u.service_tier; },
  'null tier': u => { u.service_tier = null; },
  'priority tier': u => { u.service_tier = 'priority'; },
  'missing geography': u => { delete u.inference_geo; },
  'regional geography': u => { u.inference_geo = 'us'; },
  'missing cache total': u => { delete u.cache_creation_input_tokens; },
  'cache charge': u => { u.cache_read_input_tokens = 1; },
  'unknown nested cache category': u => { u.cache_creation.future_tokens = 0; },
  'incomplete cache details': u => { delete u.cache_creation.ephemeral_1h_input_tokens; },
  'tool charge': u => { u.server_tool_use.web_search_requests = 1; },
  'unknown tool category': u => { u.server_tool_use.code_execution = 1; },
  'thinking usage': u => { u.output_tokens_details.thinking_tokens = 1; },
  'unknown output details': u => { u.output_tokens_details.future_tokens = 0; },
  'invalid input count': u => { u.input_tokens = '2'; },
  'negative output count': u => { u.output_tokens = -1; },
};
for (const [name, mutate] of Object.entries(mutations)) test(`${name}: adapter preserves raw; ledger retains reservation and stops`, async t => {
  const usage = valid(); mutate(usage);
  const stub = mock(usage);
  const dir = await mkdtemp(join(tmpdir(), 'provider-447-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const options = { ledgerPath: join(dir, 'ledger.json'), budgetMicroUsd: 30, callId: 'first', model: 'stub',
    inputTokensBound: 10, maxOutputTokens: 10, rates: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 2 } };
  let captured;
  await assert.rejects(reserveAndRun(options, async () => { captured = await stub.provider.generate({}); return captured; }), /Unknown or invalid input usage/);
  assert.equal(captured.raw, stub.raw); assert.equal(captured.usage, null);
  const ledger = await readLedger(options.ledgerPath);
  assert.equal(ledger.calls[0].status, 'blocked');
  assert.equal(ledger.calls[0].chargedMicroUsd, 30);
  await assert.rejects(reserveAndRun({ ...options, callId: 'second' }, () => stub.provider.generate({})), /Unreconciled/);
  assert.equal(stub.calls(), 1);
});
