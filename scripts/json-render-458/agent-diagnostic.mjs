// Reviewed one-invocation CLI diagnostic. This module never starts a model on import.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { schedule, promptFor, MODEL, REASONING, MAX_ATTEMPTS,
  PER_ATTEMPT_TIMEOUT_MS, WHOLE_RUN_TIMEOUT_MS } from './plan.mjs';
import { parseFinal, safeSpec, semanticErrors } from './validate.mjs';
import { verifyFrozen } from './freeze.mjs';
import { verifyAgentFrozen } from './agent-freeze.mjs';
import { agentLiveTransport } from './agent-live.mjs';
import { verifyAgentCapture } from './agent-provenance.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
function saveExclusive(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function usageFor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw.input_tokens ?? raw.inputTokens;
  const output = raw.output_tokens ?? raw.outputTokens;
  const cached = raw.cached_input_tokens ?? raw.cachedInputTokens ?? 0;
  return [input, output, cached].every((value) => Number.isSafeInteger(value) && value >= 0)
    ? { inputTokens: input, cachedInputTokens: cached, outputTokens: output } : null;
}

export async function captureOneAgentDiagnostic({ outputDir, transport, planHash, synthetic = false }) {
  if (typeof transport !== 'function' || !/^[a-f0-9]{64}$/.test(planHash) || fs.existsSync(outputDir))
    throw new Error('A fresh one-invocation capture and frozen plan are required');
  fs.mkdirSync(outputDir, { mode: 0o700 });
  const planned = schedule();
  saveExclusive(path.join(outputDir, 'manifest.json'), { kind: 'codex-ui-458-capture', synthetic,
    model: MODEL, reasoning: REASONING, planHash, scheduledCount: MAX_ATTEMPTS,
    perAttemptTimeoutMs: PER_ATTEMPT_TIMEOUT_MS, wholeRunTimeoutMs: WHOLE_RUN_TIMEOUT_MS, planned });
  const first = planned[0];
  const item = { ...first, synthetic, status: 'scheduled', attempted: true };
  const prompt = promptFor(first, []);
  const request = { id: first.id, model: MODEL, reasoning: REASONING,
    promptSha256: sha(prompt), promptBytes: Buffer.byteLength(prompt), prompt,
    priorResponseSha256: [], support: first.support, timeoutMs: PER_ATTEMPT_TIMEOUT_MS };
  const dir = path.join(outputDir, 'attempt-00');
  fs.mkdirSync(dir, { mode: 0o700 });
  saveExclusive(path.join(dir, 'request.json'), request);
  saveExclusive(path.join(dir, 'reservation.json'), { id: first.id, ordinal: 0, planHash,
    requestedModel: MODEL, requestSha256: sha(JSON.stringify(request)), consumesOneAttempt: true });
  let response;
  try { response = await transport({ row: first, prompt, attemptDir: dir, timeoutMs: request.timeoutMs }); }
  catch { response = { exitCode: null, stopReason: 'transport-exception:diagnostic-failure', rawFinal: null, usage: null, elapsedMs: null }; }
  const eventsPath = path.join(dir, 'events.jsonl');
  if (!fs.existsSync(eventsPath)) saveExclusive(eventsPath, '');
  fs.chmodSync(eventsPath, 0o400);
  const rawPath = path.join(dir, 'raw-final.txt');
  if (!fs.existsSync(rawPath) && typeof response.rawFinal === 'string') saveExclusive(rawPath, response.rawFinal);
  if (fs.existsSync(rawPath)) fs.chmodSync(rawPath, 0o400);
  const raw = fs.existsSync(rawPath) ? fs.readFileSync(rawPath, 'utf8') : null;
  const savedTransport = { exitCode: response.exitCode ?? null, signal: response.signal ?? null,
    spawnError: response.spawnError ?? null, stopReason: response.stopReason ?? null,
    elapsedMs: response.elapsedMs ?? null, eventCount: response.eventCount ?? null,
    usage: response.usage ?? null, responseModel: response.responseModel ?? null,
    rawFinalSha256: raw === null ? null : sha(raw), cliVersion: response.cliVersion ?? null,
    modelRequested: response.modelRequested ?? MODEL, reasoningRequested: response.reasoningRequested ?? REASONING,
    argv: response.argv ?? null, environmentKeys: response.environmentKeys ?? null };
  saveExclusive(path.join(dir, 'transport.json'), savedTransport);
  item.rawFinalSha256 = savedTransport.rawFinalSha256;
  item.usage = usageFor(response.usage);
  item.elapsedMs = response.elapsedMs ?? null;
  item.exitCode = response.exitCode ?? null;
  item.stopReason = response.stopReason ?? null;
  if (response.stopReason || response.exitCode !== 0 || response.spawnError || raw === null || !item.usage ||
      (response.responseModel && response.responseModel !== MODEL)) {
    item.status = response.stopReason ?? (response.responseModel && response.responseModel !== MODEL
      ? 'model-drift' : !item.usage ? 'missing-usage' : raw === null ? 'missing-final' : 'transport-failure');
  } else {
    const parsed = parseFinal(raw);
    item.cannotExpress = parsed.cannotExpress ?? null;
    if (parsed.status !== 'parsed') { item.status = parsed.status; item.errors = parsed.errors; }
    else {
      item.specSha256 = sha(JSON.stringify(parsed.spec));
      const errors = safeSpec(parsed.spec, first.scenario, first.arm);
      if (errors.length) { item.status = 'schema'; item.errors = errors; }
      else {
        item.semanticErrors = semanticErrors(parsed.spec, first.scenario);
        item.status = parsed.cannotExpress ? first.support.supported ? 'unexpected-unexpressible'
          : 'declared-unexpressible' : 'valid';
      }
    }
  }
  const rows = [item, ...planned.slice(1).map((row) => ({ ...row, synthetic,
    status: 'skipped-global', attempted: false, reason: 'one-invocation-diagnostic-limit' }))];
  saveExclusive(path.join(outputDir, 'rows.json'), rows);
  return rows;
}

export async function runReviewedAgentDiagnostic({ outputDir, approvalPath }) {
  const agentPlanSha256 = verifyAgentFrozen();
  const basePlanSha256 = verifyFrozen();
  const transport = agentLiveTransport({ approvalPath, outputDir, agentPlanHash: agentPlanSha256,
    runKind: 'one-invocation-diagnostic' });
  try {
    const rows = await captureOneAgentDiagnostic({ outputDir, transport, planHash: basePlanSha256 });
    saveExclusive(path.join(outputDir, 'agent-route.json'), {
      kind: 'barocss-458-cli-agent-diagnostic-live', agentPlanSha256, basePlanSha256,
      scheduled: MAX_ATTEMPTS, attempted: 1, maxCliInvocations: 1,
      claimSha256: transport.claim.sha256, approvalFile: transport.claim.approvalFile,
      approvalSha256: transport.claim.approvalSha256,
      reviewedCommit: transport.claim.reviewedCommit, reviewUrl: transport.claim.reviewUrl });
    const evidence = verifyAgentCapture(outputDir);
    return { rows, agentEvidenceSha256: evidence.agentEvidenceSha256 };
  } finally { transport.cleanup(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--output' || args[2] !== '--approval')
    throw new Error('Use --output fresh-private-run --approval exact-one-invocation-review-file');
  const result = await runReviewedAgentDiagnostic({ outputDir: path.resolve(args[1]), approvalPath: path.resolve(args[3]) });
  console.log(JSON.stringify({ scheduled: result.rows.length, attempted: 1,
    agentEvidenceSha256: result.agentEvidenceSha256,
    status: result.rows[0].status }, null, 2));
}
