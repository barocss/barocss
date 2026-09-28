import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';
import { SCENARIOS, CONTRACT } from './plan.mjs';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const rowStatus = (status, reason, outputDir = null) => ({ status, reason, outputDir });
const terminalStop = new Set(['approval-denied', 'login-uncertain', 'quota-uncertain',
  'ambiguous-completion', 'timeout', 'provenance-loss', 'transport-failure']);

function writeManifest(file, manifest) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'w' });
  fs.renameSync(temporary, file);
}

export function inspectTurn(result, kind, name, expectedThreadId = null) {
  if (!result || typeof result.threadId !== 'string' || typeof result.specJson !== 'string') {
    return { status: 'invalid', reason: 'invalid-envelope' };
  }
  if (expectedThreadId && result.threadId !== expectedThreadId) {
    return { status: 'failed', reason: 'provenance-loss' };
  }
  let spec;
  try { spec = JSON.parse(result.specJson); }
  catch { return { status: 'invalid', reason: 'invalid-json' }; }
  const checked = validateSpec(spec);
  if (!checked.ok) return { status: 'invalid', reason: `schema:${checked.errors[0].path}` };
  const nodes = Object.values(spec.elements);
  if (kind === 'initial' && (spec.elements.name?.type !== 'Input'
    || spec.elements.save?.type !== 'Button'
    || nodes.filter((node) => node.type === 'Input').length !== 1
    || nodes.filter((node) => node.type === 'Button' && node.on?.press?.action === 'save').length !== 1)) {
    return { status: 'invalid', reason: 'initial-form-contract' };
  }
  if (kind === 'next' && !nodes.some((node) => node.type === 'Text'
    && [name, `Name: ${name}`].includes(node.props.text))) {
    return { status: 'invalid', reason: 'next-name-contract' };
  }
  return { status: 'valid', reason: null, specSha256: sha256(result.specJson), threadId: result.threadId };
}

export function classifyTransportFailure(error) {
  const code = error?.validationCode;
  const message = error instanceof Error ? error.message : '';
  if (code === 'session-drift' || code === 'final-event-mismatch' || code === 'final-missing') return 'provenance-loss';
  if (/timeout/i.test(message)) return 'timeout';
  if (/approval|denied/i.test(message)) return 'approval-denied';
  if (/login|auth/i.test(message)) return 'login-uncertain';
  if (/quota|billing|usage/i.test(message)) return 'quota-uncertain';
  if (code === 'transport-incomplete') return 'ambiguous-completion';
  return 'transport-failure';
}

