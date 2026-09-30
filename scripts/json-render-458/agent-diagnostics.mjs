// Private, bounded CLI failure evidence. Never expose these files through the viewer.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const MAX_STDERR_BYTES = 64 * 1024;
export const MAX_ERROR_ITEM_BYTES = 32 * 1024;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const classes = new Set(['quota', 'billing', 'auth', 'approval-or-sandbox', 'other']);

export function classifyDiagnostic(message) {
  const text = String(message);
  if (/quota|rate.limit/i.test(text)) return 'quota';
  if (/bill|credit|payment/i.test(text)) return 'billing';
  if (/auth|login|credential/i.test(text)) return 'auth';
  if (/approval|permission|denied|sandbox/i.test(text)) return 'approval-or-sandbox';
  return 'other';
}

function hasReasoningKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.type === 'reasoning') return true;
  return Object.entries(value).some(([key, child]) =>
    /^(reasoning|analysis|chain_of_thought|hidden_reasoning)$/i.test(key) || hasReasoningKey(child));
}
function hasStructuredReasoning(text) {
  if (/"(?:reasoning|analysis|chain_of_thought|hidden_reasoning)"\s*:|"type"\s*:\s*"reasoning"/i.test(text)) return true;
  return text.split('\n').some((line) => {
    try { return hasReasoningKey(JSON.parse(line)); }
    catch { return false; }
  });
}

export function createAgentDiagnostics(attemptDir) {
  const stderrPath = path.join(attemptDir, 'stderr.txt');
  const errorPath = path.join(attemptDir, 'error-item.jsonl');
  const summaryPath = path.join(attemptDir, 'diagnostics.json');
  const stderrFd = fs.openSync(stderrPath, 'wx', 0o600);
  let stderrBytes = 0, stderrTruncated = false, stderrOmittedReasoning = false;
  let stderrParts = [], errorItemBytes = 0, errorItemTruncated = false;
  let errorItemClass = null, closed = false;
  return {
    stderr(chunk) {
      if (stderrOmittedReasoning) return 'stderr-hidden-reasoning';
      const bytes = Buffer.from(String(chunk), 'utf8');
      const allowed = Math.min(bytes.length, MAX_STDERR_BYTES - stderrBytes);
      if (allowed > 0) { stderrParts.push(bytes.subarray(0, allowed)); stderrBytes += allowed; }
      if (allowed < bytes.length) stderrTruncated = true;
      if (hasStructuredReasoning(Buffer.concat(stderrParts).toString('utf8'))) {
        stderrOmittedReasoning = true;
        stderrParts = [];
        stderrBytes = 0;
      }
      return stderrOmittedReasoning ? 'stderr-hidden-reasoning' : stderrTruncated ? 'stderr-limit' : null;
    },
    errorItem(line) {
      if (errorItemBytes) return errorItemClass;
      const event = JSON.parse(line);
      if (!event.type?.startsWith('item.') || event.item?.type !== 'error') throw new Error('Not a CLI error item');
      if (hasReasoningKey(event)) throw new Error('Error item contains hidden reasoning');
      const bytes = Buffer.from(line + '\n', 'utf8');
      errorItemClass = classifyDiagnostic(JSON.stringify(event.item));
      errorItemBytes = Math.min(bytes.length, MAX_ERROR_ITEM_BYTES);
      errorItemTruncated = bytes.length > MAX_ERROR_ITEM_BYTES;
      const fd = fs.openSync(errorPath, 'wx', 0o600);
      try { fs.writeSync(fd, bytes, 0, errorItemBytes); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); fs.chmodSync(errorPath, 0o400); }
      return errorItemClass;
    },
    close() {
      if (closed) return;
      closed = true;
      if (!stderrOmittedReasoning && hasStructuredReasoning(Buffer.concat(stderrParts).toString('utf8'))) {
        stderrOmittedReasoning = true;
        stderrParts = [];
        stderrBytes = 0;
      }
      for (const part of stderrParts) fs.writeSync(stderrFd, part);
      fs.fsyncSync(stderrFd); fs.closeSync(stderrFd); fs.chmodSync(stderrPath, 0o400);
      const summary = { kind: 'barocss-458-private-cli-diagnostics',
        stderrBytes, stderrSha256: sha(fs.readFileSync(stderrPath)), stderrTruncated, stderrOmittedReasoning,
        errorItemBytes, errorItemSha256: errorItemBytes ? sha(fs.readFileSync(errorPath)) : null,
        errorItemTruncated, errorItemClass };
      const fd = fs.openSync(summaryPath, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(summary) + '\n'); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); fs.chmodSync(summaryPath, 0o400); }
      return summary;
    },
  };
}

export function verifyAgentDiagnostics(attemptDir) {
  const summaryPath = path.join(attemptDir, 'diagnostics.json');
  const stderrPath = path.join(attemptDir, 'stderr.txt');
  const errorPath = path.join(attemptDir, 'error-item.jsonl');
  const summary = JSON.parse(fs.readFileSync(summaryPath));
  const stderr = fs.readFileSync(stderrPath);
  const error = fs.existsSync(errorPath) ? fs.readFileSync(errorPath) : null;
  for (const file of [summaryPath, stderrPath, ...(error ? [errorPath] : [])]) {
    if (!fs.lstatSync(file).isFile() || (fs.statSync(file).mode & 0o077) !== 0) throw new Error('Private diagnostics mode or file type drift');
  }
  if (summary.kind !== 'barocss-458-private-cli-diagnostics' ||
      !Number.isSafeInteger(summary.stderrBytes) || summary.stderrBytes !== stderr.length ||
      stderr.length > MAX_STDERR_BYTES || summary.stderrSha256 !== sha(stderr) ||
      typeof summary.stderrTruncated !== 'boolean' ||
      typeof summary.stderrOmittedReasoning !== 'boolean' ||
      (summary.stderrOmittedReasoning ? stderr.length !== 0 : hasStructuredReasoning(stderr.toString('utf8'))) ||
      !Number.isSafeInteger(summary.errorItemBytes) || summary.errorItemBytes !== (error?.length ?? 0) ||
      (error?.length ?? 0) > MAX_ERROR_ITEM_BYTES || summary.errorItemSha256 !== (error ? sha(error) : null) ||
      typeof summary.errorItemTruncated !== 'boolean' ||
      (error ? !classes.has(summary.errorItemClass) : summary.errorItemClass !== null)) throw new Error('Private diagnostics binding drift');
  if (error && !summary.errorItemTruncated) {
    const event = JSON.parse(error.toString('utf8'));
    if (!event.type?.startsWith('item.') || event.item?.type !== 'error' || hasReasoningKey(event) ||
        classifyDiagnostic(JSON.stringify(event.item)) !== summary.errorItemClass) throw new Error('Private error-item classification drift');
  }
  return { summary, files: Object.fromEntries([summaryPath, stderrPath, ...(error ? [errorPath] : [])]
    .map((file) => [path.basename(file), sha(fs.readFileSync(file))])) };
}
