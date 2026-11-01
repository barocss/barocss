/** One bounded census process group. Caller owns the heavy gate. No numerical work in this wrapper. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, openSync, readSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const [receiptId, censusId] = process.argv.slice(2);
const valid = value => /^[a-z0-9][a-z0-9-]{0,95}$/.test(value ?? '');
function need(value, message) { if (!value) throw Error(message); }
need(process.argv.length === 4 && valid(receiptId) && valid(censusId) && receiptId !== censusId,
  'usage: node support-radius-controls-run.mjs fresh-wrapper-receipt-id fresh-controls-id');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const out = join(here, 'evidence', receiptId), census = join(here, 'evidence', censusId);
need(!existsSync(out) && !existsSync(census), 'both wrapper and census IDs must be fresh');
const sha = data => createHash('sha256').update(data).digest('hex');
const inputNames = ['support-radius-controls-run.mjs', 'support-radius-controls.py', 'support-radius-cache.py', 'CACHE-CONTRACT.md', 'CACHE-CONTROLS.json', 'cache-implementation-freeze-01.json', 'cost-census.py'];
const inputs = Object.fromEntries(inputNames.map(name => {
  const bytes = readFileSync(join(here, name)); return [name, { bytes: bytes.length, sha256: sha(bytes) }];
}));
mkdirSync(out, { recursive: true });
const TIMEOUT_MS = 180000, TERM_GRACE_MS = 1000, KILL_CLOSE_MS = 2000;
const OUTPUT_LIMIT = 4 * 1024 * 1024;
const command = ['python3', '-B', join(here, 'support-radius-controls.py'), '--run-id', censusId];
const receipt = { kind: 'P4_SUPPORT_RADIUS_PRIMITIVES_OUTER_GUARD', receiptId, censusId, status: 'PREPARED',
  node: process.version, executable: process.execPath, command, cwd: root, inputs,
  timeoutMs: TIMEOUT_MS, terminationGraceMs: TERM_GRACE_MS, postKillCloseWaitMs: KILL_CLOSE_MS,
  timingBoundary: '180000ms census deadline; termination/reaping/final receipt are separate bounded cleanup',
  combinedOutputLimitBytes: OUTPUT_LIMIT, startedAt: null, spawnAt: null, pid: null, processGroupId: null,
  exit: null, signal: null, timedOut: false, stopReason: null, processClosed: false, groupSignals: [],
  parentWorldCalls: 0, parentReferenceCalls: 0, parentGeometryCalls: 0, retries: 0,
  censusSummaryPath: join(census, 'summary.json'), censusProgressPath: join(census, 'progress.json'), errors: [] };
function durableJSON(name, value, exclusive = false) {
  const descriptor = openSync(join(out, name), exclusive ? 'wx' : 'w');
  try {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); let written = 0;
    while (written < bytes.length) written += writeSync(descriptor, bytes, written, bytes.length - written);
    fsyncSync(descriptor);
  }
  finally { closeSync(descriptor); }
}
durableJSON('prepared.json', receipt, true);
const logs = Object.fromEntries(['stdout', 'stderr'].map(name => [name, {
  fd: openSync(join(out, name + '.raw'), 'wx'), hash: createHash('sha256'),
  observedBytes: 0, capturedBytes: 0, omittedBytes: 0, eof: false, writeError: null,
}]));
let capturedTotal = 0, child = null, spawnPid = null, finished = false;
let deadlineTimer = null, termTimer = null, closeTimer = null;
const clockStart = process.hrtime.bigint();
let spawnClock = null;
function elapsedMs() { return Number(process.hrtime.bigint() - clockStart) / 1e6; }
function progress() { durableJSON('progress.json', { ...receipt, elapsedMs: elapsedMs(), outputCapturedBytes: capturedTotal }); }
function signalOwnedGroup(name) {
  // detached:true creates this child as the leader of its own new session/group.
  if (!Number.isSafeInteger(spawnPid) || spawnPid <= 1 || spawnPid === process.pid) return;
  try { process.kill(-spawnPid, name); receipt.groupSignals.push({ signal: name, elapsedMs: elapsedMs(), result: 'SENT' }); }
  catch (error) {
    receipt.groupSignals.push({ signal: name, elapsedMs: elapsedMs(), result: error.code === 'ESRCH' ? 'GROUP_ABSENT' : 'ERROR', code: error.code });
    if (error.code !== 'ESRCH') receipt.errors.push({ phase: 'group-signal', code: error.code, message: error.message });
  }
}
function ownedGroupAlive() {
  if (!Number.isSafeInteger(spawnPid) || spawnPid <= 1 || spawnPid === process.pid) return false;
  try { process.kill(-spawnPid, 0); return true; }
  catch (error) {
    if (error.code === 'ESRCH') return false;
    receipt.errors.push({ phase: 'group-existence', code: error.code, message: error.message }); return true;
  }
}
function censusState(name) {
  const path = join(census, name);
  if (!existsSync(path)) return { path, present: false };
  try {
    const descriptor = openSync(path, 'r');
    let bytes;
    try {
      // Progress may be in the middle of an ordinary overwrite. Keep parse errors
      // explicit and retain the original census file; never invent call counts.
      const limit = 8 * 1024 * 1024, buffer = Buffer.alloc(limit + 1); let count = 0;
      while (count < buffer.length) { const amount = readSync(descriptor, buffer, count, buffer.length - count, count); if (!amount) break; count += amount; }
      bytes = buffer.subarray(0, count);
    } finally { closeSync(descriptor); }
    if (bytes.length > 8 * 1024 * 1024) return { path, present: true, bytes: bytes.length, status: 'OVERSIZED_NOT_INTERPRETED' };
    try {
      const data = JSON.parse(bytes);
      return { path, present: true, bytes: bytes.length, sha256: sha(bytes), status: data.status ?? null,
        counts: data.counts ?? null, referenceCallCounts: data.referenceCallCounts ?? null,
        firstFailure: data.firstFailure ?? null };
    } catch (error) { return { path, present: true, bytes: bytes.length, sha256: sha(bytes), status: 'INCOMPLETE_OR_INVALID_JSON', parseError: error.message }; }
  } catch (error) { return { path, present: true, status: 'READ_ERROR', error: error.message }; }
}
function finish(forced = false) {
  if (finished) return;
  finished = true;
  clearTimeout(deadlineTimer); clearTimeout(termTimer); clearTimeout(closeTimer);
  if (forced) {
    signalOwnedGroup('SIGKILL');
    child?.stdout?.destroy(); child?.stderr?.destroy();
    receipt.errors.push({ phase: 'cleanup', message: 'owned census group did not close all pipes before post-kill deadline' });
  }
  receipt.finishedAt = new Date().toISOString(); receipt.elapsedMs = elapsedMs();
  receipt.ownedGroupPresentAtFinalization = ownedGroupAlive();
  receipt.censusElapsedMs = spawnClock === null ? null : Number(process.hrtime.bigint() - spawnClock) / 1e6;
  receipt.cleanupElapsedMs = receipt.stopRequestedAtMs === undefined ? 0 : receipt.elapsedMs - receipt.stopRequestedAtMs;
  receipt.output = {};
  for (const [name, log] of Object.entries(logs)) {
    try { fsyncSync(log.fd); } catch (error) { receipt.errors.push({ phase: name + '-fsync', message: error.message }); }
    try { closeSync(log.fd); } catch (error) { receipt.errors.push({ phase: name + '-close', message: error.message }); }
    receipt.output[name] = { observedBytes: log.observedBytes, capturedBytes: log.capturedBytes,
      omittedBytes: log.omittedBytes, sha256: log.hash.digest('hex'), eof: log.eof, writeError: log.writeError };
  }
  receipt.censusSummary = censusState('summary.json'); receipt.censusProgress = censusState('progress.json');
  receipt.status = !receipt.stopReason && receipt.exit === 0 && receipt.signal === null && receipt.processClosed &&
    receipt.censusSummary.status === 'PASS_SUPPORT_RADIUS_PRIMITIVES' && receipt.errors.length === 0 && Object.values(logs).every(log => log.eof) ? 'PASS' : 'FAIL';
  receipt.callCountBoundary = 'Only counts present in original census progress/summary/timing receipts are reported; a timeout never implies the primitive call population completed.';
  durableJSON('result.json', receipt, true);
  console.log(JSON.stringify({ receiptId, censusId, status: receipt.status, exit: receipt.exit, signal: receipt.signal,
    timedOut: receipt.timedOut, stopReason: receipt.stopReason, elapsedMs: receipt.elapsedMs,
    censusSummary: receipt.censusSummary.status ?? 'NOT_PRESENT', censusCounts: receipt.censusSummary.counts ?? receipt.censusProgress.counts ?? null }));
  process.exitCode = receipt.status === 'PASS' ? 0 : 1;
  if (forced) process.exit(process.exitCode);
}
function stop(reason) {
  if (finished || receipt.stopReason) return;
  receipt.stopReason = reason; receipt.stopRequestedAtMs = elapsedMs();
  if (reason === 'CENSUS_TIMEOUT') receipt.timedOut = true;
  signalOwnedGroup('SIGTERM'); progress();
  termTimer = setTimeout(() => {
    signalOwnedGroup('SIGKILL'); progress();
    closeTimer = setTimeout(() => finish(!receipt.processClosed || ownedGroupAlive()), KILL_CLOSE_MS);
  }, TERM_GRACE_MS);
}
function capture(name, chunk) {
  if (finished) return;
  const log = logs[name]; log.observedBytes += chunk.length;
  const capturedBefore = log.capturedBytes;
  const keep = Math.min(chunk.length, OUTPUT_LIMIT - capturedTotal), bytes = chunk.subarray(0, keep);
  if (keep) {
    try {
      let written = 0;
      while (written < bytes.length) {
        const amount = writeSync(log.fd, bytes, written, bytes.length - written);
        need(amount > 0, 'output write made no progress');
        log.hash.update(bytes.subarray(written, written + amount)); written += amount;
        capturedTotal += amount; log.capturedBytes += amount;
      }
    }
    catch (error) { log.writeError = error.message; receipt.errors.push({ phase: name + '-write', message: error.message }); stop('OUTPUT_WRITE_FAILURE'); }
  }
  log.omittedBytes += chunk.length - (log.capturedBytes - capturedBefore);
  if (keep < chunk.length) stop('COMBINED_OUTPUT_LIMIT');
}

receipt.startedAt = new Date().toISOString(); receipt.status = 'SPAWNING';
durableJSON('start.json', receipt, true);
try {
  spawnClock = process.hrtime.bigint();
  child = spawn(command[0], command.slice(1), { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnPid = child.pid ?? null;
  receipt.pid = spawnPid; receipt.processGroupId = spawnPid;
  deadlineTimer = setTimeout(() => stop('CENSUS_TIMEOUT'), Math.max(0, TIMEOUT_MS - Number(process.hrtime.bigint() - spawnClock) / 1e6));
  child.on('spawn', () => { receipt.spawnAt = new Date().toISOString(); receipt.status = 'RUNNING'; progress(); console.log(JSON.stringify({ receiptId, censusId, pid: spawnPid, status: 'RUNNING', timeoutMs: TIMEOUT_MS })); });
  child.on('error', error => { receipt.errors.push({ phase: 'spawn', code: error.code, message: error.message }); stop('SPAWN_ERROR'); });
  for (const name of ['stdout', 'stderr']) {
    child[name].on('data', chunk => capture(name, chunk));
    child[name].on('end', () => { logs[name].eof = true; });
    child[name].on('error', error => { receipt.errors.push({ phase: name + '-pipe', message: error.message }); stop('OUTPUT_PIPE_ERROR'); });
  }
  child.on('exit', (code, signal) => {
    receipt.exit = code; receipt.signal = signal; receipt.exitAt = new Date().toISOString();
    if (code !== 0 || signal) stop('CENSUS_EXIT_FAILURE');
    // A clean parent exit must also close inherited pipes. If it does not, the
    // external deadline still terminates only this census process group.
  });
  child.on('close', (code, signal) => {
    receipt.exit = code; receipt.signal = signal; receipt.processClosed = true;
    if (!ownedGroupAlive()) finish();
    else if (!receipt.stopReason) stop('OWNED_GROUP_REMAINS_AFTER_PARENT_CLOSE');
  });
} catch (error) {
  receipt.errors.push({ phase: 'spawn-sync', code: error.code, message: error.message });
  receipt.stopReason = 'SPAWN_ERROR'; finish();
}
