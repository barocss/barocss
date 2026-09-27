// #458 direct Responses API preparation. No production network entry point is enabled.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { MAX_ATTEMPTS, MODEL, REASONING } from './plan.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyApiFrozen } from './api-frozen.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(here, 'output.schema.json'), 'utf8'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const whole = (value) => Number.isSafeInteger(value) && value >= 0;
const fail = (reason) => { throw new Error(`API pilot stopped: ${reason}`); };
export const API_CONTEXT_TOKENS = 1_050_000;
export const API_MAX_OUTPUT_TOKENS = 8_192; // Includes hidden reasoning tokens.
export const API_LONG_CONTEXT_THRESHOLD = 272_000;
export const API_PRICE_MICRO_USD_PER_MILLION = Object.freeze({
  short: Object.freeze({ input: 2_000_000, cached: 200_000, write: 2_500_000, output: 10_000_000 }),
  long: Object.freeze({ input: 4_000_000, cached: 400_000, write: 5_000_000, output: 15_000_000 }),
});
// Full model context at the highest input rate plus the full output cap. No estimate reduces this reservation.
export const API_RESERVATION_MICRO_USD = Math.ceil(
  (API_CONTEXT_TOKENS * API_PRICE_MICRO_USD_PER_MILLION.long.write +
    API_MAX_OUTPUT_TOKENS * API_PRICE_MICRO_USD_PER_MILLION.long.output) / 1_000_000);
export const API_CEILING_MICRO_USD = 10_000_000;

