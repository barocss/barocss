// Candidate direct-API plan. This module does not authorize generation.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
// Follow local imports, and include the runtime assets loaded by the browser harness.
export function inputHashes(root = fileURLToPath(new URL('../../', import.meta.url))) {
  const pending = ['scripts/json-render-447/fixtures.mjs', 'scripts/json-render-447/RUBRIC.md',
    'scripts/json-render-447/plan.mjs', 'scripts/json-render-447/capture.mjs',
    'scripts/json-render-447/provider.mjs', 'scripts/json-render-447/budget.mjs',
    'scripts/json-render-447/replay.mjs', 'scripts/json-render-447/APPROVAL-PLAN.md',
    'scripts/json-render-446/browser-app.jsx', 'scripts/json-render-446/evidence/baro.umd.cjs',
    'scripts/json-render-probe/e2e/app.css', 'scripts/json-render-447/dependency-lock.json', 'pnpm-lock.yaml'];
  const files = {};
  while (pending.length) {
    const name = pending.pop();
    if (Object.hasOwn(files, name)) continue;
    const bytes = fs.readFileSync(path.join(root, name));
    files[name] = createHash('sha256').update(bytes).digest('hex');
    if (/\.(mjs|jsx)$/.test(name)) for (const match of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
      if (dependency.startsWith('../')) throw new Error('Input escapes repository');
      pending.push(dependency);
    }
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
export function frozenPlan() {
  return { version: 1, provider: 'anthropic-direct-standard-global', models: MODELS, limits: LIMITS,
    settings: { thinking: { type: 'disabled' }, tools: [], tool_choice: { type: 'none' }, stream: false, service_tier: 'standard_only', caching: 'no cache_control field', sampling: 'provider defaults; no seed/temperature/top_p override' },
    phases: Object.fromEntries(['pilot-a', 'pilot-b', 'study'].map(phase => [phase, { rows: schedule(phase), maximumMicroUsd: maximumMicroUsd(phase) }])),
    cases: cases(), prompts: SCENARIO_IDS.flatMap(scenario => ARMS.map(arm => ({ scenario, arm, initial: sessionMessages(scenario, arm), edits: STAGES.slice(1).map(stage => ({ stage, content: editPrompt(scenario, stage) })) }))),
    files: inputHashes(),
  };
}
export const digest = object => createHash('sha256').update(JSON.stringify(object)).digest('hex');
export function approvalCheck(approval, phase, keyPresent) {
  const planHash = digest(frozenPlan());
  if (!keyPresent || approval?.ownerApproved !== true || approval?.planHash !== planHash || approval.phase !== phase || approval.provider !== 'anthropic-direct-standard-global' || approval.billingScope !== 'API-token-charges-only' || approval.accountModelsVerified !== true || approval.billingVerified !== true || approval.contextAndPricesVerified !== true || approval.budgetMicroUsd !== maximumMicroUsd(phase) || approval.callCap !== schedule(phase).length) throw new Error('Live readiness blocked: exact owner approval, account models, billing, prices, context and budget must be verified');
  return approval;
}
