// Candidate direct-API plan. This module does not authorize generation.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARMS, SCENARIO_IDS, STAGES, sessionMessages, editPrompt, cases } from './fixtures.mjs';
export const MODELS = Object.freeze([
  { id: 'claude-haiku-4-5-20251001', contextTokens: 200000, rates: { inputMicroUsdPerToken: 1, outputMicroUsdPerToken: 5 } },
  { id: 'claude-sonnet-5', contextTokens: 1000000, rates: { inputMicroUsdPerToken: 2, outputMicroUsdPerToken: 10 } },
]);
export const LIMITS = Object.freeze({ maxOutputTokens: 4096, inputEstimateCeiling: 32768, maxRequestBytes: 262144, retries: 0, timeoutMs: 120000 });
export function schedule(phase = 'pilot-a') {
  if (!['pilot-a', 'pilot-b', 'study'].includes(phase)) throw new Error('Unknown phase');
  const scenarios = phase === 'pilot-a' ? ['settings'] : SCENARIO_IDS;
  const repetitions = phase === 'study' ? 5 : 1;
  const rows = [];
  for (let repeat = 0; repeat < repetitions; repeat++) for (let si = 0; si < scenarios.length; si++) {
    for (let ai = 0; ai < ARMS.length; ai++) for (let mi = 0; mi < MODELS.length; mi++) {
      const arm = ARMS[(ai + repeat + si) % ARMS.length];
      const model = MODELS[(mi + ai + repeat + si) % MODELS.length].id;
      const scenario = scenarios[si];
      const session = `${phase}/${model}/${scenario}/${arm}/${repeat}`;
      for (const stage of STAGES) rows.push({ id: `${session}/${stage}`, session, model, scenario, arm, repeat, stage });
    }
  }
  return rows;
}
export function maximumMicroUsd(phase) {
  return schedule(phase).reduce((sum, row) => { const m = MODELS.find(x => x.id === row.model); return sum + m.contextTokens * m.rates.inputMicroUsdPerToken + LIMITS.maxOutputTokens * m.rates.outputMicroUsdPerToken; }, 0);
}
export function frozenPlan() {
  return { version: 1, provider: 'anthropic-direct-standard-global', models: MODELS, limits: LIMITS,
    settings: { thinking: { type: 'disabled' }, tools: [], tool_choice: { type: 'none' }, stream: false, service_tier: 'standard_only', caching: 'no cache_control field', sampling: 'provider defaults; no seed/temperature/top_p override' },
    phases: Object.fromEntries(['pilot-a', 'pilot-b', 'study'].map(phase => [phase, { rows: schedule(phase), maximumMicroUsd: maximumMicroUsd(phase) }])),
    cases: cases(), prompts: SCENARIO_IDS.flatMap(scenario => ARMS.map(arm => ({ scenario, arm, initial: sessionMessages(scenario, arm), edits: STAGES.slice(1).map(stage => ({ stage, content: editPrompt(scenario, stage) })) }))),
    files: Object.fromEntries(['fixtures.mjs','RUBRIC.md','plan.mjs','capture.mjs','provider.mjs','budget.mjs','replay.mjs','APPROVAL-PLAN.md'].map(name => [name, createHash('sha256').update(fs.readFileSync(fileURLToPath(new URL(name, import.meta.url)))).digest('hex')])),
  };
}
export const digest = object => createHash('sha256').update(JSON.stringify(object)).digest('hex');
export function approvalCheck(approval, phase, keyPresent) {
  const planHash = digest(frozenPlan());
  if (!keyPresent || approval?.ownerApproved !== true || approval?.planHash !== planHash || approval.phase !== phase || approval.provider !== 'anthropic-direct-standard-global' || approval.billingScope !== 'API-token-charges-only' || approval.accountModelsVerified !== true || approval.billingVerified !== true || approval.contextAndPricesVerified !== true || approval.budgetMicroUsd !== maximumMicroUsd(phase) || approval.callCap !== schedule(phase).length) throw new Error('Live readiness blocked: exact owner approval, account models, billing, prices, context and budget must be verified');
  return approval;
}