// The caller writes one durable reservation before each generate() call. A failed or
// ambiguous call consumes that reservation. This function never retries a turn.
export async function collectRows({ manifestFile, reserve, sessionFactory, outputDirectory,
  onChange = () => {}, clock = () => Date.now(), deadlineMs = CONTRACT.wholeRunTimeoutMs,
  scenarios = SCENARIOS, calibration, requireSavedFinal = false }) {
  if (!manifestFile || !path.isAbsolute(manifestFile) || typeof reserve !== 'function'
    || typeof sessionFactory !== 'function' || typeof outputDirectory !== 'function'
    || !calibration || calibration.id !== '01') throw new Error('Complete frozen corpus setup required');
  if (fs.existsSync(manifestFile)) throw new Error('Corpus manifest already exists');
  const started = clock();
  const manifest = { kind: CONTRACT.kind, contract: CONTRACT, startedAt: new Date().toISOString(),
    priorDispatches: CONTRACT.priorDispatches, newReservations: 0,
    stopReason: null, rows: scenarios.map(({ id, prompt, name }) => ({ id, prompt, name,
      initial: rowStatus('unattempted', 'pending'), next: rowStatus('unattempted', 'pending') })) };
  manifest.rows[0].initial = { ...calibration.initial };
  manifest.rows[0].next = { ...calibration.next };
  const save = () => { writeManifest(manifestFile, manifest); onChange(structuredClone(manifest)); };
  save();
  for (let index = 1; index < manifest.rows.length; index++) {
    const row = manifest.rows[index];
    if (manifest.stopReason) {
      row.initial = rowStatus('unattempted', manifest.stopReason);
      row.next = rowStatus('unattempted', manifest.stopReason);
      save();
      continue;
    }
    if (manifest.newReservations >= CONTRACT.newDispatchCeiling) {
      row.initial = rowStatus('ceiling', 'aggregate-20-dispatch-ceiling');
      row.next = rowStatus('ceiling', 'aggregate-20-dispatch-ceiling');
      save();
      continue;
    }
    if (clock() - started >= deadlineMs) {
      manifest.stopReason = 'whole-run-timeout';
      row.initial = rowStatus('unattempted', manifest.stopReason);
      row.next = rowStatus('unattempted', manifest.stopReason);
      save();
      continue;
    }
    const outputDir = outputDirectory(row.id);
    let generate;
    try { generate = await sessionFactory(row, outputDir); }
    catch {
      manifest.stopReason = 'session-setup-failure';
      row.initial = rowStatus('unattempted', manifest.stopReason, outputDir);
      row.next = rowStatus('unattempted', manifest.stopReason, outputDir);
      save();
      continue;
    }
    try {
    let sessionId;
    for (const kind of ['initial', 'next']) {
      if (kind === 'next' && row.initial.status !== 'valid') {
        row.next = rowStatus('unattempted', 'invalid-or-failed-initial');
        save();
        break;
      }
      if (manifest.newReservations >= CONTRACT.newDispatchCeiling) {
        row[kind] = rowStatus('ceiling', 'aggregate-20-dispatch-ceiling');
        save();
        break;
      }
      if (clock() - started >= deadlineMs) {
        manifest.stopReason = 'whole-run-timeout';
        row[kind] = rowStatus('unattempted', manifest.stopReason);
        save();
        break;
      }
      const ordinal = CONTRACT.priorDispatches + manifest.newReservations + 1;
      try { reserve({ ordinal, rowId: row.id, kind, outputDir }); }
      catch {
        manifest.stopReason = 'reservation-failure';
        row[kind] = rowStatus('unattempted', manifest.stopReason, outputDir);
        save();
        break;
      }
      manifest.newReservations++;
      row[kind] = rowStatus('reserved', 'dispatch-outcome-pending', outputDir);
      save();
      try {
        const result = await generate(kind === 'initial'
          ? { kind, prompt: row.prompt }
          : { kind, action: 'save', revision: 1, input: { name: row.name }, threadId: sessionId });
        const checked = inspectTurn(result, kind, row.name, kind === 'next' ? sessionId : null);
        let rawSha256 = null;
        if (requireSavedFinal) {
          try {
            const raw = fs.readFileSync(path.join(outputDir, `${kind}-final.txt`));
            const envelope = JSON.parse(raw.toString('utf8'));
            if (Object.keys(envelope).join(',') !== 'specJson' || envelope.specJson !== result.specJson) {
              throw new Error('Saved final output changed');
            }
            rawSha256 = sha256(raw);
          } catch {
            throw Object.assign(new Error('Saved final output lost'), { validationCode: 'final-event-mismatch' });
          }
        }
        row[kind] = { ...checked, outputDir };
        if (rawSha256) row[kind].rawSha256 = rawSha256;
        if (kind === 'initial' && checked.status === 'valid') sessionId = result.threadId;
        if (checked.status === 'failed') manifest.stopReason = checked.reason;
      } catch (error) {
        const reason = classifyTransportFailure(error);
        row[kind] = rowStatus('failed', reason, outputDir);
        if (terminalStop.has(reason)) manifest.stopReason = reason;
      }
      save();
      if (manifest.stopReason) break;
    }
    if (row.next.status === 'unattempted' && row.next.reason === 'pending') {
      row.next = rowStatus('unattempted', manifest.stopReason ?? 'invalid-or-failed-initial');
      save();
    }
    } finally {
      try { await generate.close?.(); }
      catch {
        manifest.stopReason = 'isolation-cleanup-failure';
        save();
      }
    }
  }
  manifest.finishedAt = new Date().toISOString();
  save();
  return manifest;
}