export function apiRequest(prompt) {
  if (typeof prompt !== 'string' || !prompt) fail('empty prompt');
  return {
    model: MODEL,
    reasoning: { effort: REASONING },
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: { format: { type: 'json_schema', name: 'barocss_ui_spec_458', strict: true, schema } },
    tools: [], tool_choice: 'none',
    service_tier: 'default', max_output_tokens: API_MAX_OUTPUT_TOKENS,
    truncation: 'disabled', store: false, background: false, stream: false,
  };
}
function saveExclusive(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  const dir = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
export function reserveApiCharge({ runDir, attemptDir, ordinal, request }) {
  if (!whole(ordinal) || ordinal >= MAX_ATTEMPTS || path.dirname(attemptDir) !== runDir || !fs.statSync(attemptDir).isDirectory()) fail('reservation path or ordinal');
  const prior = fs.readdirSync(runDir).filter((name) => /^attempt-\d{2}$/.test(name)).flatMap((name) => {
    const dir = path.join(runDir, name);
    const file = path.join(dir, 'api-charge-reservation.json');
    if (!fs.existsSync(file)) return [];
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!whole(record.ordinal) || record.ordinal >= ordinal || record.reservedMicroUsd !== API_RESERVATION_MICRO_USD ||
        record.ceilingMicroUsd !== API_CEILING_MICRO_USD) fail('reservation ledger drift');
    const settlementFile = path.join(dir, 'api-charge-settlement.json');
    if (!fs.existsSync(settlementFile)) return [{ record, held: API_RESERVATION_MICRO_USD }];
    const responseFile = path.join(dir, 'api-response.json');
    if (!fs.existsSync(responseFile)) fail('settlement missing response');
    const responseBytes = fs.readFileSync(responseFile);
    const settlement = JSON.parse(fs.readFileSync(settlementFile, 'utf8'));
    const checked = inspectApiResponse(JSON.parse(responseBytes));
    if (settlement.ordinal !== record.ordinal || settlement.responseSha256 !== sha(responseBytes) ||
        settlement.actualMicroUsd !== checked.usage.microUsd) fail('settlement ledger drift');
    return [{ record, held: settlement.actualMicroUsd }];
  });
  if (new Set(prior.map(({ record }) => record.ordinal)).size !== prior.length) fail('duplicate reservation');
  const aggregate = prior.reduce((sum, entry) => sum + entry.held, 0);
  if (prior.length >= MAX_ATTEMPTS || aggregate + API_RESERVATION_MICRO_USD > API_CEILING_MICRO_USD) fail('aggregate charge ceiling');
  const record = { ordinal, requestedModel: MODEL, serviceTier: 'default', requestedEndpoint: 'https://api.openai.com/v1/responses',
    requestSha256: sha(JSON.stringify(request)), reservedMicroUsd: API_RESERVATION_MICRO_USD,
    aggregateHeldBeforeMicroUsd: aggregate, aggregateHeldAfterMicroUsd: aggregate + API_RESERVATION_MICRO_USD,
    ceilingMicroUsd: API_CEILING_MICRO_USD };
  saveExclusive(path.join(attemptDir, 'api-charge-reservation.json'), record);
  return record;
}
export function settleApiCharge({ attemptDir, ordinal, response }) {
  const reservation = JSON.parse(fs.readFileSync(path.join(attemptDir, 'api-charge-reservation.json'), 'utf8'));
  if (reservation.ordinal !== ordinal) fail('settlement ordinal drift');
  const responseBytes = fs.readFileSync(path.join(attemptDir, 'api-response.json'));
  if (JSON.stringify(JSON.parse(responseBytes)) !== JSON.stringify(response)) fail('settlement response drift');
  const checked = inspectApiResponse(response);
  saveExclusive(path.join(attemptDir, 'api-charge-settlement.json'),
    { ordinal, responseSha256: sha(responseBytes), actualMicroUsd: checked.usage.microUsd });
  return checked;
}
export function chargeForUsage(usage) {
  if (!usage || !whole(usage.input_tokens) || !whole(usage.output_tokens) || !whole(usage.total_tokens) ||
      !whole(usage.input_tokens_details?.cached_tokens) || !whole(usage.input_tokens_details?.cache_write_tokens) ||
      !whole(usage.output_tokens_details?.reasoning_tokens)) fail('missing or invalid token usage');
  const input = usage.input_tokens, output = usage.output_tokens;
  const cached = usage.input_tokens_details.cached_tokens, write = usage.input_tokens_details.cache_write_tokens;
  if (input + output !== usage.total_tokens || cached + write > input || usage.output_tokens_details.reasoning_tokens > output ||
      input > API_CONTEXT_TOKENS || output > API_MAX_OUTPUT_TOKENS) fail('inconsistent token usage');
  const rates = input > API_LONG_CONTEXT_THRESHOLD ? API_PRICE_MICRO_USD_PER_MILLION.long : API_PRICE_MICRO_USD_PER_MILLION.short;
  const microUsd = Math.ceil(((input - cached - write) * rates.input + cached * rates.cached + write * rates.write + output * rates.output) / 1_000_000);
  if (microUsd > API_RESERVATION_MICRO_USD) fail('usage exceeds reservation');
  return { inputTokens: input, cachedInputTokens: cached, cacheWriteTokens: write, outputTokens: output,
    reasoningOutputTokens: usage.output_tokens_details.reasoning_tokens, microUsd };
}
export function inspectApiResponse(response) {
  if (!response || response.object !== 'response' || response.status !== 'completed' || response.incomplete_details || response.error ||
      response.model !== MODEL || response.service_tier !== 'default') fail('response status, model, or billing tier');
  const output = response.output;
  if (!Array.isArray(output) || output.length < 1 || output.length > 2) fail('unexpected output items');
  const reasoning = output.length === 2 ? output[0] : null;
  if (reasoning && (reasoning.type !== 'reasoning' || reasoning.content !== undefined ||
      (reasoning.summary !== undefined && (!Array.isArray(reasoning.summary) || reasoning.summary.length)))) fail('unexpected reasoning item');
  const message = output[output.length - 1];
  if (message?.type !== 'message' || message.role !== 'assistant' || message.status !== 'completed' ||
      !Array.isArray(message.content) || message.content.length !== 1) fail('unexpected message item');
  const part = message.content[0];
  if (part?.type !== 'output_text' || typeof part.text !== 'string' || !part.text ||
      (part.annotations !== undefined && (!Array.isArray(part.annotations) || part.annotations.length))) fail('refusal or unexpected output content');
  return { rawFinal: part.text, usage: chargeForUsage(response.usage) };
}
function ensureApiRunManifest(runDir, transportKind, metadata) {
  const expected = { kind: 'barocss-458-direct-responses', transportKind, synthetic: transportKind === 'api-stub',
    apiPlanHash: verifyApiFrozen(), capturePlanHash: verifyFrozen(), maxChargeMicroUsd: API_CEILING_MICRO_USD,
    approvalSha256: metadata.approvalSha256 ?? null, reviewedCommit: metadata.reviewedCommit ?? null };
  const file = path.join(runDir, 'api-run-manifest.json');
  if (!fs.existsSync(file)) saveExclusive(file, expected);
  else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(expected)) fail('API run manifest drift');
}
export function preparedApiTransport(responder, transportKind, metadata = {}) {
  if (typeof responder !== 'function' || !['api-stub', 'api-live'].includes(transportKind)) fail('invalid prepared responder');
  return async ({ row, prompt, attemptDir, timeoutMs }) => {
    const started = performance.now();
    try {
      const runDir = path.dirname(attemptDir);
      ensureApiRunManifest(runDir, transportKind, metadata);
      const request = apiRequest(prompt);
      reserveApiCharge({ runDir, attemptDir, ordinal: row.ordinal, request });
      saveExclusive(path.join(attemptDir, 'api-request.json'), request);
      const response = await responder(request, row, attemptDir, timeoutMs);
      saveExclusive(path.join(attemptDir, 'api-response.json'), response);
      const checked = settleApiCharge({ attemptDir, ordinal: row.ordinal, response });
      return { rawFinal: checked.rawFinal, usage: { input_tokens: checked.usage.inputTokens,
        cached_input_tokens: checked.usage.cachedInputTokens, output_tokens: checked.usage.outputTokens },
        responseModel: response.model, exitCode: 0, stopReason: null,
        elapsedMs: Math.max(0, Math.round(performance.now() - started)) };
    } catch (error) {
      return { rawFinal: null, usage: null, exitCode: null,
        stopReason: `api-error:${String(error?.message ?? error).slice(0, 80)}`,
        elapsedMs: Math.max(0, Math.round(performance.now() - started)) };
    }
  };
}
// Only a test-supplied responder is accepted. This function never reads a key or sends HTTP.
export function stubApiTransport(responder) { return preparedApiTransport(responder, 'api-stub'); }
