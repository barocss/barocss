// #458 serial first-response capture. Importing this module never invokes a model.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { MAX_ATTEMPTS, MODEL, PER_ATTEMPT_TIMEOUT_MS, REASONING, WHOLE_RUN_TIMEOUT_MS, promptFor, schedule } from './plan.mjs';
import { parseFinal, safeSpec, semanticErrors } from './validate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
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
  if (![input, output, cached].every((value) => Number.isSafeInteger(value) && value >= 0)) return null;
  return { inputTokens: input, cachedInputTokens: cached, outputTokens: output };
}
export async function capture({ outputDir, transport, planHash, synthetic = false, now = () => performance.now() }) {
  if (typeof transport !== 'function' || typeof planHash !== 'string' || !/^[a-f0-9]{64}$/.test(planHash)) throw new Error('Capture needs transport and frozen plan hash');
  if (fs.existsSync(outputDir)) throw new Error('Output directory already exists; never restart an ambiguous pilot');
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const planned = schedule();
  saveExclusive(path.join(outputDir, 'manifest.json'), { kind: 'codex-ui-458-capture', synthetic, model: MODEL, reasoning: REASONING,
    planHash, scheduledCount: MAX_ATTEMPTS, perAttemptTimeoutMs: PER_ATTEMPT_TIMEOUT_MS, wholeRunTimeoutMs: WHOLE_RUN_TIMEOUT_MS,
    planned });
  const histories = new Map();
  const blockedSessions = new Set();
  const rows = [];
  let globalStop = null;
  const deadline = now() + WHOLE_RUN_TIMEOUT_MS;
  for (const row of planned) {
    const item = { ...row, synthetic, status: 'scheduled', attempted: false };
    if (!globalStop && now() >= deadline) globalStop = 'whole-run-timeout';
    if (globalStop || blockedSessions.has(row.session)) {
      item.status = globalStop ? 'skipped-global' : 'skipped-session';
      item.reason = globalStop ?? 'prior-invalid-response';
      rows.push(item);
      continue;
    }
    const prior = histories.get(row.session) ?? [];
    const prompt = promptFor(row, prior);
    const request = { id: row.id, model: MODEL, reasoning: REASONING, promptSha256: sha(prompt), promptBytes: Buffer.byteLength(prompt),
      prompt, priorResponseSha256: prior.map(sha), support: row.support, timeoutMs: Math.min(PER_ATTEMPT_TIMEOUT_MS, Math.max(1, Math.floor(deadline - now()))) };
    const dir = path.join(outputDir, `attempt-${String(row.ordinal).padStart(2, '0')}`);
    fs.mkdirSync(dir, { mode: 0o700 });
    saveExclusive(path.join(dir, 'request.json'), request);
    saveExclusive(path.join(dir, 'reservation.json'), { id: row.id, ordinal: row.ordinal, planHash, requestedModel: MODEL,
      requestSha256: sha(JSON.stringify(request)), consumesOneAttempt: true });
    item.attempted = true;
    let response;
    try { response = await transport({ row, prompt, attemptDir: dir, timeoutMs: request.timeoutMs }); }
    catch (error) { response = { exitCode: null, stopReason: `transport-exception:${String(error?.message ?? error).slice(0, 80)}`, rawFinal: null, usage: null, elapsedMs: null }; }
    const eventsFile = path.join(dir, 'events.jsonl');
    if (!fs.existsSync(eventsFile)) saveExclusive(eventsFile, '');
    fs.chmodSync(eventsFile, 0o400);
    const rawFile = path.join(dir, 'raw-final.txt');
    if (!fs.existsSync(rawFile) && typeof response.rawFinal === 'string') saveExclusive(rawFile, response.rawFinal);
    if (fs.existsSync(rawFile)) fs.chmodSync(rawFile, 0o400);
    const raw = fs.existsSync(rawFile) ? fs.readFileSync(rawFile, 'utf8') : null;
    const savedTransport = { exitCode: response.exitCode ?? null, signal: response.signal ?? null, spawnError: response.spawnError ?? null,
      stopReason: response.stopReason ?? null, elapsedMs: response.elapsedMs ?? null, eventCount: response.eventCount ?? null,
      usage: response.usage ?? null, responseModel: response.responseModel ?? null, rawFinalSha256: raw === null ? null : sha(raw),
      cliVersion: response.cliVersion ?? null, modelRequested: response.modelRequested ?? MODEL, reasoningRequested: response.reasoningRequested ?? REASONING,
      argv: response.argv ?? null, environmentKeys: response.environmentKeys ?? null };
    saveExclusive(path.join(dir, 'transport.json'), savedTransport);
    item.rawFinalSha256 = savedTransport.rawFinalSha256;
    item.usage = usageFor(response.usage);
    item.elapsedMs = response.elapsedMs ?? null;
    item.exitCode = response.exitCode ?? null;
    item.stopReason = response.stopReason ?? null;
    if (response.stopReason || response.exitCode !== 0 || response.spawnError || raw === null || !item.usage || (response.responseModel && response.responseModel !== MODEL)) {
      item.status = response.stopReason ?? (response.responseModel && response.responseModel !== MODEL ? 'model-drift' : !item.usage ? 'missing-usage' : raw === null ? 'missing-final' : 'transport-failure');
      globalStop = item.status;
      rows.push(item);
      continue;
    }
    const parsed = parseFinal(raw);
    item.cannotExpress = parsed.cannotExpress ?? null;
    if (parsed.status !== 'parsed') {
      item.status = parsed.status; item.errors = parsed.errors;
      blockedSessions.add(row.session); rows.push(item); continue;
    }
    item.specSha256 = sha(JSON.stringify(parsed.spec));
    const validationErrors = safeSpec(parsed.spec, row.scenario, row.arm);
    if (validationErrors.length) {
      item.status = 'schema'; item.errors = validationErrors;
      blockedSessions.add(row.session); rows.push(item); continue;
    }
    item.semanticErrors = semanticErrors(parsed.spec, row.scenario);
    item.status = parsed.cannotExpress ? row.support.supported ? 'unexpected-unexpressible' : 'declared-unexpressible' : 'valid';
    if (item.status === 'unexpected-unexpressible') blockedSessions.add(row.session);
    else histories.set(row.session, [...prior, raw]);
    rows.push(item);
  }
  saveExclusive(path.join(outputDir, 'rows.json'), rows);
  return rows;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error('Use --output with a fresh directory');
  const outputDir = path.resolve(args[outputIndex + 1]);
  const planPath = path.join(here, 'frozen-plan.json');
  const planBytes = fs.readFileSync(planPath);
  const planHash = sha(planBytes);
  let transport;
  let synthetic;
  if (args.includes('--stub')) {
    synthetic = true;
    const { stubTransport } = await import('./stub.mjs');
    transport = stubTransport(args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'valid');
  } else if (args.includes('--live')) {
    synthetic = false;
    const { liveTransport } = await import('./live.mjs');
    transport = liveTransport({ approvalPath: args[args.indexOf('--approval') + 1], outputDir, planHash });
  } else throw new Error('Choose explicit --stub or approved --live');
  const rows = await capture({ outputDir, transport, planHash, synthetic });
  console.log(JSON.stringify({ synthetic, scheduled: rows.length, attempted: rows.filter((row) => row.attempted).length,
    statuses: rows.reduce((counts, row) => (counts[row.status] = (counts[row.status] ?? 0) + 1, counts), {}) }, null, 2));
}
