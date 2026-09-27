import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { sessionMessages, editPrompt } from './fixtures.mjs';
import { MODELS, LIMITS, schedule, maximumMicroUsd, frozenPlan, digest, approvalCheck } from './plan.mjs';
import { reserveAndRun } from './budget.mjs';
import { directProvider } from './provider.mjs';
import { specFor } from '../json-render-446/spec.mjs';
export function bodyFor(row, history) {
  return { model: row.model, system: history[0].content, messages: history.slice(1), max_tokens: LIMITS.maxOutputTokens,
    thinking: { type: 'disabled' }, tools: [], tool_choice: { type: 'none' }, stream: false, service_tier: 'standard_only' };
}
export function classify(response) {
  if (response.stopReason === 'max_tokens') return { status: 'truncated' };
  if (response.stopReason !== 'end_turn') return { status: response.stopReason === 'refusal' ? 'refusal' : 'response-stop' };
  if (typeof response.text !== 'string') return { status: 'response-format' };
  try { const spec = JSON.parse(response.text); if (!spec || Array.isArray(spec) || typeof spec !== 'object' || typeof spec.root !== 'string' || !spec.elements || typeof spec.elements !== 'object') return { status: 'schema' }; return { status: 'valid', spec }; }
  catch { return { status: 'parse' }; }
}
function saveExclusive(file, data) { const fd = fs.openSync(file, 'wx', 0o600); try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
export async function capture({ outputDir, phase = 'pilot-a', provider, budgetMicroUsd = maximumMicroUsd(phase), synthetic = false }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const planned = schedule(phase); const rows = []; const histories = new Map(); const stopped = new Set();
  saveExclusive(path.join(outputDir, 'manifest.json'), { synthetic, phase, planHash: digest(frozenPlan()), planned, budgetMicroUsd });
  let globalStop = false;
  for (let index = 0; index < planned.length; index++) {
    const row = planned[index]; const model = MODELS.find(x => x.id === row.model);
    const item = { ...row, synthetic, status: 'scheduled', raw: null, usage: null, latencyMs: null, inputEstimate: null };
    if (globalStop || stopped.has(row.session)) { item.status = globalStop ? 'blocked-budget-or-accounting' : 'blocked-prior-failure'; rows.push(item); continue; }
    let history = histories.get(row.session) || sessionMessages(row.scenario, row.arm);
    if (row.stage !== 'initial') history = [...history, { role: 'user', content: editPrompt(row.scenario, row.stage) }];
    const body = bodyFor(row, history);
    item.request = body; item.contextHash = digest(body); item.systemHash = digest(body.system); item.systemBytes = Buffer.byteLength(body.system); item.catalogTokens = null; item.requestBytes = Buffer.byteLength(JSON.stringify(body));
    // Request history is complete. Reject the session instead of slicing or compacting it.
    const file = path.join(outputDir, `response-${String(index).padStart(3, '0')}.json`);
    try {
      if (item.requestBytes > LIMITS.maxRequestBytes) { item.status = 'context'; stopped.add(row.session); rows.push(item); saveExclusive(file,item); continue; }
      item.inputEstimate = await provider.count(body, row);
      if (!Number.isSafeInteger(item.inputEstimate) || item.inputEstimate < 0) throw new Error('Unknown token estimate');
      if (item.inputEstimate > LIMITS.inputEstimateCeiling || item.inputEstimate + LIMITS.maxOutputTokens > model.contextTokens) { item.status = 'context'; stopped.add(row.session); rows.push(item); saveExclusive(file,item); continue; }
      let received;
      try {
        received = await reserveAndRun({ ledgerPath: path.join(outputDir,'ledger.json'), budgetMicroUsd, callId: row.id, model: row.model,
          inputTokensBound: model.contextTokens, maxOutputTokens: LIMITS.maxOutputTokens, rates: model.rates }, async () => {
          const start = performance.now();
          try {
            const response = await provider.generate(body, row);
            item.latencyMs = synthetic ? 0 : performance.now() - start;
            item.raw = response.raw; item.responseModel = response.responseModel; item.text = response.text; item.usage = response.usage; item.stopReason = response.stopReason;
            Object.assign(item, classify(response));
            if (response.responseModel !== row.model) { item.status = 'model-mismatch'; response.usage = null; }
            saveExclusive(file, item); // Preserve response even when usage fails validation.
            return response;
          } catch (error) {
            item.latencyMs = synthetic ? 0 : performance.now() - start; item.status = 'transport'; item.raw = error.raw ?? null;
            if (!fs.existsSync(file)) saveExclusive(file,item);
            throw error;
          }
        });
      } catch { item.status = item.status === 'transport' ? 'transport' : item.raw === null ? 'budget' : 'accounting'; globalStop = true; }
      if (received && item.status === 'valid') histories.set(row.session, [...history, { role: 'assistant', content: received.text }]);
      else stopped.add(row.session);
    } catch { item.status = 'preflight-error'; globalStop = true; }
    rows.push(item);
  }
  saveExclusive(path.join(outputDir,'rows.json'), rows);
  return rows;
}
export function syntheticProvider(mode = 'valid') {
  return {
    count: async body => Math.ceil(Buffer.byteLength(JSON.stringify(body))/3), // Stub units only; never a real-token claim.
    generate: async (body,row) => {
      if (mode === 'transport') throw new Error('Synthetic transport failure');
      let text = JSON.stringify(specFor(row.scenario,row.arm,row.stage));
      if (mode === 'invalid-json') text = '{broken';
      if (mode === 'schema') text = '{}';
      return { raw: JSON.stringify({ synthetic: true, text }), text, responseModel: row.model, stopReason: mode === 'truncated' ? 'max_tokens' : 'end_turn',
        usage: mode === 'missing-usage' ? null : { inputTokens: Math.ceil(Buffer.byteLength(JSON.stringify(body))/3), outputTokens: Math.ceil(Buffer.byteLength(text)/3) } };
    },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const value = key => args[args.indexOf(key)+1];
  const phase = args.includes('--phase') ? value('--phase') : 'pilot-a';
  if (args.includes('--freeze')) { process.stdout.write(JSON.stringify({ planHash:digest(frozenPlan()),plan:frozenPlan() },null,2)+'\n'); }
  else {
    if (!args.includes('--output')) throw new Error('Use a fresh --output directory');
    let provider; let synthetic = !args.includes('--live');
    if (!synthetic) {
      const approval = JSON.parse(fs.readFileSync(value('--approval'),'utf8'));
      approvalCheck(approval,phase,Boolean(process.env.ANTHROPIC_API_KEY));
      if (approval.outputDir !== path.resolve(value('--output'))) throw new Error('Approval is bound to a different output directory');
      if (process.env.ANTHROPIC_BASE_URL) throw new Error('Alternate billing route forbidden');
      provider = directProvider(process.env.ANTHROPIC_API_KEY);
    } else provider = syntheticProvider(args.includes('--mode') ? value('--mode') : 'valid');
    const rows = await capture({ outputDir:value('--output'),phase,provider,synthetic });
    console.log(JSON.stringify({ synthetic, scheduled:rows.length, statuses:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}) }));
  }
}
