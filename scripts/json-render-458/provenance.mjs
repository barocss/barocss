// Verify a complete saved capture before replay or viewing; never repair it.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { schedule, promptFor, MODEL, REASONING, PER_ATTEMPT_TIMEOUT_MS } from './plan.mjs';
import { parseFinal, safeSpec, semanticErrors } from './validate.mjs';
import { verifyFrozen } from './freeze.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const usageFor = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw.input_tokens ?? raw.inputTokens, output = raw.output_tokens ?? raw.outputTokens;
  const cached = raw.cached_input_tokens ?? raw.cachedInputTokens ?? 0;
  return [input, output, cached].every((value) => Number.isSafeInteger(value) && value >= 0)
    ? { inputTokens: input, cachedInputTokens: cached, outputTokens: output } : null;
};
const metadata = (row) => Object.fromEntries(['id', 'session', 'scenario', 'arm', 'stage', 'ordinal', 'support', 'required'].map((key) => [key, row[key]]));
export function verifyCapture(captureDir) {
  const manifestBytes = fs.readFileSync(path.join(captureDir, 'manifest.json'));
  const rowsBytes = fs.readFileSync(path.join(captureDir, 'rows.json'));
  const manifest = JSON.parse(manifestBytes), rows = JSON.parse(rowsBytes);
  const planned = schedule();
  if (manifest.kind !== 'codex-ui-458-capture' || manifest.planHash !== verifyFrozen() ||
      manifest.scheduledCount !== planned.length ||
      !same(manifest.planned, planned) || !same(rows.map(metadata), planned.map(metadata))) throw new Error('Capture plan or schedule mismatch');
  const histories = new Map();
  const inventory = { 'manifest.json': sha(manifestBytes), 'rows.json': sha(rowsBytes) };
  for (const row of rows) {
    const dirName = `attempt-${String(row.ordinal).padStart(2, '0')}`;
    const dir = path.join(captureDir, dirName);
    if (!row.attempted) {
      if (fs.existsSync(dir)) throw new Error(`Unattempted cell has an attempt directory: ${row.id}`);
      continue;
    }
    const requestPath = path.join(dir, 'request.json'), reservePath = path.join(dir, 'reservation.json'), transportPath = path.join(dir, 'transport.json');
    const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
    const prior = histories.get(row.session) ?? [];
    const expectedPrompt = promptFor(planned[row.ordinal], prior);
    const reservation = JSON.parse(fs.readFileSync(reservePath, 'utf8'));
    const transport = JSON.parse(fs.readFileSync(transportPath, 'utf8'));
    if (request.id !== row.id || reservation.id !== row.id || reservation.ordinal !== row.ordinal ||
        reservation.planHash !== manifest.planHash || reservation.consumesOneAttempt !== true ||
        reservation.requestSha256 !== sha(JSON.stringify(request)) ||
        request.model !== MODEL || request.reasoning !== REASONING || request.prompt !== expectedPrompt ||
        request.promptSha256 !== sha(expectedPrompt) || request.promptBytes !== Buffer.byteLength(expectedPrompt) ||
        !same(request.priorResponseSha256, prior.map(sha)) || !same(request.support, planned[row.ordinal].support) ||
        !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1 || request.timeoutMs > PER_ATTEMPT_TIMEOUT_MS) throw new Error(`Invalid request/reservation: ${row.id}`);
    const rawPath = path.join(dir, 'raw-final.txt');
    const rawHash = fs.existsSync(rawPath) ? sha(fs.readFileSync(rawPath)) : null;
    if (rawHash !== row.rawFinalSha256 || rawHash !== transport.rawFinalSha256) throw new Error(`Raw final hash mismatch: ${row.id}`);
    if (row.exitCode !== transport.exitCode || row.stopReason !== transport.stopReason || !same(row.usage, usageFor(transport.usage))) throw new Error(`Transport metadata mismatch: ${row.id}`);
    const raw = rawHash ? fs.readFileSync(rawPath, 'utf8') : null;
    let expectedStatus;
    const drift = transport.responseModel && transport.responseModel !== MODEL;
    if (transport.stopReason || transport.exitCode !== 0 || transport.spawnError || raw === null || !usageFor(transport.usage) || drift) {
      expectedStatus = transport.stopReason ?? (drift ? 'model-drift' : !usageFor(transport.usage) ? 'missing-usage' : raw === null ? 'missing-final' : 'transport-failure');
    } else {
      const parsed = parseFinal(raw);
      if (parsed.status !== 'parsed') expectedStatus = parsed.status;
      else {
        const errors = safeSpec(parsed.spec, row.scenario, row.arm);
        expectedStatus = errors.length ? 'schema' : parsed.cannotExpress ? row.support.supported ? 'unexpected-unexpressible' : 'declared-unexpressible' : 'valid';
        if (!errors.length && (!same(row.semanticErrors, semanticErrors(parsed.spec, row.scenario)) || row.specSha256 !== sha(JSON.stringify(parsed.spec)))) throw new Error(`Spec metadata mismatch: ${row.id}`);
      }
    }
    if (row.status !== expectedStatus) throw new Error(`Capture status mismatch: ${row.id}`);
    if (['valid', 'declared-unexpressible'].includes(row.status)) histories.set(row.session, [...prior, raw]);
    for (const name of ['request.json', 'reservation.json', 'transport.json', 'events.jsonl', ...(rawHash ? ['raw-final.txt'] : [])]) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) throw new Error(`Missing evidence ${dirName}/${name}`);
      inventory[`${dirName}/${name}`] = sha(fs.readFileSync(file));
    }
  }
  const found = fs.readdirSync(captureDir).filter((name) => /^attempt-\d+$/.test(name)).sort();
  const expected = rows.filter((row) => row.attempted).map((row) => `attempt-${String(row.ordinal).padStart(2, '0')}`).sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error('Unexpected or missing attempt directory');
  return { manifest, rows, manifestSha256: sha(manifestBytes), evidenceSha256: sha(JSON.stringify(inventory)), inventory };
}
